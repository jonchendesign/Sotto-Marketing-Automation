import type { Campaign, Issue } from '../types';

export default function ReviewIssuesPanel({
  campaign,
  onClose,
  onFixWithSotto,
}: {
  campaign: Campaign;
  onClose: () => void;
  onFixWithSotto: (audienceId: string) => void;
}) {
  const allIssues: { audienceId: string; audienceName: string; issue: Issue }[] = [];
  campaign.audiences.forEach((a) => {
    a.issues.forEach((issue) => allIssues.push({ audienceId: a.id, audienceName: a.name, issue }));
  });
  const blockers = allIssues.filter((x) => x.issue.severity === 'blocker');
  const warnings = allIssues.filter((x) => x.issue.severity === 'warning');
  const infos = allIssues.filter((x) => x.issue.severity === 'info');
  const canPublish = blockers.length === 0;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer review-issues-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Check before you publish</h3>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="drawer-content">
          {allIssues.length === 0 ? (
            <p className="issues-clear">Nothing blocking. You’re good to publish.</p>
          ) : (
            <>
              {blockers.length > 0 && (
                <section className="issues-group">
                  <h4 className="issues-severity-blocker">Must fix</h4>
                  {blockers.map(({ audienceId, issue }) => (
                    <div key={issue.id} className="issue-card issue-blocker">
                      <strong>{issue.title}</strong>
                      <p>{issue.detail}</p>
                      {issue.suggestedAction && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onFixWithSotto(audienceId)}
                        >
                          Ask Sotto to fix
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              )}
              {warnings.length > 0 && (
                <section className="issues-group">
                  <h4 className="issues-severity-warning">Heads up</h4>
                  {warnings.map(({ audienceId, issue }) => (
                    <div key={issue.id} className="issue-card issue-warning">
                      <strong>{issue.title}</strong>
                      <p>{issue.detail}</p>
                      {issue.suggestedAction && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onFixWithSotto(audienceId)}
                        >
                          Ask Sotto to fix
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              )}
              {infos.length > 0 && (
                <section className="issues-group">
                  <h4 className="issues-severity-info">Optional</h4>
                  {infos.map(({ issue }) => (
                    <div key={issue.id} className="issue-card issue-info">
                      <strong>{issue.title}</strong>
                      <p>{issue.detail}</p>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          <p className="issues-publish-note">
            {canPublish ? 'Blockers cleared. Ready when you are.' : 'Resolve the blockers above, then you can publish.'}
          </p>
        </div>
      </div>
    </div>
  );
}
