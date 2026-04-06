import { createRootRoute, Outlet } from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { MobileHeader } from "@/components/MobileHeader"
import { queryClient } from "@/api/queryClient"

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Desktop / Tablet: sidebar layout */}
        <div className="hidden md:flex min-h-screen">
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex-1">
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </div>

        {/* Mobile: header + full-width content */}
        <div className="flex flex-col min-h-screen md:hidden">
          <MobileHeader />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
