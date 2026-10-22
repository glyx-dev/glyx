use super::*;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};

fn registry(env: &[(&str, &str)]) -> Settings {
    let env: HashMap<String, String> = env.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    Settings::new(defs::DEFS, &move |name| env.get(name).cloned())
}

#[test]
fn every_definition_is_consistent() {
    let mut names = std::collections::HashSet::new();
    for d in defs::DEFS {
        assert!(names.insert(d.name), "{} is defined twice", d.name);
        assert!(d.name.contains('.'), "{} has no namespace", d.name);
        assert!(!d.doc.is_empty(), "{} has no documentation", d.name);
        // A config-only setting cannot be live: nothing could ever change it.
        assert!(!(d.safety == Safety::Config && d.scope == Scope::Live), "{} is live but config only", d.name);
        // The default is a valid value of its own kind.
        let default: Value = d.default.into();
        assert!(validate(d, default).is_ok(), "the default of {} is not valid", d.name);
        if let Some(env) = d.env {
            assert!(env.starts_with("GLYX_"), "{env} is not a GLYX_ variable");
        }
    }
}

#[test]
fn defaults_apply_when_nothing_else_does() {
    let s = registry(&[]);
    assert_eq!(s.int("render.labelCache"), 0);
    assert_eq!(s.int("render.canvasCacheMb"), 16);
    assert!(s.bool("render.colorEmoji"));
    assert_eq!(s.string("motion.reduce"), "auto");
    assert_eq!(s.source("render.colorEmoji"), Some(Source::Default));
    assert_eq!(s.get("no.such.setting"), None);
}

#[test]
fn precedence_is_env_then_runtime_then_config_then_default() {
    let s = registry(&[]);
    s.apply_config("canvasCacheMb", Value::Int(32)).unwrap();
    assert_eq!((s.int("render.canvasCacheMb"), s.source("render.canvasCacheMb")), (32, Some(Source::Config)));
    s.set("render.canvasCacheMb", Value::Int(8), Caller::Native).unwrap();
    assert_eq!((s.int("render.canvasCacheMb"), s.source("render.canvasCacheMb")), (8, Some(Source::Runtime)));
    s.reset("render.canvasCacheMb", Caller::Native).unwrap();
    assert_eq!(s.int("render.canvasCacheMb"), 32);

    let pinned = registry(&[("GLYX_CANVAS_CACHE_MB", "64")]);
    pinned.apply_config("canvasCacheMb", Value::Int(32)).unwrap();
    assert_eq!((pinned.int("render.canvasCacheMb"), pinned.source("render.canvasCacheMb")), (64, Some(Source::Env)));
    assert_eq!(pinned.set("render.canvasCacheMb", Value::Int(8), Caller::Native), Err(SetError::PinnedByEnv));
}

#[test]
fn environment_text_is_read_as_the_old_variables_were() {
    // GLYX_COLOR_EMOJI: off for 0, false or off; anything else leaves the default (on).
    for off in ["0", "false", "off", " OFF "] {
        assert!(!registry(&[("GLYX_COLOR_EMOJI", off)]).bool("render.colorEmoji"), "{off:?}");
    }
    for on in ["1", "yes", "banana", ""] {
        assert!(registry(&[("GLYX_COLOR_EMOJI", on)]).bool("render.colorEmoji"), "{on:?}");
    }
    // GLYX_REDUCE_MOTION: on unless 0 (and now the words).
    assert_eq!(registry(&[("GLYX_REDUCE_MOTION", "1")]).string("motion.reduce"), "on");
    assert_eq!(registry(&[("GLYX_REDUCE_MOTION", "0")]).string("motion.reduce"), "off");
    assert_eq!(registry(&[("GLYX_REDUCE_MOTION", "auto")]).string("motion.reduce"), "auto");
    assert_eq!(registry(&[("GLYX_REDUCE_MOTION", "")]).string("motion.reduce"), "auto");
    // A number out of range or not a number is ignored: the next source decides.
    assert_eq!(registry(&[("GLYX_CANVAS_CACHE_MB", "9999")]).int("render.canvasCacheMb"), 16);
    assert_eq!(registry(&[("GLYX_CANVAS_CACHE_MB", "lots")]).int("render.canvasCacheMb"), 16);
    assert_eq!(registry(&[("GLYX_LABEL_CACHE", "4096")]).int("render.labelCache"), 4096);
}

#[test]
fn the_old_switch_variables_keep_their_meaning_behind_positive_names() {
    // Switches that were off-by-being-set: any value but a false word turns the feature off.
    for (var, name) in [("GLYX_FULL_CANVAS_DAMAGE", "render.canvasPartialRedraw"), ("GLYX_SINGLE_DAMAGE_RECT", "render.multiDamageRects")] {
        for set in ["1", "", "yes", "anything"] {
            assert!(!registry(&[(var, set)]).bool(name), "{var}={set:?}");
        }
        for unset in ["0", "false", "off"] {
            assert!(registry(&[(var, unset)]).bool(name), "{var}={unset:?} is the default");
        }
        assert!(registry(&[]).bool(name));
    }
    // Read only when exactly 1.
    for (var, name) in [("GLYX_NO_SOFT_PRESENT", "render.softPresent"), ("GLYX_NO_EMOJI_FONT", "text.emojiFont")] {
        assert!(!registry(&[(var, "1")]).bool(name), "{var}=1");
        for other in ["0", "2", "true", ""] {
            assert!(registry(&[(var, other)]).bool(name), "{var}={other:?}");
        }
    }
    // On by being set.
    assert!(registry(&[("GLYX_VELLO_FIXED_BUFFERS", "")]).bool("render.vulloFixedBuffers"));
    assert!(registry(&[("GLYX_VELLO_FIXED_BUFFERS", "1")]).bool("render.vulloFixedBuffers"));
    assert!(!registry(&[("GLYX_VELLO_FIXED_BUFFERS", "0")]).bool("render.vulloFixedBuffers"));
    assert!(!registry(&[]).bool("render.vulloFixedBuffers"));
    assert!(registry(&[("GLYX_CPU_RENDER", "1")]).bool("render.cpuRender"));
    assert!(!registry(&[("GLYX_CPU_RENDER", "0")]).bool("render.cpuRender"));
}

#[test]
fn a_bad_config_value_is_refused_and_keeps_the_default() {
    let s = registry(&[]);
    assert!(matches!(s.apply_config("canvasCacheMb", Value::Int(-1)), Err(SetError::Invalid(_))));
    assert!(matches!(s.apply_config("canvasCacheMb", Value::Str("lots".into())), Err(SetError::Invalid(_))));
    assert_eq!(s.apply_config("noSuchKey", Value::Int(1)), Err(SetError::Unknown));
    assert_eq!(s.int("render.canvasCacheMb"), 16);
}

#[test]
fn startup_settings_refuse_a_change_once_the_app_has_started() {
    let s = registry(&[]);
    // Before the end of startup the native side may still set it.
    assert!(s.set("render.colorEmoji", Value::Bool(false), Caller::Native).is_ok());
    s.finish_startup();
    assert_eq!(s.set("render.colorEmoji", Value::Bool(true), Caller::Native), Err(SetError::StartupOnly));
    assert_eq!(s.reset("render.colorEmoji", Caller::Native), Err(SetError::StartupOnly));
    // A live setting still changes.
    assert!(s.set("motion.reduce", Value::Str("on".into()), Caller::DevTools).is_ok());
}

#[test]
fn who_may_set_what() {
    static LOCAL: [Def; 3] = [
        Def { name: "t.config", kind: Kind::Bool, default: DefaultValue::Bool(false), scope: Scope::Startup, safety: Safety::Config, env: None, parse_env: None, config_key: Some("c"), doc: "x" },
        Def { name: "t.dev", kind: Kind::Bool, default: DefaultValue::Bool(false), scope: Scope::Live, safety: Safety::Developer, env: None, parse_env: None, config_key: None, doc: "x" },
        Def { name: "t.app", kind: Kind::Bool, default: DefaultValue::Bool(false), scope: Scope::Live, safety: Safety::App, env: None, parse_env: None, config_key: None, doc: "x" },
    ];
    let s = Settings::new(&LOCAL, &|_| None);
    let yes = Value::Bool(true);
    for caller in [Caller::Native, Caller::DevTools] {
        assert_eq!(s.set("t.config", yes.clone(), caller), Err(SetError::NotAllowed), "{caller:?}");
        assert!(s.set("t.app", yes.clone(), caller).is_ok(), "{caller:?}");
    }
    assert!(s.set("t.dev", yes.clone(), Caller::Native).is_ok());
    assert!(s.set("t.dev", yes.clone(), Caller::DevTools).is_ok());

    // App JavaScript is locked out by default, even for a setting marked for apps...
    assert_eq!(s.set("t.app", yes.clone(), Caller::App), Err(SetError::AppLocked));
    assert_eq!(s.reset("t.app", Caller::App), Err(SetError::AppLocked));
    assert!(!s.list().iter().find(|i| i.name == "t.app").unwrap().app_can_set);
    // ...until the app's config allows it; then only the settings marked for apps.
    s.allow_app_changes(true);
    assert!(s.set("t.app", yes.clone(), Caller::App).is_ok());
    assert!(s.list().iter().find(|i| i.name == "t.app").unwrap().app_can_set);
    assert_eq!(s.set("t.dev", yes.clone(), Caller::App), Err(SetError::NotAllowed));
    assert_eq!(s.set("t.config", yes.clone(), Caller::App), Err(SetError::NotAllowed));
    assert!(!s.list().iter().find(|i| i.name == "t.dev").unwrap().app_can_set);
    // A lock beats the allowance.
    s.lock(&["t.app"]);
    assert_eq!(s.set("t.app", yes.clone(), Caller::App), Err(SetError::Locked));
    assert!(!s.list().iter().find(|i| i.name == "t.app").unwrap().app_can_set);
    // Config can still set a config-only setting.
    s.apply_config("c", Value::Bool(true)).unwrap();
    assert!(s.bool("t.config"));
}

#[test]
fn runtime_values_are_validated() {
    let s = registry(&[]);
    assert!(matches!(s.set("render.canvasCacheMb", Value::Int(257), Caller::Native), Err(SetError::Invalid(_))));
    assert!(matches!(s.set("render.canvasCacheMb", Value::Bool(true), Caller::Native), Err(SetError::Invalid(_))));
    assert!(matches!(s.set("motion.reduce", Value::Str("sometimes".into()), Caller::Native), Err(SetError::Invalid(_))));
    assert_eq!(s.set("no.such", Value::Bool(true), Caller::Native), Err(SetError::Unknown));
    assert_eq!(s.int("render.canvasCacheMb"), 16);
}

#[test]
fn a_developer_can_lock_a_setting_or_all_runtime_changes() {
    let s = registry(&[]);
    assert_eq!(s.lock(&["motion.reduce", "not.a.setting"]), vec!["not.a.setting".to_string()]);
    assert_eq!(s.set("motion.reduce", Value::Str("on".into()), Caller::Native), Err(SetError::Locked));
    assert!(s.list().iter().find(|i| i.name == "motion.reduce").unwrap().locked);

    let s = registry(&[]);
    s.disable_runtime();
    assert_eq!(s.set("render.colorEmoji", Value::Bool(false), Caller::Native), Err(SetError::Locked));
    assert!(s.list().iter().all(|i| i.locked));
}

#[test]
fn listeners_hear_only_real_changes_and_can_be_removed() {
    let s = registry(&[]);
    let heard = std::sync::Arc::new(AtomicUsize::new(0));
    let counter = heard.clone();
    let id = s.on_change(move |name, value| {
        assert_eq!(name, "motion.reduce");
        assert_eq!(value, &Value::Str("on".into()));
        counter.fetch_add(1, Ordering::SeqCst);
    });
    s.set("motion.reduce", Value::Str("on".into()), Caller::Native).unwrap();
    // The same value again is not a change.
    s.set("motion.reduce", Value::Str("on".into()), Caller::Native).unwrap();
    assert_eq!(heard.load(Ordering::SeqCst), 1);
    s.off_change(id);
    s.reset("motion.reduce", Caller::Native).unwrap();
    assert_eq!(heard.load(Ordering::SeqCst), 1);
}

#[test]
fn a_listener_may_read_settings() {
    // Listeners are called outside the lock.
    let s = std::sync::Arc::new(registry(&[]));
    let inner = s.clone();
    s.on_change(move |_, _| {
        let _ = inner.string("motion.reduce");
    });
    s.set("motion.reduce", Value::Str("off".into()), Caller::Native).unwrap();
}

#[test]
fn the_generated_documentation_lists_every_setting() {
    let md = docs_markdown(defs::DEFS);
    for d in defs::DEFS {
        assert!(md.contains(&format!("`{}`", d.name)), "{} is missing", d.name);
    }
    assert!(md.contains("`GLYX_LABEL_CACHE`") && md.contains("`window.canvasCacheMb`"));
}

#[cfg(feature = "json")]
mod json_edge {
    use super::*;
    use crate::json;

    #[test]
    fn the_list_describes_every_setting_for_devtools_and_javascript() {
        let s = registry(&[("GLYX_COLOR_EMOJI", "0")]);
        let all = json::list(&s);
        let all = all.as_array().unwrap();
        assert_eq!(all.len(), defs::DEFS.len());
        let emoji = all.iter().find(|i| i["name"] == "render.colorEmoji").unwrap();
        assert_eq!((emoji["value"].clone(), emoji["source"].clone(), emoji["type"].clone()), (serde_json::json!(false), "env".into(), "boolean".into()));
        let cache = all.iter().find(|i| i["name"] == "render.canvasCacheMb").unwrap();
        assert_eq!((cache["min"].clone(), cache["max"].clone(), cache["scope"].clone()), (0.into(), 256.into(), "startup".into()));
        let motion = all.iter().find(|i| i["name"] == "motion.reduce").unwrap();
        assert_eq!(motion["choices"], serde_json::json!(["auto", "on", "off"]));
    }

    #[test]
    fn set_takes_json_text_and_answers_with_json() {
        let s = registry(&[]);
        let ok = json::set(&s, "motion.reduce", "\"on\"", Caller::DevTools);
        assert_eq!((ok["ok"].clone(), ok["value"].clone(), ok["source"].clone()), (true.into(), "on".into(), "runtime".into()));
        // App JavaScript may not change a developer setting.
        let refused = json::set(&s, "render.labelCache", "4096", Caller::App);
        assert_eq!(refused["ok"], false);
        assert!(refused["error"].as_str().unwrap().contains("cannot be changed"));
        // Nor an app setting, until the app's config allows it.
        let locked = json::set(&s, "motion.reduce", "\"off\"", Caller::App);
        assert!(locked["error"].as_str().unwrap().contains("settings.allowJsChanges"));
        s.allow_app_changes(true);
        assert_eq!(json::set(&s, "motion.reduce", "\"off\"", Caller::App)["ok"], true);
        assert_eq!(json::set(&s, "render.labelCache", "4096", Caller::App)["ok"], false);
        // Not JSON, or not a value a setting can hold.
        for bad in ["{", "null", "[1]", "1.5"] {
            assert_eq!(json::set(&s, "motion.reduce", bad, Caller::DevTools)["ok"], false, "{bad}");
        }
        let back = json::reset(&s, "motion.reduce", Caller::DevTools);
        assert_eq!((back["ok"].clone(), back["value"].clone()), (true.into(), "auto".into()));
    }
}
