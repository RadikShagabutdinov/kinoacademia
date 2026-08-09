import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/company/')({
  beforeLoad: () => {
    throw redirect({ to: '/company/rating' });
  },
});
