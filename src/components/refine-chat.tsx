"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { usePlanStore } from "@/store/plan-store"
import { toast } from "sonner"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"

const QUICK_ACTIONS = [
  "Tighten scope",
  "Increase conversion",
  "Reduce churn risk",
  "Make more on-brand",
]

export function RefineChat() {
  const plan = usePlanStore((s) => s.plan)
  const setPlan = usePlanStore((s) => s.setPlan)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !plan || loading) return

    setMessages((m) => [...m, { role: "user", text }])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/refine-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, instruction: text }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Refine failed")
      }

      setPlan(data.plan)
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Plan updated. The brief and sections reflect your changes." },
      ])
      toast.success("Plan updated")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Refine failed"
      toast.error(msg)
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Error: ${msg}. Please try again or add GEMINI_API_KEY to .env.local` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = (action: string) => {
    setInput(action)
  }

  if (!plan) return null

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-3">
        <p className="text-xs text-muted-foreground">Quick actions</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((a) => (
            <Button
              key={a}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleQuickAction(a)}
            >
              {a}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Type instructions like: &quot;Make this less aggressive&quot;, &quot;Change
            audience to VIPs only&quot;, &quot;Add incentive: 10% off&quot;, &quot;Wait 7
            days before follow-up, max 2 nudges&quot;.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-4 bg-primary text-primary-foreground"
                    : "mr-4 bg-muted"
                )}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="mr-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <span className="flex gap-1">
                  <span className="inline-block size-2 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                  <span className="inline-block size-2 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                  <span className="inline-block size-2 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                </span>
                <span className="animate-pulse">Thinking</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      <div className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            placeholder="e.g. Make this less aggressive"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={2}
            className="resize-none"
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
