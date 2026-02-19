import { useState } from 'react';
import type { AudiencePlan, AudienceBlueprint } from '../../types';

const TONE_OPTIONS = ['Brand', 'Playful', 'Premium', 'Direct'] as const;
const OFFER_OPTIONS = ['No discount', 'Escalate', 'Always'] as const;
const STRICTNESS_OPTIONS = ['Broaden', 'Narrow', 'Keep'] as const;

function journeyAtGlance(audience: AudiencePlan): { touchpoints: number; days: number; stopSummary: string; nonResponseSummary: string; branchSummary: string } {
  const nodes = audience.flow?.nodes ?? [];
  const edges = audience.flow?.edges ?? [];
  const messageCount = nodes.filter((n) => n.type === 'message').length;
  let totalDays = 0;
  nodes.forEach((n) => {
    if (n.type === 'delay' && typeof n.data?.days === 'number') totalDays += n.data.days;
  });
  const b = audience.blueprint;
  const stopSummary = (b.stopConditions?.length ? b.stopConditions.join('; ') : '—') || '—';
  const nonResponseSummary = b.doNothingBehavior ?? '—';
  const branchSummary = edges.length
    ? edges.map((e) => (e.label ? e.label : e.condition ? `If ${e.condition}` : `${e.from} → ${e.to}`)).join('; ')
    : 'Single path';
  return {
    touchpoints: messageCount,
    days: totalDays || 7,
    stopSummary,
    nonResponseSummary,
    branchSummary,
  };
}

export default function TabBlueprint({
  audience,
  onUpdate,
  onRevise,
  regenerating,
}: {
  audience: AudiencePlan;
  onUpdate: (updater: (a: AudiencePlan) => AudiencePlan) => void;
  onRevise: (instruction: string) => void;
  regenerating: boolean;
}) {
  const [reviseInput, setReviseInput] = useState('');
  const b = audience.blueprint;
  const glance = journeyAtGlance(audience);

  return (
    <div className="tab-blueprint tab-strategy">
      {/* At a glance — Goal is verb + outcome; audience name lives in the lens only */}
      <section className="blueprint-section">
        <h4>Summary</h4>
        <div className="glance-cards">
          <div className="glance-card">
            <span className="glance-label">Goal</span>
            <span className="glance-value">{b.goal ?? '—'}</span>
          </div>
          <div className="glance-card">
            <span className="glance-label">Audience</span>
            <span className="glance-value">{b.audienceDefinition?.plain ?? '—'}</span>
          </div>
          <div className="glance-card">
            <span className="glance-label">Core idea</span>
            <span className="glance-value">{b.coreIdea ?? '—'}</span>
          </div>
          <div className="glance-card">
            <span className="glance-label">Cadence</span>
            <span className="glance-value">
              {b.cadence?.maxPerWeek ?? 0} per week
              {b.cadence?.quietHours ? ` · ${b.cadence.quietHours}` : ''}
            </span>
          </div>
        </div>
      </section>

      {/* Journey at a glance */}
      <section className="blueprint-section journey-at-glance">
        <h4>Journey at a glance</h4>
        <div className="journey-glance-card">
          <p><strong>Touchpoints & spacing:</strong> {glance.touchpoints} touches over {glance.days} days</p>
          <p><strong>Stop conditions:</strong> {glance.stopSummary}</p>
          <p><strong>Non-response handling:</strong> {glance.nonResponseSummary}</p>
          <p><strong>Branch summary:</strong> {glance.branchSummary}</p>
        </div>
      </section>

      {/* If they do nothing */}
      <section className="blueprint-section">
        <h4>When they don’t respond</h4>
        <div className="blueprint-card">
          <p>{b.doNothingBehavior ?? '—'}</p>
        </div>
      </section>

      {/* Stop conditions */}
      <section className="blueprint-section">
        <h4>When we stop</h4>
        <div className="blueprint-card">
          <ul>
            {(b.stopConditions ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
            {(!b.stopConditions || b.stopConditions.length === 0) && <li>—</li>}
          </ul>
        </div>
      </section>

      {/* Anchor messages */}
      <section className="blueprint-section">
        <h4>Sample messages</h4>
        <div className="anchor-messages">
          {(b.anchorMessages ?? []).slice(0, 2).map((m, i) => (
            <div key={i} className="anchor-message-card">
              <span className="anchor-title">{m.title}</span>
              <p className="anchor-copy">{m.smsCopy}</p>
              {m.toneNotes && <span className="anchor-tone">{m.toneNotes}</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Rationale & Assumptions */}
      <section className="blueprint-section">
        <h4>Why it’s built this way</h4>
        <div className="blueprint-card">
          <ul>
            {(b.rationale ?? []).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
            {(b.assumptions ?? []).map((a, i) => (
              <li key={`a-${i}`}>{a}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* AI Review Checklist */}
      <section className="blueprint-section">
        <h4>Quality check</h4>
        <div className="checklist">
          {(b.checklist ?? []).map((c, i) => (
            <div key={i} className={`checklist-item ${c.status}`}>
              <span>{c.status === 'pass' ? '✓' : '○'}</span>
              <span>{c.item}</span>
              {c.reason && <span className="checklist-reason">{c.reason}</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Quick edits */}
      <section className="blueprint-section quick-edits">
        <h4>Adjust without rewriting</h4>
        <div className="quick-edit-row">
          <label>Cadence (max/week)</label>
          <input
            type="number"
            min={1}
            max={7}
            value={b.cadence?.maxPerWeek ?? 3}
            onChange={(e) =>
              onUpdate((a) => ({
                ...a,
                blueprint: {
                  ...a.blueprint,
                  cadence: { ...a.blueprint.cadence, maxPerWeek: Math.max(1, parseInt(e.target.value, 10) || 1) },
                },
              }))
            }
          />
        </div>
        <div className="quick-edit-row">
          <label>Tone</label>
          <select
            value={b.tone ?? 'Brand'}
            onChange={(e) =>
              onUpdate((a) => ({
                ...a,
                blueprint: { ...a.blueprint, tone: e.target.value as AudienceBlueprint['tone'] },
              }))
            }
          >
            {TONE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="quick-edit-row">
          <label>Offer strategy</label>
          <select
            value={b.offerStrategy ?? 'No discount'}
            onChange={(e) =>
              onUpdate((a) => ({
                ...a,
                blueprint: { ...a.blueprint, offerStrategy: e.target.value as AudienceBlueprint['offerStrategy'] },
              }))
            }
          >
            {OFFER_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="quick-edit-row">
          <label>Audience strictness</label>
          <select
            value={b.audienceStrictness ?? 'Keep'}
            onChange={(e) =>
              onUpdate((a) => ({
                ...a,
                blueprint: { ...a.blueprint, audienceStrictness: e.target.value as AudienceBlueprint['audienceStrictness'] },
              }))
            }
          >
            {STRICTNESS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Ask Sotto to revise */}
      <section className="blueprint-section">
        <h4>Ask for a change</h4>
        <div className="revise-input-row">
          <input
            type="text"
            value={reviseInput}
            onChange={(e) => setReviseInput(e.target.value)}
            placeholder="e.g. Fewer messages per week, or warmer tone"
            disabled={regenerating}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!reviseInput.trim() || regenerating}
            onClick={() => {
              onRevise(reviseInput.trim());
              setReviseInput('');
            }}
          >
            {regenerating ? '…' : 'Update draft'}
          </button>
        </div>
      </section>
    </div>
  );
}
