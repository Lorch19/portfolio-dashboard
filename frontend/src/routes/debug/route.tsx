import { createFileRoute, Outlet, Navigate, useNavigate, useLocation } from "@tanstack/react-router"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute("/debug")({
  component: DebugLayout,
})

const DEBUG_TABS = [
  { name: "Events", path: "/debug/events" },
  { name: "Logs", path: "/debug/logs" },
  { name: "Replay", path: "/debug/replay" },
] as const

function DebugLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  // Redirect bare /debug to /debug/events
  if (location.pathname === "/debug") {
    return <Navigate to="/debug/events" />
  }

  const activeTab =
    DEBUG_TABS.find((t) => location.pathname === t.path)?.path ??
    "/debug/events"

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Debug</h1>
      <Tabs
        value={activeTab}
        onValueChange={(value) => navigate({ to: value })}
      >
        <TabsList>
          {DEBUG_TABS.map((tab) => (
            <TabsTrigger key={tab.path} value={tab.path}>
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Outlet />
    </div>
  )
}
