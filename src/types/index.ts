// ============================================================================
// Sotto - AI-driven SMS marketing automation - Data model
// ============================================================================

export type CampaignStatus = 'Draft' | 'Published';

export interface PolicyRule {
  id: string;
  type: 'frequency_cap' | 'quiet_hours' | 'suppression' | 'compliance' | 'offer';
  label: string;
  value: string;
  scope: 'global' | 'audience';
  audienceId?: string;
}

export interface VersionEntry {
  id: string;
  timestamp: string;
  author: 'AI' | 'human';
  notes?: string;
  blueprintSnapshot?: AudienceBlueprint;
  flowSnapshot?: FlowGraph;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  intentSummary: string;
  primaryGoal?: string;
  audiences: AudiencePlan[];
  globalPolicies: PolicyRule[];
  history: VersionEntry[];
}

export interface AudiencePlan {
  id: string;
  name: string;
  blueprint: AudienceBlueprint;
  flow: FlowGraph;
  pinned: PinnedState;
  issues: Issue[];
  policies?: PolicyRule[];
}

export interface AudienceBlueprint {
  coreIdea: string;
  cadence: {
    maxPerWeek: number;
    quietHours?: string;
    notes?: string;
  };
  doNothingBehavior: string;
  stopConditions: string[];
  anchorMessages: {
    title: string;
    smsCopy: string;
    toneNotes?: string;
  }[];
  audienceDefinition: {
    plain: string;
    include?: string[];
    exclude?: string[];
  };
  goal?: string;
  rationale: string[];
  assumptions: string[];
  checklist: {
    item: string;
    status: 'pass' | 'review';
    reason?: string;
  }[];
  tone?: ToneLabel;
  offerStrategy?: OfferStrategy;
  audienceStrictness?: 'Broaden' | 'Narrow' | 'Keep';
}

export type ToneLabel = 'Brand' | 'Playful' | 'Premium' | 'Direct';
export type OfferStrategy = 'No discount' | 'Escalate' | 'Always';

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type FlowNodeType = 'trigger' | 'message' | 'delay' | 'condition' | 'exit';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  data: Record<string, unknown>;
  pinned?: boolean;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  condition?: string;
}

export interface PinnedState {
  pinnedNodeIds: string[];
  pinnedRules: string[];
}

export type IssueSeverity = 'blocker' | 'warning' | 'info';

export interface Issue {
  id: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  suggestedAction?: string;
}

// Knowledge Base
export type KBTag = 'Brand voice' | 'Offer policy' | 'Compliance' | 'Past campaigns' | 'Audience definitions';

export interface KnowledgeBaseDoc {
  id: string;
  title: string;
  tags: KBTag[];
  rawText: string;
  extracted: {
    voice: string[];
    dos: string[];
    donts: string[];
    policies: string[];
  };
  createdAt: string;
}

export interface KnowledgeBaseProfile {
  brandVoice: string;
  offerPolicy: string;
  complianceRules: string;
  audienceGuidelines: string;
}

// API / Diff
export interface CampaignDraft {
  intentSummary: string;
  primaryGoal?: string;
  audiences: {
    id: string;
    name: string;
    blueprint: AudienceBlueprint;
    flow: FlowGraph;
  }[];
}

export interface DiffSummary {
  blueprint: { section: string; current: string; proposed: string }[];
  flow: { nodesAdded: number; nodesRemoved: number; nodesChanged: number; details?: string[] };
}

export interface ProposedRegeneration {
  blueprint: AudienceBlueprint;
  flow: FlowGraph;
  diffSummary: DiffSummary;
}
