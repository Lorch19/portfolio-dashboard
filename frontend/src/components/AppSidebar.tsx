import { useLocation, useNavigate } from "@tanstack/react-router"
import { TABS } from "@/lib/constants"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <span className="text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden">
          Portfolio Dashboard
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {TABS.map((tab) => {
            const isActive =
              location.pathname === tab.path ||
              location.pathname.startsWith(tab.path + "/")
            return (
              <SidebarMenuItem key={tab.path}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={tab.name}
                  onClick={() => navigate({ to: tab.path })}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <p className="text-xs text-faint-foreground group-data-[collapsible=icon]:hidden">
          Last updated: just now
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
