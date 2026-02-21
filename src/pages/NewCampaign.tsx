import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateCampaignDraft } from '../api/client';
import { loadCampaigns, saveCampaigns } from '../lib/storage';
import { loadKbDocs, loadKbProfile, getKbContext } from '../lib/storage';
import { runGuardrailsForCampaign } from '../lib/guardrails';
import type { Campaign, AudiencePlan, AudienceBlueprint } from '../types';

function nanoid() {
  return 'id-' + Math.random().toString(36).slice(2, 11);
}

export default function NewCampaign() {
  const navigate = useNavigate();
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const docs = loadKbDocs();
      const profile = loadKbProfile();
      const kbContext = getKbContext(docs, profile);
      const draft = await generateCampaignDraft(intent.trim(), kbContext);

      const campaignId = nanoid();
      const now = new Date().toISOString();
      const audiences: AudiencePlan[] = (draft.audiences || []).map((a: { id?: string; name?: string; blueprint?: unknown; flow?: { nodes?: unknown[]; edges?: unknown[] } }, i: number) => ({
        id: a.id || `aud-${i + 1}`,
        name: a.name || `Audience ${i + 1}`,
        blueprint: (a.blueprint as AudienceBlueprint) || ({
          coreIdea: '',
          cadence: { maxPerWeek: 3 },
          doNothingBehavior: '',
          stopConditions: [],
          anchorMessages: [],
          audienceDefinition: { plain: '' },
          rationale: [],
          assumptions: [],
          checklist: [],
        } as AudienceBlueprint),
        flow: a.flow && Array.isArray(a.flow.nodes) ? { nodes: a.flow.nodes as import('../types').FlowNode[], edges: (a.flow.edges || []) as import('../types').FlowEdge[] } : { nodes: [], edges: [] },
        pinned: { pinnedNodeIds: [], pinnedRules: [] },
        issues: [],
      }));

      const campaign: Campaign = {
        id: campaignId,
        name: draft.intentSummary?.slice(0, 60) || 'Untitled Campaign',
        status: 'Draft',
        createdAt: now,
        updatedAt: now,
        intentSummary: draft.intentSummary || intent,
        primaryGoal: draft.primaryGoal,
        audiences,
        globalPolicies: [],
        history: [{ id: nanoid(), timestamp: now, author: 'AI', notes: 'Initial draft from intent' }],
      };
      runGuardrailsForCampaign(campaign);

      const campaigns = loadCampaigns();
      saveCampaigns([...campaigns, campaign]);
      navigate(`/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page new-campaign">
      <header className="page-header">
        <h1>New campaign</h1>
      </header>
      <p className="page-description">In plain language: what’s the goal, who’s it for, and any rules (e.g. max messages per week, quiet hours). Sotto will draft audiences, copy, and flow.</p>
      <form onSubmit={handleSubmit} className="intent-form">
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="e.g. Valentine’s moisturizer launch — 20% off, two audiences: recent skincare buyers and loyalty members who browsed moisturizers. Cap at 3 texts per week, no sends 9pm–9am."
          rows={5}
          disabled={loading}
          className="intent-textarea"
        />
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Drafting…' : 'Draft campaign'}
        </button>
      </form>
    </div>
  );
}
