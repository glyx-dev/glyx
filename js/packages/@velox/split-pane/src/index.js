// @velox/split-pane — resizable two-pane layout with a draggable divider.
//
//   import { SplitPane } from '@velox/split-pane';
//   <SplitPane direction="horizontal" defaultSizes={[30,70]} width={W} height={H}>
//     <Sidebar /> <Editor />
//   </SplitPane>

import React from 'react';
import { View, useDraggable } from '@velox/react';

const { useState, useCallback } = React;

export function SplitPane({
  direction = 'horizontal',
  defaultSizes = [40, 60],
  minSizes = [80, 80],
  dividerSize = 6,
  dividerColor = '#2A2A3A',
  dividerActiveColor = '#00A878',
  children,
  width,
  height,
}) {
  const horizontal = direction === 'horizontal';
  const total = horizontal ? width : height;
  const [split, setSplit] = useState((defaultSizes[0] / 100) * total);
  const [dragging, setDragging] = useState(false);

  const onDivider = useDraggable({
    onDragStart: () => setDragging(true),
    onDragEnd:   () => setDragging(false),
    onDragMove: ({ dx, dy }) => {
      const delta = horizontal ? dx : dy;
      setSplit((prev) => Math.max(minSizes[0], Math.min(total - minSizes[1] - dividerSize, prev + delta)));
    },
  });

  const size1 = split;
  const size2 = total - split - dividerSize;
  const [a, b] = React.Children.toArray(children);

  return React.createElement(
    View,
    { width, height, style: { flexDirection: horizontal ? 'row' : 'column' } },
    React.createElement(View, {
      key: 'p1',
      width:  horizontal ? size1 : width,
      height: horizontal ? height : size1,
      style: { overflow: 'hidden' },
    }, a),
    React.createElement(View, {
      key: 'div',
      _veloxOnMount: onDivider,
      width:  horizontal ? dividerSize : width,
      height: horizontal ? height : dividerSize,
      pressable: true,
      style: {
        backgroundColor: dragging ? dividerActiveColor : dividerColor,
        cursor: horizontal ? 'col-resize' : 'row-resize',
      },
    }),
    React.createElement(View, {
      key: 'p2',
      width:  horizontal ? size2 : width,
      height: horizontal ? height : size2,
      style: { overflow: 'hidden' },
    }, b),
  );
}
