// @glyx/design — Feedback components
//
// Exports:
//   Alert          — inline status message (info / success / warning / error)
//   ProgressBar    — horizontal progress indicator
//   Spinner        — animated loading spinner
//   Skeleton       — pulsing loading placeholder
//   ToastProvider  — context provider; wrap your app root with this
//   useToast       — { showToast, dismiss } hook

import React, {
  useState, useEffect, useCallback, useRef,
  createContext, useContext,
} from 'react';
import { View, Text, Pressable } from '@glyx/react';
import { useTheme } from './theme.js';

// ── Alert ─────────────────────────────────────────────────────────────────────
//
// Inline status message box.
//
// Props:
//   variant   — 'info' | 'success' | 'warning' | 'error'  (default 'info')
//   title     — optional bold headline
//   message   — body text
//   onClose   — if provided, a dismiss (✕) button is rendered

const ALERT_ICON = { info: 'ℹ', success: '✓', warning: '⚠', error: '✕' };

export function Alert({ variant = 'info', title, message, onClose, style }) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  const bg  = variant === 'success' ? colors.successSurface
            : variant === 'warning' ? colors.warningSurface
            : variant === 'error'   ? colors.errorSurface
            : colors.surfaceRaised;

  const accent = variant === 'success' ? colors.success
               : variant === 'warning' ? colors.warning
               : variant === 'error'   ? colors.error
               : colors.primary;

  return (
    <View
      style={{
        flexDirection:    'row',
        alignItems:       'flex-start',
        backgroundColor:  bg,
        borderRadius:     radius.md,
        borderLeftWidth:  3,
        borderLeftColor:  accent,
        paddingHorizontal: space[3],
        paddingVertical:   space[3],
        gap:              space[3],
        ...style,
      }}
    >
      {/* Icon */}
      <Text
        fontSize={fontSize.base}
        style={{ color: accent, fontWeight: fontWeight.bold }}
      >
        {ALERT_ICON[variant]}
      </Text>

      {/* Content */}
      <View style={{ flex: 1, gap: space[1] }}>
        {title != null && (
          <Text
            fontSize={fontSize.sm}
            style={{ color: accent, fontWeight: fontWeight.semibold }}
          >
            {title}
          </Text>
        )}
        {message != null && (
          <Text fontSize={fontSize.sm} style={{ color: colors.text }}>
            {message}
          </Text>
        )}
      </View>

      {/* Dismiss */}
      {onClose != null && (
        <Pressable onPress={onClose}>
          <Text fontSize={fontSize.sm} style={{ color: accent }}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
//
// Horizontal track + fill bar.
//
// Props:
//   value   — current value (default 0)
//   max     — maximum value (default 100)
//   height  — bar height in px (default 6)
//   color   — fill color (defaults to theme primary)
//   label   — if provided, renders the label + percentage above the bar

export function ProgressBar({
  value = 0,
  max   = 100,
  height = 6,
  color,
  label,
  style,
}) {
  const { colors, space, radius, fontSize } = useTheme();
  const pct       = Math.min(100, Math.max(0, (value / max) * 100));
  const fillColor = color ?? colors.primary;

  return (
    <View style={{ gap: space[1], ...style }}>
      {label != null && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text fontSize={fontSize.sm} style={{ color: colors.textMuted }}>
            {label}
          </Text>
          <Text fontSize={fontSize.sm} style={{ color: colors.textMuted }}>
            {Math.round(pct)}%
          </Text>
        </View>
      )}

      {/* Track */}
      <View
        style={{
          height:          height,
          backgroundColor: colors.surfaceRaised,
          borderRadius:    radius.full,
          overflow:        'hidden',
        }}
      >
        {/* Fill */}
        <View
          style={{
            height:          '100%',
            width:           `${pct}%`,
            backgroundColor: fillColor,
            borderRadius:    radius.full,
          }}
        />
      </View>
    </View>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
//
// Rotating dot-ring loading indicator.
//
// Props:
//   size   — diameter in px (default 32)
//   color  — dot color (defaults to theme primary)

export function Spinner({ size = 32, color, style }) {
  const { colors } = useTheme();
  const c = color ?? colors.primary;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 12), 80);
    return () => clearInterval(id);
  }, []);

  const dotD   = Math.max(3, Math.round(size / 9));
  const ringR  = size / 2 - dotD;
  const cx     = size / 2;
  const cy     = size / 2;

  return (
    <View
      width={size}
      height={size}
      style={{ position: 'relative', ...style }}
    >
      {Array.from({ length: 12 }, (_, i) => {
        const angle   = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x       = cx + Math.cos(angle) * ringR - dotD / 2;
        const y       = cy + Math.sin(angle) * ringR - dotD / 2;
        const opacity = (1 - ((frame - i + 12) % 12) / 12) * 0.85 + 0.15;
        return (
          <View
            key={i}
            style={{
              position:        'absolute',
              left:            x,
              top:             y,
              width:           dotD,
              height:          dotD,
              borderRadius:    dotD / 2,
              backgroundColor: c,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
//
// A pulsing placeholder for content that is still loading.
//
// Single-rect mode:
//   <Skeleton width={200} height={16} />
//
// Multi-line mode (e.g. for a paragraph):
//   <Skeleton lines={3} height={14} gap={8} />
//   — last line is automatically shorter (65% width) to look natural

export function Skeleton({ width, height = 16, borderRadius, lines, gap, style }) {
  const { colors, radius } = useTheme();
  const [opacity, setOpacity] = useState(0.4);

  useEffect(() => {
    let rising = true;
    const id = setInterval(() => {
      setOpacity(o => {
        const next = o + (rising ? 0.04 : -0.04);
        if (next >= 0.75) rising = false;
        if (next <= 0.30) rising = true;
        return next;
      });
    }, 60);
    return () => clearInterval(id);
  }, []);

  const baseStyle = {
    height,
    borderRadius: borderRadius ?? radius.sm,
    backgroundColor: colors.border,
    opacity,
  };

  if (lines != null) {
    return (
      <View style={{ gap: gap ?? 8, ...style }}>
        {Array.from({ length: lines }, (_, i) => (
          <View
            key={i}
            style={{
              ...baseStyle,
              width: i === lines - 1 ? '65%' : '100%',
            }}
          />
        ))}
      </View>
    );
  }

  return <View style={{ width, ...baseStyle, ...style }} />;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
//
// Auto-dismissing notification system.
//
// 1. Wrap your app root with <ToastProvider>:
//
//      render(<ToastProvider><App /></ToastProvider>)
//
// 2. Call showToast() from anywhere inside:
//
//      const { showToast } = useToast()
//      showToast({ message: 'Saved!', variant: 'success' })
//
// showToast options:
//   message     — notification text
//   variant     — 'default' | 'success' | 'error' | 'warning'
//   duration    — ms before auto-dismiss (0 = stay until dismissed, default 3000)
//   action      — optional callback for an action button
//   actionLabel — label for the action button (default 'Action')

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map()); // id → timer handle

  useEffect(() => {
    const timers = timersRef.current;
    return () => { for (const h of timers.values()) clearTimeout(h); timers.clear(); };
  }, []);

  const showToast = useCallback(({
    message,
    variant      = 'default',
    duration     = 3000,
    action,
    actionLabel  = 'Action',
  }) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, variant, duration, action, actionLabel }]);
    if (duration > 0) {
      const h = setTimeout(() => {
        setToasts(t => t.filter(x => x.id !== id));
        timersRef.current.delete(id);
      }, duration);
      timersRef.current.set(id, h);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    const h = timersRef.current.get(id);
    if (h != null) { clearTimeout(h); timersRef.current.delete(id); }
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ showToast, dismiss }}>
      {children}
      {toasts.length > 0 && (
        <_ToastLayer toasts={toasts} onDismiss={dismiss} />
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be called inside <ToastProvider>');
  return ctx;
}

function _ToastLayer({ toasts, onDismiss }) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom:   24,
        left:     0,
        right:    0,
        alignItems: 'center',
        gap:      8,
        zIndex:   999,
      }}
    >
      {toasts.map(t => (
        <_ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

function _ToastItem({ toast, onDismiss }) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  const bg = toast.variant === 'success' ? colors.success
           : toast.variant === 'error'   ? colors.error
           : toast.variant === 'warning' ? colors.warning
           : colors.surfaceRaised;

  const fg = (toast.variant === 'success' ||
              toast.variant === 'error'   ||
              toast.variant === 'warning')
           ? colors.primaryText
           : colors.text;

  return (
    <View
      style={{
        flexDirection:     'row',
        alignItems:        'center',
        backgroundColor:   bg,
        borderRadius:      radius.lg,
        paddingHorizontal: space[4],
        paddingVertical:   space[3],
        gap:               space[3],
        width:             320,
        boxShadow:         '0 4 16 #00000040',
      }}
    >
      <Text fontSize={fontSize.sm} style={{ color: fg, flex: 1 }}>
        {toast.message}
      </Text>

      {toast.action != null && (
        <Pressable
          onPress={() => { toast.action(); onDismiss(toast.id); }}
        >
          <Text
            fontSize={fontSize.sm}
            style={{ color: fg, fontWeight: fontWeight.semibold }}
          >
            {toast.actionLabel}
          </Text>
        </Pressable>
      )}

      <Pressable onPress={() => onDismiss(toast.id)}>
        <Text fontSize={fontSize.sm} style={{ color: fg, opacity: 0.7 }}>
          x
        </Text>
      </Pressable>
    </View>
  );
}
