//! JSON between Rust and QuickJS, faster than QuickJS's own `JSON.parse` / `JSON.stringify`.
//!
//! QuickJS's JSON runs in its interpreter-era C code; measured on 1000 small objects, a native
//! `serde_json` parse that builds the JS values directly is about 2.2x faster, and writing the text
//! straight from the JS values is about 3.8x faster (`bench_native_json_vs_quickjs`).
//!
//! Both functions are drop-in: they give the same result as the built-in for the data they handle and
//! hand anything else to the built-in, so errors (a `SyntaxError`, a cyclic structure's `TypeError`)
//! and every unusual value (`Date`, `toJSON`, `BigInt`, class instances, ...) behave exactly as before.
//! Use them only on our own paths (arguments and results of backend commands); never replace the
//! global `JSON`.

use rquickjs::{Ctx, Object, Value};

/// Prefixes a Rust command's JSON result that `settle` should parse natively into the value it resolves with
/// (see `call_rust_command`). A control character, so no result text can begin with it by accident.
pub(crate) const PARSED_RESULT_MARKER: &str = "\u{1}glyx-parse\u{1}";

/// Deepest structure the native writer follows before leaving it to the built-in, which reports a
/// cyclic one as the `TypeError` JavaScript users know.
const MAX_DEPTH: usize = 100;

/// `JSON.parse(text)`, built natively into JS values. Text the native parser rejects goes to the
/// built-in, which throws the usual `SyntaxError`.
pub(crate) fn parse<'js>(ctx: &Ctx<'js>, text: &str) -> rquickjs::Result<Value<'js>> {
    // Two things serde_json would get subtly different from JS: a "__proto__" key (JSON.parse makes it
    // an own property; setting it natively would change the prototype) and a negative zero.
    if !text.contains("__proto__") && !text.contains("-0") {
        if let Some(v) = native_parse(ctx, text) {
            return Ok(v);
        }
    }
    ctx.json_parse(text.to_string())
}

/// `JSON.stringify(value)`: `None` where JavaScript's gives `undefined` (an undefined, a function or a
/// symbol at the top level).
pub(crate) fn stringify<'js>(ctx: &Ctx<'js>, value: Value<'js>) -> rquickjs::Result<Option<String>> {
    if value.is_undefined() || value.is_function() || value.is_symbol() {
        return Ok(None);
    }
    let Some(object_proto) = object_prototype(ctx) else {
        return builtin_stringify(ctx, value);
    };
    let mut out = String::with_capacity(256);
    if write(&value, &mut out, 0, &object_proto).is_some() {
        return Ok(Some(out));
    }
    builtin_stringify(ctx, value)
}

fn builtin_stringify<'js>(ctx: &Ctx<'js>, value: Value<'js>) -> rquickjs::Result<Option<String>> {
    match ctx.json_stringify(value)? {
        Some(s) => Ok(Some(s.to_string()?)),
        None => Ok(None),
    }
}

fn object_prototype<'js>(ctx: &Ctx<'js>) -> Option<Object<'js>> {
    ctx.globals().get::<_, Object>("Object").ok()?.get::<_, Object>("prototype").ok()
}

// ── parse ──────────────────────────────────────────────────────────────────────────────────────

fn native_parse<'js>(ctx: &Ctx<'js>, text: &str) -> Option<Value<'js>> {
    use serde::de::DeserializeSeed;
    let mut de = serde_json::Deserializer::from_str(text);
    let value = JsSeed(ctx).deserialize(&mut de).ok()?;
    de.end().ok()?; // trailing characters are an error, as in JSON.parse
    Some(value)
}

struct JsSeed<'a, 'js>(&'a Ctx<'js>);

impl<'de, 'a, 'js> serde::de::DeserializeSeed<'de> for JsSeed<'a, 'js> {
    type Value = Value<'js>;
    fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> Result<Self::Value, D::Error> {
        d.deserialize_any(JsVisitor(self.0))
    }
}

struct JsVisitor<'a, 'js>(&'a Ctx<'js>);

impl<'de, 'a, 'js> serde::de::Visitor<'de> for JsVisitor<'a, 'js> {
    type Value = Value<'js>;
    fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result { f.write_str("any JSON value") }
    fn visit_unit<E>(self) -> Result<Self::Value, E> { Ok(Value::new_null(self.0.clone())) }
    fn visit_bool<E>(self, v: bool) -> Result<Self::Value, E> { Ok(Value::new_bool(self.0.clone(), v)) }
    fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> {
        Ok(match i32::try_from(v) { Ok(i) => Value::new_int(self.0.clone(), i), Err(_) => Value::new_float(self.0.clone(), v as f64) })
    }
    fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> {
        Ok(match i32::try_from(v) { Ok(i) => Value::new_int(self.0.clone(), i), Err(_) => Value::new_float(self.0.clone(), v as f64) })
    }
    fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E> { Ok(Value::new_float(self.0.clone(), v)) }
    fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
        rquickjs::String::from_str(self.0.clone(), v).map(|s| s.into_value()).map_err(E::custom)
    }
    fn visit_seq<A: serde::de::SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
        let arr = rquickjs::Array::new(self.0.clone()).map_err(serde::de::Error::custom)?;
        let mut i = 0usize;
        while let Some(v) = seq.next_element_seed(JsSeed(self.0))? {
            arr.set(i, v).map_err(serde::de::Error::custom)?;
            i += 1;
        }
        Ok(arr.into_value())
    }
    fn visit_map<A: serde::de::MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
        let obj = Object::new(self.0.clone()).map_err(serde::de::Error::custom)?;
        while let Some(k) = map.next_key::<std::borrow::Cow<str>>()? {
            let v = map.next_value_seed(JsSeed(self.0))?;
            obj.set(k.as_ref(), v).map_err(serde::de::Error::custom)?;
        }
        Ok(obj.into_value())
    }
}

// ── stringify ──────────────────────────────────────────────────────────────────────────────────

/// Writes `v` as JSON, or returns `None` when it holds something the built-in should handle.
fn write<'js>(v: &Value<'js>, out: &mut String, depth: usize, object_proto: &Object<'js>) -> Option<()> {
    use std::fmt::Write;
    if depth > MAX_DEPTH {
        return None;
    }
    if let Some(n) = v.as_int() {
        let _ = write!(out, "{n}");
    } else if let Some(f) = v.as_float() {
        if !f.is_finite() {
            out.push_str("null");
        } else if f == 0.0 {
            if f.is_sign_negative() { return None; } // "-0": JSON.stringify gives "0"; not worth a special case
            out.push('0');
        } else if f.abs() >= 1e21 || f.abs() < 1e-6 {
            return None; // JavaScript switches to exponent notation here; Rust never does
        } else if f.fract() == 0.0 && f.abs() >= 1e15 {
            return None;
        } else {
            let _ = write!(out, "{f}");
        }
    } else if let Some(b) = v.as_bool() {
        out.push_str(if b { "true" } else { "false" });
    } else if v.is_null() {
        out.push_str("null");
    } else if let Some(s) = v.as_string() {
        write_string(&s.to_string().ok()?, out)?;
    } else if v.is_undefined() {
        out.push_str("null"); // only reached inside an array; objects skip it
    } else if v.is_function() || v.is_symbol() || v.is_big_int() {
        return None;
    } else if let Some(arr) = v.as_array() {
        out.push('[');
        for i in 0..arr.len() {
            if i > 0 { out.push(','); }
            let item: Value = arr.get(i).ok()?;
            write(&item, out, depth + 1, object_proto)?;
        }
        out.push(']');
    } else if let Some(obj) = v.as_object() {
        // Only plain objects: a Date, Map, class instance or boxed primitive serializes by its own rules.
        match obj.get_prototype() {
            None => {}
            Some(p) if p == *object_proto => {}
            Some(_) => return None,
        }
        if obj.contains_key("toJSON").ok()? {
            return None;
        }
        out.push('{');
        let mut first = true;
        for prop in obj.props::<String, Value>() {
            let (k, val) = prop.ok()?;
            if val.is_undefined() { continue; }
            if !first { out.push(','); }
            first = false;
            write_string(&k, out)?;
            out.push(':');
            write(&val, out, depth + 1, object_proto)?;
        }
        out.push('}');
    } else {
        return None;
    }
    Some(())
}

/// A JSON string literal, escaped like `JSON.stringify` does.
fn write_string(s: &str, out: &mut String) -> Option<()> {
    use std::fmt::Write;
    if s.contains('\u{FFFD}') {
        return None; // may stand for a lone surrogate, which JSON.stringify writes as \udXXX
    }
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => { let _ = write!(out, "\\u{:04x}", c as u32); }
            c => out.push(c),
        }
    }
    out.push('"');
    Some(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_ctx(f: impl FnOnce(Ctx<'_>)) {
        let rt = rquickjs::Runtime::new().unwrap();
        let ctx = rquickjs::Context::full(&rt).unwrap();
        ctx.with(f);
    }

    /// The native writer's text for a JS expression, and the built-in's: they must be identical.
    fn both(ctx: &Ctx<'_>, js: &str) -> (Option<String>, Option<String>) {
        let v: Value = ctx.eval(js).unwrap();
        let mine = stringify(ctx, v.clone()).unwrap();
        let builtin = builtin_stringify(ctx, v).unwrap();
        (mine, builtin)
    }

    #[test]
    fn stringify_matches_the_builtin_on_plain_data_and_unusual_values() {
        with_ctx(|ctx| {
            let cases = [
                "({ id: 1, name: 'x', tags: ['a', 'b'], ok: true, none: null, nested: { deep: [1, 2.5, -3, 1e300] } })",
                "[1, undefined, null, 'a']",
                "({ a: undefined, b: 1 })",
                "({ 2: 'b', 1: 'a', z: 0, a: 1 })",
                "'line\\nbreak \\t tab \\\\ quote \" bell \\u0007 bs \\b ff \\f del \\u007f ünï ✓ 😀'",
                "({ 'quo\"te': 1, 'new\\nline': 2 })",
                "[0.1, 0.000001, 1e-7, 123456789012345, 1e15, 1e21, -0, NaN, Infinity]",
                "[2147483647, 2147483648, -2147483649, 9007199254740993]",
                "new Date(0)",
                "({ toJSON() { return { replaced: true }; } })",
                "({ d: new Date(86400000), m: new Map([[1, 2]]), s: new Set([1]) })",
                "(class P { constructor() { this.x = 1; } }, new (class P { constructor() { this.x = 1; } })())",
                "Object.create(null, { k: { value: 1, enumerable: true } })",
                "({ f() {}, g: 1 })",
                "[function () {}, Symbol('s')]",
                "new Number(5)",
                "new Uint8Array([1, 2, 3])",
                "({ big: 1 })",
                "'\\ud800'",
                "({})",
                "[]",
                "''",
            ];
            for js in cases {
                let (mine, builtin) = both(&ctx, js);
                assert_eq!(mine, builtin, "stringify of {js}");
            }
        });
    }

    #[test]
    fn stringify_top_level_undefined_function_and_symbol_give_none() {
        with_ctx(|ctx| {
            for js in ["undefined", "(function () {})", "Symbol('s')"] {
                let (mine, builtin) = both(&ctx, js);
                assert_eq!(mine, None, "{js}");
                assert_eq!(builtin, None, "{js}");
            }
        });
    }

    #[test]
    fn stringify_leaves_a_cycle_and_a_bigint_to_the_builtin_errors() {
        with_ctx(|ctx| {
            for js in ["(() => { const a = {}; a.self = a; return a; })()", "({ n: 1n })"] {
                let v: Value = ctx.eval(js).unwrap();
                assert!(stringify(&ctx, v.clone()).is_err(), "native path must fall back and throw like the built-in: {js}");
                assert!(builtin_stringify(&ctx, v).is_err());
                let _ = ctx.catch(); // clear the pending exception
            }
        });
    }

    #[test]
    fn parse_matches_the_builtin() {
        with_ctx(|ctx| {
            let texts = [
                r#"{"id":1,"name":"x","tags":["a","b"],"ok":true,"none":null,"n":{"deep":[1,2.5,-3,1e300]}}"#,
                r#"[1,2,3]"#,
                r#""just a string""#,
                r#"42"#,
                r#"{"a":1,"a":2}"#,
                r#"{"2":"b","1":"a","z":0}"#,
                r#""\ud83d\ude00 \u00e9 \n \t \u0007""#,
                r#"{"__proto__":{"polluted":true}}"#,
                r#"[-0, 0, 1.0, 123456789012]"#,
                "  [ 1 ,\n 2 ]  ",
            ];
            for text in texts {
                let mine = parse(&ctx, text).unwrap();
                let builtin = ctx.json_parse(text.to_string()).unwrap();
                let a = builtin_stringify(&ctx, mine).unwrap();
                let b = builtin_stringify(&ctx, builtin).unwrap();
                assert_eq!(a, b, "parse of {text}");
            }
            // __proto__ stays an own property rather than changing the prototype.
            let v = parse(&ctx, r#"{"__proto__":{"polluted":true}}"#).unwrap();
            let obj = v.as_object().unwrap();
            assert!(obj.get::<_, Option<bool>>("polluted").unwrap().is_none());
        });
    }

    #[test]
    fn parse_errors_are_the_builtins_syntax_errors() {
        with_ctx(|ctx| {
            for text in ["", "{", "[1,]", "{'a':1}", "[1] x", "undefined", "\"\\ud800\""] {
                let mine = parse(&ctx, text);
                let builtin = ctx.json_parse(text.to_string());
                // "\ud800" alone is valid JSON for the built-in; whatever it decides, we agree.
                assert_eq!(mine.is_ok(), builtin.is_ok(), "parse of {text:?}");
                let _ = ctx.catch();
            }
        });
    }
}
