import { useState, useEffect } from 'react';

export default function MessageStudioDrawer({
  title,
  copy,
  onSave,
  onClose,
}: {
  title: string;
  copy: string;
  onSave: (newCopy: string) => void;
  onClose: () => void;
}) {
  const [editableCopy, setEditableCopy] = useState(copy);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEditableCopy(copy);
  }, [copy]);

  const handleSave = () => {
    onSave(editableCopy);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const charCount = editableCopy.length;
  const smsSegmentCount = Math.ceil(editableCopy.length / 160) || 1;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer message-studio-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Message Studio — {title}</h3>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="drawer-content">
          <label className="message-studio-label">Copy</label>
          <textarea
            className="message-studio-textarea"
            value={editableCopy}
            onChange={(e) => setEditableCopy(e.target.value)}
            placeholder="Message copy…"
            rows={4}
          />
          <div className="message-studio-meta">
            <span className="message-studio-chars">{charCount} characters</span>
            <span className="message-studio-segments">{smsSegmentCount} SMS segment(s)</span>
          </div>
          <p className="message-studio-hint">Token preview and compliance checks apply when you save.</p>
          <div className="drawer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
