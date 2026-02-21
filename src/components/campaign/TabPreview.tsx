import { useState } from 'react';
import type { AudiencePlan, FlowNode } from '../../types';

type Scenario = 'engaged' | 'ignored' | 'purchased';

export default function TabPreview({ audience }: { audience: AudiencePlan }) {
  const [scenario, setScenario] = useState<Scenario>('engaged');
  const flow = audience.flow;
  const getMessageCopy = (n: FlowNode) => (n.data?.smsCopy as string) || (n.data?.body as string) || n.label;

  const timeline: { day: number; label: string; copy?: string }[] = [];
  let day = 0;
  flow?.nodes?.forEach((n) => {
    if (n.type === 'message') {
      timeline.push({ day, label: n.label, copy: getMessageCopy(n) });
      day += 2;
    }
    if (n.type === 'delay' && typeof n.data?.days === 'number') day += n.data.days;
  });

  return (
    <div className="tab-preview">
      <h4>See what they get</h4>
      <div className="scenario-toggles">
        {(['engaged', 'ignored', 'purchased'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn btn-secondary btn-sm ${scenario === s ? 'active' : ''}`}
            onClick={() => setScenario(s)}
          >
            {s === 'engaged' ? 'They engage' : s === 'ignored' ? 'They ignore' : 'They buy'}
          </button>
        ))}
      </div>
      <p className="preview-desc">
        {scenario === 'engaged' && 'They clicked or replied; here’s the follow-up path.'}
        {scenario === 'ignored' && 'No response; this is the “when they don’t respond” path.'}
        {scenario === 'purchased' && 'They converted; we stop messaging.'}
      </p>
      <h4>Timeline</h4>
      <div className="preview-timeline">
        {timeline.length === 0 ? (
          <p>No messages in this flow yet.</p>
        ) : (
          timeline.map((t, i) => (
            <div key={i} className="preview-touch">
              <span className="preview-day">Day {t.day}</span>
              <span className="preview-label">{t.label}</span>
              {t.copy && <p className="preview-copy">{t.copy}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
