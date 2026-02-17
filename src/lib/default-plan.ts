import type { Plan } from "@/types/plan"

export function createDefaultPlan(intentText: string): Plan {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `plan-${Date.now()}`,
    name: "Untitled plan",
    status: "draft",
    intentText,
    brief: {
      goal: "Drive engagement and conversion.",
      audience: "Eligible customers based on segment criteria.",
      timing: "Campaign window as specified.",
      incentive: "Offer tier as determined.",
      confidence: {
        goal: "Med",
        audience: "Med",
        timing: "Med",
        incentive: "Med",
      },
      rationale: {
        goal: "Inferred from intent.",
        audience: "Inferred from intent.",
        timing: "Inferred from intent.",
        incentive: "Inferred from intent.",
      },
    },
    strategy: {
      audiencePhases: [
        { phase: "Phase 1", segment: "Primary target", inclusion: "Active, high intent", exclusion: "Opt-outs" },
        { phase: "Phase 2", segment: "Expand", inclusion: "Broader segment", exclusion: "Non-engaged" },
      ],
      engagementApproach: [
        "Personalized messaging based on segment",
        "Multi-touch cadence with diminishing frequency",
        "Clear CTA in each message",
      ],
      measurement: {
        primaryKpi: "Conversion rate",
        secondary: ["Open rate", "Click-through rate", "Opt-out rate"],
      },
    },
    policy: {
      clarifyMax: 1,
      exitCriteria: ["Opt-out received", "Max followups reached", "Conversion achieved"],
      optOutHandling: "Immediate stop, add to exclusion list",
      noResponse: {
        waitDays: 3,
        maxFollowups: 2,
        followupMessage: "Friendly reminder: we have a personalized offer waiting for you.",
      },
    },
    executionSketch: {
      nodes: [
        { id: "n1", label: "Initial message", type: "message" },
        { id: "n2", label: "Wait", type: "wait" },
        { id: "n3", label: "Follow-up?", type: "decision" },
        { id: "n4", label: "Follow-up message", type: "message" },
        { id: "n5", label: "End", type: "exit" },
      ],
      edges: [
        { from: "n1", to: "n2", label: "sent" },
        { from: "n2", to: "n3", label: "after wait" },
        { from: "n3", to: "n4", label: "yes" },
        { from: "n3", to: "n5", label: "no" },
        { from: "n4", to: "n2", label: "loop" },
      ],
      messageVariants: [
        "[Primary] Personalized offer based on your activity.",
        "[Reminder] Friendly reminder about your exclusive offer.",
        "[Urgency] Don't miss out — offer expires soon.",
      ],
    },
  }
}
