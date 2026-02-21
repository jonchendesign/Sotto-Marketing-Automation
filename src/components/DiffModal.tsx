import type { ProposedRegeneration } from '../types';

type AcceptChoice = 'all' | 'blueprint' | 'flow' | 'reject';

export default function DiffModal({
  proposed,
  onAccept,
  onClose,
}: {
  proposed: ProposedRegeneration;
  onAccept: (choice: AcceptChoice) => void;
  onClose: () => void;
}) {
  const diff = proposed.diffSummary;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal diff-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Compare drafts</h3>
        <p className="diff-intro">Here’s what changed. Pick what to keep.</p>

        {diff?.blueprint?.length > 0 && (
          <section className="diff-section">
            <h4>Blueprint</h4>
            <div className="diff-list">
              {diff.blueprint.map((d, i) => (
                <div key={i} className="diff-item">
                  <span className="diff-section-name">{d.section}</span>
                  <div className="diff-row">
                    <div className="diff-block">
                      <span className="diff-label">Current</span>
                      <pre>{typeof d.current === 'string' ? d.current.slice(0, 400) : JSON.stringify(d.current).slice(0, 400)}</pre>
                    </div>
                    <div className="diff-block">
                      <span className="diff-label">Proposed</span>
                      <pre>{typeof d.proposed === 'string' ? d.proposed.slice(0, 400) : JSON.stringify(d.proposed).slice(0, 400)}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {diff?.flow && (
          <section className="diff-section">
            <h4>Flow</h4>
            <p>
              Nodes: +{diff.flow.nodesAdded} / −{diff.flow.nodesRemoved} / changed {diff.flow.nodesChanged}
            </p>
            {diff.flow.details?.length ? (
              <ul>
                {diff.flow.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            ) : null}
          </section>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onAccept('reject')}>
            Keep current
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onAccept('blueprint')}>
            Plan only
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onAccept('flow')}>
            Flow only
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onAccept('all')}>
            Use this draft
          </button>
        </div>
      </div>
    </div>
  );
}
