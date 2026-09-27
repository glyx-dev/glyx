// Accessibility tab: audit issues grouped by rule, worst first.

export interface Issue { nodeId: number; id?: string; rule: string; severity: string; message: string; component?: string; text?: string }

export const RULES: Record<string, { title: string; fix: string }> = {
  'pressable-name': {
    title: 'Buttons with no name',
    fix: 'Give it visible text or an ariaLabel, so screen readers can say what it does.',
  },
  'image-name': {
    title: 'Images with no description',
    fix: 'Add an ariaLabel, or role="presentation" if the image is only decoration.',
  },
  contrast: {
    title: 'Hard-to-read text',
    fix: 'Darken or lighten the text or its background until it reaches 4.5:1 (3:1 for large or bold text).',
  },
  'focusable-role': {
    title: 'Focusable with no role',
    fix: 'Add a role (button, link, checkbox…) so assistive tech knows what it is.',
  },
};

export interface Group { rule: string; title: string; fix: string; severity: 'error' | 'warning'; errors: number; issues: Issue[] }

/** Issues grouped by rule; groups with errors first, then by size. */
export function groupIssues(issues: Issue[]): Group[] {
  const m = new Map<string, Issue[]>();
  for (const i of issues) m.set(i.rule, [...(m.get(i.rule) ?? []), i]);
  return [...m.entries()].map(([rule, list]) => {
    const errors = list.filter((i) => i.severity === 'error').length;
    // Worst first inside the group: errors, then the rest in tree order.
    const sorted = [...list].sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1));
    return {
      rule,
      title: RULES[rule]?.title ?? rule,
      fix: RULES[rule]?.fix ?? '',
      severity: errors ? 'error' as const : 'warning' as const,
      errors,
      issues: sorted,
    };
  }).sort((a, b) => (b.errors ? 1 : 0) - (a.errors ? 1 : 0) || b.issues.length - a.issues.length);
}

/** The short per-element detail: "3.62:1" for contrast, else the message. */
export function detail(i: Issue): string {
  const ratio = /([\d.]+:1)/.exec(i.message);
  return i.rule === 'contrast' && ratio ? `${ratio[1]} (needs ${/needs ([\d.]+:1)/.exec(i.message)?.[1] ?? '4.5:1'})` : i.message;
}

/** Identical findings (same component, same detail) folded into one row. */
export interface Row { key: string; component: string; detail: string; severity: string; issues: Issue[]; texts: string[] }

export function collapse(issues: Issue[]): Row[] {
  const rows = new Map<string, Row>();
  for (const i of issues) {
    const component = i.component ?? i.id ?? `node ${i.nodeId}`;
    const d = detail(i);
    const key = `${component}|${d}|${i.severity}`;
    let r = rows.get(key);
    if (!r) { r = { key, component, detail: d, severity: i.severity, issues: [], texts: [] }; rows.set(key, r); }
    r.issues.push(i);
    if (i.text && !r.texts.includes(i.text)) r.texts.push(i.text);
  }
  return [...rows.values()];
}

/** "“Sep 24”, “Aug 4” and 3 more" */
export function textSummary(texts: string[], max = 2): string {
  if (!texts.length) return '';
  const shown = texts.slice(0, max).map((t) => `“${t}”`).join(', ');
  return texts.length > max ? `${shown} and ${texts.length - max} more` : shown;
}
