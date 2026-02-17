import { NextResponse } from "next/server"
import { PlanSchema } from "@/types/plan"
import { callGemini } from "@/lib/gemini"

const PLAN_JSON_SCHEMA = `
{
  "brief": { "goal": "string", "audience": "string", "timing": "string", "incentive": "string", "confidence": {...}, "rationale": {...} },
  "strategy": { "audiencePhases": [...], "engagementApproach": [...], "measurement": {...} },
  "policy": { "clarifyMax": 1, "exitCriteria": [...], "optOutHandling": "string", "noResponse": {...} },
  "executionSketch": { "nodes": [...], "edges": [...], "messageVariants": [...] }
}
`

export async function POST(request: Request) {
  try {
    const { plan, instruction } = await request.json()
    if (!plan || !instruction || typeof instruction !== "string") {
      return NextResponse.json(
        { error: "plan and instruction required" },
        { status: 400 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set. Add it to .env.local to use refine." },
        { status: 503 }
      )
    }

    const prompt = `You are a strategic plan editor. Given the current plan (JSON) and the user's refinement instruction, produce the UPDATED plan as valid JSON only. No markdown, no code blocks. Preserve fields not affected by the instruction. The output must be a complete plan object matching this schema:

${PLAN_JSON_SCHEMA}

Current plan (JSON):
${JSON.stringify(plan, null, 2)}

User instruction: "${instruction}"

Return ONLY the full updated plan as a single JSON object. Keep id, name, status, intentText unchanged. Update only the sections affected by the instruction.`

    const raw = await callGemini(prompt)
    let s = raw.replace(/```json\n?|\n?```/g, "").trim()
    const json = JSON.parse(s) as Record<string, unknown>
    const merged = {
      ...plan,
      ...json,
      id: plan.id,
      name: plan.name ?? "Untitled plan",
      status: plan.status ?? "draft",
      intentText: plan.intentText,
    }
    const validated = PlanSchema.parse(merged)
    return NextResponse.json({ plan: validated })
  } catch (err) {
    console.error("refine-plan error:", err)
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 })
  }
}
