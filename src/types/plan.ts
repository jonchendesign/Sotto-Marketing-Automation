import { z } from "zod"

const confidenceLevel = z
  .string()
  .transform((s) => {
    const v = (s?.trim() ?? "").toLowerCase()
    if (v === "high") return "High"
    if (v === "med" || v === "medium") return "Med"
    if (v === "low") return "Low"
    return "Med" // fallback for unexpected values
  })

export const BriefSchema = z.object({
  goal: z.string(),
  audience: z.string(),
  timing: z.string(),
  incentive: z.string(),
  confidence: z.object({
    goal: confidenceLevel,
    audience: confidenceLevel,
    timing: confidenceLevel,
    incentive: confidenceLevel,
  }),
  rationale: z.object({
    goal: z.string(),
    audience: z.string(),
    timing: z.string(),
    incentive: z.string(),
  }),
})

export const StrategySchema = z.object({
  audiencePhases: z.array(
    z.object({
      phase: z.string(),
      segment: z.string(),
      inclusion: z.string(),
      exclusion: z.string().optional(),
    })
  ),
  engagementApproach: z.array(z.string()),
  measurement: z.object({
    primaryKpi: z.string(),
    secondary: z.array(z.string()),
  }),
})

export const PolicySchema = z.object({
  clarifyMax: z.number(),
  exitCriteria: z.array(z.string()),
  optOutHandling: z.string(),
  noResponse: z.object({
    waitDays: z.number(),
    maxFollowups: z.number(),
    followupMessage: z.string(),
  }),
})

export const ExecutionSketchSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(["message", "decision", "wait", "exit"]),
    })
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
    })
  ),
  messageVariants: z.array(z.string()),
})

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["draft", "published"]),
  intentText: z.string(),
  brief: BriefSchema,
  strategy: StrategySchema,
  policy: PolicySchema,
  executionSketch: ExecutionSketchSchema,
})

export type Plan = z.infer<typeof PlanSchema>
export type Brief = z.infer<typeof BriefSchema>
export type Strategy = z.infer<typeof StrategySchema>
export type Policy = z.infer<typeof PolicySchema>
export type ExecutionSketch = z.infer<typeof ExecutionSketchSchema>
