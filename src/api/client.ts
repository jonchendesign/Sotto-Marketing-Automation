import type {
  CampaignDraft,
  AudienceBlueprint,
  FlowGraph,
  PinnedState,
  ProposedRegeneration,
} from '../types';

const API = '/api';

async function request<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export async function generateCampaignDraft(
  intent: string,
  kbContext: string
): Promise<CampaignDraft> {
  return request<CampaignDraft>('/generate-draft', { intent, kbContext });
}

export async function reviseBlueprint(
  currentBlueprint: AudienceBlueprint,
  instruction: string,
  kbContext: string
): Promise<AudienceBlueprint> {
  return request<AudienceBlueprint>('/revise-blueprint', {
    currentBlueprint,
    instruction,
    kbContext,
  });
}

export async function compileFlowFromBlueprint(
  blueprint: AudienceBlueprint,
  kbContext: string,
  pinnedConstraints?: PinnedState | null
): Promise<FlowGraph> {
  return request<FlowGraph>('/compile-flow', {
    blueprint,
    kbContext,
    pinnedConstraints: pinnedConstraints ?? null,
  });
}

export async function proposeRegenerationWithDiff(
  currentBlueprint: AudienceBlueprint,
  currentFlow: FlowGraph,
  pinnedConstraints: PinnedState,
  kbContext: string
): Promise<ProposedRegeneration> {
  return request<ProposedRegeneration>('/propose-regeneration', {
    currentBlueprint,
    currentFlow,
    pinnedConstraints,
    kbContext,
  });
}

export async function extractKbProfile(
  rawText: string,
  title?: string,
  tags?: string[]
): Promise<{ voice: string[]; dos: string[]; donts: string[]; policies: string[] }> {
  return request('/extract-kb-profile', { rawText, title, tags: tags ?? [] });
}
