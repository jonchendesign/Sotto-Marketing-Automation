import type { Campaign, AudiencePlan } from '../../types';

export default function TabPolicies({
  campaign,
  audience,
  onUpdate: _onUpdate,
}: {
  campaign: Campaign;
  audience: AudiencePlan;
  onUpdate?: (updater: (c: Campaign) => Campaign) => void;
}) {
  const globalRules = campaign.globalPolicies ?? [];
  const audienceRules = audience.policies ?? [];

  return (
    <div className="tab-policies">
      <h4>Global rules</h4>
      <div className="policies-list">
        {globalRules.length === 0 ? (
          <p>No global rules yet — e.g. frequency caps, quiet hours, who we never message.</p>
        ) : (
          globalRules.map((r) => (
            <div key={r.id} className="policy-card">
              <span className="policy-type">{r.type}</span>
              <span className="policy-label">{r.label}</span>
              <span className="policy-value">{r.value}</span>
            </div>
          ))
        )}
      </div>
      <h4>This audience only</h4>
      <div className="policies-list">
        {audienceRules.length === 0 ? (
          <p>No extra rules for this audience.</p>
        ) : (
          audienceRules.map((r) => (
            <div key={r.id} className="policy-card">
              <span className="policy-type">{r.type}</span>
              <span className="policy-label">{r.label}</span>
              <span className="policy-value">{r.value}</span>
            </div>
          ))
        )}
      </div>
      <details className="policies-logic">
        <summary>View rule details</summary>
        <pre className="logic-pre">
          {JSON.stringify({ global: globalRules, audience: audienceRules }, null, 2)}
        </pre>
      </details>
    </div>
  );
}
