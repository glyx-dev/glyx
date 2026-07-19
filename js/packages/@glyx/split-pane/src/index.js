// @glyx-dev/split-pane — resizable two-pane layout with a draggable divider.
//
//   import { SplitPane } from '@glyx-dev/split-pane';
//   <SplitPane direction="horizontal" defaultSizes={[30,70]} width={W} height={H}>
//     <Sidebar /> <Editor />
//   </SplitPane>

import React from 'react';
import { View, useDraggable, glyxWindow } from '@glyx-dev/react';

const { useState, useCallback } = React;

export function SplitPane({
  direction = 'horizontal',
  defaultSizes = [40, 60],
  minSizes = [80, 80],
  dividerSize = 8,
  dividerColor = '#2A2A3A',
  dividerHoverColor = '#3A3A4E',
  dividerActiveColor = '#00A878',
  children,
  width,
  height,
}) {
  const horizontal = direction === 'horizontal';
  const total = horizontal ? width : height;
  // Store split as a fraction (0–1) so it survives container resize.
  const [fraction, setFraction] = useState(defaultSizes[0] / 100);
  const [dragging, setDragging] = useState(false);
  // Hover state gives a "this is draggable" affordance BEFORE the user
  // commits to a drag — previously the divider only changed color once
  // already mid-drag, giving no discovery cue at rest.
  const [hovering, setHovering] = useState(false);

  const resizeCursor = horizontal ? 'col-resize' : 'row-resize';
  const onDivider = useDraggable({
    onDragStart: () => { setDragging(true); glyxWindow.setCursor(resizeCursor); },
    onDragEnd:   () => { setDragging(false); glyxWindow.setCursor('default'); },
    onDragMove: ({ dx, dy }) => {
      const delta = horizontal ? dx : dy;
      setFraction((prev) => {
        const px = Math.max(minSizes[0], Math.min(total - minSizes[1] - dividerSize, prev * total + delta));
        return px / total;
      });
    },
  });

  const size1 = Math.round(fraction * total);
  const size2 = total - size1 - dividerSize;
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
      _glyxOnMount: onDivider,
      width:  horizontal ? dividerSize : width,
      height: horizontal ? height : dividerSize,
      pressable: true,
      onHoverIn:  () => setHovering(true),
      onHoverOut: () => setHovering(false),
      style: {
        backgroundColor: dragging
          ? dividerActiveColor
          : hovering ? dividerHoverColor : dividerColor,
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
