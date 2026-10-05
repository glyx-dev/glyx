// @glyx-dev/react — native desktop notifications.
import { _noBinding } from './_shared.js';

// ── Notifications ─────────────────────────────────────────────────────────────
//
// Requires `notification: true` capability in glyx.config.json.

export const notification = {
  /**
   * Send a native desktop notification. Fire-and-forget; never rejects.
   * @param {{ title: string, body?: string }} opts
   * @returns {Promise<void>}
   */
  send({ title, body = '' }) {
    if (typeof __glyx_notification_send === 'undefined') return _noBinding('notification.send');
    return __glyx_notification_send(title, body);
  },
};
