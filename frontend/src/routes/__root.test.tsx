import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
} from "@tanstack/react-router"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { MobileHeader } from "@/components/MobileHeader"

function createTestRouter(initialPath = "/health", mobile = false) {
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          {!mobile ? (
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <div>Content Area</div>
              </SidebarInset>
            </SidebarProvider>
          ) : (
            <MobileHeader />
          )}
        </TooltipProvider>
      </QueryClientProvider>
    ),
  })

  const healthRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/health",
  })

  return createRouter({
    routeTree: rootRoute.addChildren([healthRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
}

describe("Root Layout", () => {
  it("renders sidebar with all 8 navigation tabs", async () => {
    const router = createTestRouter()
    render(<RouterProvider router={router as unknown as Parameters<typeof RouterProvider>[0]["router"]} />)

    const tabNames = [
      "Health", "Supervisor", "Funnel", "Holdings",
      "Performance", "Decisions", "Costs", "Debug",
    ]

    for (const name of tabNames) {
      expect(await screen.findByText(name)).toBeInTheDocument()
    }
  })

  it("renders Portfolio Dashboard branding", async () => {
    const router = createTestRouter()
    render(<RouterProvider router={router as unknown as Parameters<typeof RouterProvider>[0]["router"]} />)
    expect(await screen.findByText("Portfolio Dashboard")).toBeInTheDocument()
  })

  it("renders hamburger menu button on mobile viewport", async () => {
    const router = createTestRouter("/health", true)
    render(<RouterProvider router={router as unknown as Parameters<typeof RouterProvider>[0]["router"]} />)
    expect(await screen.findByRole("button", { name: /open navigation/i })).toBeInTheDocument()
  })
})
