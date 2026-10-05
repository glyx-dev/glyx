// @glyx-dev/react — mDNS/Bonjour service discovery.
import { _noBinding } from './_shared.js';

// ── mDNS service discovery ────────────────────────────────────────────────────
//
// Requires `mdns: true` capability in glyx.config.json.
//
// Usage:
//   import { mdns } from '@glyx-dev/react';
//   const services = await mdns.discover('_http._tcp.local.', { timeout: 4000 });
//   // [{ name, hostname, port, addresses: string[] }, ...]

export const mdns = {
  /**
   * Browse for mDNS/Bonjour services of the given type.
   * @param {string} serviceType  e.g. "_http._tcp.local."
   * @param {{ timeout?: number }} [opts]  timeout in ms (default 5000)
   * @returns {Promise<{name:string, hostname:string, port:number, addresses:string[]}[]>}
   */
  discover(serviceType, { timeout = 5000 } = {}) {
    if (typeof __glyx_mdns_discover === 'undefined') return _noBinding('mdns.discover');
    return __glyx_mdns_discover(serviceType, timeout).then(JSON.parse);
  },
};
