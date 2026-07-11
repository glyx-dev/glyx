// @glyx/icons — Lucide icon set for Glyx apps.
//
// Icons are rendered as inline SVG data URIs so they work without any
// asset bundling step and support runtime color + size changes.
//
// Lucide icons are MIT licensed. https://lucide.dev
//
// Usage:
//   import { Icon } from '@glyx/icons'
//   <Icon name="arrow-right" size={20} color="#fff" />

import React from 'react';
import { Image } from '@glyx/react';

// ── Icon path registry ────────────────────────────────────────────────────────
// Each value is the inner SVG content (paths, circles, lines, polylines).
// All icons share: viewBox="0 0 24 24" fill="none" stroke="currentColor"
// stroke-width="{strokeWidth}" stroke-linecap="round" stroke-linejoin="round"

const ICONS = {
  // ── Arrows ──────────────────────────────────────────────────────────────────
  'arrow-right':       '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left':        '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  'arrow-up':          '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  'arrow-down':        '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'arrow-up-right':    '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  'arrow-down-left':   '<path d="M17 7 7 17"/><path d="M17 17H7V7"/>',

  // ── Chevrons ─────────────────────────────────────────────────────────────────
  'chevron-right':     '<path d="m9 18 6-6-6-6"/>',
  'chevron-left':      '<path d="m15 18-6-6 6-6"/>',
  'chevron-up':        '<path d="m18 15-6-6-6 6"/>',
  'chevron-down':      '<path d="m6 9 6 6 6-6"/>',
  'chevrons-right':    '<path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/>',
  'chevrons-left':     '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',

  // ── Basic actions ────────────────────────────────────────────────────────────
  'x':                 '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'check':             '<path d="M20 6 9 17l-5-5"/>',
  'plus':              '<path d="M12 5v14"/><path d="M5 12h14"/>',
  'minus':             '<path d="M5 12h14"/>',
  'search':            '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'menu':              '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  'more-horizontal':   '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'more-vertical':     '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  'copy':              '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  'trash':             '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  'edit':              '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  'save':              '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  'refresh-cw':        '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'filter':            '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  'sort-asc':          '<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/>',
  'external-link':     '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',

  // ── Status / Feedback ────────────────────────────────────────────────────────
  'check-circle':      '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'x-circle':          '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  'alert-circle':      '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  'alert-triangle':    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  'info':              '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'loader':            '<line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/>',

  // ── UI / Navigation ──────────────────────────────────────────────────────────
  'home':              '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  'settings':          '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  'user':              '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  'users':             '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'bell':              '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'star':              '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'heart':             '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  'eye':               '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':           '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  'lock':              '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'unlock':            '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  'maximize':          '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  'minimize':          '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',

  // ── File / Storage ───────────────────────────────────────────────────────────
  'file':              '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  'file-text':         '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  'folder':            '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  'download':          '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'upload':            '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  'link':              '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'image':             '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',

  // ── Communication ────────────────────────────────────────────────────────────
  'mail':              '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  'message-square':    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  'send':              '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',

  // ── Date / Time ──────────────────────────────────────────────────────────────
  'calendar':          '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  'clock':             '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',

  // ── Media ────────────────────────────────────────────────────────────────────
  'play':              '<polygon points="6 3 20 12 6 21 6 3"/>',
  'pause':             '<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>',
  'stop-circle':       '<circle cx="12" cy="12" r="10"/><rect width="6" height="6" x="9" y="9"/>',
  'volume-2':          '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  'volume-x':          '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',

  // ── Globe / Network ──────────────────────────────────────────────────────────
  'globe':             '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  'wifi':              '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" x2="12.01" y1="20" y2="20"/>',

  // ── Theme ────────────────────────────────────────────────────────────────────
  'sun':               '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'moon':              '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',

  // ── Misc ─────────────────────────────────────────────────────────────────────
  'tag':               '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  'zap':               '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'key':               '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  'shield':            '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  'database':          '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  'code':              '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  'terminal':          '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  'cpu':               '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  'grid':              '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  'layout':            '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/>',
};

// ── Icon component ─────────────────────────────────────────────────────────────

/**
 * Render a Lucide icon by name.
 *
 * @param {{ name: string, size?: number, color?: string, strokeWidth?: number, style?: object }} props
 *
 * @example
 * <Icon name="arrow-right" size={20} color="#fff" />
 * <Icon name="check-circle" size={24} color="#00A878" strokeWidth={1.5} />
 */
export function Icon({ name, size = 24, color = '#000000', strokeWidth = 2, style }) {
  const inner = ICONS[name];
  if (!inner) {
    if (typeof __glyx_log !== 'undefined') {
      __glyx_log('[icons] unknown icon: ' + name);
    }
    return null;
  }

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ' viewBox="0 0 24 24"',
    ' width="', size, '"',
    ' height="', size, '"',
    ' fill="none"',
    ' stroke="', color, '"',
    ' stroke-width="', strokeWidth, '"',
    ' stroke-linecap="round"',
    ' stroke-linejoin="round">',
    inner,
    '</svg>',
  ].join('');

  const src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  return React.createElement(Image, { src, width: size, height: size, style });
}

/**
 * List all available icon names.
 * @returns {string[]}
 */
export function iconNames() {
  return Object.keys(ICONS);
}
