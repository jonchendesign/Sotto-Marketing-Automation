import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadCampaigns, saveCampaigns } from '../lib/storage';
import { getKbContext } from '../lib/storage';
import { loadKbDocs, loadKbProfile } from '../lib/storage';
import type { Campaign, AudiencePlan, ProposedRegeneration } from '../types';
import { runGuardrailsForCampaign } from '../lib/guardrails';
import { reviseBlueprint, compileFlowFromBlueprint, proposeRegenerationWithDiff } from '../api/client';
import TabBlueprint from '../components/campaign/TabBlueprint';
import TabPreview from '../components/campaign/TabPreview';
import TabBuild from '../components/campaign/TabBuild';
import TabPolicies from '../components/campaign/TabPolicies';
import TabHistory from '../components/campaign/TabHistory';
import DiffModal from '../components/DiffModal';
import ReviewIssuesPanel from '../components/ReviewIssuesPanel';

type TabId = 'blueprint' | 'preview' | 'build' | 'policies' | 'history';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadCampaigns());
  const [activeTab, setActiveTab] = useState<TabId>('blueprint');
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [proposed, setProposed] = useState<ProposedRegeneration | null>(null);
  const [showReviewIssues, setShowReviewIssues] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const campaign = campaigns.find((c) => c.id === id);
  const selectedAudience = campaign?.audiences.find((a) => a.id === selectedAudienceId) ?? campaign?.audiences[0];

  useEffect(() => {
    setCampaigns(loadCampaigns());
  }, []);
  useEffect(() => {
    if (campaign && !selectedAudienceId && campaign.audiences.length) {
      setSelectedAudienceId(campaign.audiences[0].id);
    }
  }, [campaign, selectedAudienceId]);
  const guardrailsRanRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!id || guardrailsRanRef.current === id) return;
    guardrailsRanRef.current = id;
    setCampaigns((prev) => {
      const c = prev.find((x) => x.id === id);
      if (!c) return prev;
      const copy = JSON.parse(JSON.stringify(c)) as Campaign;
      runGuardrailsForCampaign(copy);
      saveCampaigns(prev.map((x) => (x.id === id ? copy : x)));
      return prev.map((x) => (x.id === id ? copy : x));
    });
  }, [id]);

  const persist = useCallback((updater: (c: Campaign) => Campaign) => {
    if (!id) return;
    setCampaigns((prev) => {
      const next = prev.map((c) => (c.id === id ? updater(c) : c));
      saveCampaigns(next);
      return next;
    });
  }, [id]);

  const updateAudience = useCallback(
    (audienceId: string, updater: (a: AudiencePlan) => AudiencePlan) => {
      persist((c) => ({
        ...c,
        updatedAt: new Date().toISOString(),
        audiences: c.audiences.map((a) => (a.id === audienceId ? updater(a) : a)),
      }));
    },
    [persist]
  );

  const handleReviseBlueprint = useCallback(
    async (instruction: string) => {
      if (!selectedAudience) return;
      setRegenerating(true);
      try {
        const docs = loadKbDocs();
        const profile = loadKbProfile();
        const kbContext = getKbContext(docs, profile);
        const revised = await reviseBlueprint(selectedAudience.blueprint, instruction, kbContext);
        const flow = await compileFlowFromBlueprint(revised, kbContext, selectedAudience.pinned);
        const proposedPayload: ProposedRegeneration = {
          blueprint: revised,
          flow,
          diffSummary: {
            blueprint: [
              { section: 'Revised', current: JSON.stringify(selectedAudience.blueprint), proposed: JSON.stringify(revised) },
            ],
            flow: { nodesAdded: 0, nodesRemoved: 0, nodesChanged: flow.nodes?.length ?? 0 },
          },
        };
        setProposed(proposedPayload);
        setShowDiff(true);
      } finally {
        setRegenerating(false);
      }
    },
    [selectedAudience]
  );

  const handleRegenerateAroundPinned = useCallback(async () => {
    if (!selectedAudience) return;
    setRegenerating(true);
    try {
      const docs = loadKbDocs();
      const profile = loadKbProfile();
      const kbContext = getKbContext(docs, profile);
      const result = await proposeRegenerationWithDiff(
        selectedAudience.blueprint,
        selectedAudience.flow,
        selectedAudience.pinned,
        kbContext
      );
      setProposed(result);
      setShowDiff(true);
    } finally {
      setRegenerating(false);
    }
  }, [selectedAudience]);

  const handleDiffAccept = useCallback(
    (accept: 'all' | 'blueprint' | 'flow' | 'reject') => {
      if (accept === 'reject' || !selectedAudience || !proposed) {
        setShowDiff(false);
        setProposed(null);
        return;
      }
      if (accept === 'all' || accept === 'blueprint') {
        updateAudience(selectedAudience.id, (a) => ({ ...a, blueprint: proposed.blueprint }));
      }
      if (accept === 'all' || accept === 'flow') {
        updateAudience(selectedAudience.id, (a) => ({ ...a, flow: proposed.flow }));
      }
      // If "Blueprint only" we keep current flow per spec
      setShowDiff(false);
      setProposed(null);
    },
    [selectedAudience, proposed, updateAudience]
  );

  const handlePublish = useCallback(() => {
    if (!campaign) return;
    const blockers = campaign.audiences.some((a) => a.issues.some((i) => i.severity === 'blocker'));
    if (blockers) {
      setShowReviewIssues(true);
      return;
    }
    persist((c) => ({ ...c, status: 'Published', updatedAt: new Date().toISOString() }));
  }, [campaign, persist]);

  if (!campaign) {
    return (
      <div className="page">
        <p>This campaign doesn’t exist or was removed.</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
          Back to campaigns
        </button>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'blueprint', label: 'Plan' },
    { id: 'preview', label: 'Preview' },
    { id: 'build', label: 'Flow' },
    { id: 'policies', label: 'Rules' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="page campaign-detail">
      <header className="campaign-detail-header">
        <div className="campaign-detail-title-row">
          <input
            type="text"
            value={campaign.name}
            onChange={(e) => persist((c) => ({ ...c, name: e.target.value }))}
            className="campaign-name-input"
          />
          <span className={`badge badge-${campaign.status.toLowerCase()}`}>{campaign.status}</span>
        </div>
        <div className="campaign-detail-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowReviewIssues(true)}
          >
            Check issues
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => handleRegenerateAroundPinned()} disabled={regenerating}>
            Redraft
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePublish}>
            Publish
          </button>
        </div>
      </header>

      <div className="campaign-detail-body">
        <aside className="campaign-audience-list">
          <h3>Audiences</h3>
          {campaign.audiences.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`audience-list-item ${selectedAudienceId === a.id ? 'active' : ''}`}
              onClick={() => setSelectedAudienceId(a.id)}
            >
              {a.name}
              {a.issues.some((i) => i.severity === 'blocker') && <span className="audience-issue-dot" title="Has blockers" />}
            </button>
          ))}
        </aside>

        <div className="campaign-main">
          {selectedAudience && (
            <>
              <div className="campaign-tabs">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="campaign-tab-content">
                {activeTab === 'blueprint' && (
                  <TabBlueprint
                    audience={selectedAudience}
                    onUpdate={(updater) => updateAudience(selectedAudience.id, updater)}
                    onRevise={handleReviseBlueprint}
                    regenerating={regenerating}
                  />
                )}
                {activeTab === 'preview' && <TabPreview audience={selectedAudience} />}
                {activeTab === 'build' && (
                  <TabBuild
                    audience={selectedAudience}
                    onUpdate={(updater) => updateAudience(selectedAudience.id, updater)}
                    onRegenerateAroundPinned={handleRegenerateAroundPinned}
                    regenerating={regenerating}
                  />
                )}
                {activeTab === 'policies' && (
                  <TabPolicies campaign={campaign} audience={selectedAudience} onUpdate={persist} />
                )}
                {activeTab === 'history' && <TabHistory campaign={campaign} />}
              </div>
            </>
          )}
        </div>
      </div>

      {showDiff && proposed && (
        <DiffModal
          proposed={proposed}
          onAccept={handleDiffAccept}
          onClose={() => { setShowDiff(false); setProposed(null); }}
        />
      )}
      {showReviewIssues && campaign && (
        <ReviewIssuesPanel
          campaign={campaign}
          onClose={() => setShowReviewIssues(false)}
          onFixWithSotto={(audienceId) => {
            setShowReviewIssues(false);
            setSelectedAudienceId(audienceId);
            setActiveTab('blueprint');
          }}
        />
      )}
    </div>
  );
}
