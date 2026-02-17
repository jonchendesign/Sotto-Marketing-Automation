"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { usePlanStore } from "@/store/plan-store"
import { StrategicBrief } from "@/components/strategic-brief"
import { RefineChat } from "@/components/refine-chat"
import { ExecutionDetailsSheet } from "@/components/execution-details-sheet"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "audience", label: "Audience" },
  { id: "messaging", label: "Messaging" },
  { id: "response-policy", label: "Response policy" },
  { id: "measurement", label: "Measurement" },
] as const

export default function PlanPage() {
  const router = useRouter()
  const plan = usePlanStore((s) => s.plan)
  const updatePlan = usePlanStore((s) => s.updatePlan)
  const publish = usePlanStore((s) => s.publish)
  const [executionSheetOpen, setExecutionSheetOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<(typeof SECTIONS)[number]["id"]>("overview")

  useEffect(() => {
    if (!plan) {
      router.replace("/intent")
    }
  }, [plan, router])

  const handlePlanNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updatePlan({ name: e.target.value })
  }

  const handlePublish = () => {
    publish()
    toast.success("Plan published")
  }

  if (!plan) return null

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Input
            value={plan.name}
            onChange={handlePlanNameChange}
            className="h-9 w-64 font-medium"
          />
          <Badge variant={plan.status === "published" ? "default" : "secondary"}>
            {plan.status === "published" ? "Published" : "Draft"}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Save draft
          </Button>
          <Button size="sm" onClick={handlePublish}>
            Publish
          </Button>
        </div>
      </header>

      {/* 3-column main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Plan Outline nav */}
        <aside className="w-48 shrink-0 border-r bg-muted/30 p-4">
          <h2 className="mb-3 text-sm font-medium">Plan Outline</h2>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "rounded px-3 py-2 text-left text-sm",
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Center: Strategic Plan Brief */}
        <main className="flex-1 overflow-y-auto p-6">
          <StrategicBrief
            plan={plan}
            activeSection={activeSection}
            onEditInDetail={() => setExecutionSheetOpen(true)}
          />
        </main>

        {/* Right: Refine chat panel */}
        <aside className="w-80 shrink-0 border-l bg-muted/20 flex flex-col">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="text-sm font-medium">Refine</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExecutionSheetOpen(true)}
            >
              View execution details
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <RefineChat />
          </div>
        </aside>
      </div>

      <ExecutionDetailsSheet
        open={executionSheetOpen}
        onOpenChange={setExecutionSheetOpen}
        plan={plan}
      />
    </div>
  )
}
