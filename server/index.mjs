/**
 * Sotto API server - Gemini-backed campaign generation.
 * Set GEMINI_API_KEY in .env (project root) or in env. Proxy /api from Vite to this server (e.g. port 3001).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Default: gemini-3-flash-preview (e.g. 1500 RPD). Override with GEMINI_MODEL in .env.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const GEMINI_FALLBACK_MODELS = ['gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-3-pro-preview'];
const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

function parseJsonFromText(text) {
  const stripped = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGemini(prompt, systemInstruction = null, jsonMode = true) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
      ...(jsonMode && { responseMimeType: 'application/json' }),
    },
    ...(systemInstruction && {
      systemInstruction: { parts: [{ text: systemInstruction }] },
    }),
  };
  const modelsToTry = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== GEMINI_MODEL)];
  let lastError;
  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(GEMINI_URL(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('No text in Gemini response');
        return jsonMode ? parseJsonFromText(text) : text;
      }
      const err = await res.text();
      lastError = new Error(`Gemini API error: ${res.status} ${err}`);
      if (res.status === 503 && attempt < 3) {
        await sleep(1000 * attempt);
        continue;
      }
      if (res.status !== 503) break;
    }
  }
  throw lastError;
}

// --- 1) generateCampaignDraft(intent, kbContext) -> CampaignDraft
app.post('/api/generate-draft', async (req, res) => {
  try {
    const { intent, kbContext = '' } = req.body;
    if (!intent) {
      return res.status(400).json({ error: 'intent is required' });
    }
    const system = `You are Sotto AI, an expert at drafting SMS marketing campaigns. Output strict JSON only. No markdown code fences.
Context from Knowledge Base (use to shape voice, offers, compliance):
${kbContext.slice(0, 6000)}`;
    const prompt = `Given this marketer intent, produce a CampaignDraft with 1-3 audiences. For each audience provide an AudienceBlueprint (answering: core idea in 1 sentence, cadence with maxPerWeek and optional quietHours, doNothingBehavior, stopConditions array, 2 anchor messages with title/smsCopy/toneNotes, audienceDefinition.plain plus include/exclude arrays, rationale array, assumptions array, checklist array with item/status/reason) and an ExecutionFlow as FlowGraph with nodes (id, type: trigger|message|delay|condition|exit, label, data, pinned optional) and edges (id, from, to, label, condition optional).

Intent: ${intent}

Return a single JSON object: { "intentSummary": string, "primaryGoal": string, "audiences": [ { "id": "aud-1", "name": string, "blueprint": AudienceBlueprint, "flow": { "nodes": [...], "edges": [...] } } ] }. Use simple ids like aud-1, node-1, edge-1.`;
    const draft = await callGemini(prompt, system);
    return res.json(draft);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'generate-draft failed' });
  }
});

// --- 2) reviseBlueprint(currentBlueprint, instruction, kbContext) -> Blueprint
app.post('/api/revise-blueprint', async (req, res) => {
  try {
    const { currentBlueprint, instruction, kbContext = '' } = req.body;
    if (!currentBlueprint || !instruction) {
      return res.status(400).json({ error: 'currentBlueprint and instruction are required' });
    }
    const system = `You are Sotto AI. Output strict JSON only. Return a single AudienceBlueprint object. KB context: ${kbContext.slice(0, 4000)}`;
    const prompt = `Current blueprint (JSON): ${JSON.stringify(currentBlueprint)}

User instruction: ${instruction}

Return the revised AudienceBlueprint as a single JSON object (same shape: coreIdea, cadence, doNothingBehavior, stopConditions, anchorMessages, audienceDefinition, rationale, assumptions, checklist).`;
    const revised = await callGemini(prompt, system);
    return res.json(revised);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'revise-blueprint failed' });
  }
});

// --- 3) compileFlowFromBlueprint(blueprint, kbContext, pinnedConstraints?) -> FlowGraph
app.post('/api/compile-flow', async (req, res) => {
  try {
    const { blueprint, kbContext = '', pinnedConstraints = null } = req.body;
    if (!blueprint) return res.status(400).json({ error: 'blueprint is required' });
    const system = `You are Sotto AI. Output strict JSON only. Return a FlowGraph: { "nodes": [...], "edges": [...] }. Each node: id, type (trigger|message|delay|condition|exit), label, data (object), pinned (optional). Each edge: id, from, to, label (plain-language), condition (optional).`;
    let prompt = `Blueprint: ${JSON.stringify(blueprint)}\n\nProduce the execution flow graph.`;
    if (pinnedConstraints && (pinnedConstraints.pinnedNodeIds?.length || pinnedConstraints.pinnedRules?.length)) {
      prompt += `\nKeep these constraints: ${JSON.stringify(pinnedConstraints)}`;
    }
    const flow = await callGemini(prompt, system);
    return res.json(flow);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'compile-flow failed' });
  }
});

// --- 4) proposeRegenerationWithDiff(current, pinnedConstraints, kbContext) -> Proposed
app.post('/api/propose-regeneration', async (req, res) => {
  try {
    const { currentBlueprint, currentFlow, pinnedConstraints = {}, kbContext = '' } = req.body;
    if (!currentBlueprint || !currentFlow) {
      return res.status(400).json({ error: 'currentBlueprint and currentFlow are required' });
    }
    const system = `You are Sotto AI. Output strict JSON only. Return a single object: { "blueprint": AudienceBlueprint, "flow": FlowGraph, "diffSummary": { "blueprint": [ { "section": string, "current": string, "proposed": string } ], "flow": { "nodesAdded": number, "nodesRemoved": number, "nodesChanged": number, "details": string[] } } }. KB: ${kbContext.slice(0, 3000)}`;
    const prompt = `Current blueprint: ${JSON.stringify(currentBlueprint)}
Current flow: ${JSON.stringify(currentFlow)}
Pinned (do not remove, regenerate around): ${JSON.stringify(pinnedConstraints)}

Generate a new blueprint and flow that respects pinned items. Then fill diffSummary: for blueprint list changed sections with current vs proposed text; for flow count nodes added/removed/changed and optional details array.`;
    const proposed = await callGemini(prompt, system);
    return res.json(proposed);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'propose-regeneration failed' });
  }
});

// --- KB: extract profile from doc text
app.post('/api/extract-kb-profile', async (req, res) => {
  try {
    const { title, rawText, tags = [] } = req.body;
    if (!rawText) return res.status(400).json({ error: 'rawText is required' });
    const prompt = `Extract from this document a structured profile. Return JSON: { "voice": string[], "dos": string[], "donts": string[], "policies": string[] }. Document title: ${title || 'Untitled'}. Tags: ${tags.join(', ')}

Document:
${rawText.slice(0, 12000)}`;
    const extracted = await callGemini(prompt, null);
    return res.json(extracted);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'extract-kb-profile failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Sotto API listening on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set — create a .env in the project root with: GEMINI_API_KEY=your_key');
  } else {
    console.log('GEMINI_API_KEY loaded.');
  }
});
