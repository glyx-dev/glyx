import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, render, useWindowSize, system, battery,
} from '@glyx-dev/react';
import {
  ThemeProvider, Card, Stat, Tabs, ProgressBar, KVRow, Badge, Spinner, useTheme,
} from '@glyx-dev/design';
import { Icon } from '@glyx-dev/icons';
import { LineChart, AreaChart, BarChart, PieChart, DEFAULT_PALETTE } from '@glyx-dev/charts';
import { DataTable } from '@glyx-dev/table';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function genSeries(n, base, amp, seed) {
  const out = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    out.push({ x: MONTHS[i % 12], y: Math.round(base + amp * r) });
  }
  return out;
}

function genTable() {
  const names = ['Spring', 'Summer', 'Referral', 'Retarget', 'Newsletter', 'Search', 'Social', 'Affiliate', 'Video', 'Display'];
  const channels = ['Email', 'Paid', 'Organic', 'Social'];
  return Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    name: names[i % names.length] + ' ' + channels[i % channels.length] + ' ' + (Math.floor(i / names.length) + 1),
    spend: 200 + ((i * 137) % 900),
    roas: +(1.5 + ((i * 0.37) % 3)).toFixed(2),
    conv: 2 + (i % 6),
  }));
}

function LivePanel() {
  const C = useTheme().colors;
  const [info, setInfo] = useState(null);
  const [mem, setMem] = useState(null);
  const [bat, setBat] = useState(null);
  useEffect(() => {
    let alive = true;
    // One-shot: CPU name/cores and OS never change — read once.
    system.getInfo().then((i) => alive && setInfo(i)).catch(() => {});
    battery.getStatus().then((b) => alive && setBat(b)).catch(() => {});
    // Subscriptions: Rust polls, JS wakes ONLY when a value changes.
    const memId = system.watch('memory',  (m) => setMem(m), { intervalMs: 5000 });
    const batId = system.watch('battery', (b) => setBat(b), { intervalMs: 10000 });
    return () => { alive = false; system.unwatch(memId); system.unwatch(batId); };
  }, []);
  return (
    <Card style={{ padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 10 }}>Live system</Text>
      {info ? (
        <View style={{ gap: 6 }}>
          <KVRow label="CPU" value={info.cpuName || '—'} />
          <KVRow label="Cores" value={String(info.cpuCores)} />
          <KVRow label="Memory" value={`${(mem ? mem.usedMb : info.memoryUsedMb)} / ${(mem ? mem.totalMb : info.memoryTotalMb)} MB`} />
          <KVRow label="OS" value={`${info.osName} ${info.osVersion}`} />
        </View>
      ) : <Text style={{ color: C.textMuted }}>Reading system info…</Text>}
      <View style={{ marginTop: 12 }}>
        {bat ? (
          <View style={{ gap: 6 }}>
            <KVRow label="Battery" value={`${Math.round(bat.level * 100)}%`} />
            <ProgressBar value={Math.round(bat.level * 100)} max={100} color={bat.charging ? C.success : C.primary} />
            <Badge label={bat.charging ? 'Charging' : 'On battery'} variant={bat.charging ? 'success' : 'default'} />
          </View>
        ) : <Text style={{ color: C.textMuted }}>Battery info unavailable</Text>}
      </View>
    </Card>
  );
}

function Dashboard() {
  const C = useTheme().colors;
  const { width } = useWindowSize();
  const [tab, setTab] = useState('overview');
  const cols = width >= 1000 ? 2 : 1;
  const cardW = Math.floor((width - 48 - (cols - 1) * 16) / cols);
  const chartW = cardW - 32;
  // Stat cards go 4-across on wide windows, 2-across otherwise.
  const statCols = width >= 1000 ? 4 : 2;
  const statW = Math.floor((width - 48 - (statCols - 1) * 16) / statCols);

  const revenue = useMemo(() => genSeries(12, 1800, 1400, 7), []);
  const signups = useMemo(() => genSeries(12, 400, 300, 19), []);
  const channels = useMemo(() => ([
    { x: 'Email', y: 4200 }, { x: 'Paid', y: 3100 }, { x: 'Organic', y: 2700 }, { x: 'Social', y: 1900 },
  ]), []);
  const devices = useMemo(() => ([
    { x: 'Desktop', y: 58 }, { x: 'Mobile', y: 33 }, { x: 'Tablet', y: 9 },
  ]), []);
  const rows = useMemo(() => genTable(), []);

  const columns = [
    { key: 'name', label: 'Campaign', sortable: true },
    { key: 'spend', label: 'Spend', align: 'right', sortable: true },
    { key: 'roas', label: 'ROAS', align: 'right', sortable: true, render: (v) => <Text style={{ color: v >= 3 ? C.success : C.text }}>{Number(v).toFixed(2)}x</Text> },
    { key: 'conv', label: 'Conv %', align: 'right', sortable: true },
  ];

  return (
    <View style={{ flex: 1, width: width || undefined, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>Analytics</Text>
        <Tabs items={[{ key: 'overview', label: 'Overview' }, { key: 'table', label: 'Campaigns' }]} value={tab} onChange={setTab} />
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }} width={width}>
        {tab === 'overview' ? (
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <Stat style={{ width: statW }} value="$4.2k" label="Revenue" change="+12%" />
              <Stat style={{ width: statW }} value="1,284" label="Users" change="+5%" />
              <Stat style={{ width: statW }} value="3.4%" label="Conversion" change="-0.4%" positive={false} />
              <Stat style={{ width: statW }} value="87" label="Sessions" change="+9%" />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
              <Card style={{ width: cardW, padding: 16 }}>
                <Text style={{ color: C.textMuted, marginBottom: 8 }}>Revenue trend</Text>
                <LineChart data={revenue} width={chartW} height={240} color="#4090F0" showDots={false} />
              </Card>
              <Card style={{ width: cardW, padding: 16 }}>
                <Text style={{ color: C.textMuted, marginBottom: 8 }}>Traffic by channel</Text>
                <BarChart data={channels} width={chartW} height={240} />
              </Card>
              <Card style={{ width: cardW, padding: 16 }}>
                <Text style={{ color: C.textMuted, marginBottom: 8 }}>Device split</Text>
                <PieChart data={devices} width={Math.min(chartW, 260)} height={260} innerRadius={0.5} />
              </Card>
              <Card style={{ width: cardW, padding: 16 }}>
                <Text style={{ color: C.textMuted, marginBottom: 8 }}>Signups</Text>
                <AreaChart data={signups} width={chartW} height={240} color="#00A878" />
              </Card>
            </View>

            <View style={{ marginTop: 16 }}>
              <LivePanel />
            </View>
          </View>
        ) : (
          <Card style={{ padding: 16 }}>
            <Text style={{ color: C.textMuted, marginBottom: 8 }}>Campaigns</Text>
            <DataTable columns={columns} rows={rows} width={width - 64} height={520} rowHeight={40} onRowPress={() => {}} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Root() {
  return (
    <ThemeProvider colorScheme="system">
      <Dashboard />
    </ThemeProvider>
  );
}

render(<Root />);
