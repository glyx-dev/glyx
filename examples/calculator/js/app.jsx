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
  onLight:     '#1e1e2e',  // dark label for pastel/light backgrounds
};

// Pastel Catppuccin colors are light — pairing them with light text kills contrast.
// Any button using one of these backgrounds gets the dark label instead.
const LIGHT_BG = new Set([C.accent, C.green, C.red, C.yellow, C.mauve, C.teal]);

// ── Calculator state machine ──────────────────────────────────────────────────

function calc(state, key) {
  if (key === 'C') {
    return { disp: '0', prev: null, op: null, wait: false, expr: '' };
  }

  if (key === '←') {
    const d = state.disp;
    const next = d.length > 1 ? d.slice(0, -1) : '0';
    return { ...state, disp: next, lastResult: undefined };
  }

  if (key >= '0' && key <= '9') {
    if (state.wait) {
      return { ...state, disp: key, wait: false, lastResult: undefined };
    }
    const d = state.disp === '0' ? key : state.disp + key;
    return { ...state, disp: d, lastResult: undefined };
  }

  if (key === '.') {
    if (state.wait) {
      return { ...state, disp: '0.', wait: false, lastResult: undefined };
    }
    if (state.disp.includes('.')) return state;
    return { ...state, disp: state.disp + '.', lastResult: undefined };
  }

  // Operator [+, −, ×, ÷]
  if (['+', '−', '×', '÷'].includes(key)) {
    if (state.op && !state.wait) {
      const result = compute(state.prev, state.disp, state.op);
      return { disp: String(result), prev: result, op: key, wait: true, expr: state.prev + ' ' + state.op + ' ' + state.disp + ' ' + key };
    }
    return { ...state, prev: state.disp, op: key, wait: true, lastResult: undefined, expr: state.disp + ' ' + key + ' ' };
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
        const fullExpr = ((s.expr || '') + s.disp).trim() + ' = ' + next.disp;
        setHistory(h => [...h, fullExpr].slice(-50)); // keep last 50
      }
      return next;
    });
  }, []);

  const pad = 8;
  const titleH = 32;
  const btnH = gridMode ? (winH - 200) / 7 : (winH - 156) / 5;
  const dispH = 60;
  const gridW    = winW - 2 * pad;
  const gridBtnW = Math.floor((gridW - 3 * 4) / 4); // 4 cols, 3 gaps of 4px

  const btnStyle = (color) => ({
    backgroundColor: color,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2 4 #00000044',
  });

  const Btn = ({ label, color = C.surfaceAlt, span = 1, disabled = false, gridColumn, gridRow }) => {
    const isLongLabel = label.length > 1;
    const fontSize = isLongLabel ? 14 : 20;
    const textHeight = isLongLabel ? 20 : 28;
    const labelColor = LIGHT_BG.has(color) ? C.onLight : C.text;
    return (
      <Pressable
        disabled={disabled}
        onPress={() => press(label)}
        flex={gridMode ? undefined : span}
        width={gridMode ? gridBtnW : undefined}
        gridColumn={gridColumn}
        gridRow={gridRow}
        height={btnH}
        style={{ ...btnStyle(color), opacity: disabled ? 0 : 1 }}
      >
        <Text fontSize={fontSize} height={textHeight} style={{ color: labelColor, textAlign: 'center' }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        position: 'relative',
        backgroundColor: C.bg,
        boxSizing: 'border-box',
      }}
      width={winW}
      height={winH}
    >
      {/* Content column */}
      <View
        style={{
          padding: pad,
          gap: 4,
          justifyContent: 'flex-start',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
        width="100%"
        height="100%"
      >
        {/* Custom titlebar — draggable (frameless window) */}
        <View
          veloxDraggable
          style={{
            backgroundColor: C.surfaceAlt,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 12,
            boxSizing: 'border-box',
          }}
          width="100%"
          height={titleH}
        >
          <Text fontSize={12} width={120} height={16} style={{ color: C.subtle }}>Calculator</Text>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', gap: 4, paddingRight: 4 }}>
            <Pressable onPress={() => setShowHistory(s => !s)} width={24} height={24} style={{ backgroundColor: showHistory ? C.green : C.overlay, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
              <Text fontSize={10} height={12} style={{ color: C.onLight }}>H</Text>
            </Pressable>
            <Pressable onPress={() => setGridMode(m => !m)} width={36} height={24} style={{ backgroundColor: C.mauve, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
              <Text fontSize={10} height={12} style={{ color: C.onLight }}>{gridMode ? 'Std' : 'Sci'}</Text>
            </Pressable>
            <Pressable onPress={() => __velox_quit()}             width={24} height={24} style={{ backgroundColor: C.red, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text fontSize={10} height={12} style={{ color: C.onLight }}>×</Text>
            </Pressable>
          </View>
        </View>

        {/* Display */}
        <View
          backgroundGradient="#1e1e2e #313244"
          style={{
            borderRadius: 12,
            padding: 12,
            justifyContent: 'center',
            alignItems: 'flex-end',
            overflow: 'hidden',
          }}
          width="90%"
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
          width="90%"
          height={20}
        >
          <Text fontSize={11} height={16} style={{ color: C.dim }}>
            {state.expr}
          </Text>
        </View>

        {gridMode ? (
          <View
            display="grid"
            gridTemplateColumns="1fr 1fr 1fr 1fr"
            gridTemplateRows="repeat(7, 1fr)"
            width={gridW}
            style={{ gap: 4, flexGrow: 1, boxSizing: 'border-box' }}
          >
            <Btn label="sin" gridColumn="1" gridRow="1" color={C.teal} />
            <Btn label="cos" gridColumn="2" gridRow="1" color={C.teal} />
            <Btn label="tan" gridColumn="3" gridRow="1" color={C.teal} />
            <Btn label="log" gridColumn="4" gridRow="1" color={C.teal} />
            <Btn label="ln"  gridColumn="1" gridRow="2" color={C.teal} />
            <Btn label="√"   gridColumn="2" gridRow="2" color={C.teal} />
            <Btn label="xⁿ"  gridColumn="3" gridRow="2" color={C.teal} />
            <Btn label="("   gridColumn="4" gridRow="2" color={C.overlay} />
            <Btn label="C"   gridColumn="1" gridRow="3" color={C.red} disabled={state.disp === '0' && !state.op && !state.expr} />
            <Btn label="←"   gridColumn="2" gridRow="3" color={C.overlay} />
            <Btn label="%"   gridColumn="3" gridRow="3" color={C.overlay} />
            <Btn label="÷"   gridColumn="4" gridRow="3" color={C.mauve} />
            <Btn label="7"   gridColumn="1" gridRow="4" />
            <Btn label="8"   gridColumn="2" gridRow="4" />
            <Btn label="9"   gridColumn="3" gridRow="4" />
            <Btn label="×"   gridColumn="4" gridRow="4" color={C.mauve} />
            <Btn label="4"   gridColumn="1" gridRow="5" />
            <Btn label="5"   gridColumn="2" gridRow="5" />
            <Btn label="6"   gridColumn="3" gridRow="5" />
            <Btn label="−"   gridColumn="4" gridRow="5" color={C.mauve} />
            <Btn label="1"   gridColumn="1" gridRow="6" />
            <Btn label="2"   gridColumn="2" gridRow="6" />
            <Btn label="3"   gridColumn="3" gridRow="6" />
            <Btn label="+"   gridColumn="4" gridRow="6" color={C.mauve} />
            <Btn label="0"   gridColumn="1 / 3" gridRow="7" span={2} />
            <Btn label="."   gridColumn="3" gridRow="7" />
            <Btn label="="   gridColumn="4" gridRow="7" color={C.accent} />
          </View>
        ) : (
          <View style={{ flexGrow: 1, gap: 4 }} width="90%">
            <View style={{ flexDirection: 'row', gap: 4 }} width="100%" height={btnH}>
              <Btn label="C" color={C.red} disabled={state.disp === '0' && !state.op && !state.expr} />
              <Btn label="←" color={C.overlay} />
              <Btn label="%" color={C.overlay} />
              <Btn label="÷" color={C.mauve} />
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }} width="100%" height={btnH}>
              <Btn label="7" />
              <Btn label="8" />
              <Btn label="9" />
              <Btn label="×" color={C.mauve} />
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }} width="100%" height={btnH}>
              <Btn label="4" />
              <Btn label="5" />
              <Btn label="6" />
              <Btn label="−" color={C.mauve} />
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }} width="100%" height={btnH}>
              <Btn label="1" />
              <Btn label="2" />
              <Btn label="3" />
              <Btn label="+" color={C.mauve} />
            </View>
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }} width="100%" height={btnH}>
              <Btn label="0" span={2} />
              <Btn label="." />
              <Btn label="=" color={C.accent} />
            </View>
          </View>
        )}

        {/* Scrollable history panel — rendered after button grid so its nodes
            have higher solidRegistry indices and win hit-tests over buttons. */}
        {showHistory && (
          <View
            position="absolute"
            top={titleH + 8} right={pad}
            width={200}
            height={280}
            zIndex={10}
            style={{
              backgroundColor: C.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.overlay,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 10, paddingRight: 10 }}
              height={30} width={200}
            >
              <Text fontSize={11} height={14} style={{ color: C.subtle }}>History</Text>
              <Text fontSize={10} height={14} style={{ color: C.dim }}>{history.length + ' entries'}</Text>
            </View>

            {history.length === 0 ? (
              <View style={{ justifyContent: 'center', alignItems: 'center' }} height={250} width={200}>
                <Text fontSize={11} height={16} style={{ color: C.dim }}>No history yet</Text>
              </View>
            ) : (
              <ScrollView
                width={200}
                height={250}
                contentHeight={history.length * 36 + 6}
                showScrollbar={history.length * 36 + 6 > 250}
                scrollbarWidth={3}
                scrollbarColor={C.overlay}
              >
                {/* Wrapper with explicit height + flex-start overrides Velox's
                    default justifyContent:center so pills stack from the top. */}
                <View
                  width={200}
                  height={history.length * 36 + 6}
                  style={{ justifyContent: 'flex-start', gap: 6, paddingTop: 6, paddingBottom: 6, boxSizing: 'border-box' }}
                >
                  {history.map((entry, i) => {
                    const eqIdx  = entry.lastIndexOf(' = ');
                    const expr   = eqIdx >= 0 ? entry.slice(0, eqIdx) : entry;
                    const result = eqIdx >= 0 ? entry.slice(eqIdx + 3) : entry;
                    return (
                      <View key={i} width={184} height={30} style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: C.surfaceAlt,
                        borderRadius: 8,
                        paddingLeft: 10,
                        paddingRight: 10,
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}>
                        <Text fontSize={11} height={15} width={100} style={{ color: C.dim }}>{expr}</Text>
                        <Text fontSize={12} height={15} width={64} style={{ color: C.accent, textAlign: 'right' }}>{'= ' + result}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* ── Result modal ── */}
      {state.lastResult !== undefined && (
        <View
          position="absolute"
          top={0}
          left={0}
          width={winW}
          height={winH}
          style={{
            backgroundColor: '#00000088',
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: C.surface,
              borderRadius: 16,
              padding: 24,
              alignItems: 'center',
              boxShadow: '0 4 12 #00000066',
              marginTop: Math.round((winH - 158) / 2),
            }}
          >
            <Text fontSize={12} height={16} style={{ color: C.subtle }}>Result</Text>
            <Text fontSize={40} height={48} style={{ color: C.text }}>
              {state.lastResult}
            </Text>
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
        </View>
      )}
    </View>
  );
}

render(<App />);
