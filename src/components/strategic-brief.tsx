"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { Plan } from "@/types/plan"
import { cn } from "@/lib/utils"

type SectionId = "overview" | "audience" | "messaging" | "response-policy" | "measurement"

interface StrategicBriefProps {
  plan: Plan
  activeSection: SectionId
  onEditInDetail?: () => void
}

export function StrategicBrief({ plan, activeSection, onEditInDetail }: StrategicBriefProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Strategic Plan Brief</h1>
        <p className="text-muted-foreground mt-1">
          High-level narrative and structured overview.
        </p>
      </div>

      {(activeSection === "overview" || !activeSection) && (
        <SectionCard
          title="Overview"
          onEditInDetail={onEditInDetail}
        >
          <ul className="space-y-2 text-sm">
            <BriefLine
              label="Goal"
              value={plan.brief.goal}
              confidence={plan.brief.confidence.goal}
              rationale={plan.brief.rationale.goal}
            />
            <BriefLine
              label="Audience"
              value={plan.brief.audience}
              confidence={plan.brief.confidence.audience}
              rationale={plan.brief.rationale.audience}
            />
            <BriefLine
              label="Timing"
              value={plan.brief.timing}
              confidence={plan.brief.confidence.timing}
              rationale={plan.brief.rationale.timing}
            />
            <BriefLine
              label="Incentive"
              value={plan.brief.incentive}
              confidence={plan.brief.confidence.incentive}
              rationale={plan.brief.rationale.incentive}
            />
          </ul>
        </SectionCard>
      )}

      {activeSection === "audience" && (
        <SectionCard title="Audience Strategy" onEditInDetail={onEditInDetail}>
          <div className="space-y-3">
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {plan.strategy.audiencePhases.map((ap, i) => (
                <li key={i}>
                  {ap.phase}: {ap.segment} — {ap.inclusion}
                  {ap.exclusion && ` (exclude: ${ap.exclusion})`}
                </li>
              ))}
            </ul>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Phase</th>
                  <th className="py-2 text-left font-medium">Segment</th>
                  <th className="py-2 text-left font-medium">Inclusion</th>
                  <th className="py-2 text-left font-medium">Exclusion</th>
                </tr>
              </thead>
              <tbody>
                {plan.strategy.audiencePhases.map((ap, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{ap.phase}</td>
                    <td className="py-2">{ap.segment}</td>
                    <td className="py-2">{ap.inclusion}</td>
                    <td className="py-2">{ap.exclusion ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {activeSection === "messaging" && (
        <SectionCard title="Engagement Approach" onEditInDetail={onEditInDetail}>
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {plan.strategy.engagementApproach.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <div className="mt-4">
            <h4 className="mb-2 font-medium">Message variants</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {plan.executionSketch.messageVariants.slice(0, 3).map((v, i) => (
                <li key={i}>• {v}</li>
              ))}
            </ul>
          </div>
        </SectionCard>
      )}

      {activeSection === "response-policy" && (
        <SectionCard title="Response Policy" onEditInDetail={onEditInDetail}>
          <ul className="space-y-2 text-sm">
            <li><strong>Clarify max:</strong> {plan.policy.clarifyMax}</li>
            <li><strong>Exit criteria:</strong> {plan.policy.exitCriteria.join("; ")}</li>
            <li><strong>Opt-out handling:</strong> {plan.policy.optOutHandling}</li>
            <li>
              <strong>No-response:</strong> Wait {plan.policy.noResponse.waitDays} days,
              max {plan.policy.noResponse.maxFollowups} followups.
              Message: {plan.policy.noResponse.followupMessage}
            </li>
          </ul>
        </SectionCard>
      )}

      {activeSection === "measurement" && (
        <SectionCard title="Measurement & Learnings" onEditInDetail={onEditInDetail}>
          <ul className="space-y-2 text-sm">
            <li><strong>Primary KPI:</strong> {plan.strategy.measurement.primaryKpi}</li>
            <li>
              <strong>Secondary:</strong>{" "}
              {plan.strategy.measurement.secondary.join(", ")}
            </li>
          </ul>
        </SectionCard>
      )}
    </div>
  )
}

function BriefLine({
  label,
  value,
  confidence,
  rationale,
}: {
  label: string
  value: string
  confidence: string
  rationale: string
}) {
  const [open, setOpen] = useState(false)
  const confColor =
    confidence === "High" ? "text-green-600" : confidence === "Med" ? "text-yellow-600" : "text-amber-600"
  return (
    <li className="flex flex-col gap-1">
      <span>
        <strong>{label}:</strong> {value}
        <span className={cn("ml-2 text-xs", confColor)}>({confidence})</span>
      </span>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Why
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

function SectionCard({
  title,
  onEditInDetail,
  children,
}: {
  title: string
  onEditInDetail?: () => void
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {onEditInDetail && (
            <button
              onClick={onEditInDetail}
              className="text-xs text-primary hover:underline"
            >
              Edit in detail
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
