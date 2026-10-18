// A table big enough to show what large views cost: 30 columns x 5000 rows of short strings.
// DataTable virtualizes rows but renders every column of each visible row, so about
// (visible rows + overscan) x 30 cells are alive at once.
import React from 'react';
import { View, render } from '@glyx-dev/react';
import { DataTable } from '@glyx-dev/table';

const COLS = 30;
const ROWS = 5000;

const columns = Array.from({ length: COLS }, (_, c) => ({ key: 'c' + c, label: 'Col ' + c, width: 90 }));

const rows = Array.from({ length: ROWS }, (_, r) => {
  const row = { id: r };
  for (let c = 0; c < COLS; c++) {
    row['c' + c] =
      c % 4 === 0 ? 'Item ' + r * 7 :
      c % 4 === 1 ? ((r * 1.37) % 1000).toFixed(2) :
      c % 4 === 2 ? ['Open', 'Closed', 'Pending'][r % 3] :
      'user' + r + '@x.com';
  }
  return row;
});

function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#12121a', padding: 10 }}>
      <DataTable columns={columns} rows={rows} rowHeight={28} width={1260} height={760} />
    </View>
  );
}

render(<App />);
