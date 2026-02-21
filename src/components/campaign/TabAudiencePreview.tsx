import { useState } from 'react';
import type { Campaign, AudiencePlan, FlowNode } from '../../types';
import TabPolicies from './TabPolicies';
import MessageStudioDrawer from '../MessageStudioDrawer';

function flowToNarrative(flow: AudiencePlan['flow']): string {
  const nodes = flow?.nodes ?? [];
  const edges = flow?.edges ?? [];
  if (nodes.length === 0) return 'No steps yet.';
  const parts: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let current = nodes.find((n) => n.type === 'trigger') ?? nodes[0];
  const seen = new Set<string>();
  let steps = 0;
  while (current && steps < 20) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    if (current.type === 'trigger') parts.push('Start');
    else if (current.type === 'message') parts.push(`Send: ${current.label}`);
    else if (current.type === 'delay') parts.push(`Wait ${(current.data?.days ?? current.data?.duration ?? '?')} days`);
    else if (current.type === 'condition') parts.push(`If ${current.label}`);
    else if (current.type === 'exit') {
      parts.push('End');
      break;
    }
    const out = edges.find((e) => e.from === current.id);
    if (!out) break;
    const next = byId.get(out.to);
    if (!next) break;
    current = next;
    steps++;
  }
  return parts.join(' → ');
}

function getMessageNodes(flow: AudiencePlan['flow']): FlowNode[] {
  return (flow?.nodes ?? []).filter((n) => n.type === 'message');
}

function getMessageCopy(n: FlowNode): string {
  return (n.data?.smsCopy as string) || (n.data?.body as string) || n.label || '';
}

export default function TabAudiencePreview({
  campaign,
  audience,
  onUpdateAudience,
  onRegenerateAroundPinned: _onRegenerateAroundPinned,
  regenerating: _regenerating,
}: {
  campaign: Campaign;
  audience: AudiencePlan;
  onUpdateAudience: (updater: (a: AudiencePlan) => AudiencePlan) => void;
  onRegenerateAroundPinned: () => void;
  regenerating: boolean;
}) {
  const [, setSimulating] = useState(false);
  const [tryResponse, setTryResponse] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [flowView, setFlowView] = useState<'narrative' | 'graph'>('narrative');
  const [messageStudio, setMessageStudio] = useState<{ node: FlowNode; copy: string } | null>(null);
  const [howWeRespondExpanded, setHowWeRespondExpanded] = useState<Record<string, boolean>>({});

  const flow = audience.flow;
  const messageNodes = getMessageNodes(flow);
  const narrative = flowToNarrative(flow);
  const history = campaign.history ?? [];
  const recentChanges = history.slice(0, 5);
  const lastUpdated = campaign.updatedAt;

  const responsePaths = (flow?.edges ?? [])
    .filter((e) => e.condition || e.label)
    .map((e, i) => ({
      id: e.id || `path-${i}`,
      summary: e.label || e.condition || `${e.from} → ${e.to}`,
      detail: e.condition ? `Condition: ${e.condition}` : (e.label ? `Branch: ${e.label}` : ''),
    }));

  const openMessageStudio = (node: FlowNode) => {
    setMessageStudio({ node, copy: getMessageCopy(node) });
  };

  const saveMessageStudio = (newCopy: string) => {
    if (!messageStudio) return;
    const nodeId = messageStudio.node.id;
    onUpdateAudience((a) => ({
      ...a,
      flow: {
        ...a.flow,
        nodes: a.flow.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, smsCopy: newCopy, body: newCopy } } : n
        ),
      },
    }));
    setMessageStudio(null);
  };

  // Group message nodes by label for "n variants" display
  const messageGroups = messageNodes.reduce<{ label: string; nodes: FlowNode[] }[]>((acc, n) => {
    const key = n.label || 'Message';
    const existing = acc.find((g) => g.label === key);
    if (existing) existing.nodes.push(n);
    else acc.push({ label: key, nodes: [n] });
    return acc;
  }, []);

  return (
    <div className="tab-audience-preview">
      <header className="audience-preview-header">
        <h4 className="audience-preview-title">
          Viewing conversation draft for <strong>{audience.name}</strong>
        </h4>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setSimulating(true)}
        >
          Run simulation
        </button>
      </header>

      <div className="audience-preview-layout">
        <aside className="audience-context-card">
          <h5>Audience context</h5>
          <ul>
            <li>{audience.blueprint.audienceDefinition?.plain ?? audience.name}</li>
            <li>Goal: {(audience.blueprint.goal || audience.blueprint.coreIdea) ?? '—'}</li>
            <li>Cadence: {audience.blueprint.cadence?.maxPerWeek ?? 0}/week</li>
          </ul>
          <p className="audience-context-cta">Make changes with Sotto AI</p>
        </aside>

        <div className="audience-preview-main">
          {/* Primary message card(s) — show as "Message name (n variants)" where applicable */}
          <section className="preview-section">
            <h5>Messages</h5>
            {messageGroups.length === 0 ? (
              <p className="preview-empty">No messages in this flow yet.</p>
            ) : (
              messageGroups.map((grp, gi) => (
                <div key={gi} className="message-card-primary">
                  <div className="message-card-header">
                    <span className="message-card-title">
                      {grp.label}
                      {grp.nodes.length > 1 ? ` (${grp.nodes.length} variants)` : ''}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openMessageStudio(grp.nodes[0])}
                    >
                      Edit
                    </button>
                  </div>
                  <p className="message-card-snippet">
                    {getMessageCopy(grp.nodes[0]).slice(0, 120)}
                    {(getMessageCopy(grp.nodes[0]).length > 120) ? '…' : ''}
                  </p>
                </div>
              ))
            )}
          </section>

          {/* How we respond */}
          <section className="preview-section">
            <h5>How we respond</h5>
            {responsePaths.length === 0 ? (
              <p className="preview-empty">No response branches defined.</p>
            ) : (
              <div className="how-we-respond-list">
                {responsePaths.map((path) => (
                  <details
                    key={path.id}
                    className="how-we-respond-item"
                    open={!!howWeRespondExpanded[path.id]}
                    onToggle={(e) =>
                      setHowWeRespondExpanded((prev) => ({ ...prev, [path.id]: (e.target as HTMLDetailsElement).open }))
                    }
                  >
                    <summary>{path.summary}</summary>
                    {path.detail && <p className="how-we-respond-detail">{path.detail}</p>}
                  </details>
                ))}
              </div>
            )}
          </section>

          {/* Try a response */}
          <section className="preview-section">
            <label className="preview-label">Try a response</label>
            <div className="try-response-row">
              <input
                type="text"
                className="try-response-input"
                placeholder="Type a customer reply to see routing..."
                value={tryResponse}
                onChange={(e) => setTryResponse(e.target.value)}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSimulating(true)}>
                Simulate
              </button>
            </div>
          </section>

          {/* Post-purchase / Exit */}
          <section className="preview-section">
            <h5>Post-purchase & exit</h5>
            <p className="preview-muted">End states and confirmation messages. Edit in Message Studio when needed.</p>
          </section>
        </div>
      </div>

      {/* Details accordion: Flow, Rules, Recent changes */}
      <details
        className="details-accordion"
        open={detailsOpen}
        onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>Details (Logic & rules)</summary>
        <div className="details-accordion-inner">
          {/* A) Flow details */}
          <section className="details-section">
            <h6>Flow details</h6>
            {flowView === 'narrative' ? (
              <p className="flow-narrative">{narrative}</p>
            ) : (
              <div className="flow-graph-compact">
                {(flow?.nodes ?? []).map((n) => (
                  <div key={n.id} className="flow-node-mini">
                    <span className="flow-node-mini-type">{n.type}</span>
                    <span className="flow-node-mini-label">{n.label}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setFlowView(flowView === 'narrative' ? 'graph' : 'narrative')}
            >
              {flowView === 'narrative' ? 'Show node graph / full step list' : 'Show readable narrative'}
            </button>
          </section>

          {/* B) Rule details (Guardrails) */}
          <section className="details-section">
            <h6>Rule details</h6>
            <TabPolicies campaign={campaign} audience={audience} />
          </section>

          {/* C) Recent changes */}
          <section className="details-section">
            <h6>Recent changes</h6>
            <p className="recent-meta">Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : '—'}</p>
            <ul className="recent-changes-list">
              {recentChanges.map((v) => (
                <li key={v.id}>
                  <span className="recent-time">{new Date(v.timestamp).toLocaleString()}</span>
                  <span className="recent-author">{v.author}</span>
                  {v.notes && <span className="recent-notes">{v.notes}</span>}
                </li>
              ))}
            </ul>
            {history.length > 5 && (
              <button type="button" className="btn btn-secondary btn-sm">
                View all
              </button>
            )}
          </section>
        </div>
      </details>

      {messageStudio && (
        <MessageStudioDrawer
          title={messageStudio.node.label}
          copy={messageStudio.copy}
          onSave={saveMessageStudio}
          onClose={() => setMessageStudio(null)}
        />
      )}
    </div>
  );
}
