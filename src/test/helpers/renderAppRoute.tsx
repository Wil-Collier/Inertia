import { render } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type AnyRouter,
  type NotFoundRouteProps,
} from "@tanstack/react-router"
import type { ReactElement } from "react"
import { createTestQueryClient } from "@/test/helpers/queryHookTestUtils"

type RouteComponent = () => ReactElement

interface TestRoute {
  path: string
  component: RouteComponent
}

interface RenderAppRouteOptions {
  initialPath: string
  routes: TestRoute[]
  queryClient?: QueryClient
  fallbackComponent?: RouteComponent
}

function normalizeRoutePath(path: string): string {
  if (path === "/") return "/"
  return path.replace(/^\//, "")
}

function DefaultNotFound(): ReactElement {
  return <div data-testid="route-not-found">Route not found</div>
}

function RootLayout(): ReactElement {
  return <Outlet />
}

export async function renderAppRoute({
  initialPath,
  routes,
  queryClient,
  fallbackComponent,
}: RenderAppRouteOptions) {
  const activeQueryClient = queryClient ?? createTestQueryClient()

  const rootRoute = createRootRoute({
    component: RootLayout,
    notFoundComponent: (_props: NotFoundRouteProps) => {
      const Fallback = fallbackComponent ?? DefaultNotFound
      return <Fallback />
    },
  })

  const childRoutes = routes.map((route) => {
    return createRoute({
      getParentRoute: () => rootRoute,
      path: normalizeRoutePath(route.path),
      component: route.component,
    })
  })

  const routeTree = rootRoute.addChildren(childRoutes)

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
    context: {
      queryClient: activeQueryClient,
    },
  })

  const renderResult = render(
    <QueryClientProvider client={activeQueryClient}>
      <RouterProvider router={router as AnyRouter} />
    </QueryClientProvider>
  )

  await router.load()

  return {
    ...renderResult,
    router,
    queryClient: activeQueryClient,
  }
}
