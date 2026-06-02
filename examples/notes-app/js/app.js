(() => {
  var __create = Object.create;
  var __getProtoOf = Object.getPrototypeOf;
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  function __accessProp(key) {
    return this[key];
  }
  var __toESMCache_node;
  var __toESMCache_esm;
  var __toESM = (mod, isNodeMode, target) => {
    var canCache = mod != null && typeof mod === "object";
    if (canCache) {
      var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
      var cached = cache.get(mod);
      if (cached)
        return cached;
    }
    target = mod != null ? __create(__getProtoOf(mod)) : {};
    const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
    if (canCache)
      cache.set(mod, to);
    return to;
  };
  var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

  // ../../node_modules/.bun/react@18.3.1/node_modules/react/cjs/react.production.min.js
  var require_react_production_min = __commonJS((exports) => {
    var l = Symbol.for("react.element");
    var n = Symbol.for("react.portal");
    var p = Symbol.for("react.fragment");
    var q = Symbol.for("react.strict_mode");
    var r = Symbol.for("react.profiler");
    var t = Symbol.for("react.provider");
    var u = Symbol.for("react.context");
    var v = Symbol.for("react.forward_ref");
    var w = Symbol.for("react.suspense");
    var x = Symbol.for("react.memo");
    var y = Symbol.for("react.lazy");
    var z = Symbol.iterator;
    function A(a) {
      if (a === null || typeof a !== "object")
        return null;
      a = z && a[z] || a["@@iterator"];
      return typeof a === "function" ? a : null;
    }
    var B = { isMounted: function() {
      return false;
    }, enqueueForceUpdate: function() {}, enqueueReplaceState: function() {}, enqueueSetState: function() {} };
    var C = Object.assign;
    var D = {};
    function E(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    E.prototype.isReactComponent = {};
    E.prototype.setState = function(a, b) {
      if (typeof a !== "object" && typeof a !== "function" && a != null)
        throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, a, b, "setState");
    };
    E.prototype.forceUpdate = function(a) {
      this.updater.enqueueForceUpdate(this, a, "forceUpdate");
    };
    function F() {}
    F.prototype = E.prototype;
    function G(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    var H = G.prototype = new F;
    H.constructor = G;
    C(H, E.prototype);
    H.isPureReactComponent = true;
    var I = Array.isArray;
    var J = Object.prototype.hasOwnProperty;
    var K = { current: null };
    var L = { key: true, ref: true, __self: true, __source: true };
    function M(a, b, e) {
      var d, c = {}, k = null, h = null;
      if (b != null)
        for (d in b.ref !== undefined && (h = b.ref), b.key !== undefined && (k = "" + b.key), b)
          J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
      var g = arguments.length - 2;
      if (g === 1)
        c.children = e;
      else if (1 < g) {
        for (var f = Array(g), m = 0;m < g; m++)
          f[m] = arguments[m + 2];
        c.children = f;
      }
      if (a && a.defaultProps)
        for (d in g = a.defaultProps, g)
          c[d] === undefined && (c[d] = g[d]);
      return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
    }
    function N(a, b) {
      return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
    }
    function O(a) {
      return typeof a === "object" && a !== null && a.$$typeof === l;
    }
    function escape(a) {
      var b = { "=": "=0", ":": "=2" };
      return "$" + a.replace(/[=:]/g, function(a2) {
        return b[a2];
      });
    }
    var P = /\/+/g;
    function Q(a, b) {
      return typeof a === "object" && a !== null && a.key != null ? escape("" + a.key) : b.toString(36);
    }
    function R(a, b, e, d, c) {
      var k = typeof a;
      if (k === "undefined" || k === "boolean")
        a = null;
      var h = false;
      if (a === null)
        h = true;
      else
        switch (k) {
          case "string":
          case "number":
            h = true;
            break;
          case "object":
            switch (a.$$typeof) {
              case l:
              case n:
                h = true;
            }
        }
      if (h)
        return h = a, c = c(h), a = d === "" ? "." + Q(h, 0) : d, I(c) ? (e = "", a != null && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
          return a2;
        })) : c != null && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
      h = 0;
      d = d === "" ? "." : d + ":";
      if (I(a))
        for (var g = 0;g < a.length; g++) {
          k = a[g];
          var f = d + Q(k, g);
          h += R(k, b, e, f, c);
        }
      else if (f = A(a), typeof f === "function")
        for (a = f.call(a), g = 0;!(k = a.next()).done; )
          k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
      else if (k === "object")
        throw b = String(a), Error("Objects are not valid as a React child (found: " + (b === "[object Object]" ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
      return h;
    }
    function S(a, b, e) {
      if (a == null)
        return a;
      var d = [], c = 0;
      R(a, d, "", "", function(a2) {
        return b.call(e, a2, c++);
      });
      return d;
    }
    function T(a) {
      if (a._status === -1) {
        var b = a._result;
        b = b();
        b.then(function(b2) {
          if (a._status === 0 || a._status === -1)
            a._status = 1, a._result = b2;
        }, function(b2) {
          if (a._status === 0 || a._status === -1)
            a._status = 2, a._result = b2;
        });
        a._status === -1 && (a._status = 0, a._result = b);
      }
      if (a._status === 1)
        return a._result.default;
      throw a._result;
    }
    var U = { current: null };
    var V = { transition: null };
    var W = { ReactCurrentDispatcher: U, ReactCurrentBatchConfig: V, ReactCurrentOwner: K };
    function X() {
      throw Error("act(...) is not supported in production builds of React.");
    }
    exports.Children = { map: S, forEach: function(a, b, e) {
      S(a, function() {
        b.apply(this, arguments);
      }, e);
    }, count: function(a) {
      var b = 0;
      S(a, function() {
        b++;
      });
      return b;
    }, toArray: function(a) {
      return S(a, function(a2) {
        return a2;
      }) || [];
    }, only: function(a) {
      if (!O(a))
        throw Error("React.Children.only expected to receive a single React element child.");
      return a;
    } };
    exports.Component = E;
    exports.Fragment = p;
    exports.Profiler = r;
    exports.PureComponent = G;
    exports.StrictMode = q;
    exports.Suspense = w;
    exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
    exports.act = X;
    exports.cloneElement = function(a, b, e) {
      if (a === null || a === undefined)
        throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
      var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
      if (b != null) {
        b.ref !== undefined && (k = b.ref, h = K.current);
        b.key !== undefined && (c = "" + b.key);
        if (a.type && a.type.defaultProps)
          var g = a.type.defaultProps;
        for (f in b)
          J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = b[f] === undefined && g !== undefined ? g[f] : b[f]);
      }
      var f = arguments.length - 2;
      if (f === 1)
        d.children = e;
      else if (1 < f) {
        g = Array(f);
        for (var m = 0;m < f; m++)
          g[m] = arguments[m + 2];
        d.children = g;
      }
      return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
    };
    exports.createContext = function(a) {
      a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
      a.Provider = { $$typeof: t, _context: a };
      return a.Consumer = a;
    };
    exports.createElement = M;
    exports.createFactory = function(a) {
      var b = M.bind(null, a);
      b.type = a;
      return b;
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(a) {
      return { $$typeof: v, render: a };
    };
    exports.isValidElement = O;
    exports.lazy = function(a) {
      return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T };
    };
    exports.memo = function(a, b) {
      return { $$typeof: x, type: a, compare: b === undefined ? null : b };
    };
    exports.startTransition = function(a) {
      var b = V.transition;
      V.transition = {};
      try {
        a();
      } finally {
        V.transition = b;
      }
    };
    exports.unstable_act = X;
    exports.useCallback = function(a, b) {
      return U.current.useCallback(a, b);
    };
    exports.useContext = function(a) {
      return U.current.useContext(a);
    };
    exports.useDebugValue = function() {};
    exports.useDeferredValue = function(a) {
      return U.current.useDeferredValue(a);
    };
    exports.useEffect = function(a, b) {
      return U.current.useEffect(a, b);
    };
    exports.useId = function() {
      return U.current.useId();
    };
    exports.useImperativeHandle = function(a, b, e) {
      return U.current.useImperativeHandle(a, b, e);
    };
    exports.useInsertionEffect = function(a, b) {
      return U.current.useInsertionEffect(a, b);
    };
    exports.useLayoutEffect = function(a, b) {
      return U.current.useLayoutEffect(a, b);
    };
    exports.useMemo = function(a, b) {
      return U.current.useMemo(a, b);
    };
    exports.useReducer = function(a, b, e) {
      return U.current.useReducer(a, b, e);
    };
    exports.useRef = function(a) {
      return U.current.useRef(a);
    };
    exports.useState = function(a) {
      return U.current.useState(a);
    };
    exports.useSyncExternalStore = function(a, b, e) {
      return U.current.useSyncExternalStore(a, b, e);
    };
    exports.useTransition = function() {
      return U.current.useTransition();
    };
    exports.version = "18.3.1";
  });

  // ../../node_modules/.bun/react@18.3.1/node_modules/react/index.js
  var require_react = __commonJS((exports, module) => {
    if (true) {
      module.exports = require_react_production_min();
    } else {}
  });

  // ../../node_modules/.bun/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.production.min.js
  var require_scheduler_production_min = __commonJS((exports) => {
    function f(a, b) {
      var c = a.length;
      a.push(b);
      a:
        for (;0 < c; ) {
          var d = c - 1 >>> 1, e = a[d];
          if (0 < g(e, b))
            a[d] = b, a[c] = e, c = d;
          else
            break a;
        }
    }
    function h(a) {
      return a.length === 0 ? null : a[0];
    }
    function k(a) {
      if (a.length === 0)
        return null;
      var b = a[0], c = a.pop();
      if (c !== b) {
        a[0] = c;
        a:
          for (var d = 0, e = a.length, w = e >>> 1;d < w; ) {
            var m = 2 * (d + 1) - 1, C = a[m], n = m + 1, x = a[n];
            if (0 > g(C, c))
              n < e && 0 > g(x, C) ? (a[d] = x, a[n] = c, d = n) : (a[d] = C, a[m] = c, d = m);
            else if (n < e && 0 > g(x, c))
              a[d] = x, a[n] = c, d = n;
            else
              break a;
          }
      }
      return b;
    }
    function g(a, b) {
      var c = a.sortIndex - b.sortIndex;
      return c !== 0 ? c : a.id - b.id;
    }
    if (typeof performance === "object" && typeof performance.now === "function") {
      l = performance;
      exports.unstable_now = function() {
        return l.now();
      };
    } else {
      p = Date, q = p.now();
      exports.unstable_now = function() {
        return p.now() - q;
      };
    }
    var l;
    var p;
    var q;
    var r = [];
    var t = [];
    var u = 1;
    var v = null;
    var y = 3;
    var z = false;
    var A = false;
    var B = false;
    var D = typeof setTimeout === "function" ? setTimeout : null;
    var E = typeof clearTimeout === "function" ? clearTimeout : null;
    var F = typeof setImmediate !== "undefined" ? setImmediate : null;
    typeof navigator !== "undefined" && navigator.scheduling !== undefined && navigator.scheduling.isInputPending !== undefined && navigator.scheduling.isInputPending.bind(navigator.scheduling);
    function G(a) {
      for (var b = h(t);b !== null; ) {
        if (b.callback === null)
          k(t);
        else if (b.startTime <= a)
          k(t), b.sortIndex = b.expirationTime, f(r, b);
        else
          break;
        b = h(t);
      }
    }
    function H(a) {
      B = false;
      G(a);
      if (!A)
        if (h(r) !== null)
          A = true, I(J);
        else {
          var b = h(t);
          b !== null && K(H, b.startTime - a);
        }
    }
    function J(a, b) {
      A = false;
      B && (B = false, E(L), L = -1);
      z = true;
      var c = y;
      try {
        G(b);
        for (v = h(r);v !== null && (!(v.expirationTime > b) || a && !M()); ) {
          var d = v.callback;
          if (typeof d === "function") {
            v.callback = null;
            y = v.priorityLevel;
            var e = d(v.expirationTime <= b);
            b = exports.unstable_now();
            typeof e === "function" ? v.callback = e : v === h(r) && k(r);
            G(b);
          } else
            k(r);
          v = h(r);
        }
        if (v !== null)
          var w = true;
        else {
          var m = h(t);
          m !== null && K(H, m.startTime - b);
          w = false;
        }
        return w;
      } finally {
        v = null, y = c, z = false;
      }
    }
    var N = false;
    var O = null;
    var L = -1;
    var P = 5;
    var Q = -1;
    function M() {
      return exports.unstable_now() - Q < P ? false : true;
    }
    function R() {
      if (O !== null) {
        var a = exports.unstable_now();
        Q = a;
        var b = true;
        try {
          b = O(true, a);
        } finally {
          b ? S() : (N = false, O = null);
        }
      } else
        N = false;
    }
    var S;
    if (typeof F === "function")
      S = function() {
        F(R);
      };
    else if (typeof MessageChannel !== "undefined") {
      T = new MessageChannel, U = T.port2;
      T.port1.onmessage = R;
      S = function() {
        U.postMessage(null);
      };
    } else
      S = function() {
        D(R, 0);
      };
    var T;
    var U;
    function I(a) {
      O = a;
      N || (N = true, S());
    }
    function K(a, b) {
      L = D(function() {
        a(exports.unstable_now());
      }, b);
    }
    exports.unstable_IdlePriority = 5;
    exports.unstable_ImmediatePriority = 1;
    exports.unstable_LowPriority = 4;
    exports.unstable_NormalPriority = 3;
    exports.unstable_Profiling = null;
    exports.unstable_UserBlockingPriority = 2;
    exports.unstable_cancelCallback = function(a) {
      a.callback = null;
    };
    exports.unstable_continueExecution = function() {
      A || z || (A = true, I(J));
    };
    exports.unstable_forceFrameRate = function(a) {
      0 > a || 125 < a ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P = 0 < a ? Math.floor(1000 / a) : 5;
    };
    exports.unstable_getCurrentPriorityLevel = function() {
      return y;
    };
    exports.unstable_getFirstCallbackNode = function() {
      return h(r);
    };
    exports.unstable_next = function(a) {
      switch (y) {
        case 1:
        case 2:
        case 3:
          var b = 3;
          break;
        default:
          b = y;
      }
      var c = y;
      y = b;
      try {
        return a();
      } finally {
        y = c;
      }
    };
    exports.unstable_pauseExecution = function() {};
    exports.unstable_requestPaint = function() {};
    exports.unstable_runWithPriority = function(a, b) {
      switch (a) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          a = 3;
      }
      var c = y;
      y = a;
      try {
        return b();
      } finally {
        y = c;
      }
    };
    exports.unstable_scheduleCallback = function(a, b, c) {
      var d = exports.unstable_now();
      typeof c === "object" && c !== null ? (c = c.delay, c = typeof c === "number" && 0 < c ? d + c : d) : c = d;
      switch (a) {
        case 1:
          var e = -1;
          break;
        case 2:
          e = 250;
          break;
        case 5:
          e = 1073741823;
          break;
        case 4:
          e = 1e4;
          break;
        default:
          e = 5000;
      }
      e = c + e;
      a = { id: u++, callback: b, priorityLevel: a, startTime: c, expirationTime: e, sortIndex: -1 };
      c > d ? (a.sortIndex = c, f(t, a), h(r) === null && a === h(t) && (B ? (E(L), L = -1) : B = true, K(H, c - d))) : (a.sortIndex = e, f(r, a), A || z || (A = true, I(J)));
      return a;
    };
    exports.unstable_shouldYield = M;
    exports.unstable_wrapCallback = function(a) {
      var b = y;
      return function() {
        var c = y;
        y = b;
        try {
          return a.apply(this, arguments);
        } finally {
          y = c;
        }
      };
    };
  });

  // ../../node_modules/.bun/scheduler@0.23.2/node_modules/scheduler/index.js
  var require_scheduler = __commonJS((exports, module) => {
    if (true) {
      module.exports = require_scheduler_production_min();
    } else {}
  });

  // ../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/cjs/react-reconciler.production.min.js
  var require_react_reconciler_production_min = __commonJS((exports, module) => {
    module.exports = function $$$reconciler($$$hostConfig) {
      var exports2 = {};
      var aa = require_react(), ba = require_scheduler(), ca = Object.assign;
      function n(a) {
        for (var b = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c = 1;c < arguments.length; c++)
          b += "&args[]=" + encodeURIComponent(arguments[c]);
        return "Minified React error #" + a + "; visit " + b + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      var da = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, ea = Symbol.for("react.element"), fa = Symbol.for("react.portal"), ha = Symbol.for("react.fragment"), ia = Symbol.for("react.strict_mode"), ja = Symbol.for("react.profiler"), ka = Symbol.for("react.provider"), la = Symbol.for("react.context"), ma = Symbol.for("react.forward_ref"), na = Symbol.for("react.suspense"), oa = Symbol.for("react.suspense_list"), pa = Symbol.for("react.memo"), qa = Symbol.for("react.lazy");
      Symbol.for("react.scope");
      Symbol.for("react.debug_trace_mode");
      var ra = Symbol.for("react.offscreen");
      Symbol.for("react.legacy_hidden");
      Symbol.for("react.cache");
      Symbol.for("react.tracing_marker");
      var sa = Symbol.iterator;
      function ta(a) {
        if (a === null || typeof a !== "object")
          return null;
        a = sa && a[sa] || a["@@iterator"];
        return typeof a === "function" ? a : null;
      }
      function ua(a) {
        if (a == null)
          return null;
        if (typeof a === "function")
          return a.displayName || a.name || null;
        if (typeof a === "string")
          return a;
        switch (a) {
          case ha:
            return "Fragment";
          case fa:
            return "Portal";
          case ja:
            return "Profiler";
          case ia:
            return "StrictMode";
          case na:
            return "Suspense";
          case oa:
            return "SuspenseList";
        }
        if (typeof a === "object")
          switch (a.$$typeof) {
            case la:
              return (a.displayName || "Context") + ".Consumer";
            case ka:
              return (a._context.displayName || "Context") + ".Provider";
            case ma:
              var b = a.render;
              a = a.displayName;
              a || (a = b.displayName || b.name || "", a = a !== "" ? "ForwardRef(" + a + ")" : "ForwardRef");
              return a;
            case pa:
              return b = a.displayName || null, b !== null ? b : ua(a.type) || "Memo";
            case qa:
              b = a._payload;
              a = a._init;
              try {
                return ua(a(b));
              } catch (c) {}
          }
        return null;
      }
      function va(a) {
        var b = a.type;
        switch (a.tag) {
          case 24:
            return "Cache";
          case 9:
            return (b.displayName || "Context") + ".Consumer";
          case 10:
            return (b._context.displayName || "Context") + ".Provider";
          case 18:
            return "DehydratedFragment";
          case 11:
            return a = b.render, a = a.displayName || a.name || "", b.displayName || (a !== "" ? "ForwardRef(" + a + ")" : "ForwardRef");
          case 7:
            return "Fragment";
          case 5:
            return b;
          case 4:
            return "Portal";
          case 3:
            return "Root";
          case 6:
            return "Text";
          case 16:
            return ua(b);
          case 8:
            return b === ia ? "StrictMode" : "Mode";
          case 22:
            return "Offscreen";
          case 12:
            return "Profiler";
          case 21:
            return "Scope";
          case 13:
            return "Suspense";
          case 19:
            return "SuspenseList";
          case 25:
            return "TracingMarker";
          case 1:
          case 0:
          case 17:
          case 2:
          case 14:
          case 15:
            if (typeof b === "function")
              return b.displayName || b.name || null;
            if (typeof b === "string")
              return b;
        }
        return null;
      }
      function wa(a) {
        var b = a, c = a;
        if (a.alternate)
          for (;b.return; )
            b = b.return;
        else {
          a = b;
          do
            b = a, (b.flags & 4098) !== 0 && (c = b.return), a = b.return;
          while (a);
        }
        return b.tag === 3 ? c : null;
      }
      function xa(a) {
        if (wa(a) !== a)
          throw Error(n(188));
      }
      function za(a) {
        var b = a.alternate;
        if (!b) {
          b = wa(a);
          if (b === null)
            throw Error(n(188));
          return b !== a ? null : a;
        }
        for (var c = a, d = b;; ) {
          var e = c.return;
          if (e === null)
            break;
          var f = e.alternate;
          if (f === null) {
            d = e.return;
            if (d !== null) {
              c = d;
              continue;
            }
            break;
          }
          if (e.child === f.child) {
            for (f = e.child;f; ) {
              if (f === c)
                return xa(e), a;
              if (f === d)
                return xa(e), b;
              f = f.sibling;
            }
            throw Error(n(188));
          }
          if (c.return !== d.return)
            c = e, d = f;
          else {
            for (var g = false, h = e.child;h; ) {
              if (h === c) {
                g = true;
                c = e;
                d = f;
                break;
              }
              if (h === d) {
                g = true;
                d = e;
                c = f;
                break;
              }
              h = h.sibling;
            }
            if (!g) {
              for (h = f.child;h; ) {
                if (h === c) {
                  g = true;
                  c = f;
                  d = e;
                  break;
                }
                if (h === d) {
                  g = true;
                  d = f;
                  c = e;
                  break;
                }
                h = h.sibling;
              }
              if (!g)
                throw Error(n(189));
            }
          }
          if (c.alternate !== d)
            throw Error(n(190));
        }
        if (c.tag !== 3)
          throw Error(n(188));
        return c.stateNode.current === c ? a : b;
      }
      function Aa(a) {
        a = za(a);
        return a !== null ? Ba(a) : null;
      }
      function Ba(a) {
        if (a.tag === 5 || a.tag === 6)
          return a;
        for (a = a.child;a !== null; ) {
          var b = Ba(a);
          if (b !== null)
            return b;
          a = a.sibling;
        }
        return null;
      }
      function Ca(a) {
        if (a.tag === 5 || a.tag === 6)
          return a;
        for (a = a.child;a !== null; ) {
          if (a.tag !== 4) {
            var b = Ca(a);
            if (b !== null)
              return b;
          }
          a = a.sibling;
        }
        return null;
      }
      var Da = Array.isArray, Ea = $$$hostConfig.getPublicInstance, Fa = $$$hostConfig.getRootHostContext, Ga = $$$hostConfig.getChildHostContext, Ha = $$$hostConfig.prepareForCommit, Ia = $$$hostConfig.resetAfterCommit, Ja = $$$hostConfig.createInstance, Ka = $$$hostConfig.appendInitialChild, La = $$$hostConfig.finalizeInitialChildren, Ma = $$$hostConfig.prepareUpdate, Na = $$$hostConfig.shouldSetTextContent, Oa = $$$hostConfig.createTextInstance, Pa = $$$hostConfig.scheduleTimeout, Qa = $$$hostConfig.cancelTimeout, Ra = $$$hostConfig.noTimeout, Sa = $$$hostConfig.isPrimaryRenderer, Ta = $$$hostConfig.supportsMutation, Ua = $$$hostConfig.supportsPersistence, Va = $$$hostConfig.supportsHydration, Wa = $$$hostConfig.getInstanceFromNode, Xa = $$$hostConfig.preparePortalMount, Ya = $$$hostConfig.getCurrentEventPriority, Za = $$$hostConfig.detachDeletedInstance, $a = $$$hostConfig.supportsMicrotasks, ab = $$$hostConfig.scheduleMicrotask, bb = $$$hostConfig.supportsTestSelectors, cb = $$$hostConfig.findFiberRoot, db = $$$hostConfig.getBoundingRect, eb = $$$hostConfig.getTextContent, fb = $$$hostConfig.isHiddenSubtree, gb = $$$hostConfig.matchAccessibilityRole, hb = $$$hostConfig.setFocusIfFocusable, ib = $$$hostConfig.setupIntersectionObserver, jb = $$$hostConfig.appendChild, kb = $$$hostConfig.appendChildToContainer, lb = $$$hostConfig.commitTextUpdate, mb = $$$hostConfig.commitMount, nb = $$$hostConfig.commitUpdate, ob = $$$hostConfig.insertBefore, pb = $$$hostConfig.insertInContainerBefore, qb = $$$hostConfig.removeChild, rb = $$$hostConfig.removeChildFromContainer, sb = $$$hostConfig.resetTextContent, tb = $$$hostConfig.hideInstance, ub = $$$hostConfig.hideTextInstance, vb = $$$hostConfig.unhideInstance, wb = $$$hostConfig.unhideTextInstance, xb = $$$hostConfig.clearContainer, yb = $$$hostConfig.cloneInstance, zb = $$$hostConfig.createContainerChildSet, Ab = $$$hostConfig.appendChildToContainerChildSet, Bb = $$$hostConfig.finalizeContainerChildren, Cb = $$$hostConfig.replaceContainerChildren, Eb = $$$hostConfig.cloneHiddenInstance, Fb = $$$hostConfig.cloneHiddenTextInstance, Gb = $$$hostConfig.canHydrateInstance, Hb = $$$hostConfig.canHydrateTextInstance, Ib = $$$hostConfig.canHydrateSuspenseInstance, Jb = $$$hostConfig.isSuspenseInstancePending, Kb = $$$hostConfig.isSuspenseInstanceFallback, Lb = $$$hostConfig.getSuspenseInstanceFallbackErrorDetails, Mb = $$$hostConfig.registerSuspenseInstanceRetry, Nb = $$$hostConfig.getNextHydratableSibling, Ob = $$$hostConfig.getFirstHydratableChild, Pb = $$$hostConfig.getFirstHydratableChildWithinContainer, Qb = $$$hostConfig.getFirstHydratableChildWithinSuspenseInstance, Rb = $$$hostConfig.hydrateInstance, Sb = $$$hostConfig.hydrateTextInstance, Tb = $$$hostConfig.hydrateSuspenseInstance, Ub = $$$hostConfig.getNextHydratableInstanceAfterSuspenseInstance, Vb = $$$hostConfig.commitHydratedContainer, Wb = $$$hostConfig.commitHydratedSuspenseInstance, Xb = $$$hostConfig.clearSuspenseBoundary, Yb = $$$hostConfig.clearSuspenseBoundaryFromContainer, Zb = $$$hostConfig.shouldDeleteUnhydratedTailInstances, $b = $$$hostConfig.didNotMatchHydratedContainerTextInstance, ac = $$$hostConfig.didNotMatchHydratedTextInstance, bc;
      function cc(a) {
        if (bc === undefined)
          try {
            throw Error();
          } catch (c) {
            var b = c.stack.trim().match(/\n( *(at )?)/);
            bc = b && b[1] || "";
          }
        return `
` + bc + a;
      }
      var dc = false;
      function ec(a, b) {
        if (!a || dc)
          return "";
        dc = true;
        var c = Error.prepareStackTrace;
        Error.prepareStackTrace = undefined;
        try {
          if (b)
            if (b = function() {
              throw Error();
            }, Object.defineProperty(b.prototype, "props", { set: function() {
              throw Error();
            } }), typeof Reflect === "object" && Reflect.construct) {
              try {
                Reflect.construct(b, []);
              } catch (l) {
                var d = l;
              }
              Reflect.construct(a, [], b);
            } else {
              try {
                b.call();
              } catch (l) {
                d = l;
              }
              a.call(b.prototype);
            }
          else {
            try {
              throw Error();
            } catch (l) {
              d = l;
            }
            a();
          }
        } catch (l) {
          if (l && d && typeof l.stack === "string") {
            for (var e = l.stack.split(`
`), f = d.stack.split(`
`), g = e.length - 1, h = f.length - 1;1 <= g && 0 <= h && e[g] !== f[h]; )
              h--;
            for (;1 <= g && 0 <= h; g--, h--)
              if (e[g] !== f[h]) {
                if (g !== 1 || h !== 1) {
                  do
                    if (g--, h--, 0 > h || e[g] !== f[h]) {
                      var k = `
` + e[g].replace(" at new ", " at ");
                      a.displayName && k.includes("<anonymous>") && (k = k.replace("<anonymous>", a.displayName));
                      return k;
                    }
                  while (1 <= g && 0 <= h);
                }
                break;
              }
          }
        } finally {
          dc = false, Error.prepareStackTrace = c;
        }
        return (a = a ? a.displayName || a.name : "") ? cc(a) : "";
      }
      var fc = Object.prototype.hasOwnProperty, gc = [], hc = -1;
      function ic(a) {
        return { current: a };
      }
      function q(a) {
        0 > hc || (a.current = gc[hc], gc[hc] = null, hc--);
      }
      function v(a, b) {
        hc++;
        gc[hc] = a.current;
        a.current = b;
      }
      var jc = {}, x = ic(jc), z = ic(false), kc = jc;
      function mc(a, b) {
        var c = a.type.contextTypes;
        if (!c)
          return jc;
        var d = a.stateNode;
        if (d && d.__reactInternalMemoizedUnmaskedChildContext === b)
          return d.__reactInternalMemoizedMaskedChildContext;
        var e = {}, f;
        for (f in c)
          e[f] = b[f];
        d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b, a.__reactInternalMemoizedMaskedChildContext = e);
        return e;
      }
      function A(a) {
        a = a.childContextTypes;
        return a !== null && a !== undefined;
      }
      function nc() {
        q(z);
        q(x);
      }
      function oc(a, b, c) {
        if (x.current !== jc)
          throw Error(n(168));
        v(x, b);
        v(z, c);
      }
      function pc(a, b, c) {
        var d = a.stateNode;
        b = b.childContextTypes;
        if (typeof d.getChildContext !== "function")
          return c;
        d = d.getChildContext();
        for (var e in d)
          if (!(e in b))
            throw Error(n(108, va(a) || "Unknown", e));
        return ca({}, c, d);
      }
      function qc(a) {
        a = (a = a.stateNode) && a.__reactInternalMemoizedMergedChildContext || jc;
        kc = x.current;
        v(x, a);
        v(z, z.current);
        return true;
      }
      function rc(a, b, c) {
        var d = a.stateNode;
        if (!d)
          throw Error(n(169));
        c ? (a = pc(a, b, kc), d.__reactInternalMemoizedMergedChildContext = a, q(z), q(x), v(x, a)) : q(z);
        v(z, c);
      }
      var tc = Math.clz32 ? Math.clz32 : sc, uc = Math.log, vc = Math.LN2;
      function sc(a) {
        a >>>= 0;
        return a === 0 ? 32 : 31 - (uc(a) / vc | 0) | 0;
      }
      var wc = 64, xc = 4194304;
      function yc(a) {
        switch (a & -a) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 4:
            return 4;
          case 8:
            return 8;
          case 16:
            return 16;
          case 32:
            return 32;
          case 64:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return a & 4194240;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
          case 67108864:
            return a & 130023424;
          case 134217728:
            return 134217728;
          case 268435456:
            return 268435456;
          case 536870912:
            return 536870912;
          case 1073741824:
            return 1073741824;
          default:
            return a;
        }
      }
      function zc(a, b) {
        var c = a.pendingLanes;
        if (c === 0)
          return 0;
        var d = 0, e = a.suspendedLanes, f = a.pingedLanes, g = c & 268435455;
        if (g !== 0) {
          var h = g & ~e;
          h !== 0 ? d = yc(h) : (f &= g, f !== 0 && (d = yc(f)));
        } else
          g = c & ~e, g !== 0 ? d = yc(g) : f !== 0 && (d = yc(f));
        if (d === 0)
          return 0;
        if (b !== 0 && b !== d && (b & e) === 0 && (e = d & -d, f = b & -b, e >= f || e === 16 && (f & 4194240) !== 0))
          return b;
        (d & 4) !== 0 && (d |= c & 16);
        b = a.entangledLanes;
        if (b !== 0)
          for (a = a.entanglements, b &= d;0 < b; )
            c = 31 - tc(b), e = 1 << c, d |= a[c], b &= ~e;
        return d;
      }
      function Ac(a, b) {
        switch (a) {
          case 1:
          case 2:
          case 4:
            return b + 250;
          case 8:
          case 16:
          case 32:
          case 64:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return b + 5000;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
          case 67108864:
            return -1;
          case 134217728:
          case 268435456:
          case 536870912:
          case 1073741824:
            return -1;
          default:
            return -1;
        }
      }
      function Bc(a, b) {
        for (var { suspendedLanes: c, pingedLanes: d, expirationTimes: e, pendingLanes: f } = a;0 < f; ) {
          var g = 31 - tc(f), h = 1 << g, k = e[g];
          if (k === -1) {
            if ((h & c) === 0 || (h & d) !== 0)
              e[g] = Ac(h, b);
          } else
            k <= b && (a.expiredLanes |= h);
          f &= ~h;
        }
      }
      function Cc(a) {
        a = a.pendingLanes & -1073741825;
        return a !== 0 ? a : a & 1073741824 ? 1073741824 : 0;
      }
      function Dc() {
        var a = wc;
        wc <<= 1;
        (wc & 4194240) === 0 && (wc = 64);
        return a;
      }
      function Ec(a) {
        for (var b = [], c = 0;31 > c; c++)
          b.push(a);
        return b;
      }
      function Fc(a, b, c) {
        a.pendingLanes |= b;
        b !== 536870912 && (a.suspendedLanes = 0, a.pingedLanes = 0);
        a = a.eventTimes;
        b = 31 - tc(b);
        a[b] = c;
      }
      function Gc(a, b) {
        var c = a.pendingLanes & ~b;
        a.pendingLanes = b;
        a.suspendedLanes = 0;
        a.pingedLanes = 0;
        a.expiredLanes &= b;
        a.mutableReadLanes &= b;
        a.entangledLanes &= b;
        b = a.entanglements;
        var d = a.eventTimes;
        for (a = a.expirationTimes;0 < c; ) {
          var e = 31 - tc(c), f = 1 << e;
          b[e] = 0;
          d[e] = -1;
          a[e] = -1;
          c &= ~f;
        }
      }
      function Hc(a, b) {
        var c = a.entangledLanes |= b;
        for (a = a.entanglements;c; ) {
          var d = 31 - tc(c), e = 1 << d;
          e & b | a[d] & b && (a[d] |= b);
          c &= ~e;
        }
      }
      var C = 0;
      function Ic(a) {
        a &= -a;
        return 1 < a ? 4 < a ? (a & 268435455) !== 0 ? 16 : 536870912 : 4 : 1;
      }
      var { unstable_scheduleCallback: Jc, unstable_cancelCallback: Kc, unstable_shouldYield: Lc, unstable_requestPaint: Mc, unstable_now: D, unstable_ImmediatePriority: Nc, unstable_UserBlockingPriority: Oc, unstable_NormalPriority: Pc, unstable_IdlePriority: Qc } = ba, Rc = null, Sc = null;
      function Tc(a) {
        if (Sc && typeof Sc.onCommitFiberRoot === "function")
          try {
            Sc.onCommitFiberRoot(Rc, a, undefined, (a.current.flags & 128) === 128);
          } catch (b) {}
      }
      function Uc(a, b) {
        return a === b && (a !== 0 || 1 / a === 1 / b) || a !== a && b !== b;
      }
      var Vc = typeof Object.is === "function" ? Object.is : Uc, Wc = null, Xc = false, Yc = false;
      function Zc(a) {
        Wc === null ? Wc = [a] : Wc.push(a);
      }
      function $c(a) {
        Xc = true;
        Zc(a);
      }
      function ad() {
        if (!Yc && Wc !== null) {
          Yc = true;
          var a = 0, b = C;
          try {
            var c = Wc;
            for (C = 1;a < c.length; a++) {
              var d = c[a];
              do
                d = d(true);
              while (d !== null);
            }
            Wc = null;
            Xc = false;
          } catch (e) {
            throw Wc !== null && (Wc = Wc.slice(a + 1)), Jc(Nc, ad), e;
          } finally {
            C = b, Yc = false;
          }
        }
        return null;
      }
      var bd = [], cd = 0, dd = null, ed = 0, fd = [], gd = 0, hd = null, id = 1, jd = "";
      function kd(a, b) {
        bd[cd++] = ed;
        bd[cd++] = dd;
        dd = a;
        ed = b;
      }
      function ld(a, b, c) {
        fd[gd++] = id;
        fd[gd++] = jd;
        fd[gd++] = hd;
        hd = a;
        var d = id;
        a = jd;
        var e = 32 - tc(d) - 1;
        d &= ~(1 << e);
        c += 1;
        var f = 32 - tc(b) + e;
        if (30 < f) {
          var g = e - e % 5;
          f = (d & (1 << g) - 1).toString(32);
          d >>= g;
          e -= g;
          id = 1 << 32 - tc(b) + e | c << e | d;
          jd = f + a;
        } else
          id = 1 << f | c << e | d, jd = a;
      }
      function md(a) {
        a.return !== null && (kd(a, 1), ld(a, 1, 0));
      }
      function nd(a) {
        for (;a === dd; )
          dd = bd[--cd], bd[cd] = null, ed = bd[--cd], bd[cd] = null;
        for (;a === hd; )
          hd = fd[--gd], fd[gd] = null, jd = fd[--gd], fd[gd] = null, id = fd[--gd], fd[gd] = null;
      }
      var od = null, pd = null, F = false, qd = false, rd = null;
      function sd(a, b) {
        var c = td(5, null, null, 0);
        c.elementType = "DELETED";
        c.stateNode = b;
        c.return = a;
        b = a.deletions;
        b === null ? (a.deletions = [c], a.flags |= 16) : b.push(c);
      }
      function ud(a, b) {
        switch (a.tag) {
          case 5:
            return b = Gb(b, a.type, a.pendingProps), b !== null ? (a.stateNode = b, od = a, pd = Ob(b), true) : false;
          case 6:
            return b = Hb(b, a.pendingProps), b !== null ? (a.stateNode = b, od = a, pd = null, true) : false;
          case 13:
            b = Ib(b);
            if (b !== null) {
              var c = hd !== null ? { id, overflow: jd } : null;
              a.memoizedState = { dehydrated: b, treeContext: c, retryLane: 1073741824 };
              c = td(18, null, null, 0);
              c.stateNode = b;
              c.return = a;
              a.child = c;
              od = a;
              pd = null;
              return true;
            }
            return false;
          default:
            return false;
        }
      }
      function vd(a) {
        return (a.mode & 1) !== 0 && (a.flags & 128) === 0;
      }
      function wd(a) {
        if (F) {
          var b = pd;
          if (b) {
            var c = b;
            if (!ud(a, b)) {
              if (vd(a))
                throw Error(n(418));
              b = Nb(c);
              var d = od;
              b && ud(a, b) ? sd(d, c) : (a.flags = a.flags & -4097 | 2, F = false, od = a);
            }
          } else {
            if (vd(a))
              throw Error(n(418));
            a.flags = a.flags & -4097 | 2;
            F = false;
            od = a;
          }
        }
      }
      function xd(a) {
        for (a = a.return;a !== null && a.tag !== 5 && a.tag !== 3 && a.tag !== 13; )
          a = a.return;
        od = a;
      }
      function yd(a) {
        if (!Va || a !== od)
          return false;
        if (!F)
          return xd(a), F = true, false;
        if (a.tag !== 3 && (a.tag !== 5 || Zb(a.type) && !Na(a.type, a.memoizedProps))) {
          var b = pd;
          if (b) {
            if (vd(a))
              throw zd(), Error(n(418));
            for (;b; )
              sd(a, b), b = Nb(b);
          }
        }
        xd(a);
        if (a.tag === 13) {
          if (!Va)
            throw Error(n(316));
          a = a.memoizedState;
          a = a !== null ? a.dehydrated : null;
          if (!a)
            throw Error(n(317));
          pd = Ub(a);
        } else
          pd = od ? Nb(a.stateNode) : null;
        return true;
      }
      function zd() {
        for (var a = pd;a; )
          a = Nb(a);
      }
      function Ad() {
        Va && (pd = od = null, qd = F = false);
      }
      function Bd(a) {
        rd === null ? rd = [a] : rd.push(a);
      }
      var Cd = da.ReactCurrentBatchConfig;
      function Dd(a, b) {
        if (Vc(a, b))
          return true;
        if (typeof a !== "object" || a === null || typeof b !== "object" || b === null)
          return false;
        var c = Object.keys(a), d = Object.keys(b);
        if (c.length !== d.length)
          return false;
        for (d = 0;d < c.length; d++) {
          var e = c[d];
          if (!fc.call(b, e) || !Vc(a[e], b[e]))
            return false;
        }
        return true;
      }
      function Ed(a) {
        switch (a.tag) {
          case 5:
            return cc(a.type);
          case 16:
            return cc("Lazy");
          case 13:
            return cc("Suspense");
          case 19:
            return cc("SuspenseList");
          case 0:
          case 2:
          case 15:
            return a = ec(a.type, false), a;
          case 11:
            return a = ec(a.type.render, false), a;
          case 1:
            return a = ec(a.type, true), a;
          default:
            return "";
        }
      }
      function Fd(a, b, c) {
        a = c.ref;
        if (a !== null && typeof a !== "function" && typeof a !== "object") {
          if (c._owner) {
            c = c._owner;
            if (c) {
              if (c.tag !== 1)
                throw Error(n(309));
              var d = c.stateNode;
            }
            if (!d)
              throw Error(n(147, a));
            var e = d, f = "" + a;
            if (b !== null && b.ref !== null && typeof b.ref === "function" && b.ref._stringRef === f)
              return b.ref;
            b = function(a2) {
              var b2 = e.refs;
              a2 === null ? delete b2[f] : b2[f] = a2;
            };
            b._stringRef = f;
            return b;
          }
          if (typeof a !== "string")
            throw Error(n(284));
          if (!c._owner)
            throw Error(n(290, a));
        }
        return a;
      }
      function Gd(a, b) {
        a = Object.prototype.toString.call(b);
        throw Error(n(31, a === "[object Object]" ? "object with keys {" + Object.keys(b).join(", ") + "}" : a));
      }
      function Hd(a) {
        var b = a._init;
        return b(a._payload);
      }
      function Id(a) {
        function b(b2, c2) {
          if (a) {
            var d2 = b2.deletions;
            d2 === null ? (b2.deletions = [c2], b2.flags |= 16) : d2.push(c2);
          }
        }
        function c(c2, d2) {
          if (!a)
            return null;
          for (;d2 !== null; )
            b(c2, d2), d2 = d2.sibling;
          return null;
        }
        function d(a2, b2) {
          for (a2 = new Map;b2 !== null; )
            b2.key !== null ? a2.set(b2.key, b2) : a2.set(b2.index, b2), b2 = b2.sibling;
          return a2;
        }
        function e(a2, b2) {
          a2 = Jd(a2, b2);
          a2.index = 0;
          a2.sibling = null;
          return a2;
        }
        function f(b2, c2, d2) {
          b2.index = d2;
          if (!a)
            return b2.flags |= 1048576, c2;
          d2 = b2.alternate;
          if (d2 !== null)
            return d2 = d2.index, d2 < c2 ? (b2.flags |= 2, c2) : d2;
          b2.flags |= 2;
          return c2;
        }
        function g(b2) {
          a && b2.alternate === null && (b2.flags |= 2);
          return b2;
        }
        function h(a2, b2, c2, d2) {
          if (b2 === null || b2.tag !== 6)
            return b2 = Kd(c2, a2.mode, d2), b2.return = a2, b2;
          b2 = e(b2, c2);
          b2.return = a2;
          return b2;
        }
        function k(a2, b2, c2, d2) {
          var f2 = c2.type;
          if (f2 === ha)
            return m(a2, b2, c2.props.children, d2, c2.key);
          if (b2 !== null && (b2.elementType === f2 || typeof f2 === "object" && f2 !== null && f2.$$typeof === qa && Hd(f2) === b2.type))
            return d2 = e(b2, c2.props), d2.ref = Fd(a2, b2, c2), d2.return = a2, d2;
          d2 = Ld(c2.type, c2.key, c2.props, null, a2.mode, d2);
          d2.ref = Fd(a2, b2, c2);
          d2.return = a2;
          return d2;
        }
        function l(a2, b2, c2, d2) {
          if (b2 === null || b2.tag !== 4 || b2.stateNode.containerInfo !== c2.containerInfo || b2.stateNode.implementation !== c2.implementation)
            return b2 = Md(c2, a2.mode, d2), b2.return = a2, b2;
          b2 = e(b2, c2.children || []);
          b2.return = a2;
          return b2;
        }
        function m(a2, b2, c2, d2, f2) {
          if (b2 === null || b2.tag !== 7)
            return b2 = Nd(c2, a2.mode, d2, f2), b2.return = a2, b2;
          b2 = e(b2, c2);
          b2.return = a2;
          return b2;
        }
        function r(a2, b2, c2) {
          if (typeof b2 === "string" && b2 !== "" || typeof b2 === "number")
            return b2 = Kd("" + b2, a2.mode, c2), b2.return = a2, b2;
          if (typeof b2 === "object" && b2 !== null) {
            switch (b2.$$typeof) {
              case ea:
                return c2 = Ld(b2.type, b2.key, b2.props, null, a2.mode, c2), c2.ref = Fd(a2, null, b2), c2.return = a2, c2;
              case fa:
                return b2 = Md(b2, a2.mode, c2), b2.return = a2, b2;
              case qa:
                var d2 = b2._init;
                return r(a2, d2(b2._payload), c2);
            }
            if (Da(b2) || ta(b2))
              return b2 = Nd(b2, a2.mode, c2, null), b2.return = a2, b2;
            Gd(a2, b2);
          }
          return null;
        }
        function p(a2, b2, c2, d2) {
          var e2 = b2 !== null ? b2.key : null;
          if (typeof c2 === "string" && c2 !== "" || typeof c2 === "number")
            return e2 !== null ? null : h(a2, b2, "" + c2, d2);
          if (typeof c2 === "object" && c2 !== null) {
            switch (c2.$$typeof) {
              case ea:
                return c2.key === e2 ? k(a2, b2, c2, d2) : null;
              case fa:
                return c2.key === e2 ? l(a2, b2, c2, d2) : null;
              case qa:
                return e2 = c2._init, p(a2, b2, e2(c2._payload), d2);
            }
            if (Da(c2) || ta(c2))
              return e2 !== null ? null : m(a2, b2, c2, d2, null);
            Gd(a2, c2);
          }
          return null;
        }
        function B(a2, b2, c2, d2, e2) {
          if (typeof d2 === "string" && d2 !== "" || typeof d2 === "number")
            return a2 = a2.get(c2) || null, h(b2, a2, "" + d2, e2);
          if (typeof d2 === "object" && d2 !== null) {
            switch (d2.$$typeof) {
              case ea:
                return a2 = a2.get(d2.key === null ? c2 : d2.key) || null, k(b2, a2, d2, e2);
              case fa:
                return a2 = a2.get(d2.key === null ? c2 : d2.key) || null, l(b2, a2, d2, e2);
              case qa:
                var f2 = d2._init;
                return B(a2, b2, c2, f2(d2._payload), e2);
            }
            if (Da(d2) || ta(d2))
              return a2 = a2.get(c2) || null, m(b2, a2, d2, e2, null);
            Gd(b2, d2);
          }
          return null;
        }
        function w(e2, g2, h2, k2) {
          for (var l2 = null, m2 = null, u = g2, t = g2 = 0, E = null;u !== null && t < h2.length; t++) {
            u.index > t ? (E = u, u = null) : E = u.sibling;
            var y = p(e2, u, h2[t], k2);
            if (y === null) {
              u === null && (u = E);
              break;
            }
            a && u && y.alternate === null && b(e2, u);
            g2 = f(y, g2, t);
            m2 === null ? l2 = y : m2.sibling = y;
            m2 = y;
            u = E;
          }
          if (t === h2.length)
            return c(e2, u), F && kd(e2, t), l2;
          if (u === null) {
            for (;t < h2.length; t++)
              u = r(e2, h2[t], k2), u !== null && (g2 = f(u, g2, t), m2 === null ? l2 = u : m2.sibling = u, m2 = u);
            F && kd(e2, t);
            return l2;
          }
          for (u = d(e2, u);t < h2.length; t++)
            E = B(u, e2, t, h2[t], k2), E !== null && (a && E.alternate !== null && u.delete(E.key === null ? t : E.key), g2 = f(E, g2, t), m2 === null ? l2 = E : m2.sibling = E, m2 = E);
          a && u.forEach(function(a2) {
            return b(e2, a2);
          });
          F && kd(e2, t);
          return l2;
        }
        function Y(e2, g2, h2, k2) {
          var l2 = ta(h2);
          if (typeof l2 !== "function")
            throw Error(n(150));
          h2 = l2.call(h2);
          if (h2 == null)
            throw Error(n(151));
          for (var u = l2 = null, m2 = g2, t = g2 = 0, E = null, y = h2.next();m2 !== null && !y.done; t++, y = h2.next()) {
            m2.index > t ? (E = m2, m2 = null) : E = m2.sibling;
            var w2 = p(e2, m2, y.value, k2);
            if (w2 === null) {
              m2 === null && (m2 = E);
              break;
            }
            a && m2 && w2.alternate === null && b(e2, m2);
            g2 = f(w2, g2, t);
            u === null ? l2 = w2 : u.sibling = w2;
            u = w2;
            m2 = E;
          }
          if (y.done)
            return c(e2, m2), F && kd(e2, t), l2;
          if (m2 === null) {
            for (;!y.done; t++, y = h2.next())
              y = r(e2, y.value, k2), y !== null && (g2 = f(y, g2, t), u === null ? l2 = y : u.sibling = y, u = y);
            F && kd(e2, t);
            return l2;
          }
          for (m2 = d(e2, m2);!y.done; t++, y = h2.next())
            y = B(m2, e2, t, y.value, k2), y !== null && (a && y.alternate !== null && m2.delete(y.key === null ? t : y.key), g2 = f(y, g2, t), u === null ? l2 = y : u.sibling = y, u = y);
          a && m2.forEach(function(a2) {
            return b(e2, a2);
          });
          F && kd(e2, t);
          return l2;
        }
        function ya(a2, d2, f2, h2) {
          typeof f2 === "object" && f2 !== null && f2.type === ha && f2.key === null && (f2 = f2.props.children);
          if (typeof f2 === "object" && f2 !== null) {
            switch (f2.$$typeof) {
              case ea:
                a: {
                  for (var k2 = f2.key, l2 = d2;l2 !== null; ) {
                    if (l2.key === k2) {
                      k2 = f2.type;
                      if (k2 === ha) {
                        if (l2.tag === 7) {
                          c(a2, l2.sibling);
                          d2 = e(l2, f2.props.children);
                          d2.return = a2;
                          a2 = d2;
                          break a;
                        }
                      } else if (l2.elementType === k2 || typeof k2 === "object" && k2 !== null && k2.$$typeof === qa && Hd(k2) === l2.type) {
                        c(a2, l2.sibling);
                        d2 = e(l2, f2.props);
                        d2.ref = Fd(a2, l2, f2);
                        d2.return = a2;
                        a2 = d2;
                        break a;
                      }
                      c(a2, l2);
                      break;
                    } else
                      b(a2, l2);
                    l2 = l2.sibling;
                  }
                  f2.type === ha ? (d2 = Nd(f2.props.children, a2.mode, h2, f2.key), d2.return = a2, a2 = d2) : (h2 = Ld(f2.type, f2.key, f2.props, null, a2.mode, h2), h2.ref = Fd(a2, d2, f2), h2.return = a2, a2 = h2);
                }
                return g(a2);
              case fa:
                a: {
                  for (l2 = f2.key;d2 !== null; ) {
                    if (d2.key === l2)
                      if (d2.tag === 4 && d2.stateNode.containerInfo === f2.containerInfo && d2.stateNode.implementation === f2.implementation) {
                        c(a2, d2.sibling);
                        d2 = e(d2, f2.children || []);
                        d2.return = a2;
                        a2 = d2;
                        break a;
                      } else {
                        c(a2, d2);
                        break;
                      }
                    else
                      b(a2, d2);
                    d2 = d2.sibling;
                  }
                  d2 = Md(f2, a2.mode, h2);
                  d2.return = a2;
                  a2 = d2;
                }
                return g(a2);
              case qa:
                return l2 = f2._init, ya(a2, d2, l2(f2._payload), h2);
            }
            if (Da(f2))
              return w(a2, d2, f2, h2);
            if (ta(f2))
              return Y(a2, d2, f2, h2);
            Gd(a2, f2);
          }
          return typeof f2 === "string" && f2 !== "" || typeof f2 === "number" ? (f2 = "" + f2, d2 !== null && d2.tag === 6 ? (c(a2, d2.sibling), d2 = e(d2, f2), d2.return = a2, a2 = d2) : (c(a2, d2), d2 = Kd(f2, a2.mode, h2), d2.return = a2, a2 = d2), g(a2)) : c(a2, d2);
        }
        return ya;
      }
      var Od = Id(true), Pd = Id(false), Qd = ic(null), Rd = null, Sd = null, Td = null;
      function Ud() {
        Td = Sd = Rd = null;
      }
      function Vd(a, b, c) {
        Sa ? (v(Qd, b._currentValue), b._currentValue = c) : (v(Qd, b._currentValue2), b._currentValue2 = c);
      }
      function Wd(a) {
        var b = Qd.current;
        q(Qd);
        Sa ? a._currentValue = b : a._currentValue2 = b;
      }
      function Xd(a, b, c) {
        for (;a !== null; ) {
          var d = a.alternate;
          (a.childLanes & b) !== b ? (a.childLanes |= b, d !== null && (d.childLanes |= b)) : d !== null && (d.childLanes & b) !== b && (d.childLanes |= b);
          if (a === c)
            break;
          a = a.return;
        }
      }
      function Yd(a, b) {
        Rd = a;
        Td = Sd = null;
        a = a.dependencies;
        a !== null && a.firstContext !== null && ((a.lanes & b) !== 0 && (G = true), a.firstContext = null);
      }
      function Zd(a) {
        var b = Sa ? a._currentValue : a._currentValue2;
        if (Td !== a)
          if (a = { context: a, memoizedValue: b, next: null }, Sd === null) {
            if (Rd === null)
              throw Error(n(308));
            Sd = a;
            Rd.dependencies = { lanes: 0, firstContext: a };
          } else
            Sd = Sd.next = a;
        return b;
      }
      var $d = null;
      function ae(a) {
        $d === null ? $d = [a] : $d.push(a);
      }
      function be(a, b, c, d) {
        var e = b.interleaved;
        e === null ? (c.next = c, ae(b)) : (c.next = e.next, e.next = c);
        b.interleaved = c;
        return ce(a, d);
      }
      function ce(a, b) {
        a.lanes |= b;
        var c = a.alternate;
        c !== null && (c.lanes |= b);
        c = a;
        for (a = a.return;a !== null; )
          a.childLanes |= b, c = a.alternate, c !== null && (c.childLanes |= b), c = a, a = a.return;
        return c.tag === 3 ? c.stateNode : null;
      }
      var de = false;
      function ee(a) {
        a.updateQueue = { baseState: a.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
      }
      function fe(a, b) {
        a = a.updateQueue;
        b.updateQueue === a && (b.updateQueue = { baseState: a.baseState, firstBaseUpdate: a.firstBaseUpdate, lastBaseUpdate: a.lastBaseUpdate, shared: a.shared, effects: a.effects });
      }
      function ge(a, b) {
        return { eventTime: a, lane: b, tag: 0, payload: null, callback: null, next: null };
      }
      function he(a, b, c) {
        var d = a.updateQueue;
        if (d === null)
          return null;
        d = d.shared;
        if ((H & 2) !== 0) {
          var e = d.pending;
          e === null ? b.next = b : (b.next = e.next, e.next = b);
          d.pending = b;
          return ce(a, c);
        }
        e = d.interleaved;
        e === null ? (b.next = b, ae(d)) : (b.next = e.next, e.next = b);
        d.interleaved = b;
        return ce(a, c);
      }
      function ie(a, b, c) {
        b = b.updateQueue;
        if (b !== null && (b = b.shared, (c & 4194240) !== 0)) {
          var d = b.lanes;
          d &= a.pendingLanes;
          c |= d;
          b.lanes = c;
          Hc(a, c);
        }
      }
      function je(a, b) {
        var { updateQueue: c, alternate: d } = a;
        if (d !== null && (d = d.updateQueue, c === d)) {
          var e = null, f = null;
          c = c.firstBaseUpdate;
          if (c !== null) {
            do {
              var g = { eventTime: c.eventTime, lane: c.lane, tag: c.tag, payload: c.payload, callback: c.callback, next: null };
              f === null ? e = f = g : f = f.next = g;
              c = c.next;
            } while (c !== null);
            f === null ? e = f = b : f = f.next = b;
          } else
            e = f = b;
          c = { baseState: d.baseState, firstBaseUpdate: e, lastBaseUpdate: f, shared: d.shared, effects: d.effects };
          a.updateQueue = c;
          return;
        }
        a = c.lastBaseUpdate;
        a === null ? c.firstBaseUpdate = b : a.next = b;
        c.lastBaseUpdate = b;
      }
      function ke(a, b, c, d) {
        var e = a.updateQueue;
        de = false;
        var { firstBaseUpdate: f, lastBaseUpdate: g } = e, h = e.shared.pending;
        if (h !== null) {
          e.shared.pending = null;
          var k = h, l = k.next;
          k.next = null;
          g === null ? f = l : g.next = l;
          g = k;
          var m = a.alternate;
          m !== null && (m = m.updateQueue, h = m.lastBaseUpdate, h !== g && (h === null ? m.firstBaseUpdate = l : h.next = l, m.lastBaseUpdate = k));
        }
        if (f !== null) {
          var r = e.baseState;
          g = 0;
          m = l = k = null;
          h = f;
          do {
            var { lane: p, eventTime: B } = h;
            if ((d & p) === p) {
              m !== null && (m = m.next = {
                eventTime: B,
                lane: 0,
                tag: h.tag,
                payload: h.payload,
                callback: h.callback,
                next: null
              });
              a: {
                var w = a, Y = h;
                p = b;
                B = c;
                switch (Y.tag) {
                  case 1:
                    w = Y.payload;
                    if (typeof w === "function") {
                      r = w.call(B, r, p);
                      break a;
                    }
                    r = w;
                    break a;
                  case 3:
                    w.flags = w.flags & -65537 | 128;
                  case 0:
                    w = Y.payload;
                    p = typeof w === "function" ? w.call(B, r, p) : w;
                    if (p === null || p === undefined)
                      break a;
                    r = ca({}, r, p);
                    break a;
                  case 2:
                    de = true;
                }
              }
              h.callback !== null && h.lane !== 0 && (a.flags |= 64, p = e.effects, p === null ? e.effects = [h] : p.push(h));
            } else
              B = { eventTime: B, lane: p, tag: h.tag, payload: h.payload, callback: h.callback, next: null }, m === null ? (l = m = B, k = r) : m = m.next = B, g |= p;
            h = h.next;
            if (h === null)
              if (h = e.shared.pending, h === null)
                break;
              else
                p = h, h = p.next, p.next = null, e.lastBaseUpdate = p, e.shared.pending = null;
          } while (1);
          m === null && (k = r);
          e.baseState = k;
          e.firstBaseUpdate = l;
          e.lastBaseUpdate = m;
          b = e.shared.interleaved;
          if (b !== null) {
            e = b;
            do
              g |= e.lane, e = e.next;
            while (e !== b);
          } else
            f === null && (e.shared.lanes = 0);
          le |= g;
          a.lanes = g;
          a.memoizedState = r;
        }
      }
      function me(a, b, c) {
        a = b.effects;
        b.effects = null;
        if (a !== null)
          for (b = 0;b < a.length; b++) {
            var d = a[b], e = d.callback;
            if (e !== null) {
              d.callback = null;
              d = c;
              if (typeof e !== "function")
                throw Error(n(191, e));
              e.call(d);
            }
          }
      }
      var ne = {}, oe = ic(ne), pe = ic(ne), qe = ic(ne);
      function re(a) {
        if (a === ne)
          throw Error(n(174));
        return a;
      }
      function se(a, b) {
        v(qe, b);
        v(pe, a);
        v(oe, ne);
        a = Fa(b);
        q(oe);
        v(oe, a);
      }
      function te() {
        q(oe);
        q(pe);
        q(qe);
      }
      function ue(a) {
        var b = re(qe.current), c = re(oe.current);
        b = Ga(c, a.type, b);
        c !== b && (v(pe, a), v(oe, b));
      }
      function ve(a) {
        pe.current === a && (q(oe), q(pe));
      }
      var I = ic(0);
      function we(a) {
        for (var b = a;b !== null; ) {
          if (b.tag === 13) {
            var c = b.memoizedState;
            if (c !== null && (c = c.dehydrated, c === null || Jb(c) || Kb(c)))
              return b;
          } else if (b.tag === 19 && b.memoizedProps.revealOrder !== undefined) {
            if ((b.flags & 128) !== 0)
              return b;
          } else if (b.child !== null) {
            b.child.return = b;
            b = b.child;
            continue;
          }
          if (b === a)
            break;
          for (;b.sibling === null; ) {
            if (b.return === null || b.return === a)
              return null;
            b = b.return;
          }
          b.sibling.return = b.return;
          b = b.sibling;
        }
        return null;
      }
      var xe = [];
      function ye() {
        for (var a = 0;a < xe.length; a++) {
          var b = xe[a];
          Sa ? b._workInProgressVersionPrimary = null : b._workInProgressVersionSecondary = null;
        }
        xe.length = 0;
      }
      var { ReactCurrentDispatcher: ze, ReactCurrentBatchConfig: Ae } = da, Be = 0, J = null, K = null, L = null, Ce = false, De = false, Ee = 0, Fe = 0;
      function M() {
        throw Error(n(321));
      }
      function Ge(a, b) {
        if (b === null)
          return false;
        for (var c = 0;c < b.length && c < a.length; c++)
          if (!Vc(a[c], b[c]))
            return false;
        return true;
      }
      function He(a, b, c, d, e, f) {
        Be = f;
        J = b;
        b.memoizedState = null;
        b.updateQueue = null;
        b.lanes = 0;
        ze.current = a === null || a.memoizedState === null ? Ie : Je;
        a = c(d, e);
        if (De) {
          f = 0;
          do {
            De = false;
            Ee = 0;
            if (25 <= f)
              throw Error(n(301));
            f += 1;
            L = K = null;
            b.updateQueue = null;
            ze.current = Ke;
            a = c(d, e);
          } while (De);
        }
        ze.current = Le;
        b = K !== null && K.next !== null;
        Be = 0;
        L = K = J = null;
        Ce = false;
        if (b)
          throw Error(n(300));
        return a;
      }
      function Me() {
        var a = Ee !== 0;
        Ee = 0;
        return a;
      }
      function Ne() {
        var a = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
        L === null ? J.memoizedState = L = a : L = L.next = a;
        return L;
      }
      function Oe() {
        if (K === null) {
          var a = J.alternate;
          a = a !== null ? a.memoizedState : null;
        } else
          a = K.next;
        var b = L === null ? J.memoizedState : L.next;
        if (b !== null)
          L = b, K = a;
        else {
          if (a === null)
            throw Error(n(310));
          K = a;
          a = { memoizedState: K.memoizedState, baseState: K.baseState, baseQueue: K.baseQueue, queue: K.queue, next: null };
          L === null ? J.memoizedState = L = a : L = L.next = a;
        }
        return L;
      }
      function Pe(a, b) {
        return typeof b === "function" ? b(a) : b;
      }
      function Qe(a) {
        var b = Oe(), c = b.queue;
        if (c === null)
          throw Error(n(311));
        c.lastRenderedReducer = a;
        var d = K, e = d.baseQueue, f = c.pending;
        if (f !== null) {
          if (e !== null) {
            var g = e.next;
            e.next = f.next;
            f.next = g;
          }
          d.baseQueue = e = f;
          c.pending = null;
        }
        if (e !== null) {
          f = e.next;
          d = d.baseState;
          var h = g = null, k = null, l = f;
          do {
            var m = l.lane;
            if ((Be & m) === m)
              k !== null && (k = k.next = { lane: 0, action: l.action, hasEagerState: l.hasEagerState, eagerState: l.eagerState, next: null }), d = l.hasEagerState ? l.eagerState : a(d, l.action);
            else {
              var r = {
                lane: m,
                action: l.action,
                hasEagerState: l.hasEagerState,
                eagerState: l.eagerState,
                next: null
              };
              k === null ? (h = k = r, g = d) : k = k.next = r;
              J.lanes |= m;
              le |= m;
            }
            l = l.next;
          } while (l !== null && l !== f);
          k === null ? g = d : k.next = h;
          Vc(d, b.memoizedState) || (G = true);
          b.memoizedState = d;
          b.baseState = g;
          b.baseQueue = k;
          c.lastRenderedState = d;
        }
        a = c.interleaved;
        if (a !== null) {
          e = a;
          do
            f = e.lane, J.lanes |= f, le |= f, e = e.next;
          while (e !== a);
        } else
          e === null && (c.lanes = 0);
        return [b.memoizedState, c.dispatch];
      }
      function Re(a) {
        var b = Oe(), c = b.queue;
        if (c === null)
          throw Error(n(311));
        c.lastRenderedReducer = a;
        var { dispatch: d, pending: e } = c, f = b.memoizedState;
        if (e !== null) {
          c.pending = null;
          var g = e = e.next;
          do
            f = a(f, g.action), g = g.next;
          while (g !== e);
          Vc(f, b.memoizedState) || (G = true);
          b.memoizedState = f;
          b.baseQueue === null && (b.baseState = f);
          c.lastRenderedState = f;
        }
        return [f, d];
      }
      function Se() {}
      function Te(a, b) {
        var c = J, d = Oe(), e = b(), f = !Vc(d.memoizedState, e);
        f && (d.memoizedState = e, G = true);
        d = d.queue;
        Ue(Ve.bind(null, c, d, a), [a]);
        if (d.getSnapshot !== b || f || L !== null && L.memoizedState.tag & 1) {
          c.flags |= 2048;
          We(9, Xe.bind(null, c, d, e, b), undefined, null);
          if (N === null)
            throw Error(n(349));
          (Be & 30) !== 0 || Ye(c, b, e);
        }
        return e;
      }
      function Ye(a, b, c) {
        a.flags |= 16384;
        a = { getSnapshot: b, value: c };
        b = J.updateQueue;
        b === null ? (b = { lastEffect: null, stores: null }, J.updateQueue = b, b.stores = [a]) : (c = b.stores, c === null ? b.stores = [a] : c.push(a));
      }
      function Xe(a, b, c, d) {
        b.value = c;
        b.getSnapshot = d;
        Ze(b) && $e(a);
      }
      function Ve(a, b, c) {
        return c(function() {
          Ze(b) && $e(a);
        });
      }
      function Ze(a) {
        var b = a.getSnapshot;
        a = a.value;
        try {
          var c = b();
          return !Vc(a, c);
        } catch (d) {
          return true;
        }
      }
      function $e(a) {
        var b = ce(a, 1);
        b !== null && af(b, a, 1, -1);
      }
      function bf(a) {
        var b = Ne();
        typeof a === "function" && (a = a());
        b.memoizedState = b.baseState = a;
        a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Pe, lastRenderedState: a };
        b.queue = a;
        a = a.dispatch = cf.bind(null, J, a);
        return [b.memoizedState, a];
      }
      function We(a, b, c, d) {
        a = { tag: a, create: b, destroy: c, deps: d, next: null };
        b = J.updateQueue;
        b === null ? (b = { lastEffect: null, stores: null }, J.updateQueue = b, b.lastEffect = a.next = a) : (c = b.lastEffect, c === null ? b.lastEffect = a.next = a : (d = c.next, c.next = a, a.next = d, b.lastEffect = a));
        return a;
      }
      function df() {
        return Oe().memoizedState;
      }
      function ef(a, b, c, d) {
        var e = Ne();
        J.flags |= a;
        e.memoizedState = We(1 | b, c, undefined, d === undefined ? null : d);
      }
      function ff(a, b, c, d) {
        var e = Oe();
        d = d === undefined ? null : d;
        var f = undefined;
        if (K !== null) {
          var g = K.memoizedState;
          f = g.destroy;
          if (d !== null && Ge(d, g.deps)) {
            e.memoizedState = We(b, c, f, d);
            return;
          }
        }
        J.flags |= a;
        e.memoizedState = We(1 | b, c, f, d);
      }
      function gf(a, b) {
        return ef(8390656, 8, a, b);
      }
      function Ue(a, b) {
        return ff(2048, 8, a, b);
      }
      function hf(a, b) {
        return ff(4, 2, a, b);
      }
      function jf(a, b) {
        return ff(4, 4, a, b);
      }
      function kf(a, b) {
        if (typeof b === "function")
          return a = a(), b(a), function() {
            b(null);
          };
        if (b !== null && b !== undefined)
          return a = a(), b.current = a, function() {
            b.current = null;
          };
      }
      function lf(a, b, c) {
        c = c !== null && c !== undefined ? c.concat([a]) : null;
        return ff(4, 4, kf.bind(null, b, a), c);
      }
      function mf() {}
      function nf(a, b) {
        var c = Oe();
        b = b === undefined ? null : b;
        var d = c.memoizedState;
        if (d !== null && b !== null && Ge(b, d[1]))
          return d[0];
        c.memoizedState = [a, b];
        return a;
      }
      function of(a, b) {
        var c = Oe();
        b = b === undefined ? null : b;
        var d = c.memoizedState;
        if (d !== null && b !== null && Ge(b, d[1]))
          return d[0];
        a = a();
        c.memoizedState = [a, b];
        return a;
      }
      function pf(a, b, c) {
        if ((Be & 21) === 0)
          return a.baseState && (a.baseState = false, G = true), a.memoizedState = c;
        Vc(c, b) || (c = Dc(), J.lanes |= c, le |= c, a.baseState = true);
        return b;
      }
      function qf(a, b) {
        var c = C;
        C = c !== 0 && 4 > c ? c : 4;
        a(true);
        var d = Ae.transition;
        Ae.transition = {};
        try {
          a(false), b();
        } finally {
          C = c, Ae.transition = d;
        }
      }
      function rf() {
        return Oe().memoizedState;
      }
      function sf(a, b, c) {
        var d = tf(a);
        c = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
        if (uf(a))
          vf(b, c);
        else if (c = be(a, b, c, d), c !== null) {
          var e = O();
          af(c, a, d, e);
          wf(c, b, d);
        }
      }
      function cf(a, b, c) {
        var d = tf(a), e = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
        if (uf(a))
          vf(b, e);
        else {
          var f = a.alternate;
          if (a.lanes === 0 && (f === null || f.lanes === 0) && (f = b.lastRenderedReducer, f !== null))
            try {
              var g = b.lastRenderedState, h = f(g, c);
              e.hasEagerState = true;
              e.eagerState = h;
              if (Vc(h, g)) {
                var k = b.interleaved;
                k === null ? (e.next = e, ae(b)) : (e.next = k.next, k.next = e);
                b.interleaved = e;
                return;
              }
            } catch (l) {} finally {}
          c = be(a, b, e, d);
          c !== null && (e = O(), af(c, a, d, e), wf(c, b, d));
        }
      }
      function uf(a) {
        var b = a.alternate;
        return a === J || b !== null && b === J;
      }
      function vf(a, b) {
        De = Ce = true;
        var c = a.pending;
        c === null ? b.next = b : (b.next = c.next, c.next = b);
        a.pending = b;
      }
      function wf(a, b, c) {
        if ((c & 4194240) !== 0) {
          var d = b.lanes;
          d &= a.pendingLanes;
          c |= d;
          b.lanes = c;
          Hc(a, c);
        }
      }
      var Le = { readContext: Zd, useCallback: M, useContext: M, useEffect: M, useImperativeHandle: M, useInsertionEffect: M, useLayoutEffect: M, useMemo: M, useReducer: M, useRef: M, useState: M, useDebugValue: M, useDeferredValue: M, useTransition: M, useMutableSource: M, useSyncExternalStore: M, useId: M, unstable_isNewReconciler: false }, Ie = { readContext: Zd, useCallback: function(a, b) {
        Ne().memoizedState = [a, b === undefined ? null : b];
        return a;
      }, useContext: Zd, useEffect: gf, useImperativeHandle: function(a, b, c) {
        c = c !== null && c !== undefined ? c.concat([a]) : null;
        return ef(4194308, 4, kf.bind(null, b, a), c);
      }, useLayoutEffect: function(a, b) {
        return ef(4194308, 4, a, b);
      }, useInsertionEffect: function(a, b) {
        return ef(4, 2, a, b);
      }, useMemo: function(a, b) {
        var c = Ne();
        b = b === undefined ? null : b;
        a = a();
        c.memoizedState = [a, b];
        return a;
      }, useReducer: function(a, b, c) {
        var d = Ne();
        b = c !== undefined ? c(b) : b;
        d.memoizedState = d.baseState = b;
        a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: a, lastRenderedState: b };
        d.queue = a;
        a = a.dispatch = sf.bind(null, J, a);
        return [d.memoizedState, a];
      }, useRef: function(a) {
        var b = Ne();
        a = { current: a };
        return b.memoizedState = a;
      }, useState: bf, useDebugValue: mf, useDeferredValue: function(a) {
        return Ne().memoizedState = a;
      }, useTransition: function() {
        var a = bf(false), b = a[0];
        a = qf.bind(null, a[1]);
        Ne().memoizedState = a;
        return [b, a];
      }, useMutableSource: function() {}, useSyncExternalStore: function(a, b, c) {
        var d = J, e = Ne();
        if (F) {
          if (c === undefined)
            throw Error(n(407));
          c = c();
        } else {
          c = b();
          if (N === null)
            throw Error(n(349));
          (Be & 30) !== 0 || Ye(d, b, c);
        }
        e.memoizedState = c;
        var f = { value: c, getSnapshot: b };
        e.queue = f;
        gf(Ve.bind(null, d, f, a), [a]);
        d.flags |= 2048;
        We(9, Xe.bind(null, d, f, c, b), undefined, null);
        return c;
      }, useId: function() {
        var a = Ne(), b = N.identifierPrefix;
        if (F) {
          var c = jd;
          var d = id;
          c = (d & ~(1 << 32 - tc(d) - 1)).toString(32) + c;
          b = ":" + b + "R" + c;
          c = Ee++;
          0 < c && (b += "H" + c.toString(32));
          b += ":";
        } else
          c = Fe++, b = ":" + b + "r" + c.toString(32) + ":";
        return a.memoizedState = b;
      }, unstable_isNewReconciler: false }, Je = {
        readContext: Zd,
        useCallback: nf,
        useContext: Zd,
        useEffect: Ue,
        useImperativeHandle: lf,
        useInsertionEffect: hf,
        useLayoutEffect: jf,
        useMemo: of,
        useReducer: Qe,
        useRef: df,
        useState: function() {
          return Qe(Pe);
        },
        useDebugValue: mf,
        useDeferredValue: function(a) {
          var b = Oe();
          return pf(b, K.memoizedState, a);
        },
        useTransition: function() {
          var a = Qe(Pe)[0], b = Oe().memoizedState;
          return [a, b];
        },
        useMutableSource: Se,
        useSyncExternalStore: Te,
        useId: rf,
        unstable_isNewReconciler: false
      }, Ke = { readContext: Zd, useCallback: nf, useContext: Zd, useEffect: Ue, useImperativeHandle: lf, useInsertionEffect: hf, useLayoutEffect: jf, useMemo: of, useReducer: Re, useRef: df, useState: function() {
        return Re(Pe);
      }, useDebugValue: mf, useDeferredValue: function(a) {
        var b = Oe();
        return K === null ? b.memoizedState = a : pf(b, K.memoizedState, a);
      }, useTransition: function() {
        var a = Re(Pe)[0], b = Oe().memoizedState;
        return [a, b];
      }, useMutableSource: Se, useSyncExternalStore: Te, useId: rf, unstable_isNewReconciler: false };
      function xf(a, b) {
        if (a && a.defaultProps) {
          b = ca({}, b);
          a = a.defaultProps;
          for (var c in a)
            b[c] === undefined && (b[c] = a[c]);
          return b;
        }
        return b;
      }
      function yf(a, b, c, d) {
        b = a.memoizedState;
        c = c(d, b);
        c = c === null || c === undefined ? b : ca({}, b, c);
        a.memoizedState = c;
        a.lanes === 0 && (a.updateQueue.baseState = c);
      }
      var zf = { isMounted: function(a) {
        return (a = a._reactInternals) ? wa(a) === a : false;
      }, enqueueSetState: function(a, b, c) {
        a = a._reactInternals;
        var d = O(), e = tf(a), f = ge(d, e);
        f.payload = b;
        c !== undefined && c !== null && (f.callback = c);
        b = he(a, f, e);
        b !== null && (af(b, a, e, d), ie(b, a, e));
      }, enqueueReplaceState: function(a, b, c) {
        a = a._reactInternals;
        var d = O(), e = tf(a), f = ge(d, e);
        f.tag = 1;
        f.payload = b;
        c !== undefined && c !== null && (f.callback = c);
        b = he(a, f, e);
        b !== null && (af(b, a, e, d), ie(b, a, e));
      }, enqueueForceUpdate: function(a, b) {
        a = a._reactInternals;
        var c = O(), d = tf(a), e = ge(c, d);
        e.tag = 2;
        b !== undefined && b !== null && (e.callback = b);
        b = he(a, e, d);
        b !== null && (af(b, a, d, c), ie(b, a, d));
      } };
      function Af(a, b, c, d, e, f, g) {
        a = a.stateNode;
        return typeof a.shouldComponentUpdate === "function" ? a.shouldComponentUpdate(d, f, g) : b.prototype && b.prototype.isPureReactComponent ? !Dd(c, d) || !Dd(e, f) : true;
      }
      function Bf(a, b, c) {
        var d = false, e = jc;
        var f = b.contextType;
        typeof f === "object" && f !== null ? f = Zd(f) : (e = A(b) ? kc : x.current, d = b.contextTypes, f = (d = d !== null && d !== undefined) ? mc(a, e) : jc);
        b = new b(c, f);
        a.memoizedState = b.state !== null && b.state !== undefined ? b.state : null;
        b.updater = zf;
        a.stateNode = b;
        b._reactInternals = a;
        d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = e, a.__reactInternalMemoizedMaskedChildContext = f);
        return b;
      }
      function Cf(a, b, c, d) {
        a = b.state;
        typeof b.componentWillReceiveProps === "function" && b.componentWillReceiveProps(c, d);
        typeof b.UNSAFE_componentWillReceiveProps === "function" && b.UNSAFE_componentWillReceiveProps(c, d);
        b.state !== a && zf.enqueueReplaceState(b, b.state, null);
      }
      function Df(a, b, c, d) {
        var e = a.stateNode;
        e.props = c;
        e.state = a.memoizedState;
        e.refs = {};
        ee(a);
        var f = b.contextType;
        typeof f === "object" && f !== null ? e.context = Zd(f) : (f = A(b) ? kc : x.current, e.context = mc(a, f));
        e.state = a.memoizedState;
        f = b.getDerivedStateFromProps;
        typeof f === "function" && (yf(a, b, f, c), e.state = a.memoizedState);
        typeof b.getDerivedStateFromProps === "function" || typeof e.getSnapshotBeforeUpdate === "function" || typeof e.UNSAFE_componentWillMount !== "function" && typeof e.componentWillMount !== "function" || (b = e.state, typeof e.componentWillMount === "function" && e.componentWillMount(), typeof e.UNSAFE_componentWillMount === "function" && e.UNSAFE_componentWillMount(), b !== e.state && zf.enqueueReplaceState(e, e.state, null), ke(a, c, e, d), e.state = a.memoizedState);
        typeof e.componentDidMount === "function" && (a.flags |= 4194308);
      }
      function Ef(a, b) {
        try {
          var c = "", d = b;
          do
            c += Ed(d), d = d.return;
          while (d);
          var e = c;
        } catch (f) {
          e = `
Error generating stack: ` + f.message + `
` + f.stack;
        }
        return { value: a, source: b, stack: e, digest: null };
      }
      function Ff(a, b, c) {
        return { value: a, source: null, stack: c != null ? c : null, digest: b != null ? b : null };
      }
      function Gf(a, b) {
        try {
          console.error(b.value);
        } catch (c) {
          setTimeout(function() {
            throw c;
          });
        }
      }
      var Hf = typeof WeakMap === "function" ? WeakMap : Map;
      function If(a, b, c) {
        c = ge(-1, c);
        c.tag = 3;
        c.payload = { element: null };
        var d = b.value;
        c.callback = function() {
          Jf || (Jf = true, Kf = d);
          Gf(a, b);
        };
        return c;
      }
      function Lf(a, b, c) {
        c = ge(-1, c);
        c.tag = 3;
        var d = a.type.getDerivedStateFromError;
        if (typeof d === "function") {
          var e = b.value;
          c.payload = function() {
            return d(e);
          };
          c.callback = function() {
            Gf(a, b);
          };
        }
        var f = a.stateNode;
        f !== null && typeof f.componentDidCatch === "function" && (c.callback = function() {
          Gf(a, b);
          typeof d !== "function" && (Mf === null ? Mf = new Set([this]) : Mf.add(this));
          var c2 = b.stack;
          this.componentDidCatch(b.value, { componentStack: c2 !== null ? c2 : "" });
        });
        return c;
      }
      function Nf(a, b, c) {
        var d = a.pingCache;
        if (d === null) {
          d = a.pingCache = new Hf;
          var e = new Set;
          d.set(b, e);
        } else
          e = d.get(b), e === undefined && (e = new Set, d.set(b, e));
        e.has(c) || (e.add(c), a = Of.bind(null, a, b, c), b.then(a, a));
      }
      function Pf(a) {
        do {
          var b;
          if (b = a.tag === 13)
            b = a.memoizedState, b = b !== null ? b.dehydrated !== null ? true : false : true;
          if (b)
            return a;
          a = a.return;
        } while (a !== null);
        return null;
      }
      function Qf(a, b, c, d, e) {
        if ((a.mode & 1) === 0)
          return a === b ? a.flags |= 65536 : (a.flags |= 128, c.flags |= 131072, c.flags &= -52805, c.tag === 1 && (c.alternate === null ? c.tag = 17 : (b = ge(-1, 1), b.tag = 2, he(c, b, 1))), c.lanes |= 1), a;
        a.flags |= 65536;
        a.lanes = e;
        return a;
      }
      var Rf = da.ReactCurrentOwner, G = false;
      function P(a, b, c, d) {
        b.child = a === null ? Pd(b, null, c, d) : Od(b, a.child, c, d);
      }
      function Sf(a, b, c, d, e) {
        c = c.render;
        var f = b.ref;
        Yd(b, e);
        d = He(a, b, c, d, f, e);
        c = Me();
        if (a !== null && !G)
          return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Tf(a, b, e);
        F && c && md(b);
        b.flags |= 1;
        P(a, b, d, e);
        return b.child;
      }
      function Uf(a, b, c, d, e) {
        if (a === null) {
          var f = c.type;
          if (typeof f === "function" && !Vf(f) && f.defaultProps === undefined && c.compare === null && c.defaultProps === undefined)
            return b.tag = 15, b.type = f, Wf(a, b, f, d, e);
          a = Ld(c.type, null, d, b, b.mode, e);
          a.ref = b.ref;
          a.return = b;
          return b.child = a;
        }
        f = a.child;
        if ((a.lanes & e) === 0) {
          var g = f.memoizedProps;
          c = c.compare;
          c = c !== null ? c : Dd;
          if (c(g, d) && a.ref === b.ref)
            return Tf(a, b, e);
        }
        b.flags |= 1;
        a = Jd(f, d);
        a.ref = b.ref;
        a.return = b;
        return b.child = a;
      }
      function Wf(a, b, c, d, e) {
        if (a !== null) {
          var f = a.memoizedProps;
          if (Dd(f, d) && a.ref === b.ref)
            if (G = false, b.pendingProps = d = f, (a.lanes & e) !== 0)
              (a.flags & 131072) !== 0 && (G = true);
            else
              return b.lanes = a.lanes, Tf(a, b, e);
        }
        return Xf(a, b, c, d, e);
      }
      function Yf(a, b, c) {
        var d = b.pendingProps, e = d.children, f = a !== null ? a.memoizedState : null;
        if (d.mode === "hidden")
          if ((b.mode & 1) === 0)
            b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, v(Zf, $f), $f |= c;
          else {
            if ((c & 1073741824) === 0)
              return a = f !== null ? f.baseLanes | c : c, b.lanes = b.childLanes = 1073741824, b.memoizedState = { baseLanes: a, cachePool: null, transitions: null }, b.updateQueue = null, v(Zf, $f), $f |= a, null;
            b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null };
            d = f !== null ? f.baseLanes : c;
            v(Zf, $f);
            $f |= d;
          }
        else
          f !== null ? (d = f.baseLanes | c, b.memoizedState = null) : d = c, v(Zf, $f), $f |= d;
        P(a, b, e, c);
        return b.child;
      }
      function ag(a, b) {
        var c = b.ref;
        if (a === null && c !== null || a !== null && a.ref !== c)
          b.flags |= 512, b.flags |= 2097152;
      }
      function Xf(a, b, c, d, e) {
        var f = A(c) ? kc : x.current;
        f = mc(b, f);
        Yd(b, e);
        c = He(a, b, c, d, f, e);
        d = Me();
        if (a !== null && !G)
          return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Tf(a, b, e);
        F && d && md(b);
        b.flags |= 1;
        P(a, b, c, e);
        return b.child;
      }
      function bg(a, b, c, d, e) {
        if (A(c)) {
          var f = true;
          qc(b);
        } else
          f = false;
        Yd(b, e);
        if (b.stateNode === null)
          cg(a, b), Bf(b, c, d), Df(b, c, d, e), d = true;
        else if (a === null) {
          var { stateNode: g, memoizedProps: h } = b;
          g.props = h;
          var k = g.context, l = c.contextType;
          typeof l === "object" && l !== null ? l = Zd(l) : (l = A(c) ? kc : x.current, l = mc(b, l));
          var m = c.getDerivedStateFromProps, r = typeof m === "function" || typeof g.getSnapshotBeforeUpdate === "function";
          r || typeof g.UNSAFE_componentWillReceiveProps !== "function" && typeof g.componentWillReceiveProps !== "function" || (h !== d || k !== l) && Cf(b, g, d, l);
          de = false;
          var p = b.memoizedState;
          g.state = p;
          ke(b, d, g, e);
          k = b.memoizedState;
          h !== d || p !== k || z.current || de ? (typeof m === "function" && (yf(b, c, m, d), k = b.memoizedState), (h = de || Af(b, c, h, d, p, k, l)) ? (r || typeof g.UNSAFE_componentWillMount !== "function" && typeof g.componentWillMount !== "function" || (typeof g.componentWillMount === "function" && g.componentWillMount(), typeof g.UNSAFE_componentWillMount === "function" && g.UNSAFE_componentWillMount()), typeof g.componentDidMount === "function" && (b.flags |= 4194308)) : (typeof g.componentDidMount === "function" && (b.flags |= 4194308), b.memoizedProps = d, b.memoizedState = k), g.props = d, g.state = k, g.context = l, d = h) : (typeof g.componentDidMount === "function" && (b.flags |= 4194308), d = false);
        } else {
          g = b.stateNode;
          fe(a, b);
          h = b.memoizedProps;
          l = b.type === b.elementType ? h : xf(b.type, h);
          g.props = l;
          r = b.pendingProps;
          p = g.context;
          k = c.contextType;
          typeof k === "object" && k !== null ? k = Zd(k) : (k = A(c) ? kc : x.current, k = mc(b, k));
          var B = c.getDerivedStateFromProps;
          (m = typeof B === "function" || typeof g.getSnapshotBeforeUpdate === "function") || typeof g.UNSAFE_componentWillReceiveProps !== "function" && typeof g.componentWillReceiveProps !== "function" || (h !== r || p !== k) && Cf(b, g, d, k);
          de = false;
          p = b.memoizedState;
          g.state = p;
          ke(b, d, g, e);
          var w = b.memoizedState;
          h !== r || p !== w || z.current || de ? (typeof B === "function" && (yf(b, c, B, d), w = b.memoizedState), (l = de || Af(b, c, l, d, p, w, k) || false) ? (m || typeof g.UNSAFE_componentWillUpdate !== "function" && typeof g.componentWillUpdate !== "function" || (typeof g.componentWillUpdate === "function" && g.componentWillUpdate(d, w, k), typeof g.UNSAFE_componentWillUpdate === "function" && g.UNSAFE_componentWillUpdate(d, w, k)), typeof g.componentDidUpdate === "function" && (b.flags |= 4), typeof g.getSnapshotBeforeUpdate === "function" && (b.flags |= 1024)) : (typeof g.componentDidUpdate !== "function" || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 4), typeof g.getSnapshotBeforeUpdate !== "function" || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 1024), b.memoizedProps = d, b.memoizedState = w), g.props = d, g.state = w, g.context = k, d = l) : (typeof g.componentDidUpdate !== "function" || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 4), typeof g.getSnapshotBeforeUpdate !== "function" || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 1024), d = false);
        }
        return dg(a, b, c, d, f, e);
      }
      function dg(a, b, c, d, e, f) {
        ag(a, b);
        var g = (b.flags & 128) !== 0;
        if (!d && !g)
          return e && rc(b, c, false), Tf(a, b, f);
        d = b.stateNode;
        Rf.current = b;
        var h = g && typeof c.getDerivedStateFromError !== "function" ? null : d.render();
        b.flags |= 1;
        a !== null && g ? (b.child = Od(b, a.child, null, f), b.child = Od(b, null, h, f)) : P(a, b, h, f);
        b.memoizedState = d.state;
        e && rc(b, c, true);
        return b.child;
      }
      function eg(a) {
        var b = a.stateNode;
        b.pendingContext ? oc(a, b.pendingContext, b.pendingContext !== b.context) : b.context && oc(a, b.context, false);
        se(a, b.containerInfo);
      }
      function fg(a, b, c, d, e) {
        Ad();
        Bd(e);
        b.flags |= 256;
        P(a, b, c, d);
        return b.child;
      }
      var gg = { dehydrated: null, treeContext: null, retryLane: 0 };
      function hg(a) {
        return { baseLanes: a, cachePool: null, transitions: null };
      }
      function ig(a, b, c) {
        var d = b.pendingProps, e = I.current, f = false, g = (b.flags & 128) !== 0, h;
        (h = g) || (h = a !== null && a.memoizedState === null ? false : (e & 2) !== 0);
        if (h)
          f = true, b.flags &= -129;
        else if (a === null || a.memoizedState !== null)
          e |= 1;
        v(I, e & 1);
        if (a === null) {
          wd(b);
          a = b.memoizedState;
          if (a !== null && (a = a.dehydrated, a !== null))
            return (b.mode & 1) === 0 ? b.lanes = 1 : Kb(a) ? b.lanes = 8 : b.lanes = 1073741824, null;
          g = d.children;
          a = d.fallback;
          return f ? (d = b.mode, f = b.child, g = { mode: "hidden", children: g }, (d & 1) === 0 && f !== null ? (f.childLanes = 0, f.pendingProps = g) : f = jg(g, d, 0, null), a = Nd(a, d, c, null), f.return = b, a.return = b, f.sibling = a, b.child = f, b.child.memoizedState = hg(c), b.memoizedState = gg, a) : kg(b, g);
        }
        e = a.memoizedState;
        if (e !== null && (h = e.dehydrated, h !== null))
          return lg(a, b, g, d, h, e, c);
        if (f) {
          f = d.fallback;
          g = b.mode;
          e = a.child;
          h = e.sibling;
          var k = { mode: "hidden", children: d.children };
          (g & 1) === 0 && b.child !== e ? (d = b.child, d.childLanes = 0, d.pendingProps = k, b.deletions = null) : (d = Jd(e, k), d.subtreeFlags = e.subtreeFlags & 14680064);
          h !== null ? f = Jd(h, f) : (f = Nd(f, g, c, null), f.flags |= 2);
          f.return = b;
          d.return = b;
          d.sibling = f;
          b.child = d;
          d = f;
          f = b.child;
          g = a.child.memoizedState;
          g = g === null ? hg(c) : { baseLanes: g.baseLanes | c, cachePool: null, transitions: g.transitions };
          f.memoizedState = g;
          f.childLanes = a.childLanes & ~c;
          b.memoizedState = gg;
          return d;
        }
        f = a.child;
        a = f.sibling;
        d = Jd(f, { mode: "visible", children: d.children });
        (b.mode & 1) === 0 && (d.lanes = c);
        d.return = b;
        d.sibling = null;
        a !== null && (c = b.deletions, c === null ? (b.deletions = [a], b.flags |= 16) : c.push(a));
        b.child = d;
        b.memoizedState = null;
        return d;
      }
      function kg(a, b) {
        b = jg({ mode: "visible", children: b }, a.mode, 0, null);
        b.return = a;
        return a.child = b;
      }
      function mg(a, b, c, d) {
        d !== null && Bd(d);
        Od(b, a.child, null, c);
        a = kg(b, b.pendingProps.children);
        a.flags |= 2;
        b.memoizedState = null;
        return a;
      }
      function lg(a, b, c, d, e, f, g) {
        if (c) {
          if (b.flags & 256)
            return b.flags &= -257, d = Ff(Error(n(422))), mg(a, b, g, d);
          if (b.memoizedState !== null)
            return b.child = a.child, b.flags |= 128, null;
          f = d.fallback;
          e = b.mode;
          d = jg({ mode: "visible", children: d.children }, e, 0, null);
          f = Nd(f, e, g, null);
          f.flags |= 2;
          d.return = b;
          f.return = b;
          d.sibling = f;
          b.child = d;
          (b.mode & 1) !== 0 && Od(b, a.child, null, g);
          b.child.memoizedState = hg(g);
          b.memoizedState = gg;
          return f;
        }
        if ((b.mode & 1) === 0)
          return mg(a, b, g, null);
        if (Kb(e))
          return d = Lb(e).digest, f = Error(n(419)), d = Ff(f, d, undefined), mg(a, b, g, d);
        c = (g & a.childLanes) !== 0;
        if (G || c) {
          d = N;
          if (d !== null) {
            switch (g & -g) {
              case 4:
                e = 2;
                break;
              case 16:
                e = 8;
                break;
              case 64:
              case 128:
              case 256:
              case 512:
              case 1024:
              case 2048:
              case 4096:
              case 8192:
              case 16384:
              case 32768:
              case 65536:
              case 131072:
              case 262144:
              case 524288:
              case 1048576:
              case 2097152:
              case 4194304:
              case 8388608:
              case 16777216:
              case 33554432:
              case 67108864:
                e = 32;
                break;
              case 536870912:
                e = 268435456;
                break;
              default:
                e = 0;
            }
            e = (e & (d.suspendedLanes | g)) !== 0 ? 0 : e;
            e !== 0 && e !== f.retryLane && (f.retryLane = e, ce(a, e), af(d, a, e, -1));
          }
          ng();
          d = Ff(Error(n(421)));
          return mg(a, b, g, d);
        }
        if (Jb(e))
          return b.flags |= 128, b.child = a.child, b = og.bind(null, a), Mb(e, b), null;
        a = f.treeContext;
        Va && (pd = Qb(e), od = b, F = true, rd = null, qd = false, a !== null && (fd[gd++] = id, fd[gd++] = jd, fd[gd++] = hd, id = a.id, jd = a.overflow, hd = b));
        b = kg(b, d.children);
        b.flags |= 4096;
        return b;
      }
      function pg(a, b, c) {
        a.lanes |= b;
        var d = a.alternate;
        d !== null && (d.lanes |= b);
        Xd(a.return, b, c);
      }
      function qg(a, b, c, d, e) {
        var f = a.memoizedState;
        f === null ? a.memoizedState = { isBackwards: b, rendering: null, renderingStartTime: 0, last: d, tail: c, tailMode: e } : (f.isBackwards = b, f.rendering = null, f.renderingStartTime = 0, f.last = d, f.tail = c, f.tailMode = e);
      }
      function rg(a, b, c) {
        var d = b.pendingProps, e = d.revealOrder, f = d.tail;
        P(a, b, d.children, c);
        d = I.current;
        if ((d & 2) !== 0)
          d = d & 1 | 2, b.flags |= 128;
        else {
          if (a !== null && (a.flags & 128) !== 0)
            a:
              for (a = b.child;a !== null; ) {
                if (a.tag === 13)
                  a.memoizedState !== null && pg(a, c, b);
                else if (a.tag === 19)
                  pg(a, c, b);
                else if (a.child !== null) {
                  a.child.return = a;
                  a = a.child;
                  continue;
                }
                if (a === b)
                  break a;
                for (;a.sibling === null; ) {
                  if (a.return === null || a.return === b)
                    break a;
                  a = a.return;
                }
                a.sibling.return = a.return;
                a = a.sibling;
              }
          d &= 1;
        }
        v(I, d);
        if ((b.mode & 1) === 0)
          b.memoizedState = null;
        else
          switch (e) {
            case "forwards":
              c = b.child;
              for (e = null;c !== null; )
                a = c.alternate, a !== null && we(a) === null && (e = c), c = c.sibling;
              c = e;
              c === null ? (e = b.child, b.child = null) : (e = c.sibling, c.sibling = null);
              qg(b, false, e, c, f);
              break;
            case "backwards":
              c = null;
              e = b.child;
              for (b.child = null;e !== null; ) {
                a = e.alternate;
                if (a !== null && we(a) === null) {
                  b.child = e;
                  break;
                }
                a = e.sibling;
                e.sibling = c;
                c = e;
                e = a;
              }
              qg(b, true, c, null, f);
              break;
            case "together":
              qg(b, false, null, null, undefined);
              break;
            default:
              b.memoizedState = null;
          }
        return b.child;
      }
      function cg(a, b) {
        (b.mode & 1) === 0 && a !== null && (a.alternate = null, b.alternate = null, b.flags |= 2);
      }
      function Tf(a, b, c) {
        a !== null && (b.dependencies = a.dependencies);
        le |= b.lanes;
        if ((c & b.childLanes) === 0)
          return null;
        if (a !== null && b.child !== a.child)
          throw Error(n(153));
        if (b.child !== null) {
          a = b.child;
          c = Jd(a, a.pendingProps);
          b.child = c;
          for (c.return = b;a.sibling !== null; )
            a = a.sibling, c = c.sibling = Jd(a, a.pendingProps), c.return = b;
          c.sibling = null;
        }
        return b.child;
      }
      function sg(a, b, c) {
        switch (b.tag) {
          case 3:
            eg(b);
            Ad();
            break;
          case 5:
            ue(b);
            break;
          case 1:
            A(b.type) && qc(b);
            break;
          case 4:
            se(b, b.stateNode.containerInfo);
            break;
          case 10:
            Vd(b, b.type._context, b.memoizedProps.value);
            break;
          case 13:
            var d = b.memoizedState;
            if (d !== null) {
              if (d.dehydrated !== null)
                return v(I, I.current & 1), b.flags |= 128, null;
              if ((c & b.child.childLanes) !== 0)
                return ig(a, b, c);
              v(I, I.current & 1);
              a = Tf(a, b, c);
              return a !== null ? a.sibling : null;
            }
            v(I, I.current & 1);
            break;
          case 19:
            d = (c & b.childLanes) !== 0;
            if ((a.flags & 128) !== 0) {
              if (d)
                return rg(a, b, c);
              b.flags |= 128;
            }
            var e = b.memoizedState;
            e !== null && (e.rendering = null, e.tail = null, e.lastEffect = null);
            v(I, I.current);
            if (d)
              break;
            else
              return null;
          case 22:
          case 23:
            return b.lanes = 0, Yf(a, b, c);
        }
        return Tf(a, b, c);
      }
      function tg(a) {
        a.flags |= 4;
      }
      function ug(a, b) {
        if (a !== null && a.child === b.child)
          return true;
        if ((b.flags & 16) !== 0)
          return false;
        for (a = b.child;a !== null; ) {
          if ((a.flags & 12854) !== 0 || (a.subtreeFlags & 12854) !== 0)
            return false;
          a = a.sibling;
        }
        return true;
      }
      var vg, wg, xg, yg;
      if (Ta)
        vg = function(a, b) {
          for (var c = b.child;c !== null; ) {
            if (c.tag === 5 || c.tag === 6)
              Ka(a, c.stateNode);
            else if (c.tag !== 4 && c.child !== null) {
              c.child.return = c;
              c = c.child;
              continue;
            }
            if (c === b)
              break;
            for (;c.sibling === null; ) {
              if (c.return === null || c.return === b)
                return;
              c = c.return;
            }
            c.sibling.return = c.return;
            c = c.sibling;
          }
        }, wg = function() {}, xg = function(a, b, c, d, e) {
          a = a.memoizedProps;
          if (a !== d) {
            var f = b.stateNode, g = re(oe.current);
            c = Ma(f, c, a, d, e, g);
            (b.updateQueue = c) && tg(b);
          }
        }, yg = function(a, b, c, d) {
          c !== d && tg(b);
        };
      else if (Ua) {
        vg = function(a, b, c, d) {
          for (var e = b.child;e !== null; ) {
            if (e.tag === 5) {
              var f = e.stateNode;
              c && d && (f = Eb(f, e.type, e.memoizedProps, e));
              Ka(a, f);
            } else if (e.tag === 6)
              f = e.stateNode, c && d && (f = Fb(f, e.memoizedProps, e)), Ka(a, f);
            else if (e.tag !== 4) {
              if (e.tag === 22 && e.memoizedState !== null)
                f = e.child, f !== null && (f.return = e), vg(a, e, true, true);
              else if (e.child !== null) {
                e.child.return = e;
                e = e.child;
                continue;
              }
            }
            if (e === b)
              break;
            for (;e.sibling === null; ) {
              if (e.return === null || e.return === b)
                return;
              e = e.return;
            }
            e.sibling.return = e.return;
            e = e.sibling;
          }
        };
        var zg = function(a, b, c, d) {
          for (var e = b.child;e !== null; ) {
            if (e.tag === 5) {
              var f = e.stateNode;
              c && d && (f = Eb(f, e.type, e.memoizedProps, e));
              Ab(a, f);
            } else if (e.tag === 6)
              f = e.stateNode, c && d && (f = Fb(f, e.memoizedProps, e)), Ab(a, f);
            else if (e.tag !== 4) {
              if (e.tag === 22 && e.memoizedState !== null)
                f = e.child, f !== null && (f.return = e), zg(a, e, true, true);
              else if (e.child !== null) {
                e.child.return = e;
                e = e.child;
                continue;
              }
            }
            if (e === b)
              break;
            for (;e.sibling === null; ) {
              if (e.return === null || e.return === b)
                return;
              e = e.return;
            }
            e.sibling.return = e.return;
            e = e.sibling;
          }
        };
        wg = function(a, b) {
          var c = b.stateNode;
          if (!ug(a, b)) {
            a = c.containerInfo;
            var d = zb(a);
            zg(d, b, false, false);
            c.pendingChildren = d;
            tg(b);
            Bb(a, d);
          }
        };
        xg = function(a, b, c, d, e) {
          var { stateNode: f, memoizedProps: g } = a;
          if ((a = ug(a, b)) && g === d)
            b.stateNode = f;
          else {
            var h = b.stateNode, k = re(oe.current), l = null;
            g !== d && (l = Ma(h, c, g, d, e, k));
            a && l === null ? b.stateNode = f : (f = yb(f, l, c, g, d, b, a, h), La(f, c, d, e, k) && tg(b), b.stateNode = f, a ? tg(b) : vg(f, b, false, false));
          }
        };
        yg = function(a, b, c, d) {
          c !== d ? (a = re(qe.current), c = re(oe.current), b.stateNode = Oa(d, a, c, b), tg(b)) : b.stateNode = a.stateNode;
        };
      } else
        wg = function() {}, xg = function() {}, yg = function() {};
      function Ag(a, b) {
        if (!F)
          switch (a.tailMode) {
            case "hidden":
              b = a.tail;
              for (var c = null;b !== null; )
                b.alternate !== null && (c = b), b = b.sibling;
              c === null ? a.tail = null : c.sibling = null;
              break;
            case "collapsed":
              c = a.tail;
              for (var d = null;c !== null; )
                c.alternate !== null && (d = c), c = c.sibling;
              d === null ? b || a.tail === null ? a.tail = null : a.tail.sibling = null : d.sibling = null;
          }
      }
      function Q(a) {
        var b = a.alternate !== null && a.alternate.child === a.child, c = 0, d = 0;
        if (b)
          for (var e = a.child;e !== null; )
            c |= e.lanes | e.childLanes, d |= e.subtreeFlags & 14680064, d |= e.flags & 14680064, e.return = a, e = e.sibling;
        else
          for (e = a.child;e !== null; )
            c |= e.lanes | e.childLanes, d |= e.subtreeFlags, d |= e.flags, e.return = a, e = e.sibling;
        a.subtreeFlags |= d;
        a.childLanes = c;
        return b;
      }
      function Bg(a, b, c) {
        var d = b.pendingProps;
        nd(b);
        switch (b.tag) {
          case 2:
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return Q(b), null;
          case 1:
            return A(b.type) && nc(), Q(b), null;
          case 3:
            c = b.stateNode;
            te();
            q(z);
            q(x);
            ye();
            c.pendingContext && (c.context = c.pendingContext, c.pendingContext = null);
            if (a === null || a.child === null)
              yd(b) ? tg(b) : a === null || a.memoizedState.isDehydrated && (b.flags & 256) === 0 || (b.flags |= 1024, rd !== null && (Cg(rd), rd = null));
            wg(a, b);
            Q(b);
            return null;
          case 5:
            ve(b);
            c = re(qe.current);
            var e = b.type;
            if (a !== null && b.stateNode != null)
              xg(a, b, e, d, c), a.ref !== b.ref && (b.flags |= 512, b.flags |= 2097152);
            else {
              if (!d) {
                if (b.stateNode === null)
                  throw Error(n(166));
                Q(b);
                return null;
              }
              a = re(oe.current);
              if (yd(b)) {
                if (!Va)
                  throw Error(n(175));
                a = Rb(b.stateNode, b.type, b.memoizedProps, c, a, b, !qd);
                b.updateQueue = a;
                a !== null && tg(b);
              } else {
                var f = Ja(e, d, c, a, b);
                vg(f, b, false, false);
                b.stateNode = f;
                La(f, e, d, c, a) && tg(b);
              }
              b.ref !== null && (b.flags |= 512, b.flags |= 2097152);
            }
            Q(b);
            return null;
          case 6:
            if (a && b.stateNode != null)
              yg(a, b, a.memoizedProps, d);
            else {
              if (typeof d !== "string" && b.stateNode === null)
                throw Error(n(166));
              a = re(qe.current);
              c = re(oe.current);
              if (yd(b)) {
                if (!Va)
                  throw Error(n(176));
                a = b.stateNode;
                c = b.memoizedProps;
                if (d = Sb(a, c, b, !qd)) {
                  if (e = od, e !== null)
                    switch (e.tag) {
                      case 3:
                        $b(e.stateNode.containerInfo, a, c, (e.mode & 1) !== 0);
                        break;
                      case 5:
                        ac(e.type, e.memoizedProps, e.stateNode, a, c, (e.mode & 1) !== 0);
                    }
                }
                d && tg(b);
              } else
                b.stateNode = Oa(d, a, c, b);
            }
            Q(b);
            return null;
          case 13:
            q(I);
            d = b.memoizedState;
            if (a === null || a.memoizedState !== null && a.memoizedState.dehydrated !== null) {
              if (F && pd !== null && (b.mode & 1) !== 0 && (b.flags & 128) === 0)
                zd(), Ad(), b.flags |= 98560, e = false;
              else if (e = yd(b), d !== null && d.dehydrated !== null) {
                if (a === null) {
                  if (!e)
                    throw Error(n(318));
                  if (!Va)
                    throw Error(n(344));
                  e = b.memoizedState;
                  e = e !== null ? e.dehydrated : null;
                  if (!e)
                    throw Error(n(317));
                  Tb(e, b);
                } else
                  Ad(), (b.flags & 128) === 0 && (b.memoizedState = null), b.flags |= 4;
                Q(b);
                e = false;
              } else
                rd !== null && (Cg(rd), rd = null), e = true;
              if (!e)
                return b.flags & 65536 ? b : null;
            }
            if ((b.flags & 128) !== 0)
              return b.lanes = c, b;
            c = d !== null;
            c !== (a !== null && a.memoizedState !== null) && c && (b.child.flags |= 8192, (b.mode & 1) !== 0 && (a === null || (I.current & 1) !== 0 ? R === 0 && (R = 3) : ng()));
            b.updateQueue !== null && (b.flags |= 4);
            Q(b);
            return null;
          case 4:
            return te(), wg(a, b), a === null && Xa(b.stateNode.containerInfo), Q(b), null;
          case 10:
            return Wd(b.type._context), Q(b), null;
          case 17:
            return A(b.type) && nc(), Q(b), null;
          case 19:
            q(I);
            e = b.memoizedState;
            if (e === null)
              return Q(b), null;
            d = (b.flags & 128) !== 0;
            f = e.rendering;
            if (f === null)
              if (d)
                Ag(e, false);
              else {
                if (R !== 0 || a !== null && (a.flags & 128) !== 0)
                  for (a = b.child;a !== null; ) {
                    f = we(a);
                    if (f !== null) {
                      b.flags |= 128;
                      Ag(e, false);
                      a = f.updateQueue;
                      a !== null && (b.updateQueue = a, b.flags |= 4);
                      b.subtreeFlags = 0;
                      a = c;
                      for (c = b.child;c !== null; )
                        d = c, e = a, d.flags &= 14680066, f = d.alternate, f === null ? (d.childLanes = 0, d.lanes = e, d.child = null, d.subtreeFlags = 0, d.memoizedProps = null, d.memoizedState = null, d.updateQueue = null, d.dependencies = null, d.stateNode = null) : (d.childLanes = f.childLanes, d.lanes = f.lanes, d.child = f.child, d.subtreeFlags = 0, d.deletions = null, d.memoizedProps = f.memoizedProps, d.memoizedState = f.memoizedState, d.updateQueue = f.updateQueue, d.type = f.type, e = f.dependencies, d.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }), c = c.sibling;
                      v(I, I.current & 1 | 2);
                      return b.child;
                    }
                    a = a.sibling;
                  }
                e.tail !== null && D() > Dg && (b.flags |= 128, d = true, Ag(e, false), b.lanes = 4194304);
              }
            else {
              if (!d)
                if (a = we(f), a !== null) {
                  if (b.flags |= 128, d = true, a = a.updateQueue, a !== null && (b.updateQueue = a, b.flags |= 4), Ag(e, true), e.tail === null && e.tailMode === "hidden" && !f.alternate && !F)
                    return Q(b), null;
                } else
                  2 * D() - e.renderingStartTime > Dg && c !== 1073741824 && (b.flags |= 128, d = true, Ag(e, false), b.lanes = 4194304);
              e.isBackwards ? (f.sibling = b.child, b.child = f) : (a = e.last, a !== null ? a.sibling = f : b.child = f, e.last = f);
            }
            if (e.tail !== null)
              return b = e.tail, e.rendering = b, e.tail = b.sibling, e.renderingStartTime = D(), b.sibling = null, a = I.current, v(I, d ? a & 1 | 2 : a & 1), b;
            Q(b);
            return null;
          case 22:
          case 23:
            return Eg(), c = b.memoizedState !== null, a !== null && a.memoizedState !== null !== c && (b.flags |= 8192), c && (b.mode & 1) !== 0 ? ($f & 1073741824) !== 0 && (Q(b), Ta && b.subtreeFlags & 6 && (b.flags |= 8192)) : Q(b), null;
          case 24:
            return null;
          case 25:
            return null;
        }
        throw Error(n(156, b.tag));
      }
      function Fg(a, b) {
        nd(b);
        switch (b.tag) {
          case 1:
            return A(b.type) && nc(), a = b.flags, a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
          case 3:
            return te(), q(z), q(x), ye(), a = b.flags, (a & 65536) !== 0 && (a & 128) === 0 ? (b.flags = a & -65537 | 128, b) : null;
          case 5:
            return ve(b), null;
          case 13:
            q(I);
            a = b.memoizedState;
            if (a !== null && a.dehydrated !== null) {
              if (b.alternate === null)
                throw Error(n(340));
              Ad();
            }
            a = b.flags;
            return a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
          case 19:
            return q(I), null;
          case 4:
            return te(), null;
          case 10:
            return Wd(b.type._context), null;
          case 22:
          case 23:
            return Eg(), null;
          case 24:
            return null;
          default:
            return null;
        }
      }
      var Gg = false, S = false, Hg = typeof WeakSet === "function" ? WeakSet : Set, T = null;
      function Ig(a, b) {
        var c = a.ref;
        if (c !== null)
          if (typeof c === "function")
            try {
              c(null);
            } catch (d) {
              U(a, b, d);
            }
          else
            c.current = null;
      }
      function Jg(a, b, c) {
        try {
          c();
        } catch (d) {
          U(a, b, d);
        }
      }
      var Kg = false;
      function Lg(a, b) {
        Ha(a.containerInfo);
        for (T = b;T !== null; )
          if (a = T, b = a.child, (a.subtreeFlags & 1028) !== 0 && b !== null)
            b.return = a, T = b;
          else
            for (;T !== null; ) {
              a = T;
              try {
                var c = a.alternate;
                if ((a.flags & 1024) !== 0)
                  switch (a.tag) {
                    case 0:
                    case 11:
                    case 15:
                      break;
                    case 1:
                      if (c !== null) {
                        var { memoizedProps: d, memoizedState: e } = c, f = a.stateNode, g = f.getSnapshotBeforeUpdate(a.elementType === a.type ? d : xf(a.type, d), e);
                        f.__reactInternalSnapshotBeforeUpdate = g;
                      }
                      break;
                    case 3:
                      Ta && xb(a.stateNode.containerInfo);
                      break;
                    case 5:
                    case 6:
                    case 4:
                    case 17:
                      break;
                    default:
                      throw Error(n(163));
                  }
              } catch (h) {
                U(a, a.return, h);
              }
              b = a.sibling;
              if (b !== null) {
                b.return = a.return;
                T = b;
                break;
              }
              T = a.return;
            }
        c = Kg;
        Kg = false;
        return c;
      }
      function Mg(a, b, c) {
        var d = b.updateQueue;
        d = d !== null ? d.lastEffect : null;
        if (d !== null) {
          var e = d = d.next;
          do {
            if ((e.tag & a) === a) {
              var f = e.destroy;
              e.destroy = undefined;
              f !== undefined && Jg(b, c, f);
            }
            e = e.next;
          } while (e !== d);
        }
      }
      function Ng(a, b) {
        b = b.updateQueue;
        b = b !== null ? b.lastEffect : null;
        if (b !== null) {
          var c = b = b.next;
          do {
            if ((c.tag & a) === a) {
              var d = c.create;
              c.destroy = d();
            }
            c = c.next;
          } while (c !== b);
        }
      }
      function Og(a) {
        var b = a.ref;
        if (b !== null) {
          var c = a.stateNode;
          switch (a.tag) {
            case 5:
              a = Ea(c);
              break;
            default:
              a = c;
          }
          typeof b === "function" ? b(a) : b.current = a;
        }
      }
      function Pg(a) {
        var b = a.alternate;
        b !== null && (a.alternate = null, Pg(b));
        a.child = null;
        a.deletions = null;
        a.sibling = null;
        a.tag === 5 && (b = a.stateNode, b !== null && Za(b));
        a.stateNode = null;
        a.return = null;
        a.dependencies = null;
        a.memoizedProps = null;
        a.memoizedState = null;
        a.pendingProps = null;
        a.stateNode = null;
        a.updateQueue = null;
      }
      function Qg(a) {
        return a.tag === 5 || a.tag === 3 || a.tag === 4;
      }
      function Rg(a) {
        a:
          for (;; ) {
            for (;a.sibling === null; ) {
              if (a.return === null || Qg(a.return))
                return null;
              a = a.return;
            }
            a.sibling.return = a.return;
            for (a = a.sibling;a.tag !== 5 && a.tag !== 6 && a.tag !== 18; ) {
              if (a.flags & 2)
                continue a;
              if (a.child === null || a.tag === 4)
                continue a;
              else
                a.child.return = a, a = a.child;
            }
            if (!(a.flags & 2))
              return a.stateNode;
          }
      }
      function Sg(a, b, c) {
        var d = a.tag;
        if (d === 5 || d === 6)
          a = a.stateNode, b ? pb(c, a, b) : kb(c, a);
        else if (d !== 4 && (a = a.child, a !== null))
          for (Sg(a, b, c), a = a.sibling;a !== null; )
            Sg(a, b, c), a = a.sibling;
      }
      function Tg(a, b, c) {
        var d = a.tag;
        if (d === 5 || d === 6)
          a = a.stateNode, b ? ob(c, a, b) : jb(c, a);
        else if (d !== 4 && (a = a.child, a !== null))
          for (Tg(a, b, c), a = a.sibling;a !== null; )
            Tg(a, b, c), a = a.sibling;
      }
      var V = null, Ug = false;
      function Vg(a, b, c) {
        for (c = c.child;c !== null; )
          Wg(a, b, c), c = c.sibling;
      }
      function Wg(a, b, c) {
        if (Sc && typeof Sc.onCommitFiberUnmount === "function")
          try {
            Sc.onCommitFiberUnmount(Rc, c);
          } catch (h) {}
        switch (c.tag) {
          case 5:
            S || Ig(c, b);
          case 6:
            if (Ta) {
              var d = V, e = Ug;
              V = null;
              Vg(a, b, c);
              V = d;
              Ug = e;
              V !== null && (Ug ? rb(V, c.stateNode) : qb(V, c.stateNode));
            } else
              Vg(a, b, c);
            break;
          case 18:
            Ta && V !== null && (Ug ? Yb(V, c.stateNode) : Xb(V, c.stateNode));
            break;
          case 4:
            Ta ? (d = V, e = Ug, V = c.stateNode.containerInfo, Ug = true, Vg(a, b, c), V = d, Ug = e) : (Ua && (d = c.stateNode.containerInfo, e = zb(d), Cb(d, e)), Vg(a, b, c));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            if (!S && (d = c.updateQueue, d !== null && (d = d.lastEffect, d !== null))) {
              e = d = d.next;
              do {
                var f = e, g = f.destroy;
                f = f.tag;
                g !== undefined && ((f & 2) !== 0 ? Jg(c, b, g) : (f & 4) !== 0 && Jg(c, b, g));
                e = e.next;
              } while (e !== d);
            }
            Vg(a, b, c);
            break;
          case 1:
            if (!S && (Ig(c, b), d = c.stateNode, typeof d.componentWillUnmount === "function"))
              try {
                d.props = c.memoizedProps, d.state = c.memoizedState, d.componentWillUnmount();
              } catch (h) {
                U(c, b, h);
              }
            Vg(a, b, c);
            break;
          case 21:
            Vg(a, b, c);
            break;
          case 22:
            c.mode & 1 ? (S = (d = S) || c.memoizedState !== null, Vg(a, b, c), S = d) : Vg(a, b, c);
            break;
          default:
            Vg(a, b, c);
        }
      }
      function Xg(a) {
        var b = a.updateQueue;
        if (b !== null) {
          a.updateQueue = null;
          var c = a.stateNode;
          c === null && (c = a.stateNode = new Hg);
          b.forEach(function(b2) {
            var d = Yg.bind(null, a, b2);
            c.has(b2) || (c.add(b2), b2.then(d, d));
          });
        }
      }
      function Zg(a, b) {
        var c = b.deletions;
        if (c !== null)
          for (var d = 0;d < c.length; d++) {
            var e = c[d];
            try {
              var f = a, g = b;
              if (Ta) {
                var h = g;
                a:
                  for (;h !== null; ) {
                    switch (h.tag) {
                      case 5:
                        V = h.stateNode;
                        Ug = false;
                        break a;
                      case 3:
                        V = h.stateNode.containerInfo;
                        Ug = true;
                        break a;
                      case 4:
                        V = h.stateNode.containerInfo;
                        Ug = true;
                        break a;
                    }
                    h = h.return;
                  }
                if (V === null)
                  throw Error(n(160));
                Wg(f, g, e);
                V = null;
                Ug = false;
              } else
                Wg(f, g, e);
              var k = e.alternate;
              k !== null && (k.return = null);
              e.return = null;
            } catch (l) {
              U(e, b, l);
            }
          }
        if (b.subtreeFlags & 12854)
          for (b = b.child;b !== null; )
            $g(b, a), b = b.sibling;
      }
      function $g(a, b) {
        var { alternate: c, flags: d } = a;
        switch (a.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            Zg(b, a);
            ah(a);
            if (d & 4) {
              try {
                Mg(3, a, a.return), Ng(3, a);
              } catch (p) {
                U(a, a.return, p);
              }
              try {
                Mg(5, a, a.return);
              } catch (p) {
                U(a, a.return, p);
              }
            }
            break;
          case 1:
            Zg(b, a);
            ah(a);
            d & 512 && c !== null && Ig(c, c.return);
            break;
          case 5:
            Zg(b, a);
            ah(a);
            d & 512 && c !== null && Ig(c, c.return);
            if (Ta) {
              if (a.flags & 32) {
                var e = a.stateNode;
                try {
                  sb(e);
                } catch (p) {
                  U(a, a.return, p);
                }
              }
              if (d & 4 && (e = a.stateNode, e != null)) {
                var f = a.memoizedProps;
                c = c !== null ? c.memoizedProps : f;
                d = a.type;
                b = a.updateQueue;
                a.updateQueue = null;
                if (b !== null)
                  try {
                    nb(e, b, d, c, f, a);
                  } catch (p) {
                    U(a, a.return, p);
                  }
              }
            }
            break;
          case 6:
            Zg(b, a);
            ah(a);
            if (d & 4 && Ta) {
              if (a.stateNode === null)
                throw Error(n(162));
              e = a.stateNode;
              f = a.memoizedProps;
              c = c !== null ? c.memoizedProps : f;
              try {
                lb(e, c, f);
              } catch (p) {
                U(a, a.return, p);
              }
            }
            break;
          case 3:
            Zg(b, a);
            ah(a);
            if (d & 4) {
              if (Ta && Va && c !== null && c.memoizedState.isDehydrated)
                try {
                  Vb(b.containerInfo);
                } catch (p) {
                  U(a, a.return, p);
                }
              if (Ua) {
                e = b.containerInfo;
                f = b.pendingChildren;
                try {
                  Cb(e, f);
                } catch (p) {
                  U(a, a.return, p);
                }
              }
            }
            break;
          case 4:
            Zg(b, a);
            ah(a);
            if (d & 4 && Ua) {
              f = a.stateNode;
              e = f.containerInfo;
              f = f.pendingChildren;
              try {
                Cb(e, f);
              } catch (p) {
                U(a, a.return, p);
              }
            }
            break;
          case 13:
            Zg(b, a);
            ah(a);
            e = a.child;
            e.flags & 8192 && (f = e.memoizedState !== null, e.stateNode.isHidden = f, !f || e.alternate !== null && e.alternate.memoizedState !== null || (bh = D()));
            d & 4 && Xg(a);
            break;
          case 22:
            var g = c !== null && c.memoizedState !== null;
            a.mode & 1 ? (S = (c = S) || g, Zg(b, a), S = c) : Zg(b, a);
            ah(a);
            if (d & 8192) {
              c = a.memoizedState !== null;
              if ((a.stateNode.isHidden = c) && !g && (a.mode & 1) !== 0)
                for (T = a, d = a.child;d !== null; ) {
                  for (b = T = d;T !== null; ) {
                    g = T;
                    var h = g.child;
                    switch (g.tag) {
                      case 0:
                      case 11:
                      case 14:
                      case 15:
                        Mg(4, g, g.return);
                        break;
                      case 1:
                        Ig(g, g.return);
                        var k = g.stateNode;
                        if (typeof k.componentWillUnmount === "function") {
                          var l = g, m = g.return;
                          try {
                            var r = l;
                            k.props = r.memoizedProps;
                            k.state = r.memoizedState;
                            k.componentWillUnmount();
                          } catch (p) {
                            U(l, m, p);
                          }
                        }
                        break;
                      case 5:
                        Ig(g, g.return);
                        break;
                      case 22:
                        if (g.memoizedState !== null) {
                          ch(b);
                          continue;
                        }
                    }
                    h !== null ? (h.return = g, T = h) : ch(b);
                  }
                  d = d.sibling;
                }
              if (Ta)
                a:
                  if (d = null, Ta)
                    for (b = a;; ) {
                      if (b.tag === 5) {
                        if (d === null) {
                          d = b;
                          try {
                            e = b.stateNode, c ? tb(e) : vb(b.stateNode, b.memoizedProps);
                          } catch (p) {
                            U(a, a.return, p);
                          }
                        }
                      } else if (b.tag === 6) {
                        if (d === null)
                          try {
                            f = b.stateNode, c ? ub(f) : wb(f, b.memoizedProps);
                          } catch (p) {
                            U(a, a.return, p);
                          }
                      } else if ((b.tag !== 22 && b.tag !== 23 || b.memoizedState === null || b === a) && b.child !== null) {
                        b.child.return = b;
                        b = b.child;
                        continue;
                      }
                      if (b === a)
                        break a;
                      for (;b.sibling === null; ) {
                        if (b.return === null || b.return === a)
                          break a;
                        d === b && (d = null);
                        b = b.return;
                      }
                      d === b && (d = null);
                      b.sibling.return = b.return;
                      b = b.sibling;
                    }
            }
            break;
          case 19:
            Zg(b, a);
            ah(a);
            d & 4 && Xg(a);
            break;
          case 21:
            break;
          default:
            Zg(b, a), ah(a);
        }
      }
      function ah(a) {
        var b = a.flags;
        if (b & 2) {
          try {
            if (Ta) {
              b: {
                for (var c = a.return;c !== null; ) {
                  if (Qg(c)) {
                    var d = c;
                    break b;
                  }
                  c = c.return;
                }
                throw Error(n(160));
              }
              switch (d.tag) {
                case 5:
                  var e = d.stateNode;
                  d.flags & 32 && (sb(e), d.flags &= -33);
                  var f = Rg(a);
                  Tg(a, f, e);
                  break;
                case 3:
                case 4:
                  var g = d.stateNode.containerInfo, h = Rg(a);
                  Sg(a, h, g);
                  break;
                default:
                  throw Error(n(161));
              }
            }
          } catch (k) {
            U(a, a.return, k);
          }
          a.flags &= -3;
        }
        b & 4096 && (a.flags &= -4097);
      }
      function dh(a, b, c) {
        T = a;
        eh(a, b, c);
      }
      function eh(a, b, c) {
        for (var d = (a.mode & 1) !== 0;T !== null; ) {
          var e = T, f = e.child;
          if (e.tag === 22 && d) {
            var g = e.memoizedState !== null || Gg;
            if (!g) {
              var h = e.alternate, k = h !== null && h.memoizedState !== null || S;
              h = Gg;
              var l = S;
              Gg = g;
              if ((S = k) && !l)
                for (T = e;T !== null; )
                  g = T, k = g.child, g.tag === 22 && g.memoizedState !== null ? fh(e) : k !== null ? (k.return = g, T = k) : fh(e);
              for (;f !== null; )
                T = f, eh(f, b, c), f = f.sibling;
              T = e;
              Gg = h;
              S = l;
            }
            gh(a, b, c);
          } else
            (e.subtreeFlags & 8772) !== 0 && f !== null ? (f.return = e, T = f) : gh(a, b, c);
        }
      }
      function gh(a) {
        for (;T !== null; ) {
          var b = T;
          if ((b.flags & 8772) !== 0) {
            var c = b.alternate;
            try {
              if ((b.flags & 8772) !== 0)
                switch (b.tag) {
                  case 0:
                  case 11:
                  case 15:
                    S || Ng(5, b);
                    break;
                  case 1:
                    var d = b.stateNode;
                    if (b.flags & 4 && !S)
                      if (c === null)
                        d.componentDidMount();
                      else {
                        var e = b.elementType === b.type ? c.memoizedProps : xf(b.type, c.memoizedProps);
                        d.componentDidUpdate(e, c.memoizedState, d.__reactInternalSnapshotBeforeUpdate);
                      }
                    var f = b.updateQueue;
                    f !== null && me(b, f, d);
                    break;
                  case 3:
                    var g = b.updateQueue;
                    if (g !== null) {
                      c = null;
                      if (b.child !== null)
                        switch (b.child.tag) {
                          case 5:
                            c = Ea(b.child.stateNode);
                            break;
                          case 1:
                            c = b.child.stateNode;
                        }
                      me(b, g, c);
                    }
                    break;
                  case 5:
                    var h = b.stateNode;
                    c === null && b.flags & 4 && mb(h, b.type, b.memoizedProps, b);
                    break;
                  case 6:
                    break;
                  case 4:
                    break;
                  case 12:
                    break;
                  case 13:
                    if (Va && b.memoizedState === null) {
                      var k = b.alternate;
                      if (k !== null) {
                        var l = k.memoizedState;
                        if (l !== null) {
                          var m = l.dehydrated;
                          m !== null && Wb(m);
                        }
                      }
                    }
                    break;
                  case 19:
                  case 17:
                  case 21:
                  case 22:
                  case 23:
                  case 25:
                    break;
                  default:
                    throw Error(n(163));
                }
              S || b.flags & 512 && Og(b);
            } catch (r) {
              U(b, b.return, r);
            }
          }
          if (b === a) {
            T = null;
            break;
          }
          c = b.sibling;
          if (c !== null) {
            c.return = b.return;
            T = c;
            break;
          }
          T = b.return;
        }
      }
      function ch(a) {
        for (;T !== null; ) {
          var b = T;
          if (b === a) {
            T = null;
            break;
          }
          var c = b.sibling;
          if (c !== null) {
            c.return = b.return;
            T = c;
            break;
          }
          T = b.return;
        }
      }
      function fh(a) {
        for (;T !== null; ) {
          var b = T;
          try {
            switch (b.tag) {
              case 0:
              case 11:
              case 15:
                var c = b.return;
                try {
                  Ng(4, b);
                } catch (k) {
                  U(b, c, k);
                }
                break;
              case 1:
                var d = b.stateNode;
                if (typeof d.componentDidMount === "function") {
                  var e = b.return;
                  try {
                    d.componentDidMount();
                  } catch (k) {
                    U(b, e, k);
                  }
                }
                var f = b.return;
                try {
                  Og(b);
                } catch (k) {
                  U(b, f, k);
                }
                break;
              case 5:
                var g = b.return;
                try {
                  Og(b);
                } catch (k) {
                  U(b, g, k);
                }
            }
          } catch (k) {
            U(b, b.return, k);
          }
          if (b === a) {
            T = null;
            break;
          }
          var h = b.sibling;
          if (h !== null) {
            h.return = b.return;
            T = h;
            break;
          }
          T = b.return;
        }
      }
      var hh = 0, ih = 1, jh = 2, kh = 3, lh = 4;
      if (typeof Symbol === "function" && Symbol.for) {
        var mh = Symbol.for;
        hh = mh("selector.component");
        ih = mh("selector.has_pseudo_class");
        jh = mh("selector.role");
        kh = mh("selector.test_id");
        lh = mh("selector.text");
      }
      function nh(a) {
        var b = Wa(a);
        if (b != null) {
          if (typeof b.memoizedProps["data-testname"] !== "string")
            throw Error(n(364));
          return b;
        }
        a = cb(a);
        if (a === null)
          throw Error(n(362));
        return a.stateNode.current;
      }
      function oh(a, b) {
        switch (b.$$typeof) {
          case hh:
            if (a.type === b.value)
              return true;
            break;
          case ih:
            a: {
              b = b.value;
              a = [a, 0];
              for (var c = 0;c < a.length; ) {
                var d = a[c++], e = a[c++], f = b[e];
                if (d.tag !== 5 || !fb(d)) {
                  for (;f != null && oh(d, f); )
                    e++, f = b[e];
                  if (e === b.length) {
                    b = true;
                    break a;
                  } else
                    for (d = d.child;d !== null; )
                      a.push(d, e), d = d.sibling;
                }
              }
              b = false;
            }
            return b;
          case jh:
            if (a.tag === 5 && gb(a.stateNode, b.value))
              return true;
            break;
          case lh:
            if (a.tag === 5 || a.tag === 6) {
              if (a = eb(a), a !== null && 0 <= a.indexOf(b.value))
                return true;
            }
            break;
          case kh:
            if (a.tag === 5 && (a = a.memoizedProps["data-testname"], typeof a === "string" && a.toLowerCase() === b.value.toLowerCase()))
              return true;
            break;
          default:
            throw Error(n(365));
        }
        return false;
      }
      function ph(a) {
        switch (a.$$typeof) {
          case hh:
            return "<" + (ua(a.value) || "Unknown") + ">";
          case ih:
            return ":has(" + (ph(a) || "") + ")";
          case jh:
            return '[role="' + a.value + '"]';
          case lh:
            return '"' + a.value + '"';
          case kh:
            return '[data-testname="' + a.value + '"]';
          default:
            throw Error(n(365));
        }
      }
      function qh(a, b) {
        var c = [];
        a = [a, 0];
        for (var d = 0;d < a.length; ) {
          var e = a[d++], f = a[d++], g = b[f];
          if (e.tag !== 5 || !fb(e)) {
            for (;g != null && oh(e, g); )
              f++, g = b[f];
            if (f === b.length)
              c.push(e);
            else
              for (e = e.child;e !== null; )
                a.push(e, f), e = e.sibling;
          }
        }
        return c;
      }
      function rh(a, b) {
        if (!bb)
          throw Error(n(363));
        a = nh(a);
        a = qh(a, b);
        b = [];
        a = Array.from(a);
        for (var c = 0;c < a.length; ) {
          var d = a[c++];
          if (d.tag === 5)
            fb(d) || b.push(d.stateNode);
          else
            for (d = d.child;d !== null; )
              a.push(d), d = d.sibling;
        }
        return b;
      }
      var sh = Math.ceil, th = da.ReactCurrentDispatcher, uh = da.ReactCurrentOwner, W = da.ReactCurrentBatchConfig, H = 0, N = null, X = null, Z = 0, $f = 0, Zf = ic(0), R = 0, vh = null, le = 0, wh = 0, xh = 0, yh = null, zh = null, bh = 0, Dg = Infinity, Ah = null;
      function Bh() {
        Dg = D() + 500;
      }
      var Jf = false, Kf = null, Mf = null, Ch = false, Dh = null, Eh = 0, Fh = 0, Gh = null, Hh = -1, Ih = 0;
      function O() {
        return (H & 6) !== 0 ? D() : Hh !== -1 ? Hh : Hh = D();
      }
      function tf(a) {
        if ((a.mode & 1) === 0)
          return 1;
        if ((H & 2) !== 0 && Z !== 0)
          return Z & -Z;
        if (Cd.transition !== null)
          return Ih === 0 && (Ih = Dc()), Ih;
        a = C;
        return a !== 0 ? a : Ya();
      }
      function af(a, b, c, d) {
        if (50 < Fh)
          throw Fh = 0, Gh = null, Error(n(185));
        Fc(a, c, d);
        if ((H & 2) === 0 || a !== N)
          a === N && ((H & 2) === 0 && (wh |= c), R === 4 && Jh(a, Z)), Kh(a, d), c === 1 && H === 0 && (b.mode & 1) === 0 && (Bh(), Xc && ad());
      }
      function Kh(a, b) {
        var c = a.callbackNode;
        Bc(a, b);
        var d = zc(a, a === N ? Z : 0);
        if (d === 0)
          c !== null && Kc(c), a.callbackNode = null, a.callbackPriority = 0;
        else if (b = d & -d, a.callbackPriority !== b) {
          c != null && Kc(c);
          if (b === 1)
            a.tag === 0 ? $c(Lh.bind(null, a)) : Zc(Lh.bind(null, a)), $a ? ab(function() {
              (H & 6) === 0 && ad();
            }) : Jc(Nc, ad), c = null;
          else {
            switch (Ic(d)) {
              case 1:
                c = Nc;
                break;
              case 4:
                c = Oc;
                break;
              case 16:
                c = Pc;
                break;
              case 536870912:
                c = Qc;
                break;
              default:
                c = Pc;
            }
            c = Mh(c, Nh.bind(null, a));
          }
          a.callbackPriority = b;
          a.callbackNode = c;
        }
      }
      function Nh(a, b) {
        Hh = -1;
        Ih = 0;
        if ((H & 6) !== 0)
          throw Error(n(327));
        var c = a.callbackNode;
        if (Oh() && a.callbackNode !== c)
          return null;
        var d = zc(a, a === N ? Z : 0);
        if (d === 0)
          return null;
        if ((d & 30) !== 0 || (d & a.expiredLanes) !== 0 || b)
          b = Ph(a, d);
        else {
          b = d;
          var e = H;
          H |= 2;
          var f = Qh();
          if (N !== a || Z !== b)
            Ah = null, Bh(), Rh(a, b);
          do
            try {
              Sh();
              break;
            } catch (h) {
              Th(a, h);
            }
          while (1);
          Ud();
          th.current = f;
          H = e;
          X !== null ? b = 0 : (N = null, Z = 0, b = R);
        }
        if (b !== 0) {
          b === 2 && (e = Cc(a), e !== 0 && (d = e, b = Uh(a, e)));
          if (b === 1)
            throw c = vh, Rh(a, 0), Jh(a, d), Kh(a, D()), c;
          if (b === 6)
            Jh(a, d);
          else {
            e = a.current.alternate;
            if ((d & 30) === 0 && !Vh(e) && (b = Ph(a, d), b === 2 && (f = Cc(a), f !== 0 && (d = f, b = Uh(a, f))), b === 1))
              throw c = vh, Rh(a, 0), Jh(a, d), Kh(a, D()), c;
            a.finishedWork = e;
            a.finishedLanes = d;
            switch (b) {
              case 0:
              case 1:
                throw Error(n(345));
              case 2:
                Wh(a, zh, Ah);
                break;
              case 3:
                Jh(a, d);
                if ((d & 130023424) === d && (b = bh + 500 - D(), 10 < b)) {
                  if (zc(a, 0) !== 0)
                    break;
                  e = a.suspendedLanes;
                  if ((e & d) !== d) {
                    O();
                    a.pingedLanes |= a.suspendedLanes & e;
                    break;
                  }
                  a.timeoutHandle = Pa(Wh.bind(null, a, zh, Ah), b);
                  break;
                }
                Wh(a, zh, Ah);
                break;
              case 4:
                Jh(a, d);
                if ((d & 4194240) === d)
                  break;
                b = a.eventTimes;
                for (e = -1;0 < d; ) {
                  var g = 31 - tc(d);
                  f = 1 << g;
                  g = b[g];
                  g > e && (e = g);
                  d &= ~f;
                }
                d = e;
                d = D() - d;
                d = (120 > d ? 120 : 480 > d ? 480 : 1080 > d ? 1080 : 1920 > d ? 1920 : 3000 > d ? 3000 : 4320 > d ? 4320 : 1960 * sh(d / 1960)) - d;
                if (10 < d) {
                  a.timeoutHandle = Pa(Wh.bind(null, a, zh, Ah), d);
                  break;
                }
                Wh(a, zh, Ah);
                break;
              case 5:
                Wh(a, zh, Ah);
                break;
              default:
                throw Error(n(329));
            }
          }
        }
        Kh(a, D());
        return a.callbackNode === c ? Nh.bind(null, a) : null;
      }
      function Uh(a, b) {
        var c = yh;
        a.current.memoizedState.isDehydrated && (Rh(a, b).flags |= 256);
        a = Ph(a, b);
        a !== 2 && (b = zh, zh = c, b !== null && Cg(b));
        return a;
      }
      function Cg(a) {
        zh === null ? zh = a : zh.push.apply(zh, a);
      }
      function Vh(a) {
        for (var b = a;; ) {
          if (b.flags & 16384) {
            var c = b.updateQueue;
            if (c !== null && (c = c.stores, c !== null))
              for (var d = 0;d < c.length; d++) {
                var e = c[d], f = e.getSnapshot;
                e = e.value;
                try {
                  if (!Vc(f(), e))
                    return false;
                } catch (g) {
                  return false;
                }
              }
          }
          c = b.child;
          if (b.subtreeFlags & 16384 && c !== null)
            c.return = b, b = c;
          else {
            if (b === a)
              break;
            for (;b.sibling === null; ) {
              if (b.return === null || b.return === a)
                return true;
              b = b.return;
            }
            b.sibling.return = b.return;
            b = b.sibling;
          }
        }
        return true;
      }
      function Jh(a, b) {
        b &= ~xh;
        b &= ~wh;
        a.suspendedLanes |= b;
        a.pingedLanes &= ~b;
        for (a = a.expirationTimes;0 < b; ) {
          var c = 31 - tc(b), d = 1 << c;
          a[c] = -1;
          b &= ~d;
        }
      }
      function Lh(a) {
        if ((H & 6) !== 0)
          throw Error(n(327));
        Oh();
        var b = zc(a, 0);
        if ((b & 1) === 0)
          return Kh(a, D()), null;
        var c = Ph(a, b);
        if (a.tag !== 0 && c === 2) {
          var d = Cc(a);
          d !== 0 && (b = d, c = Uh(a, d));
        }
        if (c === 1)
          throw c = vh, Rh(a, 0), Jh(a, b), Kh(a, D()), c;
        if (c === 6)
          throw Error(n(345));
        a.finishedWork = a.current.alternate;
        a.finishedLanes = b;
        Wh(a, zh, Ah);
        Kh(a, D());
        return null;
      }
      function Xh(a) {
        Dh !== null && Dh.tag === 0 && (H & 6) === 0 && Oh();
        var b = H;
        H |= 1;
        var c = W.transition, d = C;
        try {
          if (W.transition = null, C = 1, a)
            return a();
        } finally {
          C = d, W.transition = c, H = b, (H & 6) === 0 && ad();
        }
      }
      function Eg() {
        $f = Zf.current;
        q(Zf);
      }
      function Rh(a, b) {
        a.finishedWork = null;
        a.finishedLanes = 0;
        var c = a.timeoutHandle;
        c !== Ra && (a.timeoutHandle = Ra, Qa(c));
        if (X !== null)
          for (c = X.return;c !== null; ) {
            var d = c;
            nd(d);
            switch (d.tag) {
              case 1:
                d = d.type.childContextTypes;
                d !== null && d !== undefined && nc();
                break;
              case 3:
                te();
                q(z);
                q(x);
                ye();
                break;
              case 5:
                ve(d);
                break;
              case 4:
                te();
                break;
              case 13:
                q(I);
                break;
              case 19:
                q(I);
                break;
              case 10:
                Wd(d.type._context);
                break;
              case 22:
              case 23:
                Eg();
            }
            c = c.return;
          }
        N = a;
        X = a = Jd(a.current, null);
        Z = $f = b;
        R = 0;
        vh = null;
        xh = wh = le = 0;
        zh = yh = null;
        if ($d !== null) {
          for (b = 0;b < $d.length; b++)
            if (c = $d[b], d = c.interleaved, d !== null) {
              c.interleaved = null;
              var e = d.next, f = c.pending;
              if (f !== null) {
                var g = f.next;
                f.next = e;
                d.next = g;
              }
              c.pending = d;
            }
          $d = null;
        }
        return a;
      }
      function Th(a, b) {
        do {
          var c = X;
          try {
            Ud();
            ze.current = Le;
            if (Ce) {
              for (var d = J.memoizedState;d !== null; ) {
                var e = d.queue;
                e !== null && (e.pending = null);
                d = d.next;
              }
              Ce = false;
            }
            Be = 0;
            L = K = J = null;
            De = false;
            Ee = 0;
            uh.current = null;
            if (c === null || c.return === null) {
              R = 1;
              vh = b;
              X = null;
              break;
            }
            a: {
              var f = a, g = c.return, h = c, k = b;
              b = Z;
              h.flags |= 32768;
              if (k !== null && typeof k === "object" && typeof k.then === "function") {
                var l = k, m = h, r = m.tag;
                if ((m.mode & 1) === 0 && (r === 0 || r === 11 || r === 15)) {
                  var p = m.alternate;
                  p ? (m.updateQueue = p.updateQueue, m.memoizedState = p.memoizedState, m.lanes = p.lanes) : (m.updateQueue = null, m.memoizedState = null);
                }
                var B = Pf(g);
                if (B !== null) {
                  B.flags &= -257;
                  Qf(B, g, h, f, b);
                  B.mode & 1 && Nf(f, l, b);
                  b = B;
                  k = l;
                  var w = b.updateQueue;
                  if (w === null) {
                    var Y = new Set;
                    Y.add(k);
                    b.updateQueue = Y;
                  } else
                    w.add(k);
                  break a;
                } else {
                  if ((b & 1) === 0) {
                    Nf(f, l, b);
                    ng();
                    break a;
                  }
                  k = Error(n(426));
                }
              } else if (F && h.mode & 1) {
                var ya = Pf(g);
                if (ya !== null) {
                  (ya.flags & 65536) === 0 && (ya.flags |= 256);
                  Qf(ya, g, h, f, b);
                  Bd(Ef(k, h));
                  break a;
                }
              }
              f = k = Ef(k, h);
              R !== 4 && (R = 2);
              yh === null ? yh = [f] : yh.push(f);
              f = g;
              do {
                switch (f.tag) {
                  case 3:
                    f.flags |= 65536;
                    b &= -b;
                    f.lanes |= b;
                    var E = If(f, k, b);
                    je(f, E);
                    break a;
                  case 1:
                    h = k;
                    var { type: u, stateNode: t } = f;
                    if ((f.flags & 128) === 0 && (typeof u.getDerivedStateFromError === "function" || t !== null && typeof t.componentDidCatch === "function" && (Mf === null || !Mf.has(t)))) {
                      f.flags |= 65536;
                      b &= -b;
                      f.lanes |= b;
                      var Db = Lf(f, h, b);
                      je(f, Db);
                      break a;
                    }
                }
                f = f.return;
              } while (f !== null);
            }
            Yh(c);
          } catch (lc) {
            b = lc;
            X === c && c !== null && (X = c = c.return);
            continue;
          }
          break;
        } while (1);
      }
      function Qh() {
        var a = th.current;
        th.current = Le;
        return a === null ? Le : a;
      }
      function ng() {
        if (R === 0 || R === 3 || R === 2)
          R = 4;
        N === null || (le & 268435455) === 0 && (wh & 268435455) === 0 || Jh(N, Z);
      }
      function Ph(a, b) {
        var c = H;
        H |= 2;
        var d = Qh();
        if (N !== a || Z !== b)
          Ah = null, Rh(a, b);
        do
          try {
            Zh();
            break;
          } catch (e) {
            Th(a, e);
          }
        while (1);
        Ud();
        H = c;
        th.current = d;
        if (X !== null)
          throw Error(n(261));
        N = null;
        Z = 0;
        return R;
      }
      function Zh() {
        for (;X !== null; )
          $h(X);
      }
      function Sh() {
        for (;X !== null && !Lc(); )
          $h(X);
      }
      function $h(a) {
        var b = ai(a.alternate, a, $f);
        a.memoizedProps = a.pendingProps;
        b === null ? Yh(a) : X = b;
        uh.current = null;
      }
      function Yh(a) {
        var b = a;
        do {
          var c = b.alternate;
          a = b.return;
          if ((b.flags & 32768) === 0) {
            if (c = Bg(c, b, $f), c !== null) {
              X = c;
              return;
            }
          } else {
            c = Fg(c, b);
            if (c !== null) {
              c.flags &= 32767;
              X = c;
              return;
            }
            if (a !== null)
              a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null;
            else {
              R = 6;
              X = null;
              return;
            }
          }
          b = b.sibling;
          if (b !== null) {
            X = b;
            return;
          }
          X = b = a;
        } while (b !== null);
        R === 0 && (R = 5);
      }
      function Wh(a, b, c) {
        var d = C, e = W.transition;
        try {
          W.transition = null, C = 1, bi(a, b, c, d);
        } finally {
          W.transition = e, C = d;
        }
        return null;
      }
      function bi(a, b, c, d) {
        do
          Oh();
        while (Dh !== null);
        if ((H & 6) !== 0)
          throw Error(n(327));
        c = a.finishedWork;
        var e = a.finishedLanes;
        if (c === null)
          return null;
        a.finishedWork = null;
        a.finishedLanes = 0;
        if (c === a.current)
          throw Error(n(177));
        a.callbackNode = null;
        a.callbackPriority = 0;
        var f = c.lanes | c.childLanes;
        Gc(a, f);
        a === N && (X = N = null, Z = 0);
        (c.subtreeFlags & 2064) === 0 && (c.flags & 2064) === 0 || Ch || (Ch = true, Mh(Pc, function() {
          Oh();
          return null;
        }));
        f = (c.flags & 15990) !== 0;
        if ((c.subtreeFlags & 15990) !== 0 || f) {
          f = W.transition;
          W.transition = null;
          var g = C;
          C = 1;
          var h = H;
          H |= 4;
          uh.current = null;
          Lg(a, c);
          $g(c, a);
          Ia(a.containerInfo);
          a.current = c;
          dh(c, a, e);
          Mc();
          H = h;
          C = g;
          W.transition = f;
        } else
          a.current = c;
        Ch && (Ch = false, Dh = a, Eh = e);
        f = a.pendingLanes;
        f === 0 && (Mf = null);
        Tc(c.stateNode, d);
        Kh(a, D());
        if (b !== null)
          for (d = a.onRecoverableError, c = 0;c < b.length; c++)
            e = b[c], d(e.value, { componentStack: e.stack, digest: e.digest });
        if (Jf)
          throw Jf = false, a = Kf, Kf = null, a;
        (Eh & 1) !== 0 && a.tag !== 0 && Oh();
        f = a.pendingLanes;
        (f & 1) !== 0 ? a === Gh ? Fh++ : (Fh = 0, Gh = a) : Fh = 0;
        ad();
        return null;
      }
      function Oh() {
        if (Dh !== null) {
          var a = Ic(Eh), b = W.transition, c = C;
          try {
            W.transition = null;
            C = 16 > a ? 16 : a;
            if (Dh === null)
              var d = false;
            else {
              a = Dh;
              Dh = null;
              Eh = 0;
              if ((H & 6) !== 0)
                throw Error(n(331));
              var e = H;
              H |= 4;
              for (T = a.current;T !== null; ) {
                var f = T, g = f.child;
                if ((T.flags & 16) !== 0) {
                  var h = f.deletions;
                  if (h !== null) {
                    for (var k = 0;k < h.length; k++) {
                      var l = h[k];
                      for (T = l;T !== null; ) {
                        var m = T;
                        switch (m.tag) {
                          case 0:
                          case 11:
                          case 15:
                            Mg(8, m, f);
                        }
                        var r = m.child;
                        if (r !== null)
                          r.return = m, T = r;
                        else
                          for (;T !== null; ) {
                            m = T;
                            var { sibling: p, return: B } = m;
                            Pg(m);
                            if (m === l) {
                              T = null;
                              break;
                            }
                            if (p !== null) {
                              p.return = B;
                              T = p;
                              break;
                            }
                            T = B;
                          }
                      }
                    }
                    var w = f.alternate;
                    if (w !== null) {
                      var Y = w.child;
                      if (Y !== null) {
                        w.child = null;
                        do {
                          var ya = Y.sibling;
                          Y.sibling = null;
                          Y = ya;
                        } while (Y !== null);
                      }
                    }
                    T = f;
                  }
                }
                if ((f.subtreeFlags & 2064) !== 0 && g !== null)
                  g.return = f, T = g;
                else
                  b:
                    for (;T !== null; ) {
                      f = T;
                      if ((f.flags & 2048) !== 0)
                        switch (f.tag) {
                          case 0:
                          case 11:
                          case 15:
                            Mg(9, f, f.return);
                        }
                      var E = f.sibling;
                      if (E !== null) {
                        E.return = f.return;
                        T = E;
                        break b;
                      }
                      T = f.return;
                    }
              }
              var u = a.current;
              for (T = u;T !== null; ) {
                g = T;
                var t = g.child;
                if ((g.subtreeFlags & 2064) !== 0 && t !== null)
                  t.return = g, T = t;
                else
                  b:
                    for (g = u;T !== null; ) {
                      h = T;
                      if ((h.flags & 2048) !== 0)
                        try {
                          switch (h.tag) {
                            case 0:
                            case 11:
                            case 15:
                              Ng(9, h);
                          }
                        } catch (lc) {
                          U(h, h.return, lc);
                        }
                      if (h === g) {
                        T = null;
                        break b;
                      }
                      var Db = h.sibling;
                      if (Db !== null) {
                        Db.return = h.return;
                        T = Db;
                        break b;
                      }
                      T = h.return;
                    }
              }
              H = e;
              ad();
              if (Sc && typeof Sc.onPostCommitFiberRoot === "function")
                try {
                  Sc.onPostCommitFiberRoot(Rc, a);
                } catch (lc) {}
              d = true;
            }
            return d;
          } finally {
            C = c, W.transition = b;
          }
        }
        return false;
      }
      function ci(a, b, c) {
        b = Ef(c, b);
        b = If(a, b, 1);
        a = he(a, b, 1);
        b = O();
        a !== null && (Fc(a, 1, b), Kh(a, b));
      }
      function U(a, b, c) {
        if (a.tag === 3)
          ci(a, a, c);
        else
          for (;b !== null; ) {
            if (b.tag === 3) {
              ci(b, a, c);
              break;
            } else if (b.tag === 1) {
              var d = b.stateNode;
              if (typeof b.type.getDerivedStateFromError === "function" || typeof d.componentDidCatch === "function" && (Mf === null || !Mf.has(d))) {
                a = Ef(c, a);
                a = Lf(b, a, 1);
                b = he(b, a, 1);
                a = O();
                b !== null && (Fc(b, 1, a), Kh(b, a));
                break;
              }
            }
            b = b.return;
          }
      }
      function Of(a, b, c) {
        var d = a.pingCache;
        d !== null && d.delete(b);
        b = O();
        a.pingedLanes |= a.suspendedLanes & c;
        N === a && (Z & c) === c && (R === 4 || R === 3 && (Z & 130023424) === Z && 500 > D() - bh ? Rh(a, 0) : xh |= c);
        Kh(a, b);
      }
      function di(a, b) {
        b === 0 && ((a.mode & 1) === 0 ? b = 1 : (b = xc, xc <<= 1, (xc & 130023424) === 0 && (xc = 4194304)));
        var c = O();
        a = ce(a, b);
        a !== null && (Fc(a, b, c), Kh(a, c));
      }
      function og(a) {
        var b = a.memoizedState, c = 0;
        b !== null && (c = b.retryLane);
        di(a, c);
      }
      function Yg(a, b) {
        var c = 0;
        switch (a.tag) {
          case 13:
            var d = a.stateNode;
            var e = a.memoizedState;
            e !== null && (c = e.retryLane);
            break;
          case 19:
            d = a.stateNode;
            break;
          default:
            throw Error(n(314));
        }
        d !== null && d.delete(b);
        di(a, c);
      }
      var ai;
      ai = function(a, b, c) {
        if (a !== null)
          if (a.memoizedProps !== b.pendingProps || z.current)
            G = true;
          else {
            if ((a.lanes & c) === 0 && (b.flags & 128) === 0)
              return G = false, sg(a, b, c);
            G = (a.flags & 131072) !== 0 ? true : false;
          }
        else
          G = false, F && (b.flags & 1048576) !== 0 && ld(b, ed, b.index);
        b.lanes = 0;
        switch (b.tag) {
          case 2:
            var d = b.type;
            cg(a, b);
            a = b.pendingProps;
            var e = mc(b, x.current);
            Yd(b, c);
            e = He(null, b, d, a, e, c);
            var f = Me();
            b.flags |= 1;
            typeof e === "object" && e !== null && typeof e.render === "function" && e.$$typeof === undefined ? (b.tag = 1, b.memoizedState = null, b.updateQueue = null, A(d) ? (f = true, qc(b)) : f = false, b.memoizedState = e.state !== null && e.state !== undefined ? e.state : null, ee(b), e.updater = zf, b.stateNode = e, e._reactInternals = b, Df(b, d, a, c), b = dg(null, b, d, true, f, c)) : (b.tag = 0, F && f && md(b), P(null, b, e, c), b = b.child);
            return b;
          case 16:
            d = b.elementType;
            a: {
              cg(a, b);
              a = b.pendingProps;
              e = d._init;
              d = e(d._payload);
              b.type = d;
              e = b.tag = ei(d);
              a = xf(d, a);
              switch (e) {
                case 0:
                  b = Xf(null, b, d, a, c);
                  break a;
                case 1:
                  b = bg(null, b, d, a, c);
                  break a;
                case 11:
                  b = Sf(null, b, d, a, c);
                  break a;
                case 14:
                  b = Uf(null, b, d, xf(d.type, a), c);
                  break a;
              }
              throw Error(n(306, d, ""));
            }
            return b;
          case 0:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), Xf(a, b, d, e, c);
          case 1:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), bg(a, b, d, e, c);
          case 3:
            a: {
              eg(b);
              if (a === null)
                throw Error(n(387));
              d = b.pendingProps;
              f = b.memoizedState;
              e = f.element;
              fe(a, b);
              ke(b, d, null, c);
              var g = b.memoizedState;
              d = g.element;
              if (Va && f.isDehydrated)
                if (f = { element: d, isDehydrated: false, cache: g.cache, pendingSuspenseBoundaries: g.pendingSuspenseBoundaries, transitions: g.transitions }, b.updateQueue.baseState = f, b.memoizedState = f, b.flags & 256) {
                  e = Ef(Error(n(423)), b);
                  b = fg(a, b, d, c, e);
                  break a;
                } else if (d !== e) {
                  e = Ef(Error(n(424)), b);
                  b = fg(a, b, d, c, e);
                  break a;
                } else
                  for (Va && (pd = Pb(b.stateNode.containerInfo), od = b, F = true, rd = null, qd = false), c = Pd(b, null, d, c), b.child = c;c; )
                    c.flags = c.flags & -3 | 4096, c = c.sibling;
              else {
                Ad();
                if (d === e) {
                  b = Tf(a, b, c);
                  break a;
                }
                P(a, b, d, c);
              }
              b = b.child;
            }
            return b;
          case 5:
            return ue(b), a === null && wd(b), d = b.type, e = b.pendingProps, f = a !== null ? a.memoizedProps : null, g = e.children, Na(d, e) ? g = null : f !== null && Na(d, f) && (b.flags |= 32), ag(a, b), P(a, b, g, c), b.child;
          case 6:
            return a === null && wd(b), null;
          case 13:
            return ig(a, b, c);
          case 4:
            return se(b, b.stateNode.containerInfo), d = b.pendingProps, a === null ? b.child = Od(b, null, d, c) : P(a, b, d, c), b.child;
          case 11:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), Sf(a, b, d, e, c);
          case 7:
            return P(a, b, b.pendingProps, c), b.child;
          case 8:
            return P(a, b, b.pendingProps.children, c), b.child;
          case 12:
            return P(a, b, b.pendingProps.children, c), b.child;
          case 10:
            a: {
              d = b.type._context;
              e = b.pendingProps;
              f = b.memoizedProps;
              g = e.value;
              Vd(b, d, g);
              if (f !== null)
                if (Vc(f.value, g)) {
                  if (f.children === e.children && !z.current) {
                    b = Tf(a, b, c);
                    break a;
                  }
                } else
                  for (f = b.child, f !== null && (f.return = b);f !== null; ) {
                    var h = f.dependencies;
                    if (h !== null) {
                      g = f.child;
                      for (var k = h.firstContext;k !== null; ) {
                        if (k.context === d) {
                          if (f.tag === 1) {
                            k = ge(-1, c & -c);
                            k.tag = 2;
                            var l = f.updateQueue;
                            if (l !== null) {
                              l = l.shared;
                              var m = l.pending;
                              m === null ? k.next = k : (k.next = m.next, m.next = k);
                              l.pending = k;
                            }
                          }
                          f.lanes |= c;
                          k = f.alternate;
                          k !== null && (k.lanes |= c);
                          Xd(f.return, c, b);
                          h.lanes |= c;
                          break;
                        }
                        k = k.next;
                      }
                    } else if (f.tag === 10)
                      g = f.type === b.type ? null : f.child;
                    else if (f.tag === 18) {
                      g = f.return;
                      if (g === null)
                        throw Error(n(341));
                      g.lanes |= c;
                      h = g.alternate;
                      h !== null && (h.lanes |= c);
                      Xd(g, c, b);
                      g = f.sibling;
                    } else
                      g = f.child;
                    if (g !== null)
                      g.return = f;
                    else
                      for (g = f;g !== null; ) {
                        if (g === b) {
                          g = null;
                          break;
                        }
                        f = g.sibling;
                        if (f !== null) {
                          f.return = g.return;
                          g = f;
                          break;
                        }
                        g = g.return;
                      }
                    f = g;
                  }
              P(a, b, e.children, c);
              b = b.child;
            }
            return b;
          case 9:
            return e = b.type, d = b.pendingProps.children, Yd(b, c), e = Zd(e), d = d(e), b.flags |= 1, P(a, b, d, c), b.child;
          case 14:
            return d = b.type, e = xf(d, b.pendingProps), e = xf(d.type, e), Uf(a, b, d, e, c);
          case 15:
            return Wf(a, b, b.type, b.pendingProps, c);
          case 17:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), cg(a, b), b.tag = 1, A(d) ? (a = true, qc(b)) : a = false, Yd(b, c), Bf(b, d, e), Df(b, d, e, c), dg(null, b, d, true, a, c);
          case 19:
            return rg(a, b, c);
          case 22:
            return Yf(a, b, c);
        }
        throw Error(n(156, b.tag));
      };
      function Mh(a, b) {
        return Jc(a, b);
      }
      function fi(a, b, c, d) {
        this.tag = a;
        this.key = c;
        this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
        this.index = 0;
        this.ref = null;
        this.pendingProps = b;
        this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
        this.mode = d;
        this.subtreeFlags = this.flags = 0;
        this.deletions = null;
        this.childLanes = this.lanes = 0;
        this.alternate = null;
      }
      function td(a, b, c, d) {
        return new fi(a, b, c, d);
      }
      function Vf(a) {
        a = a.prototype;
        return !(!a || !a.isReactComponent);
      }
      function ei(a) {
        if (typeof a === "function")
          return Vf(a) ? 1 : 0;
        if (a !== undefined && a !== null) {
          a = a.$$typeof;
          if (a === ma)
            return 11;
          if (a === pa)
            return 14;
        }
        return 2;
      }
      function Jd(a, b) {
        var c = a.alternate;
        c === null ? (c = td(a.tag, b, a.key, a.mode), c.elementType = a.elementType, c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.pendingProps = b, c.type = a.type, c.flags = 0, c.subtreeFlags = 0, c.deletions = null);
        c.flags = a.flags & 14680064;
        c.childLanes = a.childLanes;
        c.lanes = a.lanes;
        c.child = a.child;
        c.memoizedProps = a.memoizedProps;
        c.memoizedState = a.memoizedState;
        c.updateQueue = a.updateQueue;
        b = a.dependencies;
        c.dependencies = b === null ? null : { lanes: b.lanes, firstContext: b.firstContext };
        c.sibling = a.sibling;
        c.index = a.index;
        c.ref = a.ref;
        return c;
      }
      function Ld(a, b, c, d, e, f) {
        var g = 2;
        d = a;
        if (typeof a === "function")
          Vf(a) && (g = 1);
        else if (typeof a === "string")
          g = 5;
        else
          a:
            switch (a) {
              case ha:
                return Nd(c.children, e, f, b);
              case ia:
                g = 8;
                e |= 8;
                break;
              case ja:
                return a = td(12, c, b, e | 2), a.elementType = ja, a.lanes = f, a;
              case na:
                return a = td(13, c, b, e), a.elementType = na, a.lanes = f, a;
              case oa:
                return a = td(19, c, b, e), a.elementType = oa, a.lanes = f, a;
              case ra:
                return jg(c, e, f, b);
              default:
                if (typeof a === "object" && a !== null)
                  switch (a.$$typeof) {
                    case ka:
                      g = 10;
                      break a;
                    case la:
                      g = 9;
                      break a;
                    case ma:
                      g = 11;
                      break a;
                    case pa:
                      g = 14;
                      break a;
                    case qa:
                      g = 16;
                      d = null;
                      break a;
                  }
                throw Error(n(130, a == null ? a : typeof a, ""));
            }
        b = td(g, c, b, e);
        b.elementType = a;
        b.type = d;
        b.lanes = f;
        return b;
      }
      function Nd(a, b, c, d) {
        a = td(7, a, d, b);
        a.lanes = c;
        return a;
      }
      function jg(a, b, c, d) {
        a = td(22, a, d, b);
        a.elementType = ra;
        a.lanes = c;
        a.stateNode = { isHidden: false };
        return a;
      }
      function Kd(a, b, c) {
        a = td(6, a, null, b);
        a.lanes = c;
        return a;
      }
      function Md(a, b, c) {
        b = td(4, a.children !== null ? a.children : [], a.key, b);
        b.lanes = c;
        b.stateNode = { containerInfo: a.containerInfo, pendingChildren: null, implementation: a.implementation };
        return b;
      }
      function gi(a, b, c, d, e) {
        this.tag = b;
        this.containerInfo = a;
        this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
        this.timeoutHandle = Ra;
        this.callbackNode = this.pendingContext = this.context = null;
        this.callbackPriority = 0;
        this.eventTimes = Ec(0);
        this.expirationTimes = Ec(-1);
        this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
        this.entanglements = Ec(0);
        this.identifierPrefix = d;
        this.onRecoverableError = e;
        Va && (this.mutableSourceEagerHydrationData = null);
      }
      function hi(a, b, c, d, e, f, g, h, k) {
        a = new gi(a, b, c, h, k);
        b === 1 ? (b = 1, f === true && (b |= 8)) : b = 0;
        f = td(3, null, null, b);
        a.current = f;
        f.stateNode = a;
        f.memoizedState = { element: d, isDehydrated: c, cache: null, transitions: null, pendingSuspenseBoundaries: null };
        ee(f);
        return a;
      }
      function ii(a) {
        if (!a)
          return jc;
        a = a._reactInternals;
        a: {
          if (wa(a) !== a || a.tag !== 1)
            throw Error(n(170));
          var b = a;
          do {
            switch (b.tag) {
              case 3:
                b = b.stateNode.context;
                break a;
              case 1:
                if (A(b.type)) {
                  b = b.stateNode.__reactInternalMemoizedMergedChildContext;
                  break a;
                }
            }
            b = b.return;
          } while (b !== null);
          throw Error(n(171));
        }
        if (a.tag === 1) {
          var c = a.type;
          if (A(c))
            return pc(a, c, b);
        }
        return b;
      }
      function ji(a) {
        var b = a._reactInternals;
        if (b === undefined) {
          if (typeof a.render === "function")
            throw Error(n(188));
          a = Object.keys(a).join(",");
          throw Error(n(268, a));
        }
        a = Aa(b);
        return a === null ? null : a.stateNode;
      }
      function ki(a, b) {
        a = a.memoizedState;
        if (a !== null && a.dehydrated !== null) {
          var c = a.retryLane;
          a.retryLane = c !== 0 && c < b ? c : b;
        }
      }
      function li(a, b) {
        ki(a, b);
        (a = a.alternate) && ki(a, b);
      }
      function mi(a) {
        a = Aa(a);
        return a === null ? null : a.stateNode;
      }
      function ni() {
        return null;
      }
      exports2.attemptContinuousHydration = function(a) {
        if (a.tag === 13) {
          var b = ce(a, 134217728);
          if (b !== null) {
            var c = O();
            af(b, a, 134217728, c);
          }
          li(a, 134217728);
        }
      };
      exports2.attemptDiscreteHydration = function(a) {
        if (a.tag === 13) {
          var b = ce(a, 1);
          if (b !== null) {
            var c = O();
            af(b, a, 1, c);
          }
          li(a, 1);
        }
      };
      exports2.attemptHydrationAtCurrentPriority = function(a) {
        if (a.tag === 13) {
          var b = tf(a), c = ce(a, b);
          if (c !== null) {
            var d = O();
            af(c, a, b, d);
          }
          li(a, b);
        }
      };
      exports2.attemptSynchronousHydration = function(a) {
        switch (a.tag) {
          case 3:
            var b = a.stateNode;
            if (b.current.memoizedState.isDehydrated) {
              var c = yc(b.pendingLanes);
              c !== 0 && (Hc(b, c | 1), Kh(b, D()), (H & 6) === 0 && (Bh(), ad()));
            }
            break;
          case 13:
            Xh(function() {
              var b2 = ce(a, 1);
              if (b2 !== null) {
                var c2 = O();
                af(b2, a, 1, c2);
              }
            }), li(a, 1);
        }
      };
      exports2.batchedUpdates = function(a, b) {
        var c = H;
        H |= 1;
        try {
          return a(b);
        } finally {
          H = c, H === 0 && (Bh(), Xc && ad());
        }
      };
      exports2.createComponentSelector = function(a) {
        return { $$typeof: hh, value: a };
      };
      exports2.createContainer = function(a, b, c, d, e, f, g) {
        return hi(a, b, false, null, c, d, e, f, g);
      };
      exports2.createHasPseudoClassSelector = function(a) {
        return { $$typeof: ih, value: a };
      };
      exports2.createHydrationContainer = function(a, b, c, d, e, f, g, h, k) {
        a = hi(c, d, true, a, e, f, g, h, k);
        a.context = ii(null);
        c = a.current;
        d = O();
        e = tf(c);
        f = ge(d, e);
        f.callback = b !== undefined && b !== null ? b : null;
        he(c, f, e);
        a.current.lanes = e;
        Fc(a, e, d);
        Kh(a, d);
        return a;
      };
      exports2.createPortal = function(a, b, c) {
        var d = 3 < arguments.length && arguments[3] !== undefined ? arguments[3] : null;
        return { $$typeof: fa, key: d == null ? null : "" + d, children: a, containerInfo: b, implementation: c };
      };
      exports2.createRoleSelector = function(a) {
        return { $$typeof: jh, value: a };
      };
      exports2.createTestNameSelector = function(a) {
        return { $$typeof: kh, value: a };
      };
      exports2.createTextSelector = function(a) {
        return { $$typeof: lh, value: a };
      };
      exports2.deferredUpdates = function(a) {
        var b = C, c = W.transition;
        try {
          return W.transition = null, C = 16, a();
        } finally {
          C = b, W.transition = c;
        }
      };
      exports2.discreteUpdates = function(a, b, c, d, e) {
        var f = C, g = W.transition;
        try {
          return W.transition = null, C = 1, a(b, c, d, e);
        } finally {
          C = f, W.transition = g, H === 0 && Bh();
        }
      };
      exports2.findAllNodes = rh;
      exports2.findBoundingRects = function(a, b) {
        if (!bb)
          throw Error(n(363));
        b = rh(a, b);
        a = [];
        for (var c = 0;c < b.length; c++)
          a.push(db(b[c]));
        for (b = a.length - 1;0 < b; b--) {
          c = a[b];
          for (var d = c.x, e = d + c.width, f = c.y, g = f + c.height, h = b - 1;0 <= h; h--)
            if (b !== h) {
              var k = a[h], l = k.x, m = l + k.width, r = k.y, p = r + k.height;
              if (d >= l && f >= r && e <= m && g <= p) {
                a.splice(b, 1);
                break;
              } else if (!(d !== l || c.width !== k.width || p < f || r > g)) {
                r > f && (k.height += r - f, k.y = f);
                p < g && (k.height = g - r);
                a.splice(b, 1);
                break;
              } else if (!(f !== r || c.height !== k.height || m < d || l > e)) {
                l > d && (k.width += l - d, k.x = d);
                m < e && (k.width = e - l);
                a.splice(b, 1);
                break;
              }
            }
        }
        return a;
      };
      exports2.findHostInstance = ji;
      exports2.findHostInstanceWithNoPortals = function(a) {
        a = za(a);
        a = a !== null ? Ca(a) : null;
        return a === null ? null : a.stateNode;
      };
      exports2.findHostInstanceWithWarning = function(a) {
        return ji(a);
      };
      exports2.flushControlled = function(a) {
        var b = H;
        H |= 1;
        var c = W.transition, d = C;
        try {
          W.transition = null, C = 1, a();
        } finally {
          C = d, W.transition = c, H = b, H === 0 && (Bh(), ad());
        }
      };
      exports2.flushPassiveEffects = Oh;
      exports2.flushSync = Xh;
      exports2.focusWithin = function(a, b) {
        if (!bb)
          throw Error(n(363));
        a = nh(a);
        b = qh(a, b);
        b = Array.from(b);
        for (a = 0;a < b.length; ) {
          var c = b[a++];
          if (!fb(c)) {
            if (c.tag === 5 && hb(c.stateNode))
              return true;
            for (c = c.child;c !== null; )
              b.push(c), c = c.sibling;
          }
        }
        return false;
      };
      exports2.getCurrentUpdatePriority = function() {
        return C;
      };
      exports2.getFindAllNodesFailureDescription = function(a, b) {
        if (!bb)
          throw Error(n(363));
        var c = 0, d = [];
        a = [nh(a), 0];
        for (var e = 0;e < a.length; ) {
          var f = a[e++], g = a[e++], h = b[g];
          if (f.tag !== 5 || !fb(f)) {
            if (oh(f, h) && (d.push(ph(h)), g++, g > c && (c = g)), g < b.length)
              for (f = f.child;f !== null; )
                a.push(f, g), f = f.sibling;
          }
        }
        if (c < b.length) {
          for (a = [];c < b.length; c++)
            a.push(ph(b[c]));
          return `findAllNodes was able to match part of the selector:
  ` + (d.join(" > ") + `

No matching component was found for:
  `) + a.join(" > ");
        }
        return null;
      };
      exports2.getPublicRootInstance = function(a) {
        a = a.current;
        if (!a.child)
          return null;
        switch (a.child.tag) {
          case 5:
            return Ea(a.child.stateNode);
          default:
            return a.child.stateNode;
        }
      };
      exports2.injectIntoDevTools = function(a) {
        a = { bundleType: a.bundleType, version: a.version, rendererPackageName: a.rendererPackageName, rendererConfig: a.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: da.ReactCurrentDispatcher, findHostInstanceByFiber: mi, findFiberByHostInstance: a.findFiberByHostInstance || ni, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1" };
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined")
          a = false;
        else {
          var b = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (b.isDisabled || !b.supportsFiber)
            a = true;
          else {
            try {
              Rc = b.inject(a), Sc = b;
            } catch (c) {}
            a = b.checkDCE ? true : false;
          }
        }
        return a;
      };
      exports2.isAlreadyRendering = function() {
        return false;
      };
      exports2.observeVisibleRects = function(a, b, c, d) {
        if (!bb)
          throw Error(n(363));
        a = rh(a, b);
        var e = ib(a, c, d).disconnect;
        return { disconnect: function() {
          e();
        } };
      };
      exports2.registerMutableSourceForHydration = function(a, b) {
        var c = b._getVersion;
        c = c(b._source);
        a.mutableSourceEagerHydrationData == null ? a.mutableSourceEagerHydrationData = [b, c] : a.mutableSourceEagerHydrationData.push(b, c);
      };
      exports2.runWithPriority = function(a, b) {
        var c = C;
        try {
          return C = a, b();
        } finally {
          C = c;
        }
      };
      exports2.shouldError = function() {
        return null;
      };
      exports2.shouldSuspend = function() {
        return false;
      };
      exports2.updateContainer = function(a, b, c, d) {
        var e = b.current, f = O(), g = tf(e);
        c = ii(c);
        b.context === null ? b.context = c : b.pendingContext = c;
        b = ge(f, g);
        b.payload = { element: a };
        d = d === undefined ? null : d;
        d !== null && (b.callback = d);
        a = he(e, b, g);
        a !== null && (af(a, e, g, f), ie(a, e, g));
        return g;
      };
      return exports2;
    };
  });

  // ../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/index.js
  var require_react_reconciler = __commonJS((exports, module) => {
    if (true) {
      module.exports = require_react_reconciler_production_min();
    } else {}
  });

  // ../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/cjs/react-reconciler-constants.production.min.js
  var require_react_reconciler_constants_production_min = __commonJS((exports) => {
    exports.ConcurrentRoot = 1;
    exports.ContinuousEventPriority = 4;
    exports.DefaultEventPriority = 16;
    exports.DiscreteEventPriority = 1;
    exports.IdleEventPriority = 536870912;
    exports.LegacyRoot = 0;
  });

  // ../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/constants.js
  var require_constants = __commonJS((exports, module) => {
    if (true) {
      module.exports = require_react_reconciler_constants_production_min();
    } else {}
  });

  // ../../node_modules/.bun/react@18.3.1/node_modules/react/cjs/react-jsx-runtime.production.min.js
  var require_react_jsx_runtime_production_min = __commonJS((exports) => {
    var f = require_react();
    var k = Symbol.for("react.element");
    var l = Symbol.for("react.fragment");
    var m = Object.prototype.hasOwnProperty;
    var n = f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner;
    var p = { key: true, ref: true, __self: true, __source: true };
    function q(c, a, g) {
      var b, d = {}, e = null, h = null;
      g !== undefined && (e = "" + g);
      a.key !== undefined && (e = "" + a.key);
      a.ref !== undefined && (h = a.ref);
      for (b in a)
        m.call(a, b) && !p.hasOwnProperty(b) && (d[b] = a[b]);
      if (c && c.defaultProps)
        for (b in a = c.defaultProps, a)
          d[b] === undefined && (d[b] = a[b]);
      return { $$typeof: k, type: c, key: e, ref: h, props: d, _owner: n.current };
    }
    exports.Fragment = l;
    exports.jsx = q;
    exports.jsxs = q;
  });

  // ../../node_modules/.bun/react@18.3.1/node_modules/react/jsx-runtime.js
  var require_jsx_runtime = __commonJS((exports, module) => {
    if (true) {
      module.exports = require_react_jsx_runtime_production_min();
    } else {}
  });

  // js/polyfills.js
  if (typeof performance === "undefined") {
    globalThis.performance = {
      now: () => Number(__velox_getTime())
    };
  }
  if (typeof setTimeout === "undefined") {
    let _nextTimerId = 1;
    const _pendingTimers = new Map;
    globalThis.setTimeout = (fn, ms) => {
      const id = _nextTimerId++;
      const delay = ms > 0 ? ms : 0;
      _pendingTimers.set(id, { fn, due: performance.now() + delay });
      if (typeof __velox_request_frame !== "undefined") {
        __velox_request_frame(delay);
      }
      return id;
    };
    globalThis.clearTimeout = (id) => {
      _pendingTimers.delete(id);
    };
    globalThis._veloxDrainTimers = () => {
      if (_pendingTimers.size === 0)
        return;
      const now = performance.now();
      const due = [];
      for (const [id, t] of _pendingTimers) {
        if (t.due <= now)
          due.push([id, t.fn]);
      }
      for (const [id] of due)
        _pendingTimers.delete(id);
      for (const [, fn] of due)
        fn();
    };
  }
  if (typeof setInterval === "undefined") {
    let _nextIntervalId = 1;
    const _pendingIntervals = new Map;
    globalThis.setInterval = (fn, ms) => {
      const id = _nextIntervalId++;
      const delay = ms > 0 ? ms : 0;
      _pendingIntervals.set(id, { fn, ms: delay, nextDue: performance.now() + delay });
      if (typeof __velox_request_frame !== "undefined")
        __velox_request_frame(delay);
      return id;
    };
    globalThis.clearInterval = (id) => {
      _pendingIntervals.delete(id);
    };
    const _prevDrain = globalThis._veloxDrainTimers;
    globalThis._veloxDrainTimers = () => {
      _prevDrain?.();
      if (_pendingIntervals.size === 0)
        return;
      const now = performance.now();
      for (const [, t] of _pendingIntervals) {
        if (now >= t.nextDue) {
          t.nextDue = now + t.ms;
          t.fn();
        }
      }
    };
  }
  if (typeof queueMicrotask === "undefined") {
    globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn);
  }
  if (typeof MessageChannel === "undefined") {
    globalThis.MessageChannel = class MessageChannel2 {
      constructor() {
        const ch = this;
        ch.port1 = {
          onmessage: null,
          postMessage(msg) {
            ch.port2.onmessage?.({ data: msg });
          }
        };
        ch.port2 = {
          onmessage: null,
          postMessage(msg) {
            ch.port1.onmessage?.({ data: msg });
          }
        };
      }
    };
  }

  // js/app.jsx
  var import_react7 = __toESM(require_react(), 1);

  // ../../js/packages/@velox/react/src/index.js
  var import_react = __toESM(require_react(), 1);
  var import_react_reconciler = __toESM(require_react_reconciler(), 1);

  // ../../js/packages/@velox/react/src/hostConfig.js
  var import_constants = __toESM(require_constants(), 1);
  function createInstance(type, props) {
    const { children, style, ref: _ref, _veloxOnMount, veloxDraggable, ...rest } = props;
    const nodeProps = { ...rest, ...style };
    if (veloxDraggable)
      nodeProps.draggable = true;
    const id = __velox_createNode(type, nodeProps);
    if (typeof _veloxOnMount === "function") {
      _veloxOnMount(id);
    }
    return { id };
  }
  function createTextInstance(text) {
    __velox_log('[Velox] Warning: raw text node "' + text + '" — wrap in <Text>');
    return { id: -1 };
  }
  function appendInitialChild(parentInstance, child) {
    if (child.id !== -1) {
      __velox_appendChild(parentInstance.id, child.id);
    }
  }
  function appendChild(parentInstance, child) {
    if (child.id !== -1) {
      __velox_appendChild(parentInstance.id, child.id);
    }
  }
  function appendChildToContainer(_container, child) {
    if (child.id !== -1) {
      __velox_setRoot(child.id);
    }
  }
  function insertBefore(parentInstance, child, _beforeChild) {
    if (child.id !== -1) {
      __velox_appendChild(parentInstance.id, child.id);
    }
  }
  function insertInContainerBefore(_container, child, _beforeChild) {
    if (child.id !== -1) {
      __velox_setRoot(child.id);
    }
  }
  function removeChild(_parentInstance, child) {
    if (child.id !== -1) {
      __velox_removeNode(child.id);
    }
  }
  function removeChildFromContainer(_container, child) {
    if (child.id !== -1) {
      __velox_removeNode(child.id);
    }
  }
  function clearContainer(_container) {}
  function detachDeletedInstance(instance) {
    if (instance.id !== -1) {
      __velox_removeNode(instance.id);
    }
  }
  function prepareUpdate(_instance, _type, _oldProps, newProps) {
    return newProps;
  }
  function commitUpdate(instance, updatePayload) {
    const { children, style, ref: _ref, _veloxOnMount, veloxDraggable, ...rest } = updatePayload;
    const nodeProps = { ...rest, ...style };
    if (veloxDraggable)
      nodeProps.draggable = true;
    __velox_updateNode(instance.id, nodeProps);
  }
  function commitTextUpdate() {}
  function commitMount() {}
  function finalizeInitialChildren() {
    return false;
  }
  function preparePortalMount() {}
  function getRootHostContext() {
    return {};
  }
  function getChildHostContext() {
    return {};
  }
  function getPublicInstance(instance) {
    return instance;
  }
  function prepareForCommit() {
    return null;
  }
  function resetAfterCommit() {}
  function shouldSetTextContent() {
    return false;
  }
  function scheduleTimeout(fn, delay) {
    return setTimeout(fn, delay);
  }
  function cancelTimeout(id) {
    clearTimeout(id);
  }
  function getCurrentEventPriority() {
    return import_constants.DefaultEventPriority;
  }
  function getInstanceFromNode() {
    return null;
  }
  function beforeActiveInstanceBlur() {}
  function afterActiveInstanceBlur() {}
  function prepareScopeUpdate() {}
  function getInstanceFromScope() {
    return null;
  }
  var HostConfig = {
    createInstance,
    createTextInstance,
    appendInitialChild,
    appendChild,
    appendChildToContainer,
    insertBefore,
    insertInContainerBefore,
    removeChild,
    removeChildFromContainer,
    clearContainer,
    detachDeletedInstance,
    prepareUpdate,
    commitUpdate,
    commitTextUpdate,
    commitMount,
    finalizeInitialChildren,
    preparePortalMount,
    getRootHostContext,
    getChildHostContext,
    getPublicInstance,
    prepareForCommit,
    resetAfterCommit,
    shouldSetTextContent,
    scheduleTimeout,
    cancelTimeout,
    noTimeout: -1,
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: true,
    supportsMicrotasks: true,
    scheduleMicrotask: (fn) => Promise.resolve().then(fn),
    getCurrentEventPriority,
    getInstanceFromNode,
    beforeActiveInstanceBlur,
    afterActiveInstanceBlur,
    prepareScopeUpdate,
    getInstanceFromScope
  };
  var hostConfig_default = HostConfig;

  // ../../js/packages/@velox/react/src/events.js
  var pressableRegistry = new Map;
  var inputRegistry = new Map;
  var scrollRegistry = new Map;
  var dragRegistry = new Map;
  var disabledRegistry = new Map;
  var pointerEventsNoneRegistry = new Set;
  var activeDragId = null;
  var windowSizeListeners = [];
  var keyListeners = [];
  var globalClickListeners = [];
  var focusedNodeId = null;
  var hoveredPressableId = null;
  var ctrlHeld = false;
  var shiftHeld = false;
  var cursorX = 0;
  var cursorY = 0;
  function registerPressable(nodeId, handlers) {
    pressableRegistry.set(nodeId, handlers);
  }
  function unregisterPressable(nodeId) {
    pressableRegistry.delete(nodeId);
  }
  function registerInput(nodeId, handlers) {
    inputRegistry.set(nodeId, handlers);
  }
  function unregisterInput(nodeId) {
    if (focusedNodeId === nodeId)
      focusedNodeId = null;
    inputRegistry.delete(nodeId);
  }
  function registerScrollView(nodeId, handlers) {
    scrollRegistry.set(nodeId, handlers);
  }
  function unregisterScrollView(nodeId) {
    scrollRegistry.delete(nodeId);
  }
  function registerDraggable(nodeId, handlers) {
    dragRegistry.set(nodeId, handlers);
  }
  function unregisterDraggable(nodeId) {
    if (activeDragId === nodeId)
      activeDragId = null;
    dragRegistry.delete(nodeId);
  }
  function registerDisabledNode(nodeId, disabled) {
    if (disabled) {
      disabledRegistry.set(nodeId, true);
    } else {
      disabledRegistry.delete(nodeId);
    }
  }
  function unregisterDisabledNode(nodeId) {
    disabledRegistry.delete(nodeId);
  }
  function addWindowSizeListener(fn) {
    windowSizeListeners.push(fn);
  }
  function removeWindowSizeListener(fn) {
    const idx = windowSizeListeners.indexOf(fn);
    if (idx >= 0)
      windowSizeListeners.splice(idx, 1);
  }
  function addKeyListener(fn) {
    keyListeners.push(fn);
  }
  function addGlobalClickListener(fn) {
    globalClickListeners.push(fn);
  }
  function removeGlobalClickListener(fn) {
    const idx = globalClickListeners.indexOf(fn);
    if (idx >= 0)
      globalClickListeners.splice(idx, 1);
  }
  function setFocus(nodeId) {
    if (focusedNodeId !== nodeId) {
      if (focusedNodeId !== null) {
        const prev = inputRegistry.get(focusedNodeId);
        prev?.onBlur?.();
      }
      focusedNodeId = nodeId;
      const handlers = inputRegistry.get(nodeId);
      handlers?.onFocus?.();
    }
  }
  function hitTest(nodeId, px, py) {
    if (pointerEventsNoneRegistry.has(nodeId))
      return false;
    const layout = __velox_getLayout(nodeId);
    if (!layout)
      return false;
    return px >= layout.x && px < layout.x + layout.width && py >= layout.y && py < layout.y + layout.height;
  }
  function isDisabled(nodeId) {
    return disabledRegistry.has(nodeId);
  }
  function dispatchEvents() {
    const events = __velox_pollEvents();
    if (!events || events.length === 0)
      return;
    let cursorMovedThisFrame = false;
    for (const ev of events) {
      switch (ev.type) {
        case "mouseButton": {
          if (!ev.pressed)
            break;
          if (globalClickListeners.length > 0) {
            const gev = { x: ev.x, y: ev.y };
            for (const fn of globalClickListeners)
              try {
                fn(gev);
              } catch {}
          }
          let handled = false;
          for (const [nodeId, handlers] of [...pressableRegistry].reverse()) {
            if (hitTest(nodeId, ev.x, ev.y)) {
              if (isDisabled(nodeId))
                break;
              const layout = __velox_getLayout(nodeId);
              const pressEv = {
                x: ev.x,
                y: ev.y,
                locationX: layout ? ev.x - layout.x : 0,
                locationY: layout ? ev.y - layout.y : 0
              };
              handlers.onPress?.(pressEv);
              handled = true;
              break;
            }
          }
          for (const [nodeId, handlers] of [...inputRegistry].reverse()) {
            if (hitTest(nodeId, ev.x, ev.y)) {
              if (isDisabled(nodeId))
                break;
              setFocus(nodeId);
              if (handlers.onClickAt) {
                const layout = __velox_getLayout(nodeId);
                if (layout)
                  handlers.onClickAt(ev.x - layout.x, ev.y - layout.y);
              }
              handled = true;
              break;
            }
          }
          if (!handled && focusedNodeId !== null) {
            const prev = inputRegistry.get(focusedNodeId);
            prev?.onBlur?.();
            focusedNodeId = null;
          }
          break;
        }
        case "keyInput": {
          if (ev.key === "ControlLeft" || ev.key === "ControlRight") {
            ctrlHeld = ev.pressed;
            break;
          }
          if (ev.key === "ShiftLeft" || ev.key === "ShiftRight") {
            shiftHeld = ev.pressed;
            break;
          }
          if (keyListeners.length > 0) {
            const kev = { key: ev.key, ctrl: ctrlHeld, shift: shiftHeld, pressed: ev.pressed };
            for (const fn of keyListeners)
              try {
                fn(kev);
              } catch {}
          }
          if (!ev.pressed || focusedNodeId === null)
            break;
          const handlers = inputRegistry.get(focusedNodeId);
          if (!handlers)
            break;
          handlers.onKeyPress?.({ key: ev.key, text: ev.text, ctrl: ctrlHeld, shift: shiftHeld });
          break;
        }
        case "cursorMoved": {
          cursorX = ev.x;
          cursorY = ev.y;
          cursorMovedThisFrame = true;
          break;
        }
        case "scroll": {
          for (const [nodeId, handlers] of [...scrollRegistry].reverse()) {
            if (hitTest(nodeId, cursorX, cursorY)) {
              if (isDisabled(nodeId))
                break;
              handlers.onScroll?.(ev.deltaY);
              break;
            }
          }
          break;
        }
        case "scrollbarDrag": {
          const handlers = scrollRegistry.get(ev.nodeId);
          handlers?.onAbsoluteScroll?.(ev.scrollY);
          break;
        }
        case "resize": {
          const size = { width: ev.width, height: ev.height };
          for (const fn of windowSizeListeners)
            fn(size);
          break;
        }
        case "dragStart": {
          for (const [nodeId, handlers] of dragRegistry) {
            if (hitTest(nodeId, ev.x, ev.y)) {
              if (isDisabled(nodeId))
                break;
              activeDragId = nodeId;
              handlers.onDragStart?.({ x: ev.x, y: ev.y });
              break;
            }
          }
          break;
        }
        case "dragMove": {
          if (activeDragId !== null) {
            const handlers = dragRegistry.get(activeDragId);
            handlers?.onDragMove?.({ x: ev.x, y: ev.y, dx: ev.dx, dy: ev.dy });
          }
          break;
        }
        case "dragEnd": {
          if (activeDragId !== null) {
            const handlers = dragRegistry.get(activeDragId);
            handlers?.onDragEnd?.({ x: ev.x, y: ev.y });
            activeDragId = null;
          }
          break;
        }
        default:
          break;
      }
    }
    if (cursorMovedThisFrame) {
      let newHoveredId = null;
      for (const [nodeId] of pressableRegistry) {
        if (isDisabled(nodeId))
          continue;
        if (hitTest(nodeId, cursorX, cursorY)) {
          newHoveredId = nodeId;
          break;
        }
      }
      if (newHoveredId !== hoveredPressableId) {
        if (hoveredPressableId !== null) {
          pressableRegistry.get(hoveredPressableId)?.onHoverOut?.();
        }
        if (newHoveredId !== null) {
          pressableRegistry.get(newHoveredId)?.onHoverIn?.();
        }
        hoveredPressableId = newHoveredId;
      }
    }
  }

  // ../../js/packages/@velox/react/src/index.js
  var VeloxReconciler = import_react_reconciler.default(hostConfig_default);
  var rootContainer = VeloxReconciler.createContainer({ isVeloxRoot: true }, 0, null, false, null, "", (err) => __velox_log("[React] Recoverable error: " + err.message), null);
  var _wsOpenSockets = new Map;
  var _ipcListeners = [];
  var _deeplinkCallbacks = [];
  var _deeplinkInitialFired = false;
  function _pollDeeplinks() {
    if (!_deeplinkInitialFired && _deeplinkCallbacks.length > 0) {
      _deeplinkInitialFired = true;
      if (typeof __velox_deeplink_getInitialUrl !== "undefined") {
        try {
          const url = __velox_deeplink_getInitialUrl();
          if (url) {
            for (const cb of _deeplinkCallbacks) {
              try {
                cb(url);
              } catch (e) {
                __velox_log("[deeplink] callback error: " + e);
              }
            }
          }
        } catch {}
      }
    }
    if (typeof __velox_deeplink_poll === "undefined")
      return;
    let raw;
    try {
      raw = __velox_deeplink_poll();
    } catch {
      return;
    }
    if (!raw || raw === "[]")
      return;
    let urls;
    try {
      urls = JSON.parse(raw);
    } catch {
      return;
    }
    for (const url of urls) {
      for (const cb of _deeplinkCallbacks) {
        try {
          cb(url);
        } catch (e) {
          __velox_log("[deeplink] callback error: " + e);
        }
      }
    }
  }
  var _globalShortcutCallbacks = new Map;
  function _pollGlobalShortcuts() {
    if (typeof __velox_shortcut_poll === "undefined")
      return;
    if (_globalShortcutCallbacks.size === 0)
      return;
    let raw;
    try {
      raw = __velox_shortcut_poll();
    } catch {
      return;
    }
    if (!raw || raw === "[]")
      return;
    let ids;
    try {
      ids = JSON.parse(raw);
    } catch {
      return;
    }
    for (const id of ids) {
      const cb = _globalShortcutCallbacks.get(id);
      if (cb)
        try {
          cb();
        } catch (e) {
          __velox_log("[shortcut] callback error: " + e);
        }
    }
  }
  function _pollGamepads() {
    if (typeof __velox_gamepad_poll === "undefined")
      return;
    if (!globalThis._gamepadCallbacks || globalThis._gamepadCallbacks.length === 0)
      return;
    let raw;
    try {
      raw = __velox_gamepad_poll();
    } catch {
      return;
    }
    if (!raw || raw === "[]")
      return;
    let evs;
    try {
      evs = JSON.parse(raw);
    } catch {
      return;
    }
    for (const ev of evs) {
      for (const cb of globalThis._gamepadCallbacks) {
        try {
          cb(ev);
        } catch (e) {
          __velox_log("[gamepad] callback error: " + e);
        }
      }
    }
  }
  var _localShortcuts = new Map;
  var _localShortcutNextId = 1;
  function _normalizeKey(winitKey) {
    if (/^Key[A-Z]$/.test(winitKey))
      return winitKey[3].toLowerCase();
    if (/^Digit\d$/.test(winitKey))
      return winitKey[5];
    return winitKey.toLowerCase();
  }
  addKeyListener(function _dispatchLocalShortcuts({ key, ctrl, shift, pressed }) {
    if (!pressed || _localShortcuts.size === 0)
      return;
    const norm = _normalizeKey(key);
    for (const { mods, key: sKey, cb } of _localShortcuts.values()) {
      if (sKey === norm && mods.ctrl === ctrl && mods.shift === shift) {
        try {
          cb();
        } catch (e) {
          __velox_log("[shortcut] local callback error: " + e);
        }
      }
    }
  });
  var _perfBudgetCallbacks = [];
  var _perfLeakCallbacks = [];
  function _pollPerfViolations() {
    if (typeof __velox_perf_poll_violations === "undefined")
      return;
    if (_perfBudgetCallbacks.length === 0)
      return;
    let raw;
    try {
      raw = __velox_perf_poll_violations();
    } catch {
      return;
    }
    if (!raw || raw === "[]")
      return;
    let violations;
    try {
      violations = JSON.parse(raw);
    } catch {
      return;
    }
    for (const v of violations) {
      for (const cb of _perfBudgetCallbacks) {
        try {
          cb(v);
        } catch (e) {
          __velox_log("[perf] onBudgetExceeded callback error: " + e);
        }
      }
    }
  }
  function _pollLeakWarnings() {
    if (typeof __velox_perf_poll_leak_warnings === "undefined")
      return;
    if (_perfLeakCallbacks.length === 0)
      return;
    let raw;
    try {
      raw = __velox_perf_poll_leak_warnings();
    } catch {
      return;
    }
    if (!raw || raw === "[]")
      return;
    let warnings;
    try {
      warnings = JSON.parse(raw);
    } catch {
      return;
    }
    for (const w of warnings) {
      for (const cb of _perfLeakCallbacks) {
        try {
          cb(w);
        } catch (e) {
          __velox_log("[perf] onLeakDetected callback error: " + e);
        }
      }
    }
  }
  var _audioCallbacks = new Map;
  function _pollAudio() {
    if (typeof __velox_audio_poll === "undefined")
      return;
    let raw;
    try {
      raw = __velox_audio_poll();
    } catch {
      return;
    }
    if (!raw || raw === "[]")
      return;
    let events;
    try {
      events = JSON.parse(raw);
    } catch {
      return;
    }
    for (const ev of events) {
      const key = String(ev.handle);
      const cbs = _audioCallbacks.get(key);
      if (cbs) {
        for (const cb of cbs) {
          if (ev.event === "ended" && cb.onEnded) {
            try {
              cb.onEnded();
            } catch (e) {
              __velox_log("[audio] onEnded error: " + e);
            }
          }
        }
        if (ev.event === "ended")
          _audioCallbacks.delete(key);
      }
    }
  }
  globalThis.__velox_frameCallback = function veloxFrameCallback() {
    VeloxReconciler.flushSync(() => {
      globalThis._veloxDrainTimers?.();
      _pollWebSockets();
      _pollIpc();
      _pollDeeplinks();
      _pollGamepads();
      _pollGlobalShortcuts();
      _pollPerfViolations();
      _pollLeakWarnings();
      _pollAudio();
      _pollVideo();
      dispatchEvents();
    });
  };
  function render(element) {
    VeloxReconciler.updateContainer(element, rootContainer, null, null);
  }
  var View = ({ children, style, ...props }) => import_react.default.createElement("view", { style, ...props }, children);
  var Text = ({ children, style, showCursor, ...props }) => import_react.default.createElement("text", { text: children, style, showCursor, ...props });
  function Image({ src, width = 120, height = 120, resizeMode = "stretch", style, ...props }) {
    const imageId = import_react.default.useMemo(() => {
      if (!src)
        return null;
      return __velox_createImage(src);
    }, [src]);
    return import_react.default.createElement("image", {
      imageId,
      resizeMode,
      style,
      width,
      height,
      ...props
    });
  }
  function Pressable({ children, onPress, onPressIn, onPressOut, onHoverIn, onHoverOut, disabled, style, ...props }) {
    const nodeIdRef = import_react.useRef(null);
    const handlersRef = import_react.useRef(null);
    const [pressed, setPressed] = import_react.useState(false);
    const [hovered, setHovered] = import_react.useState(false);
    handlersRef.current = {
      onPress: (e) => onPress?.(e),
      onPressIn: () => {
        setPressed(true);
        onPressIn?.();
      },
      onPressOut: () => {
        setPressed(false);
        onPressOut?.();
      },
      onHoverIn: () => {
        setHovered(true);
        onHoverIn?.();
      },
      onHoverOut: () => {
        setHovered(false);
        onHoverOut?.();
      }
    };
    const onMount = import_react.useCallback((id) => {
      nodeIdRef.current = id;
      registerPressable(id, {
        onPress: (e) => handlersRef.current.onPress(e),
        onPressIn: () => handlersRef.current.onPressIn(),
        onPressOut: () => handlersRef.current.onPressOut(),
        onHoverIn: () => handlersRef.current.onHoverIn(),
        onHoverOut: () => handlersRef.current.onHoverOut()
      });
      registerDisabledNode(id, !!disabled);
    }, [disabled]);
    import_react.useEffect(() => {
      if (nodeIdRef.current !== null) {
        registerDisabledNode(nodeIdRef.current, !!disabled);
      }
    }, [disabled]);
    import_react.useEffect(() => {
      return () => {
        if (nodeIdRef.current !== null) {
          unregisterPressable(nodeIdRef.current);
          unregisterDisabledNode(nodeIdRef.current);
        }
      };
    }, []);
    const mergedStyle = pressed ? { ...style, borderWidth: 2, borderColor: "#ffffffaa" } : hovered ? { ...style, borderWidth: 1, borderColor: "#ffffff55" } : style;
    return import_react.default.createElement("view", { _veloxOnMount: onMount, style: mergedStyle, ...props }, children);
  }
  function ScrollView({
    children,
    style,
    width = 300,
    height = 200,
    contentHeight,
    showScrollbar = true,
    scrollbarWidth = 8,
    scrollbarColor = "#8c8caa99",
    ...props
  }) {
    const nodeIdRef = import_react.useRef(null);
    const maxScrollRef = import_react.useRef(0);
    const [scrollY, setScrollY] = import_react.useState(0);
    const childArray = import_react.default.Children.toArray(children);
    const gap = style && style.gap || 0;
    const padding = style && style.padding || 0;
    const autoContentH = childArray.reduce((sum, c) => sum + (c.props?.height || 0), 0) + Math.max(0, childArray.length - 1) * gap + 2 * padding;
    const resolvedContentH = contentHeight ?? autoContentH;
    maxScrollRef.current = Math.max(0, resolvedContentH - height);
    const onScroll = import_react.useCallback((deltaY) => {
      setScrollY((prev) => {
        const max = maxScrollRef.current;
        return Math.min(max, Math.max(0, prev + deltaY));
      });
    }, []);
    const onAbsoluteScroll = import_react.useCallback((y) => {
      setScrollY(Math.min(maxScrollRef.current, Math.max(0, y)));
    }, []);
    const onMount = import_react.useCallback((id) => {
      nodeIdRef.current = id;
      registerScrollView(id, { onScroll, onAbsoluteScroll });
    }, [onScroll, onAbsoluteScroll]);
    import_react.useEffect(() => {
      return () => {
        if (nodeIdRef.current !== null) {
          unregisterScrollView(nodeIdRef.current);
        }
      };
    }, []);
    const viewStyle = {
      justifyContent: "flex-start",
      alignItems: "flex-start",
      clip: true,
      scrollOffsetY: scrollY,
      showScrollbar,
      scrollbarWidth,
      scrollbarColor,
      ...style
    };
    return import_react.default.createElement("view", { _veloxOnMount: onMount, style: viewStyle, width, height, ...props }, children);
  }
  function TextInput({
    value = "",
    onChangeText,
    onSubmitEditing,
    placeholder = "",
    fontSize = 16,
    multiline = false,
    width = 240,
    height = 44,
    style,
    ...props
  }) {
    const nodeIdRef = import_react.useRef(null);
    const handlersRef = import_react.useRef(null);
    const [focused, setFocused] = import_react.useState(false);
    const [anchor, setAnchor] = import_react.useState(() => value.length);
    const [focus_, setFocus_] = import_react.useState(() => value.length);
    const selStart = Math.min(anchor, focus_);
    const selEnd = Math.max(anchor, focus_);
    const moveCursor = (pos) => {
      const clamped = Math.max(0, Math.min(pos, value.length));
      setAnchor(clamped);
      setFocus_(clamped);
    };
    const extendTo = (pos) => {
      setFocus_(Math.max(0, Math.min(pos, value.length)));
    };
    handlersRef.current = {
      onFocus: () => {
        setFocused(true);
        const end = value.length;
        setAnchor(end);
        setFocus_(end);
      },
      onBlur: () => {
        setFocused(false);
      },
      onKeyPress: async ({ key, text, ctrl, shift }) => {
        const ss = Math.min(anchor, focus_);
        const se = Math.max(anchor, focus_);
        const hasSel = ss < se;
        if (ctrl) {
          if (key === "KeyA") {
            setAnchor(0);
            setFocus_(value.length);
          } else if (key === "KeyC") {
            if (hasSel) {
              try {
                await clipboard.writeText(value.slice(ss, se));
              } catch (_) {}
            }
          } else if (key === "KeyX") {
            if (hasSel) {
              try {
                await clipboard.writeText(value.slice(ss, se));
              } catch (_) {}
              const newVal = value.slice(0, ss) + value.slice(se);
              onChangeText?.(newVal);
              moveCursor(ss);
            }
          } else if (key === "KeyV") {
            try {
              const pasted = await clipboard.readText();
              if (pasted) {
                const newVal = value.slice(0, ss) + pasted + value.slice(se);
                onChangeText?.(newVal);
                const newPos = ss + pasted.length;
                setAnchor(newPos);
                setFocus_(newPos);
              }
            } catch (_) {}
          }
          return;
        }
        if ((key === "ArrowUp" || key === "ArrowDown") && multiline) {
          const lines = value.split(`
`);
          let lineIdx = 0, lineStart = 0;
          for (let i = 0;i < lines.length; i++) {
            const lineEnd = lineStart + lines[i].length;
            if (anchor <= lineEnd || i === lines.length - 1) {
              lineIdx = i;
              break;
            }
            lineStart += lines[i].length + 1;
          }
          const col = anchor - lineStart;
          if (key === "ArrowUp" && lineIdx > 0) {
            const prevLineStart = lineStart - lines[lineIdx - 1].length - 1;
            const newPos = prevLineStart + Math.min(col, lines[lineIdx - 1].length);
            if (shift) {
              extendTo(newPos);
            } else {
              moveCursor(newPos);
            }
          } else if (key === "ArrowDown" && lineIdx < lines.length - 1) {
            const nextLineStart = lineStart + lines[lineIdx].length + 1;
            const newPos = nextLineStart + Math.min(col, lines[lineIdx + 1].length);
            if (shift) {
              extendTo(newPos);
            } else {
              moveCursor(newPos);
            }
          }
          return;
        }
        if (key === "ArrowLeft") {
          if (shift) {
            extendTo(focus_ - 1);
          } else if (hasSel) {
            moveCursor(ss);
          } else {
            moveCursor(anchor - 1);
          }
          return;
        }
        if (key === "ArrowRight") {
          if (shift) {
            extendTo(focus_ + 1);
          } else if (hasSel) {
            moveCursor(se);
          } else {
            moveCursor(anchor + 1);
          }
          return;
        }
        if (key === "Home") {
          if (shift) {
            extendTo(0);
          } else {
            moveCursor(0);
          }
          return;
        }
        if (key === "End") {
          if (shift) {
            extendTo(value.length);
          } else {
            moveCursor(value.length);
          }
          return;
        }
        if (key === "Backspace") {
          if (hasSel) {
            onChangeText?.(value.slice(0, ss) + value.slice(se));
            moveCursor(ss);
          } else if (anchor > 0) {
            const chars = [...value];
            chars.splice(anchor - 1, 1);
            onChangeText?.(chars.join(""));
            moveCursor(anchor - 1);
          }
          return;
        }
        if (key === "Delete") {
          if (hasSel) {
            onChangeText?.(value.slice(0, ss) + value.slice(se));
            moveCursor(ss);
          } else if (anchor < value.length) {
            const chars = [...value];
            chars.splice(anchor, 1);
            onChangeText?.(chars.join(""));
          }
          return;
        }
        if (key === "Enter") {
          if (multiline) {
            const newVal = value.slice(0, ss) + `
` + value.slice(se);
            onChangeText?.(newVal);
            const newPos = ss + 1;
            setAnchor(newPos);
            setFocus_(newPos);
          }
          return;
        }
        if (text) {
          const newVal = value.slice(0, ss) + text + value.slice(se);
          onChangeText?.(newVal);
          const newPos = ss + text.length;
          setAnchor(newPos);
          setFocus_(newPos);
        }
      },
      onClickAt: (relX, relY) => {
        const padding = multiline ? 10 : 8;
        const textX = relX - padding;
        const avgW = fontSize * 0.55;
        if (multiline) {
          const lineHeight = fontSize * 1.4;
          const lineIdx = Math.max(0, Math.floor((relY - padding) / lineHeight));
          const lines = value.split(`
`);
          const clampedLine = Math.min(lineIdx, lines.length - 1);
          const col = Math.max(0, Math.min(Math.round(Math.max(0, textX) / avgW), lines[clampedLine].length));
          let pos = 0;
          for (let i = 0;i < clampedLine; i++)
            pos += lines[i].length + 1;
          moveCursor(pos + col);
        } else {
          const col = Math.max(0, Math.min(Math.round(Math.max(0, textX) / avgW), value.length));
          moveCursor(col);
        }
      }
    };
    const onMount = import_react.useCallback((id) => {
      nodeIdRef.current = id;
      registerInput(id, {
        onFocus: () => handlersRef.current.onFocus(),
        onBlur: () => handlersRef.current.onBlur(),
        onKeyPress: (ev) => handlersRef.current.onKeyPress(ev),
        onClickAt: (relX, relY) => handlersRef.current.onClickAt(relX, relY)
      });
    }, []);
    import_react.useEffect(() => {
      return () => {
        if (nodeIdRef.current !== null) {
          unregisterInput(nodeIdRef.current);
        }
      };
    }, []);
    const displayText = focused || value ? value : placeholder;
    const textColor = value ? "#ffffff" : "#888888";
    const innerPadding = multiline ? 10 : 8;
    const inputStyle = {
      backgroundColor: focused ? "#4a4a7e" : "#2a2a3e",
      borderRadius: 6,
      borderWidth: focused ? 2 : 1,
      borderColor: focused ? "#8080ff" : "#44446a",
      justifyContent: multiline ? "flex-start" : "center",
      alignItems: "flex-start",
      padding: innerPadding,
      clip: true,
      ...style
    };
    return import_react.default.createElement("view", { _veloxOnMount: onMount, style: inputStyle, width, height, ...props }, import_react.default.createElement("text", {
      text: displayText,
      fontSize,
      width: width - innerPadding * 2,
      height: multiline ? undefined : height - innerPadding * 2,
      style: { color: textColor },
      showCursor: focused,
      cursorPosition: focused ? focus_ : undefined,
      selectionStart: focused && selStart < selEnd ? selStart : undefined,
      selectionEnd: focused && selStart < selEnd ? selEnd : undefined,
      textAlign: "left"
    }));
  }
  function useWindowSize() {
    const [size, setSize] = import_react.useState(() => {
      const s = typeof __velox_getWindowSize !== "undefined" ? __velox_getWindowSize() : null;
      return s ? { width: s.width, height: s.height } : { width: 0, height: 0 };
    });
    import_react.useEffect(() => {
      const handler = (s) => setSize(s);
      addWindowSizeListener(handler);
      return () => removeWindowSizeListener(handler);
    }, []);
    return size;
  }
  function useMediaQuery(minWidth) {
    const { width } = useWindowSize();
    return width >= minWidth;
  }
  var veloxWindow = {
    setFullscreen: (full) => typeof __velox_setFullscreen !== "undefined" && __velox_setFullscreen(full),
    setMaximized: (max) => typeof __velox_setMaximized !== "undefined" && __velox_setMaximized(max),
    setMinimized: () => typeof __velox_setMinimized !== "undefined" && __velox_setMinimized(),
    isFullscreen: () => typeof __velox_isFullscreen !== "undefined" ? __velox_isFullscreen() : false,
    isMaximized: () => typeof __velox_isMaximized !== "undefined" ? __velox_isMaximized() : false,
    getWindowSize: () => typeof __velox_getWindowSize !== "undefined" ? __velox_getWindowSize() : { width: 0, height: 0 },
    getScreenSize: () => typeof __velox_getScreenSize !== "undefined" ? __velox_getScreenSize() : { width: 0, height: 0 },
    setAlwaysOnTop: (on) => typeof __velox_setAlwaysOnTop !== "undefined" && __velox_setAlwaysOnTop(on),
    setTitle: (title) => typeof __velox_setTitle !== "undefined" && __velox_setTitle(title)
  };
  var _noBinding = (name) => Promise.reject(new Error(`${name}: binding not available`));
  var fs = {
    readFile: (path) => typeof __velox_readFile !== "undefined" ? __velox_readFile(path) : _noBinding("readFile"),
    readFileBytes: (path) => typeof __velox_readFileBytes !== "undefined" ? __velox_readFileBytes(path) : _noBinding("readFileBytes"),
    writeFile: (path, content) => typeof __velox_writeFile !== "undefined" ? __velox_writeFile(path, content) : _noBinding("writeFile"),
    appendFile: (path, content) => typeof __velox_appendFile !== "undefined" ? __velox_appendFile(path, content) : _noBinding("appendFile"),
    listDir: (path) => typeof __velox_listDir !== "undefined" ? __velox_listDir(path).then(JSON.parse) : _noBinding("listDir"),
    deleteFile: (path) => typeof __velox_deleteFile !== "undefined" ? __velox_deleteFile(path) : _noBinding("deleteFile"),
    mkdirp: (path) => typeof __velox_mkdirp !== "undefined" ? __velox_mkdirp(path) : _noBinding("mkdirp")
  };
  var _defaultHandle = null;
  function _dbHandle(h) {
    if (typeof h === "number")
      return h;
    if (_defaultHandle !== null)
      return _defaultHandle;
    throw new Error("db: no handle provided and no default set (call db.open() first)");
  }
  var db = {
    open: (path) => typeof __velox_db_open !== "undefined" ? __velox_db_open(path).then((s) => {
      const h = Number(s);
      if (_defaultHandle === null)
        _defaultHandle = h;
      return h;
    }) : _noBinding("db.open"),
    setDefault: (handle) => {
      _defaultHandle = handle;
    },
    close: (handle) => {
      const h = handle ?? _defaultHandle;
      if (h === null || h === undefined)
        return Promise.resolve();
      if (_defaultHandle === h)
        _defaultHandle = null;
      return typeof __velox_db_close !== "undefined" ? __velox_db_close(h) : _noBinding("db.close");
    },
    query: (handleOrSql, sqlOrParams = [], paramsOrUndef = []) => {
      const isExplicit = typeof handleOrSql === "number";
      const handle = isExplicit ? handleOrSql : _dbHandle(null);
      const sql = isExplicit ? sqlOrParams : handleOrSql;
      const params = isExplicit ? paramsOrUndef : sqlOrParams;
      return typeof __velox_db_query !== "undefined" ? __velox_db_query(handle, sql, JSON.stringify(params)).then(JSON.parse) : _noBinding("db.query");
    },
    run: (handleOrSql, sqlOrParams = [], paramsOrUndef = []) => {
      const isExplicit = typeof handleOrSql === "number";
      const handle = isExplicit ? handleOrSql : _dbHandle(null);
      const sql = isExplicit ? sqlOrParams : handleOrSql;
      const params = isExplicit ? paramsOrUndef : sqlOrParams;
      return typeof __velox_db_run !== "undefined" ? __velox_db_run(handle, sql, JSON.stringify(params)).then(JSON.parse) : _noBinding("db.run");
    },
    transaction: (handleOrStmts, stmtsOrUndef) => {
      const isExplicit = typeof handleOrStmts === "number";
      const handle = isExplicit ? handleOrStmts : _dbHandle(null);
      const stmts = isExplicit ? stmtsOrUndef : handleOrStmts;
      return typeof __velox_db_transaction !== "undefined" ? __velox_db_transaction(handle, JSON.stringify(stmts)) : _noBinding("db.transaction");
    }
  };
  var vectorDb = {
    open: (path) => {
      if (typeof __velox_vectorDb_open === "undefined")
        return _noBinding("vectorDb.open");
      return __velox_vectorDb_open(path).then((s) => {
        const handle = Number(s);
        return {
          upsert(table, id, vector, meta) {
            const metaStr = meta !== undefined ? JSON.stringify(meta) : "";
            return __velox_vectorDb_upsert(handle, table, id, JSON.stringify(vector), metaStr);
          },
          search(table, queryVector, limit = 10) {
            return __velox_vectorDb_search(handle, table, JSON.stringify(queryVector), limit).then(JSON.parse);
          },
          close() {
            return __velox_vectorDb_close(handle);
          }
        };
      });
    }
  };
  var dialog = {
    openFile({ filters = [], multiple = false } = {}) {
      if (typeof __velox_dialog_openFile === "undefined")
        return _noBinding("dialog.openFile");
      return __velox_dialog_openFile(JSON.stringify(filters), multiple).then((raw) => {
        const result = JSON.parse(raw);
        if (result === null)
          return null;
        return Array.isArray(result) ? result : [result];
      });
    },
    saveFile({ defaultName = "", filters = [] } = {}) {
      if (typeof __velox_dialog_saveFile === "undefined")
        return _noBinding("dialog.saveFile");
      return __velox_dialog_saveFile(defaultName, JSON.stringify(filters)).then(JSON.parse);
    },
    openFolder() {
      if (typeof __velox_dialog_openFolder === "undefined")
        return _noBinding("dialog.openFolder");
      return __velox_dialog_openFolder().then(JSON.parse);
    }
  };
  var clipboard = {
    readText() {
      if (typeof __velox_clipboard_readText === "undefined")
        return _noBinding("clipboard.readText");
      return __velox_clipboard_readText();
    },
    writeText(text) {
      if (typeof __velox_clipboard_writeText === "undefined")
        return _noBinding("clipboard.writeText");
      return __velox_clipboard_writeText(text);
    }
  };
  var notification = {
    send({ title, body = "" }) {
      if (typeof __velox_notification_send === "undefined")
        return _noBinding("notification.send");
      return __velox_notification_send(title, body);
    }
  };
  async function fetch(url, options = {}) {
    if (typeof __velox_fetch === "undefined") {
      throw new Error("fetch: __velox_fetch binding is not available");
    }
    const raw = await __velox_fetch(url, JSON.stringify(options));
    const data = JSON.parse(raw);
    return {
      status: data.status,
      ok: data.ok,
      statusText: data.statusText,
      headers: data.headers ?? {},
      text: () => Promise.resolve(data.body),
      json: () => Promise.resolve(JSON.parse(data.body))
    };
  }
  function _pollWebSockets() {
    for (const [id, handlers] of _wsOpenSockets) {
      let raw;
      try {
        raw = __velox_ws_poll(id);
      } catch {
        continue;
      }
      if (!raw)
        continue;
      let msgs;
      try {
        msgs = JSON.parse(raw);
      } catch {
        continue;
      }
      for (const m of msgs) {
        if (m === "__VELOX_WS_CLOSED__") {
          handlers.onclose?.();
          _wsOpenSockets.delete(id);
          break;
        } else {
          handlers.onmessage?.({ data: m });
        }
      }
    }
  }
  var mdns = {
    discover(serviceType, { timeout = 5000 } = {}) {
      if (typeof __velox_mdns_discover === "undefined")
        return _noBinding("mdns.discover");
      return __velox_mdns_discover(serviceType, timeout).then(JSON.parse);
    }
  };
  var ws = {
    connect(url, handlers = {}) {
      return __velox_ws_connect(url).then((idStr) => {
        const id = Number(idStr);
        _wsOpenSockets.set(id, handlers);
        return {
          get id() {
            return id;
          },
          send(msg) {
            __velox_ws_send(id, String(msg));
          },
          close() {
            __velox_ws_close(id);
            _wsOpenSockets.delete(id);
            handlers.onclose?.();
          }
        };
      });
    }
  };
  function _pollIpc() {
    if (typeof __velox_ipc_poll === "undefined")
      return;
    let raw;
    try {
      raw = __velox_ipc_poll();
    } catch {
      return;
    }
    if (!raw)
      return;
    let msgs;
    try {
      msgs = JSON.parse(raw);
    } catch {
      return;
    }
    for (const msg of msgs) {
      for (const cb of _ipcListeners) {
        try {
          cb(msg);
        } catch {}
      }
    }
  }
  var ipc = {
    send(targetHandle, message) {
      if (typeof __velox_ipc_send !== "undefined") {
        __velox_ipc_send(targetHandle, String(message));
      }
    },
    on(event, callback) {
      if (event !== "message")
        return () => {};
      _ipcListeners.push(callback);
      return () => {
        const idx = _ipcListeners.indexOf(callback);
        if (idx !== -1)
          _ipcListeners.splice(idx, 1);
      };
    }
  };
  veloxWindow.create = function create(opts = {}) {
    if (typeof __velox_window_create === "undefined")
      return _noBinding("veloxWindow.create");
    return __velox_window_create(JSON.stringify(opts)).then((idStr) => {
      const id = Number(idStr);
      return {
        get id() {
          return id;
        },
        send(msg) {
          ipc.send(id, msg);
        }
      };
    });
  };
  veloxWindow.quit = function quit() {
    if (typeof __velox_quit !== "undefined")
      __velox_quit();
  };
  veloxWindow.restart = function restart() {
    if (typeof __velox_restart !== "undefined")
      __velox_restart();
  };
  veloxWindow.close = function close() {
    if (typeof __velox_window_close !== "undefined")
      __velox_window_close();
  };
  var _platformCache = null;
  veloxWindow.platform = function platform() {
    if (_platformCache !== null)
      return _platformCache;
    _platformCache = typeof __velox_platform !== "undefined" ? __velox_platform() : "unknown";
    return _platformCache;
  };
  veloxWindow.hideSplash = function hideSplash() {
    if (typeof __velox_splash_hide !== "undefined")
      __velox_splash_hide();
  };
  var crash = {
    _endpoint: null,
    async getReports() {
      return JSON.parse(await __velox_crash_get_reports());
    },
    clearReports() {
      if (typeof __velox_crash_clear_reports !== "undefined") {
        __velox_crash_clear_reports();
      }
    },
    setEndpoint(url) {
      crash._endpoint = url;
    }
  };
  (function _installCrashHandlers() {
    function _report(data) {
      try {
        if (typeof __velox_crash_report_js !== "undefined") {
          __velox_crash_report_js(JSON.stringify(data));
        }
      } catch (_) {}
    }
    const prevOnerror = globalThis.onerror;
    globalThis.onerror = function(msg, src, line, col, err) {
      _report({
        type: "js_error",
        timestamp: Date.now(),
        message: String(msg),
        source: String(src || ""),
        line: line || 0,
        col: col || 0,
        stack: err && err.stack ? String(err.stack) : ""
      });
      if (typeof prevOnerror === "function")
        prevOnerror(msg, src, line, col, err);
    };
    const prevUnhandled = globalThis.onunhandledrejection;
    globalThis.onunhandledrejection = function(event) {
      const reason = event && event.reason;
      _report({
        type: "unhandled_rejection",
        timestamp: Date.now(),
        message: reason instanceof Error ? reason.message : String(reason || ""),
        stack: reason instanceof Error && reason.stack ? String(reason.stack) : ""
      });
      if (typeof prevUnhandled === "function")
        prevUnhandled(event);
    };
  })();
  var backend = new Proxy(Object.create(null), {
    get(_, name) {
      return function(args) {
        const json = typeof args === "undefined" ? "{}" : JSON.stringify(args);
        return __velox_backend_call(String(name), json).then(function(raw) {
          try {
            return JSON.parse(raw);
          } catch (_2) {
            return raw;
          }
        });
      };
    }
  });
  var perf = {
    snapshot() {
      if (typeof __velox_perf_snapshot === "undefined")
        return null;
      try {
        return JSON.parse(__velox_perf_snapshot());
      } catch {
        return null;
      }
    },
    onBudgetExceeded(cb, { target = 16.667 } = {}) {
      if (typeof __velox_perf_set_budget !== "undefined")
        __velox_perf_set_budget(target);
      _perfBudgetCallbacks.push(cb);
      return function unsubscribe() {
        const idx = _perfBudgetCallbacks.indexOf(cb);
        if (idx !== -1)
          _perfBudgetCallbacks.splice(idx, 1);
      };
    },
    onLeakDetected(cb) {
      _perfLeakCallbacks.push(cb);
      return function unsubscribe() {
        const idx = _perfLeakCallbacks.indexOf(cb);
        if (idx !== -1)
          _perfLeakCallbacks.splice(idx, 1);
      };
    }
  };
  var battery = {
    async getStatus() {
      if (typeof __velox_battery_getStatus === "undefined")
        return null;
      const raw = await __velox_battery_getStatus();
      return raw === "null" ? null : JSON.parse(raw);
    }
  };
  var system = {
    async getInfo() {
      if (typeof __velox_system_getInfo === "undefined")
        return null;
      return JSON.parse(await __velox_system_getInfo());
    },
    getDarkMode() {
      if (typeof __velox_system_getDarkMode === "undefined")
        return "unknown";
      return __velox_system_getDarkMode();
    },
    isBatterySaverActive() {
      if (typeof __velox_system_getBatterySaver === "undefined")
        return false;
      return __velox_system_getBatterySaver();
    }
  };
  var power = {
    preventSleep(reason = "Velox app running") {
      if (typeof __velox_power_preventSleep === "undefined")
        return null;
      return __velox_power_preventSleep(reason);
    },
    allowSleep(handle) {
      if (typeof __velox_power_allowSleep !== "undefined")
        __velox_power_allowSleep(handle);
    }
  };
  var storage = {
    async getDrives() {
      if (typeof __velox_storage_getDrives === "undefined")
        return [];
      return JSON.parse(await __velox_storage_getDrives());
    }
  };
  var credentials = {
    async set(key, value, { service = "velox" } = {}) {
      await __velox_credentials_set(service, key, value);
    },
    async get(key, { service = "velox" } = {}) {
      const raw = await __velox_credentials_get(service, key);
      return raw === "null" ? null : JSON.parse(raw);
    },
    async delete(key, { service = "velox" } = {}) {
      await __velox_credentials_delete(service, key);
    }
  };
  var audio = {
    async play(src, { volume = 1, onEnded } = {}) {
      if (typeof __velox_audio_play === "undefined")
        throw new Error("audio binding unavailable");
      const rawId = await __velox_audio_play(src, JSON.stringify({ volume }));
      const id = String(JSON.parse(rawId));
      if (onEnded) {
        if (!_audioCallbacks.has(id))
          _audioCallbacks.set(id, []);
        _audioCallbacks.get(id).push({ onEnded });
      }
      return {
        id,
        pause() {
          if (typeof __velox_audio_pause !== "undefined")
            __velox_audio_pause(id);
        },
        resume() {
          if (typeof __velox_audio_resume !== "undefined")
            __velox_audio_resume(id);
        },
        play() {
          if (typeof __velox_audio_resume !== "undefined")
            __velox_audio_resume(id);
        },
        stop() {
          if (typeof __velox_audio_stop !== "undefined")
            __velox_audio_stop(id);
          _audioCallbacks.delete(id);
        },
        setVolume(v) {
          if (typeof __velox_audio_setVolume !== "undefined")
            __velox_audio_setVolume(id, v);
        },
        getVolume() {
          return typeof __velox_audio_getVolume !== "undefined" ? __velox_audio_getVolume(id) : 1;
        },
        getTime() {
          return typeof __velox_audio_get_time !== "undefined" ? __velox_audio_get_time(id) : 0;
        },
        async getDuration() {
          return typeof __velox_audio_duration !== "undefined" ? parseFloat(await __velox_audio_duration(id)) : -1;
        },
        async seek(secs) {
          if (typeof __velox_audio_seek !== "undefined")
            await __velox_audio_seek(id, secs);
        },
        onEnded(cb) {
          if (!_audioCallbacks.has(id))
            _audioCallbacks.set(id, []);
          _audioCallbacks.get(id).push({ onEnded: cb });
        }
      };
    }
  };
  function Checkbox({ checked = false, onChange, disabled = false, label, style, ...rest }) {
    const SIZE = 20;
    const active = checked && !disabled;
    const box = import_react.default.createElement(View, {
      style: {
        width: SIZE,
        height: SIZE,
        borderWidth: 2,
        borderColor: disabled ? "#555" : active ? "#7aa2f7" : "#555",
        borderRadius: 4,
        backgroundColor: active ? "#7aa2f7" : "transparent",
        justifyContent: "center",
        alignItems: "center"
      }
    }, active ? import_react.default.createElement(View, {
      style: { width: 10, height: 10, backgroundColor: "#171923", borderRadius: 2 }
    }) : null);
    const lbl = label != null ? import_react.default.createElement(Text, { style: { color: disabled ? "#555" : "#e7ecff", fontSize: 14 } }, String(label)) : null;
    return import_react.default.createElement(Pressable, {
      onPress: () => {
        if (!disabled && onChange)
          onChange(!checked);
      },
      style: { flexDirection: "row", alignItems: "center", gap: 8, ...style },
      ...rest
    }, box, lbl);
  }
  function Switch({ value = false, onValueChange, disabled = false, style, ...rest }) {
    return import_react.default.createElement(Pressable, {
      onPress: () => {
        if (!disabled && onValueChange)
          onValueChange(!value);
      },
      style: {
        width: 48,
        height: 24,
        backgroundColor: disabled ? "#333" : value ? "#7aa2f7" : "#3c4464",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: value ? "flex-end" : "flex-start",
        padding: 2,
        ...style
      },
      ...rest
    }, import_react.default.createElement(View, {
      style: { width: 20, height: 20, backgroundColor: disabled ? "#666" : "#fff", borderRadius: 10 }
    }));
  }
  var _RadioCtx = import_react.default.createContext(null);
  function RadioGroup({ value, onValueChange, children, style, ...rest }) {
    return import_react.default.createElement(_RadioCtx.Provider, { value: { value, onValueChange } }, import_react.default.createElement(View, { style: { gap: 8, ...style }, ...rest }, children));
  }
  function Radio({ value, label, disabled = false, style, ...rest }) {
    const ctx = import_react.default.useContext(_RadioCtx);
    const selected = ctx != null && ctx.value === value;
    const ringColor = disabled ? "#555" : selected ? "#7aa2f7" : "#555";
    const circle = import_react.default.createElement(View, {
      style: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: ringColor,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "transparent"
      }
    }, selected ? import_react.default.createElement(View, {
      style: { width: 10, height: 10, backgroundColor: disabled ? "#555" : "#7aa2f7", borderRadius: 5 }
    }) : null);
    const lbl = label != null ? import_react.default.createElement(Text, { style: { color: disabled ? "#555" : "#e7ecff", fontSize: 14 } }, String(label)) : null;
    return import_react.default.createElement(Pressable, {
      onPress: () => {
        if (!disabled && ctx && ctx.onValueChange)
          ctx.onValueChange(value);
      },
      style: { flexDirection: "row", alignItems: "center", gap: 8, ...style },
      ...rest
    }, circle, lbl);
  }
  function FileInput({
    onFilesSelected,
    accept,
    multiple = false,
    label = "Browse files…",
    disabled = false,
    style,
    ...rest
  }) {
    const handlePress = () => {
      if (disabled)
        return;
      const filters = accept ? accept.split(",").map((e) => e.trim().replace(/^\./, "")) : [];
      dialog.openFile({ filters, multiple }).then((paths) => {
        if (paths && paths.length > 0 && onFilesSelected)
          onFilesSelected(paths);
      }).catch((e) => __velox_log("[FileInput] error: " + e));
    };
    return import_react.default.createElement(Pressable, {
      onPress: handlePress,
      style: {
        padding: 8,
        backgroundColor: disabled ? "#1f2333" : "#262b3f",
        borderWidth: 1,
        borderColor: disabled ? "#3c4464" : "#7aa2f7",
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
        ...style
      },
      ...rest
    }, import_react.default.createElement(Text, {
      style: { color: disabled ? "#555" : "#7aa2f7", fontSize: 14 }
    }, label));
  }
  var ai = {
    async embed(text) {
      if (typeof __velox_ai_embed === "undefined")
        throw new Error("ai.embed: binding unavailable — add ai:true to velox.config.json");
      const raw = await __velox_ai_embed(String(text));
      return JSON.parse(raw);
    },
    async generate(prompt, { maxTokens = 200, temperature = 0.7 } = {}) {
      if (typeof __velox_ai_generate === "undefined")
        throw new Error("ai.generate: binding unavailable — add ai:true to velox.config.json");
      return __velox_ai_generate(String(prompt), JSON.stringify({ maxTokens, temperature }));
    },
    async transcribe(audioPath, { language = "" } = {}) {
      if (typeof __velox_ai_transcribe === "undefined")
        throw new Error("ai.transcribe: binding unavailable — add ai:true to velox.config.json");
      return __velox_ai_transcribe(String(audioPath), JSON.stringify({ language }));
    }
  };
  var camera = {
    async listDevices() {
      return JSON.parse(await __velox_camera_list());
    },
    async open(deviceIndex = 0) {
      return parseInt(await __velox_camera_open(deviceIndex));
    },
    close(handle) {
      __velox_camera_close(String(handle));
    },
    async capture(handle) {
      return __velox_camera_capture(String(handle));
    },
    startRecord(handle, outputPath) {
      __velox_camera_record_start(String(handle), outputPath);
    },
    async stopRecord(handle) {
      return __velox_camera_record_stop(String(handle));
    }
  };
  var microphone = {
    async listDevices() {
      return JSON.parse(await __velox_microphone_list());
    },
    async record(durationMs = 3000, deviceName = null) {
      return __velox_microphone_record(deviceName || "", durationMs);
    }
  };
  var _videoCallbacks = new Map;
  function _pollVideo() {
    const events = JSON.parse(__velox_video_poll());
    for (const ev of events) {
      const cbs = _videoCallbacks.get(ev.id);
      if (!cbs)
        continue;
      if (ev.type === "ended" && cbs.onEnded)
        cbs.onEnded();
      else if (ev.type === "metadata" && cbs.onMetadata)
        cbs.onMetadata(ev);
      else if (ev.type === "timeupdate" && cbs.onTimeUpdate)
        cbs.onTimeUpdate(ev.currentTime);
      else if (ev.type === "error" && cbs.onError)
        cbs.onError(ev.message);
    }
  }
  var video = {
    async open(url, { onEnded, onMetadata, onTimeUpdate, onError } = {}) {
      const handleId = parseInt(await __velox_video_open(url));
      _videoCallbacks.set(handleId, { onEnded, onMetadata, onTimeUpdate, onError });
      return handleId;
    },
    seek(handleId, seconds) {
      __velox_video_seek(String(handleId), Math.max(0, seconds));
    },
    setVolume(handleId, volume) {
      __velox_video_set_volume(String(handleId), volume);
    },
    pause(handleId) {
      __velox_video_pause(String(handleId));
    },
    play(handleId) {
      __velox_video_play(String(handleId));
    },
    close(handleId) {
      __velox_video_close(String(handleId));
      _videoCallbacks.delete(handleId);
    }
  };
  var Camera = import_react.default.forwardRef(function Camera2({ mirror, style, ...rest }, ref) {
    const [cameraHandle, setCameraHandle] = import_react.default.useState(null);
    import_react.default.useEffect(() => {
      return () => {
        if (cameraHandle !== null) {
          __velox_camera_close(String(cameraHandle));
        }
      };
    }, [cameraHandle]);
    import_react.default.useImperativeHandle(ref, () => ({
      get handle() {
        return cameraHandle;
      },
      async start(deviceIndex = 0) {
        const handle = parseInt(await __velox_camera_open(deviceIndex));
        setCameraHandle(handle);
        return handle;
      },
      stop() {
        if (cameraHandle !== null) {
          __velox_camera_close(String(cameraHandle));
          setCameraHandle(null);
        }
      },
      async capture() {
        if (cameraHandle === null)
          throw new Error("Camera not open");
        return __velox_camera_capture(String(cameraHandle));
      },
      startRecord(outputPath) {
        if (cameraHandle === null)
          throw new Error("Camera not open");
        __velox_camera_record_start(String(cameraHandle), outputPath);
      },
      async stopRecord() {
        if (cameraHandle === null)
          throw new Error("Camera not open");
        return __velox_camera_record_stop(String(cameraHandle));
      }
    }), [cameraHandle]);
    return import_react.default.createElement("camera", {
      cameraHandle,
      mirror: mirror === true,
      style,
      ...rest
    });
  });
  var Video = import_react.default.forwardRef(function Video2({ src, autoPlay = true, loop = false, onEnded, onMetadata, onTimeUpdate, onError, style, ...rest }, ref) {
    const [videoHandle, setVideoHandle] = import_react.default.useState(null);
    const currentTimeRef = import_react.default.useRef(0);
    const durationRef = import_react.default.useRef(-1);
    import_react.default.useEffect(() => {
      if (!src)
        return;
      let handle = null;
      let cancelled = false;
      currentTimeRef.current = 0;
      durationRef.current = -1;
      video.open(src, {
        onEnded: loop ? () => {
          if (handle !== null)
            video.seek(handle, 0);
        } : onEnded,
        onMetadata: (m) => {
          durationRef.current = m.durationSecs ?? -1;
          if (onMetadata)
            onMetadata(m);
        },
        onTimeUpdate: (t) => {
          currentTimeRef.current = t;
          if (onTimeUpdate)
            onTimeUpdate(t);
        },
        onError
      }).then((h) => {
        if (cancelled) {
          video.close(h);
          return;
        }
        handle = h;
        setVideoHandle(h);
      }).catch((e) => {
        if (onError)
          onError(e instanceof Error ? e.message : String(e));
      });
      return () => {
        cancelled = true;
        if (handle !== null) {
          video.close(handle);
          handle = null;
          setVideoHandle(null);
        }
      };
    }, [src]);
    import_react.default.useImperativeHandle(ref, () => ({
      get handle() {
        return videoHandle;
      },
      get currentTime() {
        return currentTimeRef.current;
      },
      get duration() {
        return durationRef.current;
      },
      seek(seconds) {
        if (videoHandle !== null)
          video.seek(videoHandle, seconds);
      },
      setVolume(vol) {
        if (videoHandle !== null)
          video.setVolume(videoHandle, vol);
      },
      pause() {
        if (videoHandle !== null)
          video.pause(videoHandle);
      },
      play() {
        if (videoHandle !== null)
          video.play(videoHandle);
      },
      close() {
        if (videoHandle !== null) {
          video.close(videoHandle);
          setVideoHandle(null);
        }
      }
    }), [videoHandle]);
    return import_react.default.createElement("video", { videoHandle, style, ...rest });
  });
  var input = {
    gamepads: {
      onInput(cb) {
        const key = Symbol();
        const prev = globalThis.__velox_gamepadCb;
        if (!globalThis._gamepadCallbacks)
          globalThis._gamepadCallbacks = [];
        globalThis._gamepadCallbacks.push(cb);
        return function unsubscribe() {
          const arr = globalThis._gamepadCallbacks;
          if (arr) {
            const i = arr.indexOf(cb);
            if (i !== -1)
              arr.splice(i, 1);
          }
        };
      }
    },
    globalShortcut: {
      register(accelerator, cb) {
        if (typeof __velox_shortcut_register === "undefined")
          return null;
        try {
          const id = Number(__velox_shortcut_register(accelerator));
          _globalShortcutCallbacks.set(id, cb);
          return String(id);
        } catch (e) {
          __velox_log("[shortcut] register error: " + e);
          return null;
        }
      },
      unregister(id) {
        const numId = Number(id);
        _globalShortcutCallbacks.delete(numId);
        if (typeof __velox_shortcut_unregister !== "undefined")
          __velox_shortcut_unregister(String(numId));
      }
    },
    shortcut: {
      register(accelerator, cb) {
        const parts = accelerator.toLowerCase().split("+").map((s) => s.trim());
        const mods = { ctrl: false, shift: false, alt: false, meta: false };
        let key = null;
        for (const p of parts) {
          if (p === "ctrl" || p === "control")
            mods.ctrl = true;
          else if (p === "shift")
            mods.shift = true;
          else if (p === "alt")
            mods.alt = true;
          else if (p === "meta" || p === "cmd" || p === "win")
            mods.meta = true;
          else
            key = p;
        }
        const id = _localShortcutNextId++;
        _localShortcuts.set(id, { mods, key, cb });
        return id;
      },
      unregister(id) {
        _localShortcuts.delete(id);
      }
    }
  };
  var deeplink = {
    onOpen(cb) {
      _deeplinkCallbacks.push(cb);
      return function unsubscribe() {
        const i = _deeplinkCallbacks.indexOf(cb);
        if (i !== -1)
          _deeplinkCallbacks.splice(i, 1);
      };
    }
  };
  function Slider({
    value = 0,
    onValueChange,
    onChange,
    min = 0,
    max = 1,
    step = 0,
    disabled = false,
    style,
    width: widthProp = 200,
    ...rest
  }) {
    const _cb = onValueChange ?? onChange;
    const THUMB = 20;
    const TRACK = 4;
    const accent = disabled ? "#555" : "#7aa2f7";
    const pct = max === min ? 0 : Math.max(0, Math.min(1, (Math.min(max, Math.max(min, value)) - min) / (max - min)));
    const fillW = Math.max(0, Math.round(pct * (widthProp - THUMB)));
    const rightW = Math.max(0, widthProp - THUMB - fillW);
    const trackNodeId = import_react.useRef(null);
    const minRef = import_react.useRef(min);
    minRef.current = min;
    const maxRef = import_react.useRef(max);
    maxRef.current = max;
    const stepRef = import_react.useRef(step);
    stepRef.current = step;
    const disabledRef = import_react.useRef(disabled);
    disabledRef.current = disabled;
    const onChangeRef = import_react.useRef(_cb);
    onChangeRef.current = _cb;
    const updateFromX = import_react.useCallback((x) => {
      if (disabledRef.current || !onChangeRef.current)
        return;
      const layout = __velox_getLayout(trackNodeId.current);
      if (!layout || layout.width <= 0)
        return;
      const range = maxRef.current - minRef.current;
      const frac = Math.max(0, Math.min(1, (x - layout.x) / layout.width));
      let v = minRef.current + frac * range;
      const s = stepRef.current;
      if (s > 0)
        v = Math.round(v / s) * s;
      onChangeRef.current(v);
    }, []);
    const onTrackMount = import_react.useCallback((id) => {
      trackNodeId.current = id;
      registerDraggable(id, {
        onDragStart({ x }) {
          updateFromX(x);
        },
        onDragMove({ x }) {
          updateFromX(x);
        }
      });
    }, []);
    import_react.useEffect(() => {
      return () => {
        if (trackNodeId.current !== null)
          unregisterDraggable(trackNodeId.current);
      };
    }, []);
    return import_react.default.createElement(View, {
      _veloxOnMount: onTrackMount,
      width: widthProp,
      style: { flexDirection: "row", alignItems: "center", ...style },
      ...rest
    }, import_react.default.createElement(View, { width: fillW, height: TRACK, style: { backgroundColor: accent } }), import_react.default.createElement(View, { width: THUMB, height: THUMB, style: { borderRadius: THUMB / 2, backgroundColor: accent } }), import_react.default.createElement(View, { width: rightW, height: TRACK, style: { backgroundColor: "#3c4464" } }));
  }
  function Select({
    value,
    options = [],
    onValueChange,
    disabled = false,
    placeholder = "Select…",
    style,
    ...rest
  }) {
    const [open, setOpen] = import_react.default.useState(false);
    const selected = options.find((o) => o.value === value);
    const containerNodeId = import_react.useRef(null);
    const onContainerMount = import_react.useCallback((id) => {
      containerNodeId.current = id;
    }, []);
    import_react.useEffect(() => {
      if (!open)
        return;
      const onGlobalClick = ({ x, y }) => {
        const layout = typeof __velox_getLayout !== "undefined" ? __velox_getLayout(containerNodeId.current) : null;
        if (!layout) {
          setOpen(false);
          return;
        }
        const inside = x >= layout.x && x < layout.x + layout.width && y >= layout.y && y < layout.y + layout.height;
        if (!inside)
          setOpen(false);
      };
      addGlobalClickListener(onGlobalClick);
      return () => removeGlobalClickListener(onGlobalClick);
    }, [open]);
    const OPTION_H = 40;
    const dropH = options.length * OPTION_H;
    return import_react.default.createElement(View, {
      _veloxOnMount: onContainerMount,
      style,
      ...rest
    }, import_react.default.createElement(Pressable, {
      onPress: () => {
        if (!disabled)
          setOpen((o) => !o);
      },
      style: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 10,
        height: 40,
        borderRadius: 8,
        backgroundColor: disabled ? "#1a1d2e" : "#262b3f",
        borderWidth: 1,
        borderColor: open ? "#7aa2f7" : "#3c4464",
        clip: true
      }
    }, import_react.default.createElement(View, { style: { flex: 1, clip: true }, height: 20 }, import_react.default.createElement(Text, {
      style: { color: selected ? "#e7ecff" : "#666", fontSize: 14 }
    }, selected ? selected.label : placeholder)), import_react.default.createElement(Text, {
      style: { color: "#7aa2f7", fontSize: 11 },
      width: 16,
      height: 16
    }, open ? "▲" : "▼")), open && import_react.default.createElement(View, {
      style: {
        backgroundColor: "#1e2235",
        borderRadius: 8,
        marginTop: 4,
        borderWidth: 1,
        borderColor: "#3c4464"
      },
      height: dropH
    }, ...options.map((opt, i) => import_react.default.createElement(Pressable, {
      key: String(i),
      onPress: () => {
        onValueChange?.(opt.value);
        setOpen(false);
      },
      style: {
        paddingLeft: 12,
        paddingRight: 12,
        height: OPTION_H,
        justifyContent: "center",
        backgroundColor: opt.value === value ? "#2e3555" : "transparent",
        borderRadius: 6
      }
    }, import_react.default.createElement(Text, {
      style: { color: opt.value === value ? "#7aa2f7" : "#cdd6f4", fontSize: 14 }
    }, opt.label)))));
  }
  function DatePicker({ value = null, onValueChange, disabled = false, style, ...rest }) {
    const today = value ? new Date(value) : new Date;
    const [open, setOpen] = import_react.default.useState(false);
    const [viewYear, setViewYear] = import_react.default.useState(today.getFullYear());
    const [viewMonth, setViewMonth] = import_react.default.useState(today.getMonth());
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0;i < firstDow; i++)
      cells.push(null);
    for (let d = 1;d <= daysInMonth; d++)
      cells.push(d);
    const prevMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((y) => y - 1);
      } else
        setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((y) => y + 1);
      } else
        setViewMonth((m) => m + 1);
    };
    const rowCount = Math.ceil(cells.length / 7);
    const rows = Array.from({ length: rowCount }, (_, r) => cells.slice(r * 7, r * 7 + 7));
    const CELL_W = 36;
    const CELL_H = 32;
    const CAL_W = CELL_W * 7;
    const containerNodeId = import_react.useRef(null);
    const onContainerMount = import_react.useCallback((id) => {
      containerNodeId.current = id;
    }, []);
    import_react.useEffect(() => {
      if (!open)
        return;
      const onGlobalClick = ({ x, y }) => {
        const layout = typeof __velox_getLayout !== "undefined" ? __velox_getLayout(containerNodeId.current) : null;
        if (!layout) {
          setOpen(false);
          return;
        }
        const inside = x >= layout.x && x < layout.x + layout.width && y >= layout.y && y < layout.y + layout.height;
        if (!inside)
          setOpen(false);
      };
      addGlobalClickListener(onGlobalClick);
      return () => removeGlobalClickListener(onGlobalClick);
    }, [open]);
    const CAL_ROWS_H = Math.ceil(cells.length / 7) * CELL_H;
    const CAL_TOTAL_H = 8 + 32 + 22 + CAL_ROWS_H + 8;
    return import_react.default.createElement(View, {
      _veloxOnMount: onContainerMount,
      style,
      ...rest
    }, open && import_react.default.createElement(View, {
      width: CAL_W + 16,
      height: CAL_TOTAL_H,
      style: {
        backgroundColor: "#1e2235",
        borderRadius: 8,
        marginBottom: 4,
        padding: 8,
        borderWidth: 1,
        borderColor: "#3c4464"
      }
    }, import_react.default.createElement(View, {
      width: CAL_W,
      height: 28,
      style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }
    }, import_react.default.createElement(Pressable, { onPress: prevMonth, width: 24, height: 28, style: { justifyContent: "center", alignItems: "center" } }, import_react.default.createElement(Text, { style: { color: "#7aa2f7", fontSize: 18 }, width: 20, height: 22 }, "‹")), import_react.default.createElement(Text, { style: { color: "#cdd6f4", fontSize: 13 }, width: CAL_W - 56, height: 18 }, `${monthNames[viewMonth]} ${viewYear}`), import_react.default.createElement(Pressable, { onPress: nextMonth, width: 24, height: 28, style: { justifyContent: "center", alignItems: "center" } }, import_react.default.createElement(Text, { style: { color: "#7aa2f7", fontSize: 18 }, width: 20, height: 22 }, "›"))), import_react.default.createElement(View, { width: CAL_W, height: 20, style: { flexDirection: "row", marginBottom: 2 } }, ...dayNames.map((d) => import_react.default.createElement(View, {
      key: d,
      width: CELL_W,
      height: 20,
      style: { alignItems: "center", justifyContent: "center" }
    }, import_react.default.createElement(Text, { style: { color: "#555", fontSize: 10 }, width: CELL_W, height: 14 }, d)))), ...rows.map((row, ri) => import_react.default.createElement(View, {
      key: ri,
      width: CAL_W,
      height: CELL_H,
      style: { flexDirection: "row" }
    }, ...row.map((day, ci) => {
      if (day === null) {
        return import_react.default.createElement(View, { key: ci, width: CELL_W, height: CELL_H });
      }
      const selDate = value ? new Date(value) : null;
      const isSelected = selDate && selDate.getDate() === day && selDate.getMonth() === viewMonth && selDate.getFullYear() === viewYear;
      return import_react.default.createElement(Pressable, {
        key: ci,
        onPress: () => {
          onValueChange?.(new Date(viewYear, viewMonth, day));
          setOpen(false);
        },
        width: CELL_W,
        height: CELL_H,
        style: {
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          backgroundColor: isSelected ? "#7aa2f7" : "transparent"
        }
      }, import_react.default.createElement(Text, {
        style: { color: isSelected ? "#171923" : "#cdd6f4", fontSize: 13 },
        width: CELL_W,
        height: 18
      }, String(day)));
    })))), import_react.default.createElement(Pressable, {
      onPress: () => {
        if (!disabled)
          setOpen((o) => !o);
      },
      style: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 10,
        height: 40,
        borderRadius: 8,
        backgroundColor: disabled ? "#1a1d2e" : "#262b3f",
        borderWidth: 1,
        borderColor: open ? "#7aa2f7" : "#3c4464"
      }
    }, import_react.default.createElement(Text, {
      style: { color: value ? "#e7ecff" : "#666", fontSize: 14 }
    }, value ? `${new Date(value).getFullYear()}-${String(new Date(value).getMonth() + 1).padStart(2, "0")}-${String(new Date(value).getDate()).padStart(2, "0")}` : "Select date…"), import_react.default.createElement(Text, {
      style: { color: "#7aa2f7", fontSize: 11 },
      width: 16,
      height: 16
    }, open ? "▲" : "▼")));
  }
  function _parseColor(c) {
    if (Array.isArray(c))
      return c;
    if (typeof c === "string" && c.startsWith("#")) {
      const h = c.slice(1);
      if (h.length === 3) {
        const [r, g, b] = h.split("").map((x) => parseInt(x + x, 16));
        return [r, g, b, 255];
      }
      if (h.length === 6) {
        return [
          parseInt(h.slice(0, 2), 16),
          parseInt(h.slice(2, 4), 16),
          parseInt(h.slice(4, 6), 16),
          255
        ];
      }
      if (h.length === 8) {
        return [
          parseInt(h.slice(0, 2), 16),
          parseInt(h.slice(2, 4), 16),
          parseInt(h.slice(4, 6), 16),
          parseInt(h.slice(6, 8), 16)
        ];
      }
    }
    return [255, 255, 255, 255];
  }

  class VeloxCanvasContext {
    constructor(nativeId) {
      this._id = nativeId;
      this._cmds = [];
      this.fillStyle = [255, 255, 255, 255];
      this.strokeStyle = [255, 255, 255, 255];
      this.lineWidth = 1;
    }
    clear() {
      this._cmds = [{ type: "clear" }];
    }
    fillRect(x, y, w, h) {
      this._cmds.push({ type: "fillRect", x, y, w, h, color: _parseColor(this.fillStyle) });
    }
    strokeRect(x, y, w, h) {
      this._cmds.push({ type: "strokeRect", x, y, w, h, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
    }
    fillCircle(cx, cy, r) {
      this._cmds.push({ type: "fillCircle", cx, cy, r, color: _parseColor(this.fillStyle) });
    }
    strokeCircle(cx, cy, r) {
      this._cmds.push({ type: "strokeCircle", cx, cy, r, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
    }
    strokeLine(x0, y0, x1, y1) {
      this._cmds.push({ type: "strokeLine", x0, y0, x1, y1, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
    }
    fillText(text, x, y, fontSize = 16) {
      this._cmds.push({ type: "fillText", text: String(text), x, y, fontSize, color: _parseColor(this.fillStyle) });
    }
    flush() {
      if (typeof __velox_canvas_update === "undefined")
        return;
      try {
        __velox_canvas_update(this._id, JSON.stringify(this._cmds));
      } catch (e) {
        __velox_log("[canvas] flush error: " + e);
      }
      this._cmds = [];
    }
  }
  var Canvas = import_react.default.forwardRef(function Canvas2({ style, ...props }, ref) {
    const ctxRef = import_react.useRef(null);
    const nativeId = import_react.useRef(null);
    const onMount = import_react.useCallback((id) => {
      nativeId.current = id;
      const ctx = new VeloxCanvasContext(id);
      ctxRef.current = ctx;
      if (ref) {
        if (typeof ref === "function")
          ref(ctx);
        else
          ref.current = ctx;
      }
    }, [ref]);
    return import_react.default.createElement("canvas", {
      _veloxOnMount: onMount,
      style,
      ...props
    });
  });

  class VeloxCanvas3DContext {
    constructor(nativeId) {
      this._id = nativeId;
    }
    updateScene(scene) {
      if (typeof __velox_canvas3d_update === "undefined")
        return;
      try {
        __velox_canvas3d_update(this._id, JSON.stringify(scene));
      } catch (e) {
        __velox_log("[canvas3d] updateScene error: " + e);
      }
    }
    loadGltf(path) {
      if (typeof __velox_canvas3d_load_gltf === "undefined")
        return;
      try {
        __velox_canvas3d_load_gltf(this._id, path);
      } catch (e) {
        __velox_log("[canvas3d] loadGltf error: " + e);
      }
    }
  }
  var Canvas3D = import_react.default.forwardRef(function Canvas3D2({ style, ...props }, ref) {
    const onMount = import_react.useCallback((id) => {
      const ctx = new VeloxCanvas3DContext(id);
      if (ref) {
        if (typeof ref === "function")
          ref(ctx);
        else
          ref.current = ctx;
      }
    }, [ref]);
    return import_react.default.createElement("canvas3d", {
      _veloxOnMount: onMount,
      style,
      ...props
    });
  });

  // ../../js/packages/@velox/router/src/index.js
  var import_react2 = __toESM(require_react(), 1);
  var RouterCtx = import_react2.createContext(null);
  function Router({ children, initialRoute }) {
    const routeMap = {};
    import_react2.Children.forEach(children, (child) => {
      if (child && child.type === Route) {
        routeMap[child.props.name] = child.props.component;
      }
    });
    const firstName = initialRoute ?? Object.keys(routeMap)[0] ?? null;
    const [history, setHistory] = import_react2.useState([{ name: firstName, params: {} }]);
    const navigate = import_react2.useCallback((name, params = {}, opts = {}) => {
      if (name === "back") {
        setHistory((h) => h.length > 1 ? h.slice(0, -1) : h);
      } else if (opts.replace) {
        setHistory((h) => [...h.slice(0, -1), { name, params }]);
      } else {
        setHistory((h) => [...h, { name, params }]);
      }
    }, []);
    const ctx = import_react2.useMemo(() => {
      const current = history[history.length - 1] ?? { name: null, params: {} };
      return {
        routeName: current.name,
        params: current.params,
        navigate,
        canGoBack: history.length > 1,
        history
      };
    }, [history, navigate]);
    const Screen = ctx.routeName ? routeMap[ctx.routeName] : null;
    return import_react2.default.createElement(RouterCtx.Provider, { value: ctx }, Screen ? import_react2.default.createElement(Screen) : null);
  }
  function Route(_props) {
    return null;
  }
  function useNavigate() {
    const ctx = import_react2.useContext(RouterCtx);
    if (!ctx)
      throw new Error("useNavigate must be used inside <Router>");
    return ctx.navigate;
  }
  function useRoute() {
    const ctx = import_react2.useContext(RouterCtx);
    if (!ctx)
      throw new Error("useRoute must be used inside <Router>");
    return { name: ctx.routeName, params: ctx.params, canGoBack: ctx.canGoBack };
  }

  // ../../js/packages/@velox/keychain/src/index.js
  function createKeychain(namespace, { service = "velox" } = {}) {
    if (!namespace || typeof namespace !== "string") {
      throw new Error("@velox/keychain: namespace must be a non-empty string");
    }
    const _key = (k) => `${namespace}:${k}`;
    return {
      async set(key, value) {
        await credentials.set(_key(key), JSON.stringify(value), { service });
      },
      async get(key) {
        const raw = await credentials.get(_key(key), { service });
        if (raw === null)
          return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      },
      async delete(key) {
        await credentials.delete(_key(key), { service });
      },
      async clear(keys) {
        await Promise.all(keys.map((k) => credentials.delete(_key(k), { service })));
      }
    };
  }
  function createTypedKeychain(namespace, schema, opts = {}) {
    const chain = createKeychain(namespace, opts);
    const _keys = Object.keys(schema);
    return {
      async set(key, value) {
        if (!(key in schema))
          throw new Error(`@velox/keychain: unknown key "${key}" in namespace "${namespace}"`);
        await chain.set(key, value);
      },
      async get(key) {
        if (!(key in schema))
          throw new Error(`@velox/keychain: unknown key "${key}" in namespace "${namespace}"`);
        const val = await chain.get(key);
        return val !== null ? val : schema[key];
      },
      async getAll() {
        const entries = await Promise.all(_keys.map(async (k) => [k, await this.get(k)]));
        return Object.fromEntries(entries);
      },
      async delete(key) {
        await chain.delete(key);
      },
      async clear() {
        await chain.clear(_keys);
      }
    };
  }

  // ../../js/packages/@velox/store/src/index.js
  var import_react4 = __toESM(require_react(), 1);
  var TABLE = "velox_store";
  var _initPromise = null;
  async function initStore() {
    if (_initPromise)
      return _initPromise;
    _initPromise = db.run(`CREATE TABLE IF NOT EXISTS ${TABLE} ` + `(namespace TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, ` + `PRIMARY KEY (namespace, key))`);
    return _initPromise;
  }
  var _registry = new Map;
  function createStore(namespace, defaults) {
    if (!namespace || typeof namespace !== "string") {
      throw new Error("@velox/store: namespace must be a non-empty string");
    }
    if (_registry.has(namespace))
      return _registry.get(namespace).hook;
    let _state = { ...defaults };
    let _hydrated = false;
    const _subs = new Set;
    function _notify() {
      for (const sub of _subs)
        sub();
    }
    let _hydratePromise = null;
    async function _hydrate() {
      if (_hydratePromise)
        return _hydratePromise;
      _hydratePromise = (async () => {
        await (_initPromise ?? initStore());
        const rows = await db.query(`SELECT key, value FROM ${TABLE} WHERE namespace = ?`, [namespace]);
        const next = { ...defaults };
        for (const row of rows) {
          if (row.key in next) {
            try {
              next[row.key] = JSON.parse(row.value);
            } catch {
              next[row.key] = row.value;
            }
          }
        }
        _state = next;
        _hydrated = true;
        _notify();
      })();
      return _hydratePromise;
    }
    async function _persist(key, value) {
      try {
        await db.run(`INSERT INTO ${TABLE} (namespace, key, value) VALUES (?,?,?) ` + `ON CONFLICT(namespace, key) DO UPDATE SET value=excluded.value`, [namespace, key, JSON.stringify(value)]);
      } catch (e) {
        if (typeof __velox_log !== "undefined")
          __velox_log("[store] persist: " + e);
      }
    }
    const api = {
      set(key, value) {
        if (!(key in defaults))
          return;
        _state = { ..._state, [key]: value };
        _notify();
        _persist(key, value);
      },
      setMany(patch) {
        const next = { ..._state };
        const writes = [];
        for (const [k, v] of Object.entries(patch)) {
          if (k in defaults) {
            next[k] = v;
            writes.push(_persist(k, v));
          }
        }
        _state = next;
        _notify();
        Promise.all(writes).catch(() => {});
      },
      async reset() {
        _state = { ...defaults };
        _notify();
        await db.run(`DELETE FROM ${TABLE} WHERE namespace = ?`, [namespace]);
      }
    };
    function useStore() {
      const [, forceRender] = import_react4.default.useState(0);
      import_react4.default.useEffect(() => {
        let mounted = true;
        const sub = () => {
          if (mounted)
            forceRender((n) => n + 1);
        };
        _subs.add(sub);
        _hydrate().catch(() => {});
        return () => {
          mounted = false;
          _subs.delete(sub);
        };
      }, []);
      return {
        state: _state,
        hydrated: _hydrated,
        set: api.set,
        setMany: api.setMany,
        reset: api.reset
      };
    }
    _registry.set(namespace, { hook: useStore });
    return useStore;
  }

  // ../../js/packages/@velox/three/src/index.js
  var import_react6 = __toESM(require_react(), 1);
  var SceneCtx = import_react6.createContext(null);
  function Scene({ canvasRef, background, children }) {
    const pending = import_react6.useRef({ camera: null, lights: [], meshes: [] });
    pending.current = { camera: null, lights: [], meshes: [] };
    const registerRef = import_react6.useRef(null);
    registerRef.current = function register(type, data) {
      switch (type) {
        case "camera":
          pending.current.camera = data;
          break;
        case "light":
          pending.current.lights.push(data);
          break;
        case "mesh":
          pending.current.meshes.push(data);
          break;
      }
    };
    const ctxRef = import_react6.useRef({
      register: (type, data) => registerRef.current?.(type, data),
      canvasRef: null
    });
    ctxRef.current.canvasRef = canvasRef;
    import_react6.useLayoutEffect(() => {
      const ctx3d = canvasRef?.current;
      if (!ctx3d)
        return;
      const { camera: camera2, lights, meshes } = pending.current;
      const scene = {
        camera: camera2 ?? {
          position: [0, 1, 5],
          target: [0, 0, 0],
          up: [0, 1, 0],
          fovDeg: 60,
          near: 0.1,
          far: 1000
        },
        lights,
        meshes
      };
      if (background != null)
        scene.background = background;
      ctx3d.updateScene(scene);
    });
    return import_react6.default.createElement(SceneCtx.Provider, { value: ctxRef.current }, children);
  }
  function useRegister(type, data) {
    const ctx = import_react6.useContext(SceneCtx);
    if (!ctx)
      throw new Error(`@velox/three: <${type}> must be a descendant of <Scene>`);
    ctx.register(type, data);
  }
  function PerspectiveCamera({
    position = [0, 1, 5],
    target = [0, 0, 0],
    up = [0, 1, 0],
    fov = 60,
    near = 0.1,
    far = 1000
  }) {
    useRegister("camera", { position, target, up, fovDeg: fov, near, far });
    return null;
  }
  function AmbientLight({ color = [1, 1, 1], intensity = 0.3 }) {
    useRegister("light", { type: "ambient", color, intensity });
    return null;
  }
  function DirectionalLight({
    direction = [-0.5, -1, -0.5],
    color = [1, 1, 1],
    intensity = 1
  }) {
    useRegister("light", { type: "directional", direction, color, intensity });
    return null;
  }
  var IDENTITY_MAT = [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  ];
  function buildTransform(position, rotation, scale) {
    if (!position && !rotation && scale == null)
      return IDENTITY_MAT;
    const [tx = 0, ty = 0, tz = 0] = position ?? [0, 0, 0];
    const [rx = 0, ry = 0, rz = 0] = rotation ?? [0, 0, 0];
    const [sx = 1, sy = 1, sz = 1] = typeof scale === "number" ? [scale, scale, scale] : scale ?? [1, 1, 1];
    const cx = Math.cos(rx), sx_ = Math.sin(rx);
    const cy = Math.cos(ry), sy_ = Math.sin(ry);
    const cz = Math.cos(rz), sz_ = Math.sin(rz);
    const r00 = cy * cz;
    const r01 = cy * sz_;
    const r02 = -sy_;
    const r10 = sx_ * sy_ * cz - cx * sz_;
    const r11 = sx_ * sy_ * sz_ + cx * cz;
    const r12 = sx_ * cy;
    const r20 = cx * sy_ * cz + sx_ * sz_;
    const r21 = cx * sy_ * sz_ - sx_ * cz;
    const r22 = cx * cy;
    return [
      r00 * sx,
      r10 * sx,
      r20 * sx,
      0,
      r01 * sy,
      r11 * sy,
      r21 * sy,
      0,
      r02 * sz,
      r12 * sz,
      r22 * sz,
      0,
      tx,
      ty,
      tz,
      1
    ];
  }
  function Mesh({
    geometry = "box",
    color = [1, 1, 1, 1],
    position,
    rotation,
    scale,
    transform
  }) {
    const finalTransform = transform ?? buildTransform(position, rotation, scale);
    useRegister("mesh", {
      geometry: { type: geometry.toLowerCase() },
      transform: finalTransform,
      color
    });
    return null;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/entity.js
  var entityKind = Symbol.for("drizzle:entityKind");
  var hasOwnEntityKind = Symbol.for("drizzle:hasOwnEntityKind");
  function is(value, type) {
    if (!value || typeof value !== "object") {
      return false;
    }
    if (value instanceof type) {
      return true;
    }
    if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
      throw new Error(`Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`);
    }
    let cls = Object.getPrototypeOf(value).constructor;
    if (cls) {
      while (cls) {
        if (entityKind in cls && cls[entityKind] === type[entityKind]) {
          return true;
        }
        cls = Object.getPrototypeOf(cls);
      }
    }
    return false;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/logger.js
  class ConsoleLogWriter {
    static [entityKind] = "ConsoleLogWriter";
    write(message) {
      console.log(message);
    }
  }

  class DefaultLogger {
    static [entityKind] = "DefaultLogger";
    writer;
    constructor(config) {
      this.writer = config?.writer ?? new ConsoleLogWriter;
    }
    logQuery(query, params) {
      const stringifiedParams = params.map((p) => {
        try {
          return JSON.stringify(p);
        } catch {
          return String(p);
        }
      });
      const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
      this.writer.write(`Query: ${query}${paramsStr}`);
    }
  }

  class NoopLogger {
    static [entityKind] = "NoopLogger";
    logQuery() {}
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/table.utils.js
  var TableName = Symbol.for("drizzle:Name");

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/table.js
  var Schema = Symbol.for("drizzle:Schema");
  var Columns = Symbol.for("drizzle:Columns");
  var ExtraConfigColumns = Symbol.for("drizzle:ExtraConfigColumns");
  var OriginalName = Symbol.for("drizzle:OriginalName");
  var BaseName = Symbol.for("drizzle:BaseName");
  var IsAlias = Symbol.for("drizzle:IsAlias");
  var ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
  var IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");

  class Table {
    static [entityKind] = "Table";
    static Symbol = {
      Name: TableName,
      Schema,
      OriginalName,
      Columns,
      ExtraConfigColumns,
      BaseName,
      IsAlias,
      ExtraConfigBuilder
    };
    [TableName];
    [OriginalName];
    [Schema];
    [Columns];
    [ExtraConfigColumns];
    [BaseName];
    [IsAlias] = false;
    [IsDrizzleTable] = true;
    [ExtraConfigBuilder] = undefined;
    constructor(name, schema, baseName) {
      this[TableName] = this[OriginalName] = name;
      this[Schema] = schema;
      this[BaseName] = baseName;
    }
  }
  function getTableName(table) {
    return table[TableName];
  }
  function getTableUniqueName(table) {
    return `${table[Schema] ?? "public"}.${table[TableName]}`;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/column.js
  class Column {
    constructor(table, config) {
      this.table = table;
      this.config = config;
      this.name = config.name;
      this.keyAsName = config.keyAsName;
      this.notNull = config.notNull;
      this.default = config.default;
      this.defaultFn = config.defaultFn;
      this.onUpdateFn = config.onUpdateFn;
      this.hasDefault = config.hasDefault;
      this.primary = config.primaryKey;
      this.isUnique = config.isUnique;
      this.uniqueName = config.uniqueName;
      this.uniqueType = config.uniqueType;
      this.dataType = config.dataType;
      this.columnType = config.columnType;
      this.generated = config.generated;
      this.generatedIdentity = config.generatedIdentity;
    }
    static [entityKind] = "Column";
    name;
    keyAsName;
    primary;
    notNull;
    default;
    defaultFn;
    onUpdateFn;
    hasDefault;
    isUnique;
    uniqueName;
    uniqueType;
    dataType;
    columnType;
    enumValues = undefined;
    generated = undefined;
    generatedIdentity = undefined;
    config;
    mapFromDriverValue(value) {
      return value;
    }
    mapToDriverValue(value) {
      return value;
    }
    shouldDisableInsert() {
      return this.config.generated !== undefined && this.config.generated.type !== "byDefault";
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/column-builder.js
  class ColumnBuilder {
    static [entityKind] = "ColumnBuilder";
    config;
    constructor(name, dataType, columnType) {
      this.config = {
        name,
        keyAsName: name === "",
        notNull: false,
        default: undefined,
        hasDefault: false,
        primaryKey: false,
        isUnique: false,
        uniqueName: undefined,
        uniqueType: undefined,
        dataType,
        columnType,
        generated: undefined
      };
    }
    $type() {
      return this;
    }
    notNull() {
      this.config.notNull = true;
      return this;
    }
    default(value) {
      this.config.default = value;
      this.config.hasDefault = true;
      return this;
    }
    $defaultFn(fn) {
      this.config.defaultFn = fn;
      this.config.hasDefault = true;
      return this;
    }
    $default = this.$defaultFn;
    $onUpdateFn(fn) {
      this.config.onUpdateFn = fn;
      this.config.hasDefault = true;
      return this;
    }
    $onUpdate = this.$onUpdateFn;
    primaryKey() {
      this.config.primaryKey = true;
      this.config.notNull = true;
      return this;
    }
    setName(name) {
      if (this.config.name !== "")
        return;
      this.config.name = name;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/tracing-utils.js
  function iife(fn, ...args) {
    return fn(...args);
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/pg-core/unique-constraint.js
  function uniqueKeyName(table, columns) {
    return `${table[TableName]}_${columns.join("_")}_unique`;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/pg-core/columns/common.js
  class PgColumn extends Column {
    constructor(table, config) {
      if (!config.uniqueName) {
        config.uniqueName = uniqueKeyName(table, [config.name]);
      }
      super(table, config);
      this.table = table;
    }
    static [entityKind] = "PgColumn";
  }

  class ExtraConfigColumn extends PgColumn {
    static [entityKind] = "ExtraConfigColumn";
    getSQLType() {
      return this.getSQLType();
    }
    indexConfig = {
      order: this.config.order ?? "asc",
      nulls: this.config.nulls ?? "last",
      opClass: this.config.opClass
    };
    defaultConfig = {
      order: "asc",
      nulls: "last",
      opClass: undefined
    };
    asc() {
      this.indexConfig.order = "asc";
      return this;
    }
    desc() {
      this.indexConfig.order = "desc";
      return this;
    }
    nullsFirst() {
      this.indexConfig.nulls = "first";
      return this;
    }
    nullsLast() {
      this.indexConfig.nulls = "last";
      return this;
    }
    op(opClass) {
      this.indexConfig.opClass = opClass;
      return this;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/pg-core/columns/enum.js
  var isPgEnumSym = Symbol.for("drizzle:isPgEnum");
  function isPgEnum(obj) {
    return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
  }
  class PgEnumColumn extends PgColumn {
    static [entityKind] = "PgEnumColumn";
    enum = this.config.enum;
    enumValues = this.config.enum.enumValues;
    constructor(table, config) {
      super(table, config);
      this.enum = config.enum;
    }
    getSQLType() {
      return this.enum.enumName;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/subquery.js
  class Subquery {
    static [entityKind] = "Subquery";
    constructor(sql, selection, alias, isWith = false) {
      this._ = {
        brand: "Subquery",
        sql,
        selectedFields: selection,
        alias,
        isWith
      };
    }
  }

  class WithSubquery extends Subquery {
    static [entityKind] = "WithSubquery";
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/version.js
  var version = "0.36.4";

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/tracing.js
  var otel;
  var rawTracer;
  var tracer = {
    startActiveSpan(name, fn) {
      if (!otel) {
        return fn();
      }
      if (!rawTracer) {
        rawTracer = otel.trace.getTracer("drizzle-orm", version);
      }
      return iife((otel2, rawTracer2) => rawTracer2.startActiveSpan(name, (span) => {
        try {
          return fn(span);
        } catch (e) {
          span.setStatus({
            code: otel2.SpanStatusCode.ERROR,
            message: e instanceof Error ? e.message : "Unknown error"
          });
          throw e;
        } finally {
          span.end();
        }
      }), otel, rawTracer);
    }
  };

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/view-common.js
  var ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sql/sql.js
  function isSQLWrapper(value) {
    return value !== null && value !== undefined && typeof value.getSQL === "function";
  }
  function mergeQueries(queries) {
    const result = { sql: "", params: [] };
    for (const query of queries) {
      result.sql += query.sql;
      result.params.push(...query.params);
      if (query.typings?.length) {
        if (!result.typings) {
          result.typings = [];
        }
        result.typings.push(...query.typings);
      }
    }
    return result;
  }

  class StringChunk {
    static [entityKind] = "StringChunk";
    value;
    constructor(value) {
      this.value = Array.isArray(value) ? value : [value];
    }
    getSQL() {
      return new SQL([this]);
    }
  }

  class SQL {
    constructor(queryChunks) {
      this.queryChunks = queryChunks;
    }
    static [entityKind] = "SQL";
    decoder = noopDecoder;
    shouldInlineParams = false;
    append(query) {
      this.queryChunks.push(...query.queryChunks);
      return this;
    }
    toQuery(config) {
      return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
        const query = this.buildQueryFromSourceParams(this.queryChunks, config);
        span?.setAttributes({
          "drizzle.query.text": query.sql,
          "drizzle.query.params": JSON.stringify(query.params)
        });
        return query;
      });
    }
    buildQueryFromSourceParams(chunks, _config) {
      const config = Object.assign({}, _config, {
        inlineParams: _config.inlineParams || this.shouldInlineParams,
        paramStartIndex: _config.paramStartIndex || { value: 0 }
      });
      const {
        casing,
        escapeName,
        escapeParam,
        prepareTyping,
        inlineParams,
        paramStartIndex
      } = config;
      return mergeQueries(chunks.map((chunk) => {
        if (is(chunk, StringChunk)) {
          return { sql: chunk.value.join(""), params: [] };
        }
        if (is(chunk, Name)) {
          return { sql: escapeName(chunk.value), params: [] };
        }
        if (chunk === undefined) {
          return { sql: "", params: [] };
        }
        if (Array.isArray(chunk)) {
          const result = [new StringChunk("(")];
          for (const [i, p] of chunk.entries()) {
            result.push(p);
            if (i < chunk.length - 1) {
              result.push(new StringChunk(", "));
            }
          }
          result.push(new StringChunk(")"));
          return this.buildQueryFromSourceParams(result, config);
        }
        if (is(chunk, SQL)) {
          return this.buildQueryFromSourceParams(chunk.queryChunks, {
            ...config,
            inlineParams: inlineParams || chunk.shouldInlineParams
          });
        }
        if (is(chunk, Table)) {
          const schemaName = chunk[Table.Symbol.Schema];
          const tableName = chunk[Table.Symbol.Name];
          return {
            sql: schemaName === undefined ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
            params: []
          };
        }
        if (is(chunk, Column)) {
          const columnName = casing.getColumnCasing(chunk);
          if (_config.invokeSource === "indexes") {
            return { sql: escapeName(columnName), params: [] };
          }
          const schemaName = chunk.table[Table.Symbol.Schema];
          return {
            sql: chunk.table[IsAlias] || schemaName === undefined ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
            params: []
          };
        }
        if (is(chunk, View2)) {
          const schemaName = chunk[ViewBaseConfig].schema;
          const viewName = chunk[ViewBaseConfig].name;
          return {
            sql: schemaName === undefined ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
            params: []
          };
        }
        if (is(chunk, Param)) {
          if (is(chunk.value, Placeholder)) {
            return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
          }
          const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
          if (is(mappedValue, SQL)) {
            return this.buildQueryFromSourceParams([mappedValue], config);
          }
          if (inlineParams) {
            return { sql: this.mapInlineParam(mappedValue, config), params: [] };
          }
          let typings = ["none"];
          if (prepareTyping) {
            typings = [prepareTyping(chunk.encoder)];
          }
          return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
        }
        if (is(chunk, Placeholder)) {
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }
        if (is(chunk, SQL.Aliased) && chunk.fieldAlias !== undefined) {
          return { sql: escapeName(chunk.fieldAlias), params: [] };
        }
        if (is(chunk, Subquery)) {
          if (chunk._.isWith) {
            return { sql: escapeName(chunk._.alias), params: [] };
          }
          return this.buildQueryFromSourceParams([
            new StringChunk("("),
            chunk._.sql,
            new StringChunk(") "),
            new Name(chunk._.alias)
          ], config);
        }
        if (isPgEnum(chunk)) {
          if (chunk.schema) {
            return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
          }
          return { sql: escapeName(chunk.enumName), params: [] };
        }
        if (isSQLWrapper(chunk)) {
          if (chunk.shouldOmitSQLParens?.()) {
            return this.buildQueryFromSourceParams([chunk.getSQL()], config);
          }
          return this.buildQueryFromSourceParams([
            new StringChunk("("),
            chunk.getSQL(),
            new StringChunk(")")
          ], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(chunk, config), params: [] };
        }
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }));
    }
    mapInlineParam(chunk, { escapeString }) {
      if (chunk === null) {
        return "null";
      }
      if (typeof chunk === "number" || typeof chunk === "boolean") {
        return chunk.toString();
      }
      if (typeof chunk === "string") {
        return escapeString(chunk);
      }
      if (typeof chunk === "object") {
        const mappedValueAsString = chunk.toString();
        if (mappedValueAsString === "[object Object]") {
          return escapeString(JSON.stringify(chunk));
        }
        return escapeString(mappedValueAsString);
      }
      throw new Error("Unexpected param value: " + chunk);
    }
    getSQL() {
      return this;
    }
    as(alias) {
      if (alias === undefined) {
        return this;
      }
      return new SQL.Aliased(this, alias);
    }
    mapWith(decoder) {
      this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
      return this;
    }
    inlineParams() {
      this.shouldInlineParams = true;
      return this;
    }
    if(condition) {
      return condition ? this : undefined;
    }
  }

  class Name {
    constructor(value) {
      this.value = value;
    }
    static [entityKind] = "Name";
    brand;
    getSQL() {
      return new SQL([this]);
    }
  }
  function isDriverValueEncoder(value) {
    return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
  }
  var noopDecoder = {
    mapFromDriverValue: (value) => value
  };
  var noopEncoder = {
    mapToDriverValue: (value) => value
  };
  var noopMapper = {
    ...noopDecoder,
    ...noopEncoder
  };

  class Param {
    constructor(value, encoder = noopEncoder) {
      this.value = value;
      this.encoder = encoder;
    }
    static [entityKind] = "Param";
    brand;
    getSQL() {
      return new SQL([this]);
    }
  }
  function sql(strings, ...params) {
    const queryChunks = [];
    if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
      queryChunks.push(new StringChunk(strings[0]));
    }
    for (const [paramIndex, param2] of params.entries()) {
      queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
    }
    return new SQL(queryChunks);
  }
  ((sql2) => {
    function empty() {
      return new SQL([]);
    }
    sql2.empty = empty;
    function fromList(list) {
      return new SQL(list);
    }
    sql2.fromList = fromList;
    function raw(str) {
      return new SQL([new StringChunk(str)]);
    }
    sql2.raw = raw;
    function join(chunks, separator) {
      const result = [];
      for (const [i, chunk] of chunks.entries()) {
        if (i > 0 && separator !== undefined) {
          result.push(separator);
        }
        result.push(chunk);
      }
      return new SQL(result);
    }
    sql2.join = join;
    function identifier(value) {
      return new Name(value);
    }
    sql2.identifier = identifier;
    function placeholder2(name2) {
      return new Placeholder(name2);
    }
    sql2.placeholder = placeholder2;
    function param2(value, encoder) {
      return new Param(value, encoder);
    }
    sql2.param = param2;
  })(sql || (sql = {}));
  ((SQL2) => {

    class Aliased {
      constructor(sql2, fieldAlias) {
        this.sql = sql2;
        this.fieldAlias = fieldAlias;
      }
      static [entityKind] = "SQL.Aliased";
      isSelectionField = false;
      getSQL() {
        return this.sql;
      }
      clone() {
        return new Aliased(this.sql, this.fieldAlias);
      }
    }
    SQL2.Aliased = Aliased;
  })(SQL || (SQL = {}));

  class Placeholder {
    constructor(name2) {
      this.name = name2;
    }
    static [entityKind] = "Placeholder";
    getSQL() {
      return new SQL([this]);
    }
  }
  function fillPlaceholders(params, values) {
    return params.map((p) => {
      if (is(p, Placeholder)) {
        if (!(p.name in values)) {
          throw new Error(`No value for placeholder "${p.name}" was provided`);
        }
        return values[p.name];
      }
      if (is(p, Param) && is(p.value, Placeholder)) {
        if (!(p.value.name in values)) {
          throw new Error(`No value for placeholder "${p.value.name}" was provided`);
        }
        return p.encoder.mapToDriverValue(values[p.value.name]);
      }
      return p;
    });
  }

  class View2 {
    static [entityKind] = "View";
    [ViewBaseConfig];
    constructor({ name: name2, schema, selectedFields, query }) {
      this[ViewBaseConfig] = {
        name: name2,
        originalName: name2,
        schema,
        selectedFields,
        query,
        isExisting: !query,
        isAlias: false
      };
    }
    getSQL() {
      return new SQL([this]);
    }
  }
  Column.prototype.getSQL = function() {
    return new SQL([this]);
  };
  Table.prototype.getSQL = function() {
    return new SQL([this]);
  };
  Subquery.prototype.getSQL = function() {
    return new SQL([this]);
  };

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/utils.js
  function mapResultRow(columns, row, joinsNotNullableMap) {
    const nullifyMap = {};
    const result = columns.reduce((result2, { path, field }, columnIndex) => {
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    }, {});
    if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
      for (const [objectName, tableName] of Object.entries(nullifyMap)) {
        if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
          result[objectName] = null;
        }
      }
    }
    return result;
  }
  function orderSelectedFields(fields, pathPrefix) {
    return Object.entries(fields).reduce((result, [name, field]) => {
      if (typeof name !== "string") {
        return result;
      }
      const newPath = pathPrefix ? [...pathPrefix, name] : [name];
      if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased)) {
        result.push({ path: newPath, field });
      } else if (is(field, Table)) {
        result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
      } else {
        result.push(...orderSelectedFields(field, newPath));
      }
      return result;
    }, []);
  }
  function haveSameKeys(left, right) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const [index, key] of leftKeys.entries()) {
      if (key !== rightKeys[index]) {
        return false;
      }
    }
    return true;
  }
  function mapUpdateSet(table, values) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => {
      if (is(value, SQL) || is(value, Column)) {
        return [key, value];
      } else {
        return [key, new Param(value, table[Table.Symbol.Columns][key])];
      }
    });
    if (entries.length === 0) {
      throw new Error("No values to set");
    }
    return Object.fromEntries(entries);
  }
  function applyMixins(baseClass, extendedClasses) {
    for (const extendedClass of extendedClasses) {
      for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
        if (name === "constructor")
          continue;
        Object.defineProperty(baseClass.prototype, name, Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null));
      }
    }
  }
  function getTableColumns(table) {
    return table[Table.Symbol.Columns];
  }
  function getTableLikeName(table) {
    return is(table, Subquery) ? table._.alias : is(table, View2) ? table[ViewBaseConfig].name : is(table, SQL) ? undefined : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
  }
  function getColumnNameAndConfig(a, b) {
    return {
      name: typeof a === "string" && a.length > 0 ? a : "",
      config: typeof a === "object" ? a : b
    };
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/pg-core/table.js
  var InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
  var EnableRLS = Symbol.for("drizzle:EnableRLS");

  class PgTable extends Table {
    static [entityKind] = "PgTable";
    static Symbol = Object.assign({}, Table.Symbol, {
      InlineForeignKeys,
      EnableRLS
    });
    [InlineForeignKeys] = [];
    [EnableRLS] = false;
    [Table.Symbol.ExtraConfigBuilder] = undefined;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/pg-core/primary-keys.js
  class PrimaryKeyBuilder {
    static [entityKind] = "PgPrimaryKeyBuilder";
    columns;
    name;
    constructor(columns, name) {
      this.columns = columns;
      this.name = name;
    }
    build(table) {
      return new PrimaryKey(table, this.columns, this.name);
    }
  }

  class PrimaryKey {
    constructor(table, columns, name) {
      this.table = table;
      this.columns = columns;
      this.name = name;
    }
    static [entityKind] = "PgPrimaryKey";
    columns;
    name;
    getName() {
      return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sql/expressions/conditions.js
  function bindIfParam(value, column) {
    if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View2)) {
      return new Param(value, column);
    }
    return value;
  }
  var eq = (left, right) => {
    return sql`${left} = ${bindIfParam(right, left)}`;
  };
  var ne = (left, right) => {
    return sql`${left} <> ${bindIfParam(right, left)}`;
  };
  function and(...unfilteredConditions) {
    const conditions = unfilteredConditions.filter((c) => c !== undefined);
    if (conditions.length === 0) {
      return;
    }
    if (conditions.length === 1) {
      return new SQL(conditions);
    }
    return new SQL([
      new StringChunk("("),
      sql.join(conditions, new StringChunk(" and ")),
      new StringChunk(")")
    ]);
  }
  function or(...unfilteredConditions) {
    const conditions = unfilteredConditions.filter((c) => c !== undefined);
    if (conditions.length === 0) {
      return;
    }
    if (conditions.length === 1) {
      return new SQL(conditions);
    }
    return new SQL([
      new StringChunk("("),
      sql.join(conditions, new StringChunk(" or ")),
      new StringChunk(")")
    ]);
  }
  function not(condition) {
    return sql`not ${condition}`;
  }
  var gt = (left, right) => {
    return sql`${left} > ${bindIfParam(right, left)}`;
  };
  var gte = (left, right) => {
    return sql`${left} >= ${bindIfParam(right, left)}`;
  };
  var lt = (left, right) => {
    return sql`${left} < ${bindIfParam(right, left)}`;
  };
  var lte = (left, right) => {
    return sql`${left} <= ${bindIfParam(right, left)}`;
  };
  function inArray(column, values) {
    if (Array.isArray(values)) {
      if (values.length === 0) {
        return sql`false`;
      }
      return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
    }
    return sql`${column} in ${bindIfParam(values, column)}`;
  }
  function notInArray(column, values) {
    if (Array.isArray(values)) {
      if (values.length === 0) {
        return sql`true`;
      }
      return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
    }
    return sql`${column} not in ${bindIfParam(values, column)}`;
  }
  function isNull(value) {
    return sql`${value} is null`;
  }
  function isNotNull(value) {
    return sql`${value} is not null`;
  }
  function exists(subquery) {
    return sql`exists ${subquery}`;
  }
  function notExists(subquery) {
    return sql`not exists ${subquery}`;
  }
  function between(column, min, max) {
    return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(max, column)}`;
  }
  function notBetween(column, min, max) {
    return sql`${column} not between ${bindIfParam(min, column)} and ${bindIfParam(max, column)}`;
  }
  function like(column, value) {
    return sql`${column} like ${value}`;
  }
  function notLike(column, value) {
    return sql`${column} not like ${value}`;
  }
  function ilike(column, value) {
    return sql`${column} ilike ${value}`;
  }
  function notIlike(column, value) {
    return sql`${column} not ilike ${value}`;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sql/expressions/select.js
  function asc(column) {
    return sql`${column} asc`;
  }
  function desc(column) {
    return sql`${column} desc`;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/relations.js
  class Relation {
    constructor(sourceTable, referencedTable, relationName) {
      this.sourceTable = sourceTable;
      this.referencedTable = referencedTable;
      this.relationName = relationName;
      this.referencedTableName = referencedTable[Table.Symbol.Name];
    }
    static [entityKind] = "Relation";
    referencedTableName;
    fieldName;
  }

  class Relations {
    constructor(table, config) {
      this.table = table;
      this.config = config;
    }
    static [entityKind] = "Relations";
  }

  class One extends Relation {
    constructor(sourceTable, referencedTable, config, isNullable) {
      super(sourceTable, referencedTable, config?.relationName);
      this.config = config;
      this.isNullable = isNullable;
    }
    static [entityKind] = "One";
    withFieldName(fieldName) {
      const relation = new One(this.sourceTable, this.referencedTable, this.config, this.isNullable);
      relation.fieldName = fieldName;
      return relation;
    }
  }

  class Many extends Relation {
    constructor(sourceTable, referencedTable, config) {
      super(sourceTable, referencedTable, config?.relationName);
      this.config = config;
    }
    static [entityKind] = "Many";
    withFieldName(fieldName) {
      const relation = new Many(this.sourceTable, this.referencedTable, this.config);
      relation.fieldName = fieldName;
      return relation;
    }
  }
  function getOperators() {
    return {
      and,
      between,
      eq,
      exists,
      gt,
      gte,
      ilike,
      inArray,
      isNull,
      isNotNull,
      like,
      lt,
      lte,
      ne,
      not,
      notBetween,
      notExists,
      notLike,
      notIlike,
      notInArray,
      or,
      sql
    };
  }
  function getOrderByOperators() {
    return {
      sql,
      asc,
      desc
    };
  }
  function extractTablesRelationalConfig(schema, configHelpers) {
    if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) {
      schema = schema["default"];
    }
    const tableNamesMap = {};
    const relationsBuffer = {};
    const tablesConfig = {};
    for (const [key, value] of Object.entries(schema)) {
      if (is(value, Table)) {
        const dbName = getTableUniqueName(value);
        const bufferedRelations = relationsBuffer[dbName];
        tableNamesMap[dbName] = key;
        tablesConfig[key] = {
          tsName: key,
          dbName: value[Table.Symbol.Name],
          schema: value[Table.Symbol.Schema],
          columns: value[Table.Symbol.Columns],
          relations: bufferedRelations?.relations ?? {},
          primaryKey: bufferedRelations?.primaryKey ?? []
        };
        for (const column of Object.values(value[Table.Symbol.Columns])) {
          if (column.primary) {
            tablesConfig[key].primaryKey.push(column);
          }
        }
        const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
        if (extraConfig) {
          for (const configEntry of Object.values(extraConfig)) {
            if (is(configEntry, PrimaryKeyBuilder)) {
              tablesConfig[key].primaryKey.push(...configEntry.columns);
            }
          }
        }
      } else if (is(value, Relations)) {
        const dbName = getTableUniqueName(value.table);
        const tableName = tableNamesMap[dbName];
        const relations2 = value.config(configHelpers(value.table));
        let primaryKey;
        for (const [relationName, relation] of Object.entries(relations2)) {
          if (tableName) {
            const tableConfig = tablesConfig[tableName];
            tableConfig.relations[relationName] = relation;
            if (primaryKey) {
              tableConfig.primaryKey.push(...primaryKey);
            }
          } else {
            if (!(dbName in relationsBuffer)) {
              relationsBuffer[dbName] = {
                relations: {},
                primaryKey
              };
            }
            relationsBuffer[dbName].relations[relationName] = relation;
          }
        }
      }
    }
    return { tables: tablesConfig, tableNamesMap };
  }
  function createOne(sourceTable) {
    return function one(table, config) {
      return new One(sourceTable, table, config, config?.fields.reduce((res, f) => res && f.notNull, true) ?? false);
    };
  }
  function createMany(sourceTable) {
    return function many(referencedTable, config) {
      return new Many(sourceTable, referencedTable, config);
    };
  }
  function normalizeRelation(schema, tableNamesMap, relation) {
    if (is(relation, One) && relation.config) {
      return {
        fields: relation.config.fields,
        references: relation.config.references
      };
    }
    const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
    if (!referencedTableTsName) {
      throw new Error(`Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`);
    }
    const referencedTableConfig = schema[referencedTableTsName];
    if (!referencedTableConfig) {
      throw new Error(`Table "${referencedTableTsName}" not found in schema`);
    }
    const sourceTable = relation.sourceTable;
    const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
    if (!sourceTableTsName) {
      throw new Error(`Table "${sourceTable[Table.Symbol.Name]}" not found in schema`);
    }
    const reverseRelations = [];
    for (const referencedTableRelation of Object.values(referencedTableConfig.relations)) {
      if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
        reverseRelations.push(referencedTableRelation);
      }
    }
    if (reverseRelations.length > 1) {
      throw relation.relationName ? new Error(`There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`) : new Error(`There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`);
    }
    if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
      return {
        fields: reverseRelations[0].config.references,
        references: reverseRelations[0].config.fields
      };
    }
    throw new Error(`There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`);
  }
  function createTableRelationsHelpers(sourceTable) {
    return {
      one: createOne(sourceTable),
      many: createMany(sourceTable)
    };
  }
  function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
    const result = {};
    for (const [
      selectionItemIndex,
      selectionItem
    ] of buildQueryResultSelection.entries()) {
      if (selectionItem.isJson) {
        const relation = tableConfig.relations[selectionItem.tsKey];
        const rawSubRows = row[selectionItemIndex];
        const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
        result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(tablesConfig, tablesConfig[selectionItem.relationTableTsKey], subRows, selectionItem.selection, mapColumnValue) : subRows.map((subRow) => mapRelationalRow(tablesConfig, tablesConfig[selectionItem.relationTableTsKey], subRow, selectionItem.selection, mapColumnValue));
      } else {
        const value = mapColumnValue(row[selectionItemIndex]);
        const field = selectionItem.field;
        let decoder;
        if (is(field, Column)) {
          decoder = field;
        } else if (is(field, SQL)) {
          decoder = field.decoder;
        } else {
          decoder = field.sql.decoder;
        }
        result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
      }
    }
    return result;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/alias.js
  class ColumnAliasProxyHandler {
    constructor(table) {
      this.table = table;
    }
    static [entityKind] = "ColumnAliasProxyHandler";
    get(columnObj, prop) {
      if (prop === "table") {
        return this.table;
      }
      return columnObj[prop];
    }
  }

  class TableAliasProxyHandler {
    constructor(alias, replaceOriginalName) {
      this.alias = alias;
      this.replaceOriginalName = replaceOriginalName;
    }
    static [entityKind] = "TableAliasProxyHandler";
    get(target, prop) {
      if (prop === Table.Symbol.IsAlias) {
        return true;
      }
      if (prop === Table.Symbol.Name) {
        return this.alias;
      }
      if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
        return this.alias;
      }
      if (prop === ViewBaseConfig) {
        return {
          ...target[ViewBaseConfig],
          name: this.alias,
          isAlias: true
        };
      }
      if (prop === Table.Symbol.Columns) {
        const columns = target[Table.Symbol.Columns];
        if (!columns) {
          return columns;
        }
        const proxiedColumns = {};
        Object.keys(columns).map((key) => {
          proxiedColumns[key] = new Proxy(columns[key], new ColumnAliasProxyHandler(new Proxy(target, this)));
        });
        return proxiedColumns;
      }
      const value = target[prop];
      if (is(value, Column)) {
        return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
      }
      return value;
    }
  }
  function aliasedTable(table, tableAlias) {
    return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
  }
  function aliasedTableColumn(column, tableAlias) {
    return new Proxy(column, new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false))));
  }
  function mapColumnsInAliasedSQLToAlias(query, alias) {
    return new SQL.Aliased(mapColumnsInSQLToAlias(query.sql, alias), query.fieldAlias);
  }
  function mapColumnsInSQLToAlias(query, alias) {
    return sql.join(query.queryChunks.map((c) => {
      if (is(c, Column)) {
        return aliasedTableColumn(c, alias);
      }
      if (is(c, SQL)) {
        return mapColumnsInSQLToAlias(c, alias);
      }
      if (is(c, SQL.Aliased)) {
        return mapColumnsInAliasedSQLToAlias(c, alias);
      }
      return c;
    }));
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/selection-proxy.js
  class SelectionProxyHandler {
    static [entityKind] = "SelectionProxyHandler";
    config;
    constructor(config) {
      this.config = { ...config };
    }
    get(subquery, prop) {
      if (prop === "_") {
        return {
          ...subquery["_"],
          selectedFields: new Proxy(subquery._.selectedFields, this)
        };
      }
      if (prop === ViewBaseConfig) {
        return {
          ...subquery[ViewBaseConfig],
          selectedFields: new Proxy(subquery[ViewBaseConfig].selectedFields, this)
        };
      }
      if (typeof prop === "symbol") {
        return subquery[prop];
      }
      const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View2) ? subquery[ViewBaseConfig].selectedFields : subquery;
      const value = columns[prop];
      if (is(value, SQL.Aliased)) {
        if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
          return value.sql;
        }
        const newValue = value.clone();
        newValue.isSelectionField = true;
        return newValue;
      }
      if (is(value, SQL)) {
        if (this.config.sqlBehavior === "sql") {
          return value;
        }
        throw new Error(`You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`);
      }
      if (is(value, Column)) {
        if (this.config.alias) {
          return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(value.table, new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false))));
        }
        return value;
      }
      if (typeof value !== "object" || value === null) {
        return value;
      }
      return new Proxy(value, new SelectionProxyHandler(this.config));
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/query-promise.js
  class QueryPromise {
    static [entityKind] = "QueryPromise";
    [Symbol.toStringTag] = "QueryPromise";
    catch(onRejected) {
      return this.then(undefined, onRejected);
    }
    finally(onFinally) {
      return this.then((value) => {
        onFinally?.();
        return value;
      }, (reason) => {
        onFinally?.();
        throw reason;
      });
    }
    then(onFulfilled, onRejected) {
      return this.execute().then(onFulfilled, onRejected);
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/foreign-keys.js
  class ForeignKeyBuilder {
    static [entityKind] = "SQLiteForeignKeyBuilder";
    reference;
    _onUpdate;
    _onDelete;
    constructor(config, actions) {
      this.reference = () => {
        const { name, columns, foreignColumns } = config();
        return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
      };
      if (actions) {
        this._onUpdate = actions.onUpdate;
        this._onDelete = actions.onDelete;
      }
    }
    onUpdate(action) {
      this._onUpdate = action;
      return this;
    }
    onDelete(action) {
      this._onDelete = action;
      return this;
    }
    build(table) {
      return new ForeignKey(table, this);
    }
  }

  class ForeignKey {
    constructor(table, builder) {
      this.table = table;
      this.reference = builder.reference;
      this.onUpdate = builder._onUpdate;
      this.onDelete = builder._onDelete;
    }
    static [entityKind] = "SQLiteForeignKey";
    reference;
    onUpdate;
    onDelete;
    getName() {
      const { name, columns, foreignColumns } = this.reference();
      const columnNames = columns.map((column) => column.name);
      const foreignColumnNames = foreignColumns.map((column) => column.name);
      const chunks = [
        this.table[TableName],
        ...columnNames,
        foreignColumns[0].table[TableName],
        ...foreignColumnNames
      ];
      return name ?? `${chunks.join("_")}_fk`;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/unique-constraint.js
  function uniqueKeyName2(table, columns) {
    return `${table[TableName]}_${columns.join("_")}_unique`;
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/columns/common.js
  class SQLiteColumnBuilder extends ColumnBuilder {
    static [entityKind] = "SQLiteColumnBuilder";
    foreignKeyConfigs = [];
    references(ref, actions = {}) {
      this.foreignKeyConfigs.push({ ref, actions });
      return this;
    }
    unique(name) {
      this.config.isUnique = true;
      this.config.uniqueName = name;
      return this;
    }
    generatedAlwaysAs(as, config) {
      this.config.generated = {
        as,
        type: "always",
        mode: config?.mode ?? "virtual"
      };
      return this;
    }
    buildForeignKeys(column, table) {
      return this.foreignKeyConfigs.map(({ ref, actions }) => {
        return ((ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        })(ref, actions);
      });
    }
  }

  class SQLiteColumn extends Column {
    constructor(table, config) {
      if (!config.uniqueName) {
        config.uniqueName = uniqueKeyName2(table, [config.name]);
      }
      super(table, config);
      this.table = table;
    }
    static [entityKind] = "SQLiteColumn";
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/columns/blob.js
  class SQLiteBigIntBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteBigIntBuilder";
    constructor(name) {
      super(name, "bigint", "SQLiteBigInt");
    }
    build(table) {
      return new SQLiteBigInt(table, this.config);
    }
  }

  class SQLiteBigInt extends SQLiteColumn {
    static [entityKind] = "SQLiteBigInt";
    getSQLType() {
      return "blob";
    }
    mapFromDriverValue(value) {
      return BigInt(Buffer.isBuffer(value) ? value.toString() : String.fromCodePoint(...value));
    }
    mapToDriverValue(value) {
      return Buffer.from(value.toString());
    }
  }

  class SQLiteBlobJsonBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteBlobJsonBuilder";
    constructor(name) {
      super(name, "json", "SQLiteBlobJson");
    }
    build(table) {
      return new SQLiteBlobJson(table, this.config);
    }
  }

  class SQLiteBlobJson extends SQLiteColumn {
    static [entityKind] = "SQLiteBlobJson";
    getSQLType() {
      return "blob";
    }
    mapFromDriverValue(value) {
      return JSON.parse(Buffer.isBuffer(value) ? value.toString() : String.fromCodePoint(...value));
    }
    mapToDriverValue(value) {
      return Buffer.from(JSON.stringify(value));
    }
  }

  class SQLiteBlobBufferBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteBlobBufferBuilder";
    constructor(name) {
      super(name, "buffer", "SQLiteBlobBuffer");
    }
    build(table) {
      return new SQLiteBlobBuffer(table, this.config);
    }
  }

  class SQLiteBlobBuffer extends SQLiteColumn {
    static [entityKind] = "SQLiteBlobBuffer";
    getSQLType() {
      return "blob";
    }
  }
  function blob(a, b) {
    const { name, config } = getColumnNameAndConfig(a, b);
    if (config?.mode === "json") {
      return new SQLiteBlobJsonBuilder(name);
    }
    if (config?.mode === "bigint") {
      return new SQLiteBigIntBuilder(name);
    }
    return new SQLiteBlobBufferBuilder(name);
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/columns/custom.js
  class SQLiteCustomColumnBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteCustomColumnBuilder";
    constructor(name, fieldConfig, customTypeParams) {
      super(name, "custom", "SQLiteCustomColumn");
      this.config.fieldConfig = fieldConfig;
      this.config.customTypeParams = customTypeParams;
    }
    build(table) {
      return new SQLiteCustomColumn(table, this.config);
    }
  }

  class SQLiteCustomColumn extends SQLiteColumn {
    static [entityKind] = "SQLiteCustomColumn";
    sqlName;
    mapTo;
    mapFrom;
    constructor(table, config) {
      super(table, config);
      this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
      this.mapTo = config.customTypeParams.toDriver;
      this.mapFrom = config.customTypeParams.fromDriver;
    }
    getSQLType() {
      return this.sqlName;
    }
    mapFromDriverValue(value) {
      return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
    }
    mapToDriverValue(value) {
      return typeof this.mapTo === "function" ? this.mapTo(value) : value;
    }
  }
  function customType(customTypeParams) {
    return (a, b) => {
      const { name, config } = getColumnNameAndConfig(a, b);
      return new SQLiteCustomColumnBuilder(name, config, customTypeParams);
    };
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/columns/integer.js
  class SQLiteBaseIntegerBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteBaseIntegerBuilder";
    constructor(name, dataType, columnType) {
      super(name, dataType, columnType);
      this.config.autoIncrement = false;
    }
    primaryKey(config) {
      if (config?.autoIncrement) {
        this.config.autoIncrement = true;
      }
      this.config.hasDefault = true;
      return super.primaryKey();
    }
  }

  class SQLiteBaseInteger extends SQLiteColumn {
    static [entityKind] = "SQLiteBaseInteger";
    autoIncrement = this.config.autoIncrement;
    getSQLType() {
      return "integer";
    }
  }

  class SQLiteIntegerBuilder extends SQLiteBaseIntegerBuilder {
    static [entityKind] = "SQLiteIntegerBuilder";
    constructor(name) {
      super(name, "number", "SQLiteInteger");
    }
    build(table) {
      return new SQLiteInteger(table, this.config);
    }
  }

  class SQLiteInteger extends SQLiteBaseInteger {
    static [entityKind] = "SQLiteInteger";
  }

  class SQLiteTimestampBuilder extends SQLiteBaseIntegerBuilder {
    static [entityKind] = "SQLiteTimestampBuilder";
    constructor(name, mode) {
      super(name, "date", "SQLiteTimestamp");
      this.config.mode = mode;
    }
    defaultNow() {
      return this.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`);
    }
    build(table) {
      return new SQLiteTimestamp(table, this.config);
    }
  }

  class SQLiteTimestamp extends SQLiteBaseInteger {
    static [entityKind] = "SQLiteTimestamp";
    mode = this.config.mode;
    mapFromDriverValue(value) {
      if (this.config.mode === "timestamp") {
        return new Date(value * 1000);
      }
      return new Date(value);
    }
    mapToDriverValue(value) {
      const unix = value.getTime();
      if (this.config.mode === "timestamp") {
        return Math.floor(unix / 1000);
      }
      return unix;
    }
  }

  class SQLiteBooleanBuilder extends SQLiteBaseIntegerBuilder {
    static [entityKind] = "SQLiteBooleanBuilder";
    constructor(name, mode) {
      super(name, "boolean", "SQLiteBoolean");
      this.config.mode = mode;
    }
    build(table) {
      return new SQLiteBoolean(table, this.config);
    }
  }

  class SQLiteBoolean extends SQLiteBaseInteger {
    static [entityKind] = "SQLiteBoolean";
    mode = this.config.mode;
    mapFromDriverValue(value) {
      return Number(value) === 1;
    }
    mapToDriverValue(value) {
      return value ? 1 : 0;
    }
  }
  function integer(a, b) {
    const { name, config } = getColumnNameAndConfig(a, b);
    if (config?.mode === "timestamp" || config?.mode === "timestamp_ms") {
      return new SQLiteTimestampBuilder(name, config.mode);
    }
    if (config?.mode === "boolean") {
      return new SQLiteBooleanBuilder(name, config.mode);
    }
    return new SQLiteIntegerBuilder(name);
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/columns/numeric.js
  class SQLiteNumericBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteNumericBuilder";
    constructor(name) {
      super(name, "string", "SQLiteNumeric");
    }
    build(table) {
      return new SQLiteNumeric(table, this.config);
    }
  }

  class SQLiteNumeric extends SQLiteColumn {
    static [entityKind] = "SQLiteNumeric";
    getSQLType() {
      return "numeric";
    }
  }
  function numeric(name) {
    return new SQLiteNumericBuilder(name ?? "");
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/columns/real.js
  class SQLiteRealBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteRealBuilder";
    constructor(name) {
      super(name, "number", "SQLiteReal");
    }
    build(table) {
      return new SQLiteReal(table, this.config);
    }
  }

  class SQLiteReal extends SQLiteColumn {
    static [entityKind] = "SQLiteReal";
    getSQLType() {
      return "real";
    }
  }
  function real(name) {
    return new SQLiteRealBuilder(name ?? "");
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/columns/text.js
  class SQLiteTextBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteTextBuilder";
    constructor(name, config) {
      super(name, "string", "SQLiteText");
      this.config.enumValues = config.enum;
      this.config.length = config.length;
    }
    build(table) {
      return new SQLiteText(table, this.config);
    }
  }

  class SQLiteText extends SQLiteColumn {
    static [entityKind] = "SQLiteText";
    enumValues = this.config.enumValues;
    length = this.config.length;
    constructor(table, config) {
      super(table, config);
    }
    getSQLType() {
      return `text${this.config.length ? `(${this.config.length})` : ""}`;
    }
  }

  class SQLiteTextJsonBuilder extends SQLiteColumnBuilder {
    static [entityKind] = "SQLiteTextJsonBuilder";
    constructor(name) {
      super(name, "json", "SQLiteTextJson");
    }
    build(table) {
      return new SQLiteTextJson(table, this.config);
    }
  }

  class SQLiteTextJson extends SQLiteColumn {
    static [entityKind] = "SQLiteTextJson";
    getSQLType() {
      return "text";
    }
    mapFromDriverValue(value) {
      return JSON.parse(value);
    }
    mapToDriverValue(value) {
      return JSON.stringify(value);
    }
  }
  function text(a, b = {}) {
    const { name, config } = getColumnNameAndConfig(a, b);
    if (config.mode === "json") {
      return new SQLiteTextJsonBuilder(name);
    }
    return new SQLiteTextBuilder(name, config);
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/columns/all.js
  function getSQLiteColumnBuilders() {
    return {
      blob,
      customType,
      integer,
      numeric,
      real,
      text
    };
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/table.js
  var InlineForeignKeys2 = Symbol.for("drizzle:SQLiteInlineForeignKeys");

  class SQLiteTable extends Table {
    static [entityKind] = "SQLiteTable";
    static Symbol = Object.assign({}, Table.Symbol, {
      InlineForeignKeys: InlineForeignKeys2
    });
    [Table.Symbol.Columns];
    [InlineForeignKeys2] = [];
    [Table.Symbol.ExtraConfigBuilder] = undefined;
  }
  function sqliteTableBase(name, columns, extraConfig, schema, baseName = name) {
    const rawTable = new SQLiteTable(name, schema, baseName);
    const parsedColumns = typeof columns === "function" ? columns(getSQLiteColumnBuilders()) : columns;
    const builtColumns = Object.fromEntries(Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys2].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    }));
    const table = Object.assign(rawTable, builtColumns);
    table[Table.Symbol.Columns] = builtColumns;
    table[Table.Symbol.ExtraConfigColumns] = builtColumns;
    if (extraConfig) {
      table[SQLiteTable.Symbol.ExtraConfigBuilder] = extraConfig;
    }
    return table;
  }
  var sqliteTable = (name, columns, extraConfig) => {
    return sqliteTableBase(name, columns, extraConfig);
  };

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/query-builders/delete.js
  class SQLiteDeleteBase extends QueryPromise {
    constructor(table, session, dialect, withList) {
      super();
      this.table = table;
      this.session = session;
      this.dialect = dialect;
      this.config = { table, withList };
    }
    static [entityKind] = "SQLiteDelete";
    config;
    where(where) {
      this.config.where = where;
      return this;
    }
    orderBy(...columns) {
      if (typeof columns[0] === "function") {
        const orderBy = columns[0](new Proxy(this.config.table[Table.Symbol.Columns], new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })));
        const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
        this.config.orderBy = orderByArray;
      } else {
        const orderByArray = columns;
        this.config.orderBy = orderByArray;
      }
      return this;
    }
    limit(limit) {
      this.config.limit = limit;
      return this;
    }
    returning(fields = this.table[SQLiteTable.Symbol.Columns]) {
      this.config.returning = orderSelectedFields(fields);
      return this;
    }
    getSQL() {
      return this.dialect.buildDeleteQuery(this.config);
    }
    toSQL() {
      const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
      return rest;
    }
    _prepare(isOneTimeQuery = true) {
      return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](this.dialect.sqlToQuery(this.getSQL()), this.config.returning, this.config.returning ? "all" : "run", true);
    }
    prepare() {
      return this._prepare(false);
    }
    run = (placeholderValues) => {
      return this._prepare().run(placeholderValues);
    };
    all = (placeholderValues) => {
      return this._prepare().all(placeholderValues);
    };
    get = (placeholderValues) => {
      return this._prepare().get(placeholderValues);
    };
    values = (placeholderValues) => {
      return this._prepare().values(placeholderValues);
    };
    async execute(placeholderValues) {
      return this._prepare().execute(placeholderValues);
    }
    $dynamic() {
      return this;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/casing.js
  function toSnakeCase(input2) {
    const words = input2.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
    return words.map((word) => word.toLowerCase()).join("_");
  }
  function toCamelCase(input2) {
    const words = input2.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
    return words.reduce((acc, word, i) => {
      const formattedWord = i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
      return acc + formattedWord;
    }, "");
  }
  function noopCase(input2) {
    return input2;
  }

  class CasingCache {
    static [entityKind] = "CasingCache";
    cache = {};
    cachedTables = {};
    convert;
    constructor(casing) {
      this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
    }
    getColumnCasing(column) {
      if (!column.keyAsName)
        return column.name;
      const schema = column.table[Table.Symbol.Schema] ?? "public";
      const tableName = column.table[Table.Symbol.OriginalName];
      const key = `${schema}.${tableName}.${column.name}`;
      if (!this.cache[key]) {
        this.cacheTable(column.table);
      }
      return this.cache[key];
    }
    cacheTable(table) {
      const schema = table[Table.Symbol.Schema] ?? "public";
      const tableName = table[Table.Symbol.OriginalName];
      const tableKey = `${schema}.${tableName}`;
      if (!this.cachedTables[tableKey]) {
        for (const column of Object.values(table[Table.Symbol.Columns])) {
          const columnKey = `${tableKey}.${column.name}`;
          this.cache[columnKey] = this.convert(column.name);
        }
        this.cachedTables[tableKey] = true;
      }
    }
    clearCache() {
      this.cache = {};
      this.cachedTables = {};
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/errors.js
  class DrizzleError extends Error {
    static [entityKind] = "DrizzleError";
    constructor({ message, cause }) {
      super(message);
      this.name = "DrizzleError";
      this.cause = cause;
    }
  }

  class TransactionRollbackError extends DrizzleError {
    static [entityKind] = "TransactionRollbackError";
    constructor() {
      super({ message: "Rollback" });
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/view-base.js
  class SQLiteViewBase extends View2 {
    static [entityKind] = "SQLiteViewBase";
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/dialect.js
  class SQLiteDialect {
    static [entityKind] = "SQLiteDialect";
    casing;
    constructor(config) {
      this.casing = new CasingCache(config?.casing);
    }
    escapeName(name) {
      return `"${name}"`;
    }
    escapeParam(_num) {
      return "?";
    }
    escapeString(str) {
      return `'${str.replace(/'/g, "''")}'`;
    }
    buildWithCTE(queries) {
      if (!queries?.length)
        return;
      const withSqlChunks = [sql`with `];
      for (const [i, w] of queries.entries()) {
        withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
        if (i < queries.length - 1) {
          withSqlChunks.push(sql`, `);
        }
      }
      withSqlChunks.push(sql` `);
      return sql.join(withSqlChunks);
    }
    buildDeleteQuery({ table, where, returning, withList, limit, orderBy }) {
      const withSql = this.buildWithCTE(withList);
      const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : undefined;
      const whereSql = where ? sql` where ${where}` : undefined;
      const orderBySql = this.buildOrderBy(orderBy);
      const limitSql = this.buildLimit(limit);
      return sql`${withSql}delete from ${table}${whereSql}${returningSql}${orderBySql}${limitSql}`;
    }
    buildUpdateSet(table, set) {
      const tableColumns = table[Table.Symbol.Columns];
      const columnNames = Object.keys(tableColumns).filter((colName) => set[colName] !== undefined || tableColumns[colName]?.onUpdateFn !== undefined);
      const setSize = columnNames.length;
      return sql.join(columnNames.flatMap((colName, i) => {
        const col = tableColumns[colName];
        const value = set[colName] ?? sql.param(col.onUpdateFn(), col);
        const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
        if (i < setSize - 1) {
          return [res, sql.raw(", ")];
        }
        return [res];
      }));
    }
    buildUpdateQuery({ table, set, where, returning, withList, joins, from, limit, orderBy }) {
      const withSql = this.buildWithCTE(withList);
      const setSql = this.buildUpdateSet(table, set);
      const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
      const joinsSql = this.buildJoins(joins);
      const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : undefined;
      const whereSql = where ? sql` where ${where}` : undefined;
      const orderBySql = this.buildOrderBy(orderBy);
      const limitSql = this.buildLimit(limit);
      return sql`${withSql}update ${table} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}${orderBySql}${limitSql}`;
    }
    buildSelection(fields, { isSingleTable = false } = {}) {
      const columnsLen = fields.length;
      const chunks = fields.flatMap(({ field }, i) => {
        const chunk = [];
        if (is(field, SQL.Aliased) && field.isSelectionField) {
          chunk.push(sql.identifier(field.fieldAlias));
        } else if (is(field, SQL.Aliased) || is(field, SQL)) {
          const query = is(field, SQL.Aliased) ? field.sql : field;
          if (isSingleTable) {
            chunk.push(new SQL(query.queryChunks.map((c) => {
              if (is(c, Column)) {
                return sql.identifier(this.casing.getColumnCasing(c));
              }
              return c;
            })));
          } else {
            chunk.push(query);
          }
          if (is(field, SQL.Aliased)) {
            chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
          }
        } else if (is(field, Column)) {
          const tableName = field.table[Table.Symbol.Name];
          if (isSingleTable) {
            chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
          } else {
            chunk.push(sql`${sql.identifier(tableName)}.${sql.identifier(this.casing.getColumnCasing(field))}`);
          }
        }
        if (i < columnsLen - 1) {
          chunk.push(sql`, `);
        }
        return chunk;
      });
      return sql.join(chunks);
    }
    buildJoins(joins) {
      if (!joins || joins.length === 0) {
        return;
      }
      const joinsArray = [];
      if (joins) {
        for (const [index, joinMeta] of joins.entries()) {
          if (index === 0) {
            joinsArray.push(sql` `);
          }
          const table = joinMeta.table;
          if (is(table, SQLiteTable)) {
            const tableName = table[SQLiteTable.Symbol.Name];
            const tableSchema = table[SQLiteTable.Symbol.Schema];
            const origTableName = table[SQLiteTable.Symbol.OriginalName];
            const alias = tableName === origTableName ? undefined : joinMeta.alias;
            joinsArray.push(sql`${sql.raw(joinMeta.joinType)} join ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : undefined}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`} on ${joinMeta.on}`);
          } else {
            joinsArray.push(sql`${sql.raw(joinMeta.joinType)} join ${table} on ${joinMeta.on}`);
          }
          if (index < joins.length - 1) {
            joinsArray.push(sql` `);
          }
        }
      }
      return sql.join(joinsArray);
    }
    buildLimit(limit) {
      return typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : undefined;
    }
    buildOrderBy(orderBy) {
      const orderByList = [];
      if (orderBy) {
        for (const [index, orderByValue] of orderBy.entries()) {
          orderByList.push(orderByValue);
          if (index < orderBy.length - 1) {
            orderByList.push(sql`, `);
          }
        }
      }
      return orderByList.length > 0 ? sql` order by ${sql.join(orderByList)}` : undefined;
    }
    buildFromTable(table) {
      if (is(table, Table) && table[Table.Symbol.OriginalName] !== table[Table.Symbol.Name]) {
        return sql`${sql.identifier(table[Table.Symbol.OriginalName])} ${sql.identifier(table[Table.Symbol.Name])}`;
      }
      return table;
    }
    buildSelectQuery({
      withList,
      fields,
      fieldsFlat,
      where,
      having,
      table,
      joins,
      orderBy,
      groupBy,
      limit,
      offset,
      distinct,
      setOperators
    }) {
      const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
      for (const f of fieldsList) {
        if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, SQLiteViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? undefined : getTableName(table)) && !((table2) => joins?.some(({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])))(f.field.table)) {
          const tableName = getTableName(f.field.table);
          throw new Error(`Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`);
        }
      }
      const isSingleTable = !joins || joins.length === 0;
      const withSql = this.buildWithCTE(withList);
      const distinctSql = distinct ? sql` distinct` : undefined;
      const selection = this.buildSelection(fieldsList, { isSingleTable });
      const tableSql = this.buildFromTable(table);
      const joinsSql = this.buildJoins(joins);
      const whereSql = where ? sql` where ${where}` : undefined;
      const havingSql = having ? sql` having ${having}` : undefined;
      const groupByList = [];
      if (groupBy) {
        for (const [index, groupByValue] of groupBy.entries()) {
          groupByList.push(groupByValue);
          if (index < groupBy.length - 1) {
            groupByList.push(sql`, `);
          }
        }
      }
      const groupBySql = groupByList.length > 0 ? sql` group by ${sql.join(groupByList)}` : undefined;
      const orderBySql = this.buildOrderBy(orderBy);
      const limitSql = this.buildLimit(limit);
      const offsetSql = offset ? sql` offset ${offset}` : undefined;
      const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}`;
      if (setOperators.length > 0) {
        return this.buildSetOperations(finalQuery, setOperators);
      }
      return finalQuery;
    }
    buildSetOperations(leftSelect, setOperators) {
      const [setOperator, ...rest] = setOperators;
      if (!setOperator) {
        throw new Error("Cannot pass undefined values to any set operator");
      }
      if (rest.length === 0) {
        return this.buildSetOperationQuery({ leftSelect, setOperator });
      }
      return this.buildSetOperations(this.buildSetOperationQuery({ leftSelect, setOperator }), rest);
    }
    buildSetOperationQuery({
      leftSelect,
      setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
    }) {
      const leftChunk = sql`${leftSelect.getSQL()} `;
      const rightChunk = sql`${rightSelect.getSQL()}`;
      let orderBySql;
      if (orderBy && orderBy.length > 0) {
        const orderByValues = [];
        for (const singleOrderBy of orderBy) {
          if (is(singleOrderBy, SQLiteColumn)) {
            orderByValues.push(sql.identifier(singleOrderBy.name));
          } else if (is(singleOrderBy, SQL)) {
            for (let i = 0;i < singleOrderBy.queryChunks.length; i++) {
              const chunk = singleOrderBy.queryChunks[i];
              if (is(chunk, SQLiteColumn)) {
                singleOrderBy.queryChunks[i] = sql.identifier(this.casing.getColumnCasing(chunk));
              }
            }
            orderByValues.push(sql`${singleOrderBy}`);
          } else {
            orderByValues.push(sql`${singleOrderBy}`);
          }
        }
        orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)}`;
      }
      const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : undefined;
      const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
      const offsetSql = offset ? sql` offset ${offset}` : undefined;
      return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
    }
    buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select }) {
      const valuesSqlList = [];
      const columns = table[Table.Symbol.Columns];
      const colEntries = Object.entries(columns).filter(([_, col]) => !col.shouldDisableInsert());
      const insertOrder = colEntries.map(([, column]) => sql.identifier(this.casing.getColumnCasing(column)));
      if (select) {
        const select2 = valuesOrSelect;
        if (is(select2, SQL)) {
          valuesSqlList.push(select2);
        } else {
          valuesSqlList.push(select2.getSQL());
        }
      } else {
        const values = valuesOrSelect;
        valuesSqlList.push(sql.raw("values "));
        for (const [valueIndex, value] of values.entries()) {
          const valueList = [];
          for (const [fieldName, col] of colEntries) {
            const colValue = value[fieldName];
            if (colValue === undefined || is(colValue, Param) && colValue.value === undefined) {
              let defaultValue;
              if (col.default !== null && col.default !== undefined) {
                defaultValue = is(col.default, SQL) ? col.default : sql.param(col.default, col);
              } else if (col.defaultFn !== undefined) {
                const defaultFnResult = col.defaultFn();
                defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
              } else if (!col.default && col.onUpdateFn !== undefined) {
                const onUpdateFnResult = col.onUpdateFn();
                defaultValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
              } else {
                defaultValue = sql`null`;
              }
              valueList.push(defaultValue);
            } else {
              valueList.push(colValue);
            }
          }
          valuesSqlList.push(valueList);
          if (valueIndex < values.length - 1) {
            valuesSqlList.push(sql`, `);
          }
        }
      }
      const withSql = this.buildWithCTE(withList);
      const valuesSql = sql.join(valuesSqlList);
      const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : undefined;
      const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : undefined;
      return sql`${withSql}insert into ${table} ${insertOrder} ${valuesSql}${onConflictSql}${returningSql}`;
    }
    sqlToQuery(sql2, invokeSource) {
      return sql2.toQuery({
        casing: this.casing,
        escapeName: this.escapeName,
        escapeParam: this.escapeParam,
        escapeString: this.escapeString,
        invokeSource
      });
    }
    buildRelationalQuery({
      fullSchema,
      schema,
      tableNamesMap,
      table,
      tableConfig,
      queryConfig: config,
      tableAlias,
      nestedQueryRelation,
      joinOn
    }) {
      let selection = [];
      let limit, offset, orderBy = [], where;
      const joins = [];
      if (config === true) {
        const selectionEntries = Object.entries(tableConfig.columns);
        selection = selectionEntries.map(([key, value]) => ({
          dbKey: value.name,
          tsKey: key,
          field: aliasedTableColumn(value, tableAlias),
          relationTableTsKey: undefined,
          isJson: false,
          selection: []
        }));
      } else {
        const aliasedColumns = Object.fromEntries(Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]));
        if (config.where) {
          const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
          where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
        }
        const fieldsSelection = [];
        let selectedColumns = [];
        if (config.columns) {
          let isIncludeMode = false;
          for (const [field, value] of Object.entries(config.columns)) {
            if (value === undefined) {
              continue;
            }
            if (field in tableConfig.columns) {
              if (!isIncludeMode && value === true) {
                isIncludeMode = true;
              }
              selectedColumns.push(field);
            }
          }
          if (selectedColumns.length > 0) {
            selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
          }
        } else {
          selectedColumns = Object.keys(tableConfig.columns);
        }
        for (const field of selectedColumns) {
          const column = tableConfig.columns[field];
          fieldsSelection.push({ tsKey: field, value: column });
        }
        let selectedRelations = [];
        if (config.with) {
          selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
        }
        let extras;
        if (config.extras) {
          extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
          for (const [tsKey, value] of Object.entries(extras)) {
            fieldsSelection.push({
              tsKey,
              value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
            });
          }
        }
        for (const { tsKey, value } of fieldsSelection) {
          selection.push({
            dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
            tsKey,
            field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
            relationTableTsKey: undefined,
            isJson: false,
            selection: []
          });
        }
        let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
        if (!Array.isArray(orderByOrig)) {
          orderByOrig = [orderByOrig];
        }
        orderBy = orderByOrig.map((orderByValue) => {
          if (is(orderByValue, Column)) {
            return aliasedTableColumn(orderByValue, tableAlias);
          }
          return mapColumnsInSQLToAlias(orderByValue, tableAlias);
        });
        limit = config.limit;
        offset = config.offset;
        for (const {
          tsKey: selectedRelationTsKey,
          queryConfig: selectedRelationConfigValue,
          relation
        } of selectedRelations) {
          const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
          const relationTableName = getTableUniqueName(relation.referencedTable);
          const relationTableTsName = tableNamesMap[relationTableName];
          const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
          const joinOn2 = and(...normalizedRelation.fields.map((field2, i) => eq(aliasedTableColumn(normalizedRelation.references[i], relationTableAlias), aliasedTableColumn(field2, tableAlias))));
          const builtRelation = this.buildRelationalQuery({
            fullSchema,
            schema,
            tableNamesMap,
            table: fullSchema[relationTableTsName],
            tableConfig: schema[relationTableTsName],
            queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
            tableAlias: relationTableAlias,
            joinOn: joinOn2,
            nestedQueryRelation: relation
          });
          const field = sql`(${builtRelation.sql})`.as(selectedRelationTsKey);
          selection.push({
            dbKey: selectedRelationTsKey,
            tsKey: selectedRelationTsKey,
            field,
            relationTableTsKey: relationTableTsName,
            isJson: true,
            selection: builtRelation.selection
          });
        }
      }
      if (selection.length === 0) {
        throw new DrizzleError({
          message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}"). You need to have at least one item in "columns", "with" or "extras". If you need to select all columns, omit the "columns" key or set it to undefined.`
        });
      }
      let result;
      where = and(joinOn, where);
      if (nestedQueryRelation) {
        let field = sql`json_array(${sql.join(selection.map(({ field: field2 }) => is(field2, SQLiteColumn) ? sql.identifier(this.casing.getColumnCasing(field2)) : is(field2, SQL.Aliased) ? field2.sql : field2), sql`, `)})`;
        if (is(nestedQueryRelation, Many)) {
          field = sql`coalesce(json_group_array(${field}), json_array())`;
        }
        const nestedSelection = [{
          dbKey: "data",
          tsKey: "data",
          field: field.as("data"),
          isJson: true,
          relationTableTsKey: tableConfig.tsName,
          selection
        }];
        const needsSubquery = limit !== undefined || offset !== undefined || orderBy.length > 0;
        if (needsSubquery) {
          result = this.buildSelectQuery({
            table: aliasedTable(table, tableAlias),
            fields: {},
            fieldsFlat: [
              {
                path: [],
                field: sql.raw("*")
              }
            ],
            where,
            limit,
            offset,
            orderBy,
            setOperators: []
          });
          where = undefined;
          limit = undefined;
          offset = undefined;
          orderBy = undefined;
        } else {
          result = aliasedTable(table, tableAlias);
        }
        result = this.buildSelectQuery({
          table: is(result, SQLiteTable) ? result : new Subquery(result, {}, tableAlias),
          fields: {},
          fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
            path: [],
            field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
          })),
          joins,
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
      } else {
        result = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: selection.map(({ field }) => ({
            path: [],
            field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
          })),
          joins,
          where,
          limit,
          offset,
          orderBy,
          setOperators: []
        });
      }
      return {
        tableTsKey: tableConfig.tsName,
        sql: result,
        selection
      };
    }
  }

  class SQLiteSyncDialect extends SQLiteDialect {
    static [entityKind] = "SQLiteSyncDialect";
    migrate(migrations, session, config) {
      const migrationsTable = config === undefined ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
      const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
      session.run(migrationTableCreate);
      const dbMigrations = session.values(sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`);
      const lastDbMigration = dbMigrations[0] ?? undefined;
      session.run(sql`BEGIN`);
      try {
        for (const migration of migrations) {
          if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
            for (const stmt of migration.sql) {
              session.run(sql.raw(stmt));
            }
            session.run(sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`);
          }
        }
        session.run(sql`COMMIT`);
      } catch (e) {
        session.run(sql`ROLLBACK`);
        throw e;
      }
    }
  }

  class SQLiteAsyncDialect extends SQLiteDialect {
    static [entityKind] = "SQLiteAsyncDialect";
    async migrate(migrations, session, config) {
      const migrationsTable = config === undefined ? "__drizzle_migrations" : typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
      const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
      await session.run(migrationTableCreate);
      const dbMigrations = await session.values(sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`);
      const lastDbMigration = dbMigrations[0] ?? undefined;
      await session.transaction(async (tx) => {
        for (const migration of migrations) {
          if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
            for (const stmt of migration.sql) {
              await tx.run(sql.raw(stmt));
            }
            await tx.run(sql`INSERT INTO ${sql.identifier(migrationsTable)} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`);
          }
        }
      });
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/query-builders/query-builder.js
  class TypedQueryBuilder {
    static [entityKind] = "TypedQueryBuilder";
    getSelectedFields() {
      return this._.selectedFields;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/query-builders/select.js
  class SQLiteSelectBuilder {
    static [entityKind] = "SQLiteSelectBuilder";
    fields;
    session;
    dialect;
    withList;
    distinct;
    constructor(config) {
      this.fields = config.fields;
      this.session = config.session;
      this.dialect = config.dialect;
      this.withList = config.withList;
      this.distinct = config.distinct;
    }
    from(source) {
      const isPartialSelect = !!this.fields;
      let fields;
      if (this.fields) {
        fields = this.fields;
      } else if (is(source, Subquery)) {
        fields = Object.fromEntries(Object.keys(source._.selectedFields).map((key) => [key, source[key]]));
      } else if (is(source, SQLiteViewBase)) {
        fields = source[ViewBaseConfig].selectedFields;
      } else if (is(source, SQL)) {
        fields = {};
      } else {
        fields = getTableColumns(source);
      }
      return new SQLiteSelectBase({
        table: source,
        fields,
        isPartialSelect,
        session: this.session,
        dialect: this.dialect,
        withList: this.withList,
        distinct: this.distinct
      });
    }
  }

  class SQLiteSelectQueryBuilderBase extends TypedQueryBuilder {
    static [entityKind] = "SQLiteSelectQueryBuilder";
    _;
    config;
    joinsNotNullableMap;
    tableName;
    isPartialSelect;
    session;
    dialect;
    constructor({ table, fields, isPartialSelect, session, dialect, withList, distinct }) {
      super();
      this.config = {
        withList,
        table,
        fields: { ...fields },
        distinct,
        setOperators: []
      };
      this.isPartialSelect = isPartialSelect;
      this.session = session;
      this.dialect = dialect;
      this._ = {
        selectedFields: fields
      };
      this.tableName = getTableLikeName(table);
      this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
    }
    createJoin(joinType) {
      return (table, on) => {
        const baseTableName = this.tableName;
        const tableName = getTableLikeName(table);
        if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
          throw new Error(`Alias "${tableName}" is already used in this query`);
        }
        if (!this.isPartialSelect) {
          if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
            this.config.fields = {
              [baseTableName]: this.config.fields
            };
          }
          if (typeof tableName === "string" && !is(table, SQL)) {
            const selection = is(table, Subquery) ? table._.selectedFields : is(table, View2) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
            this.config.fields[tableName] = selection;
          }
        }
        if (typeof on === "function") {
          on = on(new Proxy(this.config.fields, new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })));
        }
        if (!this.config.joins) {
          this.config.joins = [];
        }
        this.config.joins.push({ on, table, joinType, alias: tableName });
        if (typeof tableName === "string") {
          switch (joinType) {
            case "left": {
              this.joinsNotNullableMap[tableName] = false;
              break;
            }
            case "right": {
              this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false]));
              this.joinsNotNullableMap[tableName] = true;
              break;
            }
            case "inner": {
              this.joinsNotNullableMap[tableName] = true;
              break;
            }
            case "full": {
              this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false]));
              this.joinsNotNullableMap[tableName] = false;
              break;
            }
          }
        }
        return this;
      };
    }
    leftJoin = this.createJoin("left");
    rightJoin = this.createJoin("right");
    innerJoin = this.createJoin("inner");
    fullJoin = this.createJoin("full");
    createSetOperator(type, isAll) {
      return (rightSelection) => {
        const rightSelect = typeof rightSelection === "function" ? rightSelection(getSQLiteSetOperators()) : rightSelection;
        if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
          throw new Error("Set operator error (union / intersect / except): selected fields are not the same or are in a different order");
        }
        this.config.setOperators.push({ type, isAll, rightSelect });
        return this;
      };
    }
    union = this.createSetOperator("union", false);
    unionAll = this.createSetOperator("union", true);
    intersect = this.createSetOperator("intersect", false);
    except = this.createSetOperator("except", false);
    addSetOperators(setOperators) {
      this.config.setOperators.push(...setOperators);
      return this;
    }
    where(where) {
      if (typeof where === "function") {
        where = where(new Proxy(this.config.fields, new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })));
      }
      this.config.where = where;
      return this;
    }
    having(having) {
      if (typeof having === "function") {
        having = having(new Proxy(this.config.fields, new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })));
      }
      this.config.having = having;
      return this;
    }
    groupBy(...columns) {
      if (typeof columns[0] === "function") {
        const groupBy = columns[0](new Proxy(this.config.fields, new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })));
        this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
      } else {
        this.config.groupBy = columns;
      }
      return this;
    }
    orderBy(...columns) {
      if (typeof columns[0] === "function") {
        const orderBy = columns[0](new Proxy(this.config.fields, new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })));
        const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
        if (this.config.setOperators.length > 0) {
          this.config.setOperators.at(-1).orderBy = orderByArray;
        } else {
          this.config.orderBy = orderByArray;
        }
      } else {
        const orderByArray = columns;
        if (this.config.setOperators.length > 0) {
          this.config.setOperators.at(-1).orderBy = orderByArray;
        } else {
          this.config.orderBy = orderByArray;
        }
      }
      return this;
    }
    limit(limit) {
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).limit = limit;
      } else {
        this.config.limit = limit;
      }
      return this;
    }
    offset(offset) {
      if (this.config.setOperators.length > 0) {
        this.config.setOperators.at(-1).offset = offset;
      } else {
        this.config.offset = offset;
      }
      return this;
    }
    getSQL() {
      return this.dialect.buildSelectQuery(this.config);
    }
    toSQL() {
      const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
      return rest;
    }
    as(alias) {
      return new Proxy(new Subquery(this.getSQL(), this.config.fields, alias), new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" }));
    }
    getSelectedFields() {
      return new Proxy(this.config.fields, new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" }));
    }
    $dynamic() {
      return this;
    }
  }

  class SQLiteSelectBase extends SQLiteSelectQueryBuilderBase {
    static [entityKind] = "SQLiteSelect";
    _prepare(isOneTimeQuery = true) {
      if (!this.session) {
        throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
      }
      const fieldsList = orderSelectedFields(this.config.fields);
      const query = this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](this.dialect.sqlToQuery(this.getSQL()), fieldsList, "all", true);
      query.joinsNotNullableMap = this.joinsNotNullableMap;
      return query;
    }
    prepare() {
      return this._prepare(false);
    }
    run = (placeholderValues) => {
      return this._prepare().run(placeholderValues);
    };
    all = (placeholderValues) => {
      return this._prepare().all(placeholderValues);
    };
    get = (placeholderValues) => {
      return this._prepare().get(placeholderValues);
    };
    values = (placeholderValues) => {
      return this._prepare().values(placeholderValues);
    };
    async execute() {
      return this.all();
    }
  }
  applyMixins(SQLiteSelectBase, [QueryPromise]);
  function createSetOperator(type, isAll) {
    return (leftSelect, rightSelect, ...restSelects) => {
      const setOperators = [rightSelect, ...restSelects].map((select) => ({
        type,
        isAll,
        rightSelect: select
      }));
      for (const setOperator of setOperators) {
        if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
          throw new Error("Set operator error (union / intersect / except): selected fields are not the same or are in a different order");
        }
      }
      return leftSelect.addSetOperators(setOperators);
    };
  }
  var getSQLiteSetOperators = () => ({
    union,
    unionAll,
    intersect,
    except
  });
  var union = createSetOperator("union", false);
  var unionAll = createSetOperator("union", true);
  var intersect = createSetOperator("intersect", false);
  var except = createSetOperator("except", false);

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/query-builders/query-builder.js
  class QueryBuilder {
    static [entityKind] = "SQLiteQueryBuilder";
    dialect;
    dialectConfig;
    constructor(dialect) {
      this.dialect = is(dialect, SQLiteDialect) ? dialect : undefined;
      this.dialectConfig = is(dialect, SQLiteDialect) ? undefined : dialect;
    }
    $with(alias) {
      const queryBuilder = this;
      return {
        as(qb) {
          if (typeof qb === "function") {
            qb = qb(queryBuilder);
          }
          return new Proxy(new WithSubquery(qb.getSQL(), qb.getSelectedFields(), alias, true), new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" }));
        }
      };
    }
    with(...queries) {
      const self = this;
      function select(fields) {
        return new SQLiteSelectBuilder({
          fields: fields ?? undefined,
          session: undefined,
          dialect: self.getDialect(),
          withList: queries
        });
      }
      function selectDistinct(fields) {
        return new SQLiteSelectBuilder({
          fields: fields ?? undefined,
          session: undefined,
          dialect: self.getDialect(),
          withList: queries,
          distinct: true
        });
      }
      return { select, selectDistinct };
    }
    select(fields) {
      return new SQLiteSelectBuilder({ fields: fields ?? undefined, session: undefined, dialect: this.getDialect() });
    }
    selectDistinct(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? undefined,
        session: undefined,
        dialect: this.getDialect(),
        distinct: true
      });
    }
    getDialect() {
      if (!this.dialect) {
        this.dialect = new SQLiteSyncDialect(this.dialectConfig);
      }
      return this.dialect;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/query-builders/insert.js
  class SQLiteInsertBuilder {
    constructor(table, session, dialect, withList) {
      this.table = table;
      this.session = session;
      this.dialect = dialect;
      this.withList = withList;
    }
    static [entityKind] = "SQLiteInsertBuilder";
    values(values) {
      values = Array.isArray(values) ? values : [values];
      if (values.length === 0) {
        throw new Error("values() must be called with at least one value");
      }
      const mappedValues = values.map((entry) => {
        const result = {};
        const cols = this.table[Table.Symbol.Columns];
        for (const colKey of Object.keys(entry)) {
          const colValue = entry[colKey];
          result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
        }
        return result;
      });
      return new SQLiteInsertBase(this.table, mappedValues, this.session, this.dialect, this.withList);
    }
    select(selectQuery) {
      const select = typeof selectQuery === "function" ? selectQuery(new QueryBuilder) : selectQuery;
      if (!is(select, SQL) && !haveSameKeys(this.table[Columns], select._.selectedFields)) {
        throw new Error("Insert select error: selected fields are not the same or are in a different order compared to the table definition");
      }
      return new SQLiteInsertBase(this.table, select, this.session, this.dialect, this.withList, true);
    }
  }

  class SQLiteInsertBase extends QueryPromise {
    constructor(table, values, session, dialect, withList, select) {
      super();
      this.session = session;
      this.dialect = dialect;
      this.config = { table, values, withList, select };
    }
    static [entityKind] = "SQLiteInsert";
    config;
    returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
      this.config.returning = orderSelectedFields(fields);
      return this;
    }
    onConflictDoNothing(config = {}) {
      if (config.target === undefined) {
        this.config.onConflict = sql`do nothing`;
      } else {
        const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
        const whereSql = config.where ? sql` where ${config.where}` : sql``;
        this.config.onConflict = sql`${targetSql} do nothing${whereSql}`;
      }
      return this;
    }
    onConflictDoUpdate(config) {
      if (config.where && (config.targetWhere || config.setWhere)) {
        throw new Error('You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.');
      }
      const whereSql = config.where ? sql` where ${config.where}` : undefined;
      const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : undefined;
      const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : undefined;
      const targetSql = Array.isArray(config.target) ? sql`${config.target}` : sql`${[config.target]}`;
      const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
      this.config.onConflict = sql`${targetSql}${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
      return this;
    }
    getSQL() {
      return this.dialect.buildInsertQuery(this.config);
    }
    toSQL() {
      const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
      return rest;
    }
    _prepare(isOneTimeQuery = true) {
      return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](this.dialect.sqlToQuery(this.getSQL()), this.config.returning, this.config.returning ? "all" : "run", true);
    }
    prepare() {
      return this._prepare(false);
    }
    run = (placeholderValues) => {
      return this._prepare().run(placeholderValues);
    };
    all = (placeholderValues) => {
      return this._prepare().all(placeholderValues);
    };
    get = (placeholderValues) => {
      return this._prepare().get(placeholderValues);
    };
    values = (placeholderValues) => {
      return this._prepare().values(placeholderValues);
    };
    async execute() {
      return this.config.returning ? this.all() : this.run();
    }
    $dynamic() {
      return this;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/query-builders/update.js
  class SQLiteUpdateBuilder {
    constructor(table, session, dialect, withList) {
      this.table = table;
      this.session = session;
      this.dialect = dialect;
      this.withList = withList;
    }
    static [entityKind] = "SQLiteUpdateBuilder";
    set(values) {
      return new SQLiteUpdateBase(this.table, mapUpdateSet(this.table, values), this.session, this.dialect, this.withList);
    }
  }

  class SQLiteUpdateBase extends QueryPromise {
    constructor(table, set, session, dialect, withList) {
      super();
      this.session = session;
      this.dialect = dialect;
      this.config = { set, table, withList, joins: [] };
    }
    static [entityKind] = "SQLiteUpdate";
    config;
    from(source) {
      this.config.from = source;
      return this;
    }
    createJoin(joinType) {
      return (table, on) => {
        const tableName = getTableLikeName(table);
        if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) {
          throw new Error(`Alias "${tableName}" is already used in this query`);
        }
        if (typeof on === "function") {
          const from = this.config.from ? is(table, SQLiteTable) ? table[Table.Symbol.Columns] : is(table, Subquery) ? table._.selectedFields : is(table, SQLiteViewBase) ? table[ViewBaseConfig].selectedFields : undefined : undefined;
          on = on(new Proxy(this.config.table[Table.Symbol.Columns], new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })), from && new Proxy(from, new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })));
        }
        this.config.joins.push({ on, table, joinType, alias: tableName });
        return this;
      };
    }
    leftJoin = this.createJoin("left");
    rightJoin = this.createJoin("right");
    innerJoin = this.createJoin("inner");
    fullJoin = this.createJoin("full");
    where(where) {
      this.config.where = where;
      return this;
    }
    orderBy(...columns) {
      if (typeof columns[0] === "function") {
        const orderBy = columns[0](new Proxy(this.config.table[Table.Symbol.Columns], new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })));
        const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
        this.config.orderBy = orderByArray;
      } else {
        const orderByArray = columns;
        this.config.orderBy = orderByArray;
      }
      return this;
    }
    limit(limit) {
      this.config.limit = limit;
      return this;
    }
    returning(fields = this.config.table[SQLiteTable.Symbol.Columns]) {
      this.config.returning = orderSelectedFields(fields);
      return this;
    }
    getSQL() {
      return this.dialect.buildUpdateQuery(this.config);
    }
    toSQL() {
      const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
      return rest;
    }
    _prepare(isOneTimeQuery = true) {
      return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](this.dialect.sqlToQuery(this.getSQL()), this.config.returning, this.config.returning ? "all" : "run", true);
    }
    prepare() {
      return this._prepare(false);
    }
    run = (placeholderValues) => {
      return this._prepare().run(placeholderValues);
    };
    all = (placeholderValues) => {
      return this._prepare().all(placeholderValues);
    };
    get = (placeholderValues) => {
      return this._prepare().get(placeholderValues);
    };
    values = (placeholderValues) => {
      return this._prepare().values(placeholderValues);
    };
    async execute() {
      return this.config.returning ? this.all() : this.run();
    }
    $dynamic() {
      return this;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/query-builders/count.js
  class SQLiteCountBuilder extends SQL {
    constructor(params) {
      super(SQLiteCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
      this.params = params;
      this.session = params.session;
      this.sql = SQLiteCountBuilder.buildCount(params.source, params.filters);
    }
    sql;
    static [entityKind] = "SQLiteCountBuilderAsync";
    [Symbol.toStringTag] = "SQLiteCountBuilderAsync";
    session;
    static buildEmbeddedCount(source, filters) {
      return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
    }
    static buildCount(source, filters) {
      return sql`select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters}`;
    }
    then(onfulfilled, onrejected) {
      return Promise.resolve(this.session.count(this.sql)).then(onfulfilled, onrejected);
    }
    catch(onRejected) {
      return this.then(undefined, onRejected);
    }
    finally(onFinally) {
      return this.then((value) => {
        onFinally?.();
        return value;
      }, (reason) => {
        onFinally?.();
        throw reason;
      });
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/query-builders/query.js
  class RelationalQueryBuilder {
    constructor(mode, fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
      this.mode = mode;
      this.fullSchema = fullSchema;
      this.schema = schema;
      this.tableNamesMap = tableNamesMap;
      this.table = table;
      this.tableConfig = tableConfig;
      this.dialect = dialect;
      this.session = session;
    }
    static [entityKind] = "SQLiteAsyncRelationalQueryBuilder";
    findMany(config) {
      return this.mode === "sync" ? new SQLiteSyncRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? config : {}, "many") : new SQLiteRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? config : {}, "many");
    }
    findFirst(config) {
      return this.mode === "sync" ? new SQLiteSyncRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? { ...config, limit: 1 } : { limit: 1 }, "first") : new SQLiteRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? { ...config, limit: 1 } : { limit: 1 }, "first");
    }
  }

  class SQLiteRelationalQuery extends QueryPromise {
    constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
      super();
      this.fullSchema = fullSchema;
      this.schema = schema;
      this.tableNamesMap = tableNamesMap;
      this.table = table;
      this.tableConfig = tableConfig;
      this.dialect = dialect;
      this.session = session;
      this.config = config;
      this.mode = mode;
    }
    static [entityKind] = "SQLiteAsyncRelationalQuery";
    mode;
    getSQL() {
      return this.dialect.buildRelationalQuery({
        fullSchema: this.fullSchema,
        schema: this.schema,
        tableNamesMap: this.tableNamesMap,
        table: this.table,
        tableConfig: this.tableConfig,
        queryConfig: this.config,
        tableAlias: this.tableConfig.tsName
      }).sql;
    }
    _prepare(isOneTimeQuery = false) {
      const { query, builtQuery } = this._toSQL();
      return this.session[isOneTimeQuery ? "prepareOneTimeQuery" : "prepareQuery"](builtQuery, undefined, this.mode === "first" ? "get" : "all", true, (rawRows, mapColumnValue) => {
        const rows = rawRows.map((row) => mapRelationalRow(this.schema, this.tableConfig, row, query.selection, mapColumnValue));
        if (this.mode === "first") {
          return rows[0];
        }
        return rows;
      });
    }
    prepare() {
      return this._prepare(false);
    }
    _toSQL() {
      const query = this.dialect.buildRelationalQuery({
        fullSchema: this.fullSchema,
        schema: this.schema,
        tableNamesMap: this.tableNamesMap,
        table: this.table,
        tableConfig: this.tableConfig,
        queryConfig: this.config,
        tableAlias: this.tableConfig.tsName
      });
      const builtQuery = this.dialect.sqlToQuery(query.sql);
      return { query, builtQuery };
    }
    toSQL() {
      return this._toSQL().builtQuery;
    }
    executeRaw() {
      if (this.mode === "first") {
        return this._prepare(false).get();
      }
      return this._prepare(false).all();
    }
    async execute() {
      return this.executeRaw();
    }
  }

  class SQLiteSyncRelationalQuery extends SQLiteRelationalQuery {
    static [entityKind] = "SQLiteSyncRelationalQuery";
    sync() {
      return this.executeRaw();
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/query-builders/raw.js
  class SQLiteRaw extends QueryPromise {
    constructor(execute, getSQL, action, dialect, mapBatchResult) {
      super();
      this.execute = execute;
      this.getSQL = getSQL;
      this.dialect = dialect;
      this.mapBatchResult = mapBatchResult;
      this.config = { action };
    }
    static [entityKind] = "SQLiteRaw";
    config;
    getQuery() {
      return { ...this.dialect.sqlToQuery(this.getSQL()), method: this.config.action };
    }
    mapResult(result, isFromBatch) {
      return isFromBatch ? this.mapBatchResult(result) : result;
    }
    _prepare() {
      return this;
    }
    isResponseInArrayMode() {
      return false;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/db.js
  class BaseSQLiteDatabase {
    constructor(resultKind, dialect, session, schema) {
      this.resultKind = resultKind;
      this.dialect = dialect;
      this.session = session;
      this._ = schema ? {
        schema: schema.schema,
        fullSchema: schema.fullSchema,
        tableNamesMap: schema.tableNamesMap
      } : {
        schema: undefined,
        fullSchema: {},
        tableNamesMap: {}
      };
      this.query = {};
      const query = this.query;
      if (this._.schema) {
        for (const [tableName, columns] of Object.entries(this._.schema)) {
          query[tableName] = new RelationalQueryBuilder(resultKind, schema.fullSchema, this._.schema, this._.tableNamesMap, schema.fullSchema[tableName], columns, dialect, session);
        }
      }
    }
    static [entityKind] = "BaseSQLiteDatabase";
    query;
    $with(alias) {
      const self = this;
      return {
        as(qb) {
          if (typeof qb === "function") {
            qb = qb(new QueryBuilder(self.dialect));
          }
          return new Proxy(new WithSubquery(qb.getSQL(), qb.getSelectedFields(), alias, true), new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" }));
        }
      };
    }
    $count(source, filters) {
      return new SQLiteCountBuilder({ source, filters, session: this.session });
    }
    with(...queries) {
      const self = this;
      function select(fields) {
        return new SQLiteSelectBuilder({
          fields: fields ?? undefined,
          session: self.session,
          dialect: self.dialect,
          withList: queries
        });
      }
      function selectDistinct(fields) {
        return new SQLiteSelectBuilder({
          fields: fields ?? undefined,
          session: self.session,
          dialect: self.dialect,
          withList: queries,
          distinct: true
        });
      }
      function update(table) {
        return new SQLiteUpdateBuilder(table, self.session, self.dialect, queries);
      }
      function insert(into) {
        return new SQLiteInsertBuilder(into, self.session, self.dialect, queries);
      }
      function delete_(from) {
        return new SQLiteDeleteBase(from, self.session, self.dialect, queries);
      }
      return { select, selectDistinct, update, insert, delete: delete_ };
    }
    select(fields) {
      return new SQLiteSelectBuilder({ fields: fields ?? undefined, session: this.session, dialect: this.dialect });
    }
    selectDistinct(fields) {
      return new SQLiteSelectBuilder({
        fields: fields ?? undefined,
        session: this.session,
        dialect: this.dialect,
        distinct: true
      });
    }
    update(table) {
      return new SQLiteUpdateBuilder(table, this.session, this.dialect);
    }
    insert(into) {
      return new SQLiteInsertBuilder(into, this.session, this.dialect);
    }
    delete(from) {
      return new SQLiteDeleteBase(from, this.session, this.dialect);
    }
    run(query) {
      const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
      if (this.resultKind === "async") {
        return new SQLiteRaw(async () => this.session.run(sequel), () => sequel, "run", this.dialect, this.session.extractRawRunValueFromBatchResult.bind(this.session));
      }
      return this.session.run(sequel);
    }
    all(query) {
      const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
      if (this.resultKind === "async") {
        return new SQLiteRaw(async () => this.session.all(sequel), () => sequel, "all", this.dialect, this.session.extractRawAllValueFromBatchResult.bind(this.session));
      }
      return this.session.all(sequel);
    }
    get(query) {
      const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
      if (this.resultKind === "async") {
        return new SQLiteRaw(async () => this.session.get(sequel), () => sequel, "get", this.dialect, this.session.extractRawGetValueFromBatchResult.bind(this.session));
      }
      return this.session.get(sequel);
    }
    values(query) {
      const sequel = typeof query === "string" ? sql.raw(query) : query.getSQL();
      if (this.resultKind === "async") {
        return new SQLiteRaw(async () => this.session.values(sequel), () => sequel, "values", this.dialect, this.session.extractRawValuesValueFromBatchResult.bind(this.session));
      }
      return this.session.values(sequel);
    }
    transaction(transaction, config) {
      return this.session.transaction(transaction, config);
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-core/session.js
  class ExecuteResultSync extends QueryPromise {
    constructor(resultCb) {
      super();
      this.resultCb = resultCb;
    }
    static [entityKind] = "ExecuteResultSync";
    async execute() {
      return this.resultCb();
    }
    sync() {
      return this.resultCb();
    }
  }

  class SQLitePreparedQuery {
    constructor(mode, executeMethod, query) {
      this.mode = mode;
      this.executeMethod = executeMethod;
      this.query = query;
    }
    static [entityKind] = "PreparedQuery";
    joinsNotNullableMap;
    getQuery() {
      return this.query;
    }
    mapRunResult(result, _isFromBatch) {
      return result;
    }
    mapAllResult(_result, _isFromBatch) {
      throw new Error("Not implemented");
    }
    mapGetResult(_result, _isFromBatch) {
      throw new Error("Not implemented");
    }
    execute(placeholderValues) {
      if (this.mode === "async") {
        return this[this.executeMethod](placeholderValues);
      }
      return new ExecuteResultSync(() => this[this.executeMethod](placeholderValues));
    }
    mapResult(response, isFromBatch) {
      switch (this.executeMethod) {
        case "run": {
          return this.mapRunResult(response, isFromBatch);
        }
        case "all": {
          return this.mapAllResult(response, isFromBatch);
        }
        case "get": {
          return this.mapGetResult(response, isFromBatch);
        }
      }
    }
  }

  class SQLiteSession {
    constructor(dialect) {
      this.dialect = dialect;
    }
    static [entityKind] = "SQLiteSession";
    prepareOneTimeQuery(query, fields, executeMethod, isResponseInArrayMode) {
      return this.prepareQuery(query, fields, executeMethod, isResponseInArrayMode);
    }
    run(query) {
      const staticQuery = this.dialect.sqlToQuery(query);
      try {
        return this.prepareOneTimeQuery(staticQuery, undefined, "run", false).run();
      } catch (err) {
        throw new DrizzleError({ cause: err, message: `Failed to run the query '${staticQuery.sql}'` });
      }
    }
    extractRawRunValueFromBatchResult(result) {
      return result;
    }
    all(query) {
      return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), undefined, "run", false).all();
    }
    extractRawAllValueFromBatchResult(_result) {
      throw new Error("Not implemented");
    }
    get(query) {
      return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), undefined, "run", false).get();
    }
    extractRawGetValueFromBatchResult(_result) {
      throw new Error("Not implemented");
    }
    values(query) {
      return this.prepareOneTimeQuery(this.dialect.sqlToQuery(query), undefined, "run", false).values();
    }
    async count(sql2) {
      const result = await this.values(sql2);
      return result[0][0];
    }
    extractRawValuesValueFromBatchResult(_result) {
      throw new Error("Not implemented");
    }
  }

  class SQLiteTransaction extends BaseSQLiteDatabase {
    constructor(resultType, dialect, session, schema, nestedIndex = 0) {
      super(resultType, dialect, session, schema);
      this.schema = schema;
      this.nestedIndex = nestedIndex;
    }
    static [entityKind] = "SQLiteTransaction";
    rollback() {
      throw new TransactionRollbackError;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-proxy/session.js
  class SQLiteRemoteSession extends SQLiteSession {
    constructor(client, dialect, schema, batchCLient, options = {}) {
      super(dialect);
      this.client = client;
      this.schema = schema;
      this.batchCLient = batchCLient;
      this.logger = options.logger ?? new NoopLogger;
    }
    static [entityKind] = "SQLiteRemoteSession";
    logger;
    prepareQuery(query, fields, executeMethod, isResponseInArrayMode, customResultMapper) {
      return new RemotePreparedQuery(this.client, query, this.logger, fields, executeMethod, isResponseInArrayMode, customResultMapper);
    }
    async batch(queries) {
      const preparedQueries = [];
      const builtQueries = [];
      for (const query of queries) {
        const preparedQuery = query._prepare();
        const builtQuery = preparedQuery.getQuery();
        preparedQueries.push(preparedQuery);
        builtQueries.push({ sql: builtQuery.sql, params: builtQuery.params, method: builtQuery.method });
      }
      const batchResults = await this.batchCLient(builtQueries);
      return batchResults.map((result, i) => preparedQueries[i].mapResult(result, true));
    }
    async transaction(transaction, config) {
      const tx = new SQLiteProxyTransaction("async", this.dialect, this, this.schema);
      await this.run(sql.raw(`begin${config?.behavior ? " " + config.behavior : ""}`));
      try {
        const result = await transaction(tx);
        await this.run(sql`commit`);
        return result;
      } catch (err) {
        await this.run(sql`rollback`);
        throw err;
      }
    }
    extractRawAllValueFromBatchResult(result) {
      return result.rows;
    }
    extractRawGetValueFromBatchResult(result) {
      return result.rows[0];
    }
    extractRawValuesValueFromBatchResult(result) {
      return result.rows;
    }
  }

  class SQLiteProxyTransaction extends SQLiteTransaction {
    static [entityKind] = "SQLiteProxyTransaction";
    async transaction(transaction) {
      const savepointName = `sp${this.nestedIndex}`;
      const tx = new SQLiteProxyTransaction("async", this.dialect, this.session, this.schema, this.nestedIndex + 1);
      await this.session.run(sql.raw(`savepoint ${savepointName}`));
      try {
        const result = await transaction(tx);
        await this.session.run(sql.raw(`release savepoint ${savepointName}`));
        return result;
      } catch (err) {
        await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
        throw err;
      }
    }
  }

  class RemotePreparedQuery extends SQLitePreparedQuery {
    constructor(client, query, logger, fields, executeMethod, _isResponseInArrayMode, customResultMapper) {
      super("async", executeMethod, query);
      this.client = client;
      this.logger = logger;
      this.fields = fields;
      this._isResponseInArrayMode = _isResponseInArrayMode;
      this.customResultMapper = customResultMapper;
      this.customResultMapper = customResultMapper;
      this.method = executeMethod;
    }
    static [entityKind] = "SQLiteProxyPreparedQuery";
    method;
    getQuery() {
      return { ...this.query, method: this.method };
    }
    run(placeholderValues) {
      const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
      this.logger.logQuery(this.query.sql, params);
      return this.client(this.query.sql, params, "run");
    }
    mapAllResult(rows, isFromBatch) {
      if (isFromBatch) {
        rows = rows.rows;
      }
      if (!this.fields && !this.customResultMapper) {
        return rows;
      }
      if (this.customResultMapper) {
        return this.customResultMapper(rows);
      }
      return rows.map((row) => {
        return mapResultRow(this.fields, row, this.joinsNotNullableMap);
      });
    }
    async all(placeholderValues) {
      const { query, logger, client } = this;
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger.logQuery(query.sql, params);
      const { rows } = await client(query.sql, params, "all");
      return this.mapAllResult(rows);
    }
    async get(placeholderValues) {
      const { query, logger, client } = this;
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger.logQuery(query.sql, params);
      const clientResult = await client(query.sql, params, "get");
      return this.mapGetResult(clientResult.rows);
    }
    mapGetResult(rows, isFromBatch) {
      if (isFromBatch) {
        rows = rows.rows;
      }
      const row = rows;
      if (!this.fields && !this.customResultMapper) {
        return row;
      }
      if (!row) {
        return;
      }
      if (this.customResultMapper) {
        return this.customResultMapper([rows]);
      }
      return mapResultRow(this.fields, row, this.joinsNotNullableMap);
    }
    async values(placeholderValues) {
      const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
      this.logger.logQuery(this.query.sql, params);
      const clientResult = await this.client(this.query.sql, params, "values");
      return clientResult.rows;
    }
    isResponseInArrayMode() {
      return this._isResponseInArrayMode;
    }
  }

  // ../../node_modules/.bun/drizzle-orm@0.36.4+f4eacebf2041cd4f/node_modules/drizzle-orm/sqlite-proxy/driver.js
  class SqliteRemoteDatabase extends BaseSQLiteDatabase {
    static [entityKind] = "SqliteRemoteDatabase";
    async batch(batch) {
      return this.session.batch(batch);
    }
  }
  function drizzle(callback, batchCallback, config) {
    const dialect = new SQLiteAsyncDialect({ casing: config?.casing });
    let logger;
    let _batchCallback;
    let _config = {};
    if (batchCallback) {
      if (typeof batchCallback === "function") {
        _batchCallback = batchCallback;
        _config = config ?? {};
      } else {
        _batchCallback = undefined;
        _config = batchCallback;
      }
      if (_config.logger === true) {
        logger = new DefaultLogger;
      } else if (_config.logger !== false) {
        logger = _config.logger;
      }
    }
    let schema;
    if (_config.schema) {
      const tablesConfig = extractTablesRelationalConfig(_config.schema, createTableRelationsHelpers);
      schema = {
        fullSchema: _config.schema,
        schema: tablesConfig.tables,
        tableNamesMap: tablesConfig.tableNamesMap
      };
    }
    const session = new SQLiteRemoteSession(callback, dialect, schema, _batchCallback, { logger });
    return new SqliteRemoteDatabase("async", dialect, session, schema);
  }

  // ../../js/packages/@velox/drizzle/src/index.js
  function createDrizzle(dbHandle, schema) {
    return drizzle(async (sql2, params, method) => {
      if (method === "run") {
        await __velox_db_run(dbHandle, sql2, JSON.stringify(params));
        return { rows: [] };
      }
      const rowsJson = await __velox_db_query(dbHandle, sql2, JSON.stringify(params));
      const rows = JSON.parse(rowsJson);
      return { rows: rows.map((r) => Object.values(r)) };
    }, schema ? { schema } : undefined);
  }

  // js/app.jsx
  var jsx_runtime = __toESM(require_jsx_runtime(), 1);
  var drzProducts = sqliteTable("drz_products", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    price: real("price").notNull(),
    created_at: integer("created_at").notNull()
  });
  var HEADER_H = 48;
  var PAD = 16;
  var C = {
    bg: "#171923",
    surface: "#1f2333",
    surfaceAlt: "#262b3f",
    overlay: "#2b3148",
    border: "#3c4464",
    text: "#e7ecff",
    subtle: "#b7c0dd",
    dim: "#7d87ab",
    accent: "#7aa2f7",
    green: "#9ece6a",
    red: "#f7768e",
    yellow: "#e0af68",
    mauve: "#bb9af7",
    teal: "#7dcfff",
    sapphire: "#2ac3de",
    header: "#141824"
  };
  function getAccentBands(theme) {
    return [theme.accent, theme.mauve, theme.teal, theme.green, theme.yellow];
  }
  var VOCAB = [
    "todo",
    "meeting",
    "idea",
    "project",
    "code",
    "buy",
    "call",
    "email",
    "read",
    "write",
    "fix",
    "important",
    "urgent",
    "task",
    "review",
    "update",
    "check",
    "plan",
    "done",
    "note"
  ];
  function embedNote(title, body) {
    const text2 = (title + " " + body).toLowerCase();
    const vec = VOCAB.map((w) => text2.includes(w) ? 1 : 0);
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return mag > 0 ? vec.map((v) => v / mag) : vec;
  }
  var SEED_NOTES = [
    {
      title: "Project Ideas",
      body: "Ideas for next velox feature: vector search UI, nice responsive layout improvements, cross-platform build. Plan rollout for Q2."
    },
    {
      title: "Team Meeting Notes",
      body: "Meeting agenda: review sprint goals, check blockers, update roadmap, plan next release. Schedule call with design team."
    },
    {
      title: "Code Review Checklist",
      body: "Review open PRs: fix memory leak in runtime, update bindings, code cleanup. Check test coverage and update docs."
    },
    {
      title: "Shopping List",
      body: "Buy groceries: milk, eggs, coffee, bread, cheese. Also check hardware store for a new monitor stand and USB cables."
    },
    {
      title: "Email Draft — Q2 Update",
      body: "Write email to stakeholders about project update. Important: include timeline, budget note, blockers, and next steps."
    },
    {
      title: "Daily Todo",
      body: "Todo: fix CLI bug, review PR, write unit tests, update docs, check build pipeline, plan sprint tasks for tomorrow."
    },
    {
      title: "Release v0.5 Checklist",
      body: "Important urgent tasks: fix crash on startup, update version number, write changelog, review release notes, plan rollout."
    },
    {
      title: "Reading List",
      body: "Books to read: Programming Rust, Clean Code, Designing Data-Intensive Applications. Note: write blog post about key ideas."
    }
  ];
  var NotesCtx = import_react7.createContext({
    vdb: null,
    dbReady: false,
    notes: [],
    refreshNotes: () => {},
    initStatus: "Loading…"
  });
  function useNotesCtx() {
    return import_react7.useContext(NotesCtx);
  }
  function useThemeColors() {
    return C;
  }
  function formatShortDate(ms) {
    const d = new Date(ms);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[d.getMonth()] + " " + d.getDate();
  }
  function countWords(text2) {
    const trimmed = (text2 || "").trim();
    if (!trimmed)
      return 0;
    return trimmed.split(/\s+/).length;
  }
  function Btn({ label, onPress, width: w = 100, color, disabled = false, filled = false }) {
    const C2 = useThemeColors();
    const tone = color ?? C2.accent;
    return /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
      onPress: disabled ? undefined : onPress,
      width: w,
      height: 34,
      style: {
        backgroundColor: disabled ? C2.surface : filled ? C2.overlay : C2.surfaceAlt,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: disabled ? C2.border : tone
      },
      children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
        fontSize: 12,
        width: w - 16,
        height: 18,
        style: { color: disabled ? C2.dim : tone },
        children: label
      })
    });
  }
  function StatPill({ label, value, tone, width = 118 }) {
    const C2 = useThemeColors();
    const pillTone = tone ?? C2.accent;
    return /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: {
        backgroundColor: C2.surfaceAlt,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C2.border,
        padding: 10,
        gap: 2
      },
      width,
      height: 52,
      children: [
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 10,
          width: width - 22,
          height: 12,
          style: { color: C2.dim },
          children: label
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 15,
          width: width - 22,
          height: 20,
          style: { color: pillTone },
          children: value
        })
      ]
    });
  }
  function FormSection({ title, children }) {
    const C2 = useThemeColors();
    const { width: winW } = useWindowSize();
    const w = winW - PAD * 2;
    return /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: { gap: 10, alignItems: "flex-start" },
      width: w,
      children: [
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 11,
          width: w,
          height: 16,
          style: { color: C2.dim },
          children: title
        }),
        children,
        /* @__PURE__ */ jsx_runtime.jsx(View, {
          style: { backgroundColor: C2.border },
          width: w,
          height: 1
        })
      ]
    });
  }
  function NoteCard({ note, onPress, width: w, index = 0 }) {
    const C2 = useThemeColors();
    const ACCENT_BANDS = getAccentBands(C2);
    const band = ACCENT_BANDS[index % ACCENT_BANDS.length];
    const inner = w - 42;
    const preview = (note.body || "").slice(0, 110);
    const date = formatShortDate(note.updated_at);
    const words = countWords(note.body);
    return /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
      onPress,
      width: w,
      height: 102,
      style: {
        backgroundColor: C2.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C2.border,
        padding: 0,
        gap: 0,
        justifyContent: "flex-start",
        alignItems: "flex-start"
      },
      children: /* @__PURE__ */ jsx_runtime.jsxs(View, {
        style: { flexDirection: "row", gap: 0 },
        width: w,
        height: 100,
        children: [
          /* @__PURE__ */ jsx_runtime.jsx(View, {
            style: { backgroundColor: band },
            width: 6,
            height: 100
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: {
              padding: 12,
              gap: 6,
              justifyContent: "flex-start",
              alignItems: "flex-start"
            },
            width: w - 8,
            height: 100,
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { flexDirection: "row", justifyContent: "flex-start", gap: 8 },
                width: inner,
                height: 20,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 14,
                    width: inner - 60,
                    height: 20,
                    style: { color: C2.text },
                    children: note.title || "(untitled)"
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 10,
                    width: 52,
                    height: 14,
                    style: { color: C2.dim },
                    children: date
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: inner,
                height: 32,
                style: { color: C2.subtle },
                children: preview.length > 0 ? preview + (note.body.length > 110 ? "…" : "") : "(empty)"
              }),
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { flexDirection: "row", gap: 8 },
                width: inner,
                height: 16,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 10,
                    width: 88,
                    height: 14,
                    style: { color: band },
                    children: "#" + note.id
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 10,
                    width: 96,
                    height: 14,
                    style: { color: C2.dim },
                    children: words + " words"
                  })
                ]
              })
            ]
          })
        ]
      })
    });
  }
  function SectionLabel({ label, width: w }) {
    const C2 = useThemeColors();
    return /* @__PURE__ */ jsx_runtime.jsx(Text, {
      fontSize: 11,
      width: w,
      height: 16,
      style: { color: C2.dim },
      children: label
    });
  }
  function Divider({ width: w }) {
    const C2 = useThemeColors();
    return /* @__PURE__ */ jsx_runtime.jsx(View, {
      style: { backgroundColor: C2.border },
      width: w,
      height: 1
    });
  }
  function BackBtn() {
    const navigate = useNavigate();
    const C2 = useThemeColors();
    return /* @__PURE__ */ jsx_runtime.jsx(Btn, {
      label: "← Back",
      onPress: () => navigate("back"),
      width: 84,
      color: C2.subtle
    });
  }
  function NoteListScreen() {
    const { width: winW, height: winH } = useWindowSize();
    const isWide = useMediaQuery(1180);
    const C2 = useThemeColors();
    const { notes, dbReady, refreshNotes, initStatus } = useNotesCtx();
    const navigate = useNavigate();
    const [query, setQuery] = import_react7.useState("");
    const [results, setResults] = import_react7.useState(null);
    const [status, setStatus] = import_react7.useState("");
    import_react7.useEffect(() => {
      veloxWindow.setTitle("Notes");
    }, []);
    import_react7.useEffect(() => {
      if (!query.trim()) {
        setResults(null);
        return;
      }
      db.query("SELECT * FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY updated_at DESC", [`%${query}%`, `%${query}%`]).then((rows) => {
        setResults(rows);
        setStatus(rows.length === 0 ? "No notes match." : `${rows.length} match${rows.length === 1 ? "" : "es"}`);
      }).catch((e) => setStatus("Search error: " + e.message));
    }, [query]);
    const displayed = results ?? notes;
    const selectedHint = query ? status || "Searching…" : dbReady ? `${notes.length} notes in your workspace` : initStatus;
    const wordTotal = import_react7.useMemo(() => notes.reduce((sum, n) => sum + countWords(n.title) + countWords(n.body), 0), [notes]);
    const latestDate = notes.length > 0 ? formatShortDate(notes[0].updated_at) : "N/A";
    const contentW = winW - 2 * PAD;
    const contentH = winH - HEADER_H - 2 * PAD;
    const inner = contentW - 32;
    const svContentH = displayed.length * 110 + 20;
    const heroH = isWide ? 124 : 188;
    const actionsH = 76;
    const svH = Math.max(110, contentH - 40 - heroH - 40 - actionsH - 18 - 16);
    return /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: {
        backgroundColor: C2.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C2.border,
        padding: 16,
        gap: 10,
        justifyContent: "flex-start",
        alignItems: "flex-start"
      },
      width: contentW,
      height: contentH,
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: {
            flexDirection: "row",
            gap: 10,
            alignItems: "flex-start",
            backgroundColor: C2.overlay,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: C2.border,
            padding: 12
          },
          width: inner,
          height: heroH,
          children: [
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { gap: 6, justifyContent: "flex-start", alignItems: "flex-start" },
              width: isWide ? inner - 420 : inner,
              height: 98,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 22,
                  width: isWide ? inner - 430 : inner - 8,
                  height: 30,
                  style: { color: C2.text },
                  children: "My Notes Workspace Demo"
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 12,
                  width: isWide ? inner - 430 : inner - 8,
                  style: { color: C2.subtle },
                  children: "Capture ideas, write drafts, and rediscover them instantly with semantic search."
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 11,
                  width: isWide ? inner - 430 : inner - 8,
                  height: 16,
                  style: { color: C2.dim },
                  children: selectedHint
                })
              ]
            }),
            isWide && /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { flexDirection: "row", gap: 8 },
              width: 390,
              height: 60,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(StatPill, {
                  label: "Notes",
                  value: String(notes.length),
                  tone: C2.accent
                }),
                /* @__PURE__ */ jsx_runtime.jsx(StatPill, {
                  label: "Words",
                  value: String(wordTotal),
                  tone: C2.teal
                }),
                /* @__PURE__ */ jsx_runtime.jsx(StatPill, {
                  label: "Updated",
                  value: latestDate,
                  tone: C2.mauve
                })
              ]
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
          value: query,
          onChangeText: setQuery,
          placeholder: "Search by title or content...",
          fontSize: 13,
          width: inner,
          height: 36
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { gap: 8 },
          width: inner,
          height: actionsH,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 11,
              width: inner,
              height: 16,
              style: { color: C2.dim },
              children: "Tap a card to edit. Search narrows results instantly using SQL LIKE."
            }),
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
              width: inner,
              height: 52,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "+ New",
                  onPress: () => navigate("edit", { noteId: null }),
                  width: 80,
                  color: C2.green,
                  disabled: !dbReady,
                  filled: true
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Semantic",
                  onPress: () => navigate("search"),
                  width: 95,
                  color: C2.mauve,
                  disabled: !dbReady
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Refresh",
                  onPress: refreshNotes,
                  width: 90,
                  color: C2.accent,
                  disabled: !dbReady
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Network",
                  onPress: () => navigate("network"),
                  width: 90,
                  color: C2.teal
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Sys APIs",
                  onPress: () => navigate("sysapi"),
                  width: 90,
                  color: C2.yellow
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Forms",
                  onPress: () => navigate("forms"),
                  width: 74,
                  color: C2.mauve
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Audio",
                  onPress: () => navigate("audio"),
                  width: 74,
                  color: C2.teal
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Canvas",
                  onPress: () => navigate("canvas"),
                  width: 80,
                  color: C2.sapphire
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "AI",
                  onPress: () => navigate("ai"),
                  width: 52,
                  color: C2.mauve
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Media",
                  onPress: () => navigate("media"),
                  width: 64,
                  color: C2.teal
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Drizzle",
                  onPress: () => navigate("drizzle"),
                  width: 68,
                  color: C2.green
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                  label: "Packages",
                  onPress: () => navigate("packages"),
                  width: 84,
                  color: C2.mauve
                })
              ]
            })
          ]
        }),
        displayed.length === 0 ? /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { justifyContent: "flex-start", alignItems: "flex-start", gap: 8 },
          width: inner,
          height: 120,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 13,
              width: inner,
              height: 20,
              style: { color: C2.dim },
              children: dbReady ? query ? "No notes match your filter." : "No notes yet." : "Initialising database…"
            }),
            dbReady && !query && /* @__PURE__ */ jsx_runtime.jsx(Btn, {
              label: "+ Create First Note",
              onPress: () => navigate("edit", { noteId: null }),
              width: 160,
              color: C2.green,
              filled: true
            })
          ]
        }) : /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
          width: inner,
          height: Math.max(80, svH),
          contentHeight: svContentH,
          style: { gap: 10, padding: 0 },
          children: displayed.map((note, i) => /* @__PURE__ */ jsx_runtime.jsx(NoteCard, {
            note,
            width: inner,
            index: i,
            onPress: () => navigate("edit", { noteId: note.id })
          }, note.id))
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 10,
          width: inner,
          height: 14,
          style: { color: C2.dim },
          children: "Beautiful by default • SQL filtering • Semantic search powered by your Velox vector store"
        })
      ]
    });
  }
  function NoteEditScreen() {
    const { width: winW, height: winH } = useWindowSize();
    const isWide = useMediaQuery(1080);
    const C2 = useThemeColors();
    const { vdb, dbReady, refreshNotes } = useNotesCtx();
    const { params } = useRoute();
    const navigate = useNavigate();
    const noteId = params?.noteId ?? null;
    const isNew = noteId === null;
    const [title, setTitle] = import_react7.useState("");
    const [body, setBody] = import_react7.useState("");
    const [isSaving, setIsSaving] = import_react7.useState(false);
    const [status, setStatus] = import_react7.useState(isNew ? "New note" : "Loading…");
    import_react7.useEffect(() => {
      if (!isNew) {
        db.query("SELECT * FROM notes WHERE id=?", [noteId]).then(([note]) => {
          if (note) {
            setTitle(note.title);
            setBody(note.body);
            setStatus("");
            veloxWindow.setTitle(note.title || "Edit Note");
          } else {
            setStatus("Note not found.");
          }
        }).catch((e) => setStatus("Load error: " + e.message));
      } else {
        veloxWindow.setTitle("New Note");
      }
    }, [noteId, isNew]);
    const save = import_react7.useCallback(async () => {
      if (isSaving)
        return;
      setIsSaving(true);
      setStatus("Saving…");
      try {
        const now = Date.now();
        let savedId = noteId;
        if (isNew) {
          await db.run("INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)", [title, body, now, now]);
          const [row] = await db.query("SELECT last_insert_rowid() as id");
          savedId = row.id;
        } else {
          await db.run("UPDATE notes SET title=?, body=?, updated_at=? WHERE id=?", [title, body, now, noteId]);
        }
        if (vdb) {
          const vec = embedNote(title, body);
          await vdb.upsert("notes", String(savedId), vec, {
            title,
            preview: body.slice(0, 60)
          });
        }
        await refreshNotes();
        veloxWindow.setTitle(title || "Note");
        notification.send({ title: "Notes", body: `"${title || "Untitled"}" saved.` }).catch(() => {});
        setStatus("Saved ✓");
        if (isNew) {
          navigate("edit", { noteId: savedId }, { replace: true });
        }
      } catch (e) {
        setStatus("Save error: " + e.message);
      } finally {
        setIsSaving(false);
      }
    }, [title, body, noteId, isNew, vdb, refreshNotes, navigate, isSaving]);
    const deleteNote = import_react7.useCallback(async () => {
      if (isNew) {
        navigate("back");
        return;
      }
      setStatus("Deleting…");
      try {
        await db.run("DELETE FROM notes WHERE id=?", [noteId]);
        await refreshNotes();
        navigate("back");
      } catch (e) {
        setStatus("Delete error: " + e.message);
      }
    }, [isNew, noteId, refreshNotes, navigate]);
    const copyToClipboard = import_react7.useCallback(() => {
      const content = title ? `${title}

${body}` : body;
      clipboard.writeText(content).then(() => setStatus("Copied to clipboard ✓")).catch((e) => setStatus("Clipboard error: " + e.message));
    }, [title, body]);
    const exportNote = import_react7.useCallback(async () => {
      try {
        const path = await dialog.saveFile({
          defaultName: (title || "note").replace(/[^a-z0-9]/gi, "-").toLowerCase() + ".txt",
          filters: [{ name: "Text Files", extensions: ["txt"] }]
        });
        if (!path) {
          setStatus("Export cancelled.");
          return;
        }
        const content = `${title}
${"─".repeat(Math.min(title.length, 60))}

${body}`;
        await fs.writeFile(path, content);
        setStatus("Exported to " + path.split(/[/\\]/).pop());
      } catch (e) {
        setStatus("Export error: " + e.message);
      }
    }, [title, body]);
    const contentW = winW - 2 * PAD;
    const contentH = winH - HEADER_H - 2 * PAD;
    const inner = contentW - 32;
    const sideW = isWide ? 260 : inner;
    const editorW = isWide ? inner - sideW - 16 : inner;
    const bodyH = isWide ? Math.max(220, contentH - 180) : Math.max(120, contentH - 320);
    const titleWords = countWords(title);
    const bodyWords = countWords(body);
    const statusTone = status.toLowerCase().includes("error") ? C2.red : C2.green;
    return /* @__PURE__ */ jsx_runtime.jsx(View, {
      style: {
        backgroundColor: C2.overlay,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C2.border,
        padding: 16,
        gap: 10,
        justifyContent: "flex-start",
        alignItems: "flex-start"
      },
      width: contentW,
      height: contentH,
      children: /* @__PURE__ */ jsx_runtime.jsxs(View, {
        style: {
          flexDirection: isWide ? "row" : "column",
          gap: 16,
          alignItems: "flex-start"
        },
        width: inner,
        height: isWide ? contentH - 32 : contentH - 32,
        children: [
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: {
              backgroundColor: C2.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C2.border,
              padding: 14,
              gap: 10,
              justifyContent: "flex-start",
              alignItems: "flex-start"
            },
            width: sideW,
            height: isWide ? contentH - 32 : 210,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 18,
                width: sideW - 28,
                height: 24,
                style: { color: C2.text },
                children: isNew ? "Compose a new note" : "Refine your note"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: sideW - 28,
                style: { color: C2.subtle },
                children: "Use this space to capture ideas, polish drafts, and export finished thoughts."
              }),
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { flexDirection: "row", gap: 8 },
                width: sideW - 28,
                height: 52,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(StatPill, {
                    label: "Title words",
                    value: String(titleWords),
                    tone: C2.accent,
                    width: 110
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(StatPill, {
                    label: "Body words",
                    value: String(bodyWords),
                    tone: C2.teal,
                    width: 110
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx(StatPill, {
                label: "Characters",
                value: String(body.length),
                tone: C2.mauve,
                width: sideW - 28
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Divider, {
                width: sideW - 28
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: isSaving ? "Saving…" : "Save Note",
                onPress: save,
                width: sideW - 28,
                color: C2.green,
                disabled: isSaving || !dbReady,
                filled: true
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "⎘ Copy",
                onPress: copyToClipboard,
                width: sideW - 28,
                color: C2.accent
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "↓ Export",
                onPress: exportNote,
                width: sideW - 28,
                color: C2.yellow
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: isNew ? "Discard Draft" : "Delete Note",
                onPress: deleteNote,
                width: sideW - 28,
                color: C2.red
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: sideW - 28,
                style: { color: statusTone },
                children: status
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 10,
                width: sideW - 28,
                style: { color: C2.dim },
                children: "Saving also refreshes semantic embeddings for search."
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: {
              backgroundColor: C2.overlay,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C2.border,
              padding: 16,
              gap: 12,
              justifyContent: "flex-start",
              alignItems: "flex-start"
            },
            width: editorW,
            height: isWide ? contentH - 32 : contentH - 258,
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: {
                  backgroundColor: C2.surfaceAlt,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: C2.accent,
                  padding: 12,
                  gap: 4
                },
                width: editorW - 32,
                height: 72,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 14,
                    width: editorW - 56,
                    height: 20,
                    style: { color: C2.text },
                    children: isNew ? "Writing Canvas" : "Editing Canvas"
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 11,
                    width: editorW - 56,
                    style: { color: C2.subtle },
                    children: "A cleaner composition with stronger spacing, theme-aware accents, and clearer hierarchy."
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx(SectionLabel, {
                label: "TITLE",
                width: editorW - 32
              }),
              /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
                value: title,
                onChangeText: setTitle,
                placeholder: "Note title…",
                fontSize: 16,
                width: editorW - 32,
                height: 44
              }),
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { flexDirection: "row", justifyContent: "flex-start", gap: 8 },
                width: editorW - 32,
                height: 16,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(SectionLabel, {
                    label: "BODY",
                    width: editorW - 120
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 10,
                    width: 112,
                    height: 14,
                    style: { color: C2.dim },
                    children: body.length + " chars  •  " + bodyWords + " words"
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
                value: body,
                onChangeText: setBody,
                placeholder: "Start writing…",
                fontSize: 13,
                multiline: true,
                width: editorW - 32,
                height: bodyH
              })
            ]
          })
        ]
      })
    });
  }
  function NoteSearchScreen() {
    const { width: winW, height: winH } = useWindowSize();
    const isWide = useMediaQuery(1080);
    const C2 = useThemeColors();
    const { vdb, dbReady } = useNotesCtx();
    const navigate = useNavigate();
    const [query, setQuery] = import_react7.useState("");
    const [results, setResults] = import_react7.useState([]);
    const [isSearching, setIsSearching] = import_react7.useState(false);
    const [status, setStatus] = import_react7.useState("Enter a phrase and press Search.");
    import_react7.useEffect(() => {
      veloxWindow.setTitle("Notes — Semantic Search");
    }, []);
    const search = import_react7.useCallback(async () => {
      if (!vdb || !query.trim())
        return;
      setIsSearching(true);
      setStatus("Searching…");
      try {
        const vec = embedNote(query, "");
        const hits = await vdb.search("notes", vec, 8);
        const meaningful = hits.filter((h) => h.score > 0);
        if (meaningful.length === 0) {
          setResults([]);
          setStatus('No semantic matches. Try topic words like "meeting", "todo", "code"…');
          return;
        }
        const rows = await Promise.all(meaningful.map(async (hit) => {
          const [note] = await db.query("SELECT * FROM notes WHERE id=?", [parseInt(hit.id)]);
          return note ? { ...note, score: hit.score } : null;
        }));
        const found = rows.filter(Boolean);
        setResults(found);
        setStatus(`${found.length} result${found.length === 1 ? "" : "s"} by cosine similarity`);
      } catch (e) {
        setStatus("Search error: " + e.message);
      } finally {
        setIsSearching(false);
      }
    }, [vdb, query]);
    const contentW = winW - 2 * PAD;
    const contentH = winH - HEADER_H - 2 * PAD;
    const inner = contentW - 32;
    const sideW = isWide ? 250 : inner;
    const resultsW = isWide ? inner - sideW - 16 : inner;
    const svH = isWide ? contentH - 150 : contentH - 250;
    const svContentH = results.length * 94 + 16;
    return /* @__PURE__ */ jsx_runtime.jsx(View, {
      style: {
        backgroundColor: C2.overlay,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C2.border,
        padding: 16,
        gap: 10,
        justifyContent: "flex-start",
        alignItems: "flex-start"
      },
      width: contentW,
      height: contentH,
      children: /* @__PURE__ */ jsx_runtime.jsxs(View, {
        style: {
          flexDirection: isWide ? "row" : "column",
          gap: 16,
          alignItems: "flex-start"
        },
        width: inner,
        height: contentH - 32,
        children: [
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: {
              backgroundColor: C2.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C2.border,
              padding: 14,
              gap: 10,
              justifyContent: "flex-start",
              alignItems: "flex-start"
            },
            width: sideW,
            height: isWide ? contentH - 32 : 220,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 18,
                width: sideW - 28,
                height: 24,
                style: { color: C2.mauve },
                children: "Semantic Search"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: sideW - 28,
                style: { color: C2.subtle },
                children: "Search by meaning instead of exact wording. Topic words like meeting, todo, code, or idea work best."
              }),
              /* @__PURE__ */ jsx_runtime.jsx(StatPill, {
                label: "Results",
                value: String(results.length),
                tone: C2.mauve,
                width: sideW - 28
              }),
              /* @__PURE__ */ jsx_runtime.jsx(StatPill, {
                label: "Status",
                value: isSearching ? "Working" : "Ready",
                tone: C2.teal,
                width: sideW - 28
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Divider, {
                width: sideW - 28
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 10,
                width: sideW - 28,
                style: { color: C2.dim },
                children: `Embedding: 20-dim keyword presence vector.
Ranking: cosine similarity across stored note vectors.`
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: {
              backgroundColor: C2.overlay,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C2.border,
              padding: 16,
              gap: 12,
              justifyContent: "flex-start",
              alignItems: "flex-start"
            },
            width: resultsW,
            height: isWide ? contentH - 32 : contentH - 268,
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: {
                  backgroundColor: C2.surfaceAlt,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: C2.mauve,
                  padding: 12,
                  gap: 6
                },
                width: resultsW - 32,
                height: 80,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 14,
                    width: resultsW - 56,
                    height: 20,
                    style: { color: C2.text },
                    children: "Discovery Mode"
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 11,
                    width: resultsW - 56,
                    style: { color: C2.subtle },
                    children: "Find notes that feel related, even when they do not share the exact same words."
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { flexDirection: "row", gap: 10 },
                width: resultsW - 32,
                height: 36,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
                    value: query,
                    onChangeText: setQuery,
                    placeholder: "e.g. meeting agenda, code review, shopping…",
                    fontSize: 13,
                    width: resultsW - 130,
                    height: 36
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                    label: isSearching ? "Searching…" : "Search",
                    onPress: search,
                    width: 88,
                    color: C2.mauve,
                    disabled: isSearching || !vdb || !query.trim(),
                    filled: true
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: resultsW - 32,
                height: 16,
                style: { color: C2.dim },
                children: status
              }),
              results.length > 0 ? /* @__PURE__ */ jsx_runtime.jsxs(jsx_runtime.Fragment, {
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(SectionLabel, {
                    label: "RESULTS",
                    width: resultsW - 32
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
                    width: resultsW - 32,
                    height: Math.max(80, svH),
                    contentHeight: svContentH,
                    style: { gap: 10 },
                    children: results.map((note) => /* @__PURE__ */ jsx_runtime.jsxs(View, {
                      style: {
                        flexDirection: "row",
                        gap: 12,
                        alignItems: "flex-start",
                        backgroundColor: C2.surface,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: C2.border,
                        padding: 12
                      },
                      width: resultsW - 32,
                      height: 84,
                      children: [
                        /* @__PURE__ */ jsx_runtime.jsxs(View, {
                          style: { backgroundColor: C2.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: C2.mauve, padding: 8 },
                          width: 58,
                          height: 58,
                          children: [
                            /* @__PURE__ */ jsx_runtime.jsx(Text, {
                              fontSize: 16,
                              width: 40,
                              height: 22,
                              style: { color: C2.mauve },
                              children: (note.score * 100).toFixed(0)
                            }),
                            /* @__PURE__ */ jsx_runtime.jsx(Text, {
                              fontSize: 9,
                              width: 40,
                              height: 12,
                              style: { color: C2.dim },
                              children: "% match"
                            })
                          ]
                        }),
                        /* @__PURE__ */ jsx_runtime.jsxs(View, {
                          style: { gap: 5, justifyContent: "flex-start", alignItems: "flex-start" },
                          width: resultsW - 114,
                          height: 58,
                          children: [
                            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                              onPress: () => navigate("edit", { noteId: note.id }),
                              width: resultsW - 114,
                              height: 20,
                              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                                fontSize: 14,
                                width: resultsW - 120,
                                height: 20,
                                style: { color: C2.accent },
                                children: note.title || "(untitled)"
                              })
                            }),
                            /* @__PURE__ */ jsx_runtime.jsx(Text, {
                              fontSize: 11,
                              width: resultsW - 114,
                              height: 30,
                              style: { color: C2.subtle },
                              children: (note.body || "").slice(0, 96) + (note.body?.length > 96 ? "…" : "")
                            })
                          ]
                        })
                      ]
                    }, note.id))
                  })
                ]
              }) : /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: {
                  backgroundColor: C2.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: C2.border,
                  padding: 16
                },
                width: resultsW - 32,
                height: 92,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: resultsW - 64,
                    height: 18,
                    style: { color: C2.subtle },
                    children: "No semantic results yet."
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 10,
                    width: resultsW - 64,
                    style: { color: C2.dim },
                    children: 'Try topic-driven queries like "project idea", "shopping", or "release review".'
                  })
                ]
              })
            ]
          })
        ]
      })
    });
  }
  function SysApiScreen() {
    const { width: winW, height: winH } = useWindowSize();
    const navigate = useNavigate();
    const C2 = useThemeColors();
    const inner = winW - PAD * 2;
    const [battInfo, setBattInfo] = import_react7.useState(null);
    const [sysInfo, setSysInfo] = import_react7.useState(null);
    const [drives, setDrives] = import_react7.useState([]);
    const [gamepadLog, setGamepadLog] = import_react7.useState([]);
    const [shortcutLog, setShortcutLog] = import_react7.useState([]);
    const [sleepGuard, setSleepGuard] = import_react7.useState(null);
    const darkMode = system.getDarkMode();
    const batterySaver = system.isBatterySaverActive();
    const perfSnap = perf.snapshot();
    import_react7.useEffect(() => {
      battery.getStatus().then((b) => setBattInfo(b));
      system.getInfo().then((s) => setSysInfo(s));
      storage.getDrives().then((d) => setDrives(d));
    }, []);
    import_react7.useEffect(() => {
      const unsub = input.gamepads.onInput((ev) => {
        setGamepadLog((prev) => [`${ev.event?.type ?? "?"} @ ${ev.name ?? ev.id}`, ...prev].slice(0, 6));
      });
      return unsub;
    }, []);
    import_react7.useEffect(() => {
      const id = input.shortcut.register("ctrl+g", () => {
        setShortcutLog((prev) => ["Ctrl+G fired!", ...prev].slice(0, 6));
      });
      return () => input.shortcut.unregister(id);
    }, []);
    function toggleSleepGuard() {
      if (sleepGuard) {
        power.allowSleep(sleepGuard);
        setSleepGuard(null);
      } else {
        const g = power.preventSleep("SysApiScreen demo");
        setSleepGuard(g);
      }
    }
    const Row = ({ label, value, tone }) => /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: { flexDirection: "row", gap: 8, alignItems: "center" },
      width: inner,
      height: 22,
      children: [
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 11,
          width: 160,
          height: 16,
          style: { color: C2.dim },
          children: label
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 12,
          width: inner - 176,
          height: 16,
          style: { color: tone ?? C2.text },
          children: String(value ?? "—")
        })
      ]
    });
    const Section = ({ title, children }) => /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: { gap: 6, justifyContent: "flex-start", alignItems: "flex-start" },
      width: inner,
      children: [
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C2.accent },
          children: title
        }),
        children,
        /* @__PURE__ */ jsx_runtime.jsx(View, {
          style: { backgroundColor: C2.border },
          width: inner,
          height: 1
        })
      ]
    });
    return /* @__PURE__ */ jsx_runtime.jsxs(ScrollView, {
      width: inner,
      height: winH - HEADER_H - PAD * 2,
      contentHeight: 900,
      style: { gap: 16, justifyContent: "flex-start", alignItems: "flex-start" },
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 8, alignItems: "center" },
          width: inner,
          height: 32,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 16,
              width: 200,
              height: 22,
              style: { color: C2.yellow },
              children: "OS System APIs"
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Section, {
          title: "Battery",
          children: battInfo ? /* @__PURE__ */ jsx_runtime.jsxs(jsx_runtime.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "Level",
                value: `${Math.round(battInfo.level * 100)}%`,
                tone: battInfo.charging ? C2.green : C2.accent
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "Charging",
                value: battInfo.charging ? "Yes" : "No"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "Time remaining",
                value: battInfo.timeRemainingSecs != null ? `${Math.round(battInfo.timeRemainingSecs / 60)} min` : "Unknown"
              })
            ]
          }) : /* @__PURE__ */ jsx_runtime.jsx(Row, {
            label: "Status",
            value: "No battery detected (desktop?)",
            tone: C2.dim
          })
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(Section, {
          title: "System Info",
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Row, {
              label: "Color scheme",
              value: darkMode,
              tone: darkMode === "dark" ? C2.mauve : C2.yellow
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Row, {
              label: "Battery saver",
              value: batterySaver ? "Active" : "Off",
              tone: batterySaver ? C2.green : C2.dim
            }),
            sysInfo ? /* @__PURE__ */ jsx_runtime.jsxs(jsx_runtime.Fragment, {
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Row, {
                  label: "CPU",
                  value: sysInfo.cpuName
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Row, {
                  label: "Cores",
                  value: sysInfo.cpuCores
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Row, {
                  label: "RAM total",
                  value: `${sysInfo.memoryTotalMb} MB`
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Row, {
                  label: "RAM used",
                  value: `${sysInfo.memoryUsedMb} MB`,
                  tone: C2.yellow
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Row, {
                  label: "OS",
                  value: `${sysInfo.osName} ${sysInfo.osVersion}`
                })
              ]
            }) : /* @__PURE__ */ jsx_runtime.jsx(Row, {
              label: "Loading…",
              value: ""
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Section, {
          title: "Storage Drives",
          children: drives.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx(Row, {
            label: "No drives found",
            value: "",
            tone: C2.dim
          }) : drives.map((d, i) => /* @__PURE__ */ jsx_runtime.jsx(Row, {
            label: `${d.name} (${d.mountPoint})`,
            value: `${(d.availableBytes / 1e9).toFixed(1)} GB free / ${(d.totalBytes / 1e9).toFixed(1)} GB`,
            tone: C2.teal
          }, i))
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Section, {
          title: "Performance Snapshot",
          children: perfSnap ? /* @__PURE__ */ jsx_runtime.jsxs(jsx_runtime.Fragment, {
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "FPS",
                value: perfSnap.fps?.toFixed(1),
                tone: C2.green
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "Frame time",
                value: `${perfSnap.frameTime?.toFixed(2)} ms`
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "Frame P99",
                value: `${perfSnap.frameTimeP99?.toFixed(2)} ms`,
                tone: C2.yellow
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "JS time",
                value: `${perfSnap.jsTime?.toFixed(2)} ms`
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "Layout time",
                value: `${perfSnap.layoutTime?.toFixed(2)} ms`
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "Heap JS",
                value: `${perfSnap.memoryJS?.toFixed(1)} MB`
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Row, {
                label: "Nodes",
                value: perfSnap.nodeCount
              })
            ]
          }) : /* @__PURE__ */ jsx_runtime.jsx(Row, {
            label: "Loading…",
            value: ""
          })
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(Section, {
          title: "Sleep Prevention",
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Row, {
              label: "Guard active",
              value: sleepGuard ? "Yes — system will not sleep" : "No",
              tone: sleepGuard ? C2.green : C2.dim
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Btn, {
              label: sleepGuard ? "Allow Sleep" : "Prevent Sleep",
              onPress: toggleSleepGuard,
              width: 130,
              color: sleepGuard ? C2.red : C2.accent
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Section, {
          title: "Gamepad Events (connect a controller)",
          children: gamepadLog.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx(Row, {
            label: "No events yet",
            value: "",
            tone: C2.dim
          }) : gamepadLog.map((e, i) => /* @__PURE__ */ jsx_runtime.jsx(Row, {
            label: `Event ${i + 1}`,
            value: e,
            tone: C2.mauve
          }, i))
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(Section, {
          title: "App-focused Shortcut (Ctrl+G)",
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Row, {
              label: "Press Ctrl+G while this screen is open",
              value: "",
              tone: C2.dim
            }),
            shortcutLog.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx(Row, {
              label: "No shortcut fired yet",
              value: "",
              tone: C2.dim
            }) : shortcutLog.map((e, i) => /* @__PURE__ */ jsx_runtime.jsx(Row, {
              label: `Fire ${i + 1}`,
              value: e,
              tone: C2.green
            }, i))
          ]
        })
      ]
    });
  }
  function FormDemoScreen() {
    const { width: winW, height: winH } = useWindowSize();
    const navigate = useNavigate();
    const C2 = useThemeColors();
    const inner = winW - PAD * 2;
    const [checked, setChecked] = import_react7.useState(false);
    const [switched, setSwitched] = import_react7.useState(false);
    const [radioVal, setRadioVal] = import_react7.useState("option_a");
    const [pickedFile, setPickedFile] = import_react7.useState(null);
    const [credStatus, setCredStatus] = import_react7.useState("");
    const [sliderVal, setSliderVal] = import_react7.useState(0.4);
    const [selectVal, setSelectVal] = import_react7.useState(null);
    const [dateVal, setDateVal] = import_react7.useState(null);
    async function testCredentials() {
      try {
        await credentials.set("demo-token", "velox-secret-1234");
        const val = await credentials.get("demo-token");
        setCredStatus("Stored & retrieved: " + val);
        await credentials.delete("demo-token");
      } catch (e) {
        setCredStatus("Error: " + e);
      }
    }
    return /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
      width: winW,
      height: winH - HEADER_H - PAD,
      contentHeight: 1400,
      children: /* @__PURE__ */ jsx_runtime.jsxs(View, {
        style: { gap: 20, padding: PAD, alignItems: "flex-start", justifyContent: "flex-start" },
        width: inner,
        children: [
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: { flexDirection: "row", gap: 12, alignItems: "center" },
            width: inner,
            height: 34,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 16,
                width: inner - 100,
                height: 22,
                style: { color: C2.text },
                children: "Form Fields"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(FormSection, {
            title: "CHECKBOX",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Checkbox, {
                checked,
                onChange: setChecked,
                label: checked ? "Checked ✓" : "Unchecked"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Checkbox, {
                checked: true,
                disabled: true,
                label: "Disabled (checked)"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Checkbox, {
                checked: false,
                disabled: true,
                label: "Disabled (unchecked)"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(FormSection, {
            title: "SWITCH",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { flexDirection: "row", alignItems: "center", gap: 12 },
                width: inner,
                height: 28,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Switch, {
                    value: switched,
                    onValueChange: setSwitched
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 13,
                    width: inner - 64,
                    height: 18,
                    style: { color: C2.subtle },
                    children: switched ? "On" : "Off"
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { flexDirection: "row", alignItems: "center", gap: 12 },
                width: inner,
                height: 28,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Switch, {
                    value: true,
                    disabled: true
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 13,
                    width: inner - 64,
                    height: 18,
                    style: { color: C2.dim },
                    children: "Disabled (on)"
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(FormSection, {
            title: "RADIO GROUP",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs(RadioGroup, {
                value: radioVal,
                onValueChange: setRadioVal,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Radio, {
                    value: "option_a",
                    label: "Option A"
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Radio, {
                    value: "option_b",
                    label: "Option B"
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Radio, {
                    value: "option_c",
                    label: "Option C"
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Radio, {
                    value: "option_d",
                    label: "Disabled option",
                    disabled: true
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                width: inner,
                height: 18,
                style: { color: C2.dim },
                children: "Selected: " + radioVal
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(FormSection, {
            title: "FILE INPUT (requires dialog capability)",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(FileInput, {
                accept: ".txt,.md,.json",
                onFilesSelected: (paths) => setPickedFile(paths[0]),
                label: "Pick a text file…"
              }),
              pickedFile != null && /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: inner,
                height: 16,
                style: { color: C2.teal },
                children: pickedFile
              }),
              /* @__PURE__ */ jsx_runtime.jsx(FileInput, {
                disabled: true,
                label: "Disabled picker"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(FormSection, {
            title: "CREDENTIALS (OS keychain)",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "Test set / get / delete",
                onPress: testCredentials,
                width: 200,
                color: C2.mauve
              }),
              credStatus ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: inner,
                height: 16,
                style: { color: C2.green },
                children: credStatus
              }) : null
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(FormSection, {
            title: "SLIDER",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Slider, {
                value: sliderVal,
                onValueChange: setSliderVal,
                min: 0,
                max: 1,
                step: 0.05,
                style: { width: inner - 60 }
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                width: inner,
                height: 18,
                style: { color: C2.dim },
                children: "Value: " + sliderVal.toFixed(2)
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Slider, {
                value: 0.6,
                disabled: true,
                style: { width: inner - 60 }
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: inner,
                height: 16,
                style: { color: C2.dim },
                children: "Disabled"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(FormSection, {
            title: "SELECT",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Select, {
                value: selectVal,
                options: [
                  { label: "Catppuccin Mocha", value: "mocha" },
                  { label: "Catppuccin Latte", value: "latte" },
                  { label: "Tokyo Night", value: "tokyo" },
                  { label: "Gruvbox Dark", value: "gruvbox" }
                ],
                onValueChange: setSelectVal,
                placeholder: "Pick a theme…",
                style: { width: inner }
              }),
              selectVal && /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                width: inner,
                height: 18,
                style: { color: C2.teal },
                children: "Selected: " + selectVal
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Select, {
                disabled: true,
                placeholder: "Disabled select",
                style: { width: inner }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(FormSection, {
            title: "DATE PICKER",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(DatePicker, {
                value: dateVal,
                onValueChange: setDateVal,
                style: { width: inner }
              }),
              dateVal && /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                width: inner,
                height: 18,
                style: { color: C2.teal },
                children: "Picked: " + dateVal.toDateString()
              })
            ]
          })
        ]
      })
    });
  }
  function AudioDemoScreen() {
    const { width: winW, height: winH } = useWindowSize();
    const navigate = useNavigate();
    const C2 = useThemeColors();
    const inner = winW - PAD * 2;
    const [player, setPlayer] = import_react7.useState(null);
    const [playing, setPlaying] = import_react7.useState(false);
    const [volume, setVolume] = import_react7.useState(1);
    const [log, setLog] = import_react7.useState([]);
    function addLog(msg) {
      setLog((prev) => [msg, ...prev].slice(0, 10));
    }
    async function pickAndPlay() {
      try {
        const paths = await dialog.openFile({ filters: [{ name: "Audio", extensions: ["mp3", "flac", "ogg", "wav"] }], multiple: false });
        if (!paths || paths.length === 0)
          return;
        const src = paths[0];
        addLog("Playing: " + src.split(/[\\/]/).pop());
        const p = await audio.play(src, {
          volume,
          onEnded: () => {
            setPlaying(false);
            addLog("Playback ended.");
          }
        });
        setPlayer(p);
        setPlaying(true);
      } catch (e) {
        addLog("Error: " + e);
      }
    }
    function handlePause() {
      if (!player)
        return;
      player.pause();
      setPlaying(false);
      addLog("Paused.");
    }
    function handleResume() {
      if (!player)
        return;
      player.resume();
      setPlaying(true);
      addLog("Resumed.");
    }
    function handleStop() {
      if (!player)
        return;
      player.stop();
      setPlayer(null);
      setPlaying(false);
      addLog("Stopped.");
    }
    function adjustVolume(delta) {
      const v = Math.max(0, Math.min(2, volume + delta));
      setVolume(v);
      if (player)
        player.setVolume(v);
      addLog("Volume: " + Math.round(v * 100) + "%");
    }
    return /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
      width: winW,
      height: winH - HEADER_H - PAD,
      contentHeight: 600,
      children: /* @__PURE__ */ jsx_runtime.jsxs(View, {
        style: { gap: 16, padding: PAD, alignItems: "flex-start", justifyContent: "flex-start" },
        width: inner,
        children: [
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: { flexDirection: "row", gap: 12, alignItems: "center" },
            width: inner,
            height: 34,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 16,
                width: inner - 100,
                height: 22,
                style: { color: C2.text },
                children: "Audio Playback"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(Text, {
            fontSize: 12,
            width: inner,
            height: 18,
            style: { color: C2.dim },
            children: [
              "Requires ",
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                style: { color: C2.accent },
                children: "audio: true"
              }),
              " + ",
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                style: { color: C2.accent },
                children: "dialog: true"
              }),
              " in velox.config.json"
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: { flexDirection: "row", gap: 8 },
            width: inner,
            height: 36,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "Open file",
                onPress: pickAndPlay,
                width: 100,
                color: C2.teal
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "Pause",
                onPress: handlePause,
                width: 72,
                color: C2.yellow,
                disabled: !playing
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "Resume",
                onPress: handleResume,
                width: 80,
                color: C2.green,
                disabled: playing || !player
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "Stop",
                onPress: handleStop,
                width: 72,
                color: C2.red,
                disabled: !player
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: { flexDirection: "row", alignItems: "center", gap: 8 },
            width: inner,
            height: 34,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                width: 60,
                height: 18,
                style: { color: C2.subtle },
                children: "Volume"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "-10%",
                onPress: () => adjustVolume(-0.1),
                width: 60,
                color: C2.dim
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                width: 48,
                height: 18,
                style: { color: C2.text },
                children: Math.round(volume * 100) + "%"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Btn, {
                label: "+10%",
                onPress: () => adjustVolume(0.1),
                width: 60,
                color: C2.dim
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: { flexDirection: "row", gap: 8, alignItems: "center" },
            width: inner,
            height: 20,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: 60,
                height: 16,
                style: { color: C2.dim },
                children: "Status:"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: inner - 72,
                height: 16,
                style: { color: player ? playing ? C2.green : C2.yellow : C2.dim },
                children: player ? playing ? "Playing" : "Paused" : "Stopped"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: { backgroundColor: C2.surface, borderRadius: 6, padding: 10, gap: 4 },
            width: inner,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 10,
                width: inner - 20,
                height: 14,
                style: { color: C2.dim },
                children: "Log (newest first):"
              }),
              log.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: inner - 20,
                height: 16,
                style: { color: C2.dim },
                children: "No events yet."
              }) : log.map((l, i) => /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: inner - 20,
                height: 16,
                style: { color: C2.subtle },
                children: l
              }, i))
            ]
          })
        ]
      })
    });
  }
  function NetworkTestScreen() {
    const { width: winW, height: winH } = useWindowSize();
    const navigate = useNavigate();
    const C2 = useThemeColors();
    const inner = winW - PAD * 2;
    const [getResult, setGetResult] = import_react7.useState("");
    const [postResult, setPostResult] = import_react7.useState("");
    const [loading, setLoading] = import_react7.useState(false);
    const [error, setError] = import_react7.useState("");
    async function runGet() {
      setLoading(true);
      setError("");
      setGetResult("");
      try {
        const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
        const data = await res.json();
        setGetResult(JSON.stringify(data, null, 2));
      } catch (e) {
        setError("GET failed: " + (e?.message ?? String(e)));
      } finally {
        setLoading(false);
      }
    }
    async function runPost() {
      setLoading(true);
      setError("");
      setPostResult("");
      try {
        const res = await fetch("https://jsonplaceholder.typicode.com/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Velox test", body: "Hello from Velox fetch!", userId: 1 })
        });
        const data = await res.json();
        setPostResult(JSON.stringify(data, null, 2));
      } catch (e) {
        setError("POST failed: " + (e?.message ?? String(e)));
      } finally {
        setLoading(false);
      }
    }
    return /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: { justifyContent: "flex-start", alignItems: "flex-start", gap: 12 },
      width: winW,
      height: winH - HEADER_H - PAD * 2,
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 8, alignItems: "center" },
          width: inner,
          height: 32,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 16,
              width: 180,
              height: 22,
              style: { color: C2.teal },
              children: "Network Test (fetch)"
            }),
            loading && /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: 80,
              height: 18,
              style: { color: C2.yellow },
              children: "Loading…"
            })
          ]
        }),
        error !== "" && /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 12,
          width: inner,
          height: 18,
          style: { color: C2.red },
          children: error
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Divider, {}),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C2.subtle },
          children: "GET https://jsonplaceholder.typicode.com/todos/1"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Btn, {
          label: "Run GET",
          onPress: runGet,
          width: 100,
          color: C2.accent,
          disabled: loading
        }),
        getResult !== "" && /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
          width: inner,
          height: 180,
          contentHeight: Math.max(180, getResult.split(`
`).length * 18),
          children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
            fontSize: 12,
            width: inner - 12,
            height: getResult.split(`
`).length * 18,
            style: { color: C2.text },
            children: getResult
          })
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Divider, {}),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C2.subtle },
          children: "POST https://jsonplaceholder.typicode.com/posts"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Btn, {
          label: "Run POST",
          onPress: runPost,
          width: 110,
          color: C2.mauve,
          disabled: loading
        }),
        postResult !== "" && /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
          width: inner,
          height: 180,
          contentHeight: Math.max(180, postResult.split(`
`).length * 18),
          children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
            fontSize: 12,
            width: inner - 12,
            height: postResult.split(`
`).length * 18,
            style: { color: C2.text },
            children: postResult
          })
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Divider, {}),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C2.subtle },
          children: "WebSocket echo test — wss://echo.websocket.org"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(WsTestBox, {
          width: inner
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Divider, {}),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C2.subtle },
          children: "mDNS service discovery — browse local network services"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(MdnsTestBox, {
          width: inner
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Divider, {}),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C2.subtle },
          children: "Multi-window + IPC — open a child window and exchange messages"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(MultiWindowTestBox, {
          width: inner
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Divider, {}),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C2.subtle },
          children: "TextInput selection test (Phase 11B) — try Ctrl+A, Ctrl+C, Ctrl+V, arrows, shift+arrow"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(TextInputTestBox, {
          width: inner
        })
      ]
    });
  }
  function WsTestBox({ width }) {
    const C2 = useThemeColors();
    const [socket, setSocket] = import_react7.useState(null);
    const [log, setLog] = import_react7.useState([]);
    const [msgInput, setMsgInput] = import_react7.useState("Hello from Velox WebSocket!");
    const [status, setStatus] = import_react7.useState("disconnected");
    function addLog(line) {
      setLog((prev) => [...prev.slice(-19), line]);
    }
    async function connect() {
      setStatus("connecting…");
      try {
        const sock = await ws.connect("wss://echo.websocket.org", {
          onmessage: (ev) => addLog("← " + ev.data),
          onclose: () => {
            setStatus("disconnected");
            setSocket(null);
            addLog("— connection closed");
          }
        });
        setSocket(sock);
        setStatus("connected");
        addLog("— connected to wss://echo.websocket.org");
      } catch (e) {
        setStatus("error: " + (e?.message ?? String(e)));
      }
    }
    function send() {
      if (!socket)
        return;
      socket.send(msgInput);
      addLog("→ " + msgInput);
    }
    function disconnect() {
      socket?.close();
    }
    const logText = log.join(`
`);
    const logLines = log.length;
    return /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: { gap: 8, alignItems: "flex-start" },
      width,
      height: 230,
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 8, alignItems: "center" },
          width,
          height: 30,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: 120,
              height: 18,
              style: { color: status === "connected" ? C2.green : C2.dim },
              children: status
            }),
            !socket ? /* @__PURE__ */ jsx_runtime.jsx(Btn, {
              label: "Connect",
              onPress: connect,
              width: 90,
              color: C2.teal
            }) : /* @__PURE__ */ jsx_runtime.jsx(Btn, {
              label: "Disconnect",
              onPress: disconnect,
              width: 100,
              color: C2.red
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 8 },
          width,
          height: 36,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: msgInput,
              onChangeText: setMsgInput,
              placeholder: "Message to send…",
              fontSize: 13,
              width: width - 110,
              height: 36
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Btn, {
              label: "Send",
              onPress: send,
              width: 90,
              color: C2.accent,
              disabled: !socket
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
          width,
          height: 140,
          contentHeight: Math.max(140, logLines * 18),
          children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
            fontSize: 12,
            width: width - 12,
            height: Math.max(140, logLines * 18),
            style: { color: C2.text },
            children: logText || "(no messages yet)"
          })
        })
      ]
    });
  }
  function MdnsTestBox({ width }) {
    const C2 = useThemeColors();
    const [busy, setBusy] = import_react7.useState(false);
    const [svcType, setSvcType] = import_react7.useState("_http._tcp.local.");
    const [timeout, setTimeout_] = import_react7.useState("4000");
    const [results, setResults] = import_react7.useState(null);
    const [error, setError] = import_react7.useState("");
    async function discover() {
      setBusy(true);
      setResults(null);
      setError("");
      try {
        const found = await mdns.discover(svcType.trim(), { timeout: Number(timeout) || 4000 });
        setResults(found);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    }
    const rowStyle = { flexDirection: "row", alignItems: "center", gap: 8 };
    return /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: { gap: 8 },
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: rowStyle,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: 70,
              height: 20,
              style: { color: C2.subtle },
              children: "Service:"
            }),
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: svcType,
              onChangeText: setSvcType,
              width: width - 170,
              height: 28,
              fontSize: 12,
              style: { flex: 1 }
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: 40,
              height: 20,
              style: { color: C2.subtle },
              children: "ms:"
            }),
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: timeout,
              onChangeText: setTimeout_,
              width: 60,
              height: 28,
              fontSize: 12
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: discover,
              style: {
                backgroundColor: busy ? C2.dim : C2.accent,
                borderRadius: 5,
                padding: 6
              },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                height: 16,
                style: { color: "#fff" },
                children: busy ? "Scanning…" : "Browse"
              })
            })
          ]
        }),
        error ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 11,
          width,
          height: 16,
          style: { color: "#ff6b6b" },
          children: error
        }) : null,
        results !== null && (results.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 12,
          width,
          height: 18,
          style: { color: C2.dim },
          children: "No services found"
        }) : /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
          width,
          height: 120,
          style: { backgroundColor: C2.overlay, borderRadius: 6 },
          children: results.map((s, i) => /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: { padding: 6, gap: 2 },
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                width: width - 20,
                height: 16,
                style: { color: C2.text },
                children: s.name
              }),
              /* @__PURE__ */ jsx_runtime.jsxs(Text, {
                fontSize: 11,
                width: width - 20,
                height: 14,
                style: { color: C2.subtle },
                children: [
                  s.hostname,
                  ":",
                  s.port,
                  " — ",
                  s.addresses.join(", ")
                ]
              })
            ]
          }, i))
        }))
      ]
    });
  }
  function MultiWindowTestBox({ width }) {
    const C2 = useThemeColors();
    const [winHandle, setWinHandle] = import_react7.useState(null);
    const [status, setStatus] = import_react7.useState("not created");
    const [log, setLog] = import_react7.useState([]);
    const [msgText, setMsgText] = import_react7.useState("Hello from main window!");
    import_react7.useEffect(() => {
      const unsub = ipc.on("message", (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          msg = null;
        }
        if (msg && msg.type === "ping") {
          setLog((l) => [...l, `← ping from ${msg.from}: "${msg.data}"`]);
          ipc.send(msg.from, JSON.stringify({ type: "pong", from: "child", data: "Pong from child window!" }));
        } else {
          setLog((l) => [...l, `← ${raw}`]);
        }
      });
      return unsub;
    }, []);
    async function openWindow() {
      setStatus("opening…");
      setLog([]);
      try {
        const win = await veloxWindow.create({ title: "Velox IPC Child", width: 520, height: 460 });
        setWinHandle(win);
        setStatus(`opened (handle ${win.id})`);
        setLog((l) => [...l, `Window opened (id=${win.id}). Sending ping…`]);
        win.send(JSON.stringify({ type: "ping", from: 0, data: "Hello from main window!" }));
      } catch (e) {
        setStatus("error: " + String(e));
      }
    }
    function sendMsg() {
      if (!winHandle)
        return;
      winHandle.send(msgText);
      setLog((l) => [...l, `→ ${msgText}`]);
    }
    const rowStyle = { flexDirection: "row", alignItems: "center", gap: 8 };
    return /* @__PURE__ */ jsx_runtime.jsxs(View, {
      style: { gap: 8 },
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: rowStyle,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Btn, {
              label: winHandle ? "Window open" : "Open Child Window",
              onPress: openWindow,
              width: 160,
              color: winHandle ? C2.dim : C2.mauve,
              disabled: !!winHandle
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: width - 176,
              height: 20,
              style: { color: C2.subtle },
              children: status
            })
          ]
        }),
        winHandle && /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: rowStyle,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: msgText,
              onChangeText: setMsgText,
              width: width - 96,
              height: 28,
              fontSize: 12
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Btn, {
              label: "Send",
              onPress: sendMsg,
              width: 80,
              color: C2.accent
            })
          ]
        }),
        log.length > 0 && /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
          width,
          height: Math.min(120, log.length * 18 + 12),
          contentHeight: log.length * 18 + 12,
          style: { backgroundColor: C2.overlay, borderRadius: 6, padding: 6 },
          children: log.map((line, i) => /* @__PURE__ */ jsx_runtime.jsx(Text, {
            fontSize: 11,
            width: width - 24,
            height: 18,
            style: { color: C2.text },
            children: line
          }, i))
        })
      ]
    });
  }
  function TextInputTestBox({ width }) {
    const C2 = useThemeColors();
    const [val, setVal] = import_react7.useState("Hello, Velox! Edit me and try Ctrl+A to select all.");
    return /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
      value: val,
      onChangeText: setVal,
      placeholder: "Type here to test cursor and selection…",
      fontSize: 14,
      width,
      height: 40
    });
  }
  function CanvasDemoScreen() {
    const { width: winW } = useWindowSize();
    const inner = winW - PAD * 2;
    const canvasRef = import_react7.default.useRef(null);
    const angleRef = import_react7.default.useRef(0);
    import_react7.useEffect(() => {
      let raf;
      function loop() {
        const ctx = canvasRef.current;
        if (ctx) {
          const t = angleRef.current;
          angleRef.current += 0.04;
          ctx.clear();
          ctx.strokeStyle = "#1e2030";
          ctx.lineWidth = 1;
          for (let x = 0;x <= 300; x += 30)
            ctx.strokeLine(x, 0, x, 200);
          for (let y = 0;y <= 200; y += 30)
            ctx.strokeLine(0, y, 300, y);
          const cx = 150 + Math.cos(t) * 60;
          const cy = 100 + Math.sin(t) * 40;
          ctx.fillStyle = [100, 140, 255, 200];
          ctx.fillRect(cx - 20, cy - 15, 40, 30);
          const cx2 = 150 + Math.cos(t + 2) * 60;
          const cy2 = 100 + Math.sin(t + 2) * 40;
          ctx.fillStyle = [255, 100, 140, 200];
          ctx.fillRect(cx2 - 20, cy2 - 15, 40, 30);
          const r = 18 + Math.sin(t * 2) * 8;
          ctx.fillStyle = [120, 220, 160, 220];
          ctx.fillCircle(150, 100, r);
          ctx.strokeStyle = [255, 200, 80, 180];
          ctx.lineWidth = 2;
          for (let i = 0;i < 6; i++) {
            const a = t + i * Math.PI / 3;
            ctx.strokeLine(150, 100, 150 + Math.cos(a) * 70, 100 + Math.sin(a) * 70);
          }
          ctx.strokeStyle = [200, 200, 255, 120];
          ctx.lineWidth = 1;
          ctx.strokeCircle(150, 100, 70);
          ctx.fillStyle = [220, 230, 255, 255];
          ctx.fillText("Canvas 2D", 6, 6, 13);
          ctx.flush();
        }
        raf = setTimeout(loop, 16);
      }
      loop();
      return () => clearTimeout(raf);
    }, []);
    const c3dRef = import_react7.default.useRef(null);
    const [angle3d, setAngle3d] = import_react7.useState(0);
    import_react7.useEffect(() => {
      const id = setInterval(() => setAngle3d((a) => a + 0.02), 33);
      return () => clearInterval(id);
    }, []);
    return /* @__PURE__ */ jsx_runtime.jsxs(ScrollView, {
      width: inner,
      height: 600,
      style: { gap: 20 },
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", alignItems: "center", gap: 12 },
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 18,
              height: 24,
              style: { color: C.text },
              children: "Canvas Demo"
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C.dim },
          children: "2D Canvas — Vello primitives, animated each frame"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Canvas, {
          ref: canvasRef,
          width: 300,
          height: 200,
          style: { borderRadius: 8, borderWidth: 1, borderColor: C.border }
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 13,
          width: inner,
          height: 18,
          style: { color: C.dim },
          children: "3D Canvas — declarative @velox/three (R3F-style)"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Canvas3D, {
          ref: c3dRef,
          width: 300,
          height: 220,
          style: { borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: "#0f1120" },
          children: /* @__PURE__ */ jsx_runtime.jsxs(Scene, {
            canvasRef: c3dRef,
            background: [0.06, 0.067, 0.125, 1],
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(PerspectiveCamera, {
                position: [0, 1.2, 3.5],
                target: [0, 0, 0],
                fov: 55,
                near: 0.1,
                far: 100
              }),
              /* @__PURE__ */ jsx_runtime.jsx(AmbientLight, {
                color: [1, 1, 1],
                intensity: 0.25
              }),
              /* @__PURE__ */ jsx_runtime.jsx(DirectionalLight, {
                direction: [-0.5, -1, -0.8],
                color: [1, 0.94, 0.82],
                intensity: 1
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Mesh, {
                geometry: "box",
                rotation: [0, angle3d, 0],
                color: [0.39, 0.55, 1, 1]
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Mesh, {
                geometry: "plane",
                position: [0, -0.5, 0],
                scale: [4, 1, 4],
                color: [0.157, 0.176, 0.275, 1]
              })
            ]
          })
        })
      ]
    });
  }
  var AI_TABS = ["Embed", "Generate", "Transcribe"];
  function AiDemoScreen() {
    const { width: winW } = useWindowSize();
    const inner = winW - PAD * 2;
    const C2 = useThemeColors();
    const [tab, setTab] = import_react7.useState(0);
    const [loading, setLoading] = import_react7.useState(false);
    const [result, setResult] = import_react7.useState("");
    const [error, setError] = import_react7.useState("");
    const [embedText, setEmbedText] = import_react7.useState("The quick brown fox jumps over the lazy dog.");
    const [prompt, setPrompt] = import_react7.useState("Write a haiku about a Rust crate that renders UI:");
    const [maxTokens, setMaxTokens] = import_react7.useState(80);
    const [temperature, setTemperature] = import_react7.useState(0.7);
    const [audioPath, setAudioPath] = import_react7.useState("");
    function reset() {
      setResult("");
      setError("");
    }
    async function runEmbed() {
      reset();
      setLoading(true);
      try {
        const vec = await ai.embed(embedText);
        const preview = vec.slice(0, 8).map((v) => v.toFixed(4)).join(", ");
        setResult(`384-dim vector (first 8):
[${preview}, …]

L2 norm ≈ ${Math.sqrt(vec.reduce((s, v) => s + v * v, 0)).toFixed(6)}`);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    async function runGenerate() {
      reset();
      setLoading(true);
      try {
        const text2 = await ai.generate(prompt, { maxTokens, temperature });
        setResult(text2);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    async function runTranscribe() {
      if (!audioPath) {
        setError("Pick an audio file first.");
        return;
      }
      reset();
      setLoading(true);
      try {
        const transcript = await ai.transcribe(audioPath);
        setResult(transcript || "(no speech detected)");
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    async function pickAudio() {
      try {
        const paths = await dialog.openFile({ title: "Pick audio file", multiple: false });
        if (paths && paths.length > 0)
          setAudioPath(paths[0]);
      } catch (e) {}
    }
    return /* @__PURE__ */ jsx_runtime.jsxs(ScrollView, {
      width: inner,
      height: 620,
      style: { gap: 16 },
      children: [
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 18,
          width: inner,
          height: 24,
          style: { color: C2.text },
          children: "Local AI Demo"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 12,
          width: inner,
          height: 16,
          style: { color: C2.dim },
          children: "Models download from HuggingFace Hub on first call and cache locally."
        }),
        /* @__PURE__ */ jsx_runtime.jsx(View, {
          style: { flexDirection: "row", gap: 8 },
          width: inner,
          height: 34,
          children: AI_TABS.map((label, i) => /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
            onPress: () => {
              setTab(i);
              reset();
            },
            width: 100,
            height: 32,
            style: {
              backgroundColor: tab === i ? C2.accent : C2.surface,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: tab === i ? C2.accent : C2.border,
              justifyContent: "center",
              alignItems: "center"
            },
            children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 13,
              width: 84,
              height: 18,
              style: { color: tab === i ? C2.bg : C2.text },
              children: label
            })
          }, label))
        }),
        tab === 0 && /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { gap: 10 },
          width: inner,
          height: 280,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: inner,
              height: 16,
              style: { color: C2.dim },
              children: "MiniLM-L6-v2 · 384 dims · ~22 MB · ~1s after first download"
            }),
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: embedText,
              onChangeText: setEmbedText,
              placeholder: "Text to embed…",
              width: inner,
              height: 60,
              multiline: true,
              style: { backgroundColor: C2.surface, borderRadius: 6, borderColor: C2.border, borderWidth: 1, padding: 8, color: C2.text, fontSize: 13 }
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: runEmbed,
              width: 120,
              height: 32,
              style: { backgroundColor: loading ? C2.border : C2.accent, borderRadius: 6, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                width: 100,
                height: 18,
                style: { color: C2.bg },
                children: loading ? "Embedding…" : "Embed"
              })
            })
          ]
        }),
        tab === 1 && /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { gap: 10 },
          width: inner,
          height: 280,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: inner,
              height: 16,
              style: { color: C2.dim },
              children: "Phi-2 Q4_K_M · CPU · ~1.7 GB · 10-30s per 200 tokens"
            }),
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: prompt,
              onChangeText: setPrompt,
              placeholder: "Prompt…",
              width: inner,
              height: 70,
              multiline: true,
              style: { backgroundColor: C2.surface, borderRadius: 6, borderColor: C2.border, borderWidth: 1, padding: 8, color: C2.text, fontSize: 13 }
            }),
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { flexDirection: "row", gap: 16, alignItems: "center" },
              width: inner,
              height: 28,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 12,
                  width: 80,
                  height: 16,
                  style: { color: C2.dim },
                  children: `Tokens: ${maxTokens}`
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Slider, {
                  value: maxTokens,
                  onValueChange: (v) => setMaxTokens(Math.round(v)),
                  min: 20,
                  max: 400,
                  step: 10,
                  style: { flex: 1 }
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 12,
                  width: 80,
                  height: 16,
                  style: { color: C2.dim },
                  children: `Temp: ${temperature.toFixed(2)}`
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Slider, {
                  value: temperature,
                  onValueChange: (v) => setTemperature(Math.round(v * 100) / 100),
                  min: 0,
                  max: 1.5,
                  step: 0.05,
                  style: { flex: 1 }
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: runGenerate,
              width: 140,
              height: 32,
              style: { backgroundColor: loading ? C2.border : C2.green, borderRadius: 6, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                width: 120,
                height: 18,
                style: { color: C2.bg },
                children: loading ? "Generating…" : "Generate"
              })
            })
          ]
        }),
        tab === 2 && /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { gap: 10 },
          width: inner,
          height: 280,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: inner,
              height: 16,
              style: { color: C2.dim },
              children: "Whisper-tiny · ~75 MB · ~5s for 30s clip · 16kHz WAV preferred"
            }),
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { flexDirection: "row", gap: 10, alignItems: "center" },
              width: inner,
              height: 34,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: pickAudio,
                  width: 130,
                  height: 30,
                  style: { backgroundColor: C2.surface, borderRadius: 6, borderColor: C2.border, borderWidth: 1, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 110,
                    height: 16,
                    style: { color: C2.accent },
                    children: "Pick Audio File"
                  })
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 11,
                  width: inner - 148,
                  height: 16,
                  style: { color: C2.dim },
                  children: audioPath || "No file selected"
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: runTranscribe,
              width: 130,
              height: 32,
              style: { backgroundColor: loading ? C2.border : C2.teal, borderRadius: 6, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                width: 110,
                height: 18,
                style: { color: C2.bg },
                children: loading ? "Transcribing…" : "Transcribe"
              })
            })
          ]
        }),
        (result || error) && /* @__PURE__ */ jsx_runtime.jsx(View, {
          style: {
            backgroundColor: error ? "#2a1018" : C2.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: error ? C2.red : C2.border,
            padding: 12
          },
          width: inner,
          height: 140,
          children: /* @__PURE__ */ jsx_runtime.jsx(ScrollView, {
            width: inner - 24,
            height: 116,
            children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: inner - 32,
              height: 0,
              style: { color: error ? C2.red : C2.text },
              children: error || result
            })
          })
        })
      ]
    });
  }
  var MEDIA_TABS = ["Camera", "Microphone", "Video"];
  function MediaDemoScreen() {
    const { width: winW } = useWindowSize();
    const inner = winW - PAD * 2;
    const C2 = useThemeColors();
    const [tab, setTab] = import_react7.useState(0);
    const camRef = import_react7.default.useRef(null);
    const [devices, setDevices] = import_react7.useState([]);
    const [camOpen, setCamOpen] = import_react7.useState(false);
    const [mirror, setMirror] = import_react7.useState(false);
    const [recording, setRecording] = import_react7.useState(false);
    const [photoPath, setPhotoPath] = import_react7.useState("");
    const [videoPath, setVideoPath] = import_react7.useState("");
    const [camError, setCamError] = import_react7.useState("");
    import_react7.useEffect(() => {
      camera.listDevices().then(setDevices).catch(() => {});
    }, []);
    async function startCamera() {
      setCamError("");
      setPhotoPath("");
      setVideoPath("");
      try {
        await camRef.current.start(0);
        setCamOpen(true);
      } catch (e) {
        setCamError(String(e));
      }
    }
    function stopCamera() {
      if (recording)
        handleStopRecord().catch(() => {});
      if (camRef.current)
        camRef.current.stop();
      setCamOpen(false);
      setRecording(false);
    }
    async function handleCapture() {
      setCamError("");
      setPhotoPath("");
      try {
        const path = await camRef.current.capture();
        setPhotoPath(path);
      } catch (e) {
        setCamError(String(e));
      }
    }
    function handleStartRecord() {
      const ts = Date.now();
      const dir = typeof __velox_tmp_dir !== "undefined" ? __velox_tmp_dir : "/tmp";
      const out = `${dir}/velox_rec_${ts}.mp4`;
      setCamError("");
      setVideoPath("");
      try {
        camRef.current.startRecord(out);
        setRecording(true);
      } catch (e) {
        setCamError(String(e));
      }
    }
    async function handleStopRecord() {
      try {
        const path = await camRef.current.stopRecord();
        setVideoPath(path);
        setRecording(false);
        setVidSrc(path);
        setVidInput(path);
        setTab(2);
      } catch (e) {
        setCamError(String(e));
        setRecording(false);
      }
    }
    const [micLoading, setMicLoading] = import_react7.useState(false);
    const [micPath, setMicPath] = import_react7.useState("");
    const [micError, setMicError] = import_react7.useState("");
    const micPlayerRef = import_react7.default.useRef(null);
    const micSeekingRef = import_react7.default.useRef(false);
    const [micPaused, setMicPaused] = import_react7.useState(true);
    const [micTime, setMicTime] = import_react7.useState(0);
    const [micDur, setMicDur] = import_react7.useState(-1);
    const [micVolume, setMicVolume] = import_react7.useState(1);
    import_react7.default.useEffect(() => {
      if (!micPaused && micPlayerRef.current) {
        let active = true;
        const poll = () => {
          if (!active || !micPlayerRef.current)
            return;
          if (!micSeekingRef.current)
            setMicTime(micPlayerRef.current.getTime());
          setTimeout(poll, 250);
        };
        const id = setTimeout(poll, 250);
        return () => {
          active = false;
          clearTimeout(id);
        };
      }
    }, [micPaused]);
    const vidRef = import_react7.default.useRef(null);
    const vidSeekingRef = import_react7.default.useRef(false);
    const [vidSrc, setVidSrc] = import_react7.useState("");
    const [vidInput, setVidInput] = import_react7.useState("");
    const [vidStatus, setVidStatus] = import_react7.useState("");
    const [vidError, setVidError] = import_react7.useState("");
    const [vidMeta, setVidMeta] = import_react7.useState(null);
    const [vidCurrentTime, setVidCurrentTime] = import_react7.useState(0);
    const [vidVolume, setVidVolume] = import_react7.useState(1);
    const [vidPaused, setVidPaused] = import_react7.useState(false);
    async function recordMic() {
      setMicLoading(true);
      setMicError("");
      setMicPath("");
      if (micPlayerRef.current) {
        micPlayerRef.current.stop();
        micPlayerRef.current = null;
      }
      setMicPaused(true);
      setMicTime(0);
      setMicDur(-1);
      try {
        const path = await microphone.record(5000);
        setMicPath(path);
      } catch (e) {
        setMicError(String(e));
      } finally {
        setMicLoading(false);
      }
    }
    async function playMic() {
      if (!micPath)
        return;
      try {
        if (micPlayerRef.current) {
          micPlayerRef.current.stop();
          micPlayerRef.current = null;
        }
        setMicTime(0);
        setMicDur(-1);
        setMicPaused(true);
        const player = await audio.play(micPath, {
          onEnded: () => {
            setMicPaused(true);
            micPlayerRef.current = null;
            setMicTime(0);
          }
        });
        micPlayerRef.current = player;
        let dur = -1;
        try {
          dur = await player.getDuration();
        } catch (_) {}
        if (!(dur > 0))
          dur = 5;
        setMicDur(dur);
        setMicPaused(false);
      } catch (e) {
        setMicError(String(e));
        setMicPaused(true);
      }
    }
    function pauseResumeMic() {
      if (!micPlayerRef.current)
        return;
      if (micPaused) {
        micPlayerRef.current.play();
        setMicPaused(false);
      } else {
        micPlayerRef.current.pause();
        setMicPaused(true);
      }
    }
    function stopMic() {
      if (micPlayerRef.current) {
        micPlayerRef.current.stop();
        micPlayerRef.current = null;
      }
      setMicPaused(true);
      setMicTime(0);
    }
    return /* @__PURE__ */ jsx_runtime.jsxs(ScrollView, {
      width: inner,
      height: 650,
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", alignItems: "center", gap: 12 },
          width: inner,
          height: 28,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 18,
              height: 24,
              style: { color: C2.text },
              children: "Media"
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(View, {
          style: { flexDirection: "row", gap: 8, marginBottom: 16 },
          width: inner,
          height: 36,
          children: MEDIA_TABS.map((t, i) => /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
            onPress: () => setTab(i),
            width: 110,
            height: 32,
            style: { backgroundColor: tab === i ? C2.accent : C2.surface, borderRadius: 6, justifyContent: "center", alignItems: "center" },
            children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 13,
              width: 98,
              height: 18,
              style: { color: tab === i ? C2.bg : C2.text },
              children: t
            })
          }, i))
        }),
        tab === 0 && /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { gap: 10, alignItems: "flex-start" },
          width: inner,
          height: 620,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Camera, {
              ref: camRef,
              mirror,
              style: { width: inner, height: 400, borderRadius: 8, backgroundColor: "#000" }
            }),
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { flexDirection: "row", gap: 8, alignItems: "center" },
              width: inner,
              height: 34,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: startCamera,
                  width: 70,
                  height: 30,
                  style: { backgroundColor: camOpen ? C2.border : C2.green, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 58,
                    height: 16,
                    style: { color: C2.bg },
                    children: "Start"
                  })
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: stopCamera,
                  width: 70,
                  height: 30,
                  style: { backgroundColor: camOpen ? C2.red : C2.border, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 58,
                    height: 16,
                    style: { color: C2.bg },
                    children: "Stop"
                  })
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: () => setMirror((m) => !m),
                  width: 90,
                  height: 30,
                  style: { backgroundColor: mirror ? C2.accent : C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 78,
                    height: 16,
                    style: { color: mirror ? C2.bg : C2.text },
                    children: mirror ? "Mirror ON" : "Mirror OFF"
                  })
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 11,
                  width: inner - 258,
                  height: 16,
                  style: { color: C2.dim },
                  children: devices.length > 0 ? devices[0].name : "No cameras"
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { flexDirection: "row", gap: 8 },
              width: inner,
              height: 34,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: handleCapture,
                  width: 100,
                  height: 30,
                  style: { backgroundColor: camOpen ? C2.sapphire : C2.border, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 88,
                    height: 16,
                    style: { color: C2.bg },
                    children: "Take Photo"
                  })
                }),
                !recording ? /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: handleStartRecord,
                  width: 110,
                  height: 30,
                  style: { backgroundColor: camOpen ? C2.mauve : C2.border, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 98,
                    height: 16,
                    style: { color: C2.bg },
                    children: "Record MP4"
                  })
                }) : /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: handleStopRecord,
                  width: 110,
                  height: 30,
                  style: { backgroundColor: C2.red, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 98,
                    height: 16,
                    style: { color: C2.bg },
                    children: "Stop Record"
                  })
                })
              ]
            }),
            photoPath ? /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { gap: 6 },
              width: inner,
              height: 246,
              children: [
                /* @__PURE__ */ jsx_runtime.jsxs(Text, {
                  fontSize: 11,
                  width: inner,
                  height: 14,
                  style: { color: C2.teal },
                  children: [
                    "Captured: ",
                    photoPath
                  ]
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Image, {
                  src: photoPath,
                  width: inner,
                  height: 228,
                  resizeMode: "contain"
                })
              ]
            }) : null,
            videoPath ? /* @__PURE__ */ jsx_runtime.jsxs(Text, {
              fontSize: 11,
              width: inner,
              height: 14,
              style: { color: C2.teal },
              children: [
                "Recorded: ",
                videoPath,
                " (switched to Video tab)"
              ]
            }) : null,
            camError ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: inner,
              height: 20,
              style: { color: C2.red },
              children: camError
            }) : null
          ]
        }),
        tab === 1 && /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { gap: 12, alignItems: "flex-start" },
          width: inner,
          height: 480,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 14,
              width: inner,
              height: 20,
              style: { color: C2.text },
              children: "Record 5 seconds from the default microphone, then play it back."
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: recordMic,
              width: 110,
              height: 32,
              style: { backgroundColor: micLoading ? C2.border : C2.teal, borderRadius: 6, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                width: 96,
                height: 18,
                style: { color: C2.bg },
                children: micLoading ? "Recording…" : "Record 5s"
              })
            }),
            micPath ? (() => {
              const hasDur = micDur > 0;
              const fmtT = (s) => {
                const m = Math.floor(s / 60);
                return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
              };
              const isActive = !!micPlayerRef.current;
              return /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { gap: 8 },
                width: inner,
                height: 164,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 11,
                    width: inner,
                    height: 14,
                    style: { color: C2.dim },
                    children: micPath
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Slider, {
                    value: micTime,
                    min: 0,
                    max: micDur > 0 ? micDur : 5,
                    step: 0,
                    disabled: !micPlayerRef.current,
                    onChange: (v) => {
                      micSeekingRef.current = true;
                      clearTimeout(micSeekingRef._t);
                      micSeekingRef._t = setTimeout(() => {
                        micSeekingRef.current = false;
                      }, 500);
                      micPlayerRef.current?.seek(v);
                      setMicTime(v);
                    },
                    width: inner,
                    height: 24
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 11,
                    width: inner,
                    height: 14,
                    style: { color: C2.dim },
                    children: hasDur ? `${fmtT(micTime)} / ${fmtT(micDur)}` : micTime > 0 ? fmtT(micTime) : "0:00"
                  }),
                  /* @__PURE__ */ jsx_runtime.jsxs(View, {
                    style: { flexDirection: "row", gap: 8, alignItems: "center" },
                    width: inner,
                    height: 32,
                    children: [
                      /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                        onPress: playMic,
                        width: 56,
                        height: 30,
                        style: { backgroundColor: C2.green, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                        children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                          fontSize: 12,
                          width: 44,
                          height: 16,
                          style: { color: C2.bg },
                          children: "Play"
                        })
                      }),
                      /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                        onPress: pauseResumeMic,
                        width: 70,
                        height: 30,
                        style: { backgroundColor: isActive ? C2.accent : C2.border, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                        children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                          fontSize: 12,
                          width: 58,
                          height: 16,
                          style: { color: C2.bg },
                          children: micPaused ? "Resume" : "Pause"
                        })
                      }),
                      /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                        onPress: stopMic,
                        width: 52,
                        height: 30,
                        style: { backgroundColor: isActive ? C2.red : C2.border, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                        children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                          fontSize: 12,
                          width: 40,
                          height: 16,
                          style: { color: C2.bg },
                          children: "Stop"
                        })
                      }),
                      /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                        onPress: async () => {
                          if (micPlayerRef.current) {
                            const t = Math.max(0, micTime - 10);
                            await micPlayerRef.current.seek(t);
                            setMicTime(t);
                          }
                        },
                        width: 44,
                        height: 30,
                        style: { backgroundColor: C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border, justifyContent: "center", alignItems: "center" },
                        children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                          fontSize: 12,
                          width: 36,
                          height: 16,
                          style: { color: C2.text },
                          children: "-10s"
                        })
                      }),
                      /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                        onPress: async () => {
                          if (micPlayerRef.current) {
                            const t = micTime + 10;
                            await micPlayerRef.current.seek(t);
                            setMicTime(t);
                          }
                        },
                        width: 44,
                        height: 30,
                        style: { backgroundColor: C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border, justifyContent: "center", alignItems: "center" },
                        children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                          fontSize: 12,
                          width: 36,
                          height: 16,
                          style: { color: C2.text },
                          children: "+10s"
                        })
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime.jsxs(View, {
                    style: { flexDirection: "row", gap: 10, alignItems: "center" },
                    width: inner,
                    height: 28,
                    children: [
                      /* @__PURE__ */ jsx_runtime.jsx(Text, {
                        fontSize: 12,
                        width: 52,
                        height: 16,
                        style: { color: C2.dim },
                        children: "Vol"
                      }),
                      /* @__PURE__ */ jsx_runtime.jsx(Slider, {
                        value: micVolume,
                        min: 0,
                        max: 1,
                        step: 0.05,
                        onChange: (v) => {
                          setMicVolume(v);
                          micPlayerRef.current?.setVolume(v);
                        },
                        width: inner - 62,
                        height: 28
                      }),
                      /* @__PURE__ */ jsx_runtime.jsxs(Text, {
                        fontSize: 11,
                        width: 32,
                        height: 16,
                        style: { color: C2.dim },
                        children: [
                          Math.round(micVolume * 100),
                          "%"
                        ]
                      })
                    ]
                  })
                ]
              });
            })() : null,
            micError ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: inner,
              height: 20,
              style: { color: C2.red },
              children: micError
            }) : null
          ]
        }),
        tab === 2 && /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { gap: 10, alignItems: "flex-start" },
          width: inner,
          height: 660,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 13,
              width: inner,
              height: 18,
              style: { color: C2.dim },
              children: "Pick a video file or type a URL. Requires velox-media DLL."
            }),
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { flexDirection: "row", gap: 8, alignItems: "center" },
              width: inner,
              height: 36,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: async () => {
                    try {
                      const paths = await dialog.openFile({
                        filters: [
                          { name: "Video", extensions: ["mp4", "mkv", "avi", "mov", "webm", "m4v"] },
                          { name: "All files", extensions: ["*"] }
                        ]
                      });
                      if (paths && paths.length > 0) {
                        setVidError("");
                        setVidStatus("");
                        setVidMeta(null);
                        setVidInput(paths[0]);
                        setVidSrc(paths[0]);
                      }
                    } catch (e) {
                      setVidError(String(e));
                    }
                  },
                  width: 90,
                  height: 32,
                  style: { backgroundColor: C2.sapphire, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 13,
                    width: 78,
                    height: 18,
                    style: { color: C2.bg },
                    children: "Browse…"
                  })
                }),
                /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
                  value: vidInput,
                  onChangeText: (v) => {
                    setVidInput(v);
                  },
                  placeholder: "or paste a URL / path",
                  width: inner - 186,
                  height: 32,
                  style: { backgroundColor: C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border, paddingHorizontal: 8 }
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: () => {
                    setVidError("");
                    setVidStatus("");
                    setVidMeta(null);
                    setVidSrc(vidInput.trim());
                  },
                  width: 78,
                  height: 32,
                  style: { backgroundColor: C2.accent, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 13,
                    width: 66,
                    height: 18,
                    style: { color: C2.bg },
                    children: "Load"
                  })
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Video, {
              ref: vidRef,
              src: vidSrc || undefined,
              autoPlay: true,
              loop: false,
              onMetadata: (m) => {
                setVidMeta(m);
                setVidCurrentTime(0);
                setVidPaused(false);
              },
              onTimeUpdate: (t) => {
                if (!vidSeekingRef.current)
                  setVidCurrentTime(t);
              },
              onEnded: () => {
                setVidStatus("Playback ended");
                setVidPaused(true);
              },
              onError: (e) => setVidError(String(e)),
              style: { width: inner, height: 360, borderRadius: 8, backgroundColor: "#000" }
            }),
            (() => {
              const dur = vidMeta?.durationSecs ?? -1;
              const hasDur = dur > 0;
              const fmtT = (s) => {
                const m = Math.floor(s / 60);
                return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
              };
              return /* @__PURE__ */ jsx_runtime.jsxs(View, {
                style: { gap: 6 },
                width: inner,
                height: 38,
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx(Slider, {
                    value: vidCurrentTime,
                    min: 0,
                    max: Math.max(dur > 0 ? dur : 7200, vidCurrentTime + 1),
                    step: 0,
                    disabled: !vidRef.current?.handle,
                    onChange: (v) => {
                      vidSeekingRef.current = true;
                      clearTimeout(vidSeekingRef._t);
                      vidSeekingRef._t = setTimeout(() => {
                        vidSeekingRef.current = false;
                      }, 500);
                      vidRef.current?.seek(v);
                      setVidCurrentTime(v);
                    },
                    width: inner,
                    height: 24
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 11,
                    width: inner,
                    height: 14,
                    style: { color: C2.dim },
                    children: hasDur ? `${fmtT(vidCurrentTime)} / ${fmtT(dur)}` : vidCurrentTime > 0 ? fmtT(vidCurrentTime) : ""
                  })
                ]
              });
            })(),
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
              width: inner,
              height: 36,
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: () => {
                    if (vidPaused) {
                      vidRef.current?.play();
                      setVidPaused(false);
                    } else {
                      vidRef.current?.pause();
                      setVidPaused(true);
                    }
                  },
                  width: 62,
                  height: 30,
                  style: { backgroundColor: C2.accent, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 50,
                    height: 16,
                    style: { color: C2.bg },
                    children: vidPaused ? "Play" : "Pause"
                  })
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: () => vidRef.current?.seek(Math.max(0, vidCurrentTime - 15)),
                  width: 44,
                  height: 30,
                  style: { backgroundColor: C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 36,
                    height: 16,
                    style: { color: C2.text },
                    children: "-15s"
                  })
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: () => vidRef.current?.seek(vidCurrentTime + 15),
                  width: 44,
                  height: 30,
                  style: { backgroundColor: C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 36,
                    height: 16,
                    style: { color: C2.text },
                    children: "+15s"
                  })
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 11,
                  width: 28,
                  height: 16,
                  style: { color: C2.dim },
                  children: "Vol"
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Slider, {
                  min: 0,
                  max: 1,
                  step: 0.05,
                  value: vidVolume,
                  onChange: (v) => {
                    setVidVolume(v);
                    vidRef.current?.setVolume(v);
                  },
                  style: { width: 100, height: 30 }
                }),
                /* @__PURE__ */ jsx_runtime.jsxs(Text, {
                  fontSize: 11,
                  width: 28,
                  height: 16,
                  style: { color: C2.dim },
                  children: [
                    Math.round(vidVolume * 100),
                    "%"
                  ]
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: () => {
                    vidRef.current?.close();
                    setVidSrc("");
                    setVidStatus("");
                    setVidMeta(null);
                    setVidCurrentTime(0);
                    setVidPaused(false);
                  },
                  width: 52,
                  height: 30,
                  style: { backgroundColor: C2.red, borderRadius: 6, justifyContent: "center", alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 12,
                    width: 40,
                    height: 16,
                    style: { color: C2.bg },
                    children: "Close"
                  })
                })
              ]
            }),
            vidMeta ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 11,
              width: inner,
              height: 14,
              style: { color: C2.dim },
              children: `${vidMeta.width ?? "?"}×${vidMeta.height ?? "?"}  ${(vidMeta.fps ?? 0).toFixed(1)}fps`
            }) : null,
            vidStatus ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: inner,
              height: 18,
              style: { color: C2.teal },
              children: vidStatus
            }) : null,
            vidError ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              width: inner,
              height: 20,
              style: { color: C2.red },
              children: vidError
            }) : null
          ]
        })
      ]
    });
  }
  var appChain = createTypedKeychain("demo", { apiKey: null, sessionToken: null });
  var useCounter = createStore("counter", { count: 0, lastReset: "" });
  function PackagesDemoScreen() {
    const { width: winW } = useWindowSize();
    const inner = winW - PAD * 2;
    const C2 = useThemeColors();
    const [kcInput, setKcInput] = import_react7.useState("");
    const [kcStored, setKcStored] = import_react7.useState(null);
    const [kcStatus, setKcStatus] = import_react7.useState("");
    async function kcSave() {
      setKcStatus("");
      try {
        await appChain.set("apiKey", kcInput.trim());
        setKcStatus("Saved to OS keychain ✓");
        setKcInput("");
      } catch (e) {
        setKcStatus("Save error: " + String(e));
      }
    }
    async function kcLoad() {
      setKcStatus("");
      try {
        const val = await appChain.get("apiKey");
        setKcStored(val);
        setKcStatus(val === null ? "No value stored yet." : "Loaded from OS keychain ✓");
      } catch (e) {
        setKcStatus("Load error: " + String(e));
      }
    }
    async function kcClear() {
      try {
        await appChain.clear();
        setKcStored(null);
        setKcStatus("Cleared ✓");
      } catch (e) {
        setKcStatus("Clear error: " + String(e));
      }
    }
    const { state: ctr, set: setCtr, reset: resetCtr, hydrated } = useCounter();
    return /* @__PURE__ */ jsx_runtime.jsxs(ScrollView, {
      width: inner,
      height: 600,
      style: { gap: 24 },
      children: [
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", alignItems: "center", gap: 12 },
          width: inner,
          height: 28,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 18,
              height: 24,
              style: { color: C2.text },
              children: "Packages"
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 15,
          width: inner,
          height: 20,
          style: { color: C2.accent },
          children: "@velox/keychain"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 12,
          width: inner,
          height: 16,
          style: { color: C2.dim },
          children: "Typed namespace-scoped wrapper over the OS credential store (DPAPI / Keychain / Secret Service)."
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 8, alignItems: "center" },
          width: inner,
          height: 34,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: kcInput,
              onChangeText: setKcInput,
              placeholder: "Enter a value to store as apiKey…",
              width: inner - 100,
              height: 32,
              style: { backgroundColor: C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border, paddingHorizontal: 8 }
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: kcSave,
              width: 84,
              height: 32,
              style: { backgroundColor: C2.accent, borderRadius: 6, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                width: 72,
                height: 18,
                style: { color: C2.bg },
                children: "Save"
              })
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 8 },
          width: inner,
          height: 32,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: kcLoad,
              width: 100,
              height: 32,
              style: { backgroundColor: C2.sapphire, borderRadius: 6, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                width: 88,
                height: 18,
                style: { color: C2.bg },
                children: "Load apiKey"
              })
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: kcClear,
              width: 80,
              height: 32,
              style: { backgroundColor: C2.red, borderRadius: 6, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                width: 68,
                height: 18,
                style: { color: C2.bg },
                children: "Clear all"
              })
            })
          ]
        }),
        kcStatus ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 12,
          width: inner,
          height: 16,
          style: { color: C2.teal },
          children: kcStatus
        }) : null,
        kcStored !== null ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 12,
          width: inner,
          height: 16,
          style: { color: C2.text },
          children: `apiKey = "${kcStored}"`
        }) : null,
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 15,
          width: inner,
          height: 20,
          style: { color: C2.accent },
          children: "@velox/store"
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(Text, {
          fontSize: 12,
          width: inner,
          height: 16,
          style: { color: C2.dim },
          children: [
            "Persistent reactive store backed by SQLite. State survives app restarts.",
            hydrated ? "" : "  (hydrating…)"
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 12, alignItems: "center" },
          width: inner,
          height: 40,
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: () => setCtr("count", ctr.count - 1),
              width: 40,
              height: 40,
              style: { backgroundColor: C2.surface, borderRadius: 8, borderWidth: 1, borderColor: C2.border, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 20,
                width: 28,
                height: 28,
                style: { color: C2.text },
                children: "−"
              })
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 24,
              width: 60,
              height: 32,
              style: { color: C2.text, textAlign: "center" },
              children: ctr.count
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: () => setCtr("count", ctr.count + 1),
              width: 40,
              height: 40,
              style: { backgroundColor: C2.surface, borderRadius: 8, borderWidth: 1, borderColor: C2.border, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 20,
                width: 28,
                height: 28,
                style: { color: C2.text },
                children: "+"
              })
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: () => resetCtr(),
              width: 70,
              height: 32,
              style: { backgroundColor: C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border, justifyContent: "center", alignItems: "center" },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 12,
                width: 58,
                height: 16,
                style: { color: C2.dim },
                children: "Reset"
              })
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 11,
          width: inner,
          height: 14,
          style: { color: C2.dim },
          children: "Increment, close the app, reopen — counter persists."
        })
      ]
    });
  }
  var SEED_PRODUCTS = [
    { name: "Velox Pro", price: 49.99 },
    { name: "Velox Starter", price: 9.99 },
    { name: "Velox Enterprise", price: 299.99 }
  ];
  function DrizzleScreen() {
    const { width: winW } = useWindowSize();
    const C2 = useThemeColors();
    const [driz, setDriz] = import_react7.useState(null);
    const [rows, setRows] = import_react7.useState([]);
    const [name, setName] = import_react7.useState("");
    const [price, setPrice] = import_react7.useState("");
    const [status, setStatus] = import_react7.useState("Initialising…");
    const [filterGt, setFilterGt] = import_react7.useState("0");
    import_react7.useEffect(() => {
      let handle;
      (async () => {
        try {
          handle = await db.open(":memory:");
          await db.run(handle, `CREATE TABLE drz_products (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             name TEXT NOT NULL,
             price REAL NOT NULL,
             created_at INTEGER NOT NULL
           )`);
          const d = createDrizzle(handle);
          await d.insert(drzProducts).values(SEED_PRODUCTS.map((s) => ({ ...s, created_at: Date.now() })));
          setDriz(d);
          const initial = await d.select().from(drzProducts).orderBy(desc(drzProducts.id));
          setRows(initial);
          setStatus("Drizzle ORM — in-memory SQLite via Velox bindings");
        } catch (e) {
          setStatus("Error: " + e.message);
        }
      })();
      return () => {
        if (handle != null)
          db.close(handle);
      };
    }, []);
    const refresh = async (d = driz, minPrice = Number(filterGt) || 0) => {
      if (!d)
        return;
      const result = minPrice > 0 ? await d.select().from(drzProducts).where(gt(drzProducts.price, minPrice)).orderBy(desc(drzProducts.id)) : await d.select().from(drzProducts).orderBy(desc(drzProducts.id));
      setRows(result);
    };
    const handleInsert = async () => {
      if (!driz || !name.trim())
        return;
      const p = parseFloat(price) || 0;
      await driz.insert(drzProducts).values({
        name: name.trim(),
        price: p,
        created_at: Date.now()
      });
      setName("");
      setPrice("");
      await refresh();
    };
    const handleDelete = async (id) => {
      if (!driz)
        return;
      await driz.delete(drzProducts).where(eq(drzProducts.id, id));
      await refresh();
    };
    return /* @__PURE__ */ jsx_runtime.jsxs(ScrollView, {
      style: { flex: 1, backgroundColor: C2.bg },
      contentPadding: PAD,
      children: [
        /* @__PURE__ */ jsx_runtime.jsx(BackBtn, {}),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 20,
          style: { color: C2.text, marginBottom: 4 },
          children: "Drizzle ORM"
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 12,
          style: { color: C2.dim, marginBottom: 16 },
          children: status
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: name,
              onChangeText: setName,
              placeholder: "Product name",
              style: {
                flex: 1,
                minWidth: 140,
                backgroundColor: C2.surface,
                borderRadius: 6,
                paddingHorizontal: 10,
                height: 36,
                color: C2.text,
                fontSize: 13
              }
            }),
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: price,
              onChangeText: setPrice,
              placeholder: "Price",
              style: {
                width: 80,
                backgroundColor: C2.surface,
                borderRadius: 6,
                paddingHorizontal: 10,
                height: 36,
                color: C2.text,
                fontSize: 13
              }
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
              onPress: handleInsert,
              style: {
                backgroundColor: C2.accent,
                borderRadius: 6,
                paddingHorizontal: 16,
                height: 36,
                justifyContent: "center"
              },
              children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 13,
                style: { color: C2.bg },
                children: "Insert"
              })
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 16 },
          children: [
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              style: { color: C2.dim },
              children: "Price >"
            }),
            /* @__PURE__ */ jsx_runtime.jsx(TextInput, {
              value: filterGt,
              onChangeText: (v) => {
                setFilterGt(v);
                refresh(driz, Number(v) || 0);
              },
              style: {
                width: 70,
                backgroundColor: C2.surface,
                borderRadius: 6,
                paddingHorizontal: 10,
                height: 30,
                color: C2.text,
                fontSize: 12
              }
            }),
            /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 11,
              style: { color: C2.dim },
              children: `drizzle.select().from(products).where(gt(price, ${Number(filterGt) || 0})).orderBy(desc(id))`
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsxs(View, {
          style: { backgroundColor: C2.surface, borderRadius: 8, overflow: "hidden" },
          children: [
            /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: {
                flexDirection: "row",
                backgroundColor: C2.overlay,
                paddingHorizontal: 12,
                paddingVertical: 8
              },
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 11,
                  style: { color: C2.dim, width: 36 },
                  children: "ID"
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 11,
                  style: { color: C2.dim, flex: 1 },
                  children: "Name"
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 11,
                  style: { color: C2.dim, width: 72 },
                  children: "Price"
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 11,
                  style: { color: C2.dim, width: 32 }
                })
              ]
            }),
            rows.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx(Text, {
              fontSize: 12,
              style: { color: C2.dim, padding: 16 },
              children: "No results"
            }) : rows.map((row) => /* @__PURE__ */ jsx_runtime.jsxs(View, {
              style: {
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: C2.border
              },
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 12,
                  style: { color: C2.dim, width: 36 },
                  children: row.id
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 13,
                  style: { color: C2.text, flex: 1 },
                  children: row.name
                }),
                /* @__PURE__ */ jsx_runtime.jsxs(Text, {
                  fontSize: 13,
                  style: { color: C2.green, width: 72 },
                  children: [
                    "$",
                    row.price.toFixed(2)
                  ]
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                  onPress: () => handleDelete(row.id),
                  style: { width: 32, alignItems: "center" },
                  children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                    fontSize: 13,
                    style: { color: C2.red },
                    children: "✕"
                  })
                })
              ]
            }, row.id))
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx(Text, {
          fontSize: 10,
          style: { color: C2.dim, marginTop: 12, lineHeight: 16 },
          children: "Typed insert / select / delete / where / orderBy — zero raw SQL in the screen. " + "Drizzle generates the SQL; @velox/drizzle routes it through __velox_db_* bindings."
        })
      ]
    });
  }
  function DeeplinkHandler({ url }) {
    const navigate = useNavigate();
    import_react7.useEffect(() => {
      if (!url)
        return;
      const m = url.match(/^notes:\/\/note\/(\d+)/);
      if (m) {
        navigate("edit", { noteId: Number(m[1]) });
      } else if (url.startsWith("notes://new")) {
        navigate("edit", { noteId: null });
      } else if (url.startsWith("notes://search")) {
        navigate("search");
      }
    }, [url]);
    return null;
  }
  function App() {
    const { width: winW, height: winH } = useWindowSize();
    const [fullscreen, setFullscreen] = import_react7.useState(false);
    const [maximized, setMaximized] = import_react7.useState(false);
    const C2 = useThemeColors();
    const [pendingDeeplink, setPendingDeeplink] = import_react7.useState(null);
    import_react7.useEffect(() => deeplink.onOpen((url) => setPendingDeeplink(url)), []);
    const [crashReports, setCrashReports] = import_react7.useState([]);
    import_react7.useEffect(() => {
      crash.getReports().then((reports) => {
        if (reports && reports.length > 0)
          setCrashReports(reports);
      }).catch(() => {});
    }, []);
    const [vdb, setVdb] = import_react7.useState(null);
    const [dbReady, setDbReady] = import_react7.useState(false);
    const [notes, setNotes] = import_react7.useState([]);
    const [initStatus, setInitStatus] = import_react7.useState("Opening database…");
    const refreshNotes = import_react7.useCallback(() => db.query("SELECT * FROM notes ORDER BY updated_at DESC").then(setNotes).catch(() => {}), []);
    import_react7.useEffect(() => {
      let store;
      db.open("notes.db").then(() => {
        setInitStatus("Creating schema…");
        return Promise.all([
          db.run("CREATE TABLE IF NOT EXISTS notes (" + "  id         INTEGER PRIMARY KEY AUTOINCREMENT," + '  title      TEXT    NOT NULL DEFAULT "",' + '  body       TEXT    NOT NULL DEFAULT "",' + "  created_at INTEGER NOT NULL," + "  updated_at INTEGER NOT NULL" + ")"),
          initStore()
        ]);
      }).then(() => db.query("SELECT count(*) AS cnt FROM notes")).then(([{ cnt }]) => {
        if (cnt === 0) {
          setInitStatus("Seeding example notes…");
          const now = Date.now();
          return db.transaction(SEED_NOTES.map((n) => ({
            sql: "INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)",
            params: [n.title, n.body, now, now]
          })));
        }
      }).then(() => {
        setInitStatus("Opening vector store…");
        return vectorDb.open("notes-vectors.db");
      }).then(async (s) => {
        store = s;
        setInitStatus("Syncing embeddings…");
        const allNotes = await db.query("SELECT * FROM notes");
        await Promise.all(allNotes.map((n) => s.upsert("notes", String(n.id), embedNote(n.title, n.body), {
          title: n.title,
          preview: n.body.slice(0, 60)
        })));
        setNotes(allNotes);
        setVdb(store);
        setDbReady(true);
        setInitStatus("Ready");
      }).catch((e) => {
        setInitStatus("Init error: " + (e?.message ?? String(e)));
      });
    }, []);
    const toggleFullscreen = () => {
      const next = !fullscreen;
      veloxWindow.setFullscreen(next);
      setFullscreen(next);
    };
    const toggleMaximize = () => {
      const next = !maximized;
      veloxWindow.setMaximized(next);
      setMaximized(next);
    };
    const ctx = { vdb, dbReady, notes, refreshNotes, initStatus };
    return /* @__PURE__ */ jsx_runtime.jsx(NotesCtx.Provider, {
      value: ctx,
      children: /* @__PURE__ */ jsx_runtime.jsxs(View, {
        style: { backgroundColor: C2.bg },
        width: winW,
        height: winH,
        children: [
          crashReports.length > 0 && /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#4d1a1a",
              borderWidth: 1,
              borderColor: "#e06c75",
              padding: 8,
              gap: 8
            },
            width: winW,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                style: { color: "#e06c75", fontSize: 12, flex: 1 },
                children: "⚠ Crash detected in previous session: " + (crashReports[0]?.message || crashReports[0]?.error || "Unknown error") + (crashReports.length > 1 ? ` (+${crashReports.length - 1} more)` : "")
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                onPress: () => {
                  crash.clearReports().catch(() => {});
                  setCrashReports([]);
                },
                style: { padding: 4 },
                children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  style: { color: "#e06c75", fontSize: 14 },
                  children: "✕"
                })
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs(View, {
            style: {
              flexDirection: "row",
              backgroundColor: C2.header,
              borderWidth: 1,
              borderColor: C2.border,
              alignItems: "flex-start",
              justifyContent: "flex-start",
              gap: 10,
              padding: 8
            },
            width: winW,
            height: HEADER_H,
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(View, {
                style: {
                  backgroundColor: C2.surfaceAlt,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: C2.accent,
                  padding: 8
                },
                width: 220,
                height: 30,
                children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 12,
                  width: 200,
                  height: 16,
                  style: { color: C2.accent },
                  children: `Velox Notes  •  ${winW} × ${winH}`
                })
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Text, {
                fontSize: 11,
                width: 120,
                height: 28,
                style: { color: C2.dim },
                children: "Focused writing mode"
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                onPress: toggleFullscreen,
                width: 100,
                height: 30,
                style: { backgroundColor: fullscreen ? C2.surfaceAlt : C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.mauve },
                children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 12,
                  width: 84,
                  height: 18,
                  style: { color: fullscreen ? C2.mauve : C2.text },
                  children: fullscreen ? "Exit Full" : "Fullscreen"
                })
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                onPress: toggleMaximize,
                width: 96,
                height: 30,
                style: { backgroundColor: maximized ? C2.surfaceAlt : C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.green },
                children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 12,
                  width: 80,
                  height: 18,
                  style: { color: maximized ? C2.green : C2.text },
                  children: maximized ? "Restore" : "Maximize"
                })
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Pressable, {
                onPress: () => veloxWindow.setMinimized(),
                width: 84,
                height: 30,
                style: { backgroundColor: C2.surface, borderRadius: 6, borderWidth: 1, borderColor: C2.border },
                children: /* @__PURE__ */ jsx_runtime.jsx(Text, {
                  fontSize: 12,
                  width: 68,
                  height: 18,
                  style: { color: C2.text },
                  children: "Minimize"
                })
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsx(View, {
            style: { padding: PAD, justifyContent: "flex-start", alignItems: "flex-start" },
            width: winW,
            height: winH - HEADER_H,
            children: /* @__PURE__ */ jsx_runtime.jsxs(Router, {
              initialRoute: "list",
              children: [
                /* @__PURE__ */ jsx_runtime.jsx(DeeplinkHandler, {
                  url: pendingDeeplink
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "list",
                  component: NoteListScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "edit",
                  component: NoteEditScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "search",
                  component: NoteSearchScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "network",
                  component: NetworkTestScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "sysapi",
                  component: SysApiScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "forms",
                  component: FormDemoScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "audio",
                  component: AudioDemoScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "canvas",
                  component: CanvasDemoScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "ai",
                  component: AiDemoScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "media",
                  component: MediaDemoScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "drizzle",
                  component: DrizzleScreen
                }),
                /* @__PURE__ */ jsx_runtime.jsx(Route, {
                  name: "packages",
                  component: PackagesDemoScreen
                })
              ]
            })
          })
        ]
      })
    });
  }
  render(/* @__PURE__ */ jsx_runtime.jsx(App, {}));
  __velox_log("Week 23: Notes reference app loaded.");
})();
