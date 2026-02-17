import { create } from "zustand"
import type { Plan } from "@/types/plan"

interface PlanState {
  plan: Plan | null
  name: string

  setPlan: (plan: Plan | null) => void
  setPlanName: (name: string) => void
  updatePlan: (updates: Partial<Plan>) => void
  publish: () => void
  reset: () => void
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plan: null,
  name: "",

  setPlan: (plan) => set({ plan, name: plan?.name ?? "" }),
  setPlanName: (name) => set({ name }),
  updatePlan: (updates) => {
    const { plan } = get()
    if (plan) set({ plan: { ...plan, ...updates } })
  },
  publish: () => {
    const { plan } = get()
    if (plan) set({ plan: { ...plan, status: "published" } })
  },
  reset: () => set({ plan: null, name: "" }),
}))
