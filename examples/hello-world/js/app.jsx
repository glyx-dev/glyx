// Week 11 milestone — React renders through the full Velox pipeline.
//
// Data flow:
//   JSX → React reconciler → HostConfig → __velox_createNode / __velox_appendChild
//       → SceneCommand queue → Taffy layout → Vello render

import './polyfills.js';          // must be first — sets up V8 globals
import React from 'react';
import { View, Text, render } from '@velox/react';

render(
  <View width={360} height={180}>
    <Text fontSize={20} width={200} height={28}>Hello Velox</Text>
  </View>
);

__velox_log('Week 11: React rendered through Velox pipeline.');
