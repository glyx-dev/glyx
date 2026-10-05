// @glyx-dev/split-pane — resizable two-pane layout with a draggable divider.
//
//   import { SplitPane } from '@glyx-dev/split-pane';
//   <SplitPane direction="horizontal" defaultSizes={[30,70]} width={W} height={H}>
//     <Sidebar />
//     {({ width, height }) => <Editor width={width} height={height} />}
//   </SplitPane>

import React from 'react';
import { View, Pressable, useDraggable, glyxWindow } from '@glyx-dev/react';

const { useState, useRef } = React;

/**
 * Divider look for its state. Pure, so it's unit-tested: a thin line at
 * rest; on hover the line thickens and brightens and a grip appears; while
 * dragging it takes the active colour.
 */
export function dividerLook({ hovering, dragging, lineColor, hoverColor, activeColor }) {
  const hot = hovering || dragging;
  return {
    lineThickness: hot ? 3 : 1,
    lineColor:     dragging ? activeColor : hovering ? hoverColor : lineColor,
    showGrip:      hot,
  };
}

export function SplitPane({
  direction = 'horizontal',
  defaultSizes = [40, 60],
  minSizes = [80, 80],
  dividerSize = 8,
  dividerColor = '#2A2A3A',
  dividerHoverColor = '#5A5F7A',
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
  const [hovering, setHovering] = useState(false);
  // Read inside handlers that outlive a render (drag end, hover out).
  const live = useRef({ hovering: false, dragging: false });

  const resizeCursor = horizontal ? 'col-resize' : 'row-resize';
  const setCursor = (c) => glyxWindow.setCursor(c);

  const onDivider = useDraggable({
    onDragStart: () => {
      live.current.dragging = true;
      setDragging(true);
      setCursor(resizeCursor);
    },
    onDragEnd: () => {
      live.current.dragging = false;
      setDragging(false);
      // Released over the divider: keep the resize cursor; elsewhere: reset.
      if (!live.current.hovering) setCursor('default');
    },
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
  // A pane may be a render function `({ width, height }) => node`, for
  // content that needs its pane's pixel size (editors, media).
  const [a, b] = (Array.isArray(children) ? children : [children]).filter((c) => c != null && c !== false);
  const pane = (c, w, h) => (typeof c === 'function' ? c({ width: w, height: h }) : c);
  const look = dividerLook({
    hovering, dragging,
    lineColor: dividerColor, hoverColor: dividerHoverColor, activeColor: dividerActiveColor,
  });
  const fade = { duration: 140, properties: ['backgroundColor', 'opacity'], easing: 'ease-out' };

  return React.createElement(
    View,
    { width, height, style: { flexDirection: horizontal ? 'row' : 'column' } },
    React.createElement(View, {
      key: 'p1',
      width:  horizontal ? size1 : width,
      height: horizontal ? height : size1,
      style: { overflow: 'hidden' },
    }, pane(a, horizontal ? size1 : width, horizontal ? height : size1)),
    // The grab area: `dividerSize` wide, transparent. A Pressable, because
    // only pressables get hover — which is what switches the cursor as soon
    // as the pointer arrives, not only once a drag starts.
    React.createElement(Pressable, {
      key: 'div',
      _glyxOnMount: onDivider,
      feedback: false,
      ariaLabel: horizontal ? 'Resize panes horizontally' : 'Resize panes vertically',
      onHoverIn: () => {
        live.current.hovering = true;
        setHovering(true);
        setCursor(resizeCursor);
      },
      onHoverOut: () => {
        live.current.hovering = false;
        setHovering(false);
        // Mid-drag the pointer often runs ahead of the divider; keep the
        // resize cursor until the drag ends.
        if (!live.current.dragging) setCursor('default');
      },
      style: {
        width:  horizontal ? dividerSize : width,
        height: horizontal ? height : dividerSize,
        alignItems: 'center', justifyContent: 'center',
      },
    },
      // The visible line, centred in the grab area.
      React.createElement(View, {
        transition: fade,
        style: {
          position: 'absolute',
          ...(horizontal
            ? { left: (dividerSize - look.lineThickness) / 2, top: 0, width: look.lineThickness, height }
            : { top: (dividerSize - look.lineThickness) / 2, left: 0, height: look.lineThickness, width }),
          borderRadius: look.lineThickness / 2,
          backgroundColor: look.lineColor,
        },
      }),
      // A small grip pill in the middle, shown on hover / drag.
      React.createElement(View, {
        transition: fade,
        style: {
          width:  horizontal ? 6 : 28,
          height: horizontal ? 28 : 6,
          borderRadius: 3,
          backgroundColor: look.lineColor,
          opacity: look.showGrip ? 1 : 0,
        },
      }),
    ),
    React.createElement(View, {
      key: 'p2',
      width:  horizontal ? size2 : width,
      height: horizontal ? height : size2,
      style: { overflow: 'hidden' },
    }, pane(b, horizontal ? size2 : width, horizontal ? height : size2)),
  );
}
