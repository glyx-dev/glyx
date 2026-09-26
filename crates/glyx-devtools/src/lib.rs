//! Glyx DevTools Protocol (GDP).
//!
//! A native, engine-neutral devtools protocol: the same channel serves the
//! Inspector UI, the `glyx inspect` CLI and AI automation, on V8 and QuickJS
//! alike (CDP stays available separately for V8 debugging).
//!
//! This crate is only the protocol and the transport. The domains
//! (`Runtime`, `Console`, ...) are implemented in `glyx-core`, where the
//! window state lives; it depends on this crate, never the other way round.

pub mod protocol;
pub mod transport;
pub mod relay;

pub use protocol::{codes, ErrorBody, Handshake, Request, WindowInfo, DEFAULT_PORT, PROTOCOL_VERSION};
pub use transport::{new_token, origin_allowed, ConnId, DevtoolsServer, Incoming};
pub use relay::{AppInfo, Assets, Relay, RelayConfig};
