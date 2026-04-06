import { useState } from "react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { Menu } from "lucide-react"
import { TABS } from "@/lib/constants"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <header className="flex items-center gap-3 border-b border-border p-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-full p-0">
          <SheetTitle className="p-4 text-sm font-semibold">
            Portfolio Dashboard
          </SheetTitle>
          <nav className="flex flex-col">
            {TABS.map((tab) => {
              const isActive =
                location.pathname === tab.path ||
                location.pathname.startsWith(tab.path + "/")
              return (
                <button
                  key={tab.path}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? "bg-primary-muted text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => {
                    navigate({ to: tab.path })
                    setOpen(false)
                  }}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
      <span className="text-sm font-semibold">Portfolio Dashboard</span>
    </header>
  )
}
