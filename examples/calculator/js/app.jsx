import './polyfills.js';
import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, render, useWindowSize,
} from '@velox/react';

// ── Theme ─────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#1e1e2e',
  surface:     '#181825',
  surfaceAlt:  '#313244',
  overlay:     '#45475a',
  text:        '#cdd6f4',
  subtle:      '#a6adc8',
  dim:         '#6c7086',
  accent:      '#89b4fa',
  green:       '#a6e3a1',
  red:         '#f38ba8',
  yellow:      '#f9e2af',
  mauve:       '#cba6f7',
  teal:        '#94e2d5',
};

// ── Calculator state machine ──────────────────────────────────────────────────

function calc(state, key) {
  if (key === 'C') {
    return { disp: '0', prev: null, op: null, wait: false, expr: '' };
  }

  if (key === '⌫') {
    const d = state.disp;
    const next = d.length > 1 ? d.slice(0, -1) : '0';
    return { ...state, disp: next };
  }

  if (key >= '0' && key <= '9') {
    if (state.wait) {
      return { ...state, disp: key, wait: false };
    }
    const d = state.disp === '0' ? key : state.disp + key;
    return { ...state, disp: d };
  }

  if (key === '.') {
    if (state.wait) {
      return { ...state, disp: '0.', wait: false };
    }
    if (state.disp.includes('.')) return state;
    return { ...state, disp: state.disp + '.' };
  }

  // Operator [+, −, ×, ÷]
  if (['+', '−', '×', '÷'].includes(key)) {
    if (state.op && !state.wait) {
      const result = compute(state.prev, state.disp, state.op);
      return { disp: String(result), prev: result, op: key, wait: true, expr: state.prev + ' ' + state.op + ' ' + state.disp + ' ' + key };
    }
    return { ...state, prev: state.disp, op: key, wait: true, expr: state.disp + ' ' + key + ' ' };
  }

  if (key === '=') {
    if (!state.op) return state;
    const result = compute(state.prev, state.disp, state.op);
    return { disp: String(result), prev: null, op: null, wait: true, expr: '', lastResult: result };
  }

  return state;
}

function compute(a, b, op) {
  const left = parseFloat(a);
  const right = parseFloat(b);
  switch (op) {
    case '+': return left + right;
    case '−': return left - right;
    case '×': return left * right;
    case '÷': return right !== 0 ? left / right : 'Error';
    default: return right;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const { width: winW, height: winH } = useWindowSize();
  const [state, setState] = useState({ disp: '0', prev: null, op: null, wait: false, expr: '' });
  const [gridMode, setGridMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const press = useCallback((key) => {
    setState(s => {
      const next = calc(s, key);
      if (key === '=' && next.lastResult !== undefined) {
        const entry = (s.expr || s.disp + ' =') + ' ' + next.disp;
        setHistory(h => [...h, entry].slice(-50)); // keep last 50
      }
      return next;
    });
  }, []);

  const titleH = 32;
  const btnH = gridMode ? (winH - 200) / 7 : (winH - 156) / 5;
  const dispH = 60;

  const btnStyle = (color) => ({
    backgroundColor: color,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
    boxShadow: '0 2 4 #00000044',
  });

  const Btn = ({ label, color = C.surfaceAlt, span = 1, disabled = false, gridColumn, gridRow }) => (
    <Pressable
      disabled={disabled}
      onPress={() => press(label)}
      flex={gridMode ? undefined : span}
      gridColumn={gridColumn}
      gridRow={gridRow}
      height={btnH}
      style={btnStyle(color)}
    >
      <Text fontSize={20} height={28} style={{ color: disabled ? C.dim : C.text, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );

  const pad = 8;

  return (
    <View
      style={{
        backgroundColor: C.bg,
        padding: pad,
        gap: 4,
        justifyContent: 'flex-start',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
      width={winW}
      height={winH}
    >
      {/* Custom titlebar — draggable (frameless window) */}
      <View
        veloxDraggable
        style={{
          backgroundColor: C.surfaceAlt,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 12,
        }}
        width="100%"
        height={titleH}
      >
        <Text fontSize={12} width={120} height={16} style={{ color: C.subtle }}>Calculator</Text>
        <View style={{ flexDirection: 'row', gap: 4, paddingRight: 4 }}>
          <Pressable onPress={() => setShowHistory(s => !s)} width={24} height={24} style={{ backgroundColor: showHistory ? C.green : C.overlay, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
            <Text fontSize={10} height={12} style={{ color: '#fff' }}>H</Text>
          </Pressable>
          <Pressable onPress={() => setGridMode(m => !m)} width={36} height={24} style={{ backgroundColor: C.mauve, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
            <Text fontSize={10} height={12} style={{ color: '#fff' }}>{gridMode ? 'Std' : 'Sci'}</Text>
          </Pressable>
          <Pressable onPress={() => __velox_quit()}             width={24} height={24} style={{ backgroundColor: C.red, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text fontSize={10} height={12} style={{ color: '#fff' }}>×</Text>
          </Pressable>
        </View>
      </View>

      {/* Scrollable history panel */}
      {showHistory && history.length > 0 && (
        <View
          position="absolute"
          top={titleH + 8} right={pad}
          width={180}
          height={260}
          style={{
            backgroundColor: C.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: C.overlay,
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
          <Text fontSize={10} height={20} style={{ color: C.subtle, padding: 4 }}>History</Text>
          <ScrollView
            width={178}
            showScrollbar
            scrollbarWidth={6}
            scrollbarColor="#8c8caa99"
            contentHeight={history.length * 26}
            height={236}
          >
            {history.map((entry, i) => (
              <Text key={i} fontSize={11} height={24} style={{
                color: C.text,
                paddingLeft: 4,
                paddingRight: 16,
              }}>
                {entry}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Display */}
      <View
        backgroundGradient="#1e1e2e #313244"
        alignSelf="stretch"
        flexGrow={1}
        style={{
          borderRadius: 12,
          padding: 12,
          justifyContent: 'center',
          alignItems: 'flex-end',
          minWidth: 200,
          overflow: 'hidden',
        }}
        height={dispH}
      >
        <Text
          fontSize={28} height={36}
          width="100%"
          style={{ color: C.text, textAlign: 'right' }}
          numberOfLines={1}
        >
          {state.disp}
        </Text>
      </View>

      {/* Expression bar */}
      <View
        opacity={0.6}
        style={{ alignItems: 'flex-end' }}
        width="100%"
        height={20}
      >
        <Text fontSize={11} height={16} style={{ color: C.dim }}>
          {state.expr}
        </Text>
      </View>

      {gridMode ? (
        <View display="grid" gridTemplateColumns="1fr 1fr 1fr 1fr" gridTemplateRows="repeat(7, 1fr)" width="100%" style={{ gap: 0, flexGrow: 1 }}>
          {/* Row 1: scientific functions */}
          <Btn label="sin" gridColumn="1" gridRow="1" color={C.teal} />
          <Btn label="cos" gridColumn="2" gridRow="1" color={C.teal} />
          <Btn label="tan" gridColumn="3" gridRow="1" color={C.teal} />
          <Btn label="log" gridColumn="4" gridRow="1" color={C.teal} />

          {/* Row 2: more scientific */}
          <Btn label="ln"  gridColumn="1" gridRow="2" color={C.teal} />
          <Btn label="√"   gridColumn="2" gridRow="2" color={C.teal} />
          <Btn label="xⁿ"  gridColumn="3" gridRow="2" color={C.teal} />
          <Btn label="("   gridColumn="4" gridRow="2" color={C.overlay} />

          {/* Row 3: memory/clear */}
          <Btn label="C"   gridColumn="1" gridRow="3" color={C.red} />
          <Btn label="⌫"   gridColumn="2" gridRow="3" color={C.overlay} />
          <Btn label="%"   gridColumn="3" gridRow="3" color={C.overlay} />
          <Btn label="÷"   gridColumn="4" gridRow="3" color={C.mauve} />

          {/* Row 4: digits 7-9 + × */}
          <Btn label="7"   gridColumn="1" gridRow="4" />
          <Btn label="8"   gridColumn="2" gridRow="4" />
          <Btn label="9"   gridColumn="3" gridRow="4" />
          <Btn label="×"   gridColumn="4" gridRow="4" color={C.mauve} />

          {/* Row 5: digits 4-6 + − */}
          <Btn label="4"   gridColumn="1" gridRow="5" />
          <Btn label="5"   gridColumn="2" gridRow="5" />
          <Btn label="6"   gridColumn="3" gridRow="5" />
          <Btn label="−"   gridColumn="4" gridRow="5" color={C.mauve} />

          {/* Row 6: digits 1-3 + + */}
          <Btn label="1"   gridColumn="1" gridRow="6" />
          <Btn label="2"   gridColumn="2" gridRow="6" />
          <Btn label="3"   gridColumn="3" gridRow="6" />
          <Btn label="+"   gridColumn="4" gridRow="6" color={C.mauve} />

          {/* Row 7: 0 (span 2), ., = */}
          <Btn label="0"   gridColumn="1 / 3" gridRow="7" span={2} />
          <Btn label="."   gridColumn="3" gridRow="7" />
          <Btn label="="   gridColumn="4" gridRow="7" color={C.accent} />
        </View>
      ) : (
        <>
          {/* Row 1: C, ⌫, %, ÷ */}
          <View style={{ flexDirection: 'row', gap: 4 }} width="100%" height={btnH}>
            <Btn label="C" color={C.red} />
            <Btn label="⌫" color={C.overlay} />
            <Btn label="%" color={C.overlay} />
            <Btn label="÷" color={C.mauve} disabled={state.disp === '0'} />
          </View>

          {/* Row 2: 7, 8, 9, × */}
          <View style={{ flexDirection: 'row', gap: 4 }} width="100%" height={btnH}>
            <Btn label="7" />
            <Btn label="8" />
            <Btn label="9" />
            <Btn label="×" color={C.mauve} />
          </View>

          {/* Row 3: 4, 5, 6, − */}
          <View style={{ flexDirection: 'row', gap: 4 }} width="100%" height={btnH}>
            <Btn label="4" />
            <Btn label="5" />
            <Btn label="6" />
            <Btn label="−" color={C.mauve} />
          </View>

          {/* Row 4: 1, 2, 3, + */}
          <View style={{ flexDirection: 'row', gap: 4 }} width="100%" height={btnH}>
            <Btn label="1" />
            <Btn label="2" />
            <Btn label="3" />
            <Btn label="+" color={C.mauve} />
          </View>

          {/* Row 5: 0 (span 2), ., = — wraps on narrow windows */}
          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }} width="100%" height={btnH}>
            <Btn label="0" span={2} />
            <Btn label="." />
            <Btn label="=" color={C.accent} />
          </View>
        </>
      )}

      {/* ── Result overlay ── */}
      {state.lastResult !== undefined && (
        <Pressable
          position="absolute"
          top={0} left={0} right={0} bottom={0}
          onPress={() => setState(s => ({ ...s, lastResult: undefined }))}
          style={{
            backgroundColor: '#00000088',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <View
            style={{
              backgroundColor: C.surface,
              borderRadius: 16,
              padding: 24,
              alignItems: 'center',
              boxShadow: '0 4 12 #00000066',
            }}
          >
            <View transform="scale(1.15)">
              <Text fontSize={12} height={16} style={{ color: C.subtle }}>Result</Text>
              <Text fontSize={40} height={48} style={{ color: C.text }}>
                {state.lastResult}
              </Text>
            </View>
            <Pressable
              onPress={() => setState(s => ({ ...s, lastResult: undefined }))}
              style={{
                backgroundColor: C.accent,
                borderRadius: 8,
                padding: 8,
                paddingLeft: 20,
                paddingRight: 20,
                marginTop: 12,
              }}
            >
              <Text fontSize={14} height={18} style={{ color: '#fff' }}>OK</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* ── Test 2: Rotated "About" badge ── */}
      <View
        position="absolute"
        bottom={8} right={8}
        width={56} height={22}
        transform="rotate(-6)"
        style={{
          backgroundColor: C.mauve,
          borderTopLeftRadius: 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text fontSize={9} height={13} style={{ color: '#fff', textAlign: 'center' }}>About</Text>
      </View>
    </View>
  );
}

render(<App />);
