import { createRoute, z } from '@hono/zod-openapi';
import {
  BranchCode,
  CompanyRatingDto,
  PersonRatingDto,
  PersonRatingSummaryDto,
  RatingHistoryQuery,
  RatingTransactionDto,
  TransferRatingInput,
  Uuid,
} from '@kinoacademia/shared';
import type { Context } from 'hono';
import type { AuthVariables } from '../auth/middleware';
import { requireAuth, requireRole } from '../auth/middleware';
import { ownsCompany } from '../auth/ownership';
import { db } from '../db/client';
import { findCompanyById, listCompanies } from '../modules/companies/companies-repo';
import {
  findOpenPersonByUserId,
  findPersonById,
  listPersons,
} from '../modules/persons/persons-repo';
import * as ratings from '../modules/ratings/ratings.service';
import { createOpenAPIApp } from '../openapi/app';
import { apiError, errorResponses } from '../openapi/responses';
import { handleRatingError } from './rating-error';

type Env = { Variables: AuthVariables };

const requireOwnPerson = async (c: Context) => {
  const user = c.get('user') as AuthVariables['user'];
  const person = await findOpenPersonByUserId(user.id);
  if (!person) return null;
  return person;
};

const CompanyIdParam = z.object({
  id: Uuid,
});

const PersonIdParam = z.object({
  id: Uuid,
});

const AdmireResponse = z.object({
  donor: PersonRatingDto,
  transaction: RatingTransactionDto,
});

export const PersonNameEntry = z.object({
  displayName: z.string(),
});

export const CompanyNameEntry = z.object({
  name: z.string(),
  branchCode: BranchCode,
});

const AllRatingsResponse = z.object({
  persons: z.array(PersonRatingDto),
  companies: z.array(CompanyRatingDto),
  personNames: z.record(Uuid, PersonNameEntry),
  companyNames: z.record(Uuid, CompanyNameEntry),
});

/**
 * Общая выборка для сводных экранов рейтинга. Разбивку персонажей сериализует
 * вызывающая сторона: игровые экраны получают свёрнутую, админка — полную.
 */
export const collectAllRatings = async () => {
  const [personRatings, companyRatings, allPersons, allCompanies] = await Promise.all([
    ratings.listAllPersonRatingsWithStar(),
    ratings.listAllCompanyRatings(),
    listPersons(),
    listCompanies(),
  ]);
  const personNames: Record<string, { displayName: string }> = {};
  for (const p of allPersons) {
    personNames[p.id] = { displayName: p.displayName };
  }
  const companyNames: Record<string, { name: string; branchCode: BranchCode }> = {};
  for (const cmp of allCompanies) {
    companyNames[cmp.id] = { name: cmp.name, branchCode: cmp.branchCode };
  }
  return {
    personRatings,
    companies: companyRatings.map(ratings.toCompanyRatingDto),
    personNames,
    companyNames,
  };
};

const CompanyRatingResponse = z.object({
  rating: CompanyRatingDto,
  history: z.array(RatingTransactionDto),
});

const getMyRatingRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['ratings'],
  summary: 'Get my person rating',
  description:
    "Retrieve rating for currently authenticated user's active person. Returns rating details including generated, permanent, base, topups, penalties, and star status. See rating formulas in README.",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Person rating data',
      content: {
        'application/json': {
          schema: PersonRatingDto.openapi('PersonRatingDto'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getPersonRatingSummaryRoute = createRoute({
  method: 'get',
  path: '/person/:id/summary',
  tags: ['ratings'],
  summary: "Get another person's rating summary",
  description:
    'Lightweight rating summary (permanent rating total and star status only, no breakdown) for any open person. Available to any authenticated user. Used for the rating comparison feature ("Встречная проверка рейтинга") on the home page.',
  security: [{ cookieAuth: [] }],
  request: {
    params: PersonIdParam,
  },
  responses: {
    200: {
      description: 'Person rating summary',
      content: {
        'application/json': {
          schema: PersonRatingSummaryDto.openapi('PersonRatingSummaryDto'),
        },
      },
    },
    401: errorResponses[401],
    404: errorResponses[404],
  },
});

const admireRoute = createRoute({
  method: 'post',
  path: '/me/admire',
  tags: ['ratings'],
  summary: 'Express admiration (transfer rating)',
  description:
    "Transfer rating points from current person to another person (admiration mechanic). Deducts from donor's variable rating (generated) and adds the amount — multiplied by 5 when the donor is a Star — to the recipient's permanent rating (systemTopup). Cannot transfer to self.",
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: TransferRatingInput.openapi('TransferRatingInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Admiration expressed successfully',
      content: {
        'application/json': {
          schema: AdmireResponse.openapi('AdmireResponse'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    501: errorResponses[501],
  },
});

const getMyHistoryRoute = createRoute({
  method: 'get',
  path: '/me/history',
  tags: ['ratings'],
  summary: 'Get my rating history',
  description:
    "List rating transactions for currently authenticated user's active person. Optional filters by kind and limit.",
  security: [{ cookieAuth: [] }],
  request: {
    query: RatingHistoryQuery,
  },
  responses: {
    200: {
      description: 'Rating transaction history',
      content: {
        'application/json': {
          schema: z.array(RatingTransactionDto).openapi('RatingTransactionList'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getAllRatingsRoute = createRoute({
  middleware: [requireRole('info', 'admin')] as const,
  method: 'get',
  path: '/all',
  tags: ['ratings'],
  summary: 'Get all ratings',
  description:
    'List all person and company ratings in the system. Info or admin role required. Used for leaderboards and dashboards.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'All ratings data',
      content: {
        'application/json': {
          schema: AllRatingsResponse.openapi('AllRatingsResponse'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getCompanyRatingRoute = createRoute({
  middleware: [requireRole('head', 'admin', 'info')] as const,
  method: 'get',
  path: '/company/:id',
  tags: ['ratings'],
  summary: 'Get company rating',
  description:
    'Retrieve company rating and transaction history. Head users can only access their own company. Admin and info roles can access any company.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyIdParam,
  },
  responses: {
    200: {
      description: 'Company rating data with history',
      content: {
        'application/json': {
          schema: CompanyRatingResponse.openapi('CompanyRatingResponse'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export const ratingsRoutes = createOpenAPIApp<Env>();

ratingsRoutes.use('*', requireAuth);

ratingsRoutes.openapi(getMyRatingRoute, async (c) => {
  const person = await requireOwnPerson(c);
  if (!person) return apiError(c, 403, { code: 'forbidden', message: 'No active person' });
  const { row, isStar } = await ratings.getPersonRating(person.id);
  return c.json(ratings.toPersonRatingDto(row, isStar), 200);
});

ratingsRoutes.openapi(getPersonRatingSummaryRoute, async (c) => {
  const { id } = c.req.valid('param');
  const person = await findPersonById(id);
  if (!person || !person.isOpen) {
    return apiError(c, 404, { code: 'not_found', message: 'Person not found' });
  }
  const { row, isStar } = await ratings.getPersonRating(id);
  const summary: PersonRatingSummaryDto = {
    personId: row.personId,
    nowPermanent: row.nowPermanent,
    isStar,
  };
  return c.json(summary, 200);
});

ratingsRoutes.openapi(admireRoute, async (c) => {
  const user = c.get('user') as AuthVariables['user'];
  const person = await requireOwnPerson(c);
  if (!person) return apiError(c, 403, { code: 'forbidden', message: 'No active person' });

  const { recipientPersonId, amount, comment } = c.req.valid('json');

  if (recipientPersonId === person.id) {
    return apiError(c, 409, {
      code: 'conflict',
      message: 'Cannot transfer rating to yourself',
    });
  }

  try {
    const result = await ratings.expressAdmiration({
      donorPersonId: person.id,
      recipientPersonId,
      amount,
      actorUserId: user.id,
      ...(comment !== undefined && { comment }),
    });
    const isStar = await ratings.getPersonRating(person.id).then((r) => r.isStar);
    return c.json(
      {
        donor: ratings.toPersonRatingDto(result.donor, isStar),
        transaction: ratings.toTransactionDto(result.tx),
      },
      200,
    );
  } catch (err) {
    return handleRatingError(c, err);
  }
});

ratingsRoutes.openapi(getMyHistoryRoute, async (c) => {
  const person = await requireOwnPerson(c);
  if (!person) return apiError(c, 403, { code: 'forbidden', message: 'No active person' });

  const { limit, kind } = c.req.valid('query');

  const rows = await ratings.listPersonHistoryForPlayer(person.id, limit, kind);
  return c.json(rows.map(ratings.toTransactionDto), 200);
});

ratingsRoutes.openapi(getAllRatingsRoute, async (c) => {
  const { personRatings, companies, personNames, companyNames } = await collectAllRatings();
  return c.json(
    {
      persons: personRatings.map(({ row, isStar }) => ratings.toPersonRatingDto(row, isStar)),
      companies,
      personNames,
      companyNames,
    },
    200,
  );
});

ratingsRoutes.openapi(getCompanyRatingRoute, async (c) => {
  const { id: companyId } = c.req.valid('param');
  const company = await findCompanyById(companyId);
  if (!company) {
    return apiError(c, 404, { code: 'not_found', message: 'Company not found' });
  }
  const user = c.get('user') as AuthVariables['user'];
  if (user.role === 'head') {
    const owns = await ownsCompany(db, user.id, companyId);
    if (!owns) {
      return apiError(c, 403, { code: 'forbidden', message: 'Not your company' });
    }
  }

  const [row, history] = await Promise.all([
    ratings.getCompanyRating(companyId),
    ratings.listCompanyHistory(companyId),
  ]);
  return c.json(
    {
      rating: ratings.toCompanyRatingDto(row),
      history: history.map(ratings.toTransactionDto),
    },
    200,
  );
});
