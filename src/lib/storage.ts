import type { Campaign, KnowledgeBaseDoc, KnowledgeBaseProfile } from '../types';

const CAMPAIGNS_KEY = 'sotto-campaigns';
const KB_DOCS_KEY = 'sotto-kb-docs';
const KB_PROFILE_KEY = 'sotto-kb-profile';

export function loadCampaigns(): Campaign[] {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCampaigns(campaigns: Campaign[]) {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

export function loadKbDocs(): KnowledgeBaseDoc[] {
  try {
    const raw = localStorage.getItem(KB_DOCS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveKbDocs(docs: KnowledgeBaseDoc[]) {
  localStorage.setItem(KB_DOCS_KEY, JSON.stringify(docs));
}

export function loadKbProfile(): KnowledgeBaseProfile | null {
  try {
    const raw = localStorage.getItem(KB_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveKbProfile(profile: KnowledgeBaseProfile) {
  localStorage.setItem(KB_PROFILE_KEY, JSON.stringify(profile));
}

export function getKbContext(docs: KnowledgeBaseDoc[], profile: KnowledgeBaseProfile | null): string {
  const parts: string[] = [];
  if (profile) {
    parts.push('Profile:', profile.brandVoice, profile.offerPolicy, profile.complianceRules, profile.audienceGuidelines);
  }
  docs.forEach((d) => {
    parts.push(`Doc "${d.title}":`, ...d.extracted.voice, ...d.extracted.dos, ...d.extracted.donts, ...d.extracted.policies);
  });
  return parts.join('\n').slice(0, 15000);
}
