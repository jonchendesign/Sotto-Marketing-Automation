import { NextResponse } from "next/server"
import { PlanSchema } from "@/types/plan"
import { createDefaultPlan } from "@/lib/default-plan"
import { callGemini } from "@/lib/gemini"

const PLAN_JSON_SCHEMA = `
{
  "id": "string (UUID)",
  "name": "string",
  "status": "draft",
  "intentText": "string (the user's intent)",
  "brief": {
    "goal": "string",
    "audience": "string",
    "timing": "string",
    "incentive": "string",
    "confidence": { "goal": "High|Med|Low", "audience": "High|Med|Low", "timing": "High|Med|Low", "incentive": "High|Med|Low" },
    "rationale": { "goal": "string", "audience": "string", "timing": "string", "incentive": "string" }
  },
  "strategy": {
    "audiencePhases": [{ "phase": "string", "segment": "string", "inclusion": "string", "exclusion": "string?" }],
    "engagementApproach": ["string"],
    "measurement": { "primaryKpi": "string", "secondary": ["string"] }
  },
  "policy": {
    "clarifyMax": 1,
    "exitCriteria": ["string"],
    "optOutHandling": "string",
    "noResponse": { "waitDays": 3, "maxFollowups": 2, "followupMessage": "string" }
  },
  "executionSketch": {
    "nodes": [{ "id": "string", "label": "string", "type": "message|decision|wait|exit" }],
    "edges": [{ "from": "string", "to": "string", "label": "string?" }],
    "messageVariants": ["string"]
  }
}
`

export async function POST(request: Request) {
  let intentText = "Create a campaign plan"
  try {
    const body = await request.json() as { intentText?: string }
    intentText = body?.intentText && typeof body.intentText === "string"
      ? body.intentText
      : intentText
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      const fallback = createDefaultPlan(intentText)
      return NextResponse.json({ plan: fallback })
    }

    const prompt = `You are a strategic plan generator. Given the user's intent, produce a structured Strategic Plan in valid JSON only. No markdown, no code blocks. The JSON must match this schema exactly:

${PLAN_JSON_SCHEMA}

User intent:
"${intentText}"

Return ONLY the JSON object. Use a random UUID for id. Set status to "draft". Include at least 2 audiencePhases, at least 3 engagementApproach items, at least 3 exitCriteria, and 3 messageVariants.`

    const raw = await callGemini(prompt)
    const json = parsePlanJson(raw)
    const plan = PlanSchema.parse({
      ...json,
      id: json.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `plan-${Date.now()}`),
      name: json.name ?? "Untitled plan",
      status: json.status ?? "draft",
      intentText,
    })
    return NextResponse.json({ plan })
  } catch (err) {
    console.error("generate-plan error:", err)
    const fallback = createDefaultPlan(intentText)
    return NextResponse.json({ plan: fallback })
  }
}

function parsePlanJson(raw: string): Record<string, unknown> {
  let s = raw.replace(/```json\n?|\n?```/g, "").trim()
  return JSON.parse(s) as Record<string, unknown>
}
