import { serve } from '@hono/node-server';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { queryClient } from './db/client';
import { env, isProduction } from './env';
import { start as startJobsScheduler } from './jobs';
import { logger } from './logger';
import { wireContractRatingHooks } from './modules/ratings/ratings.service';
import { createOpenAPIApp, securitySchemes } from './openapi/app';
import { adminAuditRoutes } from './routes/admin/audit';
import { adminCompaniesRoutes } from './routes/admin/companies';
import { adminContractsRoutes } from './routes/admin/contracts';
import { adminJobsRoutes } from './routes/admin/jobs';
import { adminOscarsRoutes } from './routes/admin/oscars';
import { adminPersonsRoutes } from './routes/admin/persons';
import { adminRandomizerRoutes } from './routes/admin/randomizer';
import { adminRatingsRoutes } from './routes/admin/ratings';
import { adminTransactionsRoutes } from './routes/admin/transactions';
import { adminUsersRoutes } from './routes/admin/users';
import { authRoutes } from './routes/auth';
import { companiesRoutes } from './routes/companies';
import { contractsRoutes } from './routes/contracts';
import { filmsRoutes } from './routes/films';
import { oscarsRoutes } from './routes/oscars';
import { personsRoutes } from './routes/persons';
import { ratingsRoutes } from './routes/ratings';
import { scansRoutes } from './routes/scans';
import { wireWsBroadcasts } from './ws/broadcasts';
import { startHeartbeat } from './ws/hub';
import { setupWs } from './ws/server';

wireContractRatingHooks();
wireWsBroadcasts();

const app = createOpenAPIApp();

app.use(
  '*',
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
);

// Liveness: процесс жив, зависимости не проверяются.
app.get('/health', (c) => c.json({ status: 'ok', version: env.APP_VERSION }));

// Readiness: используется в HEALTHCHECK образа и smoke-проверке после деплоя.
app.get('/health/ready', async (c) => {
  try {
    await queryClient`select 1`;
  } catch (err) {
    logger.error({ err }, 'readiness check failed');
    return c.json(
      { status: 'error', db: 'error', jobs: env.JOBS_ENABLED, version: env.APP_VERSION },
      503,
    );
  }
  return c.json({ status: 'ok', db: 'ok', jobs: env.JOBS_ENABLED, version: env.APP_VERSION });
});

app.route('/api/auth', authRoutes);
app.route('/api/admin/users', adminUsersRoutes);
app.route('/api/admin/persons', adminPersonsRoutes);
app.route('/api/admin/companies', adminCompaniesRoutes);
app.route('/api/admin/contracts', adminContractsRoutes);
app.route('/api/admin/transactions', adminTransactionsRoutes);
app.route('/api/admin/randomizer', adminRandomizerRoutes);
app.route('/api/admin/ratings', adminRatingsRoutes);
app.route('/api/admin/jobs', adminJobsRoutes);
app.route('/api/admin/audit', adminAuditRoutes);
app.route('/api/admin/oscars', adminOscarsRoutes);
app.route('/api/companies', companiesRoutes);
app.route('/api/contracts', contractsRoutes);
app.route('/api/films', filmsRoutes);
app.route('/api/oscars', oscarsRoutes);
app.route('/api/persons', personsRoutes);
app.route('/api/ratings', ratingsRoutes);
app.route('/api/scans', scansRoutes);

const ws = setupWs(app);

const apiDocsEnabled = !isProduction || env.ENABLE_API_DOCS;

if (apiDocsEnabled) {
  // Схема авторизации регистрируется через реестр: в @hono/zod-openapi 1.x
  // поле `components` в app.doc() больше не принимается.
  app.openAPIRegistry.registerComponent(
    'securitySchemes',
    'cookieAuth',
    securitySchemes.cookieAuth,
  );

  app.doc('/api/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Kinoacademia API',
      version: '0.1.0',
      description:
        'Backend API for Kinoacademia game. Manages users, persons (characters), companies, contracts, and ratings. All protected endpoints use cookie-based authentication (ka_access HttpOnly cookie). See contract state diagram and rating formulas in README.',
    },
    servers: [
      {
        url: isProduction ? env.WEB_ORIGIN : 'http://localhost:3000',
        description: isProduction ? 'Production' : 'Development',
      },
    ],
    tags: [
      { name: 'auth', description: 'Authentication and session management' },
      { name: 'users', description: 'User management (admin only)' },
      { name: 'persons', description: 'Person (character) management' },
      { name: 'companies', description: 'Company management and queries' },
      {
        name: 'contracts',
        description: 'Contract lifecycle management (permanent/temporary, state transitions)',
      },
      {
        name: 'ratings',
        description:
          'Rating system (generated, permanent, randomizer, topups, penalties, admiration)',
      },
      { name: 'films', description: 'Films, assignments (cinema companies)' },
      { name: 'oscars', description: 'Oscar nominations and awards' },
      { name: 'scans', description: 'Contract scans (sets + pages, storage-agnostic)' },
      { name: 'admin', description: 'Administrative operations' },
    ],
  });

  app.get(
    '/api/docs',
    apiReference({
      theme: 'purple',
      url: '/api/openapi.json',
    }),
  );
}

if (process.env.VITEST !== 'true') {
  const server = serve({ fetch: app.fetch, port: env.PORT }, () => {
    console.log(`API running on http://localhost:${env.PORT}`);
    if (apiDocsEnabled) {
      console.log(`API docs available at http://localhost:${env.PORT}/api/docs`);
    }
  });
  ws.injectWebSocket(server);
  startHeartbeat();

  if (env.JOBS_ENABLED) {
    startJobsScheduler().catch((err) => {
      logger.error({ err }, 'failed to start jobs scheduler');
    });
  }
}

export default app;
