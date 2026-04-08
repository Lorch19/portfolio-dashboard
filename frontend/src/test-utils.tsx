import { render, type RenderOptions } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { QueryClient } from "@tanstack/react-query"
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
} from "@tanstack/react-router"
import { TooltipProvider } from "@/components/ui/tooltip"

export function renderWithRouter(
  ui: React.ReactNode,
  {
    route = "/",
    ...renderOptions
  }: RenderOptions & { route?: string } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const rootRoute = createRootRoute({
    component: () => ui,
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [route] }),
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router as unknown as Parameters<typeof RouterProvider>[0]["router"]} />
      </TooltipProvider>
    </QueryClientProvider>,
    renderOptions
  )
}
