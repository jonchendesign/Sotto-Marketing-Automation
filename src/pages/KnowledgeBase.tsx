import { useState, useEffect } from 'react';
import { loadKbDocs, saveKbDocs, loadKbProfile, saveKbProfile } from '../lib/storage';
import { extractKbProfile } from '../api/client';
import type { KnowledgeBaseDoc, KnowledgeBaseProfile, KBTag } from '../types';

const TAGS: KBTag[] = ['Brand voice', 'Offer policy', 'Compliance', 'Past campaigns', 'Audience definitions'];

function nanoid() {
  return 'kb-' + Math.random().toString(36).slice(2, 11);
}

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<KnowledgeBaseDoc[]>(() => loadKbDocs());
  const [profile, setProfile] = useState<KnowledgeBaseProfile | null>(() => loadKbProfile());
  const [uploadText, setUploadText] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadTags, setUploadTags] = useState<KBTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<KnowledgeBaseProfile | null>(null);

  useEffect(() => {
    saveKbDocs(docs);
  }, [docs]);
  useEffect(() => {
    if (profile) saveKbProfile(profile);
  }, [profile]);

  const handleAddDoc = async () => {
    if (!uploadText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const extracted = await extractKbProfile(uploadText, uploadTitle || undefined, uploadTags.length ? uploadTags : undefined);
      const doc: KnowledgeBaseDoc = {
        id: nanoid(),
        title: uploadTitle || 'Untitled',
        tags: uploadTags,
        rawText: uploadText,
        extracted: {
          voice: extracted.voice ?? [],
          dos: extracted.dos ?? [],
          donts: extracted.donts ?? [],
          policies: extracted.policies ?? [],
        },
        createdAt: new Date().toISOString(),
      };
      setDocs((prev) => [...prev, doc]);
      setUploadText('');
      setUploadTitle('');
      setUploadTags([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const defaultProfile: KnowledgeBaseProfile = {
    brandVoice: '',
    offerPolicy: '',
    complianceRules: '',
    audienceGuidelines: '',
  };

  const startEditProfile = () => {
    setProfileDraft(profile ? { ...profile } : { ...defaultProfile });
    setEditingProfile(true);
  };
  const saveProfile = () => {
    if (profileDraft) {
      setProfile(profileDraft);
      saveKbProfile(profileDraft);
    }
    setEditingProfile(false);
    setProfileDraft(null);
  };

  return (
    <div className="page knowledge-base">
      <header className="page-header">
        <h1>Knowledge base</h1>
      </header>
      <p className="page-description">Add your brand voice, offer rules, and compliance notes. Sotto uses this when it drafts campaigns so they sound like you and stay in bounds.</p>

      <section className="kb-upload">
        <h3>Add a document</h3>
        <p className="kb-hint">Paste text from style guides, promo rules, or compliance docs. We’ll pull out the bits that matter for drafting.</p>
        <input
          type="text"
          value={uploadTitle}
          onChange={(e) => setUploadTitle(e.target.value)}
          placeholder="e.g. Brand voice guide"
          className="kb-input"
        />
        <div className="kb-tags">
          {TAGS.map((t) => (
            <label key={t}>
              <input
                type="checkbox"
                checked={uploadTags.includes(t)}
                onChange={(e) =>
                  setUploadTags((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
                }
              />
              {t}
            </label>
          ))}
        </div>
        <textarea
          value={uploadText}
          onChange={(e) => setUploadText(e.target.value)}
          placeholder="Paste your doc here…"
          rows={6}
          className="kb-textarea"
        />
        {error && <div className="form-error">{error}</div>}
        <button type="button" className="btn btn-primary" onClick={handleAddDoc} disabled={loading}>
          {loading ? 'Reading…' : 'Add & extract'}
        </button>
      </section>

      <section className="kb-docs">
        <h3>Your documents</h3>
        <ul className="kb-doc-list">
          {docs.map((d) => (
            <li key={d.id} className="kb-doc-card">
              <div className="kb-doc-header">
                <strong>{d.title}</strong>
                <span className="kb-doc-tags">{d.tags.join(', ')}</span>
              </div>
              <div className="kb-doc-extracted">
                <h4>What we use from this</h4>
                {d.extracted.voice?.length > 0 && (
                  <p><strong>Voice:</strong> {d.extracted.voice.join('; ')}</p>
                )}
                {d.extracted.dos?.length > 0 && (
                  <p><strong>Do:</strong> {d.extracted.dos.join('; ')}</p>
                )}
                {d.extracted.donts?.length > 0 && (
                  <p><strong>Don’t:</strong> {d.extracted.donts.join('; ')}</p>
                )}
                {d.extracted.policies?.length > 0 && (
                  <p><strong>Policies:</strong> {d.extracted.policies.join('; ')}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="kb-profile">
        <h3>What Sotto uses when it drafts</h3>
        {editingProfile && profileDraft ? (
          <div className="profile-edit">
            <label>Brand voice</label>
            <textarea
              value={profileDraft.brandVoice}
              onChange={(e) => setProfileDraft({ ...profileDraft, brandVoice: e.target.value })}
              rows={2}
            />
            <label>Offer policy</label>
            <textarea
              value={profileDraft.offerPolicy}
              onChange={(e) => setProfileDraft({ ...profileDraft, offerPolicy: e.target.value })}
              rows={2}
            />
            <label>Compliance rules</label>
            <textarea
              value={profileDraft.complianceRules}
              onChange={(e) => setProfileDraft({ ...profileDraft, complianceRules: e.target.value })}
              rows={2}
            />
            <label>Audience guidelines</label>
            <textarea
              value={profileDraft.audienceGuidelines}
              onChange={(e) => setProfileDraft({ ...profileDraft, audienceGuidelines: e.target.value })}
              rows={2}
            />
            <button type="button" className="btn btn-primary" onClick={saveProfile}>Save profile</button>
          </div>
        ) : (
          <div className="profile-display">
            {profile ? (
              <>
                <p><strong>Brand voice:</strong> {profile.brandVoice || '—'}</p>
                <p><strong>Offer policy:</strong> {profile.offerPolicy || '—'}</p>
                <p><strong>Compliance:</strong> {profile.complianceRules || '—'}</p>
                <p><strong>Audience:</strong> {profile.audienceGuidelines || '—'}</p>
              </>
            ) : (
              <p>Add documents above, then edit this summary so Sotto knows how to write for you.</p>
            )}
            <button type="button" className="btn btn-secondary" onClick={startEditProfile}>
              Edit summary
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
