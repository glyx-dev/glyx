//! The `console` object for both engines: every method formats its
//! arguments and calls `__glyx_log`, which logs natively and publishes to
//! [`crate::log_bus`] (so GDP's Console domain sees it). The level is
//! encoded as a `[warn] ` / `[error] ` / `[debug] ` prefix, parsed by
//! `log_bus::split_level`.
//!
//! One definition, used by the V8 snapshot bootstrap, the plain V8 runtime
//! and QuickJS. (V8's own built-in `console` prints nowhere unless an
//! inspector is attached, so it must be replaced.)

macro_rules! console_polyfill {
    () => { r#"
(function() {
    function _fmt(args) {
        return Array.prototype.map.call(args, function(x) {
            return typeof x === 'object' ? JSON.stringify(x) : String(x);
        }).join(' ');
    }
    function _table(data) {
        if (data == null || typeof data !== 'object') { __glyx_log(String(data)); return; }
        var rows = Array.isArray(data) ? data.map(function(v, i) { return [String(i), v]; })
                                        : Object.keys(data).map(function(k) { return [k, data[k]]; });
        var cols = [];
        rows.forEach(function(r) {
            var v = r[1];
            if (v != null && typeof v === 'object') {
                Object.keys(v).forEach(function(k) { if (cols.indexOf(k) === -1) cols.push(k); });
            } else if (cols.indexOf('Values') === -1) {
                cols.push('Values');
            }
        });
        var headers = ['(index)'].concat(cols);
        var lines = rows.map(function(r) {
            var v = r[1];
            var cells = cols.map(function(c) {
                if (v != null && typeof v === 'object') {
                    return c in v ? String(v[c]) : '';
                }
                return c === 'Values' ? String(v) : '';
            });
            return [r[0]].concat(cells);
        });
        var widths = headers.map(function(h, i) {
            return Math.max(h.length, lines.reduce(function(m, l) { return Math.max(m, l[i].length); }, 0));
        });
        var pad = function(s, w) { return s + Array(w - s.length + 1).join(' '); };
        var sep = '+-' + widths.map(function(w) { return Array(w + 1).join('-'); }).join('-+-') + '-+';
        var fmtRow = function(cells) { return '| ' + cells.map(function(c, i) { return pad(c, widths[i]); }).join(' | ') + ' |'; };
        var out = [sep, fmtRow(headers), sep].concat(lines.map(fmtRow)).concat([sep]);
        __glyx_log(out.join('\n'));
    }
    globalThis.console = {
        log:   function() { __glyx_log(_fmt(arguments)); },
        info:  function() { __glyx_log(_fmt(arguments)); },
        warn:  function() { __glyx_log('[warn] ' + _fmt(arguments)); },
        error: function() { __glyx_log('[error] ' + _fmt(arguments)); },
        debug: function() { __glyx_log('[debug] ' + _fmt(arguments)); },
        table: function(data) { _table(data); },
    };
})();
"# };
}
#[cfg(feature = "v8")] // only the V8 snapshot bootstrap splices it in
pub(crate) use console_polyfill;

pub const CONSOLE_POLYFILL: &str = console_polyfill!();

#[cfg(test)]
mod tests {
    #[test]
    fn every_level_routes_to_glyx_log_with_its_prefix() {
        let js = super::CONSOLE_POLYFILL;
        for needle in ["log:", "info:", "table:", "'[warn] '", "'[error] '", "'[debug] '", "globalThis.console"] {
            assert!(js.contains(needle), "{needle}");
        }
    }
}
