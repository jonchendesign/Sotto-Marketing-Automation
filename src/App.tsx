import React, { useReducer, useState, useRef, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

type Channel = 'SMS'; // SMS-only product
type CampaignStatus = 'Draft' | 'Scheduled' | 'Live';
type CheckSeverity = 'success' | 'warning' | 'blocking';
type ToneLabel = 'Professional' | 'Warm' | 'Playful';

// Flow steps (event-driven, conditional, relative timing)
type FlowStep =
  | { id: string; kind: 'entry'; description: string }
  | { id: string; kind: 'send'; messageId: string; label: string }
  | { id: string; kind: 'wait'; duration: number; unit: 'hours' | 'days' }
  | { id: string; kind: 'decision'; label: string; conditionKey: string; yesNext: string; noNext: string }
  | { id: string; kind: 'exit'; label: string }
  | { id: string; kind: 'pause'; label: string; maxDelayHours: number };

// Flow Behaviors (flow-level execution modifiers)
interface FlowBehavior {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
  appliesTo: string; // e.g. "PAUSE steps in this flow"
  explanation: string;
}

// Execution trace entry (for simulation / Why)
interface ExecutionTraceEntry {
  id: string;
  customerId: string; // "A" | "B" | "C"
  relativeTime: string; // "Day 0" | "Day 3" etc
  stepId: string;
  stepLabel: string;
  explanation: string[];
}

// Activity Log for "Why this happened" inspection
interface ActivityLogEntry {
  id: string;
  timestamp: string;
  source: 'plan' | 'adjustment';
  touchId?: string;
  stepId?: string;
  adjustmentId?: string;
  explanation: string[];
}

interface Audience {
  id: string;
  name: string;
  size: number;
  inclusions: string[];
  exclusions: string[];
}

interface Message {
  id: string;
  channel: Channel;
  subject?: string;
  body: string;
  tone: ToneLabel;
}

interface Check {
  id: string;
  type: 'conflict' | 'validation';
  severity: CheckSeverity;
  title: string;
  description: string;
  conflictingItemId?: string;
  suggestedActions?: string[];
}

interface Campaign {
  id: string;
  name: string;
  brand: string;
  product: string;
  offerPercent: number;
  startDate: string;
  endDate: string;
  channels: Channel[];
  status: CampaignStatus;
  audiences: Audience[];
  flowSteps: FlowStep[];
  messages: Record<string, Message>;
  checks: Check[];
  shortLink: string;
  flowBehaviors: FlowBehavior[];
  activityLog: ActivityLogEntry[];
  executionTrace: ExecutionTraceEntry[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  changes?: string[];
  isStatus?: boolean;
}

interface AppState {
  campaign: Campaign | null;
  chatMessages: ChatMessage[];
  toasts: Toast[];
  openTraceDrawer: boolean;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

// ============================================================================
// MOCK DATA
// ============================================================================

const SHORT_LINK = 'kiehls.com/vday';

function createInitialCampaign(): Campaign {
  return {
    id: 'camp-1',
    name: "Valentine's Day Moisturizer Launch",
    brand: "Kiehl's",
    product: 'Ultra Hydration Moisturizer',
    offerPercent: 20,
    startDate: '2026-02-07',
    endDate: '2026-02-14',
    channels: ['SMS'],
    status: 'Draft',
    shortLink: SHORT_LINK,
    audiences: [
      {
        id: 'aud-1',
        name: 'Existing skincare customers (last 12 months)',
        size: 128340,
        inclusions: [
          'Purchased skincare ≥ 1x in last 12 months',
          'Region: US',
          'Opted into SMS'
        ],
        exclusions: [
          'Purchased Ultra Hydration Moisturizer in last 30 days',
          'Unsubscribed users'
        ]
      },
      {
        id: 'aud-2',
        name: 'Loyalty members who browsed moisturizers',
        size: 42120,
        inclusions: [
          'Loyalty tier: any',
          'Browsed moisturizers in last 14 days',
          'Region: US'
        ],
        exclusions: ['Unsubscribed users']
      }
    ],
    flowSteps: [
      { id: 'entry-1', kind: 'entry', description: 'Customer joins campaign audience' },
      { id: 'send-launch', kind: 'send', messageId: 'sms1', label: 'Launch message' },
      { id: 'wait-1', kind: 'wait', duration: 3, unit: 'days' },
      { id: 'decision-1', kind: 'decision', label: 'Purchased product?', conditionKey: 'purchased', yesNext: 'exit-1', noNext: 'send-reminder' },
      { id: 'send-reminder', kind: 'send', messageId: 'sms2', label: 'Reminder message' },
      { id: 'wait-2', kind: 'wait', duration: 2, unit: 'days' },
      { id: 'decision-2', kind: 'decision', label: 'Eligible for SMS now?', conditionKey: 'eligible_now', yesNext: 'send-lastchance', noNext: 'pause-1' },
      { id: 'send-lastchance', kind: 'send', messageId: 'sms3', label: 'Last-chance message' },
      { id: 'pause-1', kind: 'pause', label: 'Pause up to 24h then re-check or exit', maxDelayHours: 24 },
      { id: 'exit-1', kind: 'exit', label: 'Exit flow' }
    ],
    messages: {
      sms1: {
        id: 'sms1',
        channel: 'SMS',
        body: "Valentine's Day is almost here 💕 Enjoy {offer} off our new {product}. Shop now: {shortLink}",
        tone: 'Warm'
      },
      sms2: {
        id: 'sms2',
        channel: 'SMS',
        body: "Treat your routine with {product}. Limited-time {offer} until {endDate}. Shop now: {shortLink}",
        tone: 'Warm'
      },
      sms3: {
        id: 'sms3',
        channel: 'SMS',
        body: "Last chance 💘 {offer} off {product} ends soon. Don't miss it: {shortLink}",
        tone: 'Warm'
      }
    },
    checks: [],
    flowBehaviors: [
      {
        id: 'behavior-stop-purchase',
        label: 'Stop after purchase',
        description: "If a customer purchases the product, the flow exits and remaining steps are not run.",
        enabled: true,
        locked: true,
        appliesTo: 'DECISION step "Purchased product?" — flow exits on YES.',
        explanation: 'Customer purchased; flow exited.'
      },
      {
        id: 'behavior-eligibility',
        label: 'Enforce eligibility',
        description: "Texts are only sent when the customer is in quiet hours window and within SMS frequency limits.",
        enabled: true,
        locked: true,
        appliesTo: 'All SEND steps — skips send if not eligible.',
        explanation: 'Send skipped; customer not eligible (quiet hours or frequency limit).'
      },
      {
        id: 'behavior-pause-fatigue',
        label: 'Pause to avoid fatigue',
        description: "If the next step would violate frequency limits, the flow pauses up to 24h and retries.",
        enabled: false,
        appliesTo: 'PAUSE step — active when eligibility blocks send; flow waits then re-checks.',
        explanation: 'Flow paused to avoid over-texting; will re-check eligibility.'
      }
    ],
    activityLog: [
      {
        id: 'log-1',
        timestamp: 'Day 0',
        source: 'plan',
        stepId: 'send-launch',
        explanation: ['Launch message sent. Customer entered flow.']
      },
      {
        id: 'log-2',
        timestamp: 'Day 3',
        source: 'adjustment',
        stepId: 'decision-1',
        explanation: ['Decision: Purchased product? → NO. Proceeding to Reminder.']
      },
      {
        id: 'log-3',
        timestamp: 'Day 5',
        source: 'adjustment',
        stepId: 'decision-2',
        explanation: ['Decision: Eligible for SMS now? → NO. Flow paused up to 24h.']
      }
    ],
    executionTrace: []
  };
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function parseDate(str: string): Date | null {
  const match = str.match(/feb\s*(\d+)/i);
  if (match) {
    return new Date(`2026-02-${match[1].padStart(2, '0')}`);
  }
  return null;
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

function getTotalWaitDays(flowSteps: FlowStep[]): number {
  let total = 0;
  flowSteps.forEach(s => {
    if (s.kind === 'wait') total += s.unit === 'days' ? s.duration : Math.ceil(s.duration / 24);
  });
  return total;
}

function detectConflicts(campaign: Campaign): Check[] {
  const checks: Check[] = [];
  const steps = campaign.flowSteps;
  const pauseBehavior = campaign.flowBehaviors.find(b => b.id === 'behavior-pause-fatigue');

  // Success: flow enforces quiet hours & frequency
  checks.push({
    id: 'check-quiet-hours',
    type: 'validation',
    severity: 'success',
    title: 'Flow enforces quiet hours',
    description: 'SEND steps only run when customer is within allowed send window.'
  });
  checks.push({
    id: 'check-frequency',
    type: 'validation',
    severity: 'success',
    title: 'Flow enforces frequency limits',
    description: 'Eligibility behavior ensures SMS limits are respected.'
  });

  // Warning: flow may pause when pause behavior is ON
  if (pauseBehavior?.enabled) {
    checks.push({
      id: 'warning-pause',
      type: 'validation',
      severity: 'warning',
      title: 'Flow may pause up to 24h for some recipients',
      description: 'When "Pause to avoid fatigue" is ON, the flow can wait up to 24h before re-checking eligibility.'
    });
  }

  // Blocking: send step without messageId
  steps.forEach(s => {
    if (s.kind === 'send' && !s.messageId) {
      checks.push({
        id: `blocking-send-${s.id}`,
        type: 'validation',
        severity: 'blocking',
        title: 'Send step has no message',
        description: `Step "${s.label}" has no message linked. Link a message to this step.`
      });
    }
  });

  // Blocking: wait duration 0
  steps.forEach(s => {
    if (s.kind === 'wait' && s.duration <= 0) {
      checks.push({
        id: `blocking-wait-${s.id}`,
        type: 'validation',
        severity: 'blocking',
        title: 'Wait duration must be greater than 0',
        description: `Step "${s.id}" has invalid wait duration.`
      });
    }
  });

  // Warning: campaign window shorter than total waits
  const totalWaitDays = getTotalWaitDays(steps);
  const windowStart = new Date(campaign.startDate);
  const windowEnd = new Date(campaign.endDate);
  const windowDays = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24));
  if (totalWaitDays > windowDays) {
    checks.push({
      id: 'warning-window',
      type: 'validation',
      severity: 'warning',
      title: 'Campaign window may be too short',
      description: `Total wait time (${totalWaitDays} days) is longer than campaign window (${windowDays} days). Some customers may not complete the flow.`
    });
  }

  // Blocking: no audience
  const totalAudienceSize = campaign.audiences.reduce((sum, a) => sum + a.size, 0);
  if (totalAudienceSize === 0) {
    checks.push({
      id: 'blocking-no-audience',
      type: 'validation',
      severity: 'blocking',
      title: 'No audience selected',
      description: 'Campaign cannot launch without an audience. Add at least one audience segment.'
    });
  }

  return checks;
}

// ============================================================================
// MESSAGE INTERPOLATION
// ============================================================================

function interpolateMessage(template: string, campaign: Campaign): string {
  return template
    .replace(/{offer}/g, `${campaign.offerPercent}%`)
    .replace(/{product}/g, campaign.product)
    .replace(/{shortLink}/g, campaign.shortLink)
    .replace(/{endDate}/g, formatDate(campaign.endDate));
}

function adjustTone(message: Message, newTone: ToneLabel): Message {
  let body = message.body;
  let subject = message.subject;

  // Simple deterministic tone adjustments
  if (newTone === 'Professional') {
    body = body
      .replace(/💕/g, '')
      .replace(/💘/g, '')
      .replace(/Love your skin/g, 'Elevate your skincare')
      .replace(/Treat your routine/g, 'Enhance your skincare regimen')
      .replace(/almost here/g, 'approaching')
      .replace(/Don't miss it/g, 'Act now');
    if (subject) {
      subject = subject.replace(/Love your skin/g, 'Elevate your skincare');
    }
  } else if (newTone === 'Warm') {
    body = body
      .replace(/Elevate your skincare/g, 'Love your skin')
      .replace(/Enhance your skincare regimen/g, 'Treat your routine')
      .replace(/approaching/g, 'almost here 💕')
      .replace(/Act now/g, "Don't miss it 💘");
    if (subject) {
      subject = subject.replace(/Elevate your skincare/g, 'Love your skin');
    }
  } else if (newTone === 'Playful') {
    body = body
      .replace(/Valentine's Day is almost here/g, "Cupid's got a deal for you")
      .replace(/Love your skin/g, 'Get that glow')
      .replace(/Treat your routine/g, 'Pamper yourself')
      .replace(/Last chance/g, 'Tick tock')
      .replace(/Don't miss it/g, 'Grab it before it vanishes');
    if (subject) {
      subject = subject.replace(/Love your skin/g, 'Get that glow');
    }
  }

  return { ...message, body, subject, tone: newTone };
}

// ============================================================================
// REDUCER
// ============================================================================

type Action =
  | { type: 'SET_CAMPAIGN'; campaign: Campaign | null }
  | { type: 'UPDATE_CAMPAIGN'; updates: Partial<Campaign> }
  | { type: 'UPDATE_OFFER'; percent: number }
  | { type: 'RENAME_CAMPAIGN'; name: string }
  | { type: 'UPDATE_FLOW_STEP'; stepId: string; updates: Partial<FlowStep> }
  | { type: 'REMOVE_FLOW_STEP'; stepId: string }
  | { type: 'ADD_FLOW_STEP'; afterStepId: string; step: FlowStep }
  | { type: 'UPDATE_MESSAGE'; messageId: string; updates: Partial<Message> }
  | { type: 'UPDATE_AUDIENCE'; audienceId: string; updates: Partial<Audience> }
  | { type: 'SET_STATUS'; status: CampaignStatus }
  | { type: 'REFRESH_CHECKS' }
  | { type: 'ADD_CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'TOGGLE_FLOW_BEHAVIOR'; behaviorId: string }
  | { type: 'ENABLE_PAUSE_BEHAVIOR' }
  | { type: 'DISABLE_PAUSE_BEHAVIOR' }
  | { type: 'SET_EXECUTION_TRACE'; trace: ExecutionTraceEntry[] }
  | { type: 'SHIFT_CAMPAIGN_WINDOW'; newStartDate: string }
  | { type: 'OPEN_TRACE_DRAWER' }
  | { type: 'CLEAR_OPEN_TRACE_DRAWER' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CAMPAIGN': {
      const campaign = action.campaign;
      if (campaign) {
        campaign.checks = detectConflicts(campaign);
      }
      return { ...state, campaign };
    }

    case 'UPDATE_CAMPAIGN': {
      if (!state.campaign) return state;
      const campaign = { ...state.campaign, ...action.updates };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'UPDATE_OFFER': {
      if (!state.campaign) return state;
      const campaign = { ...state.campaign, offerPercent: action.percent };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'RENAME_CAMPAIGN': {
      if (!state.campaign) return state;
      return { ...state, campaign: { ...state.campaign, name: action.name } };
    }

    case 'SHIFT_CAMPAIGN_WINDOW': {
      if (!state.campaign) return state;
      const oldStart = new Date(state.campaign.startDate);
      const newStart = new Date(action.newStartDate);
      const diffDays = Math.round((newStart.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24));
      const campaign = {
        ...state.campaign,
        startDate: action.newStartDate,
        endDate: addDays(state.campaign.endDate, diffDays)
      };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'UPDATE_FLOW_STEP': {
      if (!state.campaign) return state;
      const flowSteps = state.campaign.flowSteps.map(s =>
        s.id === action.stepId ? { ...s, ...action.updates } as FlowStep : s
      );
      const campaign = { ...state.campaign, flowSteps };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'REMOVE_FLOW_STEP': {
      if (!state.campaign) return state;
      const flowSteps = state.campaign.flowSteps.filter(s => s.id !== action.stepId);
      const campaign = { ...state.campaign, flowSteps };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'ADD_FLOW_STEP': {
      if (!state.campaign) return state;
      const idx = state.campaign.flowSteps.findIndex(s => s.id === action.afterStepId);
      if (idx === -1) return state;
      const flowSteps = [
        ...state.campaign.flowSteps.slice(0, idx + 1),
        action.step,
        ...state.campaign.flowSteps.slice(idx + 1)
      ];
      const campaign = { ...state.campaign, flowSteps };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'UPDATE_MESSAGE': {
      if (!state.campaign) return state;
      const messages = {
        ...state.campaign.messages,
        [action.messageId]: { ...state.campaign.messages[action.messageId], ...action.updates }
      };
      return { ...state, campaign: { ...state.campaign, messages } };
    }

    case 'UPDATE_AUDIENCE': {
      if (!state.campaign) return state;
      const audiences = state.campaign.audiences.map(a =>
        a.id === action.audienceId ? { ...a, ...action.updates } : a
      );
      const campaign = { ...state.campaign, audiences };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'SET_STATUS': {
      if (!state.campaign) return state;
      return { ...state, campaign: { ...state.campaign, status: action.status } };
    }

    case 'REFRESH_CHECKS': {
      if (!state.campaign) return state;
      const campaign = { ...state.campaign, checks: detectConflicts(state.campaign) };
      return { ...state, campaign };
    }

    case 'ADD_CHAT_MESSAGE': {
      return { ...state, chatMessages: [...state.chatMessages, action.message] };
    }

    case 'ADD_TOAST': {
      return { ...state, toasts: [...state.toasts, action.toast] };
    }

    case 'REMOVE_TOAST': {
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };
    }

    case 'TOGGLE_FLOW_BEHAVIOR': {
      if (!state.campaign) return state;
      const behavior = state.campaign.flowBehaviors.find(b => b.id === action.behaviorId);
      if (!behavior || behavior.locked) return state;
      const flowBehaviors = state.campaign.flowBehaviors.map(b =>
        b.id === action.behaviorId ? { ...b, enabled: !b.enabled } : b
      );
      const campaign = { ...state.campaign, flowBehaviors };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'ENABLE_PAUSE_BEHAVIOR': {
      if (!state.campaign) return state;
      const flowBehaviors = state.campaign.flowBehaviors.map(b =>
        b.id === 'behavior-pause-fatigue' ? { ...b, enabled: true } : b
      );
      const campaign = { ...state.campaign, flowBehaviors };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'DISABLE_PAUSE_BEHAVIOR': {
      if (!state.campaign) return state;
      const flowBehaviors = state.campaign.flowBehaviors.map(b =>
        b.id === 'behavior-pause-fatigue' ? { ...b, enabled: false } : b
      );
      const campaign = { ...state.campaign, flowBehaviors };
      campaign.checks = detectConflicts(campaign);
      return { ...state, campaign };
    }

    case 'SET_EXECUTION_TRACE': {
      if (!state.campaign) return state;
      return { ...state, campaign: { ...state.campaign, executionTrace: action.trace } };
    }

    case 'OPEN_TRACE_DRAWER':
      return { ...state, openTraceDrawer: true };

    case 'CLEAR_OPEN_TRACE_DRAWER':
      return { ...state, openTraceDrawer: false };

    default:
      return state;
  }
}

// ============================================================================
// COMMAND PROCESSOR
// ============================================================================

interface CommandResult {
  response: string;
  changes: string[];
  actions: Action[];
}

function processCommand(input: string, campaign: Campaign | null): CommandResult {
  const lower = input.toLowerCase().trim();

  // Create campaign
  if (lower.includes('create') && (lower.includes('valentine') || lower.includes('moisturizer') || lower.includes('campaign'))) {
    const newCampaign = createInitialCampaign();
    return {
      response: "I've created a new Valentine's Day Moisturizer Launch campaign for Kiehl's. The flow has 3 sends with waits and decisions (campaign window Feb 7–14).",
      changes: [
        'Created campaign: Valentine\'s Day Moisturizer Launch',
        'Set offer: 20% off Ultra Hydration Moisturizer',
        'Added flow: Entry → Launch → Wait 3 days → Decision (purchased?) → Reminder → Wait 2 days → Decision (eligible?) → Last-chance or Pause',
        'Added 2 audience segments totaling 170,460 recipients'
      ],
      actions: [{ type: 'SET_CAMPAIGN', campaign: newCampaign }]
    };
  }

  if (!campaign) {
    return {
      response: "No campaign exists yet. Try saying \"create valentine's moisturizer campaign\" to get started.",
      changes: [],
      actions: []
    };
  }

  // Change discount
  const discountMatch = lower.match(/change\s+(?:discount|offer)\s+to\s+(\d+)%?/);
  if (discountMatch) {
    const newPercent = parseInt(discountMatch[1]);
    return {
      response: `Done! I've updated the offer from ${campaign.offerPercent}% to ${newPercent}% off.`,
      changes: [`Changed offer: ${campaign.offerPercent}% → ${newPercent}%`],
      actions: [
        { type: 'UPDATE_OFFER', percent: newPercent },
        { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: `Offer changed to ${newPercent}%`, type: 'success' } }
      ]
    };
  }

  // Move campaign window
  const moveMatch = lower.match(/move\s+(?:launch|start|window)\s+to\s+(feb\s*\d+)/i);
  if (moveMatch) {
    const newDate = parseDate(moveMatch[1]);
    if (newDate) {
      const newDateStr = newDate.toISOString().split('T')[0];
      return {
        response: `Done! I've updated the campaign window. Start is now ${formatDate(newDateStr)}. Flow timing is relative, so steps are unchanged.`,
        changes: [
          `Updated window: ${formatDate(campaign.startDate)} → ${formatDate(newDateStr)}`
        ],
        actions: [
          { type: 'SHIFT_CAMPAIGN_WINDOW', newStartDate: newDateStr },
          { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Window updated', type: 'success' } }
        ]
      };
    }
  }

  // Add a decision after reminder (e.g. "if clicked link")
  const addDecisionMatch = lower.match(/add\s+(?:a\s+)?decision\s+after\s+reminder\s*:?\s*(?:if\s+)?(.+)/i);
  if (addDecisionMatch) {
    const conditionLabel = addDecisionMatch[1].trim().replace(/\?$/, '');
    const hasReminder = campaign.flowSteps.some(s => s.id === 'send-reminder');
    if (hasReminder) {
      const conditionKey = conditionLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      return {
        response: `Done! I've added a decision after the Reminder send: "${conditionLabel}". YES continues to the next wait; NO goes to exit.`,
        changes: [
          `Added DECISION step after Reminder: "${conditionLabel}" (conditionKey: ${conditionKey})`,
          'YES → next step (Wait 2 days), NO → Exit'
        ],
        actions: [
          {
            type: 'ADD_FLOW_STEP',
            afterStepId: 'send-reminder',
            step: {
              id: 'decision-clicked',
              kind: 'decision',
              label: conditionLabel + '?',
              conditionKey: conditionKey || 'clicked_link',
              yesNext: 'wait-2',
              noNext: 'exit-1'
            }
          },
          { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Decision added', type: 'success' } }
        ]
      };
    }
  }

  // Set reminder wait to X days
  const reminderWaitMatch = lower.match(/set\s+(?:reminder\s+)?wait\s+to\s+(\d+)\s+days?/);
  if (reminderWaitMatch) {
    const days = parseInt(reminderWaitMatch[1]);
    const wait2 = campaign.flowSteps.find(s => s.id === 'wait-2');
    if (wait2 && wait2.kind === 'wait') {
      return {
        response: `Done! The wait before the last-chance send is now ${days} days.`,
        changes: ['Updated WAIT step (after Reminder) to ' + days + ' days'],
        actions: [
          { type: 'UPDATE_FLOW_STEP', stepId: 'wait-2', updates: { duration: days, unit: 'days' } },
          { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Wait updated', type: 'success' } }
        ]
      };
    }
  }

  // Remove last-chance
  if (lower.includes('remove') && (lower.includes('last-chance') || lower.includes('last chance'))) {
    const sendLastChance = campaign.flowSteps.find(s => s.kind === 'send' && s.id === 'send-lastchance');
    if (sendLastChance) {
      return {
        response: "Done! I've removed the Last-chance send step from the flow.",
        changes: ['Removed SEND step: Last-chance message'],
        actions: [
          { type: 'REMOVE_FLOW_STEP', stepId: 'send-lastchance' },
          { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Last-chance removed', type: 'success' } }
        ]
      };
    }
  }

  // Remove last touch / last text (generic)
  if (lower.includes('remove') && lower.includes('last') && (lower.includes('touch') || lower.includes('text'))) {
    const sendSteps = campaign.flowSteps.filter(s => s.kind === 'send');
    if (sendSteps.length > 0) {
      const lastSend = sendSteps[sendSteps.length - 1];
      return {
        response: `Done! I've removed the "${lastSend.kind === 'send' ? lastSend.label : 'send'}" step from the flow.`,
        changes: [`Removed SEND step: ${lastSend.kind === 'send' ? lastSend.label : lastSend.id}`],
        actions: [
          { type: 'REMOVE_FLOW_STEP', stepId: lastSend.id },
          { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Step removed', type: 'success' } }
        ]
      };
    }
  }

  // Show conflicts
  if (lower.includes('show') && lower.includes('conflict')) {
    if (campaign.checks.length === 0) {
      return {
        response: "No conflicts detected. Your campaign schedule looks clear!",
        changes: [],
        actions: []
      };
    }
    const conflictSummary = campaign.checks.map(c => `• ${c.title}: ${c.description}`).join('\n');
    return {
      response: `Here are the current checks:\n\n${conflictSummary}`,
      changes: [],
      actions: []
    };
  }

  // Rename campaign
  const renameMatch = lower.match(/rename\s+(?:campaign\s+)?to\s+["']?(.+?)["']?$/i);
  if (renameMatch) {
    const newName = renameMatch[1].trim();
    return {
      response: `Done! Campaign renamed to "${newName}".`,
      changes: [`Renamed: "${campaign.name}" → "${newName}"`],
      actions: [
        { type: 'RENAME_CAMPAIGN', name: newName },
        { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Campaign renamed', type: 'success' } }
      ]
    };
  }

  // Make the flow more conservative (increase waits, enable pause)
  if (lower.includes('make') && lower.includes('conservative')) {
    const wait1 = campaign.flowSteps.find(s => s.id === 'wait-1');
    const wait2 = campaign.flowSteps.find(s => s.id === 'wait-2');
    const actions: Action[] = [
      { type: 'ENABLE_PAUSE_BEHAVIOR' },
      { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Flow more conservative', type: 'success' } }
    ];
    const changes: string[] = ['Enabled "Pause to avoid fatigue"'];
    if (wait1 && wait1.kind === 'wait' && wait1.duration < 4) {
      actions.unshift({ type: 'UPDATE_FLOW_STEP', stepId: 'wait-1', updates: { duration: 4, unit: 'days' } });
      changes.unshift('Updated WAIT step after Launch to 4 days');
    }
    if (wait2 && wait2.kind === 'wait' && wait2.duration < 3) {
      actions.unshift({ type: 'UPDATE_FLOW_STEP', stepId: 'wait-2', updates: { duration: 3, unit: 'days' } });
      changes.unshift('Updated WAIT step after Reminder to 3 days');
    }
    return {
      response: "I've made the flow more conservative: increased wait times and enabled pause to avoid fatigue. Fewer, better texts.",
      changes,
      actions
    };
  }

  // Make campaign adaptive / enable pause behavior
  if (lower.includes('make') && (lower.includes('adaptive') || lower.includes('automatic'))) {
    return {
      response: "I kept your flow the same. I enabled pause to avoid fatigue so the flow can wait up to 24h and re-check eligibility instead of over-texting.",
      changes: ['Enabled "Pause to avoid fatigue"'],
      actions: [
        { type: 'ENABLE_PAUSE_BEHAVIOR' },
        { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Pause behavior enabled', type: 'success' } }
      ]
    };
  }

  // Lock timing / disable pause
  if (lower.includes('lock') && lower.includes('timing')) {
    return {
      response: "Done! Pause to avoid fatigue is off. The flow will not wait; it will follow the path without extra delays.",
      changes: ['Disabled "Pause to avoid fatigue"'],
      actions: [
        { type: 'DISABLE_PAUSE_BEHAVIOR' },
        { type: 'ADD_TOAST', toast: { id: Date.now().toString(), message: 'Pause disabled', type: 'success' } }
      ]
    };
  }

  // Why did customer C not get the last text → set trace and open drawer
  if (lower.includes('why') && lower.includes('customer') && (lower.includes(' c ') || lower.includes(' c\'') || lower.includes('customer c')) && (lower.includes('last text') || lower.includes('not get'))) {
    const mockTrace: ExecutionTraceEntry[] = [
      { id: 't-a1', customerId: 'A', relativeTime: 'Day 0', stepId: 'send-launch', stepLabel: 'Send Launch message', explanation: ['Launch text sent.'] },
      { id: 't-a2', customerId: 'A', relativeTime: 'Day 3', stepId: 'decision-1', stepLabel: 'Purchased product?', explanation: ['YES — customer purchased. Flow exited.'] },
      { id: 't-b1', customerId: 'B', relativeTime: 'Day 0', stepId: 'send-launch', stepLabel: 'Send Launch message', explanation: ['Launch text sent.'] },
      { id: 't-b2', customerId: 'B', relativeTime: 'Day 3', stepId: 'decision-1', stepLabel: 'Purchased product?', explanation: ['NO — proceeding to Reminder.'] },
      { id: 't-b3', customerId: 'B', relativeTime: 'Day 3', stepId: 'send-reminder', stepLabel: 'Send Reminder message', explanation: ['Reminder text sent.'] },
      { id: 't-b4', customerId: 'B', relativeTime: 'Day 5', stepId: 'decision-2', stepLabel: 'Eligible for SMS now?', explanation: ['YES — proceeding to Last-chance.'] },
      { id: 't-b5', customerId: 'B', relativeTime: 'Day 5', stepId: 'send-lastchance', stepLabel: 'Send Last-chance message', explanation: ['Last-chance text sent. Flow complete.'] },
      { id: 't-c1', customerId: 'C', relativeTime: 'Day 0', stepId: 'send-launch', stepLabel: 'Send Launch message', explanation: ['Launch text sent.'] },
      { id: 't-c2', customerId: 'C', relativeTime: 'Day 3', stepId: 'decision-1', stepLabel: 'Purchased product?', explanation: ['NO — proceeding to Reminder.'] },
      { id: 't-c3', customerId: 'C', relativeTime: 'Day 5', stepId: 'decision-2', stepLabel: 'Eligible for SMS now?', explanation: ['NO — frequency limit reached. Flow paused up to 24h.'] },
      { id: 't-c4', customerId: 'C', relativeTime: 'Day 5', stepId: 'pause-1', stepLabel: 'Pause', explanation: ['Customer C did not get the last text because they hit the weekly SMS limit. Flow paused; will re-check or exit.'] }
    ];
    return {
      response: "Customer C hit the weekly SMS frequency limit before the Last-chance step. The flow paused (up to 24h) instead of sending. I've opened the execution trace so you can see their path.",
      changes: ['Opened execution trace for Customer A, B, and C'],
      actions: [
        { type: 'SET_EXECUTION_TRACE', trace: mockTrace },
        { type: 'OPEN_TRACE_DRAWER' }
      ]
    };
  }

  // Why did this happen / why was this skipped
  if (lower.includes('why') && (lower.includes('skip') || lower.includes('send') || lower.includes('happen') || lower.includes('delay'))) {
    const relevantLog = campaign.activityLog.find(l => l.source === 'adjustment');
    if (relevantLog) {
      return {
        response: relevantLog.explanation.join('\n'),
        changes: [],
        actions: []
      };
    }
    return {
      response: "This text was sent as scheduled in your campaign plan.",
      changes: [],
      actions: []
    };
  }

  // Show flow behaviors
  if ((lower.includes('show') && lower.includes('behavior')) || (lower.includes('show') && lower.includes('adjustment')) || (lower.includes('show') && lower.includes('automatic'))) {
    const enabled = campaign.flowBehaviors.filter(b => b.enabled && !b.locked);
    const alwaysOn = campaign.flowBehaviors.filter(b => b.locked);
    const disabled = campaign.flowBehaviors.filter(b => !b.enabled && !b.locked);
    const lines: string[] = [];
    if (alwaysOn.length > 0) {
      lines.push('Always on:');
      alwaysOn.forEach(b => lines.push(`• ${b.label}`));
    }
    if (enabled.length > 0) {
      lines.push('Enabled:');
      enabled.forEach(b => lines.push(`• ${b.label}`));
    }
    if (disabled.length > 0) {
      lines.push('Off:');
      disabled.forEach(b => lines.push(`• ${b.label}`));
    }
    return {
      response: lines.length > 0 ? lines.join('\n') : "Expand the \"Flow Behaviors\" section on the canvas to see what applies during execution.",
      changes: [],
      actions: []
    };
  }

  // Help / unknown
  return {
    response: "I can help you with:\n• \"change discount to X%\"\n• \"move launch to Feb X\"\n• \"set reminder wait to 2 days\"\n• \"add a decision after reminder: if clicked link\"\n• \"remove last-chance\"\n• \"make the flow more conservative\"\n• \"show me conflicts\"\n• \"rename campaign to ...\"\n• \"why did customer C not get the last text?\"\n• \"show flow behaviors\"\n\nWhat would you like to do?",
    changes: [],
    actions: []
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Toast Component
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`} onClick={() => onDismiss(toast.id)}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

// Badge Component
function Badge({ children, variant }: { children: React.ReactNode; variant: 'sms' | 'email' | 'push' | 'warning' | 'blocking' | 'draft' | 'scheduled' | 'live' | 'success' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// Collapsible Section
function Section({ 
  title, 
  defaultExpanded = false, 
  children,
  summary
}: { 
  title: string; 
  defaultExpanded?: boolean; 
  children: React.ReactNode;
  summary?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="section">
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <span className="section-chevron">{expanded ? '▼' : '▶'}</span>
        <h3 className="section-title">{title}</h3>
        {!expanded && summary && <div className="section-summary">{summary}</div>}
      </div>
      {expanded && <div className="section-content">{children}</div>}
    </div>
  );
}

// Chat Interface
function ChatInterface({ 
  messages, 
  onSend 
}: { 
  messages: ChatMessage[]; 
  onSend: (message: string) => void;
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-header-icon">✨</div>
        <div>
          <h2>Campaign Assistant</h2>
          <p>Build and refine your SMS campaign with natural language</p>
        </div>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>👋 Hi! I can help you build an SMS campaign.</p>
            <p>Try: <strong>"create valentine's moisturizer campaign"</strong></p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}${msg.isStatus ? ' chat-message-status' : ''}`}>
            <div className="chat-message-content">
              {msg.content.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              {!msg.isStatus && msg.changes && msg.changes.length > 0 && (
                <div className="chat-changes">
                  <strong>What I changed:</strong>
                  <ul>
                    {msg.changes.map((change, i) => (
                      <li key={i}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a command or ask a question..."
          className="chat-input"
        />
        <button type="submit" className="chat-send-btn">Send</button>
      </form>
    </div>
  );
}

// Audience Editor Modal
function AudienceEditorModal({ 
  audience, 
  onSave, 
  onClose 
}: { 
  audience: Audience; 
  onSave: (updates: Partial<Audience>) => void; 
  onClose: () => void;
}) {
  const [inclusions, setInclusions] = useState(audience.inclusions.join('\n'));
  const [exclusions, setExclusions] = useState(audience.exclusions.join('\n'));

  const handleSave = () => {
    onSave({
      inclusions: inclusions.split('\n').filter(s => s.trim()),
      exclusions: exclusions.split('\n').filter(s => s.trim())
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Edit Audience: {audience.name}</h3>
        <div className="form-group">
          <label>Inclusions (one per line)</label>
          <textarea 
            value={inclusions} 
            onChange={e => setInclusions(e.target.value)}
            rows={4}
          />
        </div>
        <div className="form-group">
          <label>Exclusions (one per line)</label>
          <textarea 
            value={exclusions} 
            onChange={e => setExclusions(e.target.value)}
            rows={4}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// Conflict Drawer
function ConflictDrawer({ 
  check, 
  onAction, 
  onClose 
}: { 
  check: Check; 
  onAction: (action: string) => void; 
  onClose: () => void;
}) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>{check.title}</h3>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-content">
          <Badge variant={check.severity}>{check.severity}</Badge>
          <p className="drawer-description">{check.description}</p>
          
          {check.suggestedActions && check.suggestedActions.length > 0 && (
            <div className="drawer-actions">
              <h4>Suggested Actions</h4>
              {check.suggestedActions.map((action, i) => (
                <button 
                  key={i} 
                  className="btn btn-secondary btn-block"
                  onClick={() => onAction(action)}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Schedule Modal
function ScheduleModal({ 
  campaign, 
  onConfirm, 
  onClose 
}: { 
  campaign: Campaign; 
  onConfirm: () => void; 
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Schedule Campaign</h3>
        <div className="schedule-summary">
          <p><strong>{campaign.name}</strong></p>
          <p>{formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}</p>
          <p>{campaign.flowSteps.filter(s => s.kind === 'send').length} texts</p>
          <p>{campaign.audiences.reduce((sum, a) => sum + a.size, 0).toLocaleString()} recipients</p>
        </div>
        {campaign.checks.filter(c => c.severity === 'warning').length > 0 && (
          <div className="schedule-warnings">
            <p>⚠️ {campaign.checks.filter(c => c.severity === 'warning').length} warning(s) detected</p>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Confirm Schedule</button>
        </div>
      </div>
    </div>
  );
}

// Launch Modal
function LaunchModal({ 
  campaign, 
  onConfirm, 
  onClose 
}: { 
  campaign: Campaign; 
  onConfirm: () => void; 
  onClose: () => void;
}) {
  const blockingChecks = campaign.checks.filter(c => c.severity === 'blocking');
  const warningChecks = campaign.checks.filter(c => c.severity === 'warning');
  const canLaunch = blockingChecks.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Launch Campaign</h3>
        <div className="schedule-summary">
          <p><strong>{campaign.name}</strong></p>
          <p>This will immediately activate the campaign.</p>
        </div>
        
        {blockingChecks.length > 0 && (
          <div className="launch-blocking">
            <h4>🚫 Blocking Issues</h4>
            {blockingChecks.map(check => (
              <p key={check.id}>{check.title}: {check.description}</p>
            ))}
          </div>
        )}
        
        {warningChecks.length > 0 && (
          <div className="schedule-warnings">
            <h4>⚠️ Warnings</h4>
            {warningChecks.map(check => (
              <p key={check.id}>{check.title}</p>
            ))}
          </div>
        )}
        
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={onConfirm}
            disabled={!canLaunch}
          >
            {canLaunch ? 'Launch Now' : 'Cannot Launch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Flow Overview Section
function flowStepLabel(step: FlowStep): string {
  switch (step.kind) {
    case 'entry': return step.description;
    case 'send': return `Send ${step.label}`;
    case 'wait': return `Wait ${step.duration} ${step.unit}`;
    case 'decision': return `If ${step.label} →`;
    case 'exit': return step.label;
    case 'pause': return step.label;
    default: return '';
  }
}

function FlowOverviewSection({
  steps,
  messages,
  campaign,
  onUpdateStep,
  onShowWhy,
  onRunSimulation
}: {
  steps: FlowStep[];
  messages: Record<string, Message>;
  campaign: Campaign;
  onUpdateStep: (stepId: string, updates: Partial<FlowStep>) => void;
  onShowWhy: () => void;
  onRunSimulation: () => void;
}) {
  const entryStep = steps.find(s => s.kind === 'entry');
  const sendCount = steps.filter(s => s.kind === 'send').length;
  const decisionCount = steps.filter(s => s.kind === 'decision').length;

  const collapsedSummary = entryStep ? (
    <span className="flow-summary-text">
      Entry: {entryStep.kind === 'entry' && entryStep.description} • {sendCount} sends • {decisionCount} decisions
    </span>
  ) : null;

  return (
    <Section
      title="Flow Overview"
      summary={collapsedSummary}
    >
      <div className="flow-overview-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRunSimulation}>
          Run Simulation
        </button>
      </div>
      <div className="flow-steps-list">
        {steps.map((step) => (
          <div key={step.id} className={`flow-step-card flow-step-${step.kind}`}>
            <div className="flow-step-header">
              <span className="flow-step-badge">{step.kind.toUpperCase()}</span>
              <span className="flow-step-label">{flowStepLabel(step)}</span>
              <button className="btn-icon btn-why" onClick={onShowWhy} title="Why this happened">?</button>
            </div>
            {step.kind === 'wait' && (
              <div className="flow-step-edit">
                <input
                  type="number"
                  min={1}
                  value={step.duration}
                  onChange={e => onUpdateStep(step.id, { duration: parseInt(e.target.value) || 1 })}
                  className="flow-step-input-num"
                />
                <select
                  value={step.unit}
                  onChange={e => onUpdateStep(step.id, { unit: e.target.value as 'hours' | 'days' })}
                  className="flow-step-select"
                >
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            )}
            {step.kind === 'decision' && (
              <div className="flow-step-branches">
                <span className="flow-branch">YES → {step.yesNext}</span>
                <span className="flow-branch">NO → {step.noNext}</span>
              </div>
            )}
            {step.kind === 'send' && messages[step.messageId] && (
              <p className="flow-step-preview">{interpolateMessage(messages[step.messageId].body, campaign).slice(0, 50)}…</p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// Flow Behaviors Section
function FlowBehaviorsSection({
  behaviors,
  onToggle,
  onShowWhy
}: {
  behaviors: FlowBehavior[];
  onToggle: (id: string) => void;
  onShowWhy: () => void;
}) {
  const totalOn = behaviors.filter(b => b.enabled).length;
  const toggleableCount = behaviors.filter(b => !b.locked && b.enabled).length;

  return (
    <Section
      title="Flow Behaviors"
      summary={
        <span className="adjustments-summary">
          {totalOn} on • {toggleableCount} optional
        </span>
      }
    >
      <div className="adjustments-list">
        {behaviors.map(b => (
          <div key={b.id} className={`adjustment-card ${b.enabled ? 'enabled' : 'disabled'}`}>
            <div className="adjustment-header">
              <div className="adjustment-info">
                <span className="adjustment-label">{b.label}</span>
                <p className="adjustment-desc">{b.description}</p>
                <p className="adjustment-applies">{b.appliesTo}</p>
              </div>
              <div className="adjustment-controls">
                <button className="btn-icon" onClick={onShowWhy} title="Why this happened">?</button>
                {b.locked ? (
                  <span className="adjustment-check">✓</span>
                ) : (
                  <label className="toggle-switch">
                    <input type="checkbox" checked={b.enabled} onChange={() => onToggle(b.id)} />
                    <span className="toggle-slider"></span>
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// Execution Trace Drawer (simulation results)
function ExecutionTraceDrawer({
  trace,
  onClose
}: {
  trace: ExecutionTraceEntry[];
  onClose: () => void;
}) {
  const byCustomer = trace.reduce((acc, t) => {
    if (!acc[t.customerId]) acc[t.customerId] = [];
    acc[t.customerId].push(t);
    return acc;
  }, {} as Record<string, ExecutionTraceEntry[]>);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer execution-trace-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Execution trace</h3>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-content">
          <p className="drawer-subtitle">Mock simulation for 3 example customers</p>
          {['A', 'B', 'C'].map(cid => (
            <div key={cid} className="trace-customer-block">
              <h4 className="trace-customer-title">Customer {cid}</h4>
              {(byCustomer[cid] || []).map(entry => (
                <div key={entry.id} className="trace-entry">
                  <span className="trace-time">{entry.relativeTime}</span>
                  <span className="trace-step">{entry.stepLabel}</span>
                  <ul className="trace-explanation">
                    {entry.explanation.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Why Drawer - plan-based vs adjustment-based explanations
function WhyDrawer({
  log,
  onClose
}: {
  log: ActivityLogEntry[];
  onClose: () => void;
}) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer why-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Why this happened</h3>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-content">
          <div className="why-log-list">
            {log.map(entry => (
              <div key={entry.id} className={`why-entry why-entry-${entry.source}`}>
                <div className="why-entry-header">
                  <span className="why-entry-source">
                    {entry.source === 'plan' ? 'Plan' : 'Adjusted'}
                  </span>
                  <span className="why-entry-time">
                    {/^\d{4}-\d{2}-\d{2}/.test(entry.timestamp)
                      ? new Date(entry.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })
                      : entry.timestamp}
                  </span>
                </div>
                <div className="why-entry-explanation">
                  {entry.explanation.map((exp, i) => (
                    <p key={i}>{exp}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Campaign Canvas
function CampaignCanvas({
  campaign,
  dispatch,
  openTraceDrawer,
  onClearOpenTraceDrawer
}: {
  campaign: Campaign;
  dispatch: React.Dispatch<Action>;
  openTraceDrawer: boolean;
  onClearOpenTraceDrawer: () => void;
}) {
  const [editingAudience, setEditingAudience] = useState<Audience | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<Check | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  useEffect(() => {
    if (openTraceDrawer && campaign.executionTrace?.length) {
      setShowTrace(true);
      onClearOpenTraceDrawer();
    }
  }, [openTraceDrawer, campaign.executionTrace?.length, onClearOpenTraceDrawer]);

  const sendStepCount = campaign.flowSteps.filter(s => s.kind === 'send').length;

  const handleToggleBehavior = (behaviorId: string) => {
    dispatch({ type: 'TOGGLE_FLOW_BEHAVIOR', behaviorId });
  };

  const handleShowWhyClicked = () => setShowActivityLog(true);

  const handleUpdateFlowStep = (stepId: string, updates: Partial<FlowStep>) => {
    dispatch({ type: 'UPDATE_FLOW_STEP', stepId, updates });
  };

  const handleRunSimulation = () => {
    const trace: ExecutionTraceEntry[] = [
      { id: 't-a1', customerId: 'A', relativeTime: 'Day 0', stepId: 'send-launch', stepLabel: 'Send Launch message', explanation: ['Launch text sent.'] },
      { id: 't-a2', customerId: 'A', relativeTime: 'Day 3', stepId: 'decision-1', stepLabel: 'Purchased product?', explanation: ['YES — customer purchased. Flow exited.'] },
      { id: 't-b1', customerId: 'B', relativeTime: 'Day 0', stepId: 'send-launch', stepLabel: 'Send Launch message', explanation: ['Launch text sent.'] },
      { id: 't-b2', customerId: 'B', relativeTime: 'Day 3', stepId: 'decision-1', stepLabel: 'Purchased product?', explanation: ['NO — proceeding to Reminder.'] },
      { id: 't-b3', customerId: 'B', relativeTime: 'Day 3', stepId: 'send-reminder', stepLabel: 'Send Reminder message', explanation: ['Reminder text sent.'] },
      { id: 't-b4', customerId: 'B', relativeTime: 'Day 5', stepId: 'decision-2', stepLabel: 'Eligible for SMS now?', explanation: ['YES — proceeding to Last-chance.'] },
      { id: 't-b5', customerId: 'B', relativeTime: 'Day 5', stepId: 'send-lastchance', stepLabel: 'Send Last-chance message', explanation: ['Last-chance text sent. Flow complete.'] },
      { id: 't-c1', customerId: 'C', relativeTime: 'Day 0', stepId: 'send-launch', stepLabel: 'Send Launch message', explanation: ['Launch text sent.'] },
      { id: 't-c2', customerId: 'C', relativeTime: 'Day 3', stepId: 'decision-1', stepLabel: 'Purchased product?', explanation: ['NO — proceeding to Reminder.'] },
      { id: 't-c3', customerId: 'C', relativeTime: 'Day 5', stepId: 'decision-2', stepLabel: 'Eligible for SMS now?', explanation: ['NO — frequency limit reached. Flow paused up to 24h.'] },
      { id: 't-c4', customerId: 'C', relativeTime: 'Day 5', stepId: 'pause-1', stepLabel: 'Pause', explanation: ['Customer C did not get the last text because they hit the weekly SMS limit. Flow paused; will re-check or exit.'] }
    ];
    dispatch({ type: 'SET_EXECUTION_TRACE', trace });
    setShowTrace(true);
  };

  const handleMessageEdit = (messageId: string, newBody: string) => {
    dispatch({ type: 'UPDATE_MESSAGE', messageId, updates: { body: newBody } });
  };

  const handleToneChange = (messageId: string) => {
    const message = campaign.messages[messageId];
    const tones: ToneLabel[] = ['Professional', 'Warm', 'Playful'];
    const currentIndex = tones.indexOf(message.tone);
    const nextTone = tones[(currentIndex + 1) % tones.length];
    const adjusted = adjustTone(message, nextTone);
    dispatch({ type: 'UPDATE_MESSAGE', messageId, updates: adjusted });
  };

  const handleAudienceSave = (updates: Partial<Audience>) => {
    if (editingAudience) {
      dispatch({ type: 'UPDATE_AUDIENCE', audienceId: editingAudience.id, updates });
      dispatch({ 
        type: 'ADD_TOAST', 
        toast: { id: Date.now().toString(), message: 'Audience updated', type: 'success' } 
      });
    }
  };

  const handleScheduleConfirm = () => {
    dispatch({ type: 'SET_STATUS', status: 'Scheduled' });
    dispatch({ 
      type: 'ADD_TOAST', 
      toast: { id: Date.now().toString(), message: 'Campaign scheduled!', type: 'success' } 
    });
    setShowScheduleModal(false);
  };

  const handleLaunchConfirm = () => {
    dispatch({ type: 'SET_STATUS', status: 'Live' });
    dispatch({ 
      type: 'ADD_TOAST', 
      toast: { id: Date.now().toString(), message: 'Campaign launched!', type: 'success' } 
    });
    setShowLaunchModal(false);
  };

  const handleConflictAction = (action: string) => {
    // Parse the action and apply it
    const dateMatch = action.match(/(\w+\s+\d+)/);
    if (dateMatch) {
      dispatch({ 
        type: 'ADD_TOAST', 
        toast: { id: Date.now().toString(), message: `Applied: ${action}`, type: 'info' } 
      });
    }
    setSelectedCheck(null);
  };

  const totalAudience = campaign.audiences.reduce((sum, a) => sum + a.size, 0);

  return (
    <div className="canvas">
      <div className="canvas-header">
        <div>
          <h1 className="canvas-title">{campaign.name}</h1>
          <p className="canvas-subtitle">{campaign.brand} • {campaign.product}</p>
        </div>
        <Badge variant={campaign.status.toLowerCase() as 'draft' | 'scheduled' | 'live'}>
          {campaign.status}
        </Badge>
      </div>

      <div className="canvas-sections">
        {/* Campaign Summary - Always Expanded */}
        <div className="section section-summary">
          <h3 className="section-title">Campaign Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Offer</span>
              <span className="summary-value">{campaign.offerPercent}% off</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Window</span>
              <span className="summary-value">{formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}</span>
            </div>
            <div className="summary-item summary-item-delivery">
              <span className="summary-label">Delivery</span>
              <span className="summary-value">
                <div className="delivery-info">
                  <span>SMS</span>
                  <span className="delivery-note">Quiet hours and frequency limits enforced</span>
                </div>
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Sends</span>
              <span className="summary-value">{sendStepCount} texts</span>
            </div>
          </div>
        </div>

        {/* Audiences */}
        <Section 
          title="Audiences" 
          summary={<span>{campaign.audiences.length} segments • {totalAudience.toLocaleString()} recipients</span>}
        >
          {campaign.audiences.map(audience => (
            <div key={audience.id} className="audience-card">
              <div className="audience-header">
                <span className="audience-name">{audience.name}</span>
                <span className="audience-size">{audience.size.toLocaleString()}</span>
              </div>
              <div className="audience-details">
                <div className="audience-rules">
                  <strong>Include:</strong>
                  <ul>{audience.inclusions.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
                <div className="audience-rules">
                  <strong>Exclude:</strong>
                  <ul>{audience.exclusions.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              </div>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingAudience(audience)}
              >
                Edit audience
              </button>
            </div>
          ))}
        </Section>

        {/* Flow Overview */}
        <FlowOverviewSection
          steps={campaign.flowSteps}
          messages={campaign.messages}
          campaign={campaign}
          onUpdateStep={handleUpdateFlowStep}
          onShowWhy={handleShowWhyClicked}
          onRunSimulation={handleRunSimulation}
        />

        {/* Flow Behaviors */}
        <FlowBehaviorsSection
          behaviors={campaign.flowBehaviors}
          onToggle={handleToggleBehavior}
          onShowWhy={handleShowWhyClicked}
        />

        {/* Messages */}
        <Section 
          title="Messages"
          summary={<span>{Object.keys(campaign.messages).length} templates</span>}
        >
          {Object.values(campaign.messages).map(message => (
            <div key={message.id} className="message-card">
              <div className="message-header">
                <span className="message-tone">Tone: {message.tone}</span>
              </div>
              {editingMessage === message.id ? (
                <textarea
                  className="message-editor"
                  value={message.body}
                  onChange={e => handleMessageEdit(message.id, e.target.value)}
                  onBlur={() => setEditingMessage(null)}
                  autoFocus
                  rows={3}
                />
              ) : (
                <p 
                  className="message-body"
                  onClick={() => setEditingMessage(message.id)}
                >
                  {interpolateMessage(message.body, campaign)}
                </p>
              )}
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => handleToneChange(message.id)}
              >
                Adjust tone
              </button>
            </div>
          ))}
        </Section>

        {/* Conflicts & Checks */}
        <div className="section section-checks">
          <h3 className="section-title">Conflicts & Checks</h3>
          {campaign.checks.length === 0 ? (
            <p className="checks-clear">✓ No issues detected</p>
          ) : (
            <div className="checks-list">
              {campaign.checks.map(check => (
                <div 
                  key={check.id} 
                  className={`check-item check-item-${check.severity}`}
                  onClick={() => check.severity !== 'success' && setSelectedCheck(check)}
                >
                  {check.severity === 'success' ? (
                    <span className="check-ok">✓</span>
                  ) : (
                    <Badge variant={check.severity}>{check.severity}</Badge>
                  )}
                  <span className="check-title">{check.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="canvas-actions">
        <button 
          className="btn btn-secondary"
          onClick={() => dispatch({ 
            type: 'ADD_TOAST', 
            toast: { id: Date.now().toString(), message: 'Draft saved', type: 'success' } 
          })}
        >
          Save Draft
        </button>
        <button 
          className="btn btn-secondary"
          onClick={() => setShowScheduleModal(true)}
        >
          Schedule
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => setShowLaunchModal(true)}
        >
          Launch
        </button>
      </div>

      {/* Modals */}
      {editingAudience && (
        <AudienceEditorModal
          audience={editingAudience}
          onSave={handleAudienceSave}
          onClose={() => setEditingAudience(null)}
        />
      )}
      {selectedCheck && (
        <ConflictDrawer
          check={selectedCheck}
          onAction={handleConflictAction}
          onClose={() => setSelectedCheck(null)}
        />
      )}
      {showScheduleModal && (
        <ScheduleModal
          campaign={campaign}
          onConfirm={handleScheduleConfirm}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
      {showLaunchModal && (
        <LaunchModal
          campaign={campaign}
          onConfirm={handleLaunchConfirm}
          onClose={() => setShowLaunchModal(false)}
        />
      )}
      {showActivityLog && (
        <WhyDrawer
          log={campaign.activityLog}
          onClose={() => setShowActivityLog(false)}
        />
      )}
      {showTrace && campaign.executionTrace?.length > 0 && (
        <ExecutionTraceDrawer
          trace={campaign.executionTrace}
          onClose={() => {
            setShowTrace(false);
            onClearOpenTraceDrawer();
          }}
        />
      )}
    </div>
  );
}

// Empty State
function EmptyCanvas() {
  return (
    <div className="canvas canvas-empty">
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <h2>No Campaign Yet</h2>
        <p>Use the chat to create a new campaign.</p>
        <p className="empty-hint">Try: "create valentine's moisturizer campaign"</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [state, dispatch] = useReducer(reducer, {
    campaign: null,
    chatMessages: [],
    toasts: [],
    openTraceDrawer: false
  });

  const [dividerPosition, setDividerPosition] = useState(380);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current) {
      const newPos = Math.max(280, Math.min(600, e.clientX));
      setDividerPosition(newPos);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const CREATE_CAMPAIGN_STATUS_MESSAGES = [
    "Pulling in the best audiences...",
    "Looking across your brand book...",
    "Checking calendar and inventory...",
    "Putting it all together..."
  ];
  const CREATE_CAMPAIGN_DELAY_MS = 8000;
  const CREATE_CAMPAIGN_STATUS_INTERVAL_MS = 2000;

  const handleChatSend = (message: string) => {
    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', message: userMsg });

    // Process command
    const result = processCommand(message, state.campaign);

    const isCreateCampaign = result.actions.some(
      (a): a is { type: 'SET_CAMPAIGN'; campaign: Campaign } =>
        a.type === 'SET_CAMPAIGN' && 'campaign' in a
    );

    if (isCreateCampaign) {
      // Show status messages over 8 seconds, then apply campaign and final response
      CREATE_CAMPAIGN_STATUS_MESSAGES.forEach((statusText, i) => {
        setTimeout(() => {
          const statusMsg: ChatMessage = {
            id: `status-${Date.now()}-${i}`,
            role: 'assistant',
            content: statusText,
            isStatus: true
          };
          dispatch({ type: 'ADD_CHAT_MESSAGE', message: statusMsg });
        }, i * CREATE_CAMPAIGN_STATUS_INTERVAL_MS);
      });
      setTimeout(() => {
        result.actions.forEach(action => dispatch(action));
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          changes: result.changes.length > 0 ? result.changes : undefined
        };
        dispatch({ type: 'ADD_CHAT_MESSAGE', message: assistantMsg });
      }, CREATE_CAMPAIGN_DELAY_MS);
    } else {
      result.actions.forEach(action => dispatch(action));
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        changes: result.changes.length > 0 ? result.changes : undefined
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', message: assistantMsg });
    }
  };

  const handleToastDismiss = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  };

  // Auto-dismiss toasts
  useEffect(() => {
    if (state.toasts.length > 0) {
      const timer = setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', id: state.toasts[0].id });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.toasts]);

  return (
    <div className="app">
      <div className="split-pane">
        <div className="pane pane-left" style={{ width: dividerPosition }}>
          <ChatInterface messages={state.chatMessages} onSend={handleChatSend} />
        </div>
        <div 
          className="divider"
          onMouseDown={handleMouseDown}
        />
        <div className="pane pane-right" style={{ left: dividerPosition + 4 }}>
          {state.campaign ? (
            <CampaignCanvas
              campaign={state.campaign}
              dispatch={dispatch}
              openTraceDrawer={state.openTraceDrawer}
              onClearOpenTraceDrawer={() => dispatch({ type: 'CLEAR_OPEN_TRACE_DRAWER' })}
            />
          ) : (
            <EmptyCanvas />
          )}
        </div>
      </div>
      <ToastContainer toasts={state.toasts} onDismiss={handleToastDismiss} />
    </div>
  );
}
