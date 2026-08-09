import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      {/*{import.meta.env.DEV && (*/}
      {/*  <>*/}
      {/*    <TanStackRouterDevtools router={router} position="bottom-right" />*/}
      {/*    <ReactQueryDevtools buttonPosition="bottom-left" />*/}
      {/*  </>*/}
      {/*)}*/}
    </QueryClientProvider>
  );
}
