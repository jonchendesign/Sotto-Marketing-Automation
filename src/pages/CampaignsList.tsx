import React from 'react';
import { Link } from 'react-router-dom';
import type { Campaign } from '../types';
import { loadCampaigns } from '../lib/storage';

export default function CampaignsList() {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>(() => loadCampaigns());

  React.useEffect(() => {
    setCampaigns(loadCampaigns());
  }, []);

  return (
    <div className="page campaigns-list">
      <header className="page-header">
        <h1>Campaigns</h1>
        <Link to="/campaigns/new" className="btn btn-primary">
          New campaign
        </Link>
      </header>
      {campaigns.length === 0 ? (
        <div className="empty-state">
          <p>You’re not running any campaigns yet. Tell Sotto what you want to achieve and it’ll draft the rest.</p>
          <Link to="/campaigns/new" className="btn btn-primary">
            Start a campaign
          </Link>
        </div>
      ) : (
        <ul className="campaign-list">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link to={`/campaigns/${c.id}`} className="campaign-list-item">
                <span className="campaign-list-name">{c.name}</span>
                <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                <span className="campaign-list-meta">
                  {new Date(c.updatedAt).toLocaleDateString()} · {c.primaryGoal || c.intentSummary.slice(0, 40)}…
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
