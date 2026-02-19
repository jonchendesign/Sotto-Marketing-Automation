import { useState } from 'react';
import type { Campaign } from '../../types';

export default function TabHistory({ campaign }: { campaign: Campaign }) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const history = campaign.history ?? [];
  const selected = history.find((v) => v.id === selectedVersionId);

  return (
    <div className="tab-history">
      <h4>Version history</h4>
      <ul className="history-list">
        {history.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className={`history-item ${selectedVersionId === v.id ? 'active' : ''}`}
              onClick={() => setSelectedVersionId(selectedVersionId === v.id ? null : v.id)}
            >
              <span className="history-time">{new Date(v.timestamp).toLocaleString()}</span>
              <span className="history-author">{v.author}</span>
              {v.notes && <span className="history-notes">{v.notes}</span>}
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="history-detail">
          <h4>Snapshot</h4>
          {selected.blueprintSnapshot && (
            <details>
              <summary>Blueprint</summary>
              <pre>{JSON.stringify(selected.blueprintSnapshot, null, 2).slice(0, 1500)}…</pre>
            </details>
          )}
          {selected.flowSnapshot && (
            <details>
              <summary>Flow</summary>
              <pre>{JSON.stringify(selected.flowSnapshot, null, 2).slice(0, 800)}…</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
