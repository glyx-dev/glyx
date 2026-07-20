import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, render, useWindowSize, fs, dialog,
} from '@glyx-dev/react';
import {
  ThemeProvider, Card, Badge, IconButton, useTheme,
} from '@glyx-dev/design';
import { Icon } from '@glyx-dev/icons';
import { LineChart, AreaChart, BarChart, PieChart } from '@glyx-dev/charts';

// ── Palette (matches the glyx-design-kit dashboard template) ──────────────────

const COLORS = {
  sky:     '#38bdf8',
  emerald: '#34d399',
  indigo:  '#818cf8',
  amber:   '#fbbf24',
  rose:    '#fb7185',
};

function fmtTime(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Manual thousands separator — avoids toLocaleString() (ICU locale data is trimmed
// in the JS-only runner, where Number.toLocaleString throws).
function fmtNum(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const INITIAL_POINTS = 20;

function genInitial() {
  const now = Date.now();
  const out = [];
  for (let i = INITIAL_POINTS; i >= 0; i--) {
    const t = new Date(now - i * 2000);
    out.push({
      timestamp: fmtTime(t),
      revenue: Math.floor(Math.random() * 500) + 1000,
      users:    Math.floor(Math.random() * 50) + 100,
      errors:   Math.floor(Math.random() * 5),
    });
  }
  return out;
}

// ── Real-time data (mirrors the template's useRealtimeData hook) ──────────────

function useRealtimeData() {
  const [timeseries, setTimeseries] = useState(genInitial);
  const [deviceData, setDeviceData] = useState([
    { x: 'Desktop', y: 45 },
    { x: 'Mobile',  y: 40 },
    { x: 'Tablet',  y: 15 },
  ]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setTimeseries((prev) => {
        const last = prev[prev.length - 1];
        const newUsers    = Math.max(50,  Math.min(300,  last.users    + (Math.random() * 20 - 10)));
        const newRevenue  = Math.max(500, Math.min(3000, last.revenue  + (Math.random() * 200 - 100)));
        const newErrors   = Math.max(0,   Math.min(20,   last.errors   + (Math.random() * 4 - 2)));
        const next = [...prev.slice(1)];
        next.push({
          timestamp: fmtTime(new Date()),
          revenue:   Math.round(newRevenue),
          users:     Math.round(newUsers),
          errors:    Math.round(newErrors),
        });
        return next;
      });
      setDeviceData((prev) => prev.map((d) => ({ ...d, y: Math.max(1, d.y + (Math.random() * 2 - 1)) })));
    }, 3000);
    return () => clearInterval(id);
  }, [isPaused]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);
  return { timeseries, deviceData, isPaused, togglePause };
}

const INITIAL_WIDGETS = [
  { id: 'rev',     title: 'Revenue Overview',    type: 'area', dataKey: 'revenue', visible: true },
  { id: 'users',   title: 'Active Users',        type: 'line', dataKey: 'users',    visible: true },
  { id: 'devices', title: 'Device Distribution', type: 'pie',  dataKey: 'value',    visible: true },
  { id: 'errors',  title: 'Error Rate',          type: 'bar',  dataKey: 'errors',   visible: true },
];

function buildCSV(data) {
  if (!data || !data.length) return '';
  const headers = Object.keys(data[0]);
  return [
    headers.join(','),
    ...data.map((row) => headers.map((h) => JSON.stringify(row[h])).join(',')),
  ].join('\n');
}

async function exportToCSV(filename, data) {
  try {
    const path = await dialog.saveFile({
      defaultName: `${filename}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (!path) return;
    await fs.writeFile(path, buildCSV(data));
  } catch (e) {
    // export cancelled or capability unavailable — ignore
  }
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ title, value, change, color, width }) {
  const C = useTheme().colors;
  const positive = change >= 0;
  return (
    <Card style={{ padding: 16, width }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text fontSize={13} style={{ color: C.textMuted }}>{title}</Text>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text fontSize={22} style={{ color: C.text, fontWeight: '700' }}>{value}</Text>
        <Text fontSize={12} style={{ color: positive ? C.success : C.error, fontWeight: '700' }}>
          {positive ? '+' : ''}{change}%
        </Text>
      </View>
    </Card>
  );
}

// Header text button with a stable width + centered label, so "Pause" and "Resume"
// stay visually consistent (the design Button's label can drift off-center).
function ActionButton({ label, onPress, variant = 'secondary', minWidth = 96 }) {
  const C = useTheme().colors;
  const bg = variant === 'primary' ? C.primary : C.surfaceRaised;
  const fg = variant === 'primary' ? C.primaryText : C.text;
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: bg,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text fontSize={14} style={{ color: fg, fontWeight: '600', textAlign: 'center', width: '100%' }}>{label}</Text>
    </Pressable>
  );
}

// ── Chart widget ───────────────────────────────────────────────────────────────

function ChartWidget({ config, timeseries, deviceData, width }) {
  const C = useTheme().colors;
  const h = 260;
  // Card already applies 16px padding on each side; leave a little extra right
  // breathing room so the last axis labels aren't clipped.
  const cw = Math.max(80, width - 36);
  const [selected, setSelected] = useState(null);
  let chart = null;

  // Real click-to-select: every chart type reports the raw data point it was
  // built from (not just x/y pixel coords), so apps can drive selection,
  // drill-down, etc. straight off onPointPress.
  const onPointPress = (point) => setSelected(point);

  if (config.type === 'area') {
    chart = (
      <AreaChart
        data={timeseries.map((d) => ({ x: d.timestamp, y: d[config.dataKey] }))}
        width={cw} height={h} color={COLORS.sky}
        onPointPress={onPointPress} zoomPan
      />
    );
  } else if (config.type === 'line') {
    chart = (
      <LineChart
        data={timeseries.map((d) => ({ x: d.timestamp, y: d[config.dataKey] }))}
        width={cw} height={h} color={COLORS.emerald} showDots={false}
        onPointPress={onPointPress}
      />
    );
  } else if (config.type === 'bar') {
    chart = (
      <BarChart
        data={timeseries.map((d) => ({ x: d.timestamp, y: d[config.dataKey] }))}
        width={cw} height={h} color={COLORS.indigo}
        onPointPress={onPointPress}
      />
    );
  } else if (config.type === 'pie') {
    // Legend adds its own row below the donut — give it real room within the
    // widget's fixed height budget instead of letting it overflow the card.
    chart = (
      <PieChart
        data={deviceData} width={cw} height={h - 36} innerRadius={0.5}
        onPointPress={onPointPress} showLegend
      />
    );
  }

  return (
    <Card style={{ padding: 16, width }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text fontSize={14} style={{ color: C.text, fontWeight: '600' }}>{config.title}</Text>
        {selected ? (
          <Text fontSize={12} style={{ color: C.textMuted }}>
            {String(selected.x)}: {fmtNum(selected[config.dataKey] ?? selected.y)}
          </Text>
        ) : null}
      </View>
      <View style={{ height: h }}>{chart}</View>
      {config.type === 'area' ? (
        <Text fontSize={11} style={{ color: C.textMuted, marginTop: 6 }}>
          Drag to pan, use +/−/⟲ to zoom · click a point to select it
        </Text>
      ) : null}
    </Card>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────────

function Dashboard({ scheme, onToggleTheme }) {
  const C = useTheme().colors;
  const { width } = useWindowSize();
  const { timeseries, deviceData, isPaused, togglePause } = useRealtimeData();
  const [widgets, setWidgets] = useState(INITIAL_WIDGETS);
  const [showSettings, setShowSettings] = useState(false);

  const toggleWidget = (id) =>
    setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));

  const latest = timeseries[timeseries.length - 1] || { revenue: 0, users: 0, errors: 0 };
  const prev   = timeseries[timeseries.length - 2] || { revenue: 0, users: 0, errors: 0 };
  const pct = (cur, p) => (p ? Math.round(((cur - p) / p) * 100) : 0);

  const handleExport = () => exportToCSV('analytics-report', timeseries);

  const pad = 16;
  const statCols = width >= 1000 ? 4 : 2;
  const statGap = 12;
  const statW = Math.floor((width - pad * 2 - (statCols - 1) * statGap) / statCols);

  const chartCols = width >= 1000 ? 2 : 1;
  const chartGap = 12;
  const chartW = Math.floor((width - pad * 2 - (chartCols - 1) * chartGap) / chartCols);

  const visible = widgets.filter((w) => w.visible);

  return (
    <View style={{ flex: 1, width: width || undefined, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: pad, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.sky, alignItems: 'center', justifyContent: 'center' }}>
            <Text fontSize={15} style={{ color: '#fff', fontWeight: '700' }}>N</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text fontSize={18} style={{ color: C.text, fontWeight: '700' }}>Nexus Analytics</Text>
            <Badge label="Real-Time" variant="success" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActionButton label={isPaused ? 'Resume' : 'Pause'} onPress={togglePause} />
          <IconButton icon="settings" variant="ghost" label="Customize widgets" onPress={() => setShowSettings((s) => !s)} />
          <ActionButton label="Export CSV" onPress={handleExport} variant="primary" minWidth={112} />
          <IconButton
            icon={scheme === 'dark' ? 'sun' : 'moon'}
            variant="ghost"
            label="Toggle theme"
            onPress={onToggleTheme}
          />
        </View>
      </View>

      {/* Widget settings popover */}
      {showSettings && (
        <Card style={{ position: 'absolute', top: 64, right: pad, width: 240, zIndex: 50, padding: 12 }}>
          <Text fontSize={13} style={{ color: C.text, fontWeight: '600', marginBottom: 8 }}>Customize Layout</Text>
          {widgets.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => toggleWidget(w.id)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}
            >
              <Text fontSize={13} style={{ color: C.textMuted }}>{w.title}</Text>
              <View style={{
                width: 18, height: 18, borderRadius: 4,
                backgroundColor: w.visible ? C.primary : C.surfaceRaised,
                borderWidth: 1, borderColor: C.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {w.visible ? <Icon name="check" size={12} color={C.primaryText} /> : null}
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      <ScrollView style={{ flex: 1, padding: pad }} width={width}>
        {/* Stat cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: statGap, marginBottom: statGap }}>
          <StatCard title="Total Revenue"  value={`$${fmtNum(latest.revenue)}`} change={pct(latest.revenue, prev.revenue)} color={COLORS.sky}  width={statW} />
          <StatCard title="Active Users"   value={fmtNum(latest.users)}               change={pct(latest.users, prev.users)}       color={COLORS.emerald} width={statW} />
          <StatCard title="System Errors"  value={latest.errors}                                 change={-pct(latest.errors, prev.errors)}    color={COLORS.rose} width={statW} />
          <StatCard title="Avg Session"    value="4m 12s"                                        change={2.4}                                 color={COLORS.amber} width={statW} />
        </View>

        {/* Widget grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: chartGap }}>
          {visible.map((w) => {
            const span2 = w.type === 'area';
            const ww = span2 ? chartW * 2 + chartGap : chartW;
            return (
              <View key={w.id} style={{ width: ww }}>
                <ChartWidget config={w} timeseries={timeseries} deviceData={deviceData} width={ww} />
              </View>
            );
          })}
        </View>

        {/* Empty state */}
        {visible.length === 0 && (
          <Card style={{ padding: 32, alignItems: 'center', marginTop: statGap }}>
            <Icon name="settings" size={32} color={C.textMuted} />
            <Text fontSize={16} style={{ color: C.text, marginTop: 8 }}>No widgets visible</Text>
            <Text fontSize={13} style={{ color: C.textMuted, marginTop: 4 }}>Use the settings menu to add widgets to your dashboard.</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

// ── Root (lifts color scheme so the theme toggle is runtime-switchable) ─────────

function Root() {
  const [scheme, setScheme] = useState('dark');
  return (
    <ThemeProvider colorScheme={scheme}>
      <Dashboard scheme={scheme} onToggleTheme={() => setScheme((s) => (s === 'dark' ? 'light' : 'dark'))} />
    </ThemeProvider>
  );
}

render(<Root />);
