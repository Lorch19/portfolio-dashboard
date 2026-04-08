import {
  Activity,
  Eye,
  Filter,
  Briefcase,
  TrendingUp,
  Brain,
  DollarSign,
  Bug,
} from "lucide-react"

export const TABS = [
  { name: "Health", path: "/health", icon: Activity },
  { name: "Supervisor", path: "/supervisor", icon: Eye },
  { name: "Performance", path: "/performance", icon: TrendingUp },
  { name: "Funnel", path: "/funnel", icon: Filter },
  { name: "Holdings", path: "/holdings", icon: Briefcase },
  { name: "Decisions", path: "/decisions", icon: Brain },
  { name: "Costs", path: "/costs", icon: DollarSign },
  { name: "Debug", path: "/debug", icon: Bug },
] as const

export const HEALTH_REFETCH_INTERVAL = 30_000

// VPS metric thresholds for trend indicators
export const VPS_THRESHOLD_WARNING = 60
export const VPS_THRESHOLD_CRITICAL = 80
export const SUPERVISOR_REFETCH_INTERVAL = 30_000
export const DEFAULT_REFETCH_INTERVAL = 60_000
export const FUNNEL_STALE_TIME = 900_000
export const HOLDINGS_STALE_TIME = 300_000
export const PERFORMANCE_STALE_TIME = 3_600_000
export const COSTS_STALE_TIME = 3_600_000
export const DECISIONS_STALE_TIME = 900_000
