//! The runtime settings registry.
//!
//! Tunables used to be scattered: environment variables read in one place each (`GLYX_LABEL_CACHE`, `GLYX_COLOR_EMOJI`, ...), `glyx.config`
//! keys parsed elsewhere, and DevTools switches. Each one now has a **definition** (name, type, default, range, scope, safety, the legacy
//! environment variable and config key it replaces, one line of documentation) in [`defs::DEFS`], and is read through one object.
//!
//! **Precedence**, highest first: the environment variable (it pins the setting for the process), a runtime [`Settings::set`], the
//! `glyx.config` value, the default.
//!
//! **Scope**: a [`Scope::Startup`] setting is read once while the app starts and refuses a runtime `set`; a [`Scope::Live`] one can change
//! while the app runs and tells its listeners.
//!
//! **Safety** says who may `set` it at runtime: [`Safety::Config`] nobody (environment and `glyx.config` only: heap caps, anything security
//! relevant), [`Safety::Developer`] the native side and DevTools, [`Safety::App`] also the app's JavaScript. Plugins and webviews are
//! untrusted callers of the last kind only. A developer can [`Settings::lock`] single settings or [`Settings::disable_runtime`] altogether.
//!
//! **App JavaScript is locked out by default**, whatever a setting's class: the app's own `glyx.config` (`settings.allowJsChanges`) has to opt in
//! ([`Settings::allow_app_changes`]), and even then JavaScript can change only the few settings marked [`Safety::App`].
//!
//! The registry holds no JSON and no JavaScript types: the bindings and DevTools convert [`Value`] at their edge.

pub mod defs;
#[cfg(feature = "json")]
pub mod json;

use std::sync::{Arc, OnceLock, RwLock};

/// The type of a setting and the values it accepts.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Bool,
    /// An integer in `min..=max`.
    Int { min: i64, max: i64 },
    /// One of a fixed list of words.
    Choice(&'static [&'static str]),
}

/// A default, usable in a `const` table.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DefaultValue {
    Bool(bool),
    Int(i64),
    Str(&'static str),
}

/// A setting's value.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Value {
    Bool(bool),
    Int(i64),
    Str(String),
}

impl From<DefaultValue> for Value {
    fn from(d: DefaultValue) -> Value {
        match d {
            DefaultValue::Bool(b) => Value::Bool(b),
            DefaultValue::Int(i) => Value::Int(i),
            DefaultValue::Str(s) => Value::Str(s.to_string()),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scope {
    /// Read once while the app starts; a runtime `set` is refused.
    Startup,
    /// May change while the app runs; listeners are told.
    Live,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Safety {
    /// Environment and `glyx.config` only. Never settable at runtime, by anyone.
    Config,
    /// The native side and DevTools may set it at runtime; app JavaScript may not.
    Developer,
    /// Anyone, including app JavaScript.
    App,
}

/// Who is asking to change a setting.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Caller {
    Native,
    DevTools,
    App,
}

impl Caller {
    /// Whether this caller may change a setting of the given class.
    fn may_set(self, safety: Safety) -> bool {
        match safety {
            Safety::Config => false,
            Safety::Developer => matches!(self, Caller::Native | Caller::DevTools),
            Safety::App => true,
        }
    }
}

/// A setting's definition: everything about it except its current value.
pub struct Def {
    /// `namespace.name`, camel case after the dot (`render.labelCache`).
    pub name: &'static str,
    pub kind: Kind,
    pub default: DefaultValue,
    pub scope: Scope,
    pub safety: Safety,
    /// The legacy environment variable, if there is one. Its text is read by `parse_env`.
    pub env: Option<&'static str>,
    /// How the environment text becomes a value, where the generic reading (`true/false/on/off/1/0`, a number, one of the words) is not what
    /// the variable always meant. `None` from it ignores the text.
    pub parse_env: Option<fn(&str) -> Option<Value>>,
    /// The `glyx.config` key (inside `window`) this setting replaces, if there is one.
    pub config_key: Option<&'static str>,
    /// One line, for the generated documentation and DevTools.
    pub doc: &'static str,
}

/// Where the value in force came from.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    Env,
    Runtime,
    Config,
    Default,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SetError {
    Unknown,
    /// The value is of the wrong type, out of range, or not one of the words.
    Invalid(String),
    /// A startup-only setting, after the app has started.
    StartupOnly,
    /// This caller may not change this setting.
    NotAllowed,
    /// App JavaScript may not change settings in this app (the default; `settings.allowJsChanges` in `glyx.config` turns it on).
    AppLocked,
    /// The developer locked it, or turned runtime changes off.
    Locked,
    /// The environment variable decides it for this process.
    PinnedByEnv,
}

impl std::fmt::Display for SetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SetError::Unknown => write!(f, "unknown setting"),
            SetError::Invalid(why) => write!(f, "{why}"),
            SetError::StartupOnly => write!(f, "this setting is read at startup and cannot change while the app runs"),
            SetError::NotAllowed => write!(f, "this setting cannot be changed by this caller"),
            SetError::AppLocked => write!(f, "this app does not let JavaScript change settings (set settings.allowJsChanges in glyx.config)"),
            SetError::Locked => write!(f, "this setting is locked"),
            SetError::PinnedByEnv => write!(f, "this setting is pinned by its environment variable"),
        }
    }
}

/// A setting as DevTools and `glyx.settings.list()` show it.
#[derive(Clone, Debug)]
pub struct Info {
    pub name: &'static str,
    pub value: Value,
    pub source: Source,
    pub default: Value,
    pub kind: Kind,
    pub scope: Scope,
    pub safety: Safety,
    /// No runtime change is possible for anyone (config-only, locked, or runtime changes switched off).
    pub locked: bool,
    /// App JavaScript could change it right now: the setting is marked for apps, the app allows it, and nothing locks it.
    pub app_can_set: bool,
    pub doc: &'static str,
}

pub type ListenerId = u64;
type Listener = Arc<dyn Fn(&str, &Value) + Send + Sync>;

struct Inner {
    config: Vec<Option<Value>>,
    runtime: Vec<Option<Value>>,
    locked: Vec<bool>,
    runtime_off: bool,
    /// App JavaScript may change settings (default false; only settings marked [`Safety::App`] even then).
    app_allowed: bool,
    started: bool,
    listeners: Vec<(ListenerId, Listener)>,
    next_listener: ListenerId,
}

pub struct Settings {
    defs: &'static [Def],
    /// What the environment said, read once at construction.
    env: Vec<Option<Value>>,
    inner: RwLock<Inner>,
}

impl Settings {
    /// A registry over `defs`, reading the environment through `env` (a function, so tests need no real variables).
    pub fn new(defs: &'static [Def], env: &dyn Fn(&str) -> Option<String>) -> Settings {
        let env_values = defs
            .iter()
            .map(|d| {
                let text = env(d.env?)?;
                let text = text.trim();
                match d.parse_env {
                    Some(parse) => parse(text),
                    None => parse_text(d.kind, text),
                }
            })
            .collect();
        let n = defs.len();
        Settings {
            defs,
            env: env_values,
            inner: RwLock::new(Inner {
                config: vec![None; n],
                runtime: vec![None; n],
                locked: vec![false; n],
                runtime_off: false,
                app_allowed: false,
                started: false,
                listeners: Vec::new(),
                next_listener: 1,
            }),
        }
    }

    fn index(&self, name: &str) -> Option<usize> {
        self.defs.iter().position(|d| d.name == name)
    }

    fn resolve(&self, i: usize, inner: &Inner) -> (Value, Source) {
        if let Some(v) = &self.env[i] {
            (v.clone(), Source::Env)
        } else if let Some(v) = &inner.runtime[i] {
            (v.clone(), Source::Runtime)
        } else if let Some(v) = &inner.config[i] {
            (v.clone(), Source::Config)
        } else {
            (self.defs[i].default.into(), Source::Default)
        }
    }

    /// The value in force, or `None` for a name that is not defined.
    pub fn get(&self, name: &str) -> Option<Value> {
        let i = self.index(name)?;
        let inner = self.inner.read().unwrap();
        Some(self.resolve(i, &inner).0)
    }

    pub fn source(&self, name: &str) -> Option<Source> {
        let i = self.index(name)?;
        let inner = self.inner.read().unwrap();
        Some(self.resolve(i, &inner).1)
    }

    /// A boolean setting. A name that is not defined, or is not a boolean, is a bug in the caller: it asserts in debug builds and is `false`.
    pub fn bool(&self, name: &str) -> bool {
        match self.get(name) {
            Some(Value::Bool(b)) => b,
            other => {
                debug_assert!(false, "setting {name:?} is not a boolean ({other:?})");
                false
            }
        }
    }

    /// An integer setting (0 for a bug in the caller, as for [`Settings::bool`]).
    pub fn int(&self, name: &str) -> i64 {
        match self.get(name) {
            Some(Value::Int(i)) => i,
            other => {
                debug_assert!(false, "setting {name:?} is not an integer ({other:?})");
                0
            }
        }
    }

    /// A choice setting.
    pub fn string(&self, name: &str) -> String {
        match self.get(name) {
            Some(Value::Str(s)) => s,
            other => {
                debug_assert!(false, "setting {name:?} is not a word ({other:?})");
                String::new()
            }
        }
    }

    /// Load a `glyx.config` value by its config key. A value of the wrong type or out of range is refused (the setting keeps the next
    /// source, so a bad config never breaks startup); the error says why, for the caller to log.
    pub fn apply_config(&self, config_key: &str, value: Value) -> Result<(), SetError> {
        let i = self.defs.iter().position(|d| d.config_key == Some(config_key)).ok_or(SetError::Unknown)?;
        let value = validate(&self.defs[i], value)?;
        self.inner.write().unwrap().config[i] = Some(value);
        Ok(())
    }

    /// Mark the end of startup: from here a [`Scope::Startup`] setting refuses `set`.
    pub fn finish_startup(&self) {
        self.inner.write().unwrap().started = true;
    }

    /// Change a setting while the app runs. Returns the value now in force.
    pub fn set(&self, name: &str, value: Value, caller: Caller) -> Result<Value, SetError> {
        self.change(name, Some(value), caller)
    }

    /// Drop a runtime override, back to the config value or the default.
    pub fn reset(&self, name: &str, caller: Caller) -> Result<Value, SetError> {
        self.change(name, None, caller)
    }

    fn change(&self, name: &str, value: Option<Value>, caller: Caller) -> Result<Value, SetError> {
        let i = self.index(name).ok_or(SetError::Unknown)?;
        let def = &self.defs[i];
        let (after, tell) = {
            let mut inner = self.inner.write().unwrap();
            if !caller.may_set(def.safety) {
                return Err(SetError::NotAllowed);
            }
            if caller == Caller::App && !inner.app_allowed {
                return Err(SetError::AppLocked);
            }
            if def.scope == Scope::Startup && inner.started {
                return Err(SetError::StartupOnly);
            }
            if inner.runtime_off || inner.locked[i] {
                return Err(SetError::Locked);
            }
            if value.is_some() && self.env[i].is_some() {
                return Err(SetError::PinnedByEnv);
            }
            let value = match value {
                Some(v) => Some(validate(def, v)?),
                None => None,
            };
            let before = self.resolve(i, &inner).0;
            inner.runtime[i] = value;
            let after = self.resolve(i, &inner).0;
            let tell: Vec<Listener> = if before != after { inner.listeners.iter().map(|(_, l)| l.clone()).collect() } else { Vec::new() };
            (after, tell)
        };
        // Told outside the lock, so a listener may read settings.
        for listener in tell {
            listener(def.name, &after);
        }
        Ok(after)
    }

    /// Lock single settings against runtime changes from every caller (the developer's `glyx.config`). Unknown names are returned.
    pub fn lock(&self, names: &[&str]) -> Vec<String> {
        let mut unknown = Vec::new();
        let mut inner = self.inner.write().unwrap();
        for name in names {
            match self.index(name) {
                Some(i) => inner.locked[i] = true,
                None => unknown.push(name.to_string()),
            }
        }
        unknown
    }

    /// Let app JavaScript change the settings marked [`Safety::App`] (the app's `settings.allowJsChanges`). Off by default.
    pub fn allow_app_changes(&self, allowed: bool) {
        self.inner.write().unwrap().app_allowed = allowed;
    }

    /// Refuse every runtime change (for an app that loads third-party plugins and wants no tuning at all).
    pub fn disable_runtime(&self) {
        self.inner.write().unwrap().runtime_off = true;
    }

    /// Be told when a setting's value in force changes. The callback gets the name and the new value.
    pub fn on_change(&self, f: impl Fn(&str, &Value) + Send + Sync + 'static) -> ListenerId {
        let mut inner = self.inner.write().unwrap();
        let id = inner.next_listener;
        inner.next_listener += 1;
        inner.listeners.push((id, Arc::new(f)));
        id
    }

    pub fn off_change(&self, id: ListenerId) {
        self.inner.write().unwrap().listeners.retain(|(i, _)| *i != id);
    }

    /// Every setting with its value, for DevTools and `glyx.settings.list()`.
    pub fn list(&self) -> Vec<Info> {
        let inner = self.inner.read().unwrap();
        self.defs
            .iter()
            .enumerate()
            .map(|(i, d)| {
                let (value, source) = self.resolve(i, &inner);
                Info {
                    name: d.name,
                    value,
                    source,
                    default: d.default.into(),
                    kind: d.kind,
                    scope: d.scope,
                    safety: d.safety,
                    locked: inner.runtime_off || inner.locked[i] || d.safety == Safety::Config,
                    app_can_set: d.safety == Safety::App
                        && inner.app_allowed
                        && !inner.runtime_off
                        && !inner.locked[i]
                        && self.env[i].is_none()
                        && !(d.scope == Scope::Startup && inner.started),
                    doc: d.doc,
                }
            })
            .collect()
    }
}

/// Check a value against a definition's type, range and words.
fn validate(def: &Def, value: Value) -> Result<Value, SetError> {
    match (def.kind, value) {
        (Kind::Bool, v @ Value::Bool(_)) => Ok(v),
        (Kind::Int { min, max }, Value::Int(i)) => {
            if (min..=max).contains(&i) {
                Ok(Value::Int(i))
            } else {
                Err(SetError::Invalid(format!("{} must be between {min} and {max}", def.name)))
            }
        }
        (Kind::Choice(words), Value::Str(s)) => {
            if words.contains(&s.as_str()) {
                Ok(Value::Str(s))
            } else {
                Err(SetError::Invalid(format!("{} must be one of: {}", def.name, words.join(", "))))
            }
        }
        _ => Err(SetError::Invalid(format!("{} has the wrong type", def.name))),
    }
}

/// The generic reading of environment text for a kind: `true/false/on/off/yes/no/1/0`, a number in range, one of the words.
pub fn parse_text(kind: Kind, text: &str) -> Option<Value> {
    let text = text.trim();
    match kind {
        Kind::Bool => match text.to_ascii_lowercase().as_str() {
            "1" | "true" | "on" | "yes" => Some(Value::Bool(true)),
            "0" | "false" | "off" | "no" => Some(Value::Bool(false)),
            _ => None,
        },
        Kind::Int { min, max } => text.parse::<i64>().ok().filter(|i| (min..=max).contains(i)).map(Value::Int),
        Kind::Choice(words) => words.iter().find(|w| w.eq_ignore_ascii_case(text)).map(|w| Value::Str(w.to_string())),
    }
}

/// The settings of this process, over [`defs::DEFS`] and the real environment.
pub fn global() -> &'static Settings {
    static GLOBAL: OnceLock<Settings> = OnceLock::new();
    GLOBAL.get_or_init(|| Settings::new(defs::DEFS, &|name| std::env::var(name).ok()))
}

/// Markdown for the documentation site, generated from the definitions so it cannot drift from the code.
pub fn docs_markdown(defs: &[Def]) -> String {
    let mut out = String::from(
        "| Setting | Type | Default | Changes | Who may set it | Environment | `glyx.config` | What it does |\n|---|---|---|---|---|---|---|---|\n",
    );
    for d in defs {
        let kind = match d.kind {
            Kind::Bool => "boolean".to_string(),
            Kind::Int { min, max } => format!("integer {min} to {max}"),
            Kind::Choice(words) => words.join(" / "),
        };
        let default = match d.default {
            DefaultValue::Bool(b) => b.to_string(),
            DefaultValue::Int(i) => i.to_string(),
            DefaultValue::Str(s) => s.to_string(),
        };
        let scope = match d.scope {
            Scope::Startup => "at startup",
            Scope::Live => "live",
        };
        let safety = match d.safety {
            Safety::Config => "config only",
            Safety::Developer => "developer (DevTools)",
            Safety::App => "app JavaScript too",
        };
        out.push_str(&format!(
            "| `{}` | {} | {} | {} | {} | {} | {} | {} |\n",
            d.name,
            kind,
            default,
            scope,
            safety,
            d.env.map_or(String::new(), |e| format!("`{e}`")),
            d.config_key.map_or(String::new(), |k| format!("`window.{k}`")),
            d.doc,
        ));
    }
    out
}

#[cfg(test)]
mod tests;
