import React from 'react';

export type PanelId =
  | 'overview' | 'inspector' | 'console' | 'performance' | 'animations'
  | 'memory' | 'layout' | 'network' | 'cpu';

export interface PanelDef {
  id: PanelId;
  label: string;
  /** Plan phase that delivers it (GDP_DEVTOOLS_PLAN.md, M4); null = here now. */
  phase: string | null;
  blurb: string;
  icon: React.ReactNode;
}

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const PANELS: PanelDef[] = [
  { id: 'overview', label: 'Overview', phase: null,
    blurb: 'What you are connected to.',
    icon: <Icon d="M4 5h16v14H4zM4 9h16M9 9v10" /> },
  { id: 'inspector', label: 'Inspector', phase: null,
    blurb: 'Element tree with component names, select-in-app, box model, live prop edits and the accessibility view.',
    icon: <Icon d="M4 4l7 17 2.5-7.5L21 11z" /> },
  { id: 'console', label: 'Console', phase: null,
    blurb: 'Logs with filters, and a REPL that runs in the app with $0 for the selected element.',
    icon: <Icon d="M5 7l5 5-5 5M12 17h7" /> },
  { id: 'performance', label: 'Performance', phase: null,
    blurb: 'Frame chart split into JS, layout, render and present, jank marked, redraw overlays, recordings.',
    icon: <Icon d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { id: 'animations', label: 'Animations', phase: null,
    blurb: 'Timeline of transitions and keyframe animations, slow motion and scrubbing.',
    icon: <Icon d="M3 12c3-6 6-6 9 0s6 6 9 0" /> },
  { id: 'memory', label: 'Memory', phase: 'D5',
    blurb: 'Heap, RSS and GPU memory over time, leak warnings and snapshots.',
    icon: <Icon d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h3" /> },
  { id: 'layout', label: 'Layout', phase: 'D6',
    blurb: 'Flex explorer: why an element is the size it is, with live reflow.',
    icon: <Icon d="M3 3h18v18H3zM3 12h18M12 3v18" /> },
  { id: 'network', label: 'Network', phase: 'D7',
    blurb: 'fetch, WebSocket and IPC traffic with timings and payloads.',
    icon: <Icon d="M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /> },
  { id: 'cpu', label: 'CPU profiler', phase: 'D8',
    blurb: 'Record JavaScript time and read it as a flame chart.',
    icon: <Icon d="M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /> },
];
