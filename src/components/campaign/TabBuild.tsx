import type { AudiencePlan } from '../../types';

export default function TabBuild({
  audience,
  onUpdate,
  onRegenerateAroundPinned,
  regenerating,
}: {
  audience: AudiencePlan;
  onUpdate: (updater: (a: AudiencePlan) => AudiencePlan) => void;
  onRegenerateAroundPinned: () => void;
  regenerating: boolean;
}) {
  const nodes = (audience.flow?.nodes ?? []).map((n) => ({
    ...n,
    pinned: n.pinned ?? audience.pinned.pinnedNodeIds.includes(n.id),
  }));
  const edges = audience.flow?.edges ?? [];

  const togglePin = (nodeId: string) => {
    const pinned = audience.pinned.pinnedNodeIds.includes(nodeId)
      ? audience.pinned.pinnedNodeIds.filter((id) => id !== nodeId)
      : [...audience.pinned.pinnedNodeIds, nodeId];
    onUpdate((a) => ({
      ...a,
      pinned: { ...a.pinned, pinnedNodeIds: pinned },
      flow: {
        ...a.flow,
        nodes: a.flow.nodes.map((n) => (n.id === nodeId ? { ...n, pinned: !n.pinned } : n)),
      },
    }));
  };

  return (
    <div className="tab-build">
      <p className="tab-build-intro">The sequence Sotto will run. Pin any step you want to keep; we’ll redraft around it.</p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={regenerating}
        onClick={onRegenerateAroundPinned}
      >
        Redraft around pinned steps
      </button>
      <div className="flow-graph-list">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`flow-node-card flow-node-${node.type} ${node.pinned ? 'pinned' : ''}`}
          >
            <div className="flow-node-header">
              <span className="flow-node-type">{node.type}</span>
              {node.pinned && <span className="badge badge-pinned">Pinned</span>}
              <button
                type="button"
                className="btn-icon btn-pin"
                onClick={() => togglePin(node.id)}
                title={node.pinned ? 'Unpin' : 'Pin'}
              >
                📌
              </button>
            </div>
            <span className="flow-node-label">{node.label}</span>
            {node.type === 'message' && node.data?.smsCopy != null && (
              <p className="flow-node-preview">{String(node.data.smsCopy).slice(0, 80)}…</p>
            )}
            {node.type === 'delay' && (
              <span className="flow-node-data">{String(node.data?.days ?? node.data?.duration ?? '—')} days</span>
            )}
          </div>
        ))}
      </div>
      <div className="flow-edges">
        <h4>Branches</h4>
        {edges.map((e) => (
          <div key={e.id} className="flow-edge-item">
            {e.from} → {e.to} {e.label && `(${e.label})`}
          </div>
        ))}
      </div>
    </div>
  );
}
