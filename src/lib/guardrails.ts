import type { AudiencePlan, Campaign, Issue } from '../types';

function makeIssue(id: string, severity: Issue['severity'], title: string, detail: string, suggestedAction?: string): Issue {
  return { id, severity, title, detail, suggestedAction };
}

/** Run guardrail checks on an audience plan; returns issues. */
export function runGuardrails(campaign: Campaign, audience: AudiencePlan): Issue[] {
  const issues: Issue[] = [];
  const prefix = `aud-${audience.id}-`;

  // 1) Frequency cap exceeded (simple: check blueprint cadence vs a global cap if we had one)
  const maxPerWeek = audience.blueprint.cadence?.maxPerWeek ?? 0;
  if (maxPerWeek > 7) {
    issues.push(makeIssue(
      `${prefix}freq-cap`,
      'warning',
      'Frequency cap high',
      `Max ${maxPerWeek} messages per week may exceed typical SMS best practices.`,
      'Ask Sotto to fix'
    ));
  }

  // 2) Missing stop condition
  const stopConditions = audience.blueprint.stopConditions ?? [];
  if (stopConditions.length === 0) {
    issues.push(makeIssue(
      `${prefix}no-stop`,
      'blocker',
      'Missing stop condition',
      'At least one stop condition is required before publishing.',
      'Ask Sotto to fix'
    ));
  }

  // 3) Conflicting audience overlap (simple heuristic: same name?)
  const otherAudiences = campaign.audiences.filter((a) => a.id !== audience.id);
  const sameName = otherAudiences.find((a) => a.name === audience.name);
  if (sameName) {
    issues.push(makeIssue(
      `${prefix}overlap`,
      'warning',
      'Possible audience overlap',
      `Another audience has the same name; segments may overlap.`,
      'Ask Sotto to fix'
    ));
  }

  // 4) Unreachable branch / graph validation
  const flow = audience.flow;
  if (flow?.nodes?.length && flow?.edges?.length) {
    const hasTrigger = flow.nodes.some((n) => n.type === 'trigger');
    if (!hasTrigger) {
      issues.push(makeIssue(
        `${prefix}no-trigger`,
        'blocker',
        'Flow has no trigger',
        'Execution flow must have a trigger node.',
        'Ask Sotto to fix'
      ));
    }
    const reachable = new Set<string>();
    const triggerNode = flow.nodes.find((n) => n.type === 'trigger');
    if (triggerNode) {
      reachable.add(triggerNode.id);
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of flow.edges) {
          if (reachable.has(e.from) && !reachable.has(e.to)) {
            reachable.add(e.to);
            changed = true;
          }
        }
      }
    }
    const unreachable = flow.nodes.filter((n) => !reachable.has(n.id) && n.type !== 'trigger');
    if (unreachable.length > 0) {
      issues.push(makeIssue(
        `${prefix}unreachable`,
        'warning',
        'Unreachable nodes',
        `These nodes are not reachable from the trigger: ${unreachable.map((n) => n.label).join(', ')}.`,
        'Ask Sotto to fix'
      ));
    }
  }

  // 5) Infinite loop risk (simple: no exit node)
  const hasExit = flow?.nodes?.some((n) => n.type === 'exit');
  if (flow?.nodes?.length && !hasExit) {
    issues.push(makeIssue(
      `${prefix}no-exit`,
      'blocker',
      'Flow has no exit',
      'Execution flow must have at least one exit node to avoid infinite loops.',
      'Ask Sotto to fix'
    ));
  }

  // 6) Compliance/promo rule violation - placeholder (would check KB policies)
  if (audience.blueprint.offerStrategy === 'Always' && !audience.blueprint.anchorMessages?.some((m) => m.smsCopy.toLowerCase().includes('disclaimer'))) {
    issues.push(makeIssue(
      `${prefix}compliance`,
      'info',
      'Offer disclaimer',
      'Consider adding a disclaimer for always-on offer messaging.',
      'Ask Sotto to fix'
    ));
  }

  return issues;
}

export function runGuardrailsForCampaign(campaign: Campaign): void {
  campaign.audiences.forEach((aud) => {
    aud.issues = runGuardrails(campaign, aud);
  });
}
