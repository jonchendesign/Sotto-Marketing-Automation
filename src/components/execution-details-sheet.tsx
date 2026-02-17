"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { Plan } from "@/types/plan"

interface ExecutionDetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: Plan
}

export function ExecutionDetailsSheet({
  open,
  onOpenChange,
  plan,
}: ExecutionDetailsSheetProps) {
  const handleFlowEdit = () => {
    toast("Flow builder not implemented in prototype")
  }

  const handleGenerateMore = () => {
    toast("Generate more (Gemini) — optional / mocked")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Execution details</SheetTitle>
          <SheetDescription>
            Flow builder, rules, and message variants.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="flow" className="mt-6">
          <TabsList>
            <TabsTrigger value="flow">Flow Builder</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="messages">Message variants</TabsTrigger>
          </TabsList>

          <TabsContent value="flow" className="mt-4">
            <div className="rounded-lg border border-dashed bg-muted/30 p-6">
              <p className="text-sm text-muted-foreground mb-4">
                Wireframe: nodes and edges (read-only)
              </p>
              <div className="flex flex-wrap gap-2">
                {plan.executionSketch.nodes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded border bg-background px-3 py-2 text-sm"
                  >
                    {n.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({n.type})
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Edges:{" "}
                {plan.executionSketch.edges
                  .map((e) => `${e.from} → ${e.to}`)
                  .join(", ")}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleFlowEdit}
                disabled
              >
                Edit (disabled)
              </Button>
              <span className="ml-2 text-xs text-muted-foreground">
                — Flow builder not implemented
              </span>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <div className="space-y-4">
              <div>
                <Label>IF/THEN rules</Label>
                <ul className="mt-2 space-y-2 text-sm">
                  <li className="rounded border p-2">
                    IF opt-out received THEN stop, add to exclusion
                  </li>
                  <li className="rounded border p-2">
                    IF max followups reached THEN stop
                  </li>
                  <li className="rounded border p-2">
                    IF no response after {plan.policy.noResponse.waitDays} days
                    THEN send followup (max {plan.policy.noResponse.maxFollowups})
                  </li>
                  <li className="rounded border p-2">
                    IF conversion achieved THEN stop
                  </li>
                </ul>
              </div>
              <div>
                <Label>Timing</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Wait {plan.policy.noResponse.waitDays} days, max{" "}
                  {plan.policy.noResponse.maxFollowups} followups.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <div className="space-y-4">
              {plan.executionSketch.messageVariants.map((v, i) => (
                <div key={i} className="space-y-1">
                  <Label>Variant {i + 1}</Label>
                  <p className="rounded border bg-muted/30 p-2 text-sm">{v}</p>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateMore}
              >
                Generate more
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
