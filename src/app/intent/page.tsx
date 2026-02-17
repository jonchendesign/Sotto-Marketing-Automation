"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { usePlanStore } from "@/store/plan-store"
import { toast } from "sonner"

export default function IntentPage() {
  const router = useRouter()
  const [intentText, setIntentText] = useState("")
  const [loading, setLoading] = useState(false)
  const setPlan = usePlanStore((s) => s.setPlan)

  const handleGenerate = async () => {
    const text = intentText.trim() || "Run a promotional campaign for eligible customers with a discount offer."
    setLoading(true)
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentText: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate plan")
      setPlan(data.plan)
      router.push("/plan")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate plan"
      toast.error(msg)
      console.error("Generate plan error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Describe what you want to do</h1>
        <p className="text-muted-foreground mt-1">
          Write your intent in plain language. We&apos;ll generate a Strategic Plan Brief.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intent</CardTitle>
          <CardDescription>
            Describe your plan in a few sentences. Include audience, goal, incentive, and timing if known.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="e.g. Target Northeast customers for Spring 2025 sale with a 15% discount. Drive revenue. If no response, wait 3 days and send 2 follow-up reminders."
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            rows={6}
            className="resize-none"
          />
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate plan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
