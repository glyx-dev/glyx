(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ../../node_modules/.bun/react@18.3.1/node_modules/react/cjs/react.production.min.js
  var require_react_production_min = __commonJS({
    "../../node_modules/.bun/react@18.3.1/node_modules/react/cjs/react.production.min.js"(exports) {
      "use strict";
      var l = /* @__PURE__ */ Symbol.for("react.element");
      var n = /* @__PURE__ */ Symbol.for("react.portal");
      var p = /* @__PURE__ */ Symbol.for("react.fragment");
      var q = /* @__PURE__ */ Symbol.for("react.strict_mode");
      var r = /* @__PURE__ */ Symbol.for("react.profiler");
      var t = /* @__PURE__ */ Symbol.for("react.provider");
      var u = /* @__PURE__ */ Symbol.for("react.context");
      var v = /* @__PURE__ */ Symbol.for("react.forward_ref");
      var w = /* @__PURE__ */ Symbol.for("react.suspense");
      var x = /* @__PURE__ */ Symbol.for("react.memo");
      var y = /* @__PURE__ */ Symbol.for("react.lazy");
      var z = Symbol.iterator;
      function A(a) {
        if (null === a || "object" !== typeof a) return null;
        a = z && a[z] || a["@@iterator"];
        return "function" === typeof a ? a : null;
      }
      var B = { isMounted: function() {
        return false;
      }, enqueueForceUpdate: function() {
      }, enqueueReplaceState: function() {
      }, enqueueSetState: function() {
      } };
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
        if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
        this.updater.enqueueSetState(this, a, b, "setState");
      };
      E.prototype.forceUpdate = function(a) {
        this.updater.enqueueForceUpdate(this, a, "forceUpdate");
      };
      function F() {
      }
      F.prototype = E.prototype;
      function G(a, b, e) {
        this.props = a;
        this.context = b;
        this.refs = D;
        this.updater = e || B;
      }
      var H = G.prototype = new F();
      H.constructor = G;
      C(H, E.prototype);
      H.isPureReactComponent = true;
      var I = Array.isArray;
      var J = Object.prototype.hasOwnProperty;
      var K = { current: null };
      var L = { key: true, ref: true, __self: true, __source: true };
      function M(a, b, e) {
        var d, c = {}, k = null, h = null;
        if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
        var g = arguments.length - 2;
        if (1 === g) c.children = e;
        else if (1 < g) {
          for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
          c.children = f;
        }
        if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
        return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
      }
      function N(a, b) {
        return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
      }
      function O(a) {
        return "object" === typeof a && null !== a && a.$$typeof === l;
      }
      function escape(a) {
        var b = { "=": "=0", ":": "=2" };
        return "$" + a.replace(/[=:]/g, function(a2) {
          return b[a2];
        });
      }
      var P = /\/+/g;
      function Q(a, b) {
        return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
      }
      function R(a, b, e, d, c) {
        var k = typeof a;
        if ("undefined" === k || "boolean" === k) a = null;
        var h = false;
        if (null === a) h = true;
        else switch (k) {
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
        if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
          return a2;
        })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
        h = 0;
        d = "" === d ? "." : d + ":";
        if (I(a)) for (var g = 0; g < a.length; g++) {
          k = a[g];
          var f = d + Q(k, g);
          h += R(k, b, e, f, c);
        }
        else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
        else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
        return h;
      }
      function S(a, b, e) {
        if (null == a) return a;
        var d = [], c = 0;
        R(a, d, "", "", function(a2) {
          return b.call(e, a2, c++);
        });
        return d;
      }
      function T(a) {
        if (-1 === a._status) {
          var b = a._result;
          b = b();
          b.then(function(b2) {
            if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
          }, function(b2) {
            if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
          });
          -1 === a._status && (a._status = 0, a._result = b);
        }
        if (1 === a._status) return a._result.default;
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
        if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
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
        if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
        var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
        if (null != b) {
          void 0 !== b.ref && (k = b.ref, h = K.current);
          void 0 !== b.key && (c = "" + b.key);
          if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
          for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
        }
        var f = arguments.length - 2;
        if (1 === f) d.children = e;
        else if (1 < f) {
          g = Array(f);
          for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
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
        return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
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
      exports.useDebugValue = function() {
      };
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
    }
  });

  // ../../node_modules/.bun/react@18.3.1/node_modules/react/index.js
  var require_react = __commonJS({
    "../../node_modules/.bun/react@18.3.1/node_modules/react/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_production_min();
      } else {
        module.exports = null;
      }
    }
  });

  // ../../node_modules/.bun/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.production.min.js
  var require_scheduler_production_min = __commonJS({
    "../../node_modules/.bun/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.production.min.js"(exports) {
      "use strict";
      function f(a, b) {
        var c = a.length;
        a.push(b);
        a: for (; 0 < c; ) {
          var d = c - 1 >>> 1, e = a[d];
          if (0 < g(e, b)) a[d] = b, a[c] = e, c = d;
          else break a;
        }
      }
      function h(a) {
        return 0 === a.length ? null : a[0];
      }
      function k(a) {
        if (0 === a.length) return null;
        var b = a[0], c = a.pop();
        if (c !== b) {
          a[0] = c;
          a: for (var d = 0, e = a.length, w = e >>> 1; d < w; ) {
            var m = 2 * (d + 1) - 1, C = a[m], n = m + 1, x = a[n];
            if (0 > g(C, c)) n < e && 0 > g(x, C) ? (a[d] = x, a[n] = c, d = n) : (a[d] = C, a[m] = c, d = m);
            else if (n < e && 0 > g(x, c)) a[d] = x, a[n] = c, d = n;
            else break a;
          }
        }
        return b;
      }
      function g(a, b) {
        var c = a.sortIndex - b.sortIndex;
        return 0 !== c ? c : a.id - b.id;
      }
      if ("object" === typeof performance && "function" === typeof performance.now) {
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
      var D = "function" === typeof setTimeout ? setTimeout : null;
      var E = "function" === typeof clearTimeout ? clearTimeout : null;
      var F = "undefined" !== typeof setImmediate ? setImmediate : null;
      "undefined" !== typeof navigator && void 0 !== navigator.scheduling && void 0 !== navigator.scheduling.isInputPending && navigator.scheduling.isInputPending.bind(navigator.scheduling);
      function G(a) {
        for (var b = h(t); null !== b; ) {
          if (null === b.callback) k(t);
          else if (b.startTime <= a) k(t), b.sortIndex = b.expirationTime, f(r, b);
          else break;
          b = h(t);
        }
      }
      function H(a) {
        B = false;
        G(a);
        if (!A) if (null !== h(r)) A = true, I(J);
        else {
          var b = h(t);
          null !== b && K(H, b.startTime - a);
        }
      }
      function J(a, b) {
        A = false;
        B && (B = false, E(L), L = -1);
        z = true;
        var c = y;
        try {
          G(b);
          for (v = h(r); null !== v && (!(v.expirationTime > b) || a && !M()); ) {
            var d = v.callback;
            if ("function" === typeof d) {
              v.callback = null;
              y = v.priorityLevel;
              var e = d(v.expirationTime <= b);
              b = exports.unstable_now();
              "function" === typeof e ? v.callback = e : v === h(r) && k(r);
              G(b);
            } else k(r);
            v = h(r);
          }
          if (null !== v) var w = true;
          else {
            var m = h(t);
            null !== m && K(H, m.startTime - b);
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
        if (null !== O) {
          var a = exports.unstable_now();
          Q = a;
          var b = true;
          try {
            b = O(true, a);
          } finally {
            b ? S() : (N = false, O = null);
          }
        } else N = false;
      }
      var S;
      if ("function" === typeof F) S = function() {
        F(R);
      };
      else if ("undefined" !== typeof MessageChannel) {
        T = new MessageChannel(), U = T.port2;
        T.port1.onmessage = R;
        S = function() {
          U.postMessage(null);
        };
      } else S = function() {
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
        0 > a || 125 < a ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P = 0 < a ? Math.floor(1e3 / a) : 5;
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
      exports.unstable_pauseExecution = function() {
      };
      exports.unstable_requestPaint = function() {
      };
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
        "object" === typeof c && null !== c ? (c = c.delay, c = "number" === typeof c && 0 < c ? d + c : d) : c = d;
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
            e = 5e3;
        }
        e = c + e;
        a = { id: u++, callback: b, priorityLevel: a, startTime: c, expirationTime: e, sortIndex: -1 };
        c > d ? (a.sortIndex = c, f(t, a), null === h(r) && a === h(t) && (B ? (E(L), L = -1) : B = true, K(H, c - d))) : (a.sortIndex = e, f(r, a), A || z || (A = true, I(J)));
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
    }
  });

  // ../../node_modules/.bun/scheduler@0.23.2/node_modules/scheduler/index.js
  var require_scheduler = __commonJS({
    "../../node_modules/.bun/scheduler@0.23.2/node_modules/scheduler/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_scheduler_production_min();
      } else {
        module.exports = null;
      }
    }
  });

  // ../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/cjs/react-reconciler.production.min.js
  var require_react_reconciler_production_min = __commonJS({
    "../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/cjs/react-reconciler.production.min.js"(exports, module) {
      module.exports = function $$$reconciler($$$hostConfig) {
        var exports2 = {};
        "use strict";
        var aa = require_react(), ba = require_scheduler(), ca = Object.assign;
        function n(a) {
          for (var b = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c = 1; c < arguments.length; c++) b += "&args[]=" + encodeURIComponent(arguments[c]);
          return "Minified React error #" + a + "; visit " + b + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
        }
        var da = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, ea = /* @__PURE__ */ Symbol.for("react.element"), fa = /* @__PURE__ */ Symbol.for("react.portal"), ha = /* @__PURE__ */ Symbol.for("react.fragment"), ia = /* @__PURE__ */ Symbol.for("react.strict_mode"), ja = /* @__PURE__ */ Symbol.for("react.profiler"), ka = /* @__PURE__ */ Symbol.for("react.provider"), la = /* @__PURE__ */ Symbol.for("react.context"), ma = /* @__PURE__ */ Symbol.for("react.forward_ref"), na = /* @__PURE__ */ Symbol.for("react.suspense"), oa = /* @__PURE__ */ Symbol.for("react.suspense_list"), pa = /* @__PURE__ */ Symbol.for("react.memo"), qa = /* @__PURE__ */ Symbol.for("react.lazy");
        /* @__PURE__ */ Symbol.for("react.scope");
        /* @__PURE__ */ Symbol.for("react.debug_trace_mode");
        var ra = /* @__PURE__ */ Symbol.for("react.offscreen");
        /* @__PURE__ */ Symbol.for("react.legacy_hidden");
        /* @__PURE__ */ Symbol.for("react.cache");
        /* @__PURE__ */ Symbol.for("react.tracing_marker");
        var sa = Symbol.iterator;
        function ta(a) {
          if (null === a || "object" !== typeof a) return null;
          a = sa && a[sa] || a["@@iterator"];
          return "function" === typeof a ? a : null;
        }
        function ua(a) {
          if (null == a) return null;
          if ("function" === typeof a) return a.displayName || a.name || null;
          if ("string" === typeof a) return a;
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
          if ("object" === typeof a) switch (a.$$typeof) {
            case la:
              return (a.displayName || "Context") + ".Consumer";
            case ka:
              return (a._context.displayName || "Context") + ".Provider";
            case ma:
              var b = a.render;
              a = a.displayName;
              a || (a = b.displayName || b.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
              return a;
            case pa:
              return b = a.displayName || null, null !== b ? b : ua(a.type) || "Memo";
            case qa:
              b = a._payload;
              a = a._init;
              try {
                return ua(a(b));
              } catch (c) {
              }
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
              return a = b.render, a = a.displayName || a.name || "", b.displayName || ("" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
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
              if ("function" === typeof b) return b.displayName || b.name || null;
              if ("string" === typeof b) return b;
          }
          return null;
        }
        function wa(a) {
          var b = a, c = a;
          if (a.alternate) for (; b.return; ) b = b.return;
          else {
            a = b;
            do
              b = a, 0 !== (b.flags & 4098) && (c = b.return), a = b.return;
            while (a);
          }
          return 3 === b.tag ? c : null;
        }
        function xa(a) {
          if (wa(a) !== a) throw Error(n(188));
        }
        function za(a) {
          var b = a.alternate;
          if (!b) {
            b = wa(a);
            if (null === b) throw Error(n(188));
            return b !== a ? null : a;
          }
          for (var c = a, d = b; ; ) {
            var e = c.return;
            if (null === e) break;
            var f = e.alternate;
            if (null === f) {
              d = e.return;
              if (null !== d) {
                c = d;
                continue;
              }
              break;
            }
            if (e.child === f.child) {
              for (f = e.child; f; ) {
                if (f === c) return xa(e), a;
                if (f === d) return xa(e), b;
                f = f.sibling;
              }
              throw Error(n(188));
            }
            if (c.return !== d.return) c = e, d = f;
            else {
              for (var g = false, h = e.child; h; ) {
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
                for (h = f.child; h; ) {
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
                if (!g) throw Error(n(189));
              }
            }
            if (c.alternate !== d) throw Error(n(190));
          }
          if (3 !== c.tag) throw Error(n(188));
          return c.stateNode.current === c ? a : b;
        }
        function Aa(a) {
          a = za(a);
          return null !== a ? Ba(a) : null;
        }
        function Ba(a) {
          if (5 === a.tag || 6 === a.tag) return a;
          for (a = a.child; null !== a; ) {
            var b = Ba(a);
            if (null !== b) return b;
            a = a.sibling;
          }
          return null;
        }
        function Ca(a) {
          if (5 === a.tag || 6 === a.tag) return a;
          for (a = a.child; null !== a; ) {
            if (4 !== a.tag) {
              var b = Ca(a);
              if (null !== b) return b;
            }
            a = a.sibling;
          }
          return null;
        }
        var Da = Array.isArray, Ea = $$$hostConfig.getPublicInstance, Fa = $$$hostConfig.getRootHostContext, Ga = $$$hostConfig.getChildHostContext, Ha = $$$hostConfig.prepareForCommit, Ia = $$$hostConfig.resetAfterCommit, Ja = $$$hostConfig.createInstance, Ka = $$$hostConfig.appendInitialChild, La = $$$hostConfig.finalizeInitialChildren, Ma = $$$hostConfig.prepareUpdate, Na = $$$hostConfig.shouldSetTextContent, Oa = $$$hostConfig.createTextInstance, Pa = $$$hostConfig.scheduleTimeout, Qa = $$$hostConfig.cancelTimeout, Ra = $$$hostConfig.noTimeout, Sa = $$$hostConfig.isPrimaryRenderer, Ta = $$$hostConfig.supportsMutation, Ua = $$$hostConfig.supportsPersistence, Va = $$$hostConfig.supportsHydration, Wa = $$$hostConfig.getInstanceFromNode, Xa = $$$hostConfig.preparePortalMount, Ya = $$$hostConfig.getCurrentEventPriority, Za = $$$hostConfig.detachDeletedInstance, $a = $$$hostConfig.supportsMicrotasks, ab = $$$hostConfig.scheduleMicrotask, bb = $$$hostConfig.supportsTestSelectors, cb = $$$hostConfig.findFiberRoot, db = $$$hostConfig.getBoundingRect, eb = $$$hostConfig.getTextContent, fb = $$$hostConfig.isHiddenSubtree, gb = $$$hostConfig.matchAccessibilityRole, hb = $$$hostConfig.setFocusIfFocusable, ib = $$$hostConfig.setupIntersectionObserver, jb = $$$hostConfig.appendChild, kb = $$$hostConfig.appendChildToContainer, lb = $$$hostConfig.commitTextUpdate, mb = $$$hostConfig.commitMount, nb = $$$hostConfig.commitUpdate, ob = $$$hostConfig.insertBefore, pb = $$$hostConfig.insertInContainerBefore, qb = $$$hostConfig.removeChild, rb = $$$hostConfig.removeChildFromContainer, sb = $$$hostConfig.resetTextContent, tb = $$$hostConfig.hideInstance, ub = $$$hostConfig.hideTextInstance, vb = $$$hostConfig.unhideInstance, wb = $$$hostConfig.unhideTextInstance, xb = $$$hostConfig.clearContainer, yb = $$$hostConfig.cloneInstance, zb = $$$hostConfig.createContainerChildSet, Ab = $$$hostConfig.appendChildToContainerChildSet, Bb = $$$hostConfig.finalizeContainerChildren, Cb = $$$hostConfig.replaceContainerChildren, Eb = $$$hostConfig.cloneHiddenInstance, Fb = $$$hostConfig.cloneHiddenTextInstance, Gb = $$$hostConfig.canHydrateInstance, Hb = $$$hostConfig.canHydrateTextInstance, Ib = $$$hostConfig.canHydrateSuspenseInstance, Jb = $$$hostConfig.isSuspenseInstancePending, Kb = $$$hostConfig.isSuspenseInstanceFallback, Lb = $$$hostConfig.getSuspenseInstanceFallbackErrorDetails, Mb = $$$hostConfig.registerSuspenseInstanceRetry, Nb = $$$hostConfig.getNextHydratableSibling, Ob = $$$hostConfig.getFirstHydratableChild, Pb = $$$hostConfig.getFirstHydratableChildWithinContainer, Qb = $$$hostConfig.getFirstHydratableChildWithinSuspenseInstance, Rb = $$$hostConfig.hydrateInstance, Sb = $$$hostConfig.hydrateTextInstance, Tb = $$$hostConfig.hydrateSuspenseInstance, Ub = $$$hostConfig.getNextHydratableInstanceAfterSuspenseInstance, Vb = $$$hostConfig.commitHydratedContainer, Wb = $$$hostConfig.commitHydratedSuspenseInstance, Xb = $$$hostConfig.clearSuspenseBoundary, Yb = $$$hostConfig.clearSuspenseBoundaryFromContainer, Zb = $$$hostConfig.shouldDeleteUnhydratedTailInstances, $b = $$$hostConfig.didNotMatchHydratedContainerTextInstance, ac = $$$hostConfig.didNotMatchHydratedTextInstance, bc;
        function cc(a) {
          if (void 0 === bc) try {
            throw Error();
          } catch (c) {
            var b = c.stack.trim().match(/\n( *(at )?)/);
            bc = b && b[1] || "";
          }
          return "\n" + bc + a;
        }
        var dc = false;
        function ec(a, b) {
          if (!a || dc) return "";
          dc = true;
          var c = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          try {
            if (b) if (b = function() {
              throw Error();
            }, Object.defineProperty(b.prototype, "props", { set: function() {
              throw Error();
            } }), "object" === typeof Reflect && Reflect.construct) {
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
            if (l && d && "string" === typeof l.stack) {
              for (var e = l.stack.split("\n"), f = d.stack.split("\n"), g = e.length - 1, h = f.length - 1; 1 <= g && 0 <= h && e[g] !== f[h]; ) h--;
              for (; 1 <= g && 0 <= h; g--, h--) if (e[g] !== f[h]) {
                if (1 !== g || 1 !== h) {
                  do
                    if (g--, h--, 0 > h || e[g] !== f[h]) {
                      var k = "\n" + e[g].replace(" at new ", " at ");
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
          if (!c) return jc;
          var d = a.stateNode;
          if (d && d.__reactInternalMemoizedUnmaskedChildContext === b) return d.__reactInternalMemoizedMaskedChildContext;
          var e = {}, f;
          for (f in c) e[f] = b[f];
          d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b, a.__reactInternalMemoizedMaskedChildContext = e);
          return e;
        }
        function A(a) {
          a = a.childContextTypes;
          return null !== a && void 0 !== a;
        }
        function nc() {
          q(z);
          q(x);
        }
        function oc(a, b, c) {
          if (x.current !== jc) throw Error(n(168));
          v(x, b);
          v(z, c);
        }
        function pc(a, b, c) {
          var d = a.stateNode;
          b = b.childContextTypes;
          if ("function" !== typeof d.getChildContext) return c;
          d = d.getChildContext();
          for (var e in d) if (!(e in b)) throw Error(n(108, va(a) || "Unknown", e));
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
          if (!d) throw Error(n(169));
          c ? (a = pc(a, b, kc), d.__reactInternalMemoizedMergedChildContext = a, q(z), q(x), v(x, a)) : q(z);
          v(z, c);
        }
        var tc = Math.clz32 ? Math.clz32 : sc, uc = Math.log, vc = Math.LN2;
        function sc(a) {
          a >>>= 0;
          return 0 === a ? 32 : 31 - (uc(a) / vc | 0) | 0;
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
          if (0 === c) return 0;
          var d = 0, e = a.suspendedLanes, f = a.pingedLanes, g = c & 268435455;
          if (0 !== g) {
            var h = g & ~e;
            0 !== h ? d = yc(h) : (f &= g, 0 !== f && (d = yc(f)));
          } else g = c & ~e, 0 !== g ? d = yc(g) : 0 !== f && (d = yc(f));
          if (0 === d) return 0;
          if (0 !== b && b !== d && 0 === (b & e) && (e = d & -d, f = b & -b, e >= f || 16 === e && 0 !== (f & 4194240))) return b;
          0 !== (d & 4) && (d |= c & 16);
          b = a.entangledLanes;
          if (0 !== b) for (a = a.entanglements, b &= d; 0 < b; ) c = 31 - tc(b), e = 1 << c, d |= a[c], b &= ~e;
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
              return b + 5e3;
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
          for (var c = a.suspendedLanes, d = a.pingedLanes, e = a.expirationTimes, f = a.pendingLanes; 0 < f; ) {
            var g = 31 - tc(f), h = 1 << g, k = e[g];
            if (-1 === k) {
              if (0 === (h & c) || 0 !== (h & d)) e[g] = Ac(h, b);
            } else k <= b && (a.expiredLanes |= h);
            f &= ~h;
          }
        }
        function Cc(a) {
          a = a.pendingLanes & -1073741825;
          return 0 !== a ? a : a & 1073741824 ? 1073741824 : 0;
        }
        function Dc() {
          var a = wc;
          wc <<= 1;
          0 === (wc & 4194240) && (wc = 64);
          return a;
        }
        function Ec(a) {
          for (var b = [], c = 0; 31 > c; c++) b.push(a);
          return b;
        }
        function Fc(a, b, c) {
          a.pendingLanes |= b;
          536870912 !== b && (a.suspendedLanes = 0, a.pingedLanes = 0);
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
          for (a = a.expirationTimes; 0 < c; ) {
            var e = 31 - tc(c), f = 1 << e;
            b[e] = 0;
            d[e] = -1;
            a[e] = -1;
            c &= ~f;
          }
        }
        function Hc(a, b) {
          var c = a.entangledLanes |= b;
          for (a = a.entanglements; c; ) {
            var d = 31 - tc(c), e = 1 << d;
            e & b | a[d] & b && (a[d] |= b);
            c &= ~e;
          }
        }
        var C = 0;
        function Ic(a) {
          a &= -a;
          return 1 < a ? 4 < a ? 0 !== (a & 268435455) ? 16 : 536870912 : 4 : 1;
        }
        var Jc = ba.unstable_scheduleCallback, Kc = ba.unstable_cancelCallback, Lc = ba.unstable_shouldYield, Mc = ba.unstable_requestPaint, D = ba.unstable_now, Nc = ba.unstable_ImmediatePriority, Oc = ba.unstable_UserBlockingPriority, Pc = ba.unstable_NormalPriority, Qc = ba.unstable_IdlePriority, Rc = null, Sc = null;
        function Tc(a) {
          if (Sc && "function" === typeof Sc.onCommitFiberRoot) try {
            Sc.onCommitFiberRoot(Rc, a, void 0, 128 === (a.current.flags & 128));
          } catch (b) {
          }
        }
        function Uc(a, b) {
          return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
        }
        var Vc = "function" === typeof Object.is ? Object.is : Uc, Wc = null, Xc = false, Yc = false;
        function Zc(a) {
          null === Wc ? Wc = [a] : Wc.push(a);
        }
        function $c(a) {
          Xc = true;
          Zc(a);
        }
        function ad() {
          if (!Yc && null !== Wc) {
            Yc = true;
            var a = 0, b = C;
            try {
              var c = Wc;
              for (C = 1; a < c.length; a++) {
                var d = c[a];
                do
                  d = d(true);
                while (null !== d);
              }
              Wc = null;
              Xc = false;
            } catch (e) {
              throw null !== Wc && (Wc = Wc.slice(a + 1)), Jc(Nc, ad), e;
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
          } else id = 1 << f | c << e | d, jd = a;
        }
        function md(a) {
          null !== a.return && (kd(a, 1), ld(a, 1, 0));
        }
        function nd(a) {
          for (; a === dd; ) dd = bd[--cd], bd[cd] = null, ed = bd[--cd], bd[cd] = null;
          for (; a === hd; ) hd = fd[--gd], fd[gd] = null, jd = fd[--gd], fd[gd] = null, id = fd[--gd], fd[gd] = null;
        }
        var od = null, pd = null, F = false, qd = false, rd = null;
        function sd(a, b) {
          var c = td(5, null, null, 0);
          c.elementType = "DELETED";
          c.stateNode = b;
          c.return = a;
          b = a.deletions;
          null === b ? (a.deletions = [c], a.flags |= 16) : b.push(c);
        }
        function ud(a, b) {
          switch (a.tag) {
            case 5:
              return b = Gb(b, a.type, a.pendingProps), null !== b ? (a.stateNode = b, od = a, pd = Ob(b), true) : false;
            case 6:
              return b = Hb(b, a.pendingProps), null !== b ? (a.stateNode = b, od = a, pd = null, true) : false;
            case 13:
              b = Ib(b);
              if (null !== b) {
                var c = null !== hd ? { id, overflow: jd } : null;
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
          return 0 !== (a.mode & 1) && 0 === (a.flags & 128);
        }
        function wd(a) {
          if (F) {
            var b = pd;
            if (b) {
              var c = b;
              if (!ud(a, b)) {
                if (vd(a)) throw Error(n(418));
                b = Nb(c);
                var d = od;
                b && ud(a, b) ? sd(d, c) : (a.flags = a.flags & -4097 | 2, F = false, od = a);
              }
            } else {
              if (vd(a)) throw Error(n(418));
              a.flags = a.flags & -4097 | 2;
              F = false;
              od = a;
            }
          }
        }
        function xd(a) {
          for (a = a.return; null !== a && 5 !== a.tag && 3 !== a.tag && 13 !== a.tag; ) a = a.return;
          od = a;
        }
        function yd(a) {
          if (!Va || a !== od) return false;
          if (!F) return xd(a), F = true, false;
          if (3 !== a.tag && (5 !== a.tag || Zb(a.type) && !Na(a.type, a.memoizedProps))) {
            var b = pd;
            if (b) {
              if (vd(a)) throw zd(), Error(n(418));
              for (; b; ) sd(a, b), b = Nb(b);
            }
          }
          xd(a);
          if (13 === a.tag) {
            if (!Va) throw Error(n(316));
            a = a.memoizedState;
            a = null !== a ? a.dehydrated : null;
            if (!a) throw Error(n(317));
            pd = Ub(a);
          } else pd = od ? Nb(a.stateNode) : null;
          return true;
        }
        function zd() {
          for (var a = pd; a; ) a = Nb(a);
        }
        function Ad() {
          Va && (pd = od = null, qd = F = false);
        }
        function Bd(a) {
          null === rd ? rd = [a] : rd.push(a);
        }
        var Cd = da.ReactCurrentBatchConfig;
        function Dd(a, b) {
          if (Vc(a, b)) return true;
          if ("object" !== typeof a || null === a || "object" !== typeof b || null === b) return false;
          var c = Object.keys(a), d = Object.keys(b);
          if (c.length !== d.length) return false;
          for (d = 0; d < c.length; d++) {
            var e = c[d];
            if (!fc.call(b, e) || !Vc(a[e], b[e])) return false;
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
          if (null !== a && "function" !== typeof a && "object" !== typeof a) {
            if (c._owner) {
              c = c._owner;
              if (c) {
                if (1 !== c.tag) throw Error(n(309));
                var d = c.stateNode;
              }
              if (!d) throw Error(n(147, a));
              var e = d, f = "" + a;
              if (null !== b && null !== b.ref && "function" === typeof b.ref && b.ref._stringRef === f) return b.ref;
              b = function(a2) {
                var b2 = e.refs;
                null === a2 ? delete b2[f] : b2[f] = a2;
              };
              b._stringRef = f;
              return b;
            }
            if ("string" !== typeof a) throw Error(n(284));
            if (!c._owner) throw Error(n(290, a));
          }
          return a;
        }
        function Gd(a, b) {
          a = Object.prototype.toString.call(b);
          throw Error(n(31, "[object Object]" === a ? "object with keys {" + Object.keys(b).join(", ") + "}" : a));
        }
        function Hd(a) {
          var b = a._init;
          return b(a._payload);
        }
        function Id(a) {
          function b(b2, c2) {
            if (a) {
              var d2 = b2.deletions;
              null === d2 ? (b2.deletions = [c2], b2.flags |= 16) : d2.push(c2);
            }
          }
          function c(c2, d2) {
            if (!a) return null;
            for (; null !== d2; ) b(c2, d2), d2 = d2.sibling;
            return null;
          }
          function d(a2, b2) {
            for (a2 = /* @__PURE__ */ new Map(); null !== b2; ) null !== b2.key ? a2.set(b2.key, b2) : a2.set(b2.index, b2), b2 = b2.sibling;
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
            if (!a) return b2.flags |= 1048576, c2;
            d2 = b2.alternate;
            if (null !== d2) return d2 = d2.index, d2 < c2 ? (b2.flags |= 2, c2) : d2;
            b2.flags |= 2;
            return c2;
          }
          function g(b2) {
            a && null === b2.alternate && (b2.flags |= 2);
            return b2;
          }
          function h(a2, b2, c2, d2) {
            if (null === b2 || 6 !== b2.tag) return b2 = Kd(c2, a2.mode, d2), b2.return = a2, b2;
            b2 = e(b2, c2);
            b2.return = a2;
            return b2;
          }
          function k(a2, b2, c2, d2) {
            var f2 = c2.type;
            if (f2 === ha) return m(a2, b2, c2.props.children, d2, c2.key);
            if (null !== b2 && (b2.elementType === f2 || "object" === typeof f2 && null !== f2 && f2.$$typeof === qa && Hd(f2) === b2.type)) return d2 = e(b2, c2.props), d2.ref = Fd(a2, b2, c2), d2.return = a2, d2;
            d2 = Ld(c2.type, c2.key, c2.props, null, a2.mode, d2);
            d2.ref = Fd(a2, b2, c2);
            d2.return = a2;
            return d2;
          }
          function l(a2, b2, c2, d2) {
            if (null === b2 || 4 !== b2.tag || b2.stateNode.containerInfo !== c2.containerInfo || b2.stateNode.implementation !== c2.implementation) return b2 = Md(c2, a2.mode, d2), b2.return = a2, b2;
            b2 = e(b2, c2.children || []);
            b2.return = a2;
            return b2;
          }
          function m(a2, b2, c2, d2, f2) {
            if (null === b2 || 7 !== b2.tag) return b2 = Nd(c2, a2.mode, d2, f2), b2.return = a2, b2;
            b2 = e(b2, c2);
            b2.return = a2;
            return b2;
          }
          function r(a2, b2, c2) {
            if ("string" === typeof b2 && "" !== b2 || "number" === typeof b2) return b2 = Kd("" + b2, a2.mode, c2), b2.return = a2, b2;
            if ("object" === typeof b2 && null !== b2) {
              switch (b2.$$typeof) {
                case ea:
                  return c2 = Ld(b2.type, b2.key, b2.props, null, a2.mode, c2), c2.ref = Fd(a2, null, b2), c2.return = a2, c2;
                case fa:
                  return b2 = Md(b2, a2.mode, c2), b2.return = a2, b2;
                case qa:
                  var d2 = b2._init;
                  return r(a2, d2(b2._payload), c2);
              }
              if (Da(b2) || ta(b2)) return b2 = Nd(b2, a2.mode, c2, null), b2.return = a2, b2;
              Gd(a2, b2);
            }
            return null;
          }
          function p(a2, b2, c2, d2) {
            var e2 = null !== b2 ? b2.key : null;
            if ("string" === typeof c2 && "" !== c2 || "number" === typeof c2) return null !== e2 ? null : h(a2, b2, "" + c2, d2);
            if ("object" === typeof c2 && null !== c2) {
              switch (c2.$$typeof) {
                case ea:
                  return c2.key === e2 ? k(a2, b2, c2, d2) : null;
                case fa:
                  return c2.key === e2 ? l(a2, b2, c2, d2) : null;
                case qa:
                  return e2 = c2._init, p(
                    a2,
                    b2,
                    e2(c2._payload),
                    d2
                  );
              }
              if (Da(c2) || ta(c2)) return null !== e2 ? null : m(a2, b2, c2, d2, null);
              Gd(a2, c2);
            }
            return null;
          }
          function B(a2, b2, c2, d2, e2) {
            if ("string" === typeof d2 && "" !== d2 || "number" === typeof d2) return a2 = a2.get(c2) || null, h(b2, a2, "" + d2, e2);
            if ("object" === typeof d2 && null !== d2) {
              switch (d2.$$typeof) {
                case ea:
                  return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, k(b2, a2, d2, e2);
                case fa:
                  return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, l(b2, a2, d2, e2);
                case qa:
                  var f2 = d2._init;
                  return B(a2, b2, c2, f2(d2._payload), e2);
              }
              if (Da(d2) || ta(d2)) return a2 = a2.get(c2) || null, m(b2, a2, d2, e2, null);
              Gd(b2, d2);
            }
            return null;
          }
          function w(e2, g2, h2, k2) {
            for (var l2 = null, m2 = null, u = g2, t = g2 = 0, E = null; null !== u && t < h2.length; t++) {
              u.index > t ? (E = u, u = null) : E = u.sibling;
              var y = p(e2, u, h2[t], k2);
              if (null === y) {
                null === u && (u = E);
                break;
              }
              a && u && null === y.alternate && b(e2, u);
              g2 = f(y, g2, t);
              null === m2 ? l2 = y : m2.sibling = y;
              m2 = y;
              u = E;
            }
            if (t === h2.length) return c(e2, u), F && kd(e2, t), l2;
            if (null === u) {
              for (; t < h2.length; t++) u = r(e2, h2[t], k2), null !== u && (g2 = f(u, g2, t), null === m2 ? l2 = u : m2.sibling = u, m2 = u);
              F && kd(e2, t);
              return l2;
            }
            for (u = d(e2, u); t < h2.length; t++) E = B(u, e2, t, h2[t], k2), null !== E && (a && null !== E.alternate && u.delete(null === E.key ? t : E.key), g2 = f(E, g2, t), null === m2 ? l2 = E : m2.sibling = E, m2 = E);
            a && u.forEach(function(a2) {
              return b(e2, a2);
            });
            F && kd(e2, t);
            return l2;
          }
          function Y(e2, g2, h2, k2) {
            var l2 = ta(h2);
            if ("function" !== typeof l2) throw Error(n(150));
            h2 = l2.call(h2);
            if (null == h2) throw Error(n(151));
            for (var u = l2 = null, m2 = g2, t = g2 = 0, E = null, y = h2.next(); null !== m2 && !y.done; t++, y = h2.next()) {
              m2.index > t ? (E = m2, m2 = null) : E = m2.sibling;
              var w2 = p(e2, m2, y.value, k2);
              if (null === w2) {
                null === m2 && (m2 = E);
                break;
              }
              a && m2 && null === w2.alternate && b(e2, m2);
              g2 = f(w2, g2, t);
              null === u ? l2 = w2 : u.sibling = w2;
              u = w2;
              m2 = E;
            }
            if (y.done) return c(
              e2,
              m2
            ), F && kd(e2, t), l2;
            if (null === m2) {
              for (; !y.done; t++, y = h2.next()) y = r(e2, y.value, k2), null !== y && (g2 = f(y, g2, t), null === u ? l2 = y : u.sibling = y, u = y);
              F && kd(e2, t);
              return l2;
            }
            for (m2 = d(e2, m2); !y.done; t++, y = h2.next()) y = B(m2, e2, t, y.value, k2), null !== y && (a && null !== y.alternate && m2.delete(null === y.key ? t : y.key), g2 = f(y, g2, t), null === u ? l2 = y : u.sibling = y, u = y);
            a && m2.forEach(function(a2) {
              return b(e2, a2);
            });
            F && kd(e2, t);
            return l2;
          }
          function ya(a2, d2, f2, h2) {
            "object" === typeof f2 && null !== f2 && f2.type === ha && null === f2.key && (f2 = f2.props.children);
            if ("object" === typeof f2 && null !== f2) {
              switch (f2.$$typeof) {
                case ea:
                  a: {
                    for (var k2 = f2.key, l2 = d2; null !== l2; ) {
                      if (l2.key === k2) {
                        k2 = f2.type;
                        if (k2 === ha) {
                          if (7 === l2.tag) {
                            c(a2, l2.sibling);
                            d2 = e(l2, f2.props.children);
                            d2.return = a2;
                            a2 = d2;
                            break a;
                          }
                        } else if (l2.elementType === k2 || "object" === typeof k2 && null !== k2 && k2.$$typeof === qa && Hd(k2) === l2.type) {
                          c(a2, l2.sibling);
                          d2 = e(l2, f2.props);
                          d2.ref = Fd(a2, l2, f2);
                          d2.return = a2;
                          a2 = d2;
                          break a;
                        }
                        c(a2, l2);
                        break;
                      } else b(a2, l2);
                      l2 = l2.sibling;
                    }
                    f2.type === ha ? (d2 = Nd(f2.props.children, a2.mode, h2, f2.key), d2.return = a2, a2 = d2) : (h2 = Ld(f2.type, f2.key, f2.props, null, a2.mode, h2), h2.ref = Fd(a2, d2, f2), h2.return = a2, a2 = h2);
                  }
                  return g(a2);
                case fa:
                  a: {
                    for (l2 = f2.key; null !== d2; ) {
                      if (d2.key === l2) if (4 === d2.tag && d2.stateNode.containerInfo === f2.containerInfo && d2.stateNode.implementation === f2.implementation) {
                        c(a2, d2.sibling);
                        d2 = e(d2, f2.children || []);
                        d2.return = a2;
                        a2 = d2;
                        break a;
                      } else {
                        c(a2, d2);
                        break;
                      }
                      else b(a2, d2);
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
              if (Da(f2)) return w(a2, d2, f2, h2);
              if (ta(f2)) return Y(a2, d2, f2, h2);
              Gd(a2, f2);
            }
            return "string" === typeof f2 && "" !== f2 || "number" === typeof f2 ? (f2 = "" + f2, null !== d2 && 6 === d2.tag ? (c(a2, d2.sibling), d2 = e(d2, f2), d2.return = a2, a2 = d2) : (c(a2, d2), d2 = Kd(f2, a2.mode, h2), d2.return = a2, a2 = d2), g(a2)) : c(a2, d2);
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
          for (; null !== a; ) {
            var d = a.alternate;
            (a.childLanes & b) !== b ? (a.childLanes |= b, null !== d && (d.childLanes |= b)) : null !== d && (d.childLanes & b) !== b && (d.childLanes |= b);
            if (a === c) break;
            a = a.return;
          }
        }
        function Yd(a, b) {
          Rd = a;
          Td = Sd = null;
          a = a.dependencies;
          null !== a && null !== a.firstContext && (0 !== (a.lanes & b) && (G = true), a.firstContext = null);
        }
        function Zd(a) {
          var b = Sa ? a._currentValue : a._currentValue2;
          if (Td !== a) if (a = { context: a, memoizedValue: b, next: null }, null === Sd) {
            if (null === Rd) throw Error(n(308));
            Sd = a;
            Rd.dependencies = { lanes: 0, firstContext: a };
          } else Sd = Sd.next = a;
          return b;
        }
        var $d = null;
        function ae(a) {
          null === $d ? $d = [a] : $d.push(a);
        }
        function be(a, b, c, d) {
          var e = b.interleaved;
          null === e ? (c.next = c, ae(b)) : (c.next = e.next, e.next = c);
          b.interleaved = c;
          return ce(a, d);
        }
        function ce(a, b) {
          a.lanes |= b;
          var c = a.alternate;
          null !== c && (c.lanes |= b);
          c = a;
          for (a = a.return; null !== a; ) a.childLanes |= b, c = a.alternate, null !== c && (c.childLanes |= b), c = a, a = a.return;
          return 3 === c.tag ? c.stateNode : null;
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
          if (null === d) return null;
          d = d.shared;
          if (0 !== (H & 2)) {
            var e = d.pending;
            null === e ? b.next = b : (b.next = e.next, e.next = b);
            d.pending = b;
            return ce(a, c);
          }
          e = d.interleaved;
          null === e ? (b.next = b, ae(d)) : (b.next = e.next, e.next = b);
          d.interleaved = b;
          return ce(a, c);
        }
        function ie(a, b, c) {
          b = b.updateQueue;
          if (null !== b && (b = b.shared, 0 !== (c & 4194240))) {
            var d = b.lanes;
            d &= a.pendingLanes;
            c |= d;
            b.lanes = c;
            Hc(a, c);
          }
        }
        function je(a, b) {
          var c = a.updateQueue, d = a.alternate;
          if (null !== d && (d = d.updateQueue, c === d)) {
            var e = null, f = null;
            c = c.firstBaseUpdate;
            if (null !== c) {
              do {
                var g = { eventTime: c.eventTime, lane: c.lane, tag: c.tag, payload: c.payload, callback: c.callback, next: null };
                null === f ? e = f = g : f = f.next = g;
                c = c.next;
              } while (null !== c);
              null === f ? e = f = b : f = f.next = b;
            } else e = f = b;
            c = { baseState: d.baseState, firstBaseUpdate: e, lastBaseUpdate: f, shared: d.shared, effects: d.effects };
            a.updateQueue = c;
            return;
          }
          a = c.lastBaseUpdate;
          null === a ? c.firstBaseUpdate = b : a.next = b;
          c.lastBaseUpdate = b;
        }
        function ke(a, b, c, d) {
          var e = a.updateQueue;
          de = false;
          var f = e.firstBaseUpdate, g = e.lastBaseUpdate, h = e.shared.pending;
          if (null !== h) {
            e.shared.pending = null;
            var k = h, l = k.next;
            k.next = null;
            null === g ? f = l : g.next = l;
            g = k;
            var m = a.alternate;
            null !== m && (m = m.updateQueue, h = m.lastBaseUpdate, h !== g && (null === h ? m.firstBaseUpdate = l : h.next = l, m.lastBaseUpdate = k));
          }
          if (null !== f) {
            var r = e.baseState;
            g = 0;
            m = l = k = null;
            h = f;
            do {
              var p = h.lane, B = h.eventTime;
              if ((d & p) === p) {
                null !== m && (m = m.next = {
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
                      if ("function" === typeof w) {
                        r = w.call(B, r, p);
                        break a;
                      }
                      r = w;
                      break a;
                    case 3:
                      w.flags = w.flags & -65537 | 128;
                    case 0:
                      w = Y.payload;
                      p = "function" === typeof w ? w.call(B, r, p) : w;
                      if (null === p || void 0 === p) break a;
                      r = ca({}, r, p);
                      break a;
                    case 2:
                      de = true;
                  }
                }
                null !== h.callback && 0 !== h.lane && (a.flags |= 64, p = e.effects, null === p ? e.effects = [h] : p.push(h));
              } else B = { eventTime: B, lane: p, tag: h.tag, payload: h.payload, callback: h.callback, next: null }, null === m ? (l = m = B, k = r) : m = m.next = B, g |= p;
              h = h.next;
              if (null === h) if (h = e.shared.pending, null === h) break;
              else p = h, h = p.next, p.next = null, e.lastBaseUpdate = p, e.shared.pending = null;
            } while (1);
            null === m && (k = r);
            e.baseState = k;
            e.firstBaseUpdate = l;
            e.lastBaseUpdate = m;
            b = e.shared.interleaved;
            if (null !== b) {
              e = b;
              do
                g |= e.lane, e = e.next;
              while (e !== b);
            } else null === f && (e.shared.lanes = 0);
            le |= g;
            a.lanes = g;
            a.memoizedState = r;
          }
        }
        function me(a, b, c) {
          a = b.effects;
          b.effects = null;
          if (null !== a) for (b = 0; b < a.length; b++) {
            var d = a[b], e = d.callback;
            if (null !== e) {
              d.callback = null;
              d = c;
              if ("function" !== typeof e) throw Error(n(191, e));
              e.call(d);
            }
          }
        }
        var ne = {}, oe = ic(ne), pe = ic(ne), qe = ic(ne);
        function re(a) {
          if (a === ne) throw Error(n(174));
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
          for (var b = a; null !== b; ) {
            if (13 === b.tag) {
              var c = b.memoizedState;
              if (null !== c && (c = c.dehydrated, null === c || Jb(c) || Kb(c))) return b;
            } else if (19 === b.tag && void 0 !== b.memoizedProps.revealOrder) {
              if (0 !== (b.flags & 128)) return b;
            } else if (null !== b.child) {
              b.child.return = b;
              b = b.child;
              continue;
            }
            if (b === a) break;
            for (; null === b.sibling; ) {
              if (null === b.return || b.return === a) return null;
              b = b.return;
            }
            b.sibling.return = b.return;
            b = b.sibling;
          }
          return null;
        }
        var xe = [];
        function ye() {
          for (var a = 0; a < xe.length; a++) {
            var b = xe[a];
            Sa ? b._workInProgressVersionPrimary = null : b._workInProgressVersionSecondary = null;
          }
          xe.length = 0;
        }
        var ze = da.ReactCurrentDispatcher, Ae = da.ReactCurrentBatchConfig, Be = 0, J = null, K = null, L = null, Ce = false, De = false, Ee = 0, Fe = 0;
        function M() {
          throw Error(n(321));
        }
        function Ge(a, b) {
          if (null === b) return false;
          for (var c = 0; c < b.length && c < a.length; c++) if (!Vc(a[c], b[c])) return false;
          return true;
        }
        function He(a, b, c, d, e, f) {
          Be = f;
          J = b;
          b.memoizedState = null;
          b.updateQueue = null;
          b.lanes = 0;
          ze.current = null === a || null === a.memoizedState ? Ie : Je;
          a = c(d, e);
          if (De) {
            f = 0;
            do {
              De = false;
              Ee = 0;
              if (25 <= f) throw Error(n(301));
              f += 1;
              L = K = null;
              b.updateQueue = null;
              ze.current = Ke;
              a = c(d, e);
            } while (De);
          }
          ze.current = Le;
          b = null !== K && null !== K.next;
          Be = 0;
          L = K = J = null;
          Ce = false;
          if (b) throw Error(n(300));
          return a;
        }
        function Me() {
          var a = 0 !== Ee;
          Ee = 0;
          return a;
        }
        function Ne() {
          var a = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
          null === L ? J.memoizedState = L = a : L = L.next = a;
          return L;
        }
        function Oe() {
          if (null === K) {
            var a = J.alternate;
            a = null !== a ? a.memoizedState : null;
          } else a = K.next;
          var b = null === L ? J.memoizedState : L.next;
          if (null !== b) L = b, K = a;
          else {
            if (null === a) throw Error(n(310));
            K = a;
            a = { memoizedState: K.memoizedState, baseState: K.baseState, baseQueue: K.baseQueue, queue: K.queue, next: null };
            null === L ? J.memoizedState = L = a : L = L.next = a;
          }
          return L;
        }
        function Pe(a, b) {
          return "function" === typeof b ? b(a) : b;
        }
        function Qe(a) {
          var b = Oe(), c = b.queue;
          if (null === c) throw Error(n(311));
          c.lastRenderedReducer = a;
          var d = K, e = d.baseQueue, f = c.pending;
          if (null !== f) {
            if (null !== e) {
              var g = e.next;
              e.next = f.next;
              f.next = g;
            }
            d.baseQueue = e = f;
            c.pending = null;
          }
          if (null !== e) {
            f = e.next;
            d = d.baseState;
            var h = g = null, k = null, l = f;
            do {
              var m = l.lane;
              if ((Be & m) === m) null !== k && (k = k.next = { lane: 0, action: l.action, hasEagerState: l.hasEagerState, eagerState: l.eagerState, next: null }), d = l.hasEagerState ? l.eagerState : a(d, l.action);
              else {
                var r = {
                  lane: m,
                  action: l.action,
                  hasEagerState: l.hasEagerState,
                  eagerState: l.eagerState,
                  next: null
                };
                null === k ? (h = k = r, g = d) : k = k.next = r;
                J.lanes |= m;
                le |= m;
              }
              l = l.next;
            } while (null !== l && l !== f);
            null === k ? g = d : k.next = h;
            Vc(d, b.memoizedState) || (G = true);
            b.memoizedState = d;
            b.baseState = g;
            b.baseQueue = k;
            c.lastRenderedState = d;
          }
          a = c.interleaved;
          if (null !== a) {
            e = a;
            do
              f = e.lane, J.lanes |= f, le |= f, e = e.next;
            while (e !== a);
          } else null === e && (c.lanes = 0);
          return [b.memoizedState, c.dispatch];
        }
        function Re(a) {
          var b = Oe(), c = b.queue;
          if (null === c) throw Error(n(311));
          c.lastRenderedReducer = a;
          var d = c.dispatch, e = c.pending, f = b.memoizedState;
          if (null !== e) {
            c.pending = null;
            var g = e = e.next;
            do
              f = a(f, g.action), g = g.next;
            while (g !== e);
            Vc(f, b.memoizedState) || (G = true);
            b.memoizedState = f;
            null === b.baseQueue && (b.baseState = f);
            c.lastRenderedState = f;
          }
          return [f, d];
        }
        function Se() {
        }
        function Te(a, b) {
          var c = J, d = Oe(), e = b(), f = !Vc(d.memoizedState, e);
          f && (d.memoizedState = e, G = true);
          d = d.queue;
          Ue(Ve.bind(null, c, d, a), [a]);
          if (d.getSnapshot !== b || f || null !== L && L.memoizedState.tag & 1) {
            c.flags |= 2048;
            We(9, Xe.bind(null, c, d, e, b), void 0, null);
            if (null === N) throw Error(n(349));
            0 !== (Be & 30) || Ye(c, b, e);
          }
          return e;
        }
        function Ye(a, b, c) {
          a.flags |= 16384;
          a = { getSnapshot: b, value: c };
          b = J.updateQueue;
          null === b ? (b = { lastEffect: null, stores: null }, J.updateQueue = b, b.stores = [a]) : (c = b.stores, null === c ? b.stores = [a] : c.push(a));
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
          null !== b && af(b, a, 1, -1);
        }
        function bf(a) {
          var b = Ne();
          "function" === typeof a && (a = a());
          b.memoizedState = b.baseState = a;
          a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Pe, lastRenderedState: a };
          b.queue = a;
          a = a.dispatch = cf.bind(null, J, a);
          return [b.memoizedState, a];
        }
        function We(a, b, c, d) {
          a = { tag: a, create: b, destroy: c, deps: d, next: null };
          b = J.updateQueue;
          null === b ? (b = { lastEffect: null, stores: null }, J.updateQueue = b, b.lastEffect = a.next = a) : (c = b.lastEffect, null === c ? b.lastEffect = a.next = a : (d = c.next, c.next = a, a.next = d, b.lastEffect = a));
          return a;
        }
        function df() {
          return Oe().memoizedState;
        }
        function ef(a, b, c, d) {
          var e = Ne();
          J.flags |= a;
          e.memoizedState = We(1 | b, c, void 0, void 0 === d ? null : d);
        }
        function ff(a, b, c, d) {
          var e = Oe();
          d = void 0 === d ? null : d;
          var f = void 0;
          if (null !== K) {
            var g = K.memoizedState;
            f = g.destroy;
            if (null !== d && Ge(d, g.deps)) {
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
          if ("function" === typeof b) return a = a(), b(a), function() {
            b(null);
          };
          if (null !== b && void 0 !== b) return a = a(), b.current = a, function() {
            b.current = null;
          };
        }
        function lf(a, b, c) {
          c = null !== c && void 0 !== c ? c.concat([a]) : null;
          return ff(4, 4, kf.bind(null, b, a), c);
        }
        function mf() {
        }
        function nf(a, b) {
          var c = Oe();
          b = void 0 === b ? null : b;
          var d = c.memoizedState;
          if (null !== d && null !== b && Ge(b, d[1])) return d[0];
          c.memoizedState = [a, b];
          return a;
        }
        function of(a, b) {
          var c = Oe();
          b = void 0 === b ? null : b;
          var d = c.memoizedState;
          if (null !== d && null !== b && Ge(b, d[1])) return d[0];
          a = a();
          c.memoizedState = [a, b];
          return a;
        }
        function pf(a, b, c) {
          if (0 === (Be & 21)) return a.baseState && (a.baseState = false, G = true), a.memoizedState = c;
          Vc(c, b) || (c = Dc(), J.lanes |= c, le |= c, a.baseState = true);
          return b;
        }
        function qf(a, b) {
          var c = C;
          C = 0 !== c && 4 > c ? c : 4;
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
          if (uf(a)) vf(b, c);
          else if (c = be(a, b, c, d), null !== c) {
            var e = O();
            af(c, a, d, e);
            wf(c, b, d);
          }
        }
        function cf(a, b, c) {
          var d = tf(a), e = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
          if (uf(a)) vf(b, e);
          else {
            var f = a.alternate;
            if (0 === a.lanes && (null === f || 0 === f.lanes) && (f = b.lastRenderedReducer, null !== f)) try {
              var g = b.lastRenderedState, h = f(g, c);
              e.hasEagerState = true;
              e.eagerState = h;
              if (Vc(h, g)) {
                var k = b.interleaved;
                null === k ? (e.next = e, ae(b)) : (e.next = k.next, k.next = e);
                b.interleaved = e;
                return;
              }
            } catch (l) {
            } finally {
            }
            c = be(a, b, e, d);
            null !== c && (e = O(), af(c, a, d, e), wf(c, b, d));
          }
        }
        function uf(a) {
          var b = a.alternate;
          return a === J || null !== b && b === J;
        }
        function vf(a, b) {
          De = Ce = true;
          var c = a.pending;
          null === c ? b.next = b : (b.next = c.next, c.next = b);
          a.pending = b;
        }
        function wf(a, b, c) {
          if (0 !== (c & 4194240)) {
            var d = b.lanes;
            d &= a.pendingLanes;
            c |= d;
            b.lanes = c;
            Hc(a, c);
          }
        }
        var Le = { readContext: Zd, useCallback: M, useContext: M, useEffect: M, useImperativeHandle: M, useInsertionEffect: M, useLayoutEffect: M, useMemo: M, useReducer: M, useRef: M, useState: M, useDebugValue: M, useDeferredValue: M, useTransition: M, useMutableSource: M, useSyncExternalStore: M, useId: M, unstable_isNewReconciler: false }, Ie = { readContext: Zd, useCallback: function(a, b) {
          Ne().memoizedState = [a, void 0 === b ? null : b];
          return a;
        }, useContext: Zd, useEffect: gf, useImperativeHandle: function(a, b, c) {
          c = null !== c && void 0 !== c ? c.concat([a]) : null;
          return ef(
            4194308,
            4,
            kf.bind(null, b, a),
            c
          );
        }, useLayoutEffect: function(a, b) {
          return ef(4194308, 4, a, b);
        }, useInsertionEffect: function(a, b) {
          return ef(4, 2, a, b);
        }, useMemo: function(a, b) {
          var c = Ne();
          b = void 0 === b ? null : b;
          a = a();
          c.memoizedState = [a, b];
          return a;
        }, useReducer: function(a, b, c) {
          var d = Ne();
          b = void 0 !== c ? c(b) : b;
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
        }, useMutableSource: function() {
        }, useSyncExternalStore: function(a, b, c) {
          var d = J, e = Ne();
          if (F) {
            if (void 0 === c) throw Error(n(407));
            c = c();
          } else {
            c = b();
            if (null === N) throw Error(n(349));
            0 !== (Be & 30) || Ye(d, b, c);
          }
          e.memoizedState = c;
          var f = { value: c, getSnapshot: b };
          e.queue = f;
          gf(Ve.bind(
            null,
            d,
            f,
            a
          ), [a]);
          d.flags |= 2048;
          We(9, Xe.bind(null, d, f, c, b), void 0, null);
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
          } else c = Fe++, b = ":" + b + "r" + c.toString(32) + ":";
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
          return null === K ? b.memoizedState = a : pf(b, K.memoizedState, a);
        }, useTransition: function() {
          var a = Re(Pe)[0], b = Oe().memoizedState;
          return [a, b];
        }, useMutableSource: Se, useSyncExternalStore: Te, useId: rf, unstable_isNewReconciler: false };
        function xf(a, b) {
          if (a && a.defaultProps) {
            b = ca({}, b);
            a = a.defaultProps;
            for (var c in a) void 0 === b[c] && (b[c] = a[c]);
            return b;
          }
          return b;
        }
        function yf(a, b, c, d) {
          b = a.memoizedState;
          c = c(d, b);
          c = null === c || void 0 === c ? b : ca({}, b, c);
          a.memoizedState = c;
          0 === a.lanes && (a.updateQueue.baseState = c);
        }
        var zf = { isMounted: function(a) {
          return (a = a._reactInternals) ? wa(a) === a : false;
        }, enqueueSetState: function(a, b, c) {
          a = a._reactInternals;
          var d = O(), e = tf(a), f = ge(d, e);
          f.payload = b;
          void 0 !== c && null !== c && (f.callback = c);
          b = he(a, f, e);
          null !== b && (af(b, a, e, d), ie(b, a, e));
        }, enqueueReplaceState: function(a, b, c) {
          a = a._reactInternals;
          var d = O(), e = tf(a), f = ge(d, e);
          f.tag = 1;
          f.payload = b;
          void 0 !== c && null !== c && (f.callback = c);
          b = he(a, f, e);
          null !== b && (af(b, a, e, d), ie(b, a, e));
        }, enqueueForceUpdate: function(a, b) {
          a = a._reactInternals;
          var c = O(), d = tf(a), e = ge(c, d);
          e.tag = 2;
          void 0 !== b && null !== b && (e.callback = b);
          b = he(a, e, d);
          null !== b && (af(b, a, d, c), ie(b, a, d));
        } };
        function Af(a, b, c, d, e, f, g) {
          a = a.stateNode;
          return "function" === typeof a.shouldComponentUpdate ? a.shouldComponentUpdate(d, f, g) : b.prototype && b.prototype.isPureReactComponent ? !Dd(c, d) || !Dd(e, f) : true;
        }
        function Bf(a, b, c) {
          var d = false, e = jc;
          var f = b.contextType;
          "object" === typeof f && null !== f ? f = Zd(f) : (e = A(b) ? kc : x.current, d = b.contextTypes, f = (d = null !== d && void 0 !== d) ? mc(a, e) : jc);
          b = new b(c, f);
          a.memoizedState = null !== b.state && void 0 !== b.state ? b.state : null;
          b.updater = zf;
          a.stateNode = b;
          b._reactInternals = a;
          d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = e, a.__reactInternalMemoizedMaskedChildContext = f);
          return b;
        }
        function Cf(a, b, c, d) {
          a = b.state;
          "function" === typeof b.componentWillReceiveProps && b.componentWillReceiveProps(c, d);
          "function" === typeof b.UNSAFE_componentWillReceiveProps && b.UNSAFE_componentWillReceiveProps(c, d);
          b.state !== a && zf.enqueueReplaceState(b, b.state, null);
        }
        function Df(a, b, c, d) {
          var e = a.stateNode;
          e.props = c;
          e.state = a.memoizedState;
          e.refs = {};
          ee(a);
          var f = b.contextType;
          "object" === typeof f && null !== f ? e.context = Zd(f) : (f = A(b) ? kc : x.current, e.context = mc(a, f));
          e.state = a.memoizedState;
          f = b.getDerivedStateFromProps;
          "function" === typeof f && (yf(a, b, f, c), e.state = a.memoizedState);
          "function" === typeof b.getDerivedStateFromProps || "function" === typeof e.getSnapshotBeforeUpdate || "function" !== typeof e.UNSAFE_componentWillMount && "function" !== typeof e.componentWillMount || (b = e.state, "function" === typeof e.componentWillMount && e.componentWillMount(), "function" === typeof e.UNSAFE_componentWillMount && e.UNSAFE_componentWillMount(), b !== e.state && zf.enqueueReplaceState(e, e.state, null), ke(a, c, e, d), e.state = a.memoizedState);
          "function" === typeof e.componentDidMount && (a.flags |= 4194308);
        }
        function Ef(a, b) {
          try {
            var c = "", d = b;
            do
              c += Ed(d), d = d.return;
            while (d);
            var e = c;
          } catch (f) {
            e = "\nError generating stack: " + f.message + "\n" + f.stack;
          }
          return { value: a, source: b, stack: e, digest: null };
        }
        function Ff(a, b, c) {
          return { value: a, source: null, stack: null != c ? c : null, digest: null != b ? b : null };
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
        var Hf = "function" === typeof WeakMap ? WeakMap : Map;
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
          if ("function" === typeof d) {
            var e = b.value;
            c.payload = function() {
              return d(e);
            };
            c.callback = function() {
              Gf(a, b);
            };
          }
          var f = a.stateNode;
          null !== f && "function" === typeof f.componentDidCatch && (c.callback = function() {
            Gf(a, b);
            "function" !== typeof d && (null === Mf ? Mf = /* @__PURE__ */ new Set([this]) : Mf.add(this));
            var c2 = b.stack;
            this.componentDidCatch(b.value, { componentStack: null !== c2 ? c2 : "" });
          });
          return c;
        }
        function Nf(a, b, c) {
          var d = a.pingCache;
          if (null === d) {
            d = a.pingCache = new Hf();
            var e = /* @__PURE__ */ new Set();
            d.set(b, e);
          } else e = d.get(b), void 0 === e && (e = /* @__PURE__ */ new Set(), d.set(b, e));
          e.has(c) || (e.add(c), a = Of.bind(null, a, b, c), b.then(a, a));
        }
        function Pf(a) {
          do {
            var b;
            if (b = 13 === a.tag) b = a.memoizedState, b = null !== b ? null !== b.dehydrated ? true : false : true;
            if (b) return a;
            a = a.return;
          } while (null !== a);
          return null;
        }
        function Qf(a, b, c, d, e) {
          if (0 === (a.mode & 1)) return a === b ? a.flags |= 65536 : (a.flags |= 128, c.flags |= 131072, c.flags &= -52805, 1 === c.tag && (null === c.alternate ? c.tag = 17 : (b = ge(-1, 1), b.tag = 2, he(c, b, 1))), c.lanes |= 1), a;
          a.flags |= 65536;
          a.lanes = e;
          return a;
        }
        var Rf = da.ReactCurrentOwner, G = false;
        function P(a, b, c, d) {
          b.child = null === a ? Pd(b, null, c, d) : Od(b, a.child, c, d);
        }
        function Sf(a, b, c, d, e) {
          c = c.render;
          var f = b.ref;
          Yd(b, e);
          d = He(a, b, c, d, f, e);
          c = Me();
          if (null !== a && !G) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Tf(a, b, e);
          F && c && md(b);
          b.flags |= 1;
          P(a, b, d, e);
          return b.child;
        }
        function Uf(a, b, c, d, e) {
          if (null === a) {
            var f = c.type;
            if ("function" === typeof f && !Vf(f) && void 0 === f.defaultProps && null === c.compare && void 0 === c.defaultProps) return b.tag = 15, b.type = f, Wf(a, b, f, d, e);
            a = Ld(c.type, null, d, b, b.mode, e);
            a.ref = b.ref;
            a.return = b;
            return b.child = a;
          }
          f = a.child;
          if (0 === (a.lanes & e)) {
            var g = f.memoizedProps;
            c = c.compare;
            c = null !== c ? c : Dd;
            if (c(g, d) && a.ref === b.ref) return Tf(a, b, e);
          }
          b.flags |= 1;
          a = Jd(f, d);
          a.ref = b.ref;
          a.return = b;
          return b.child = a;
        }
        function Wf(a, b, c, d, e) {
          if (null !== a) {
            var f = a.memoizedProps;
            if (Dd(f, d) && a.ref === b.ref) if (G = false, b.pendingProps = d = f, 0 !== (a.lanes & e)) 0 !== (a.flags & 131072) && (G = true);
            else return b.lanes = a.lanes, Tf(a, b, e);
          }
          return Xf(a, b, c, d, e);
        }
        function Yf(a, b, c) {
          var d = b.pendingProps, e = d.children, f = null !== a ? a.memoizedState : null;
          if ("hidden" === d.mode) if (0 === (b.mode & 1)) b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, v(Zf, $f), $f |= c;
          else {
            if (0 === (c & 1073741824)) return a = null !== f ? f.baseLanes | c : c, b.lanes = b.childLanes = 1073741824, b.memoizedState = { baseLanes: a, cachePool: null, transitions: null }, b.updateQueue = null, v(Zf, $f), $f |= a, null;
            b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null };
            d = null !== f ? f.baseLanes : c;
            v(Zf, $f);
            $f |= d;
          }
          else null !== f ? (d = f.baseLanes | c, b.memoizedState = null) : d = c, v(Zf, $f), $f |= d;
          P(a, b, e, c);
          return b.child;
        }
        function ag(a, b) {
          var c = b.ref;
          if (null === a && null !== c || null !== a && a.ref !== c) b.flags |= 512, b.flags |= 2097152;
        }
        function Xf(a, b, c, d, e) {
          var f = A(c) ? kc : x.current;
          f = mc(b, f);
          Yd(b, e);
          c = He(a, b, c, d, f, e);
          d = Me();
          if (null !== a && !G) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Tf(a, b, e);
          F && d && md(b);
          b.flags |= 1;
          P(a, b, c, e);
          return b.child;
        }
        function bg(a, b, c, d, e) {
          if (A(c)) {
            var f = true;
            qc(b);
          } else f = false;
          Yd(b, e);
          if (null === b.stateNode) cg(a, b), Bf(b, c, d), Df(b, c, d, e), d = true;
          else if (null === a) {
            var g = b.stateNode, h = b.memoizedProps;
            g.props = h;
            var k = g.context, l = c.contextType;
            "object" === typeof l && null !== l ? l = Zd(l) : (l = A(c) ? kc : x.current, l = mc(b, l));
            var m = c.getDerivedStateFromProps, r = "function" === typeof m || "function" === typeof g.getSnapshotBeforeUpdate;
            r || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== d || k !== l) && Cf(b, g, d, l);
            de = false;
            var p = b.memoizedState;
            g.state = p;
            ke(b, d, g, e);
            k = b.memoizedState;
            h !== d || p !== k || z.current || de ? ("function" === typeof m && (yf(b, c, m, d), k = b.memoizedState), (h = de || Af(b, c, h, d, p, k, l)) ? (r || "function" !== typeof g.UNSAFE_componentWillMount && "function" !== typeof g.componentWillMount || ("function" === typeof g.componentWillMount && g.componentWillMount(), "function" === typeof g.UNSAFE_componentWillMount && g.UNSAFE_componentWillMount()), "function" === typeof g.componentDidMount && (b.flags |= 4194308)) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), b.memoizedProps = d, b.memoizedState = k), g.props = d, g.state = k, g.context = l, d = h) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), d = false);
          } else {
            g = b.stateNode;
            fe(a, b);
            h = b.memoizedProps;
            l = b.type === b.elementType ? h : xf(b.type, h);
            g.props = l;
            r = b.pendingProps;
            p = g.context;
            k = c.contextType;
            "object" === typeof k && null !== k ? k = Zd(k) : (k = A(c) ? kc : x.current, k = mc(b, k));
            var B = c.getDerivedStateFromProps;
            (m = "function" === typeof B || "function" === typeof g.getSnapshotBeforeUpdate) || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== r || p !== k) && Cf(b, g, d, k);
            de = false;
            p = b.memoizedState;
            g.state = p;
            ke(b, d, g, e);
            var w = b.memoizedState;
            h !== r || p !== w || z.current || de ? ("function" === typeof B && (yf(b, c, B, d), w = b.memoizedState), (l = de || Af(b, c, l, d, p, w, k) || false) ? (m || "function" !== typeof g.UNSAFE_componentWillUpdate && "function" !== typeof g.componentWillUpdate || ("function" === typeof g.componentWillUpdate && g.componentWillUpdate(d, w, k), "function" === typeof g.UNSAFE_componentWillUpdate && g.UNSAFE_componentWillUpdate(d, w, k)), "function" === typeof g.componentDidUpdate && (b.flags |= 4), "function" === typeof g.getSnapshotBeforeUpdate && (b.flags |= 1024)) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 1024), b.memoizedProps = d, b.memoizedState = w), g.props = d, g.state = w, g.context = k, d = l) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 1024), d = false);
          }
          return dg(a, b, c, d, f, e);
        }
        function dg(a, b, c, d, e, f) {
          ag(a, b);
          var g = 0 !== (b.flags & 128);
          if (!d && !g) return e && rc(b, c, false), Tf(a, b, f);
          d = b.stateNode;
          Rf.current = b;
          var h = g && "function" !== typeof c.getDerivedStateFromError ? null : d.render();
          b.flags |= 1;
          null !== a && g ? (b.child = Od(b, a.child, null, f), b.child = Od(b, null, h, f)) : P(a, b, h, f);
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
          var d = b.pendingProps, e = I.current, f = false, g = 0 !== (b.flags & 128), h;
          (h = g) || (h = null !== a && null === a.memoizedState ? false : 0 !== (e & 2));
          if (h) f = true, b.flags &= -129;
          else if (null === a || null !== a.memoizedState) e |= 1;
          v(I, e & 1);
          if (null === a) {
            wd(b);
            a = b.memoizedState;
            if (null !== a && (a = a.dehydrated, null !== a)) return 0 === (b.mode & 1) ? b.lanes = 1 : Kb(a) ? b.lanes = 8 : b.lanes = 1073741824, null;
            g = d.children;
            a = d.fallback;
            return f ? (d = b.mode, f = b.child, g = { mode: "hidden", children: g }, 0 === (d & 1) && null !== f ? (f.childLanes = 0, f.pendingProps = g) : f = jg(g, d, 0, null), a = Nd(a, d, c, null), f.return = b, a.return = b, f.sibling = a, b.child = f, b.child.memoizedState = hg(c), b.memoizedState = gg, a) : kg(b, g);
          }
          e = a.memoizedState;
          if (null !== e && (h = e.dehydrated, null !== h)) return lg(a, b, g, d, h, e, c);
          if (f) {
            f = d.fallback;
            g = b.mode;
            e = a.child;
            h = e.sibling;
            var k = { mode: "hidden", children: d.children };
            0 === (g & 1) && b.child !== e ? (d = b.child, d.childLanes = 0, d.pendingProps = k, b.deletions = null) : (d = Jd(e, k), d.subtreeFlags = e.subtreeFlags & 14680064);
            null !== h ? f = Jd(h, f) : (f = Nd(f, g, c, null), f.flags |= 2);
            f.return = b;
            d.return = b;
            d.sibling = f;
            b.child = d;
            d = f;
            f = b.child;
            g = a.child.memoizedState;
            g = null === g ? hg(c) : { baseLanes: g.baseLanes | c, cachePool: null, transitions: g.transitions };
            f.memoizedState = g;
            f.childLanes = a.childLanes & ~c;
            b.memoizedState = gg;
            return d;
          }
          f = a.child;
          a = f.sibling;
          d = Jd(f, { mode: "visible", children: d.children });
          0 === (b.mode & 1) && (d.lanes = c);
          d.return = b;
          d.sibling = null;
          null !== a && (c = b.deletions, null === c ? (b.deletions = [a], b.flags |= 16) : c.push(a));
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
          null !== d && Bd(d);
          Od(b, a.child, null, c);
          a = kg(b, b.pendingProps.children);
          a.flags |= 2;
          b.memoizedState = null;
          return a;
        }
        function lg(a, b, c, d, e, f, g) {
          if (c) {
            if (b.flags & 256) return b.flags &= -257, d = Ff(Error(n(422))), mg(a, b, g, d);
            if (null !== b.memoizedState) return b.child = a.child, b.flags |= 128, null;
            f = d.fallback;
            e = b.mode;
            d = jg({ mode: "visible", children: d.children }, e, 0, null);
            f = Nd(f, e, g, null);
            f.flags |= 2;
            d.return = b;
            f.return = b;
            d.sibling = f;
            b.child = d;
            0 !== (b.mode & 1) && Od(b, a.child, null, g);
            b.child.memoizedState = hg(g);
            b.memoizedState = gg;
            return f;
          }
          if (0 === (b.mode & 1)) return mg(a, b, g, null);
          if (Kb(e)) return d = Lb(e).digest, f = Error(n(419)), d = Ff(
            f,
            d,
            void 0
          ), mg(a, b, g, d);
          c = 0 !== (g & a.childLanes);
          if (G || c) {
            d = N;
            if (null !== d) {
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
              e = 0 !== (e & (d.suspendedLanes | g)) ? 0 : e;
              0 !== e && e !== f.retryLane && (f.retryLane = e, ce(a, e), af(
                d,
                a,
                e,
                -1
              ));
            }
            ng();
            d = Ff(Error(n(421)));
            return mg(a, b, g, d);
          }
          if (Jb(e)) return b.flags |= 128, b.child = a.child, b = og.bind(null, a), Mb(e, b), null;
          a = f.treeContext;
          Va && (pd = Qb(e), od = b, F = true, rd = null, qd = false, null !== a && (fd[gd++] = id, fd[gd++] = jd, fd[gd++] = hd, id = a.id, jd = a.overflow, hd = b));
          b = kg(b, d.children);
          b.flags |= 4096;
          return b;
        }
        function pg(a, b, c) {
          a.lanes |= b;
          var d = a.alternate;
          null !== d && (d.lanes |= b);
          Xd(a.return, b, c);
        }
        function qg(a, b, c, d, e) {
          var f = a.memoizedState;
          null === f ? a.memoizedState = { isBackwards: b, rendering: null, renderingStartTime: 0, last: d, tail: c, tailMode: e } : (f.isBackwards = b, f.rendering = null, f.renderingStartTime = 0, f.last = d, f.tail = c, f.tailMode = e);
        }
        function rg(a, b, c) {
          var d = b.pendingProps, e = d.revealOrder, f = d.tail;
          P(a, b, d.children, c);
          d = I.current;
          if (0 !== (d & 2)) d = d & 1 | 2, b.flags |= 128;
          else {
            if (null !== a && 0 !== (a.flags & 128)) a: for (a = b.child; null !== a; ) {
              if (13 === a.tag) null !== a.memoizedState && pg(a, c, b);
              else if (19 === a.tag) pg(a, c, b);
              else if (null !== a.child) {
                a.child.return = a;
                a = a.child;
                continue;
              }
              if (a === b) break a;
              for (; null === a.sibling; ) {
                if (null === a.return || a.return === b) break a;
                a = a.return;
              }
              a.sibling.return = a.return;
              a = a.sibling;
            }
            d &= 1;
          }
          v(I, d);
          if (0 === (b.mode & 1)) b.memoizedState = null;
          else switch (e) {
            case "forwards":
              c = b.child;
              for (e = null; null !== c; ) a = c.alternate, null !== a && null === we(a) && (e = c), c = c.sibling;
              c = e;
              null === c ? (e = b.child, b.child = null) : (e = c.sibling, c.sibling = null);
              qg(b, false, e, c, f);
              break;
            case "backwards":
              c = null;
              e = b.child;
              for (b.child = null; null !== e; ) {
                a = e.alternate;
                if (null !== a && null === we(a)) {
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
              qg(b, false, null, null, void 0);
              break;
            default:
              b.memoizedState = null;
          }
          return b.child;
        }
        function cg(a, b) {
          0 === (b.mode & 1) && null !== a && (a.alternate = null, b.alternate = null, b.flags |= 2);
        }
        function Tf(a, b, c) {
          null !== a && (b.dependencies = a.dependencies);
          le |= b.lanes;
          if (0 === (c & b.childLanes)) return null;
          if (null !== a && b.child !== a.child) throw Error(n(153));
          if (null !== b.child) {
            a = b.child;
            c = Jd(a, a.pendingProps);
            b.child = c;
            for (c.return = b; null !== a.sibling; ) a = a.sibling, c = c.sibling = Jd(a, a.pendingProps), c.return = b;
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
              if (null !== d) {
                if (null !== d.dehydrated) return v(I, I.current & 1), b.flags |= 128, null;
                if (0 !== (c & b.child.childLanes)) return ig(a, b, c);
                v(I, I.current & 1);
                a = Tf(a, b, c);
                return null !== a ? a.sibling : null;
              }
              v(I, I.current & 1);
              break;
            case 19:
              d = 0 !== (c & b.childLanes);
              if (0 !== (a.flags & 128)) {
                if (d) return rg(
                  a,
                  b,
                  c
                );
                b.flags |= 128;
              }
              var e = b.memoizedState;
              null !== e && (e.rendering = null, e.tail = null, e.lastEffect = null);
              v(I, I.current);
              if (d) break;
              else return null;
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
          if (null !== a && a.child === b.child) return true;
          if (0 !== (b.flags & 16)) return false;
          for (a = b.child; null !== a; ) {
            if (0 !== (a.flags & 12854) || 0 !== (a.subtreeFlags & 12854)) return false;
            a = a.sibling;
          }
          return true;
        }
        var vg, wg, xg, yg;
        if (Ta) vg = function(a, b) {
          for (var c = b.child; null !== c; ) {
            if (5 === c.tag || 6 === c.tag) Ka(a, c.stateNode);
            else if (4 !== c.tag && null !== c.child) {
              c.child.return = c;
              c = c.child;
              continue;
            }
            if (c === b) break;
            for (; null === c.sibling; ) {
              if (null === c.return || c.return === b) return;
              c = c.return;
            }
            c.sibling.return = c.return;
            c = c.sibling;
          }
        }, wg = function() {
        }, xg = function(a, b, c, d, e) {
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
            for (var e = b.child; null !== e; ) {
              if (5 === e.tag) {
                var f = e.stateNode;
                c && d && (f = Eb(f, e.type, e.memoizedProps, e));
                Ka(a, f);
              } else if (6 === e.tag) f = e.stateNode, c && d && (f = Fb(f, e.memoizedProps, e)), Ka(a, f);
              else if (4 !== e.tag) {
                if (22 === e.tag && null !== e.memoizedState) f = e.child, null !== f && (f.return = e), vg(a, e, true, true);
                else if (null !== e.child) {
                  e.child.return = e;
                  e = e.child;
                  continue;
                }
              }
              if (e === b) break;
              for (; null === e.sibling; ) {
                if (null === e.return || e.return === b) return;
                e = e.return;
              }
              e.sibling.return = e.return;
              e = e.sibling;
            }
          };
          var zg = function(a, b, c, d) {
            for (var e = b.child; null !== e; ) {
              if (5 === e.tag) {
                var f = e.stateNode;
                c && d && (f = Eb(f, e.type, e.memoizedProps, e));
                Ab(a, f);
              } else if (6 === e.tag) f = e.stateNode, c && d && (f = Fb(f, e.memoizedProps, e)), Ab(a, f);
              else if (4 !== e.tag) {
                if (22 === e.tag && null !== e.memoizedState) f = e.child, null !== f && (f.return = e), zg(a, e, true, true);
                else if (null !== e.child) {
                  e.child.return = e;
                  e = e.child;
                  continue;
                }
              }
              if (e === b) break;
              for (; null === e.sibling; ) {
                if (null === e.return || e.return === b) return;
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
            var f = a.stateNode, g = a.memoizedProps;
            if ((a = ug(a, b)) && g === d) b.stateNode = f;
            else {
              var h = b.stateNode, k = re(oe.current), l = null;
              g !== d && (l = Ma(h, c, g, d, e, k));
              a && null === l ? b.stateNode = f : (f = yb(f, l, c, g, d, b, a, h), La(f, c, d, e, k) && tg(b), b.stateNode = f, a ? tg(b) : vg(f, b, false, false));
            }
          };
          yg = function(a, b, c, d) {
            c !== d ? (a = re(qe.current), c = re(oe.current), b.stateNode = Oa(d, a, c, b), tg(b)) : b.stateNode = a.stateNode;
          };
        } else wg = function() {
        }, xg = function() {
        }, yg = function() {
        };
        function Ag(a, b) {
          if (!F) switch (a.tailMode) {
            case "hidden":
              b = a.tail;
              for (var c = null; null !== b; ) null !== b.alternate && (c = b), b = b.sibling;
              null === c ? a.tail = null : c.sibling = null;
              break;
            case "collapsed":
              c = a.tail;
              for (var d = null; null !== c; ) null !== c.alternate && (d = c), c = c.sibling;
              null === d ? b || null === a.tail ? a.tail = null : a.tail.sibling = null : d.sibling = null;
          }
        }
        function Q(a) {
          var b = null !== a.alternate && a.alternate.child === a.child, c = 0, d = 0;
          if (b) for (var e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags & 14680064, d |= e.flags & 14680064, e.return = a, e = e.sibling;
          else for (e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags, d |= e.flags, e.return = a, e = e.sibling;
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
              if (null === a || null === a.child) yd(b) ? tg(b) : null === a || a.memoizedState.isDehydrated && 0 === (b.flags & 256) || (b.flags |= 1024, null !== rd && (Cg(rd), rd = null));
              wg(a, b);
              Q(b);
              return null;
            case 5:
              ve(b);
              c = re(qe.current);
              var e = b.type;
              if (null !== a && null != b.stateNode) xg(a, b, e, d, c), a.ref !== b.ref && (b.flags |= 512, b.flags |= 2097152);
              else {
                if (!d) {
                  if (null === b.stateNode) throw Error(n(166));
                  Q(b);
                  return null;
                }
                a = re(oe.current);
                if (yd(b)) {
                  if (!Va) throw Error(n(175));
                  a = Rb(b.stateNode, b.type, b.memoizedProps, c, a, b, !qd);
                  b.updateQueue = a;
                  null !== a && tg(b);
                } else {
                  var f = Ja(e, d, c, a, b);
                  vg(f, b, false, false);
                  b.stateNode = f;
                  La(f, e, d, c, a) && tg(b);
                }
                null !== b.ref && (b.flags |= 512, b.flags |= 2097152);
              }
              Q(b);
              return null;
            case 6:
              if (a && null != b.stateNode) yg(a, b, a.memoizedProps, d);
              else {
                if ("string" !== typeof d && null === b.stateNode) throw Error(n(166));
                a = re(qe.current);
                c = re(oe.current);
                if (yd(b)) {
                  if (!Va) throw Error(n(176));
                  a = b.stateNode;
                  c = b.memoizedProps;
                  if (d = Sb(a, c, b, !qd)) {
                    if (e = od, null !== e) switch (e.tag) {
                      case 3:
                        $b(e.stateNode.containerInfo, a, c, 0 !== (e.mode & 1));
                        break;
                      case 5:
                        ac(e.type, e.memoizedProps, e.stateNode, a, c, 0 !== (e.mode & 1));
                    }
                  }
                  d && tg(b);
                } else b.stateNode = Oa(d, a, c, b);
              }
              Q(b);
              return null;
            case 13:
              q(I);
              d = b.memoizedState;
              if (null === a || null !== a.memoizedState && null !== a.memoizedState.dehydrated) {
                if (F && null !== pd && 0 !== (b.mode & 1) && 0 === (b.flags & 128)) zd(), Ad(), b.flags |= 98560, e = false;
                else if (e = yd(b), null !== d && null !== d.dehydrated) {
                  if (null === a) {
                    if (!e) throw Error(n(318));
                    if (!Va) throw Error(n(344));
                    e = b.memoizedState;
                    e = null !== e ? e.dehydrated : null;
                    if (!e) throw Error(n(317));
                    Tb(e, b);
                  } else Ad(), 0 === (b.flags & 128) && (b.memoizedState = null), b.flags |= 4;
                  Q(b);
                  e = false;
                } else null !== rd && (Cg(rd), rd = null), e = true;
                if (!e) return b.flags & 65536 ? b : null;
              }
              if (0 !== (b.flags & 128)) return b.lanes = c, b;
              c = null !== d;
              c !== (null !== a && null !== a.memoizedState) && c && (b.child.flags |= 8192, 0 !== (b.mode & 1) && (null === a || 0 !== (I.current & 1) ? 0 === R && (R = 3) : ng()));
              null !== b.updateQueue && (b.flags |= 4);
              Q(b);
              return null;
            case 4:
              return te(), wg(a, b), null === a && Xa(b.stateNode.containerInfo), Q(b), null;
            case 10:
              return Wd(b.type._context), Q(b), null;
            case 17:
              return A(b.type) && nc(), Q(b), null;
            case 19:
              q(I);
              e = b.memoizedState;
              if (null === e) return Q(b), null;
              d = 0 !== (b.flags & 128);
              f = e.rendering;
              if (null === f) if (d) Ag(e, false);
              else {
                if (0 !== R || null !== a && 0 !== (a.flags & 128)) for (a = b.child; null !== a; ) {
                  f = we(a);
                  if (null !== f) {
                    b.flags |= 128;
                    Ag(e, false);
                    a = f.updateQueue;
                    null !== a && (b.updateQueue = a, b.flags |= 4);
                    b.subtreeFlags = 0;
                    a = c;
                    for (c = b.child; null !== c; ) d = c, e = a, d.flags &= 14680066, f = d.alternate, null === f ? (d.childLanes = 0, d.lanes = e, d.child = null, d.subtreeFlags = 0, d.memoizedProps = null, d.memoizedState = null, d.updateQueue = null, d.dependencies = null, d.stateNode = null) : (d.childLanes = f.childLanes, d.lanes = f.lanes, d.child = f.child, d.subtreeFlags = 0, d.deletions = null, d.memoizedProps = f.memoizedProps, d.memoizedState = f.memoizedState, d.updateQueue = f.updateQueue, d.type = f.type, e = f.dependencies, d.dependencies = null === e ? null : { lanes: e.lanes, firstContext: e.firstContext }), c = c.sibling;
                    v(I, I.current & 1 | 2);
                    return b.child;
                  }
                  a = a.sibling;
                }
                null !== e.tail && D() > Dg && (b.flags |= 128, d = true, Ag(e, false), b.lanes = 4194304);
              }
              else {
                if (!d) if (a = we(f), null !== a) {
                  if (b.flags |= 128, d = true, a = a.updateQueue, null !== a && (b.updateQueue = a, b.flags |= 4), Ag(e, true), null === e.tail && "hidden" === e.tailMode && !f.alternate && !F) return Q(b), null;
                } else 2 * D() - e.renderingStartTime > Dg && 1073741824 !== c && (b.flags |= 128, d = true, Ag(e, false), b.lanes = 4194304);
                e.isBackwards ? (f.sibling = b.child, b.child = f) : (a = e.last, null !== a ? a.sibling = f : b.child = f, e.last = f);
              }
              if (null !== e.tail) return b = e.tail, e.rendering = b, e.tail = b.sibling, e.renderingStartTime = D(), b.sibling = null, a = I.current, v(I, d ? a & 1 | 2 : a & 1), b;
              Q(b);
              return null;
            case 22:
            case 23:
              return Eg(), c = null !== b.memoizedState, null !== a && null !== a.memoizedState !== c && (b.flags |= 8192), c && 0 !== (b.mode & 1) ? 0 !== ($f & 1073741824) && (Q(b), Ta && b.subtreeFlags & 6 && (b.flags |= 8192)) : Q(b), null;
            case 24:
              return null;
            case 25:
              return null;
          }
          throw Error(n(
            156,
            b.tag
          ));
        }
        function Fg(a, b) {
          nd(b);
          switch (b.tag) {
            case 1:
              return A(b.type) && nc(), a = b.flags, a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
            case 3:
              return te(), q(z), q(x), ye(), a = b.flags, 0 !== (a & 65536) && 0 === (a & 128) ? (b.flags = a & -65537 | 128, b) : null;
            case 5:
              return ve(b), null;
            case 13:
              q(I);
              a = b.memoizedState;
              if (null !== a && null !== a.dehydrated) {
                if (null === b.alternate) throw Error(n(340));
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
        var Gg = false, S = false, Hg = "function" === typeof WeakSet ? WeakSet : Set, T = null;
        function Ig(a, b) {
          var c = a.ref;
          if (null !== c) if ("function" === typeof c) try {
            c(null);
          } catch (d) {
            U(a, b, d);
          }
          else c.current = null;
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
          for (T = b; null !== T; ) if (a = T, b = a.child, 0 !== (a.subtreeFlags & 1028) && null !== b) b.return = a, T = b;
          else for (; null !== T; ) {
            a = T;
            try {
              var c = a.alternate;
              if (0 !== (a.flags & 1024)) switch (a.tag) {
                case 0:
                case 11:
                case 15:
                  break;
                case 1:
                  if (null !== c) {
                    var d = c.memoizedProps, e = c.memoizedState, f = a.stateNode, g = f.getSnapshotBeforeUpdate(a.elementType === a.type ? d : xf(a.type, d), e);
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
            if (null !== b) {
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
          d = null !== d ? d.lastEffect : null;
          if (null !== d) {
            var e = d = d.next;
            do {
              if ((e.tag & a) === a) {
                var f = e.destroy;
                e.destroy = void 0;
                void 0 !== f && Jg(b, c, f);
              }
              e = e.next;
            } while (e !== d);
          }
        }
        function Ng(a, b) {
          b = b.updateQueue;
          b = null !== b ? b.lastEffect : null;
          if (null !== b) {
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
          if (null !== b) {
            var c = a.stateNode;
            switch (a.tag) {
              case 5:
                a = Ea(c);
                break;
              default:
                a = c;
            }
            "function" === typeof b ? b(a) : b.current = a;
          }
        }
        function Pg(a) {
          var b = a.alternate;
          null !== b && (a.alternate = null, Pg(b));
          a.child = null;
          a.deletions = null;
          a.sibling = null;
          5 === a.tag && (b = a.stateNode, null !== b && Za(b));
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
          return 5 === a.tag || 3 === a.tag || 4 === a.tag;
        }
        function Rg(a) {
          a: for (; ; ) {
            for (; null === a.sibling; ) {
              if (null === a.return || Qg(a.return)) return null;
              a = a.return;
            }
            a.sibling.return = a.return;
            for (a = a.sibling; 5 !== a.tag && 6 !== a.tag && 18 !== a.tag; ) {
              if (a.flags & 2) continue a;
              if (null === a.child || 4 === a.tag) continue a;
              else a.child.return = a, a = a.child;
            }
            if (!(a.flags & 2)) return a.stateNode;
          }
        }
        function Sg(a, b, c) {
          var d = a.tag;
          if (5 === d || 6 === d) a = a.stateNode, b ? pb(c, a, b) : kb(c, a);
          else if (4 !== d && (a = a.child, null !== a)) for (Sg(a, b, c), a = a.sibling; null !== a; ) Sg(a, b, c), a = a.sibling;
        }
        function Tg(a, b, c) {
          var d = a.tag;
          if (5 === d || 6 === d) a = a.stateNode, b ? ob(c, a, b) : jb(c, a);
          else if (4 !== d && (a = a.child, null !== a)) for (Tg(a, b, c), a = a.sibling; null !== a; ) Tg(a, b, c), a = a.sibling;
        }
        var V = null, Ug = false;
        function Vg(a, b, c) {
          for (c = c.child; null !== c; ) Wg(a, b, c), c = c.sibling;
        }
        function Wg(a, b, c) {
          if (Sc && "function" === typeof Sc.onCommitFiberUnmount) try {
            Sc.onCommitFiberUnmount(Rc, c);
          } catch (h) {
          }
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
                null !== V && (Ug ? rb(V, c.stateNode) : qb(V, c.stateNode));
              } else Vg(a, b, c);
              break;
            case 18:
              Ta && null !== V && (Ug ? Yb(V, c.stateNode) : Xb(V, c.stateNode));
              break;
            case 4:
              Ta ? (d = V, e = Ug, V = c.stateNode.containerInfo, Ug = true, Vg(a, b, c), V = d, Ug = e) : (Ua && (d = c.stateNode.containerInfo, e = zb(d), Cb(d, e)), Vg(a, b, c));
              break;
            case 0:
            case 11:
            case 14:
            case 15:
              if (!S && (d = c.updateQueue, null !== d && (d = d.lastEffect, null !== d))) {
                e = d = d.next;
                do {
                  var f = e, g = f.destroy;
                  f = f.tag;
                  void 0 !== g && (0 !== (f & 2) ? Jg(c, b, g) : 0 !== (f & 4) && Jg(c, b, g));
                  e = e.next;
                } while (e !== d);
              }
              Vg(a, b, c);
              break;
            case 1:
              if (!S && (Ig(c, b), d = c.stateNode, "function" === typeof d.componentWillUnmount)) try {
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
              c.mode & 1 ? (S = (d = S) || null !== c.memoizedState, Vg(a, b, c), S = d) : Vg(a, b, c);
              break;
            default:
              Vg(
                a,
                b,
                c
              );
          }
        }
        function Xg(a) {
          var b = a.updateQueue;
          if (null !== b) {
            a.updateQueue = null;
            var c = a.stateNode;
            null === c && (c = a.stateNode = new Hg());
            b.forEach(function(b2) {
              var d = Yg.bind(null, a, b2);
              c.has(b2) || (c.add(b2), b2.then(d, d));
            });
          }
        }
        function Zg(a, b) {
          var c = b.deletions;
          if (null !== c) for (var d = 0; d < c.length; d++) {
            var e = c[d];
            try {
              var f = a, g = b;
              if (Ta) {
                var h = g;
                a: for (; null !== h; ) {
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
                if (null === V) throw Error(n(160));
                Wg(f, g, e);
                V = null;
                Ug = false;
              } else Wg(f, g, e);
              var k = e.alternate;
              null !== k && (k.return = null);
              e.return = null;
            } catch (l) {
              U(e, b, l);
            }
          }
          if (b.subtreeFlags & 12854) for (b = b.child; null !== b; ) $g(b, a), b = b.sibling;
        }
        function $g(a, b) {
          var c = a.alternate, d = a.flags;
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
              d & 512 && null !== c && Ig(c, c.return);
              break;
            case 5:
              Zg(b, a);
              ah(a);
              d & 512 && null !== c && Ig(c, c.return);
              if (Ta) {
                if (a.flags & 32) {
                  var e = a.stateNode;
                  try {
                    sb(e);
                  } catch (p) {
                    U(a, a.return, p);
                  }
                }
                if (d & 4 && (e = a.stateNode, null != e)) {
                  var f = a.memoizedProps;
                  c = null !== c ? c.memoizedProps : f;
                  d = a.type;
                  b = a.updateQueue;
                  a.updateQueue = null;
                  if (null !== b) try {
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
                if (null === a.stateNode) throw Error(n(162));
                e = a.stateNode;
                f = a.memoizedProps;
                c = null !== c ? c.memoizedProps : f;
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
                if (Ta && Va && null !== c && c.memoizedState.isDehydrated) try {
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
              Zg(
                b,
                a
              );
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
              e.flags & 8192 && (f = null !== e.memoizedState, e.stateNode.isHidden = f, !f || null !== e.alternate && null !== e.alternate.memoizedState || (bh = D()));
              d & 4 && Xg(a);
              break;
            case 22:
              var g = null !== c && null !== c.memoizedState;
              a.mode & 1 ? (S = (c = S) || g, Zg(b, a), S = c) : Zg(b, a);
              ah(a);
              if (d & 8192) {
                c = null !== a.memoizedState;
                if ((a.stateNode.isHidden = c) && !g && 0 !== (a.mode & 1)) for (T = a, d = a.child; null !== d; ) {
                  for (b = T = d; null !== T; ) {
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
                        if ("function" === typeof k.componentWillUnmount) {
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
                        if (null !== g.memoizedState) {
                          ch(b);
                          continue;
                        }
                    }
                    null !== h ? (h.return = g, T = h) : ch(b);
                  }
                  d = d.sibling;
                }
                if (Ta) {
                  a: if (d = null, Ta) for (b = a; ; ) {
                    if (5 === b.tag) {
                      if (null === d) {
                        d = b;
                        try {
                          e = b.stateNode, c ? tb(e) : vb(b.stateNode, b.memoizedProps);
                        } catch (p) {
                          U(a, a.return, p);
                        }
                      }
                    } else if (6 === b.tag) {
                      if (null === d) try {
                        f = b.stateNode, c ? ub(f) : wb(f, b.memoizedProps);
                      } catch (p) {
                        U(a, a.return, p);
                      }
                    } else if ((22 !== b.tag && 23 !== b.tag || null === b.memoizedState || b === a) && null !== b.child) {
                      b.child.return = b;
                      b = b.child;
                      continue;
                    }
                    if (b === a) break a;
                    for (; null === b.sibling; ) {
                      if (null === b.return || b.return === a) break a;
                      d === b && (d = null);
                      b = b.return;
                    }
                    d === b && (d = null);
                    b.sibling.return = b.return;
                    b = b.sibling;
                  }
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
                  for (var c = a.return; null !== c; ) {
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
          for (var d = 0 !== (a.mode & 1); null !== T; ) {
            var e = T, f = e.child;
            if (22 === e.tag && d) {
              var g = null !== e.memoizedState || Gg;
              if (!g) {
                var h = e.alternate, k = null !== h && null !== h.memoizedState || S;
                h = Gg;
                var l = S;
                Gg = g;
                if ((S = k) && !l) for (T = e; null !== T; ) g = T, k = g.child, 22 === g.tag && null !== g.memoizedState ? fh(e) : null !== k ? (k.return = g, T = k) : fh(e);
                for (; null !== f; ) T = f, eh(f, b, c), f = f.sibling;
                T = e;
                Gg = h;
                S = l;
              }
              gh(a, b, c);
            } else 0 !== (e.subtreeFlags & 8772) && null !== f ? (f.return = e, T = f) : gh(a, b, c);
          }
        }
        function gh(a) {
          for (; null !== T; ) {
            var b = T;
            if (0 !== (b.flags & 8772)) {
              var c = b.alternate;
              try {
                if (0 !== (b.flags & 8772)) switch (b.tag) {
                  case 0:
                  case 11:
                  case 15:
                    S || Ng(5, b);
                    break;
                  case 1:
                    var d = b.stateNode;
                    if (b.flags & 4 && !S) if (null === c) d.componentDidMount();
                    else {
                      var e = b.elementType === b.type ? c.memoizedProps : xf(b.type, c.memoizedProps);
                      d.componentDidUpdate(e, c.memoizedState, d.__reactInternalSnapshotBeforeUpdate);
                    }
                    var f = b.updateQueue;
                    null !== f && me(b, f, d);
                    break;
                  case 3:
                    var g = b.updateQueue;
                    if (null !== g) {
                      c = null;
                      if (null !== b.child) switch (b.child.tag) {
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
                    null === c && b.flags & 4 && mb(h, b.type, b.memoizedProps, b);
                    break;
                  case 6:
                    break;
                  case 4:
                    break;
                  case 12:
                    break;
                  case 13:
                    if (Va && null === b.memoizedState) {
                      var k = b.alternate;
                      if (null !== k) {
                        var l = k.memoizedState;
                        if (null !== l) {
                          var m = l.dehydrated;
                          null !== m && Wb(m);
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
            if (null !== c) {
              c.return = b.return;
              T = c;
              break;
            }
            T = b.return;
          }
        }
        function ch(a) {
          for (; null !== T; ) {
            var b = T;
            if (b === a) {
              T = null;
              break;
            }
            var c = b.sibling;
            if (null !== c) {
              c.return = b.return;
              T = c;
              break;
            }
            T = b.return;
          }
        }
        function fh(a) {
          for (; null !== T; ) {
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
                  if ("function" === typeof d.componentDidMount) {
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
            if (null !== h) {
              h.return = b.return;
              T = h;
              break;
            }
            T = b.return;
          }
        }
        var hh = 0, ih = 1, jh = 2, kh = 3, lh = 4;
        if ("function" === typeof Symbol && Symbol.for) {
          var mh = Symbol.for;
          hh = mh("selector.component");
          ih = mh("selector.has_pseudo_class");
          jh = mh("selector.role");
          kh = mh("selector.test_id");
          lh = mh("selector.text");
        }
        function nh(a) {
          var b = Wa(a);
          if (null != b) {
            if ("string" !== typeof b.memoizedProps["data-testname"]) throw Error(n(364));
            return b;
          }
          a = cb(a);
          if (null === a) throw Error(n(362));
          return a.stateNode.current;
        }
        function oh(a, b) {
          switch (b.$$typeof) {
            case hh:
              if (a.type === b.value) return true;
              break;
            case ih:
              a: {
                b = b.value;
                a = [a, 0];
                for (var c = 0; c < a.length; ) {
                  var d = a[c++], e = a[c++], f = b[e];
                  if (5 !== d.tag || !fb(d)) {
                    for (; null != f && oh(d, f); ) e++, f = b[e];
                    if (e === b.length) {
                      b = true;
                      break a;
                    } else for (d = d.child; null !== d; ) a.push(d, e), d = d.sibling;
                  }
                }
                b = false;
              }
              return b;
            case jh:
              if (5 === a.tag && gb(a.stateNode, b.value)) return true;
              break;
            case lh:
              if (5 === a.tag || 6 === a.tag) {
                if (a = eb(a), null !== a && 0 <= a.indexOf(b.value)) return true;
              }
              break;
            case kh:
              if (5 === a.tag && (a = a.memoizedProps["data-testname"], "string" === typeof a && a.toLowerCase() === b.value.toLowerCase())) return true;
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
          for (var d = 0; d < a.length; ) {
            var e = a[d++], f = a[d++], g = b[f];
            if (5 !== e.tag || !fb(e)) {
              for (; null != g && oh(e, g); ) f++, g = b[f];
              if (f === b.length) c.push(e);
              else for (e = e.child; null !== e; ) a.push(e, f), e = e.sibling;
            }
          }
          return c;
        }
        function rh(a, b) {
          if (!bb) throw Error(n(363));
          a = nh(a);
          a = qh(a, b);
          b = [];
          a = Array.from(a);
          for (var c = 0; c < a.length; ) {
            var d = a[c++];
            if (5 === d.tag) fb(d) || b.push(d.stateNode);
            else for (d = d.child; null !== d; ) a.push(d), d = d.sibling;
          }
          return b;
        }
        var sh = Math.ceil, th = da.ReactCurrentDispatcher, uh = da.ReactCurrentOwner, W = da.ReactCurrentBatchConfig, H = 0, N = null, X = null, Z = 0, $f = 0, Zf = ic(0), R = 0, vh = null, le = 0, wh = 0, xh = 0, yh = null, zh = null, bh = 0, Dg = Infinity, Ah = null;
        function Bh() {
          Dg = D() + 500;
        }
        var Jf = false, Kf = null, Mf = null, Ch = false, Dh = null, Eh = 0, Fh = 0, Gh = null, Hh = -1, Ih = 0;
        function O() {
          return 0 !== (H & 6) ? D() : -1 !== Hh ? Hh : Hh = D();
        }
        function tf(a) {
          if (0 === (a.mode & 1)) return 1;
          if (0 !== (H & 2) && 0 !== Z) return Z & -Z;
          if (null !== Cd.transition) return 0 === Ih && (Ih = Dc()), Ih;
          a = C;
          return 0 !== a ? a : Ya();
        }
        function af(a, b, c, d) {
          if (50 < Fh) throw Fh = 0, Gh = null, Error(n(185));
          Fc(a, c, d);
          if (0 === (H & 2) || a !== N) a === N && (0 === (H & 2) && (wh |= c), 4 === R && Jh(a, Z)), Kh(a, d), 1 === c && 0 === H && 0 === (b.mode & 1) && (Bh(), Xc && ad());
        }
        function Kh(a, b) {
          var c = a.callbackNode;
          Bc(a, b);
          var d = zc(a, a === N ? Z : 0);
          if (0 === d) null !== c && Kc(c), a.callbackNode = null, a.callbackPriority = 0;
          else if (b = d & -d, a.callbackPriority !== b) {
            null != c && Kc(c);
            if (1 === b) 0 === a.tag ? $c(Lh.bind(null, a)) : Zc(Lh.bind(null, a)), $a ? ab(function() {
              0 === (H & 6) && ad();
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
          if (0 !== (H & 6)) throw Error(n(327));
          var c = a.callbackNode;
          if (Oh() && a.callbackNode !== c) return null;
          var d = zc(a, a === N ? Z : 0);
          if (0 === d) return null;
          if (0 !== (d & 30) || 0 !== (d & a.expiredLanes) || b) b = Ph(a, d);
          else {
            b = d;
            var e = H;
            H |= 2;
            var f = Qh();
            if (N !== a || Z !== b) Ah = null, Bh(), Rh(a, b);
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
            null !== X ? b = 0 : (N = null, Z = 0, b = R);
          }
          if (0 !== b) {
            2 === b && (e = Cc(a), 0 !== e && (d = e, b = Uh(a, e)));
            if (1 === b) throw c = vh, Rh(a, 0), Jh(a, d), Kh(a, D()), c;
            if (6 === b) Jh(a, d);
            else {
              e = a.current.alternate;
              if (0 === (d & 30) && !Vh(e) && (b = Ph(a, d), 2 === b && (f = Cc(a), 0 !== f && (d = f, b = Uh(a, f))), 1 === b)) throw c = vh, Rh(a, 0), Jh(a, d), Kh(a, D()), c;
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
                    if (0 !== zc(a, 0)) break;
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
                  if ((d & 4194240) === d) break;
                  b = a.eventTimes;
                  for (e = -1; 0 < d; ) {
                    var g = 31 - tc(d);
                    f = 1 << g;
                    g = b[g];
                    g > e && (e = g);
                    d &= ~f;
                  }
                  d = e;
                  d = D() - d;
                  d = (120 > d ? 120 : 480 > d ? 480 : 1080 > d ? 1080 : 1920 > d ? 1920 : 3e3 > d ? 3e3 : 4320 > d ? 4320 : 1960 * sh(d / 1960)) - d;
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
          2 !== a && (b = zh, zh = c, null !== b && Cg(b));
          return a;
        }
        function Cg(a) {
          null === zh ? zh = a : zh.push.apply(zh, a);
        }
        function Vh(a) {
          for (var b = a; ; ) {
            if (b.flags & 16384) {
              var c = b.updateQueue;
              if (null !== c && (c = c.stores, null !== c)) for (var d = 0; d < c.length; d++) {
                var e = c[d], f = e.getSnapshot;
                e = e.value;
                try {
                  if (!Vc(f(), e)) return false;
                } catch (g) {
                  return false;
                }
              }
            }
            c = b.child;
            if (b.subtreeFlags & 16384 && null !== c) c.return = b, b = c;
            else {
              if (b === a) break;
              for (; null === b.sibling; ) {
                if (null === b.return || b.return === a) return true;
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
          for (a = a.expirationTimes; 0 < b; ) {
            var c = 31 - tc(b), d = 1 << c;
            a[c] = -1;
            b &= ~d;
          }
        }
        function Lh(a) {
          if (0 !== (H & 6)) throw Error(n(327));
          Oh();
          var b = zc(a, 0);
          if (0 === (b & 1)) return Kh(a, D()), null;
          var c = Ph(a, b);
          if (0 !== a.tag && 2 === c) {
            var d = Cc(a);
            0 !== d && (b = d, c = Uh(a, d));
          }
          if (1 === c) throw c = vh, Rh(a, 0), Jh(a, b), Kh(a, D()), c;
          if (6 === c) throw Error(n(345));
          a.finishedWork = a.current.alternate;
          a.finishedLanes = b;
          Wh(a, zh, Ah);
          Kh(a, D());
          return null;
        }
        function Xh(a) {
          null !== Dh && 0 === Dh.tag && 0 === (H & 6) && Oh();
          var b = H;
          H |= 1;
          var c = W.transition, d = C;
          try {
            if (W.transition = null, C = 1, a) return a();
          } finally {
            C = d, W.transition = c, H = b, 0 === (H & 6) && ad();
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
          if (null !== X) for (c = X.return; null !== c; ) {
            var d = c;
            nd(d);
            switch (d.tag) {
              case 1:
                d = d.type.childContextTypes;
                null !== d && void 0 !== d && nc();
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
          if (null !== $d) {
            for (b = 0; b < $d.length; b++) if (c = $d[b], d = c.interleaved, null !== d) {
              c.interleaved = null;
              var e = d.next, f = c.pending;
              if (null !== f) {
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
                for (var d = J.memoizedState; null !== d; ) {
                  var e = d.queue;
                  null !== e && (e.pending = null);
                  d = d.next;
                }
                Ce = false;
              }
              Be = 0;
              L = K = J = null;
              De = false;
              Ee = 0;
              uh.current = null;
              if (null === c || null === c.return) {
                R = 1;
                vh = b;
                X = null;
                break;
              }
              a: {
                var f = a, g = c.return, h = c, k = b;
                b = Z;
                h.flags |= 32768;
                if (null !== k && "object" === typeof k && "function" === typeof k.then) {
                  var l = k, m = h, r = m.tag;
                  if (0 === (m.mode & 1) && (0 === r || 11 === r || 15 === r)) {
                    var p = m.alternate;
                    p ? (m.updateQueue = p.updateQueue, m.memoizedState = p.memoizedState, m.lanes = p.lanes) : (m.updateQueue = null, m.memoizedState = null);
                  }
                  var B = Pf(g);
                  if (null !== B) {
                    B.flags &= -257;
                    Qf(B, g, h, f, b);
                    B.mode & 1 && Nf(f, l, b);
                    b = B;
                    k = l;
                    var w = b.updateQueue;
                    if (null === w) {
                      var Y = /* @__PURE__ */ new Set();
                      Y.add(k);
                      b.updateQueue = Y;
                    } else w.add(k);
                    break a;
                  } else {
                    if (0 === (b & 1)) {
                      Nf(f, l, b);
                      ng();
                      break a;
                    }
                    k = Error(n(426));
                  }
                } else if (F && h.mode & 1) {
                  var ya = Pf(g);
                  if (null !== ya) {
                    0 === (ya.flags & 65536) && (ya.flags |= 256);
                    Qf(ya, g, h, f, b);
                    Bd(Ef(k, h));
                    break a;
                  }
                }
                f = k = Ef(k, h);
                4 !== R && (R = 2);
                null === yh ? yh = [f] : yh.push(f);
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
                      var u = f.type, t = f.stateNode;
                      if (0 === (f.flags & 128) && ("function" === typeof u.getDerivedStateFromError || null !== t && "function" === typeof t.componentDidCatch && (null === Mf || !Mf.has(t)))) {
                        f.flags |= 65536;
                        b &= -b;
                        f.lanes |= b;
                        var Db = Lf(f, h, b);
                        je(f, Db);
                        break a;
                      }
                  }
                  f = f.return;
                } while (null !== f);
              }
              Yh(c);
            } catch (lc) {
              b = lc;
              X === c && null !== c && (X = c = c.return);
              continue;
            }
            break;
          } while (1);
        }
        function Qh() {
          var a = th.current;
          th.current = Le;
          return null === a ? Le : a;
        }
        function ng() {
          if (0 === R || 3 === R || 2 === R) R = 4;
          null === N || 0 === (le & 268435455) && 0 === (wh & 268435455) || Jh(N, Z);
        }
        function Ph(a, b) {
          var c = H;
          H |= 2;
          var d = Qh();
          if (N !== a || Z !== b) Ah = null, Rh(a, b);
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
          if (null !== X) throw Error(n(261));
          N = null;
          Z = 0;
          return R;
        }
        function Zh() {
          for (; null !== X; ) $h(X);
        }
        function Sh() {
          for (; null !== X && !Lc(); ) $h(X);
        }
        function $h(a) {
          var b = ai(a.alternate, a, $f);
          a.memoizedProps = a.pendingProps;
          null === b ? Yh(a) : X = b;
          uh.current = null;
        }
        function Yh(a) {
          var b = a;
          do {
            var c = b.alternate;
            a = b.return;
            if (0 === (b.flags & 32768)) {
              if (c = Bg(c, b, $f), null !== c) {
                X = c;
                return;
              }
            } else {
              c = Fg(c, b);
              if (null !== c) {
                c.flags &= 32767;
                X = c;
                return;
              }
              if (null !== a) a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null;
              else {
                R = 6;
                X = null;
                return;
              }
            }
            b = b.sibling;
            if (null !== b) {
              X = b;
              return;
            }
            X = b = a;
          } while (null !== b);
          0 === R && (R = 5);
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
          while (null !== Dh);
          if (0 !== (H & 6)) throw Error(n(327));
          c = a.finishedWork;
          var e = a.finishedLanes;
          if (null === c) return null;
          a.finishedWork = null;
          a.finishedLanes = 0;
          if (c === a.current) throw Error(n(177));
          a.callbackNode = null;
          a.callbackPriority = 0;
          var f = c.lanes | c.childLanes;
          Gc(a, f);
          a === N && (X = N = null, Z = 0);
          0 === (c.subtreeFlags & 2064) && 0 === (c.flags & 2064) || Ch || (Ch = true, Mh(Pc, function() {
            Oh();
            return null;
          }));
          f = 0 !== (c.flags & 15990);
          if (0 !== (c.subtreeFlags & 15990) || f) {
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
          } else a.current = c;
          Ch && (Ch = false, Dh = a, Eh = e);
          f = a.pendingLanes;
          0 === f && (Mf = null);
          Tc(c.stateNode, d);
          Kh(a, D());
          if (null !== b) for (d = a.onRecoverableError, c = 0; c < b.length; c++) e = b[c], d(e.value, { componentStack: e.stack, digest: e.digest });
          if (Jf) throw Jf = false, a = Kf, Kf = null, a;
          0 !== (Eh & 1) && 0 !== a.tag && Oh();
          f = a.pendingLanes;
          0 !== (f & 1) ? a === Gh ? Fh++ : (Fh = 0, Gh = a) : Fh = 0;
          ad();
          return null;
        }
        function Oh() {
          if (null !== Dh) {
            var a = Ic(Eh), b = W.transition, c = C;
            try {
              W.transition = null;
              C = 16 > a ? 16 : a;
              if (null === Dh) var d = false;
              else {
                a = Dh;
                Dh = null;
                Eh = 0;
                if (0 !== (H & 6)) throw Error(n(331));
                var e = H;
                H |= 4;
                for (T = a.current; null !== T; ) {
                  var f = T, g = f.child;
                  if (0 !== (T.flags & 16)) {
                    var h = f.deletions;
                    if (null !== h) {
                      for (var k = 0; k < h.length; k++) {
                        var l = h[k];
                        for (T = l; null !== T; ) {
                          var m = T;
                          switch (m.tag) {
                            case 0:
                            case 11:
                            case 15:
                              Mg(8, m, f);
                          }
                          var r = m.child;
                          if (null !== r) r.return = m, T = r;
                          else for (; null !== T; ) {
                            m = T;
                            var p = m.sibling, B = m.return;
                            Pg(m);
                            if (m === l) {
                              T = null;
                              break;
                            }
                            if (null !== p) {
                              p.return = B;
                              T = p;
                              break;
                            }
                            T = B;
                          }
                        }
                      }
                      var w = f.alternate;
                      if (null !== w) {
                        var Y = w.child;
                        if (null !== Y) {
                          w.child = null;
                          do {
                            var ya = Y.sibling;
                            Y.sibling = null;
                            Y = ya;
                          } while (null !== Y);
                        }
                      }
                      T = f;
                    }
                  }
                  if (0 !== (f.subtreeFlags & 2064) && null !== g) g.return = f, T = g;
                  else b: for (; null !== T; ) {
                    f = T;
                    if (0 !== (f.flags & 2048)) switch (f.tag) {
                      case 0:
                      case 11:
                      case 15:
                        Mg(9, f, f.return);
                    }
                    var E = f.sibling;
                    if (null !== E) {
                      E.return = f.return;
                      T = E;
                      break b;
                    }
                    T = f.return;
                  }
                }
                var u = a.current;
                for (T = u; null !== T; ) {
                  g = T;
                  var t = g.child;
                  if (0 !== (g.subtreeFlags & 2064) && null !== t) t.return = g, T = t;
                  else b: for (g = u; null !== T; ) {
                    h = T;
                    if (0 !== (h.flags & 2048)) try {
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
                    if (null !== Db) {
                      Db.return = h.return;
                      T = Db;
                      break b;
                    }
                    T = h.return;
                  }
                }
                H = e;
                ad();
                if (Sc && "function" === typeof Sc.onPostCommitFiberRoot) try {
                  Sc.onPostCommitFiberRoot(Rc, a);
                } catch (lc) {
                }
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
          null !== a && (Fc(a, 1, b), Kh(a, b));
        }
        function U(a, b, c) {
          if (3 === a.tag) ci(a, a, c);
          else for (; null !== b; ) {
            if (3 === b.tag) {
              ci(b, a, c);
              break;
            } else if (1 === b.tag) {
              var d = b.stateNode;
              if ("function" === typeof b.type.getDerivedStateFromError || "function" === typeof d.componentDidCatch && (null === Mf || !Mf.has(d))) {
                a = Ef(c, a);
                a = Lf(b, a, 1);
                b = he(b, a, 1);
                a = O();
                null !== b && (Fc(b, 1, a), Kh(b, a));
                break;
              }
            }
            b = b.return;
          }
        }
        function Of(a, b, c) {
          var d = a.pingCache;
          null !== d && d.delete(b);
          b = O();
          a.pingedLanes |= a.suspendedLanes & c;
          N === a && (Z & c) === c && (4 === R || 3 === R && (Z & 130023424) === Z && 500 > D() - bh ? Rh(a, 0) : xh |= c);
          Kh(a, b);
        }
        function di(a, b) {
          0 === b && (0 === (a.mode & 1) ? b = 1 : (b = xc, xc <<= 1, 0 === (xc & 130023424) && (xc = 4194304)));
          var c = O();
          a = ce(a, b);
          null !== a && (Fc(a, b, c), Kh(a, c));
        }
        function og(a) {
          var b = a.memoizedState, c = 0;
          null !== b && (c = b.retryLane);
          di(a, c);
        }
        function Yg(a, b) {
          var c = 0;
          switch (a.tag) {
            case 13:
              var d = a.stateNode;
              var e = a.memoizedState;
              null !== e && (c = e.retryLane);
              break;
            case 19:
              d = a.stateNode;
              break;
            default:
              throw Error(n(314));
          }
          null !== d && d.delete(b);
          di(a, c);
        }
        var ai;
        ai = function(a, b, c) {
          if (null !== a) if (a.memoizedProps !== b.pendingProps || z.current) G = true;
          else {
            if (0 === (a.lanes & c) && 0 === (b.flags & 128)) return G = false, sg(a, b, c);
            G = 0 !== (a.flags & 131072) ? true : false;
          }
          else G = false, F && 0 !== (b.flags & 1048576) && ld(b, ed, b.index);
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
              "object" === typeof e && null !== e && "function" === typeof e.render && void 0 === e.$$typeof ? (b.tag = 1, b.memoizedState = null, b.updateQueue = null, A(d) ? (f = true, qc(b)) : f = false, b.memoizedState = null !== e.state && void 0 !== e.state ? e.state : null, ee(b), e.updater = zf, b.stateNode = e, e._reactInternals = b, Df(b, d, a, c), b = dg(null, b, d, true, f, c)) : (b.tag = 0, F && f && md(b), P(null, b, e, c), b = b.child);
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
                throw Error(n(
                  306,
                  d,
                  ""
                ));
              }
              return b;
            case 0:
              return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), Xf(a, b, d, e, c);
            case 1:
              return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), bg(a, b, d, e, c);
            case 3:
              a: {
                eg(b);
                if (null === a) throw Error(n(387));
                d = b.pendingProps;
                f = b.memoizedState;
                e = f.element;
                fe(a, b);
                ke(b, d, null, c);
                var g = b.memoizedState;
                d = g.element;
                if (Va && f.isDehydrated) if (f = { element: d, isDehydrated: false, cache: g.cache, pendingSuspenseBoundaries: g.pendingSuspenseBoundaries, transitions: g.transitions }, b.updateQueue.baseState = f, b.memoizedState = f, b.flags & 256) {
                  e = Ef(Error(n(423)), b);
                  b = fg(a, b, d, c, e);
                  break a;
                } else if (d !== e) {
                  e = Ef(Error(n(424)), b);
                  b = fg(a, b, d, c, e);
                  break a;
                } else for (Va && (pd = Pb(b.stateNode.containerInfo), od = b, F = true, rd = null, qd = false), c = Pd(b, null, d, c), b.child = c; c; ) c.flags = c.flags & -3 | 4096, c = c.sibling;
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
              return ue(b), null === a && wd(b), d = b.type, e = b.pendingProps, f = null !== a ? a.memoizedProps : null, g = e.children, Na(d, e) ? g = null : null !== f && Na(d, f) && (b.flags |= 32), ag(a, b), P(a, b, g, c), b.child;
            case 6:
              return null === a && wd(b), null;
            case 13:
              return ig(a, b, c);
            case 4:
              return se(b, b.stateNode.containerInfo), d = b.pendingProps, null === a ? b.child = Od(b, null, d, c) : P(a, b, d, c), b.child;
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
                if (null !== f) if (Vc(f.value, g)) {
                  if (f.children === e.children && !z.current) {
                    b = Tf(a, b, c);
                    break a;
                  }
                } else for (f = b.child, null !== f && (f.return = b); null !== f; ) {
                  var h = f.dependencies;
                  if (null !== h) {
                    g = f.child;
                    for (var k = h.firstContext; null !== k; ) {
                      if (k.context === d) {
                        if (1 === f.tag) {
                          k = ge(-1, c & -c);
                          k.tag = 2;
                          var l = f.updateQueue;
                          if (null !== l) {
                            l = l.shared;
                            var m = l.pending;
                            null === m ? k.next = k : (k.next = m.next, m.next = k);
                            l.pending = k;
                          }
                        }
                        f.lanes |= c;
                        k = f.alternate;
                        null !== k && (k.lanes |= c);
                        Xd(f.return, c, b);
                        h.lanes |= c;
                        break;
                      }
                      k = k.next;
                    }
                  } else if (10 === f.tag) g = f.type === b.type ? null : f.child;
                  else if (18 === f.tag) {
                    g = f.return;
                    if (null === g) throw Error(n(341));
                    g.lanes |= c;
                    h = g.alternate;
                    null !== h && (h.lanes |= c);
                    Xd(g, c, b);
                    g = f.sibling;
                  } else g = f.child;
                  if (null !== g) g.return = f;
                  else for (g = f; null !== g; ) {
                    if (g === b) {
                      g = null;
                      break;
                    }
                    f = g.sibling;
                    if (null !== f) {
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
          if ("function" === typeof a) return Vf(a) ? 1 : 0;
          if (void 0 !== a && null !== a) {
            a = a.$$typeof;
            if (a === ma) return 11;
            if (a === pa) return 14;
          }
          return 2;
        }
        function Jd(a, b) {
          var c = a.alternate;
          null === c ? (c = td(a.tag, b, a.key, a.mode), c.elementType = a.elementType, c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.pendingProps = b, c.type = a.type, c.flags = 0, c.subtreeFlags = 0, c.deletions = null);
          c.flags = a.flags & 14680064;
          c.childLanes = a.childLanes;
          c.lanes = a.lanes;
          c.child = a.child;
          c.memoizedProps = a.memoizedProps;
          c.memoizedState = a.memoizedState;
          c.updateQueue = a.updateQueue;
          b = a.dependencies;
          c.dependencies = null === b ? null : { lanes: b.lanes, firstContext: b.firstContext };
          c.sibling = a.sibling;
          c.index = a.index;
          c.ref = a.ref;
          return c;
        }
        function Ld(a, b, c, d, e, f) {
          var g = 2;
          d = a;
          if ("function" === typeof a) Vf(a) && (g = 1);
          else if ("string" === typeof a) g = 5;
          else a: switch (a) {
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
              if ("object" === typeof a && null !== a) switch (a.$$typeof) {
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
              throw Error(n(130, null == a ? a : typeof a, ""));
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
          b = td(4, null !== a.children ? a.children : [], a.key, b);
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
          1 === b ? (b = 1, true === f && (b |= 8)) : b = 0;
          f = td(3, null, null, b);
          a.current = f;
          f.stateNode = a;
          f.memoizedState = { element: d, isDehydrated: c, cache: null, transitions: null, pendingSuspenseBoundaries: null };
          ee(f);
          return a;
        }
        function ii(a) {
          if (!a) return jc;
          a = a._reactInternals;
          a: {
            if (wa(a) !== a || 1 !== a.tag) throw Error(n(170));
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
            } while (null !== b);
            throw Error(n(171));
          }
          if (1 === a.tag) {
            var c = a.type;
            if (A(c)) return pc(a, c, b);
          }
          return b;
        }
        function ji(a) {
          var b = a._reactInternals;
          if (void 0 === b) {
            if ("function" === typeof a.render) throw Error(n(188));
            a = Object.keys(a).join(",");
            throw Error(n(268, a));
          }
          a = Aa(b);
          return null === a ? null : a.stateNode;
        }
        function ki(a, b) {
          a = a.memoizedState;
          if (null !== a && null !== a.dehydrated) {
            var c = a.retryLane;
            a.retryLane = 0 !== c && c < b ? c : b;
          }
        }
        function li(a, b) {
          ki(a, b);
          (a = a.alternate) && ki(a, b);
        }
        function mi(a) {
          a = Aa(a);
          return null === a ? null : a.stateNode;
        }
        function ni() {
          return null;
        }
        exports2.attemptContinuousHydration = function(a) {
          if (13 === a.tag) {
            var b = ce(a, 134217728);
            if (null !== b) {
              var c = O();
              af(b, a, 134217728, c);
            }
            li(a, 134217728);
          }
        };
        exports2.attemptDiscreteHydration = function(a) {
          if (13 === a.tag) {
            var b = ce(a, 1);
            if (null !== b) {
              var c = O();
              af(b, a, 1, c);
            }
            li(a, 1);
          }
        };
        exports2.attemptHydrationAtCurrentPriority = function(a) {
          if (13 === a.tag) {
            var b = tf(a), c = ce(a, b);
            if (null !== c) {
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
                0 !== c && (Hc(b, c | 1), Kh(b, D()), 0 === (H & 6) && (Bh(), ad()));
              }
              break;
            case 13:
              Xh(function() {
                var b2 = ce(a, 1);
                if (null !== b2) {
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
            H = c, 0 === H && (Bh(), Xc && ad());
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
          f.callback = void 0 !== b && null !== b ? b : null;
          he(c, f, e);
          a.current.lanes = e;
          Fc(a, e, d);
          Kh(a, d);
          return a;
        };
        exports2.createPortal = function(a, b, c) {
          var d = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
          return { $$typeof: fa, key: null == d ? null : "" + d, children: a, containerInfo: b, implementation: c };
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
            C = f, W.transition = g, 0 === H && Bh();
          }
        };
        exports2.findAllNodes = rh;
        exports2.findBoundingRects = function(a, b) {
          if (!bb) throw Error(n(363));
          b = rh(a, b);
          a = [];
          for (var c = 0; c < b.length; c++) a.push(db(b[c]));
          for (b = a.length - 1; 0 < b; b--) {
            c = a[b];
            for (var d = c.x, e = d + c.width, f = c.y, g = f + c.height, h = b - 1; 0 <= h; h--) if (b !== h) {
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
          a = null !== a ? Ca(a) : null;
          return null === a ? null : a.stateNode;
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
            C = d, W.transition = c, H = b, 0 === H && (Bh(), ad());
          }
        };
        exports2.flushPassiveEffects = Oh;
        exports2.flushSync = Xh;
        exports2.focusWithin = function(a, b) {
          if (!bb) throw Error(n(363));
          a = nh(a);
          b = qh(a, b);
          b = Array.from(b);
          for (a = 0; a < b.length; ) {
            var c = b[a++];
            if (!fb(c)) {
              if (5 === c.tag && hb(c.stateNode)) return true;
              for (c = c.child; null !== c; ) b.push(c), c = c.sibling;
            }
          }
          return false;
        };
        exports2.getCurrentUpdatePriority = function() {
          return C;
        };
        exports2.getFindAllNodesFailureDescription = function(a, b) {
          if (!bb) throw Error(n(363));
          var c = 0, d = [];
          a = [nh(a), 0];
          for (var e = 0; e < a.length; ) {
            var f = a[e++], g = a[e++], h = b[g];
            if (5 !== f.tag || !fb(f)) {
              if (oh(f, h) && (d.push(ph(h)), g++, g > c && (c = g)), g < b.length) for (f = f.child; null !== f; ) a.push(f, g), f = f.sibling;
            }
          }
          if (c < b.length) {
            for (a = []; c < b.length; c++) a.push(ph(b[c]));
            return "findAllNodes was able to match part of the selector:\n  " + (d.join(" > ") + "\n\nNo matching component was found for:\n  ") + a.join(" > ");
          }
          return null;
        };
        exports2.getPublicRootInstance = function(a) {
          a = a.current;
          if (!a.child) return null;
          switch (a.child.tag) {
            case 5:
              return Ea(a.child.stateNode);
            default:
              return a.child.stateNode;
          }
        };
        exports2.injectIntoDevTools = function(a) {
          a = { bundleType: a.bundleType, version: a.version, rendererPackageName: a.rendererPackageName, rendererConfig: a.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: da.ReactCurrentDispatcher, findHostInstanceByFiber: mi, findFiberByHostInstance: a.findFiberByHostInstance || ni, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1" };
          if ("undefined" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) a = false;
          else {
            var b = __REACT_DEVTOOLS_GLOBAL_HOOK__;
            if (b.isDisabled || !b.supportsFiber) a = true;
            else {
              try {
                Rc = b.inject(a), Sc = b;
              } catch (c) {
              }
              a = b.checkDCE ? true : false;
            }
          }
          return a;
        };
        exports2.isAlreadyRendering = function() {
          return false;
        };
        exports2.observeVisibleRects = function(a, b, c, d) {
          if (!bb) throw Error(n(363));
          a = rh(a, b);
          var e = ib(a, c, d).disconnect;
          return { disconnect: function() {
            e();
          } };
        };
        exports2.registerMutableSourceForHydration = function(a, b) {
          var c = b._getVersion;
          c = c(b._source);
          null == a.mutableSourceEagerHydrationData ? a.mutableSourceEagerHydrationData = [b, c] : a.mutableSourceEagerHydrationData.push(b, c);
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
          null === b.context ? b.context = c : b.pendingContext = c;
          b = ge(f, g);
          b.payload = { element: a };
          d = void 0 === d ? null : d;
          null !== d && (b.callback = d);
          a = he(e, b, g);
          null !== a && (af(a, e, g, f), ie(a, e, g));
          return g;
        };
        return exports2;
      };
    }
  });

  // ../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/index.js
  var require_react_reconciler = __commonJS({
    "../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/index.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_reconciler_production_min();
      } else {
        module.exports = null;
      }
    }
  });

  // ../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/cjs/react-reconciler-constants.production.min.js
  var require_react_reconciler_constants_production_min = __commonJS({
    "../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/cjs/react-reconciler-constants.production.min.js"(exports) {
      "use strict";
      exports.ConcurrentRoot = 1;
      exports.ContinuousEventPriority = 4;
      exports.DefaultEventPriority = 16;
      exports.DiscreteEventPriority = 1;
      exports.IdleEventPriority = 536870912;
      exports.LegacyRoot = 0;
    }
  });

  // ../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/constants.js
  var require_constants = __commonJS({
    "../../node_modules/.bun/react-reconciler@0.29.2+f4eacebf2041cd4f/node_modules/react-reconciler/constants.js"(exports, module) {
      "use strict";
      if (true) {
        module.exports = require_react_reconciler_constants_production_min();
      } else {
        module.exports = null;
      }
    }
  });

  // js/app.jsx
  var import_react7 = __toESM(require_react());

  // ../../js/packages/@glyx/react/src/polyfills.js
  if (typeof performance === "undefined") {
    globalThis.performance = {
      now: () => Number(__glyx_getTime())
    };
  }
  try {
    "a".localeCompare("b");
  } catch {
    String.prototype.localeCompare = function(other) {
      const a = String(this), b = String(other);
      return a < b ? -1 : a > b ? 1 : 0;
    };
  }
  if (typeof setTimeout === "undefined") {
    let _nextTimerId = 1;
    const _pendingTimers = /* @__PURE__ */ new Map();
    globalThis.setTimeout = (fn, ms) => {
      const id = _nextTimerId++;
      const delay = ms > 0 ? ms : 0;
      _pendingTimers.set(id, { fn, due: performance.now() + delay });
      if (typeof __glyx_request_frame !== "undefined") {
        __glyx_request_frame(delay);
      }
      return id;
    };
    globalThis.clearTimeout = (id) => {
      _pendingTimers.delete(id);
    };
    globalThis._glyxDrainTimers = () => {
      if (_pendingTimers.size === 0) return;
      const now = performance.now();
      const due = [];
      for (const [id, t] of _pendingTimers) {
        if (t.due <= now) due.push([id, t.fn]);
      }
      for (const [id] of due) _pendingTimers.delete(id);
      for (const [, fn] of due) fn();
    };
  }
  if (typeof setInterval === "undefined") {
    let _nextIntervalId = 1;
    const _pendingIntervals = /* @__PURE__ */ new Map();
    globalThis.setInterval = (fn, ms) => {
      const id = _nextIntervalId++;
      const delay = ms > 0 ? ms : 0;
      _pendingIntervals.set(id, { fn, ms: delay, nextDue: performance.now() + delay });
      if (typeof __glyx_request_frame !== "undefined") __glyx_request_frame(delay);
      return id;
    };
    globalThis.clearInterval = (id) => {
      _pendingIntervals.delete(id);
    };
    const _prevDrain = globalThis._glyxDrainTimers;
    globalThis._glyxDrainTimers = () => {
      _prevDrain?.();
      if (_pendingIntervals.size === 0) return;
      const now = performance.now();
      let earliest = Infinity;
      for (const [, t] of _pendingIntervals) {
        if (now >= t.nextDue) {
          t.nextDue = now + t.ms;
          t.fn();
        }
        if (t.nextDue < earliest) earliest = t.nextDue;
      }
      if (earliest < Infinity && typeof __glyx_request_frame !== "undefined") {
        __glyx_request_frame(Math.max(0, earliest - performance.now()));
      }
    };
  }
  if (typeof queueMicrotask === "undefined") {
    globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn);
  }
  if (typeof MessageChannel === "undefined") {
    globalThis.MessageChannel = class MessageChannel {
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

  // ../../js/packages/@glyx/react/src/index.js
  var import_react6 = __toESM(require_react(), 1);
  var import_react_reconciler = __toESM(require_react_reconciler(), 1);

  // ../../js/packages/@glyx/react/src/hostConfig.js
  var import_constants = __toESM(require_constants(), 1);

  // ../../js/packages/@glyx/react/src/events.js
  var pressableRegistry = /* @__PURE__ */ new Map();
  var inputRegistry = /* @__PURE__ */ new Map();
  var scrollRegistry = /* @__PURE__ */ new Map();
  var dragRegistry = /* @__PURE__ */ new Map();
  var disabledRegistry = /* @__PURE__ */ new Map();
  var pointerEventsNoneRegistry = /* @__PURE__ */ new Set();
  var zIndexMap = /* @__PURE__ */ new Map();
  var solidRegistry = [];
  var parentMap = /* @__PURE__ */ new Map();
  var activeDragId = null;
  var imageErrorRegistry = /* @__PURE__ */ new Map();
  var systemWatchRegistry = /* @__PURE__ */ new Map();
  var windowSizeListeners = [];
  var keyListeners = [];
  var globalClickListeners = [];
  var focusedNodeId = null;
  var inputDragNodeId = null;
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
  function registerSolid(nodeId) {
    solidRegistry.push(nodeId);
  }
  function unregisterSolid(nodeId) {
    const i = solidRegistry.indexOf(nodeId);
    if (i !== -1) solidRegistry.splice(i, 1);
  }
  function setNodeParent(childId, parentId) {
    parentMap.set(childId, parentId);
  }
  function removeNodeFromTree(nodeId) {
    parentMap.delete(nodeId);
    unregisterSolid(nodeId);
    zIndexMap.delete(nodeId);
  }
  function setNodeZIndex(nodeId, zIndex) {
    if (zIndex !== 0) {
      zIndexMap.set(nodeId, zIndex);
    } else {
      zIndexMap.delete(nodeId);
    }
  }
  function addWindowSizeListener(fn) {
    windowSizeListeners.push(fn);
  }
  function removeWindowSizeListener(fn) {
    const idx = windowSizeListeners.indexOf(fn);
    if (idx >= 0) windowSizeListeners.splice(idx, 1);
  }
  function addKeyListener(fn) {
    keyListeners.push(fn);
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
    if (pointerEventsNoneRegistry.has(nodeId)) return false;
    const layout = __glyx_getLayout(nodeId);
    if (!layout) return false;
    return px >= layout.x && px < layout.x + layout.width && py >= layout.y && py < layout.y + layout.height;
  }
  function isDisabled(nodeId) {
    return disabledRegistry.has(nodeId);
  }
  function findScrollTarget(fromNodeId) {
    if (fromNodeId !== null) {
      let id = parentMap.get(fromNodeId);
      while (id !== void 0) {
        if (scrollRegistry.has(id)) return id;
        id = parentMap.get(id);
      }
    }
    for (const [nodeId] of [...scrollRegistry].reverse()) {
      if (hitTest(nodeId, cursorX, cursorY)) return nodeId;
    }
    return null;
  }
  function isAncestorOf(ancestorId, descendantId) {
    let id = parentMap.get(descendantId);
    while (id !== void 0) {
      if (id === ancestorId) return true;
      id = parentMap.get(id);
    }
    return false;
  }
  function findTopmostSolid(x, y) {
    const covering = [];
    for (const id of solidRegistry) {
      if (hitTest(id, x, y)) covering.push(id);
    }
    if (covering.length === 0) return null;
    if (covering.length === 1) return covering[0];
    const deepest = covering.filter(
      (id) => !covering.some((other) => other !== id && isAncestorOf(id, other))
    );
    if (deepest.length === 1) return deepest[0];
    const effectiveZ = (id) => {
      let z = zIndexMap.get(id) ?? 0;
      let p = parentMap.get(id);
      while (p !== void 0) {
        const pz = zIndexMap.get(p);
        if (pz !== void 0 && pz > z) z = pz;
        p = parentMap.get(p);
      }
      return z;
    };
    let bestId = deepest[0];
    let bestIdx = solidRegistry.lastIndexOf(deepest[0]);
    let bestZ = effectiveZ(deepest[0]);
    for (let i = 1; i < deepest.length; i++) {
      const z = effectiveZ(deepest[i]);
      const idx = solidRegistry.lastIndexOf(deepest[i]);
      if (z > bestZ || z === bestZ && idx > bestIdx) {
        bestId = deepest[i];
        bestIdx = idx;
        bestZ = z;
      }
    }
    return bestId;
  }
  function dispatchEvents() {
    const events = __glyx_pollEvents();
    if (!events || events.length === 0) return;
    let cursorMovedThisFrame = false;
    for (const ev of events) {
      switch (ev.type) {
        case "mouseButton": {
          if (!ev.pressed) {
            inputDragNodeId = null;
            break;
          }
          const isRight = ev.button === 1;
          if (globalClickListeners.length > 0) {
            const gev = { x: ev.x, y: ev.y, button: ev.button };
            for (const fn of globalClickListeners) try {
              fn(gev);
            } catch {
            }
          }
          const topmostId = findTopmostSolid(ev.x, ev.y);
          if (topmostId !== null) {
            let pressableTarget = topmostId;
            while (pressableTarget !== void 0 && !pressableRegistry.has(pressableTarget)) {
              pressableTarget = parentMap.get(pressableTarget);
            }
            if (pressableTarget !== void 0) {
              const ph = pressableRegistry.get(pressableTarget);
              if (ph && !isDisabled(pressableTarget)) {
                const layout = __glyx_getLayout(pressableTarget);
                const pev = {
                  x: ev.x,
                  y: ev.y,
                  locationX: layout ? ev.x - layout.x : 0,
                  locationY: layout ? ev.y - layout.y : 0
                };
                if (isRight) ph.onRightPress?.(pev);
                else ph.onPress?.(pev);
              }
            }
            const ih = inputRegistry.get(topmostId);
            if (ih && !isDisabled(topmostId)) {
              setFocus(topmostId);
              const layout = __glyx_getLayout(topmostId);
              if (layout) ih.onClickAt?.(ev.x - layout.x, ev.y - layout.y);
              if (!isRight) inputDragNodeId = topmostId;
            }
          }
          if (focusedNodeId !== null && focusedNodeId !== topmostId) {
            inputRegistry.get(focusedNodeId)?.onBlur?.();
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
            for (const fn of keyListeners) try {
              fn(kev);
            } catch {
            }
          }
          if (!ev.pressed) break;
          {
            const k = ev.key;
            const noFocus = focusedNodeId === null;
            const isPageKey = (k === "PageUp" || k === "PageDown") && noFocus;
            const isJumpKey = ctrlHeld && (k === "Home" || k === "End") && noFocus;
            const isArrowKey = (k === "ArrowUp" || k === "ArrowDown") && noFocus;
            if (isPageKey || isJumpKey || isArrowKey) {
              const target = findScrollTarget(focusedNodeId);
              if (target !== null) {
                const sh = scrollRegistry.get(target);
                const layout = __glyx_getLayout(target);
                const viewH = layout ? layout.height : 200;
                const LINE = 24;
                if (k === "ArrowUp") sh.onScroll?.(-LINE);
                else if (k === "ArrowDown") sh.onScroll?.(LINE);
                else if (k === "PageUp") sh.onScroll?.(-(viewH - LINE));
                else if (k === "PageDown") sh.onScroll?.(viewH - LINE);
                else if (k === "Home") sh.onAbsoluteScroll?.(0);
                else if (k === "End") sh.onAbsoluteScroll?.(999999);
              }
              break;
            }
          }
          if (focusedNodeId === null) break;
          const handlers = inputRegistry.get(focusedNodeId);
          if (!handlers) break;
          handlers.onKeyPress?.({ key: ev.key, text: ev.text, ctrl: ctrlHeld, shift: shiftHeld });
          break;
        }
        case "cursorMoved": {
          cursorX = ev.x;
          cursorY = ev.y;
          cursorMovedThisFrame = true;
          if (inputDragNodeId !== null) {
            const ih = inputRegistry.get(inputDragNodeId);
            if (ih && ih.onDragAt) {
              const layout = __glyx_getLayout(inputDragNodeId);
              if (layout) ih.onDragAt(ev.x - layout.x, ev.y - layout.y);
            }
          }
          break;
        }
        case "scroll": {
          let target = null;
          let targetHandlers = null;
          for (const [nodeId, handlers] of scrollRegistry) {
            if (!hitTest(nodeId, cursorX, cursorY) || isDisabled(nodeId)) continue;
            if (target === null || isAncestorOf(target, nodeId)) {
              target = nodeId;
              targetHandlers = handlers;
            }
          }
          targetHandlers?.onScroll?.(ev.deltaY);
          break;
        }
        case "scrollbarDrag": {
          const handlers = scrollRegistry.get(ev.nodeId);
          handlers?.onAbsoluteScroll?.(ev.scrollY);
          break;
        }
        case "resize": {
          const size = { width: ev.width, height: ev.height };
          for (const fn of windowSizeListeners) fn(size);
          break;
        }
        case "systemWatch": {
          const cb = systemWatchRegistry.get(ev.id);
          if (cb) {
            let val = null;
            try {
              val = JSON.parse(ev.payload);
            } catch {
              val = ev.payload;
            }
            try {
              cb(val);
            } catch (e) {
              if (typeof __glyx_log !== "undefined") __glyx_log("[system.watch] callback error: " + e);
            }
          }
          break;
        }
        case "imageError": {
          const onError = imageErrorRegistry.get(ev.imageId);
          if (onError) try {
            onError({ path: ev.path });
          } catch {
          }
          break;
        }
        case "dragStart": {
          for (const [nodeId, handlers] of dragRegistry) {
            if (hitTest(nodeId, ev.x, ev.y)) {
              if (isDisabled(nodeId)) break;
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
      const topSolid = findTopmostSolid(cursorX, cursorY);
      let hoverId = topSolid;
      while (hoverId !== void 0 && !pressableRegistry.has(hoverId)) {
        hoverId = parentMap.get(hoverId);
      }
      const newHoveredId = hoverId !== void 0 && !isDisabled(hoverId) ? hoverId : null;
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

  // ../../js/packages/@glyx/react/src/hostConfig.js
  function createInstance(type, props) {
    const { children, style, ref: _ref, _glyxOnMount, glyxDraggable, ...rest } = props;
    const nodeProps = { ...rest, ...style };
    if (glyxDraggable) nodeProps.draggable = true;
    const id = __glyx_createNode(type, nodeProps);
    if (type === "view") {
      registerSolid(id);
      if (nodeProps.zIndex) setNodeZIndex(id, nodeProps.zIndex);
    }
    if (typeof _glyxOnMount === "function") {
      _glyxOnMount(id);
    }
    return { id };
  }
  function createTextInstance(text) {
    __glyx_log('[Glyx] Warning: raw text node "' + text + '" \u2014 wrap in <Text>');
    return { id: -1 };
  }
  function appendInitialChild(parentInstance, child) {
    if (child.id !== -1) {
      __glyx_appendChild(parentInstance.id, child.id);
      setNodeParent(child.id, parentInstance.id);
    }
  }
  function appendChild(parentInstance, child) {
    if (child.id !== -1) {
      __glyx_appendChild(parentInstance.id, child.id);
      setNodeParent(child.id, parentInstance.id);
    }
  }
  function appendChildToContainer(_container, child) {
    if (child.id !== -1) {
      __glyx_setRoot(child.id);
    }
  }
  function insertBefore(parentInstance, child, beforeChild) {
    if (child.id !== -1) {
      if (beforeChild && beforeChild.id !== -1) {
        __glyx_insertBefore(parentInstance.id, child.id, beforeChild.id);
      } else {
        __glyx_appendChild(parentInstance.id, child.id);
      }
      setNodeParent(child.id, parentInstance.id);
    }
  }
  function insertInContainerBefore(_container, child, _beforeChild) {
    if (child.id !== -1) {
      __glyx_setRoot(child.id);
    }
  }
  function removeChild(_parentInstance, child) {
    if (child.id !== -1) {
      __glyx_removeNode(child.id);
    }
  }
  function removeChildFromContainer(_container, child) {
    if (child.id !== -1) {
      __glyx_removeNode(child.id);
    }
  }
  function clearContainer(_container) {
  }
  function detachDeletedInstance(instance) {
    if (instance.id !== -1) {
      __glyx_removeNode(instance.id);
      removeNodeFromTree(instance.id);
    }
  }
  function prepareUpdate(_instance, _type, oldProps, newProps) {
    const skip = ["children", "ref", "_glyxOnMount", "glyxDraggable"];
    const oldKeys = Object.keys(oldProps).filter((k) => !skip.includes(k));
    const newKeys = Object.keys(newProps).filter((k) => !skip.includes(k));
    if (oldKeys.length !== newKeys.length) return newProps;
    for (const k of newKeys) {
      if (oldProps[k] !== newProps[k]) return newProps;
    }
    return null;
  }
  function commitUpdate(instance, updatePayload) {
    const { children, style, ref: _ref, _glyxOnMount, glyxDraggable, ...rest } = updatePayload;
    const nodeProps = { ...rest, ...style };
    if (glyxDraggable) nodeProps.draggable = true;
    __glyx_updateNode(instance.id, nodeProps);
    setNodeZIndex(instance.id, nodeProps.zIndex ?? 0);
  }
  function commitTextUpdate() {
  }
  function commitMount() {
  }
  function finalizeInitialChildren() {
    return false;
  }
  function preparePortalMount() {
  }
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
  function resetAfterCommit() {
  }
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
  function beforeActiveInstanceBlur() {
  }
  function afterActiveInstanceBlur() {
  }
  function prepareScopeUpdate() {
  }
  function getInstanceFromScope() {
    return null;
  }
  var HostConfig = {
    // Creation
    createInstance,
    createTextInstance,
    // Initial tree
    appendInitialChild,
    // Mutation
    appendChild,
    appendChildToContainer,
    insertBefore,
    insertInContainerBefore,
    removeChild,
    removeChildFromContainer,
    clearContainer,
    detachDeletedInstance,
    // Updates
    prepareUpdate,
    commitUpdate,
    commitTextUpdate,
    commitMount,
    // Finalisation
    finalizeInitialChildren,
    preparePortalMount,
    // Context
    getRootHostContext,
    getChildHostContext,
    getPublicInstance,
    // Commit lifecycle
    prepareForCommit,
    resetAfterCommit,
    // Text
    shouldSetTextContent,
    // Scheduling
    scheduleTimeout,
    cancelTimeout,
    noTimeout: -1,
    // Feature flags
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: true,
    // Microtask scheduling — tells React to flush sync callbacks via microtasks
    // rather than via the Scheduler (MessageChannel path). This ensures that
    // flushSync's finally block can correctly flush pending sync work when
    // setState is called from outside React's event system.
    supportsMicrotasks: true,
    scheduleMicrotask: (fn) => Promise.resolve().then(fn),
    // Event system
    getCurrentEventPriority,
    getInstanceFromNode,
    beforeActiveInstanceBlur,
    afterActiveInstanceBlur,
    prepareScopeUpdate,
    getInstanceFromScope
  };
  var hostConfig_default = HostConfig;

  // ../../js/packages/@glyx/react/src/api.js
  var _wsOpenSockets = /* @__PURE__ */ new Map();
  var _ipcListeners = [];
  var _deeplinkCallbacks = [];
  var _deeplinkInitialFired = false;
  function _pollDeeplinks() {
    if (!_deeplinkInitialFired && _deeplinkCallbacks.length > 0) {
      _deeplinkInitialFired = true;
      if (typeof __glyx_deeplink_getInitialUrl !== "undefined") {
        try {
          const url = __glyx_deeplink_getInitialUrl();
          if (url) {
            for (const cb of _deeplinkCallbacks) {
              try {
                cb(url);
              } catch (e) {
                __glyx_log("[deeplink] callback error: " + e);
              }
            }
          }
        } catch {
        }
      }
    }
    if (typeof __glyx_deeplink_poll === "undefined") return;
    let raw;
    try {
      raw = __glyx_deeplink_poll();
    } catch {
      return;
    }
    if (!raw || raw === "[]") return;
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
          __glyx_log("[deeplink] callback error: " + e);
        }
      }
    }
  }
  var _globalShortcutCallbacks = /* @__PURE__ */ new Map();
  function _pollGlobalShortcuts() {
    if (typeof __glyx_shortcut_poll === "undefined") return;
    if (_globalShortcutCallbacks.size === 0) return;
    let raw;
    try {
      raw = __glyx_shortcut_poll();
    } catch {
      return;
    }
    if (!raw || raw === "[]") return;
    let ids;
    try {
      ids = JSON.parse(raw);
    } catch {
      return;
    }
    for (const id of ids) {
      const cb = _globalShortcutCallbacks.get(id);
      if (cb) try {
        cb();
      } catch (e) {
        __glyx_log("[shortcut] callback error: " + e);
      }
    }
  }
  function _pollGamepads() {
    if (typeof __glyx_gamepad_poll === "undefined") return;
    if (!globalThis._gamepadCallbacks || globalThis._gamepadCallbacks.length === 0) return;
    let raw;
    try {
      raw = __glyx_gamepad_poll();
    } catch {
      return;
    }
    if (!raw || raw === "[]") return;
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
          __glyx_log("[gamepad] callback error: " + e);
        }
      }
    }
  }
  var _localShortcuts = /* @__PURE__ */ new Map();
  function _normalizeKey(winitKey) {
    if (/^Key[A-Z]$/.test(winitKey)) return winitKey[3].toLowerCase();
    if (/^Digit\d$/.test(winitKey)) return winitKey[5];
    return winitKey.toLowerCase();
  }
  addKeyListener(function _dispatchLocalShortcuts({ key, ctrl, shift, pressed }) {
    if (!pressed || _localShortcuts.size === 0) return;
    const norm = _normalizeKey(key);
    for (const { mods, key: sKey, cb } of _localShortcuts.values()) {
      if (sKey === norm && mods.ctrl === ctrl && mods.shift === shift) {
        try {
          cb();
        } catch (e) {
          __glyx_log("[shortcut] local callback error: " + e);
        }
      }
    }
  });
  var _perfBudgetCallbacks = [];
  var _perfLeakCallbacks = [];
  function _pollPerfViolations() {
    if (typeof __glyx_perf_poll_violations === "undefined") return;
    if (_perfBudgetCallbacks.length === 0) return;
    let raw;
    try {
      raw = __glyx_perf_poll_violations();
    } catch {
      return;
    }
    if (!raw || raw === "[]") return;
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
          __glyx_log("[perf] onBudgetExceeded callback error: " + e);
        }
      }
    }
  }
  function _pollLeakWarnings() {
    if (typeof __glyx_perf_poll_leak_warnings === "undefined") return;
    if (_perfLeakCallbacks.length === 0) return;
    let raw;
    try {
      raw = __glyx_perf_poll_leak_warnings();
    } catch {
      return;
    }
    if (!raw || raw === "[]") return;
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
          __glyx_log("[perf] onLeakDetected callback error: " + e);
        }
      }
    }
  }
  var _audioCallbacks = /* @__PURE__ */ new Map();
  function _pollAudio() {
    if (typeof __glyx_audio_poll === "undefined") return;
    let raw;
    try {
      raw = __glyx_audio_poll();
    } catch {
      return;
    }
    if (!raw || raw === "[]") return;
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
              __glyx_log("[audio] onEnded error: " + e);
            }
          }
        }
        if (ev.event === "ended") _audioCallbacks.delete(key);
      }
    }
  }
  var _noBinding = (name) => Promise.reject(new Error(`${name}: binding not available`));
  var _fsWatchCallbacks = /* @__PURE__ */ new Map();
  function _pollFsWatch() {
    if (typeof __glyx_fs_watch_poll === "undefined") return;
    const raw = __glyx_fs_watch_poll();
    if (!raw || raw === "[]") return;
    let events;
    try {
      events = JSON.parse(raw);
    } catch {
      return;
    }
    for (const ev of events) {
      const cb = _fsWatchCallbacks.get(ev.id);
      if (cb) cb({ path: ev.path, type: ev.type });
    }
  }
  var GlyxHeaders = class _GlyxHeaders {
    constructor(init) {
      this._m = /* @__PURE__ */ new Map();
      if (!init) return;
      if (init instanceof _GlyxHeaders) {
        init.forEach((v, k) => this.set(k, v));
      } else if (Array.isArray(init)) {
        for (const [k, v] of init) this.append(k, v);
      } else if (typeof init.forEach === "function") {
        init.forEach((v, k) => this.set(k, v));
      } else {
        for (const k of Object.keys(init)) this.set(k, init[k]);
      }
    }
    set(k, v) {
      this._m.set(String(k).toLowerCase(), String(v));
    }
    append(k, v) {
      const lk = String(k).toLowerCase();
      this._m.set(lk, this._m.has(lk) ? `${this._m.get(lk)}, ${v}` : String(v));
    }
    get(k) {
      const v = this._m.get(String(k).toLowerCase());
      return v == null ? null : v;
    }
    has(k) {
      return this._m.has(String(k).toLowerCase());
    }
    delete(k) {
      this._m.delete(String(k).toLowerCase());
    }
    forEach(cb, t) {
      this._m.forEach((v, k) => cb.call(t, v, k, this));
    }
    keys() {
      return this._m.keys();
    }
    values() {
      return this._m.values();
    }
    entries() {
      return this._m.entries();
    }
    [Symbol.iterator]() {
      return this._m.entries();
    }
    toObject() {
      const o = {};
      this._m.forEach((v, k) => {
        o[k] = v;
      });
      return o;
    }
  };
  function _makeResponse(data, url) {
    const headers = new GlyxHeaders(data.headers || {});
    const bodyText = data.body ?? "";
    let used = false;
    const consume = () => {
      if (used) throw new TypeError("Body has already been consumed.");
      used = true;
    };
    const toBytes = () => {
      if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(bodyText);
      const u8 = new Uint8Array(bodyText.length);
      for (let i = 0; i < bodyText.length; i++) u8[i] = bodyText.charCodeAt(i) & 255;
      return u8;
    };
    return {
      url: data.url || url,
      status: data.status,
      ok: data.ok,
      statusText: data.statusText,
      headers,
      redirected: false,
      type: "basic",
      get bodyUsed() {
        return used;
      },
      text: () => {
        consume();
        return Promise.resolve(bodyText);
      },
      json: () => {
        consume();
        return Promise.resolve(JSON.parse(bodyText));
      },
      arrayBuffer: () => {
        consume();
        return Promise.resolve(toBytes().buffer);
      },
      blob: () => {
        consume();
        const u8 = toBytes();
        return Promise.resolve({
          size: u8.length,
          type: headers.get("content-type") || "",
          arrayBuffer: () => Promise.resolve(u8.buffer),
          text: () => Promise.resolve(bodyText)
        });
      },
      clone: () => _makeResponse(data, url)
    };
  }
  async function fetch(url, options = {}) {
    if (typeof __glyx_fetch === "undefined") {
      throw new Error("fetch: __glyx_fetch binding is not available");
    }
    const init = { ...options };
    const hdrs = new GlyxHeaders(init.headers);
    if (init.body != null && typeof init.body !== "string" && !init.multipart) {
      const b = init.body;
      const isBinary = b instanceof ArrayBuffer || ArrayBuffer.isView(b);
      if (!isBinary && typeof b === "object") {
        init.body = JSON.stringify(b);
        if (!hdrs.has("content-type")) hdrs.set("Content-Type", "application/json");
      } else if (!isBinary) {
        init.body = String(b);
      }
    }
    init.headers = hdrs.toObject();
    const raw = await __glyx_fetch(url, JSON.stringify(init));
    return _makeResponse(JSON.parse(raw), url);
  }
  if (typeof globalThis.fetch === "undefined") globalThis.fetch = fetch;
  if (typeof globalThis.Headers === "undefined") globalThis.Headers = GlyxHeaders;
  function _pollWebSockets() {
    for (const [id, handlers] of _wsOpenSockets) {
      let raw;
      try {
        raw = __glyx_ws_poll(id);
      } catch {
        continue;
      }
      if (!raw) continue;
      let msgs;
      try {
        msgs = JSON.parse(raw);
      } catch {
        continue;
      }
      for (const m of msgs) {
        if (m === "__GLYX_WS_CLOSED__") {
          handlers.onclose?.();
          _wsOpenSockets.delete(id);
          break;
        } else {
          handlers.onmessage?.({ data: m });
        }
      }
    }
  }
  function _pollIpc() {
    if (typeof __glyx_ipc_poll === "undefined") return;
    let raw;
    try {
      raw = __glyx_ipc_poll();
    } catch {
      return;
    }
    if (!raw) return;
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
        } catch {
        }
      }
    }
  }
  var ipc = {
    /**
     * Send a string message to another window by its handle.
     * @param {number} targetHandle
     * @param {string} message
     */
    send(targetHandle, message) {
      if (typeof __glyx_ipc_send !== "undefined") {
        __glyx_ipc_send(targetHandle, String(message));
      }
    },
    /**
     * Register a callback for messages received by this window.
     * @param {'message'} event  — currently only 'message' is supported
     * @param {(msg: string) => void} callback
     * @returns {() => void}  unsubscribe function
     */
    on(event, callback) {
      if (event !== "message") return () => {
      };
      _ipcListeners.push(callback);
      return () => {
        const idx = _ipcListeners.indexOf(callback);
        if (idx !== -1) _ipcListeners.splice(idx, 1);
      };
    }
  };
  var glyxWindow = {
    setFullscreen: (full) => typeof __glyx_setFullscreen !== "undefined" && __glyx_setFullscreen(full),
    setMaximized: (max) => typeof __glyx_setMaximized !== "undefined" && __glyx_setMaximized(max),
    setMinimized: () => typeof __glyx_setMinimized !== "undefined" && __glyx_setMinimized(),
    isFullscreen: () => typeof __glyx_isFullscreen !== "undefined" ? __glyx_isFullscreen() : false,
    isMaximized: () => typeof __glyx_isMaximized !== "undefined" ? __glyx_isMaximized() : false,
    getWindowSize: () => typeof __glyx_getWindowSize !== "undefined" ? __glyx_getWindowSize() : { width: 0, height: 0 },
    getScreenSize: () => typeof __glyx_getScreenSize !== "undefined" ? __glyx_getScreenSize() : { width: 0, height: 0 },
    setAlwaysOnTop: (on) => typeof __glyx_setAlwaysOnTop !== "undefined" && __glyx_setAlwaysOnTop(on),
    setTitle: (title) => typeof __glyx_setTitle !== "undefined" && __glyx_setTitle(title),
    /** Set the mouse cursor icon: 'default' | 'pointer' | 'text' | 'move' |
     *  'grab' | 'grabbing' | 'col-resize' | 'row-resize' | 'ew-resize' |
     *  'ns-resize' | 'crosshair' | 'not-allowed' | 'wait'. */
    setCursor: (name) => typeof __glyx_setCursor !== "undefined" && __glyx_setCursor(name),
    /** Immediately run V8 GC + mimalloc segment decommit. The framework does
     *  this automatically on focus loss; call manually at level transitions or
     *  loading screens for faster memory recovery. */
    collectMemory: () => typeof __glyx_collect_memory !== "undefined" && __glyx_collect_memory(),
    /** Open an http(s)/mailto URL in the OS default app (browser). */
    openExternal: (url) => typeof __glyx_open_external !== "undefined" && __glyx_open_external(url)
  };
  glyxWindow.create = function create(opts = {}) {
    if (typeof __glyx_window_create === "undefined") return _noBinding("glyxWindow.create");
    return __glyx_window_create(JSON.stringify(opts)).then((idStr) => {
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
  glyxWindow.quit = function quit() {
    if (typeof __glyx_quit !== "undefined") __glyx_quit();
  };
  glyxWindow.restart = function restart() {
    if (typeof __glyx_restart !== "undefined") __glyx_restart();
  };
  glyxWindow.close = function close() {
    if (typeof __glyx_window_close !== "undefined") __glyx_window_close();
  };
  var _platformCache = null;
  glyxWindow.platform = function platform() {
    if (_platformCache !== null) return _platformCache;
    _platformCache = typeof __glyx_platform !== "undefined" ? __glyx_platform() : "unknown";
    return _platformCache;
  };
  glyxWindow.hideSplash = function hideSplash() {
    if (typeof __glyx_splash_hide !== "undefined") __glyx_splash_hide();
  };
  (function _installCrashHandlers() {
    function _report(data) {
      try {
        if (typeof __glyx_crash_report_js !== "undefined") {
          __glyx_crash_report_js(JSON.stringify(data));
        }
      } catch (_) {
      }
    }
    const prevOnerror = globalThis.onerror;
    globalThis.onerror = function(msg, src, line, col, err) {
      _report({
        type: "js_error",
        timestamp: Date.now(),
        message: String(msg || ""),
        source: String(src || ""),
        line: line || 0,
        col: col || 0,
        stack: err && err.stack ? String(err.stack) : ""
      });
      if (typeof prevOnerror === "function") prevOnerror(msg, src, line, col, err);
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
      if (typeof prevUnhandled === "function") prevUnhandled(event);
    };
  })();
  function _backendCall(cmd, args) {
    var json = args === void 0 ? "{}" : JSON.stringify(args);
    return __glyx_backend_call(cmd, json).then(function(raw) {
      try {
        return JSON.parse(raw);
      } catch (_) {
        return raw;
      }
    });
  }
  function _backendNs(prefix) {
    return new Proxy(function() {
    }, {
      get: function(_, fn) {
        if (typeof fn !== "string") return void 0;
        return function(args) {
          return _backendCall(prefix + "." + fn, args);
        };
      },
      apply: function(_, __, a) {
        return _backendCall(prefix, a[0]);
      }
    });
  }
  var backend = new Proxy(/* @__PURE__ */ Object.create(null), {
    get: function(_, name) {
      if (typeof name !== "string") return void 0;
      return _backendNs(name);
    }
  });
  var _videoCallbacks = /* @__PURE__ */ new Map();
  function _pollVideo() {
    if (typeof __glyx_video_poll === "undefined") return;
    const events = JSON.parse(__glyx_video_poll());
    for (const ev of events) {
      const cbs = _videoCallbacks.get(ev.id);
      if (!cbs) continue;
      if (ev.type === "ended" && cbs.onEnded) cbs.onEnded();
      else if (ev.type === "metadata" && cbs.onMetadata) cbs.onMetadata(ev);
      else if (ev.type === "timeupdate" && cbs.onTimeUpdate) cbs.onTimeUpdate(ev.currentTime);
      else if (ev.type === "error" && cbs.onError) cbs.onError(ev.message);
    }
  }
  var video = {
    /**
     * Open a video file or URL for playback.
     * @param {string} url
     * @param {{ onEnded?, onMetadata?, onTimeUpdate?, onError? }} opts
     * @returns {Promise<number>} Resolves with the video handle ID.
     */
    async open(url, { onEnded, onMetadata, onTimeUpdate, onError } = {}) {
      const handleId = parseInt(await __glyx_video_open(url));
      _videoCallbacks.set(handleId, { onEnded, onMetadata, onTimeUpdate, onError });
      return handleId;
    },
    /** Seek to `seconds`. */
    seek(handleId, seconds) {
      __glyx_video_seek(String(handleId), Math.max(0, seconds));
    },
    /** Set playback volume (0.0 = mute, 1.0 = normal, up to 2.0). */
    setVolume(handleId, volume) {
      __glyx_video_set_volume(String(handleId), volume);
    },
    /** Pause decode and audio threads. */
    pause(handleId) {
      __glyx_video_pause(String(handleId));
    },
    /** Resume after pause. */
    play(handleId) {
      __glyx_video_play(String(handleId));
    },
    /** Close and release the video handle. */
    close(handleId) {
      __glyx_video_close(String(handleId));
      _videoCallbacks.delete(handleId);
    }
  };

  // ../../js/packages/@glyx/react/src/core.js
  var import_react = __toESM(require_react(), 1);
  var View = ({ children, style, ...props }) => import_react.default.createElement("view", { style, ...props }, children);
  function Text({ children, style, showCursor, ...props }) {
    const text = Array.isArray(children) ? children.map((c) => c == null ? "" : String(c)).join("") : children == null ? "" : String(children);
    return import_react.default.createElement("text", { text, style, showCursor, ...props });
  }
  function Pressable({ children, onPress, onRightPress, onPressIn, onPressOut, onHoverIn, onHoverOut, disabled, feedback = true, style, ...props }) {
    const nodeIdRef = (0, import_react.useRef)(null);
    const handlersRef = (0, import_react.useRef)(null);
    const [pressed, setPressed] = (0, import_react.useState)(false);
    const [hovered, setHovered] = (0, import_react.useState)(false);
    handlersRef.current = {
      onPress: (e) => onPress?.(e),
      onRightPress: (e) => onRightPress?.(e),
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
    const onMount = (0, import_react.useCallback)((id) => {
      nodeIdRef.current = id;
      registerPressable(id, {
        onPress: (e) => handlersRef.current.onPress(e),
        onRightPress: (e) => handlersRef.current.onRightPress(e),
        onPressIn: () => handlersRef.current.onPressIn(),
        onPressOut: () => handlersRef.current.onPressOut(),
        onHoverIn: () => handlersRef.current.onHoverIn(),
        onHoverOut: () => handlersRef.current.onHoverOut()
      });
      registerDisabledNode(id, !!disabled);
    }, [disabled]);
    (0, import_react.useEffect)(() => {
      if (nodeIdRef.current !== null) {
        registerDisabledNode(nodeIdRef.current, !!disabled);
      }
      if (disabled) {
        setPressed(false);
        setHovered(false);
      }
    }, [disabled]);
    (0, import_react.useEffect)(() => {
      return () => {
        if (nodeIdRef.current !== null) {
          unregisterPressable(nodeIdRef.current);
          unregisterDisabledNode(nodeIdRef.current);
        }
      };
    }, []);
    const styleIsFn = typeof style === "function";
    const resolvedStyle = styleIsFn ? style({ pressed, hovered }) : style;
    const baseOpacity = resolvedStyle?.opacity ?? 1;
    const mergedStyle = !styleIsFn && feedback && pressed && !disabled ? { ...resolvedStyle, opacity: baseOpacity * 0.65 } : !styleIsFn && feedback && hovered && !disabled ? { ...resolvedStyle, opacity: baseOpacity * 0.85 } : resolvedStyle;
    return import_react.default.createElement(
      "view",
      // pressable:true tells the Rust drag-check that this node is interactive,
      // so glyxDraggable regions skip the window drag when this is under cursor.
      { _glyxOnMount: onMount, style: mergedStyle, pressable: true, ...props },
      children
    );
  }
  function useWindowSize() {
    const [size, setSize] = (0, import_react.useState)(() => {
      const s = typeof __glyx_getWindowSize !== "undefined" ? __glyx_getWindowSize() : null;
      return s ? { width: s.width, height: s.height } : { width: 0, height: 0 };
    });
    (0, import_react.useEffect)(() => {
      const handler = (s) => setSize(s);
      addWindowSizeListener(handler);
      return () => removeWindowSizeListener(handler);
    }, []);
    return size;
  }
  var _SelectionCtx = (0, import_react.createContext)(true);

  // ../../js/packages/@glyx/react/src/popover.js
  var import_react2 = __toESM(require_react(), 1);
  var _popoverNextId = 0;
  var _popoverStore = {
    current: null,
    // { id, x, y, h, width, contentH, render, onClose }
    listeners: /* @__PURE__ */ new Set(),
    open(p) {
      const id = ++_popoverNextId;
      this.current = { id, ...p };
      this._emit();
      return id;
    },
    close(id) {
      if (!this.current) return;
      if (id != null && this.current.id !== id) return;
      const cb = this.current.onClose;
      this.current = null;
      this._emit();
      if (cb) cb();
    },
    _emit() {
      for (const l of this.listeners) l();
    }
  };
  function PopoverHost() {
    const [, force] = (0, import_react2.useState)(0);
    const { width: winW, height: winH } = useWindowSize();
    (0, import_react2.useEffect)(() => {
      const l = () => force((n) => n + 1 | 0);
      _popoverStore.listeners.add(l);
      return () => {
        _popoverStore.listeners.delete(l);
      };
    }, []);
    const p = _popoverStore.current;
    if (!p) return null;
    const PAD = 4;
    const cw = p.width || 240;
    const ch = p.contentH || 200;
    const belowY = p.y + p.h + PAD;
    const flipUp = belowY + ch > winH && p.y - ch - PAD >= 0;
    const top = flipUp ? Math.max(4, p.y - ch - PAD) : belowY;
    const left = Math.max(4, Math.min(p.x, winW - cw - 4));
    return import_react2.default.createElement(
      Pressable,
      {
        // Full-screen backdrop — a click anywhere outside the content dismisses.
        // feedback:false — opacity feedback on a container multiplies through the
        // subtree, which made the whole popover dim on hover.
        onPress: () => _popoverStore.close(p.id),
        feedback: false,
        style: { position: "absolute", left: 0, top: 0, width: winW, height: winH, zIndex: 9e3 }
      },
      import_react2.default.createElement(Pressable, {
        onPress: () => {
        },
        // absorb clicks inside the popover so it doesn't dismiss
        feedback: false,
        style: { position: "absolute", left, top, width: cw, zIndex: 9001 }
      }, p.render(p.id))
    );
  }

  // ../../js/packages/@glyx/react/src/controls.js
  var import_react3 = __toESM(require_react(), 1);
  var SELECT_COLORS_DARK = {
    triggerBg: "#262b3f",
    triggerBgDisabled: "#1a1d2e",
    triggerBorder: "#3c4464",
    triggerBorderFocus: "#7aa2f7",
    triggerText: "#e7ecff",
    triggerPlaceholder: "#9aa0b6",
    // chevron: arrow icons on triggers and calendar nav — subtler than accent
    chevron: "#9aa0b6",
    dropdownBg: "#1e2235",
    dropdownBorder: "#3c4464",
    optionText: "#cdd6f4",
    optionSelectedText: "#7aa2f7",
    optionHoverBg: "#2a3048",
    optionSelectedBg: "#2e3555",
    optionCheck: "#7aa2f7",
    // calCellSelectedBg: accent for the selected day cell (keep as primary)
    calCellSelectedBg: "#7aa2f7",
    calCellSelectedText: "#1e1e2e",
    calDayName: "#6c7086"
  };
  var SelectColorsContext = import_react3.default.createContext(SELECT_COLORS_DARK);
  var _RadioCtx = import_react3.default.createContext(null);

  // ../../js/packages/@glyx/react/src/canvas.js
  var import_react4 = __toESM(require_react(), 1);
  function _parseColor(c) {
    if (Array.isArray(c)) return c;
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
  var _OP_CLEAR = 0;
  var _OP_FILLRECT = 1;
  var _OP_STROKERECT = 2;
  var _OP_FILLCIRCLE = 3;
  var _OP_STROKECIRCLE = 4;
  var _OP_STROKELINE = 5;
  var _OP_FILLTEXT = 6;
  var _OP_FILLPATH = 7;
  var _OP_STROKEPATH = 8;
  function _packColor(c) {
    const col = _parseColor(c);
    return (col[0] & 255 | (col[1] & 255) << 8 | (col[2] & 255) << 16 | (col[3] & 255) << 24) >>> 0;
  }
  var _canvasBin;
  function _canvasBinaryEnv() {
    if (_canvasBin !== void 0) return _canvasBin;
    const ok = typeof __glyx_canvas_protocol !== "undefined" && __glyx_canvas_protocol === "binary" && typeof __glyx_canvas_cmdbuf_f32 !== "undefined" && typeof __glyx_canvas_cmdbuf_u32 !== "undefined" && typeof __glyx_canvas_strbuf !== "undefined" && typeof __glyx_canvas_flush !== "undefined";
    _canvasBin = ok ? {
      f32: __glyx_canvas_cmdbuf_f32,
      u32: __glyx_canvas_cmdbuf_u32,
      str: __glyx_canvas_strbuf,
      cap: __glyx_canvas_cmdbuf_f32.length,
      strCap: __glyx_canvas_strbuf.length,
      enc: typeof TextEncoder !== "undefined" ? new TextEncoder() : null
    } : false;
    return _canvasBin;
  }
  var GlyxCanvasContext = class {
    constructor(nativeId) {
      this._id = nativeId;
      this._bin = _canvasBinaryEnv();
      this._cmds = [];
      this._fc = 0;
      this._sc = 0;
      this._firstChunk = true;
      this._path = [];
      this._pathClosed = false;
      this.fillStyle = [255, 255, 255, 255];
      this.strokeStyle = [255, 255, 255, 255];
      this.lineWidth = 1;
    }
    // Ensure `slots` f32 command slots are free; flush a continuation chunk if not.
    _ensure(slots) {
      if (this._fc + slots > this._bin.cap) this._flushChunk();
    }
    // Send the current buffer contents to Rust and reset cursors. The first chunk
    // of a frame replaces the canvas command list; overflow continuations append.
    _flushChunk() {
      const b = this._bin;
      try {
        __glyx_canvas_flush(this._id, b.f32, this._fc, b.str, this._sc, !this._firstChunk);
      } catch (e) {
        __glyx_log("[canvas] flush error: " + e);
      }
      this._firstChunk = false;
      this._fc = 0;
      this._sc = 0;
    }
    clear() {
      if (!this._bin) {
        this._cmds.length = 0;
        this._cmds.push({ type: "clear" });
        return;
      }
      this._fc = 0;
      this._sc = 0;
      this._firstChunk = true;
      this._bin.f32[0] = _OP_CLEAR;
      this._fc = 1;
    }
    fillRect(x, y, w, h) {
      if (!this._bin) {
        this._cmds.push({ type: "fillRect", x, y, w, h, color: _parseColor(this.fillStyle) });
        return;
      }
      this._ensure(6);
      const f = this._bin.f32, p = this._fc;
      f[p] = _OP_FILLRECT;
      f[p + 1] = x;
      f[p + 2] = y;
      f[p + 3] = w;
      f[p + 4] = h;
      this._bin.u32[p + 5] = _packColor(this.fillStyle);
      this._fc = p + 6;
    }
    strokeRect(x, y, w, h) {
      if (!this._bin) {
        this._cmds.push({ type: "strokeRect", x, y, w, h, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
        return;
      }
      this._ensure(7);
      const f = this._bin.f32, p = this._fc;
      f[p] = _OP_STROKERECT;
      f[p + 1] = x;
      f[p + 2] = y;
      f[p + 3] = w;
      f[p + 4] = h;
      this._bin.u32[p + 5] = _packColor(this.strokeStyle);
      f[p + 6] = this.lineWidth;
      this._fc = p + 7;
    }
    fillCircle(cx, cy, r) {
      if (!this._bin) {
        this._cmds.push({ type: "fillCircle", cx, cy, r, color: _parseColor(this.fillStyle) });
        return;
      }
      this._ensure(5);
      const f = this._bin.f32, p = this._fc;
      f[p] = _OP_FILLCIRCLE;
      f[p + 1] = cx;
      f[p + 2] = cy;
      f[p + 3] = r;
      this._bin.u32[p + 4] = _packColor(this.fillStyle);
      this._fc = p + 5;
    }
    strokeCircle(cx, cy, r) {
      if (!this._bin) {
        this._cmds.push({ type: "strokeCircle", cx, cy, r, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
        return;
      }
      this._ensure(6);
      const f = this._bin.f32, p = this._fc;
      f[p] = _OP_STROKECIRCLE;
      f[p + 1] = cx;
      f[p + 2] = cy;
      f[p + 3] = r;
      this._bin.u32[p + 4] = _packColor(this.strokeStyle);
      f[p + 5] = this.lineWidth;
      this._fc = p + 6;
    }
    strokeLine(x0, y0, x1, y1) {
      if (!this._bin) {
        this._cmds.push({ type: "strokeLine", x0, y0, x1, y1, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
        return;
      }
      this._ensure(7);
      const f = this._bin.f32, p = this._fc;
      f[p] = _OP_STROKELINE;
      f[p + 1] = x0;
      f[p + 2] = y0;
      f[p + 3] = x1;
      f[p + 4] = y1;
      this._bin.u32[p + 5] = _packColor(this.strokeStyle);
      f[p + 6] = this.lineWidth;
      this._fc = p + 7;
    }
    fillText(text, x, y, fontSize = 16) {
      if (!this._bin) {
        this._cmds.push({ type: "fillText", text: String(text), x, y, fontSize, color: _parseColor(this.fillStyle) });
        return;
      }
      const b = this._bin, s = String(text);
      if (this._fc + 7 > b.cap || this._sc + s.length * 4 > b.strCap) this._flushChunk();
      const off = this._sc;
      let len = 0;
      if (b.enc) {
        len = b.enc.encodeInto(s, b.str.subarray(this._sc)).written | 0;
      }
      this._sc += len;
      const f = b.f32, p = this._fc;
      f[p] = _OP_FILLTEXT;
      f[p + 1] = x;
      f[p + 2] = y;
      f[p + 3] = fontSize;
      b.u32[p + 4] = _packColor(this.fillStyle);
      f[p + 5] = off;
      f[p + 6] = len;
      this._fc = p + 7;
    }
    // ── Path API (canvas-like) ────────────────────────────────────────────────
    // Curves are tessellated to line segments in JS; the native side only deals
    // with polylines/polygons. Single subpath per begin→fill/stroke.
    beginPath() {
      this._path.length = 0;
      this._pathClosed = false;
    }
    moveTo(x, y) {
      this._path.push(x, y);
    }
    lineTo(x, y) {
      this._path.push(x, y);
    }
    closePath() {
      this._pathClosed = true;
    }
    /** Arc from `a0`→`a1` radians (set `ccw` for counter-clockwise). */
    arc(cx, cy, r, a0, a1, ccw = false) {
      let start = a0, end = a1;
      if (ccw && end > start) end -= Math.PI * 2;
      if (!ccw && end < start) end += Math.PI * 2;
      const sweep = Math.abs(end - start);
      const segs = Math.max(6, Math.ceil(sweep / (Math.PI / 16)));
      for (let i = 0; i <= segs; i++) {
        const t = start + (end - start) * (i / segs);
        this._path.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
      }
    }
    quadraticCurveTo(cpx, cpy, x, y) {
      const n = this._path.length;
      const x0 = n >= 2 ? this._path[n - 2] : cpx;
      const y0 = n >= 2 ? this._path[n - 1] : cpy;
      const segs = 16;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs, mt = 1 - t;
        this._path.push(
          mt * mt * x0 + 2 * mt * t * cpx + t * t * x,
          mt * mt * y0 + 2 * mt * t * cpy + t * t * y
        );
      }
    }
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      const n = this._path.length;
      const x0 = n >= 2 ? this._path[n - 2] : c1x;
      const y0 = n >= 2 ? this._path[n - 1] : c1y;
      const segs = 20;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs, mt = 1 - t;
        const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
        this._path.push(
          a * x0 + b * c1x + c * c2x + d * x,
          a * y0 + b * c1y + c * c2y + d * y
        );
      }
    }
    /** Fill the current path as a polygon (auto-closed). */
    fill() {
      if (this._path.length < 6) return;
      if (this._bin) {
        const count = this._path.length >> 1;
        const slots = 3 + this._path.length;
        if (slots > this._bin.cap) return;
        if (this._fc + slots > this._bin.cap) this._flushChunk();
        const f = this._bin.f32, p = this._fc;
        f[p] = _OP_FILLPATH;
        f[p + 1] = count;
        this._bin.u32[p + 2] = _packColor(this.fillStyle);
        const o = p + 3;
        for (let k = 0; k < this._path.length; k++) f[o + k] = this._path[k];
        this._fc = o + this._path.length;
      } else {
        this._cmds.push({ type: "fillPath", points: this._path.slice(), color: _parseColor(this.fillStyle) });
      }
    }
    /** Stroke the current path as a polyline (closed if `closePath()` was called). */
    stroke() {
      if (this._path.length < 4) return;
      if (this._bin) {
        const count = this._path.length >> 1;
        const slots = 5 + this._path.length;
        if (slots > this._bin.cap) return;
        if (this._fc + slots > this._bin.cap) this._flushChunk();
        const f = this._bin.f32, p = this._fc;
        f[p] = _OP_STROKEPATH;
        f[p + 1] = count;
        this._bin.u32[p + 2] = _packColor(this.strokeStyle);
        f[p + 3] = this.lineWidth;
        f[p + 4] = this._pathClosed ? 1 : 0;
        const o = p + 5;
        for (let k = 0; k < this._path.length; k++) f[o + k] = this._path[k];
        this._fc = o + this._path.length;
      } else {
        this._cmds.push({
          type: "strokePath",
          points: this._path.slice(),
          color: _parseColor(this.strokeStyle),
          lineWidth: this.lineWidth,
          closed: this._pathClosed
        });
      }
    }
    /** Send accumulated draw commands to the native layer. */
    flush() {
      if (this._bin) {
        this._flushChunk();
        this._firstChunk = true;
        return;
      }
      if (typeof __glyx_canvas_update === "undefined") {
        this._cmds.length = 0;
        return;
      }
      try {
        __glyx_canvas_update(this._id, JSON.stringify(this._cmds));
      } catch (e) {
        __glyx_log("[canvas] flush error: " + e);
      }
      this._cmds.length = 0;
    }
  };
  var Canvas = import_react4.default.forwardRef(function Canvas2({ style, ...props }, ref) {
    const ctxRef = (0, import_react4.useRef)(null);
    const nativeId = (0, import_react4.useRef)(null);
    const onMount = (0, import_react4.useCallback)((id) => {
      nativeId.current = id;
      const ctx = new GlyxCanvasContext(id);
      ctxRef.current = ctx;
      if (ref) {
        if (typeof ref === "function") ref(ctx);
        else ref.current = ctx;
      }
    }, [ref]);
    return import_react4.default.createElement("canvas", {
      _glyxOnMount: onMount,
      style,
      ...props
    });
  });
  var GlyxCanvas3DContext = class {
    constructor(nativeId) {
      this._id = nativeId;
    }
    updateScene(scene) {
      if (typeof __glyx_canvas3d_update === "undefined") return;
      try {
        __glyx_canvas3d_update(this._id, JSON.stringify(scene));
      } catch (e) {
        __glyx_log("[canvas3d] updateScene error: " + e);
      }
    }
    loadGltf(path) {
      if (typeof __glyx_canvas3d_load_gltf === "undefined") return;
      try {
        __glyx_canvas3d_load_gltf(this._id, path);
      } catch (e) {
        __glyx_log("[canvas3d] loadGltf error: " + e);
      }
    }
    unloadGltf(path) {
      if (typeof __glyx_canvas3d_unload_gltf === "undefined") return;
      __glyx_canvas3d_unload_gltf(path);
    }
  };
  var Canvas3D = import_react4.default.forwardRef(function Canvas3D2({ style, ...props }, ref) {
    const onMount = (0, import_react4.useCallback)((id) => {
      const ctx = new GlyxCanvas3DContext(id);
      if (ref) {
        if (typeof ref === "function") ref(ctx);
        else ref.current = ctx;
      }
    }, [ref]);
    return import_react4.default.createElement("canvas3d", {
      _glyxOnMount: onMount,
      style,
      ...props
    });
  });

  // ../../js/packages/@glyx/react/src/media.js
  var import_react5 = __toESM(require_react(), 1);
  var Camera = import_react5.default.forwardRef(function Camera2({ mirror, style, ...rest }, ref) {
    const [cameraHandle, setCameraHandle] = import_react5.default.useState(null);
    import_react5.default.useEffect(() => {
      return () => {
        if (cameraHandle !== null) {
          __glyx_camera_close(String(cameraHandle));
        }
      };
    }, [cameraHandle]);
    import_react5.default.useImperativeHandle(ref, () => ({
      /** @returns {number|null} current handle, or null if not open */
      get handle() {
        return cameraHandle;
      },
      async start(deviceIndex = 0) {
        const handle = parseInt(await __glyx_camera_open(deviceIndex));
        setCameraHandle(handle);
        return handle;
      },
      stop() {
        if (cameraHandle !== null) {
          __glyx_camera_close(String(cameraHandle));
          setCameraHandle(null);
        }
      },
      /** Capture current frame → PNG. @returns {Promise<string>} path */
      async capture() {
        if (cameraHandle === null) throw new Error("Camera not open");
        return __glyx_camera_capture(String(cameraHandle));
      },
      /** Start MP4 recording via ffmpeg. @param {string} outputPath */
      startRecord(outputPath) {
        if (cameraHandle === null) throw new Error("Camera not open");
        __glyx_camera_record_start(String(cameraHandle), outputPath);
      },
      /** Stop recording and flush MP4. @returns {Promise<string>} path */
      async stopRecord() {
        if (cameraHandle === null) throw new Error("Camera not open");
        return __glyx_camera_record_stop(String(cameraHandle));
      }
    }), [cameraHandle]);
    return import_react5.default.createElement("camera", {
      cameraHandle,
      mirror: mirror === true,
      style,
      ...rest
    });
  });
  var Video = import_react5.default.forwardRef(function Video2({ src, autoPlay = true, loop = false, onEnded, onMetadata, onTimeUpdate, onError, style, ...rest }, ref) {
    const [videoHandle, setVideoHandle] = import_react5.default.useState(null);
    const currentTimeRef = import_react5.default.useRef(0);
    const durationRef = import_react5.default.useRef(-1);
    import_react5.default.useEffect(() => {
      if (!src) return;
      let handle = null;
      let cancelled = false;
      currentTimeRef.current = 0;
      durationRef.current = -1;
      video.open(src, {
        onEnded: loop ? () => {
          if (handle !== null) video.seek(handle, 0);
        } : onEnded,
        onMetadata: (m) => {
          durationRef.current = m.durationSecs ?? -1;
          if (onMetadata) onMetadata(m);
        },
        onTimeUpdate: (t) => {
          currentTimeRef.current = t;
          if (onTimeUpdate) onTimeUpdate(t);
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
        if (onError) onError(e instanceof Error ? e.message : String(e));
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
    import_react5.default.useImperativeHandle(ref, () => ({
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
        if (videoHandle !== null) video.seek(videoHandle, seconds);
      },
      setVolume(vol) {
        if (videoHandle !== null) video.setVolume(videoHandle, vol);
      },
      pause() {
        if (videoHandle !== null) video.pause(videoHandle);
      },
      play() {
        if (videoHandle !== null) video.play(videoHandle);
      },
      close() {
        if (videoHandle !== null) {
          video.close(videoHandle);
          setVideoHandle(null);
        }
      }
    }), [videoHandle]);
    return import_react5.default.createElement("video", { videoHandle, style, ...rest });
  });

  // ../../js/packages/@glyx/react/src/index.js
  var GlyxReconciler = (0, import_react_reconciler.default)(hostConfig_default);
  var rootContainer = GlyxReconciler.createContainer(
    { isGlyxRoot: true },
    0,
    // LegacyRoot — synchronous rendering
    null,
    false,
    null,
    "",
    (err) => __glyx_log("[React] Recoverable error: " + err.message),
    null
  );
  globalThis.__glyx_frameCallback = function glyxFrameCallback() {
    GlyxReconciler.flushSync(() => {
      globalThis._glyxDrainTimers?.();
      _pollWebSockets();
      _pollIpc();
      _pollDeeplinks();
      _pollGamepads();
      _pollGlobalShortcuts();
      _pollPerfViolations();
      _pollLeakWarnings();
      _pollAudio();
      _pollVideo();
      _pollFsWatch();
      dispatchEvents();
    });
  };
  function render(element) {
    GlyxReconciler.updateContainer(
      import_react6.default.createElement(
        View,
        {
          style: { position: "relative", flexDirection: "column", flexGrow: 1, alignSelf: "stretch" }
        },
        element,
        import_react6.default.createElement(PopoverHost)
      ),
      rootContainer,
      null,
      null
    );
  }

  // js/app.jsx
  function App() {
    return /* @__PURE__ */ import_react7.default.createElement(
      View,
      {
        style: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f0f14"
        }
      },
      /* @__PURE__ */ import_react7.default.createElement(Text, { style: { fontSize: 32, fontWeight: "700", color: "#e8e8f0" } }, "Hello, World!")
    );
  }
  render(/* @__PURE__ */ import_react7.default.createElement(App, null));
})();
/*! Bundled license information:

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.production.min.js:
  (**
   * @license React
   * scheduler.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-reconciler/cjs/react-reconciler.production.min.js:
  (**
   * @license React
   * react-reconciler.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-reconciler/cjs/react-reconciler-constants.production.min.js:
  (**
   * @license React
   * react-reconciler-constants.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vcmVhY3RAMTguMy4xL25vZGVfbW9kdWxlcy9yZWFjdC9janMvcmVhY3QucHJvZHVjdGlvbi5taW4uanMiLCAiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vcmVhY3RAMTguMy4xL25vZGVfbW9kdWxlcy9yZWFjdC9pbmRleC5qcyIsICIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9zY2hlZHVsZXJAMC4yMy4yL25vZGVfbW9kdWxlcy9zY2hlZHVsZXIvY2pzL3NjaGVkdWxlci5wcm9kdWN0aW9uLm1pbi5qcyIsICIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9zY2hlZHVsZXJAMC4yMy4yL25vZGVfbW9kdWxlcy9zY2hlZHVsZXIvaW5kZXguanMiLCAiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vcmVhY3QtcmVjb25jaWxlckAwLjI5LjIrZjRlYWNlYmYyMDQxY2Q0Zi9ub2RlX21vZHVsZXMvcmVhY3QtcmVjb25jaWxlci9janMvcmVhY3QtcmVjb25jaWxlci5wcm9kdWN0aW9uLm1pbi5qcyIsICIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9yZWFjdC1yZWNvbmNpbGVyQDAuMjkuMitmNGVhY2ViZjIwNDFjZDRmL25vZGVfbW9kdWxlcy9yZWFjdC1yZWNvbmNpbGVyL2luZGV4LmpzIiwgIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3JlYWN0LXJlY29uY2lsZXJAMC4yOS4yK2Y0ZWFjZWJmMjA0MWNkNGYvbm9kZV9tb2R1bGVzL3JlYWN0LXJlY29uY2lsZXIvY2pzL3JlYWN0LXJlY29uY2lsZXItY29uc3RhbnRzLnByb2R1Y3Rpb24ubWluLmpzIiwgIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3JlYWN0LXJlY29uY2lsZXJAMC4yOS4yK2Y0ZWFjZWJmMjA0MWNkNGYvbm9kZV9tb2R1bGVzL3JlYWN0LXJlY29uY2lsZXIvY29uc3RhbnRzLmpzIiwgIi4uL2FwcC5qc3giLCAiLi4vLi4vLi4vLi4vanMvcGFja2FnZXMvQGdseXgvcmVhY3Qvc3JjL3BvbHlmaWxscy5qcyIsICIuLi8uLi8uLi8uLi9qcy9wYWNrYWdlcy9AZ2x5eC9yZWFjdC9zcmMvaW5kZXguanMiLCAiLi4vLi4vLi4vLi4vanMvcGFja2FnZXMvQGdseXgvcmVhY3Qvc3JjL2hvc3RDb25maWcuanMiLCAiLi4vLi4vLi4vLi4vanMvcGFja2FnZXMvQGdseXgvcmVhY3Qvc3JjL2V2ZW50cy5qcyIsICIuLi8uLi8uLi8uLi9qcy9wYWNrYWdlcy9AZ2x5eC9yZWFjdC9zcmMvYXBpLmpzIiwgIi4uLy4uLy4uLy4uL2pzL3BhY2thZ2VzL0BnbHl4L3JlYWN0L3NyYy9jb3JlLmpzIiwgIi4uLy4uLy4uLy4uL2pzL3BhY2thZ2VzL0BnbHl4L3JlYWN0L3NyYy9wb3BvdmVyLmpzIiwgIi4uLy4uLy4uLy4uL2pzL3BhY2thZ2VzL0BnbHl4L3JlYWN0L3NyYy9jb250cm9scy5qcyIsICIuLi8uLi8uLi8uLi9qcy9wYWNrYWdlcy9AZ2x5eC9yZWFjdC9zcmMvY2FudmFzLmpzIiwgIi4uLy4uLy4uLy4uL2pzL3BhY2thZ2VzL0BnbHl4L3JlYWN0L3NyYy9tZWRpYS5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBAbGljZW5zZSBSZWFjdFxuICogcmVhY3QucHJvZHVjdGlvbi5taW4uanNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZhY2Vib29rLCBJbmMuIGFuZCBpdHMgYWZmaWxpYXRlcy5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqL1xuJ3VzZSBzdHJpY3QnO3ZhciBsPVN5bWJvbC5mb3IoXCJyZWFjdC5lbGVtZW50XCIpLG49U3ltYm9sLmZvcihcInJlYWN0LnBvcnRhbFwiKSxwPVN5bWJvbC5mb3IoXCJyZWFjdC5mcmFnbWVudFwiKSxxPVN5bWJvbC5mb3IoXCJyZWFjdC5zdHJpY3RfbW9kZVwiKSxyPVN5bWJvbC5mb3IoXCJyZWFjdC5wcm9maWxlclwiKSx0PVN5bWJvbC5mb3IoXCJyZWFjdC5wcm92aWRlclwiKSx1PVN5bWJvbC5mb3IoXCJyZWFjdC5jb250ZXh0XCIpLHY9U3ltYm9sLmZvcihcInJlYWN0LmZvcndhcmRfcmVmXCIpLHc9U3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlXCIpLHg9U3ltYm9sLmZvcihcInJlYWN0Lm1lbW9cIikseT1TeW1ib2wuZm9yKFwicmVhY3QubGF6eVwiKSx6PVN5bWJvbC5pdGVyYXRvcjtmdW5jdGlvbiBBKGEpe2lmKG51bGw9PT1hfHxcIm9iamVjdFwiIT09dHlwZW9mIGEpcmV0dXJuIG51bGw7YT16JiZhW3pdfHxhW1wiQEBpdGVyYXRvclwiXTtyZXR1cm5cImZ1bmN0aW9uXCI9PT10eXBlb2YgYT9hOm51bGx9XG52YXIgQj17aXNNb3VudGVkOmZ1bmN0aW9uKCl7cmV0dXJuITF9LGVucXVldWVGb3JjZVVwZGF0ZTpmdW5jdGlvbigpe30sZW5xdWV1ZVJlcGxhY2VTdGF0ZTpmdW5jdGlvbigpe30sZW5xdWV1ZVNldFN0YXRlOmZ1bmN0aW9uKCl7fX0sQz1PYmplY3QuYXNzaWduLEQ9e307ZnVuY3Rpb24gRShhLGIsZSl7dGhpcy5wcm9wcz1hO3RoaXMuY29udGV4dD1iO3RoaXMucmVmcz1EO3RoaXMudXBkYXRlcj1lfHxCfUUucHJvdG90eXBlLmlzUmVhY3RDb21wb25lbnQ9e307XG5FLnByb3RvdHlwZS5zZXRTdGF0ZT1mdW5jdGlvbihhLGIpe2lmKFwib2JqZWN0XCIhPT10eXBlb2YgYSYmXCJmdW5jdGlvblwiIT09dHlwZW9mIGEmJm51bGwhPWEpdGhyb3cgRXJyb3IoXCJzZXRTdGF0ZSguLi4pOiB0YWtlcyBhbiBvYmplY3Qgb2Ygc3RhdGUgdmFyaWFibGVzIHRvIHVwZGF0ZSBvciBhIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYW4gb2JqZWN0IG9mIHN0YXRlIHZhcmlhYmxlcy5cIik7dGhpcy51cGRhdGVyLmVucXVldWVTZXRTdGF0ZSh0aGlzLGEsYixcInNldFN0YXRlXCIpfTtFLnByb3RvdHlwZS5mb3JjZVVwZGF0ZT1mdW5jdGlvbihhKXt0aGlzLnVwZGF0ZXIuZW5xdWV1ZUZvcmNlVXBkYXRlKHRoaXMsYSxcImZvcmNlVXBkYXRlXCIpfTtmdW5jdGlvbiBGKCl7fUYucHJvdG90eXBlPUUucHJvdG90eXBlO2Z1bmN0aW9uIEcoYSxiLGUpe3RoaXMucHJvcHM9YTt0aGlzLmNvbnRleHQ9Yjt0aGlzLnJlZnM9RDt0aGlzLnVwZGF0ZXI9ZXx8Qn12YXIgSD1HLnByb3RvdHlwZT1uZXcgRjtcbkguY29uc3RydWN0b3I9RztDKEgsRS5wcm90b3R5cGUpO0guaXNQdXJlUmVhY3RDb21wb25lbnQ9ITA7dmFyIEk9QXJyYXkuaXNBcnJheSxKPU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHksSz17Y3VycmVudDpudWxsfSxMPXtrZXk6ITAscmVmOiEwLF9fc2VsZjohMCxfX3NvdXJjZTohMH07XG5mdW5jdGlvbiBNKGEsYixlKXt2YXIgZCxjPXt9LGs9bnVsbCxoPW51bGw7aWYobnVsbCE9Yilmb3IoZCBpbiB2b2lkIDAhPT1iLnJlZiYmKGg9Yi5yZWYpLHZvaWQgMCE9PWIua2V5JiYoaz1cIlwiK2Iua2V5KSxiKUouY2FsbChiLGQpJiYhTC5oYXNPd25Qcm9wZXJ0eShkKSYmKGNbZF09YltkXSk7dmFyIGc9YXJndW1lbnRzLmxlbmd0aC0yO2lmKDE9PT1nKWMuY2hpbGRyZW49ZTtlbHNlIGlmKDE8Zyl7Zm9yKHZhciBmPUFycmF5KGcpLG09MDttPGc7bSsrKWZbbV09YXJndW1lbnRzW20rMl07Yy5jaGlsZHJlbj1mfWlmKGEmJmEuZGVmYXVsdFByb3BzKWZvcihkIGluIGc9YS5kZWZhdWx0UHJvcHMsZyl2b2lkIDA9PT1jW2RdJiYoY1tkXT1nW2RdKTtyZXR1cm57JCR0eXBlb2Y6bCx0eXBlOmEsa2V5OmsscmVmOmgscHJvcHM6Yyxfb3duZXI6Sy5jdXJyZW50fX1cbmZ1bmN0aW9uIE4oYSxiKXtyZXR1cm57JCR0eXBlb2Y6bCx0eXBlOmEudHlwZSxrZXk6YixyZWY6YS5yZWYscHJvcHM6YS5wcm9wcyxfb3duZXI6YS5fb3duZXJ9fWZ1bmN0aW9uIE8oYSl7cmV0dXJuXCJvYmplY3RcIj09PXR5cGVvZiBhJiZudWxsIT09YSYmYS4kJHR5cGVvZj09PWx9ZnVuY3Rpb24gZXNjYXBlKGEpe3ZhciBiPXtcIj1cIjpcIj0wXCIsXCI6XCI6XCI9MlwifTtyZXR1cm5cIiRcIithLnJlcGxhY2UoL1s9Ol0vZyxmdW5jdGlvbihhKXtyZXR1cm4gYlthXX0pfXZhciBQPS9cXC8rL2c7ZnVuY3Rpb24gUShhLGIpe3JldHVyblwib2JqZWN0XCI9PT10eXBlb2YgYSYmbnVsbCE9PWEmJm51bGwhPWEua2V5P2VzY2FwZShcIlwiK2Eua2V5KTpiLnRvU3RyaW5nKDM2KX1cbmZ1bmN0aW9uIFIoYSxiLGUsZCxjKXt2YXIgaz10eXBlb2YgYTtpZihcInVuZGVmaW5lZFwiPT09a3x8XCJib29sZWFuXCI9PT1rKWE9bnVsbDt2YXIgaD0hMTtpZihudWxsPT09YSloPSEwO2Vsc2Ugc3dpdGNoKGspe2Nhc2UgXCJzdHJpbmdcIjpjYXNlIFwibnVtYmVyXCI6aD0hMDticmVhaztjYXNlIFwib2JqZWN0XCI6c3dpdGNoKGEuJCR0eXBlb2Ype2Nhc2UgbDpjYXNlIG46aD0hMH19aWYoaClyZXR1cm4gaD1hLGM9YyhoKSxhPVwiXCI9PT1kP1wiLlwiK1EoaCwwKTpkLEkoYyk/KGU9XCJcIixudWxsIT1hJiYoZT1hLnJlcGxhY2UoUCxcIiQmL1wiKStcIi9cIiksUihjLGIsZSxcIlwiLGZ1bmN0aW9uKGEpe3JldHVybiBhfSkpOm51bGwhPWMmJihPKGMpJiYoYz1OKGMsZSsoIWMua2V5fHxoJiZoLmtleT09PWMua2V5P1wiXCI6KFwiXCIrYy5rZXkpLnJlcGxhY2UoUCxcIiQmL1wiKStcIi9cIikrYSkpLGIucHVzaChjKSksMTtoPTA7ZD1cIlwiPT09ZD9cIi5cIjpkK1wiOlwiO2lmKEkoYSkpZm9yKHZhciBnPTA7ZzxhLmxlbmd0aDtnKyspe2s9XG5hW2ddO3ZhciBmPWQrUShrLGcpO2grPVIoayxiLGUsZixjKX1lbHNlIGlmKGY9QShhKSxcImZ1bmN0aW9uXCI9PT10eXBlb2YgZilmb3IoYT1mLmNhbGwoYSksZz0wOyEoaz1hLm5leHQoKSkuZG9uZTspaz1rLnZhbHVlLGY9ZCtRKGssZysrKSxoKz1SKGssYixlLGYsYyk7ZWxzZSBpZihcIm9iamVjdFwiPT09ayl0aHJvdyBiPVN0cmluZyhhKSxFcnJvcihcIk9iamVjdHMgYXJlIG5vdCB2YWxpZCBhcyBhIFJlYWN0IGNoaWxkIChmb3VuZDogXCIrKFwiW29iamVjdCBPYmplY3RdXCI9PT1iP1wib2JqZWN0IHdpdGgga2V5cyB7XCIrT2JqZWN0LmtleXMoYSkuam9pbihcIiwgXCIpK1wifVwiOmIpK1wiKS4gSWYgeW91IG1lYW50IHRvIHJlbmRlciBhIGNvbGxlY3Rpb24gb2YgY2hpbGRyZW4sIHVzZSBhbiBhcnJheSBpbnN0ZWFkLlwiKTtyZXR1cm4gaH1cbmZ1bmN0aW9uIFMoYSxiLGUpe2lmKG51bGw9PWEpcmV0dXJuIGE7dmFyIGQ9W10sYz0wO1IoYSxkLFwiXCIsXCJcIixmdW5jdGlvbihhKXtyZXR1cm4gYi5jYWxsKGUsYSxjKyspfSk7cmV0dXJuIGR9ZnVuY3Rpb24gVChhKXtpZigtMT09PWEuX3N0YXR1cyl7dmFyIGI9YS5fcmVzdWx0O2I9YigpO2IudGhlbihmdW5jdGlvbihiKXtpZigwPT09YS5fc3RhdHVzfHwtMT09PWEuX3N0YXR1cylhLl9zdGF0dXM9MSxhLl9yZXN1bHQ9Yn0sZnVuY3Rpb24oYil7aWYoMD09PWEuX3N0YXR1c3x8LTE9PT1hLl9zdGF0dXMpYS5fc3RhdHVzPTIsYS5fcmVzdWx0PWJ9KTstMT09PWEuX3N0YXR1cyYmKGEuX3N0YXR1cz0wLGEuX3Jlc3VsdD1iKX1pZigxPT09YS5fc3RhdHVzKXJldHVybiBhLl9yZXN1bHQuZGVmYXVsdDt0aHJvdyBhLl9yZXN1bHQ7fVxudmFyIFU9e2N1cnJlbnQ6bnVsbH0sVj17dHJhbnNpdGlvbjpudWxsfSxXPXtSZWFjdEN1cnJlbnREaXNwYXRjaGVyOlUsUmVhY3RDdXJyZW50QmF0Y2hDb25maWc6VixSZWFjdEN1cnJlbnRPd25lcjpLfTtmdW5jdGlvbiBYKCl7dGhyb3cgRXJyb3IoXCJhY3QoLi4uKSBpcyBub3Qgc3VwcG9ydGVkIGluIHByb2R1Y3Rpb24gYnVpbGRzIG9mIFJlYWN0LlwiKTt9XG5leHBvcnRzLkNoaWxkcmVuPXttYXA6Uyxmb3JFYWNoOmZ1bmN0aW9uKGEsYixlKXtTKGEsZnVuY3Rpb24oKXtiLmFwcGx5KHRoaXMsYXJndW1lbnRzKX0sZSl9LGNvdW50OmZ1bmN0aW9uKGEpe3ZhciBiPTA7UyhhLGZ1bmN0aW9uKCl7YisrfSk7cmV0dXJuIGJ9LHRvQXJyYXk6ZnVuY3Rpb24oYSl7cmV0dXJuIFMoYSxmdW5jdGlvbihhKXtyZXR1cm4gYX0pfHxbXX0sb25seTpmdW5jdGlvbihhKXtpZighTyhhKSl0aHJvdyBFcnJvcihcIlJlYWN0LkNoaWxkcmVuLm9ubHkgZXhwZWN0ZWQgdG8gcmVjZWl2ZSBhIHNpbmdsZSBSZWFjdCBlbGVtZW50IGNoaWxkLlwiKTtyZXR1cm4gYX19O2V4cG9ydHMuQ29tcG9uZW50PUU7ZXhwb3J0cy5GcmFnbWVudD1wO2V4cG9ydHMuUHJvZmlsZXI9cjtleHBvcnRzLlB1cmVDb21wb25lbnQ9RztleHBvcnRzLlN0cmljdE1vZGU9cTtleHBvcnRzLlN1c3BlbnNlPXc7XG5leHBvcnRzLl9fU0VDUkVUX0lOVEVSTkFMU19ET19OT1RfVVNFX09SX1lPVV9XSUxMX0JFX0ZJUkVEPVc7ZXhwb3J0cy5hY3Q9WDtcbmV4cG9ydHMuY2xvbmVFbGVtZW50PWZ1bmN0aW9uKGEsYixlKXtpZihudWxsPT09YXx8dm9pZCAwPT09YSl0aHJvdyBFcnJvcihcIlJlYWN0LmNsb25lRWxlbWVudCguLi4pOiBUaGUgYXJndW1lbnQgbXVzdCBiZSBhIFJlYWN0IGVsZW1lbnQsIGJ1dCB5b3UgcGFzc2VkIFwiK2ErXCIuXCIpO3ZhciBkPUMoe30sYS5wcm9wcyksYz1hLmtleSxrPWEucmVmLGg9YS5fb3duZXI7aWYobnVsbCE9Yil7dm9pZCAwIT09Yi5yZWYmJihrPWIucmVmLGg9Sy5jdXJyZW50KTt2b2lkIDAhPT1iLmtleSYmKGM9XCJcIitiLmtleSk7aWYoYS50eXBlJiZhLnR5cGUuZGVmYXVsdFByb3BzKXZhciBnPWEudHlwZS5kZWZhdWx0UHJvcHM7Zm9yKGYgaW4gYilKLmNhbGwoYixmKSYmIUwuaGFzT3duUHJvcGVydHkoZikmJihkW2ZdPXZvaWQgMD09PWJbZl0mJnZvaWQgMCE9PWc/Z1tmXTpiW2ZdKX12YXIgZj1hcmd1bWVudHMubGVuZ3RoLTI7aWYoMT09PWYpZC5jaGlsZHJlbj1lO2Vsc2UgaWYoMTxmKXtnPUFycmF5KGYpO1xuZm9yKHZhciBtPTA7bTxmO20rKylnW21dPWFyZ3VtZW50c1ttKzJdO2QuY2hpbGRyZW49Z31yZXR1cm57JCR0eXBlb2Y6bCx0eXBlOmEudHlwZSxrZXk6YyxyZWY6ayxwcm9wczpkLF9vd25lcjpofX07ZXhwb3J0cy5jcmVhdGVDb250ZXh0PWZ1bmN0aW9uKGEpe2E9eyQkdHlwZW9mOnUsX2N1cnJlbnRWYWx1ZTphLF9jdXJyZW50VmFsdWUyOmEsX3RocmVhZENvdW50OjAsUHJvdmlkZXI6bnVsbCxDb25zdW1lcjpudWxsLF9kZWZhdWx0VmFsdWU6bnVsbCxfZ2xvYmFsTmFtZTpudWxsfTthLlByb3ZpZGVyPXskJHR5cGVvZjp0LF9jb250ZXh0OmF9O3JldHVybiBhLkNvbnN1bWVyPWF9O2V4cG9ydHMuY3JlYXRlRWxlbWVudD1NO2V4cG9ydHMuY3JlYXRlRmFjdG9yeT1mdW5jdGlvbihhKXt2YXIgYj1NLmJpbmQobnVsbCxhKTtiLnR5cGU9YTtyZXR1cm4gYn07ZXhwb3J0cy5jcmVhdGVSZWY9ZnVuY3Rpb24oKXtyZXR1cm57Y3VycmVudDpudWxsfX07XG5leHBvcnRzLmZvcndhcmRSZWY9ZnVuY3Rpb24oYSl7cmV0dXJueyQkdHlwZW9mOnYscmVuZGVyOmF9fTtleHBvcnRzLmlzVmFsaWRFbGVtZW50PU87ZXhwb3J0cy5sYXp5PWZ1bmN0aW9uKGEpe3JldHVybnskJHR5cGVvZjp5LF9wYXlsb2FkOntfc3RhdHVzOi0xLF9yZXN1bHQ6YX0sX2luaXQ6VH19O2V4cG9ydHMubWVtbz1mdW5jdGlvbihhLGIpe3JldHVybnskJHR5cGVvZjp4LHR5cGU6YSxjb21wYXJlOnZvaWQgMD09PWI/bnVsbDpifX07ZXhwb3J0cy5zdGFydFRyYW5zaXRpb249ZnVuY3Rpb24oYSl7dmFyIGI9Vi50cmFuc2l0aW9uO1YudHJhbnNpdGlvbj17fTt0cnl7YSgpfWZpbmFsbHl7Vi50cmFuc2l0aW9uPWJ9fTtleHBvcnRzLnVuc3RhYmxlX2FjdD1YO2V4cG9ydHMudXNlQ2FsbGJhY2s9ZnVuY3Rpb24oYSxiKXtyZXR1cm4gVS5jdXJyZW50LnVzZUNhbGxiYWNrKGEsYil9O2V4cG9ydHMudXNlQ29udGV4dD1mdW5jdGlvbihhKXtyZXR1cm4gVS5jdXJyZW50LnVzZUNvbnRleHQoYSl9O1xuZXhwb3J0cy51c2VEZWJ1Z1ZhbHVlPWZ1bmN0aW9uKCl7fTtleHBvcnRzLnVzZURlZmVycmVkVmFsdWU9ZnVuY3Rpb24oYSl7cmV0dXJuIFUuY3VycmVudC51c2VEZWZlcnJlZFZhbHVlKGEpfTtleHBvcnRzLnVzZUVmZmVjdD1mdW5jdGlvbihhLGIpe3JldHVybiBVLmN1cnJlbnQudXNlRWZmZWN0KGEsYil9O2V4cG9ydHMudXNlSWQ9ZnVuY3Rpb24oKXtyZXR1cm4gVS5jdXJyZW50LnVzZUlkKCl9O2V4cG9ydHMudXNlSW1wZXJhdGl2ZUhhbmRsZT1mdW5jdGlvbihhLGIsZSl7cmV0dXJuIFUuY3VycmVudC51c2VJbXBlcmF0aXZlSGFuZGxlKGEsYixlKX07ZXhwb3J0cy51c2VJbnNlcnRpb25FZmZlY3Q9ZnVuY3Rpb24oYSxiKXtyZXR1cm4gVS5jdXJyZW50LnVzZUluc2VydGlvbkVmZmVjdChhLGIpfTtleHBvcnRzLnVzZUxheW91dEVmZmVjdD1mdW5jdGlvbihhLGIpe3JldHVybiBVLmN1cnJlbnQudXNlTGF5b3V0RWZmZWN0KGEsYil9O1xuZXhwb3J0cy51c2VNZW1vPWZ1bmN0aW9uKGEsYil7cmV0dXJuIFUuY3VycmVudC51c2VNZW1vKGEsYil9O2V4cG9ydHMudXNlUmVkdWNlcj1mdW5jdGlvbihhLGIsZSl7cmV0dXJuIFUuY3VycmVudC51c2VSZWR1Y2VyKGEsYixlKX07ZXhwb3J0cy51c2VSZWY9ZnVuY3Rpb24oYSl7cmV0dXJuIFUuY3VycmVudC51c2VSZWYoYSl9O2V4cG9ydHMudXNlU3RhdGU9ZnVuY3Rpb24oYSl7cmV0dXJuIFUuY3VycmVudC51c2VTdGF0ZShhKX07ZXhwb3J0cy51c2VTeW5jRXh0ZXJuYWxTdG9yZT1mdW5jdGlvbihhLGIsZSl7cmV0dXJuIFUuY3VycmVudC51c2VTeW5jRXh0ZXJuYWxTdG9yZShhLGIsZSl9O2V4cG9ydHMudXNlVHJhbnNpdGlvbj1mdW5jdGlvbigpe3JldHVybiBVLmN1cnJlbnQudXNlVHJhbnNpdGlvbigpfTtleHBvcnRzLnZlcnNpb249XCIxOC4zLjFcIjtcbiIsICIndXNlIHN0cmljdCc7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QucHJvZHVjdGlvbi5taW4uanMnKTtcbn0gZWxzZSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QuZGV2ZWxvcG1lbnQuanMnKTtcbn1cbiIsICIvKipcbiAqIEBsaWNlbnNlIFJlYWN0XG4gKiBzY2hlZHVsZXIucHJvZHVjdGlvbi5taW4uanNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZhY2Vib29rLCBJbmMuIGFuZCBpdHMgYWZmaWxpYXRlcy5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqL1xuJ3VzZSBzdHJpY3QnO2Z1bmN0aW9uIGYoYSxiKXt2YXIgYz1hLmxlbmd0aDthLnB1c2goYik7YTpmb3IoOzA8Yzspe3ZhciBkPWMtMT4+PjEsZT1hW2RdO2lmKDA8ZyhlLGIpKWFbZF09YixhW2NdPWUsYz1kO2Vsc2UgYnJlYWsgYX19ZnVuY3Rpb24gaChhKXtyZXR1cm4gMD09PWEubGVuZ3RoP251bGw6YVswXX1mdW5jdGlvbiBrKGEpe2lmKDA9PT1hLmxlbmd0aClyZXR1cm4gbnVsbDt2YXIgYj1hWzBdLGM9YS5wb3AoKTtpZihjIT09Yil7YVswXT1jO2E6Zm9yKHZhciBkPTAsZT1hLmxlbmd0aCx3PWU+Pj4xO2Q8dzspe3ZhciBtPTIqKGQrMSktMSxDPWFbbV0sbj1tKzEseD1hW25dO2lmKDA+ZyhDLGMpKW48ZSYmMD5nKHgsQyk/KGFbZF09eCxhW25dPWMsZD1uKTooYVtkXT1DLGFbbV09YyxkPW0pO2Vsc2UgaWYobjxlJiYwPmcoeCxjKSlhW2RdPXgsYVtuXT1jLGQ9bjtlbHNlIGJyZWFrIGF9fXJldHVybiBifVxuZnVuY3Rpb24gZyhhLGIpe3ZhciBjPWEuc29ydEluZGV4LWIuc29ydEluZGV4O3JldHVybiAwIT09Yz9jOmEuaWQtYi5pZH1pZihcIm9iamVjdFwiPT09dHlwZW9mIHBlcmZvcm1hbmNlJiZcImZ1bmN0aW9uXCI9PT10eXBlb2YgcGVyZm9ybWFuY2Uubm93KXt2YXIgbD1wZXJmb3JtYW5jZTtleHBvcnRzLnVuc3RhYmxlX25vdz1mdW5jdGlvbigpe3JldHVybiBsLm5vdygpfX1lbHNle3ZhciBwPURhdGUscT1wLm5vdygpO2V4cG9ydHMudW5zdGFibGVfbm93PWZ1bmN0aW9uKCl7cmV0dXJuIHAubm93KCktcX19dmFyIHI9W10sdD1bXSx1PTEsdj1udWxsLHk9Myx6PSExLEE9ITEsQj0hMSxEPVwiZnVuY3Rpb25cIj09PXR5cGVvZiBzZXRUaW1lb3V0P3NldFRpbWVvdXQ6bnVsbCxFPVwiZnVuY3Rpb25cIj09PXR5cGVvZiBjbGVhclRpbWVvdXQ/Y2xlYXJUaW1lb3V0Om51bGwsRj1cInVuZGVmaW5lZFwiIT09dHlwZW9mIHNldEltbWVkaWF0ZT9zZXRJbW1lZGlhdGU6bnVsbDtcblwidW5kZWZpbmVkXCIhPT10eXBlb2YgbmF2aWdhdG9yJiZ2b2lkIDAhPT1uYXZpZ2F0b3Iuc2NoZWR1bGluZyYmdm9pZCAwIT09bmF2aWdhdG9yLnNjaGVkdWxpbmcuaXNJbnB1dFBlbmRpbmcmJm5hdmlnYXRvci5zY2hlZHVsaW5nLmlzSW5wdXRQZW5kaW5nLmJpbmQobmF2aWdhdG9yLnNjaGVkdWxpbmcpO2Z1bmN0aW9uIEcoYSl7Zm9yKHZhciBiPWgodCk7bnVsbCE9PWI7KXtpZihudWxsPT09Yi5jYWxsYmFjaylrKHQpO2Vsc2UgaWYoYi5zdGFydFRpbWU8PWEpayh0KSxiLnNvcnRJbmRleD1iLmV4cGlyYXRpb25UaW1lLGYocixiKTtlbHNlIGJyZWFrO2I9aCh0KX19ZnVuY3Rpb24gSChhKXtCPSExO0coYSk7aWYoIUEpaWYobnVsbCE9PWgocikpQT0hMCxJKEopO2Vsc2V7dmFyIGI9aCh0KTtudWxsIT09YiYmSyhILGIuc3RhcnRUaW1lLWEpfX1cbmZ1bmN0aW9uIEooYSxiKXtBPSExO0ImJihCPSExLEUoTCksTD0tMSk7ej0hMDt2YXIgYz15O3RyeXtHKGIpO2Zvcih2PWgocik7bnVsbCE9PXYmJighKHYuZXhwaXJhdGlvblRpbWU+Yil8fGEmJiFNKCkpOyl7dmFyIGQ9di5jYWxsYmFjaztpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgZCl7di5jYWxsYmFjaz1udWxsO3k9di5wcmlvcml0eUxldmVsO3ZhciBlPWQodi5leHBpcmF0aW9uVGltZTw9Yik7Yj1leHBvcnRzLnVuc3RhYmxlX25vdygpO1wiZnVuY3Rpb25cIj09PXR5cGVvZiBlP3YuY2FsbGJhY2s9ZTp2PT09aChyKSYmayhyKTtHKGIpfWVsc2UgayhyKTt2PWgocil9aWYobnVsbCE9PXYpdmFyIHc9ITA7ZWxzZXt2YXIgbT1oKHQpO251bGwhPT1tJiZLKEgsbS5zdGFydFRpbWUtYik7dz0hMX1yZXR1cm4gd31maW5hbGx5e3Y9bnVsbCx5PWMsej0hMX19dmFyIE49ITEsTz1udWxsLEw9LTEsUD01LFE9LTE7XG5mdW5jdGlvbiBNKCl7cmV0dXJuIGV4cG9ydHMudW5zdGFibGVfbm93KCktUTxQPyExOiEwfWZ1bmN0aW9uIFIoKXtpZihudWxsIT09Tyl7dmFyIGE9ZXhwb3J0cy51bnN0YWJsZV9ub3coKTtRPWE7dmFyIGI9ITA7dHJ5e2I9TyghMCxhKX1maW5hbGx5e2I/UygpOihOPSExLE89bnVsbCl9fWVsc2UgTj0hMX12YXIgUztpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgRilTPWZ1bmN0aW9uKCl7RihSKX07ZWxzZSBpZihcInVuZGVmaW5lZFwiIT09dHlwZW9mIE1lc3NhZ2VDaGFubmVsKXt2YXIgVD1uZXcgTWVzc2FnZUNoYW5uZWwsVT1ULnBvcnQyO1QucG9ydDEub25tZXNzYWdlPVI7Uz1mdW5jdGlvbigpe1UucG9zdE1lc3NhZ2UobnVsbCl9fWVsc2UgUz1mdW5jdGlvbigpe0QoUiwwKX07ZnVuY3Rpb24gSShhKXtPPWE7Tnx8KE49ITAsUygpKX1mdW5jdGlvbiBLKGEsYil7TD1EKGZ1bmN0aW9uKCl7YShleHBvcnRzLnVuc3RhYmxlX25vdygpKX0sYil9XG5leHBvcnRzLnVuc3RhYmxlX0lkbGVQcmlvcml0eT01O2V4cG9ydHMudW5zdGFibGVfSW1tZWRpYXRlUHJpb3JpdHk9MTtleHBvcnRzLnVuc3RhYmxlX0xvd1ByaW9yaXR5PTQ7ZXhwb3J0cy51bnN0YWJsZV9Ob3JtYWxQcmlvcml0eT0zO2V4cG9ydHMudW5zdGFibGVfUHJvZmlsaW5nPW51bGw7ZXhwb3J0cy51bnN0YWJsZV9Vc2VyQmxvY2tpbmdQcmlvcml0eT0yO2V4cG9ydHMudW5zdGFibGVfY2FuY2VsQ2FsbGJhY2s9ZnVuY3Rpb24oYSl7YS5jYWxsYmFjaz1udWxsfTtleHBvcnRzLnVuc3RhYmxlX2NvbnRpbnVlRXhlY3V0aW9uPWZ1bmN0aW9uKCl7QXx8enx8KEE9ITAsSShKKSl9O1xuZXhwb3J0cy51bnN0YWJsZV9mb3JjZUZyYW1lUmF0ZT1mdW5jdGlvbihhKXswPmF8fDEyNTxhP2NvbnNvbGUuZXJyb3IoXCJmb3JjZUZyYW1lUmF0ZSB0YWtlcyBhIHBvc2l0aXZlIGludCBiZXR3ZWVuIDAgYW5kIDEyNSwgZm9yY2luZyBmcmFtZSByYXRlcyBoaWdoZXIgdGhhbiAxMjUgZnBzIGlzIG5vdCBzdXBwb3J0ZWRcIik6UD0wPGE/TWF0aC5mbG9vcigxRTMvYSk6NX07ZXhwb3J0cy51bnN0YWJsZV9nZXRDdXJyZW50UHJpb3JpdHlMZXZlbD1mdW5jdGlvbigpe3JldHVybiB5fTtleHBvcnRzLnVuc3RhYmxlX2dldEZpcnN0Q2FsbGJhY2tOb2RlPWZ1bmN0aW9uKCl7cmV0dXJuIGgocil9O2V4cG9ydHMudW5zdGFibGVfbmV4dD1mdW5jdGlvbihhKXtzd2l0Y2goeSl7Y2FzZSAxOmNhc2UgMjpjYXNlIDM6dmFyIGI9MzticmVhaztkZWZhdWx0OmI9eX12YXIgYz15O3k9Yjt0cnl7cmV0dXJuIGEoKX1maW5hbGx5e3k9Y319O2V4cG9ydHMudW5zdGFibGVfcGF1c2VFeGVjdXRpb249ZnVuY3Rpb24oKXt9O1xuZXhwb3J0cy51bnN0YWJsZV9yZXF1ZXN0UGFpbnQ9ZnVuY3Rpb24oKXt9O2V4cG9ydHMudW5zdGFibGVfcnVuV2l0aFByaW9yaXR5PWZ1bmN0aW9uKGEsYil7c3dpdGNoKGEpe2Nhc2UgMTpjYXNlIDI6Y2FzZSAzOmNhc2UgNDpjYXNlIDU6YnJlYWs7ZGVmYXVsdDphPTN9dmFyIGM9eTt5PWE7dHJ5e3JldHVybiBiKCl9ZmluYWxseXt5PWN9fTtcbmV4cG9ydHMudW5zdGFibGVfc2NoZWR1bGVDYWxsYmFjaz1mdW5jdGlvbihhLGIsYyl7dmFyIGQ9ZXhwb3J0cy51bnN0YWJsZV9ub3coKTtcIm9iamVjdFwiPT09dHlwZW9mIGMmJm51bGwhPT1jPyhjPWMuZGVsYXksYz1cIm51bWJlclwiPT09dHlwZW9mIGMmJjA8Yz9kK2M6ZCk6Yz1kO3N3aXRjaChhKXtjYXNlIDE6dmFyIGU9LTE7YnJlYWs7Y2FzZSAyOmU9MjUwO2JyZWFrO2Nhc2UgNTplPTEwNzM3NDE4MjM7YnJlYWs7Y2FzZSA0OmU9MUU0O2JyZWFrO2RlZmF1bHQ6ZT01RTN9ZT1jK2U7YT17aWQ6dSsrLGNhbGxiYWNrOmIscHJpb3JpdHlMZXZlbDphLHN0YXJ0VGltZTpjLGV4cGlyYXRpb25UaW1lOmUsc29ydEluZGV4Oi0xfTtjPmQ/KGEuc29ydEluZGV4PWMsZih0LGEpLG51bGw9PT1oKHIpJiZhPT09aCh0KSYmKEI/KEUoTCksTD0tMSk6Qj0hMCxLKEgsYy1kKSkpOihhLnNvcnRJbmRleD1lLGYocixhKSxBfHx6fHwoQT0hMCxJKEopKSk7cmV0dXJuIGF9O1xuZXhwb3J0cy51bnN0YWJsZV9zaG91bGRZaWVsZD1NO2V4cG9ydHMudW5zdGFibGVfd3JhcENhbGxiYWNrPWZ1bmN0aW9uKGEpe3ZhciBiPXk7cmV0dXJuIGZ1bmN0aW9uKCl7dmFyIGM9eTt5PWI7dHJ5e3JldHVybiBhLmFwcGx5KHRoaXMsYXJndW1lbnRzKX1maW5hbGx5e3k9Y319fTtcbiIsICIndXNlIHN0cmljdCc7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvc2NoZWR1bGVyLnByb2R1Y3Rpb24ubWluLmpzJyk7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3NjaGVkdWxlci5kZXZlbG9wbWVudC5qcycpO1xufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgUmVhY3RcbiAqIHJlYWN0LXJlY29uY2lsZXIucHJvZHVjdGlvbi5taW4uanNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZhY2Vib29rLCBJbmMuIGFuZCBpdHMgYWZmaWxpYXRlcy5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAkJCRyZWNvbmNpbGVyKCQkJGhvc3RDb25maWcpIHtcbiAgICB2YXIgZXhwb3J0cyA9IHt9O1xuJ3VzZSBzdHJpY3QnO3ZhciBhYT1yZXF1aXJlKFwicmVhY3RcIiksYmE9cmVxdWlyZShcInNjaGVkdWxlclwiKSxjYT1PYmplY3QuYXNzaWduO2Z1bmN0aW9uIG4oYSl7Zm9yKHZhciBiPVwiaHR0cHM6Ly9yZWFjdGpzLm9yZy9kb2NzL2Vycm9yLWRlY29kZXIuaHRtbD9pbnZhcmlhbnQ9XCIrYSxjPTE7Yzxhcmd1bWVudHMubGVuZ3RoO2MrKyliKz1cIiZhcmdzW109XCIrZW5jb2RlVVJJQ29tcG9uZW50KGFyZ3VtZW50c1tjXSk7cmV0dXJuXCJNaW5pZmllZCBSZWFjdCBlcnJvciAjXCIrYStcIjsgdmlzaXQgXCIrYitcIiBmb3IgdGhlIGZ1bGwgbWVzc2FnZSBvciB1c2UgdGhlIG5vbi1taW5pZmllZCBkZXYgZW52aXJvbm1lbnQgZm9yIGZ1bGwgZXJyb3JzIGFuZCBhZGRpdGlvbmFsIGhlbHBmdWwgd2FybmluZ3MuXCJ9XG52YXIgZGE9YWEuX19TRUNSRVRfSU5URVJOQUxTX0RPX05PVF9VU0VfT1JfWU9VX1dJTExfQkVfRklSRUQsZWE9U3ltYm9sLmZvcihcInJlYWN0LmVsZW1lbnRcIiksZmE9U3ltYm9sLmZvcihcInJlYWN0LnBvcnRhbFwiKSxoYT1TeW1ib2wuZm9yKFwicmVhY3QuZnJhZ21lbnRcIiksaWE9U3ltYm9sLmZvcihcInJlYWN0LnN0cmljdF9tb2RlXCIpLGphPVN5bWJvbC5mb3IoXCJyZWFjdC5wcm9maWxlclwiKSxrYT1TeW1ib2wuZm9yKFwicmVhY3QucHJvdmlkZXJcIiksbGE9U3ltYm9sLmZvcihcInJlYWN0LmNvbnRleHRcIiksbWE9U3ltYm9sLmZvcihcInJlYWN0LmZvcndhcmRfcmVmXCIpLG5hPVN5bWJvbC5mb3IoXCJyZWFjdC5zdXNwZW5zZVwiKSxvYT1TeW1ib2wuZm9yKFwicmVhY3Quc3VzcGVuc2VfbGlzdFwiKSxwYT1TeW1ib2wuZm9yKFwicmVhY3QubWVtb1wiKSxxYT1TeW1ib2wuZm9yKFwicmVhY3QubGF6eVwiKTtTeW1ib2wuZm9yKFwicmVhY3Quc2NvcGVcIik7U3ltYm9sLmZvcihcInJlYWN0LmRlYnVnX3RyYWNlX21vZGVcIik7XG52YXIgcmE9U3ltYm9sLmZvcihcInJlYWN0Lm9mZnNjcmVlblwiKTtTeW1ib2wuZm9yKFwicmVhY3QubGVnYWN5X2hpZGRlblwiKTtTeW1ib2wuZm9yKFwicmVhY3QuY2FjaGVcIik7U3ltYm9sLmZvcihcInJlYWN0LnRyYWNpbmdfbWFya2VyXCIpO3ZhciBzYT1TeW1ib2wuaXRlcmF0b3I7ZnVuY3Rpb24gdGEoYSl7aWYobnVsbD09PWF8fFwib2JqZWN0XCIhPT10eXBlb2YgYSlyZXR1cm4gbnVsbDthPXNhJiZhW3NhXXx8YVtcIkBAaXRlcmF0b3JcIl07cmV0dXJuXCJmdW5jdGlvblwiPT09dHlwZW9mIGE/YTpudWxsfVxuZnVuY3Rpb24gdWEoYSl7aWYobnVsbD09YSlyZXR1cm4gbnVsbDtpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgYSlyZXR1cm4gYS5kaXNwbGF5TmFtZXx8YS5uYW1lfHxudWxsO2lmKFwic3RyaW5nXCI9PT10eXBlb2YgYSlyZXR1cm4gYTtzd2l0Y2goYSl7Y2FzZSBoYTpyZXR1cm5cIkZyYWdtZW50XCI7Y2FzZSBmYTpyZXR1cm5cIlBvcnRhbFwiO2Nhc2UgamE6cmV0dXJuXCJQcm9maWxlclwiO2Nhc2UgaWE6cmV0dXJuXCJTdHJpY3RNb2RlXCI7Y2FzZSBuYTpyZXR1cm5cIlN1c3BlbnNlXCI7Y2FzZSBvYTpyZXR1cm5cIlN1c3BlbnNlTGlzdFwifWlmKFwib2JqZWN0XCI9PT10eXBlb2YgYSlzd2l0Y2goYS4kJHR5cGVvZil7Y2FzZSBsYTpyZXR1cm4oYS5kaXNwbGF5TmFtZXx8XCJDb250ZXh0XCIpK1wiLkNvbnN1bWVyXCI7Y2FzZSBrYTpyZXR1cm4oYS5fY29udGV4dC5kaXNwbGF5TmFtZXx8XCJDb250ZXh0XCIpK1wiLlByb3ZpZGVyXCI7Y2FzZSBtYTp2YXIgYj1hLnJlbmRlcjthPWEuZGlzcGxheU5hbWU7YXx8KGE9Yi5kaXNwbGF5TmFtZXx8XG5iLm5hbWV8fFwiXCIsYT1cIlwiIT09YT9cIkZvcndhcmRSZWYoXCIrYStcIilcIjpcIkZvcndhcmRSZWZcIik7cmV0dXJuIGE7Y2FzZSBwYTpyZXR1cm4gYj1hLmRpc3BsYXlOYW1lfHxudWxsLG51bGwhPT1iP2I6dWEoYS50eXBlKXx8XCJNZW1vXCI7Y2FzZSBxYTpiPWEuX3BheWxvYWQ7YT1hLl9pbml0O3RyeXtyZXR1cm4gdWEoYShiKSl9Y2F0Y2goYyl7fX1yZXR1cm4gbnVsbH1cbmZ1bmN0aW9uIHZhKGEpe3ZhciBiPWEudHlwZTtzd2l0Y2goYS50YWcpe2Nhc2UgMjQ6cmV0dXJuXCJDYWNoZVwiO2Nhc2UgOTpyZXR1cm4oYi5kaXNwbGF5TmFtZXx8XCJDb250ZXh0XCIpK1wiLkNvbnN1bWVyXCI7Y2FzZSAxMDpyZXR1cm4oYi5fY29udGV4dC5kaXNwbGF5TmFtZXx8XCJDb250ZXh0XCIpK1wiLlByb3ZpZGVyXCI7Y2FzZSAxODpyZXR1cm5cIkRlaHlkcmF0ZWRGcmFnbWVudFwiO2Nhc2UgMTE6cmV0dXJuIGE9Yi5yZW5kZXIsYT1hLmRpc3BsYXlOYW1lfHxhLm5hbWV8fFwiXCIsYi5kaXNwbGF5TmFtZXx8KFwiXCIhPT1hP1wiRm9yd2FyZFJlZihcIithK1wiKVwiOlwiRm9yd2FyZFJlZlwiKTtjYXNlIDc6cmV0dXJuXCJGcmFnbWVudFwiO2Nhc2UgNTpyZXR1cm4gYjtjYXNlIDQ6cmV0dXJuXCJQb3J0YWxcIjtjYXNlIDM6cmV0dXJuXCJSb290XCI7Y2FzZSA2OnJldHVyblwiVGV4dFwiO2Nhc2UgMTY6cmV0dXJuIHVhKGIpO2Nhc2UgODpyZXR1cm4gYj09PWlhP1wiU3RyaWN0TW9kZVwiOlwiTW9kZVwiO2Nhc2UgMjI6cmV0dXJuXCJPZmZzY3JlZW5cIjtcbmNhc2UgMTI6cmV0dXJuXCJQcm9maWxlclwiO2Nhc2UgMjE6cmV0dXJuXCJTY29wZVwiO2Nhc2UgMTM6cmV0dXJuXCJTdXNwZW5zZVwiO2Nhc2UgMTk6cmV0dXJuXCJTdXNwZW5zZUxpc3RcIjtjYXNlIDI1OnJldHVyblwiVHJhY2luZ01hcmtlclwiO2Nhc2UgMTpjYXNlIDA6Y2FzZSAxNzpjYXNlIDI6Y2FzZSAxNDpjYXNlIDE1OmlmKFwiZnVuY3Rpb25cIj09PXR5cGVvZiBiKXJldHVybiBiLmRpc3BsYXlOYW1lfHxiLm5hbWV8fG51bGw7aWYoXCJzdHJpbmdcIj09PXR5cGVvZiBiKXJldHVybiBifXJldHVybiBudWxsfWZ1bmN0aW9uIHdhKGEpe3ZhciBiPWEsYz1hO2lmKGEuYWx0ZXJuYXRlKWZvcig7Yi5yZXR1cm47KWI9Yi5yZXR1cm47ZWxzZXthPWI7ZG8gYj1hLDAhPT0oYi5mbGFncyY0MDk4KSYmKGM9Yi5yZXR1cm4pLGE9Yi5yZXR1cm47d2hpbGUoYSl9cmV0dXJuIDM9PT1iLnRhZz9jOm51bGx9ZnVuY3Rpb24geGEoYSl7aWYod2EoYSkhPT1hKXRocm93IEVycm9yKG4oMTg4KSk7fVxuZnVuY3Rpb24gemEoYSl7dmFyIGI9YS5hbHRlcm5hdGU7aWYoIWIpe2I9d2EoYSk7aWYobnVsbD09PWIpdGhyb3cgRXJyb3IobigxODgpKTtyZXR1cm4gYiE9PWE/bnVsbDphfWZvcih2YXIgYz1hLGQ9Yjs7KXt2YXIgZT1jLnJldHVybjtpZihudWxsPT09ZSlicmVhazt2YXIgZj1lLmFsdGVybmF0ZTtpZihudWxsPT09Zil7ZD1lLnJldHVybjtpZihudWxsIT09ZCl7Yz1kO2NvbnRpbnVlfWJyZWFrfWlmKGUuY2hpbGQ9PT1mLmNoaWxkKXtmb3IoZj1lLmNoaWxkO2Y7KXtpZihmPT09YylyZXR1cm4geGEoZSksYTtpZihmPT09ZClyZXR1cm4geGEoZSksYjtmPWYuc2libGluZ310aHJvdyBFcnJvcihuKDE4OCkpO31pZihjLnJldHVybiE9PWQucmV0dXJuKWM9ZSxkPWY7ZWxzZXtmb3IodmFyIGc9ITEsaD1lLmNoaWxkO2g7KXtpZihoPT09Yyl7Zz0hMDtjPWU7ZD1mO2JyZWFrfWlmKGg9PT1kKXtnPSEwO2Q9ZTtjPWY7YnJlYWt9aD1oLnNpYmxpbmd9aWYoIWcpe2ZvcihoPWYuY2hpbGQ7aDspe2lmKGg9PT1cbmMpe2c9ITA7Yz1mO2Q9ZTticmVha31pZihoPT09ZCl7Zz0hMDtkPWY7Yz1lO2JyZWFrfWg9aC5zaWJsaW5nfWlmKCFnKXRocm93IEVycm9yKG4oMTg5KSk7fX1pZihjLmFsdGVybmF0ZSE9PWQpdGhyb3cgRXJyb3IobigxOTApKTt9aWYoMyE9PWMudGFnKXRocm93IEVycm9yKG4oMTg4KSk7cmV0dXJuIGMuc3RhdGVOb2RlLmN1cnJlbnQ9PT1jP2E6Yn1mdW5jdGlvbiBBYShhKXthPXphKGEpO3JldHVybiBudWxsIT09YT9CYShhKTpudWxsfWZ1bmN0aW9uIEJhKGEpe2lmKDU9PT1hLnRhZ3x8Nj09PWEudGFnKXJldHVybiBhO2ZvcihhPWEuY2hpbGQ7bnVsbCE9PWE7KXt2YXIgYj1CYShhKTtpZihudWxsIT09YilyZXR1cm4gYjthPWEuc2libGluZ31yZXR1cm4gbnVsbH1cbmZ1bmN0aW9uIENhKGEpe2lmKDU9PT1hLnRhZ3x8Nj09PWEudGFnKXJldHVybiBhO2ZvcihhPWEuY2hpbGQ7bnVsbCE9PWE7KXtpZig0IT09YS50YWcpe3ZhciBiPUNhKGEpO2lmKG51bGwhPT1iKXJldHVybiBifWE9YS5zaWJsaW5nfXJldHVybiBudWxsfVxudmFyIERhPUFycmF5LmlzQXJyYXksRWE9JCQkaG9zdENvbmZpZy5nZXRQdWJsaWNJbnN0YW5jZSxGYT0kJCRob3N0Q29uZmlnLmdldFJvb3RIb3N0Q29udGV4dCxHYT0kJCRob3N0Q29uZmlnLmdldENoaWxkSG9zdENvbnRleHQsSGE9JCQkaG9zdENvbmZpZy5wcmVwYXJlRm9yQ29tbWl0LElhPSQkJGhvc3RDb25maWcucmVzZXRBZnRlckNvbW1pdCxKYT0kJCRob3N0Q29uZmlnLmNyZWF0ZUluc3RhbmNlLEthPSQkJGhvc3RDb25maWcuYXBwZW5kSW5pdGlhbENoaWxkLExhPSQkJGhvc3RDb25maWcuZmluYWxpemVJbml0aWFsQ2hpbGRyZW4sTWE9JCQkaG9zdENvbmZpZy5wcmVwYXJlVXBkYXRlLE5hPSQkJGhvc3RDb25maWcuc2hvdWxkU2V0VGV4dENvbnRlbnQsT2E9JCQkaG9zdENvbmZpZy5jcmVhdGVUZXh0SW5zdGFuY2UsUGE9JCQkaG9zdENvbmZpZy5zY2hlZHVsZVRpbWVvdXQsUWE9JCQkaG9zdENvbmZpZy5jYW5jZWxUaW1lb3V0LFJhPSQkJGhvc3RDb25maWcubm9UaW1lb3V0LFxuU2E9JCQkaG9zdENvbmZpZy5pc1ByaW1hcnlSZW5kZXJlcixUYT0kJCRob3N0Q29uZmlnLnN1cHBvcnRzTXV0YXRpb24sVWE9JCQkaG9zdENvbmZpZy5zdXBwb3J0c1BlcnNpc3RlbmNlLFZhPSQkJGhvc3RDb25maWcuc3VwcG9ydHNIeWRyYXRpb24sV2E9JCQkaG9zdENvbmZpZy5nZXRJbnN0YW5jZUZyb21Ob2RlLFhhPSQkJGhvc3RDb25maWcucHJlcGFyZVBvcnRhbE1vdW50LFlhPSQkJGhvc3RDb25maWcuZ2V0Q3VycmVudEV2ZW50UHJpb3JpdHksWmE9JCQkaG9zdENvbmZpZy5kZXRhY2hEZWxldGVkSW5zdGFuY2UsJGE9JCQkaG9zdENvbmZpZy5zdXBwb3J0c01pY3JvdGFza3MsYWI9JCQkaG9zdENvbmZpZy5zY2hlZHVsZU1pY3JvdGFzayxiYj0kJCRob3N0Q29uZmlnLnN1cHBvcnRzVGVzdFNlbGVjdG9ycyxjYj0kJCRob3N0Q29uZmlnLmZpbmRGaWJlclJvb3QsZGI9JCQkaG9zdENvbmZpZy5nZXRCb3VuZGluZ1JlY3QsZWI9JCQkaG9zdENvbmZpZy5nZXRUZXh0Q29udGVudCxmYj1cbiQkJGhvc3RDb25maWcuaXNIaWRkZW5TdWJ0cmVlLGdiPSQkJGhvc3RDb25maWcubWF0Y2hBY2Nlc3NpYmlsaXR5Um9sZSxoYj0kJCRob3N0Q29uZmlnLnNldEZvY3VzSWZGb2N1c2FibGUsaWI9JCQkaG9zdENvbmZpZy5zZXR1cEludGVyc2VjdGlvbk9ic2VydmVyLGpiPSQkJGhvc3RDb25maWcuYXBwZW5kQ2hpbGQsa2I9JCQkaG9zdENvbmZpZy5hcHBlbmRDaGlsZFRvQ29udGFpbmVyLGxiPSQkJGhvc3RDb25maWcuY29tbWl0VGV4dFVwZGF0ZSxtYj0kJCRob3N0Q29uZmlnLmNvbW1pdE1vdW50LG5iPSQkJGhvc3RDb25maWcuY29tbWl0VXBkYXRlLG9iPSQkJGhvc3RDb25maWcuaW5zZXJ0QmVmb3JlLHBiPSQkJGhvc3RDb25maWcuaW5zZXJ0SW5Db250YWluZXJCZWZvcmUscWI9JCQkaG9zdENvbmZpZy5yZW1vdmVDaGlsZCxyYj0kJCRob3N0Q29uZmlnLnJlbW92ZUNoaWxkRnJvbUNvbnRhaW5lcixzYj0kJCRob3N0Q29uZmlnLnJlc2V0VGV4dENvbnRlbnQsdGI9JCQkaG9zdENvbmZpZy5oaWRlSW5zdGFuY2UsXG51Yj0kJCRob3N0Q29uZmlnLmhpZGVUZXh0SW5zdGFuY2UsdmI9JCQkaG9zdENvbmZpZy51bmhpZGVJbnN0YW5jZSx3Yj0kJCRob3N0Q29uZmlnLnVuaGlkZVRleHRJbnN0YW5jZSx4Yj0kJCRob3N0Q29uZmlnLmNsZWFyQ29udGFpbmVyLHliPSQkJGhvc3RDb25maWcuY2xvbmVJbnN0YW5jZSx6Yj0kJCRob3N0Q29uZmlnLmNyZWF0ZUNvbnRhaW5lckNoaWxkU2V0LEFiPSQkJGhvc3RDb25maWcuYXBwZW5kQ2hpbGRUb0NvbnRhaW5lckNoaWxkU2V0LEJiPSQkJGhvc3RDb25maWcuZmluYWxpemVDb250YWluZXJDaGlsZHJlbixDYj0kJCRob3N0Q29uZmlnLnJlcGxhY2VDb250YWluZXJDaGlsZHJlbixFYj0kJCRob3N0Q29uZmlnLmNsb25lSGlkZGVuSW5zdGFuY2UsRmI9JCQkaG9zdENvbmZpZy5jbG9uZUhpZGRlblRleHRJbnN0YW5jZSxHYj0kJCRob3N0Q29uZmlnLmNhbkh5ZHJhdGVJbnN0YW5jZSxIYj0kJCRob3N0Q29uZmlnLmNhbkh5ZHJhdGVUZXh0SW5zdGFuY2UsSWI9JCQkaG9zdENvbmZpZy5jYW5IeWRyYXRlU3VzcGVuc2VJbnN0YW5jZSxcbkpiPSQkJGhvc3RDb25maWcuaXNTdXNwZW5zZUluc3RhbmNlUGVuZGluZyxLYj0kJCRob3N0Q29uZmlnLmlzU3VzcGVuc2VJbnN0YW5jZUZhbGxiYWNrLExiPSQkJGhvc3RDb25maWcuZ2V0U3VzcGVuc2VJbnN0YW5jZUZhbGxiYWNrRXJyb3JEZXRhaWxzLE1iPSQkJGhvc3RDb25maWcucmVnaXN0ZXJTdXNwZW5zZUluc3RhbmNlUmV0cnksTmI9JCQkaG9zdENvbmZpZy5nZXROZXh0SHlkcmF0YWJsZVNpYmxpbmcsT2I9JCQkaG9zdENvbmZpZy5nZXRGaXJzdEh5ZHJhdGFibGVDaGlsZCxQYj0kJCRob3N0Q29uZmlnLmdldEZpcnN0SHlkcmF0YWJsZUNoaWxkV2l0aGluQ29udGFpbmVyLFFiPSQkJGhvc3RDb25maWcuZ2V0Rmlyc3RIeWRyYXRhYmxlQ2hpbGRXaXRoaW5TdXNwZW5zZUluc3RhbmNlLFJiPSQkJGhvc3RDb25maWcuaHlkcmF0ZUluc3RhbmNlLFNiPSQkJGhvc3RDb25maWcuaHlkcmF0ZVRleHRJbnN0YW5jZSxUYj0kJCRob3N0Q29uZmlnLmh5ZHJhdGVTdXNwZW5zZUluc3RhbmNlLFxuVWI9JCQkaG9zdENvbmZpZy5nZXROZXh0SHlkcmF0YWJsZUluc3RhbmNlQWZ0ZXJTdXNwZW5zZUluc3RhbmNlLFZiPSQkJGhvc3RDb25maWcuY29tbWl0SHlkcmF0ZWRDb250YWluZXIsV2I9JCQkaG9zdENvbmZpZy5jb21taXRIeWRyYXRlZFN1c3BlbnNlSW5zdGFuY2UsWGI9JCQkaG9zdENvbmZpZy5jbGVhclN1c3BlbnNlQm91bmRhcnksWWI9JCQkaG9zdENvbmZpZy5jbGVhclN1c3BlbnNlQm91bmRhcnlGcm9tQ29udGFpbmVyLFpiPSQkJGhvc3RDb25maWcuc2hvdWxkRGVsZXRlVW5oeWRyYXRlZFRhaWxJbnN0YW5jZXMsJGI9JCQkaG9zdENvbmZpZy5kaWROb3RNYXRjaEh5ZHJhdGVkQ29udGFpbmVyVGV4dEluc3RhbmNlLGFjPSQkJGhvc3RDb25maWcuZGlkTm90TWF0Y2hIeWRyYXRlZFRleHRJbnN0YW5jZSxiYztcbmZ1bmN0aW9uIGNjKGEpe2lmKHZvaWQgMD09PWJjKXRyeXt0aHJvdyBFcnJvcigpO31jYXRjaChjKXt2YXIgYj1jLnN0YWNrLnRyaW0oKS5tYXRjaCgvXFxuKCAqKGF0ICk/KS8pO2JjPWImJmJbMV18fFwiXCJ9cmV0dXJuXCJcXG5cIitiYythfXZhciBkYz0hMTtcbmZ1bmN0aW9uIGVjKGEsYil7aWYoIWF8fGRjKXJldHVyblwiXCI7ZGM9ITA7dmFyIGM9RXJyb3IucHJlcGFyZVN0YWNrVHJhY2U7RXJyb3IucHJlcGFyZVN0YWNrVHJhY2U9dm9pZCAwO3RyeXtpZihiKWlmKGI9ZnVuY3Rpb24oKXt0aHJvdyBFcnJvcigpO30sT2JqZWN0LmRlZmluZVByb3BlcnR5KGIucHJvdG90eXBlLFwicHJvcHNcIix7c2V0OmZ1bmN0aW9uKCl7dGhyb3cgRXJyb3IoKTt9fSksXCJvYmplY3RcIj09PXR5cGVvZiBSZWZsZWN0JiZSZWZsZWN0LmNvbnN0cnVjdCl7dHJ5e1JlZmxlY3QuY29uc3RydWN0KGIsW10pfWNhdGNoKGwpe3ZhciBkPWx9UmVmbGVjdC5jb25zdHJ1Y3QoYSxbXSxiKX1lbHNle3RyeXtiLmNhbGwoKX1jYXRjaChsKXtkPWx9YS5jYWxsKGIucHJvdG90eXBlKX1lbHNle3RyeXt0aHJvdyBFcnJvcigpO31jYXRjaChsKXtkPWx9YSgpfX1jYXRjaChsKXtpZihsJiZkJiZcInN0cmluZ1wiPT09dHlwZW9mIGwuc3RhY2spe2Zvcih2YXIgZT1sLnN0YWNrLnNwbGl0KFwiXFxuXCIpLFxuZj1kLnN0YWNrLnNwbGl0KFwiXFxuXCIpLGc9ZS5sZW5ndGgtMSxoPWYubGVuZ3RoLTE7MTw9ZyYmMDw9aCYmZVtnXSE9PWZbaF07KWgtLTtmb3IoOzE8PWcmJjA8PWg7Zy0tLGgtLSlpZihlW2ddIT09ZltoXSl7aWYoMSE9PWd8fDEhPT1oKXtkbyBpZihnLS0saC0tLDA+aHx8ZVtnXSE9PWZbaF0pe3ZhciBrPVwiXFxuXCIrZVtnXS5yZXBsYWNlKFwiIGF0IG5ldyBcIixcIiBhdCBcIik7YS5kaXNwbGF5TmFtZSYmay5pbmNsdWRlcyhcIjxhbm9ueW1vdXM+XCIpJiYoaz1rLnJlcGxhY2UoXCI8YW5vbnltb3VzPlwiLGEuZGlzcGxheU5hbWUpKTtyZXR1cm4ga313aGlsZSgxPD1nJiYwPD1oKX1icmVha319fWZpbmFsbHl7ZGM9ITEsRXJyb3IucHJlcGFyZVN0YWNrVHJhY2U9Y31yZXR1cm4oYT1hP2EuZGlzcGxheU5hbWV8fGEubmFtZTpcIlwiKT9jYyhhKTpcIlwifXZhciBmYz1PYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LGdjPVtdLGhjPS0xO2Z1bmN0aW9uIGljKGEpe3JldHVybntjdXJyZW50OmF9fVxuZnVuY3Rpb24gcShhKXswPmhjfHwoYS5jdXJyZW50PWdjW2hjXSxnY1toY109bnVsbCxoYy0tKX1mdW5jdGlvbiB2KGEsYil7aGMrKztnY1toY109YS5jdXJyZW50O2EuY3VycmVudD1ifXZhciBqYz17fSx4PWljKGpjKSx6PWljKCExKSxrYz1qYztmdW5jdGlvbiBtYyhhLGIpe3ZhciBjPWEudHlwZS5jb250ZXh0VHlwZXM7aWYoIWMpcmV0dXJuIGpjO3ZhciBkPWEuc3RhdGVOb2RlO2lmKGQmJmQuX19yZWFjdEludGVybmFsTWVtb2l6ZWRVbm1hc2tlZENoaWxkQ29udGV4dD09PWIpcmV0dXJuIGQuX19yZWFjdEludGVybmFsTWVtb2l6ZWRNYXNrZWRDaGlsZENvbnRleHQ7dmFyIGU9e30sZjtmb3IoZiBpbiBjKWVbZl09YltmXTtkJiYoYT1hLnN0YXRlTm9kZSxhLl9fcmVhY3RJbnRlcm5hbE1lbW9pemVkVW5tYXNrZWRDaGlsZENvbnRleHQ9YixhLl9fcmVhY3RJbnRlcm5hbE1lbW9pemVkTWFza2VkQ2hpbGRDb250ZXh0PWUpO3JldHVybiBlfVxuZnVuY3Rpb24gQShhKXthPWEuY2hpbGRDb250ZXh0VHlwZXM7cmV0dXJuIG51bGwhPT1hJiZ2b2lkIDAhPT1hfWZ1bmN0aW9uIG5jKCl7cSh6KTtxKHgpfWZ1bmN0aW9uIG9jKGEsYixjKXtpZih4LmN1cnJlbnQhPT1qYyl0aHJvdyBFcnJvcihuKDE2OCkpO3YoeCxiKTt2KHosYyl9ZnVuY3Rpb24gcGMoYSxiLGMpe3ZhciBkPWEuc3RhdGVOb2RlO2I9Yi5jaGlsZENvbnRleHRUeXBlcztpZihcImZ1bmN0aW9uXCIhPT10eXBlb2YgZC5nZXRDaGlsZENvbnRleHQpcmV0dXJuIGM7ZD1kLmdldENoaWxkQ29udGV4dCgpO2Zvcih2YXIgZSBpbiBkKWlmKCEoZSBpbiBiKSl0aHJvdyBFcnJvcihuKDEwOCx2YShhKXx8XCJVbmtub3duXCIsZSkpO3JldHVybiBjYSh7fSxjLGQpfVxuZnVuY3Rpb24gcWMoYSl7YT0oYT1hLnN0YXRlTm9kZSkmJmEuX19yZWFjdEludGVybmFsTWVtb2l6ZWRNZXJnZWRDaGlsZENvbnRleHR8fGpjO2tjPXguY3VycmVudDt2KHgsYSk7dih6LHouY3VycmVudCk7cmV0dXJuITB9ZnVuY3Rpb24gcmMoYSxiLGMpe3ZhciBkPWEuc3RhdGVOb2RlO2lmKCFkKXRocm93IEVycm9yKG4oMTY5KSk7Yz8oYT1wYyhhLGIsa2MpLGQuX19yZWFjdEludGVybmFsTWVtb2l6ZWRNZXJnZWRDaGlsZENvbnRleHQ9YSxxKHopLHEoeCksdih4LGEpKTpxKHopO3YoeixjKX12YXIgdGM9TWF0aC5jbHozMj9NYXRoLmNsejMyOnNjLHVjPU1hdGgubG9nLHZjPU1hdGguTE4yO2Z1bmN0aW9uIHNjKGEpe2E+Pj49MDtyZXR1cm4gMD09PWE/MzI6MzEtKHVjKGEpL3ZjfDApfDB9dmFyIHdjPTY0LHhjPTQxOTQzMDQ7XG5mdW5jdGlvbiB5YyhhKXtzd2l0Y2goYSYtYSl7Y2FzZSAxOnJldHVybiAxO2Nhc2UgMjpyZXR1cm4gMjtjYXNlIDQ6cmV0dXJuIDQ7Y2FzZSA4OnJldHVybiA4O2Nhc2UgMTY6cmV0dXJuIDE2O2Nhc2UgMzI6cmV0dXJuIDMyO2Nhc2UgNjQ6Y2FzZSAxMjg6Y2FzZSAyNTY6Y2FzZSA1MTI6Y2FzZSAxMDI0OmNhc2UgMjA0ODpjYXNlIDQwOTY6Y2FzZSA4MTkyOmNhc2UgMTYzODQ6Y2FzZSAzMjc2ODpjYXNlIDY1NTM2OmNhc2UgMTMxMDcyOmNhc2UgMjYyMTQ0OmNhc2UgNTI0Mjg4OmNhc2UgMTA0ODU3NjpjYXNlIDIwOTcxNTI6cmV0dXJuIGEmNDE5NDI0MDtjYXNlIDQxOTQzMDQ6Y2FzZSA4Mzg4NjA4OmNhc2UgMTY3NzcyMTY6Y2FzZSAzMzU1NDQzMjpjYXNlIDY3MTA4ODY0OnJldHVybiBhJjEzMDAyMzQyNDtjYXNlIDEzNDIxNzcyODpyZXR1cm4gMTM0MjE3NzI4O2Nhc2UgMjY4NDM1NDU2OnJldHVybiAyNjg0MzU0NTY7Y2FzZSA1MzY4NzA5MTI6cmV0dXJuIDUzNjg3MDkxMjtjYXNlIDEwNzM3NDE4MjQ6cmV0dXJuIDEwNzM3NDE4MjQ7XG5kZWZhdWx0OnJldHVybiBhfX1mdW5jdGlvbiB6YyhhLGIpe3ZhciBjPWEucGVuZGluZ0xhbmVzO2lmKDA9PT1jKXJldHVybiAwO3ZhciBkPTAsZT1hLnN1c3BlbmRlZExhbmVzLGY9YS5waW5nZWRMYW5lcyxnPWMmMjY4NDM1NDU1O2lmKDAhPT1nKXt2YXIgaD1nJn5lOzAhPT1oP2Q9eWMoaCk6KGYmPWcsMCE9PWYmJihkPXljKGYpKSl9ZWxzZSBnPWMmfmUsMCE9PWc/ZD15YyhnKTowIT09ZiYmKGQ9eWMoZikpO2lmKDA9PT1kKXJldHVybiAwO2lmKDAhPT1iJiZiIT09ZCYmMD09PShiJmUpJiYoZT1kJi1kLGY9YiYtYixlPj1mfHwxNj09PWUmJjAhPT0oZiY0MTk0MjQwKSkpcmV0dXJuIGI7MCE9PShkJjQpJiYoZHw9YyYxNik7Yj1hLmVudGFuZ2xlZExhbmVzO2lmKDAhPT1iKWZvcihhPWEuZW50YW5nbGVtZW50cyxiJj1kOzA8YjspYz0zMS10YyhiKSxlPTE8PGMsZHw9YVtjXSxiJj1+ZTtyZXR1cm4gZH1cbmZ1bmN0aW9uIEFjKGEsYil7c3dpdGNoKGEpe2Nhc2UgMTpjYXNlIDI6Y2FzZSA0OnJldHVybiBiKzI1MDtjYXNlIDg6Y2FzZSAxNjpjYXNlIDMyOmNhc2UgNjQ6Y2FzZSAxMjg6Y2FzZSAyNTY6Y2FzZSA1MTI6Y2FzZSAxMDI0OmNhc2UgMjA0ODpjYXNlIDQwOTY6Y2FzZSA4MTkyOmNhc2UgMTYzODQ6Y2FzZSAzMjc2ODpjYXNlIDY1NTM2OmNhc2UgMTMxMDcyOmNhc2UgMjYyMTQ0OmNhc2UgNTI0Mjg4OmNhc2UgMTA0ODU3NjpjYXNlIDIwOTcxNTI6cmV0dXJuIGIrNUUzO2Nhc2UgNDE5NDMwNDpjYXNlIDgzODg2MDg6Y2FzZSAxNjc3NzIxNjpjYXNlIDMzNTU0NDMyOmNhc2UgNjcxMDg4NjQ6cmV0dXJuLTE7Y2FzZSAxMzQyMTc3Mjg6Y2FzZSAyNjg0MzU0NTY6Y2FzZSA1MzY4NzA5MTI6Y2FzZSAxMDczNzQxODI0OnJldHVybi0xO2RlZmF1bHQ6cmV0dXJuLTF9fVxuZnVuY3Rpb24gQmMoYSxiKXtmb3IodmFyIGM9YS5zdXNwZW5kZWRMYW5lcyxkPWEucGluZ2VkTGFuZXMsZT1hLmV4cGlyYXRpb25UaW1lcyxmPWEucGVuZGluZ0xhbmVzOzA8Zjspe3ZhciBnPTMxLXRjKGYpLGg9MTw8ZyxrPWVbZ107aWYoLTE9PT1rKXtpZigwPT09KGgmYyl8fDAhPT0oaCZkKSllW2ddPUFjKGgsYil9ZWxzZSBrPD1iJiYoYS5leHBpcmVkTGFuZXN8PWgpO2YmPX5ofX1mdW5jdGlvbiBDYyhhKXthPWEucGVuZGluZ0xhbmVzJi0xMDczNzQxODI1O3JldHVybiAwIT09YT9hOmEmMTA3Mzc0MTgyND8xMDczNzQxODI0OjB9ZnVuY3Rpb24gRGMoKXt2YXIgYT13Yzt3Yzw8PTE7MD09PSh3YyY0MTk0MjQwKSYmKHdjPTY0KTtyZXR1cm4gYX1mdW5jdGlvbiBFYyhhKXtmb3IodmFyIGI9W10sYz0wOzMxPmM7YysrKWIucHVzaChhKTtyZXR1cm4gYn1cbmZ1bmN0aW9uIEZjKGEsYixjKXthLnBlbmRpbmdMYW5lc3w9Yjs1MzY4NzA5MTIhPT1iJiYoYS5zdXNwZW5kZWRMYW5lcz0wLGEucGluZ2VkTGFuZXM9MCk7YT1hLmV2ZW50VGltZXM7Yj0zMS10YyhiKTthW2JdPWN9ZnVuY3Rpb24gR2MoYSxiKXt2YXIgYz1hLnBlbmRpbmdMYW5lcyZ+YjthLnBlbmRpbmdMYW5lcz1iO2Euc3VzcGVuZGVkTGFuZXM9MDthLnBpbmdlZExhbmVzPTA7YS5leHBpcmVkTGFuZXMmPWI7YS5tdXRhYmxlUmVhZExhbmVzJj1iO2EuZW50YW5nbGVkTGFuZXMmPWI7Yj1hLmVudGFuZ2xlbWVudHM7dmFyIGQ9YS5ldmVudFRpbWVzO2ZvcihhPWEuZXhwaXJhdGlvblRpbWVzOzA8Yzspe3ZhciBlPTMxLXRjKGMpLGY9MTw8ZTtiW2VdPTA7ZFtlXT0tMTthW2VdPS0xO2MmPX5mfX1cbmZ1bmN0aW9uIEhjKGEsYil7dmFyIGM9YS5lbnRhbmdsZWRMYW5lc3w9Yjtmb3IoYT1hLmVudGFuZ2xlbWVudHM7Yzspe3ZhciBkPTMxLXRjKGMpLGU9MTw8ZDtlJmJ8YVtkXSZiJiYoYVtkXXw9Yik7YyY9fmV9fXZhciBDPTA7ZnVuY3Rpb24gSWMoYSl7YSY9LWE7cmV0dXJuIDE8YT80PGE/MCE9PShhJjI2ODQzNTQ1NSk/MTY6NTM2ODcwOTEyOjQ6MX12YXIgSmM9YmEudW5zdGFibGVfc2NoZWR1bGVDYWxsYmFjayxLYz1iYS51bnN0YWJsZV9jYW5jZWxDYWxsYmFjayxMYz1iYS51bnN0YWJsZV9zaG91bGRZaWVsZCxNYz1iYS51bnN0YWJsZV9yZXF1ZXN0UGFpbnQsRD1iYS51bnN0YWJsZV9ub3csTmM9YmEudW5zdGFibGVfSW1tZWRpYXRlUHJpb3JpdHksT2M9YmEudW5zdGFibGVfVXNlckJsb2NraW5nUHJpb3JpdHksUGM9YmEudW5zdGFibGVfTm9ybWFsUHJpb3JpdHksUWM9YmEudW5zdGFibGVfSWRsZVByaW9yaXR5LFJjPW51bGwsU2M9bnVsbDtcbmZ1bmN0aW9uIFRjKGEpe2lmKFNjJiZcImZ1bmN0aW9uXCI9PT10eXBlb2YgU2Mub25Db21taXRGaWJlclJvb3QpdHJ5e1NjLm9uQ29tbWl0RmliZXJSb290KFJjLGEsdm9pZCAwLDEyOD09PShhLmN1cnJlbnQuZmxhZ3MmMTI4KSl9Y2F0Y2goYil7fX1mdW5jdGlvbiBVYyhhLGIpe3JldHVybiBhPT09YiYmKDAhPT1hfHwxL2E9PT0xL2IpfHxhIT09YSYmYiE9PWJ9dmFyIFZjPVwiZnVuY3Rpb25cIj09PXR5cGVvZiBPYmplY3QuaXM/T2JqZWN0LmlzOlVjLFdjPW51bGwsWGM9ITEsWWM9ITE7ZnVuY3Rpb24gWmMoYSl7bnVsbD09PVdjP1djPVthXTpXYy5wdXNoKGEpfWZ1bmN0aW9uICRjKGEpe1hjPSEwO1pjKGEpfVxuZnVuY3Rpb24gYWQoKXtpZighWWMmJm51bGwhPT1XYyl7WWM9ITA7dmFyIGE9MCxiPUM7dHJ5e3ZhciBjPVdjO2ZvcihDPTE7YTxjLmxlbmd0aDthKyspe3ZhciBkPWNbYV07ZG8gZD1kKCEwKTt3aGlsZShudWxsIT09ZCl9V2M9bnVsbDtYYz0hMX1jYXRjaChlKXt0aHJvdyBudWxsIT09V2MmJihXYz1XYy5zbGljZShhKzEpKSxKYyhOYyxhZCksZTt9ZmluYWxseXtDPWIsWWM9ITF9fXJldHVybiBudWxsfXZhciBiZD1bXSxjZD0wLGRkPW51bGwsZWQ9MCxmZD1bXSxnZD0wLGhkPW51bGwsaWQ9MSxqZD1cIlwiO2Z1bmN0aW9uIGtkKGEsYil7YmRbY2QrK109ZWQ7YmRbY2QrK109ZGQ7ZGQ9YTtlZD1ifVxuZnVuY3Rpb24gbGQoYSxiLGMpe2ZkW2dkKytdPWlkO2ZkW2dkKytdPWpkO2ZkW2dkKytdPWhkO2hkPWE7dmFyIGQ9aWQ7YT1qZDt2YXIgZT0zMi10YyhkKS0xO2QmPX4oMTw8ZSk7Yys9MTt2YXIgZj0zMi10YyhiKStlO2lmKDMwPGYpe3ZhciBnPWUtZSU1O2Y9KGQmKDE8PGcpLTEpLnRvU3RyaW5nKDMyKTtkPj49ZztlLT1nO2lkPTE8PDMyLXRjKGIpK2V8Yzw8ZXxkO2pkPWYrYX1lbHNlIGlkPTE8PGZ8Yzw8ZXxkLGpkPWF9ZnVuY3Rpb24gbWQoYSl7bnVsbCE9PWEucmV0dXJuJiYoa2QoYSwxKSxsZChhLDEsMCkpfWZ1bmN0aW9uIG5kKGEpe2Zvcig7YT09PWRkOylkZD1iZFstLWNkXSxiZFtjZF09bnVsbCxlZD1iZFstLWNkXSxiZFtjZF09bnVsbDtmb3IoO2E9PT1oZDspaGQ9ZmRbLS1nZF0sZmRbZ2RdPW51bGwsamQ9ZmRbLS1nZF0sZmRbZ2RdPW51bGwsaWQ9ZmRbLS1nZF0sZmRbZ2RdPW51bGx9dmFyIG9kPW51bGwscGQ9bnVsbCxGPSExLHFkPSExLHJkPW51bGw7XG5mdW5jdGlvbiBzZChhLGIpe3ZhciBjPXRkKDUsbnVsbCxudWxsLDApO2MuZWxlbWVudFR5cGU9XCJERUxFVEVEXCI7Yy5zdGF0ZU5vZGU9YjtjLnJldHVybj1hO2I9YS5kZWxldGlvbnM7bnVsbD09PWI/KGEuZGVsZXRpb25zPVtjXSxhLmZsYWdzfD0xNik6Yi5wdXNoKGMpfVxuZnVuY3Rpb24gdWQoYSxiKXtzd2l0Y2goYS50YWcpe2Nhc2UgNTpyZXR1cm4gYj1HYihiLGEudHlwZSxhLnBlbmRpbmdQcm9wcyksbnVsbCE9PWI/KGEuc3RhdGVOb2RlPWIsb2Q9YSxwZD1PYihiKSwhMCk6ITE7Y2FzZSA2OnJldHVybiBiPUhiKGIsYS5wZW5kaW5nUHJvcHMpLG51bGwhPT1iPyhhLnN0YXRlTm9kZT1iLG9kPWEscGQ9bnVsbCwhMCk6ITE7Y2FzZSAxMzpiPUliKGIpO2lmKG51bGwhPT1iKXt2YXIgYz1udWxsIT09aGQ/e2lkOmlkLG92ZXJmbG93OmpkfTpudWxsO2EubWVtb2l6ZWRTdGF0ZT17ZGVoeWRyYXRlZDpiLHRyZWVDb250ZXh0OmMscmV0cnlMYW5lOjEwNzM3NDE4MjR9O2M9dGQoMTgsbnVsbCxudWxsLDApO2Muc3RhdGVOb2RlPWI7Yy5yZXR1cm49YTthLmNoaWxkPWM7b2Q9YTtwZD1udWxsO3JldHVybiEwfXJldHVybiExO2RlZmF1bHQ6cmV0dXJuITF9fWZ1bmN0aW9uIHZkKGEpe3JldHVybiAwIT09KGEubW9kZSYxKSYmMD09PShhLmZsYWdzJjEyOCl9XG5mdW5jdGlvbiB3ZChhKXtpZihGKXt2YXIgYj1wZDtpZihiKXt2YXIgYz1iO2lmKCF1ZChhLGIpKXtpZih2ZChhKSl0aHJvdyBFcnJvcihuKDQxOCkpO2I9TmIoYyk7dmFyIGQ9b2Q7YiYmdWQoYSxiKT9zZChkLGMpOihhLmZsYWdzPWEuZmxhZ3MmLTQwOTd8MixGPSExLG9kPWEpfX1lbHNle2lmKHZkKGEpKXRocm93IEVycm9yKG4oNDE4KSk7YS5mbGFncz1hLmZsYWdzJi00MDk3fDI7Rj0hMTtvZD1hfX19ZnVuY3Rpb24geGQoYSl7Zm9yKGE9YS5yZXR1cm47bnVsbCE9PWEmJjUhPT1hLnRhZyYmMyE9PWEudGFnJiYxMyE9PWEudGFnOylhPWEucmV0dXJuO29kPWF9XG5mdW5jdGlvbiB5ZChhKXtpZighVmF8fGEhPT1vZClyZXR1cm4hMTtpZighRilyZXR1cm4geGQoYSksRj0hMCwhMTtpZigzIT09YS50YWcmJig1IT09YS50YWd8fFpiKGEudHlwZSkmJiFOYShhLnR5cGUsYS5tZW1vaXplZFByb3BzKSkpe3ZhciBiPXBkO2lmKGIpe2lmKHZkKGEpKXRocm93IHpkKCksRXJyb3Iobig0MTgpKTtmb3IoO2I7KXNkKGEsYiksYj1OYihiKX19eGQoYSk7aWYoMTM9PT1hLnRhZyl7aWYoIVZhKXRocm93IEVycm9yKG4oMzE2KSk7YT1hLm1lbW9pemVkU3RhdGU7YT1udWxsIT09YT9hLmRlaHlkcmF0ZWQ6bnVsbDtpZighYSl0aHJvdyBFcnJvcihuKDMxNykpO3BkPVViKGEpfWVsc2UgcGQ9b2Q/TmIoYS5zdGF0ZU5vZGUpOm51bGw7cmV0dXJuITB9ZnVuY3Rpb24gemQoKXtmb3IodmFyIGE9cGQ7YTspYT1OYihhKX1mdW5jdGlvbiBBZCgpe1ZhJiYocGQ9b2Q9bnVsbCxxZD1GPSExKX1mdW5jdGlvbiBCZChhKXtudWxsPT09cmQ/cmQ9W2FdOnJkLnB1c2goYSl9XG52YXIgQ2Q9ZGEuUmVhY3RDdXJyZW50QmF0Y2hDb25maWc7ZnVuY3Rpb24gRGQoYSxiKXtpZihWYyhhLGIpKXJldHVybiEwO2lmKFwib2JqZWN0XCIhPT10eXBlb2YgYXx8bnVsbD09PWF8fFwib2JqZWN0XCIhPT10eXBlb2YgYnx8bnVsbD09PWIpcmV0dXJuITE7dmFyIGM9T2JqZWN0LmtleXMoYSksZD1PYmplY3Qua2V5cyhiKTtpZihjLmxlbmd0aCE9PWQubGVuZ3RoKXJldHVybiExO2ZvcihkPTA7ZDxjLmxlbmd0aDtkKyspe3ZhciBlPWNbZF07aWYoIWZjLmNhbGwoYixlKXx8IVZjKGFbZV0sYltlXSkpcmV0dXJuITF9cmV0dXJuITB9XG5mdW5jdGlvbiBFZChhKXtzd2l0Y2goYS50YWcpe2Nhc2UgNTpyZXR1cm4gY2MoYS50eXBlKTtjYXNlIDE2OnJldHVybiBjYyhcIkxhenlcIik7Y2FzZSAxMzpyZXR1cm4gY2MoXCJTdXNwZW5zZVwiKTtjYXNlIDE5OnJldHVybiBjYyhcIlN1c3BlbnNlTGlzdFwiKTtjYXNlIDA6Y2FzZSAyOmNhc2UgMTU6cmV0dXJuIGE9ZWMoYS50eXBlLCExKSxhO2Nhc2UgMTE6cmV0dXJuIGE9ZWMoYS50eXBlLnJlbmRlciwhMSksYTtjYXNlIDE6cmV0dXJuIGE9ZWMoYS50eXBlLCEwKSxhO2RlZmF1bHQ6cmV0dXJuXCJcIn19XG5mdW5jdGlvbiBGZChhLGIsYyl7YT1jLnJlZjtpZihudWxsIT09YSYmXCJmdW5jdGlvblwiIT09dHlwZW9mIGEmJlwib2JqZWN0XCIhPT10eXBlb2YgYSl7aWYoYy5fb3duZXIpe2M9Yy5fb3duZXI7aWYoYyl7aWYoMSE9PWMudGFnKXRocm93IEVycm9yKG4oMzA5KSk7dmFyIGQ9Yy5zdGF0ZU5vZGV9aWYoIWQpdGhyb3cgRXJyb3IobigxNDcsYSkpO3ZhciBlPWQsZj1cIlwiK2E7aWYobnVsbCE9PWImJm51bGwhPT1iLnJlZiYmXCJmdW5jdGlvblwiPT09dHlwZW9mIGIucmVmJiZiLnJlZi5fc3RyaW5nUmVmPT09ZilyZXR1cm4gYi5yZWY7Yj1mdW5jdGlvbihhKXt2YXIgYj1lLnJlZnM7bnVsbD09PWE/ZGVsZXRlIGJbZl06YltmXT1hfTtiLl9zdHJpbmdSZWY9ZjtyZXR1cm4gYn1pZihcInN0cmluZ1wiIT09dHlwZW9mIGEpdGhyb3cgRXJyb3IobigyODQpKTtpZighYy5fb3duZXIpdGhyb3cgRXJyb3IobigyOTAsYSkpO31yZXR1cm4gYX1cbmZ1bmN0aW9uIEdkKGEsYil7YT1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYik7dGhyb3cgRXJyb3IobigzMSxcIltvYmplY3QgT2JqZWN0XVwiPT09YT9cIm9iamVjdCB3aXRoIGtleXMge1wiK09iamVjdC5rZXlzKGIpLmpvaW4oXCIsIFwiKStcIn1cIjphKSk7fWZ1bmN0aW9uIEhkKGEpe3ZhciBiPWEuX2luaXQ7cmV0dXJuIGIoYS5fcGF5bG9hZCl9XG5mdW5jdGlvbiBJZChhKXtmdW5jdGlvbiBiKGIsYyl7aWYoYSl7dmFyIGQ9Yi5kZWxldGlvbnM7bnVsbD09PWQ/KGIuZGVsZXRpb25zPVtjXSxiLmZsYWdzfD0xNik6ZC5wdXNoKGMpfX1mdW5jdGlvbiBjKGMsZCl7aWYoIWEpcmV0dXJuIG51bGw7Zm9yKDtudWxsIT09ZDspYihjLGQpLGQ9ZC5zaWJsaW5nO3JldHVybiBudWxsfWZ1bmN0aW9uIGQoYSxiKXtmb3IoYT1uZXcgTWFwO251bGwhPT1iOyludWxsIT09Yi5rZXk/YS5zZXQoYi5rZXksYik6YS5zZXQoYi5pbmRleCxiKSxiPWIuc2libGluZztyZXR1cm4gYX1mdW5jdGlvbiBlKGEsYil7YT1KZChhLGIpO2EuaW5kZXg9MDthLnNpYmxpbmc9bnVsbDtyZXR1cm4gYX1mdW5jdGlvbiBmKGIsYyxkKXtiLmluZGV4PWQ7aWYoIWEpcmV0dXJuIGIuZmxhZ3N8PTEwNDg1NzYsYztkPWIuYWx0ZXJuYXRlO2lmKG51bGwhPT1kKXJldHVybiBkPWQuaW5kZXgsZDxjPyhiLmZsYWdzfD0yLGMpOmQ7Yi5mbGFnc3w9MjtyZXR1cm4gY31mdW5jdGlvbiBnKGIpe2EmJlxubnVsbD09PWIuYWx0ZXJuYXRlJiYoYi5mbGFnc3w9Mik7cmV0dXJuIGJ9ZnVuY3Rpb24gaChhLGIsYyxkKXtpZihudWxsPT09Ynx8NiE9PWIudGFnKXJldHVybiBiPUtkKGMsYS5tb2RlLGQpLGIucmV0dXJuPWEsYjtiPWUoYixjKTtiLnJldHVybj1hO3JldHVybiBifWZ1bmN0aW9uIGsoYSxiLGMsZCl7dmFyIGY9Yy50eXBlO2lmKGY9PT1oYSlyZXR1cm4gbShhLGIsYy5wcm9wcy5jaGlsZHJlbixkLGMua2V5KTtpZihudWxsIT09YiYmKGIuZWxlbWVudFR5cGU9PT1mfHxcIm9iamVjdFwiPT09dHlwZW9mIGYmJm51bGwhPT1mJiZmLiQkdHlwZW9mPT09cWEmJkhkKGYpPT09Yi50eXBlKSlyZXR1cm4gZD1lKGIsYy5wcm9wcyksZC5yZWY9RmQoYSxiLGMpLGQucmV0dXJuPWEsZDtkPUxkKGMudHlwZSxjLmtleSxjLnByb3BzLG51bGwsYS5tb2RlLGQpO2QucmVmPUZkKGEsYixjKTtkLnJldHVybj1hO3JldHVybiBkfWZ1bmN0aW9uIGwoYSxiLGMsZCl7aWYobnVsbD09PWJ8fDQhPT1iLnRhZ3x8XG5iLnN0YXRlTm9kZS5jb250YWluZXJJbmZvIT09Yy5jb250YWluZXJJbmZvfHxiLnN0YXRlTm9kZS5pbXBsZW1lbnRhdGlvbiE9PWMuaW1wbGVtZW50YXRpb24pcmV0dXJuIGI9TWQoYyxhLm1vZGUsZCksYi5yZXR1cm49YSxiO2I9ZShiLGMuY2hpbGRyZW58fFtdKTtiLnJldHVybj1hO3JldHVybiBifWZ1bmN0aW9uIG0oYSxiLGMsZCxmKXtpZihudWxsPT09Ynx8NyE9PWIudGFnKXJldHVybiBiPU5kKGMsYS5tb2RlLGQsZiksYi5yZXR1cm49YSxiO2I9ZShiLGMpO2IucmV0dXJuPWE7cmV0dXJuIGJ9ZnVuY3Rpb24gcihhLGIsYyl7aWYoXCJzdHJpbmdcIj09PXR5cGVvZiBiJiZcIlwiIT09Ynx8XCJudW1iZXJcIj09PXR5cGVvZiBiKXJldHVybiBiPUtkKFwiXCIrYixhLm1vZGUsYyksYi5yZXR1cm49YSxiO2lmKFwib2JqZWN0XCI9PT10eXBlb2YgYiYmbnVsbCE9PWIpe3N3aXRjaChiLiQkdHlwZW9mKXtjYXNlIGVhOnJldHVybiBjPUxkKGIudHlwZSxiLmtleSxiLnByb3BzLG51bGwsYS5tb2RlLGMpLFxuYy5yZWY9RmQoYSxudWxsLGIpLGMucmV0dXJuPWEsYztjYXNlIGZhOnJldHVybiBiPU1kKGIsYS5tb2RlLGMpLGIucmV0dXJuPWEsYjtjYXNlIHFhOnZhciBkPWIuX2luaXQ7cmV0dXJuIHIoYSxkKGIuX3BheWxvYWQpLGMpfWlmKERhKGIpfHx0YShiKSlyZXR1cm4gYj1OZChiLGEubW9kZSxjLG51bGwpLGIucmV0dXJuPWEsYjtHZChhLGIpfXJldHVybiBudWxsfWZ1bmN0aW9uIHAoYSxiLGMsZCl7dmFyIGU9bnVsbCE9PWI/Yi5rZXk6bnVsbDtpZihcInN0cmluZ1wiPT09dHlwZW9mIGMmJlwiXCIhPT1jfHxcIm51bWJlclwiPT09dHlwZW9mIGMpcmV0dXJuIG51bGwhPT1lP251bGw6aChhLGIsXCJcIitjLGQpO2lmKFwib2JqZWN0XCI9PT10eXBlb2YgYyYmbnVsbCE9PWMpe3N3aXRjaChjLiQkdHlwZW9mKXtjYXNlIGVhOnJldHVybiBjLmtleT09PWU/ayhhLGIsYyxkKTpudWxsO2Nhc2UgZmE6cmV0dXJuIGMua2V5PT09ZT9sKGEsYixjLGQpOm51bGw7Y2FzZSBxYTpyZXR1cm4gZT1jLl9pbml0LHAoYSxcbmIsZShjLl9wYXlsb2FkKSxkKX1pZihEYShjKXx8dGEoYykpcmV0dXJuIG51bGwhPT1lP251bGw6bShhLGIsYyxkLG51bGwpO0dkKGEsYyl9cmV0dXJuIG51bGx9ZnVuY3Rpb24gQihhLGIsYyxkLGUpe2lmKFwic3RyaW5nXCI9PT10eXBlb2YgZCYmXCJcIiE9PWR8fFwibnVtYmVyXCI9PT10eXBlb2YgZClyZXR1cm4gYT1hLmdldChjKXx8bnVsbCxoKGIsYSxcIlwiK2QsZSk7aWYoXCJvYmplY3RcIj09PXR5cGVvZiBkJiZudWxsIT09ZCl7c3dpdGNoKGQuJCR0eXBlb2Ype2Nhc2UgZWE6cmV0dXJuIGE9YS5nZXQobnVsbD09PWQua2V5P2M6ZC5rZXkpfHxudWxsLGsoYixhLGQsZSk7Y2FzZSBmYTpyZXR1cm4gYT1hLmdldChudWxsPT09ZC5rZXk/YzpkLmtleSl8fG51bGwsbChiLGEsZCxlKTtjYXNlIHFhOnZhciBmPWQuX2luaXQ7cmV0dXJuIEIoYSxiLGMsZihkLl9wYXlsb2FkKSxlKX1pZihEYShkKXx8dGEoZCkpcmV0dXJuIGE9YS5nZXQoYyl8fG51bGwsbShiLGEsZCxlLG51bGwpO0dkKGIsZCl9cmV0dXJuIG51bGx9XG5mdW5jdGlvbiB3KGUsZyxoLGspe2Zvcih2YXIgbD1udWxsLG09bnVsbCx1PWcsdD1nPTAsRT1udWxsO251bGwhPT11JiZ0PGgubGVuZ3RoO3QrKyl7dS5pbmRleD50PyhFPXUsdT1udWxsKTpFPXUuc2libGluZzt2YXIgeT1wKGUsdSxoW3RdLGspO2lmKG51bGw9PT15KXtudWxsPT09dSYmKHU9RSk7YnJlYWt9YSYmdSYmbnVsbD09PXkuYWx0ZXJuYXRlJiZiKGUsdSk7Zz1mKHksZyx0KTtudWxsPT09bT9sPXk6bS5zaWJsaW5nPXk7bT15O3U9RX1pZih0PT09aC5sZW5ndGgpcmV0dXJuIGMoZSx1KSxGJiZrZChlLHQpLGw7aWYobnVsbD09PXUpe2Zvcig7dDxoLmxlbmd0aDt0KyspdT1yKGUsaFt0XSxrKSxudWxsIT09dSYmKGc9Zih1LGcsdCksbnVsbD09PW0/bD11Om0uc2libGluZz11LG09dSk7RiYma2QoZSx0KTtyZXR1cm4gbH1mb3IodT1kKGUsdSk7dDxoLmxlbmd0aDt0KyspRT1CKHUsZSx0LGhbdF0sayksbnVsbCE9PUUmJihhJiZudWxsIT09RS5hbHRlcm5hdGUmJnUuZGVsZXRlKG51bGw9PT1cbkUua2V5P3Q6RS5rZXkpLGc9ZihFLGcsdCksbnVsbD09PW0/bD1FOm0uc2libGluZz1FLG09RSk7YSYmdS5mb3JFYWNoKGZ1bmN0aW9uKGEpe3JldHVybiBiKGUsYSl9KTtGJiZrZChlLHQpO3JldHVybiBsfWZ1bmN0aW9uIFkoZSxnLGgsayl7dmFyIGw9dGEoaCk7aWYoXCJmdW5jdGlvblwiIT09dHlwZW9mIGwpdGhyb3cgRXJyb3IobigxNTApKTtoPWwuY2FsbChoKTtpZihudWxsPT1oKXRocm93IEVycm9yKG4oMTUxKSk7Zm9yKHZhciB1PWw9bnVsbCxtPWcsdD1nPTAsRT1udWxsLHk9aC5uZXh0KCk7bnVsbCE9PW0mJiF5LmRvbmU7dCsrLHk9aC5uZXh0KCkpe20uaW5kZXg+dD8oRT1tLG09bnVsbCk6RT1tLnNpYmxpbmc7dmFyIHc9cChlLG0seS52YWx1ZSxrKTtpZihudWxsPT09dyl7bnVsbD09PW0mJihtPUUpO2JyZWFrfWEmJm0mJm51bGw9PT13LmFsdGVybmF0ZSYmYihlLG0pO2c9Zih3LGcsdCk7bnVsbD09PXU/bD13OnUuc2libGluZz13O3U9dzttPUV9aWYoeS5kb25lKXJldHVybiBjKGUsXG5tKSxGJiZrZChlLHQpLGw7aWYobnVsbD09PW0pe2Zvcig7IXkuZG9uZTt0KysseT1oLm5leHQoKSl5PXIoZSx5LnZhbHVlLGspLG51bGwhPT15JiYoZz1mKHksZyx0KSxudWxsPT09dT9sPXk6dS5zaWJsaW5nPXksdT15KTtGJiZrZChlLHQpO3JldHVybiBsfWZvcihtPWQoZSxtKTsheS5kb25lO3QrKyx5PWgubmV4dCgpKXk9QihtLGUsdCx5LnZhbHVlLGspLG51bGwhPT15JiYoYSYmbnVsbCE9PXkuYWx0ZXJuYXRlJiZtLmRlbGV0ZShudWxsPT09eS5rZXk/dDp5LmtleSksZz1mKHksZyx0KSxudWxsPT09dT9sPXk6dS5zaWJsaW5nPXksdT15KTthJiZtLmZvckVhY2goZnVuY3Rpb24oYSl7cmV0dXJuIGIoZSxhKX0pO0YmJmtkKGUsdCk7cmV0dXJuIGx9ZnVuY3Rpb24geWEoYSxkLGYsaCl7XCJvYmplY3RcIj09PXR5cGVvZiBmJiZudWxsIT09ZiYmZi50eXBlPT09aGEmJm51bGw9PT1mLmtleSYmKGY9Zi5wcm9wcy5jaGlsZHJlbik7aWYoXCJvYmplY3RcIj09PXR5cGVvZiBmJiZudWxsIT09XG5mKXtzd2l0Y2goZi4kJHR5cGVvZil7Y2FzZSBlYTphOntmb3IodmFyIGs9Zi5rZXksbD1kO251bGwhPT1sOyl7aWYobC5rZXk9PT1rKXtrPWYudHlwZTtpZihrPT09aGEpe2lmKDc9PT1sLnRhZyl7YyhhLGwuc2libGluZyk7ZD1lKGwsZi5wcm9wcy5jaGlsZHJlbik7ZC5yZXR1cm49YTthPWQ7YnJlYWsgYX19ZWxzZSBpZihsLmVsZW1lbnRUeXBlPT09a3x8XCJvYmplY3RcIj09PXR5cGVvZiBrJiZudWxsIT09ayYmay4kJHR5cGVvZj09PXFhJiZIZChrKT09PWwudHlwZSl7YyhhLGwuc2libGluZyk7ZD1lKGwsZi5wcm9wcyk7ZC5yZWY9RmQoYSxsLGYpO2QucmV0dXJuPWE7YT1kO2JyZWFrIGF9YyhhLGwpO2JyZWFrfWVsc2UgYihhLGwpO2w9bC5zaWJsaW5nfWYudHlwZT09PWhhPyhkPU5kKGYucHJvcHMuY2hpbGRyZW4sYS5tb2RlLGgsZi5rZXkpLGQucmV0dXJuPWEsYT1kKTooaD1MZChmLnR5cGUsZi5rZXksZi5wcm9wcyxudWxsLGEubW9kZSxoKSxoLnJlZj1GZChhLGQsZiksaC5yZXR1cm49XG5hLGE9aCl9cmV0dXJuIGcoYSk7Y2FzZSBmYTphOntmb3IobD1mLmtleTtudWxsIT09ZDspe2lmKGQua2V5PT09bClpZig0PT09ZC50YWcmJmQuc3RhdGVOb2RlLmNvbnRhaW5lckluZm89PT1mLmNvbnRhaW5lckluZm8mJmQuc3RhdGVOb2RlLmltcGxlbWVudGF0aW9uPT09Zi5pbXBsZW1lbnRhdGlvbil7YyhhLGQuc2libGluZyk7ZD1lKGQsZi5jaGlsZHJlbnx8W10pO2QucmV0dXJuPWE7YT1kO2JyZWFrIGF9ZWxzZXtjKGEsZCk7YnJlYWt9ZWxzZSBiKGEsZCk7ZD1kLnNpYmxpbmd9ZD1NZChmLGEubW9kZSxoKTtkLnJldHVybj1hO2E9ZH1yZXR1cm4gZyhhKTtjYXNlIHFhOnJldHVybiBsPWYuX2luaXQseWEoYSxkLGwoZi5fcGF5bG9hZCksaCl9aWYoRGEoZikpcmV0dXJuIHcoYSxkLGYsaCk7aWYodGEoZikpcmV0dXJuIFkoYSxkLGYsaCk7R2QoYSxmKX1yZXR1cm5cInN0cmluZ1wiPT09dHlwZW9mIGYmJlwiXCIhPT1mfHxcIm51bWJlclwiPT09dHlwZW9mIGY/KGY9XCJcIitmLG51bGwhPT1kJiZcbjY9PT1kLnRhZz8oYyhhLGQuc2libGluZyksZD1lKGQsZiksZC5yZXR1cm49YSxhPWQpOihjKGEsZCksZD1LZChmLGEubW9kZSxoKSxkLnJldHVybj1hLGE9ZCksZyhhKSk6YyhhLGQpfXJldHVybiB5YX12YXIgT2Q9SWQoITApLFBkPUlkKCExKSxRZD1pYyhudWxsKSxSZD1udWxsLFNkPW51bGwsVGQ9bnVsbDtmdW5jdGlvbiBVZCgpe1RkPVNkPVJkPW51bGx9ZnVuY3Rpb24gVmQoYSxiLGMpe1NhPyh2KFFkLGIuX2N1cnJlbnRWYWx1ZSksYi5fY3VycmVudFZhbHVlPWMpOih2KFFkLGIuX2N1cnJlbnRWYWx1ZTIpLGIuX2N1cnJlbnRWYWx1ZTI9Yyl9ZnVuY3Rpb24gV2QoYSl7dmFyIGI9UWQuY3VycmVudDtxKFFkKTtTYT9hLl9jdXJyZW50VmFsdWU9YjphLl9jdXJyZW50VmFsdWUyPWJ9XG5mdW5jdGlvbiBYZChhLGIsYyl7Zm9yKDtudWxsIT09YTspe3ZhciBkPWEuYWx0ZXJuYXRlOyhhLmNoaWxkTGFuZXMmYikhPT1iPyhhLmNoaWxkTGFuZXN8PWIsbnVsbCE9PWQmJihkLmNoaWxkTGFuZXN8PWIpKTpudWxsIT09ZCYmKGQuY2hpbGRMYW5lcyZiKSE9PWImJihkLmNoaWxkTGFuZXN8PWIpO2lmKGE9PT1jKWJyZWFrO2E9YS5yZXR1cm59fWZ1bmN0aW9uIFlkKGEsYil7UmQ9YTtUZD1TZD1udWxsO2E9YS5kZXBlbmRlbmNpZXM7bnVsbCE9PWEmJm51bGwhPT1hLmZpcnN0Q29udGV4dCYmKDAhPT0oYS5sYW5lcyZiKSYmKEc9ITApLGEuZmlyc3RDb250ZXh0PW51bGwpfVxuZnVuY3Rpb24gWmQoYSl7dmFyIGI9U2E/YS5fY3VycmVudFZhbHVlOmEuX2N1cnJlbnRWYWx1ZTI7aWYoVGQhPT1hKWlmKGE9e2NvbnRleHQ6YSxtZW1vaXplZFZhbHVlOmIsbmV4dDpudWxsfSxudWxsPT09U2Qpe2lmKG51bGw9PT1SZCl0aHJvdyBFcnJvcihuKDMwOCkpO1NkPWE7UmQuZGVwZW5kZW5jaWVzPXtsYW5lczowLGZpcnN0Q29udGV4dDphfX1lbHNlIFNkPVNkLm5leHQ9YTtyZXR1cm4gYn12YXIgJGQ9bnVsbDtmdW5jdGlvbiBhZShhKXtudWxsPT09JGQ/JGQ9W2FdOiRkLnB1c2goYSl9ZnVuY3Rpb24gYmUoYSxiLGMsZCl7dmFyIGU9Yi5pbnRlcmxlYXZlZDtudWxsPT09ZT8oYy5uZXh0PWMsYWUoYikpOihjLm5leHQ9ZS5uZXh0LGUubmV4dD1jKTtiLmludGVybGVhdmVkPWM7cmV0dXJuIGNlKGEsZCl9XG5mdW5jdGlvbiBjZShhLGIpe2EubGFuZXN8PWI7dmFyIGM9YS5hbHRlcm5hdGU7bnVsbCE9PWMmJihjLmxhbmVzfD1iKTtjPWE7Zm9yKGE9YS5yZXR1cm47bnVsbCE9PWE7KWEuY2hpbGRMYW5lc3w9YixjPWEuYWx0ZXJuYXRlLG51bGwhPT1jJiYoYy5jaGlsZExhbmVzfD1iKSxjPWEsYT1hLnJldHVybjtyZXR1cm4gMz09PWMudGFnP2Muc3RhdGVOb2RlOm51bGx9dmFyIGRlPSExO2Z1bmN0aW9uIGVlKGEpe2EudXBkYXRlUXVldWU9e2Jhc2VTdGF0ZTphLm1lbW9pemVkU3RhdGUsZmlyc3RCYXNlVXBkYXRlOm51bGwsbGFzdEJhc2VVcGRhdGU6bnVsbCxzaGFyZWQ6e3BlbmRpbmc6bnVsbCxpbnRlcmxlYXZlZDpudWxsLGxhbmVzOjB9LGVmZmVjdHM6bnVsbH19XG5mdW5jdGlvbiBmZShhLGIpe2E9YS51cGRhdGVRdWV1ZTtiLnVwZGF0ZVF1ZXVlPT09YSYmKGIudXBkYXRlUXVldWU9e2Jhc2VTdGF0ZTphLmJhc2VTdGF0ZSxmaXJzdEJhc2VVcGRhdGU6YS5maXJzdEJhc2VVcGRhdGUsbGFzdEJhc2VVcGRhdGU6YS5sYXN0QmFzZVVwZGF0ZSxzaGFyZWQ6YS5zaGFyZWQsZWZmZWN0czphLmVmZmVjdHN9KX1mdW5jdGlvbiBnZShhLGIpe3JldHVybntldmVudFRpbWU6YSxsYW5lOmIsdGFnOjAscGF5bG9hZDpudWxsLGNhbGxiYWNrOm51bGwsbmV4dDpudWxsfX1cbmZ1bmN0aW9uIGhlKGEsYixjKXt2YXIgZD1hLnVwZGF0ZVF1ZXVlO2lmKG51bGw9PT1kKXJldHVybiBudWxsO2Q9ZC5zaGFyZWQ7aWYoMCE9PShIJjIpKXt2YXIgZT1kLnBlbmRpbmc7bnVsbD09PWU/Yi5uZXh0PWI6KGIubmV4dD1lLm5leHQsZS5uZXh0PWIpO2QucGVuZGluZz1iO3JldHVybiBjZShhLGMpfWU9ZC5pbnRlcmxlYXZlZDtudWxsPT09ZT8oYi5uZXh0PWIsYWUoZCkpOihiLm5leHQ9ZS5uZXh0LGUubmV4dD1iKTtkLmludGVybGVhdmVkPWI7cmV0dXJuIGNlKGEsYyl9ZnVuY3Rpb24gaWUoYSxiLGMpe2I9Yi51cGRhdGVRdWV1ZTtpZihudWxsIT09YiYmKGI9Yi5zaGFyZWQsMCE9PShjJjQxOTQyNDApKSl7dmFyIGQ9Yi5sYW5lcztkJj1hLnBlbmRpbmdMYW5lcztjfD1kO2IubGFuZXM9YztIYyhhLGMpfX1cbmZ1bmN0aW9uIGplKGEsYil7dmFyIGM9YS51cGRhdGVRdWV1ZSxkPWEuYWx0ZXJuYXRlO2lmKG51bGwhPT1kJiYoZD1kLnVwZGF0ZVF1ZXVlLGM9PT1kKSl7dmFyIGU9bnVsbCxmPW51bGw7Yz1jLmZpcnN0QmFzZVVwZGF0ZTtpZihudWxsIT09Yyl7ZG97dmFyIGc9e2V2ZW50VGltZTpjLmV2ZW50VGltZSxsYW5lOmMubGFuZSx0YWc6Yy50YWcscGF5bG9hZDpjLnBheWxvYWQsY2FsbGJhY2s6Yy5jYWxsYmFjayxuZXh0Om51bGx9O251bGw9PT1mP2U9Zj1nOmY9Zi5uZXh0PWc7Yz1jLm5leHR9d2hpbGUobnVsbCE9PWMpO251bGw9PT1mP2U9Zj1iOmY9Zi5uZXh0PWJ9ZWxzZSBlPWY9YjtjPXtiYXNlU3RhdGU6ZC5iYXNlU3RhdGUsZmlyc3RCYXNlVXBkYXRlOmUsbGFzdEJhc2VVcGRhdGU6ZixzaGFyZWQ6ZC5zaGFyZWQsZWZmZWN0czpkLmVmZmVjdHN9O2EudXBkYXRlUXVldWU9YztyZXR1cm59YT1jLmxhc3RCYXNlVXBkYXRlO251bGw9PT1hP2MuZmlyc3RCYXNlVXBkYXRlPWI6YS5uZXh0PVxuYjtjLmxhc3RCYXNlVXBkYXRlPWJ9XG5mdW5jdGlvbiBrZShhLGIsYyxkKXt2YXIgZT1hLnVwZGF0ZVF1ZXVlO2RlPSExO3ZhciBmPWUuZmlyc3RCYXNlVXBkYXRlLGc9ZS5sYXN0QmFzZVVwZGF0ZSxoPWUuc2hhcmVkLnBlbmRpbmc7aWYobnVsbCE9PWgpe2Uuc2hhcmVkLnBlbmRpbmc9bnVsbDt2YXIgaz1oLGw9ay5uZXh0O2submV4dD1udWxsO251bGw9PT1nP2Y9bDpnLm5leHQ9bDtnPWs7dmFyIG09YS5hbHRlcm5hdGU7bnVsbCE9PW0mJihtPW0udXBkYXRlUXVldWUsaD1tLmxhc3RCYXNlVXBkYXRlLGghPT1nJiYobnVsbD09PWg/bS5maXJzdEJhc2VVcGRhdGU9bDpoLm5leHQ9bCxtLmxhc3RCYXNlVXBkYXRlPWspKX1pZihudWxsIT09Zil7dmFyIHI9ZS5iYXNlU3RhdGU7Zz0wO209bD1rPW51bGw7aD1mO2Rve3ZhciBwPWgubGFuZSxCPWguZXZlbnRUaW1lO2lmKChkJnApPT09cCl7bnVsbCE9PW0mJihtPW0ubmV4dD17ZXZlbnRUaW1lOkIsbGFuZTowLHRhZzpoLnRhZyxwYXlsb2FkOmgucGF5bG9hZCxjYWxsYmFjazpoLmNhbGxiYWNrLFxubmV4dDpudWxsfSk7YTp7dmFyIHc9YSxZPWg7cD1iO0I9Yztzd2l0Y2goWS50YWcpe2Nhc2UgMTp3PVkucGF5bG9hZDtpZihcImZ1bmN0aW9uXCI9PT10eXBlb2Ygdyl7cj13LmNhbGwoQixyLHApO2JyZWFrIGF9cj13O2JyZWFrIGE7Y2FzZSAzOncuZmxhZ3M9dy5mbGFncyYtNjU1Mzd8MTI4O2Nhc2UgMDp3PVkucGF5bG9hZDtwPVwiZnVuY3Rpb25cIj09PXR5cGVvZiB3P3cuY2FsbChCLHIscCk6dztpZihudWxsPT09cHx8dm9pZCAwPT09cClicmVhayBhO3I9Y2Eoe30scixwKTticmVhayBhO2Nhc2UgMjpkZT0hMH19bnVsbCE9PWguY2FsbGJhY2smJjAhPT1oLmxhbmUmJihhLmZsYWdzfD02NCxwPWUuZWZmZWN0cyxudWxsPT09cD9lLmVmZmVjdHM9W2hdOnAucHVzaChoKSl9ZWxzZSBCPXtldmVudFRpbWU6QixsYW5lOnAsdGFnOmgudGFnLHBheWxvYWQ6aC5wYXlsb2FkLGNhbGxiYWNrOmguY2FsbGJhY2ssbmV4dDpudWxsfSxudWxsPT09bT8obD1tPUIsaz1yKTptPW0ubmV4dD1CLGd8PVxucDtoPWgubmV4dDtpZihudWxsPT09aClpZihoPWUuc2hhcmVkLnBlbmRpbmcsbnVsbD09PWgpYnJlYWs7ZWxzZSBwPWgsaD1wLm5leHQscC5uZXh0PW51bGwsZS5sYXN0QmFzZVVwZGF0ZT1wLGUuc2hhcmVkLnBlbmRpbmc9bnVsbH13aGlsZSgxKTtudWxsPT09bSYmKGs9cik7ZS5iYXNlU3RhdGU9aztlLmZpcnN0QmFzZVVwZGF0ZT1sO2UubGFzdEJhc2VVcGRhdGU9bTtiPWUuc2hhcmVkLmludGVybGVhdmVkO2lmKG51bGwhPT1iKXtlPWI7ZG8gZ3w9ZS5sYW5lLGU9ZS5uZXh0O3doaWxlKGUhPT1iKX1lbHNlIG51bGw9PT1mJiYoZS5zaGFyZWQubGFuZXM9MCk7bGV8PWc7YS5sYW5lcz1nO2EubWVtb2l6ZWRTdGF0ZT1yfX1cbmZ1bmN0aW9uIG1lKGEsYixjKXthPWIuZWZmZWN0cztiLmVmZmVjdHM9bnVsbDtpZihudWxsIT09YSlmb3IoYj0wO2I8YS5sZW5ndGg7YisrKXt2YXIgZD1hW2JdLGU9ZC5jYWxsYmFjaztpZihudWxsIT09ZSl7ZC5jYWxsYmFjaz1udWxsO2Q9YztpZihcImZ1bmN0aW9uXCIhPT10eXBlb2YgZSl0aHJvdyBFcnJvcihuKDE5MSxlKSk7ZS5jYWxsKGQpfX19dmFyIG5lPXt9LG9lPWljKG5lKSxwZT1pYyhuZSkscWU9aWMobmUpO2Z1bmN0aW9uIHJlKGEpe2lmKGE9PT1uZSl0aHJvdyBFcnJvcihuKDE3NCkpO3JldHVybiBhfWZ1bmN0aW9uIHNlKGEsYil7dihxZSxiKTt2KHBlLGEpO3Yob2UsbmUpO2E9RmEoYik7cShvZSk7dihvZSxhKX1mdW5jdGlvbiB0ZSgpe3Eob2UpO3EocGUpO3EocWUpfWZ1bmN0aW9uIHVlKGEpe3ZhciBiPXJlKHFlLmN1cnJlbnQpLGM9cmUob2UuY3VycmVudCk7Yj1HYShjLGEudHlwZSxiKTtjIT09YiYmKHYocGUsYSksdihvZSxiKSl9XG5mdW5jdGlvbiB2ZShhKXtwZS5jdXJyZW50PT09YSYmKHEob2UpLHEocGUpKX12YXIgST1pYygwKTtmdW5jdGlvbiB3ZShhKXtmb3IodmFyIGI9YTtudWxsIT09Yjspe2lmKDEzPT09Yi50YWcpe3ZhciBjPWIubWVtb2l6ZWRTdGF0ZTtpZihudWxsIT09YyYmKGM9Yy5kZWh5ZHJhdGVkLG51bGw9PT1jfHxKYihjKXx8S2IoYykpKXJldHVybiBifWVsc2UgaWYoMTk9PT1iLnRhZyYmdm9pZCAwIT09Yi5tZW1vaXplZFByb3BzLnJldmVhbE9yZGVyKXtpZigwIT09KGIuZmxhZ3MmMTI4KSlyZXR1cm4gYn1lbHNlIGlmKG51bGwhPT1iLmNoaWxkKXtiLmNoaWxkLnJldHVybj1iO2I9Yi5jaGlsZDtjb250aW51ZX1pZihiPT09YSlicmVhaztmb3IoO251bGw9PT1iLnNpYmxpbmc7KXtpZihudWxsPT09Yi5yZXR1cm58fGIucmV0dXJuPT09YSlyZXR1cm4gbnVsbDtiPWIucmV0dXJufWIuc2libGluZy5yZXR1cm49Yi5yZXR1cm47Yj1iLnNpYmxpbmd9cmV0dXJuIG51bGx9dmFyIHhlPVtdO1xuZnVuY3Rpb24geWUoKXtmb3IodmFyIGE9MDthPHhlLmxlbmd0aDthKyspe3ZhciBiPXhlW2FdO1NhP2IuX3dvcmtJblByb2dyZXNzVmVyc2lvblByaW1hcnk9bnVsbDpiLl93b3JrSW5Qcm9ncmVzc1ZlcnNpb25TZWNvbmRhcnk9bnVsbH14ZS5sZW5ndGg9MH12YXIgemU9ZGEuUmVhY3RDdXJyZW50RGlzcGF0Y2hlcixBZT1kYS5SZWFjdEN1cnJlbnRCYXRjaENvbmZpZyxCZT0wLEo9bnVsbCxLPW51bGwsTD1udWxsLENlPSExLERlPSExLEVlPTAsRmU9MDtmdW5jdGlvbiBNKCl7dGhyb3cgRXJyb3IobigzMjEpKTt9ZnVuY3Rpb24gR2UoYSxiKXtpZihudWxsPT09YilyZXR1cm4hMTtmb3IodmFyIGM9MDtjPGIubGVuZ3RoJiZjPGEubGVuZ3RoO2MrKylpZighVmMoYVtjXSxiW2NdKSlyZXR1cm4hMTtyZXR1cm4hMH1cbmZ1bmN0aW9uIEhlKGEsYixjLGQsZSxmKXtCZT1mO0o9YjtiLm1lbW9pemVkU3RhdGU9bnVsbDtiLnVwZGF0ZVF1ZXVlPW51bGw7Yi5sYW5lcz0wO3plLmN1cnJlbnQ9bnVsbD09PWF8fG51bGw9PT1hLm1lbW9pemVkU3RhdGU/SWU6SmU7YT1jKGQsZSk7aWYoRGUpe2Y9MDtkb3tEZT0hMTtFZT0wO2lmKDI1PD1mKXRocm93IEVycm9yKG4oMzAxKSk7Zis9MTtMPUs9bnVsbDtiLnVwZGF0ZVF1ZXVlPW51bGw7emUuY3VycmVudD1LZTthPWMoZCxlKX13aGlsZShEZSl9emUuY3VycmVudD1MZTtiPW51bGwhPT1LJiZudWxsIT09Sy5uZXh0O0JlPTA7TD1LPUo9bnVsbDtDZT0hMTtpZihiKXRocm93IEVycm9yKG4oMzAwKSk7cmV0dXJuIGF9ZnVuY3Rpb24gTWUoKXt2YXIgYT0wIT09RWU7RWU9MDtyZXR1cm4gYX1cbmZ1bmN0aW9uIE5lKCl7dmFyIGE9e21lbW9pemVkU3RhdGU6bnVsbCxiYXNlU3RhdGU6bnVsbCxiYXNlUXVldWU6bnVsbCxxdWV1ZTpudWxsLG5leHQ6bnVsbH07bnVsbD09PUw/Si5tZW1vaXplZFN0YXRlPUw9YTpMPUwubmV4dD1hO3JldHVybiBMfWZ1bmN0aW9uIE9lKCl7aWYobnVsbD09PUspe3ZhciBhPUouYWx0ZXJuYXRlO2E9bnVsbCE9PWE/YS5tZW1vaXplZFN0YXRlOm51bGx9ZWxzZSBhPUsubmV4dDt2YXIgYj1udWxsPT09TD9KLm1lbW9pemVkU3RhdGU6TC5uZXh0O2lmKG51bGwhPT1iKUw9YixLPWE7ZWxzZXtpZihudWxsPT09YSl0aHJvdyBFcnJvcihuKDMxMCkpO0s9YTthPXttZW1vaXplZFN0YXRlOksubWVtb2l6ZWRTdGF0ZSxiYXNlU3RhdGU6Sy5iYXNlU3RhdGUsYmFzZVF1ZXVlOksuYmFzZVF1ZXVlLHF1ZXVlOksucXVldWUsbmV4dDpudWxsfTtudWxsPT09TD9KLm1lbW9pemVkU3RhdGU9TD1hOkw9TC5uZXh0PWF9cmV0dXJuIEx9XG5mdW5jdGlvbiBQZShhLGIpe3JldHVyblwiZnVuY3Rpb25cIj09PXR5cGVvZiBiP2IoYSk6Yn1cbmZ1bmN0aW9uIFFlKGEpe3ZhciBiPU9lKCksYz1iLnF1ZXVlO2lmKG51bGw9PT1jKXRocm93IEVycm9yKG4oMzExKSk7Yy5sYXN0UmVuZGVyZWRSZWR1Y2VyPWE7dmFyIGQ9SyxlPWQuYmFzZVF1ZXVlLGY9Yy5wZW5kaW5nO2lmKG51bGwhPT1mKXtpZihudWxsIT09ZSl7dmFyIGc9ZS5uZXh0O2UubmV4dD1mLm5leHQ7Zi5uZXh0PWd9ZC5iYXNlUXVldWU9ZT1mO2MucGVuZGluZz1udWxsfWlmKG51bGwhPT1lKXtmPWUubmV4dDtkPWQuYmFzZVN0YXRlO3ZhciBoPWc9bnVsbCxrPW51bGwsbD1mO2Rve3ZhciBtPWwubGFuZTtpZigoQmUmbSk9PT1tKW51bGwhPT1rJiYoaz1rLm5leHQ9e2xhbmU6MCxhY3Rpb246bC5hY3Rpb24saGFzRWFnZXJTdGF0ZTpsLmhhc0VhZ2VyU3RhdGUsZWFnZXJTdGF0ZTpsLmVhZ2VyU3RhdGUsbmV4dDpudWxsfSksZD1sLmhhc0VhZ2VyU3RhdGU/bC5lYWdlclN0YXRlOmEoZCxsLmFjdGlvbik7ZWxzZXt2YXIgcj17bGFuZTptLGFjdGlvbjpsLmFjdGlvbixoYXNFYWdlclN0YXRlOmwuaGFzRWFnZXJTdGF0ZSxcbmVhZ2VyU3RhdGU6bC5lYWdlclN0YXRlLG5leHQ6bnVsbH07bnVsbD09PWs/KGg9az1yLGc9ZCk6az1rLm5leHQ9cjtKLmxhbmVzfD1tO2xlfD1tfWw9bC5uZXh0fXdoaWxlKG51bGwhPT1sJiZsIT09Zik7bnVsbD09PWs/Zz1kOmsubmV4dD1oO1ZjKGQsYi5tZW1vaXplZFN0YXRlKXx8KEc9ITApO2IubWVtb2l6ZWRTdGF0ZT1kO2IuYmFzZVN0YXRlPWc7Yi5iYXNlUXVldWU9aztjLmxhc3RSZW5kZXJlZFN0YXRlPWR9YT1jLmludGVybGVhdmVkO2lmKG51bGwhPT1hKXtlPWE7ZG8gZj1lLmxhbmUsSi5sYW5lc3w9ZixsZXw9ZixlPWUubmV4dDt3aGlsZShlIT09YSl9ZWxzZSBudWxsPT09ZSYmKGMubGFuZXM9MCk7cmV0dXJuW2IubWVtb2l6ZWRTdGF0ZSxjLmRpc3BhdGNoXX1cbmZ1bmN0aW9uIFJlKGEpe3ZhciBiPU9lKCksYz1iLnF1ZXVlO2lmKG51bGw9PT1jKXRocm93IEVycm9yKG4oMzExKSk7Yy5sYXN0UmVuZGVyZWRSZWR1Y2VyPWE7dmFyIGQ9Yy5kaXNwYXRjaCxlPWMucGVuZGluZyxmPWIubWVtb2l6ZWRTdGF0ZTtpZihudWxsIT09ZSl7Yy5wZW5kaW5nPW51bGw7dmFyIGc9ZT1lLm5leHQ7ZG8gZj1hKGYsZy5hY3Rpb24pLGc9Zy5uZXh0O3doaWxlKGchPT1lKTtWYyhmLGIubWVtb2l6ZWRTdGF0ZSl8fChHPSEwKTtiLm1lbW9pemVkU3RhdGU9ZjtudWxsPT09Yi5iYXNlUXVldWUmJihiLmJhc2VTdGF0ZT1mKTtjLmxhc3RSZW5kZXJlZFN0YXRlPWZ9cmV0dXJuW2YsZF19ZnVuY3Rpb24gU2UoKXt9XG5mdW5jdGlvbiBUZShhLGIpe3ZhciBjPUosZD1PZSgpLGU9YigpLGY9IVZjKGQubWVtb2l6ZWRTdGF0ZSxlKTtmJiYoZC5tZW1vaXplZFN0YXRlPWUsRz0hMCk7ZD1kLnF1ZXVlO1VlKFZlLmJpbmQobnVsbCxjLGQsYSksW2FdKTtpZihkLmdldFNuYXBzaG90IT09Ynx8Znx8bnVsbCE9PUwmJkwubWVtb2l6ZWRTdGF0ZS50YWcmMSl7Yy5mbGFnc3w9MjA0ODtXZSg5LFhlLmJpbmQobnVsbCxjLGQsZSxiKSx2b2lkIDAsbnVsbCk7aWYobnVsbD09PU4pdGhyb3cgRXJyb3IobigzNDkpKTswIT09KEJlJjMwKXx8WWUoYyxiLGUpfXJldHVybiBlfWZ1bmN0aW9uIFllKGEsYixjKXthLmZsYWdzfD0xNjM4NDthPXtnZXRTbmFwc2hvdDpiLHZhbHVlOmN9O2I9Si51cGRhdGVRdWV1ZTtudWxsPT09Yj8oYj17bGFzdEVmZmVjdDpudWxsLHN0b3JlczpudWxsfSxKLnVwZGF0ZVF1ZXVlPWIsYi5zdG9yZXM9W2FdKTooYz1iLnN0b3JlcyxudWxsPT09Yz9iLnN0b3Jlcz1bYV06Yy5wdXNoKGEpKX1cbmZ1bmN0aW9uIFhlKGEsYixjLGQpe2IudmFsdWU9YztiLmdldFNuYXBzaG90PWQ7WmUoYikmJiRlKGEpfWZ1bmN0aW9uIFZlKGEsYixjKXtyZXR1cm4gYyhmdW5jdGlvbigpe1plKGIpJiYkZShhKX0pfWZ1bmN0aW9uIFplKGEpe3ZhciBiPWEuZ2V0U25hcHNob3Q7YT1hLnZhbHVlO3RyeXt2YXIgYz1iKCk7cmV0dXJuIVZjKGEsYyl9Y2F0Y2goZCl7cmV0dXJuITB9fWZ1bmN0aW9uICRlKGEpe3ZhciBiPWNlKGEsMSk7bnVsbCE9PWImJmFmKGIsYSwxLC0xKX1cbmZ1bmN0aW9uIGJmKGEpe3ZhciBiPU5lKCk7XCJmdW5jdGlvblwiPT09dHlwZW9mIGEmJihhPWEoKSk7Yi5tZW1vaXplZFN0YXRlPWIuYmFzZVN0YXRlPWE7YT17cGVuZGluZzpudWxsLGludGVybGVhdmVkOm51bGwsbGFuZXM6MCxkaXNwYXRjaDpudWxsLGxhc3RSZW5kZXJlZFJlZHVjZXI6UGUsbGFzdFJlbmRlcmVkU3RhdGU6YX07Yi5xdWV1ZT1hO2E9YS5kaXNwYXRjaD1jZi5iaW5kKG51bGwsSixhKTtyZXR1cm5bYi5tZW1vaXplZFN0YXRlLGFdfVxuZnVuY3Rpb24gV2UoYSxiLGMsZCl7YT17dGFnOmEsY3JlYXRlOmIsZGVzdHJveTpjLGRlcHM6ZCxuZXh0Om51bGx9O2I9Si51cGRhdGVRdWV1ZTtudWxsPT09Yj8oYj17bGFzdEVmZmVjdDpudWxsLHN0b3JlczpudWxsfSxKLnVwZGF0ZVF1ZXVlPWIsYi5sYXN0RWZmZWN0PWEubmV4dD1hKTooYz1iLmxhc3RFZmZlY3QsbnVsbD09PWM/Yi5sYXN0RWZmZWN0PWEubmV4dD1hOihkPWMubmV4dCxjLm5leHQ9YSxhLm5leHQ9ZCxiLmxhc3RFZmZlY3Q9YSkpO3JldHVybiBhfWZ1bmN0aW9uIGRmKCl7cmV0dXJuIE9lKCkubWVtb2l6ZWRTdGF0ZX1mdW5jdGlvbiBlZihhLGIsYyxkKXt2YXIgZT1OZSgpO0ouZmxhZ3N8PWE7ZS5tZW1vaXplZFN0YXRlPVdlKDF8YixjLHZvaWQgMCx2b2lkIDA9PT1kP251bGw6ZCl9XG5mdW5jdGlvbiBmZihhLGIsYyxkKXt2YXIgZT1PZSgpO2Q9dm9pZCAwPT09ZD9udWxsOmQ7dmFyIGY9dm9pZCAwO2lmKG51bGwhPT1LKXt2YXIgZz1LLm1lbW9pemVkU3RhdGU7Zj1nLmRlc3Ryb3k7aWYobnVsbCE9PWQmJkdlKGQsZy5kZXBzKSl7ZS5tZW1vaXplZFN0YXRlPVdlKGIsYyxmLGQpO3JldHVybn19Si5mbGFnc3w9YTtlLm1lbW9pemVkU3RhdGU9V2UoMXxiLGMsZixkKX1mdW5jdGlvbiBnZihhLGIpe3JldHVybiBlZig4MzkwNjU2LDgsYSxiKX1mdW5jdGlvbiBVZShhLGIpe3JldHVybiBmZigyMDQ4LDgsYSxiKX1mdW5jdGlvbiBoZihhLGIpe3JldHVybiBmZig0LDIsYSxiKX1mdW5jdGlvbiBqZihhLGIpe3JldHVybiBmZig0LDQsYSxiKX1cbmZ1bmN0aW9uIGtmKGEsYil7aWYoXCJmdW5jdGlvblwiPT09dHlwZW9mIGIpcmV0dXJuIGE9YSgpLGIoYSksZnVuY3Rpb24oKXtiKG51bGwpfTtpZihudWxsIT09YiYmdm9pZCAwIT09YilyZXR1cm4gYT1hKCksYi5jdXJyZW50PWEsZnVuY3Rpb24oKXtiLmN1cnJlbnQ9bnVsbH19ZnVuY3Rpb24gbGYoYSxiLGMpe2M9bnVsbCE9PWMmJnZvaWQgMCE9PWM/Yy5jb25jYXQoW2FdKTpudWxsO3JldHVybiBmZig0LDQsa2YuYmluZChudWxsLGIsYSksYyl9ZnVuY3Rpb24gbWYoKXt9ZnVuY3Rpb24gbmYoYSxiKXt2YXIgYz1PZSgpO2I9dm9pZCAwPT09Yj9udWxsOmI7dmFyIGQ9Yy5tZW1vaXplZFN0YXRlO2lmKG51bGwhPT1kJiZudWxsIT09YiYmR2UoYixkWzFdKSlyZXR1cm4gZFswXTtjLm1lbW9pemVkU3RhdGU9W2EsYl07cmV0dXJuIGF9XG5mdW5jdGlvbiBvZihhLGIpe3ZhciBjPU9lKCk7Yj12b2lkIDA9PT1iP251bGw6Yjt2YXIgZD1jLm1lbW9pemVkU3RhdGU7aWYobnVsbCE9PWQmJm51bGwhPT1iJiZHZShiLGRbMV0pKXJldHVybiBkWzBdO2E9YSgpO2MubWVtb2l6ZWRTdGF0ZT1bYSxiXTtyZXR1cm4gYX1mdW5jdGlvbiBwZihhLGIsYyl7aWYoMD09PShCZSYyMSkpcmV0dXJuIGEuYmFzZVN0YXRlJiYoYS5iYXNlU3RhdGU9ITEsRz0hMCksYS5tZW1vaXplZFN0YXRlPWM7VmMoYyxiKXx8KGM9RGMoKSxKLmxhbmVzfD1jLGxlfD1jLGEuYmFzZVN0YXRlPSEwKTtyZXR1cm4gYn1mdW5jdGlvbiBxZihhLGIpe3ZhciBjPUM7Qz0wIT09YyYmND5jP2M6NDthKCEwKTt2YXIgZD1BZS50cmFuc2l0aW9uO0FlLnRyYW5zaXRpb249e307dHJ5e2EoITEpLGIoKX1maW5hbGx5e0M9YyxBZS50cmFuc2l0aW9uPWR9fWZ1bmN0aW9uIHJmKCl7cmV0dXJuIE9lKCkubWVtb2l6ZWRTdGF0ZX1cbmZ1bmN0aW9uIHNmKGEsYixjKXt2YXIgZD10ZihhKTtjPXtsYW5lOmQsYWN0aW9uOmMsaGFzRWFnZXJTdGF0ZTohMSxlYWdlclN0YXRlOm51bGwsbmV4dDpudWxsfTtpZih1ZihhKSl2ZihiLGMpO2Vsc2UgaWYoYz1iZShhLGIsYyxkKSxudWxsIT09Yyl7dmFyIGU9TygpO2FmKGMsYSxkLGUpO3dmKGMsYixkKX19XG5mdW5jdGlvbiBjZihhLGIsYyl7dmFyIGQ9dGYoYSksZT17bGFuZTpkLGFjdGlvbjpjLGhhc0VhZ2VyU3RhdGU6ITEsZWFnZXJTdGF0ZTpudWxsLG5leHQ6bnVsbH07aWYodWYoYSkpdmYoYixlKTtlbHNle3ZhciBmPWEuYWx0ZXJuYXRlO2lmKDA9PT1hLmxhbmVzJiYobnVsbD09PWZ8fDA9PT1mLmxhbmVzKSYmKGY9Yi5sYXN0UmVuZGVyZWRSZWR1Y2VyLG51bGwhPT1mKSl0cnl7dmFyIGc9Yi5sYXN0UmVuZGVyZWRTdGF0ZSxoPWYoZyxjKTtlLmhhc0VhZ2VyU3RhdGU9ITA7ZS5lYWdlclN0YXRlPWg7aWYoVmMoaCxnKSl7dmFyIGs9Yi5pbnRlcmxlYXZlZDtudWxsPT09az8oZS5uZXh0PWUsYWUoYikpOihlLm5leHQ9ay5uZXh0LGsubmV4dD1lKTtiLmludGVybGVhdmVkPWU7cmV0dXJufX1jYXRjaChsKXt9ZmluYWxseXt9Yz1iZShhLGIsZSxkKTtudWxsIT09YyYmKGU9TygpLGFmKGMsYSxkLGUpLHdmKGMsYixkKSl9fVxuZnVuY3Rpb24gdWYoYSl7dmFyIGI9YS5hbHRlcm5hdGU7cmV0dXJuIGE9PT1KfHxudWxsIT09YiYmYj09PUp9ZnVuY3Rpb24gdmYoYSxiKXtEZT1DZT0hMDt2YXIgYz1hLnBlbmRpbmc7bnVsbD09PWM/Yi5uZXh0PWI6KGIubmV4dD1jLm5leHQsYy5uZXh0PWIpO2EucGVuZGluZz1ifWZ1bmN0aW9uIHdmKGEsYixjKXtpZigwIT09KGMmNDE5NDI0MCkpe3ZhciBkPWIubGFuZXM7ZCY9YS5wZW5kaW5nTGFuZXM7Y3w9ZDtiLmxhbmVzPWM7SGMoYSxjKX19XG52YXIgTGU9e3JlYWRDb250ZXh0OlpkLHVzZUNhbGxiYWNrOk0sdXNlQ29udGV4dDpNLHVzZUVmZmVjdDpNLHVzZUltcGVyYXRpdmVIYW5kbGU6TSx1c2VJbnNlcnRpb25FZmZlY3Q6TSx1c2VMYXlvdXRFZmZlY3Q6TSx1c2VNZW1vOk0sdXNlUmVkdWNlcjpNLHVzZVJlZjpNLHVzZVN0YXRlOk0sdXNlRGVidWdWYWx1ZTpNLHVzZURlZmVycmVkVmFsdWU6TSx1c2VUcmFuc2l0aW9uOk0sdXNlTXV0YWJsZVNvdXJjZTpNLHVzZVN5bmNFeHRlcm5hbFN0b3JlOk0sdXNlSWQ6TSx1bnN0YWJsZV9pc05ld1JlY29uY2lsZXI6ITF9LEllPXtyZWFkQ29udGV4dDpaZCx1c2VDYWxsYmFjazpmdW5jdGlvbihhLGIpe05lKCkubWVtb2l6ZWRTdGF0ZT1bYSx2b2lkIDA9PT1iP251bGw6Yl07cmV0dXJuIGF9LHVzZUNvbnRleHQ6WmQsdXNlRWZmZWN0OmdmLHVzZUltcGVyYXRpdmVIYW5kbGU6ZnVuY3Rpb24oYSxiLGMpe2M9bnVsbCE9PWMmJnZvaWQgMCE9PWM/Yy5jb25jYXQoW2FdKTpudWxsO3JldHVybiBlZig0MTk0MzA4LFxuNCxrZi5iaW5kKG51bGwsYixhKSxjKX0sdXNlTGF5b3V0RWZmZWN0OmZ1bmN0aW9uKGEsYil7cmV0dXJuIGVmKDQxOTQzMDgsNCxhLGIpfSx1c2VJbnNlcnRpb25FZmZlY3Q6ZnVuY3Rpb24oYSxiKXtyZXR1cm4gZWYoNCwyLGEsYil9LHVzZU1lbW86ZnVuY3Rpb24oYSxiKXt2YXIgYz1OZSgpO2I9dm9pZCAwPT09Yj9udWxsOmI7YT1hKCk7Yy5tZW1vaXplZFN0YXRlPVthLGJdO3JldHVybiBhfSx1c2VSZWR1Y2VyOmZ1bmN0aW9uKGEsYixjKXt2YXIgZD1OZSgpO2I9dm9pZCAwIT09Yz9jKGIpOmI7ZC5tZW1vaXplZFN0YXRlPWQuYmFzZVN0YXRlPWI7YT17cGVuZGluZzpudWxsLGludGVybGVhdmVkOm51bGwsbGFuZXM6MCxkaXNwYXRjaDpudWxsLGxhc3RSZW5kZXJlZFJlZHVjZXI6YSxsYXN0UmVuZGVyZWRTdGF0ZTpifTtkLnF1ZXVlPWE7YT1hLmRpc3BhdGNoPXNmLmJpbmQobnVsbCxKLGEpO3JldHVybltkLm1lbW9pemVkU3RhdGUsYV19LHVzZVJlZjpmdW5jdGlvbihhKXt2YXIgYj1cbk5lKCk7YT17Y3VycmVudDphfTtyZXR1cm4gYi5tZW1vaXplZFN0YXRlPWF9LHVzZVN0YXRlOmJmLHVzZURlYnVnVmFsdWU6bWYsdXNlRGVmZXJyZWRWYWx1ZTpmdW5jdGlvbihhKXtyZXR1cm4gTmUoKS5tZW1vaXplZFN0YXRlPWF9LHVzZVRyYW5zaXRpb246ZnVuY3Rpb24oKXt2YXIgYT1iZighMSksYj1hWzBdO2E9cWYuYmluZChudWxsLGFbMV0pO05lKCkubWVtb2l6ZWRTdGF0ZT1hO3JldHVybltiLGFdfSx1c2VNdXRhYmxlU291cmNlOmZ1bmN0aW9uKCl7fSx1c2VTeW5jRXh0ZXJuYWxTdG9yZTpmdW5jdGlvbihhLGIsYyl7dmFyIGQ9SixlPU5lKCk7aWYoRil7aWYodm9pZCAwPT09Yyl0aHJvdyBFcnJvcihuKDQwNykpO2M9YygpfWVsc2V7Yz1iKCk7aWYobnVsbD09PU4pdGhyb3cgRXJyb3IobigzNDkpKTswIT09KEJlJjMwKXx8WWUoZCxiLGMpfWUubWVtb2l6ZWRTdGF0ZT1jO3ZhciBmPXt2YWx1ZTpjLGdldFNuYXBzaG90OmJ9O2UucXVldWU9ZjtnZihWZS5iaW5kKG51bGwsZCxcbmYsYSksW2FdKTtkLmZsYWdzfD0yMDQ4O1dlKDksWGUuYmluZChudWxsLGQsZixjLGIpLHZvaWQgMCxudWxsKTtyZXR1cm4gY30sdXNlSWQ6ZnVuY3Rpb24oKXt2YXIgYT1OZSgpLGI9Ti5pZGVudGlmaWVyUHJlZml4O2lmKEYpe3ZhciBjPWpkO3ZhciBkPWlkO2M9KGQmfigxPDwzMi10YyhkKS0xKSkudG9TdHJpbmcoMzIpK2M7Yj1cIjpcIitiK1wiUlwiK2M7Yz1FZSsrOzA8YyYmKGIrPVwiSFwiK2MudG9TdHJpbmcoMzIpKTtiKz1cIjpcIn1lbHNlIGM9RmUrKyxiPVwiOlwiK2IrXCJyXCIrYy50b1N0cmluZygzMikrXCI6XCI7cmV0dXJuIGEubWVtb2l6ZWRTdGF0ZT1ifSx1bnN0YWJsZV9pc05ld1JlY29uY2lsZXI6ITF9LEplPXtyZWFkQ29udGV4dDpaZCx1c2VDYWxsYmFjazpuZix1c2VDb250ZXh0OlpkLHVzZUVmZmVjdDpVZSx1c2VJbXBlcmF0aXZlSGFuZGxlOmxmLHVzZUluc2VydGlvbkVmZmVjdDpoZix1c2VMYXlvdXRFZmZlY3Q6amYsdXNlTWVtbzpvZix1c2VSZWR1Y2VyOlFlLHVzZVJlZjpkZix1c2VTdGF0ZTpmdW5jdGlvbigpe3JldHVybiBRZShQZSl9LFxudXNlRGVidWdWYWx1ZTptZix1c2VEZWZlcnJlZFZhbHVlOmZ1bmN0aW9uKGEpe3ZhciBiPU9lKCk7cmV0dXJuIHBmKGIsSy5tZW1vaXplZFN0YXRlLGEpfSx1c2VUcmFuc2l0aW9uOmZ1bmN0aW9uKCl7dmFyIGE9UWUoUGUpWzBdLGI9T2UoKS5tZW1vaXplZFN0YXRlO3JldHVyblthLGJdfSx1c2VNdXRhYmxlU291cmNlOlNlLHVzZVN5bmNFeHRlcm5hbFN0b3JlOlRlLHVzZUlkOnJmLHVuc3RhYmxlX2lzTmV3UmVjb25jaWxlcjohMX0sS2U9e3JlYWRDb250ZXh0OlpkLHVzZUNhbGxiYWNrOm5mLHVzZUNvbnRleHQ6WmQsdXNlRWZmZWN0OlVlLHVzZUltcGVyYXRpdmVIYW5kbGU6bGYsdXNlSW5zZXJ0aW9uRWZmZWN0OmhmLHVzZUxheW91dEVmZmVjdDpqZix1c2VNZW1vOm9mLHVzZVJlZHVjZXI6UmUsdXNlUmVmOmRmLHVzZVN0YXRlOmZ1bmN0aW9uKCl7cmV0dXJuIFJlKFBlKX0sdXNlRGVidWdWYWx1ZTptZix1c2VEZWZlcnJlZFZhbHVlOmZ1bmN0aW9uKGEpe3ZhciBiPU9lKCk7cmV0dXJuIG51bGw9PT1cbks/Yi5tZW1vaXplZFN0YXRlPWE6cGYoYixLLm1lbW9pemVkU3RhdGUsYSl9LHVzZVRyYW5zaXRpb246ZnVuY3Rpb24oKXt2YXIgYT1SZShQZSlbMF0sYj1PZSgpLm1lbW9pemVkU3RhdGU7cmV0dXJuW2EsYl19LHVzZU11dGFibGVTb3VyY2U6U2UsdXNlU3luY0V4dGVybmFsU3RvcmU6VGUsdXNlSWQ6cmYsdW5zdGFibGVfaXNOZXdSZWNvbmNpbGVyOiExfTtmdW5jdGlvbiB4ZihhLGIpe2lmKGEmJmEuZGVmYXVsdFByb3BzKXtiPWNhKHt9LGIpO2E9YS5kZWZhdWx0UHJvcHM7Zm9yKHZhciBjIGluIGEpdm9pZCAwPT09YltjXSYmKGJbY109YVtjXSk7cmV0dXJuIGJ9cmV0dXJuIGJ9ZnVuY3Rpb24geWYoYSxiLGMsZCl7Yj1hLm1lbW9pemVkU3RhdGU7Yz1jKGQsYik7Yz1udWxsPT09Y3x8dm9pZCAwPT09Yz9iOmNhKHt9LGIsYyk7YS5tZW1vaXplZFN0YXRlPWM7MD09PWEubGFuZXMmJihhLnVwZGF0ZVF1ZXVlLmJhc2VTdGF0ZT1jKX1cbnZhciB6Zj17aXNNb3VudGVkOmZ1bmN0aW9uKGEpe3JldHVybihhPWEuX3JlYWN0SW50ZXJuYWxzKT93YShhKT09PWE6ITF9LGVucXVldWVTZXRTdGF0ZTpmdW5jdGlvbihhLGIsYyl7YT1hLl9yZWFjdEludGVybmFsczt2YXIgZD1PKCksZT10ZihhKSxmPWdlKGQsZSk7Zi5wYXlsb2FkPWI7dm9pZCAwIT09YyYmbnVsbCE9PWMmJihmLmNhbGxiYWNrPWMpO2I9aGUoYSxmLGUpO251bGwhPT1iJiYoYWYoYixhLGUsZCksaWUoYixhLGUpKX0sZW5xdWV1ZVJlcGxhY2VTdGF0ZTpmdW5jdGlvbihhLGIsYyl7YT1hLl9yZWFjdEludGVybmFsczt2YXIgZD1PKCksZT10ZihhKSxmPWdlKGQsZSk7Zi50YWc9MTtmLnBheWxvYWQ9Yjt2b2lkIDAhPT1jJiZudWxsIT09YyYmKGYuY2FsbGJhY2s9Yyk7Yj1oZShhLGYsZSk7bnVsbCE9PWImJihhZihiLGEsZSxkKSxpZShiLGEsZSkpfSxlbnF1ZXVlRm9yY2VVcGRhdGU6ZnVuY3Rpb24oYSxiKXthPWEuX3JlYWN0SW50ZXJuYWxzO3ZhciBjPU8oKSxkPVxudGYoYSksZT1nZShjLGQpO2UudGFnPTI7dm9pZCAwIT09YiYmbnVsbCE9PWImJihlLmNhbGxiYWNrPWIpO2I9aGUoYSxlLGQpO251bGwhPT1iJiYoYWYoYixhLGQsYyksaWUoYixhLGQpKX19O2Z1bmN0aW9uIEFmKGEsYixjLGQsZSxmLGcpe2E9YS5zdGF0ZU5vZGU7cmV0dXJuXCJmdW5jdGlvblwiPT09dHlwZW9mIGEuc2hvdWxkQ29tcG9uZW50VXBkYXRlP2Euc2hvdWxkQ29tcG9uZW50VXBkYXRlKGQsZixnKTpiLnByb3RvdHlwZSYmYi5wcm90b3R5cGUuaXNQdXJlUmVhY3RDb21wb25lbnQ/IURkKGMsZCl8fCFEZChlLGYpOiEwfVxuZnVuY3Rpb24gQmYoYSxiLGMpe3ZhciBkPSExLGU9amM7dmFyIGY9Yi5jb250ZXh0VHlwZTtcIm9iamVjdFwiPT09dHlwZW9mIGYmJm51bGwhPT1mP2Y9WmQoZik6KGU9QShiKT9rYzp4LmN1cnJlbnQsZD1iLmNvbnRleHRUeXBlcyxmPShkPW51bGwhPT1kJiZ2b2lkIDAhPT1kKT9tYyhhLGUpOmpjKTtiPW5ldyBiKGMsZik7YS5tZW1vaXplZFN0YXRlPW51bGwhPT1iLnN0YXRlJiZ2b2lkIDAhPT1iLnN0YXRlP2Iuc3RhdGU6bnVsbDtiLnVwZGF0ZXI9emY7YS5zdGF0ZU5vZGU9YjtiLl9yZWFjdEludGVybmFscz1hO2QmJihhPWEuc3RhdGVOb2RlLGEuX19yZWFjdEludGVybmFsTWVtb2l6ZWRVbm1hc2tlZENoaWxkQ29udGV4dD1lLGEuX19yZWFjdEludGVybmFsTWVtb2l6ZWRNYXNrZWRDaGlsZENvbnRleHQ9Zik7cmV0dXJuIGJ9XG5mdW5jdGlvbiBDZihhLGIsYyxkKXthPWIuc3RhdGU7XCJmdW5jdGlvblwiPT09dHlwZW9mIGIuY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wcyYmYi5jb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzKGMsZCk7XCJmdW5jdGlvblwiPT09dHlwZW9mIGIuVU5TQUZFX2NvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMmJmIuVU5TQUZFX2NvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMoYyxkKTtiLnN0YXRlIT09YSYmemYuZW5xdWV1ZVJlcGxhY2VTdGF0ZShiLGIuc3RhdGUsbnVsbCl9XG5mdW5jdGlvbiBEZihhLGIsYyxkKXt2YXIgZT1hLnN0YXRlTm9kZTtlLnByb3BzPWM7ZS5zdGF0ZT1hLm1lbW9pemVkU3RhdGU7ZS5yZWZzPXt9O2VlKGEpO3ZhciBmPWIuY29udGV4dFR5cGU7XCJvYmplY3RcIj09PXR5cGVvZiBmJiZudWxsIT09Zj9lLmNvbnRleHQ9WmQoZik6KGY9QShiKT9rYzp4LmN1cnJlbnQsZS5jb250ZXh0PW1jKGEsZikpO2Uuc3RhdGU9YS5tZW1vaXplZFN0YXRlO2Y9Yi5nZXREZXJpdmVkU3RhdGVGcm9tUHJvcHM7XCJmdW5jdGlvblwiPT09dHlwZW9mIGYmJih5ZihhLGIsZixjKSxlLnN0YXRlPWEubWVtb2l6ZWRTdGF0ZSk7XCJmdW5jdGlvblwiPT09dHlwZW9mIGIuZ2V0RGVyaXZlZFN0YXRlRnJvbVByb3BzfHxcImZ1bmN0aW9uXCI9PT10eXBlb2YgZS5nZXRTbmFwc2hvdEJlZm9yZVVwZGF0ZXx8XCJmdW5jdGlvblwiIT09dHlwZW9mIGUuVU5TQUZFX2NvbXBvbmVudFdpbGxNb3VudCYmXCJmdW5jdGlvblwiIT09dHlwZW9mIGUuY29tcG9uZW50V2lsbE1vdW50fHwoYj1lLnN0YXRlLFxuXCJmdW5jdGlvblwiPT09dHlwZW9mIGUuY29tcG9uZW50V2lsbE1vdW50JiZlLmNvbXBvbmVudFdpbGxNb3VudCgpLFwiZnVuY3Rpb25cIj09PXR5cGVvZiBlLlVOU0FGRV9jb21wb25lbnRXaWxsTW91bnQmJmUuVU5TQUZFX2NvbXBvbmVudFdpbGxNb3VudCgpLGIhPT1lLnN0YXRlJiZ6Zi5lbnF1ZXVlUmVwbGFjZVN0YXRlKGUsZS5zdGF0ZSxudWxsKSxrZShhLGMsZSxkKSxlLnN0YXRlPWEubWVtb2l6ZWRTdGF0ZSk7XCJmdW5jdGlvblwiPT09dHlwZW9mIGUuY29tcG9uZW50RGlkTW91bnQmJihhLmZsYWdzfD00MTk0MzA4KX1mdW5jdGlvbiBFZihhLGIpe3RyeXt2YXIgYz1cIlwiLGQ9YjtkbyBjKz1FZChkKSxkPWQucmV0dXJuO3doaWxlKGQpO3ZhciBlPWN9Y2F0Y2goZil7ZT1cIlxcbkVycm9yIGdlbmVyYXRpbmcgc3RhY2s6IFwiK2YubWVzc2FnZStcIlxcblwiK2Yuc3RhY2t9cmV0dXJue3ZhbHVlOmEsc291cmNlOmIsc3RhY2s6ZSxkaWdlc3Q6bnVsbH19XG5mdW5jdGlvbiBGZihhLGIsYyl7cmV0dXJue3ZhbHVlOmEsc291cmNlOm51bGwsc3RhY2s6bnVsbCE9Yz9jOm51bGwsZGlnZXN0Om51bGwhPWI/YjpudWxsfX1mdW5jdGlvbiBHZihhLGIpe3RyeXtjb25zb2xlLmVycm9yKGIudmFsdWUpfWNhdGNoKGMpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXt0aHJvdyBjO30pfX12YXIgSGY9XCJmdW5jdGlvblwiPT09dHlwZW9mIFdlYWtNYXA/V2Vha01hcDpNYXA7ZnVuY3Rpb24gSWYoYSxiLGMpe2M9Z2UoLTEsYyk7Yy50YWc9MztjLnBheWxvYWQ9e2VsZW1lbnQ6bnVsbH07dmFyIGQ9Yi52YWx1ZTtjLmNhbGxiYWNrPWZ1bmN0aW9uKCl7SmZ8fChKZj0hMCxLZj1kKTtHZihhLGIpfTtyZXR1cm4gY31cbmZ1bmN0aW9uIExmKGEsYixjKXtjPWdlKC0xLGMpO2MudGFnPTM7dmFyIGQ9YS50eXBlLmdldERlcml2ZWRTdGF0ZUZyb21FcnJvcjtpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgZCl7dmFyIGU9Yi52YWx1ZTtjLnBheWxvYWQ9ZnVuY3Rpb24oKXtyZXR1cm4gZChlKX07Yy5jYWxsYmFjaz1mdW5jdGlvbigpe0dmKGEsYil9fXZhciBmPWEuc3RhdGVOb2RlO251bGwhPT1mJiZcImZ1bmN0aW9uXCI9PT10eXBlb2YgZi5jb21wb25lbnREaWRDYXRjaCYmKGMuY2FsbGJhY2s9ZnVuY3Rpb24oKXtHZihhLGIpO1wiZnVuY3Rpb25cIiE9PXR5cGVvZiBkJiYobnVsbD09PU1mP01mPW5ldyBTZXQoW3RoaXNdKTpNZi5hZGQodGhpcykpO3ZhciBjPWIuc3RhY2s7dGhpcy5jb21wb25lbnREaWRDYXRjaChiLnZhbHVlLHtjb21wb25lbnRTdGFjazpudWxsIT09Yz9jOlwiXCJ9KX0pO3JldHVybiBjfVxuZnVuY3Rpb24gTmYoYSxiLGMpe3ZhciBkPWEucGluZ0NhY2hlO2lmKG51bGw9PT1kKXtkPWEucGluZ0NhY2hlPW5ldyBIZjt2YXIgZT1uZXcgU2V0O2Quc2V0KGIsZSl9ZWxzZSBlPWQuZ2V0KGIpLHZvaWQgMD09PWUmJihlPW5ldyBTZXQsZC5zZXQoYixlKSk7ZS5oYXMoYyl8fChlLmFkZChjKSxhPU9mLmJpbmQobnVsbCxhLGIsYyksYi50aGVuKGEsYSkpfWZ1bmN0aW9uIFBmKGEpe2Rve3ZhciBiO2lmKGI9MTM9PT1hLnRhZyliPWEubWVtb2l6ZWRTdGF0ZSxiPW51bGwhPT1iP251bGwhPT1iLmRlaHlkcmF0ZWQ/ITA6ITE6ITA7aWYoYilyZXR1cm4gYTthPWEucmV0dXJufXdoaWxlKG51bGwhPT1hKTtyZXR1cm4gbnVsbH1cbmZ1bmN0aW9uIFFmKGEsYixjLGQsZSl7aWYoMD09PShhLm1vZGUmMSkpcmV0dXJuIGE9PT1iP2EuZmxhZ3N8PTY1NTM2OihhLmZsYWdzfD0xMjgsYy5mbGFnc3w9MTMxMDcyLGMuZmxhZ3MmPS01MjgwNSwxPT09Yy50YWcmJihudWxsPT09Yy5hbHRlcm5hdGU/Yy50YWc9MTc6KGI9Z2UoLTEsMSksYi50YWc9MixoZShjLGIsMSkpKSxjLmxhbmVzfD0xKSxhO2EuZmxhZ3N8PTY1NTM2O2EubGFuZXM9ZTtyZXR1cm4gYX12YXIgUmY9ZGEuUmVhY3RDdXJyZW50T3duZXIsRz0hMTtmdW5jdGlvbiBQKGEsYixjLGQpe2IuY2hpbGQ9bnVsbD09PWE/UGQoYixudWxsLGMsZCk6T2QoYixhLmNoaWxkLGMsZCl9XG5mdW5jdGlvbiBTZihhLGIsYyxkLGUpe2M9Yy5yZW5kZXI7dmFyIGY9Yi5yZWY7WWQoYixlKTtkPUhlKGEsYixjLGQsZixlKTtjPU1lKCk7aWYobnVsbCE9PWEmJiFHKXJldHVybiBiLnVwZGF0ZVF1ZXVlPWEudXBkYXRlUXVldWUsYi5mbGFncyY9LTIwNTMsYS5sYW5lcyY9fmUsVGYoYSxiLGUpO0YmJmMmJm1kKGIpO2IuZmxhZ3N8PTE7UChhLGIsZCxlKTtyZXR1cm4gYi5jaGlsZH1cbmZ1bmN0aW9uIFVmKGEsYixjLGQsZSl7aWYobnVsbD09PWEpe3ZhciBmPWMudHlwZTtpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgZiYmIVZmKGYpJiZ2b2lkIDA9PT1mLmRlZmF1bHRQcm9wcyYmbnVsbD09PWMuY29tcGFyZSYmdm9pZCAwPT09Yy5kZWZhdWx0UHJvcHMpcmV0dXJuIGIudGFnPTE1LGIudHlwZT1mLFdmKGEsYixmLGQsZSk7YT1MZChjLnR5cGUsbnVsbCxkLGIsYi5tb2RlLGUpO2EucmVmPWIucmVmO2EucmV0dXJuPWI7cmV0dXJuIGIuY2hpbGQ9YX1mPWEuY2hpbGQ7aWYoMD09PShhLmxhbmVzJmUpKXt2YXIgZz1mLm1lbW9pemVkUHJvcHM7Yz1jLmNvbXBhcmU7Yz1udWxsIT09Yz9jOkRkO2lmKGMoZyxkKSYmYS5yZWY9PT1iLnJlZilyZXR1cm4gVGYoYSxiLGUpfWIuZmxhZ3N8PTE7YT1KZChmLGQpO2EucmVmPWIucmVmO2EucmV0dXJuPWI7cmV0dXJuIGIuY2hpbGQ9YX1cbmZ1bmN0aW9uIFdmKGEsYixjLGQsZSl7aWYobnVsbCE9PWEpe3ZhciBmPWEubWVtb2l6ZWRQcm9wcztpZihEZChmLGQpJiZhLnJlZj09PWIucmVmKWlmKEc9ITEsYi5wZW5kaW5nUHJvcHM9ZD1mLDAhPT0oYS5sYW5lcyZlKSkwIT09KGEuZmxhZ3MmMTMxMDcyKSYmKEc9ITApO2Vsc2UgcmV0dXJuIGIubGFuZXM9YS5sYW5lcyxUZihhLGIsZSl9cmV0dXJuIFhmKGEsYixjLGQsZSl9XG5mdW5jdGlvbiBZZihhLGIsYyl7dmFyIGQ9Yi5wZW5kaW5nUHJvcHMsZT1kLmNoaWxkcmVuLGY9bnVsbCE9PWE/YS5tZW1vaXplZFN0YXRlOm51bGw7aWYoXCJoaWRkZW5cIj09PWQubW9kZSlpZigwPT09KGIubW9kZSYxKSliLm1lbW9pemVkU3RhdGU9e2Jhc2VMYW5lczowLGNhY2hlUG9vbDpudWxsLHRyYW5zaXRpb25zOm51bGx9LHYoWmYsJGYpLCRmfD1jO2Vsc2V7aWYoMD09PShjJjEwNzM3NDE4MjQpKXJldHVybiBhPW51bGwhPT1mP2YuYmFzZUxhbmVzfGM6YyxiLmxhbmVzPWIuY2hpbGRMYW5lcz0xMDczNzQxODI0LGIubWVtb2l6ZWRTdGF0ZT17YmFzZUxhbmVzOmEsY2FjaGVQb29sOm51bGwsdHJhbnNpdGlvbnM6bnVsbH0sYi51cGRhdGVRdWV1ZT1udWxsLHYoWmYsJGYpLCRmfD1hLG51bGw7Yi5tZW1vaXplZFN0YXRlPXtiYXNlTGFuZXM6MCxjYWNoZVBvb2w6bnVsbCx0cmFuc2l0aW9uczpudWxsfTtkPW51bGwhPT1mP2YuYmFzZUxhbmVzOmM7dihaZiwkZik7JGZ8PWR9ZWxzZSBudWxsIT09XG5mPyhkPWYuYmFzZUxhbmVzfGMsYi5tZW1vaXplZFN0YXRlPW51bGwpOmQ9Yyx2KFpmLCRmKSwkZnw9ZDtQKGEsYixlLGMpO3JldHVybiBiLmNoaWxkfWZ1bmN0aW9uIGFnKGEsYil7dmFyIGM9Yi5yZWY7aWYobnVsbD09PWEmJm51bGwhPT1jfHxudWxsIT09YSYmYS5yZWYhPT1jKWIuZmxhZ3N8PTUxMixiLmZsYWdzfD0yMDk3MTUyfWZ1bmN0aW9uIFhmKGEsYixjLGQsZSl7dmFyIGY9QShjKT9rYzp4LmN1cnJlbnQ7Zj1tYyhiLGYpO1lkKGIsZSk7Yz1IZShhLGIsYyxkLGYsZSk7ZD1NZSgpO2lmKG51bGwhPT1hJiYhRylyZXR1cm4gYi51cGRhdGVRdWV1ZT1hLnVwZGF0ZVF1ZXVlLGIuZmxhZ3MmPS0yMDUzLGEubGFuZXMmPX5lLFRmKGEsYixlKTtGJiZkJiZtZChiKTtiLmZsYWdzfD0xO1AoYSxiLGMsZSk7cmV0dXJuIGIuY2hpbGR9XG5mdW5jdGlvbiBiZyhhLGIsYyxkLGUpe2lmKEEoYykpe3ZhciBmPSEwO3FjKGIpfWVsc2UgZj0hMTtZZChiLGUpO2lmKG51bGw9PT1iLnN0YXRlTm9kZSljZyhhLGIpLEJmKGIsYyxkKSxEZihiLGMsZCxlKSxkPSEwO2Vsc2UgaWYobnVsbD09PWEpe3ZhciBnPWIuc3RhdGVOb2RlLGg9Yi5tZW1vaXplZFByb3BzO2cucHJvcHM9aDt2YXIgaz1nLmNvbnRleHQsbD1jLmNvbnRleHRUeXBlO1wib2JqZWN0XCI9PT10eXBlb2YgbCYmbnVsbCE9PWw/bD1aZChsKToobD1BKGMpP2tjOnguY3VycmVudCxsPW1jKGIsbCkpO3ZhciBtPWMuZ2V0RGVyaXZlZFN0YXRlRnJvbVByb3BzLHI9XCJmdW5jdGlvblwiPT09dHlwZW9mIG18fFwiZnVuY3Rpb25cIj09PXR5cGVvZiBnLmdldFNuYXBzaG90QmVmb3JlVXBkYXRlO3J8fFwiZnVuY3Rpb25cIiE9PXR5cGVvZiBnLlVOU0FGRV9jb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzJiZcImZ1bmN0aW9uXCIhPT10eXBlb2YgZy5jb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzfHwoaCE9PVxuZHx8ayE9PWwpJiZDZihiLGcsZCxsKTtkZT0hMTt2YXIgcD1iLm1lbW9pemVkU3RhdGU7Zy5zdGF0ZT1wO2tlKGIsZCxnLGUpO2s9Yi5tZW1vaXplZFN0YXRlO2ghPT1kfHxwIT09a3x8ei5jdXJyZW50fHxkZT8oXCJmdW5jdGlvblwiPT09dHlwZW9mIG0mJih5ZihiLGMsbSxkKSxrPWIubWVtb2l6ZWRTdGF0ZSksKGg9ZGV8fEFmKGIsYyxoLGQscCxrLGwpKT8ocnx8XCJmdW5jdGlvblwiIT09dHlwZW9mIGcuVU5TQUZFX2NvbXBvbmVudFdpbGxNb3VudCYmXCJmdW5jdGlvblwiIT09dHlwZW9mIGcuY29tcG9uZW50V2lsbE1vdW50fHwoXCJmdW5jdGlvblwiPT09dHlwZW9mIGcuY29tcG9uZW50V2lsbE1vdW50JiZnLmNvbXBvbmVudFdpbGxNb3VudCgpLFwiZnVuY3Rpb25cIj09PXR5cGVvZiBnLlVOU0FGRV9jb21wb25lbnRXaWxsTW91bnQmJmcuVU5TQUZFX2NvbXBvbmVudFdpbGxNb3VudCgpKSxcImZ1bmN0aW9uXCI9PT10eXBlb2YgZy5jb21wb25lbnREaWRNb3VudCYmKGIuZmxhZ3N8PTQxOTQzMDgpKTpcbihcImZ1bmN0aW9uXCI9PT10eXBlb2YgZy5jb21wb25lbnREaWRNb3VudCYmKGIuZmxhZ3N8PTQxOTQzMDgpLGIubWVtb2l6ZWRQcm9wcz1kLGIubWVtb2l6ZWRTdGF0ZT1rKSxnLnByb3BzPWQsZy5zdGF0ZT1rLGcuY29udGV4dD1sLGQ9aCk6KFwiZnVuY3Rpb25cIj09PXR5cGVvZiBnLmNvbXBvbmVudERpZE1vdW50JiYoYi5mbGFnc3w9NDE5NDMwOCksZD0hMSl9ZWxzZXtnPWIuc3RhdGVOb2RlO2ZlKGEsYik7aD1iLm1lbW9pemVkUHJvcHM7bD1iLnR5cGU9PT1iLmVsZW1lbnRUeXBlP2g6eGYoYi50eXBlLGgpO2cucHJvcHM9bDtyPWIucGVuZGluZ1Byb3BzO3A9Zy5jb250ZXh0O2s9Yy5jb250ZXh0VHlwZTtcIm9iamVjdFwiPT09dHlwZW9mIGsmJm51bGwhPT1rP2s9WmQoayk6KGs9QShjKT9rYzp4LmN1cnJlbnQsaz1tYyhiLGspKTt2YXIgQj1jLmdldERlcml2ZWRTdGF0ZUZyb21Qcm9wczsobT1cImZ1bmN0aW9uXCI9PT10eXBlb2YgQnx8XCJmdW5jdGlvblwiPT09dHlwZW9mIGcuZ2V0U25hcHNob3RCZWZvcmVVcGRhdGUpfHxcblwiZnVuY3Rpb25cIiE9PXR5cGVvZiBnLlVOU0FGRV9jb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzJiZcImZ1bmN0aW9uXCIhPT10eXBlb2YgZy5jb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzfHwoaCE9PXJ8fHAhPT1rKSYmQ2YoYixnLGQsayk7ZGU9ITE7cD1iLm1lbW9pemVkU3RhdGU7Zy5zdGF0ZT1wO2tlKGIsZCxnLGUpO3ZhciB3PWIubWVtb2l6ZWRTdGF0ZTtoIT09cnx8cCE9PXd8fHouY3VycmVudHx8ZGU/KFwiZnVuY3Rpb25cIj09PXR5cGVvZiBCJiYoeWYoYixjLEIsZCksdz1iLm1lbW9pemVkU3RhdGUpLChsPWRlfHxBZihiLGMsbCxkLHAsdyxrKXx8ITEpPyhtfHxcImZ1bmN0aW9uXCIhPT10eXBlb2YgZy5VTlNBRkVfY29tcG9uZW50V2lsbFVwZGF0ZSYmXCJmdW5jdGlvblwiIT09dHlwZW9mIGcuY29tcG9uZW50V2lsbFVwZGF0ZXx8KFwiZnVuY3Rpb25cIj09PXR5cGVvZiBnLmNvbXBvbmVudFdpbGxVcGRhdGUmJmcuY29tcG9uZW50V2lsbFVwZGF0ZShkLHcsayksXCJmdW5jdGlvblwiPT09dHlwZW9mIGcuVU5TQUZFX2NvbXBvbmVudFdpbGxVcGRhdGUmJlxuZy5VTlNBRkVfY29tcG9uZW50V2lsbFVwZGF0ZShkLHcsaykpLFwiZnVuY3Rpb25cIj09PXR5cGVvZiBnLmNvbXBvbmVudERpZFVwZGF0ZSYmKGIuZmxhZ3N8PTQpLFwiZnVuY3Rpb25cIj09PXR5cGVvZiBnLmdldFNuYXBzaG90QmVmb3JlVXBkYXRlJiYoYi5mbGFnc3w9MTAyNCkpOihcImZ1bmN0aW9uXCIhPT10eXBlb2YgZy5jb21wb25lbnREaWRVcGRhdGV8fGg9PT1hLm1lbW9pemVkUHJvcHMmJnA9PT1hLm1lbW9pemVkU3RhdGV8fChiLmZsYWdzfD00KSxcImZ1bmN0aW9uXCIhPT10eXBlb2YgZy5nZXRTbmFwc2hvdEJlZm9yZVVwZGF0ZXx8aD09PWEubWVtb2l6ZWRQcm9wcyYmcD09PWEubWVtb2l6ZWRTdGF0ZXx8KGIuZmxhZ3N8PTEwMjQpLGIubWVtb2l6ZWRQcm9wcz1kLGIubWVtb2l6ZWRTdGF0ZT13KSxnLnByb3BzPWQsZy5zdGF0ZT13LGcuY29udGV4dD1rLGQ9bCk6KFwiZnVuY3Rpb25cIiE9PXR5cGVvZiBnLmNvbXBvbmVudERpZFVwZGF0ZXx8aD09PWEubWVtb2l6ZWRQcm9wcyYmcD09PVxuYS5tZW1vaXplZFN0YXRlfHwoYi5mbGFnc3w9NCksXCJmdW5jdGlvblwiIT09dHlwZW9mIGcuZ2V0U25hcHNob3RCZWZvcmVVcGRhdGV8fGg9PT1hLm1lbW9pemVkUHJvcHMmJnA9PT1hLm1lbW9pemVkU3RhdGV8fChiLmZsYWdzfD0xMDI0KSxkPSExKX1yZXR1cm4gZGcoYSxiLGMsZCxmLGUpfVxuZnVuY3Rpb24gZGcoYSxiLGMsZCxlLGYpe2FnKGEsYik7dmFyIGc9MCE9PShiLmZsYWdzJjEyOCk7aWYoIWQmJiFnKXJldHVybiBlJiZyYyhiLGMsITEpLFRmKGEsYixmKTtkPWIuc3RhdGVOb2RlO1JmLmN1cnJlbnQ9Yjt2YXIgaD1nJiZcImZ1bmN0aW9uXCIhPT10eXBlb2YgYy5nZXREZXJpdmVkU3RhdGVGcm9tRXJyb3I/bnVsbDpkLnJlbmRlcigpO2IuZmxhZ3N8PTE7bnVsbCE9PWEmJmc/KGIuY2hpbGQ9T2QoYixhLmNoaWxkLG51bGwsZiksYi5jaGlsZD1PZChiLG51bGwsaCxmKSk6UChhLGIsaCxmKTtiLm1lbW9pemVkU3RhdGU9ZC5zdGF0ZTtlJiZyYyhiLGMsITApO3JldHVybiBiLmNoaWxkfWZ1bmN0aW9uIGVnKGEpe3ZhciBiPWEuc3RhdGVOb2RlO2IucGVuZGluZ0NvbnRleHQ/b2MoYSxiLnBlbmRpbmdDb250ZXh0LGIucGVuZGluZ0NvbnRleHQhPT1iLmNvbnRleHQpOmIuY29udGV4dCYmb2MoYSxiLmNvbnRleHQsITEpO3NlKGEsYi5jb250YWluZXJJbmZvKX1cbmZ1bmN0aW9uIGZnKGEsYixjLGQsZSl7QWQoKTtCZChlKTtiLmZsYWdzfD0yNTY7UChhLGIsYyxkKTtyZXR1cm4gYi5jaGlsZH12YXIgZ2c9e2RlaHlkcmF0ZWQ6bnVsbCx0cmVlQ29udGV4dDpudWxsLHJldHJ5TGFuZTowfTtmdW5jdGlvbiBoZyhhKXtyZXR1cm57YmFzZUxhbmVzOmEsY2FjaGVQb29sOm51bGwsdHJhbnNpdGlvbnM6bnVsbH19XG5mdW5jdGlvbiBpZyhhLGIsYyl7dmFyIGQ9Yi5wZW5kaW5nUHJvcHMsZT1JLmN1cnJlbnQsZj0hMSxnPTAhPT0oYi5mbGFncyYxMjgpLGg7KGg9Zyl8fChoPW51bGwhPT1hJiZudWxsPT09YS5tZW1vaXplZFN0YXRlPyExOjAhPT0oZSYyKSk7aWYoaClmPSEwLGIuZmxhZ3MmPS0xMjk7ZWxzZSBpZihudWxsPT09YXx8bnVsbCE9PWEubWVtb2l6ZWRTdGF0ZSllfD0xO3YoSSxlJjEpO2lmKG51bGw9PT1hKXt3ZChiKTthPWIubWVtb2l6ZWRTdGF0ZTtpZihudWxsIT09YSYmKGE9YS5kZWh5ZHJhdGVkLG51bGwhPT1hKSlyZXR1cm4gMD09PShiLm1vZGUmMSk/Yi5sYW5lcz0xOktiKGEpP2IubGFuZXM9ODpiLmxhbmVzPTEwNzM3NDE4MjQsbnVsbDtnPWQuY2hpbGRyZW47YT1kLmZhbGxiYWNrO3JldHVybiBmPyhkPWIubW9kZSxmPWIuY2hpbGQsZz17bW9kZTpcImhpZGRlblwiLGNoaWxkcmVuOmd9LDA9PT0oZCYxKSYmbnVsbCE9PWY/KGYuY2hpbGRMYW5lcz0wLGYucGVuZGluZ1Byb3BzPWcpOlxuZj1qZyhnLGQsMCxudWxsKSxhPU5kKGEsZCxjLG51bGwpLGYucmV0dXJuPWIsYS5yZXR1cm49YixmLnNpYmxpbmc9YSxiLmNoaWxkPWYsYi5jaGlsZC5tZW1vaXplZFN0YXRlPWhnKGMpLGIubWVtb2l6ZWRTdGF0ZT1nZyxhKTprZyhiLGcpfWU9YS5tZW1vaXplZFN0YXRlO2lmKG51bGwhPT1lJiYoaD1lLmRlaHlkcmF0ZWQsbnVsbCE9PWgpKXJldHVybiBsZyhhLGIsZyxkLGgsZSxjKTtpZihmKXtmPWQuZmFsbGJhY2s7Zz1iLm1vZGU7ZT1hLmNoaWxkO2g9ZS5zaWJsaW5nO3ZhciBrPXttb2RlOlwiaGlkZGVuXCIsY2hpbGRyZW46ZC5jaGlsZHJlbn07MD09PShnJjEpJiZiLmNoaWxkIT09ZT8oZD1iLmNoaWxkLGQuY2hpbGRMYW5lcz0wLGQucGVuZGluZ1Byb3BzPWssYi5kZWxldGlvbnM9bnVsbCk6KGQ9SmQoZSxrKSxkLnN1YnRyZWVGbGFncz1lLnN1YnRyZWVGbGFncyYxNDY4MDA2NCk7bnVsbCE9PWg/Zj1KZChoLGYpOihmPU5kKGYsZyxjLG51bGwpLGYuZmxhZ3N8PTIpO2YucmV0dXJuPVxuYjtkLnJldHVybj1iO2Quc2libGluZz1mO2IuY2hpbGQ9ZDtkPWY7Zj1iLmNoaWxkO2c9YS5jaGlsZC5tZW1vaXplZFN0YXRlO2c9bnVsbD09PWc/aGcoYyk6e2Jhc2VMYW5lczpnLmJhc2VMYW5lc3xjLGNhY2hlUG9vbDpudWxsLHRyYW5zaXRpb25zOmcudHJhbnNpdGlvbnN9O2YubWVtb2l6ZWRTdGF0ZT1nO2YuY2hpbGRMYW5lcz1hLmNoaWxkTGFuZXMmfmM7Yi5tZW1vaXplZFN0YXRlPWdnO3JldHVybiBkfWY9YS5jaGlsZDthPWYuc2libGluZztkPUpkKGYse21vZGU6XCJ2aXNpYmxlXCIsY2hpbGRyZW46ZC5jaGlsZHJlbn0pOzA9PT0oYi5tb2RlJjEpJiYoZC5sYW5lcz1jKTtkLnJldHVybj1iO2Quc2libGluZz1udWxsO251bGwhPT1hJiYoYz1iLmRlbGV0aW9ucyxudWxsPT09Yz8oYi5kZWxldGlvbnM9W2FdLGIuZmxhZ3N8PTE2KTpjLnB1c2goYSkpO2IuY2hpbGQ9ZDtiLm1lbW9pemVkU3RhdGU9bnVsbDtyZXR1cm4gZH1cbmZ1bmN0aW9uIGtnKGEsYil7Yj1qZyh7bW9kZTpcInZpc2libGVcIixjaGlsZHJlbjpifSxhLm1vZGUsMCxudWxsKTtiLnJldHVybj1hO3JldHVybiBhLmNoaWxkPWJ9ZnVuY3Rpb24gbWcoYSxiLGMsZCl7bnVsbCE9PWQmJkJkKGQpO09kKGIsYS5jaGlsZCxudWxsLGMpO2E9a2coYixiLnBlbmRpbmdQcm9wcy5jaGlsZHJlbik7YS5mbGFnc3w9MjtiLm1lbW9pemVkU3RhdGU9bnVsbDtyZXR1cm4gYX1cbmZ1bmN0aW9uIGxnKGEsYixjLGQsZSxmLGcpe2lmKGMpe2lmKGIuZmxhZ3MmMjU2KXJldHVybiBiLmZsYWdzJj0tMjU3LGQ9RmYoRXJyb3Iobig0MjIpKSksbWcoYSxiLGcsZCk7aWYobnVsbCE9PWIubWVtb2l6ZWRTdGF0ZSlyZXR1cm4gYi5jaGlsZD1hLmNoaWxkLGIuZmxhZ3N8PTEyOCxudWxsO2Y9ZC5mYWxsYmFjaztlPWIubW9kZTtkPWpnKHttb2RlOlwidmlzaWJsZVwiLGNoaWxkcmVuOmQuY2hpbGRyZW59LGUsMCxudWxsKTtmPU5kKGYsZSxnLG51bGwpO2YuZmxhZ3N8PTI7ZC5yZXR1cm49YjtmLnJldHVybj1iO2Quc2libGluZz1mO2IuY2hpbGQ9ZDswIT09KGIubW9kZSYxKSYmT2QoYixhLmNoaWxkLG51bGwsZyk7Yi5jaGlsZC5tZW1vaXplZFN0YXRlPWhnKGcpO2IubWVtb2l6ZWRTdGF0ZT1nZztyZXR1cm4gZn1pZigwPT09KGIubW9kZSYxKSlyZXR1cm4gbWcoYSxiLGcsbnVsbCk7aWYoS2IoZSkpcmV0dXJuIGQ9TGIoZSkuZGlnZXN0LGY9RXJyb3Iobig0MTkpKSxkPUZmKGYsXG5kLHZvaWQgMCksbWcoYSxiLGcsZCk7Yz0wIT09KGcmYS5jaGlsZExhbmVzKTtpZihHfHxjKXtkPU47aWYobnVsbCE9PWQpe3N3aXRjaChnJi1nKXtjYXNlIDQ6ZT0yO2JyZWFrO2Nhc2UgMTY6ZT04O2JyZWFrO2Nhc2UgNjQ6Y2FzZSAxMjg6Y2FzZSAyNTY6Y2FzZSA1MTI6Y2FzZSAxMDI0OmNhc2UgMjA0ODpjYXNlIDQwOTY6Y2FzZSA4MTkyOmNhc2UgMTYzODQ6Y2FzZSAzMjc2ODpjYXNlIDY1NTM2OmNhc2UgMTMxMDcyOmNhc2UgMjYyMTQ0OmNhc2UgNTI0Mjg4OmNhc2UgMTA0ODU3NjpjYXNlIDIwOTcxNTI6Y2FzZSA0MTk0MzA0OmNhc2UgODM4ODYwODpjYXNlIDE2Nzc3MjE2OmNhc2UgMzM1NTQ0MzI6Y2FzZSA2NzEwODg2NDplPTMyO2JyZWFrO2Nhc2UgNTM2ODcwOTEyOmU9MjY4NDM1NDU2O2JyZWFrO2RlZmF1bHQ6ZT0wfWU9MCE9PShlJihkLnN1c3BlbmRlZExhbmVzfGcpKT8wOmU7MCE9PWUmJmUhPT1mLnJldHJ5TGFuZSYmKGYucmV0cnlMYW5lPWUsY2UoYSxlKSxhZihkLGEsXG5lLC0xKSl9bmcoKTtkPUZmKEVycm9yKG4oNDIxKSkpO3JldHVybiBtZyhhLGIsZyxkKX1pZihKYihlKSlyZXR1cm4gYi5mbGFnc3w9MTI4LGIuY2hpbGQ9YS5jaGlsZCxiPW9nLmJpbmQobnVsbCxhKSxNYihlLGIpLG51bGw7YT1mLnRyZWVDb250ZXh0O1ZhJiYocGQ9UWIoZSksb2Q9YixGPSEwLHJkPW51bGwscWQ9ITEsbnVsbCE9PWEmJihmZFtnZCsrXT1pZCxmZFtnZCsrXT1qZCxmZFtnZCsrXT1oZCxpZD1hLmlkLGpkPWEub3ZlcmZsb3csaGQ9YikpO2I9a2coYixkLmNoaWxkcmVuKTtiLmZsYWdzfD00MDk2O3JldHVybiBifWZ1bmN0aW9uIHBnKGEsYixjKXthLmxhbmVzfD1iO3ZhciBkPWEuYWx0ZXJuYXRlO251bGwhPT1kJiYoZC5sYW5lc3w9Yik7WGQoYS5yZXR1cm4sYixjKX1cbmZ1bmN0aW9uIHFnKGEsYixjLGQsZSl7dmFyIGY9YS5tZW1vaXplZFN0YXRlO251bGw9PT1mP2EubWVtb2l6ZWRTdGF0ZT17aXNCYWNrd2FyZHM6YixyZW5kZXJpbmc6bnVsbCxyZW5kZXJpbmdTdGFydFRpbWU6MCxsYXN0OmQsdGFpbDpjLHRhaWxNb2RlOmV9OihmLmlzQmFja3dhcmRzPWIsZi5yZW5kZXJpbmc9bnVsbCxmLnJlbmRlcmluZ1N0YXJ0VGltZT0wLGYubGFzdD1kLGYudGFpbD1jLGYudGFpbE1vZGU9ZSl9XG5mdW5jdGlvbiByZyhhLGIsYyl7dmFyIGQ9Yi5wZW5kaW5nUHJvcHMsZT1kLnJldmVhbE9yZGVyLGY9ZC50YWlsO1AoYSxiLGQuY2hpbGRyZW4sYyk7ZD1JLmN1cnJlbnQ7aWYoMCE9PShkJjIpKWQ9ZCYxfDIsYi5mbGFnc3w9MTI4O2Vsc2V7aWYobnVsbCE9PWEmJjAhPT0oYS5mbGFncyYxMjgpKWE6Zm9yKGE9Yi5jaGlsZDtudWxsIT09YTspe2lmKDEzPT09YS50YWcpbnVsbCE9PWEubWVtb2l6ZWRTdGF0ZSYmcGcoYSxjLGIpO2Vsc2UgaWYoMTk9PT1hLnRhZylwZyhhLGMsYik7ZWxzZSBpZihudWxsIT09YS5jaGlsZCl7YS5jaGlsZC5yZXR1cm49YTthPWEuY2hpbGQ7Y29udGludWV9aWYoYT09PWIpYnJlYWsgYTtmb3IoO251bGw9PT1hLnNpYmxpbmc7KXtpZihudWxsPT09YS5yZXR1cm58fGEucmV0dXJuPT09YilicmVhayBhO2E9YS5yZXR1cm59YS5zaWJsaW5nLnJldHVybj1hLnJldHVybjthPWEuc2libGluZ31kJj0xfXYoSSxkKTtpZigwPT09KGIubW9kZSYxKSliLm1lbW9pemVkU3RhdGU9XG5udWxsO2Vsc2Ugc3dpdGNoKGUpe2Nhc2UgXCJmb3J3YXJkc1wiOmM9Yi5jaGlsZDtmb3IoZT1udWxsO251bGwhPT1jOylhPWMuYWx0ZXJuYXRlLG51bGwhPT1hJiZudWxsPT09d2UoYSkmJihlPWMpLGM9Yy5zaWJsaW5nO2M9ZTtudWxsPT09Yz8oZT1iLmNoaWxkLGIuY2hpbGQ9bnVsbCk6KGU9Yy5zaWJsaW5nLGMuc2libGluZz1udWxsKTtxZyhiLCExLGUsYyxmKTticmVhaztjYXNlIFwiYmFja3dhcmRzXCI6Yz1udWxsO2U9Yi5jaGlsZDtmb3IoYi5jaGlsZD1udWxsO251bGwhPT1lOyl7YT1lLmFsdGVybmF0ZTtpZihudWxsIT09YSYmbnVsbD09PXdlKGEpKXtiLmNoaWxkPWU7YnJlYWt9YT1lLnNpYmxpbmc7ZS5zaWJsaW5nPWM7Yz1lO2U9YX1xZyhiLCEwLGMsbnVsbCxmKTticmVhaztjYXNlIFwidG9nZXRoZXJcIjpxZyhiLCExLG51bGwsbnVsbCx2b2lkIDApO2JyZWFrO2RlZmF1bHQ6Yi5tZW1vaXplZFN0YXRlPW51bGx9cmV0dXJuIGIuY2hpbGR9XG5mdW5jdGlvbiBjZyhhLGIpezA9PT0oYi5tb2RlJjEpJiZudWxsIT09YSYmKGEuYWx0ZXJuYXRlPW51bGwsYi5hbHRlcm5hdGU9bnVsbCxiLmZsYWdzfD0yKX1mdW5jdGlvbiBUZihhLGIsYyl7bnVsbCE9PWEmJihiLmRlcGVuZGVuY2llcz1hLmRlcGVuZGVuY2llcyk7bGV8PWIubGFuZXM7aWYoMD09PShjJmIuY2hpbGRMYW5lcykpcmV0dXJuIG51bGw7aWYobnVsbCE9PWEmJmIuY2hpbGQhPT1hLmNoaWxkKXRocm93IEVycm9yKG4oMTUzKSk7aWYobnVsbCE9PWIuY2hpbGQpe2E9Yi5jaGlsZDtjPUpkKGEsYS5wZW5kaW5nUHJvcHMpO2IuY2hpbGQ9Yztmb3IoYy5yZXR1cm49YjtudWxsIT09YS5zaWJsaW5nOylhPWEuc2libGluZyxjPWMuc2libGluZz1KZChhLGEucGVuZGluZ1Byb3BzKSxjLnJldHVybj1iO2Muc2libGluZz1udWxsfXJldHVybiBiLmNoaWxkfVxuZnVuY3Rpb24gc2coYSxiLGMpe3N3aXRjaChiLnRhZyl7Y2FzZSAzOmVnKGIpO0FkKCk7YnJlYWs7Y2FzZSA1OnVlKGIpO2JyZWFrO2Nhc2UgMTpBKGIudHlwZSkmJnFjKGIpO2JyZWFrO2Nhc2UgNDpzZShiLGIuc3RhdGVOb2RlLmNvbnRhaW5lckluZm8pO2JyZWFrO2Nhc2UgMTA6VmQoYixiLnR5cGUuX2NvbnRleHQsYi5tZW1vaXplZFByb3BzLnZhbHVlKTticmVhaztjYXNlIDEzOnZhciBkPWIubWVtb2l6ZWRTdGF0ZTtpZihudWxsIT09ZCl7aWYobnVsbCE9PWQuZGVoeWRyYXRlZClyZXR1cm4gdihJLEkuY3VycmVudCYxKSxiLmZsYWdzfD0xMjgsbnVsbDtpZigwIT09KGMmYi5jaGlsZC5jaGlsZExhbmVzKSlyZXR1cm4gaWcoYSxiLGMpO3YoSSxJLmN1cnJlbnQmMSk7YT1UZihhLGIsYyk7cmV0dXJuIG51bGwhPT1hP2Euc2libGluZzpudWxsfXYoSSxJLmN1cnJlbnQmMSk7YnJlYWs7Y2FzZSAxOTpkPTAhPT0oYyZiLmNoaWxkTGFuZXMpO2lmKDAhPT0oYS5mbGFncyYxMjgpKXtpZihkKXJldHVybiByZyhhLFxuYixjKTtiLmZsYWdzfD0xMjh9dmFyIGU9Yi5tZW1vaXplZFN0YXRlO251bGwhPT1lJiYoZS5yZW5kZXJpbmc9bnVsbCxlLnRhaWw9bnVsbCxlLmxhc3RFZmZlY3Q9bnVsbCk7dihJLEkuY3VycmVudCk7aWYoZClicmVhaztlbHNlIHJldHVybiBudWxsO2Nhc2UgMjI6Y2FzZSAyMzpyZXR1cm4gYi5sYW5lcz0wLFlmKGEsYixjKX1yZXR1cm4gVGYoYSxiLGMpfWZ1bmN0aW9uIHRnKGEpe2EuZmxhZ3N8PTR9ZnVuY3Rpb24gdWcoYSxiKXtpZihudWxsIT09YSYmYS5jaGlsZD09PWIuY2hpbGQpcmV0dXJuITA7aWYoMCE9PShiLmZsYWdzJjE2KSlyZXR1cm4hMTtmb3IoYT1iLmNoaWxkO251bGwhPT1hOyl7aWYoMCE9PShhLmZsYWdzJjEyODU0KXx8MCE9PShhLnN1YnRyZWVGbGFncyYxMjg1NCkpcmV0dXJuITE7YT1hLnNpYmxpbmd9cmV0dXJuITB9dmFyIHZnLHdnLHhnLHlnO1xuaWYoVGEpdmc9ZnVuY3Rpb24oYSxiKXtmb3IodmFyIGM9Yi5jaGlsZDtudWxsIT09Yzspe2lmKDU9PT1jLnRhZ3x8Nj09PWMudGFnKUthKGEsYy5zdGF0ZU5vZGUpO2Vsc2UgaWYoNCE9PWMudGFnJiZudWxsIT09Yy5jaGlsZCl7Yy5jaGlsZC5yZXR1cm49YztjPWMuY2hpbGQ7Y29udGludWV9aWYoYz09PWIpYnJlYWs7Zm9yKDtudWxsPT09Yy5zaWJsaW5nOyl7aWYobnVsbD09PWMucmV0dXJufHxjLnJldHVybj09PWIpcmV0dXJuO2M9Yy5yZXR1cm59Yy5zaWJsaW5nLnJldHVybj1jLnJldHVybjtjPWMuc2libGluZ319LHdnPWZ1bmN0aW9uKCl7fSx4Zz1mdW5jdGlvbihhLGIsYyxkLGUpe2E9YS5tZW1vaXplZFByb3BzO2lmKGEhPT1kKXt2YXIgZj1iLnN0YXRlTm9kZSxnPXJlKG9lLmN1cnJlbnQpO2M9TWEoZixjLGEsZCxlLGcpOyhiLnVwZGF0ZVF1ZXVlPWMpJiZ0ZyhiKX19LHlnPWZ1bmN0aW9uKGEsYixjLGQpe2MhPT1kJiZ0ZyhiKX07ZWxzZSBpZihVYSl7dmc9ZnVuY3Rpb24oYSxcbmIsYyxkKXtmb3IodmFyIGU9Yi5jaGlsZDtudWxsIT09ZTspe2lmKDU9PT1lLnRhZyl7dmFyIGY9ZS5zdGF0ZU5vZGU7YyYmZCYmKGY9RWIoZixlLnR5cGUsZS5tZW1vaXplZFByb3BzLGUpKTtLYShhLGYpfWVsc2UgaWYoNj09PWUudGFnKWY9ZS5zdGF0ZU5vZGUsYyYmZCYmKGY9RmIoZixlLm1lbW9pemVkUHJvcHMsZSkpLEthKGEsZik7ZWxzZSBpZig0IT09ZS50YWcpaWYoMjI9PT1lLnRhZyYmbnVsbCE9PWUubWVtb2l6ZWRTdGF0ZSlmPWUuY2hpbGQsbnVsbCE9PWYmJihmLnJldHVybj1lKSx2ZyhhLGUsITAsITApO2Vsc2UgaWYobnVsbCE9PWUuY2hpbGQpe2UuY2hpbGQucmV0dXJuPWU7ZT1lLmNoaWxkO2NvbnRpbnVlfWlmKGU9PT1iKWJyZWFrO2Zvcig7bnVsbD09PWUuc2libGluZzspe2lmKG51bGw9PT1lLnJldHVybnx8ZS5yZXR1cm49PT1iKXJldHVybjtlPWUucmV0dXJufWUuc2libGluZy5yZXR1cm49ZS5yZXR1cm47ZT1lLnNpYmxpbmd9fTt2YXIgemc9ZnVuY3Rpb24oYSxcbmIsYyxkKXtmb3IodmFyIGU9Yi5jaGlsZDtudWxsIT09ZTspe2lmKDU9PT1lLnRhZyl7dmFyIGY9ZS5zdGF0ZU5vZGU7YyYmZCYmKGY9RWIoZixlLnR5cGUsZS5tZW1vaXplZFByb3BzLGUpKTtBYihhLGYpfWVsc2UgaWYoNj09PWUudGFnKWY9ZS5zdGF0ZU5vZGUsYyYmZCYmKGY9RmIoZixlLm1lbW9pemVkUHJvcHMsZSkpLEFiKGEsZik7ZWxzZSBpZig0IT09ZS50YWcpaWYoMjI9PT1lLnRhZyYmbnVsbCE9PWUubWVtb2l6ZWRTdGF0ZSlmPWUuY2hpbGQsbnVsbCE9PWYmJihmLnJldHVybj1lKSx6ZyhhLGUsITAsITApO2Vsc2UgaWYobnVsbCE9PWUuY2hpbGQpe2UuY2hpbGQucmV0dXJuPWU7ZT1lLmNoaWxkO2NvbnRpbnVlfWlmKGU9PT1iKWJyZWFrO2Zvcig7bnVsbD09PWUuc2libGluZzspe2lmKG51bGw9PT1lLnJldHVybnx8ZS5yZXR1cm49PT1iKXJldHVybjtlPWUucmV0dXJufWUuc2libGluZy5yZXR1cm49ZS5yZXR1cm47ZT1lLnNpYmxpbmd9fTt3Zz1mdW5jdGlvbihhLGIpe3ZhciBjPVxuYi5zdGF0ZU5vZGU7aWYoIXVnKGEsYikpe2E9Yy5jb250YWluZXJJbmZvO3ZhciBkPXpiKGEpO3pnKGQsYiwhMSwhMSk7Yy5wZW5kaW5nQ2hpbGRyZW49ZDt0ZyhiKTtCYihhLGQpfX07eGc9ZnVuY3Rpb24oYSxiLGMsZCxlKXt2YXIgZj1hLnN0YXRlTm9kZSxnPWEubWVtb2l6ZWRQcm9wcztpZigoYT11ZyhhLGIpKSYmZz09PWQpYi5zdGF0ZU5vZGU9ZjtlbHNle3ZhciBoPWIuc3RhdGVOb2RlLGs9cmUob2UuY3VycmVudCksbD1udWxsO2chPT1kJiYobD1NYShoLGMsZyxkLGUsaykpO2EmJm51bGw9PT1sP2Iuc3RhdGVOb2RlPWY6KGY9eWIoZixsLGMsZyxkLGIsYSxoKSxMYShmLGMsZCxlLGspJiZ0ZyhiKSxiLnN0YXRlTm9kZT1mLGE/dGcoYik6dmcoZixiLCExLCExKSl9fTt5Zz1mdW5jdGlvbihhLGIsYyxkKXtjIT09ZD8oYT1yZShxZS5jdXJyZW50KSxjPXJlKG9lLmN1cnJlbnQpLGIuc3RhdGVOb2RlPU9hKGQsYSxjLGIpLHRnKGIpKTpiLnN0YXRlTm9kZT1hLnN0YXRlTm9kZX19ZWxzZSB3Zz1cbmZ1bmN0aW9uKCl7fSx4Zz1mdW5jdGlvbigpe30seWc9ZnVuY3Rpb24oKXt9O2Z1bmN0aW9uIEFnKGEsYil7aWYoIUYpc3dpdGNoKGEudGFpbE1vZGUpe2Nhc2UgXCJoaWRkZW5cIjpiPWEudGFpbDtmb3IodmFyIGM9bnVsbDtudWxsIT09YjspbnVsbCE9PWIuYWx0ZXJuYXRlJiYoYz1iKSxiPWIuc2libGluZztudWxsPT09Yz9hLnRhaWw9bnVsbDpjLnNpYmxpbmc9bnVsbDticmVhaztjYXNlIFwiY29sbGFwc2VkXCI6Yz1hLnRhaWw7Zm9yKHZhciBkPW51bGw7bnVsbCE9PWM7KW51bGwhPT1jLmFsdGVybmF0ZSYmKGQ9YyksYz1jLnNpYmxpbmc7bnVsbD09PWQ/Ynx8bnVsbD09PWEudGFpbD9hLnRhaWw9bnVsbDphLnRhaWwuc2libGluZz1udWxsOmQuc2libGluZz1udWxsfX1cbmZ1bmN0aW9uIFEoYSl7dmFyIGI9bnVsbCE9PWEuYWx0ZXJuYXRlJiZhLmFsdGVybmF0ZS5jaGlsZD09PWEuY2hpbGQsYz0wLGQ9MDtpZihiKWZvcih2YXIgZT1hLmNoaWxkO251bGwhPT1lOyljfD1lLmxhbmVzfGUuY2hpbGRMYW5lcyxkfD1lLnN1YnRyZWVGbGFncyYxNDY4MDA2NCxkfD1lLmZsYWdzJjE0NjgwMDY0LGUucmV0dXJuPWEsZT1lLnNpYmxpbmc7ZWxzZSBmb3IoZT1hLmNoaWxkO251bGwhPT1lOyljfD1lLmxhbmVzfGUuY2hpbGRMYW5lcyxkfD1lLnN1YnRyZWVGbGFncyxkfD1lLmZsYWdzLGUucmV0dXJuPWEsZT1lLnNpYmxpbmc7YS5zdWJ0cmVlRmxhZ3N8PWQ7YS5jaGlsZExhbmVzPWM7cmV0dXJuIGJ9XG5mdW5jdGlvbiBCZyhhLGIsYyl7dmFyIGQ9Yi5wZW5kaW5nUHJvcHM7bmQoYik7c3dpdGNoKGIudGFnKXtjYXNlIDI6Y2FzZSAxNjpjYXNlIDE1OmNhc2UgMDpjYXNlIDExOmNhc2UgNzpjYXNlIDg6Y2FzZSAxMjpjYXNlIDk6Y2FzZSAxNDpyZXR1cm4gUShiKSxudWxsO2Nhc2UgMTpyZXR1cm4gQShiLnR5cGUpJiZuYygpLFEoYiksbnVsbDtjYXNlIDM6Yz1iLnN0YXRlTm9kZTt0ZSgpO3Eoeik7cSh4KTt5ZSgpO2MucGVuZGluZ0NvbnRleHQmJihjLmNvbnRleHQ9Yy5wZW5kaW5nQ29udGV4dCxjLnBlbmRpbmdDb250ZXh0PW51bGwpO2lmKG51bGw9PT1hfHxudWxsPT09YS5jaGlsZCl5ZChiKT90ZyhiKTpudWxsPT09YXx8YS5tZW1vaXplZFN0YXRlLmlzRGVoeWRyYXRlZCYmMD09PShiLmZsYWdzJjI1Nil8fChiLmZsYWdzfD0xMDI0LG51bGwhPT1yZCYmKENnKHJkKSxyZD1udWxsKSk7d2coYSxiKTtRKGIpO3JldHVybiBudWxsO2Nhc2UgNTp2ZShiKTtjPXJlKHFlLmN1cnJlbnQpO3ZhciBlPVxuYi50eXBlO2lmKG51bGwhPT1hJiZudWxsIT1iLnN0YXRlTm9kZSl4ZyhhLGIsZSxkLGMpLGEucmVmIT09Yi5yZWYmJihiLmZsYWdzfD01MTIsYi5mbGFnc3w9MjA5NzE1Mik7ZWxzZXtpZighZCl7aWYobnVsbD09PWIuc3RhdGVOb2RlKXRocm93IEVycm9yKG4oMTY2KSk7UShiKTtyZXR1cm4gbnVsbH1hPXJlKG9lLmN1cnJlbnQpO2lmKHlkKGIpKXtpZighVmEpdGhyb3cgRXJyb3IobigxNzUpKTthPVJiKGIuc3RhdGVOb2RlLGIudHlwZSxiLm1lbW9pemVkUHJvcHMsYyxhLGIsIXFkKTtiLnVwZGF0ZVF1ZXVlPWE7bnVsbCE9PWEmJnRnKGIpfWVsc2V7dmFyIGY9SmEoZSxkLGMsYSxiKTt2ZyhmLGIsITEsITEpO2Iuc3RhdGVOb2RlPWY7TGEoZixlLGQsYyxhKSYmdGcoYil9bnVsbCE9PWIucmVmJiYoYi5mbGFnc3w9NTEyLGIuZmxhZ3N8PTIwOTcxNTIpfVEoYik7cmV0dXJuIG51bGw7Y2FzZSA2OmlmKGEmJm51bGwhPWIuc3RhdGVOb2RlKXlnKGEsYixhLm1lbW9pemVkUHJvcHMsZCk7XG5lbHNle2lmKFwic3RyaW5nXCIhPT10eXBlb2YgZCYmbnVsbD09PWIuc3RhdGVOb2RlKXRocm93IEVycm9yKG4oMTY2KSk7YT1yZShxZS5jdXJyZW50KTtjPXJlKG9lLmN1cnJlbnQpO2lmKHlkKGIpKXtpZighVmEpdGhyb3cgRXJyb3IobigxNzYpKTthPWIuc3RhdGVOb2RlO2M9Yi5tZW1vaXplZFByb3BzO2lmKGQ9U2IoYSxjLGIsIXFkKSlpZihlPW9kLG51bGwhPT1lKXN3aXRjaChlLnRhZyl7Y2FzZSAzOiRiKGUuc3RhdGVOb2RlLmNvbnRhaW5lckluZm8sYSxjLDAhPT0oZS5tb2RlJjEpKTticmVhaztjYXNlIDU6YWMoZS50eXBlLGUubWVtb2l6ZWRQcm9wcyxlLnN0YXRlTm9kZSxhLGMsMCE9PShlLm1vZGUmMSkpfWQmJnRnKGIpfWVsc2UgYi5zdGF0ZU5vZGU9T2EoZCxhLGMsYil9UShiKTtyZXR1cm4gbnVsbDtjYXNlIDEzOnEoSSk7ZD1iLm1lbW9pemVkU3RhdGU7aWYobnVsbD09PWF8fG51bGwhPT1hLm1lbW9pemVkU3RhdGUmJm51bGwhPT1hLm1lbW9pemVkU3RhdGUuZGVoeWRyYXRlZCl7aWYoRiYmXG5udWxsIT09cGQmJjAhPT0oYi5tb2RlJjEpJiYwPT09KGIuZmxhZ3MmMTI4KSl6ZCgpLEFkKCksYi5mbGFnc3w9OTg1NjAsZT0hMTtlbHNlIGlmKGU9eWQoYiksbnVsbCE9PWQmJm51bGwhPT1kLmRlaHlkcmF0ZWQpe2lmKG51bGw9PT1hKXtpZighZSl0aHJvdyBFcnJvcihuKDMxOCkpO2lmKCFWYSl0aHJvdyBFcnJvcihuKDM0NCkpO2U9Yi5tZW1vaXplZFN0YXRlO2U9bnVsbCE9PWU/ZS5kZWh5ZHJhdGVkOm51bGw7aWYoIWUpdGhyb3cgRXJyb3IobigzMTcpKTtUYihlLGIpfWVsc2UgQWQoKSwwPT09KGIuZmxhZ3MmMTI4KSYmKGIubWVtb2l6ZWRTdGF0ZT1udWxsKSxiLmZsYWdzfD00O1EoYik7ZT0hMX1lbHNlIG51bGwhPT1yZCYmKENnKHJkKSxyZD1udWxsKSxlPSEwO2lmKCFlKXJldHVybiBiLmZsYWdzJjY1NTM2P2I6bnVsbH1pZigwIT09KGIuZmxhZ3MmMTI4KSlyZXR1cm4gYi5sYW5lcz1jLGI7Yz1udWxsIT09ZDtjIT09KG51bGwhPT1hJiZudWxsIT09YS5tZW1vaXplZFN0YXRlKSYmXG5jJiYoYi5jaGlsZC5mbGFnc3w9ODE5MiwwIT09KGIubW9kZSYxKSYmKG51bGw9PT1hfHwwIT09KEkuY3VycmVudCYxKT8wPT09UiYmKFI9Myk6bmcoKSkpO251bGwhPT1iLnVwZGF0ZVF1ZXVlJiYoYi5mbGFnc3w9NCk7UShiKTtyZXR1cm4gbnVsbDtjYXNlIDQ6cmV0dXJuIHRlKCksd2coYSxiKSxudWxsPT09YSYmWGEoYi5zdGF0ZU5vZGUuY29udGFpbmVySW5mbyksUShiKSxudWxsO2Nhc2UgMTA6cmV0dXJuIFdkKGIudHlwZS5fY29udGV4dCksUShiKSxudWxsO2Nhc2UgMTc6cmV0dXJuIEEoYi50eXBlKSYmbmMoKSxRKGIpLG51bGw7Y2FzZSAxOTpxKEkpO2U9Yi5tZW1vaXplZFN0YXRlO2lmKG51bGw9PT1lKXJldHVybiBRKGIpLG51bGw7ZD0wIT09KGIuZmxhZ3MmMTI4KTtmPWUucmVuZGVyaW5nO2lmKG51bGw9PT1mKWlmKGQpQWcoZSwhMSk7ZWxzZXtpZigwIT09Unx8bnVsbCE9PWEmJjAhPT0oYS5mbGFncyYxMjgpKWZvcihhPWIuY2hpbGQ7bnVsbCE9PWE7KXtmPXdlKGEpO2lmKG51bGwhPT1cbmYpe2IuZmxhZ3N8PTEyODtBZyhlLCExKTthPWYudXBkYXRlUXVldWU7bnVsbCE9PWEmJihiLnVwZGF0ZVF1ZXVlPWEsYi5mbGFnc3w9NCk7Yi5zdWJ0cmVlRmxhZ3M9MDthPWM7Zm9yKGM9Yi5jaGlsZDtudWxsIT09YzspZD1jLGU9YSxkLmZsYWdzJj0xNDY4MDA2NixmPWQuYWx0ZXJuYXRlLG51bGw9PT1mPyhkLmNoaWxkTGFuZXM9MCxkLmxhbmVzPWUsZC5jaGlsZD1udWxsLGQuc3VidHJlZUZsYWdzPTAsZC5tZW1vaXplZFByb3BzPW51bGwsZC5tZW1vaXplZFN0YXRlPW51bGwsZC51cGRhdGVRdWV1ZT1udWxsLGQuZGVwZW5kZW5jaWVzPW51bGwsZC5zdGF0ZU5vZGU9bnVsbCk6KGQuY2hpbGRMYW5lcz1mLmNoaWxkTGFuZXMsZC5sYW5lcz1mLmxhbmVzLGQuY2hpbGQ9Zi5jaGlsZCxkLnN1YnRyZWVGbGFncz0wLGQuZGVsZXRpb25zPW51bGwsZC5tZW1vaXplZFByb3BzPWYubWVtb2l6ZWRQcm9wcyxkLm1lbW9pemVkU3RhdGU9Zi5tZW1vaXplZFN0YXRlLGQudXBkYXRlUXVldWU9Zi51cGRhdGVRdWV1ZSxcbmQudHlwZT1mLnR5cGUsZT1mLmRlcGVuZGVuY2llcyxkLmRlcGVuZGVuY2llcz1udWxsPT09ZT9udWxsOntsYW5lczplLmxhbmVzLGZpcnN0Q29udGV4dDplLmZpcnN0Q29udGV4dH0pLGM9Yy5zaWJsaW5nO3YoSSxJLmN1cnJlbnQmMXwyKTtyZXR1cm4gYi5jaGlsZH1hPWEuc2libGluZ31udWxsIT09ZS50YWlsJiZEKCk+RGcmJihiLmZsYWdzfD0xMjgsZD0hMCxBZyhlLCExKSxiLmxhbmVzPTQxOTQzMDQpfWVsc2V7aWYoIWQpaWYoYT13ZShmKSxudWxsIT09YSl7aWYoYi5mbGFnc3w9MTI4LGQ9ITAsYT1hLnVwZGF0ZVF1ZXVlLG51bGwhPT1hJiYoYi51cGRhdGVRdWV1ZT1hLGIuZmxhZ3N8PTQpLEFnKGUsITApLG51bGw9PT1lLnRhaWwmJlwiaGlkZGVuXCI9PT1lLnRhaWxNb2RlJiYhZi5hbHRlcm5hdGUmJiFGKXJldHVybiBRKGIpLG51bGx9ZWxzZSAyKkQoKS1lLnJlbmRlcmluZ1N0YXJ0VGltZT5EZyYmMTA3Mzc0MTgyNCE9PWMmJihiLmZsYWdzfD0xMjgsZD0hMCxBZyhlLCExKSxiLmxhbmVzPVxuNDE5NDMwNCk7ZS5pc0JhY2t3YXJkcz8oZi5zaWJsaW5nPWIuY2hpbGQsYi5jaGlsZD1mKTooYT1lLmxhc3QsbnVsbCE9PWE/YS5zaWJsaW5nPWY6Yi5jaGlsZD1mLGUubGFzdD1mKX1pZihudWxsIT09ZS50YWlsKXJldHVybiBiPWUudGFpbCxlLnJlbmRlcmluZz1iLGUudGFpbD1iLnNpYmxpbmcsZS5yZW5kZXJpbmdTdGFydFRpbWU9RCgpLGIuc2libGluZz1udWxsLGE9SS5jdXJyZW50LHYoSSxkP2EmMXwyOmEmMSksYjtRKGIpO3JldHVybiBudWxsO2Nhc2UgMjI6Y2FzZSAyMzpyZXR1cm4gRWcoKSxjPW51bGwhPT1iLm1lbW9pemVkU3RhdGUsbnVsbCE9PWEmJm51bGwhPT1hLm1lbW9pemVkU3RhdGUhPT1jJiYoYi5mbGFnc3w9ODE5MiksYyYmMCE9PShiLm1vZGUmMSk/MCE9PSgkZiYxMDczNzQxODI0KSYmKFEoYiksVGEmJmIuc3VidHJlZUZsYWdzJjYmJihiLmZsYWdzfD04MTkyKSk6UShiKSxudWxsO2Nhc2UgMjQ6cmV0dXJuIG51bGw7Y2FzZSAyNTpyZXR1cm4gbnVsbH10aHJvdyBFcnJvcihuKDE1NixcbmIudGFnKSk7fVxuZnVuY3Rpb24gRmcoYSxiKXtuZChiKTtzd2l0Y2goYi50YWcpe2Nhc2UgMTpyZXR1cm4gQShiLnR5cGUpJiZuYygpLGE9Yi5mbGFncyxhJjY1NTM2PyhiLmZsYWdzPWEmLTY1NTM3fDEyOCxiKTpudWxsO2Nhc2UgMzpyZXR1cm4gdGUoKSxxKHopLHEoeCkseWUoKSxhPWIuZmxhZ3MsMCE9PShhJjY1NTM2KSYmMD09PShhJjEyOCk/KGIuZmxhZ3M9YSYtNjU1Mzd8MTI4LGIpOm51bGw7Y2FzZSA1OnJldHVybiB2ZShiKSxudWxsO2Nhc2UgMTM6cShJKTthPWIubWVtb2l6ZWRTdGF0ZTtpZihudWxsIT09YSYmbnVsbCE9PWEuZGVoeWRyYXRlZCl7aWYobnVsbD09PWIuYWx0ZXJuYXRlKXRocm93IEVycm9yKG4oMzQwKSk7QWQoKX1hPWIuZmxhZ3M7cmV0dXJuIGEmNjU1MzY/KGIuZmxhZ3M9YSYtNjU1Mzd8MTI4LGIpOm51bGw7Y2FzZSAxOTpyZXR1cm4gcShJKSxudWxsO2Nhc2UgNDpyZXR1cm4gdGUoKSxudWxsO2Nhc2UgMTA6cmV0dXJuIFdkKGIudHlwZS5fY29udGV4dCksbnVsbDtjYXNlIDIyOmNhc2UgMjM6cmV0dXJuIEVnKCksXG5udWxsO2Nhc2UgMjQ6cmV0dXJuIG51bGw7ZGVmYXVsdDpyZXR1cm4gbnVsbH19dmFyIEdnPSExLFM9ITEsSGc9XCJmdW5jdGlvblwiPT09dHlwZW9mIFdlYWtTZXQ/V2Vha1NldDpTZXQsVD1udWxsO2Z1bmN0aW9uIElnKGEsYil7dmFyIGM9YS5yZWY7aWYobnVsbCE9PWMpaWYoXCJmdW5jdGlvblwiPT09dHlwZW9mIGMpdHJ5e2MobnVsbCl9Y2F0Y2goZCl7VShhLGIsZCl9ZWxzZSBjLmN1cnJlbnQ9bnVsbH1mdW5jdGlvbiBKZyhhLGIsYyl7dHJ5e2MoKX1jYXRjaChkKXtVKGEsYixkKX19dmFyIEtnPSExO1xuZnVuY3Rpb24gTGcoYSxiKXtIYShhLmNvbnRhaW5lckluZm8pO2ZvcihUPWI7bnVsbCE9PVQ7KWlmKGE9VCxiPWEuY2hpbGQsMCE9PShhLnN1YnRyZWVGbGFncyYxMDI4KSYmbnVsbCE9PWIpYi5yZXR1cm49YSxUPWI7ZWxzZSBmb3IoO251bGwhPT1UOyl7YT1UO3RyeXt2YXIgYz1hLmFsdGVybmF0ZTtpZigwIT09KGEuZmxhZ3MmMTAyNCkpc3dpdGNoKGEudGFnKXtjYXNlIDA6Y2FzZSAxMTpjYXNlIDE1OmJyZWFrO2Nhc2UgMTppZihudWxsIT09Yyl7dmFyIGQ9Yy5tZW1vaXplZFByb3BzLGU9Yy5tZW1vaXplZFN0YXRlLGY9YS5zdGF0ZU5vZGUsZz1mLmdldFNuYXBzaG90QmVmb3JlVXBkYXRlKGEuZWxlbWVudFR5cGU9PT1hLnR5cGU/ZDp4ZihhLnR5cGUsZCksZSk7Zi5fX3JlYWN0SW50ZXJuYWxTbmFwc2hvdEJlZm9yZVVwZGF0ZT1nfWJyZWFrO2Nhc2UgMzpUYSYmeGIoYS5zdGF0ZU5vZGUuY29udGFpbmVySW5mbyk7YnJlYWs7Y2FzZSA1OmNhc2UgNjpjYXNlIDQ6Y2FzZSAxNzpicmVhaztcbmRlZmF1bHQ6dGhyb3cgRXJyb3IobigxNjMpKTt9fWNhdGNoKGgpe1UoYSxhLnJldHVybixoKX1iPWEuc2libGluZztpZihudWxsIT09Yil7Yi5yZXR1cm49YS5yZXR1cm47VD1iO2JyZWFrfVQ9YS5yZXR1cm59Yz1LZztLZz0hMTtyZXR1cm4gY31mdW5jdGlvbiBNZyhhLGIsYyl7dmFyIGQ9Yi51cGRhdGVRdWV1ZTtkPW51bGwhPT1kP2QubGFzdEVmZmVjdDpudWxsO2lmKG51bGwhPT1kKXt2YXIgZT1kPWQubmV4dDtkb3tpZigoZS50YWcmYSk9PT1hKXt2YXIgZj1lLmRlc3Ryb3k7ZS5kZXN0cm95PXZvaWQgMDt2b2lkIDAhPT1mJiZKZyhiLGMsZil9ZT1lLm5leHR9d2hpbGUoZSE9PWQpfX1mdW5jdGlvbiBOZyhhLGIpe2I9Yi51cGRhdGVRdWV1ZTtiPW51bGwhPT1iP2IubGFzdEVmZmVjdDpudWxsO2lmKG51bGwhPT1iKXt2YXIgYz1iPWIubmV4dDtkb3tpZigoYy50YWcmYSk9PT1hKXt2YXIgZD1jLmNyZWF0ZTtjLmRlc3Ryb3k9ZCgpfWM9Yy5uZXh0fXdoaWxlKGMhPT1iKX19XG5mdW5jdGlvbiBPZyhhKXt2YXIgYj1hLnJlZjtpZihudWxsIT09Yil7dmFyIGM9YS5zdGF0ZU5vZGU7c3dpdGNoKGEudGFnKXtjYXNlIDU6YT1FYShjKTticmVhaztkZWZhdWx0OmE9Y31cImZ1bmN0aW9uXCI9PT10eXBlb2YgYj9iKGEpOmIuY3VycmVudD1hfX1mdW5jdGlvbiBQZyhhKXt2YXIgYj1hLmFsdGVybmF0ZTtudWxsIT09YiYmKGEuYWx0ZXJuYXRlPW51bGwsUGcoYikpO2EuY2hpbGQ9bnVsbDthLmRlbGV0aW9ucz1udWxsO2Euc2libGluZz1udWxsOzU9PT1hLnRhZyYmKGI9YS5zdGF0ZU5vZGUsbnVsbCE9PWImJlphKGIpKTthLnN0YXRlTm9kZT1udWxsO2EucmV0dXJuPW51bGw7YS5kZXBlbmRlbmNpZXM9bnVsbDthLm1lbW9pemVkUHJvcHM9bnVsbDthLm1lbW9pemVkU3RhdGU9bnVsbDthLnBlbmRpbmdQcm9wcz1udWxsO2Euc3RhdGVOb2RlPW51bGw7YS51cGRhdGVRdWV1ZT1udWxsfVxuZnVuY3Rpb24gUWcoYSl7cmV0dXJuIDU9PT1hLnRhZ3x8Mz09PWEudGFnfHw0PT09YS50YWd9ZnVuY3Rpb24gUmcoYSl7YTpmb3IoOzspe2Zvcig7bnVsbD09PWEuc2libGluZzspe2lmKG51bGw9PT1hLnJldHVybnx8UWcoYS5yZXR1cm4pKXJldHVybiBudWxsO2E9YS5yZXR1cm59YS5zaWJsaW5nLnJldHVybj1hLnJldHVybjtmb3IoYT1hLnNpYmxpbmc7NSE9PWEudGFnJiY2IT09YS50YWcmJjE4IT09YS50YWc7KXtpZihhLmZsYWdzJjIpY29udGludWUgYTtpZihudWxsPT09YS5jaGlsZHx8ND09PWEudGFnKWNvbnRpbnVlIGE7ZWxzZSBhLmNoaWxkLnJldHVybj1hLGE9YS5jaGlsZH1pZighKGEuZmxhZ3MmMikpcmV0dXJuIGEuc3RhdGVOb2RlfX1cbmZ1bmN0aW9uIFNnKGEsYixjKXt2YXIgZD1hLnRhZztpZig1PT09ZHx8Nj09PWQpYT1hLnN0YXRlTm9kZSxiP3BiKGMsYSxiKTprYihjLGEpO2Vsc2UgaWYoNCE9PWQmJihhPWEuY2hpbGQsbnVsbCE9PWEpKWZvcihTZyhhLGIsYyksYT1hLnNpYmxpbmc7bnVsbCE9PWE7KVNnKGEsYixjKSxhPWEuc2libGluZ31mdW5jdGlvbiBUZyhhLGIsYyl7dmFyIGQ9YS50YWc7aWYoNT09PWR8fDY9PT1kKWE9YS5zdGF0ZU5vZGUsYj9vYihjLGEsYik6amIoYyxhKTtlbHNlIGlmKDQhPT1kJiYoYT1hLmNoaWxkLG51bGwhPT1hKSlmb3IoVGcoYSxiLGMpLGE9YS5zaWJsaW5nO251bGwhPT1hOylUZyhhLGIsYyksYT1hLnNpYmxpbmd9dmFyIFY9bnVsbCxVZz0hMTtmdW5jdGlvbiBWZyhhLGIsYyl7Zm9yKGM9Yy5jaGlsZDtudWxsIT09YzspV2coYSxiLGMpLGM9Yy5zaWJsaW5nfVxuZnVuY3Rpb24gV2coYSxiLGMpe2lmKFNjJiZcImZ1bmN0aW9uXCI9PT10eXBlb2YgU2Mub25Db21taXRGaWJlclVubW91bnQpdHJ5e1NjLm9uQ29tbWl0RmliZXJVbm1vdW50KFJjLGMpfWNhdGNoKGgpe31zd2l0Y2goYy50YWcpe2Nhc2UgNTpTfHxJZyhjLGIpO2Nhc2UgNjppZihUYSl7dmFyIGQ9VixlPVVnO1Y9bnVsbDtWZyhhLGIsYyk7Vj1kO1VnPWU7bnVsbCE9PVYmJihVZz9yYihWLGMuc3RhdGVOb2RlKTpxYihWLGMuc3RhdGVOb2RlKSl9ZWxzZSBWZyhhLGIsYyk7YnJlYWs7Y2FzZSAxODpUYSYmbnVsbCE9PVYmJihVZz9ZYihWLGMuc3RhdGVOb2RlKTpYYihWLGMuc3RhdGVOb2RlKSk7YnJlYWs7Y2FzZSA0OlRhPyhkPVYsZT1VZyxWPWMuc3RhdGVOb2RlLmNvbnRhaW5lckluZm8sVWc9ITAsVmcoYSxiLGMpLFY9ZCxVZz1lKTooVWEmJihkPWMuc3RhdGVOb2RlLmNvbnRhaW5lckluZm8sZT16YihkKSxDYihkLGUpKSxWZyhhLGIsYykpO2JyZWFrO2Nhc2UgMDpjYXNlIDExOmNhc2UgMTQ6Y2FzZSAxNTppZighUyYmXG4oZD1jLnVwZGF0ZVF1ZXVlLG51bGwhPT1kJiYoZD1kLmxhc3RFZmZlY3QsbnVsbCE9PWQpKSl7ZT1kPWQubmV4dDtkb3t2YXIgZj1lLGc9Zi5kZXN0cm95O2Y9Zi50YWc7dm9pZCAwIT09ZyYmKDAhPT0oZiYyKT9KZyhjLGIsZyk6MCE9PShmJjQpJiZKZyhjLGIsZykpO2U9ZS5uZXh0fXdoaWxlKGUhPT1kKX1WZyhhLGIsYyk7YnJlYWs7Y2FzZSAxOmlmKCFTJiYoSWcoYyxiKSxkPWMuc3RhdGVOb2RlLFwiZnVuY3Rpb25cIj09PXR5cGVvZiBkLmNvbXBvbmVudFdpbGxVbm1vdW50KSl0cnl7ZC5wcm9wcz1jLm1lbW9pemVkUHJvcHMsZC5zdGF0ZT1jLm1lbW9pemVkU3RhdGUsZC5jb21wb25lbnRXaWxsVW5tb3VudCgpfWNhdGNoKGgpe1UoYyxiLGgpfVZnKGEsYixjKTticmVhaztjYXNlIDIxOlZnKGEsYixjKTticmVhaztjYXNlIDIyOmMubW9kZSYxPyhTPShkPVMpfHxudWxsIT09Yy5tZW1vaXplZFN0YXRlLFZnKGEsYixjKSxTPWQpOlZnKGEsYixjKTticmVhaztkZWZhdWx0OlZnKGEsYixcbmMpfX1mdW5jdGlvbiBYZyhhKXt2YXIgYj1hLnVwZGF0ZVF1ZXVlO2lmKG51bGwhPT1iKXthLnVwZGF0ZVF1ZXVlPW51bGw7dmFyIGM9YS5zdGF0ZU5vZGU7bnVsbD09PWMmJihjPWEuc3RhdGVOb2RlPW5ldyBIZyk7Yi5mb3JFYWNoKGZ1bmN0aW9uKGIpe3ZhciBkPVlnLmJpbmQobnVsbCxhLGIpO2MuaGFzKGIpfHwoYy5hZGQoYiksYi50aGVuKGQsZCkpfSl9fVxuZnVuY3Rpb24gWmcoYSxiKXt2YXIgYz1iLmRlbGV0aW9ucztpZihudWxsIT09Yylmb3IodmFyIGQ9MDtkPGMubGVuZ3RoO2QrKyl7dmFyIGU9Y1tkXTt0cnl7dmFyIGY9YSxnPWI7aWYoVGEpe3ZhciBoPWc7YTpmb3IoO251bGwhPT1oOyl7c3dpdGNoKGgudGFnKXtjYXNlIDU6Vj1oLnN0YXRlTm9kZTtVZz0hMTticmVhayBhO2Nhc2UgMzpWPWguc3RhdGVOb2RlLmNvbnRhaW5lckluZm87VWc9ITA7YnJlYWsgYTtjYXNlIDQ6Vj1oLnN0YXRlTm9kZS5jb250YWluZXJJbmZvO1VnPSEwO2JyZWFrIGF9aD1oLnJldHVybn1pZihudWxsPT09Vil0aHJvdyBFcnJvcihuKDE2MCkpO1dnKGYsZyxlKTtWPW51bGw7VWc9ITF9ZWxzZSBXZyhmLGcsZSk7dmFyIGs9ZS5hbHRlcm5hdGU7bnVsbCE9PWsmJihrLnJldHVybj1udWxsKTtlLnJldHVybj1udWxsfWNhdGNoKGwpe1UoZSxiLGwpfX1pZihiLnN1YnRyZWVGbGFncyYxMjg1NClmb3IoYj1iLmNoaWxkO251bGwhPT1iOykkZyhiLGEpLGI9Yi5zaWJsaW5nfVxuZnVuY3Rpb24gJGcoYSxiKXt2YXIgYz1hLmFsdGVybmF0ZSxkPWEuZmxhZ3M7c3dpdGNoKGEudGFnKXtjYXNlIDA6Y2FzZSAxMTpjYXNlIDE0OmNhc2UgMTU6WmcoYixhKTthaChhKTtpZihkJjQpe3RyeXtNZygzLGEsYS5yZXR1cm4pLE5nKDMsYSl9Y2F0Y2gocCl7VShhLGEucmV0dXJuLHApfXRyeXtNZyg1LGEsYS5yZXR1cm4pfWNhdGNoKHApe1UoYSxhLnJldHVybixwKX19YnJlYWs7Y2FzZSAxOlpnKGIsYSk7YWgoYSk7ZCY1MTImJm51bGwhPT1jJiZJZyhjLGMucmV0dXJuKTticmVhaztjYXNlIDU6WmcoYixhKTthaChhKTtkJjUxMiYmbnVsbCE9PWMmJklnKGMsYy5yZXR1cm4pO2lmKFRhKXtpZihhLmZsYWdzJjMyKXt2YXIgZT1hLnN0YXRlTm9kZTt0cnl7c2IoZSl9Y2F0Y2gocCl7VShhLGEucmV0dXJuLHApfX1pZihkJjQmJihlPWEuc3RhdGVOb2RlLG51bGwhPWUpKXt2YXIgZj1hLm1lbW9pemVkUHJvcHM7Yz1udWxsIT09Yz9jLm1lbW9pemVkUHJvcHM6ZjtkPWEudHlwZTtiPVxuYS51cGRhdGVRdWV1ZTthLnVwZGF0ZVF1ZXVlPW51bGw7aWYobnVsbCE9PWIpdHJ5e25iKGUsYixkLGMsZixhKX1jYXRjaChwKXtVKGEsYS5yZXR1cm4scCl9fX1icmVhaztjYXNlIDY6WmcoYixhKTthaChhKTtpZihkJjQmJlRhKXtpZihudWxsPT09YS5zdGF0ZU5vZGUpdGhyb3cgRXJyb3IobigxNjIpKTtlPWEuc3RhdGVOb2RlO2Y9YS5tZW1vaXplZFByb3BzO2M9bnVsbCE9PWM/Yy5tZW1vaXplZFByb3BzOmY7dHJ5e2xiKGUsYyxmKX1jYXRjaChwKXtVKGEsYS5yZXR1cm4scCl9fWJyZWFrO2Nhc2UgMzpaZyhiLGEpO2FoKGEpO2lmKGQmNCl7aWYoVGEmJlZhJiZudWxsIT09YyYmYy5tZW1vaXplZFN0YXRlLmlzRGVoeWRyYXRlZCl0cnl7VmIoYi5jb250YWluZXJJbmZvKX1jYXRjaChwKXtVKGEsYS5yZXR1cm4scCl9aWYoVWEpe2U9Yi5jb250YWluZXJJbmZvO2Y9Yi5wZW5kaW5nQ2hpbGRyZW47dHJ5e0NiKGUsZil9Y2F0Y2gocCl7VShhLGEucmV0dXJuLHApfX19YnJlYWs7Y2FzZSA0OlpnKGIsXG5hKTthaChhKTtpZihkJjQmJlVhKXtmPWEuc3RhdGVOb2RlO2U9Zi5jb250YWluZXJJbmZvO2Y9Zi5wZW5kaW5nQ2hpbGRyZW47dHJ5e0NiKGUsZil9Y2F0Y2gocCl7VShhLGEucmV0dXJuLHApfX1icmVhaztjYXNlIDEzOlpnKGIsYSk7YWgoYSk7ZT1hLmNoaWxkO2UuZmxhZ3MmODE5MiYmKGY9bnVsbCE9PWUubWVtb2l6ZWRTdGF0ZSxlLnN0YXRlTm9kZS5pc0hpZGRlbj1mLCFmfHxudWxsIT09ZS5hbHRlcm5hdGUmJm51bGwhPT1lLmFsdGVybmF0ZS5tZW1vaXplZFN0YXRlfHwoYmg9RCgpKSk7ZCY0JiZYZyhhKTticmVhaztjYXNlIDIyOnZhciBnPW51bGwhPT1jJiZudWxsIT09Yy5tZW1vaXplZFN0YXRlO2EubW9kZSYxPyhTPShjPVMpfHxnLFpnKGIsYSksUz1jKTpaZyhiLGEpO2FoKGEpO2lmKGQmODE5Mil7Yz1udWxsIT09YS5tZW1vaXplZFN0YXRlO2lmKChhLnN0YXRlTm9kZS5pc0hpZGRlbj1jKSYmIWcmJjAhPT0oYS5tb2RlJjEpKWZvcihUPWEsZD1hLmNoaWxkO251bGwhPT1cbmQ7KXtmb3IoYj1UPWQ7bnVsbCE9PVQ7KXtnPVQ7dmFyIGg9Zy5jaGlsZDtzd2l0Y2goZy50YWcpe2Nhc2UgMDpjYXNlIDExOmNhc2UgMTQ6Y2FzZSAxNTpNZyg0LGcsZy5yZXR1cm4pO2JyZWFrO2Nhc2UgMTpJZyhnLGcucmV0dXJuKTt2YXIgaz1nLnN0YXRlTm9kZTtpZihcImZ1bmN0aW9uXCI9PT10eXBlb2Ygay5jb21wb25lbnRXaWxsVW5tb3VudCl7dmFyIGw9ZyxtPWcucmV0dXJuO3RyeXt2YXIgcj1sO2sucHJvcHM9ci5tZW1vaXplZFByb3BzO2suc3RhdGU9ci5tZW1vaXplZFN0YXRlO2suY29tcG9uZW50V2lsbFVubW91bnQoKX1jYXRjaChwKXtVKGwsbSxwKX19YnJlYWs7Y2FzZSA1OklnKGcsZy5yZXR1cm4pO2JyZWFrO2Nhc2UgMjI6aWYobnVsbCE9PWcubWVtb2l6ZWRTdGF0ZSl7Y2goYik7Y29udGludWV9fW51bGwhPT1oPyhoLnJldHVybj1nLFQ9aCk6Y2goYil9ZD1kLnNpYmxpbmd9aWYoVGEpYTppZihkPW51bGwsVGEpZm9yKGI9YTs7KXtpZig1PT09Yi50YWcpe2lmKG51bGw9PT1cbmQpe2Q9Yjt0cnl7ZT1iLnN0YXRlTm9kZSxjP3RiKGUpOnZiKGIuc3RhdGVOb2RlLGIubWVtb2l6ZWRQcm9wcyl9Y2F0Y2gocCl7VShhLGEucmV0dXJuLHApfX19ZWxzZSBpZig2PT09Yi50YWcpe2lmKG51bGw9PT1kKXRyeXtmPWIuc3RhdGVOb2RlLGM/dWIoZik6d2IoZixiLm1lbW9pemVkUHJvcHMpfWNhdGNoKHApe1UoYSxhLnJldHVybixwKX19ZWxzZSBpZigoMjIhPT1iLnRhZyYmMjMhPT1iLnRhZ3x8bnVsbD09PWIubWVtb2l6ZWRTdGF0ZXx8Yj09PWEpJiZudWxsIT09Yi5jaGlsZCl7Yi5jaGlsZC5yZXR1cm49YjtiPWIuY2hpbGQ7Y29udGludWV9aWYoYj09PWEpYnJlYWsgYTtmb3IoO251bGw9PT1iLnNpYmxpbmc7KXtpZihudWxsPT09Yi5yZXR1cm58fGIucmV0dXJuPT09YSlicmVhayBhO2Q9PT1iJiYoZD1udWxsKTtiPWIucmV0dXJufWQ9PT1iJiYoZD1udWxsKTtiLnNpYmxpbmcucmV0dXJuPWIucmV0dXJuO2I9Yi5zaWJsaW5nfX1icmVhaztjYXNlIDE5OlpnKGIsYSk7YWgoYSk7XG5kJjQmJlhnKGEpO2JyZWFrO2Nhc2UgMjE6YnJlYWs7ZGVmYXVsdDpaZyhiLGEpLGFoKGEpfX1mdW5jdGlvbiBhaChhKXt2YXIgYj1hLmZsYWdzO2lmKGImMil7dHJ5e2lmKFRhKXtiOntmb3IodmFyIGM9YS5yZXR1cm47bnVsbCE9PWM7KXtpZihRZyhjKSl7dmFyIGQ9YzticmVhayBifWM9Yy5yZXR1cm59dGhyb3cgRXJyb3IobigxNjApKTt9c3dpdGNoKGQudGFnKXtjYXNlIDU6dmFyIGU9ZC5zdGF0ZU5vZGU7ZC5mbGFncyYzMiYmKHNiKGUpLGQuZmxhZ3MmPS0zMyk7dmFyIGY9UmcoYSk7VGcoYSxmLGUpO2JyZWFrO2Nhc2UgMzpjYXNlIDQ6dmFyIGc9ZC5zdGF0ZU5vZGUuY29udGFpbmVySW5mbyxoPVJnKGEpO1NnKGEsaCxnKTticmVhaztkZWZhdWx0OnRocm93IEVycm9yKG4oMTYxKSk7fX19Y2F0Y2goayl7VShhLGEucmV0dXJuLGspfWEuZmxhZ3MmPS0zfWImNDA5NiYmKGEuZmxhZ3MmPS00MDk3KX1mdW5jdGlvbiBkaChhLGIsYyl7VD1hO2VoKGEsYixjKX1cbmZ1bmN0aW9uIGVoKGEsYixjKXtmb3IodmFyIGQ9MCE9PShhLm1vZGUmMSk7bnVsbCE9PVQ7KXt2YXIgZT1ULGY9ZS5jaGlsZDtpZigyMj09PWUudGFnJiZkKXt2YXIgZz1udWxsIT09ZS5tZW1vaXplZFN0YXRlfHxHZztpZighZyl7dmFyIGg9ZS5hbHRlcm5hdGUsaz1udWxsIT09aCYmbnVsbCE9PWgubWVtb2l6ZWRTdGF0ZXx8UztoPUdnO3ZhciBsPVM7R2c9ZztpZigoUz1rKSYmIWwpZm9yKFQ9ZTtudWxsIT09VDspZz1ULGs9Zy5jaGlsZCwyMj09PWcudGFnJiZudWxsIT09Zy5tZW1vaXplZFN0YXRlP2ZoKGUpOm51bGwhPT1rPyhrLnJldHVybj1nLFQ9ayk6ZmgoZSk7Zm9yKDtudWxsIT09ZjspVD1mLGVoKGYsYixjKSxmPWYuc2libGluZztUPWU7R2c9aDtTPWx9Z2goYSxiLGMpfWVsc2UgMCE9PShlLnN1YnRyZWVGbGFncyY4NzcyKSYmbnVsbCE9PWY/KGYucmV0dXJuPWUsVD1mKTpnaChhLGIsYyl9fVxuZnVuY3Rpb24gZ2goYSl7Zm9yKDtudWxsIT09VDspe3ZhciBiPVQ7aWYoMCE9PShiLmZsYWdzJjg3NzIpKXt2YXIgYz1iLmFsdGVybmF0ZTt0cnl7aWYoMCE9PShiLmZsYWdzJjg3NzIpKXN3aXRjaChiLnRhZyl7Y2FzZSAwOmNhc2UgMTE6Y2FzZSAxNTpTfHxOZyg1LGIpO2JyZWFrO2Nhc2UgMTp2YXIgZD1iLnN0YXRlTm9kZTtpZihiLmZsYWdzJjQmJiFTKWlmKG51bGw9PT1jKWQuY29tcG9uZW50RGlkTW91bnQoKTtlbHNle3ZhciBlPWIuZWxlbWVudFR5cGU9PT1iLnR5cGU/Yy5tZW1vaXplZFByb3BzOnhmKGIudHlwZSxjLm1lbW9pemVkUHJvcHMpO2QuY29tcG9uZW50RGlkVXBkYXRlKGUsYy5tZW1vaXplZFN0YXRlLGQuX19yZWFjdEludGVybmFsU25hcHNob3RCZWZvcmVVcGRhdGUpfXZhciBmPWIudXBkYXRlUXVldWU7bnVsbCE9PWYmJm1lKGIsZixkKTticmVhaztjYXNlIDM6dmFyIGc9Yi51cGRhdGVRdWV1ZTtpZihudWxsIT09Zyl7Yz1udWxsO2lmKG51bGwhPT1iLmNoaWxkKXN3aXRjaChiLmNoaWxkLnRhZyl7Y2FzZSA1OmM9XG5FYShiLmNoaWxkLnN0YXRlTm9kZSk7YnJlYWs7Y2FzZSAxOmM9Yi5jaGlsZC5zdGF0ZU5vZGV9bWUoYixnLGMpfWJyZWFrO2Nhc2UgNTp2YXIgaD1iLnN0YXRlTm9kZTtudWxsPT09YyYmYi5mbGFncyY0JiZtYihoLGIudHlwZSxiLm1lbW9pemVkUHJvcHMsYik7YnJlYWs7Y2FzZSA2OmJyZWFrO2Nhc2UgNDpicmVhaztjYXNlIDEyOmJyZWFrO2Nhc2UgMTM6aWYoVmEmJm51bGw9PT1iLm1lbW9pemVkU3RhdGUpe3ZhciBrPWIuYWx0ZXJuYXRlO2lmKG51bGwhPT1rKXt2YXIgbD1rLm1lbW9pemVkU3RhdGU7aWYobnVsbCE9PWwpe3ZhciBtPWwuZGVoeWRyYXRlZDtudWxsIT09bSYmV2IobSl9fX1icmVhaztjYXNlIDE5OmNhc2UgMTc6Y2FzZSAyMTpjYXNlIDIyOmNhc2UgMjM6Y2FzZSAyNTpicmVhaztkZWZhdWx0OnRocm93IEVycm9yKG4oMTYzKSk7fVN8fGIuZmxhZ3MmNTEyJiZPZyhiKX1jYXRjaChyKXtVKGIsYi5yZXR1cm4scil9fWlmKGI9PT1hKXtUPW51bGw7YnJlYWt9Yz1iLnNpYmxpbmc7XG5pZihudWxsIT09Yyl7Yy5yZXR1cm49Yi5yZXR1cm47VD1jO2JyZWFrfVQ9Yi5yZXR1cm59fWZ1bmN0aW9uIGNoKGEpe2Zvcig7bnVsbCE9PVQ7KXt2YXIgYj1UO2lmKGI9PT1hKXtUPW51bGw7YnJlYWt9dmFyIGM9Yi5zaWJsaW5nO2lmKG51bGwhPT1jKXtjLnJldHVybj1iLnJldHVybjtUPWM7YnJlYWt9VD1iLnJldHVybn19XG5mdW5jdGlvbiBmaChhKXtmb3IoO251bGwhPT1UOyl7dmFyIGI9VDt0cnl7c3dpdGNoKGIudGFnKXtjYXNlIDA6Y2FzZSAxMTpjYXNlIDE1OnZhciBjPWIucmV0dXJuO3RyeXtOZyg0LGIpfWNhdGNoKGspe1UoYixjLGspfWJyZWFrO2Nhc2UgMTp2YXIgZD1iLnN0YXRlTm9kZTtpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgZC5jb21wb25lbnREaWRNb3VudCl7dmFyIGU9Yi5yZXR1cm47dHJ5e2QuY29tcG9uZW50RGlkTW91bnQoKX1jYXRjaChrKXtVKGIsZSxrKX19dmFyIGY9Yi5yZXR1cm47dHJ5e09nKGIpfWNhdGNoKGspe1UoYixmLGspfWJyZWFrO2Nhc2UgNTp2YXIgZz1iLnJldHVybjt0cnl7T2coYil9Y2F0Y2goayl7VShiLGcsayl9fX1jYXRjaChrKXtVKGIsYi5yZXR1cm4sayl9aWYoYj09PWEpe1Q9bnVsbDticmVha312YXIgaD1iLnNpYmxpbmc7aWYobnVsbCE9PWgpe2gucmV0dXJuPWIucmV0dXJuO1Q9aDticmVha31UPWIucmV0dXJufX1cbnZhciBoaD0wLGloPTEsamg9MixraD0zLGxoPTQ7aWYoXCJmdW5jdGlvblwiPT09dHlwZW9mIFN5bWJvbCYmU3ltYm9sLmZvcil7dmFyIG1oPVN5bWJvbC5mb3I7aGg9bWgoXCJzZWxlY3Rvci5jb21wb25lbnRcIik7aWg9bWgoXCJzZWxlY3Rvci5oYXNfcHNldWRvX2NsYXNzXCIpO2poPW1oKFwic2VsZWN0b3Iucm9sZVwiKTtraD1taChcInNlbGVjdG9yLnRlc3RfaWRcIik7bGg9bWgoXCJzZWxlY3Rvci50ZXh0XCIpfWZ1bmN0aW9uIG5oKGEpe3ZhciBiPVdhKGEpO2lmKG51bGwhPWIpe2lmKFwic3RyaW5nXCIhPT10eXBlb2YgYi5tZW1vaXplZFByb3BzW1wiZGF0YS10ZXN0bmFtZVwiXSl0aHJvdyBFcnJvcihuKDM2NCkpO3JldHVybiBifWE9Y2IoYSk7aWYobnVsbD09PWEpdGhyb3cgRXJyb3IobigzNjIpKTtyZXR1cm4gYS5zdGF0ZU5vZGUuY3VycmVudH1cbmZ1bmN0aW9uIG9oKGEsYil7c3dpdGNoKGIuJCR0eXBlb2Ype2Nhc2UgaGg6aWYoYS50eXBlPT09Yi52YWx1ZSlyZXR1cm4hMDticmVhaztjYXNlIGloOmE6e2I9Yi52YWx1ZTthPVthLDBdO2Zvcih2YXIgYz0wO2M8YS5sZW5ndGg7KXt2YXIgZD1hW2MrK10sZT1hW2MrK10sZj1iW2VdO2lmKDUhPT1kLnRhZ3x8IWZiKGQpKXtmb3IoO251bGwhPWYmJm9oKGQsZik7KWUrKyxmPWJbZV07aWYoZT09PWIubGVuZ3RoKXtiPSEwO2JyZWFrIGF9ZWxzZSBmb3IoZD1kLmNoaWxkO251bGwhPT1kOylhLnB1c2goZCxlKSxkPWQuc2libGluZ319Yj0hMX1yZXR1cm4gYjtjYXNlIGpoOmlmKDU9PT1hLnRhZyYmZ2IoYS5zdGF0ZU5vZGUsYi52YWx1ZSkpcmV0dXJuITA7YnJlYWs7Y2FzZSBsaDppZig1PT09YS50YWd8fDY9PT1hLnRhZylpZihhPWViKGEpLG51bGwhPT1hJiYwPD1hLmluZGV4T2YoYi52YWx1ZSkpcmV0dXJuITA7YnJlYWs7Y2FzZSBraDppZig1PT09YS50YWcmJihhPWEubWVtb2l6ZWRQcm9wc1tcImRhdGEtdGVzdG5hbWVcIl0sXG5cInN0cmluZ1wiPT09dHlwZW9mIGEmJmEudG9Mb3dlckNhc2UoKT09PWIudmFsdWUudG9Mb3dlckNhc2UoKSkpcmV0dXJuITA7YnJlYWs7ZGVmYXVsdDp0aHJvdyBFcnJvcihuKDM2NSkpO31yZXR1cm4hMX1mdW5jdGlvbiBwaChhKXtzd2l0Y2goYS4kJHR5cGVvZil7Y2FzZSBoaDpyZXR1cm5cIjxcIisodWEoYS52YWx1ZSl8fFwiVW5rbm93blwiKStcIj5cIjtjYXNlIGloOnJldHVyblwiOmhhcyhcIisocGgoYSl8fFwiXCIpK1wiKVwiO2Nhc2Ugamg6cmV0dXJuJ1tyb2xlPVwiJythLnZhbHVlKydcIl0nO2Nhc2UgbGg6cmV0dXJuJ1wiJythLnZhbHVlKydcIic7Y2FzZSBraDpyZXR1cm4nW2RhdGEtdGVzdG5hbWU9XCInK2EudmFsdWUrJ1wiXSc7ZGVmYXVsdDp0aHJvdyBFcnJvcihuKDM2NSkpO319XG5mdW5jdGlvbiBxaChhLGIpe3ZhciBjPVtdO2E9W2EsMF07Zm9yKHZhciBkPTA7ZDxhLmxlbmd0aDspe3ZhciBlPWFbZCsrXSxmPWFbZCsrXSxnPWJbZl07aWYoNSE9PWUudGFnfHwhZmIoZSkpe2Zvcig7bnVsbCE9ZyYmb2goZSxnKTspZisrLGc9YltmXTtpZihmPT09Yi5sZW5ndGgpYy5wdXNoKGUpO2Vsc2UgZm9yKGU9ZS5jaGlsZDtudWxsIT09ZTspYS5wdXNoKGUsZiksZT1lLnNpYmxpbmd9fXJldHVybiBjfWZ1bmN0aW9uIHJoKGEsYil7aWYoIWJiKXRocm93IEVycm9yKG4oMzYzKSk7YT1uaChhKTthPXFoKGEsYik7Yj1bXTthPUFycmF5LmZyb20oYSk7Zm9yKHZhciBjPTA7YzxhLmxlbmd0aDspe3ZhciBkPWFbYysrXTtpZig1PT09ZC50YWcpZmIoZCl8fGIucHVzaChkLnN0YXRlTm9kZSk7ZWxzZSBmb3IoZD1kLmNoaWxkO251bGwhPT1kOylhLnB1c2goZCksZD1kLnNpYmxpbmd9cmV0dXJuIGJ9XG52YXIgc2g9TWF0aC5jZWlsLHRoPWRhLlJlYWN0Q3VycmVudERpc3BhdGNoZXIsdWg9ZGEuUmVhY3RDdXJyZW50T3duZXIsVz1kYS5SZWFjdEN1cnJlbnRCYXRjaENvbmZpZyxIPTAsTj1udWxsLFg9bnVsbCxaPTAsJGY9MCxaZj1pYygwKSxSPTAsdmg9bnVsbCxsZT0wLHdoPTAseGg9MCx5aD1udWxsLHpoPW51bGwsYmg9MCxEZz1JbmZpbml0eSxBaD1udWxsO2Z1bmN0aW9uIEJoKCl7RGc9RCgpKzUwMH12YXIgSmY9ITEsS2Y9bnVsbCxNZj1udWxsLENoPSExLERoPW51bGwsRWg9MCxGaD0wLEdoPW51bGwsSGg9LTEsSWg9MDtmdW5jdGlvbiBPKCl7cmV0dXJuIDAhPT0oSCY2KT9EKCk6LTEhPT1IaD9IaDpIaD1EKCl9ZnVuY3Rpb24gdGYoYSl7aWYoMD09PShhLm1vZGUmMSkpcmV0dXJuIDE7aWYoMCE9PShIJjIpJiYwIT09WilyZXR1cm4gWiYtWjtpZihudWxsIT09Q2QudHJhbnNpdGlvbilyZXR1cm4gMD09PUloJiYoSWg9RGMoKSksSWg7YT1DO3JldHVybiAwIT09YT9hOllhKCl9XG5mdW5jdGlvbiBhZihhLGIsYyxkKXtpZig1MDxGaCl0aHJvdyBGaD0wLEdoPW51bGwsRXJyb3IobigxODUpKTtGYyhhLGMsZCk7aWYoMD09PShIJjIpfHxhIT09TilhPT09TiYmKDA9PT0oSCYyKSYmKHdofD1jKSw0PT09UiYmSmgoYSxaKSksS2goYSxkKSwxPT09YyYmMD09PUgmJjA9PT0oYi5tb2RlJjEpJiYoQmgoKSxYYyYmYWQoKSl9XG5mdW5jdGlvbiBLaChhLGIpe3ZhciBjPWEuY2FsbGJhY2tOb2RlO0JjKGEsYik7dmFyIGQ9emMoYSxhPT09Tj9aOjApO2lmKDA9PT1kKW51bGwhPT1jJiZLYyhjKSxhLmNhbGxiYWNrTm9kZT1udWxsLGEuY2FsbGJhY2tQcmlvcml0eT0wO2Vsc2UgaWYoYj1kJi1kLGEuY2FsbGJhY2tQcmlvcml0eSE9PWIpe251bGwhPWMmJktjKGMpO2lmKDE9PT1iKTA9PT1hLnRhZz8kYyhMaC5iaW5kKG51bGwsYSkpOlpjKExoLmJpbmQobnVsbCxhKSksJGE/YWIoZnVuY3Rpb24oKXswPT09KEgmNikmJmFkKCl9KTpKYyhOYyxhZCksYz1udWxsO2Vsc2V7c3dpdGNoKEljKGQpKXtjYXNlIDE6Yz1OYzticmVhaztjYXNlIDQ6Yz1PYzticmVhaztjYXNlIDE2OmM9UGM7YnJlYWs7Y2FzZSA1MzY4NzA5MTI6Yz1RYzticmVhaztkZWZhdWx0OmM9UGN9Yz1NaChjLE5oLmJpbmQobnVsbCxhKSl9YS5jYWxsYmFja1ByaW9yaXR5PWI7YS5jYWxsYmFja05vZGU9Y319XG5mdW5jdGlvbiBOaChhLGIpe0hoPS0xO0loPTA7aWYoMCE9PShIJjYpKXRocm93IEVycm9yKG4oMzI3KSk7dmFyIGM9YS5jYWxsYmFja05vZGU7aWYoT2goKSYmYS5jYWxsYmFja05vZGUhPT1jKXJldHVybiBudWxsO3ZhciBkPXpjKGEsYT09PU4/WjowKTtpZigwPT09ZClyZXR1cm4gbnVsbDtpZigwIT09KGQmMzApfHwwIT09KGQmYS5leHBpcmVkTGFuZXMpfHxiKWI9UGgoYSxkKTtlbHNle2I9ZDt2YXIgZT1IO0h8PTI7dmFyIGY9UWgoKTtpZihOIT09YXx8WiE9PWIpQWg9bnVsbCxCaCgpLFJoKGEsYik7ZG8gdHJ5e1NoKCk7YnJlYWt9Y2F0Y2goaCl7VGgoYSxoKX13aGlsZSgxKTtVZCgpO3RoLmN1cnJlbnQ9ZjtIPWU7bnVsbCE9PVg/Yj0wOihOPW51bGwsWj0wLGI9Uil9aWYoMCE9PWIpezI9PT1iJiYoZT1DYyhhKSwwIT09ZSYmKGQ9ZSxiPVVoKGEsZSkpKTtpZigxPT09Yil0aHJvdyBjPXZoLFJoKGEsMCksSmgoYSxkKSxLaChhLEQoKSksYztpZig2PT09YilKaChhLGQpO2Vsc2V7ZT1cbmEuY3VycmVudC5hbHRlcm5hdGU7aWYoMD09PShkJjMwKSYmIVZoKGUpJiYoYj1QaChhLGQpLDI9PT1iJiYoZj1DYyhhKSwwIT09ZiYmKGQ9ZixiPVVoKGEsZikpKSwxPT09YikpdGhyb3cgYz12aCxSaChhLDApLEpoKGEsZCksS2goYSxEKCkpLGM7YS5maW5pc2hlZFdvcms9ZTthLmZpbmlzaGVkTGFuZXM9ZDtzd2l0Y2goYil7Y2FzZSAwOmNhc2UgMTp0aHJvdyBFcnJvcihuKDM0NSkpO2Nhc2UgMjpXaChhLHpoLEFoKTticmVhaztjYXNlIDM6SmgoYSxkKTtpZigoZCYxMzAwMjM0MjQpPT09ZCYmKGI9YmgrNTAwLUQoKSwxMDxiKSl7aWYoMCE9PXpjKGEsMCkpYnJlYWs7ZT1hLnN1c3BlbmRlZExhbmVzO2lmKChlJmQpIT09ZCl7TygpO2EucGluZ2VkTGFuZXN8PWEuc3VzcGVuZGVkTGFuZXMmZTticmVha31hLnRpbWVvdXRIYW5kbGU9UGEoV2guYmluZChudWxsLGEsemgsQWgpLGIpO2JyZWFrfVdoKGEsemgsQWgpO2JyZWFrO2Nhc2UgNDpKaChhLGQpO2lmKChkJjQxOTQyNDApPT09ZClicmVhaztcbmI9YS5ldmVudFRpbWVzO2ZvcihlPS0xOzA8ZDspe3ZhciBnPTMxLXRjKGQpO2Y9MTw8ZztnPWJbZ107Zz5lJiYoZT1nKTtkJj1+Zn1kPWU7ZD1EKCktZDtkPSgxMjA+ZD8xMjA6NDgwPmQ/NDgwOjEwODA+ZD8xMDgwOjE5MjA+ZD8xOTIwOjNFMz5kPzNFMzo0MzIwPmQ/NDMyMDoxOTYwKnNoKGQvMTk2MCkpLWQ7aWYoMTA8ZCl7YS50aW1lb3V0SGFuZGxlPVBhKFdoLmJpbmQobnVsbCxhLHpoLEFoKSxkKTticmVha31XaChhLHpoLEFoKTticmVhaztjYXNlIDU6V2goYSx6aCxBaCk7YnJlYWs7ZGVmYXVsdDp0aHJvdyBFcnJvcihuKDMyOSkpO319fUtoKGEsRCgpKTtyZXR1cm4gYS5jYWxsYmFja05vZGU9PT1jP05oLmJpbmQobnVsbCxhKTpudWxsfVxuZnVuY3Rpb24gVWgoYSxiKXt2YXIgYz15aDthLmN1cnJlbnQubWVtb2l6ZWRTdGF0ZS5pc0RlaHlkcmF0ZWQmJihSaChhLGIpLmZsYWdzfD0yNTYpO2E9UGgoYSxiKTsyIT09YSYmKGI9emgsemg9YyxudWxsIT09YiYmQ2coYikpO3JldHVybiBhfWZ1bmN0aW9uIENnKGEpe251bGw9PT16aD96aD1hOnpoLnB1c2guYXBwbHkoemgsYSl9XG5mdW5jdGlvbiBWaChhKXtmb3IodmFyIGI9YTs7KXtpZihiLmZsYWdzJjE2Mzg0KXt2YXIgYz1iLnVwZGF0ZVF1ZXVlO2lmKG51bGwhPT1jJiYoYz1jLnN0b3JlcyxudWxsIT09YykpZm9yKHZhciBkPTA7ZDxjLmxlbmd0aDtkKyspe3ZhciBlPWNbZF0sZj1lLmdldFNuYXBzaG90O2U9ZS52YWx1ZTt0cnl7aWYoIVZjKGYoKSxlKSlyZXR1cm4hMX1jYXRjaChnKXtyZXR1cm4hMX19fWM9Yi5jaGlsZDtpZihiLnN1YnRyZWVGbGFncyYxNjM4NCYmbnVsbCE9PWMpYy5yZXR1cm49YixiPWM7ZWxzZXtpZihiPT09YSlicmVhaztmb3IoO251bGw9PT1iLnNpYmxpbmc7KXtpZihudWxsPT09Yi5yZXR1cm58fGIucmV0dXJuPT09YSlyZXR1cm4hMDtiPWIucmV0dXJufWIuc2libGluZy5yZXR1cm49Yi5yZXR1cm47Yj1iLnNpYmxpbmd9fXJldHVybiEwfVxuZnVuY3Rpb24gSmgoYSxiKXtiJj1+eGg7YiY9fndoO2Euc3VzcGVuZGVkTGFuZXN8PWI7YS5waW5nZWRMYW5lcyY9fmI7Zm9yKGE9YS5leHBpcmF0aW9uVGltZXM7MDxiOyl7dmFyIGM9MzEtdGMoYiksZD0xPDxjO2FbY109LTE7YiY9fmR9fWZ1bmN0aW9uIExoKGEpe2lmKDAhPT0oSCY2KSl0aHJvdyBFcnJvcihuKDMyNykpO09oKCk7dmFyIGI9emMoYSwwKTtpZigwPT09KGImMSkpcmV0dXJuIEtoKGEsRCgpKSxudWxsO3ZhciBjPVBoKGEsYik7aWYoMCE9PWEudGFnJiYyPT09Yyl7dmFyIGQ9Q2MoYSk7MCE9PWQmJihiPWQsYz1VaChhLGQpKX1pZigxPT09Yyl0aHJvdyBjPXZoLFJoKGEsMCksSmgoYSxiKSxLaChhLEQoKSksYztpZig2PT09Yyl0aHJvdyBFcnJvcihuKDM0NSkpO2EuZmluaXNoZWRXb3JrPWEuY3VycmVudC5hbHRlcm5hdGU7YS5maW5pc2hlZExhbmVzPWI7V2goYSx6aCxBaCk7S2goYSxEKCkpO3JldHVybiBudWxsfVxuZnVuY3Rpb24gWGgoYSl7bnVsbCE9PURoJiYwPT09RGgudGFnJiYwPT09KEgmNikmJk9oKCk7dmFyIGI9SDtIfD0xO3ZhciBjPVcudHJhbnNpdGlvbixkPUM7dHJ5e2lmKFcudHJhbnNpdGlvbj1udWxsLEM9MSxhKXJldHVybiBhKCl9ZmluYWxseXtDPWQsVy50cmFuc2l0aW9uPWMsSD1iLDA9PT0oSCY2KSYmYWQoKX19ZnVuY3Rpb24gRWcoKXskZj1aZi5jdXJyZW50O3EoWmYpfVxuZnVuY3Rpb24gUmgoYSxiKXthLmZpbmlzaGVkV29yaz1udWxsO2EuZmluaXNoZWRMYW5lcz0wO3ZhciBjPWEudGltZW91dEhhbmRsZTtjIT09UmEmJihhLnRpbWVvdXRIYW5kbGU9UmEsUWEoYykpO2lmKG51bGwhPT1YKWZvcihjPVgucmV0dXJuO251bGwhPT1jOyl7dmFyIGQ9YztuZChkKTtzd2l0Y2goZC50YWcpe2Nhc2UgMTpkPWQudHlwZS5jaGlsZENvbnRleHRUeXBlcztudWxsIT09ZCYmdm9pZCAwIT09ZCYmbmMoKTticmVhaztjYXNlIDM6dGUoKTtxKHopO3EoeCk7eWUoKTticmVhaztjYXNlIDU6dmUoZCk7YnJlYWs7Y2FzZSA0OnRlKCk7YnJlYWs7Y2FzZSAxMzpxKEkpO2JyZWFrO2Nhc2UgMTk6cShJKTticmVhaztjYXNlIDEwOldkKGQudHlwZS5fY29udGV4dCk7YnJlYWs7Y2FzZSAyMjpjYXNlIDIzOkVnKCl9Yz1jLnJldHVybn1OPWE7WD1hPUpkKGEuY3VycmVudCxudWxsKTtaPSRmPWI7Uj0wO3ZoPW51bGw7eGg9d2g9bGU9MDt6aD15aD1udWxsO2lmKG51bGwhPT0kZCl7Zm9yKGI9XG4wO2I8JGQubGVuZ3RoO2IrKylpZihjPSRkW2JdLGQ9Yy5pbnRlcmxlYXZlZCxudWxsIT09ZCl7Yy5pbnRlcmxlYXZlZD1udWxsO3ZhciBlPWQubmV4dCxmPWMucGVuZGluZztpZihudWxsIT09Zil7dmFyIGc9Zi5uZXh0O2YubmV4dD1lO2QubmV4dD1nfWMucGVuZGluZz1kfSRkPW51bGx9cmV0dXJuIGF9XG5mdW5jdGlvbiBUaChhLGIpe2Rve3ZhciBjPVg7dHJ5e1VkKCk7emUuY3VycmVudD1MZTtpZihDZSl7Zm9yKHZhciBkPUoubWVtb2l6ZWRTdGF0ZTtudWxsIT09ZDspe3ZhciBlPWQucXVldWU7bnVsbCE9PWUmJihlLnBlbmRpbmc9bnVsbCk7ZD1kLm5leHR9Q2U9ITF9QmU9MDtMPUs9Sj1udWxsO0RlPSExO0VlPTA7dWguY3VycmVudD1udWxsO2lmKG51bGw9PT1jfHxudWxsPT09Yy5yZXR1cm4pe1I9MTt2aD1iO1g9bnVsbDticmVha31hOnt2YXIgZj1hLGc9Yy5yZXR1cm4saD1jLGs9YjtiPVo7aC5mbGFnc3w9MzI3Njg7aWYobnVsbCE9PWsmJlwib2JqZWN0XCI9PT10eXBlb2YgayYmXCJmdW5jdGlvblwiPT09dHlwZW9mIGsudGhlbil7dmFyIGw9ayxtPWgscj1tLnRhZztpZigwPT09KG0ubW9kZSYxKSYmKDA9PT1yfHwxMT09PXJ8fDE1PT09cikpe3ZhciBwPW0uYWx0ZXJuYXRlO3A/KG0udXBkYXRlUXVldWU9cC51cGRhdGVRdWV1ZSxtLm1lbW9pemVkU3RhdGU9cC5tZW1vaXplZFN0YXRlLFxubS5sYW5lcz1wLmxhbmVzKToobS51cGRhdGVRdWV1ZT1udWxsLG0ubWVtb2l6ZWRTdGF0ZT1udWxsKX12YXIgQj1QZihnKTtpZihudWxsIT09Qil7Qi5mbGFncyY9LTI1NztRZihCLGcsaCxmLGIpO0IubW9kZSYxJiZOZihmLGwsYik7Yj1CO2s9bDt2YXIgdz1iLnVwZGF0ZVF1ZXVlO2lmKG51bGw9PT13KXt2YXIgWT1uZXcgU2V0O1kuYWRkKGspO2IudXBkYXRlUXVldWU9WX1lbHNlIHcuYWRkKGspO2JyZWFrIGF9ZWxzZXtpZigwPT09KGImMSkpe05mKGYsbCxiKTtuZygpO2JyZWFrIGF9az1FcnJvcihuKDQyNikpfX1lbHNlIGlmKEYmJmgubW9kZSYxKXt2YXIgeWE9UGYoZyk7aWYobnVsbCE9PXlhKXswPT09KHlhLmZsYWdzJjY1NTM2KSYmKHlhLmZsYWdzfD0yNTYpO1FmKHlhLGcsaCxmLGIpO0JkKEVmKGssaCkpO2JyZWFrIGF9fWY9az1FZihrLGgpOzQhPT1SJiYoUj0yKTtudWxsPT09eWg/eWg9W2ZdOnloLnB1c2goZik7Zj1nO2Rve3N3aXRjaChmLnRhZyl7Y2FzZSAzOmYuZmxhZ3N8PVxuNjU1MzY7YiY9LWI7Zi5sYW5lc3w9Yjt2YXIgRT1JZihmLGssYik7amUoZixFKTticmVhayBhO2Nhc2UgMTpoPWs7dmFyIHU9Zi50eXBlLHQ9Zi5zdGF0ZU5vZGU7aWYoMD09PShmLmZsYWdzJjEyOCkmJihcImZ1bmN0aW9uXCI9PT10eXBlb2YgdS5nZXREZXJpdmVkU3RhdGVGcm9tRXJyb3J8fG51bGwhPT10JiZcImZ1bmN0aW9uXCI9PT10eXBlb2YgdC5jb21wb25lbnREaWRDYXRjaCYmKG51bGw9PT1NZnx8IU1mLmhhcyh0KSkpKXtmLmZsYWdzfD02NTUzNjtiJj0tYjtmLmxhbmVzfD1iO3ZhciBEYj1MZihmLGgsYik7amUoZixEYik7YnJlYWsgYX19Zj1mLnJldHVybn13aGlsZShudWxsIT09Zil9WWgoYyl9Y2F0Y2gobGMpe2I9bGM7WD09PWMmJm51bGwhPT1jJiYoWD1jPWMucmV0dXJuKTtjb250aW51ZX1icmVha313aGlsZSgxKX1mdW5jdGlvbiBRaCgpe3ZhciBhPXRoLmN1cnJlbnQ7dGguY3VycmVudD1MZTtyZXR1cm4gbnVsbD09PWE/TGU6YX1cbmZ1bmN0aW9uIG5nKCl7aWYoMD09PVJ8fDM9PT1SfHwyPT09UilSPTQ7bnVsbD09PU58fDA9PT0obGUmMjY4NDM1NDU1KSYmMD09PSh3aCYyNjg0MzU0NTUpfHxKaChOLFopfWZ1bmN0aW9uIFBoKGEsYil7dmFyIGM9SDtIfD0yO3ZhciBkPVFoKCk7aWYoTiE9PWF8fFohPT1iKUFoPW51bGwsUmgoYSxiKTtkbyB0cnl7WmgoKTticmVha31jYXRjaChlKXtUaChhLGUpfXdoaWxlKDEpO1VkKCk7SD1jO3RoLmN1cnJlbnQ9ZDtpZihudWxsIT09WCl0aHJvdyBFcnJvcihuKDI2MSkpO049bnVsbDtaPTA7cmV0dXJuIFJ9ZnVuY3Rpb24gWmgoKXtmb3IoO251bGwhPT1YOykkaChYKX1mdW5jdGlvbiBTaCgpe2Zvcig7bnVsbCE9PVgmJiFMYygpOykkaChYKX1mdW5jdGlvbiAkaChhKXt2YXIgYj1haShhLmFsdGVybmF0ZSxhLCRmKTthLm1lbW9pemVkUHJvcHM9YS5wZW5kaW5nUHJvcHM7bnVsbD09PWI/WWgoYSk6WD1iO3VoLmN1cnJlbnQ9bnVsbH1cbmZ1bmN0aW9uIFloKGEpe3ZhciBiPWE7ZG97dmFyIGM9Yi5hbHRlcm5hdGU7YT1iLnJldHVybjtpZigwPT09KGIuZmxhZ3MmMzI3NjgpKXtpZihjPUJnKGMsYiwkZiksbnVsbCE9PWMpe1g9YztyZXR1cm59fWVsc2V7Yz1GZyhjLGIpO2lmKG51bGwhPT1jKXtjLmZsYWdzJj0zMjc2NztYPWM7cmV0dXJufWlmKG51bGwhPT1hKWEuZmxhZ3N8PTMyNzY4LGEuc3VidHJlZUZsYWdzPTAsYS5kZWxldGlvbnM9bnVsbDtlbHNle1I9NjtYPW51bGw7cmV0dXJufX1iPWIuc2libGluZztpZihudWxsIT09Yil7WD1iO3JldHVybn1YPWI9YX13aGlsZShudWxsIT09Yik7MD09PVImJihSPTUpfWZ1bmN0aW9uIFdoKGEsYixjKXt2YXIgZD1DLGU9Vy50cmFuc2l0aW9uO3RyeXtXLnRyYW5zaXRpb249bnVsbCxDPTEsYmkoYSxiLGMsZCl9ZmluYWxseXtXLnRyYW5zaXRpb249ZSxDPWR9cmV0dXJuIG51bGx9XG5mdW5jdGlvbiBiaShhLGIsYyxkKXtkbyBPaCgpO3doaWxlKG51bGwhPT1EaCk7aWYoMCE9PShIJjYpKXRocm93IEVycm9yKG4oMzI3KSk7Yz1hLmZpbmlzaGVkV29yazt2YXIgZT1hLmZpbmlzaGVkTGFuZXM7aWYobnVsbD09PWMpcmV0dXJuIG51bGw7YS5maW5pc2hlZFdvcms9bnVsbDthLmZpbmlzaGVkTGFuZXM9MDtpZihjPT09YS5jdXJyZW50KXRocm93IEVycm9yKG4oMTc3KSk7YS5jYWxsYmFja05vZGU9bnVsbDthLmNhbGxiYWNrUHJpb3JpdHk9MDt2YXIgZj1jLmxhbmVzfGMuY2hpbGRMYW5lcztHYyhhLGYpO2E9PT1OJiYoWD1OPW51bGwsWj0wKTswPT09KGMuc3VidHJlZUZsYWdzJjIwNjQpJiYwPT09KGMuZmxhZ3MmMjA2NCl8fENofHwoQ2g9ITAsTWgoUGMsZnVuY3Rpb24oKXtPaCgpO3JldHVybiBudWxsfSkpO2Y9MCE9PShjLmZsYWdzJjE1OTkwKTtpZigwIT09KGMuc3VidHJlZUZsYWdzJjE1OTkwKXx8Zil7Zj1XLnRyYW5zaXRpb247Vy50cmFuc2l0aW9uPW51bGw7dmFyIGc9XG5DO0M9MTt2YXIgaD1IO0h8PTQ7dWguY3VycmVudD1udWxsO0xnKGEsYyk7JGcoYyxhKTtJYShhLmNvbnRhaW5lckluZm8pO2EuY3VycmVudD1jO2RoKGMsYSxlKTtNYygpO0g9aDtDPWc7Vy50cmFuc2l0aW9uPWZ9ZWxzZSBhLmN1cnJlbnQ9YztDaCYmKENoPSExLERoPWEsRWg9ZSk7Zj1hLnBlbmRpbmdMYW5lczswPT09ZiYmKE1mPW51bGwpO1RjKGMuc3RhdGVOb2RlLGQpO0toKGEsRCgpKTtpZihudWxsIT09Yilmb3IoZD1hLm9uUmVjb3ZlcmFibGVFcnJvcixjPTA7YzxiLmxlbmd0aDtjKyspZT1iW2NdLGQoZS52YWx1ZSx7Y29tcG9uZW50U3RhY2s6ZS5zdGFjayxkaWdlc3Q6ZS5kaWdlc3R9KTtpZihKZil0aHJvdyBKZj0hMSxhPUtmLEtmPW51bGwsYTswIT09KEVoJjEpJiYwIT09YS50YWcmJk9oKCk7Zj1hLnBlbmRpbmdMYW5lczswIT09KGYmMSk/YT09PUdoP0ZoKys6KEZoPTAsR2g9YSk6Rmg9MDthZCgpO3JldHVybiBudWxsfVxuZnVuY3Rpb24gT2goKXtpZihudWxsIT09RGgpe3ZhciBhPUljKEVoKSxiPVcudHJhbnNpdGlvbixjPUM7dHJ5e1cudHJhbnNpdGlvbj1udWxsO0M9MTY+YT8xNjphO2lmKG51bGw9PT1EaCl2YXIgZD0hMTtlbHNle2E9RGg7RGg9bnVsbDtFaD0wO2lmKDAhPT0oSCY2KSl0aHJvdyBFcnJvcihuKDMzMSkpO3ZhciBlPUg7SHw9NDtmb3IoVD1hLmN1cnJlbnQ7bnVsbCE9PVQ7KXt2YXIgZj1ULGc9Zi5jaGlsZDtpZigwIT09KFQuZmxhZ3MmMTYpKXt2YXIgaD1mLmRlbGV0aW9ucztpZihudWxsIT09aCl7Zm9yKHZhciBrPTA7azxoLmxlbmd0aDtrKyspe3ZhciBsPWhba107Zm9yKFQ9bDtudWxsIT09VDspe3ZhciBtPVQ7c3dpdGNoKG0udGFnKXtjYXNlIDA6Y2FzZSAxMTpjYXNlIDE1Ok1nKDgsbSxmKX12YXIgcj1tLmNoaWxkO2lmKG51bGwhPT1yKXIucmV0dXJuPW0sVD1yO2Vsc2UgZm9yKDtudWxsIT09VDspe209VDt2YXIgcD1tLnNpYmxpbmcsQj1tLnJldHVybjtQZyhtKTtpZihtPT09XG5sKXtUPW51bGw7YnJlYWt9aWYobnVsbCE9PXApe3AucmV0dXJuPUI7VD1wO2JyZWFrfVQ9Qn19fXZhciB3PWYuYWx0ZXJuYXRlO2lmKG51bGwhPT13KXt2YXIgWT13LmNoaWxkO2lmKG51bGwhPT1ZKXt3LmNoaWxkPW51bGw7ZG97dmFyIHlhPVkuc2libGluZztZLnNpYmxpbmc9bnVsbDtZPXlhfXdoaWxlKG51bGwhPT1ZKX19VD1mfX1pZigwIT09KGYuc3VidHJlZUZsYWdzJjIwNjQpJiZudWxsIT09ZylnLnJldHVybj1mLFQ9ZztlbHNlIGI6Zm9yKDtudWxsIT09VDspe2Y9VDtpZigwIT09KGYuZmxhZ3MmMjA0OCkpc3dpdGNoKGYudGFnKXtjYXNlIDA6Y2FzZSAxMTpjYXNlIDE1Ok1nKDksZixmLnJldHVybil9dmFyIEU9Zi5zaWJsaW5nO2lmKG51bGwhPT1FKXtFLnJldHVybj1mLnJldHVybjtUPUU7YnJlYWsgYn1UPWYucmV0dXJufX12YXIgdT1hLmN1cnJlbnQ7Zm9yKFQ9dTtudWxsIT09VDspe2c9VDt2YXIgdD1nLmNoaWxkO2lmKDAhPT0oZy5zdWJ0cmVlRmxhZ3MmMjA2NCkmJm51bGwhPT1cbnQpdC5yZXR1cm49ZyxUPXQ7ZWxzZSBiOmZvcihnPXU7bnVsbCE9PVQ7KXtoPVQ7aWYoMCE9PShoLmZsYWdzJjIwNDgpKXRyeXtzd2l0Y2goaC50YWcpe2Nhc2UgMDpjYXNlIDExOmNhc2UgMTU6TmcoOSxoKX19Y2F0Y2gobGMpe1UoaCxoLnJldHVybixsYyl9aWYoaD09PWcpe1Q9bnVsbDticmVhayBifXZhciBEYj1oLnNpYmxpbmc7aWYobnVsbCE9PURiKXtEYi5yZXR1cm49aC5yZXR1cm47VD1EYjticmVhayBifVQ9aC5yZXR1cm59fUg9ZTthZCgpO2lmKFNjJiZcImZ1bmN0aW9uXCI9PT10eXBlb2YgU2Mub25Qb3N0Q29tbWl0RmliZXJSb290KXRyeXtTYy5vblBvc3RDb21taXRGaWJlclJvb3QoUmMsYSl9Y2F0Y2gobGMpe31kPSEwfXJldHVybiBkfWZpbmFsbHl7Qz1jLFcudHJhbnNpdGlvbj1ifX1yZXR1cm4hMX1mdW5jdGlvbiBjaShhLGIsYyl7Yj1FZihjLGIpO2I9SWYoYSxiLDEpO2E9aGUoYSxiLDEpO2I9TygpO251bGwhPT1hJiYoRmMoYSwxLGIpLEtoKGEsYikpfVxuZnVuY3Rpb24gVShhLGIsYyl7aWYoMz09PWEudGFnKWNpKGEsYSxjKTtlbHNlIGZvcig7bnVsbCE9PWI7KXtpZigzPT09Yi50YWcpe2NpKGIsYSxjKTticmVha31lbHNlIGlmKDE9PT1iLnRhZyl7dmFyIGQ9Yi5zdGF0ZU5vZGU7aWYoXCJmdW5jdGlvblwiPT09dHlwZW9mIGIudHlwZS5nZXREZXJpdmVkU3RhdGVGcm9tRXJyb3J8fFwiZnVuY3Rpb25cIj09PXR5cGVvZiBkLmNvbXBvbmVudERpZENhdGNoJiYobnVsbD09PU1mfHwhTWYuaGFzKGQpKSl7YT1FZihjLGEpO2E9TGYoYixhLDEpO2I9aGUoYixhLDEpO2E9TygpO251bGwhPT1iJiYoRmMoYiwxLGEpLEtoKGIsYSkpO2JyZWFrfX1iPWIucmV0dXJufX1cbmZ1bmN0aW9uIE9mKGEsYixjKXt2YXIgZD1hLnBpbmdDYWNoZTtudWxsIT09ZCYmZC5kZWxldGUoYik7Yj1PKCk7YS5waW5nZWRMYW5lc3w9YS5zdXNwZW5kZWRMYW5lcyZjO049PT1hJiYoWiZjKT09PWMmJig0PT09Unx8Mz09PVImJihaJjEzMDAyMzQyNCk9PT1aJiY1MDA+RCgpLWJoP1JoKGEsMCk6eGh8PWMpO0toKGEsYil9ZnVuY3Rpb24gZGkoYSxiKXswPT09YiYmKDA9PT0oYS5tb2RlJjEpP2I9MTooYj14Yyx4Yzw8PTEsMD09PSh4YyYxMzAwMjM0MjQpJiYoeGM9NDE5NDMwNCkpKTt2YXIgYz1PKCk7YT1jZShhLGIpO251bGwhPT1hJiYoRmMoYSxiLGMpLEtoKGEsYykpfWZ1bmN0aW9uIG9nKGEpe3ZhciBiPWEubWVtb2l6ZWRTdGF0ZSxjPTA7bnVsbCE9PWImJihjPWIucmV0cnlMYW5lKTtkaShhLGMpfVxuZnVuY3Rpb24gWWcoYSxiKXt2YXIgYz0wO3N3aXRjaChhLnRhZyl7Y2FzZSAxMzp2YXIgZD1hLnN0YXRlTm9kZTt2YXIgZT1hLm1lbW9pemVkU3RhdGU7bnVsbCE9PWUmJihjPWUucmV0cnlMYW5lKTticmVhaztjYXNlIDE5OmQ9YS5zdGF0ZU5vZGU7YnJlYWs7ZGVmYXVsdDp0aHJvdyBFcnJvcihuKDMxNCkpO31udWxsIT09ZCYmZC5kZWxldGUoYik7ZGkoYSxjKX12YXIgYWk7XG5haT1mdW5jdGlvbihhLGIsYyl7aWYobnVsbCE9PWEpaWYoYS5tZW1vaXplZFByb3BzIT09Yi5wZW5kaW5nUHJvcHN8fHouY3VycmVudClHPSEwO2Vsc2V7aWYoMD09PShhLmxhbmVzJmMpJiYwPT09KGIuZmxhZ3MmMTI4KSlyZXR1cm4gRz0hMSxzZyhhLGIsYyk7Rz0wIT09KGEuZmxhZ3MmMTMxMDcyKT8hMDohMX1lbHNlIEc9ITEsRiYmMCE9PShiLmZsYWdzJjEwNDg1NzYpJiZsZChiLGVkLGIuaW5kZXgpO2IubGFuZXM9MDtzd2l0Y2goYi50YWcpe2Nhc2UgMjp2YXIgZD1iLnR5cGU7Y2coYSxiKTthPWIucGVuZGluZ1Byb3BzO3ZhciBlPW1jKGIseC5jdXJyZW50KTtZZChiLGMpO2U9SGUobnVsbCxiLGQsYSxlLGMpO3ZhciBmPU1lKCk7Yi5mbGFnc3w9MTtcIm9iamVjdFwiPT09dHlwZW9mIGUmJm51bGwhPT1lJiZcImZ1bmN0aW9uXCI9PT10eXBlb2YgZS5yZW5kZXImJnZvaWQgMD09PWUuJCR0eXBlb2Y/KGIudGFnPTEsYi5tZW1vaXplZFN0YXRlPW51bGwsYi51cGRhdGVRdWV1ZT1udWxsLFxuQShkKT8oZj0hMCxxYyhiKSk6Zj0hMSxiLm1lbW9pemVkU3RhdGU9bnVsbCE9PWUuc3RhdGUmJnZvaWQgMCE9PWUuc3RhdGU/ZS5zdGF0ZTpudWxsLGVlKGIpLGUudXBkYXRlcj16ZixiLnN0YXRlTm9kZT1lLGUuX3JlYWN0SW50ZXJuYWxzPWIsRGYoYixkLGEsYyksYj1kZyhudWxsLGIsZCwhMCxmLGMpKTooYi50YWc9MCxGJiZmJiZtZChiKSxQKG51bGwsYixlLGMpLGI9Yi5jaGlsZCk7cmV0dXJuIGI7Y2FzZSAxNjpkPWIuZWxlbWVudFR5cGU7YTp7Y2coYSxiKTthPWIucGVuZGluZ1Byb3BzO2U9ZC5faW5pdDtkPWUoZC5fcGF5bG9hZCk7Yi50eXBlPWQ7ZT1iLnRhZz1laShkKTthPXhmKGQsYSk7c3dpdGNoKGUpe2Nhc2UgMDpiPVhmKG51bGwsYixkLGEsYyk7YnJlYWsgYTtjYXNlIDE6Yj1iZyhudWxsLGIsZCxhLGMpO2JyZWFrIGE7Y2FzZSAxMTpiPVNmKG51bGwsYixkLGEsYyk7YnJlYWsgYTtjYXNlIDE0OmI9VWYobnVsbCxiLGQseGYoZC50eXBlLGEpLGMpO2JyZWFrIGF9dGhyb3cgRXJyb3IobigzMDYsXG5kLFwiXCIpKTt9cmV0dXJuIGI7Y2FzZSAwOnJldHVybiBkPWIudHlwZSxlPWIucGVuZGluZ1Byb3BzLGU9Yi5lbGVtZW50VHlwZT09PWQ/ZTp4ZihkLGUpLFhmKGEsYixkLGUsYyk7Y2FzZSAxOnJldHVybiBkPWIudHlwZSxlPWIucGVuZGluZ1Byb3BzLGU9Yi5lbGVtZW50VHlwZT09PWQ/ZTp4ZihkLGUpLGJnKGEsYixkLGUsYyk7Y2FzZSAzOmE6e2VnKGIpO2lmKG51bGw9PT1hKXRocm93IEVycm9yKG4oMzg3KSk7ZD1iLnBlbmRpbmdQcm9wcztmPWIubWVtb2l6ZWRTdGF0ZTtlPWYuZWxlbWVudDtmZShhLGIpO2tlKGIsZCxudWxsLGMpO3ZhciBnPWIubWVtb2l6ZWRTdGF0ZTtkPWcuZWxlbWVudDtpZihWYSYmZi5pc0RlaHlkcmF0ZWQpaWYoZj17ZWxlbWVudDpkLGlzRGVoeWRyYXRlZDohMSxjYWNoZTpnLmNhY2hlLHBlbmRpbmdTdXNwZW5zZUJvdW5kYXJpZXM6Zy5wZW5kaW5nU3VzcGVuc2VCb3VuZGFyaWVzLHRyYW5zaXRpb25zOmcudHJhbnNpdGlvbnN9LGIudXBkYXRlUXVldWUuYmFzZVN0YXRlPVxuZixiLm1lbW9pemVkU3RhdGU9ZixiLmZsYWdzJjI1Nil7ZT1FZihFcnJvcihuKDQyMykpLGIpO2I9ZmcoYSxiLGQsYyxlKTticmVhayBhfWVsc2UgaWYoZCE9PWUpe2U9RWYoRXJyb3Iobig0MjQpKSxiKTtiPWZnKGEsYixkLGMsZSk7YnJlYWsgYX1lbHNlIGZvcihWYSYmKHBkPVBiKGIuc3RhdGVOb2RlLmNvbnRhaW5lckluZm8pLG9kPWIsRj0hMCxyZD1udWxsLHFkPSExKSxjPVBkKGIsbnVsbCxkLGMpLGIuY2hpbGQ9YztjOyljLmZsYWdzPWMuZmxhZ3MmLTN8NDA5NixjPWMuc2libGluZztlbHNle0FkKCk7aWYoZD09PWUpe2I9VGYoYSxiLGMpO2JyZWFrIGF9UChhLGIsZCxjKX1iPWIuY2hpbGR9cmV0dXJuIGI7Y2FzZSA1OnJldHVybiB1ZShiKSxudWxsPT09YSYmd2QoYiksZD1iLnR5cGUsZT1iLnBlbmRpbmdQcm9wcyxmPW51bGwhPT1hP2EubWVtb2l6ZWRQcm9wczpudWxsLGc9ZS5jaGlsZHJlbixOYShkLGUpP2c9bnVsbDpudWxsIT09ZiYmTmEoZCxmKSYmKGIuZmxhZ3N8PTMyKSxcbmFnKGEsYiksUChhLGIsZyxjKSxiLmNoaWxkO2Nhc2UgNjpyZXR1cm4gbnVsbD09PWEmJndkKGIpLG51bGw7Y2FzZSAxMzpyZXR1cm4gaWcoYSxiLGMpO2Nhc2UgNDpyZXR1cm4gc2UoYixiLnN0YXRlTm9kZS5jb250YWluZXJJbmZvKSxkPWIucGVuZGluZ1Byb3BzLG51bGw9PT1hP2IuY2hpbGQ9T2QoYixudWxsLGQsYyk6UChhLGIsZCxjKSxiLmNoaWxkO2Nhc2UgMTE6cmV0dXJuIGQ9Yi50eXBlLGU9Yi5wZW5kaW5nUHJvcHMsZT1iLmVsZW1lbnRUeXBlPT09ZD9lOnhmKGQsZSksU2YoYSxiLGQsZSxjKTtjYXNlIDc6cmV0dXJuIFAoYSxiLGIucGVuZGluZ1Byb3BzLGMpLGIuY2hpbGQ7Y2FzZSA4OnJldHVybiBQKGEsYixiLnBlbmRpbmdQcm9wcy5jaGlsZHJlbixjKSxiLmNoaWxkO2Nhc2UgMTI6cmV0dXJuIFAoYSxiLGIucGVuZGluZ1Byb3BzLmNoaWxkcmVuLGMpLGIuY2hpbGQ7Y2FzZSAxMDphOntkPWIudHlwZS5fY29udGV4dDtlPWIucGVuZGluZ1Byb3BzO2Y9Yi5tZW1vaXplZFByb3BzO1xuZz1lLnZhbHVlO1ZkKGIsZCxnKTtpZihudWxsIT09ZilpZihWYyhmLnZhbHVlLGcpKXtpZihmLmNoaWxkcmVuPT09ZS5jaGlsZHJlbiYmIXouY3VycmVudCl7Yj1UZihhLGIsYyk7YnJlYWsgYX19ZWxzZSBmb3IoZj1iLmNoaWxkLG51bGwhPT1mJiYoZi5yZXR1cm49Yik7bnVsbCE9PWY7KXt2YXIgaD1mLmRlcGVuZGVuY2llcztpZihudWxsIT09aCl7Zz1mLmNoaWxkO2Zvcih2YXIgaz1oLmZpcnN0Q29udGV4dDtudWxsIT09azspe2lmKGsuY29udGV4dD09PWQpe2lmKDE9PT1mLnRhZyl7az1nZSgtMSxjJi1jKTtrLnRhZz0yO3ZhciBsPWYudXBkYXRlUXVldWU7aWYobnVsbCE9PWwpe2w9bC5zaGFyZWQ7dmFyIG09bC5wZW5kaW5nO251bGw9PT1tP2submV4dD1rOihrLm5leHQ9bS5uZXh0LG0ubmV4dD1rKTtsLnBlbmRpbmc9a319Zi5sYW5lc3w9YztrPWYuYWx0ZXJuYXRlO251bGwhPT1rJiYoay5sYW5lc3w9Yyk7WGQoZi5yZXR1cm4sYyxiKTtoLmxhbmVzfD1jO2JyZWFrfWs9ay5uZXh0fX1lbHNlIGlmKDEwPT09XG5mLnRhZylnPWYudHlwZT09PWIudHlwZT9udWxsOmYuY2hpbGQ7ZWxzZSBpZigxOD09PWYudGFnKXtnPWYucmV0dXJuO2lmKG51bGw9PT1nKXRocm93IEVycm9yKG4oMzQxKSk7Zy5sYW5lc3w9YztoPWcuYWx0ZXJuYXRlO251bGwhPT1oJiYoaC5sYW5lc3w9Yyk7WGQoZyxjLGIpO2c9Zi5zaWJsaW5nfWVsc2UgZz1mLmNoaWxkO2lmKG51bGwhPT1nKWcucmV0dXJuPWY7ZWxzZSBmb3IoZz1mO251bGwhPT1nOyl7aWYoZz09PWIpe2c9bnVsbDticmVha31mPWcuc2libGluZztpZihudWxsIT09Zil7Zi5yZXR1cm49Zy5yZXR1cm47Zz1mO2JyZWFrfWc9Zy5yZXR1cm59Zj1nfVAoYSxiLGUuY2hpbGRyZW4sYyk7Yj1iLmNoaWxkfXJldHVybiBiO2Nhc2UgOTpyZXR1cm4gZT1iLnR5cGUsZD1iLnBlbmRpbmdQcm9wcy5jaGlsZHJlbixZZChiLGMpLGU9WmQoZSksZD1kKGUpLGIuZmxhZ3N8PTEsUChhLGIsZCxjKSxiLmNoaWxkO2Nhc2UgMTQ6cmV0dXJuIGQ9Yi50eXBlLGU9eGYoZCxiLnBlbmRpbmdQcm9wcyksXG5lPXhmKGQudHlwZSxlKSxVZihhLGIsZCxlLGMpO2Nhc2UgMTU6cmV0dXJuIFdmKGEsYixiLnR5cGUsYi5wZW5kaW5nUHJvcHMsYyk7Y2FzZSAxNzpyZXR1cm4gZD1iLnR5cGUsZT1iLnBlbmRpbmdQcm9wcyxlPWIuZWxlbWVudFR5cGU9PT1kP2U6eGYoZCxlKSxjZyhhLGIpLGIudGFnPTEsQShkKT8oYT0hMCxxYyhiKSk6YT0hMSxZZChiLGMpLEJmKGIsZCxlKSxEZihiLGQsZSxjKSxkZyhudWxsLGIsZCwhMCxhLGMpO2Nhc2UgMTk6cmV0dXJuIHJnKGEsYixjKTtjYXNlIDIyOnJldHVybiBZZihhLGIsYyl9dGhyb3cgRXJyb3IobigxNTYsYi50YWcpKTt9O2Z1bmN0aW9uIE1oKGEsYil7cmV0dXJuIEpjKGEsYil9XG5mdW5jdGlvbiBmaShhLGIsYyxkKXt0aGlzLnRhZz1hO3RoaXMua2V5PWM7dGhpcy5zaWJsaW5nPXRoaXMuY2hpbGQ9dGhpcy5yZXR1cm49dGhpcy5zdGF0ZU5vZGU9dGhpcy50eXBlPXRoaXMuZWxlbWVudFR5cGU9bnVsbDt0aGlzLmluZGV4PTA7dGhpcy5yZWY9bnVsbDt0aGlzLnBlbmRpbmdQcm9wcz1iO3RoaXMuZGVwZW5kZW5jaWVzPXRoaXMubWVtb2l6ZWRTdGF0ZT10aGlzLnVwZGF0ZVF1ZXVlPXRoaXMubWVtb2l6ZWRQcm9wcz1udWxsO3RoaXMubW9kZT1kO3RoaXMuc3VidHJlZUZsYWdzPXRoaXMuZmxhZ3M9MDt0aGlzLmRlbGV0aW9ucz1udWxsO3RoaXMuY2hpbGRMYW5lcz10aGlzLmxhbmVzPTA7dGhpcy5hbHRlcm5hdGU9bnVsbH1mdW5jdGlvbiB0ZChhLGIsYyxkKXtyZXR1cm4gbmV3IGZpKGEsYixjLGQpfWZ1bmN0aW9uIFZmKGEpe2E9YS5wcm90b3R5cGU7cmV0dXJuISghYXx8IWEuaXNSZWFjdENvbXBvbmVudCl9XG5mdW5jdGlvbiBlaShhKXtpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgYSlyZXR1cm4gVmYoYSk/MTowO2lmKHZvaWQgMCE9PWEmJm51bGwhPT1hKXthPWEuJCR0eXBlb2Y7aWYoYT09PW1hKXJldHVybiAxMTtpZihhPT09cGEpcmV0dXJuIDE0fXJldHVybiAyfVxuZnVuY3Rpb24gSmQoYSxiKXt2YXIgYz1hLmFsdGVybmF0ZTtudWxsPT09Yz8oYz10ZChhLnRhZyxiLGEua2V5LGEubW9kZSksYy5lbGVtZW50VHlwZT1hLmVsZW1lbnRUeXBlLGMudHlwZT1hLnR5cGUsYy5zdGF0ZU5vZGU9YS5zdGF0ZU5vZGUsYy5hbHRlcm5hdGU9YSxhLmFsdGVybmF0ZT1jKTooYy5wZW5kaW5nUHJvcHM9YixjLnR5cGU9YS50eXBlLGMuZmxhZ3M9MCxjLnN1YnRyZWVGbGFncz0wLGMuZGVsZXRpb25zPW51bGwpO2MuZmxhZ3M9YS5mbGFncyYxNDY4MDA2NDtjLmNoaWxkTGFuZXM9YS5jaGlsZExhbmVzO2MubGFuZXM9YS5sYW5lcztjLmNoaWxkPWEuY2hpbGQ7Yy5tZW1vaXplZFByb3BzPWEubWVtb2l6ZWRQcm9wcztjLm1lbW9pemVkU3RhdGU9YS5tZW1vaXplZFN0YXRlO2MudXBkYXRlUXVldWU9YS51cGRhdGVRdWV1ZTtiPWEuZGVwZW5kZW5jaWVzO2MuZGVwZW5kZW5jaWVzPW51bGw9PT1iP251bGw6e2xhbmVzOmIubGFuZXMsZmlyc3RDb250ZXh0OmIuZmlyc3RDb250ZXh0fTtcbmMuc2libGluZz1hLnNpYmxpbmc7Yy5pbmRleD1hLmluZGV4O2MucmVmPWEucmVmO3JldHVybiBjfVxuZnVuY3Rpb24gTGQoYSxiLGMsZCxlLGYpe3ZhciBnPTI7ZD1hO2lmKFwiZnVuY3Rpb25cIj09PXR5cGVvZiBhKVZmKGEpJiYoZz0xKTtlbHNlIGlmKFwic3RyaW5nXCI9PT10eXBlb2YgYSlnPTU7ZWxzZSBhOnN3aXRjaChhKXtjYXNlIGhhOnJldHVybiBOZChjLmNoaWxkcmVuLGUsZixiKTtjYXNlIGlhOmc9ODtlfD04O2JyZWFrO2Nhc2UgamE6cmV0dXJuIGE9dGQoMTIsYyxiLGV8MiksYS5lbGVtZW50VHlwZT1qYSxhLmxhbmVzPWYsYTtjYXNlIG5hOnJldHVybiBhPXRkKDEzLGMsYixlKSxhLmVsZW1lbnRUeXBlPW5hLGEubGFuZXM9ZixhO2Nhc2Ugb2E6cmV0dXJuIGE9dGQoMTksYyxiLGUpLGEuZWxlbWVudFR5cGU9b2EsYS5sYW5lcz1mLGE7Y2FzZSByYTpyZXR1cm4gamcoYyxlLGYsYik7ZGVmYXVsdDppZihcIm9iamVjdFwiPT09dHlwZW9mIGEmJm51bGwhPT1hKXN3aXRjaChhLiQkdHlwZW9mKXtjYXNlIGthOmc9MTA7YnJlYWsgYTtjYXNlIGxhOmc9OTticmVhayBhO2Nhc2UgbWE6Zz0xMTtcbmJyZWFrIGE7Y2FzZSBwYTpnPTE0O2JyZWFrIGE7Y2FzZSBxYTpnPTE2O2Q9bnVsbDticmVhayBhfXRocm93IEVycm9yKG4oMTMwLG51bGw9PWE/YTp0eXBlb2YgYSxcIlwiKSk7fWI9dGQoZyxjLGIsZSk7Yi5lbGVtZW50VHlwZT1hO2IudHlwZT1kO2IubGFuZXM9ZjtyZXR1cm4gYn1mdW5jdGlvbiBOZChhLGIsYyxkKXthPXRkKDcsYSxkLGIpO2EubGFuZXM9YztyZXR1cm4gYX1mdW5jdGlvbiBqZyhhLGIsYyxkKXthPXRkKDIyLGEsZCxiKTthLmVsZW1lbnRUeXBlPXJhO2EubGFuZXM9YzthLnN0YXRlTm9kZT17aXNIaWRkZW46ITF9O3JldHVybiBhfWZ1bmN0aW9uIEtkKGEsYixjKXthPXRkKDYsYSxudWxsLGIpO2EubGFuZXM9YztyZXR1cm4gYX1cbmZ1bmN0aW9uIE1kKGEsYixjKXtiPXRkKDQsbnVsbCE9PWEuY2hpbGRyZW4/YS5jaGlsZHJlbjpbXSxhLmtleSxiKTtiLmxhbmVzPWM7Yi5zdGF0ZU5vZGU9e2NvbnRhaW5lckluZm86YS5jb250YWluZXJJbmZvLHBlbmRpbmdDaGlsZHJlbjpudWxsLGltcGxlbWVudGF0aW9uOmEuaW1wbGVtZW50YXRpb259O3JldHVybiBifVxuZnVuY3Rpb24gZ2koYSxiLGMsZCxlKXt0aGlzLnRhZz1iO3RoaXMuY29udGFpbmVySW5mbz1hO3RoaXMuZmluaXNoZWRXb3JrPXRoaXMucGluZ0NhY2hlPXRoaXMuY3VycmVudD10aGlzLnBlbmRpbmdDaGlsZHJlbj1udWxsO3RoaXMudGltZW91dEhhbmRsZT1SYTt0aGlzLmNhbGxiYWNrTm9kZT10aGlzLnBlbmRpbmdDb250ZXh0PXRoaXMuY29udGV4dD1udWxsO3RoaXMuY2FsbGJhY2tQcmlvcml0eT0wO3RoaXMuZXZlbnRUaW1lcz1FYygwKTt0aGlzLmV4cGlyYXRpb25UaW1lcz1FYygtMSk7dGhpcy5lbnRhbmdsZWRMYW5lcz10aGlzLmZpbmlzaGVkTGFuZXM9dGhpcy5tdXRhYmxlUmVhZExhbmVzPXRoaXMuZXhwaXJlZExhbmVzPXRoaXMucGluZ2VkTGFuZXM9dGhpcy5zdXNwZW5kZWRMYW5lcz10aGlzLnBlbmRpbmdMYW5lcz0wO3RoaXMuZW50YW5nbGVtZW50cz1FYygwKTt0aGlzLmlkZW50aWZpZXJQcmVmaXg9ZDt0aGlzLm9uUmVjb3ZlcmFibGVFcnJvcj1lO1ZhJiYodGhpcy5tdXRhYmxlU291cmNlRWFnZXJIeWRyYXRpb25EYXRhPVxubnVsbCl9ZnVuY3Rpb24gaGkoYSxiLGMsZCxlLGYsZyxoLGspe2E9bmV3IGdpKGEsYixjLGgsayk7MT09PWI/KGI9MSwhMD09PWYmJihifD04KSk6Yj0wO2Y9dGQoMyxudWxsLG51bGwsYik7YS5jdXJyZW50PWY7Zi5zdGF0ZU5vZGU9YTtmLm1lbW9pemVkU3RhdGU9e2VsZW1lbnQ6ZCxpc0RlaHlkcmF0ZWQ6YyxjYWNoZTpudWxsLHRyYW5zaXRpb25zOm51bGwscGVuZGluZ1N1c3BlbnNlQm91bmRhcmllczpudWxsfTtlZShmKTtyZXR1cm4gYX1cbmZ1bmN0aW9uIGlpKGEpe2lmKCFhKXJldHVybiBqYzthPWEuX3JlYWN0SW50ZXJuYWxzO2E6e2lmKHdhKGEpIT09YXx8MSE9PWEudGFnKXRocm93IEVycm9yKG4oMTcwKSk7dmFyIGI9YTtkb3tzd2l0Y2goYi50YWcpe2Nhc2UgMzpiPWIuc3RhdGVOb2RlLmNvbnRleHQ7YnJlYWsgYTtjYXNlIDE6aWYoQShiLnR5cGUpKXtiPWIuc3RhdGVOb2RlLl9fcmVhY3RJbnRlcm5hbE1lbW9pemVkTWVyZ2VkQ2hpbGRDb250ZXh0O2JyZWFrIGF9fWI9Yi5yZXR1cm59d2hpbGUobnVsbCE9PWIpO3Rocm93IEVycm9yKG4oMTcxKSk7fWlmKDE9PT1hLnRhZyl7dmFyIGM9YS50eXBlO2lmKEEoYykpcmV0dXJuIHBjKGEsYyxiKX1yZXR1cm4gYn1cbmZ1bmN0aW9uIGppKGEpe3ZhciBiPWEuX3JlYWN0SW50ZXJuYWxzO2lmKHZvaWQgMD09PWIpe2lmKFwiZnVuY3Rpb25cIj09PXR5cGVvZiBhLnJlbmRlcil0aHJvdyBFcnJvcihuKDE4OCkpO2E9T2JqZWN0LmtleXMoYSkuam9pbihcIixcIik7dGhyb3cgRXJyb3IobigyNjgsYSkpO31hPUFhKGIpO3JldHVybiBudWxsPT09YT9udWxsOmEuc3RhdGVOb2RlfWZ1bmN0aW9uIGtpKGEsYil7YT1hLm1lbW9pemVkU3RhdGU7aWYobnVsbCE9PWEmJm51bGwhPT1hLmRlaHlkcmF0ZWQpe3ZhciBjPWEucmV0cnlMYW5lO2EucmV0cnlMYW5lPTAhPT1jJiZjPGI/YzpifX1mdW5jdGlvbiBsaShhLGIpe2tpKGEsYik7KGE9YS5hbHRlcm5hdGUpJiZraShhLGIpfWZ1bmN0aW9uIG1pKGEpe2E9QWEoYSk7cmV0dXJuIG51bGw9PT1hP251bGw6YS5zdGF0ZU5vZGV9ZnVuY3Rpb24gbmkoKXtyZXR1cm4gbnVsbH1cbmV4cG9ydHMuYXR0ZW1wdENvbnRpbnVvdXNIeWRyYXRpb249ZnVuY3Rpb24oYSl7aWYoMTM9PT1hLnRhZyl7dmFyIGI9Y2UoYSwxMzQyMTc3MjgpO2lmKG51bGwhPT1iKXt2YXIgYz1PKCk7YWYoYixhLDEzNDIxNzcyOCxjKX1saShhLDEzNDIxNzcyOCl9fTtleHBvcnRzLmF0dGVtcHREaXNjcmV0ZUh5ZHJhdGlvbj1mdW5jdGlvbihhKXtpZigxMz09PWEudGFnKXt2YXIgYj1jZShhLDEpO2lmKG51bGwhPT1iKXt2YXIgYz1PKCk7YWYoYixhLDEsYyl9bGkoYSwxKX19O2V4cG9ydHMuYXR0ZW1wdEh5ZHJhdGlvbkF0Q3VycmVudFByaW9yaXR5PWZ1bmN0aW9uKGEpe2lmKDEzPT09YS50YWcpe3ZhciBiPXRmKGEpLGM9Y2UoYSxiKTtpZihudWxsIT09Yyl7dmFyIGQ9TygpO2FmKGMsYSxiLGQpfWxpKGEsYil9fTtcbmV4cG9ydHMuYXR0ZW1wdFN5bmNocm9ub3VzSHlkcmF0aW9uPWZ1bmN0aW9uKGEpe3N3aXRjaChhLnRhZyl7Y2FzZSAzOnZhciBiPWEuc3RhdGVOb2RlO2lmKGIuY3VycmVudC5tZW1vaXplZFN0YXRlLmlzRGVoeWRyYXRlZCl7dmFyIGM9eWMoYi5wZW5kaW5nTGFuZXMpOzAhPT1jJiYoSGMoYixjfDEpLEtoKGIsRCgpKSwwPT09KEgmNikmJihCaCgpLGFkKCkpKX1icmVhaztjYXNlIDEzOlhoKGZ1bmN0aW9uKCl7dmFyIGI9Y2UoYSwxKTtpZihudWxsIT09Yil7dmFyIGM9TygpO2FmKGIsYSwxLGMpfX0pLGxpKGEsMSl9fTtleHBvcnRzLmJhdGNoZWRVcGRhdGVzPWZ1bmN0aW9uKGEsYil7dmFyIGM9SDtIfD0xO3RyeXtyZXR1cm4gYShiKX1maW5hbGx5e0g9YywwPT09SCYmKEJoKCksWGMmJmFkKCkpfX07ZXhwb3J0cy5jcmVhdGVDb21wb25lbnRTZWxlY3Rvcj1mdW5jdGlvbihhKXtyZXR1cm57JCR0eXBlb2Y6aGgsdmFsdWU6YX19O1xuZXhwb3J0cy5jcmVhdGVDb250YWluZXI9ZnVuY3Rpb24oYSxiLGMsZCxlLGYsZyl7cmV0dXJuIGhpKGEsYiwhMSxudWxsLGMsZCxlLGYsZyl9O2V4cG9ydHMuY3JlYXRlSGFzUHNldWRvQ2xhc3NTZWxlY3Rvcj1mdW5jdGlvbihhKXtyZXR1cm57JCR0eXBlb2Y6aWgsdmFsdWU6YX19O2V4cG9ydHMuY3JlYXRlSHlkcmF0aW9uQ29udGFpbmVyPWZ1bmN0aW9uKGEsYixjLGQsZSxmLGcsaCxrKXthPWhpKGMsZCwhMCxhLGUsZixnLGgsayk7YS5jb250ZXh0PWlpKG51bGwpO2M9YS5jdXJyZW50O2Q9TygpO2U9dGYoYyk7Zj1nZShkLGUpO2YuY2FsbGJhY2s9dm9pZCAwIT09YiYmbnVsbCE9PWI/YjpudWxsO2hlKGMsZixlKTthLmN1cnJlbnQubGFuZXM9ZTtGYyhhLGUsZCk7S2goYSxkKTtyZXR1cm4gYX07XG5leHBvcnRzLmNyZWF0ZVBvcnRhbD1mdW5jdGlvbihhLGIsYyl7dmFyIGQ9Mzxhcmd1bWVudHMubGVuZ3RoJiZ2b2lkIDAhPT1hcmd1bWVudHNbM10/YXJndW1lbnRzWzNdOm51bGw7cmV0dXJueyQkdHlwZW9mOmZhLGtleTpudWxsPT1kP251bGw6XCJcIitkLGNoaWxkcmVuOmEsY29udGFpbmVySW5mbzpiLGltcGxlbWVudGF0aW9uOmN9fTtleHBvcnRzLmNyZWF0ZVJvbGVTZWxlY3Rvcj1mdW5jdGlvbihhKXtyZXR1cm57JCR0eXBlb2Y6amgsdmFsdWU6YX19O2V4cG9ydHMuY3JlYXRlVGVzdE5hbWVTZWxlY3Rvcj1mdW5jdGlvbihhKXtyZXR1cm57JCR0eXBlb2Y6a2gsdmFsdWU6YX19O2V4cG9ydHMuY3JlYXRlVGV4dFNlbGVjdG9yPWZ1bmN0aW9uKGEpe3JldHVybnskJHR5cGVvZjpsaCx2YWx1ZTphfX07XG5leHBvcnRzLmRlZmVycmVkVXBkYXRlcz1mdW5jdGlvbihhKXt2YXIgYj1DLGM9Vy50cmFuc2l0aW9uO3RyeXtyZXR1cm4gVy50cmFuc2l0aW9uPW51bGwsQz0xNixhKCl9ZmluYWxseXtDPWIsVy50cmFuc2l0aW9uPWN9fTtleHBvcnRzLmRpc2NyZXRlVXBkYXRlcz1mdW5jdGlvbihhLGIsYyxkLGUpe3ZhciBmPUMsZz1XLnRyYW5zaXRpb247dHJ5e3JldHVybiBXLnRyYW5zaXRpb249bnVsbCxDPTEsYShiLGMsZCxlKX1maW5hbGx5e0M9ZixXLnRyYW5zaXRpb249ZywwPT09SCYmQmgoKX19O2V4cG9ydHMuZmluZEFsbE5vZGVzPXJoO1xuZXhwb3J0cy5maW5kQm91bmRpbmdSZWN0cz1mdW5jdGlvbihhLGIpe2lmKCFiYil0aHJvdyBFcnJvcihuKDM2MykpO2I9cmgoYSxiKTthPVtdO2Zvcih2YXIgYz0wO2M8Yi5sZW5ndGg7YysrKWEucHVzaChkYihiW2NdKSk7Zm9yKGI9YS5sZW5ndGgtMTswPGI7Yi0tKXtjPWFbYl07Zm9yKHZhciBkPWMueCxlPWQrYy53aWR0aCxmPWMueSxnPWYrYy5oZWlnaHQsaD1iLTE7MDw9aDtoLS0paWYoYiE9PWgpe3ZhciBrPWFbaF0sbD1rLngsbT1sK2sud2lkdGgscj1rLnkscD1yK2suaGVpZ2h0O2lmKGQ+PWwmJmY+PXImJmU8PW0mJmc8PXApe2Euc3BsaWNlKGIsMSk7YnJlYWt9ZWxzZSBpZighKGQhPT1sfHxjLndpZHRoIT09ay53aWR0aHx8cDxmfHxyPmcpKXtyPmYmJihrLmhlaWdodCs9ci1mLGsueT1mKTtwPGcmJihrLmhlaWdodD1nLXIpO2Euc3BsaWNlKGIsMSk7YnJlYWt9ZWxzZSBpZighKGYhPT1yfHxjLmhlaWdodCE9PWsuaGVpZ2h0fHxtPGR8fGw+ZSkpe2w+ZCYmKGsud2lkdGgrPVxubC1kLGsueD1kKTttPGUmJihrLndpZHRoPWUtbCk7YS5zcGxpY2UoYiwxKTticmVha319fXJldHVybiBhfTtleHBvcnRzLmZpbmRIb3N0SW5zdGFuY2U9amk7ZXhwb3J0cy5maW5kSG9zdEluc3RhbmNlV2l0aE5vUG9ydGFscz1mdW5jdGlvbihhKXthPXphKGEpO2E9bnVsbCE9PWE/Q2EoYSk6bnVsbDtyZXR1cm4gbnVsbD09PWE/bnVsbDphLnN0YXRlTm9kZX07ZXhwb3J0cy5maW5kSG9zdEluc3RhbmNlV2l0aFdhcm5pbmc9ZnVuY3Rpb24oYSl7cmV0dXJuIGppKGEpfTtleHBvcnRzLmZsdXNoQ29udHJvbGxlZD1mdW5jdGlvbihhKXt2YXIgYj1IO0h8PTE7dmFyIGM9Vy50cmFuc2l0aW9uLGQ9Qzt0cnl7Vy50cmFuc2l0aW9uPW51bGwsQz0xLGEoKX1maW5hbGx5e0M9ZCxXLnRyYW5zaXRpb249YyxIPWIsMD09PUgmJihCaCgpLGFkKCkpfX07ZXhwb3J0cy5mbHVzaFBhc3NpdmVFZmZlY3RzPU9oO2V4cG9ydHMuZmx1c2hTeW5jPVhoO1xuZXhwb3J0cy5mb2N1c1dpdGhpbj1mdW5jdGlvbihhLGIpe2lmKCFiYil0aHJvdyBFcnJvcihuKDM2MykpO2E9bmgoYSk7Yj1xaChhLGIpO2I9QXJyYXkuZnJvbShiKTtmb3IoYT0wO2E8Yi5sZW5ndGg7KXt2YXIgYz1iW2ErK107aWYoIWZiKGMpKXtpZig1PT09Yy50YWcmJmhiKGMuc3RhdGVOb2RlKSlyZXR1cm4hMDtmb3IoYz1jLmNoaWxkO251bGwhPT1jOyliLnB1c2goYyksYz1jLnNpYmxpbmd9fXJldHVybiExfTtleHBvcnRzLmdldEN1cnJlbnRVcGRhdGVQcmlvcml0eT1mdW5jdGlvbigpe3JldHVybiBDfTtcbmV4cG9ydHMuZ2V0RmluZEFsbE5vZGVzRmFpbHVyZURlc2NyaXB0aW9uPWZ1bmN0aW9uKGEsYil7aWYoIWJiKXRocm93IEVycm9yKG4oMzYzKSk7dmFyIGM9MCxkPVtdO2E9W25oKGEpLDBdO2Zvcih2YXIgZT0wO2U8YS5sZW5ndGg7KXt2YXIgZj1hW2UrK10sZz1hW2UrK10saD1iW2ddO2lmKDUhPT1mLnRhZ3x8IWZiKGYpKWlmKG9oKGYsaCkmJihkLnB1c2gocGgoaCkpLGcrKyxnPmMmJihjPWcpKSxnPGIubGVuZ3RoKWZvcihmPWYuY2hpbGQ7bnVsbCE9PWY7KWEucHVzaChmLGcpLGY9Zi5zaWJsaW5nfWlmKGM8Yi5sZW5ndGgpe2ZvcihhPVtdO2M8Yi5sZW5ndGg7YysrKWEucHVzaChwaChiW2NdKSk7cmV0dXJuXCJmaW5kQWxsTm9kZXMgd2FzIGFibGUgdG8gbWF0Y2ggcGFydCBvZiB0aGUgc2VsZWN0b3I6XFxuICBcIisoZC5qb2luKFwiID4gXCIpK1wiXFxuXFxuTm8gbWF0Y2hpbmcgY29tcG9uZW50IHdhcyBmb3VuZCBmb3I6XFxuICBcIikrYS5qb2luKFwiID4gXCIpfXJldHVybiBudWxsfTtcbmV4cG9ydHMuZ2V0UHVibGljUm9vdEluc3RhbmNlPWZ1bmN0aW9uKGEpe2E9YS5jdXJyZW50O2lmKCFhLmNoaWxkKXJldHVybiBudWxsO3N3aXRjaChhLmNoaWxkLnRhZyl7Y2FzZSA1OnJldHVybiBFYShhLmNoaWxkLnN0YXRlTm9kZSk7ZGVmYXVsdDpyZXR1cm4gYS5jaGlsZC5zdGF0ZU5vZGV9fTtcbmV4cG9ydHMuaW5qZWN0SW50b0RldlRvb2xzPWZ1bmN0aW9uKGEpe2E9e2J1bmRsZVR5cGU6YS5idW5kbGVUeXBlLHZlcnNpb246YS52ZXJzaW9uLHJlbmRlcmVyUGFja2FnZU5hbWU6YS5yZW5kZXJlclBhY2thZ2VOYW1lLHJlbmRlcmVyQ29uZmlnOmEucmVuZGVyZXJDb25maWcsb3ZlcnJpZGVIb29rU3RhdGU6bnVsbCxvdmVycmlkZUhvb2tTdGF0ZURlbGV0ZVBhdGg6bnVsbCxvdmVycmlkZUhvb2tTdGF0ZVJlbmFtZVBhdGg6bnVsbCxvdmVycmlkZVByb3BzOm51bGwsb3ZlcnJpZGVQcm9wc0RlbGV0ZVBhdGg6bnVsbCxvdmVycmlkZVByb3BzUmVuYW1lUGF0aDpudWxsLHNldEVycm9ySGFuZGxlcjpudWxsLHNldFN1c3BlbnNlSGFuZGxlcjpudWxsLHNjaGVkdWxlVXBkYXRlOm51bGwsY3VycmVudERpc3BhdGNoZXJSZWY6ZGEuUmVhY3RDdXJyZW50RGlzcGF0Y2hlcixmaW5kSG9zdEluc3RhbmNlQnlGaWJlcjptaSxmaW5kRmliZXJCeUhvc3RJbnN0YW5jZTphLmZpbmRGaWJlckJ5SG9zdEluc3RhbmNlfHxcbm5pLGZpbmRIb3N0SW5zdGFuY2VzRm9yUmVmcmVzaDpudWxsLHNjaGVkdWxlUmVmcmVzaDpudWxsLHNjaGVkdWxlUm9vdDpudWxsLHNldFJlZnJlc2hIYW5kbGVyOm51bGwsZ2V0Q3VycmVudEZpYmVyOm51bGwscmVjb25jaWxlclZlcnNpb246XCIxOC4zLjFcIn07aWYoXCJ1bmRlZmluZWRcIj09PXR5cGVvZiBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18pYT0hMTtlbHNle3ZhciBiPV9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXztpZihiLmlzRGlzYWJsZWR8fCFiLnN1cHBvcnRzRmliZXIpYT0hMDtlbHNle3RyeXtSYz1iLmluamVjdChhKSxTYz1ifWNhdGNoKGMpe31hPWIuY2hlY2tEQ0U/ITA6ITF9fXJldHVybiBhfTtleHBvcnRzLmlzQWxyZWFkeVJlbmRlcmluZz1mdW5jdGlvbigpe3JldHVybiExfTtcbmV4cG9ydHMub2JzZXJ2ZVZpc2libGVSZWN0cz1mdW5jdGlvbihhLGIsYyxkKXtpZighYmIpdGhyb3cgRXJyb3IobigzNjMpKTthPXJoKGEsYik7dmFyIGU9aWIoYSxjLGQpLmRpc2Nvbm5lY3Q7cmV0dXJue2Rpc2Nvbm5lY3Q6ZnVuY3Rpb24oKXtlKCl9fX07ZXhwb3J0cy5yZWdpc3Rlck11dGFibGVTb3VyY2VGb3JIeWRyYXRpb249ZnVuY3Rpb24oYSxiKXt2YXIgYz1iLl9nZXRWZXJzaW9uO2M9YyhiLl9zb3VyY2UpO251bGw9PWEubXV0YWJsZVNvdXJjZUVhZ2VySHlkcmF0aW9uRGF0YT9hLm11dGFibGVTb3VyY2VFYWdlckh5ZHJhdGlvbkRhdGE9W2IsY106YS5tdXRhYmxlU291cmNlRWFnZXJIeWRyYXRpb25EYXRhLnB1c2goYixjKX07ZXhwb3J0cy5ydW5XaXRoUHJpb3JpdHk9ZnVuY3Rpb24oYSxiKXt2YXIgYz1DO3RyeXtyZXR1cm4gQz1hLGIoKX1maW5hbGx5e0M9Y319O2V4cG9ydHMuc2hvdWxkRXJyb3I9ZnVuY3Rpb24oKXtyZXR1cm4gbnVsbH07XG5leHBvcnRzLnNob3VsZFN1c3BlbmQ9ZnVuY3Rpb24oKXtyZXR1cm4hMX07ZXhwb3J0cy51cGRhdGVDb250YWluZXI9ZnVuY3Rpb24oYSxiLGMsZCl7dmFyIGU9Yi5jdXJyZW50LGY9TygpLGc9dGYoZSk7Yz1paShjKTtudWxsPT09Yi5jb250ZXh0P2IuY29udGV4dD1jOmIucGVuZGluZ0NvbnRleHQ9YztiPWdlKGYsZyk7Yi5wYXlsb2FkPXtlbGVtZW50OmF9O2Q9dm9pZCAwPT09ZD9udWxsOmQ7bnVsbCE9PWQmJihiLmNhbGxiYWNrPWQpO2E9aGUoZSxiLGcpO251bGwhPT1hJiYoYWYoYSxlLGcsZiksaWUoYSxlLGcpKTtyZXR1cm4gZ307XG5cbiAgICByZXR1cm4gZXhwb3J0cztcbn07XG4iLCAiJ3VzZSBzdHJpY3QnO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJykge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LXJlY29uY2lsZXIucHJvZHVjdGlvbi5taW4uanMnKTtcbn0gZWxzZSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QtcmVjb25jaWxlci5kZXZlbG9wbWVudC5qcycpO1xufVxuIiwgIi8qKlxuICogQGxpY2Vuc2UgUmVhY3RcbiAqIHJlYWN0LXJlY29uY2lsZXItY29uc3RhbnRzLnByb2R1Y3Rpb24ubWluLmpzXG4gKlxuICogQ29weXJpZ2h0IChjKSBGYWNlYm9vaywgSW5jLiBhbmQgaXRzIGFmZmlsaWF0ZXMuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuXG4gKi9cbid1c2Ugc3RyaWN0JztleHBvcnRzLkNvbmN1cnJlbnRSb290PTE7ZXhwb3J0cy5Db250aW51b3VzRXZlbnRQcmlvcml0eT00O2V4cG9ydHMuRGVmYXVsdEV2ZW50UHJpb3JpdHk9MTY7ZXhwb3J0cy5EaXNjcmV0ZUV2ZW50UHJpb3JpdHk9MTtleHBvcnRzLklkbGVFdmVudFByaW9yaXR5PTUzNjg3MDkxMjtleHBvcnRzLkxlZ2FjeVJvb3Q9MDtcbiIsICIndXNlIHN0cmljdCc7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QtcmVjb25jaWxlci1jb25zdGFudHMucHJvZHVjdGlvbi5taW4uanMnKTtcbn0gZWxzZSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9janMvcmVhY3QtcmVjb25jaWxlci1jb25zdGFudHMuZGV2ZWxvcG1lbnQuanMnKTtcbn1cbiIsICJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgVmlldywgVGV4dCwgcmVuZGVyIH0gZnJvbSAnQGdseXgtZGV2L3JlYWN0JztcblxuZnVuY3Rpb24gQXBwKCkge1xuICByZXR1cm4gKFxuICAgIDxWaWV3XG4gICAgICBzdHlsZT17e1xuICAgICAgICBmbGV4OiAxLFxuICAgICAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcbiAgICAgICAganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLFxuICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6ICcjMGYwZjE0JyxcbiAgICAgIH19XG4gICAgPlxuICAgICAgPFRleHQgc3R5bGU9e3sgZm9udFNpemU6IDMyLCBmb250V2VpZ2h0OiAnNzAwJywgY29sb3I6ICcjZThlOGYwJyB9fT5cbiAgICAgICAgSGVsbG8sIFdvcmxkIVxuICAgICAgPC9UZXh0PlxuICAgIDwvVmlldz5cbiAgKTtcbn1cblxucmVuZGVyKDxBcHAgLz4pO1xuIiwgIi8vIFY4IGVudmlyb25tZW50IHBvbHlmaWxscyBcdTIwMTQgYXV0by1sb2FkZWQgYnkgQGdseXgtZGV2L3JlYWN0XG4vL1xuLy8gcnVzdHlfdjggcnVucyBhIGJhcmUgVjggaXNvbGF0ZSBcdTIwMTQgbm8gYnJvd3NlciBvciBOb2RlIGdsb2JhbHMuXG4vLyBSZWFjdCdzIHNjaGVkdWxlciBuZWVkcyBwZXJmb3JtYW5jZS5ub3coKSwgc2V0VGltZW91dCwgY2xlYXJUaW1lb3V0LFxuLy8gYW5kIE1lc3NhZ2VDaGFubmVsLiBUaGVzZSBzdHVicyBhcmUgaW5zdGFsbGVkIG9uY2Ugd2hlbiBAZ2x5eC1kZXYvcmVhY3Rcbi8vIGlzIGZpcnN0IGltcG9ydGVkLCBiZWZvcmUgdGhlIHJlY29uY2lsZXIgaW5pdGlhbGlzZXMgaXRzIHNjaGVkdWxlci5cblxuaWYgKHR5cGVvZiBwZXJmb3JtYW5jZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgZ2xvYmFsVGhpcy5wZXJmb3JtYW5jZSA9IHtcbiAgICBub3c6ICgpID0+IE51bWJlcihfX2dseXhfZ2V0VGltZSgpKSxcbiAgfTtcbn1cblxuLy8gVjggaXMgZW1iZWRkZWQgd2l0aG91dCBJQ1UgZGF0YSwgc28gbG9jYWxlLWF3YXJlIGJ1aWx0aW5zIHRocm93XG4vLyBcIkludGVybmFsIGVycm9yLiBJY3UgZXJyb3IuXCIuICBSZXBsYWNlIGxvY2FsZUNvbXBhcmUgd2l0aCBhIHBsYWluXG4vLyBjb2RlLXVuaXQgY29tcGFyaXNvbiAoc3VmZmljaWVudCBmb3Igc29ydGluZyBmaWxlIG5hbWVzIGV0Yy4pLlxudHJ5IHtcbiAgJ2EnLmxvY2FsZUNvbXBhcmUoJ2InKTtcbn0gY2F0Y2gge1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZXh0ZW5kLW5hdGl2ZVxuICBTdHJpbmcucHJvdG90eXBlLmxvY2FsZUNvbXBhcmUgPSBmdW5jdGlvbiAob3RoZXIpIHtcbiAgICBjb25zdCBhID0gU3RyaW5nKHRoaXMpLCBiID0gU3RyaW5nKG90aGVyKTtcbiAgICByZXR1cm4gYSA8IGIgPyAtMSA6IGEgPiBiID8gMSA6IDA7XG4gIH07XG59XG5cbmlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgbGV0IF9uZXh0VGltZXJJZCA9IDE7XG4gIGNvbnN0IF9wZW5kaW5nVGltZXJzID0gbmV3IE1hcCgpO1xuXG4gIGdsb2JhbFRoaXMuc2V0VGltZW91dCA9IChmbiwgbXMpID0+IHtcbiAgICBjb25zdCBpZCA9IF9uZXh0VGltZXJJZCsrO1xuICAgIGNvbnN0IGRlbGF5ID0gbXMgPiAwID8gbXMgOiAwO1xuICAgIF9wZW5kaW5nVGltZXJzLnNldChpZCwgeyBmbiwgZHVlOiBwZXJmb3JtYW5jZS5ub3coKSArIGRlbGF5IH0pO1xuICAgIGlmICh0eXBlb2YgX19nbHl4X3JlcXVlc3RfZnJhbWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBfX2dseXhfcmVxdWVzdF9mcmFtZShkZWxheSk7XG4gICAgfVxuICAgIHJldHVybiBpZDtcbiAgfTtcblxuICBnbG9iYWxUaGlzLmNsZWFyVGltZW91dCA9IChpZCkgPT4geyBfcGVuZGluZ1RpbWVycy5kZWxldGUoaWQpOyB9O1xuXG4gIGdsb2JhbFRoaXMuX2dseXhEcmFpblRpbWVycyA9ICgpID0+IHtcbiAgICBpZiAoX3BlbmRpbmdUaW1lcnMuc2l6ZSA9PT0gMCkgcmV0dXJuO1xuICAgIGNvbnN0IG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIGNvbnN0IGR1ZSA9IFtdO1xuICAgIGZvciAoY29uc3QgW2lkLCB0XSBvZiBfcGVuZGluZ1RpbWVycykge1xuICAgICAgaWYgKHQuZHVlIDw9IG5vdykgZHVlLnB1c2goW2lkLCB0LmZuXSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2lkXSBvZiBkdWUpIF9wZW5kaW5nVGltZXJzLmRlbGV0ZShpZCk7XG4gICAgZm9yIChjb25zdCBbLCBmbl0gb2YgZHVlKSBmbigpO1xuICB9O1xufVxuXG5pZiAodHlwZW9mIHNldEludGVydmFsID09PSAndW5kZWZpbmVkJykge1xuICBsZXQgX25leHRJbnRlcnZhbElkID0gMTtcbiAgY29uc3QgX3BlbmRpbmdJbnRlcnZhbHMgPSBuZXcgTWFwKCk7XG5cbiAgZ2xvYmFsVGhpcy5zZXRJbnRlcnZhbCA9IChmbiwgbXMpID0+IHtcbiAgICBjb25zdCBpZCAgICA9IF9uZXh0SW50ZXJ2YWxJZCsrO1xuICAgIGNvbnN0IGRlbGF5ID0gbXMgPiAwID8gbXMgOiAwO1xuICAgIF9wZW5kaW5nSW50ZXJ2YWxzLnNldChpZCwgeyBmbiwgbXM6IGRlbGF5LCBuZXh0RHVlOiBwZXJmb3JtYW5jZS5ub3coKSArIGRlbGF5IH0pO1xuICAgIGlmICh0eXBlb2YgX19nbHl4X3JlcXVlc3RfZnJhbWUgIT09ICd1bmRlZmluZWQnKSBfX2dseXhfcmVxdWVzdF9mcmFtZShkZWxheSk7XG4gICAgcmV0dXJuIGlkO1xuICB9O1xuXG4gIGdsb2JhbFRoaXMuY2xlYXJJbnRlcnZhbCA9IChpZCkgPT4geyBfcGVuZGluZ0ludGVydmFscy5kZWxldGUoaWQpOyB9O1xuXG4gIGNvbnN0IF9wcmV2RHJhaW4gPSBnbG9iYWxUaGlzLl9nbHl4RHJhaW5UaW1lcnM7XG4gIGdsb2JhbFRoaXMuX2dseXhEcmFpblRpbWVycyA9ICgpID0+IHtcbiAgICBfcHJldkRyYWluPy4oKTtcbiAgICBpZiAoX3BlbmRpbmdJbnRlcnZhbHMuc2l6ZSA9PT0gMCkgcmV0dXJuO1xuICAgIGNvbnN0IG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIGxldCBlYXJsaWVzdCA9IEluZmluaXR5O1xuICAgIGZvciAoY29uc3QgWywgdF0gb2YgX3BlbmRpbmdJbnRlcnZhbHMpIHtcbiAgICAgIGlmIChub3cgPj0gdC5uZXh0RHVlKSB7XG4gICAgICAgIHQubmV4dER1ZSA9IG5vdyArIHQubXM7XG4gICAgICAgIHQuZm4oKTtcbiAgICAgIH1cbiAgICAgIGlmICh0Lm5leHREdWUgPCBlYXJsaWVzdCkgZWFybGllc3QgPSB0Lm5leHREdWU7XG4gICAgfVxuICAgIC8vIFJlLWFybSB0aGUgbmF0aXZlIHdha2V1cCBmb3IgdGhlIG5leHQgZHVlIGludGVydmFsLiAgV2l0aG91dCB0aGlzLFxuICAgIC8vIGludGVydmFscyBmaXJlIG9uY2UgYW5kIHRoZW4gb25seSB0aWNrIHdoZW4gc29tZXRoaW5nIGVsc2UgKGlucHV0LFxuICAgIC8vIGEgc2V0VGltZW91dCkgaGFwcGVucyB0byBjYXVzZSBhIGZyYW1lIFx1MjAxNCBhbmltYXRpb25zIHN0YWxsIHVubGVzc1xuICAgIC8vIHRoZSB1c2VyIGtlZXBzIG1vdmluZyB0aGUgbW91c2UuXG4gICAgaWYgKGVhcmxpZXN0IDwgSW5maW5pdHkgJiYgdHlwZW9mIF9fZ2x5eF9yZXF1ZXN0X2ZyYW1lICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgX19nbHl4X3JlcXVlc3RfZnJhbWUoTWF0aC5tYXgoMCwgZWFybGllc3QgLSBwZXJmb3JtYW5jZS5ub3coKSkpO1xuICAgIH1cbiAgfTtcbn1cblxuaWYgKHR5cGVvZiBxdWV1ZU1pY3JvdGFzayA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgZ2xvYmFsVGhpcy5xdWV1ZU1pY3JvdGFzayA9IChmbikgPT4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmbik7XG59XG5cbmlmICh0eXBlb2YgTWVzc2FnZUNoYW5uZWwgPT09ICd1bmRlZmluZWQnKSB7XG4gIGdsb2JhbFRoaXMuTWVzc2FnZUNoYW5uZWwgPSBjbGFzcyBNZXNzYWdlQ2hhbm5lbCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICBjb25zdCBjaCA9IHRoaXM7XG4gICAgICBjaC5wb3J0MSA9IHtcbiAgICAgICAgb25tZXNzYWdlOiBudWxsLFxuICAgICAgICBwb3N0TWVzc2FnZShtc2cpIHsgY2gucG9ydDIub25tZXNzYWdlPy4oeyBkYXRhOiBtc2cgfSk7IH0sXG4gICAgICB9O1xuICAgICAgY2gucG9ydDIgPSB7XG4gICAgICAgIG9ubWVzc2FnZTogbnVsbCxcbiAgICAgICAgcG9zdE1lc3NhZ2UobXNnKSB7IGNoLnBvcnQxLm9ubWVzc2FnZT8uKHsgZGF0YTogbXNnIH0pOyB9LFxuICAgICAgfTtcbiAgICB9XG4gIH07XG59XG4iLCAiLy8gQGdseXgtZGV2L3JlYWN0IFx1MjAxNCBSZWFjdCByZW5kZXJlciBmb3IgdGhlIEdseXggcnVudGltZS5cbi8vIFBvbHlmaWxscyBtdXN0IGJlIGluc3RhbGxlZCBiZWZvcmUgcmVhY3QvcmVhY3QtcmVjb25jaWxlciBpbml0aWFsaXNlLlxuaW1wb3J0ICcuL3BvbHlmaWxscy5qcyc7XG5cbmltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCc7XG5pbXBvcnQgUmVjb25jaWxlciBmcm9tICdyZWFjdC1yZWNvbmNpbGVyJztcbmltcG9ydCBIb3N0Q29uZmlnIGZyb20gJy4vaG9zdENvbmZpZy5qcyc7XG5pbXBvcnQgeyBkaXNwYXRjaEV2ZW50cywgYWRkR2xvYmFsQ2xpY2tMaXN0ZW5lciwgcmVtb3ZlR2xvYmFsQ2xpY2tMaXN0ZW5lciwgYWRkS2V5TGlzdGVuZXIgfSBmcm9tICcuL2V2ZW50cy5qcyc7XG5pbXBvcnQge1xuICBfcG9sbFdlYlNvY2tldHMsIF9wb2xsSXBjLCBfcG9sbERlZXBsaW5rcywgX3BvbGxHYW1lcGFkcyxcbiAgX3BvbGxHbG9iYWxTaG9ydGN1dHMsIF9wb2xsUGVyZlZpb2xhdGlvbnMsIF9wb2xsTGVha1dhcm5pbmdzLFxuICBfcG9sbEF1ZGlvLCBfcG9sbFZpZGVvLCBfcG9sbEZzV2F0Y2gsXG59IGZyb20gJy4vYXBpLmpzJztcbmltcG9ydCB7IFZpZXcgfSBmcm9tICcuL2NvcmUuanMnO1xuaW1wb3J0IHsgUG9wb3Zlckhvc3QgfSBmcm9tICcuL3BvcG92ZXIuanMnO1xuXG4vLyBSZS1leHBvcnQgZnJvbSBzdWItbW9kdWxlc1xuZXhwb3J0ICogZnJvbSAnLi9hcGkuanMnO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlLmpzJztcbmV4cG9ydCAqIGZyb20gJy4vcG9wb3Zlci5qcyc7XG5leHBvcnQgKiBmcm9tICcuL2NvbnRyb2xzLmpzJztcbmV4cG9ydCAqIGZyb20gJy4vY2FudmFzLmpzJztcbmV4cG9ydCAqIGZyb20gJy4vbWVkaWEuanMnO1xuXG4vLyBFdmVudC1yZWdpc3RyeSBoZWxwZXJzIHVzZWQgYnkgY29tcGFuaW9uIHBhY2thZ2VzIChAZ2x5eC1kZXYvY29udGV4dC1tZW51LCBcdTIwMjYpLlxuZXhwb3J0IHsgYWRkR2xvYmFsQ2xpY2tMaXN0ZW5lciwgcmVtb3ZlR2xvYmFsQ2xpY2tMaXN0ZW5lciwgYWRkS2V5TGlzdGVuZXIgfTtcblxuLy8gXHUyNTAwXHUyNTAwIFJlY29uY2lsZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IEdseXhSZWNvbmNpbGVyID0gUmVjb25jaWxlcihIb3N0Q29uZmlnKTtcblxuY29uc3Qgcm9vdENvbnRhaW5lciA9IEdseXhSZWNvbmNpbGVyLmNyZWF0ZUNvbnRhaW5lcihcbiAgeyBpc0dseXhSb290OiB0cnVlIH0sXG4gIDAsICAgICAgLy8gTGVnYWN5Um9vdCBcdTIwMTQgc3luY2hyb25vdXMgcmVuZGVyaW5nXG4gIG51bGwsIGZhbHNlLCBudWxsLCAnJyxcbiAgKGVycikgPT4gX19nbHl4X2xvZygnW1JlYWN0XSBSZWNvdmVyYWJsZSBlcnJvcjogJyArIGVyci5tZXNzYWdlKSxcbiAgbnVsbFxuKTtcblxuLy8gXHUyNTAwXHUyNTAwIEZyYW1lIGNhbGxiYWNrIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIFJ1c3QgY2FsbHMgX19nbHl4X2ZyYW1lQ2FsbGJhY2soKSBvbmNlIHBlciBSZWRyYXdSZXF1ZXN0ZWQgKGZyYW1lX3RpY2spLFxuLy8gYmV0d2VlbiB0aWNrKCkgYW5kIGRyYWluX3NjZW5lX2NvbW1hbmRzKCkuXG5cbmdsb2JhbFRoaXMuX19nbHl4X2ZyYW1lQ2FsbGJhY2sgPSBmdW5jdGlvbiBnbHl4RnJhbWVDYWxsYmFjaygpIHtcbiAgLy8gZmx1c2hTeW5jIGZvcmNlcyBSZWFjdCB0byBjb21taXQgYWxsIHN0YXRlIHVwZGF0ZXMgdHJpZ2dlcmVkIGJ5IGV2ZW50c1xuICAvLyBzeW5jaHJvbm91c2x5LCBzbyBzY2VuZSBjb21tYW5kcyBhcmUgaW4gdGhlIHF1ZXVlIGJlZm9yZSBSdXN0IGRyYWlucyB0aGVtLlxuICBHbHl4UmVjb25jaWxlci5mbHVzaFN5bmMoKCkgPT4ge1xuICAgIC8vIERyYWluIGRlZmVycmVkIHNldFRpbWVvdXQgY2FsbGJhY2tzIChhbmltYXRpb24gbG9vcHMsIFJlYWN0IHNjaGVkdWxlcikuXG4gICAgZ2xvYmFsVGhpcy5fZ2x5eERyYWluVGltZXJzPy4oKTtcbiAgICBfcG9sbFdlYlNvY2tldHMoKTtcbiAgICBfcG9sbElwYygpO1xuICAgIF9wb2xsRGVlcGxpbmtzKCk7XG4gICAgX3BvbGxHYW1lcGFkcygpO1xuICAgIF9wb2xsR2xvYmFsU2hvcnRjdXRzKCk7XG4gICAgX3BvbGxQZXJmVmlvbGF0aW9ucygpO1xuICAgIF9wb2xsTGVha1dhcm5pbmdzKCk7XG4gICAgX3BvbGxBdWRpbygpO1xuICAgIF9wb2xsVmlkZW8oKTtcbiAgICBfcG9sbEZzV2F0Y2goKTtcbiAgICBkaXNwYXRjaEV2ZW50cygpO1xuICB9KTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBQdWJsaWMgcmVuZGVyIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlcihlbGVtZW50KSB7XG4gIC8vIFRoZSBmcmFtZXdvcmsgaGFzIGEgU0lOR0xFIHNjZW5lIHJvb3QsIHNvIHdlIG1vdW50IG9uZSB3cmFwcGVyIFZpZXcgKGZvcmNlZFxuICAvLyB0byB0aGUgd2luZG93IHNpemUgYnkgdGhlIGxheW91dCBlbmdpbmUpIHRoYXQgaG9sZHMgdGhlIGFwcCBwbHVzIGFuXG4gIC8vIGF1dG8taW5qZWN0ZWQgUG9wb3Zlckhvc3QuIFRoZSBob3N0J3MgYWJzb2x1dGVseS1wb3NpdGlvbmVkIGNvbnRlbnQgaXMgYVxuICAvLyBjaGlsZCBvZiB0aGlzIHJvb3Qgd3JhcHBlciBcdTIxOTIgcG9zaXRpb25lZCBpbiB3aW5kb3cgY29vcmRzLCBuZXZlciBjbGlwcGVkIGJ5IGFcbiAgLy8gc2Nyb2xsIGFuY2VzdG9yLiBBcHBzIGdldCBmbG9hdGluZyBwb3B1cHMgZm9yIGZyZWUsIG5vIG1hbnVhbCBtb3VudGluZy5cbiAgLy8gVGhlIHdyYXBwZXIgZmlsbHMgdGhlIGZyYW1ld29yaydzIGpzLXJvb3QgKGEgd2luZG93LXNpemVkIGZsZXggY29sdW1uKSBhbmRcbiAgLy8gcmVwcm9kdWNlcyB0aGUgc2FtZSBjb2x1bW4vc3RyZXRjaCBjb250ZXh0IHRoZSBhcHAncyByb290IHVzZWQgdG8gc2VlLCBzb1xuICAvLyB0aGUgYXBwJ3MgbGF5b3V0IGlzIHVuY2hhbmdlZC4gUG9wb3Zlckhvc3QgcmVuZGVycyBudWxsIChubyBsYXlvdXQgaW1wYWN0KVxuICAvLyB1bnRpbCBhIHBvcHVwIG9wZW5zLCB0aGVuIGFic29sdXRlbHkgKG91dCBvZiBmbG93KS5cbiAgR2x5eFJlY29uY2lsZXIudXBkYXRlQ29udGFpbmVyKFxuICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywge1xuICAgICAgc3R5bGU6IHsgcG9zaXRpb246ICdyZWxhdGl2ZScsIGZsZXhEaXJlY3Rpb246ICdjb2x1bW4nLCBmbGV4R3JvdzogMSwgYWxpZ25TZWxmOiAnc3RyZXRjaCcgfSxcbiAgICB9LFxuICAgICAgZWxlbWVudCxcbiAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoUG9wb3Zlckhvc3QpLFxuICAgICksXG4gICAgcm9vdENvbnRhaW5lciwgbnVsbCwgbnVsbCxcbiAgKTtcbn1cbiIsICIvLyBAZ2x5eC1kZXYvcmVhY3QgXHUyMDE0IHJlYWN0LXJlY29uY2lsZXIgSG9zdENvbmZpZ1xuLy9cbi8vIFRoaXMgaXMgdGhlIGJyaWRnZSBiZXR3ZWVuIFJlYWN0J3MgcmVjb25jaWxlciBhbmQgR2x5eCdzIG5hdGl2ZSBzY2VuZSBncmFwaC5cbi8vIEV2ZXJ5IG1ldGhvZCBoZXJlIG1hcHMgUmVhY3QncyBpbnRlcm5hbCB0cmVlIG9wZXJhdGlvbnMgdG8gbmF0aXZlIGJpbmRpbmdzXG4vLyBleHBvc2VkIGJ5IHRoZSBSdXN0IHJ1bnRpbWU6IF9fZ2x5eF9jcmVhdGVOb2RlLCBfX2dseXhfYXBwZW5kQ2hpbGQsXG4vLyBfX2dseXhfdXBkYXRlTm9kZSwgX19nbHl4X3JlbW92ZU5vZGUsIF9fZ2x5eF9zZXRSb290LlxuLy9cbi8vIE9ubHkgYHN1cHBvcnRzTXV0YXRpb246IHRydWVgIGlzIGVuYWJsZWQgXHUyMDE0IG5vIHBlcnNpc3RlbmNlLCBubyBoeWRyYXRpb24uXG5cbmltcG9ydCB7IERlZmF1bHRFdmVudFByaW9yaXR5IH0gZnJvbSAncmVhY3QtcmVjb25jaWxlci9jb25zdGFudHMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJTb2xpZCwgc2V0Tm9kZVBhcmVudCwgcmVtb3ZlTm9kZUZyb21UcmVlLCBzZXROb2RlWkluZGV4IH0gZnJvbSAnLi9ldmVudHMuanMnO1xuXG4vLyBcdTI1MDBcdTI1MDAgSW5zdGFuY2UgY3JlYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGNyZWF0ZUluc3RhbmNlKHR5cGUsIHByb3BzKSB7XG4gIC8vIFN0cmlwIGBjaGlsZHJlbmAgXHUyMDE0IFJlYWN0IG1hbmFnZXMgdGhlIHRyZWUuXG4gIC8vIEZsYXR0ZW4gYHN0eWxlYCBpbnRvIHRoZSB0b3AtbGV2ZWwgcHJvcCBvYmplY3Qgc28gUnVzdCBzZWVzXG4gIC8vIGJhY2tncm91bmRDb2xvciwgYm9yZGVyUmFkaXVzLCBldGMuIGRpcmVjdGx5IChub3QgbmVzdGVkIHVuZGVyIHN0eWxlKS5cbiAgLy8gU3RyaXAgYF9nbHl4T25Nb3VudGAgXHUyMDE0IGEgY2FsbGJhY2sgdGhhdCBjb21wb25lbnRzIHVzZSB0byBsZWFybiB0aGVpclxuICAvLyBuYXRpdmUgbm9kZSBJRCBzeW5jaHJvbm91c2x5LCB3aXRob3V0IHJlbHlpbmcgb24gcmVmIGZvcndhcmRpbmcuXG4gIGNvbnN0IHsgY2hpbGRyZW4sIHN0eWxlLCByZWY6IF9yZWYsIF9nbHl4T25Nb3VudCwgZ2x5eERyYWdnYWJsZSwgLi4ucmVzdCB9ID0gcHJvcHM7XG4gIGNvbnN0IG5vZGVQcm9wcyA9IHsgLi4ucmVzdCwgLi4uc3R5bGUgfTtcbiAgaWYgKGdseXhEcmFnZ2FibGUpIG5vZGVQcm9wcy5kcmFnZ2FibGUgPSB0cnVlO1xuICBjb25zdCBpZCA9IF9fZ2x5eF9jcmVhdGVOb2RlKHR5cGUsIG5vZGVQcm9wcyk7XG4gIC8vIEV2ZXJ5ICd2aWV3JyBub2RlIGlzIHNvbGlkIChjbGljay1vcGFxdWUpIGJ5IGRlZmF1bHQuICBOb2RlcyB3aXRoXG4gIC8vIHBvaW50ZXJFdmVudHM6J25vbmUnIGFyZSBzdGlsbCByZWdpc3RlcmVkIGJ1dCBleGNsdWRlZCBhdCBsb29rdXAgdGltZS5cbiAgaWYgKHR5cGUgPT09ICd2aWV3Jykge1xuICAgIHJlZ2lzdGVyU29saWQoaWQpO1xuICAgIGlmIChub2RlUHJvcHMuekluZGV4KSBzZXROb2RlWkluZGV4KGlkLCBub2RlUHJvcHMuekluZGV4KTtcbiAgfVxuICAvLyBGaXJlIHRoZSBtb3VudCBjYWxsYmFjayBpbW1lZGlhdGVseSBzbyB0aGUgY29tcG9uZW50IGNhbiByZWdpc3RlciBpdHMgSURcbiAgLy8gYmVmb3JlIGFueSB1c2VFZmZlY3QgLyB1c2VMYXlvdXRFZmZlY3QgcnVucy5cbiAgaWYgKHR5cGVvZiBfZ2x5eE9uTW91bnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICBfZ2x5eE9uTW91bnQoaWQpO1xuICB9XG4gIHJldHVybiB7IGlkIH07XG59XG5cbi8vIFJhdyB0ZXh0IG5vZGVzIChlLmcuIFwiaGVsbG9cIiBkaXJlY3RseSBpbnNpZGUgYSBob3N0IGVsZW1lbnQpIGFyZSBub3Rcbi8vIHN1cHBvcnRlZC4gVXNlIDxUZXh0PmhlbGxvPC9UZXh0PiBpbnN0ZWFkLiBSZXR1cm4gYSBzdHViIHNvIFJlYWN0IG5ldmVyXG4vLyBjcmFzaGVzIGlmIGl0IHNvbWVob3cgY2FsbHMgdGhpcy5cbmZ1bmN0aW9uIGNyZWF0ZVRleHRJbnN0YW5jZSh0ZXh0KSB7XG4gIF9fZ2x5eF9sb2coJ1tHbHl4XSBXYXJuaW5nOiByYXcgdGV4dCBub2RlIFwiJyArIHRleHQgKyAnXCIgXHUyMDE0IHdyYXAgaW4gPFRleHQ+Jyk7XG4gIHJldHVybiB7IGlkOiAtMSB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgVHJlZSBjb25zdHJ1Y3Rpb24gKGluaXRpYWwgbW91bnQpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vLyBDYWxsZWQgZm9yIGVhY2ggY2hpbGQgZHVyaW5nIHRoZSBpbml0aWFsIHRyZWUgYnVpbGQgKGJlZm9yZSBjb21taXQpLlxuZnVuY3Rpb24gYXBwZW5kSW5pdGlhbENoaWxkKHBhcmVudEluc3RhbmNlLCBjaGlsZCkge1xuICBpZiAoY2hpbGQuaWQgIT09IC0xKSB7XG4gICAgX19nbHl4X2FwcGVuZENoaWxkKHBhcmVudEluc3RhbmNlLmlkLCBjaGlsZC5pZCk7XG4gICAgc2V0Tm9kZVBhcmVudChjaGlsZC5pZCwgcGFyZW50SW5zdGFuY2UuaWQpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBUcmVlIGNvbnN0cnVjdGlvbiAodXBkYXRlcyAvIHJlLXJlbmRlcnMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBhcHBlbmRDaGlsZChwYXJlbnRJbnN0YW5jZSwgY2hpbGQpIHtcbiAgaWYgKGNoaWxkLmlkICE9PSAtMSkge1xuICAgIF9fZ2x5eF9hcHBlbmRDaGlsZChwYXJlbnRJbnN0YW5jZS5pZCwgY2hpbGQuaWQpO1xuICAgIHNldE5vZGVQYXJlbnQoY2hpbGQuaWQsIHBhcmVudEluc3RhbmNlLmlkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBlbmRDaGlsZFRvQ29udGFpbmVyKF9jb250YWluZXIsIGNoaWxkKSB7XG4gIC8vIFRoZSBjb250YWluZXIgaXMgdGhlIHZpcnR1YWwgcm9vdCAoY3JlYXRlZCBieSBjcmVhdGVDb250YWluZXIpLlxuICAvLyBFeHBsaWNpdGx5IHNldCB0aGlzIGNoaWxkIGFzIHRoZSBzY2VuZSByb290IHNvIFJ1c3Qga25vd3Mgd2hhdCB0byByZW5kZXIuXG4gIGlmIChjaGlsZC5pZCAhPT0gLTEpIHtcbiAgICBfX2dseXhfc2V0Um9vdChjaGlsZC5pZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0QmVmb3JlKHBhcmVudEluc3RhbmNlLCBjaGlsZCwgYmVmb3JlQ2hpbGQpIHtcbiAgaWYgKGNoaWxkLmlkICE9PSAtMSkge1xuICAgIGlmIChiZWZvcmVDaGlsZCAmJiBiZWZvcmVDaGlsZC5pZCAhPT0gLTEpIHtcbiAgICAgIF9fZ2x5eF9pbnNlcnRCZWZvcmUocGFyZW50SW5zdGFuY2UuaWQsIGNoaWxkLmlkLCBiZWZvcmVDaGlsZC5pZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIF9fZ2x5eF9hcHBlbmRDaGlsZChwYXJlbnRJbnN0YW5jZS5pZCwgY2hpbGQuaWQpO1xuICAgIH1cbiAgICBzZXROb2RlUGFyZW50KGNoaWxkLmlkLCBwYXJlbnRJbnN0YW5jZS5pZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0SW5Db250YWluZXJCZWZvcmUoX2NvbnRhaW5lciwgY2hpbGQsIF9iZWZvcmVDaGlsZCkge1xuICBpZiAoY2hpbGQuaWQgIT09IC0xKSB7XG4gICAgX19nbHl4X3NldFJvb3QoY2hpbGQuaWQpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBUcmVlIHJlbW92YWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHJlbW92ZUNoaWxkKF9wYXJlbnRJbnN0YW5jZSwgY2hpbGQpIHtcbiAgaWYgKGNoaWxkLmlkICE9PSAtMSkge1xuICAgIF9fZ2x5eF9yZW1vdmVOb2RlKGNoaWxkLmlkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVDaGlsZEZyb21Db250YWluZXIoX2NvbnRhaW5lciwgY2hpbGQpIHtcbiAgaWYgKGNoaWxkLmlkICE9PSAtMSkge1xuICAgIF9fZ2x5eF9yZW1vdmVOb2RlKGNoaWxkLmlkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGVhckNvbnRhaW5lcihfY29udGFpbmVyKSB7XG4gIC8vIE5vLW9wIFx1MjAxNCBzY2VuZSByZXNldHMgd2hlbiB0aGUgbmV3IHJvb3QgaXMgc2V0IHZpYSBhcHBlbmRDaGlsZFRvQ29udGFpbmVyLlxufVxuXG4vLyBDYWxsZWQgYnkgUmVhY3QgYWZ0ZXIgaXQgaGFzIGZpbmlzaGVkIHdpdGggYSBkZWxldGVkIGluc3RhbmNlLlxuZnVuY3Rpb24gZGV0YWNoRGVsZXRlZEluc3RhbmNlKGluc3RhbmNlKSB7XG4gIGlmIChpbnN0YW5jZS5pZCAhPT0gLTEpIHtcbiAgICBfX2dseXhfcmVtb3ZlTm9kZShpbnN0YW5jZS5pZCk7XG4gICAgcmVtb3ZlTm9kZUZyb21UcmVlKGluc3RhbmNlLmlkKTtcbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgVXBkYXRlcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLy8gUmV0dXJuIGEgcGF5bG9hZCB0byBjb21taXQsIG9yIG51bGwgdG8gc2tpcCBjb21taXRVcGRhdGUuXG4vLyBTaGFsbG93LWNvbXBhcmUgb2xkIGFuZCBuZXcgcHJvcHMgc28gdGhhdCBwYXJlbnQgcmUtcmVuZGVycyBkb24ndCBjYXNjYWRlXG4vLyBhIG5hdGl2ZSB1cGRhdGVOb2RlIGNhbGwgdG8gZXZlcnkgY2hpbGQgd2hvc2UgdmlzdWFsIHByb3BzIGRpZG4ndCBjaGFuZ2UuXG5mdW5jdGlvbiBwcmVwYXJlVXBkYXRlKF9pbnN0YW5jZSwgX3R5cGUsIG9sZFByb3BzLCBuZXdQcm9wcykge1xuICBjb25zdCBza2lwID0gWydjaGlsZHJlbicsICdyZWYnLCAnX2dseXhPbk1vdW50JywgJ2dseXhEcmFnZ2FibGUnXTtcbiAgY29uc3Qgb2xkS2V5cyA9IE9iamVjdC5rZXlzKG9sZFByb3BzKS5maWx0ZXIoKGspID0+ICFza2lwLmluY2x1ZGVzKGspKTtcbiAgY29uc3QgbmV3S2V5cyA9IE9iamVjdC5rZXlzKG5ld1Byb3BzKS5maWx0ZXIoKGspID0+ICFza2lwLmluY2x1ZGVzKGspKTtcbiAgaWYgKG9sZEtleXMubGVuZ3RoICE9PSBuZXdLZXlzLmxlbmd0aCkgcmV0dXJuIG5ld1Byb3BzO1xuICBmb3IgKGNvbnN0IGsgb2YgbmV3S2V5cykge1xuICAgIGlmIChvbGRQcm9wc1trXSAhPT0gbmV3UHJvcHNba10pIHJldHVybiBuZXdQcm9wcztcbiAgfVxuICByZXR1cm4gbnVsbDsgLy8gbm8gdmlzdWFsIGNoYW5nZSBcdTIwMTQgc2tpcCBjb21taXRVcGRhdGVcbn1cblxuZnVuY3Rpb24gY29tbWl0VXBkYXRlKGluc3RhbmNlLCB1cGRhdGVQYXlsb2FkKSB7XG4gIGNvbnN0IHsgY2hpbGRyZW4sIHN0eWxlLCByZWY6IF9yZWYsIF9nbHl4T25Nb3VudCwgZ2x5eERyYWdnYWJsZSwgLi4ucmVzdCB9ID0gdXBkYXRlUGF5bG9hZDtcbiAgY29uc3Qgbm9kZVByb3BzID0geyAuLi5yZXN0LCAuLi5zdHlsZSB9O1xuICBpZiAoZ2x5eERyYWdnYWJsZSkgbm9kZVByb3BzLmRyYWdnYWJsZSA9IHRydWU7XG4gIF9fZ2x5eF91cGRhdGVOb2RlKGluc3RhbmNlLmlkLCBub2RlUHJvcHMpO1xuICBzZXROb2RlWkluZGV4KGluc3RhbmNlLmlkLCBub2RlUHJvcHMuekluZGV4ID8/IDApO1xufVxuXG5mdW5jdGlvbiBjb21taXRUZXh0VXBkYXRlKCkge1xuICAvLyBOb3QgdXNlZCBcdTIwMTQgd2UgZG9uJ3Qgc3VwcG9ydCByYXcgdGV4dCBub2Rlcy5cbn1cblxuZnVuY3Rpb24gY29tbWl0TW91bnQoKSB7XG4gIC8vIE9ubHkgY2FsbGVkIGlmIGZpbmFsaXplSW5pdGlhbENoaWxkcmVuIHJldHVybnMgdHJ1ZSAoaXQgZG9lc24ndCkuXG59XG5cbi8vIFx1MjUwMFx1MjUwMCBGaW5hbGlzYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGZpbmFsaXplSW5pdGlhbENoaWxkcmVuKCkge1xuICAvLyBSZXR1cm4gZmFsc2UgXHUyMDE0IG5vIHBvc3QtbW91bnQgd29yayBuZWVkZWQuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVBvcnRhbE1vdW50KCkge31cblxuLy8gXHUyNTAwXHUyNTAwIEhvc3QgY29udGV4dCAocGFzc2VkIGRvd24gdGhlIHRyZWUsIGNhbiBjYXJyeSByZW5kZXJpbmcgaGludHMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBnZXRSb290SG9zdENvbnRleHQoKSAgeyByZXR1cm4ge307IH1cbmZ1bmN0aW9uIGdldENoaWxkSG9zdENvbnRleHQoKSB7IHJldHVybiB7fTsgfVxuZnVuY3Rpb24gZ2V0UHVibGljSW5zdGFuY2UoaW5zdGFuY2UpIHsgcmV0dXJuIGluc3RhbmNlOyB9XG5cbi8vIFx1MjUwMFx1MjUwMCBDb21taXQgbGlmZWN5Y2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwcmVwYXJlRm9yQ29tbWl0KCkgIHsgcmV0dXJuIG51bGw7IH1cbmZ1bmN0aW9uIHJlc2V0QWZ0ZXJDb21taXQoKSAge31cblxuLy8gXHUyNTAwXHUyNTAwIFRleHQgY29udGVudCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLy8gUmV0dXJuIHRydWUgaWYgdGhlIG5vZGUgaXRzZWxmIGhhbmRsZXMgdGV4dCAoc28gUmVhY3Qgc2tpcHMgY3JlYXRlVGV4dEluc3RhbmNlKS5cbi8vIFdlIHJldHVybiBmYWxzZTogb3VyIFRleHQgY29tcG9uZW50IHdyYXBzIGNoaWxkcmVuIGFzIGEgYHRleHRgIHByb3AuXG5mdW5jdGlvbiBzaG91bGRTZXRUZXh0Q29udGVudCgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbi8vIFx1MjUwMFx1MjUwMCBTY2hlZHVsaW5nIChkZWxlZ2F0ZWQgdG8gb3VyIFY4IHBvbHlmaWxscykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHNjaGVkdWxlVGltZW91dChmbiwgZGVsYXkpIHsgcmV0dXJuIHNldFRpbWVvdXQoZm4sIGRlbGF5KTsgfVxuZnVuY3Rpb24gY2FuY2VsVGltZW91dChpZCkgICAgICAgICAgeyBjbGVhclRpbWVvdXQoaWQpOyB9XG5cbi8vIFx1MjUwMFx1MjUwMCBFdmVudCBwcmlvcml0eSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gZ2V0Q3VycmVudEV2ZW50UHJpb3JpdHkoKSB7IHJldHVybiBEZWZhdWx0RXZlbnRQcmlvcml0eTsgfVxuXG4vLyBcdTI1MDBcdTI1MDAgU3R1YnMgcmVxdWlyZWQgYnkgcmVhY3QtcmVjb25jaWxlciAwLjI5IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBnZXRJbnN0YW5jZUZyb21Ob2RlKCkgIHsgcmV0dXJuIG51bGw7IH1cbmZ1bmN0aW9uIGJlZm9yZUFjdGl2ZUluc3RhbmNlQmx1cigpIHt9XG5mdW5jdGlvbiBhZnRlckFjdGl2ZUluc3RhbmNlQmx1cigpICB7fVxuZnVuY3Rpb24gcHJlcGFyZVNjb3BlVXBkYXRlKCkgICAgICAge31cbmZ1bmN0aW9uIGdldEluc3RhbmNlRnJvbVNjb3BlKCkgICAgIHsgcmV0dXJuIG51bGw7IH1cblxuLy8gXHUyNTAwXHUyNTAwIEV4cG9ydCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY29uc3QgSG9zdENvbmZpZyA9IHtcbiAgLy8gQ3JlYXRpb25cbiAgY3JlYXRlSW5zdGFuY2UsXG4gIGNyZWF0ZVRleHRJbnN0YW5jZSxcblxuICAvLyBJbml0aWFsIHRyZWVcbiAgYXBwZW5kSW5pdGlhbENoaWxkLFxuXG4gIC8vIE11dGF0aW9uXG4gIGFwcGVuZENoaWxkLFxuICBhcHBlbmRDaGlsZFRvQ29udGFpbmVyLFxuICBpbnNlcnRCZWZvcmUsXG4gIGluc2VydEluQ29udGFpbmVyQmVmb3JlLFxuICByZW1vdmVDaGlsZCxcbiAgcmVtb3ZlQ2hpbGRGcm9tQ29udGFpbmVyLFxuICBjbGVhckNvbnRhaW5lcixcbiAgZGV0YWNoRGVsZXRlZEluc3RhbmNlLFxuXG4gIC8vIFVwZGF0ZXNcbiAgcHJlcGFyZVVwZGF0ZSxcbiAgY29tbWl0VXBkYXRlLFxuICBjb21taXRUZXh0VXBkYXRlLFxuICBjb21taXRNb3VudCxcblxuICAvLyBGaW5hbGlzYXRpb25cbiAgZmluYWxpemVJbml0aWFsQ2hpbGRyZW4sXG4gIHByZXBhcmVQb3J0YWxNb3VudCxcblxuICAvLyBDb250ZXh0XG4gIGdldFJvb3RIb3N0Q29udGV4dCxcbiAgZ2V0Q2hpbGRIb3N0Q29udGV4dCxcbiAgZ2V0UHVibGljSW5zdGFuY2UsXG5cbiAgLy8gQ29tbWl0IGxpZmVjeWNsZVxuICBwcmVwYXJlRm9yQ29tbWl0LFxuICByZXNldEFmdGVyQ29tbWl0LFxuXG4gIC8vIFRleHRcbiAgc2hvdWxkU2V0VGV4dENvbnRlbnQsXG5cbiAgLy8gU2NoZWR1bGluZ1xuICBzY2hlZHVsZVRpbWVvdXQsXG4gIGNhbmNlbFRpbWVvdXQsXG4gIG5vVGltZW91dDogLTEsXG5cbiAgLy8gRmVhdHVyZSBmbGFnc1xuICBzdXBwb3J0c011dGF0aW9uOiAgICB0cnVlLFxuICBzdXBwb3J0c1BlcnNpc3RlbmNlOiBmYWxzZSxcbiAgc3VwcG9ydHNIeWRyYXRpb246ICAgZmFsc2UsXG4gIGlzUHJpbWFyeVJlbmRlcmVyOiAgIHRydWUsXG5cbiAgLy8gTWljcm90YXNrIHNjaGVkdWxpbmcgXHUyMDE0IHRlbGxzIFJlYWN0IHRvIGZsdXNoIHN5bmMgY2FsbGJhY2tzIHZpYSBtaWNyb3Rhc2tzXG4gIC8vIHJhdGhlciB0aGFuIHZpYSB0aGUgU2NoZWR1bGVyIChNZXNzYWdlQ2hhbm5lbCBwYXRoKS4gVGhpcyBlbnN1cmVzIHRoYXRcbiAgLy8gZmx1c2hTeW5jJ3MgZmluYWxseSBibG9jayBjYW4gY29ycmVjdGx5IGZsdXNoIHBlbmRpbmcgc3luYyB3b3JrIHdoZW5cbiAgLy8gc2V0U3RhdGUgaXMgY2FsbGVkIGZyb20gb3V0c2lkZSBSZWFjdCdzIGV2ZW50IHN5c3RlbS5cbiAgc3VwcG9ydHNNaWNyb3Rhc2tzOiB0cnVlLFxuICBzY2hlZHVsZU1pY3JvdGFzazogIChmbikgPT4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmbiksXG5cbiAgLy8gRXZlbnQgc3lzdGVtXG4gIGdldEN1cnJlbnRFdmVudFByaW9yaXR5LFxuICBnZXRJbnN0YW5jZUZyb21Ob2RlLFxuICBiZWZvcmVBY3RpdmVJbnN0YW5jZUJsdXIsXG4gIGFmdGVyQWN0aXZlSW5zdGFuY2VCbHVyLFxuICBwcmVwYXJlU2NvcGVVcGRhdGUsXG4gIGdldEluc3RhbmNlRnJvbVNjb3BlLFxufTtcblxuZXhwb3J0IGRlZmF1bHQgSG9zdENvbmZpZztcbiIsICIvLyBAZ2x5eC1kZXYvcmVhY3QgXHUyMDE0IGV2ZW50IGRpc3BhdGNoZXJcclxuLy9cclxuLy8gVGhpcyBtb2R1bGUgYnJpZGdlcyBHbHl4J3MgbmF0aXZlIGlucHV0IGV2ZW50cyB0byBSZWFjdCBjb21wb25lbnQgaGFuZGxlcnMuXHJcbi8vIEl0IGlzIGRyaXZlbiBieSBgX19nbHl4X2ZyYW1lQ2FsbGJhY2tgLCByZWdpc3RlcmVkIG9uIGBnbG9iYWxUaGlzYCBpblxyXG4vLyBpbmRleC5qcyBhbmQgY2FsbGVkIGJ5IHRoZSBSdXN0IHJ1bnRpbWUgb25jZSBwZXIgZnJhbWUgKGZyYW1lX3RpY2spLlxyXG4vL1xyXG4vLyAjIyBBcmNoaXRlY3R1cmVcclxuLy9cclxuLy8gICBSdXN0IHNpZGU6ICAgICAgICAgICAgICAgSlMgc2lkZTpcclxuLy8gICBwdXNoX2V2ZW50KGV2KSAgXHUyMTkyICBfX2dseXhfcG9sbEV2ZW50cygpICBcdTIxOTIgIGRpc3BhdGNoRXZlbnRzKClcclxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjE5MiBoaXQtdGVzdCB2aWEgX19nbHl4X2dldExheW91dFxyXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyMTkyIGNhbGwgcmVnaXN0ZXJlZCBoYW5kbGVyc1xyXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyMTkyIFJlYWN0IHN0YXRlIHVwZGF0ZXNcclxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjE5MiByZWNvbmNpbGVyIHJlLXJlbmRlcnNcclxuLy9cclxuLy8gIyMgSGl0LXRlc3RpbmdcclxuLy9cclxuLy8gQSBwb2ludCAocHgsIHB5KSBpcyBpbnNpZGUgYSBub2RlIHdoZW46XHJcbi8vICAgeCA8PSBweCA8IHgrd2lkdGggIEFORCAgeSA8PSBweSA8IHkraGVpZ2h0XHJcblxyXG4vLyBcdTI1MDBcdTI1MDAgUmVnaXN0cnkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcblxyXG4vLyBNYXAgZnJvbSBub2RlSWQgLT4geyBvblByZXNzLCBvblByZXNzSW4sIG9uUHJlc3NPdXQsIG9uSG92ZXJJbiwgb25Ib3Zlck91dCB9XHJcbmNvbnN0IHByZXNzYWJsZVJlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xyXG5cclxuLy8gTWFwIGZyb20gbm9kZUlkIC0+IHsgb25Gb2N1cywgb25LZXlQcmVzcywgb25DaGFuZ2VUZXh0IH1cclxuY29uc3QgaW5wdXRSZWdpc3RyeSA9IG5ldyBNYXAoKTtcclxuXHJcbi8vIE1hcCBmcm9tIG5vZGVJZCAtPiB7IG9uU2Nyb2xsIH1cclxuLy8gU2Nyb2xsVmlld3MgcmVnaXN0ZXIgaGVyZSBzbyBzY3JvbGwgZXZlbnRzIGNhbiBiZSByb3V0ZWQgdG8gd2hpY2hldmVyXHJcbi8vIHNjcm9sbCB2aWV3IHRoZSBjdXJzb3IgaXMgY3VycmVudGx5IG92ZXIuXHJcbmNvbnN0IHNjcm9sbFJlZ2lzdHJ5ID0gbmV3IE1hcCgpO1xyXG5cclxuLy8gTWFwIGZyb20gbm9kZUlkIC0+IHsgb25EcmFnU3RhcnQ/LCBvbkRyYWdNb3ZlPywgb25EcmFnRW5kPyB9XHJcbi8vIERyYWdnYWJsZSBub2RlcyAoZS5nLiBTbGlkZXIgdGh1bWIpIHJlZ2lzdGVyIGhlcmUuXHJcbmNvbnN0IGRyYWdSZWdpc3RyeSA9IG5ldyBNYXAoKTtcclxuXHJcbi8vIE1hcCBmcm9tIG5vZGVJZCAtPiB0cnVlL2ZhbHNlIFx1MjAxNCBwcmV2ZW50cyBldmVudCBkaXNwYXRjaCB0byB0aGUgbm9kZS5cclxuLy8gQ2hpbGRyZW4gb2YgYSBkaXNhYmxlZCBub2RlIGFyZSBhbHNvIGJsb2NrZWQgKGFuY2VzdG9yIGNoZWNrIGR1cmluZyBkaXNwYXRjaCkuXHJcbmNvbnN0IGRpc2FibGVkUmVnaXN0cnkgPSBuZXcgTWFwKCk7XHJcblxyXG4vLyBTZXQgb2Ygbm9kZUlkcyB3aXRoIHBvaW50ZXJFdmVudHM6ICdub25lJyBcdTIwMTQgdGhlc2Ugbm9kZXMgYXJlIGludmlzaWJsZSB0b1xyXG4vLyBoaXQtdGVzdGluZzsgZXZlbnRzIHBhc3MgdGhyb3VnaCB0aGVtIHRvIG5vZGVzIHVuZGVybmVhdGguXHJcbmNvbnN0IHBvaW50ZXJFdmVudHNOb25lUmVnaXN0cnkgPSBuZXcgU2V0KCk7XHJcblxyXG4vLyBNYXAgZnJvbSBub2RlSWQgLT4gekluZGV4IChpbnRlZ2VyKS4gIE9ubHkgbm9kZXMgd2l0aCBhbiBleHBsaWNpdCB6SW5kZXhcclxuLy8gcHJvcCBhcmUgc3RvcmVkIGhlcmU7IGFic2VudCA9IDAuICBVc2VkIGJ5IGZpbmRUb3Btb3N0U29saWQgdG8gcHJlZmVyXHJcbi8vIGhpZ2hlci16LWluZGV4IG5vZGVzIG92ZXIgbGF0ZXItcmVnaXN0ZXJlZCBvbmVzIHdoZW4gYm90aCBjb3ZlciBhIHBvaW50LlxyXG5jb25zdCB6SW5kZXhNYXAgPSBuZXcgTWFwKCk7XHJcblxyXG4vLyBPcmRlcmVkIGFycmF5IG9mIGFsbCBzb2xpZCAoY2xpY2stb3BhcXVlKSBub2RlIGlkcywgaW4gY3JlYXRpb24gb3JkZXIuXHJcbi8vIExhdGVyIGVudHJpZXMgd2VyZSByZW5kZXJlZCBsYXRlciAob24gdG9wIGluIHotb3JkZXIpLlxyXG4vLyBFdmVyeSAndmlldycgbmF0aXZlIG5vZGUgaXMgc29saWQgYnkgZGVmYXVsdC4gIE5vZGVzIHdpdGggcG9pbnRlckV2ZW50czonbm9uZSdcclxuLy8gYXJlIHN0aWxsIGluIHRoaXMgbGlzdCBidXQgYXJlIGV4Y2x1ZGVkIGF0IGxvb2t1cCB0aW1lIHZpYSBwb2ludGVyRXZlbnRzTm9uZVJlZ2lzdHJ5LlxyXG5jb25zdCBzb2xpZFJlZ2lzdHJ5ID0gW107XHJcblxyXG4vLyBNYXAgZnJvbSBjaGlsZElkIFx1MjE5MiBwYXJlbnRJZCwgcG9wdWxhdGVkIGJ5IGhvc3RDb25maWcgb24gZXZlcnkgdHJlZSBtdXRhdGlvbi5cclxuLy8gVXNlZCBieSBmaW5kVG9wbW9zdFNvbGlkIHRvIGRldGVybWluZSBhbmNlc3RvciByZWxhdGlvbnNoaXBzLlxyXG5jb25zdCBwYXJlbnRNYXAgPSBuZXcgTWFwKCk7XHJcblxyXG4vLyBDdXJyZW50bHkgZHJhZ2dlZCBub2RlIGlkIChvciBudWxsKS4gU2V0IG9uIGRyYWdTdGFydCwgY2xlYXJlZCBvbiBkcmFnRW5kLlxyXG5sZXQgYWN0aXZlRHJhZ0lkID0gbnVsbDtcclxuXHJcbi8vIE1hcCBmcm9tIGltYWdlSWQgLT4gb25FcnJvciBjYWxsYmFjaywgZmlyZWQgd2hlbiBhIG5hdGl2ZSBpbWFnZSBsb2FkIGZhaWxzLlxyXG5jb25zdCBpbWFnZUVycm9yUmVnaXN0cnkgPSBuZXcgTWFwKCk7XHJcblxyXG4vLyBNYXAgZnJvbSB3YXRjaCBpZCAtPiBjYWxsYmFjayBmb3IgUnVzdC1zaWRlIHN5c3RlbSB3YXRjaGVycyAoc3lzdGVtLndhdGNoKS5cclxuY29uc3Qgc3lzdGVtV2F0Y2hSZWdpc3RyeSA9IG5ldyBNYXAoKTtcclxuXHJcbi8vIExpc3RlbmVycyBub3RpZmllZCBvbiB3aW5kb3cgcmVzaXplOiBBcnJheTwoc2l6ZToge3dpZHRoLCBoZWlnaHR9KSA9PiB2b2lkPlxyXG5jb25zdCB3aW5kb3dTaXplTGlzdGVuZXJzID0gW107XHJcblxyXG4vLyBMaXN0ZW5lcnMgbm90aWZpZWQgb24gZXZlcnkga2V5IGV2ZW50OiBBcnJheTwoZXY6IHtrZXksIGN0cmwsIHNoaWZ0LCBwcmVzc2VkfSkgPT4gdm9pZD5cclxuY29uc3Qga2V5TGlzdGVuZXJzID0gW107XHJcblxyXG4vLyBMaXN0ZW5lcnMgY2FsbGVkIG9uIGV2ZXJ5IG1vdXNlLWJ1dHRvbiBwcmVzcywgcmVnYXJkbGVzcyBvZiB3aGljaCBub2RlIHdhcyBoaXQuXHJcbi8vIFVzZWQgYnkgZHJvcGRvd25zIC8gb3ZlcmxheXMgdG8gY2xvc2Ugb24gb3V0c2lkZSBjbGljay5cclxuLy8gQXJyYXk8KGV2OiB7eCwgeSwgcHJlc3NlZH0pID0+IHZvaWQ+XHJcbmNvbnN0IGdsb2JhbENsaWNrTGlzdGVuZXJzID0gW107XHJcblxyXG4vLyBDdXJyZW50bHkgZm9jdXNlZCBpbnB1dCBub2RlIGlkIChvciBudWxsKS5cclxubGV0IGZvY3VzZWROb2RlSWQgPSBudWxsO1xyXG4vLyBJbnB1dCBub2RlIGN1cnJlbnRseSBiZWluZyBkcmFnLXNlbGVjdGVkIChsZWZ0IGJ1dHRvbiBoZWxkIGFmdGVyIHByZXNzaW5nXHJcbi8vIG9uIGEgVGV4dElucHV0KTsgY3Vyc29yTW92ZWQgZXh0ZW5kcyBpdHMgc2VsZWN0aW9uIHVudGlsIHJlbGVhc2UuXHJcbmxldCBpbnB1dERyYWdOb2RlSWQgPSBudWxsO1xyXG5cclxuLy8gQ3VycmVudGx5IGhvdmVyZWQgcHJlc3NhYmxlIG5vZGUgaWQgKG9yIG51bGwpLlxyXG4vLyBVcGRhdGVkIG9uY2UgcGVyIGZyYW1lIGZyb20gdGhlIGxhc3QgY3Vyc29yTW92ZWQgZXZlbnQncyBwb3NpdGlvbi5cclxubGV0IGhvdmVyZWRQcmVzc2FibGVJZCA9IG51bGw7XHJcblxyXG4vLyBNb2RpZmllciBrZXkgc3RhdGUgXHUyMDE0IHVwZGF0ZWQgb24gZXZlcnkga2V5SW5wdXQgKHByZXNzZWQgQU5EIHJlbGVhc2VkKS5cclxubGV0IGN0cmxIZWxkICA9IGZhbHNlO1xyXG5sZXQgc2hpZnRIZWxkID0gZmFsc2U7XHJcblxyXG4vLyBMYXN0IGN1cnNvciBwb3NpdGlvbiBzZWVuIHRoaXMgZnJhbWUgKHVwZGF0ZWQgYnkgY3Vyc29yTW92ZWQgZXZlbnRzKS5cclxubGV0IGN1cnNvclggPSAwO1xyXG5sZXQgY3Vyc29yWSA9IDA7XHJcblxyXG4vLyBcdTI1MDBcdTI1MDAgUHVibGljIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcclxuXHJcbi8qKlxyXG4gKiBSZWdpc3RlciBhIFByZXNzYWJsZSBub2RlIHNvIHRoZSBldmVudCBkaXNwYXRjaGVyIGNhbiBmaXJlIGl0cyBjYWxsYmFja3MuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBub2RlSWRcclxuICogQHBhcmFtIHt7IG9uUHJlc3M/OiAoKSA9PiB2b2lkLCBvblByZXNzSW4/OiAoKSA9PiB2b2lkLCBvblByZXNzT3V0PzogKCkgPT4gdm9pZCB9fSBoYW5kbGVyc1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyUHJlc3NhYmxlKG5vZGVJZCwgaGFuZGxlcnMpIHtcclxuICBwcmVzc2FibGVSZWdpc3RyeS5zZXQobm9kZUlkLCBoYW5kbGVycyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWdpc3RlciBhIGNhbGxiYWNrIGZpcmVkIHdoZW4gdGhlIGltYWdlIHdpdGggYGltYWdlSWRgIGZhaWxzIHRvIGxvYWQuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBpbWFnZUlkIC0gaWQgcmV0dXJuZWQgYnkgX19nbHl4X2NyZWF0ZUltYWdlXHJcbiAqIEBwYXJhbSB7KGV2OiB7IHBhdGg6IHN0cmluZyB9KSA9PiB2b2lkfSBvbkVycm9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJJbWFnZUVycm9yKGltYWdlSWQsIG9uRXJyb3IpIHtcclxuICBpbWFnZUVycm9yUmVnaXN0cnkuc2V0KGltYWdlSWQsIG9uRXJyb3IpO1xyXG59XHJcblxyXG4vKiogUmVnaXN0ZXIvdW5yZWdpc3RlciBhIHN5c3RlbS53YXRjaCBzdWJzY3JpYmVyIChzZWUgYXBpLmpzKS4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyU3lzdGVtV2F0Y2goaWQsIGNiKSB7XHJcbiAgc3lzdGVtV2F0Y2hSZWdpc3RyeS5zZXQoaWQsIGNiKTtcclxufVxyXG5leHBvcnQgZnVuY3Rpb24gdW5yZWdpc3RlclN5c3RlbVdhdGNoKGlkKSB7XHJcbiAgc3lzdGVtV2F0Y2hSZWdpc3RyeS5kZWxldGUoaWQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdW5yZWdpc3RlckltYWdlRXJyb3IoaW1hZ2VJZCkge1xyXG4gIGltYWdlRXJyb3JSZWdpc3RyeS5kZWxldGUoaW1hZ2VJZCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVbnJlZ2lzdGVyIGEgUHJlc3NhYmxlIG5vZGUgKGNhbGxlZCB3aGVuIHRoZSBjb21wb25lbnQgdW5tb3VudHMpLlxyXG4gKiBAcGFyYW0ge251bWJlcn0gbm9kZUlkXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdW5yZWdpc3RlclByZXNzYWJsZShub2RlSWQpIHtcclxuICBwcmVzc2FibGVSZWdpc3RyeS5kZWxldGUobm9kZUlkKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlZ2lzdGVyIGEgVGV4dElucHV0IG5vZGUuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBub2RlSWRcclxuICogQHBhcmFtIHt7IG9uRm9jdXM/OiAoKSA9PiB2b2lkLCBvbkJsdXI/OiAoKSA9PiB2b2lkLCBvbkNoYW5nZVRleHQ/OiAodGV4dDogc3RyaW5nKSA9PiB2b2lkIH19IGhhbmRsZXJzXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJJbnB1dChub2RlSWQsIGhhbmRsZXJzKSB7XHJcbiAgaW5wdXRSZWdpc3RyeS5zZXQobm9kZUlkLCBoYW5kbGVycyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVbnJlZ2lzdGVyIGEgVGV4dElucHV0IG5vZGUuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBub2RlSWRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bnJlZ2lzdGVySW5wdXQobm9kZUlkKSB7XHJcbiAgaWYgKGZvY3VzZWROb2RlSWQgPT09IG5vZGVJZCkgZm9jdXNlZE5vZGVJZCA9IG51bGw7XHJcbiAgaW5wdXRSZWdpc3RyeS5kZWxldGUobm9kZUlkKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlZ2lzdGVyIGEgU2Nyb2xsVmlldyBub2RlIHNvIHNjcm9sbCBldmVudHMgYXJlIHJvdXRlZCB0byBpdC5cclxuICogQHBhcmFtIHtudW1iZXJ9IG5vZGVJZFxyXG4gKiBAcGFyYW0ge3sgb25TY3JvbGw6IChkZWx0YVk6IG51bWJlcikgPT4gdm9pZCwgb25BYnNvbHV0ZVNjcm9sbD86ICh5OiBudW1iZXIpID0+IHZvaWQgfX0gaGFuZGxlcnNcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclNjcm9sbFZpZXcobm9kZUlkLCBoYW5kbGVycykge1xyXG4gIHNjcm9sbFJlZ2lzdHJ5LnNldChub2RlSWQsIGhhbmRsZXJzKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVucmVnaXN0ZXIgYSBTY3JvbGxWaWV3IG5vZGUgKGNhbGxlZCB3aGVuIHRoZSBjb21wb25lbnQgdW5tb3VudHMpLlxyXG4gKiBAcGFyYW0ge251bWJlcn0gbm9kZUlkXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdW5yZWdpc3RlclNjcm9sbFZpZXcobm9kZUlkKSB7XHJcbiAgc2Nyb2xsUmVnaXN0cnkuZGVsZXRlKG5vZGVJZCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWdpc3RlciBhIGRyYWdnYWJsZSBub2RlIChlLmcuIGEgU2xpZGVyIHRodW1iKS5cclxuICogQHBhcmFtIHtudW1iZXJ9IG5vZGVJZFxyXG4gKiBAcGFyYW0ge3sgb25EcmFnU3RhcnQ/OiAoZTp7eCx5fSk9PnZvaWQsIG9uRHJhZ01vdmU/OiAoZTp7eCx5LGR4LGR5fSk9PnZvaWQsIG9uRHJhZ0VuZD86IChlOnt4LHl9KT0+dm9pZCB9fSBoYW5kbGVyc1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyRHJhZ2dhYmxlKG5vZGVJZCwgaGFuZGxlcnMpIHtcclxuICBkcmFnUmVnaXN0cnkuc2V0KG5vZGVJZCwgaGFuZGxlcnMpO1xyXG59XHJcblxyXG4vKipcclxuICogVW5yZWdpc3RlciBhIGRyYWdnYWJsZSBub2RlIChjYWxsZWQgd2hlbiB0aGUgY29tcG9uZW50IHVubW91bnRzKS5cclxuICogQHBhcmFtIHtudW1iZXJ9IG5vZGVJZFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHVucmVnaXN0ZXJEcmFnZ2FibGUobm9kZUlkKSB7XHJcbiAgaWYgKGFjdGl2ZURyYWdJZCA9PT0gbm9kZUlkKSBhY3RpdmVEcmFnSWQgPSBudWxsO1xyXG4gIGRyYWdSZWdpc3RyeS5kZWxldGUobm9kZUlkKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlZ2lzdGVyIG9yIHVwZGF0ZSB0aGUgZGlzYWJsZWQgc3RhdGUgb2YgYSBub2RlLlxyXG4gKiBXaGVuIGBkaXNhYmxlZGAgaXMgdHJ1ZSwgdGhlIG5vZGUgKGFuZCBhbnkgZGVzY2VuZGFudCkgd2lsbCBub3QgcmVjZWl2ZVxyXG4gKiBwcmVzcywgaW5wdXQsIGRyYWcsIGhvdmVyLCBvciBzY3JvbGwgZXZlbnRzLlxyXG4gKiBAcGFyYW0ge251bWJlcn0gbm9kZUlkXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gZGlzYWJsZWRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckRpc2FibGVkTm9kZShub2RlSWQsIGRpc2FibGVkKSB7XHJcbiAgaWYgKGRpc2FibGVkKSB7XHJcbiAgICBkaXNhYmxlZFJlZ2lzdHJ5LnNldChub2RlSWQsIHRydWUpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBkaXNhYmxlZFJlZ2lzdHJ5LmRlbGV0ZShub2RlSWQpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFVucmVnaXN0ZXIgYSBkaXNhYmxlZCBub2RlIChjYWxsZWQgd2hlbiB0aGUgY29tcG9uZW50IHVubW91bnRzKS5cclxuICogQHBhcmFtIHtudW1iZXJ9IG5vZGVJZFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHVucmVnaXN0ZXJEaXNhYmxlZE5vZGUobm9kZUlkKSB7XHJcbiAgZGlzYWJsZWRSZWdpc3RyeS5kZWxldGUobm9kZUlkKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE1hcmsgYSBub2RlIGFzIGhhdmluZyBgcG9pbnRlckV2ZW50czogJ25vbmUnYCwgbWFraW5nIGl0IGludmlzaWJsZSB0b1xyXG4gKiBoaXQtdGVzdGluZy4gRXZlbnRzIHBhc3MgdGhyb3VnaCB0byBub2RlcyBsYXllcmVkIHVuZGVybmVhdGguXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBub2RlSWRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclBvaW50ZXJFdmVudHNOb25lKG5vZGVJZCkge1xyXG4gIHBvaW50ZXJFdmVudHNOb25lUmVnaXN0cnkuYWRkKG5vZGVJZCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWdpc3RlciBhIHZpZXcgbm9kZSBhcyBzb2xpZCAoY2xpY2stb3BhcXVlKS5cclxuICogQ2FsbGVkIGZyb20gaG9zdENvbmZpZy5jcmVhdGVJbnN0YW5jZSBmb3IgZXZlcnkgJ3ZpZXcnIG5hdGl2ZSBub2RlLlxyXG4gKiBAcGFyYW0ge251bWJlcn0gbm9kZUlkXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJTb2xpZChub2RlSWQpIHtcclxuICBzb2xpZFJlZ2lzdHJ5LnB1c2gobm9kZUlkKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVucmVnaXN0ZXIgYSBzb2xpZCBub2RlIG9uIHVubW91bnQuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBub2RlSWRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bnJlZ2lzdGVyU29saWQobm9kZUlkKSB7XHJcbiAgY29uc3QgaSA9IHNvbGlkUmVnaXN0cnkuaW5kZXhPZihub2RlSWQpO1xyXG4gIGlmIChpICE9PSAtMSkgc29saWRSZWdpc3RyeS5zcGxpY2UoaSwgMSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWNvcmQgdGhhdCBgY2hpbGRJZGAgaXMgYSBkaXJlY3QgY2hpbGQgb2YgYHBhcmVudElkYCBpbiB0aGUgbmF0aXZlIHRyZWUuXHJcbiAqIENhbGxlZCBieSBob3N0Q29uZmlnIHdoZW5ldmVyIGEgY2hpbGQgaXMgYXR0YWNoZWQgdG8gYSBwYXJlbnQuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBjaGlsZElkXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBwYXJlbnRJZFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNldE5vZGVQYXJlbnQoY2hpbGRJZCwgcGFyZW50SWQpIHtcclxuICBwYXJlbnRNYXAuc2V0KGNoaWxkSWQsIHBhcmVudElkKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSBhIG5vZGUgZnJvbSBwYXJlbnRNYXAgYW5kIHNvbGlkUmVnaXN0cnkgb24gdHJlZSBkZXRhY2guXHJcbiAqIFJlcGxhY2VzIHNlcGFyYXRlIHVucmVnaXN0ZXJTb2xpZCArIHBhcmVudE1hcC5kZWxldGUgY2FsbHMgaW4gaG9zdENvbmZpZy5cclxuICogQHBhcmFtIHtudW1iZXJ9IG5vZGVJZFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZU5vZGVGcm9tVHJlZShub2RlSWQpIHtcclxuICBwYXJlbnRNYXAuZGVsZXRlKG5vZGVJZCk7XHJcbiAgdW5yZWdpc3RlclNvbGlkKG5vZGVJZCk7XHJcbiAgekluZGV4TWFwLmRlbGV0ZShub2RlSWQpO1xyXG59XHJcblxyXG4vKipcclxuICogUmVjb3JkIHRoZSB6LWluZGV4IGZvciBhIG5vZGUgc28gaGl0LXRlc3RpbmcgY2FuIHByZWZlciB2aXN1YWxseS1oaWdoZXJcclxuICogbm9kZXMgb3ZlciBvbmVzIHdpdGggYSBsYXRlciBzb2xpZFJlZ2lzdHJ5IGluZGV4LlxyXG4gKiBAcGFyYW0ge251bWJlcn0gbm9kZUlkXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB6SW5kZXhcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzZXROb2RlWkluZGV4KG5vZGVJZCwgekluZGV4KSB7XHJcbiAgaWYgKHpJbmRleCAhPT0gMCkge1xyXG4gICAgekluZGV4TWFwLnNldChub2RlSWQsIHpJbmRleCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHpJbmRleE1hcC5kZWxldGUobm9kZUlkKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVbnJlZ2lzdGVyIGEgcG9pbnRlckV2ZW50czogJ25vbmUnIG1hcmtlci5cclxuICogQHBhcmFtIHtudW1iZXJ9IG5vZGVJZFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHVucmVnaXN0ZXJQb2ludGVyRXZlbnRzTm9uZShub2RlSWQpIHtcclxuICBwb2ludGVyRXZlbnRzTm9uZVJlZ2lzdHJ5LmRlbGV0ZShub2RlSWQpO1xyXG59XHJcblxyXG4vKipcclxuICogU3Vic2NyaWJlIHRvIHdpbmRvdyByZXNpemUgZXZlbnRzLlxyXG4gKiBAcGFyYW0geyhzaXplOiB7d2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXJ9KSA9PiB2b2lkfSBmblxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFkZFdpbmRvd1NpemVMaXN0ZW5lcihmbikge1xyXG4gIHdpbmRvd1NpemVMaXN0ZW5lcnMucHVzaChmbik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVbnN1YnNjcmliZSBmcm9tIHdpbmRvdyByZXNpemUgZXZlbnRzLlxyXG4gKiBAcGFyYW0geyhzaXplOiB7d2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXJ9KSA9PiB2b2lkfSBmblxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZVdpbmRvd1NpemVMaXN0ZW5lcihmbikge1xyXG4gIGNvbnN0IGlkeCA9IHdpbmRvd1NpemVMaXN0ZW5lcnMuaW5kZXhPZihmbik7XHJcbiAgaWYgKGlkeCA+PSAwKSB3aW5kb3dTaXplTGlzdGVuZXJzLnNwbGljZShpZHgsIDEpO1xyXG59XHJcblxyXG4vKipcclxuICogU3Vic2NyaWJlIHRvIHJhdyBrZXkgZXZlbnRzIChwcmVzcyBhbmQgcmVsZWFzZSkuXHJcbiAqIEBwYXJhbSB7KGV2OiB7a2V5OiBzdHJpbmcsIGN0cmw6IGJvb2xlYW4sIHNoaWZ0OiBib29sZWFuLCBwcmVzc2VkOiBib29sZWFufSkgPT4gdm9pZH0gZm5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhZGRLZXlMaXN0ZW5lcihmbikge1xyXG4gIGtleUxpc3RlbmVycy5wdXNoKGZuKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVuc3Vic2NyaWJlIGZyb20gcmF3IGtleSBldmVudHMuXHJcbiAqIEBwYXJhbSB7KGV2OiB7a2V5OiBzdHJpbmcsIGN0cmw6IGJvb2xlYW4sIHNoaWZ0OiBib29sZWFuLCBwcmVzc2VkOiBib29sZWFufSkgPT4gdm9pZH0gZm5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVLZXlMaXN0ZW5lcihmbikge1xyXG4gIGNvbnN0IGlkeCA9IGtleUxpc3RlbmVycy5pbmRleE9mKGZuKTtcclxuICBpZiAoaWR4ID49IDApIGtleUxpc3RlbmVycy5zcGxpY2UoaWR4LCAxKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFN1YnNjcmliZSB0byBldmVyeSBtb3VzZS1idXR0b24gcHJlc3MgZXZlbnQgKHJlZ2FyZGxlc3Mgb2Ygd2hpY2ggbm9kZSB3YXMgaGl0KS5cclxuICogVXNlZnVsIGZvciBkcm9wZG93bnMvb3ZlcmxheXMgdGhhdCBuZWVkIHRvIGNsb3NlIG9uIG91dHNpZGUgY2xpY2suXHJcbiAqIEBwYXJhbSB7KGV2OiB7eDogbnVtYmVyLCB5OiBudW1iZXJ9KSA9PiB2b2lkfSBmblxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFkZEdsb2JhbENsaWNrTGlzdGVuZXIoZm4pIHtcclxuICBnbG9iYWxDbGlja0xpc3RlbmVycy5wdXNoKGZuKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVuc3Vic2NyaWJlIGZyb20gZ2xvYmFsIGNsaWNrIGV2ZW50cy5cclxuICogQHBhcmFtIHsoZXY6IHt4OiBudW1iZXIsIHk6IG51bWJlcn0pID0+IHZvaWR9IGZuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlR2xvYmFsQ2xpY2tMaXN0ZW5lcihmbikge1xyXG4gIGNvbnN0IGlkeCA9IGdsb2JhbENsaWNrTGlzdGVuZXJzLmluZGV4T2YoZm4pO1xyXG4gIGlmIChpZHggPj0gMCkgZ2xvYmFsQ2xpY2tMaXN0ZW5lcnMuc3BsaWNlKGlkeCwgMSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFeHBsaWNpdGx5IGZvY3VzIGEgVGV4dElucHV0IG5vZGUgZnJvbSBKUyAoZS5nLiBwcm9ncmFtbWF0aWMgZm9jdXMpLlxyXG4gKiBAcGFyYW0ge251bWJlcn0gbm9kZUlkXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc2V0Rm9jdXMobm9kZUlkKSB7XHJcbiAgaWYgKGZvY3VzZWROb2RlSWQgIT09IG5vZGVJZCkge1xyXG4gICAgaWYgKGZvY3VzZWROb2RlSWQgIT09IG51bGwpIHtcclxuICAgICAgY29uc3QgcHJldiA9IGlucHV0UmVnaXN0cnkuZ2V0KGZvY3VzZWROb2RlSWQpO1xyXG4gICAgICBwcmV2Py5vbkJsdXI/LigpO1xyXG4gICAgfVxyXG4gICAgZm9jdXNlZE5vZGVJZCA9IG5vZGVJZDtcclxuICAgIGNvbnN0IGhhbmRsZXJzID0gaW5wdXRSZWdpc3RyeS5nZXQobm9kZUlkKTtcclxuICAgIGhhbmRsZXJzPy5vbkZvY3VzPy4oKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBIaXQtdGVzdCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG5cclxuZnVuY3Rpb24gaGl0VGVzdChub2RlSWQsIHB4LCBweSkge1xyXG4gIGlmIChwb2ludGVyRXZlbnRzTm9uZVJlZ2lzdHJ5Lmhhcyhub2RlSWQpKSByZXR1cm4gZmFsc2U7XHJcbiAgY29uc3QgbGF5b3V0ID0gX19nbHl4X2dldExheW91dChub2RlSWQpO1xyXG4gIGlmICghbGF5b3V0KSByZXR1cm4gZmFsc2U7XHJcbiAgcmV0dXJuIChcclxuICAgIHB4ID49IGxheW91dC54ICYmIHB4IDwgbGF5b3V0LnggKyBsYXlvdXQud2lkdGggJiZcclxuICAgIHB5ID49IGxheW91dC55ICYmIHB5IDwgbGF5b3V0LnkgKyBsYXlvdXQuaGVpZ2h0XHJcbiAgKTtcclxufVxyXG5cclxuLyoqIFRydWUgd2hlbiB0aGUgbm9kZSBpcyBpbiB0aGUgZGlzYWJsZWQgcmVnaXN0cnkuICovXHJcbmZ1bmN0aW9uIGlzRGlzYWJsZWQobm9kZUlkKSB7XHJcbiAgcmV0dXJuIGRpc2FibGVkUmVnaXN0cnkuaGFzKG5vZGVJZCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGaW5kIHRoZSBzY3JvbGwgdmlldyB0aGF0IHNob3VsZCByZWNlaXZlIGtleWJvYXJkIHNjcm9sbCBrZXlzLlxyXG4gKiBXYWxrcyB1cCBmcm9tIGBmcm9tTm9kZUlkYCAoaWYgc2V0KSB0byBmaW5kIHRoZSBuZWFyZXN0IHNjcm9sbCBhbmNlc3RvcixcclxuICogdGhlbiBmYWxscyBiYWNrIHRvIHRoZSB0b3Btb3N0IHNjcm9sbCB2aWV3IHRoZSBjdXJzb3IgaXMgb3Zlci5cclxuICogQHBhcmFtIHtudW1iZXJ8bnVsbH0gZnJvbU5vZGVJZFxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfG51bGx9XHJcbiAqL1xyXG5mdW5jdGlvbiBmaW5kU2Nyb2xsVGFyZ2V0KGZyb21Ob2RlSWQpIHtcclxuICBpZiAoZnJvbU5vZGVJZCAhPT0gbnVsbCkge1xyXG4gICAgbGV0IGlkID0gcGFyZW50TWFwLmdldChmcm9tTm9kZUlkKTtcclxuICAgIHdoaWxlIChpZCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGlmIChzY3JvbGxSZWdpc3RyeS5oYXMoaWQpKSByZXR1cm4gaWQ7XHJcbiAgICAgIGlkID0gcGFyZW50TWFwLmdldChpZCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGZvciAoY29uc3QgW25vZGVJZF0gb2YgWy4uLnNjcm9sbFJlZ2lzdHJ5XS5yZXZlcnNlKCkpIHtcclxuICAgIGlmIChoaXRUZXN0KG5vZGVJZCwgY3Vyc29yWCwgY3Vyc29yWSkpIHJldHVybiBub2RlSWQ7XHJcbiAgfVxyXG4gIHJldHVybiBudWxsO1xyXG59XHJcblxyXG4vKiogUmV0dXJucyB0cnVlIHdoZW4gYGFuY2VzdG9ySWRgIGlzIGEgZGlyZWN0IG9yIGluZGlyZWN0IHBhcmVudCBvZiBgZGVzY2VuZGFudElkYC4gKi9cclxuZnVuY3Rpb24gaXNBbmNlc3Rvck9mKGFuY2VzdG9ySWQsIGRlc2NlbmRhbnRJZCkge1xyXG4gIGxldCBpZCA9IHBhcmVudE1hcC5nZXQoZGVzY2VuZGFudElkKTtcclxuICB3aGlsZSAoaWQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgaWYgKGlkID09PSBhbmNlc3RvcklkKSByZXR1cm4gdHJ1ZTtcclxuICAgIGlkID0gcGFyZW50TWFwLmdldChpZCk7XHJcbiAgfVxyXG4gIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybiB0aGUgdG9wbW9zdCBzb2xpZCAoY2xpY2stb3BhcXVlKSBub2RlIGNvdmVyaW5nICh4LCB5KSwgb3IgbnVsbC5cclxuICpcclxuICogUmVhY3QgY3JlYXRlcyBob3N0IGluc3RhbmNlcyBpbiBwb3N0LW9yZGVyIChjaGlsZHJlbiBiZWZvcmUgcGFyZW50cyksIHNvXHJcbiAqIHNvbGlkUmVnaXN0cnkgaXMgb3JkZXJlZDogY2hpbGRyZW4gaGF2ZSBMT1dFUiBpbmRpY2VzLCBwYXJlbnRzIEhJR0hFUi5cclxuICpcclxuICogQWxnb3JpdGhtOlxyXG4gKiAgIDEuIENvbGxlY3QgZXZlcnkgc29saWQgbm9kZSB3aG9zZSBsYXlvdXQgcmVjdCBjb3ZlcnMgKHgsIHkpLlxyXG4gKiAgIDIuIEZpbHRlciB0byBcImRlZXBlc3RcIiBcdTIwMTQgcmVtb3ZlIGFueSBub2RlIHRoYXQgaXMgYW4gYW5jZXN0b3Igb2YgYW5vdGhlclxyXG4gKiAgICAgIGNvdmVyaW5nIG5vZGUgKGFuIGFuY2VzdG9yIGlzIHBhaW50ZWQgYmVuZWF0aCBpdHMgZGVzY2VuZGFudHMpLlxyXG4gKiAgIDMuIEFtb25nIHRoZSByZW1haW5pbmcgc2libGluZ3MvY291c2lucywgcmV0dXJuIHRoZSBvbmUgd2l0aCB0aGUgaGlnaGVzdFxyXG4gKiAgICAgIHNvbGlkUmVnaXN0cnkgaW5kZXggKGxhdGVyLXJlZ2lzdGVyZWQgc2libGluZyA9IHBhaW50ZWQgb24gdG9wKS5cclxuICovXHJcbmZ1bmN0aW9uIGZpbmRUb3Btb3N0U29saWQoeCwgeSkge1xyXG4gIGNvbnN0IGNvdmVyaW5nID0gW107XHJcbiAgZm9yIChjb25zdCBpZCBvZiBzb2xpZFJlZ2lzdHJ5KSB7XHJcbiAgICBpZiAoaGl0VGVzdChpZCwgeCwgeSkpIGNvdmVyaW5nLnB1c2goaWQpO1xyXG4gIH1cclxuICBpZiAoY292ZXJpbmcubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcclxuICBpZiAoY292ZXJpbmcubGVuZ3RoID09PSAxKSByZXR1cm4gY292ZXJpbmdbMF07XHJcbiAgLy8gS2VlcCBvbmx5IGRlZXBlc3Qgbm9kZXMgKHJlbW92ZSBhbmNlc3RvcnMgb2Ygb3RoZXIgY292ZXJpbmcgbm9kZXMpLlxyXG4gIGNvbnN0IGRlZXBlc3QgPSBjb3ZlcmluZy5maWx0ZXIoXHJcbiAgICBpZCA9PiAhY292ZXJpbmcuc29tZShvdGhlciA9PiBvdGhlciAhPT0gaWQgJiYgaXNBbmNlc3Rvck9mKGlkLCBvdGhlcikpXHJcbiAgKTtcclxuICBpZiAoZGVlcGVzdC5sZW5ndGggPT09IDEpIHJldHVybiBkZWVwZXN0WzBdO1xyXG4gIC8vIEFtb25nIHNpYmxpbmdzLCBwaWNrIHRoZSB2aXN1YWxseSB0b3Btb3N0IG5vZGUuXHJcbiAgLy8gei1pbmRleCB0YWtlcyBwcmlvcml0eSBvdmVyIHJlZ2lzdHJhdGlvbiBvcmRlcjogYSBub2RlIHdpdGggYSBoaWdoZXJcclxuICAvLyB6LWluZGV4IGJlYXRzIG9uZSByZWdpc3RlcmVkIGxhdGVyICh3aGljaCBpcyB0aGUgY29tbW9uIGNhc2Ugd2hlbiBhblxyXG4gIC8vIGFic29sdXRlbHktcG9zaXRpb25lZCBvdmVybGF5IGlzIGRlY2xhcmVkIGJlZm9yZSB0aGUgY29udGVudCBpdCBjb3ZlcnNcclxuICAvLyBpbiBKU1ggYnV0IG11c3QgcmVjZWl2ZSBjbGlja3Mgb3ZlciBpdCkuXHJcbiAgLy8gVGhlIGVmZmVjdGl2ZSB6LWluZGV4IGlzIGluaGVyaXRlZCBmcm9tIHRoZSBhbmNlc3RvciBjaGFpbjogYSBsZWFmIGluc2lkZVxyXG4gIC8vIGEgekluZGV4Ojk5OSBvdmVybGF5IGxheWVyIG11c3QgYmVhdCBjb250ZW50IHJlLXJlbmRlcmVkIGFmdGVyIHRoZVxyXG4gIC8vIG92ZXJsYXkgbW91bnRlZCAoZS5nLiB0b2FzdCBpdGVtcyBvdmVyIGEgc2NyZWVuIHRoYXQgcmUtcmVuZGVyZWQgbGF0ZXIpLlxyXG4gIGNvbnN0IGVmZmVjdGl2ZVogPSAoaWQpID0+IHtcclxuICAgIGxldCB6ID0gekluZGV4TWFwLmdldChpZCkgPz8gMDtcclxuICAgIGxldCBwID0gcGFyZW50TWFwLmdldChpZCk7XHJcbiAgICB3aGlsZSAocCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGNvbnN0IHB6ID0gekluZGV4TWFwLmdldChwKTtcclxuICAgICAgaWYgKHB6ICE9PSB1bmRlZmluZWQgJiYgcHogPiB6KSB6ID0gcHo7XHJcbiAgICAgIHAgPSBwYXJlbnRNYXAuZ2V0KHApO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHo7XHJcbiAgfTtcclxuICBsZXQgYmVzdElkID0gZGVlcGVzdFswXTtcclxuICBsZXQgYmVzdElkeCA9IHNvbGlkUmVnaXN0cnkubGFzdEluZGV4T2YoZGVlcGVzdFswXSk7XHJcbiAgbGV0IGJlc3RaICAgPSBlZmZlY3RpdmVaKGRlZXBlc3RbMF0pO1xyXG4gIGZvciAobGV0IGkgPSAxOyBpIDwgZGVlcGVzdC5sZW5ndGg7IGkrKykge1xyXG4gICAgY29uc3QgeiAgID0gZWZmZWN0aXZlWihkZWVwZXN0W2ldKTtcclxuICAgIGNvbnN0IGlkeCA9IHNvbGlkUmVnaXN0cnkubGFzdEluZGV4T2YoZGVlcGVzdFtpXSk7XHJcbiAgICBpZiAoeiA+IGJlc3RaIHx8ICh6ID09PSBiZXN0WiAmJiBpZHggPiBiZXN0SWR4KSkge1xyXG4gICAgICBiZXN0SWQgID0gZGVlcGVzdFtpXTtcclxuICAgICAgYmVzdElkeCA9IGlkeDtcclxuICAgICAgYmVzdFogICA9IHo7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBiZXN0SWQ7XHJcbn1cclxuXHJcbi8vIFx1MjUwMFx1MjUwMCBNYWluIGRpc3BhdGNoIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG5cclxuLyoqXHJcbiAqIFByb2Nlc3MgYWxsIHF1ZXVlZCBuYXRpdmUgZXZlbnRzLlxyXG4gKiBDYWxsZWQgb25jZSBwZXIgZnJhbWUgZnJvbSBgX19nbHl4X2ZyYW1lQ2FsbGJhY2tgLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGRpc3BhdGNoRXZlbnRzKCkge1xyXG4gIGNvbnN0IGV2ZW50cyA9IF9fZ2x5eF9wb2xsRXZlbnRzKCk7XHJcbiAgaWYgKCFldmVudHMgfHwgZXZlbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICBsZXQgY3Vyc29yTW92ZWRUaGlzRnJhbWUgPSBmYWxzZTtcclxuXHJcbiAgZm9yIChjb25zdCBldiBvZiBldmVudHMpIHtcclxuICAgIHN3aXRjaCAoZXYudHlwZSkge1xyXG5cclxuICAgICAgY2FzZSAnbW91c2VCdXR0b24nOiB7XHJcbiAgICAgICAgaWYgKCFldi5wcmVzc2VkKSB7XHJcbiAgICAgICAgICBpbnB1dERyYWdOb2RlSWQgPSBudWxsOyAgIC8vIGVuZCB0ZXh0IGRyYWctc2VsZWN0aW9uIG9uIHJlbGVhc2VcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgaXNSaWdodCA9IGV2LmJ1dHRvbiA9PT0gMTsgLy8gMCA9IGxlZnQsIDEgPSByaWdodCwgMiA9IG1pZGRsZVxyXG5cclxuICAgICAgICAvLyBOb3RpZnkgZ2xvYmFsIGNsaWNrIGxpc3RlbmVycyBmaXJzdCAoZS5nLiB0byBjbG9zZSBvcGVuIGRyb3Bkb3ducyAvXHJcbiAgICAgICAgLy8gY29udGV4dCBtZW51cykuIGBidXR0b25gIGxldHMgbGlzdGVuZXJzIGRpc3Rpbmd1aXNoIHJpZ2h0LWNsaWNrcy5cclxuICAgICAgICBpZiAoZ2xvYmFsQ2xpY2tMaXN0ZW5lcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgY29uc3QgZ2V2ID0geyB4OiBldi54LCB5OiBldi55LCBidXR0b246IGV2LmJ1dHRvbiB9O1xyXG4gICAgICAgICAgZm9yIChjb25zdCBmbiBvZiBnbG9iYWxDbGlja0xpc3RlbmVycykgdHJ5IHsgZm4oZ2V2KTsgfSBjYXRjaCB7fVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRmluZCB0aGUgdG9wbW9zdCBzb2xpZCAoY2xpY2stb3BhcXVlKSBub2RlIGF0IHRoaXMgcG9zaXRpb24uXHJcbiAgICAgICAgLy8gQSBwbGFpbiBWaWV3IGFic29yYnMgdGhlIGNsaWNrIGV2ZW4gd2l0aG91dCBhIGhhbmRsZXIsIHByZXZlbnRpbmdcclxuICAgICAgICAvLyBmYWxsdGhyb3VnaCB0byBwcmVzc2FibGVzL2lucHV0cyByZW5kZXJlZCBiZW5lYXRoIGl0IGluIHotb3JkZXIuXHJcbiAgICAgICAgY29uc3QgdG9wbW9zdElkID0gZmluZFRvcG1vc3RTb2xpZChldi54LCBldi55KTtcclxuXHJcbiAgICAgICAgaWYgKHRvcG1vc3RJZCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgLy8gV2FsayB1cCB0aGUgcGFyZW50IGNoYWluIHRvIGZpbmQgdGhlIG5lYXJlc3QgcHJlc3NhYmxlIGFuY2VzdG9yXHJcbiAgICAgICAgICAvLyAoc2VsZi1pbmNsdXNpdmUpLiAgZmluZFRvcG1vc3RTb2xpZCByZXR1cm5zIHRoZSBkZWVwZXN0IGxlYWYgbm9kZSxcclxuICAgICAgICAgIC8vIGJ1dCBjbGlja2luZyBhbnl3aGVyZSBpbnNpZGUgYSBQcmVzc2FibGUncyBzdWJ0cmVlIHNob3VsZCBmaXJlIGl0c1xyXG4gICAgICAgICAgLy8gb25QcmVzcyBcdTIwMTQgZXhhY3RseSBsaWtlIERPTSBldmVudCBidWJibGluZy5cclxuICAgICAgICAgIGxldCBwcmVzc2FibGVUYXJnZXQgPSB0b3Btb3N0SWQ7XHJcbiAgICAgICAgICB3aGlsZSAocHJlc3NhYmxlVGFyZ2V0ICE9PSB1bmRlZmluZWQgJiYgIXByZXNzYWJsZVJlZ2lzdHJ5LmhhcyhwcmVzc2FibGVUYXJnZXQpKSB7XHJcbiAgICAgICAgICAgIHByZXNzYWJsZVRhcmdldCA9IHBhcmVudE1hcC5nZXQocHJlc3NhYmxlVGFyZ2V0KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmIChwcmVzc2FibGVUYXJnZXQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBjb25zdCBwaCA9IHByZXNzYWJsZVJlZ2lzdHJ5LmdldChwcmVzc2FibGVUYXJnZXQpO1xyXG4gICAgICAgICAgICBpZiAocGggJiYgIWlzRGlzYWJsZWQocHJlc3NhYmxlVGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGxheW91dCA9IF9fZ2x5eF9nZXRMYXlvdXQocHJlc3NhYmxlVGFyZ2V0KTtcclxuICAgICAgICAgICAgICBjb25zdCBwZXYgPSB7XHJcbiAgICAgICAgICAgICAgICB4OiBldi54LCB5OiBldi55LFxyXG4gICAgICAgICAgICAgICAgbG9jYXRpb25YOiBsYXlvdXQgPyBldi54IC0gbGF5b3V0LnggOiAwLFxyXG4gICAgICAgICAgICAgICAgbG9jYXRpb25ZOiBsYXlvdXQgPyBldi55IC0gbGF5b3V0LnkgOiAwLFxyXG4gICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgLy8gUmlnaHQtY2xpY2sgXHUyMTkyIG9uUmlnaHRQcmVzcyAoaWYgcHJlc2VudCk7IG90aGVyd2lzZSBsZWZ0IFx1MjE5MiBvblByZXNzLlxyXG4gICAgICAgICAgICAgIGlmIChpc1JpZ2h0KSBwaC5vblJpZ2h0UHJlc3M/LihwZXYpO1xyXG4gICAgICAgICAgICAgIGVsc2UgICAgICAgICBwaC5vblByZXNzPy4ocGV2KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFJvdXRlIHRvIFRleHRJbnB1dCBoYW5kbGVyIGlmIHRoZSB0b3Btb3N0IG5vZGUgaXMgYW4gaW5wdXQuXHJcbiAgICAgICAgICAvLyBJbnB1dHMgYXJlIGxlYWYgbm9kZXMgd2l0aCBubyBjaGlsZHJlbiwgc28gbm8gd2Fsay11cCBuZWVkZWQuXHJcbiAgICAgICAgICBjb25zdCBpaCA9IGlucHV0UmVnaXN0cnkuZ2V0KHRvcG1vc3RJZCk7XHJcbiAgICAgICAgICBpZiAoaWggJiYgIWlzRGlzYWJsZWQodG9wbW9zdElkKSkge1xyXG4gICAgICAgICAgICBzZXRGb2N1cyh0b3Btb3N0SWQpO1xyXG4gICAgICAgICAgICBjb25zdCBsYXlvdXQgPSBfX2dseXhfZ2V0TGF5b3V0KHRvcG1vc3RJZCk7XHJcbiAgICAgICAgICAgIGlmIChsYXlvdXQpIGloLm9uQ2xpY2tBdD8uKGV2LnggLSBsYXlvdXQueCwgZXYueSAtIGxheW91dC55KTtcclxuICAgICAgICAgICAgLy8gQmVnaW4gZHJhZy1zZWxlY3Rpb246IHN1YnNlcXVlbnQgY3Vyc29yTW92ZWQgZXZlbnRzIGV4dGVuZCB0aGVcclxuICAgICAgICAgICAgLy8gc2VsZWN0aW9uIGZyb20gdGhpcyBhbmNob3IgdW50aWwgdGhlIGJ1dHRvbiBpcyByZWxlYXNlZC5cclxuICAgICAgICAgICAgaWYgKCFpc1JpZ2h0KSBpbnB1dERyYWdOb2RlSWQgPSB0b3Btb3N0SWQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBCbHVyIGZvY3VzZWQgaW5wdXQgaWYgdGhlIGNsaWNrIGxhbmRlZCBlbHNld2hlcmUuXHJcbiAgICAgICAgaWYgKGZvY3VzZWROb2RlSWQgIT09IG51bGwgJiYgZm9jdXNlZE5vZGVJZCAhPT0gdG9wbW9zdElkKSB7XHJcbiAgICAgICAgICBpbnB1dFJlZ2lzdHJ5LmdldChmb2N1c2VkTm9kZUlkKT8ub25CbHVyPy4oKTtcclxuICAgICAgICAgIGZvY3VzZWROb2RlSWQgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG5cclxuICAgICAgY2FzZSAna2V5SW5wdXQnOiB7XHJcbiAgICAgICAgLy8gQWx3YXlzIHRyYWNrIG1vZGlmaWVyIHN0YXRlIChvbiBib3RoIHByZXNzIGFuZCByZWxlYXNlKS5cclxuICAgICAgICBpZiAoZXYua2V5ID09PSAnQ29udHJvbExlZnQnIHx8IGV2LmtleSA9PT0gJ0NvbnRyb2xSaWdodCcpIHtcclxuICAgICAgICAgIGN0cmxIZWxkID0gZXYucHJlc3NlZDtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZXYua2V5ID09PSAnU2hpZnRMZWZ0JyB8fCBldi5rZXkgPT09ICdTaGlmdFJpZ2h0Jykge1xyXG4gICAgICAgICAgc2hpZnRIZWxkID0gZXYucHJlc3NlZDtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gTm90aWZ5IGdsb2JhbCBrZXkgbGlzdGVuZXJzICh1c2VkIGZvciBhcHAtZm9jdXNlZCBzaG9ydGN1dHMpLlxyXG4gICAgICAgIGlmIChrZXlMaXN0ZW5lcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgY29uc3Qga2V2ID0geyBrZXk6IGV2LmtleSwgY3RybDogY3RybEhlbGQsIHNoaWZ0OiBzaGlmdEhlbGQsIHByZXNzZWQ6IGV2LnByZXNzZWQgfTtcclxuICAgICAgICAgIGZvciAoY29uc3QgZm4gb2Yga2V5TGlzdGVuZXJzKSB0cnkgeyBmbihrZXYpOyB9IGNhdGNoIHt9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIWV2LnByZXNzZWQpIGJyZWFrO1xyXG5cclxuICAgICAgICAvLyBTY3JvbGwtbmF2aWdhdGlvbiBrZXlzOiByb3V0ZSB0byB0aGUgdG9wbW9zdCBzY3JvbGwgdmlldyB0aGUgY3Vyc29yXHJcbiAgICAgICAgLy8gaXMgb3ZlciBcdTIwMTQgYnV0IE9OTFkgd2hlbiBubyB0ZXh0IGlucHV0IGlzIGZvY3VzZWQuICBBIGZvY3VzZWQgaW5wdXRcclxuICAgICAgICAvLyBvd25zIEFMTCBuYXZpZ2F0aW9uIGtleXMgKFRleHRJbnB1dCBtb3ZlcyB0aGUgY2FyZXQgb24gUGFnZVVwL0Rvd25cclxuICAgICAgICAvLyBhbmQganVtcHMgdGhlIGRvY3VtZW50IG9uIEN0cmwrSG9tZS9FbmQ7IGNhcmV0LWZvbGxvdyBzY3JvbGxzIHRoZSB2aWV3KS5cclxuICAgICAgICB7XHJcbiAgICAgICAgICBjb25zdCBrID0gZXYua2V5O1xyXG4gICAgICAgICAgY29uc3Qgbm9Gb2N1cyAgICA9IGZvY3VzZWROb2RlSWQgPT09IG51bGw7XHJcbiAgICAgICAgICBjb25zdCBpc1BhZ2VLZXkgID0gKGsgPT09ICdQYWdlVXAnIHx8IGsgPT09ICdQYWdlRG93bicpICYmIG5vRm9jdXM7XHJcbiAgICAgICAgICBjb25zdCBpc0p1bXBLZXkgID0gY3RybEhlbGQgJiYgKGsgPT09ICdIb21lJyB8fCBrID09PSAnRW5kJykgJiYgbm9Gb2N1cztcclxuICAgICAgICAgIGNvbnN0IGlzQXJyb3dLZXkgPSAoayA9PT0gJ0Fycm93VXAnIHx8IGsgPT09ICdBcnJvd0Rvd24nKSAmJiBub0ZvY3VzO1xyXG4gICAgICAgICAgaWYgKGlzUGFnZUtleSB8fCBpc0p1bXBLZXkgfHwgaXNBcnJvd0tleSkge1xyXG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBmaW5kU2Nyb2xsVGFyZ2V0KGZvY3VzZWROb2RlSWQpO1xyXG4gICAgICAgICAgICBpZiAodGFyZ2V0ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgY29uc3Qgc2ggICAgID0gc2Nyb2xsUmVnaXN0cnkuZ2V0KHRhcmdldCk7XHJcbiAgICAgICAgICAgICAgY29uc3QgbGF5b3V0ID0gX19nbHl4X2dldExheW91dCh0YXJnZXQpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IHZpZXdIICA9IGxheW91dCA/IGxheW91dC5oZWlnaHQgOiAyMDA7XHJcbiAgICAgICAgICAgICAgY29uc3QgTElORSAgID0gMjQ7XHJcbiAgICAgICAgICAgICAgaWYgICAgICAoayA9PT0gJ0Fycm93VXAnKSAgIHNoLm9uU2Nyb2xsPy4oLShMSU5FKSk7XHJcbiAgICAgICAgICAgICAgZWxzZSBpZiAoayA9PT0gJ0Fycm93RG93bicpIHNoLm9uU2Nyb2xsPy4oTElORSk7XHJcbiAgICAgICAgICAgICAgZWxzZSBpZiAoayA9PT0gJ1BhZ2VVcCcpICAgIHNoLm9uU2Nyb2xsPy4oLSh2aWV3SCAtIExJTkUpKTtcclxuICAgICAgICAgICAgICBlbHNlIGlmIChrID09PSAnUGFnZURvd24nKSAgc2gub25TY3JvbGw/Lih2aWV3SCAtIExJTkUpO1xyXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGsgPT09ICdIb21lJykgICAgICBzaC5vbkFic29sdXRlU2Nyb2xsPy4oMCk7XHJcbiAgICAgICAgICAgICAgZWxzZSBpZiAoayA9PT0gJ0VuZCcpICAgICAgIHNoLm9uQWJzb2x1dGVTY3JvbGw/Lig5OTk5OTkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGZvY3VzZWROb2RlSWQgPT09IG51bGwpIGJyZWFrO1xyXG5cclxuICAgICAgICBjb25zdCBoYW5kbGVycyA9IGlucHV0UmVnaXN0cnkuZ2V0KGZvY3VzZWROb2RlSWQpO1xyXG4gICAgICAgIGlmICghaGFuZGxlcnMpIGJyZWFrO1xyXG5cclxuICAgICAgICBoYW5kbGVycy5vbktleVByZXNzPy4oeyBrZXk6IGV2LmtleSwgdGV4dDogZXYudGV4dCwgY3RybDogY3RybEhlbGQsIHNoaWZ0OiBzaGlmdEhlbGQgfSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNhc2UgJ2N1cnNvck1vdmVkJzoge1xyXG4gICAgICAgIC8vIFRyYWNrIGZpbmFsIHBvc2l0aW9uIFx1MjAxNCBob3ZlciBpcyByZXNvbHZlZCBvbmNlIGFmdGVyIHRoZSBsb29wXHJcbiAgICAgICAgLy8gc28gbXVsdGlwbGUgY3Vyc29yIGV2ZW50cyBwZXIgZnJhbWUgcHJvZHVjZSBvbmx5IG9uZSBoaXQtdGVzdC5cclxuICAgICAgICBjdXJzb3JYID0gZXYueDtcclxuICAgICAgICBjdXJzb3JZID0gZXYueTtcclxuICAgICAgICBjdXJzb3JNb3ZlZFRoaXNGcmFtZSA9IHRydWU7XHJcbiAgICAgICAgLy8gVGV4dCBkcmFnLXNlbGVjdGlvbjogd2hpbGUgdGhlIGxlZnQgYnV0dG9uIGlzIGhlbGQgb24gYW4gaW5wdXQsXHJcbiAgICAgICAgLy8gZXZlcnkgY3Vyc29yIG1vdmUgZXh0ZW5kcyB0aGUgc2VsZWN0aW9uIHRvd2FyZCB0aGUgcG9pbnRlci5cclxuICAgICAgICBpZiAoaW5wdXREcmFnTm9kZUlkICE9PSBudWxsKSB7XHJcbiAgICAgICAgICBjb25zdCBpaCA9IGlucHV0UmVnaXN0cnkuZ2V0KGlucHV0RHJhZ05vZGVJZCk7XHJcbiAgICAgICAgICBpZiAoaWggJiYgaWgub25EcmFnQXQpIHtcclxuICAgICAgICAgICAgY29uc3QgbGF5b3V0ID0gX19nbHl4X2dldExheW91dChpbnB1dERyYWdOb2RlSWQpO1xyXG4gICAgICAgICAgICBpZiAobGF5b3V0KSBpaC5vbkRyYWdBdChldi54IC0gbGF5b3V0LngsIGV2LnkgLSBsYXlvdXQueSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjYXNlICdzY3JvbGwnOiB7XHJcbiAgICAgICAgLy8gUm91dGUgdGhlIHNjcm9sbCBkZWx0YSB0byB0aGUgREVFUEVTVCBTY3JvbGxWaWV3IHRoZSBjdXJzb3IgaXMgb3Zlci5cclxuICAgICAgICAvLyBSZWdpc3RyYXRpb24gb3JkZXIgaXMgdW5yZWxpYWJsZSBmb3IgbmVzdGluZyAoY2hpbGRyZW4gbW91bnQgYmVmb3JlXHJcbiAgICAgICAgLy8gcGFyZW50cywgYW5kIHNpZGUtYnktc2lkZSBwYW5lcyBjYW4gcmUtcmVnaXN0ZXIgaW4gYW55IG9yZGVyKTogYVxyXG4gICAgICAgIC8vIHRhYmxlJ3MgaW5uZXIgbGlzdCBpbnNpZGUgYSBwYWdlIFNjcm9sbFZpZXcgbXVzdCB3aW4gb3ZlciB0aGUgcGFnZS5cclxuICAgICAgICBsZXQgdGFyZ2V0ID0gbnVsbDtcclxuICAgICAgICBsZXQgdGFyZ2V0SGFuZGxlcnMgPSBudWxsO1xyXG4gICAgICAgIGZvciAoY29uc3QgW25vZGVJZCwgaGFuZGxlcnNdIG9mIHNjcm9sbFJlZ2lzdHJ5KSB7XHJcbiAgICAgICAgICBpZiAoIWhpdFRlc3Qobm9kZUlkLCBjdXJzb3JYLCBjdXJzb3JZKSB8fCBpc0Rpc2FibGVkKG5vZGVJZCkpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgaWYgKHRhcmdldCA9PT0gbnVsbCB8fCBpc0FuY2VzdG9yT2YodGFyZ2V0LCBub2RlSWQpKSB7XHJcbiAgICAgICAgICAgIHRhcmdldCA9IG5vZGVJZDtcclxuICAgICAgICAgICAgdGFyZ2V0SGFuZGxlcnMgPSBoYW5kbGVycztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGFyZ2V0SGFuZGxlcnM/Lm9uU2Nyb2xsPy4oZXYuZGVsdGFZKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG5cclxuICAgICAgY2FzZSAnc2Nyb2xsYmFyRHJhZyc6IHtcclxuICAgICAgICAvLyBBYnNvbHV0ZSBzY3JvbGwgcG9zaXRpb24gc2V0IGJ5IHNjcm9sbGJhciB0aHVtYiBkcmFnIFx1MjAxNCByb3V0ZWQgYnlcclxuICAgICAgICAvLyBub2RlIElEIGRpcmVjdGx5IChubyBoaXQtdGVzdCBuZWVkZWQ7IHRoZSB0aHVtYiBpcyBpbnNpZGUgdGhlIGNsaXApLlxyXG4gICAgICAgIGNvbnN0IGhhbmRsZXJzID0gc2Nyb2xsUmVnaXN0cnkuZ2V0KGV2Lm5vZGVJZCk7XHJcbiAgICAgICAgaGFuZGxlcnM/Lm9uQWJzb2x1dGVTY3JvbGw/Lihldi5zY3JvbGxZKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG5cclxuICAgICAgY2FzZSAncmVzaXplJzoge1xyXG4gICAgICAgIGNvbnN0IHNpemUgPSB7IHdpZHRoOiBldi53aWR0aCwgaGVpZ2h0OiBldi5oZWlnaHQgfTtcclxuICAgICAgICBmb3IgKGNvbnN0IGZuIG9mIHdpbmRvd1NpemVMaXN0ZW5lcnMpIGZuKHNpemUpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjYXNlICdzeXN0ZW1XYXRjaCc6IHtcclxuICAgICAgICAvLyBSdXN0LXNpZGUgd2F0Y2hlciBkZXRlY3RlZCBhIGNoYW5nZSAoZGVsdGEtZ2F0ZWQpIFx1MjAxNCBkaXNwYXRjaCB0byB0aGVcclxuICAgICAgICAvLyBzdWJzY3JpYmVyLiAgUGF5bG9hZCBpcyBKU09OIChvciBhIGJhcmUgSlNPTiBzY2FsYXIgZm9yIGRhcmtNb2RlKS5cclxuICAgICAgICBjb25zdCBjYiA9IHN5c3RlbVdhdGNoUmVnaXN0cnkuZ2V0KGV2LmlkKTtcclxuICAgICAgICBpZiAoY2IpIHtcclxuICAgICAgICAgIGxldCB2YWwgPSBudWxsO1xyXG4gICAgICAgICAgdHJ5IHsgdmFsID0gSlNPTi5wYXJzZShldi5wYXlsb2FkKTsgfSBjYXRjaCB7IHZhbCA9IGV2LnBheWxvYWQ7IH1cclxuICAgICAgICAgIHRyeSB7IGNiKHZhbCk7IH0gY2F0Y2ggKGUpIHsgaWYgKHR5cGVvZiBfX2dseXhfbG9nICE9PSAndW5kZWZpbmVkJykgX19nbHl4X2xvZygnW3N5c3RlbS53YXRjaF0gY2FsbGJhY2sgZXJyb3I6ICcgKyBlKTsgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG5cclxuICAgICAgY2FzZSAnaW1hZ2VFcnJvcic6IHtcclxuICAgICAgICBjb25zdCBvbkVycm9yID0gaW1hZ2VFcnJvclJlZ2lzdHJ5LmdldChldi5pbWFnZUlkKTtcclxuICAgICAgICBpZiAob25FcnJvcikgdHJ5IHsgb25FcnJvcih7IHBhdGg6IGV2LnBhdGggfSk7IH0gY2F0Y2gge31cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG5cclxuICAgICAgY2FzZSAnZHJhZ1N0YXJ0Jzoge1xyXG4gICAgICAgIGZvciAoY29uc3QgW25vZGVJZCwgaGFuZGxlcnNdIG9mIGRyYWdSZWdpc3RyeSkge1xyXG4gICAgICAgICAgaWYgKGhpdFRlc3Qobm9kZUlkLCBldi54LCBldi55KSkge1xyXG4gICAgICAgICAgICBpZiAoaXNEaXNhYmxlZChub2RlSWQpKSBicmVhaztcclxuICAgICAgICAgICAgYWN0aXZlRHJhZ0lkID0gbm9kZUlkO1xyXG4gICAgICAgICAgICBoYW5kbGVycy5vbkRyYWdTdGFydD8uKHsgeDogZXYueCwgeTogZXYueSB9KTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjYXNlICdkcmFnTW92ZSc6IHtcclxuICAgICAgICBpZiAoYWN0aXZlRHJhZ0lkICE9PSBudWxsKSB7XHJcbiAgICAgICAgICBjb25zdCBoYW5kbGVycyA9IGRyYWdSZWdpc3RyeS5nZXQoYWN0aXZlRHJhZ0lkKTtcclxuICAgICAgICAgIGhhbmRsZXJzPy5vbkRyYWdNb3ZlPy4oeyB4OiBldi54LCB5OiBldi55LCBkeDogZXYuZHgsIGR5OiBldi5keSB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNhc2UgJ2RyYWdFbmQnOiB7XHJcbiAgICAgICAgaWYgKGFjdGl2ZURyYWdJZCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgY29uc3QgaGFuZGxlcnMgPSBkcmFnUmVnaXN0cnkuZ2V0KGFjdGl2ZURyYWdJZCk7XHJcbiAgICAgICAgICBoYW5kbGVycz8ub25EcmFnRW5kPy4oeyB4OiBldi54LCB5OiBldi55IH0pO1xyXG4gICAgICAgICAgYWN0aXZlRHJhZ0lkID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBcdTI1MDBcdTI1MDAgSG92ZXIgc3RhdGUgdXBkYXRlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG4gIC8vIFJ1biBvbmNlIHBlciBmcmFtZSB1c2luZyB0aGUgZmluYWwgY3Vyc29yIHBvc2l0aW9uLlxyXG4gIC8vIE9ubHkgZmlyZXMgb25Ib3ZlckluL091dCBjYWxsYmFja3Mgb24gYWN0dWFsIGVudGVyL2xlYXZlIHRyYW5zaXRpb25zLlxyXG4gIC8vIFVzZXMgZmluZFRvcG1vc3RTb2xpZCBzbyB0aGF0IHZpZXdzIGJlbmVhdGggYSBjb3ZlcmluZyBzb2xpZCBub2RlIG5ldmVyXHJcbiAgLy8gcmVjZWl2ZSBob3ZlciBlZmZlY3RzLCBhbmQgcGxhaW4gVmlld3MgKG5vdCBpbiBwcmVzc2FibGVSZWdpc3RyeSkgYXJlXHJcbiAgLy8gdHJlYXRlZCBhcyBob3Zlci1vcGFxdWUgKG5vIGVmZmVjdCBmaXJlcyBvbiB0aGVtKS5cclxuICBpZiAoY3Vyc29yTW92ZWRUaGlzRnJhbWUpIHtcclxuICAgIGNvbnN0IHRvcFNvbGlkID0gZmluZFRvcG1vc3RTb2xpZChjdXJzb3JYLCBjdXJzb3JZKTtcclxuICAgIC8vIFdhbGsgdXAgdG8gZmluZCB0aGUgbmVhcmVzdCBwcmVzc2FibGUgYW5jZXN0b3IgKHNhbWUgYnViYmxpbmcgbG9naWMgYXMgY2xpY2spLlxyXG4gICAgbGV0IGhvdmVySWQgPSB0b3BTb2xpZDtcclxuICAgIHdoaWxlIChob3ZlcklkICE9PSB1bmRlZmluZWQgJiYgIXByZXNzYWJsZVJlZ2lzdHJ5Lmhhcyhob3ZlcklkKSkge1xyXG4gICAgICBob3ZlcklkID0gcGFyZW50TWFwLmdldChob3ZlcklkKTtcclxuICAgIH1cclxuICAgIGNvbnN0IG5ld0hvdmVyZWRJZCA9IChob3ZlcklkICE9PSB1bmRlZmluZWQgJiYgIWlzRGlzYWJsZWQoaG92ZXJJZCkpID8gaG92ZXJJZCA6IG51bGw7XHJcblxyXG4gICAgaWYgKG5ld0hvdmVyZWRJZCAhPT0gaG92ZXJlZFByZXNzYWJsZUlkKSB7XHJcbiAgICAgIGlmIChob3ZlcmVkUHJlc3NhYmxlSWQgIT09IG51bGwpIHtcclxuICAgICAgICBwcmVzc2FibGVSZWdpc3RyeS5nZXQoaG92ZXJlZFByZXNzYWJsZUlkKT8ub25Ib3Zlck91dD8uKCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKG5ld0hvdmVyZWRJZCAhPT0gbnVsbCkge1xyXG4gICAgICAgIHByZXNzYWJsZVJlZ2lzdHJ5LmdldChuZXdIb3ZlcmVkSWQpPy5vbkhvdmVySW4/LigpO1xyXG4gICAgICB9XHJcbiAgICAgIGhvdmVyZWRQcmVzc2FibGVJZCA9IG5ld0hvdmVyZWRJZDtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIiwgIi8vIEBnbHl4LWRldi9yZWFjdCBcdTIwMTQgbmF0aXZlIEFQSSBiaW5kaW5ncyBhbmQgZnJhbWUgcG9sbCBzdGF0ZS5cbmltcG9ydCB7IGFkZEtleUxpc3RlbmVyLCByZWdpc3RlclN5c3RlbVdhdGNoLCB1bnJlZ2lzdGVyU3lzdGVtV2F0Y2ggfSBmcm9tICcuL2V2ZW50cy5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMCBXZWJTb2NrZXQgaW5ib3ggcG9sbGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBPcGVuIHNvY2tldHM6IGlkIChudW1iZXIpIFx1MjE5MiB7IG9ubWVzc2FnZSwgb25jbG9zZSwgb25lcnJvciB9XG5leHBvcnQgY29uc3QgX3dzT3BlblNvY2tldHMgPSBuZXcgTWFwKCk7XG5cbi8vIFx1MjUwMFx1MjUwMCBJUEMgaW5ib3ggcG9sbGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBDYWxsYmFja3MgcmVnaXN0ZXJlZCB2aWEgaXBjLm9uKCdtZXNzYWdlJywgY2IpLlxuZXhwb3J0IGNvbnN0IF9pcGNMaXN0ZW5lcnMgPSBbXTtcblxuLy8gXHUyNTAwXHUyNTAwIERlZXAgbGluayBwb2xsaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIEZvcndhcmRlZCBVUkxzIGFycml2ZSBlYWNoIGZyYW1lIHZpYSBfX2dseXhfZGVlcGxpbmtfcG9sbCgpLlxuLy8gVGhlIGluaXRpYWwgbGF1bmNoIFVSTCBpcyByZXRyaWV2ZWQgb25jZSBvbiBzdGFydHVwIHZpYSBfX2dseXhfZGVlcGxpbmtfZ2V0SW5pdGlhbFVybCgpLlxuXG5leHBvcnQgY29uc3QgX2RlZXBsaW5rQ2FsbGJhY2tzID0gW107XG5leHBvcnQgbGV0ICAgX2RlZXBsaW5rSW5pdGlhbEZpcmVkID0gZmFsc2U7XG5cbmV4cG9ydCBmdW5jdGlvbiBfcG9sbERlZXBsaW5rcygpIHtcbiAgLy8gRmlyZSBpbml0aWFsIFVSTCBvbmNlICh0aGUgVVJMIHRoYXQgbGF1bmNoZWQgdGhpcyBpbnN0YW5jZSBvZiB0aGUgYXBwKS5cbiAgaWYgKCFfZGVlcGxpbmtJbml0aWFsRmlyZWQgJiYgX2RlZXBsaW5rQ2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICBfZGVlcGxpbmtJbml0aWFsRmlyZWQgPSB0cnVlO1xuICAgIGlmICh0eXBlb2YgX19nbHl4X2RlZXBsaW5rX2dldEluaXRpYWxVcmwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1cmwgPSBfX2dseXhfZGVlcGxpbmtfZ2V0SW5pdGlhbFVybCgpO1xuICAgICAgICBpZiAodXJsKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBjYiBvZiBfZGVlcGxpbmtDYWxsYmFja3MpIHtcbiAgICAgICAgICAgIHRyeSB7IGNiKHVybCk7IH0gY2F0Y2ggKGUpIHsgX19nbHl4X2xvZygnW2RlZXBsaW5rXSBjYWxsYmFjayBlcnJvcjogJyArIGUpOyB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuICB9XG5cbiAgLy8gRHJhaW4gZm9yd2FyZGVkIFVSTHMgZnJvbSB0aGUgc2luZ2xlLWluc3RhbmNlIGxpc3RlbmVyIHF1ZXVlLlxuICBpZiAodHlwZW9mIF9fZ2x5eF9kZWVwbGlua19wb2xsID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICBsZXQgcmF3O1xuICB0cnkgeyByYXcgPSBfX2dseXhfZGVlcGxpbmtfcG9sbCgpOyB9IGNhdGNoIHsgcmV0dXJuOyB9XG4gIGlmICghcmF3IHx8IHJhdyA9PT0gJ1tdJykgcmV0dXJuO1xuICBsZXQgdXJscztcbiAgdHJ5IHsgdXJscyA9IEpTT04ucGFyc2UocmF3KTsgfSBjYXRjaCB7IHJldHVybjsgfVxuICBmb3IgKGNvbnN0IHVybCBvZiB1cmxzKSB7XG4gICAgZm9yIChjb25zdCBjYiBvZiBfZGVlcGxpbmtDYWxsYmFja3MpIHtcbiAgICAgIHRyeSB7IGNiKHVybCk7IH0gY2F0Y2ggKGUpIHsgX19nbHl4X2xvZygnW2RlZXBsaW5rXSBjYWxsYmFjayBlcnJvcjogJyArIGUpOyB9XG4gICAgfVxuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBHbG9iYWwgc2hvcnRjdXQgcG9sbGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBDYWxsYmFja3MgcmVnaXN0ZXJlZCB2aWEgaW5wdXQuZ2xvYmFsU2hvcnRjdXQucmVnaXN0ZXIoYWNjLCBjYikuXG5leHBvcnQgY29uc3QgX2dsb2JhbFNob3J0Y3V0Q2FsbGJhY2tzID0gbmV3IE1hcCgpOyAgLy8gaWQgKG51bWJlcikgXHUyMTkyIGNiXG5cbmV4cG9ydCBmdW5jdGlvbiBfcG9sbEdsb2JhbFNob3J0Y3V0cygpIHtcbiAgaWYgKHR5cGVvZiBfX2dseXhfc2hvcnRjdXRfcG9sbCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKF9nbG9iYWxTaG9ydGN1dENhbGxiYWNrcy5zaXplID09PSAwKSByZXR1cm47XG4gIGxldCByYXc7XG4gIHRyeSB7IHJhdyA9IF9fZ2x5eF9zaG9ydGN1dF9wb2xsKCk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgaWYgKCFyYXcgfHwgcmF3ID09PSAnW10nKSByZXR1cm47XG4gIGxldCBpZHM7XG4gIHRyeSB7IGlkcyA9IEpTT04ucGFyc2UocmF3KTsgfSBjYXRjaCB7IHJldHVybjsgfVxuICBmb3IgKGNvbnN0IGlkIG9mIGlkcykge1xuICAgIGNvbnN0IGNiID0gX2dsb2JhbFNob3J0Y3V0Q2FsbGJhY2tzLmdldChpZCk7XG4gICAgaWYgKGNiKSB0cnkgeyBjYigpOyB9IGNhdGNoIChlKSB7IF9fZ2x5eF9sb2coJ1tzaG9ydGN1dF0gY2FsbGJhY2sgZXJyb3I6ICcgKyBlKTsgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfcG9sbEdhbWVwYWRzKCkge1xuICBpZiAodHlwZW9mIF9fZ2x5eF9nYW1lcGFkX3BvbGwgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmICghZ2xvYmFsVGhpcy5fZ2FtZXBhZENhbGxiYWNrcyB8fCBnbG9iYWxUaGlzLl9nYW1lcGFkQ2FsbGJhY2tzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICBsZXQgcmF3O1xuICB0cnkgeyByYXcgPSBfX2dseXhfZ2FtZXBhZF9wb2xsKCk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgaWYgKCFyYXcgfHwgcmF3ID09PSAnW10nKSByZXR1cm47XG4gIGxldCBldnM7XG4gIHRyeSB7IGV2cyA9IEpTT04ucGFyc2UocmF3KTsgfSBjYXRjaCB7IHJldHVybjsgfVxuICBmb3IgKGNvbnN0IGV2IG9mIGV2cykge1xuICAgIGZvciAoY29uc3QgY2Igb2YgZ2xvYmFsVGhpcy5fZ2FtZXBhZENhbGxiYWNrcykge1xuICAgICAgdHJ5IHsgY2IoZXYpOyB9IGNhdGNoIChlKSB7IF9fZ2x5eF9sb2coJ1tnYW1lcGFkXSBjYWxsYmFjayBlcnJvcjogJyArIGUpOyB9XG4gICAgfVxuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBBcHAtZm9jdXNlZCBzaG9ydGN1dCByZWdpc3RyeSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBLZXllZCBieSBpZDsgZW50cmllcyBhcmUgeyBtb2RzOiB7Y3RybCxzaGlmdCxhbHQsbWV0YX0sIGtleTogc3RyaW5nLCBjYiB9LlxuLy8gRGlzcGF0Y2hlZCB2aWEgYWRkS2V5TGlzdGVuZXIgcmVnaXN0ZXJlZCBiZWxvdy5cbmV4cG9ydCBjb25zdCBfbG9jYWxTaG9ydGN1dHMgPSBuZXcgTWFwKCk7ICAvLyBpZCBcdTIxOTIgeyBtb2RzLCBrZXksIGNiIH1cbmV4cG9ydCBsZXQgICBfbG9jYWxTaG9ydGN1dE5leHRJZCA9IDE7XG5cbi8vIE5vcm1hbGl6ZSBhIHdpbml0IHBoeXNpY2FsIGtleSBuYW1lIHRvIHRoZSBzaG9ydGN1dCB0b2tlbiBhIHVzZXIgd291bGQgdHlwZS5cbi8vIHdpbml0IHNlbmRzIEtleUNvZGU6OkRlYnVnIG5hbWVzOiAnS2V5RycgXHUyMTkyICdnJywgJ0RpZ2l0MScgXHUyMTkyICcxJywgJ1NwYWNlJyBcdTIxOTIgJ3NwYWNlJy5cbmZ1bmN0aW9uIF9ub3JtYWxpemVLZXkod2luaXRLZXkpIHtcbiAgaWYgKC9eS2V5W0EtWl0kLy50ZXN0KHdpbml0S2V5KSkgICByZXR1cm4gd2luaXRLZXlbM10udG9Mb3dlckNhc2UoKTsgIC8vIEtleUcgXHUyMTkyIGdcbiAgaWYgKC9eRGlnaXRcXGQkLy50ZXN0KHdpbml0S2V5KSkgICAgcmV0dXJuIHdpbml0S2V5WzVdOyAgICAgICAgICAgICAgICAgLy8gRGlnaXQxIFx1MjE5MiAxXG4gIHJldHVybiB3aW5pdEtleS50b0xvd2VyQ2FzZSgpOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNwYWNlIFx1MjE5MiBzcGFjZSwgRjEgXHUyMTkyIGYxXG59XG5cbi8vIExpc3RlbiB0byBldmVyeSBrZXkgZXZlbnQgZnJvbSBldmVudHMuanMgYW5kIGNoZWNrIGxvY2FsIHNob3J0Y3V0cy5cbmFkZEtleUxpc3RlbmVyKGZ1bmN0aW9uIF9kaXNwYXRjaExvY2FsU2hvcnRjdXRzKHsga2V5LCBjdHJsLCBzaGlmdCwgcHJlc3NlZCB9KSB7XG4gIGlmICghcHJlc3NlZCB8fCBfbG9jYWxTaG9ydGN1dHMuc2l6ZSA9PT0gMCkgcmV0dXJuO1xuICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUtleShrZXkpO1xuICBmb3IgKGNvbnN0IHsgbW9kcywga2V5OiBzS2V5LCBjYiB9IG9mIF9sb2NhbFNob3J0Y3V0cy52YWx1ZXMoKSkge1xuICAgIGlmIChzS2V5ID09PSBub3JtICYmIG1vZHMuY3RybCA9PT0gY3RybCAmJiBtb2RzLnNoaWZ0ID09PSBzaGlmdCkge1xuICAgICAgdHJ5IHsgY2IoKTsgfSBjYXRjaCAoZSkgeyBfX2dseXhfbG9nKCdbc2hvcnRjdXRdIGxvY2FsIGNhbGxiYWNrIGVycm9yOiAnICsgZSk7IH1cbiAgICB9XG4gIH1cbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgUGVyZiB2aW9sYXRpb24gKyBsZWFrIHBvbGxpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBjb25zdCBfcGVyZkJ1ZGdldENhbGxiYWNrcyA9IFtdO1xuZXhwb3J0IGNvbnN0IF9wZXJmTGVha0NhbGxiYWNrcyAgID0gW107XG5cbmV4cG9ydCBmdW5jdGlvbiBfcG9sbFBlcmZWaW9sYXRpb25zKCkge1xuICBpZiAodHlwZW9mIF9fZ2x5eF9wZXJmX3BvbGxfdmlvbGF0aW9ucyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKF9wZXJmQnVkZ2V0Q2FsbGJhY2tzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICBsZXQgcmF3O1xuICB0cnkgeyByYXcgPSBfX2dseXhfcGVyZl9wb2xsX3Zpb2xhdGlvbnMoKTsgfSBjYXRjaCB7IHJldHVybjsgfVxuICBpZiAoIXJhdyB8fCByYXcgPT09ICdbXScpIHJldHVybjtcbiAgbGV0IHZpb2xhdGlvbnM7XG4gIHRyeSB7IHZpb2xhdGlvbnMgPSBKU09OLnBhcnNlKHJhdyk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgZm9yIChjb25zdCB2IG9mIHZpb2xhdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IGNiIG9mIF9wZXJmQnVkZ2V0Q2FsbGJhY2tzKSB7XG4gICAgICB0cnkgeyBjYih2KTsgfSBjYXRjaCAoZSkgeyBfX2dseXhfbG9nKCdbcGVyZl0gb25CdWRnZXRFeGNlZWRlZCBjYWxsYmFjayBlcnJvcjogJyArIGUpOyB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfcG9sbExlYWtXYXJuaW5ncygpIHtcbiAgaWYgKHR5cGVvZiBfX2dseXhfcGVyZl9wb2xsX2xlYWtfd2FybmluZ3MgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChfcGVyZkxlYWtDYWxsYmFja3MubGVuZ3RoID09PSAwKSByZXR1cm47XG4gIGxldCByYXc7XG4gIHRyeSB7IHJhdyA9IF9fZ2x5eF9wZXJmX3BvbGxfbGVha193YXJuaW5ncygpOyB9IGNhdGNoIHsgcmV0dXJuOyB9XG4gIGlmICghcmF3IHx8IHJhdyA9PT0gJ1tdJykgcmV0dXJuO1xuICBsZXQgd2FybmluZ3M7XG4gIHRyeSB7IHdhcm5pbmdzID0gSlNPTi5wYXJzZShyYXcpOyB9IGNhdGNoIHsgcmV0dXJuOyB9XG4gIGZvciAoY29uc3QgdyBvZiB3YXJuaW5ncykge1xuICAgIGZvciAoY29uc3QgY2Igb2YgX3BlcmZMZWFrQ2FsbGJhY2tzKSB7XG4gICAgICB0cnkgeyBjYih3KTsgfSBjYXRjaCAoZSkgeyBfX2dseXhfbG9nKCdbcGVyZl0gb25MZWFrRGV0ZWN0ZWQgY2FsbGJhY2sgZXJyb3I6ICcgKyBlKTsgfVxuICAgIH1cbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgQXVkaW8gZXZlbnQgcG9sbGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBEcmFpbnMgYF9fZ2x5eF9hdWRpb19wb2xsKClgIGVhY2ggZnJhbWUgYW5kIGZpcmVzIHJlZ2lzdGVyZWQgb25FbmRlZCBjYWxsYmFja3MuXG4vLyBNYXA6IGhhbmRsZSAoc3RyaW5nKSBcdTIxOTIgYXJyYXkgb2YgeyBvbkVuZGVkIH0gb2JqZWN0cy5cblxuZXhwb3J0IGNvbnN0IF9hdWRpb0NhbGxiYWNrcyA9IG5ldyBNYXAoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIF9wb2xsQXVkaW8oKSB7XG4gIGlmICh0eXBlb2YgX19nbHl4X2F1ZGlvX3BvbGwgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGxldCByYXc7XG4gIHRyeSB7IHJhdyA9IF9fZ2x5eF9hdWRpb19wb2xsKCk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgaWYgKCFyYXcgfHwgcmF3ID09PSAnW10nKSByZXR1cm47XG4gIGxldCBldmVudHM7XG4gIHRyeSB7IGV2ZW50cyA9IEpTT04ucGFyc2UocmF3KTsgfSBjYXRjaCB7IHJldHVybjsgfVxuICBmb3IgKGNvbnN0IGV2IG9mIGV2ZW50cykge1xuICAgIGNvbnN0IGtleSA9IFN0cmluZyhldi5oYW5kbGUpO1xuICAgIGNvbnN0IGNicyA9IF9hdWRpb0NhbGxiYWNrcy5nZXQoa2V5KTtcbiAgICBpZiAoY2JzKSB7XG4gICAgICBmb3IgKGNvbnN0IGNiIG9mIGNicykge1xuICAgICAgICBpZiAoZXYuZXZlbnQgPT09ICdlbmRlZCcgJiYgY2Iub25FbmRlZCkge1xuICAgICAgICAgIHRyeSB7IGNiLm9uRW5kZWQoKTsgfSBjYXRjaCAoZSkgeyBfX2dseXhfbG9nKCdbYXVkaW9dIG9uRW5kZWQgZXJyb3I6ICcgKyBlKTsgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZXYuZXZlbnQgPT09ICdlbmRlZCcpIF9hdWRpb0NhbGxiYWNrcy5kZWxldGUoa2V5KTtcbiAgICB9XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEZpbGUgc3lzdGVtIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBBbGwgbWV0aG9kcyByZXR1cm4gUHJvbWlzZXMuIFJlcXVpcmVzIGBmcy5yZWFkYCAvIGBmcy53cml0ZWAgY2FwYWJpbGl0aWVzXG4vLyBkZWNsYXJlZCBpbiBgZ2x5eC5jb25maWcuanNvbmAuIEF0dGVtcHRpbmcgdG8gY2FsbCB3aXRob3V0IHRoZSBjYXBhYmlsaXR5XG4vLyByZWplY3RzIHRoZSBQcm9taXNlIHdpdGggYSBkZXNjcmlwdGl2ZSBlcnJvci5cbi8vXG4vLyBVc2FnZTpcbi8vICAgaW1wb3J0IHsgZnMgfSBmcm9tICdAZ2x5eC1kZXYvcmVhY3QnO1xuLy8gICBhd2FpdCBmcy53cml0ZUZpbGUoJ2RhdGEvbm90ZXMudHh0JywgJ2hlbGxvJyk7XG4vLyAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5saXN0RGlyKCdkYXRhLycpOyAgLy8gW3sgbmFtZSwgaXNEaXIgfSwgLi4uXVxuXG5jb25zdCBfbm9CaW5kaW5nID0gKG5hbWUpID0+IFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihgJHtuYW1lfTogYmluZGluZyBub3QgYXZhaWxhYmxlYCkpO1xuXG5leHBvcnQgY29uc3QgZnMgPSB7XG4gIC8qKiBSZWFkIHRoZSBlbnRpcmUgZmlsZSBhcyBhIFVURi04IHN0cmluZy4gUmVxdWlyZXMgYGZzLnJlYWRgLiAqL1xuICByZWFkRmlsZTogICAocGF0aCkgICAgICAgICAgPT4gdHlwZW9mIF9fZ2x5eF9yZWFkRmlsZSAgICAgICE9PSAndW5kZWZpbmVkJyA/IF9fZ2x5eF9yZWFkRmlsZShwYXRoKSAgICAgICAgICA6IF9ub0JpbmRpbmcoJ3JlYWRGaWxlJyksXG4gIC8qKlxuICAgKiBSZWFkIHRoZSBlbnRpcmUgZmlsZSBhcyByYXcgYnl0ZXMsIHJldHVybmVkIGFzIGEgYmFzZTY0LWVuY29kZWQgc3RyaW5nLlxuICAgKiBVc2UgdGhpcyBmb3IgYmluYXJ5IGZpbGVzIChpbWFnZXMsIFBERnMsIGV0Yy4pIGJlZm9yZSB1cGxvYWRpbmcgdmlhIGZldGNoIG11bHRpcGFydC5cbiAgICogUmVxdWlyZXMgYGZzLnJlYWRgLlxuICAgKi9cbiAgcmVhZEZpbGVCeXRlczogKHBhdGgpICAgICAgID0+IHR5cGVvZiBfX2dseXhfcmVhZEZpbGVCeXRlcyAhPT0gJ3VuZGVmaW5lZCcgPyBfX2dseXhfcmVhZEZpbGVCeXRlcyhwYXRoKSAgICAgOiBfbm9CaW5kaW5nKCdyZWFkRmlsZUJ5dGVzJyksXG4gIC8qKiBXcml0ZSAob3ZlcndyaXRlKSBhIGZpbGUgd2l0aCB0aGUgZ2l2ZW4gc3RyaW5nIGNvbnRlbnQuIFJlcXVpcmVzIGBmcy53cml0ZWAuICovXG4gIHdyaXRlRmlsZTogIChwYXRoLCBjb250ZW50KSA9PiB0eXBlb2YgX19nbHl4X3dyaXRlRmlsZSAgIT09ICd1bmRlZmluZWQnID8gX19nbHl4X3dyaXRlRmlsZShwYXRoLCBjb250ZW50KSA6IF9ub0JpbmRpbmcoJ3dyaXRlRmlsZScpLFxuICAvKiogQXBwZW5kIHN0cmluZyBjb250ZW50IHRvIGEgZmlsZSAoY3JlYXRlcyBpdCBpZiBtaXNzaW5nKS4gUmVxdWlyZXMgYGZzLndyaXRlYC4gKi9cbiAgYXBwZW5kRmlsZTogKHBhdGgsIGNvbnRlbnQpID0+IHR5cGVvZiBfX2dseXhfYXBwZW5kRmlsZSAhPT0gJ3VuZGVmaW5lZCcgPyBfX2dseXhfYXBwZW5kRmlsZShwYXRoLCBjb250ZW50KTogX25vQmluZGluZygnYXBwZW5kRmlsZScpLFxuICAvKiogTGlzdCBkaXJlY3RvcnkgZW50cmllcy4gUmVzb2x2ZXMgd2l0aCBgW3sgbmFtZTogc3RyaW5nLCBpc0RpcjogYm9vbGVhbiB9XWAuIFJlcXVpcmVzIGBmcy5yZWFkYC4gKi9cbiAgbGlzdERpcjogICAgKHBhdGgpICAgICAgICAgID0+IHR5cGVvZiBfX2dseXhfbGlzdERpciAgICAhPT0gJ3VuZGVmaW5lZCcgPyBfX2dseXhfbGlzdERpcihwYXRoKS50aGVuKEpTT04ucGFyc2UpICAgOiBfbm9CaW5kaW5nKCdsaXN0RGlyJyksXG4gIC8qKiBEZWxldGUgYSBmaWxlLiBSZXF1aXJlcyBgZnMud3JpdGVgLiAqL1xuICBkZWxldGVGaWxlOiAocGF0aCkgICAgICAgICAgPT4gdHlwZW9mIF9fZ2x5eF9kZWxldGVGaWxlICE9PSAndW5kZWZpbmVkJyA/IF9fZ2x5eF9kZWxldGVGaWxlKHBhdGgpICAgICAgICAgOiBfbm9CaW5kaW5nKCdkZWxldGVGaWxlJyksXG4gIC8qKiBDcmVhdGUgYSBkaXJlY3RvcnkgYW5kIGFsbCBtaXNzaW5nIHBhcmVudHMuIFJlcXVpcmVzIGBmcy53cml0ZWAuICovXG4gIG1rZGlycDogICAgIChwYXRoKSAgICAgICAgICA9PiB0eXBlb2YgX19nbHl4X21rZGlycCAgICAgIT09ICd1bmRlZmluZWQnID8gX19nbHl4X21rZGlycChwYXRoKSAgICAgICAgICAgICA6IF9ub0JpbmRpbmcoJ21rZGlycCcpLFxuICAvKiogU3RhdCBhIGZpbGUgb3IgZGlyZWN0b3J5LiBSZXNvbHZlcyB3aXRoIGB7IHNpemUsIG10aW1lLCBpc0RpciwgaXNGaWxlIH1gLiBSZXF1aXJlcyBgZnMucmVhZGAuICovXG4gIHN0YXQ6ICAgICAgIChwYXRoKSAgICAgICAgICA9PiB0eXBlb2YgX19nbHl4X3N0YXQgICAgICAgIT09ICd1bmRlZmluZWQnID8gX19nbHl4X3N0YXQocGF0aCkudGhlbihKU09OLnBhcnNlKSAgIDogX25vQmluZGluZygnc3RhdCcpLFxuICAvKiogUmVuYW1lIChtb3ZlKSBhIGZpbGUuIFJlcXVpcmVzIGBmcy5yZWFkYCBvbiBzcmMgYW5kIGBmcy53cml0ZWAgb24gZHN0LiAqL1xuICByZW5hbWU6ICAgICAoc3JjLCBkc3QpICAgICAgPT4gdHlwZW9mIF9fZ2x5eF9yZW5hbWUgICAgICE9PSAndW5kZWZpbmVkJyA/IF9fZ2x5eF9yZW5hbWUoc3JjLCBkc3QpICAgICAgICAgOiBfbm9CaW5kaW5nKCdyZW5hbWUnKSxcbiAgLyoqIENvcHkgYSBmaWxlLiBSZXF1aXJlcyBgZnMucmVhZGAgb24gc3JjIGFuZCBgZnMud3JpdGVgIG9uIGRzdC4gKi9cbiAgY29weTogICAgICAgKHNyYywgZHN0KSAgICAgID0+IHR5cGVvZiBfX2dseXhfY29weUZpbGUgICAhPT0gJ3VuZGVmaW5lZCcgPyBfX2dseXhfY29weUZpbGUoc3JjLCBkc3QpICAgICAgIDogX25vQmluZGluZygnY29weScpLFxuICAvKiogUmVhZCBhIGZpbGUgYXMgVVRGLTggYW5kIHBhcnNlIGFzIEpTT04uIFJlcXVpcmVzIGBmcy5yZWFkYC4gKi9cbiAgcmVhZEpTT046ICAgYXN5bmMgKHBhdGgpICAgICAgICAgID0+IEpTT04ucGFyc2UoYXdhaXQgZnMucmVhZEZpbGUocGF0aCkpLFxuICAvKiogU2VyaWFsaXplIGB2YWx1ZWAgdG8gSlNPTiBhbmQgd3JpdGUgdG8gYSBmaWxlLiBSZXF1aXJlcyBgZnMud3JpdGVgLiAqL1xuICB3cml0ZUpTT046ICBhc3luYyAocGF0aCwgdmFsLCBpbmRlbnQgPSAyKSA9PiBmcy53cml0ZUZpbGUocGF0aCwgSlNPTi5zdHJpbmdpZnkodmFsLCBudWxsLCBpbmRlbnQpKSxcbiAgLyoqXG4gICAqIFdhdGNoIGBwYXRoYCBmb3IgY2hhbmdlcy4gYGNhbGxiYWNrYCBpcyBjYWxsZWQgd2l0aCBgeyBwYXRoLCB0eXBlIH1gIG9uIGVhY2ggZXZlbnQuXG4gICAqIGB0eXBlYCBpcyBvbmUgb2YgYFwibW9kaWZpZWRcImAsIGBcImNyZWF0ZWRcImAsIGBcInJlbW92ZWRcImAsIGBcImFjY2Vzc2VkXCJgLCBgXCJvdGhlclwiYC5cbiAgICogUmV0dXJucyBhIFByb21pc2U8d2F0Y2hJZD4gXHUyMDE0IHBhc3MgdGhlIGlkIHRvIGBmcy51bndhdGNoKClgIHRvIHN0b3Agd2F0Y2hpbmcuXG4gICAqIFJlcXVpcmVzIGBmcy5yZWFkYCBjYXBhYmlsaXR5LlxuICAgKi9cbiAgd2F0Y2g6IGFzeW5jIChwYXRoLCBjYWxsYmFjaykgPT4ge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X2ZzX3dhdGNoID09PSAndW5kZWZpbmVkJykgcmV0dXJuIF9ub0JpbmRpbmcoJ2ZzLndhdGNoJyk7XG4gICAgY29uc3QgaWQgPSBhd2FpdCBfX2dseXhfZnNfd2F0Y2gocGF0aCk7XG4gICAgX2ZzV2F0Y2hDYWxsYmFja3Muc2V0KGlkLCBjYWxsYmFjayk7XG4gICAgcmV0dXJuIGlkO1xuICB9LFxuICAvKiogU3RvcCB3YXRjaGluZyB0aGUgZ2l2ZW4gd2F0Y2hJZCAocmV0dXJuZWQgZnJvbSBgZnMud2F0Y2hgKS4gKi9cbiAgdW53YXRjaDogKGlkKSA9PiB7XG4gICAgX2ZzV2F0Y2hDYWxsYmFja3MuZGVsZXRlKGlkKTtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9mc191bndhdGNoICE9PSAndW5kZWZpbmVkJykgX19nbHl4X2ZzX3Vud2F0Y2goaWQpO1xuICB9LFxufTtcblxuY29uc3QgX2ZzV2F0Y2hDYWxsYmFja3MgPSBuZXcgTWFwKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBfcG9sbEZzV2F0Y2goKSB7XG4gIGlmICh0eXBlb2YgX19nbHl4X2ZzX3dhdGNoX3BvbGwgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGNvbnN0IHJhdyA9IF9fZ2x5eF9mc193YXRjaF9wb2xsKCk7XG4gIGlmICghcmF3IHx8IHJhdyA9PT0gJ1tdJykgcmV0dXJuO1xuICBsZXQgZXZlbnRzO1xuICB0cnkgeyBldmVudHMgPSBKU09OLnBhcnNlKHJhdyk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgZm9yIChjb25zdCBldiBvZiBldmVudHMpIHtcbiAgICBjb25zdCBjYiA9IF9mc1dhdGNoQ2FsbGJhY2tzLmdldChldi5pZCk7XG4gICAgaWYgKGNiKSBjYih7IHBhdGg6IGV2LnBhdGgsIHR5cGU6IGV2LnR5cGUgfSk7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFNRTGl0ZSBkYXRhYmFzZSBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gVGhpbiBhc3luYyB3cmFwcGVyIG92ZXIgdGhlIFJ1c3QgYHNxbHhgIGJpbmRpbmdzLiBSZXF1aXJlcyBgZGI6IHRydWVgIGluXG4vLyBgZ2x5eC5jb25maWcuanNvbmAuXG4vL1xuLy8gVXNhZ2U6XG4vLyAgIGltcG9ydCB7IGRiIH0gZnJvbSAnQGdseXgtZGV2L3JlYWN0Jztcbi8vICAgY29uc3QgaGFuZGxlID0gYXdhaXQgZGIub3BlbignYXBwLmRiJyk7XG4vLyAgIGF3YWl0IGRiLnJ1bihoYW5kbGUsICdDUkVBVEUgVEFCTEUgSUYgTk9UIEVYSVNUUyBpdGVtcyAoaWQgSU5URUdFUiBQUklNQVJZIEtFWSwgbmFtZSBURVhUKScpO1xuLy8gICBhd2FpdCBkYi5ydW4oaGFuZGxlLCAnSU5TRVJUIElOVE8gaXRlbXMgKG5hbWUpIFZBTFVFUyAoPyknLCBbJ2hlbGxvJ10pO1xuLy8gICBjb25zdCByb3dzID0gYXdhaXQgZGIucXVlcnkoaGFuZGxlLCAnU0VMRUNUICogRlJPTSBpdGVtcycpOyAgLy8gW3sgaWQsIG5hbWUgfSwgLi4uXVxuXG4vLyBcdTI1MDBcdTI1MDAgU1FMaXRlIGRlZmF1bHQtaGFuZGxlIHN0YXRlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIGBfZGVmYXVsdEhhbmRsZWAgaXMgc2V0IGF1dG9tYXRpY2FsbHkgd2hlbiB0aGUgZmlyc3QgZGIub3BlbigpIHJlc29sdmVzLlxuLy8gVGhpcyBsZXRzIHNpbmdsZS1kYiBhcHBzIHNraXAgcGFzc2luZyB0aGUgaGFuZGxlIG9uIGV2ZXJ5IGNhbGw6XG4vL1xuLy8gICBTaW5nbGUtREIgKHNpbXBsZSk6XG4vLyAgICAgYXdhaXQgZGIub3BlbignYXBwLmRiJyk7XG4vLyAgICAgYXdhaXQgZGIucnVuKCdJTlNFUlQgSU5UTyBpdGVtcyAobmFtZSkgVkFMVUVTICg/KScsIFsnaGVsbG8nXSk7XG4vLyAgICAgY29uc3Qgcm93cyA9IGF3YWl0IGRiLnF1ZXJ5KCdTRUxFQ1QgKiBGUk9NIGl0ZW1zJyk7XG4vL1xuLy8gICBNdWx0aS1EQiAoZXhwbGljaXQgaGFuZGxlKTpcbi8vICAgICBjb25zdCBoMSA9IGF3YWl0IGRiLm9wZW4oJ3VzZXJzLmRiJyk7XG4vLyAgICAgY29uc3QgaDIgPSBhd2FpdCBkYi5vcGVuKCdsb2dzLmRiJyk7XG4vLyAgICAgZGIuc2V0RGVmYXVsdChoMik7XG4vLyAgICAgYXdhaXQgZGIucnVuKGgxLCAnSU5TRVJUIElOVE8gdXNlcnMgLi4uJywgW10pOyAgIC8vIGV4cGxpY2l0XG4vLyAgICAgYXdhaXQgZGIucnVuKCdJTlNFUlQgSU5UTyBsb2dzIC4uLicsIFtdKTsgICAgICAgICAvLyB1c2VzIGRlZmF1bHQgKGgyKVxuXG5sZXQgX2RlZmF1bHRIYW5kbGUgPSBudWxsO1xuY29uc3QgX2RiQmFja3VwVGltZXJzID0gbmV3IE1hcCgpOyAvLyBoYW5kbGUgXHUyMTkyIGludGVydmFsSWRcblxuZnVuY3Rpb24gX3BhcnNlSW50ZXJ2YWwocykge1xuICBjb25zdCBtYXAgPSB7ICcxaCc6IDM2MDAwMDAsICc2aCc6IDIxNjAwMDAwLCAnMTJoJzogNDMyMDAwMDAsICcyNGgnOiA4NjQwMDAwMCwgJ2RhaWx5JzogODY0MDAwMDAgfTtcbiAgaWYgKG1hcFtzXSkgcmV0dXJuIG1hcFtzXTtcbiAgY29uc3QgbSA9IFN0cmluZyhzKS5tYXRjaCgvXihcXGQrKShtc3xzfG18aHxkKSQvKTtcbiAgaWYgKCFtKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbiA9IE51bWJlcihtWzFdKTtcbiAgY29uc3QgdW5pdCA9IHsgbXM6IDEsIHM6IDEwMDAsIG06IDYwMDAwLCBoOiAzNjAwMDAwLCBkOiA4NjQwMDAwMCB9W21bMl1dO1xuICByZXR1cm4gbiAqIHVuaXQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9ydW5CYWNrdXAoaGFuZGxlLCBkaXIsIGtlZXApIHtcbiAgLy8gQnVpbGQgYSBmaWxlbmFtZSBsaWtlOiBhcHAtMjAyNi0wNy0wOVQxNC0wMC0wMC5zcWxpdGVcbiAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKC86L2csICctJyk7XG4gIGNvbnN0IGRlc3RQYXRoID0gYCR7ZGlyfS9iYWNrdXAtJHtub3d9LnNxbGl0ZWA7XG4gIGF3YWl0IGRiLmJhY2t1cChoYW5kbGUsIGRlc3RQYXRoKTtcbiAgY29uc29sZS5sb2coYFtkYl0gYmFja3VwIHdyaXR0ZW4gdG8gXCIke2Rlc3RQYXRofVwiYCk7XG5cbiAgLy8gUHJ1bmUgb2xkIGJhY2t1cHM6IGxpc3QgZGlyLCBmaWx0ZXIgYmFja3VwLSouc3FsaXRlLCBkZWxldGUgb2xkZXN0LlxuICBpZiAodHlwZW9mIF9fZ2x5eF9saXN0RGlyICE9PSAndW5kZWZpbmVkJyAmJiBrZWVwID4gMCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gSlNPTi5wYXJzZShhd2FpdCBfX2dseXhfbGlzdERpcihkaXIpKTtcbiAgICAgIGNvbnN0IGJhY2t1cHMgPSBlbnRyaWVzXG4gICAgICAgIC5maWx0ZXIoZSA9PiAvXmJhY2t1cC1cXGR7NH0tXFxkezJ9LVxcZHsyfVRbXFxkLV0rXFwuc3FsaXRlJC8udGVzdChlLm5hbWUgPz8gZSkpXG4gICAgICAgIC5tYXAoZSA9PiBlLm5hbWUgPz8gZSlcbiAgICAgICAgLnNvcnQoKTtcbiAgICAgIGNvbnN0IHRvRGVsZXRlID0gYmFja3Vwcy5zbGljZSgwLCBNYXRoLm1heCgwLCBiYWNrdXBzLmxlbmd0aCAtIGtlZXApKTtcbiAgICAgIGZvciAoY29uc3QgbmFtZSBvZiB0b0RlbGV0ZSkge1xuICAgICAgICBhd2FpdCBfX2dseXhfZGVsZXRlRmlsZShgJHtkaXJ9LyR7bmFtZX1gKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtkYl0gcHJ1bmVkIG9sZCBiYWNrdXAgXCIke25hbWV9XCJgKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChfKSB7fVxuICB9XG59XG5cbi8qKiBSZXNvbHZlIHRoZSBoYW5kbGU6IGV4cGxpY2l0IG51bWJlciA+IGRlZmF1bHQgPiBlcnJvci4gKi9cbmZ1bmN0aW9uIF9kYkhhbmRsZShoKSB7XG4gIGlmICh0eXBlb2YgaCA9PT0gJ251bWJlcicpIHJldHVybiBoO1xuICBpZiAoX2RlZmF1bHRIYW5kbGUgIT09IG51bGwpIHJldHVybiBfZGVmYXVsdEhhbmRsZTtcbiAgdGhyb3cgbmV3IEVycm9yKCdkYjogbm8gaGFuZGxlIHByb3ZpZGVkIGFuZCBubyBkZWZhdWx0IHNldCAoY2FsbCBkYi5vcGVuKCkgZmlyc3QpJyk7XG59XG5cbmV4cG9ydCBjb25zdCBkYiA9IHtcbiAgLyoqXG4gICAqIE9wZW4gKG9yIGNyZWF0ZSkgYSBTUUxpdGUgZGF0YWJhc2UgYXQgdGhlIGdpdmVuIHBhdGguXG4gICAqIGBcIjptZW1vcnk6XCJgIG9wZW5zIGFuIGluLW1lbW9yeSBkYXRhYmFzZS5cbiAgICogVGhlIGZpcnN0IGNhbGwgYXV0by1zZXRzIHRoZSBkZWZhdWx0IGhhbmRsZTsgdXNlIGBkYi5zZXREZWZhdWx0KGgpYCB0byBjaGFuZ2UgaXQuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59IE9wYXF1ZSBpbnRlZ2VyIGhhbmRsZSBmb3Igc3Vic2VxdWVudCBjYWxscy5cbiAgICovXG4gIG9wZW46IChwYXRoKSA9PlxuICAgIHR5cGVvZiBfX2dseXhfZGJfb3BlbiAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgID8gX19nbHl4X2RiX29wZW4ocGF0aCkudGhlbigocykgPT4ge1xuICAgICAgICAgIGNvbnN0IGggPSBOdW1iZXIocyk7XG4gICAgICAgICAgaWYgKF9kZWZhdWx0SGFuZGxlID09PSBudWxsKSBfZGVmYXVsdEhhbmRsZSA9IGg7XG4gICAgICAgICAgcmV0dXJuIGg7XG4gICAgICAgIH0pXG4gICAgICA6IF9ub0JpbmRpbmcoJ2RiLm9wZW4nKSxcblxuICAvKiogTWFudWFsbHkgc2V0IHRoZSBkZWZhdWx0IGhhbmRsZSB1c2VkIHdoZW4gbm8gaGFuZGxlIGlzIHBhc3NlZCB0byBydW4vcXVlcnkvdHJhbnNhY3Rpb24uICovXG4gIHNldERlZmF1bHQ6IChoYW5kbGUpID0+IHsgX2RlZmF1bHRIYW5kbGUgPSBoYW5kbGU7IH0sXG5cbiAgLyoqXG4gICAqIENsb3NlIGEgZGF0YWJhc2UgYW5kIHJlbGVhc2UgaXRzIGNvbm5lY3Rpb25zLlxuICAgKiBJZGVtcG90ZW50IFx1MjAxNCBjbG9zaW5nIGFuIGFscmVhZHktY2xvc2VkIGhhbmRsZSBpcyBhIG5vLW9wLlxuICAgKiBAcGFyYW0ge251bWJlcn0gW2hhbmRsZV0gLSBEZWZhdWx0cyB0byB0aGUgY3VycmVudCBkZWZhdWx0IGhhbmRsZS5cbiAgICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gICAqL1xuICBjbG9zZTogKGhhbmRsZSkgPT4ge1xuICAgIGNvbnN0IGggPSBoYW5kbGUgPz8gX2RlZmF1bHRIYW5kbGU7XG4gICAgaWYgKGggPT09IG51bGwgfHwgaCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgaWYgKF9kZWZhdWx0SGFuZGxlID09PSBoKSBfZGVmYXVsdEhhbmRsZSA9IG51bGw7XG4gICAgcmV0dXJuIHR5cGVvZiBfX2dseXhfZGJfY2xvc2UgIT09ICd1bmRlZmluZWQnXG4gICAgICA/IF9fZ2x5eF9kYl9jbG9zZShoKVxuICAgICAgOiBfbm9CaW5kaW5nKCdkYi5jbG9zZScpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGEgU0VMRUNUIHN0YXRlbWVudCBhbmQgcmV0dXJuIGFsbCByb3dzIGFzIHBsYWluIG9iamVjdHMuXG4gICAqXG4gICAqIE92ZXJsb2FkZWQgXHUyMDE0IGhhbmRsZSBpcyBvcHRpb25hbCB3aGVuIGEgZGVmYXVsdCBpcyBzZXQ6XG4gICAqICAgZGIucXVlcnkoJ1NFTEVDVCAqIEZST00gaXRlbXMnKSAgICAgICAgICAgICAvLyB1c2VzIGRlZmF1bHQgaGFuZGxlXG4gICAqICAgZGIucXVlcnkoJ1NFTEVDVCAqIEZST00gaXRlbXMgV0hFUkUgaWQ9PycsIFsxXSlcbiAgICogICBkYi5xdWVyeShoYW5kbGUsICdTRUxFQ1QgKiBGUk9NIGl0ZW1zJykgICAgIC8vIGV4cGxpY2l0IGhhbmRsZVxuICAgKiAgIGRiLnF1ZXJ5KGhhbmRsZSwgJ1NFTEVDVCAqIEZST00gaXRlbXMgV0hFUkUgaWQ9PycsIFsxXSlcbiAgICpcbiAgICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0W10+fVxuICAgKi9cbiAgcXVlcnk6IChoYW5kbGVPclNxbCwgc3FsT3JQYXJhbXMgPSBbXSwgcGFyYW1zT3JVbmRlZiA9IFtdKSA9PiB7XG4gICAgY29uc3QgaXNFeHBsaWNpdCA9IHR5cGVvZiBoYW5kbGVPclNxbCA9PT0gJ251bWJlcic7XG4gICAgY29uc3QgaGFuZGxlID0gaXNFeHBsaWNpdCA/IGhhbmRsZU9yU3FsICAgICAgICA6IF9kYkhhbmRsZShudWxsKTtcbiAgICBjb25zdCBzcWwgICAgPSBpc0V4cGxpY2l0ID8gc3FsT3JQYXJhbXMgICAgICAgICA6IGhhbmRsZU9yU3FsO1xuICAgIGNvbnN0IHBhcmFtcyA9IGlzRXhwbGljaXQgPyBwYXJhbXNPclVuZGVmICAgICAgIDogc3FsT3JQYXJhbXM7XG4gICAgcmV0dXJuIHR5cGVvZiBfX2dseXhfZGJfcXVlcnkgIT09ICd1bmRlZmluZWQnXG4gICAgICA/IF9fZ2x5eF9kYl9xdWVyeShoYW5kbGUsIHNxbCwgSlNPTi5zdHJpbmdpZnkocGFyYW1zKSkudGhlbihKU09OLnBhcnNlKVxuICAgICAgOiBfbm9CaW5kaW5nKCdkYi5xdWVyeScpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGFuIElOU0VSVCAvIFVQREFURSAvIERFTEVURSAvIERETCBzdGF0ZW1lbnQuXG4gICAqXG4gICAqIE92ZXJsb2FkZWQgXHUyMDE0IGhhbmRsZSBpcyBvcHRpb25hbCB3aGVuIGEgZGVmYXVsdCBpcyBzZXQ6XG4gICAqICAgZGIucnVuKCdDUkVBVEUgVEFCTEUgSUYgTk9UIEVYSVNUUyAuLi4nKVxuICAgKiAgIGRiLnJ1bignSU5TRVJUIElOVE8gaXRlbXMgKG5hbWUpIFZBTFVFUyAoPyknLCBbJ2hlbGxvJ10pXG4gICAqICAgZGIucnVuKGhhbmRsZSwgJ0lOU0VSVCBJTlRPIGl0ZW1zIChuYW1lKSBWQUxVRVMgKD8pJywgWydoZWxsbyddKVxuICAgKlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7IHJvd3NBZmZlY3RlZDogbnVtYmVyLCBsYXN0SW5zZXJ0SWQ6IG51bWJlciB9Pn1cbiAgICovXG4gIHJ1bjogKGhhbmRsZU9yU3FsLCBzcWxPclBhcmFtcyA9IFtdLCBwYXJhbXNPclVuZGVmID0gW10pID0+IHtcbiAgICBjb25zdCBpc0V4cGxpY2l0ID0gdHlwZW9mIGhhbmRsZU9yU3FsID09PSAnbnVtYmVyJztcbiAgICBjb25zdCBoYW5kbGUgPSBpc0V4cGxpY2l0ID8gaGFuZGxlT3JTcWwgIDogX2RiSGFuZGxlKG51bGwpO1xuICAgIGNvbnN0IHNxbCAgICA9IGlzRXhwbGljaXQgPyBzcWxPclBhcmFtcyAgIDogaGFuZGxlT3JTcWw7XG4gICAgY29uc3QgcGFyYW1zID0gaXNFeHBsaWNpdCA/IHBhcmFtc09yVW5kZWYgOiBzcWxPclBhcmFtcztcbiAgICByZXR1cm4gdHlwZW9mIF9fZ2x5eF9kYl9ydW4gIT09ICd1bmRlZmluZWQnXG4gICAgICA/IF9fZ2x5eF9kYl9ydW4oaGFuZGxlLCBzcWwsIEpTT04uc3RyaW5naWZ5KHBhcmFtcykpLnRoZW4oSlNPTi5wYXJzZSlcbiAgICAgIDogX25vQmluZGluZygnZGIucnVuJyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgbXVsdGlwbGUgU1FMIHN0YXRlbWVudHMgYXRvbWljYWxseSBpbiBhIHNpbmdsZSB0cmFuc2FjdGlvbi5cbiAgICogQW55IGZhaWx1cmUgcm9sbHMgYmFjayBhbGwgc3RhdGVtZW50cy5cbiAgICpcbiAgICogT3ZlcmxvYWRlZCBcdTIwMTQgaGFuZGxlIGlzIG9wdGlvbmFsIHdoZW4gYSBkZWZhdWx0IGlzIHNldDpcbiAgICogICBkYi50cmFuc2FjdGlvbihbXG4gICAqICAgICB7IHNxbDogJ0lOU0VSVCBJTlRPIGEgKHgpIFZBTFVFUyAoPyknLCBwYXJhbXM6IFsxXSB9LFxuICAgKiAgICAgeyBzcWw6ICdVUERBVEUgYiBTRVQgbiA9IG4gKyAxIFdIRVJFIGlkID0gPycsIHBhcmFtczogWzQyXSB9LFxuICAgKiAgIF0pXG4gICAqICAgZGIudHJhbnNhY3Rpb24oaGFuZGxlLCBbLi4uc3RtdHNdKVxuICAgKlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn1cbiAgICovXG4gIHRyYW5zYWN0aW9uOiAoaGFuZGxlT3JTdG10cywgc3RtdHNPclVuZGVmKSA9PiB7XG4gICAgY29uc3QgaXNFeHBsaWNpdCA9IHR5cGVvZiBoYW5kbGVPclN0bXRzID09PSAnbnVtYmVyJztcbiAgICBjb25zdCBoYW5kbGUgPSBpc0V4cGxpY2l0ID8gaGFuZGxlT3JTdG10cyA6IF9kYkhhbmRsZShudWxsKTtcbiAgICBjb25zdCBzdG10cyAgPSBpc0V4cGxpY2l0ID8gc3RtdHNPclVuZGVmICA6IGhhbmRsZU9yU3RtdHM7XG4gICAgcmV0dXJuIHR5cGVvZiBfX2dseXhfZGJfdHJhbnNhY3Rpb24gIT09ICd1bmRlZmluZWQnXG4gICAgICA/IF9fZ2x5eF9kYl90cmFuc2FjdGlvbihoYW5kbGUsIEpTT04uc3RyaW5naWZ5KHN0bXRzKSlcbiAgICAgIDogX25vQmluZGluZygnZGIudHJhbnNhY3Rpb24nKTtcbiAgfSxcblxuICAvKipcbiAgICogUnVuIHZlcnNpb25lZCBzY2hlbWEgbWlncmF0aW9ucyBhZ2FpbnN0IGFuIG9wZW4gZGF0YWJhc2UuXG4gICAqXG4gICAqIEFwcGxpZWQgdmVyc2lvbnMgYXJlIHRyYWNrZWQgaW4gdGhlIGBfZ2x5eF9taWdyYXRpb25zYCB0YWJsZSBzbyBvbmx5XG4gICAqIHBlbmRpbmcgbWlncmF0aW9ucyBydW4uIEVhY2ggbWlncmF0aW9uIGlzIGNvbW1pdHRlZCBhdG9taWNhbGx5IHRvZ2V0aGVyXG4gICAqIHdpdGggaXRzIHRyYWNraW5nIHJlY29yZCBcdTIwMTQgYSBwYXJ0aWFsIGZhaWx1cmUgbGVhdmVzIHRoZSBkYXRhYmFzZSBjbGVhbi5cbiAgICpcbiAgICogT3ZlcmxvYWRlZCBcdTIwMTQgaGFuZGxlIGlzIG9wdGlvbmFsIHdoZW4gYSBkZWZhdWx0IGlzIHNldDpcbiAgICogICBhd2FpdCBkYi5taWdyYXRlKFt7IHZlcnNpb246IDEsIHVwOiAnQ1JFQVRFIFRBQkxFIC4uLicgfV0pXG4gICAqICAgYXdhaXQgZGIubWlncmF0ZShoYW5kbGUsIFt7IHZlcnNpb246IDEsIHVwOiAnLi4uJyB9XSlcbiAgICpcbiAgICogYHVwYCBjYW4gYmUgYSBzdHJpbmcgKHNpbmdsZSBzdGF0ZW1lbnQpIG9yIGFycmF5IG9mIHN0cmluZ3MgKG11bHRpcGxlKS5cbiAgICogQW4gb3B0aW9uYWwgYG5hbWVgIGZpZWxkIGlzIHN0b3JlZCBmb3IgaHVtYW4tcmVhZGFibGUgaGlzdG9yeS5cbiAgICpcbiAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn0gTnVtYmVyIG9mIG1pZ3JhdGlvbnMgYXBwbGllZCB0aGlzIHJ1bi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYXdhaXQgZGIubWlncmF0ZShbXG4gICAqICAgeyB2ZXJzaW9uOiAxLCBuYW1lOiAnY3JlYXRlX3VzZXJzJyxcbiAgICogICAgIHVwOiAnQ1JFQVRFIFRBQkxFIHVzZXJzIChpZCBJTlRFR0VSIFBSSU1BUlkgS0VZLCBuYW1lIFRFWFQgTk9UIE5VTEwpJyB9LFxuICAgKiAgIHsgdmVyc2lvbjogMiwgbmFtZTogJ2FkZF9lbWFpbCcsXG4gICAqICAgICB1cDogJ0FMVEVSIFRBQkxFIHVzZXJzIEFERCBDT0xVTU4gZW1haWwgVEVYVCcgfSxcbiAgICogICB7IHZlcnNpb246IDMsIG5hbWU6ICdjcmVhdGVfaW5kZXhlcycsXG4gICAqICAgICB1cDogWydDUkVBVEUgSU5ERVggaWR4X3VzZXJzX2VtYWlsIE9OIHVzZXJzKGVtYWlsKScsXG4gICAqICAgICAgICAgICdDUkVBVEUgSU5ERVggaWR4X3VzZXJzX25hbWUgIE9OIHVzZXJzKG5hbWUpJ10gfSxcbiAgICogXSk7XG4gICAqL1xuICBtaWdyYXRlOiBhc3luYyAoaGFuZGxlT3JNaWdyYXRpb25zLCBtaWdyYXRpb25zT3JVbmRlZikgPT4ge1xuICAgIGNvbnN0IGlzRXhwbGljaXQgPSB0eXBlb2YgaGFuZGxlT3JNaWdyYXRpb25zID09PSAnbnVtYmVyJztcbiAgICBjb25zdCBoYW5kbGUgICAgID0gaXNFeHBsaWNpdCA/IGhhbmRsZU9yTWlncmF0aW9ucyA6IF9kYkhhbmRsZShudWxsKTtcbiAgICBjb25zdCBtaWdyYXRpb25zID0gaXNFeHBsaWNpdCA/IG1pZ3JhdGlvbnNPclVuZGVmICA6IGhhbmRsZU9yTWlncmF0aW9ucztcblxuICAgIGlmICghQXJyYXkuaXNBcnJheShtaWdyYXRpb25zKSB8fCBtaWdyYXRpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG5cbiAgICBjb25zdCBzb3J0ZWQgPSBbLi4ubWlncmF0aW9uc10uc29ydCgoYSwgYikgPT4gYS52ZXJzaW9uIC0gYi52ZXJzaW9uKTtcblxuICAgIC8vIEVuc3VyZSB0cmFja2luZyB0YWJsZSBleGlzdHMuXG4gICAgYXdhaXQgZGIucnVuKGhhbmRsZSxcbiAgICAgICdDUkVBVEUgVEFCTEUgSUYgTk9UIEVYSVNUUyBfZ2x5eF9taWdyYXRpb25zICcgK1xuICAgICAgJyh2ZXJzaW9uIElOVEVHRVIgUFJJTUFSWSBLRVksIG5hbWUgVEVYVCwgYXBwbGllZF9hdCBJTlRFR0VSIERFRkFVTFQgKHVuaXhlcG9jaCgpKSknXG4gICAgKTtcblxuICAgIGNvbnN0IGFwcGxpZWQgICAgPSBhd2FpdCBkYi5xdWVyeShoYW5kbGUsICdTRUxFQ1QgdmVyc2lvbiBGUk9NIF9nbHl4X21pZ3JhdGlvbnMnKTtcbiAgICBjb25zdCBhcHBsaWVkU2V0ID0gbmV3IFNldChhcHBsaWVkLm1hcChyID0+IHIudmVyc2lvbikpO1xuICAgIGNvbnN0IHBlbmRpbmcgICAgPSBzb3J0ZWQuZmlsdGVyKG0gPT4gIWFwcGxpZWRTZXQuaGFzKG0udmVyc2lvbikpO1xuXG4gICAgZm9yIChjb25zdCBtIG9mIHBlbmRpbmcpIHtcbiAgICAgIGNvbnN0IHVwU3FscyA9IEFycmF5LmlzQXJyYXkobS51cCkgPyBtLnVwIDogW20udXBdO1xuICAgICAgLy8gUnVuIGFsbCB1cCBzdGF0ZW1lbnRzICsgdHJhY2tpbmcgaW5zZXJ0IGluIGEgc2luZ2xlIHRyYW5zYWN0aW9uLlxuICAgICAgYXdhaXQgZGIudHJhbnNhY3Rpb24oaGFuZGxlLCBbXG4gICAgICAgIC4uLnVwU3Fscy5tYXAoc3FsID0+ICh7IHNxbCB9KSksXG4gICAgICAgIHtcbiAgICAgICAgICBzcWw6ICAgICdJTlNFUlQgSU5UTyBfZ2x5eF9taWdyYXRpb25zICh2ZXJzaW9uLCBuYW1lKSBWQUxVRVMgKD8sID8pJyxcbiAgICAgICAgICBwYXJhbXM6IFttLnZlcnNpb24sIG0ubmFtZSA/PyAnbWlncmF0aW9uXycgKyBtLnZlcnNpb25dLFxuICAgICAgICB9LFxuICAgICAgXSk7XG4gICAgfVxuXG4gICAgaWYgKHBlbmRpbmcubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICdbZGJdIGFwcGxpZWQgJyArIHBlbmRpbmcubGVuZ3RoICsgJyBtaWdyYXRpb24ocyk6ICcgK1xuICAgICAgICBwZW5kaW5nLm1hcChtID0+ICd2JyArIG0udmVyc2lvbiArIChtLm5hbWUgPyAnKCcgKyBtLm5hbWUgKyAnKScgOiAnJykpLmpvaW4oJywgJylcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBwZW5kaW5nLmxlbmd0aDtcbiAgfSxcblxuICAvKipcbiAgICogUnVuIGEgc2VlZCBmdW5jdGlvbiwgb3B0aW9uYWxseSB0cmFja2VkIHNvIGl0IG9ubHkgZXhlY3V0ZXMgb25jZSBwZXIgbmFtZS5cbiAgICpcbiAgICogKipVbnRyYWNrZWQqKiAobm8gbmFtZSk6IGFsd2F5cyBydW5zIFx1MjAxNCB1c2Ugd2hlbiB0aGUgZnVuY3Rpb24gaXMgYWxyZWFkeVxuICAgKiBpZGVtcG90ZW50IChlLmcuIGBJTlNFUlQgT1IgSUdOT1JFYCkuXG4gICAqXG4gICAqICoqVHJhY2tlZCoqICh3aXRoIG5hbWUpOiBydW5zIG9uY2UgYW5kIHJlY29yZHMgaW4gYF9nbHl4X3NlZWRzYC4gT25cbiAgICogc3Vic2VxdWVudCBzdGFydHMgdGhlIHNlZWQgaXMgc2tpcHBlZC4gVXNlZnVsIGZvciBkZXYgZml4dHVyZXMgb3JcbiAgICogZGVmYXVsdC1zZXR0aW5ncyByb3dzLlxuICAgKlxuICAgKiBPdmVybG9hZGVkIFx1MjAxNCBoYW5kbGUgaXMgb3B0aW9uYWwgd2hlbiBhIGRlZmF1bHQgaXMgc2V0OlxuICAgKiAgIGRiLnNlZWQoZm4pICAgICAgICAgICAgICAgICAgICAgLy8gdW50cmFja2VkLCBkZWZhdWx0IGhhbmRsZVxuICAgKiAgIGRiLnNlZWQoJ2luaXRpYWxfZGF0YScsIGZuKSAgICAgLy8gdHJhY2tlZCBieSBuYW1lLCBkZWZhdWx0IGhhbmRsZVxuICAgKiAgIGRiLnNlZWQoaGFuZGxlLCBmbikgICAgICAgICAgICAgLy8gdW50cmFja2VkLCBleHBsaWNpdCBoYW5kbGVcbiAgICogICBkYi5zZWVkKGhhbmRsZSwgJ2luaXRpYWwnLCBmbikgIC8vIHRyYWNrZWQsIGV4cGxpY2l0IGhhbmRsZVxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiAvLyBBbHdheXMgcnVuIChpZGVtcG90ZW50IFNRTCk6XG4gICAqIGF3YWl0IGRiLnNlZWQoYXN5bmMgKCkgPT4ge1xuICAgKiAgIGF3YWl0IGRiLnJ1bignSU5TRVJUIE9SIElHTk9SRSBJTlRPIHNldHRpbmdzIChrZXksdmFsdWUpIFZBTFVFUyAoPyw/KScsXG4gICAqICAgICAgICAgICAgICAgIFsndGhlbWUnLCdkYXJrJ10pO1xuICAgKiB9KTtcbiAgICpcbiAgICogLy8gUnVuIG9uY2UgKGRldiBmaXh0dXJlcyk6XG4gICAqIGF3YWl0IGRiLnNlZWQoJ3NhbXBsZV9ub3RlcycsIGFzeW5jICgpID0+IHtcbiAgICogICBhd2FpdCBkYi5ydW4oJ0lOU0VSVCBJTlRPIG5vdGVzICh0aXRsZSxib2R5KSBWQUxVRVMgKD8sPyknLFxuICAgKiAgICAgICAgICAgICAgICBbJ1dlbGNvbWUnLCdIZWxsbyBmcm9tIEdseXghJ10pO1xuICAgKiB9KTtcbiAgICovXG4gIC8qKlxuICAgKiBDcmVhdGUgYW4gYXRvbWljIG9ubGluZSBiYWNrdXAgb2YgdGhlIGRhdGFiYXNlLlxuICAgKiBVc2VzIFNRTGl0ZSdzIGBWQUNVVU0gSU5UT2AgXHUyMDE0IHdvcmtzIHdpdGggV0FMIG1vZGUsIGRvZXMgbm90IGJsb2NrIHJlYWRzL3dyaXRlcy5cbiAgICpcbiAgICogT3ZlcmxvYWRlZCBcdTIwMTQgaGFuZGxlIGlzIG9wdGlvbmFsIHdoZW4gYSBkZWZhdWx0IGlzIHNldDpcbiAgICogICBhd2FpdCBkYi5iYWNrdXAoJy4vYmFja3Vwcy9hcHAtMjAyNi0wNy0wOS5zcWxpdGUnKVxuICAgKiAgIGF3YWl0IGRiLmJhY2t1cChoYW5kbGUsICcuL2JhY2t1cHMvYXBwLnNxbGl0ZScpXG4gICAqXG4gICAqIFRoZSBkZXN0aW5hdGlvbiBkaXJlY3RvcnkgaXMgY3JlYXRlZCBhdXRvbWF0aWNhbGx5LlxuICAgKiBBbnkgZXhpc3RpbmcgZmlsZSBhdCBkZXN0UGF0aCBpcyBvdmVyd3JpdHRlbiBhdG9taWNhbGx5LlxuICAgKlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn1cbiAgICovXG4gIGJhY2t1cDogKGhhbmRsZU9yUGF0aCwgcGF0aE9yVW5kZWYpID0+IHtcbiAgICBjb25zdCBpc0V4cGxpY2l0ID0gdHlwZW9mIGhhbmRsZU9yUGF0aCA9PT0gJ251bWJlcic7XG4gICAgY29uc3QgaGFuZGxlID0gaXNFeHBsaWNpdCA/IGhhbmRsZU9yUGF0aCA6IF9kYkhhbmRsZShudWxsKTtcbiAgICBjb25zdCBwYXRoICAgPSBpc0V4cGxpY2l0ID8gcGF0aE9yVW5kZWYgIDogaGFuZGxlT3JQYXRoO1xuICAgIGlmICghcGF0aCkgdGhyb3cgbmV3IEVycm9yKCdkYi5iYWNrdXA6IGRlc3RpbmF0aW9uIHBhdGggaXMgcmVxdWlyZWQnKTtcbiAgICByZXR1cm4gdHlwZW9mIF9fZ2x5eF9kYl9iYWNrdXAgIT09ICd1bmRlZmluZWQnXG4gICAgICA/IF9fZ2x5eF9kYl9iYWNrdXAoaGFuZGxlLCBwYXRoKVxuICAgICAgOiBfbm9CaW5kaW5nKCdkYi5iYWNrdXAnKTtcbiAgfSxcblxuICAvKipcbiAgICogQ29uZmlndXJlIGF1dG9tYXRpYyBiYWNrdXBzIGZvciBhbiBvcGVuIGRhdGFiYXNlLlxuICAgKlxuICAgKiBPcHRpb25zOlxuICAgKiAgIGRpciAgICAgIFx1MjAxNCBiYWNrdXAgZGlyZWN0b3J5IChyZWxhdGl2ZSB0byBhcHAgZGF0YSBkaXIsIG9yIGFic29sdXRlKVxuICAgKiAgIGludGVydmFsIFx1MjAxNCBzY2hlZHVsZTogJzFoJywgJzZoJywgJzEyaCcsICcyNGgnLCBvciBtaWxsaXNlY29uZHNcbiAgICogICBrZWVwICAgICBcdTIwMTQgbnVtYmVyIG9mIGJhY2t1cCBmaWxlcyB0byByZXRhaW4gKG9sZGVzdCBwcnVuZWQsIGRlZmF1bHQgNSlcbiAgICogICBjb21wcmVzcyBcdTIwMTQgbm90IHlldCBzdXBwb3J0ZWQgKHJlc2VydmVkKVxuICAgKlxuICAgKiBCYWNrdXBzIGFyZSBuYW1lZDogYDxiYXNlbmFtZT4tPElTTzg2MDE+LnNxbGl0ZWBcbiAgICogICBlLmcuIGBhcHAtMjAyNi0wNy0wOVQwMi0wMC0wMC5zcWxpdGVgXG4gICAqXG4gICAqIE92ZXJsb2FkZWQgXHUyMDE0IGhhbmRsZSBpcyBvcHRpb25hbCB3aGVuIGEgZGVmYXVsdCBpcyBzZXQ6XG4gICAqICAgZGIuY29uZmlnKHsgYmFja3VwOiB7IGRpcjogJy4vYmFja3VwcycsIGludGVydmFsOiAnMWgnLCBrZWVwOiA1IH0gfSlcbiAgICogICBkYi5jb25maWcoaGFuZGxlLCB7IGJhY2t1cDogeyBkaXI6ICcuL2JhY2t1cHMnLCBpbnRlcnZhbDogJzI0aCcgfSB9KVxuICAgKlxuICAgKiBDYWxsIGBkYi5jb25maWcoKWAgd2l0aCB0aGUgc2FtZSBoYW5kbGUgdG8gY2FuY2VsIHRoZSBleGlzdGluZyBzY2hlZHVsZS5cbiAgICovXG4gIGNvbmZpZzogKGhhbmRsZU9yT3B0cywgb3B0c09yVW5kZWYpID0+IHtcbiAgICBjb25zdCBpc0V4cGxpY2l0ID0gdHlwZW9mIGhhbmRsZU9yT3B0cyA9PT0gJ251bWJlcic7XG4gICAgY29uc3QgaGFuZGxlID0gaXNFeHBsaWNpdCA/IGhhbmRsZU9yT3B0cyA6IF9kYkhhbmRsZShudWxsKTtcbiAgICBjb25zdCBvcHRzICAgPSBpc0V4cGxpY2l0ID8gb3B0c09yVW5kZWYgIDogaGFuZGxlT3JPcHRzO1xuXG4gICAgLy8gQ2FuY2VsIGFueSBwcmV2aW91cyBhdXRvLWJhY2t1cCB0aW1lciBmb3IgdGhpcyBoYW5kbGUuXG4gICAgaWYgKF9kYkJhY2t1cFRpbWVycy5oYXMoaGFuZGxlKSkge1xuICAgICAgY2xlYXJJbnRlcnZhbChfZGJCYWNrdXBUaW1lcnMuZ2V0KGhhbmRsZSkpO1xuICAgICAgX2RiQmFja3VwVGltZXJzLmRlbGV0ZShoYW5kbGUpO1xuICAgIH1cblxuICAgIGlmICghb3B0cz8uYmFja3VwKSByZXR1cm47XG4gICAgY29uc3QgeyBkaXIgPSAnLi9iYWNrdXBzJywgaW50ZXJ2YWwgPSAnMjRoJywga2VlcCA9IDUgfSA9IG9wdHMuYmFja3VwO1xuXG4gICAgY29uc3QgbXMgPSB0eXBlb2YgaW50ZXJ2YWwgPT09ICdudW1iZXInID8gaW50ZXJ2YWwgOiBfcGFyc2VJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgaWYgKCFtcyB8fCBtcyA8PSAwKSB0aHJvdyBuZXcgRXJyb3IoYGRiLmNvbmZpZzogaW52YWxpZCBpbnRlcnZhbCBcIiR7aW50ZXJ2YWx9XCJgKTtcblxuICAgIGNvbnN0IHRpbWVyID0gc2V0SW50ZXJ2YWwoYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgX3J1bkJhY2t1cChoYW5kbGUsIGRpciwga2VlcCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW2RiXSBhdXRvLWJhY2t1cCBmYWlsZWQ6JywgZT8ubWVzc2FnZSA/PyBlKTtcbiAgICAgIH1cbiAgICB9LCBtcyk7XG5cbiAgICBfZGJCYWNrdXBUaW1lcnMuc2V0KGhhbmRsZSwgdGltZXIpO1xuICAgIGNvbnNvbGUubG9nKGBbZGJdIGF1dG8tYmFja3VwIHNjaGVkdWxlZCBldmVyeSAke2ludGVydmFsfSwgZGlyPVwiJHtkaXJ9XCIsIGtlZXA9JHtrZWVwfWApO1xuICB9LFxuXG4gIHNlZWQ6IGFzeW5jIChoYW5kbGVPck5hbWVPckZuLCBuYW1lT3JGbk9yVW5kZWYsIGZuT3JVbmRlZikgPT4ge1xuICAgIGxldCBoYW5kbGUsIG5hbWUsIGZuO1xuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVPck5hbWVPckZuID09PSAnbnVtYmVyJykge1xuICAgICAgaGFuZGxlID0gaGFuZGxlT3JOYW1lT3JGbjtcbiAgICAgIGlmICh0eXBlb2YgbmFtZU9yRm5PclVuZGVmID09PSAnc3RyaW5nJykgeyBuYW1lID0gbmFtZU9yRm5PclVuZGVmOyBmbiA9IGZuT3JVbmRlZjsgfVxuICAgICAgZWxzZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBmbiAgID0gbmFtZU9yRm5PclVuZGVmOyB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgaGFuZGxlT3JOYW1lT3JGbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGhhbmRsZSA9IF9kYkhhbmRsZShudWxsKTtcbiAgICAgIG5hbWUgICA9IGhhbmRsZU9yTmFtZU9yRm47XG4gICAgICBmbiAgICAgPSBuYW1lT3JGbk9yVW5kZWY7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZSA9IF9kYkhhbmRsZShudWxsKTtcbiAgICAgIGZuICAgICA9IGhhbmRsZU9yTmFtZU9yRm47XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykgdGhyb3cgbmV3IEVycm9yKCdkYi5zZWVkOiBleHBlY3RlZCBhIGZ1bmN0aW9uJyk7XG5cbiAgICBpZiAobmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBUcmFja2VkIFx1MjAxNCBydW5zIG9uY2UgcGVyIG5hbWUuXG4gICAgICBhd2FpdCBkYi5ydW4oaGFuZGxlLFxuICAgICAgICAnQ1JFQVRFIFRBQkxFIElGIE5PVCBFWElTVFMgX2dseXhfc2VlZHMgJyArXG4gICAgICAgICcobmFtZSBURVhUIFBSSU1BUlkgS0VZLCBzZWVkZWRfYXQgSU5URUdFUiBERUZBVUxUICh1bml4ZXBvY2goKSkpJ1xuICAgICAgKTtcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgZGIucXVlcnkoXG4gICAgICAgIGhhbmRsZSwgJ1NFTEVDVCBuYW1lIEZST00gX2dseXhfc2VlZHMgV0hFUkUgbmFtZSA9ID8nLCBbbmFtZV1cbiAgICAgICk7XG4gICAgICBpZiAoZXhpc3RpbmcubGVuZ3RoID4gMCkgcmV0dXJuO1xuICAgICAgYXdhaXQgZm4oKTtcbiAgICAgIGF3YWl0IGRiLnJ1bihoYW5kbGUsICdJTlNFUlQgSU5UTyBfZ2x5eF9zZWVkcyAobmFtZSkgVkFMVUVTICg/KScsIFtuYW1lXSk7XG4gICAgICBjb25zb2xlLmxvZygnW2RiXSBzZWVkIGFwcGxpZWQ6ICcgKyBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgZm4oKTtcbiAgICB9XG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgVmVjdG9yIERhdGFiYXNlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIHZlY3RvckRiLm9wZW4ocGF0aCkgXHUyMTkyIFByb21pc2U8VmVjdG9yRGJIYW5kbGU+XG4vL1xuLy8gVmVjdG9yRGJIYW5kbGU6XG4vLyAgIC51cHNlcnQodGFibGUsIGlkLCB2ZWN0b3IsIG1ldGFkYXRhPykgXHUyMTkyIFByb21pc2U8dm9pZD5cbi8vICAgLnNlYXJjaCh0YWJsZSwgcXVlcnlWZWN0b3IsIGxpbWl0PykgICBcdTIxOTIgUHJvbWlzZTx7aWQsc2NvcmUsbWV0YWRhdGF9W10+XG4vLyAgIC5jbG9zZSgpICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcdTIxOTIgUHJvbWlzZTx2b2lkPlxuXG5leHBvcnQgY29uc3QgdmVjdG9yRGIgPSB7XG4gIC8qKlxuICAgKiBPcGVuIChvciBjcmVhdGUpIGEgdmVjdG9yIHN0b3JlIGF0IHRoZSBnaXZlbiBwYXRoLlxuICAgKiBgXCI6bWVtb3J5OlwiYCBvcGVucyBhbiBpbi1wcm9jZXNzIGVwaGVtZXJhbCBzdG9yZSAobG9zdCBvbiBjbG9zZSkuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPFZlY3RvckRiSGFuZGxlPn1cbiAgICovXG4gIG9wZW46IChwYXRoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBfX2dseXhfdmVjdG9yRGJfb3BlbiA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBfbm9CaW5kaW5nKCd2ZWN0b3JEYi5vcGVuJyk7XG4gICAgcmV0dXJuIF9fZ2x5eF92ZWN0b3JEYl9vcGVuKHBhdGgpLnRoZW4oKHMpID0+IHtcbiAgICAgIGNvbnN0IGhhbmRsZSA9IE51bWJlcihzKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJbnNlcnQgb3IgcmVwbGFjZSBhIHZlY3RvciByZWNvcmQuXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSAgIHRhYmxlICAgIFx1MjAxNCBjb2xsZWN0aW9uIG5hbWVcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9ICAgaWQgICAgICAgXHUyMDE0IHVuaXF1ZSByZWNvcmQga2V5XG4gICAgICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHZlY3RvciAgIFx1MjAxNCBlbWJlZGRpbmcgKGFycmF5IG9mIGZsb2F0cylcbiAgICAgICAgICogQHBhcmFtIHthbnl9ICAgICAgW21ldGFdICAgXHUyMDE0IG9wdGlvbmFsIG1ldGFkYXRhIChKU09OLXNlcmlhbGlzYWJsZSlcbiAgICAgICAgICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gICAgICAgICAqL1xuICAgICAgICB1cHNlcnQodGFibGUsIGlkLCB2ZWN0b3IsIG1ldGEpIHtcbiAgICAgICAgICBjb25zdCBtZXRhU3RyID0gbWV0YSAhPT0gdW5kZWZpbmVkID8gSlNPTi5zdHJpbmdpZnkobWV0YSkgOiAnJztcbiAgICAgICAgICByZXR1cm4gX19nbHl4X3ZlY3RvckRiX3Vwc2VydChoYW5kbGUsIHRhYmxlLCBpZCwgSlNPTi5zdHJpbmdpZnkodmVjdG9yKSwgbWV0YVN0cik7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZpbmQgdGhlIG5lYXJlc3QgdmVjdG9ycyBieSBjb3NpbmUgc2ltaWxhcml0eS5cbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9ICAgdGFibGUgICAgICAgXHUyMDE0IGNvbGxlY3Rpb24gbmFtZVxuICAgICAgICAgKiBAcGFyYW0ge251bWJlcltdfSBxdWVyeVZlY3RvciBcdTIwMTQgcXVlcnkgZW1iZWRkaW5nXG4gICAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSAgIFtsaW1pdD0xMF0gIFx1MjAxNCBtYXggcmVzdWx0c1xuICAgICAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7aWQ6c3RyaW5nLCBzY29yZTpudW1iZXIsIG1ldGFkYXRhOmFueX1bXT59XG4gICAgICAgICAqL1xuICAgICAgICBzZWFyY2godGFibGUsIHF1ZXJ5VmVjdG9yLCBsaW1pdCA9IDEwKSB7XG4gICAgICAgICAgcmV0dXJuIF9fZ2x5eF92ZWN0b3JEYl9zZWFyY2goaGFuZGxlLCB0YWJsZSwgSlNPTi5zdHJpbmdpZnkocXVlcnlWZWN0b3IpLCBsaW1pdClcbiAgICAgICAgICAgIC50aGVuKEpTT04ucGFyc2UpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDbG9zZSB0aGUgdmVjdG9yIHN0b3JlIGFuZCByZWxlYXNlIGl0cyByZXNvdXJjZXMuXG4gICAgICAgICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICAgICAgICAgKi9cbiAgICAgICAgY2xvc2UoKSB7XG4gICAgICAgICAgcmV0dXJuIF9fZ2x5eF92ZWN0b3JEYl9jbG9zZShoYW5kbGUpO1xuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9KTtcbiAgfSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBGaWxlIERpYWxvZ3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gUmVxdWlyZXMgYGRpYWxvZzogdHJ1ZWAgY2FwYWJpbGl0eSBpbiBnbHl4LmNvbmZpZy5qc29uLlxuLy9cbi8vIGRpYWxvZy5vcGVuRmlsZSh7IGZpbHRlcnM/LCBtdWx0aXBsZT8gfSkgXHUyMTkyIFByb21pc2U8c3RyaW5nW10gfCBudWxsPlxuLy8gZGlhbG9nLnNhdmVGaWxlKHsgZGVmYXVsdE5hbWU/LCBmaWx0ZXJzPyB9KSBcdTIxOTIgUHJvbWlzZTxzdHJpbmcgfCBudWxsPlxuLy8gZGlhbG9nLm9wZW5Gb2xkZXIoKSAgICAgICAgICAgICAgICAgICAgICAgICBcdTIxOTIgUHJvbWlzZTxzdHJpbmcgfCBudWxsPlxuLy9cbi8vIEZpbHRlciBzaGFwZTogW3sgbmFtZTogc3RyaW5nLCBleHRlbnNpb25zOiBzdHJpbmdbXSB9XVxuXG5leHBvcnQgY29uc3QgZGlhbG9nID0ge1xuICAvKipcbiAgICogU2hvdyBhIG5hdGl2ZSBvcGVuLWZpbGUgZGlhbG9nLlxuICAgKiBAcGFyYW0ge3sgZmlsdGVycz86IHtuYW1lOnN0cmluZyxleHRlbnNpb25zOnN0cmluZ1tdfVtdLCBtdWx0aXBsZT86IGJvb2xlYW4gfX0gW29wdHNdXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZ1tdIHwgbnVsbD59IFNlbGVjdGVkIHBhdGgocyksIG9yIG51bGwgaWYgY2FuY2VsbGVkLlxuICAgKi9cbiAgb3BlbkZpbGUoeyBmaWx0ZXJzID0gW10sIG11bHRpcGxlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKHR5cGVvZiBfX2dseXhfZGlhbG9nX29wZW5GaWxlID09PSAndW5kZWZpbmVkJykgcmV0dXJuIF9ub0JpbmRpbmcoJ2RpYWxvZy5vcGVuRmlsZScpO1xuICAgIHJldHVybiBfX2dseXhfZGlhbG9nX29wZW5GaWxlKEpTT04uc3RyaW5naWZ5KGZpbHRlcnMpLCBtdWx0aXBsZSkudGhlbihyYXcgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gSlNPTi5wYXJzZShyYXcpO1xuICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgICAvLyBtdWx0aXBsZT1mYWxzZSByZXR1cm5zIGEgYmFyZSBKU09OIHN0cmluZzsgbXVsdGlwbGU9dHJ1ZSByZXR1cm5zIGEgSlNPTiBhcnJheS5cbiAgICAgIC8vIEFsd2F5cyBub3JtYWxpc2UgdG8gc3RyaW5nW10gc28gY2FsbGVycyBjYW4gdXNlIHJlc3VsdFswXSB1bmlmb3JtbHkuXG4gICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0IDogW3Jlc3VsdF07XG4gICAgfSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNob3cgYSBuYXRpdmUgc2F2ZS1maWxlIGRpYWxvZy5cbiAgICogQHBhcmFtIHt7IGRlZmF1bHROYW1lPzogc3RyaW5nLCBmaWx0ZXJzPzoge25hbWU6c3RyaW5nLGV4dGVuc2lvbnM6c3RyaW5nW119W10gfX0gW29wdHNdXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZyB8IG51bGw+fSBDaG9zZW4gc2F2ZSBwYXRoLCBvciBudWxsIGlmIGNhbmNlbGxlZC5cbiAgICovXG4gIHNhdmVGaWxlKHsgZGVmYXVsdE5hbWUgPSAnJywgZmlsdGVycyA9IFtdIH0gPSB7fSkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X2RpYWxvZ19zYXZlRmlsZSA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBfbm9CaW5kaW5nKCdkaWFsb2cuc2F2ZUZpbGUnKTtcbiAgICByZXR1cm4gX19nbHl4X2RpYWxvZ19zYXZlRmlsZShkZWZhdWx0TmFtZSwgSlNPTi5zdHJpbmdpZnkoZmlsdGVycykpLnRoZW4oSlNPTi5wYXJzZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFNob3cgYSBuYXRpdmUgb3Blbi1mb2xkZXIgZGlhbG9nLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmcgfCBudWxsPn0gU2VsZWN0ZWQgZm9sZGVyIHBhdGgsIG9yIG51bGwgaWYgY2FuY2VsbGVkLlxuICAgKi9cbiAgb3BlbkZvbGRlcigpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9kaWFsb2dfb3BlbkZvbGRlciA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBfbm9CaW5kaW5nKCdkaWFsb2cub3BlbkZvbGRlcicpO1xuICAgIHJldHVybiBfX2dseXhfZGlhbG9nX29wZW5Gb2xkZXIoKS50aGVuKEpTT04ucGFyc2UpO1xuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIENsaXBib2FyZCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBSZXF1aXJlcyBgY2xpcGJvYXJkOiB0cnVlYCBjYXBhYmlsaXR5IGluIGdseXguY29uZmlnLmpzb24uXG5cbmV4cG9ydCBjb25zdCBjbGlwYm9hcmQgPSB7XG4gIC8qKlxuICAgKiBSZWFkIHBsYWluIHRleHQgZnJvbSB0aGUgc3lzdGVtIGNsaXBib2FyZC5cbiAgICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nPn1cbiAgICovXG4gIHJlYWRUZXh0KCkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X2NsaXBib2FyZF9yZWFkVGV4dCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBfbm9CaW5kaW5nKCdjbGlwYm9hcmQucmVhZFRleHQnKTtcbiAgICByZXR1cm4gX19nbHl4X2NsaXBib2FyZF9yZWFkVGV4dCgpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBXcml0ZSBwbGFpbiB0ZXh0IHRvIHRoZSBzeXN0ZW0gY2xpcGJvYXJkLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn1cbiAgICovXG4gIHdyaXRlVGV4dCh0ZXh0KSB7XG4gICAgaWYgKHR5cGVvZiBfX2dseXhfY2xpcGJvYXJkX3dyaXRlVGV4dCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBfbm9CaW5kaW5nKCdjbGlwYm9hcmQud3JpdGVUZXh0Jyk7XG4gICAgcmV0dXJuIF9fZ2x5eF9jbGlwYm9hcmRfd3JpdGVUZXh0KHRleHQpO1xuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIE5vdGlmaWNhdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gUmVxdWlyZXMgYG5vdGlmaWNhdGlvbjogdHJ1ZWAgY2FwYWJpbGl0eSBpbiBnbHl4LmNvbmZpZy5qc29uLlxuXG5leHBvcnQgY29uc3Qgbm90aWZpY2F0aW9uID0ge1xuICAvKipcbiAgICogU2VuZCBhIG5hdGl2ZSBkZXNrdG9wIG5vdGlmaWNhdGlvbi4gRmlyZS1hbmQtZm9yZ2V0OyBuZXZlciByZWplY3RzLlxuICAgKiBAcGFyYW0ge3sgdGl0bGU6IHN0cmluZywgYm9keT86IHN0cmluZyB9fSBvcHRzXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICAgKi9cbiAgc2VuZCh7IHRpdGxlLCBib2R5ID0gJycgfSkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X25vdGlmaWNhdGlvbl9zZW5kID09PSAndW5kZWZpbmVkJykgcmV0dXJuIF9ub0JpbmRpbmcoJ25vdGlmaWNhdGlvbi5zZW5kJyk7XG4gICAgcmV0dXJuIF9fZ2x5eF9ub3RpZmljYXRpb25fc2VuZCh0aXRsZSwgYm9keSk7XG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgZmV0Y2ggXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gQnJvd3Nlci1jb21wYXRpYmxlIGZldGNoIEFQSSBiYWNrZWQgYnkgdGhlIFJ1c3QgcmVxd2VzdCBIVFRQIGNsaWVudC5cbi8vIFJlcXVpcmVzIGBuZXR3b3JrLmFsbG93YCBjYXBhYmlsaXR5IGluIGdseXguY29uZmlnLmpzb246XG4vLyAgIHsgXCJjYXBhYmlsaXRpZXNcIjogeyBcIm5ldHdvcmtcIjogeyBcImFsbG93XCI6IFtcImFwaS5leGFtcGxlLmNvbVwiXSB9IH0gfVxuLy8gVXNlIFtcIipcIl0gdG8gYWxsb3cgYWxsIG91dGJvdW5kIHJlcXVlc3RzLlxuLy9cbi8vIFJlc3BvbnNlIHNoYXBlIG1pcnJvcnMgdGhlIGJyb3dzZXIgRmV0Y2ggQVBJIChzdWJzZXQpOlxuLy8gICByZXMuc3RhdHVzICAgICAgXHUyMTkyIG51bWJlclxuLy8gICByZXMub2sgICAgICAgICAgXHUyMTkyIGJvb2xlYW4gKHRydWUgd2hlbiAyMDAtMjk5KVxuLy8gICByZXMuc3RhdHVzVGV4dCAgXHUyMTkyIHN0cmluZ1xuLy8gICByZXMuaGVhZGVycyAgICAgXHUyMTkyIHBsYWluIG9iamVjdCAgeyBcImNvbnRlbnQtdHlwZVwiOiBcIi4uLlwiIH1cbi8vICAgcmVzLnRleHQoKSAgICAgIFx1MjE5MiBQcm9taXNlPHN0cmluZz5cbi8vICAgcmVzLmpzb24oKSAgICAgIFx1MjE5MiBQcm9taXNlPGFueT5cblxuLyoqXG4gKiBNYWtlIGFuIEhUVFAgcmVxdWVzdC5cbiAqXG4gKiBTdXBwb3J0cyBwbGFpbiBzdHJpbmcgYm9kaWVzIGFuZCBtdWx0aXBhcnQvZm9ybS1kYXRhIHVwbG9hZHM6XG4gKiBgYGBqc1xuICogLy8gSlNPTiBQT1NUXG4gKiBmZXRjaCh1cmwsIHsgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzonYXBwbGljYXRpb24vanNvbid9LFxuICogICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpIH0pO1xuICpcbiAqIC8vIE11bHRpcGFydCB1cGxvYWQgKHRleHQgZmllbGQgKyBiaW5hcnkgZmlsZSlcbiAqIGNvbnN0IGJ5dGVzID0gYXdhaXQgZnMucmVhZEZpbGVCeXRlcyhmaWxlUGF0aCk7ICAgICAgICAgIC8vIGJhc2U2NCBzdHJpbmdcbiAqIGZldGNoKHVybCwgeyBtZXRob2Q6ICdQT1NUJywgbXVsdGlwYXJ0OiBbXG4gKiAgIHsgbmFtZTogJ2Rlc2NyaXB0aW9uJywgdmFsdWU6ICdteSB1cGxvYWQnIH0sXG4gKiAgIHsgbmFtZTogJ2ZpbGUnLCBmaWxlbmFtZTogJ3Bob3RvLmpwZycsIGJhc2U2NDogYnl0ZXMsIGNvbnRlbnRUeXBlOiAnaW1hZ2UvanBlZycgfSxcbiAqIF19KTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmxcbiAqIEBwYXJhbSB7eyBtZXRob2Q/OiBzdHJpbmcsIGhlYWRlcnM/OiBSZWNvcmQ8c3RyaW5nLHN0cmluZz4sXG4gKiAgICAgICAgICAgYm9keT86IHN0cmluZyxcbiAqICAgICAgICAgICBtdWx0aXBhcnQ/OiBBcnJheTx7bmFtZTpzdHJpbmcsIHZhbHVlPzpzdHJpbmcsIGZpbGVuYW1lPzpzdHJpbmcsXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhc2U2ND86c3RyaW5nLCBjb250ZW50VHlwZT86c3RyaW5nfT4gfX0gW29wdGlvbnNdXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7IHN0YXR1czogbnVtYmVyLCBvazogYm9vbGVhbiwgc3RhdHVzVGV4dDogc3RyaW5nLFxuICogICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLHN0cmluZz4sXG4gKiAgICAgICAgICAgICAgICAgICAgIHRleHQ6ICgpID0+IFByb21pc2U8c3RyaW5nPiwganNvbjogKCkgPT4gUHJvbWlzZTxhbnk+IH0+fVxuICovXG4vLyBDYXNlLWluc2Vuc2l0aXZlLCBzcGVjLWNvbXBhdGlibGUgSGVhZGVycyAodGhlIHJ1bnRpbWUgaGFzIG5vIHBsYXRmb3JtIG9uZSkuXG5jbGFzcyBHbHl4SGVhZGVycyB7XG4gIGNvbnN0cnVjdG9yKGluaXQpIHtcbiAgICB0aGlzLl9tID0gbmV3IE1hcCgpO1xuICAgIGlmICghaW5pdCkgcmV0dXJuO1xuICAgIGlmIChpbml0IGluc3RhbmNlb2YgR2x5eEhlYWRlcnMpIHsgaW5pdC5mb3JFYWNoKCh2LCBrKSA9PiB0aGlzLnNldChrLCB2KSk7IH1cbiAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KGluaXQpKSAgICAgeyBmb3IgKGNvbnN0IFtrLCB2XSBvZiBpbml0KSB0aGlzLmFwcGVuZChrLCB2KTsgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBpbml0LmZvckVhY2ggPT09ICdmdW5jdGlvbicpIHsgaW5pdC5mb3JFYWNoKCh2LCBrKSA9PiB0aGlzLnNldChrLCB2KSk7IH1cbiAgICBlbHNlIHsgZm9yIChjb25zdCBrIG9mIE9iamVjdC5rZXlzKGluaXQpKSB0aGlzLnNldChrLCBpbml0W2tdKTsgfVxuICB9XG4gIHNldChrLCB2KSAgICAgeyB0aGlzLl9tLnNldChTdHJpbmcoaykudG9Mb3dlckNhc2UoKSwgU3RyaW5nKHYpKTsgfVxuICBhcHBlbmQoaywgdikgIHsgY29uc3QgbGsgPSBTdHJpbmcoaykudG9Mb3dlckNhc2UoKTsgdGhpcy5fbS5zZXQobGssIHRoaXMuX20uaGFzKGxrKSA/IGAke3RoaXMuX20uZ2V0KGxrKX0sICR7dn1gIDogU3RyaW5nKHYpKTsgfVxuICBnZXQoaykgICAgICAgIHsgY29uc3QgdiA9IHRoaXMuX20uZ2V0KFN0cmluZyhrKS50b0xvd2VyQ2FzZSgpKTsgcmV0dXJuIHYgPT0gbnVsbCA/IG51bGwgOiB2OyB9XG4gIGhhcyhrKSAgICAgICAgeyByZXR1cm4gdGhpcy5fbS5oYXMoU3RyaW5nKGspLnRvTG93ZXJDYXNlKCkpOyB9XG4gIGRlbGV0ZShrKSAgICAgeyB0aGlzLl9tLmRlbGV0ZShTdHJpbmcoaykudG9Mb3dlckNhc2UoKSk7IH1cbiAgZm9yRWFjaChjYiwgdCl7IHRoaXMuX20uZm9yRWFjaCgodiwgaykgPT4gY2IuY2FsbCh0LCB2LCBrLCB0aGlzKSk7IH1cbiAga2V5cygpICAgICAgICB7IHJldHVybiB0aGlzLl9tLmtleXMoKTsgfVxuICB2YWx1ZXMoKSAgICAgIHsgcmV0dXJuIHRoaXMuX20udmFsdWVzKCk7IH1cbiAgZW50cmllcygpICAgICB7IHJldHVybiB0aGlzLl9tLmVudHJpZXMoKTsgfVxuICBbU3ltYm9sLml0ZXJhdG9yXSgpIHsgcmV0dXJuIHRoaXMuX20uZW50cmllcygpOyB9XG4gIHRvT2JqZWN0KCkgICAgeyBjb25zdCBvID0ge307IHRoaXMuX20uZm9yRWFjaCgodiwgaykgPT4geyBvW2tdID0gdjsgfSk7IHJldHVybiBvOyB9XG59XG5leHBvcnQgeyBHbHl4SGVhZGVycyBhcyBIZWFkZXJzIH07XG5cbi8vIEJ1aWxkIGEgUmVzcG9uc2UtbGlrZSBvYmplY3QgZnJvbSB0aGUgbmF0aXZlIGZldGNoIHJlc3VsdC4gYGNsb25lKClgIHJlLWRlcml2ZXNcbi8vIGEgZnJlc2gsIGluZGVwZW5kZW50bHktY29uc3VtYWJsZSBib2R5IGZyb20gdGhlIHNhbWUgY2FwdHVyZWQgZGF0YS5cbmZ1bmN0aW9uIF9tYWtlUmVzcG9uc2UoZGF0YSwgdXJsKSB7XG4gIGNvbnN0IGhlYWRlcnMgID0gbmV3IEdseXhIZWFkZXJzKGRhdGEuaGVhZGVycyB8fCB7fSk7XG4gIGNvbnN0IGJvZHlUZXh0ID0gZGF0YS5ib2R5ID8/ICcnO1xuICBsZXQgdXNlZCA9IGZhbHNlO1xuICBjb25zdCBjb25zdW1lID0gKCkgPT4geyBpZiAodXNlZCkgdGhyb3cgbmV3IFR5cGVFcnJvcignQm9keSBoYXMgYWxyZWFkeSBiZWVuIGNvbnN1bWVkLicpOyB1c2VkID0gdHJ1ZTsgfTtcbiAgY29uc3QgdG9CeXRlcyA9ICgpID0+IHtcbiAgICBpZiAodHlwZW9mIFRleHRFbmNvZGVyICE9PSAndW5kZWZpbmVkJykgcmV0dXJuIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShib2R5VGV4dCk7XG4gICAgY29uc3QgdTggPSBuZXcgVWludDhBcnJheShib2R5VGV4dC5sZW5ndGgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYm9keVRleHQubGVuZ3RoOyBpKyspIHU4W2ldID0gYm9keVRleHQuY2hhckNvZGVBdChpKSAmIDB4ZmY7XG4gICAgcmV0dXJuIHU4O1xuICB9O1xuICByZXR1cm4ge1xuICAgIHVybDogZGF0YS51cmwgfHwgdXJsLCBzdGF0dXM6IGRhdGEuc3RhdHVzLCBvazogZGF0YS5vaywgc3RhdHVzVGV4dDogZGF0YS5zdGF0dXNUZXh0LFxuICAgIGhlYWRlcnMsIHJlZGlyZWN0ZWQ6IGZhbHNlLCB0eXBlOiAnYmFzaWMnLFxuICAgIGdldCBib2R5VXNlZCgpIHsgcmV0dXJuIHVzZWQ7IH0sXG4gICAgdGV4dDogICAgICAgICgpID0+IHsgY29uc3VtZSgpOyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGJvZHlUZXh0KTsgfSxcbiAgICBqc29uOiAgICAgICAgKCkgPT4geyBjb25zdW1lKCk7IHJldHVybiBQcm9taXNlLnJlc29sdmUoSlNPTi5wYXJzZShib2R5VGV4dCkpOyB9LFxuICAgIGFycmF5QnVmZmVyOiAoKSA9PiB7IGNvbnN1bWUoKTsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0b0J5dGVzKCkuYnVmZmVyKTsgfSxcbiAgICBibG9iOiAgICAgICAgKCkgPT4ge1xuICAgICAgY29uc3VtZSgpO1xuICAgICAgY29uc3QgdTggPSB0b0J5dGVzKCk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcbiAgICAgICAgc2l6ZTogdTgubGVuZ3RoLCB0eXBlOiBoZWFkZXJzLmdldCgnY29udGVudC10eXBlJykgfHwgJycsXG4gICAgICAgIGFycmF5QnVmZmVyOiAoKSA9PiBQcm9taXNlLnJlc29sdmUodTguYnVmZmVyKSxcbiAgICAgICAgdGV4dDogICAgICAgICgpID0+IFByb21pc2UucmVzb2x2ZShib2R5VGV4dCksXG4gICAgICB9KTtcbiAgICB9LFxuICAgIGNsb25lOiAoKSA9PiBfbWFrZVJlc3BvbnNlKGRhdGEsIHVybCksXG4gIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaCh1cmwsIG9wdGlvbnMgPSB7fSkge1xuICBpZiAodHlwZW9mIF9fZ2x5eF9mZXRjaCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2ZldGNoOiBfX2dseXhfZmV0Y2ggYmluZGluZyBpcyBub3QgYXZhaWxhYmxlJyk7XG4gIH1cbiAgLy8gTm9ybWFsaXplIHJlcXVlc3QgaW5pdCB0byB3aGF0IHRoZSBuYXRpdmUgYmluZGluZyBleHBlY3RzIChzdHJpbmcgYm9keSArXG4gIC8vIHBsYWluIGhlYWRlciBvYmplY3QpLCB3aGlsZSBhY2NlcHRpbmcgdGhlIHNwZWMgc2hhcGVzIGxpYnJhcmllcyB1c2UuXG4gIGNvbnN0IGluaXQgPSB7IC4uLm9wdGlvbnMgfTtcbiAgY29uc3QgaGRycyA9IG5ldyBHbHl4SGVhZGVycyhpbml0LmhlYWRlcnMpO1xuICBpZiAoaW5pdC5ib2R5ICE9IG51bGwgJiYgdHlwZW9mIGluaXQuYm9keSAhPT0gJ3N0cmluZycgJiYgIWluaXQubXVsdGlwYXJ0KSB7XG4gICAgY29uc3QgYiA9IGluaXQuYm9keTtcbiAgICBjb25zdCBpc0JpbmFyeSA9IGIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciB8fCBBcnJheUJ1ZmZlci5pc1ZpZXcoYik7XG4gICAgaWYgKCFpc0JpbmFyeSAmJiB0eXBlb2YgYiA9PT0gJ29iamVjdCcpIHtcbiAgICAgIC8vIENvbnZlbmllbmNlOiBwbGFpbiBvYmplY3QgYm9keSBcdTIxOTIgSlNPTi5cbiAgICAgIGluaXQuYm9keSA9IEpTT04uc3RyaW5naWZ5KGIpO1xuICAgICAgaWYgKCFoZHJzLmhhcygnY29udGVudC10eXBlJykpIGhkcnMuc2V0KCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgIH0gZWxzZSBpZiAoIWlzQmluYXJ5KSB7XG4gICAgICBpbml0LmJvZHkgPSBTdHJpbmcoYik7XG4gICAgfVxuICAgIC8vIChCaW5hcnkgcmVxdWVzdCBib2RpZXMgYXJlbid0IHN1cHBvcnRlZCBvdmVyIHRoZSB0ZXh0IGNoYW5uZWwgXHUyMDE0IHVzZSB0aGVcbiAgICAvLyAgYG11bHRpcGFydGAgb3B0aW9uIHdpdGggYmFzZTY0IHBhcnRzIGZvciBmaWxlIHVwbG9hZHMuKVxuICB9XG4gIGluaXQuaGVhZGVycyA9IGhkcnMudG9PYmplY3QoKTtcblxuICBjb25zdCByYXcgPSBhd2FpdCBfX2dseXhfZmV0Y2godXJsLCBKU09OLnN0cmluZ2lmeShpbml0KSk7XG4gIHJldHVybiBfbWFrZVJlc3BvbnNlKEpTT04ucGFyc2UocmF3KSwgdXJsKTtcbn1cblxuLy8gRXhwb3NlIGBmZXRjaGAgKyBgSGVhZGVyc2AgYXMgZ2xvYmFscyAodGhlIGVtYmVkZGVkIFY4IHJ1bnRpbWUgaGFzIG5vIHBsYXRmb3JtXG4vLyBlcXVpdmFsZW50cywgc28gdGhpcyBpcyBwdXJlbHkgYWRkaXRpdmUgXHUyMDE0IG5vdGhpbmcgc3RhbmRhcmQgaXMgc2hhZG93ZWQpLiBMZXRzXG4vLyB3ZWItb3JpZW50ZWQgbGlicmFyaWVzIChTdXBhYmFzZSwgU3RyaXBlLCBcdTIwMjYpIHdvcmsgdW5tb2RpZmllZDsgYm90aCByZW1haW5cbi8vIGltcG9ydGFibGUgZnJvbSBAZ2x5eC1kZXYvcmVhY3QuXG4vL1xuLy8gTk9URTogcmVzcG9uc2UgYm9kaWVzIGNyb3NzIHRoZSBicmlkZ2UgYXMgVVRGLTggdGV4dCwgc28gYGFycmF5QnVmZmVyKClgL2BibG9iKClgXG4vLyBhcmUgY29ycmVjdCBmb3IgdGV4dC9KU09OIGJ1dCBsb3NzeSBmb3IgdHJ1ZSBiaW5hcnkgZG93bmxvYWRzIChpbWFnZXMpLiBGZXRjaFxuLy8gYmluYXJ5IHZpYSBhIGRlZGljYXRlZCBkb3dubG9hZC9mcyBBUEkgaW5zdGVhZC5cbmlmICh0eXBlb2YgZ2xvYmFsVGhpcy5mZXRjaCA9PT0gJ3VuZGVmaW5lZCcpICAgZ2xvYmFsVGhpcy5mZXRjaCA9IGZldGNoO1xuaWYgKHR5cGVvZiBnbG9iYWxUaGlzLkhlYWRlcnMgPT09ICd1bmRlZmluZWQnKSBnbG9iYWxUaGlzLkhlYWRlcnMgPSBHbHl4SGVhZGVycztcblxuLy8gXHUyNTAwXHUyNTAwIFdlYlNvY2tldCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBEcmFpbnMgZWFjaCBvcGVuIHNvY2tldCdzIGluYm94IG9uY2UgcGVyIGZyYW1lIGFuZCBmaXJlcyByZWdpc3RlcmVkIGhhbmRsZXJzLlxuLy8gQ2FsbGVkIGZyb20gX19nbHl4X2ZyYW1lQ2FsbGJhY2sgKGRlZmluZWQgYWJvdmUpIGluc2lkZSBmbHVzaFN5bmMgc28gdGhhdFxuLy8gb25tZXNzYWdlIGNhbGxiYWNrcyB0aGF0IGNhbGwgc2V0U3RhdGUgYXJlIGJhdGNoZWQgd2l0aCB0aGUgcmVzdCBvZiB0aGUgZnJhbWUuXG5leHBvcnQgZnVuY3Rpb24gX3BvbGxXZWJTb2NrZXRzKCkge1xuICBmb3IgKGNvbnN0IFtpZCwgaGFuZGxlcnNdIG9mIF93c09wZW5Tb2NrZXRzKSB7XG4gICAgbGV0IHJhdztcbiAgICB0cnkgeyByYXcgPSBfX2dseXhfd3NfcG9sbChpZCk7IH0gY2F0Y2ggeyBjb250aW51ZTsgfVxuICAgIGlmICghcmF3KSBjb250aW51ZTtcbiAgICBsZXQgbXNncztcbiAgICB0cnkgeyBtc2dzID0gSlNPTi5wYXJzZShyYXcpOyB9IGNhdGNoIHsgY29udGludWU7IH1cbiAgICBmb3IgKGNvbnN0IG0gb2YgbXNncykge1xuICAgICAgaWYgKG0gPT09ICdfX0dMWVhfV1NfQ0xPU0VEX18nKSB7XG4gICAgICAgIGhhbmRsZXJzLm9uY2xvc2U/LigpO1xuICAgICAgICBfd3NPcGVuU29ja2V0cy5kZWxldGUoaWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhhbmRsZXJzLm9ubWVzc2FnZT8uKHsgZGF0YTogbSB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBXZWJTb2NrZXQgQVBJLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBzb2NrZXQgPSBhd2FpdCB3cy5jb25uZWN0KCd3c3M6Ly9lY2hvLndlYnNvY2tldC5vcmcnLCB7XG4gKiAgIG9ubWVzc2FnZTogKGV2KSA9PiBjb25zb2xlLmxvZygncmVjZWl2ZWQ6JywgZXYuZGF0YSksXG4gKiAgIG9uY2xvc2U6ICAgKCkgICA9PiBjb25zb2xlLmxvZygnY2xvc2VkJyksXG4gKiB9KTtcbiAqIHNvY2tldC5zZW5kKCdIZWxsbyEnKTtcbiAqIC8vIGxhdGVyOlxuICogc29ja2V0LmNsb3NlKCk7XG4gKi9cbi8vIFx1MjUwMFx1MjUwMCBtRE5TIHNlcnZpY2UgZGlzY292ZXJ5IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIFJlcXVpcmVzIGBtZG5zOiB0cnVlYCBjYXBhYmlsaXR5IGluIGdseXguY29uZmlnLmpzb24uXG4vL1xuLy8gVXNhZ2U6XG4vLyAgIGltcG9ydCB7IG1kbnMgfSBmcm9tICdAZ2x5eC1kZXYvcmVhY3QnO1xuLy8gICBjb25zdCBzZXJ2aWNlcyA9IGF3YWl0IG1kbnMuZGlzY292ZXIoJ19odHRwLl90Y3AubG9jYWwuJywgeyB0aW1lb3V0OiA0MDAwIH0pO1xuLy8gICAvLyBbeyBuYW1lLCBob3N0bmFtZSwgcG9ydCwgYWRkcmVzc2VzOiBzdHJpbmdbXSB9LCAuLi5dXG5cbmV4cG9ydCBjb25zdCBtZG5zID0ge1xuICAvKipcbiAgICogQnJvd3NlIGZvciBtRE5TL0JvbmpvdXIgc2VydmljZXMgb2YgdGhlIGdpdmVuIHR5cGUuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzZXJ2aWNlVHlwZSAgZS5nLiBcIl9odHRwLl90Y3AubG9jYWwuXCJcbiAgICogQHBhcmFtIHt7IHRpbWVvdXQ/OiBudW1iZXIgfX0gW29wdHNdICB0aW1lb3V0IGluIG1zIChkZWZhdWx0IDUwMDApXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHtuYW1lOnN0cmluZywgaG9zdG5hbWU6c3RyaW5nLCBwb3J0Om51bWJlciwgYWRkcmVzc2VzOnN0cmluZ1tdfVtdPn1cbiAgICovXG4gIGRpc2NvdmVyKHNlcnZpY2VUeXBlLCB7IHRpbWVvdXQgPSA1MDAwIH0gPSB7fSkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X21kbnNfZGlzY292ZXIgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gX25vQmluZGluZygnbWRucy5kaXNjb3ZlcicpO1xuICAgIHJldHVybiBfX2dseXhfbWRuc19kaXNjb3ZlcihzZXJ2aWNlVHlwZSwgdGltZW91dCkudGhlbihKU09OLnBhcnNlKTtcbiAgfSxcbn07XG5cbmV4cG9ydCBjb25zdCB3cyA9IHtcbiAgLyoqXG4gICAqIE9wZW4gYSBXZWJTb2NrZXQgY29ubmVjdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAgd3M6Ly8gb3Igd3NzOi8vIFVSTFxuICAgKiBAcGFyYW0ge3sgb25tZXNzYWdlPzogKGV2OiB7ZGF0YTpzdHJpbmd9KSA9PiB2b2lkLFxuICAgKiAgICAgICAgICAgIG9uY2xvc2U/OiAgKCkgPT4gdm9pZCxcbiAgICogICAgICAgICAgICBvbmVycm9yPzogIChlcnI6IHN0cmluZykgPT4gdm9pZCB9fSBbaGFuZGxlcnNdXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHsgc2VuZDogKG1zZzpzdHJpbmcpPT52b2lkLCBjbG9zZTogKCk9PnZvaWQsIGlkOiBudW1iZXIgfT59XG4gICAqL1xuICBjb25uZWN0KHVybCwgaGFuZGxlcnMgPSB7fSkge1xuICAgIHJldHVybiBfX2dseXhfd3NfY29ubmVjdCh1cmwpLnRoZW4oaWRTdHIgPT4ge1xuICAgICAgY29uc3QgaWQgPSBOdW1iZXIoaWRTdHIpO1xuICAgICAgX3dzT3BlblNvY2tldHMuc2V0KGlkLCBoYW5kbGVycyk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBnZXQgaWQoKSB7IHJldHVybiBpZDsgfSxcbiAgICAgICAgc2VuZChtc2cpICB7IF9fZ2x5eF93c19zZW5kKGlkLCBTdHJpbmcobXNnKSk7IH0sXG4gICAgICAgIGNsb3NlKCkgICAge1xuICAgICAgICAgIF9fZ2x5eF93c19jbG9zZShpZCk7XG4gICAgICAgICAgX3dzT3BlblNvY2tldHMuZGVsZXRlKGlkKTtcbiAgICAgICAgICBoYW5kbGVycy5vbmNsb3NlPy4oKTtcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfSk7XG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgSVBDIChpbnRlci13aW5kb3cgbWVzc2FnaW5nKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBEcmFpbiB0aGlzIHdpbmRvdydzIElQQyBpbmJveCBlYWNoIGZyYW1lIGFuZCBmaXJlIHJlZ2lzdGVyZWQgbGlzdGVuZXJzLlxuZXhwb3J0IGZ1bmN0aW9uIF9wb2xsSXBjKCkge1xuICBpZiAodHlwZW9mIF9fZ2x5eF9pcGNfcG9sbCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgbGV0IHJhdztcbiAgdHJ5IHsgcmF3ID0gX19nbHl4X2lwY19wb2xsKCk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgaWYgKCFyYXcpIHJldHVybjtcbiAgbGV0IG1zZ3M7XG4gIHRyeSB7IG1zZ3MgPSBKU09OLnBhcnNlKHJhdyk7IH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgZm9yIChjb25zdCBtc2cgb2YgbXNncykge1xuICAgIGZvciAoY29uc3QgY2Igb2YgX2lwY0xpc3RlbmVycykge1xuICAgICAgdHJ5IHsgY2IobXNnKTsgfSBjYXRjaCB7fVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEludGVyLXdpbmRvdyBwcm9jZXNzIGNvbW11bmljYXRpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEluIHdpbmRvdyAwIChtYWluKTpcbiAqIGNvbnN0IGNoaWxkID0gYXdhaXQgZ2x5eFdpbmRvdy5jcmVhdGUoeyB0aXRsZTogJ0luc3BlY3RvcicsIHdpZHRoOiA0MDAsIGhlaWdodDogNjAwIH0pO1xuICogaXBjLnNlbmQoY2hpbGQuaWQsIEpTT04uc3RyaW5naWZ5KHsgdHlwZTogJ2luaXQnLCBkYXRhOiA0MiB9KSk7XG4gKlxuICogLy8gSW4gd2luZG93IE4gKHNlY29uZGFyeSk6XG4gKiBpcGMub24oJ21lc3NhZ2UnLCAobXNnKSA9PiBjb25zb2xlLmxvZygncmVjZWl2ZWQ6JywgbXNnKSk7XG4gKi9cbmV4cG9ydCBjb25zdCBpcGMgPSB7XG4gIC8qKlxuICAgKiBTZW5kIGEgc3RyaW5nIG1lc3NhZ2UgdG8gYW5vdGhlciB3aW5kb3cgYnkgaXRzIGhhbmRsZS5cbiAgICogQHBhcmFtIHtudW1iZXJ9IHRhcmdldEhhbmRsZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxuICAgKi9cbiAgc2VuZCh0YXJnZXRIYW5kbGUsIG1lc3NhZ2UpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9pcGNfc2VuZCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIF9fZ2x5eF9pcGNfc2VuZCh0YXJnZXRIYW5kbGUsIFN0cmluZyhtZXNzYWdlKSk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGNhbGxiYWNrIGZvciBtZXNzYWdlcyByZWNlaXZlZCBieSB0aGlzIHdpbmRvdy5cbiAgICogQHBhcmFtIHsnbWVzc2FnZSd9IGV2ZW50ICBcdTIwMTQgY3VycmVudGx5IG9ubHkgJ21lc3NhZ2UnIGlzIHN1cHBvcnRlZFxuICAgKiBAcGFyYW0geyhtc2c6IHN0cmluZykgPT4gdm9pZH0gY2FsbGJhY2tcbiAgICogQHJldHVybnMgeygpID0+IHZvaWR9ICB1bnN1YnNjcmliZSBmdW5jdGlvblxuICAgKi9cbiAgb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKGV2ZW50ICE9PSAnbWVzc2FnZScpIHJldHVybiAoKSA9PiB7fTtcbiAgICBfaXBjTGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBpZHggPSBfaXBjTGlzdGVuZXJzLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgaWYgKGlkeCAhPT0gLTEpIF9pcGNMaXN0ZW5lcnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgfTtcbiAgfSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBNdWx0aS13aW5kb3cgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gRXh0ZW5kcyBnbHl4V2luZG93IHdpdGggYSBjcmVhdGUoKSBtZXRob2QgZm9yIG9wZW5pbmcgc2Vjb25kYXJ5IHdpbmRvd3MuXG4vLyBUaGlzIGV4cG9ydCBhZGRzIHRvIHRoZSBleGlzdGluZyBnbHl4V2luZG93IG9iamVjdCAoZGVmaW5lZCBlYXJsaWVyIGluIHRoZVxuLy8gZmlsZSkgXHUyMDE0IGltcG9ydCBnbHl4V2luZG93IHRvIHVzZSBhbGwgd2luZG93IGNvbnRyb2wgbWV0aG9kcy5cblxuLyoqXG4gKiBPcGVuIGEgc2Vjb25kYXJ5IHdpbmRvdyBydW5uaW5nIGFuIGluZGVwZW5kZW50IGluc3RhbmNlIG9mIHRoZSBhcHAuXG4gKiBSZXR1cm5zIGEgaGFuZGxlIG9iamVjdCB1c2FibGUgd2l0aCB0aGUgYGlwY2AgQVBJLlxuICpcbiAqIEBwYXJhbSB7eyB0aXRsZT86IHN0cmluZywgd2lkdGg/OiBudW1iZXIsIGhlaWdodD86IG51bWJlciB9fSBvcHRzXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7IGlkOiBudW1iZXIsIHNlbmQ6IChtc2c6IHN0cmluZykgPT4gdm9pZCB9Pn1cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgd2luID0gYXdhaXQgZ2x5eFdpbmRvdy5jcmVhdGUoeyB0aXRsZTogJ0luc3BlY3RvcicsIHdpZHRoOiA0MDAsIGhlaWdodDogNjAwIH0pO1xuICogd2luLnNlbmQoSlNPTi5zdHJpbmdpZnkoeyB0eXBlOiAnaGVsbG8nIH0pKTtcbiAqL1xuZXhwb3J0IGNvbnN0IGdseXhXaW5kb3cgPSB7XG4gIHNldEZ1bGxzY3JlZW46ICAgKGZ1bGwpICA9PiB0eXBlb2YgX19nbHl4X3NldEZ1bGxzY3JlZW4gICAhPT0gJ3VuZGVmaW5lZCcgJiYgX19nbHl4X3NldEZ1bGxzY3JlZW4oZnVsbCksXG4gIHNldE1heGltaXplZDogICAgKG1heCkgICA9PiB0eXBlb2YgX19nbHl4X3NldE1heGltaXplZCAgICAhPT0gJ3VuZGVmaW5lZCcgJiYgX19nbHl4X3NldE1heGltaXplZChtYXgpLFxuICBzZXRNaW5pbWl6ZWQ6ICAgICgpICAgICAgPT4gdHlwZW9mIF9fZ2x5eF9zZXRNaW5pbWl6ZWQgICAgIT09ICd1bmRlZmluZWQnICYmIF9fZ2x5eF9zZXRNaW5pbWl6ZWQoKSxcbiAgaXNGdWxsc2NyZWVuOiAgICAoKSAgICAgID0+IHR5cGVvZiBfX2dseXhfaXNGdWxsc2NyZWVuICAgICE9PSAndW5kZWZpbmVkJyA/IF9fZ2x5eF9pc0Z1bGxzY3JlZW4oKSAgICA6IGZhbHNlLFxuICBpc01heGltaXplZDogICAgICgpICAgICAgPT4gdHlwZW9mIF9fZ2x5eF9pc01heGltaXplZCAgICAgIT09ICd1bmRlZmluZWQnID8gX19nbHl4X2lzTWF4aW1pemVkKCkgICAgIDogZmFsc2UsXG4gIGdldFdpbmRvd1NpemU6ICAgKCkgICAgICA9PiB0eXBlb2YgX19nbHl4X2dldFdpbmRvd1NpemUgICAhPT0gJ3VuZGVmaW5lZCcgPyBfX2dseXhfZ2V0V2luZG93U2l6ZSgpICAgOiB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAgfSxcbiAgZ2V0U2NyZWVuU2l6ZTogICAoKSAgICAgID0+IHR5cGVvZiBfX2dseXhfZ2V0U2NyZWVuU2l6ZSAgICE9PSAndW5kZWZpbmVkJyA/IF9fZ2x5eF9nZXRTY3JlZW5TaXplKCkgICA6IHsgd2lkdGg6IDAsIGhlaWdodDogMCB9LFxuICBzZXRBbHdheXNPblRvcDogIChvbikgICAgPT4gdHlwZW9mIF9fZ2x5eF9zZXRBbHdheXNPblRvcCAgIT09ICd1bmRlZmluZWQnICYmIF9fZ2x5eF9zZXRBbHdheXNPblRvcChvbiksXG4gIHNldFRpdGxlOiAgICAgICAgKHRpdGxlKSA9PiB0eXBlb2YgX19nbHl4X3NldFRpdGxlICAgICAgICAhPT0gJ3VuZGVmaW5lZCcgJiYgX19nbHl4X3NldFRpdGxlKHRpdGxlKSxcbiAgLyoqIFNldCB0aGUgbW91c2UgY3Vyc29yIGljb246ICdkZWZhdWx0JyB8ICdwb2ludGVyJyB8ICd0ZXh0JyB8ICdtb3ZlJyB8XG4gICAqICAnZ3JhYicgfCAnZ3JhYmJpbmcnIHwgJ2NvbC1yZXNpemUnIHwgJ3Jvdy1yZXNpemUnIHwgJ2V3LXJlc2l6ZScgfFxuICAgKiAgJ25zLXJlc2l6ZScgfCAnY3Jvc3NoYWlyJyB8ICdub3QtYWxsb3dlZCcgfCAnd2FpdCcuICovXG4gIHNldEN1cnNvcjogICAgICAgKG5hbWUpICA9PiB0eXBlb2YgX19nbHl4X3NldEN1cnNvciAgICAgICAhPT0gJ3VuZGVmaW5lZCcgJiYgX19nbHl4X3NldEN1cnNvcihuYW1lKSxcbiAgLyoqIEltbWVkaWF0ZWx5IHJ1biBWOCBHQyArIG1pbWFsbG9jIHNlZ21lbnQgZGVjb21taXQuIFRoZSBmcmFtZXdvcmsgZG9lc1xuICAgKiAgdGhpcyBhdXRvbWF0aWNhbGx5IG9uIGZvY3VzIGxvc3M7IGNhbGwgbWFudWFsbHkgYXQgbGV2ZWwgdHJhbnNpdGlvbnMgb3JcbiAgICogIGxvYWRpbmcgc2NyZWVucyBmb3IgZmFzdGVyIG1lbW9yeSByZWNvdmVyeS4gKi9cbiAgY29sbGVjdE1lbW9yeTogICAoKSAgICAgID0+IHR5cGVvZiBfX2dseXhfY29sbGVjdF9tZW1vcnkgICE9PSAndW5kZWZpbmVkJyAmJiBfX2dseXhfY29sbGVjdF9tZW1vcnkoKSxcbiAgLyoqIE9wZW4gYW4gaHR0cChzKS9tYWlsdG8gVVJMIGluIHRoZSBPUyBkZWZhdWx0IGFwcCAoYnJvd3NlcikuICovXG4gIG9wZW5FeHRlcm5hbDogICAgKHVybCkgICA9PiB0eXBlb2YgX19nbHl4X29wZW5fZXh0ZXJuYWwgICAhPT0gJ3VuZGVmaW5lZCcgJiYgX19nbHl4X29wZW5fZXh0ZXJuYWwodXJsKSxcbn07XG5cbmdseXhXaW5kb3cuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKG9wdHMgPSB7fSkge1xuICBpZiAodHlwZW9mIF9fZ2x5eF93aW5kb3dfY3JlYXRlID09PSAndW5kZWZpbmVkJykgcmV0dXJuIF9ub0JpbmRpbmcoJ2dseXhXaW5kb3cuY3JlYXRlJyk7XG4gIHJldHVybiBfX2dseXhfd2luZG93X2NyZWF0ZShKU09OLnN0cmluZ2lmeShvcHRzKSkudGhlbihpZFN0ciA9PiB7XG4gICAgY29uc3QgaWQgPSBOdW1iZXIoaWRTdHIpO1xuICAgIHJldHVybiB7XG4gICAgICBnZXQgaWQoKSB7IHJldHVybiBpZDsgfSxcbiAgICAgIHNlbmQobXNnKSB7IGlwYy5zZW5kKGlkLCBtc2cpOyB9LFxuICAgIH07XG4gIH0pO1xufTtcblxuLyoqXG4gKiBRdWl0IHRoZSBhcHBsaWNhdGlvbiBcdTIwMTQgY2xvc2VzIGFsbCB3aW5kb3dzIGFuZCBleGl0cyB0aGUgZXZlbnQgbG9vcC5cbiAqIFNhZmUgdG8gY2FsbCBmcm9tIGFueSB3aW5kb3cuXG4gKi9cbmdseXhXaW5kb3cucXVpdCA9IGZ1bmN0aW9uIHF1aXQoKSB7XG4gIGlmICh0eXBlb2YgX19nbHl4X3F1aXQgIT09ICd1bmRlZmluZWQnKSBfX2dseXhfcXVpdCgpO1xufTtcblxuLyoqXG4gKiBSZXN0YXJ0IHRoZSBhcHBsaWNhdGlvbiBcdTIwMTQgcXVpdHMgY2xlYW5seSB0aGVuIHJlLWxhdW5jaGVzIHRoZSBzYW1lIGV4ZWN1dGFibGUuXG4gKiBVc2VmdWwgYWZ0ZXIgYXBwbHlpbmcgYW4gdXBkYXRlIG9yIHNldHRpbmdzIHRoYXQgcmVxdWlyZSBhIGZ1bGwgcmVsb2FkLlxuICovXG5nbHl4V2luZG93LnJlc3RhcnQgPSBmdW5jdGlvbiByZXN0YXJ0KCkge1xuICBpZiAodHlwZW9mIF9fZ2x5eF9yZXN0YXJ0ICE9PSAndW5kZWZpbmVkJykgX19nbHl4X3Jlc3RhcnQoKTtcbn07XG5cbi8qKlxuICogQ2xvc2UgdGhlIHdpbmRvdyAobWFpbiB3aW5kb3c6IGV4aXRzIHRoZSBhcHA7IHNlY29uZGFyeSB3aW5kb3dzOiBjbG9zZXMgdGhhdCB3aW5kb3cpLlxuICogSW4gdGhlIGN1cnJlbnQgaW1wbGVtZW50YXRpb24gdGhpcyBpcyBlcXVpdmFsZW50IHRvIGBnbHl4V2luZG93LnF1aXQoKWAuXG4gKi9cbmdseXhXaW5kb3cuY2xvc2UgPSBmdW5jdGlvbiBjbG9zZSgpIHtcbiAgaWYgKHR5cGVvZiBfX2dseXhfd2luZG93X2Nsb3NlICE9PSAndW5kZWZpbmVkJykgX19nbHl4X3dpbmRvd19jbG9zZSgpO1xufTtcblxuLyoqIENhY2hlIHNvIHBsYXRmb3JtKCkgbmV2ZXIgY2FsbHMgdGhlIGJpbmRpbmcgdHdpY2UuICovXG5sZXQgX3BsYXRmb3JtQ2FjaGUgPSBudWxsO1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGhvc3QgT1M6IGBcIndpbmRvd3NcImAgfCBgXCJtYWNvc1wiYCB8IGBcImxpbnV4XCJgLlxuICogVmFsdWUgaXMgZGV0ZXJtaW5lZCBhdCBjb21waWxlIHRpbWUgYW5kIG5ldmVyIGNoYW5nZXMgYXQgcnVudGltZS5cbiAqL1xuZ2x5eFdpbmRvdy5wbGF0Zm9ybSA9IGZ1bmN0aW9uIHBsYXRmb3JtKCkge1xuICBpZiAoX3BsYXRmb3JtQ2FjaGUgIT09IG51bGwpIHJldHVybiBfcGxhdGZvcm1DYWNoZTtcbiAgX3BsYXRmb3JtQ2FjaGUgPSB0eXBlb2YgX19nbHl4X3BsYXRmb3JtICE9PSAndW5kZWZpbmVkJyA/IF9fZ2x5eF9wbGF0Zm9ybSgpIDogJ3Vua25vd24nO1xuICByZXR1cm4gX3BsYXRmb3JtQ2FjaGU7XG59O1xuXG4vKipcbiAqIEhpZGUgdGhlIHNwbGFzaCBzY3JlZW4gb3ZlcmxheSBwcm9ncmFtbWF0aWNhbGx5LlxuICpcbiAqIENhbGwgdGhpcyBvbmNlIHlvdXIgYXBwIGhhcyBsb2FkZWQgaXRzIGluaXRpYWwgZGF0YSBhbmQgaXMgcmVhZHkgdG8gc2hvd1xuICogdGhlIG1haW4gVUkuIElmIGBtaW5pbXVtTXNgIGlzIGNvbmZpZ3VyZWQgaW4gZ2x5eC5jb25maWcuanNvbiwgdGhlIHNwbGFzaFxuICogc3RheXMgdmlzaWJsZSBmb3IgYXQgbGVhc3QgdGhhdCBkdXJhdGlvbiBldmVuIGFmdGVyIHRoaXMgY2FsbC5cbiAqL1xuZ2x5eFdpbmRvdy5oaWRlU3BsYXNoID0gZnVuY3Rpb24gaGlkZVNwbGFzaCgpIHtcbiAgaWYgKHR5cGVvZiBfX2dseXhfc3BsYXNoX2hpZGUgIT09ICd1bmRlZmluZWQnKSBfX2dseXhfc3BsYXNoX2hpZGUoKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBDcmFzaCByZXBvcnRlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqXG4gKiBDcmFzaCByZXBvcnRlciBBUEkuXG4gKlxuICogUmVxdWlyZXMgYGNyYXNoOiB0cnVlYCBpbiBnbHl4LmNvbmZpZy5qc29uLlxuICpcbiAqIEpTIGVycm9ycyBhcmUgY2FwdHVyZWQgYXV0b21hdGljYWxseSB2aWEgYGdsb2JhbFRoaXMub25lcnJvcmAgYW5kXG4gKiBgZ2xvYmFsVGhpcy5vbnVuaGFuZGxlZHJlamVjdGlvbmAuIFVzZSBgY3Jhc2guZ2V0UmVwb3J0cygpYCBvbiBuZXh0XG4gKiBsYXVuY2ggdG8gZGV0ZWN0IHByaW9yIGNyYXNoZXMgYW5kIG9mZmVyIGRpYWdub3N0aWMgb3B0aW9ucy5cbiAqL1xuZXhwb3J0IGNvbnN0IGNyYXNoID0ge1xuICAvKiogQHByaXZhdGUgXHUyMDE0IGNvbmZpZ3VyYWJsZSBlbmRwb2ludCBVUkwgZm9yIHJlcG9ydCB1cGxvYWQgKi9cbiAgX2VuZHBvaW50OiBudWxsLFxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBhbGwgc3RvcmVkIGNyYXNoIHJlcG9ydHMuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHtmaWxlOnN0cmluZywgY29udGVudDpzdHJpbmd9W10+fVxuICAgKi9cbiAgYXN5bmMgZ2V0UmVwb3J0cygpIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShhd2FpdCBfX2dseXhfY3Jhc2hfZ2V0X3JlcG9ydHMoKSk7XG4gIH0sXG5cbiAgLyoqIERlbGV0ZSBhbGwgc3RvcmVkIGNyYXNoIHJlcG9ydHMgZnJvbSBkaXNrLiAqL1xuICBjbGVhclJlcG9ydHMoKSB7XG4gICAgaWYgKHR5cGVvZiBfX2dseXhfY3Jhc2hfY2xlYXJfcmVwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIF9fZ2x5eF9jcmFzaF9jbGVhcl9yZXBvcnRzKCk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBDb25maWd1cmUgYW4gZW5kcG9pbnQgVVJMIHRoYXQgY3Jhc2ggcmVwb3J0cyBhcmUgUE9TVGVkIHRvIG9uIG5leHQgbGF1bmNoLlxuICAgKiBUaGUgdXBsb2FkIGl0c2VsZiBpcyBwZXJmb3JtZWQgYnkgdGhlIGFwcCBcdTIwMTQgdGhpcyBvbmx5IHN0b3JlcyB0aGUgVVJMLlxuICAgKiBAcGFyYW0ge3N0cmluZ3xudWxsfSB1cmwgIEZ1bGwgVVJMIChIVFRQUyByZWNvbW1lbmRlZCkuIFBhc3MgbnVsbCB0byBkaXNhYmxlLlxuICAgKi9cbiAgc2V0RW5kcG9pbnQodXJsKSB7XG4gICAgY3Jhc2guX2VuZHBvaW50ID0gdXJsO1xuICB9LFxufTtcblxuLy8gQXV0b21hdGljYWxseSBjYXB0dXJlIEpTIGVycm9ycyBhbmQgdW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9ucy5cbi8vIFRoZXNlIGFyZSBzdG9yZWQgb24gZGlzayBzbyB0aGV5IHN1cnZpdmUgdGhlIGN1cnJlbnQgcHJvY2Vzcy5cbi8vIFJlcXVpcmVzIGBjcmFzaDogdHJ1ZWAgaW4gZ2x5eC5jb25maWcuanNvbiAodGhlIGJpbmRpbmcgdGhyb3dzIGlmIG5vdCBzZXQpLlxuKGZ1bmN0aW9uIF9pbnN0YWxsQ3Jhc2hIYW5kbGVycygpIHtcbiAgZnVuY3Rpb24gX3JlcG9ydChkYXRhKSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0eXBlb2YgX19nbHl4X2NyYXNoX3JlcG9ydF9qcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgX19nbHl4X2NyYXNoX3JlcG9ydF9qcyhKU09OLnN0cmluZ2lmeShkYXRhKSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoXykge31cbiAgfVxuXG4gIGNvbnN0IHByZXZPbmVycm9yID0gZ2xvYmFsVGhpcy5vbmVycm9yO1xuICBnbG9iYWxUaGlzLm9uZXJyb3IgPSBmdW5jdGlvbihtc2csIHNyYywgbGluZSwgY29sLCBlcnIpIHtcbiAgICBfcmVwb3J0KHtcbiAgICAgIHR5cGU6ICAgICdqc19lcnJvcicsXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICBtZXNzYWdlOiBTdHJpbmcobXNnIHx8ICcnKSxcbiAgICAgIHNvdXJjZTogIFN0cmluZyhzcmMgfHwgJycpLFxuICAgICAgbGluZTogICAgbGluZSB8fCAwLFxuICAgICAgY29sOiAgICAgY29sICB8fCAwLFxuICAgICAgc3RhY2s6ICAgZXJyICYmIGVyci5zdGFjayA/IFN0cmluZyhlcnIuc3RhY2spIDogJycsXG4gICAgfSk7XG4gICAgaWYgKHR5cGVvZiBwcmV2T25lcnJvciA9PT0gJ2Z1bmN0aW9uJykgcHJldk9uZXJyb3IobXNnLCBzcmMsIGxpbmUsIGNvbCwgZXJyKTtcbiAgfTtcblxuICBjb25zdCBwcmV2VW5oYW5kbGVkID0gZ2xvYmFsVGhpcy5vbnVuaGFuZGxlZHJlamVjdGlvbjtcbiAgZ2xvYmFsVGhpcy5vbnVuaGFuZGxlZHJlamVjdGlvbiA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgY29uc3QgcmVhc29uID0gZXZlbnQgJiYgZXZlbnQucmVhc29uO1xuICAgIF9yZXBvcnQoe1xuICAgICAgdHlwZTogICAgJ3VuaGFuZGxlZF9yZWplY3Rpb24nLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgbWVzc2FnZTogcmVhc29uIGluc3RhbmNlb2YgRXJyb3IgPyByZWFzb24ubWVzc2FnZSA6IFN0cmluZyhyZWFzb24gfHwgJycpLFxuICAgICAgc3RhY2s6ICAgcmVhc29uIGluc3RhbmNlb2YgRXJyb3IgJiYgcmVhc29uLnN0YWNrID8gU3RyaW5nKHJlYXNvbi5zdGFjaykgOiAnJyxcbiAgICB9KTtcbiAgICBpZiAodHlwZW9mIHByZXZVbmhhbmRsZWQgPT09ICdmdW5jdGlvbicpIHByZXZVbmhhbmRsZWQoZXZlbnQpO1xuICB9O1xufSkoKTtcblxuLy8gXHUyNTAwXHUyNTAwIEJhY2tlbmQgY29tbWFuZCBkaXNwYXRjaCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBDYWxscyBuYXRpdmUgUnVzdCBjb21tYW5kcyByZWdpc3RlcmVkIHZpYSBHbHl4RXh0ZW5zaW9uOjpyZWdpc3Rlcl9jb21tYW5kcygpLlxuLy9cbi8vIFVzYWdlIChKUyk6XG4vLyAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJhY2tlbmQuZ3JlZXQoeyBuYW1lOiAnQWxpY2UnIH0pO1xuLy9cbi8vIFRoZSBSdXN0IHNpZGU6XG4vLyAgIGNtZHMuYWRkKFwiZ3JlZXRcIiwgfGFyZ3NfanNvbnwgYXN5bmMgbW92ZSB7XG4vLyAgICAgbGV0IHY6IHNlcmRlX2pzb246OlZhbHVlID0gc2VyZGVfanNvbjo6ZnJvbV9zdHIoJmFyZ3NfanNvbik/O1xuLy8gICAgIE9rKGZvcm1hdCEoXCJcXFwiSGVsbG8sIHt9IVxcXCJcIiwgdltcIm5hbWVcIl0uYXNfc3RyKCkudW53cmFwX29yKFwid29ybGRcIikpKVxuLy8gICB9KTtcbi8vXG4vLyBgYmFja2VuZGAgaXMgYSBQcm94eSBzbyBhbnkgcHJvcGVydHkgYWNjZXNzIHJldHVybnMgYW4gYXN5bmMgZnVuY3Rpb24uXG4vLyBUaGUgcmVzb2x2ZWQgdmFsdWUgaXMgSlNPTi1wYXJzZWQgXHUyMDE0IHJldHVybiBhIEpTT04gc3RyaW5nIGZyb20gUnVzdC9KUyBwbHVnaW4uXG4vL1xuLy8gVHdvIGNhbGwgc3R5bGVzIGFyZSBzdXBwb3J0ZWQ6XG4vLyAgIGJhY2tlbmQubXlDb21tYW5kKGFyZ3MpICAgICAgICBcdTIwMTQgZmxhdCBSdXN0IGNvbW1hbmRcbi8vICAgYmFja2VuZC5kYi5nZXRVc2VycyhhcmdzKSAgICAgIFx1MjAxNCBuYW1lc3BhY2VkIEpTIHBsdWdpbiBjb21tYW5kIChcImRiLmdldFVzZXJzXCIpXG4vL1xuLy8gYGJhY2tlbmQuZGJgIHJldHVybnMgYSBuYW1lc3BhY2UgUHJveHk7IGNhbGxpbmcgaXQgZGlyZWN0bHkgYWxzbyB3b3Jrc1xuLy8gKGJhY2tlbmQuZGIoYXJncykgZGlzcGF0Y2hlcyBcImRiXCIpIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5LlxuXG5mdW5jdGlvbiBfYmFja2VuZENhbGwoY21kLCBhcmdzKSB7XG4gIHZhciBqc29uID0gYXJncyA9PT0gdW5kZWZpbmVkID8gJ3t9JyA6IEpTT04uc3RyaW5naWZ5KGFyZ3MpO1xuICByZXR1cm4gX19nbHl4X2JhY2tlbmRfY2FsbChjbWQsIGpzb24pLnRoZW4oZnVuY3Rpb24ocmF3KSB7XG4gICAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UocmF3KTsgfSBjYXRjaCAoXykgeyByZXR1cm4gcmF3OyB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBfYmFja2VuZE5zKHByZWZpeCkge1xuICAvLyBBIFByb3h5IG92ZXIgYSBmdW5jdGlvbiBzbyBpdCdzIGJvdGggY2FsbGFibGUgKGJhY2tlbmQuY21kKGFyZ3MpKSBhbmRcbiAgLy8gaGFzIHByb3BlcnRpZXMgKGJhY2tlbmQubnMuZm4oYXJncykpLlxuICByZXR1cm4gbmV3IFByb3h5KGZ1bmN0aW9uKCkge30sIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKF8sIGZuKSB7XG4gICAgICBpZiAodHlwZW9mIGZuICE9PSAnc3RyaW5nJykgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiBmdW5jdGlvbihhcmdzKSB7IHJldHVybiBfYmFja2VuZENhbGwocHJlZml4ICsgJy4nICsgZm4sIGFyZ3MpOyB9O1xuICAgIH0sXG4gICAgYXBwbHk6IGZ1bmN0aW9uKF8sIF9fLCBhKSB7IHJldHVybiBfYmFja2VuZENhbGwocHJlZml4LCBhWzBdKTsgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBjb25zdCBiYWNrZW5kID0gbmV3IFByb3h5KE9iamVjdC5jcmVhdGUobnVsbCksIHtcbiAgZ2V0OiBmdW5jdGlvbihfLCBuYW1lKSB7XG4gICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICByZXR1cm4gX2JhY2tlbmROcyhuYW1lKTtcbiAgfSxcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgUGVyZm9ybWFuY2UgbW9uaXRvcmluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqXG4gKiBQZXJmb3JtYW5jZSBtb25pdG9yaW5nIEFQSS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgc25hcCA9IHBlcmYuc25hcHNob3QoKTtcbiAqIC8vIFx1MjE5MiB7IGZwczogNjAuMSwgZnJhbWVUaW1lOiAxNC4yLCBmcmFtZVRpbWVQOTk6IDE4LjUsIGpzVGltZTogMi4xLFxuICogLy8gICAgICBsYXlvdXRUaW1lOiAwLjgsIGdwdVRpbWU6IDEuMywgbWVtb3J5SlM6IDEyLjQsIG5vZGVDb3VudDogNDIgfVxuICpcbiAqIGNvbnN0IHVuc3ViID0gcGVyZi5vbkJ1ZGdldEV4Y2VlZGVkKCh2KSA9PiBjb25zb2xlLmxvZygnc2xvdyBmcmFtZTonLCB2KSwgeyB0YXJnZXQ6IDE2LjY2NyB9KTtcbiAqIHVuc3ViKCk7IC8vIHJlbW92ZSBsaXN0ZW5lclxuICovXG5leHBvcnQgY29uc3QgcGVyZiA9IHtcbiAgLyoqXG4gICAqIFN5bmNocm9ub3VzbHkgcmV0dXJucyBhIHNuYXBzaG90IG9mIGN1cnJlbnQgcGVyZm9ybWFuY2UgbWV0cmljcy5cbiAgICogQHJldHVybnMge3sgZnBzLCBmcmFtZVRpbWUsIGZyYW1lVGltZVA5OSwganNUaW1lLCBsYXlvdXRUaW1lLCBncHVUaW1lLCBtZW1vcnlKUywgbm9kZUNvdW50IH19XG4gICAqL1xuICBzbmFwc2hvdCgpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9wZXJmX3NuYXBzaG90ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIG51bGw7XG4gICAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UoX19nbHl4X3BlcmZfc25hcHNob3QoKSk7IH0gY2F0Y2ggeyByZXR1cm4gbnVsbDsgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGNhbGxiYWNrIGZpcmVkIHdoZW5ldmVyIGEgZnJhbWUgZXhjZWVkcyBgdGFyZ2V0YCBtcy5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2IgIENhbGxlZCB3aXRoIGB7IGJ1ZGdldCwgYWN0dWFsLCBqc1RpbWUsIGxheW91dFRpbWUgfWBcbiAgICogQHBhcmFtIHt7IHRhcmdldD86IG51bWJlciB9fSBvcHRzICBEZWZhdWx0IHRhcmdldCA9IDE2LjY2NyBtcyAoNjAgZnBzKVxuICAgKiBAcmV0dXJucyB7ZnVuY3Rpb259IFVuc3Vic2NyaWJlIGZ1bmN0aW9uXG4gICAqL1xuICBvbkJ1ZGdldEV4Y2VlZGVkKGNiLCB7IHRhcmdldCA9IDE2LjY2NyB9ID0ge30pIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9wZXJmX3NldF9idWRnZXQgIT09ICd1bmRlZmluZWQnKSBfX2dseXhfcGVyZl9zZXRfYnVkZ2V0KHRhcmdldCk7XG4gICAgX3BlcmZCdWRnZXRDYWxsYmFja3MucHVzaChjYik7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIHVuc3Vic2NyaWJlKCkge1xuICAgICAgY29uc3QgaWR4ID0gX3BlcmZCdWRnZXRDYWxsYmFja3MuaW5kZXhPZihjYik7XG4gICAgICBpZiAoaWR4ICE9PSAtMSkgX3BlcmZCdWRnZXRDYWxsYmFja3Muc3BsaWNlKGlkeCwgMSk7XG4gICAgfTtcbiAgfSxcbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgY2FsbGJhY2sgZm9yIGRldi1tb2RlIG1lbW9yeS9ub2RlIGxlYWsgd2FybmluZ3MuXG4gICAqIEZpcmVzIHdoZW4gdGhlIFJ1c3QgbGF5ZXIgZGV0ZWN0cyBhIHN1c3RhaW5lZCBtb25vdG9uaWMgZ3Jvd3RoIGluIG5vZGUgY291bnQuXG4gICAqIE9ubHkgYWN0aXZlIGluIGRldiBidWlsZHMgKG5vLW9wIGluIHByb2R1Y3Rpb24pLlxuICAgKiBAcGFyYW0geyh3YXJuaW5nOiB7dHlwZTogc3RyaW5nLCBjb3VudDogbnVtYmVyLCBtc2c6IHN0cmluZ30pID0+IHZvaWR9IGNiXG4gICAqIEByZXR1cm5zIHsoKSA9PiB2b2lkfSB1bnN1YnNjcmliZSBmdW5jdGlvblxuICAgKi9cbiAgb25MZWFrRGV0ZWN0ZWQoY2IpIHtcbiAgICBfcGVyZkxlYWtDYWxsYmFja3MucHVzaChjYik7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIHVuc3Vic2NyaWJlKCkge1xuICAgICAgY29uc3QgaWR4ID0gX3BlcmZMZWFrQ2FsbGJhY2tzLmluZGV4T2YoY2IpO1xuICAgICAgaWYgKGlkeCAhPT0gLTEpIF9wZXJmTGVha0NhbGxiYWNrcy5zcGxpY2UoaWR4LCAxKTtcbiAgICB9O1xuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIE9TIHN5c3RlbSBBUElzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY29uc3QgYmF0dGVyeSA9IHtcbiAgLyoqIEByZXR1cm5zIHtQcm9taXNlPHtsZXZlbDpudW1iZXIsIGNoYXJnaW5nOmJvb2xlYW4sIHRpbWVSZW1haW5pbmdTZWNzOm51bWJlcnxudWxsfXxudWxsPn0gKi9cbiAgYXN5bmMgZ2V0U3RhdHVzKCkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X2JhdHRlcnlfZ2V0U3RhdHVzID09PSAndW5kZWZpbmVkJykgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcmF3ID0gYXdhaXQgX19nbHl4X2JhdHRlcnlfZ2V0U3RhdHVzKCk7XG4gICAgcmV0dXJuIHJhdyA9PT0gJ251bGwnID8gbnVsbCA6IEpTT04ucGFyc2UocmF3KTtcbiAgfSxcbn07XG5cbmV4cG9ydCBjb25zdCBzeXN0ZW0gPSB7XG4gIC8qKlxuICAgKiBTdWJzY3JpYmUgdG8gYSBzeXN0ZW0gbWV0cmljIFx1MjAxNCBcImRvbid0IHBvbGw7IHN1YnNjcmliZS5cIlxuICAgKlxuICAgKiBBIFJVU1Qtc2lkZSBwb2xsZXIgcmVhZHMgdGhlIG1ldHJpYyBvbiBhIHRpbWVyIGFuZCBmaXJlcyBgY2JgIE9OTFkgd2hlblxuICAgKiB0aGUgdmFsdWUgY2hhbmdlczsgVjggc3RheXMgY29tcGxldGVseSBpZGxlIGJldHdlZW4gY2hhbmdlcy4gIFVzZSB0aGlzXG4gICAqIGluc3RlYWQgb2Ygc2V0SW50ZXJ2YWwgKyBnZXRJbmZvKCkvZ2V0U3RhdHVzKCkgZm9yIGxpdmUgZGlzcGxheXMuXG4gICAqXG4gICAqIEtpbmRzIGFuZCBwYXlsb2FkczpcbiAgICogICAnYmF0dGVyeScgICAgICBcdTIxOTIgeyBsZXZlbCwgY2hhcmdpbmcsIHRpbWVSZW1haW5pbmdTZWNzIH0gfCBudWxsXG4gICAqICAgJ21lbW9yeScgICAgICAgXHUyMTkyIHsgdXNlZE1iLCB0b3RhbE1iIH1cbiAgICogICAnZGFya01vZGUnICAgICBcdTIxOTIgJ2RhcmsnIHwgJ2xpZ2h0JyB8ICd1bmtub3duJ1xuICAgKiAgICdiYXR0ZXJ5U2F2ZXInIFx1MjE5MiBib29sZWFuXG4gICAqXG4gICAqIEBwYXJhbSB7J2JhdHRlcnknfCdtZW1vcnknfCdkYXJrTW9kZSd8J2JhdHRlcnlTYXZlcid9IGtpbmRcbiAgICogQHBhcmFtIHsodmFsdWU6IGFueSkgPT4gdm9pZH0gY2JcbiAgICogQHBhcmFtIHt7IGludGVydmFsTXM/OiBudW1iZXIgfX0gW29wdHNdICBQb2xsIGNhZGVuY2UgKGZsb29yIDEwMDBtcztcbiAgICogICBkZWZhdWx0czogMnMgZm9yIGRhcmtNb2RlL2JhdHRlcnlTYXZlciwgMTBzIGZvciBiYXR0ZXJ5L21lbW9yeSkuXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IHdhdGNoIGlkIFx1MjAxNCBwYXNzIHRvIGBzeXN0ZW0udW53YXRjaChpZClgLlxuICAgKi9cbiAgd2F0Y2goa2luZCwgY2IsIG9wdHMpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9zeXN0ZW1fd2F0Y2ggPT09ICd1bmRlZmluZWQnKSByZXR1cm4gMDtcbiAgICBjb25zdCBpZCA9IF9fZ2x5eF9zeXN0ZW1fd2F0Y2goa2luZCwgKG9wdHMgJiYgb3B0cy5pbnRlcnZhbE1zKSB8fCAwKTtcbiAgICBpZiAoaWQgPiAwKSByZWdpc3RlclN5c3RlbVdhdGNoKGlkLCBjYik7XG4gICAgcmV0dXJuIGlkO1xuICB9LFxuICAvKiogU3RvcCBhIGBzeXN0ZW0ud2F0Y2hgIHN1YnNjcmlwdGlvbi4gKi9cbiAgdW53YXRjaChpZCkge1xuICAgIGlmICghaWQpIHJldHVybjtcbiAgICB1bnJlZ2lzdGVyU3lzdGVtV2F0Y2goaWQpO1xuICAgIGlmICh0eXBlb2YgX19nbHl4X3N5c3RlbV91bndhdGNoICE9PSAndW5kZWZpbmVkJykgX19nbHl4X3N5c3RlbV91bndhdGNoKGlkKTtcbiAgfSxcbiAgLyoqIEByZXR1cm5zIHtQcm9taXNlPHtjcHVOYW1lLGNwdUNvcmVzLG1lbW9yeVRvdGFsTWIsbWVtb3J5VXNlZE1iLG9zTmFtZSxvc1ZlcnNpb259Pn0gKi9cbiAgYXN5bmMgZ2V0SW5mbygpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9zeXN0ZW1fZ2V0SW5mbyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBKU09OLnBhcnNlKGF3YWl0IF9fZ2x5eF9zeXN0ZW1fZ2V0SW5mbygpKTtcbiAgfSxcbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIE9TLWxldmVsIGNvbG9yIHNjaGVtZSBwcmVmZXJlbmNlIHN5bmNocm9ub3VzbHkgKH4xIFx1MDBCNXMpLlxuICAgKiBAcmV0dXJucyB7XCJkYXJrXCJ8XCJsaWdodFwifFwidW5rbm93blwifVxuICAgKi9cbiAgZ2V0RGFya01vZGUoKSB7XG4gICAgaWYgKHR5cGVvZiBfX2dseXhfc3lzdGVtX2dldERhcmtNb2RlID09PSAndW5kZWZpbmVkJykgcmV0dXJuICd1bmtub3duJztcbiAgICByZXR1cm4gX19nbHl4X3N5c3RlbV9nZXREYXJrTW9kZSgpO1xuICB9LFxuICAvKipcbiAgICogUmV0dXJucyB3aGV0aGVyIGJhdHRlcnktc2F2ZXIgLyBwb3dlci1zYXZlciBtb2RlIGlzIGFjdGl2ZSBzeW5jaHJvbm91c2x5ICh+MSBcdTAwQjVzKS5cbiAgICogV2luZG93czogcmVhZHMgR2V0U3lzdGVtUG93ZXJTdGF0dXMoKS4gbWFjT1MvTGludXg6IGFsd2F5cyBmYWxzZSB1bnRpbCBuYXRpdmUgc3VwcG9ydCBsYW5kcy5cbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqL1xuICBpc0JhdHRlcnlTYXZlckFjdGl2ZSgpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9zeXN0ZW1fZ2V0QmF0dGVyeVNhdmVyID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBfX2dseXhfc3lzdGVtX2dldEJhdHRlcnlTYXZlcigpO1xuICB9LFxufTtcblxuZXhwb3J0IGNvbnN0IHBvd2VyID0ge1xuICAvKiogUHJldmVudCBzeXN0ZW0gc2xlZXAuIFJldHVybnMgYSBndWFyZCBoYW5kbGUgc3RyaW5nLiAqL1xuICBwcmV2ZW50U2xlZXAocmVhc29uID0gJ0dseXggYXBwIHJ1bm5pbmcnKSB7XG4gICAgaWYgKHR5cGVvZiBfX2dseXhfcG93ZXJfcHJldmVudFNsZWVwID09PSAndW5kZWZpbmVkJykgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIF9fZ2x5eF9wb3dlcl9wcmV2ZW50U2xlZXAocmVhc29uKTtcbiAgfSxcbiAgLyoqIFJlbGVhc2Ugc2xlZXAgcHJldmVudGlvbiBndWFyZCBieSBoYW5kbGUgc3RyaW5nLiAqL1xuICBhbGxvd1NsZWVwKGhhbmRsZSkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X3Bvd2VyX2FsbG93U2xlZXAgIT09ICd1bmRlZmluZWQnKSBfX2dseXhfcG93ZXJfYWxsb3dTbGVlcChoYW5kbGUpO1xuICB9LFxufTtcblxuZXhwb3J0IGNvbnN0IHN0b3JhZ2UgPSB7XG4gIC8qKiBAcmV0dXJucyB7UHJvbWlzZTxBcnJheTx7bmFtZSxtb3VudFBvaW50LHRvdGFsQnl0ZXMsYXZhaWxhYmxlQnl0ZXN9Pj59ICovXG4gIGFzeW5jIGdldERyaXZlcygpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9zdG9yYWdlX2dldERyaXZlcyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBbXTtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShhd2FpdCBfX2dseXhfc3RvcmFnZV9nZXREcml2ZXMoKSk7XG4gIH0sXG59O1xuXG4vKipcbiAqIE9TIGNyZWRlbnRpYWwgc3RvcmUgXHUyMDE0IFdpbmRvd3MgQ3JlZGVudGlhbCBNYW5hZ2VyLCBtYWNPUyBLZXljaGFpbiwgTGludXggU2VjcmV0IFNlcnZpY2UuXG4gKiBEYXRhIGlzIGVuY3J5cHRlZCBieSB0aGUgT1MgYW5kIHRpZWQgdG8gdGhlIGxvZ2dlZC1pbiB1c2VyIGFjY291bnQuXG4gKiBOZXZlciBzdG9yZWQgYXMgcGxhaW50ZXh0IG9uIGRpc2suIFN1cnZpdmVzIGFwcCByZXN0YXJ0cy5cbiAqXG4gKiBVc2UgZm9yOiBhdXRoIHRva2Vucywgc2Vzc2lvbiBJRHMsIEFQSSBrZXlzIHRoZSB1c2VyIHByb3ZpZGVzIGF0IHJ1bnRpbWUuXG4gKiBEbyBOT1QgZW1iZWQgYnVpbGQtdGltZSBzZWNyZXRzIGluIHRoZSBiaW5hcnkgXHUyMDE0IHVzZSBhIGJhY2tlbmQgcHJveHkgaW5zdGVhZC5cbiAqXG4gKiBSZXF1aXJlcyBgY3JlZGVudGlhbHM6IHRydWVgIGluIGdseXguY29uZmlnLnRzIGNhcGFiaWxpdGllcy5cbiAqL1xuZXhwb3J0IGNvbnN0IGNyZWRlbnRpYWxzID0ge1xuICAvKipcbiAgICogU3RvcmUgYSBzZWNyZXQuIFJlcGxhY2VzIGFueSBleGlzdGluZyB2YWx1ZSBmb3IgdGhlIHNhbWUga2V5LlxuICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZVxuICAgKiBAcGFyYW0ge3sgc2VydmljZT86IHN0cmluZyB9fSBbb3B0aW9uc10gIHNlcnZpY2UgZGVmYXVsdHMgdG8gJ2dseXgnXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICAgKi9cbiAgYXN5bmMgc2V0KGtleSwgdmFsdWUsIHsgc2VydmljZSA9ICdnbHl4JyB9ID0ge30pIHtcbiAgICBhd2FpdCBfX2dseXhfY3JlZGVudGlhbHNfc2V0KHNlcnZpY2UsIGtleSwgdmFsdWUpO1xuICB9LFxuICAvKipcbiAgICogUmV0cmlldmUgYSBzZWNyZXQuIFJldHVybnMgbnVsbCBpZiBubyBlbnRyeSBleGlzdHMuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcbiAgICogQHBhcmFtIHt7IHNlcnZpY2U/OiBzdHJpbmcgfX0gW29wdGlvbnNdXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZ3xudWxsPn1cbiAgICovXG4gIGFzeW5jIGdldChrZXksIHsgc2VydmljZSA9ICdnbHl4JyB9ID0ge30pIHtcbiAgICBjb25zdCByYXcgPSBhd2FpdCBfX2dseXhfY3JlZGVudGlhbHNfZ2V0KHNlcnZpY2UsIGtleSk7XG4gICAgcmV0dXJuIHJhdyA9PT0gJ251bGwnID8gbnVsbCA6IEpTT04ucGFyc2UocmF3KTtcbiAgfSxcbiAgLyoqXG4gICAqIERlbGV0ZSBhIHNlY3JldC4gTm8tb3AgaWYgaXQgZG9lcyBub3QgZXhpc3QuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcbiAgICogQHBhcmFtIHt7IHNlcnZpY2U/OiBzdHJpbmcgfX0gW29wdGlvbnNdXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICAgKi9cbiAgYXN5bmMgZGVsZXRlKGtleSwgeyBzZXJ2aWNlID0gJ2dseXgnIH0gPSB7fSkge1xuICAgIGF3YWl0IF9fZ2x5eF9jcmVkZW50aWFsc19kZWxldGUoc2VydmljZSwga2V5KTtcbiAgfSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBdWRpbyBwbGF5YmFjayBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqXG4gKiBBdWRpbyBwbGF5YmFjayBBUEkuXG4gKlxuICogQ2FwYWJpbGl0eTogYGF1ZGlvOiB0cnVlYCBpbiBnbHl4LmNvbmZpZy5qc29uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBwbGF5ZXIgPSBhd2FpdCBhdWRpby5wbGF5KCcvcGF0aC90by9maWxlLm1wMycpO1xuICogcGxheWVyLnBhdXNlKCk7XG4gKiBwbGF5ZXIuc2V0Vm9sdW1lKDAuNSk7XG4gKiBwbGF5ZXIuc3RvcCgpO1xuICovXG5leHBvcnQgY29uc3QgYXVkaW8gPSB7XG4gIC8qKlxuICAgKiBQbGF5IGFuIGF1ZGlvIGZpbGUuIFJldHVybnMgYSBwbGF5ZXIgaGFuZGxlLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3JjICBBYnNvbHV0ZSBwYXRoIHRvIHRoZSBhdWRpbyBmaWxlIChtcDMsIGZsYWMsIG9nZywgd2F2KS5cbiAgICogQHBhcmFtIHt7IHZvbHVtZT86IG51bWJlciwgb25FbmRlZD86IGZ1bmN0aW9uIH19IFtvcHRzXVxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7IGlkOiBzdHJpbmcsIHBhdXNlLCByZXN1bWUsIHN0b3AsIHNldFZvbHVtZSwgZ2V0Vm9sdW1lIH0+fVxuICAgKi9cbiAgYXN5bmMgcGxheShzcmMsIHsgdm9sdW1lID0gMS4wLCBvbkVuZGVkIH0gPSB7fSkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X2F1ZGlvX3BsYXkgPT09ICd1bmRlZmluZWQnKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdhdWRpbyBiaW5kaW5nIHVuYXZhaWxhYmxlJyk7XG4gICAgY29uc3QgcmF3SWQgPSBhd2FpdCBfX2dseXhfYXVkaW9fcGxheShzcmMsIEpTT04uc3RyaW5naWZ5KHsgdm9sdW1lIH0pKTtcbiAgICBjb25zdCBpZCA9IFN0cmluZyhKU09OLnBhcnNlKHJhd0lkKSk7XG4gICAgaWYgKG9uRW5kZWQpIHtcbiAgICAgIGlmICghX2F1ZGlvQ2FsbGJhY2tzLmhhcyhpZCkpIF9hdWRpb0NhbGxiYWNrcy5zZXQoaWQsIFtdKTtcbiAgICAgIF9hdWRpb0NhbGxiYWNrcy5nZXQoaWQpLnB1c2goeyBvbkVuZGVkIH0pO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgaWQsXG4gICAgICBwYXVzZSgpICAgICAgICAgICB7IGlmICh0eXBlb2YgX19nbHl4X2F1ZGlvX3BhdXNlICAgICAhPT0gJ3VuZGVmaW5lZCcpIF9fZ2x5eF9hdWRpb19wYXVzZShpZCk7IH0sXG4gICAgICByZXN1bWUoKSAgICAgICAgICB7IGlmICh0eXBlb2YgX19nbHl4X2F1ZGlvX3Jlc3VtZSAgICAhPT0gJ3VuZGVmaW5lZCcpIF9fZ2x5eF9hdWRpb19yZXN1bWUoaWQpOyB9LFxuICAgICAgcGxheSgpICAgICAgICAgICAgeyBpZiAodHlwZW9mIF9fZ2x5eF9hdWRpb19yZXN1bWUgICAgIT09ICd1bmRlZmluZWQnKSBfX2dseXhfYXVkaW9fcmVzdW1lKGlkKTsgfSxcbiAgICAgIHN0b3AoKSAgICAgICAgICAgIHsgaWYgKHR5cGVvZiBfX2dseXhfYXVkaW9fc3RvcCAgICAgICE9PSAndW5kZWZpbmVkJykgX19nbHl4X2F1ZGlvX3N0b3AoaWQpOyBfYXVkaW9DYWxsYmFja3MuZGVsZXRlKGlkKTsgfSxcbiAgICAgIHNldFZvbHVtZSh2KSAgICAgIHsgaWYgKHR5cGVvZiBfX2dseXhfYXVkaW9fc2V0Vm9sdW1lICE9PSAndW5kZWZpbmVkJykgX19nbHl4X2F1ZGlvX3NldFZvbHVtZShpZCwgdik7IH0sXG4gICAgICBnZXRWb2x1bWUoKSAgICAgICB7IHJldHVybiB0eXBlb2YgX19nbHl4X2F1ZGlvX2dldFZvbHVtZSAhPT0gJ3VuZGVmaW5lZCcgPyBfX2dseXhfYXVkaW9fZ2V0Vm9sdW1lKGlkKSA6IDEuMDsgfSxcbiAgICAgIGdldFRpbWUoKSAgICAgICAgIHsgcmV0dXJuIHR5cGVvZiBfX2dseXhfYXVkaW9fZ2V0X3RpbWUgIT09ICd1bmRlZmluZWQnID8gX19nbHl4X2F1ZGlvX2dldF90aW1lKGlkKSA6IDAuMDsgfSxcbiAgICAgIGFzeW5jIGdldER1cmF0aW9uKCkgeyByZXR1cm4gdHlwZW9mIF9fZ2x5eF9hdWRpb19kdXJhdGlvbiAhPT0gJ3VuZGVmaW5lZCcgPyBwYXJzZUZsb2F0KGF3YWl0IF9fZ2x5eF9hdWRpb19kdXJhdGlvbihpZCkpIDogLTE7IH0sXG4gICAgICBhc3luYyBzZWVrKHNlY3MpICB7IGlmICh0eXBlb2YgX19nbHl4X2F1ZGlvX3NlZWsgIT09ICd1bmRlZmluZWQnKSBhd2FpdCBfX2dseXhfYXVkaW9fc2VlayhpZCwgc2Vjcyk7IH0sXG4gICAgICBvbkVuZGVkKGNiKSAgICAgICB7XG4gICAgICAgIGlmICghX2F1ZGlvQ2FsbGJhY2tzLmhhcyhpZCkpIF9hdWRpb0NhbGxiYWNrcy5zZXQoaWQsIFtdKTtcbiAgICAgICAgX2F1ZGlvQ2FsbGJhY2tzLmdldChpZCkucHVzaCh7IG9uRW5kZWQ6IGNiIH0pO1xuICAgICAgfSxcbiAgICB9O1xuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwIExvY2FsIEFJIChDYW5kbGUpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIENhcGFiaWxpdHkgZ2F0ZTogYGFpOiB0cnVlYCBpbiBnbHl4LmNvbmZpZy5qc29uLlxuLy9cbi8vIE1vZGVscyBhcmUgZG93bmxvYWRlZCBmcm9tIEh1Z2dpbmdGYWNlIEh1YiBvbiBmaXJzdCBjYWxsIGFuZCBjYWNoZWQgaW5cbi8vIH4vLmNhY2hlL2h1Z2dpbmdmYWNlLy4gU3Vic2VxdWVudCBjYWxscyByZXVzZSBjYWNoZWQgd2VpZ2h0cy5cbi8vXG4vLyBXQVJOSU5HOiBmaXJzdCBjYWxscyBibG9jayB1bnRpbCBkb3dubG9hZCBjb21wbGV0ZXM6XG4vLyAgIC0gYWkuZW1iZWQoKSAgICAgIFx1MjAxNCB+MjIgTUIgKE1pbmlMTS1MNi12MiksIGxvYWRzIGluIH4xcyBhZnRlciBkb3dubG9hZFxuLy8gICAtIGFpLmdlbmVyYXRlKCkgICBcdTIwMTQgfjEuNyBHQiAoUGhpLTIgUTRfS19NKSwgQ1BVIGluZmVyZW5jZSB+MTAtMzBzLzIwMCB0b2tlbnNcbi8vICAgLSBhaS50cmFuc2NyaWJlKCkgXHUyMDE0IH43NSBNQiAoV2hpc3Blci10aW55KSwgfjVzIGZvciBhIDMwcyBjbGlwXG5cbmV4cG9ydCBjb25zdCBhaSA9IHtcbiAgLyoqXG4gICAqIEVtYmVkIHRleHQgaW50byBhIDM4NC1kaW1lbnNpb25hbCB1bml0LW5vcm1hbGlzZWQgdmVjdG9yLlxuICAgKlxuICAgKiBVc2VzIHNlbnRlbmNlLXRyYW5zZm9ybWVycy9hbGwtTWluaUxNLUw2LXYyLiBTdWl0YWJsZSBmb3IgY29zaW5lLXNpbWlsYXJpdHlcbiAgICogc2VhcmNoIHdpdGggdGhlIGB2ZWN0b3JEYmAgQVBJIFx1MjAxNCByZXBsYWNlcyBrZXl3b3JkLWJhZyBmYWtlIGVtYmVkZGluZ3MuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcltdPn0gIDM4NC1lbGVtZW50IGZsb2F0MzIgYXJyYXlcbiAgICovXG4gIGFzeW5jIGVtYmVkKHRleHQpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9haV9lbWJlZCA9PT0gJ3VuZGVmaW5lZCcpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FpLmVtYmVkOiBiaW5kaW5nIHVuYXZhaWxhYmxlIFx1MjAxNCBhZGQgYWk6dHJ1ZSB0byBnbHl4LmNvbmZpZy5qc29uJyk7XG4gICAgY29uc3QgcmF3ID0gYXdhaXQgX19nbHl4X2FpX2VtYmVkKFN0cmluZyh0ZXh0KSk7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UocmF3KTtcbiAgfSxcblxuICAvKipcbiAgICogR2VuZXJhdGUgdGV4dCBmcm9tIGEgcHJvbXB0IHVzaW5nIFBoaS0yIChxdWFudGl6ZWQgUTRfS19NLCBDUFUpLlxuICAgKlxuICAgKiBSZXNvbHZlcyB3aXRoIHRoZSBmdWxsIGdlbmVyYXRlZCBzdHJpbmcgd2hlbiBkb25lLlxuICAgKiBMb25nLXJ1bm5pbmcgXHUyMDE0IGV4cGVjdCAxMC0zMCBzZWNvbmRzIHBlciAyMDAgdG9rZW5zIG9uIENQVS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHByb21wdFxuICAgKiBAcGFyYW0ge3sgbWF4VG9rZW5zPzogbnVtYmVyLCB0ZW1wZXJhdHVyZT86IG51bWJlciB9fSBbb3B0c11cbiAgICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nPn1cbiAgICovXG4gIGFzeW5jIGdlbmVyYXRlKHByb21wdCwgeyBtYXhUb2tlbnMgPSAyMDAsIHRlbXBlcmF0dXJlID0gMC43IH0gPSB7fSkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X2FpX2dlbmVyYXRlID09PSAndW5kZWZpbmVkJylcbiAgICAgIHRocm93IG5ldyBFcnJvcignYWkuZ2VuZXJhdGU6IGJpbmRpbmcgdW5hdmFpbGFibGUgXHUyMDE0IGFkZCBhaTp0cnVlIHRvIGdseXguY29uZmlnLmpzb24nKTtcbiAgICByZXR1cm4gX19nbHl4X2FpX2dlbmVyYXRlKFN0cmluZyhwcm9tcHQpLCBKU09OLnN0cmluZ2lmeSh7IG1heFRva2VucywgdGVtcGVyYXR1cmUgfSkpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUcmFuc2NyaWJlIGFuIGF1ZGlvIGZpbGUgdG8gdGV4dCB1c2luZyBXaGlzcGVyLXRpbnkgKENQVSkuXG4gICAqXG4gICAqIFN1cHBvcnRzIFdBViAoMTYga0h6IG1vbm8gcHJlZmVycmVkKSwgTVAzLCBGTEFDLCBPR0cuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBhdWRpb1BhdGggIEFic29sdXRlIHBhdGggdG8gdGhlIGF1ZGlvIGZpbGVcbiAgICogQHBhcmFtIHt7IGxhbmd1YWdlPzogc3RyaW5nIH19IFtvcHRzXSAgSVNPIDYzOS0xIGNvZGUsIGUuZy4gJ2VuJzsgZW1wdHkgPSBhdXRvLWRldGVjdFxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmc+fSAgUGxhaW4gdGV4dCB0cmFuc2NyaXB0XG4gICAqL1xuICBhc3luYyB0cmFuc2NyaWJlKGF1ZGlvUGF0aCwgeyBsYW5ndWFnZSA9ICcnIH0gPSB7fSkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X2FpX3RyYW5zY3JpYmUgPT09ICd1bmRlZmluZWQnKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdhaS50cmFuc2NyaWJlOiBiaW5kaW5nIHVuYXZhaWxhYmxlIFx1MjAxNCBhZGQgYWk6dHJ1ZSB0byBnbHl4LmNvbmZpZy5qc29uJyk7XG4gICAgcmV0dXJuIF9fZ2x5eF9haV90cmFuc2NyaWJlKFN0cmluZyhhdWRpb1BhdGgpLCBKU09OLnN0cmluZ2lmeSh7IGxhbmd1YWdlIH0pKTtcbiAgfSxcblxuICAvKiogVW5sb2FkIEFQSSBcdTIwMTQgZnJlZSBtb2RlbCBSQU0gaW1tZWRpYXRlbHkgd2l0aG91dCByZXN0YXJ0aW5nIHRoZSBhcHAuICovXG4gIHVubG9hZDoge1xuICAgIGVtYmVkKCkgICAgICB7IGlmICh0eXBlb2YgX19nbHl4X2FpX3VubG9hZF9lbWJlZCAgICAgICE9PSAndW5kZWZpbmVkJykgX19nbHl4X2FpX3VubG9hZF9lbWJlZCgpOyB9LFxuICAgIGdlbmVyYXRlKCkgICB7IGlmICh0eXBlb2YgX19nbHl4X2FpX3VubG9hZF9nZW5lcmF0ZSAgICE9PSAndW5kZWZpbmVkJykgX19nbHl4X2FpX3VubG9hZF9nZW5lcmF0ZSgpOyB9LFxuICAgIHRyYW5zY3JpYmUoKSB7IGlmICh0eXBlb2YgX19nbHl4X2FpX3VubG9hZF90cmFuc2NyaWJlICE9PSAndW5kZWZpbmVkJykgX19nbHl4X2FpX3VubG9hZF90cmFuc2NyaWJlKCk7IH0sXG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgQ2FtZXJhIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGNvbnN0IGNhbWVyYSA9IHtcbiAgLyoqIExpc3QgY29ubmVjdGVkIGNhbWVyYSBkZXZpY2VzLiBAcmV0dXJucyB7UHJvbWlzZTx7aW5kZXg6bnVtYmVyLG5hbWU6c3RyaW5nfVtdPn0gKi9cbiAgYXN5bmMgbGlzdERldmljZXMoKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoYXdhaXQgX19nbHl4X2NhbWVyYV9saXN0KCkpO1xuICB9LFxuICAvKiogT3BlbiBjYW1lcmEgYnkgZGV2aWNlIGluZGV4LiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXI+fSBoYW5kbGUgSUQgKi9cbiAgYXN5bmMgb3BlbihkZXZpY2VJbmRleCA9IDApIHtcbiAgICByZXR1cm4gcGFyc2VJbnQoYXdhaXQgX19nbHl4X2NhbWVyYV9vcGVuKGRldmljZUluZGV4KSk7XG4gIH0sXG4gIC8qKiBDbG9zZSBhIHByZXZpb3VzbHkgb3BlbmVkIGNhbWVyYS4gQHBhcmFtIHtudW1iZXJ9IGhhbmRsZSAqL1xuICBjbG9zZShoYW5kbGUpIHtcbiAgICBfX2dseXhfY2FtZXJhX2Nsb3NlKFN0cmluZyhoYW5kbGUpKTtcbiAgfSxcbiAgLyoqXG4gICAqIENhcHR1cmUgdGhlIGN1cnJlbnQgZnJhbWUgYXMgYSBQTkcgZmlsZS5cbiAgICogQHBhcmFtIHtudW1iZXJ9IGhhbmRsZSAgSGFuZGxlIHJldHVybmVkIGJ5IG9wZW4oKSBvciBDYW1lcmEuc3RhcnQoKS5cbiAgICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nPn0gIEFic29sdXRlIHBhdGggdG8gdGhlIHNhdmVkIFBORy5cbiAgICovXG4gIGFzeW5jIGNhcHR1cmUoaGFuZGxlKSB7XG4gICAgcmV0dXJuIF9fZ2x5eF9jYW1lcmFfY2FwdHVyZShTdHJpbmcoaGFuZGxlKSk7XG4gIH0sXG4gIC8qKlxuICAgKiBTdGFydCByZWNvcmRpbmcgdG8gYW4gTVA0IGZpbGUgdmlhIGZmbXBlZyAobXVzdCBiZSBpbiBQQVRIKS5cbiAgICogQHBhcmFtIHtudW1iZXJ9IGhhbmRsZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3V0cHV0UGF0aCAgQWJzb2x1dGUgcGF0aCBmb3IgdGhlIG91dHB1dCBNUDQuXG4gICAqL1xuICBzdGFydFJlY29yZChoYW5kbGUsIG91dHB1dFBhdGgpIHtcbiAgICBfX2dseXhfY2FtZXJhX3JlY29yZF9zdGFydChTdHJpbmcoaGFuZGxlKSwgb3V0cHV0UGF0aCk7XG4gIH0sXG4gIC8qKlxuICAgKiBTdG9wIHJlY29yZGluZyBhbmQgZmx1c2ggdGhlIE1QNC5cbiAgICogQHBhcmFtIHtudW1iZXJ9IGhhbmRsZVxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmc+fSAgQWJzb2x1dGUgcGF0aCB0byB0aGUgZmluaXNoZWQgTVA0LlxuICAgKi9cbiAgYXN5bmMgc3RvcFJlY29yZChoYW5kbGUpIHtcbiAgICByZXR1cm4gX19nbHl4X2NhbWVyYV9yZWNvcmRfc3RvcChTdHJpbmcoaGFuZGxlKSk7XG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgTWljcm9waG9uZSBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBjb25zdCBtaWNyb3Bob25lID0ge1xuICAvKiogTGlzdCBjb25uZWN0ZWQgaW5wdXQgZGV2aWNlcy4gQHJldHVybnMge1Byb21pc2U8e25hbWU6c3RyaW5nfVtdPn0gKi9cbiAgYXN5bmMgbGlzdERldmljZXMoKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoYXdhaXQgX19nbHl4X21pY3JvcGhvbmVfbGlzdCgpKTtcbiAgfSxcbiAgLyoqXG4gICAqIFJlY29yZCBmcm9tIHRoZSBtaWNyb3Bob25lIHRvIGEgV0FWIGZpbGUuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbZHVyYXRpb25Ncz0zMDAwXSBSZWNvcmRpbmcgZHVyYXRpb24gaW4gbWlsbGlzZWNvbmRzLlxuICAgKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBbZGV2aWNlTmFtZT1udWxsXSBEZXZpY2UgbmFtZSwgb3IgbnVsbCBmb3IgZGVmYXVsdC5cbiAgICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nPn0gQWJzb2x1dGUgcGF0aCB0byB0aGUgcmVjb3JkZWQgV0FWIGZpbGUuXG4gICAqL1xuICBhc3luYyByZWNvcmQoZHVyYXRpb25NcyA9IDMwMDAsIGRldmljZU5hbWUgPSBudWxsKSB7XG4gICAgcmV0dXJuIF9fZ2x5eF9taWNyb3Bob25lX3JlY29yZChkZXZpY2VOYW1lIHx8ICcnLCBkdXJhdGlvbk1zKTtcbiAgfSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBISUQgQVBJIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vKipcbiAqIEh1bWFuIEludGVyZmFjZSBEZXZpY2UgKEhJRCkgQVBJIFx1MjAxNCBVU0IgZ2FtZXBhZHMsIGN1c3RvbSBoYXJkd2FyZSwgZXRjLlxuICpcbiAqIFJlcXVpcmVzIGBoaWQ6IHRydWVgIGluIGdseXguY29uZmlnLmpzb24uXG4gKi9cbmV4cG9ydCBjb25zdCBoaWQgPSB7XG4gIC8qKlxuICAgKiBMaXN0IGFsbCBjb25uZWN0ZWQgSElEIGRldmljZXMuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHt2ZW5kb3JJZCxwcm9kdWN0SWQsbWFudWZhY3R1cmVyLHByb2R1Y3Qsc2VyaWFsTnVtYmVyLGludGVyZmFjZU51bWJlcixwYXRofVtdPn1cbiAgICovXG4gIGFzeW5jIGVudW1lcmF0ZSgpIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShhd2FpdCBfX2dseXhfaGlkX2VudW1lcmF0ZSgpKTtcbiAgfSxcbiAgLyoqXG4gICAqIE9wZW4gYSBISUQgZGV2aWNlIGJ5IHZlbmRvciArIHByb2R1Y3QgSUQuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSB2ZW5kb3JJZFxuICAgKiBAcGFyYW0ge251bWJlcn0gcHJvZHVjdElkXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59IEhhbmRsZSBJRC5cbiAgICovXG4gIGFzeW5jIG9wZW4odmVuZG9ySWQsIHByb2R1Y3RJZCkge1xuICAgIHJldHVybiBwYXJzZUludChhd2FpdCBfX2dseXhfaGlkX29wZW4odmVuZG9ySWQsIHByb2R1Y3RJZCkpO1xuICB9LFxuICAvKipcbiAgICogUmVhZCBieXRlcyBmcm9tIGFuIG9wZW4gSElEIGRldmljZS5cbiAgICogQHBhcmFtIHtudW1iZXJ9IGhhbmRsZSAgIEhhbmRsZSByZXR1cm5lZCBieSBvcGVuKCkuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbdGltZW91dE1zPTEwMF1cbiAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyW10+fSBBcnJheSBvZiBieXRlIHZhbHVlcyAodXAgdG8gNjQpLlxuICAgKi9cbiAgYXN5bmMgcmVhZChoYW5kbGUsIHRpbWVvdXRNcyA9IDEwMCkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGF3YWl0IF9fZ2x5eF9oaWRfcmVhZChoYW5kbGUsIHRpbWVvdXRNcykpO1xuICB9LFxuICAvKipcbiAgICogV3JpdGUgYnl0ZXMgdG8gYW4gb3BlbiBISUQgZGV2aWNlLlxuICAgKiBAcGFyYW0ge251bWJlcn0gaGFuZGxlICAgSGFuZGxlIHJldHVybmVkIGJ5IG9wZW4oKS5cbiAgICogQHBhcmFtIHtudW1iZXJbXX0gZGF0YSAgIEFycmF5IG9mIGJ5dGUgdmFsdWVzLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXI+fSBOdW1iZXIgb2YgYnl0ZXMgd3JpdHRlbi5cbiAgICovXG4gIGFzeW5jIHdyaXRlKGhhbmRsZSwgZGF0YSkge1xuICAgIHJldHVybiBwYXJzZUludChhd2FpdCBfX2dseXhfaGlkX3dyaXRlKGhhbmRsZSwgSlNPTi5zdHJpbmdpZnkoZGF0YSkpKTtcbiAgfSxcbiAgLyoqXG4gICAqIENsb3NlIGEgSElEIGRldmljZSBoYW5kbGUuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBoYW5kbGVcbiAgICovXG4gIGNsb3NlKGhhbmRsZSkge1xuICAgIF9fZ2x5eF9oaWRfY2xvc2UoaGFuZGxlKTtcbiAgfSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBBdXRvLXVwZGF0ZXIgQVBJIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vKipcbiAqIEF1dG8tdXBkYXRlciBcdTIwMTQgY2hlY2sgZm9yIGFuZCBhcHBseSB1cGRhdGVzLlxuICpcbiAqIFJlcXVpcmVzIGB1cGRhdGVyOiB0cnVlYCBpbiBnbHl4LmNvbmZpZy5qc29uLlxuICpcbiAqICMjIE1hbmlmZXN0LWJhc2VkIGZsb3cgKHJlY29tbWVuZGVkKVxuICpcbiAqIEhvc3QgYSBgbGF0ZXN0Lmpzb25gIG9uIGFueSBzdGF0aWMgc2VydmVyOlxuICogYGBganNvblxuICoge1xuICogICBcInZlcnNpb25cIjogICAgIFwiMi4xLjBcIixcbiAqICAgXCJ1cGRhdGVfdHlwZVwiOiBcImpzX29ubHlcIiwgICAvLyBcImpzX29ubHlcIiB8IFwicnVubmVyXCIgfCBcImZ1bGxcIlxuICogICBcIm5vdGVzXCI6ICAgICAgIFwiQnVnIGZpeGVzXCIsXG4gKiAgIFwianNfdXJsXCI6ICAgICAgXCJodHRwczovL2Nkbi5leGFtcGxlLmNvbS8yLjEuMC9hcHAuanNcIixcbiAqICAgXCJqc19zaGEyNTZcIjogICBcImFiYzEyMy4uLlwiXG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBUaGVuIGluIHlvdXIgYXBwOlxuICogYGBganNcbiAqIGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdXBkYXRlci5jaGVja01hbmlmZXN0KCdodHRwczovL2Nkbi5leGFtcGxlLmNvbS9sYXRlc3QuanNvbicpO1xuICogaWYgKG1hbmlmZXN0KSB7XG4gKiAgIGlmIChtYW5pZmVzdC51cGRhdGVfdHlwZSA9PT0gJ2pzX29ubHknKSB7XG4gKiAgICAgYXdhaXQgdXBkYXRlci5kb3dubG9hZEpzKG1hbmlmZXN0LmpzX3VybCwgbWFuaWZlc3QuanNfc2hhMjU2KTtcbiAqICAgICBnbHl4V2luZG93LnJlc3RhcnQoKTsgICAvLyBhcHBsaWVzIG9uIG5leHQgbGF1bmNoIGF1dG9tYXRpY2FsbHlcbiAqICAgfSBlbHNlIHtcbiAqICAgICAvLyBydW5uZXIvZnVsbDogdXNlIHVwZGF0ZXIudXBkYXRlKCkgZm9yIEdpdEh1YiByZWxlYXNlcywgb3IgZGlyZWN0IGRvd25sb2FkXG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICpcbiAqICMjIEdpdEh1Yi1yZWxlYXNlIGZsb3cgKGJpbmFyeSB1cGRhdGVzKVxuICpcbiAqIGBgYGpzXG4gKiBjb25zdCBpbmZvID0gYXdhaXQgdXBkYXRlci5jaGVjaygnbXlvcmcnLCAnbXlhcHAnLCAnMS4wLjAnKTtcbiAqIGlmIChpbmZvLmhhc1VwZGF0ZSkge1xuICogICBjb25zdCByZXN1bHQgPSBhd2FpdCB1cGRhdGVyLnVwZGF0ZSgnbXlvcmcnLCAnbXlhcHAnLCAnbXlhcHAnLCAnMS4wLjAnKTtcbiAqICAgaWYgKHJlc3VsdC51cGRhdGVkKSB7IC8vIHNob3cgXCJyZXN0YXJ0IHJlcXVpcmVkXCIgZGlhbG9nIH1cbiAqIH1cbiAqIGBgYFxuICovXG5leHBvcnQgY29uc3QgdXBkYXRlciA9IHtcbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGFwcCB2ZXJzaW9uIGRlY2xhcmVkIGluIGBnbHl4LmNvbmZpZy5qc29uYCAoYHZlcnNpb25gIGZpZWxkKSxcbiAgICogb3IgYFwiMC4wLjBcImAgaWYgbm90IHNldC5cbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICovXG4gIGdldFZlcnNpb24oKSB7XG4gICAgcmV0dXJuIF9fZ2x5eF91cGRhdGVyX2dldF92ZXJzaW9uKCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGN1cnJlbnQgcGxhdGZvcm0gaWRlbnRpZmllcjogYFwid2luZG93c1wiYCwgYFwibWFjb3NcImAsIG9yIGBcImxpbnV4XCJgLlxuICAgKiBNYXRjaGVzIHRoZSBgX3BsYXRmb3JtYCBmaWVsZCBpbmplY3RlZCBpbnRvIG1hbmlmZXN0cyBieSBgY2hlY2tNYW5pZmVzdGAuXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAqL1xuICBnZXRQbGF0Zm9ybSgpIHtcbiAgICByZXR1cm4gX19nbHl4X3BsYXRmb3JtKCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEZldGNoIGEgSlNPTiBtYW5pZmVzdCBmcm9tIGB1cmxgIGFuZCBjb21wYXJlIGl0cyBgdmVyc2lvbmAgZmllbGQgYWdhaW5zdFxuICAgKiBgY3VycmVudFZlcnNpb25gIChkZWZhdWx0cyB0byBgdXBkYXRlci5nZXRWZXJzaW9uKClgIHdoZW4gb21pdHRlZCkuXG4gICAqXG4gICAqIFJldHVybnMgYG51bGxgIHdoZW4gYWxyZWFkeSB1cCB0byBkYXRlICoqb3IqKiB3aGVuIHRoZSBtYW5pZmVzdCdzIG9wdGlvbmFsXG4gICAqIGBwbGF0Zm9ybXNgIGFycmF5IGRvZXMgbm90IGluY2x1ZGUgdGhlIGN1cnJlbnQgT1MuXG4gICAqXG4gICAqIFRoZSByZXR1cm5lZCBtYW5pZmVzdCBpbmNsdWRlcyBhIGBfcGxhdGZvcm1gIGtleSAoZS5nLiBgXCJ3aW5kb3dzXCJgKSBzbyB5b3VcbiAgICogY2FuIHJlYWQgcGxhdGZvcm0tc3BlY2lmaWMgYXNzZXQgVVJMczpcbiAgICogYGBganNcbiAgICogY29uc3QgbSA9IGF3YWl0IHVwZGF0ZXIuY2hlY2tNYW5pZmVzdCgnaHR0cHM6Ly9jZG4uZXhhbXBsZS5jb20vbGF0ZXN0Lmpzb24nKTtcbiAgICogaWYgKG0gJiYgbS51cGRhdGVfdHlwZSA9PT0gJ3J1bm5lcicpIHtcbiAgICogICBjb25zdCB7IHJ1bm5lcl91cmwsIHJ1bm5lcl9zaGEyNTYgfSA9IG1bbS5fcGxhdGZvcm1dID8/IHt9O1xuICAgKiB9XG4gICAqIGBgYFxuICAgKiBAcGFyYW0ge3N0cmluZ30gIHVybCAgICAgICAgICAgIFVSTCBvZiB0aGUgSlNPTiBtYW5pZmVzdC5cbiAgICogQHBhcmFtIHtzdHJpbmc9fSBjdXJyZW50VmVyc2lvbiBTZW12ZXIgc3RyaW5nIHRvIGNvbXBhcmUgYWdhaW5zdC4gRGVmYXVsdHMgdG8gYXBwIHZlcnNpb24uXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdHxudWxsPn0gIE1hbmlmZXN0IG9iamVjdCBpZiBhIG5ld2VyIHZlcnNpb24gZXhpc3RzLCBvdGhlcndpc2UgbnVsbC5cbiAgICovXG4gIGFzeW5jIGNoZWNrTWFuaWZlc3QodXJsLCBjdXJyZW50VmVyc2lvbikge1xuICAgIGNvbnN0IGN1cnJlbnQgPSBjdXJyZW50VmVyc2lvbiA/PyB1cGRhdGVyLmdldFZlcnNpb24oKTtcbiAgICBjb25zdCByYXcgPSBhd2FpdCBfX2dseXhfdXBkYXRlcl9jaGVja19tYW5pZmVzdCh1cmwsIGN1cnJlbnQpO1xuICAgIHJldHVybiByYXcgPT09ICdudWxsJyA/IG51bGwgOiBKU09OLnBhcnNlKHJhdyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERvd25sb2FkIGEgSlMgYnVuZGxlIGZyb20gYHVybGAsIHZlcmlmeSBpdHMgU0hBLTI1NiBkaWdlc3QsIGFuZCBzdGFnZSBpdFxuICAgKiBmb3IgdGhlIG5leHQgcmVzdGFydC4gT24gbmV4dCBsYXVuY2ggdGhlIHJ1bm5lciBsb2FkcyB0aGUgc3RhZ2VkIEpTXG4gICAqIGluc3RlYWQgb2YgdGhlIHRyYWlsZXIgYnVuZGxlIFx1MjAxNCBjb21wbGV0aW5nIGEgSlMtb25seSB1cGRhdGUgd2l0aCB6ZXJvIGRvd250aW1lLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gIHVybCAgICBEaXJlY3QgZG93bmxvYWQgVVJMIG9mIHRoZSBuZXcgYGFwcC5qc2AuXG4gICAqIEBwYXJhbSB7c3RyaW5nPX0gc2hhMjU2IEV4cGVjdGVkIFNIQS0yNTYgaGV4IGRpZ2VzdC4gUGFzcyBgXCJcImAgdG8gc2tpcCB2ZXJpZmljYXRpb24uXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICAgKi9cbiAgYXN5bmMgZG93bmxvYWRKcyh1cmwsIHNoYTI1NiA9ICcnKSB7XG4gICAgYXdhaXQgX19nbHl4X3VwZGF0ZXJfZG93bmxvYWRfanModXJsLCBzaGEyNTYpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBDaGVjayBHaXRIdWIgcmVsZWFzZXMgZm9yIGEgbmV3ZXIgdmVyc2lvbi5cbiAgICogQHBhcmFtIHtzdHJpbmd9IG93bmVyICAgICAgICAgIEdpdEh1YiBvd25lciAodXNlciBvciBvcmcpLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gcmVwbyAgICAgICAgICAgUmVwb3NpdG9yeSBuYW1lLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gY3VycmVudFZlcnNpb24gQ3VycmVudCBzZW12ZXIgc3RyaW5nIChlLmcuIFwiMS4wLjBcIikuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHtoYXNVcGRhdGU6Ym9vbGVhbiwgbGF0ZXN0VmVyc2lvbjpzdHJpbmcsIGJvZHk6c3RyaW5nfT59XG4gICAqL1xuICBhc3luYyBjaGVjayhvd25lciwgcmVwbywgY3VycmVudFZlcnNpb24pIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShhd2FpdCBfX2dseXhfdXBkYXRlcl9jaGVjayhvd25lciwgcmVwbywgY3VycmVudFZlcnNpb24pKTtcbiAgfSxcblxuICAvKipcbiAgICogRG93bmxvYWQgdGhlIGxhdGVzdCBHaXRIdWIgcmVsZWFzZSBhbmQgcmVwbGFjZSB0aGUgcnVubmluZyBiaW5hcnkuXG4gICAqIFRoZSBjYWxsZXIgc2hvdWxkIHByb21wdCB0aGUgdXNlciB0byByZXN0YXJ0IHRoZSBhcHAgYWZ0ZXIgdGhpcyByZXNvbHZlcy5cbiAgICogQHBhcmFtIHtzdHJpbmd9IG93bmVyICAgICAgICAgIEdpdEh1YiBvd25lci5cbiAgICogQHBhcmFtIHtzdHJpbmd9IHJlcG8gICAgICAgICAgIFJlcG9zaXRvcnkgbmFtZS5cbiAgICogQHBhcmFtIHtzdHJpbmd9IGJpbk5hbWUgICAgICAgIEJpbmFyeSBhc3NldCBuYW1lICh3aXRob3V0IC5leGUgXHUyMDE0IGFkZGVkIG9uIFdpbmRvd3MpLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gY3VycmVudFZlcnNpb24gQ3VycmVudCBzZW12ZXIgc3RyaW5nLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTx7dXBkYXRlZDpib29sZWFuLCBsYXRlc3RWZXJzaW9uOnN0cmluZ30+fVxuICAgKi9cbiAgYXN5bmMgdXBkYXRlKG93bmVyLCByZXBvLCBiaW5OYW1lLCBjdXJyZW50VmVyc2lvbikge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGF3YWl0IF9fZ2x5eF91cGRhdGVyX3VwZGF0ZShvd25lciwgcmVwbywgYmluTmFtZSwgY3VycmVudFZlcnNpb24pKTtcbiAgfSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMCBWaWRlbyBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gTG93LWxldmVsIGJpbmRpbmdzIGZvciB0aGUgZ2x5eC1tZWRpYSBETEwgZGVjb2Rlci5cbi8vIFJlcXVpcmVzIGB2aWRlbzogdHJ1ZWAgaW4gZ2x5eC5jb25maWcuanNvbi5cbi8vIEZvciBhIHJlYWR5LW1hZGUgY29tcG9uZW50LCB1c2UgdGhlIGA8VmlkZW8+YCBjb21wb25lbnQgKFBoYXNlIDE2SCB2MykuXG4vL1xuLy8gVXNhZ2U6XG4vLyAgIGNvbnN0IGhhbmRsZUlkID0gYXdhaXQgdmlkZW8ub3BlbignL3BhdGgvdG8vbW92aWUubXA0Jyk7XG4vLyAgIC8vIHBhc3MgaGFuZGxlSWQgYXMgYHZpZGVvSGFuZGxlYCBwcm9wIHRvIGEgPFZpZXcgbm9kZVR5cGU9XCJ2aWRlb1wiPiBub2RlXG4vLyAgIHZpZGVvLnNlZWsoaGFuZGxlSWQsIDMwLjApOyAgLy8ganVtcCB0byAzMCBzZWNvbmRzXG4vLyAgIHZpZGVvLmNsb3NlKGhhbmRsZUlkKTtcblxuLy8gSW50ZXJuYWw6IHZpZGVvIGV2ZW50IGxpc3RlbmVyc1xuLy8gaGFuZGxlSWQgXHUyMTkyIHsgb25FbmRlZCwgb25NZXRhZGF0YSwgb25UaW1lVXBkYXRlLCBvbkVycm9yIH1cbmV4cG9ydCBjb25zdCBfdmlkZW9DYWxsYmFja3MgPSBuZXcgTWFwKCk7XG5leHBvcnQgZnVuY3Rpb24gX3BvbGxWaWRlbygpIHtcbiAgaWYgKHR5cGVvZiBfX2dseXhfdmlkZW9fcG9sbCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgY29uc3QgZXZlbnRzID0gSlNPTi5wYXJzZShfX2dseXhfdmlkZW9fcG9sbCgpKTtcbiAgZm9yIChjb25zdCBldiBvZiBldmVudHMpIHtcbiAgICBjb25zdCBjYnMgPSBfdmlkZW9DYWxsYmFja3MuZ2V0KGV2LmlkKTtcbiAgICBpZiAoIWNicykgY29udGludWU7XG4gICAgaWYgICAgICAoZXYudHlwZSA9PT0gJ2VuZGVkJyAgICAgICYmIGNicy5vbkVuZGVkKSAgICAgIGNicy5vbkVuZGVkKCk7XG4gICAgZWxzZSBpZiAoZXYudHlwZSA9PT0gJ21ldGFkYXRhJyAgICYmIGNicy5vbk1ldGFkYXRhKSAgIGNicy5vbk1ldGFkYXRhKGV2KTtcbiAgICBlbHNlIGlmIChldi50eXBlID09PSAndGltZXVwZGF0ZScgJiYgY2JzLm9uVGltZVVwZGF0ZSkgY2JzLm9uVGltZVVwZGF0ZShldi5jdXJyZW50VGltZSk7XG4gICAgZWxzZSBpZiAoZXYudHlwZSA9PT0gJ2Vycm9yJyAgICAgICYmIGNicy5vbkVycm9yKSAgICAgIGNicy5vbkVycm9yKGV2Lm1lc3NhZ2UpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCB2aWRlbyA9IHtcbiAgLyoqXG4gICAqIE9wZW4gYSB2aWRlbyBmaWxlIG9yIFVSTCBmb3IgcGxheWJhY2suXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1cmxcbiAgICogQHBhcmFtIHt7IG9uRW5kZWQ/LCBvbk1ldGFkYXRhPywgb25UaW1lVXBkYXRlPywgb25FcnJvcj8gfX0gb3B0c1xuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXI+fSBSZXNvbHZlcyB3aXRoIHRoZSB2aWRlbyBoYW5kbGUgSUQuXG4gICAqL1xuICBhc3luYyBvcGVuKHVybCwgeyBvbkVuZGVkLCBvbk1ldGFkYXRhLCBvblRpbWVVcGRhdGUsIG9uRXJyb3IgfSA9IHt9KSB7XG4gICAgY29uc3QgaGFuZGxlSWQgPSBwYXJzZUludChhd2FpdCBfX2dseXhfdmlkZW9fb3Blbih1cmwpKTtcbiAgICBfdmlkZW9DYWxsYmFja3Muc2V0KGhhbmRsZUlkLCB7IG9uRW5kZWQsIG9uTWV0YWRhdGEsIG9uVGltZVVwZGF0ZSwgb25FcnJvciB9KTtcbiAgICByZXR1cm4gaGFuZGxlSWQ7XG4gIH0sXG4gIC8qKiBTZWVrIHRvIGBzZWNvbmRzYC4gKi9cbiAgc2VlayhoYW5kbGVJZCwgc2Vjb25kcykge1xuICAgIF9fZ2x5eF92aWRlb19zZWVrKFN0cmluZyhoYW5kbGVJZCksIE1hdGgubWF4KDAsIHNlY29uZHMpKTtcbiAgfSxcbiAgLyoqIFNldCBwbGF5YmFjayB2b2x1bWUgKDAuMCA9IG11dGUsIDEuMCA9IG5vcm1hbCwgdXAgdG8gMi4wKS4gKi9cbiAgc2V0Vm9sdW1lKGhhbmRsZUlkLCB2b2x1bWUpIHtcbiAgICBfX2dseXhfdmlkZW9fc2V0X3ZvbHVtZShTdHJpbmcoaGFuZGxlSWQpLCB2b2x1bWUpO1xuICB9LFxuICAvKiogUGF1c2UgZGVjb2RlIGFuZCBhdWRpbyB0aHJlYWRzLiAqL1xuICBwYXVzZShoYW5kbGVJZCkge1xuICAgIF9fZ2x5eF92aWRlb19wYXVzZShTdHJpbmcoaGFuZGxlSWQpKTtcbiAgfSxcbiAgLyoqIFJlc3VtZSBhZnRlciBwYXVzZS4gKi9cbiAgcGxheShoYW5kbGVJZCkge1xuICAgIF9fZ2x5eF92aWRlb19wbGF5KFN0cmluZyhoYW5kbGVJZCkpO1xuICB9LFxuICAvKiogQ2xvc2UgYW5kIHJlbGVhc2UgdGhlIHZpZGVvIGhhbmRsZS4gKi9cbiAgY2xvc2UoaGFuZGxlSWQpIHtcbiAgICBfX2dseXhfdmlkZW9fY2xvc2UoU3RyaW5nKGhhbmRsZUlkKSk7XG4gICAgX3ZpZGVvQ2FsbGJhY2tzLmRlbGV0ZShoYW5kbGVJZCk7XG4gIH0sXG59O1xuXG5leHBvcnQgY29uc3QgaW5wdXQgPSB7XG4gIGdhbWVwYWRzOiB7XG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSBjYWxsYmFjayBmaXJlZCBmb3IgZXZlcnkgZ2FtZXBhZCBldmVudCBwb2xsZWQgZWFjaCBmcmFtZS5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYiAgQ2FsbGVkIHdpdGggYHtpZCwgbmFtZSwgZXZlbnQ6IHt0eXBlLCAuLi59fWBcbiAgICAgKiBAcmV0dXJucyB7ZnVuY3Rpb259IFVuc3Vic2NyaWJlXG4gICAgICovXG4gICAgb25JbnB1dChjYikge1xuICAgICAgY29uc3Qga2V5ID0gU3ltYm9sKCk7XG4gICAgICAvLyBwb2xsIGdhbWVwYWRzIGVhY2ggZnJhbWUgYW5kIGZpcmUgY2JcbiAgICAgIGNvbnN0IHByZXYgPSBnbG9iYWxUaGlzLl9fZ2x5eF9nYW1lcGFkQ2I7XG4gICAgICBpZiAoIWdsb2JhbFRoaXMuX2dhbWVwYWRDYWxsYmFja3MpIGdsb2JhbFRoaXMuX2dhbWVwYWRDYWxsYmFja3MgPSBbXTtcbiAgICAgIGdsb2JhbFRoaXMuX2dhbWVwYWRDYWxsYmFja3MucHVzaChjYik7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gdW5zdWJzY3JpYmUoKSB7XG4gICAgICAgIGNvbnN0IGFyciA9IGdsb2JhbFRoaXMuX2dhbWVwYWRDYWxsYmFja3M7XG4gICAgICAgIGlmIChhcnIpIHtcbiAgICAgICAgICBjb25zdCBpID0gYXJyLmluZGV4T2YoY2IpO1xuICAgICAgICAgIGlmIChpICE9PSAtMSkgYXJyLnNwbGljZShpLCAxKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9LFxuICB9LFxuXG4gIC8qKiBTeXN0ZW0td2lkZSBzaG9ydGN1dHMgXHUyMDE0IGZpcmVzIGV2ZW4gd2hlbiB0aGUgYXBwIGlzIGJhY2tncm91bmRlZC4gKi9cbiAgZ2xvYmFsU2hvcnRjdXQ6IHtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYWNjZWxlcmF0b3IgIGUuZy4gXCJjdHJsK3NoaWZ0K3ZcIlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNiXG4gICAgICogQHJldHVybnMge3N0cmluZ30gaWQgXHUyMDE0IHBhc3MgdG8gdW5yZWdpc3RlcigpXG4gICAgICovXG4gICAgcmVnaXN0ZXIoYWNjZWxlcmF0b3IsIGNiKSB7XG4gICAgICBpZiAodHlwZW9mIF9fZ2x5eF9zaG9ydGN1dF9yZWdpc3RlciA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBudWxsO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaWQgPSBOdW1iZXIoX19nbHl4X3Nob3J0Y3V0X3JlZ2lzdGVyKGFjY2VsZXJhdG9yKSk7XG4gICAgICAgIF9nbG9iYWxTaG9ydGN1dENhbGxiYWNrcy5zZXQoaWQsIGNiKTtcbiAgICAgICAgcmV0dXJuIFN0cmluZyhpZCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIF9fZ2x5eF9sb2coJ1tzaG9ydGN1dF0gcmVnaXN0ZXIgZXJyb3I6ICcgKyBlKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSxcbiAgICB1bnJlZ2lzdGVyKGlkKSB7XG4gICAgICBjb25zdCBudW1JZCA9IE51bWJlcihpZCk7XG4gICAgICBfZ2xvYmFsU2hvcnRjdXRDYWxsYmFja3MuZGVsZXRlKG51bUlkKTtcbiAgICAgIGlmICh0eXBlb2YgX19nbHl4X3Nob3J0Y3V0X3VucmVnaXN0ZXIgIT09ICd1bmRlZmluZWQnKSBfX2dseXhfc2hvcnRjdXRfdW5yZWdpc3RlcihTdHJpbmcobnVtSWQpKTtcbiAgICB9LFxuICB9LFxuXG4gIC8qKiBBcHAtZm9jdXNlZCBzaG9ydGN1dHMgXHUyMDE0IGZpcmVzIHdoZW4gdGhlIGFwcCB3aW5kb3cgaXMgZm9jdXNlZCAobm8gT1MgcmVnaXN0cmF0aW9uKS4gKi9cbiAgc2hvcnRjdXQ6IHtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYWNjZWxlcmF0b3IgIGUuZy4gXCJjdHJsK2tcIlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNiXG4gICAgICogQHJldHVybnMge251bWJlcn0gaWQgXHUyMDE0IHBhc3MgdG8gdW5yZWdpc3RlcigpXG4gICAgICovXG4gICAgcmVnaXN0ZXIoYWNjZWxlcmF0b3IsIGNiKSB7XG4gICAgICBjb25zdCBwYXJ0cyA9IGFjY2VsZXJhdG9yLnRvTG93ZXJDYXNlKCkuc3BsaXQoJysnKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gICAgICBjb25zdCBtb2RzID0geyBjdHJsOiBmYWxzZSwgc2hpZnQ6IGZhbHNlLCBhbHQ6IGZhbHNlLCBtZXRhOiBmYWxzZSB9O1xuICAgICAgbGV0IGtleSA9IG51bGw7XG4gICAgICBmb3IgKGNvbnN0IHAgb2YgcGFydHMpIHtcbiAgICAgICAgaWYgKHAgPT09ICdjdHJsJyB8fCBwID09PSAnY29udHJvbCcpIG1vZHMuY3RybCA9IHRydWU7XG4gICAgICAgIGVsc2UgaWYgKHAgPT09ICdzaGlmdCcpIG1vZHMuc2hpZnQgPSB0cnVlO1xuICAgICAgICBlbHNlIGlmIChwID09PSAnYWx0JykgbW9kcy5hbHQgPSB0cnVlO1xuICAgICAgICBlbHNlIGlmIChwID09PSAnbWV0YScgfHwgcCA9PT0gJ2NtZCcgfHwgcCA9PT0gJ3dpbicpIG1vZHMubWV0YSA9IHRydWU7XG4gICAgICAgIGVsc2Uga2V5ID0gcDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGlkID0gX2xvY2FsU2hvcnRjdXROZXh0SWQrKztcbiAgICAgIF9sb2NhbFNob3J0Y3V0cy5zZXQoaWQsIHsgbW9kcywga2V5LCBjYiB9KTtcbiAgICAgIHJldHVybiBpZDtcbiAgICB9LFxuICAgIHVucmVnaXN0ZXIoaWQpIHsgX2xvY2FsU2hvcnRjdXRzLmRlbGV0ZShpZCk7IH0sXG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDAgRGVlcCBsaW5rcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqXG4gKiBEZWVwLWxpbmsgVVJMIGhhbmRsaW5nLlxuICpcbiAqIEZpcmVzIGZvciBib3RoIHRoZSBpbml0aWFsIGxhdW5jaCBVUkwgKHRoZSBVUkwgdGhhdCBvcGVuZWQgdGhlIGFwcCkgYW5kXG4gKiBhbnkgVVJMcyBmb3J3YXJkZWQgYnkgYSBzZWNvbmQgaW5zdGFuY2UgKHdoZW4gYHNpbmdsZUluc3RhbmNlOiB0cnVlYCkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGRlZXBsaW5rIH0gZnJvbSAnQGdseXgtZGV2L3JlYWN0JztcbiAqIGRlZXBsaW5rLm9uT3BlbigodXJsKSA9PiB7XG4gKiAgIC8vIHVybCA9IFwibm90ZXM6Ly9ub3RlLzQyXCJcbiAqICAgbmF2aWdhdGUoJ25vdGVEZXRhaWwnLCB7IGlkOiB1cmwuc3BsaXQoJy8nKS5wb3AoKSB9KTtcbiAqIH0pO1xuICovXG5leHBvcnQgY29uc3QgZGVlcGxpbmsgPSB7XG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGNhbGxiYWNrIGZpcmVkIGZvciBldmVyeSBkZWVwLWxpbmsgVVJMLCBpbmNsdWRpbmcgdGhlIGluaXRpYWwgbGF1bmNoIFVSTC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOiB2b2lkfSBjYiAgQ2FsbGVkIHdpdGggdGhlIGZ1bGwgVVJMIHN0cmluZy5cbiAgICogQHJldHVybnMge2Z1bmN0aW9ufSBVbnN1YnNjcmliZSBmdW5jdGlvbi5cbiAgICovXG4gIG9uT3BlbihjYikge1xuICAgIF9kZWVwbGlua0NhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gdW5zdWJzY3JpYmUoKSB7XG4gICAgICBjb25zdCBpID0gX2RlZXBsaW5rQ2FsbGJhY2tzLmluZGV4T2YoY2IpO1xuICAgICAgaWYgKGkgIT09IC0xKSBfZGVlcGxpbmtDYWxsYmFja3Muc3BsaWNlKGksIDEpO1xuICAgIH07XG4gIH0sXG59O1xuIiwgImltcG9ydCBSZWFjdCwgeyB1c2VTdGF0ZSwgdXNlRWZmZWN0LCB1c2VSZWYsIHVzZUNhbGxiYWNrLCBjcmVhdGVDb250ZXh0LCB1c2VDb250ZXh0IH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHtcbiAgcmVnaXN0ZXJQcmVzc2FibGUsIHVucmVnaXN0ZXJQcmVzc2FibGUsXG4gIHJlZ2lzdGVyU2Nyb2xsVmlldywgdW5yZWdpc3RlclNjcm9sbFZpZXcsXG4gIHJlZ2lzdGVyRHJhZ2dhYmxlLCB1bnJlZ2lzdGVyRHJhZ2dhYmxlLFxuICByZWdpc3RlckRpc2FibGVkTm9kZSwgdW5yZWdpc3RlckRpc2FibGVkTm9kZSxcbiAgYWRkV2luZG93U2l6ZUxpc3RlbmVyLCByZW1vdmVXaW5kb3dTaXplTGlzdGVuZXIsXG4gIGFkZEdsb2JhbENsaWNrTGlzdGVuZXIsIHJlbW92ZUdsb2JhbENsaWNrTGlzdGVuZXIsXG4gIHJlZ2lzdGVySW1hZ2VFcnJvciwgdW5yZWdpc3RlckltYWdlRXJyb3IsXG59IGZyb20gJy4vZXZlbnRzLmpzJztcbmltcG9ydCB7IGdseXhXaW5kb3csIGNsaXBib2FyZCwgaW5wdXQgfSBmcm9tICcuL2FwaS5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMCBIb3N0IGNvbXBvbmVudHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBjb25zdCBWaWV3ID0gKHsgY2hpbGRyZW4sIHN0eWxlLCAuLi5wcm9wcyB9KSA9PlxuICBSZWFjdC5jcmVhdGVFbGVtZW50KCd2aWV3JywgeyBzdHlsZSwgLi4ucHJvcHMgfSwgY2hpbGRyZW4pO1xuXG4vKipcbiAqIFJlcGFpbnRCb3VuZGFyeSBcdTIwMTQgZXhwbGljaXQgcmVuZGVyLWxheWVyIGhpbnQuXG4gKlxuICogV3JhcHMgYSBzdWJ0cmVlIHRoYXQgY2hhbmdlcyBpbmZyZXF1ZW50bHkgKHNpZGViYXJzLCBuYXZiYXJzLCBjb21wbGV4IHN0YXRpY1xuICogY2FyZHMsIGxpc3QgaXRlbXMpLiAgV2hlbiBub25lIG9mIHRoZSBib3VuZGFyeSdzIGRlc2NlbmRhbnRzIGFyZSBkaXJ0eSBpbiBhXG4gKiBnaXZlbiBmcmFtZSwgR2x5eCByZXBsYXlzIHRoZSBjYWNoZWQgVmVsbG8gc2NlbmUgZnJhZ21lbnQgZGlyZWN0bHkgXHUyMDE0XG4gKiBza2lwcGluZyBhbGwgY2hpbGQgdHJhdmVyc2FsIGFuZCBkcmF3LWNhbGwgY29uc3RydWN0aW9uLlxuICpcbiAqIE5vIHZpc3VhbCBkaWZmZXJlbmNlIFx1MjAxNCBwdXJlbHkgYSBwZXJmb3JtYW5jZSBoaW50LiAgU2FmZSB0byBhZGQvcmVtb3ZlLlxuICpcbiAqIEV4YW1wbGU6XG4gKiAgIDxSZXBhaW50Qm91bmRhcnk+XG4gKiAgICAgPFNpZGViYXIgLz5cbiAqICAgPC9SZXBhaW50Qm91bmRhcnk+XG4gKi9cbmV4cG9ydCBjb25zdCBSZXBhaW50Qm91bmRhcnkgPSAoeyBjaGlsZHJlbiwgc3R5bGUsIC4uLnByb3BzIH0pID0+XG4gIFJlYWN0LmNyZWF0ZUVsZW1lbnQoJ3JlcGFpbnRCb3VuZGFyeScsIHsgc3R5bGUsIC4uLnByb3BzIH0sIGNoaWxkcmVuKTtcblxuZXhwb3J0IGZ1bmN0aW9uIFRleHQoeyBjaGlsZHJlbiwgc3R5bGUsIHNob3dDdXJzb3IsIC4uLnByb3BzIH0pIHtcbiAgLy8gRmxhdHRlbiBtaXhlZCBjaGlsZHJlbiAoc3RyaW5ncyArIGV4cHJlc3Npb25zKSB0byBhIHNpbmdsZSBzdHJpbmcsXG4gIC8vIG1hdGNoaW5nIGJyb3dzZXIgYmVoYXZpb3VyIHdoZXJlIDxUZXh0Pj0ge3ZhbH08L1RleHQ+IGp1c3Qgd29ya3MuXG4gIGNvbnN0IHRleHQgPSBBcnJheS5pc0FycmF5KGNoaWxkcmVuKVxuICAgID8gY2hpbGRyZW4ubWFwKGMgPT4gKGMgPT0gbnVsbCA/ICcnIDogU3RyaW5nKGMpKSkuam9pbignJylcbiAgICA6IChjaGlsZHJlbiA9PSBudWxsID8gJycgOiBTdHJpbmcoY2hpbGRyZW4pKTtcbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoJ3RleHQnLCB7IHRleHQsIHN0eWxlLCBzaG93Q3Vyc29yLCAuLi5wcm9wcyB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEltYWdlKHsgc3JjLCB3aWR0aCA9IDEyMCwgaGVpZ2h0ID0gMTIwLCByZXNpemVNb2RlID0gJ3N0cmV0Y2gnLCBvbkVycm9yLCBzdHlsZSwgLi4ucHJvcHMgfSkge1xuICAvLyBEaXNwbGF5LXNpemUgaGludDogbGV0cyB0aGUgZW5naW5lIHJhc3Rlcml6ZSBTVkdzIGF0IHRoZSByZW5kZXJlZCBzaXplXG4gIC8vIChiaXRtYXBzIGlnbm9yZSBpdCkuIHN0eWxlLndpZHRoL2hlaWdodCB3aW4gb3ZlciB0aGUgcHJvcHMsIG1hdGNoaW5nIGxheW91dC5cbiAgY29uc3QgaGludFcgPSB0eXBlb2Ygc3R5bGU/LndpZHRoICA9PT0gJ251bWJlcicgPyBzdHlsZS53aWR0aCAgOiAodHlwZW9mIHdpZHRoICA9PT0gJ251bWJlcicgPyB3aWR0aCAgOiAwKTtcbiAgY29uc3QgaGludEggPSB0eXBlb2Ygc3R5bGU/LmhlaWdodCA9PT0gJ251bWJlcicgPyBzdHlsZS5oZWlnaHQgOiAodHlwZW9mIGhlaWdodCA9PT0gJ251bWJlcicgPyBoZWlnaHQgOiAwKTtcbiAgY29uc3QgaW1hZ2VJZCA9IFJlYWN0LnVzZU1lbW8oKCkgPT4ge1xuICAgIGlmICghc3JjKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gX19nbHl4X2NyZWF0ZUltYWdlKHNyYywgaGludFcsIGhpbnRIKTtcbiAgfSwgW3NyYywgaGludFcsIGhpbnRIXSk7XG5cbiAgLy8gS2VlcCB0aGUgbGF0ZXN0IG9uRXJyb3Igd2l0aG91dCByZS1yZWdpc3RlcmluZyBlYWNoIHJlbmRlci5cbiAgY29uc3Qgb25FcnJvclJlZiA9IHVzZVJlZihvbkVycm9yKTtcbiAgb25FcnJvclJlZi5jdXJyZW50ID0gb25FcnJvcjtcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaW1hZ2VJZCA9PSBudWxsKSByZXR1cm47XG4gICAgcmVnaXN0ZXJJbWFnZUVycm9yKGltYWdlSWQsIGV2ID0+IG9uRXJyb3JSZWYuY3VycmVudD8uKGV2KSk7XG4gICAgcmV0dXJuICgpID0+IHVucmVnaXN0ZXJJbWFnZUVycm9yKGltYWdlSWQpO1xuICB9LCBbaW1hZ2VJZF0pO1xuXG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KCdpbWFnZScsIHtcbiAgICBpbWFnZUlkLFxuICAgIHJlc2l6ZU1vZGUsXG4gICAgc3R5bGUsXG4gICAgd2lkdGgsXG4gICAgaGVpZ2h0LFxuICAgIC4uLnByb3BzLFxuICB9KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFByZXNzYWJsZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBSZWdpc3RyYXRpb24gc3RyYXRlZ3k6IHJlZ2lzdGVyIFNZTkNIUk9OT1VTTFkgaW5zaWRlIF9nbHl4T25Nb3VudCwgd2hpY2hcbi8vIGZpcmVzIGZyb20gY3JlYXRlSW5zdGFuY2UgZHVyaW5nIFJlYWN0J3MgY29tbWl0IHBoYXNlIFx1MjAxNCBndWFyYW50ZWVkIGJlZm9yZVxuLy8gYW55IGZyYW1lX3RpY2sgZGlzcGF0Y2hlcyBldmVudHMuXG4vL1xuLy8gQSBoYW5kbGVyc1JlZiBwcm94eSBpcyBzdG9yZWQgaW4gdGhlIHJlZ2lzdHJ5IHNvIHRoZSByZWdpc3RlcmVkIGNhbGxiYWNrc1xuLy8gYWx3YXlzIGRlbGVnYXRlIHRvIHRoZSBsYXRlc3QgY2xvc3VyZSB2YWx1ZXMgd2l0aG91dCBuZWVkaW5nIHJlLXJlZ2lzdHJhdGlvblxuLy8gb24gZXZlcnkgcmVuZGVyLlxuXG5leHBvcnQgZnVuY3Rpb24gUHJlc3NhYmxlKHsgY2hpbGRyZW4sIG9uUHJlc3MsIG9uUmlnaHRQcmVzcywgb25QcmVzc0luLCBvblByZXNzT3V0LCBvbkhvdmVySW4sIG9uSG92ZXJPdXQsIGRpc2FibGVkLCBmZWVkYmFjayA9IHRydWUsIHN0eWxlLCAuLi5wcm9wcyB9KSB7XG4gIGNvbnN0IG5vZGVJZFJlZiAgICA9IHVzZVJlZihudWxsKTtcbiAgY29uc3QgaGFuZGxlcnNSZWYgID0gdXNlUmVmKG51bGwpO1xuICBjb25zdCBbcHJlc3NlZCwgc2V0UHJlc3NlZF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtob3ZlcmVkLCBzZXRIb3ZlcmVkXSA9IHVzZVN0YXRlKGZhbHNlKTtcblxuICAvLyBBbHdheXMga2VlcCBoYW5kbGVyc1JlZiB1cCB0byBkYXRlIHdpdGggdGhlIGxhdGVzdCBwcm9wIHZhbHVlcy5cbiAgaGFuZGxlcnNSZWYuY3VycmVudCA9IHtcbiAgICBvblByZXNzOiAgICAgIChlKSA9PiBvblByZXNzPy4oZSksXG4gICAgb25SaWdodFByZXNzOiAoZSkgPT4gb25SaWdodFByZXNzPy4oZSksXG4gICAgb25QcmVzc0luOiAgKCkgPT4geyBzZXRQcmVzc2VkKHRydWUpOyAgb25QcmVzc0luPy4oKTsgfSxcbiAgICBvblByZXNzT3V0OiAoKSA9PiB7IHNldFByZXNzZWQoZmFsc2UpOyBvblByZXNzT3V0Py4oKTsgfSxcbiAgICBvbkhvdmVySW46ICAoKSA9PiB7IHNldEhvdmVyZWQodHJ1ZSk7ICBvbkhvdmVySW4/LigpOyB9LFxuICAgIG9uSG92ZXJPdXQ6ICgpID0+IHsgc2V0SG92ZXJlZChmYWxzZSk7IG9uSG92ZXJPdXQ/LigpOyB9LFxuICB9O1xuXG4gIC8vIENhbGxlZCBzeW5jaHJvbm91c2x5IGJ5IGNyZWF0ZUluc3RhbmNlIHRoZSBtb21lbnQgdGhlIG5hdGl2ZSBub2RlIGV4aXN0cy5cbiAgY29uc3Qgb25Nb3VudCA9IHVzZUNhbGxiYWNrKChpZCkgPT4ge1xuICAgIG5vZGVJZFJlZi5jdXJyZW50ID0gaWQ7XG4gICAgLy8gUmVnaXN0ZXIgc3RhYmxlIHByb3h5IGZ1bmN0aW9ucyB0aGF0IGRlbGVnYXRlIHRvIGhhbmRsZXJzUmVmLlxuICAgIHJlZ2lzdGVyUHJlc3NhYmxlKGlkLCB7XG4gICAgICBvblByZXNzOiAgICAgIChlKSA9PiBoYW5kbGVyc1JlZi5jdXJyZW50Lm9uUHJlc3MoZSksXG4gICAgICBvblJpZ2h0UHJlc3M6IChlKSA9PiBoYW5kbGVyc1JlZi5jdXJyZW50Lm9uUmlnaHRQcmVzcyhlKSxcbiAgICAgIG9uUHJlc3NJbjogICgpID0+IGhhbmRsZXJzUmVmLmN1cnJlbnQub25QcmVzc0luKCksXG4gICAgICBvblByZXNzT3V0OiAoKSA9PiBoYW5kbGVyc1JlZi5jdXJyZW50Lm9uUHJlc3NPdXQoKSxcbiAgICAgIG9uSG92ZXJJbjogICgpID0+IGhhbmRsZXJzUmVmLmN1cnJlbnQub25Ib3ZlckluKCksXG4gICAgICBvbkhvdmVyT3V0OiAoKSA9PiBoYW5kbGVyc1JlZi5jdXJyZW50Lm9uSG92ZXJPdXQoKSxcbiAgICB9KTtcbiAgICByZWdpc3RlckRpc2FibGVkTm9kZShpZCwgISFkaXNhYmxlZCk7XG4gIH0sIFtkaXNhYmxlZF0pOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHJlYWN0LWhvb2tzL2V4aGF1c3RpdmUtZGVwc1xuXG4gIC8vIEtlZXAgZGlzYWJsZWQgc3RhdGUgaW4gc3luYyB3aGVuIHRoZSBwcm9wIGNoYW5nZXM7IGFsc28gY2xlYXIgYW55XG4gIC8vIHN0dWNrIGludGVyYWN0aW9uIHN0YXRlIHNvIHRoZSBidXR0b24gZG9lc24ndCBhcHBlYXIgaG92ZXJlZC9wcmVzc2VkXG4gIC8vIGFmdGVyIGJlY29taW5nIGRpc2FibGVkLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChub2RlSWRSZWYuY3VycmVudCAhPT0gbnVsbCkge1xuICAgICAgcmVnaXN0ZXJEaXNhYmxlZE5vZGUobm9kZUlkUmVmLmN1cnJlbnQsICEhZGlzYWJsZWQpO1xuICAgIH1cbiAgICBpZiAoZGlzYWJsZWQpIHtcbiAgICAgIHNldFByZXNzZWQoZmFsc2UpO1xuICAgICAgc2V0SG92ZXJlZChmYWxzZSk7XG4gICAgfVxuICB9LCBbZGlzYWJsZWRdKTtcblxuICAvLyBVbnJlZ2lzdGVyIG9uIHVubW91bnQuIHVzZUVmZmVjdCBmb3IgY2xlYW51cCBvbmx5IFx1MjAxNCBubyB0aW1pbmcgZGVwZW5kZW5jeS5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKG5vZGVJZFJlZi5jdXJyZW50ICE9PSBudWxsKSB7XG4gICAgICAgIHVucmVnaXN0ZXJQcmVzc2FibGUobm9kZUlkUmVmLmN1cnJlbnQpO1xuICAgICAgICB1bnJlZ2lzdGVyRGlzYWJsZWROb2RlKG5vZGVJZFJlZi5jdXJyZW50KTtcbiAgICAgIH1cbiAgICB9O1xuICB9LCBbXSk7XG5cbiAgLy8gVmlzdWFsIGZlZWRiYWNrIChvcGFjaXR5LWJhc2VkIFx1MjAxNCBzdGF5cyB3aXRoaW4gZWxlbWVudCBib3VuZHMpOlxuICAvLyAgIHByZXNzZWQgXHUyMTkyIGRhcmtlbmVkIChjb25maXJtcyB0aGUgY2xpY2spXG4gIC8vICAgaG92ZXJlZCBcdTIxOTIgc2xpZ2h0bHkgZGltbWVkIChpbmRpY2F0ZXMgaW50ZXJhY3Rpdml0eSlcbiAgLy8gICBkaXNhYmxlZCAvIGRlZmF1bHQgLyBmZWVkYmFjazpmYWxzZSBcdTIxOTIgbm8gY2hhbmdlXG4gIC8vIGBmZWVkYmFjazogZmFsc2VgIGlzIGZvciBzdHJ1Y3R1cmFsIHByZXNzYWJsZXMgKGJhY2tkcm9wcywgY2xpY2tcbiAgLy8gYWJzb3JiZXJzLCBjdXN0b20tc3R5bGVkIGNvbnRyb2xzKSBcdTIwMTQgb3BhY2l0eSBvbiBhIGNvbnRhaW5lciBtdWx0aXBsaWVzXG4gIC8vIHRocm91Z2ggdGhlIHdob2xlIHN1YnRyZWUsIHNvIGEgZGltbWluZyBiYWNrZHJvcCBkaW1zIGl0cyBjb250ZW50IHRvby5cbiAgLy8gc3R5bGUgbWF5IGJlIGEgZnVuY3Rpb24gcmVjZWl2aW5nIHRoZSBpbnRlcmFjdGlvbiBzdGF0ZSAoUk4tc3R5bGUpOlxuICAvLyAgIHN0eWxlPXsoeyBwcmVzc2VkLCBob3ZlcmVkIH0pID0+ICh7IC4uLiB9KX1cbiAgLy8gRnVuY3Rpb24gc3R5bGVzIGhhbmRsZSB0aGVpciBvd24gZmVlZGJhY2ssIHNvIG9wYWNpdHkgZmVlZGJhY2sgaXMgc2tpcHBlZC5cbiAgY29uc3Qgc3R5bGVJc0ZuID0gdHlwZW9mIHN0eWxlID09PSAnZnVuY3Rpb24nO1xuICBjb25zdCByZXNvbHZlZFN0eWxlID0gc3R5bGVJc0ZuID8gc3R5bGUoeyBwcmVzc2VkLCBob3ZlcmVkIH0pIDogc3R5bGU7XG4gIGNvbnN0IGJhc2VPcGFjaXR5ID0gcmVzb2x2ZWRTdHlsZT8ub3BhY2l0eSA/PyAxO1xuICBjb25zdCBtZXJnZWRTdHlsZSA9ICghc3R5bGVJc0ZuICYmIGZlZWRiYWNrICYmIHByZXNzZWQgJiYgIWRpc2FibGVkKVxuICAgID8geyAuLi5yZXNvbHZlZFN0eWxlLCBvcGFjaXR5OiBiYXNlT3BhY2l0eSAqIDAuNjUgfVxuICAgIDogKCFzdHlsZUlzRm4gJiYgZmVlZGJhY2sgJiYgaG92ZXJlZCAmJiAhZGlzYWJsZWQpXG4gICAgPyB7IC4uLnJlc29sdmVkU3R5bGUsIG9wYWNpdHk6IGJhc2VPcGFjaXR5ICogMC44NSB9XG4gICAgOiByZXNvbHZlZFN0eWxlO1xuXG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFxuICAgICd2aWV3JyxcbiAgICAvLyBwcmVzc2FibGU6dHJ1ZSB0ZWxscyB0aGUgUnVzdCBkcmFnLWNoZWNrIHRoYXQgdGhpcyBub2RlIGlzIGludGVyYWN0aXZlLFxuICAgIC8vIHNvIGdseXhEcmFnZ2FibGUgcmVnaW9ucyBza2lwIHRoZSB3aW5kb3cgZHJhZyB3aGVuIHRoaXMgaXMgdW5kZXIgY3Vyc29yLlxuICAgIHsgX2dseXhPbk1vdW50OiBvbk1vdW50LCBzdHlsZTogbWVyZ2VkU3R5bGUsIHByZXNzYWJsZTogdHJ1ZSwgLi4ucHJvcHMgfSxcbiAgICBjaGlsZHJlblxuICApO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgdXNlRHJhZ2dhYmxlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIExvdy1sZXZlbCBkcmFnIGhvb2suIFJldHVybnMgYW4gYF9nbHl4T25Nb3VudGAgY2FsbGJhY2sgdG8gc3ByZWFkIG9udG8gYSBWaWV3O1xuLy8gdGhlIFZpZXcncyBmdWxsIGFyZWEgdGhlbiByZWNlaXZlcyBuYXRpdmUgZHJhZyBldmVudHM6XG4vLyAgIG9uRHJhZ1N0YXJ0KHt4LHl9KSBcdTAwQjcgb25EcmFnTW92ZSh7eCx5LGR4LGR5fSkgXHUwMEI3IG9uRHJhZ0VuZCh7eCx5fSlcbi8vIFVzZWQgdG8gYnVpbGQgc3BsaXQgcGFuZXMsIGRyYWctYW5kLWRyb3AsIHJlc2l6ZSBoYW5kbGVzLCBldGMuXG4vL1xuLy8gICBjb25zdCBvbk1vdW50ID0gdXNlRHJhZ2dhYmxlKHsgb25EcmFnTW92ZTogKHtkeH0pID0+IHNldFcodyA9PiB3ICsgZHgpIH0pO1xuLy8gICA8VmlldyBfZ2x5eE9uTW91bnQ9e29uTW91bnR9IC4uLiAvPlxuZXhwb3J0IGZ1bmN0aW9uIHVzZURyYWdnYWJsZShoYW5kbGVycykge1xuICBjb25zdCBpZFJlZiA9IHVzZVJlZihudWxsKTtcbiAgY29uc3QgaFJlZiAgPSB1c2VSZWYoaGFuZGxlcnMpO1xuICBoUmVmLmN1cnJlbnQgPSBoYW5kbGVycztcbiAgY29uc3Qgb25Nb3VudCA9IHVzZUNhbGxiYWNrKChpZCkgPT4ge1xuICAgIGlkUmVmLmN1cnJlbnQgPSBpZDtcbiAgICByZWdpc3RlckRyYWdnYWJsZShpZCwge1xuICAgICAgb25EcmFnU3RhcnQ6IChlKSA9PiBoUmVmLmN1cnJlbnQub25EcmFnU3RhcnQ/LihlKSxcbiAgICAgIG9uRHJhZ01vdmU6ICAoZSkgPT4gaFJlZi5jdXJyZW50Lm9uRHJhZ01vdmU/LihlKSxcbiAgICAgIG9uRHJhZ0VuZDogICAoZSkgPT4gaFJlZi5jdXJyZW50Lm9uRHJhZ0VuZD8uKGUpLFxuICAgIH0pO1xuICB9LCBbXSk7XG4gIHVzZUVmZmVjdCgoKSA9PiAoKSA9PiB7IGlmIChpZFJlZi5jdXJyZW50ICE9PSBudWxsKSB1bnJlZ2lzdGVyRHJhZ2dhYmxlKGlkUmVmLmN1cnJlbnQpOyB9LCBbXSk7XG4gIHJldHVybiBvbk1vdW50O1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2Nyb2xsVmlldyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBBIHZlcnRpY2FsbHktc2Nyb2xsYWJsZSBjb250YWluZXIgYmFja2VkIGJ5IGEgVmVsbG8gY2xpcCBsYXllci5cbi8vXG4vLyBUaGUgbmF0aXZlIHZpZXcgcmVjZWl2ZXMgdHdvIGV4dHJhIHByb3BzIHRoYXQgdGhlIFJ1c3QgcmVuZGVyZXIgaGFuZGxlczpcbi8vICAgY2xpcDogdHJ1ZSAgICAgICAgICBcdTIwMTQgcHVzaCBhIFZlbGxvIGNsaXAgbGF5ZXIgYXJvdW5kIGNoaWxkcmVuXG4vLyAgIHNjcm9sbE9mZnNldFk6IG4gICAgXHUyMDE0IHNoaWZ0IGNoaWxkcmVuIHVwd2FyZCBieSBuIHBpeGVsc1xuLy9cbi8vIFNjcm9sbCBkZWx0YXMgYXJyaXZlIHZpYSB0aGUgYHNjcm9sbGAgaW5wdXQgZXZlbnQsIHJvdXRlZCBieSBldmVudHMuanMgdG9cbi8vIHdoaWNoZXZlciBTY3JvbGxWaWV3IHRoZSBjdXJzb3IgaXMgY3VycmVudGx5IG92ZXIuICBUaGUgY29tcG9uZW50IGNvbnZlcnRzXG4vLyBkZWx0YXMgaW50byBhIFJlYWN0IHN0YXRlIGludGVnZXIgYW5kIHJlLXJlbmRlcnMsIHdoaWNoIHRyaWdnZXJzIGFcbi8vIHZpc3VhbC1vbmx5IFVwZGF0ZU5vZGUgKG5vIFRhZmZ5IHJlYnVpbGQgXHUyMDE0IGluY3JlbWVudGFsIGxheW91dCkuXG5cbmV4cG9ydCBmdW5jdGlvbiBTY3JvbGxWaWV3KHtcbiAgY2hpbGRyZW4sXG4gIHN0eWxlLFxuICBoZWlnaHQsICAgICAgICAgICAgICAgLy8gbGF5b3V0IGhlaWdodCBcdTIwMTQgb25seSBzZXQgaWYgeW91IG5lZWQgYSBmaXhlZCBoZWlnaHRcbiAgY29udGVudEhlaWdodCwgICAgICAgIC8vIGV4cGxpY2l0IGNvbnRlbnQgaGVpZ2h0IG92ZXJyaWRlIChtb3JlIHJlbGlhYmxlIHRoYW4gYXV0by1kZXRlY3QpXG4gIHNob3dTY3JvbGxiYXIgICA9IHRydWUsXG4gIHNjcm9sbGJhcldpZHRoICA9IDgsXG4gIHNjcm9sbGJhckNvbG9yICA9ICcjOGM4Y2FhOTknLFxuICAuLi5wcm9wc1xufSkge1xuICBjb25zdCBub2RlSWRSZWYgICAgPSB1c2VSZWYobnVsbCk7XG4gIGNvbnN0IG1heFNjcm9sbFJlZiA9IHVzZVJlZigwKTtcbiAgY29uc3QgW3Njcm9sbFksIHNldFNjcm9sbFldID0gdXNlU3RhdGUoMCk7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIENvbXB1dGUgbWF4IHNjcm9sbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gUHJlZmVyIHRoZSBleHBsaWNpdCBgY29udGVudEhlaWdodGAgcHJvcCB3aGVuIHByb3ZpZGVkIChtb3N0IHJlbGlhYmxlKS5cbiAgLy8gT3RoZXJ3aXNlIGVzdGltYXRlIGJ5IHN1bW1pbmcgY2hpbGQgYGhlaWdodGAgcHJvcHMgZnJvbSB0aGUgUmVhY3QgZWxlbWVudFxuICAvLyB0cmVlIFx1MjAxNCB3b3JrcyBmb3IgdW5pZm9ybS1oZWlnaHQgbGlzdHMgd2hlcmUgaGVpZ2h0cyBhcmUgZXhwbGljaXQgcHJvcHMuXG4gIGNvbnN0IGNoaWxkQXJyYXkgPSBSZWFjdC5DaGlsZHJlbi50b0FycmF5KGNoaWxkcmVuKTtcbiAgY29uc3QgZ2FwICAgICAgICA9IChzdHlsZSAmJiBzdHlsZS5nYXApICAgICB8fCAwO1xuICBjb25zdCBwYWRkaW5nICAgID0gKHN0eWxlICYmIHN0eWxlLnBhZGRpbmcpIHx8IDA7XG4gIGNvbnN0IGF1dG9Db250ZW50SCA9IGNoaWxkQXJyYXkucmVkdWNlKChzdW0sIGMpID0+IHN1bSArIChjLnByb3BzPy5oZWlnaHQgfHwgMCksIDApXG4gICAgICAgICAgICAgICAgICAgICArIE1hdGgubWF4KDAsIGNoaWxkQXJyYXkubGVuZ3RoIC0gMSkgKiBnYXBcbiAgICAgICAgICAgICAgICAgICAgICsgMiAqIHBhZGRpbmc7XG4gIGNvbnN0IHJlc29sdmVkQ29udGVudEggPSBjb250ZW50SGVpZ2h0ID8/IGF1dG9Db250ZW50SDtcblxuICAvLyBIZWlnaHQgZm9yIHNjcm9sbCBjYXA6IGV4cGxpY2l0IHByb3AgPiBzdHlsZS5oZWlnaHQgPiAwICh1bmNhcHBlZCkuXG4gIGNvbnN0IHZpZXdIID0gaGVpZ2h0ID8/IChzdHlsZSAmJiBzdHlsZS5oZWlnaHQpID8/IDA7XG4gIG1heFNjcm9sbFJlZi5jdXJyZW50ID0gTWF0aC5tYXgoMCwgcmVzb2x2ZWRDb250ZW50SCAtIHZpZXdIKTtcblxuICAvLyBcdTI1MDBcdTI1MDAgU3RhYmxlIHNjcm9sbCBoYW5kbGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBFbXB0eSBkZXAgYXJyYXkgXHUyMTkyIGNyZWF0ZWQgb25jZSwgcmUtcmVnaXN0ZXJlZCBuZXZlci5cbiAgLy8gUmVhZHMgbWF4U2Nyb2xsUmVmLmN1cnJlbnQgKG5vdCBhIGNhcHR1cmVkIHZhbHVlKSBzbyB0aGUgY2FwIGlzIGFsd2F5cyBmcmVzaC5cbiAgLy8gUmVmcmVzaCBtYXhTY3JvbGwgZnJvbSBSRUFMIGxheW91dCByaWdodCBiZWZvcmUgY2xhbXBpbmcuICBUaGUgbmF0aXZlXG4gIC8vIGxheW91dCBjYWNoZSByZXBvcnRzIGBjb250ZW50SGVpZ2h0YCBmb3IgY2xpcCBub2RlcyAobWVhc3VyZWQgZnJvbSBhY3R1YWxcbiAgLy8gY2hpbGQgcmVjdHMpLCB3aGljaCBzdXBlcnNlZGVzIHRoZSBwcm9wLXN1bSBlc3RpbWF0ZSBcdTIwMTQgYXV0by1zaXplZCBjaGlsZHJlblxuICAvLyAobm8gaGVpZ2h0IHByb3BzKSB3b3VsZCBvdGhlcndpc2UgY29tcHV0ZSBtYXhTY3JvbGwgPSAwIGFuZCBraWxsIHNjcm9sbGluZy5cbiAgY29uc3QgcmVmcmVzaE1heFNjcm9sbCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBjb25zdCBpZCA9IG5vZGVJZFJlZi5jdXJyZW50O1xuICAgIGlmIChpZCA9PSBudWxsIHx8IHR5cGVvZiBfX2dseXhfZ2V0TGF5b3V0ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICAgIGNvbnN0IGwgPSBfX2dseXhfZ2V0TGF5b3V0KGlkKTtcbiAgICBpZiAobCAmJiB0eXBlb2YgbC5jb250ZW50SGVpZ2h0ID09PSAnbnVtYmVyJyAmJiBsLmNvbnRlbnRIZWlnaHQgPiAwKSB7XG4gICAgICBtYXhTY3JvbGxSZWYuY3VycmVudCA9IE1hdGgubWF4KDAsIGwuY29udGVudEhlaWdodCAtIGwuaGVpZ2h0KTtcbiAgICB9XG4gIH0sIFtdKTtcblxuICBjb25zdCBvblNjcm9sbCA9IHVzZUNhbGxiYWNrKChkZWx0YVkpID0+IHtcbiAgICByZWZyZXNoTWF4U2Nyb2xsKCk7XG4gICAgc2V0U2Nyb2xsWSgocHJldikgPT4ge1xuICAgICAgY29uc3QgbWF4ID0gbWF4U2Nyb2xsUmVmLmN1cnJlbnQ7XG4gICAgICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heCgwLCBwcmV2ICsgZGVsdGFZKSk7XG4gICAgfSk7XG4gIH0sIFtdKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcblxuICBjb25zdCBvbkFic29sdXRlU2Nyb2xsID0gdXNlQ2FsbGJhY2soKHkpID0+IHtcbiAgICByZWZyZXNoTWF4U2Nyb2xsKCk7XG4gICAgc2V0U2Nyb2xsWShNYXRoLm1pbihtYXhTY3JvbGxSZWYuY3VycmVudCwgTWF0aC5tYXgoMCwgeSkpKTtcbiAgfSwgW10pOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHJlYWN0LWhvb2tzL2V4aGF1c3RpdmUtZGVwc1xuXG4gIGNvbnN0IG9uTW91bnQgPSB1c2VDYWxsYmFjaygoaWQpID0+IHtcbiAgICBub2RlSWRSZWYuY3VycmVudCA9IGlkO1xuICAgIHJlZ2lzdGVyU2Nyb2xsVmlldyhpZCwgeyBvblNjcm9sbCwgb25BYnNvbHV0ZVNjcm9sbCB9KTtcbiAgfSwgW29uU2Nyb2xsLCBvbkFic29sdXRlU2Nyb2xsXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKG5vZGVJZFJlZi5jdXJyZW50ICE9PSBudWxsKSB7XG4gICAgICAgIHVucmVnaXN0ZXJTY3JvbGxWaWV3KG5vZGVJZFJlZi5jdXJyZW50KTtcbiAgICAgIH1cbiAgICB9O1xuICB9LCBbXSk7XG5cbiAgY29uc3Qgdmlld1N0eWxlID0ge1xuICAgIC8vIEl0ZW1zIHN0YWNrIGZyb20gdG9wOiBwcmV2ZW50cyBUYWZmeSBjZW50ZXJpbmcgb3ZlcmZsb3dpbmcgY29udGVudFxuICAgIC8vIGFib3ZlIHRoZSB2aWV3cG9ydCBvcmlnaW4sIHdoaWNoIHdvdWxkIG1ha2UgZWFybHkgaXRlbXMgaW52aXNpYmxlLlxuICAgIGp1c3RpZnlDb250ZW50OiAnZmxleC1zdGFydCcsXG4gICAgYWxpZ25JdGVtczogICAgICdzdHJldGNoJyxcbiAgICAvLyBSdXN0OiBwdXNoIFZlbGxvIGNsaXAgbGF5ZXIgKyBzaGlmdCBjaGlsZHJlbiBieSBzY3JvbGxPZmZzZXRZLlxuICAgIGNsaXA6ICAgICAgICAgICB0cnVlLFxuICAgIHNjcm9sbE9mZnNldFk6ICBzY3JvbGxZLFxuICAgIC8vIFNjcm9sbGJhciB2aXN1YWwgcHJvcHNcbiAgICBzaG93U2Nyb2xsYmFyLFxuICAgIHNjcm9sbGJhcldpZHRoLFxuICAgIHNjcm9sbGJhckNvbG9yLFxuICAgIC4uLnN0eWxlLFxuICB9O1xuXG4gIGNvbnN0IGZpbmFsU3R5bGUgPSBoZWlnaHQgIT0gbnVsbCA/IHsgLi4udmlld1N0eWxlLCBoZWlnaHQgfSA6IHZpZXdTdHlsZTtcblxuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcbiAgICAndmlldycsXG4gICAgeyBfZ2x5eE9uTW91bnQ6IG9uTW91bnQsIHN0eWxlOiBmaW5hbFN0eWxlLCAuLi5wcm9wcyB9LFxuICAgIGNoaWxkcmVuLFxuICApO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgVmlydHVhbGl6ZWRMaXN0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIEEgd2luZG93ZWQgbGlzdCB0aGF0IHJlbmRlcnMgb25seSB0aGUgaXRlbXMgY3VycmVudGx5IHZpc2libGUgaW4gdGhlXG4vLyB2aWV3cG9ydCwgcGx1cyBhbiBgb3ZlcnNjYW5gIGJ1ZmZlciBvbiBlYWNoIHNpZGUuICBMYXJnZSBkYXRhc2V0cyAodGhvdXNhbmRzXG4vLyBvZiBpdGVtcykgaW5jdXIgbm8gbGF5b3V0IG9yIGRyYXcgY29zdCBmb3Igb2ZmLXNjcmVlbiByb3dzLlxuLy9cbi8vIFVubGlrZSBTY3JvbGxWaWV3ICh3aGljaCByZW5kZXJzIGFsbCBjaGlsZHJlbiksIFZpcnR1YWxpemVkTGlzdCByZXBsYWNlc1xuLy8gaW52aXNpYmxlIGl0ZW1zIHdpdGggbGlnaHR3ZWlnaHQgc3BhY2VyIFZpZXdzLCBzbyBUYWZmeSBvbmx5IGxheXMgb3V0IHRoZVxuLy8gdmlzaWJsZSBzbGljZS5cbi8vXG4vLyBSZXF1aXJlbWVudHM6XG4vLyAgIFx1MjAyMiBgaXRlbUhlaWdodGAgbXVzdCBiZSBhIGZpeGVkIG51bWJlciAodW5pZm9ybS1oZWlnaHQgcm93cykuXG4vLyAgICAgVmFyaWFibGUtaGVpZ2h0IHN1cHBvcnQgKG1lYXN1cmVkIGl0ZW1zKSBpcyBwbGFubmVkIGZvciBhIGZ1dHVyZSByZWxlYXNlLlxuLy8gICBcdTIwMjIgYGhlaWdodGAgICAgIFx1MjAxNCB2aXNpYmxlIGNvbnRhaW5lciBoZWlnaHQgaW4gcHggKHJlcXVpcmVkKVxuLy8gICBcdTIwMjIgYHdpZHRoYCAgICAgIFx1MjAxNCBjb250YWluZXIgd2lkdGggaW4gcHggKHJlcXVpcmVkKVxuLy9cbi8vIFVzYWdlOlxuLy8gICA8VmlydHVhbGl6ZWRMaXN0XG4vLyAgICAgZGF0YT17aXRlbXN9XG4vLyAgICAgcmVuZGVySXRlbT17KHsgaXRlbSwgaW5kZXggfSkgPT4gPFJvdyBpdGVtPXtpdGVtfSAvPn1cbi8vICAgICBrZXlFeHRyYWN0b3I9eyhpdGVtKSA9PiBTdHJpbmcoaXRlbS5pZCl9XG4vLyAgICAgaXRlbUhlaWdodD17NTZ9XG4vLyAgICAgaGVpZ2h0PXs2MDB9XG4vLyAgICAgd2lkdGg9ezQwMH1cbi8vICAgLz5cblxuZXhwb3J0IGZ1bmN0aW9uIFZpcnR1YWxpemVkTGlzdCh7XG4gIGRhdGEsXG4gIHJlbmRlckl0ZW0sXG4gIGtleUV4dHJhY3RvcixcbiAgaXRlbUhlaWdodCxcbiAgaGVpZ2h0LFxuICB3aWR0aCxcbiAgb3ZlcnNjYW4gICAgICAgPSA1LFxuICBzaG93U2Nyb2xsYmFyICA9IHRydWUsXG4gIHNjcm9sbGJhcldpZHRoID0gOCxcbiAgc2Nyb2xsYmFyQ29sb3IgPSAnIzhjOGNhYTk5JyxcbiAgc3R5bGUsXG4gIC4uLnByb3BzXG59KSB7XG4gIGNvbnN0IG5vZGVJZFJlZiAgICA9IHVzZVJlZihudWxsKTtcbiAgY29uc3QgbWF4U2Nyb2xsUmVmID0gdXNlUmVmKDApO1xuICBjb25zdCBbc2Nyb2xsWSwgc2V0U2Nyb2xsWV0gPSB1c2VTdGF0ZSgwKTtcblxuICBjb25zdCB0b3RhbEl0ZW1zICAgID0gZGF0YSA/IGRhdGEubGVuZ3RoIDogMDtcbiAgY29uc3QgdG90YWxDb250ZW50SCA9IHRvdGFsSXRlbXMgKiBpdGVtSGVpZ2h0O1xuXG4gIC8vIEtlZXAgbWF4U2Nyb2xsIGN1cnJlbnQgd2l0aG91dCByZS1yZWdpc3RlcmluZyB0aGUgc2Nyb2xsIGhhbmRsZXIuXG4gIG1heFNjcm9sbFJlZi5jdXJyZW50ID0gTWF0aC5tYXgoMCwgdG90YWxDb250ZW50SCAtIGhlaWdodCk7XG5cbiAgLy8gVmlzaWJsZSB3aW5kb3cgKGl0ZW0gaW5kaWNlcykuXG4gIGNvbnN0IGZpcnN0VmlzaWJsZSA9IE1hdGgubWF4KDAsIE1hdGguZmxvb3Ioc2Nyb2xsWSAvIGl0ZW1IZWlnaHQpIC0gb3ZlcnNjYW4pO1xuICBjb25zdCBsYXN0VmlzaWJsZSAgPSBNYXRoLm1pbih0b3RhbEl0ZW1zLCBNYXRoLmNlaWwoKHNjcm9sbFkgKyBoZWlnaHQpIC8gaXRlbUhlaWdodCkgKyBvdmVyc2Nhbik7XG5cbiAgY29uc3QgdG9wU3BhY2VySCAgICA9IGZpcnN0VmlzaWJsZSAqIGl0ZW1IZWlnaHQ7XG4gIGNvbnN0IGJvdHRvbVNwYWNlckggPSBNYXRoLm1heCgwLCAodG90YWxJdGVtcyAtIGxhc3RWaXNpYmxlKSAqIGl0ZW1IZWlnaHQpO1xuXG4gIC8vIFN0YWJsZSBoYW5kbGVycyBcdTIwMTQgbmV2ZXIgcmUtcmVnaXN0ZXJlZCBiZXR3ZWVuIHJlbmRlcnMuXG4gIGNvbnN0IG9uU2Nyb2xsID0gdXNlQ2FsbGJhY2soKGRlbHRhWSkgPT4ge1xuICAgIHNldFNjcm9sbFkoKHByZXYpID0+IE1hdGgubWluKG1heFNjcm9sbFJlZi5jdXJyZW50LCBNYXRoLm1heCgwLCBwcmV2ICsgZGVsdGFZKSkpO1xuICB9LCBbXSk7XG5cbiAgY29uc3Qgb25BYnNvbHV0ZVNjcm9sbCA9IHVzZUNhbGxiYWNrKCh5KSA9PiB7XG4gICAgc2V0U2Nyb2xsWShNYXRoLm1pbihtYXhTY3JvbGxSZWYuY3VycmVudCwgTWF0aC5tYXgoMCwgeSkpKTtcbiAgfSwgW10pO1xuXG4gIGNvbnN0IG9uTW91bnQgPSB1c2VDYWxsYmFjaygoaWQpID0+IHtcbiAgICBub2RlSWRSZWYuY3VycmVudCA9IGlkO1xuICAgIHJlZ2lzdGVyU2Nyb2xsVmlldyhpZCwgeyBvblNjcm9sbCwgb25BYnNvbHV0ZVNjcm9sbCB9KTtcbiAgfSwgW29uU2Nyb2xsLCBvbkFic29sdXRlU2Nyb2xsXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKG5vZGVJZFJlZi5jdXJyZW50ICE9PSBudWxsKSB1bnJlZ2lzdGVyU2Nyb2xsVmlldyhub2RlSWRSZWYuY3VycmVudCk7XG4gICAgfTtcbiAgfSwgW10pO1xuXG4gIC8vIEJ1aWxkIHRoZSB2aXNpYmxlIHNsaWNlLlxuICBjb25zdCB2aXNpYmxlQ2hpbGRyZW4gPSBbXTtcblxuICBpZiAodG9wU3BhY2VySCA+IDApIHtcbiAgICB2aXNpYmxlQ2hpbGRyZW4ucHVzaChcbiAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywgeyBrZXk6ICdfX3ZsX3RvcCcsIGhlaWdodDogdG9wU3BhY2VySCwgd2lkdGggfSlcbiAgICApO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IGZpcnN0VmlzaWJsZTsgaSA8IGxhc3RWaXNpYmxlOyBpKyspIHtcbiAgICBjb25zdCBpdGVtID0gZGF0YVtpXTtcbiAgICBjb25zdCBrZXkgID0ga2V5RXh0cmFjdG9yID8ga2V5RXh0cmFjdG9yKGl0ZW0sIGkpIDogU3RyaW5nKGkpO1xuICAgIHZpc2libGVDaGlsZHJlbi5wdXNoKFxuICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcbiAgICAgICAgVmlldyxcbiAgICAgICAgeyBrZXksIGhlaWdodDogaXRlbUhlaWdodCwgd2lkdGggfSxcbiAgICAgICAgcmVuZGVySXRlbSh7IGl0ZW0sIGluZGV4OiBpIH0pXG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIGlmIChib3R0b21TcGFjZXJIID4gMCkge1xuICAgIHZpc2libGVDaGlsZHJlbi5wdXNoKFxuICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7IGtleTogJ19fdmxfYm90JywgaGVpZ2h0OiBib3R0b21TcGFjZXJILCB3aWR0aCB9KVxuICAgICk7XG4gIH1cblxuICBjb25zdCB2aWV3U3R5bGUgPSB7XG4gICAganVzdGlmeUNvbnRlbnQ6ICdmbGV4LXN0YXJ0JyxcbiAgICBhbGlnbkl0ZW1zOiAgICAgJ2ZsZXgtc3RhcnQnLFxuICAgIGNsaXA6ICAgICAgICAgICB0cnVlLFxuICAgIHNjcm9sbE9mZnNldFk6ICBzY3JvbGxZLFxuICAgIHNob3dTY3JvbGxiYXIsXG4gICAgc2Nyb2xsYmFyV2lkdGgsXG4gICAgc2Nyb2xsYmFyQ29sb3IsXG4gICAgc2Nyb2xsQ29udGVudEg6IHRvdGFsQ29udGVudEgsXG4gICAgLi4uc3R5bGUsXG4gIH07XG5cbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXG4gICAgJ3ZpZXcnLFxuICAgIHsgX2dseXhPbk1vdW50OiBvbk1vdW50LCBzdHlsZTogdmlld1N0eWxlLCB3aWR0aCwgaGVpZ2h0LCAuLi5wcm9wcyB9LFxuICAgIC4uLnZpc2libGVDaGlsZHJlbixcbiAgKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFJlc3BvbnNpdmUgbGF5b3V0IGhvb2tzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vKipcbiAqIFJldHVybnMgdGhlIGN1cnJlbnQgd2luZG93IHNpemUgaW4gcGh5c2ljYWwgcGl4ZWxzLCB1cGRhdGluZyBvbiByZXNpemUuXG4gKiBAcmV0dXJucyB7eyB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciB9fVxuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlV2luZG93U2l6ZSgpIHtcbiAgY29uc3QgW3NpemUsIHNldFNpemVdID0gdXNlU3RhdGUoKCkgPT4ge1xuICAgIGNvbnN0IHMgPSB0eXBlb2YgX19nbHl4X2dldFdpbmRvd1NpemUgIT09ICd1bmRlZmluZWQnID8gX19nbHl4X2dldFdpbmRvd1NpemUoKSA6IG51bGw7XG4gICAgcmV0dXJuIHMgPyB7IHdpZHRoOiBzLndpZHRoLCBoZWlnaHQ6IHMuaGVpZ2h0IH0gOiB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAgfTtcbiAgfSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBoYW5kbGVyID0gKHMpID0+IHNldFNpemUocyk7XG4gICAgYWRkV2luZG93U2l6ZUxpc3RlbmVyKGhhbmRsZXIpO1xuICAgIHJldHVybiAoKSA9PiByZW1vdmVXaW5kb3dTaXplTGlzdGVuZXIoaGFuZGxlcik7XG4gIH0sIFtdKTtcblxuICByZXR1cm4gc2l6ZTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBjdXJyZW50IG1vbml0b3Igc2l6ZSBpbiBwaHlzaWNhbCBwaXhlbHMgKHJlYWQtb25jZSwgZG9lcyBub3QgdXBkYXRlKS5cbiAqIEByZXR1cm5zIHt7IHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyIH19XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VTY3JlZW5TaXplKCkge1xuICBjb25zdCBbc2l6ZV0gPSB1c2VTdGF0ZSgoKSA9PiB7XG4gICAgY29uc3QgcyA9IHR5cGVvZiBfX2dseXhfZ2V0U2NyZWVuU2l6ZSAhPT0gJ3VuZGVmaW5lZCcgPyBfX2dseXhfZ2V0U2NyZWVuU2l6ZSgpIDogbnVsbDtcbiAgICByZXR1cm4gcyA/IHsgd2lkdGg6IHMud2lkdGgsIGhlaWdodDogcy5oZWlnaHQgfSA6IHsgd2lkdGg6IDAsIGhlaWdodDogMCB9O1xuICB9KTtcbiAgcmV0dXJuIHNpemU7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIHdoZW4gdGhlIHdpbmRvdyB3aWR0aCBpcyBhdCBsZWFzdCBgbWluV2lkdGhgIHBpeGVscy5cbiAqIEVxdWl2YWxlbnQgdG8gQ1NTIGBAbWVkaWEgKG1pbi13aWR0aDogWHB4KWAuXG4gKiBAcGFyYW0ge251bWJlcn0gbWluV2lkdGhcbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlTWVkaWFRdWVyeShtaW5XaWR0aCkge1xuICBjb25zdCB7IHdpZHRoIH0gPSB1c2VXaW5kb3dTaXplKCk7XG4gIHJldHVybiB3aWR0aCA+PSBtaW5XaWR0aDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFdpbmRvdyBpbXBlcmF0aXZlIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBnbHl4V2luZG93IGlzIGRlZmluZWQgYW5kIGV4cG9ydGVkIGZyb20gYXBpLmpzLlxuLy8gSXQgaXMgaW1wb3J0ZWQgaGVyZSBmb3IgdXNlIGJ5IFdpbmRvd0NvbnRyb2xzIGFuZCBTZWxlY3RhYmxlVGV4dC5cblxuLy8gXHUyNTAwXHUyNTAwIFNlY3VyZSBlbnYgYWNjZXNzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIFJlYWRzIGEgc2luZ2xlIGVudmlyb25tZW50IHZhcmlhYmxlIGJ5IG5hbWUuXG4vLyBSZXR1cm5zIG51bGwgaWYgdGhlIG5hbWUgaXMgbm90IGluIHRoZSBgZW52LmFsbG93YCBjYXBhYmlsaXR5IGxpc3QsIG9yIGlmXG4vLyB0aGUgdmFyaWFibGUgZG9lcyBub3QgZXhpc3QgaW4gdGhlIHByb2Nlc3MgZW52aXJvbm1lbnQuXG4vLyBgcHJvY2Vzcy5lbnZgIGlzIG5vdCBhdmFpbGFibGUgXHUyMDE0IG9ubHkgZXhwbGljaXRseSBhbGxvd2VkIG5hbWVzIGFyZSByZWFkYWJsZS5cblxuLyoqXG4gKiBSZWFkIGEgc2luZ2xlIGVudmlyb25tZW50IHZhcmlhYmxlIGRlY2xhcmVkIGluIGBnbHl4LmNvbmZpZy5qc29uYC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFx1MjAxNCBUaGUgdmFyaWFibGUgbmFtZSAoZS5nLiBgXCJBUElfS0VZXCJgKS5cbiAqIEByZXR1cm5zIHtzdHJpbmcgfCBudWxsfVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RW52KG5hbWUpIHtcbiAgcmV0dXJuIHR5cGVvZiBfX2dseXhfZ2V0RW52ICE9PSAndW5kZWZpbmVkJyA/IF9fZ2x5eF9nZXRFbnYobmFtZSkgOiBudWxsO1xufVxuXG4vKipcbiAqIE1lYXN1cmUgc2hhcGVkIHRleHQuIFJldHVybnMgYHsgd2lkdGgsIGhlaWdodCB9YCBpbiBsb2dpY2FsIHBpeGVscy5cbiAqIGBtYXhXaWR0aGAgd3JhcHMgdGhlIHRleHQ7IG9taXQgKG9yIHBhc3MgSW5maW5pdHkpIGZvciBzaW5nbGUtbGluZSB3aWR0aC5cbiAqIFVzZWQgZm9yIHRhYmxlIGNvbHVtbiBhdXRvLXNpemluZywgcmljaC10ZXh0IGxheW91dCwgdHJ1bmNhdGlvbiwgZXRjLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWVhc3VyZVRleHQodGV4dCwgZm9udFNpemUgPSAxNCwgbWF4V2lkdGggPSBJbmZpbml0eSkge1xuICBpZiAodHlwZW9mIF9fZ2x5eF9tZWFzdXJlX3RleHQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIHsgd2lkdGg6IFN0cmluZyh0ZXh0KS5sZW5ndGggKiBmb250U2l6ZSAqIDAuNTUsIGhlaWdodDogZm9udFNpemUgKiAxLjMgfTtcbiAgfVxuICByZXR1cm4gX19nbHl4X21lYXN1cmVfdGV4dChTdHJpbmcodGV4dCksIGZvbnRTaXplLCBOdW1iZXIuaXNGaW5pdGUobWF4V2lkdGgpID8gbWF4V2lkdGggOiAxZTYpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2VsZWN0YWJsZVRleHQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gVXNlci1zZWxlY3RhYmxlIHRleHQgd2l0aCBwb2ludGVyLWRyaXZlbiBzZWxlY3Rpb24gYW5kIEN0cmwvQ21kK0MgY29weS5cbi8vXG4vLyBVc2FnZTpcbi8vICAgPFNlbGVjdGFibGVUZXh0IGZvbnRTaXplPXsxNn0gY29sb3I9XCIjZmZmXCI+SGVsbG8gd29ybGQ8L1NlbGVjdGFibGVUZXh0PlxuLy9cbi8vIERpc2FibGUgZm9yIGEgc3VidHJlZTpcbi8vICAgPFNlbGVjdGlvbkFyZWEgZW5hYmxlZD17ZmFsc2V9PjxSZWFkT25seVBhbmVsIC8+PC9TZWxlY3Rpb25BcmVhPlxuLy9cbi8vIERpc2FibGUgb25lIGVsZW1lbnQgaW5zaWRlIGFuIGVuYWJsZWQgYXJlYTpcbi8vICAgPFNlbGVjdGFibGVUZXh0IHNlbGVjdGFibGU9e2ZhbHNlfT5ub3QgY29weWFibGU8L1NlbGVjdGFibGVUZXh0PlxuXG5jb25zdCBfU2VsZWN0aW9uQ3R4ID0gY3JlYXRlQ29udGV4dCh0cnVlKTtcblxuZXhwb3J0IGZ1bmN0aW9uIFNlbGVjdGlvbkFyZWEoeyBlbmFibGVkID0gdHJ1ZSwgY2hpbGRyZW4gfSkge1xuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChfU2VsZWN0aW9uQ3R4LlByb3ZpZGVyLCB7IHZhbHVlOiBlbmFibGVkIH0sIGNoaWxkcmVuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFNlbGVjdGFibGVUZXh0KHtcbiAgY2hpbGRyZW4sXG4gIHN0eWxlLFxuICBzZWxlY3RhYmxlOiBzZWxlY3RhYmxlUHJvcCxcbiAgZm9udFNpemUgPSAxNixcbiAgY29sb3IsXG4gIHRleHRBbGlnbixcbiAgbnVtYmVyT2ZMaW5lcyxcbiAgLi4ucmVzdFxufSkge1xuICBjb25zdCBhcmVhRW5hYmxlZCAgICA9IHVzZUNvbnRleHQoX1NlbGVjdGlvbkN0eCk7XG4gIGNvbnN0IGlzU2VsZWN0YWJsZSAgID0gc2VsZWN0YWJsZVByb3AgIT09IHVuZGVmaW5lZCA/IHNlbGVjdGFibGVQcm9wIDogYXJlYUVuYWJsZWQ7XG5cbiAgY29uc3QgdGV4dCA9IHR5cGVvZiBjaGlsZHJlbiA9PT0gJ3N0cmluZycgPyBjaGlsZHJlblxuICAgICAgICAgICAgIDogQXJyYXkuaXNBcnJheShjaGlsZHJlbikgPyBjaGlsZHJlbi5qb2luKCcnKSA6IFN0cmluZyhjaGlsZHJlbiA/PyAnJyk7XG5cbiAgY29uc3Qgbm9kZUlkUmVmICAgPSB1c2VSZWYobnVsbCk7XG4gIGNvbnN0IGRyYWdBbmNob3IgID0gdXNlUmVmKG51bGwpO1xuICBjb25zdCBbc2VsU3RhcnQsIHNldFNlbFN0YXJ0XSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbc2VsRW5kLCAgIHNldFNlbEVuZF0gICA9IHVzZVN0YXRlKG51bGwpO1xuXG4gIC8vIFN0YWxlLWNsb3N1cmUgcmVmcyBzbyBldmVudCBjYWxsYmFja3MgYWx3YXlzIHNlZSBjdXJyZW50IHZhbHVlcy5cbiAgY29uc3QgaXNTZWxlY3RhYmxlUmVmID0gdXNlUmVmKGlzU2VsZWN0YWJsZSk7XG4gIGNvbnN0IHRleHRSZWYgICAgICAgICA9IHVzZVJlZih7IHRleHQsIGZvbnRTaXplLCBzZWxTdGFydCwgc2VsRW5kIH0pO1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlzU2VsZWN0YWJsZVJlZi5jdXJyZW50ID0gaXNTZWxlY3RhYmxlO1xuICAgIHRleHRSZWYuY3VycmVudCAgICAgICAgID0geyB0ZXh0LCBmb250U2l6ZSwgc2VsU3RhcnQsIHNlbEVuZCB9O1xuICB9KTtcblxuICAvLyBDb252ZXJ0IHdpbmRvdy1hYnNvbHV0ZSB4IFx1MjE5MiBjaGFyYWN0ZXIgaW5kZXguXG4gIGZ1bmN0aW9uIGNoYXJBdEFic1goYWJzWCkge1xuICAgIGlmICh0eXBlb2YgX19nbHl4X3RleHRfY2hhcl9hdF94ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIDA7XG4gICAgY29uc3QgaWQgPSBub2RlSWRSZWYuY3VycmVudDtcbiAgICBpZiAoaWQgPT09IG51bGwpIHJldHVybiAwO1xuICAgIGNvbnN0IGxheW91dCA9IF9fZ2x5eF9nZXRMYXlvdXQoaWQpO1xuICAgIGNvbnN0IGxvY2FsWCA9IE1hdGgubWF4KDAsIGFic1ggLSAobGF5b3V0ID8gbGF5b3V0LnggOiAwKSk7XG4gICAgY29uc3QgeyB0ZXh0OiB0LCBmb250U2l6ZTogZnMgfSA9IHRleHRSZWYuY3VycmVudDtcbiAgICByZXR1cm4gX19nbHl4X3RleHRfY2hhcl9hdF94KHQsIGZzLCAxZTYsIGxvY2FsWCkgfCAwO1xuICB9XG5cbiAgLy8gTW91bnQ6IHJlZ2lzdGVyIGJvdGggZHJhZyBhbmQgcHJlc3NhYmxlIGhhbmRsZXJzIG9uY2UuXG4gIGNvbnN0IF92ZWxveE9uTW91bnQgPSB1c2VDYWxsYmFjaygoaWQpID0+IHtcbiAgICBub2RlSWRSZWYuY3VycmVudCA9IGlkO1xuXG4gICAgcmVnaXN0ZXJEcmFnZ2FibGUoaWQsIHtcbiAgICAgIG9uRHJhZ1N0YXJ0KHsgeCB9KSB7XG4gICAgICAgIGlmICghaXNTZWxlY3RhYmxlUmVmLmN1cnJlbnQpIHJldHVybjtcbiAgICAgICAgY29uc3QgaWR4ID0gY2hhckF0QWJzWCh4KTtcbiAgICAgICAgZHJhZ0FuY2hvci5jdXJyZW50ID0gaWR4O1xuICAgICAgICBzZXRTZWxTdGFydChpZHgpO1xuICAgICAgICBzZXRTZWxFbmQoaWR4KTtcbiAgICAgIH0sXG4gICAgICBvbkRyYWdNb3ZlKHsgeCB9KSB7XG4gICAgICAgIGlmICghaXNTZWxlY3RhYmxlUmVmLmN1cnJlbnQpIHJldHVybjtcbiAgICAgICAgY29uc3QgaWR4ICAgID0gY2hhckF0QWJzWCh4KTtcbiAgICAgICAgY29uc3QgYW5jaG9yID0gZHJhZ0FuY2hvci5jdXJyZW50ID8/IGlkeDtcbiAgICAgICAgc2V0U2VsU3RhcnQoTWF0aC5taW4oYW5jaG9yLCBpZHgpKTtcbiAgICAgICAgc2V0U2VsRW5kKE1hdGgubWF4KGFuY2hvciwgaWR4KSk7XG4gICAgICB9LFxuICAgICAgb25EcmFnRW5kKCkgeyBkcmFnQW5jaG9yLmN1cnJlbnQgPSBudWxsOyB9LFxuICAgIH0pO1xuXG4gICAgcmVnaXN0ZXJQcmVzc2FibGUoaWQsIHtcbiAgICAgIG9uUHJlc3MoeyB4IH0pIHtcbiAgICAgICAgaWYgKCFpc1NlbGVjdGFibGVSZWYuY3VycmVudCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBpZHggPSBjaGFyQXRBYnNYKHgpO1xuICAgICAgICBzZXRTZWxTdGFydChpZHgpO1xuICAgICAgICBzZXRTZWxFbmQoaWR4KTtcbiAgICAgIH0sXG4gICAgICBvblByZXNzSW4oKSB7fSwgb25QcmVzc091dCgpIHt9LCBvbkhvdmVySW4oKSB7fSwgb25Ib3Zlck91dCgpIHt9LFxuICAgIH0pO1xuICB9LCBbXSk7IC8vIE5vIGRlcHMgXHUyMDE0IHJlYWRzIGZyb20gcmVmcyBhdCBjYWxsIHRpbWUuXG5cbiAgLy8gQ3RybC9DbWQrQzogY29weSBzZWxlY3RlZCB0ZXh0IHRvIGNsaXBib2FyZC5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWlzU2VsZWN0YWJsZSkgcmV0dXJuO1xuICAgIGNvbnN0IGNvbWJvID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgL21hYy9pLnRlc3QobmF2aWdhdG9yLnBsYXRmb3JtID8/ICcnKVxuICAgICAgPyAnbWV0YStjJyA6ICdjdHJsK2MnO1xuICAgIGNvbnN0IHN0b3AgPSBpbnB1dC5zaG9ydGN1dChjb21ibywgKCkgPT4ge1xuICAgICAgY29uc3QgeyB0ZXh0OiB0LCBzZWxTdGFydDogc3MsIHNlbEVuZDogc2UgfSA9IHRleHRSZWYuY3VycmVudDtcbiAgICAgIGlmIChzcyAhPT0gbnVsbCAmJiBzZSAhPT0gbnVsbCAmJiBzZSA+IHNzKSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdGVkID0gQXJyYXkuZnJvbSh0KS5zbGljZShzcywgc2UpLmpvaW4oJycpO1xuICAgICAgICBjbGlwYm9hcmQud3JpdGVUZXh0KHNlbGVjdGVkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gc3RvcDtcbiAgfSwgW2lzU2VsZWN0YWJsZV0pO1xuXG4gIGNvbnN0IGhhc1NlbGVjdGlvbiA9IHNlbFN0YXJ0ICE9PSBudWxsICYmIHNlbEVuZCAhPT0gbnVsbCAmJiBzZWxFbmQgPiBzZWxTdGFydDtcblxuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcbiAgICBWaWV3LFxuICAgIHsgX3ZlbG94T25Nb3VudCwgc3R5bGUsIC4uLnJlc3QgfSxcbiAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFxuICAgICAgVGV4dCxcbiAgICAgIHtcbiAgICAgICAgZm9udFNpemUsXG4gICAgICAgIGNvbG9yLFxuICAgICAgICB0ZXh0QWxpZ24sXG4gICAgICAgIG51bWJlck9mTGluZXMsXG4gICAgICAgIHNlbGVjdGlvblN0YXJ0OiBoYXNTZWxlY3Rpb24gPyBzZWxTdGFydCA6IHVuZGVmaW5lZCxcbiAgICAgICAgc2VsZWN0aW9uRW5kOiAgIGhhc1NlbGVjdGlvbiA/IHNlbEVuZCAgIDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICAgIGNoaWxkcmVuXG4gICAgKVxuICApO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgV2luZG93Q29udHJvbHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gQSByZWFkeS1tYWRlIG1pbmltaXplIC8gbWF4aW1pemUtb3ItcmVzdG9yZSAvIGNsb3NlIGJ1dHRvbiByb3cgZm9yIGN1c3RvbVxuLy8gdGl0bGUgYmFycyAoYHdpbmRvdy5kZWNvcmF0aW9uczogZmFsc2VgIGluIGdseXguY29uZmlnLmpzb24pLlxuLy9cbi8vIFVzYWdlOlxuLy8gICBpbXBvcnQgeyBXaW5kb3dDb250cm9scyB9IGZyb20gJ0BnbHl4LWRldi9yZWFjdCc7XG4vLyAgIDxWaWV3IGdseXhEcmFnZ2FibGUgc3R5bGU9e3N0eWxlcy50aXRsZUJhcn0+XG4vLyAgICAgPFRleHQgc3R5bGU9e3N0eWxlcy50aXRsZX0+TXkgQXBwPC9UZXh0PlxuLy8gICAgIDxXaW5kb3dDb250cm9scyAvPlxuLy8gICA8L1ZpZXc+XG4vL1xuLy8gUGxhdGZvcm0tYXdhcmUgYnV0dG9uIG9yZGVyOlxuLy8gICBtYWNPUyAgIFx1MjE5MiB0cmFmZmljLWxpZ2h0IG9yZGVyIG9uIHRoZSBMRUZUIHNpZGUgIChjbG9zZSBcdTAwQjcgbWluaW1pemUgXHUwMEI3IG1heGltaXplKVxuLy8gICBXaW5kb3dzIC8gTGludXggXHUyMTkyIHN0YW5kYXJkIG9yZGVyIG9uIHRoZSBSSUdIVCBzaWRlIChtaW5pbWl6ZSBcdTAwQjcgbWF4aW1pemUgXHUwMEI3IGNsb3NlKVxuXG4vLyBtYWNPUyB0cmFmZmljLWxpZ2h0OiBjb2xvcmVkIGNpcmNsZSArIHRpbnkgZ2x5cGhcbmNvbnN0IF93Y19tYWMgPSAobGFiZWwsIG9uUHJlc3MsIGJnKSA9PlxuICBSZWFjdC5jcmVhdGVFbGVtZW50KFByZXNzYWJsZSwge1xuICAgIG9uUHJlc3MsXG4gICAgc3R5bGU6IHtcbiAgICAgIHdpZHRoOiAxNCwgaGVpZ2h0OiAxNCwgYm9yZGVyUmFkaXVzOiA3LFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBiZyxcbiAgICAgIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJywgYWxpZ25JdGVtczogJ2NlbnRlcicsXG4gICAgfSxcbiAgfSwgUmVhY3QuY3JlYXRlRWxlbWVudChUZXh0LCB7IHN0eWxlOiB7IGZvbnRTaXplOiA4LCBjb2xvcjogJyMwMDAwMDA4OCcgfSB9LCBsYWJlbCkpO1xuXG4vLyBXaW5kb3dzL0xpbnV4OiBubyBiYWNrZ3JvdW5kLCBpY29uLW9ubHksIGhpZ2hsaWdodCBvbiBob3ZlclxuZnVuY3Rpb24gX1djV2luKHsgbGFiZWwsIG9uUHJlc3MsIGlzQ2xvc2UgfSkge1xuICBjb25zdCBbaG92LCBzZXRIb3ZdID0gUmVhY3QudXNlU3RhdGUoZmFsc2UpO1xuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChQcmVzc2FibGUsIHtcbiAgICBvblByZXNzLFxuICAgIGZlZWRiYWNrOiBmYWxzZSxcbiAgICBvbkhvdmVySW46ICAoKSA9PiBzZXRIb3YodHJ1ZSksXG4gICAgb25Ib3Zlck91dDogKCkgPT4gc2V0SG92KGZhbHNlKSxcbiAgICBzdHlsZToge1xuICAgICAgd2lkdGg6IDQ2LCBoZWlnaHQ6IDQwLFxuICAgICAganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLCBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcbiAgICAgIGJhY2tncm91bmRDb2xvcjogaG92ID8gKGlzQ2xvc2UgPyAnI2M0MmIxYycgOiAncmdiYSgwLDAsMCwwLjA4KScpIDogJ3RyYW5zcGFyZW50JyxcbiAgICB9LFxuICB9LCBSZWFjdC5jcmVhdGVFbGVtZW50KFRleHQsIHtcbiAgICBzdHlsZTogeyBmb250U2l6ZTogMTEsIGNvbG9yOiAoaG92ICYmIGlzQ2xvc2UpID8gJyNmZmZmZmYnIDogJyMwMDAwMDAnIH0sXG4gIH0sIGxhYmVsKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dDb250cm9scyh7IHN0eWxlIH0gPSB7fSkge1xuICBjb25zdCBbbWF4aW1pemVkLCBzZXRNYXhpbWl6ZWRdID0gUmVhY3QudXNlU3RhdGUoKCkgPT4gZ2x5eFdpbmRvdy5pc01heGltaXplZCgpKTtcblxuICBjb25zdCBtaW5pbWl6ZSA9ICgpID0+IGdseXhXaW5kb3cuc2V0TWluaW1pemVkKCk7XG4gIGNvbnN0IHRvZ2dsZU1heCA9ICgpID0+IHtcbiAgICBpZiAoZ2x5eFdpbmRvdy5pc01heGltaXplZCgpKSB7XG4gICAgICBnbHl4V2luZG93LnNldE1heGltaXplZChmYWxzZSk7XG4gICAgICBzZXRNYXhpbWl6ZWQoZmFsc2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnbHl4V2luZG93LnNldE1heGltaXplZCh0cnVlKTtcbiAgICAgIHNldE1heGltaXplZCh0cnVlKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGNsb3NlID0gKCkgPT4gZ2x5eFdpbmRvdy5jbG9zZSgpO1xuXG4gIGNvbnN0IGlzTWFjID0gZ2x5eFdpbmRvdy5wbGF0Zm9ybSgpID09PSAnbWFjb3MnO1xuXG4gIGlmIChpc01hYykge1xuICAgIGNvbnN0IGJ1dHRvbnMgPSBbXG4gICAgICBfd2NfbWFjKCdcdTI3MTUnLCBjbG9zZSwgICAgICAnI2ZmNWY1NycpLFxuICAgICAgX3djX21hYygnXHUyMjEyJywgbWluaW1pemUsICAgJyNmZWJjMmUnKSxcbiAgICAgIF93Y19tYWMobWF4aW1pemVkID8gJ1x1MjJBMScgOiAnXHUyMjlFJywgdG9nZ2xlTWF4LCAnIzI4Yzg0MCcpLFxuICAgIF07XG4gICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywge1xuICAgICAgc3R5bGU6IHsgZmxleERpcmVjdGlvbjogJ3JvdycsIGdhcDogNiwgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1hcmdpbkxlZnQ6IDgsIC4uLnN0eWxlIH0sXG4gICAgfSwgLi4uYnV0dG9ucyk7XG4gIH1cblxuICAvLyBXaW5kb3dzIC8gTGludXg6IGljb24tb25seSBidXR0b25zLCBubyBnYXAgKHRvdWNoKSwgY2xvc2Ugb24gZmFyIHJpZ2h0XG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFZpZXcsIHtcbiAgICBzdHlsZTogeyBmbGV4RGlyZWN0aW9uOiAncm93JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIC4uLnN0eWxlIH0sXG4gIH0sXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChfV2NXaW4sIHsgbGFiZWw6ICdcdTI1MDAnLCBvblByZXNzOiBtaW5pbWl6ZSB9KSxcbiAgICBSZWFjdC5jcmVhdGVFbGVtZW50KF9XY1dpbiwgeyBsYWJlbDogbWF4aW1pemVkID8gJ1x1Mjc1MCcgOiAnXHUyNjEwJywgb25QcmVzczogdG9nZ2xlTWF4IH0pLFxuICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoX1djV2luLCB7IGxhYmVsOiAnXHUyNzE1Jywgb25QcmVzczogY2xvc2UsIGlzQ2xvc2U6IHRydWUgfSksXG4gICk7XG59XG4iLCAiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyBhZGRHbG9iYWxDbGlja0xpc3RlbmVyLCByZW1vdmVHbG9iYWxDbGlja0xpc3RlbmVyIH0gZnJvbSAnLi9ldmVudHMuanMnO1xuaW1wb3J0IHsgVmlldywgUHJlc3NhYmxlLCB1c2VXaW5kb3dTaXplIH0gZnJvbSAnLi9jb3JlLmpzJztcblxuLy8gXHUyNTAwXHUyNTAwIFBvcG92ZXIgb3ZlcmxheSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBBIHNpbmdsZSBmbG9hdGluZyBsYXllciByZW5kZXJlZCBhdCB0aGUgYXBwIHJvb3QuIEJlY2F1c2UgaXQgbGl2ZXMgYXQgdGhlIHJvb3Rcbi8vIChub3QgaW5zaWRlIGFueSBTY3JvbGxWaWV3KSwgaXRzIGFic29sdXRlbHktcG9zaXRpb25lZCBjb250ZW50IGlzIG5ldmVyIGNsaXBwZWRcbi8vIFx1MjAxNCB0aGUgZml4IGZvciBmbG9hdGluZyBkcm9wZG93bnMvbWVudXMuIFBvc2l0aW9uZWQgaW4gd2luZG93IGNvb3JkaW5hdGVzIHdpdGhcbi8vIGZsaXAtdXAgbmVhciB0aGUgYm90dG9tIGVkZ2UgYW5kIGhvcml6b250YWwgY2xhbXBpbmcuXG5cbmxldCBfcG9wb3Zlck5leHRJZCA9IDA7XG5leHBvcnQgY29uc3QgX3BvcG92ZXJTdG9yZSA9IHtcbiAgY3VycmVudDogbnVsbCwgLy8geyBpZCwgeCwgeSwgaCwgd2lkdGgsIGNvbnRlbnRILCByZW5kZXIsIG9uQ2xvc2UgfVxuICBsaXN0ZW5lcnM6IG5ldyBTZXQoKSxcbiAgb3BlbihwKSB7IGNvbnN0IGlkID0gKytfcG9wb3Zlck5leHRJZDsgdGhpcy5jdXJyZW50ID0geyBpZCwgLi4ucCB9OyB0aGlzLl9lbWl0KCk7IHJldHVybiBpZDsgfSxcbiAgY2xvc2UoaWQpIHtcbiAgICBpZiAoIXRoaXMuY3VycmVudCkgcmV0dXJuO1xuICAgIGlmIChpZCAhPSBudWxsICYmIHRoaXMuY3VycmVudC5pZCAhPT0gaWQpIHJldHVybjtcbiAgICBjb25zdCBjYiA9IHRoaXMuY3VycmVudC5vbkNsb3NlO1xuICAgIHRoaXMuY3VycmVudCA9IG51bGw7XG4gICAgdGhpcy5fZW1pdCgpO1xuICAgIGlmIChjYikgY2IoKTtcbiAgfSxcbiAgX2VtaXQoKSB7IGZvciAoY29uc3QgbCBvZiB0aGlzLmxpc3RlbmVycykgbCgpOyB9LFxufTtcblxuLyoqIE9wZW4gYSBmbG9hdGluZyBwb3BvdmVyIGFuY2hvcmVkIHRvIGEgcmVjdC4gUmV0dXJucyBhbiBpZCBmb3IgY2xvc2VQb3BvdmVyKCkuICovXG5leHBvcnQgZnVuY3Rpb24gb3BlblBvcG92ZXIob3B0cykgeyByZXR1cm4gX3BvcG92ZXJTdG9yZS5vcGVuKG9wdHMpOyB9XG4vKiogQ2xvc2UgdGhlIGFjdGl2ZSBwb3BvdmVyIChvcHRpb25hbGx5IG9ubHkgaWYgaXQgbWF0Y2hlcyBgaWRgKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZVBvcG92ZXIoaWQpIHsgX3BvcG92ZXJTdG9yZS5jbG9zZShpZCk7IH1cblxuLyoqXG4gKiBSb290IG92ZXJsYXkgaG9zdC4gQXV0by1pbmplY3RlZCBieSByZW5kZXIoKTsgeW91IG5vcm1hbGx5IG5ldmVyIHVzZSBpdFxuICogZGlyZWN0bHkuIFJlbmRlcnMgdGhlIGFjdGl2ZSBwb3BvdmVyLCBhIGZ1bGwtc2NyZWVuIGJhY2tkcm9wIGZvciBvdXRzaWRlLWNsaWNrXG4gKiBkaXNtaXNzYWwsIGFuZCBoYW5kbGVzIGZsaXAvY2xhbXAgcG9zaXRpb25pbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBQb3BvdmVySG9zdCgpIHtcbiAgY29uc3QgWywgZm9yY2VdID0gdXNlU3RhdGUoMCk7XG4gIGNvbnN0IHsgd2lkdGg6IHdpblcsIGhlaWdodDogd2luSCB9ID0gdXNlV2luZG93U2l6ZSgpO1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGwgPSAoKSA9PiBmb3JjZSgobikgPT4gKG4gKyAxKSB8IDApO1xuICAgIF9wb3BvdmVyU3RvcmUubGlzdGVuZXJzLmFkZChsKTtcbiAgICByZXR1cm4gKCkgPT4geyBfcG9wb3ZlclN0b3JlLmxpc3RlbmVycy5kZWxldGUobCk7IH07XG4gIH0sIFtdKTtcblxuICBjb25zdCBwID0gX3BvcG92ZXJTdG9yZS5jdXJyZW50O1xuICBpZiAoIXApIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IFBBRCA9IDQ7XG4gIGNvbnN0IGN3ICA9IHAud2lkdGggfHwgMjQwO1xuICBjb25zdCBjaCAgPSBwLmNvbnRlbnRIIHx8IDIwMDtcbiAgY29uc3QgYmVsb3dZID0gcC55ICsgcC5oICsgUEFEO1xuICBjb25zdCBmbGlwVXAgPSAoYmVsb3dZICsgY2ggPiB3aW5IKSAmJiAocC55IC0gY2ggLSBQQUQgPj0gMCk7XG4gIGNvbnN0IHRvcCAgPSBmbGlwVXAgPyBNYXRoLm1heCg0LCBwLnkgLSBjaCAtIFBBRCkgOiBiZWxvd1k7XG4gIGNvbnN0IGxlZnQgPSBNYXRoLm1heCg0LCBNYXRoLm1pbihwLngsIHdpblcgLSBjdyAtIDQpKTtcblxuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChQcmVzc2FibGUsIHtcbiAgICAvLyBGdWxsLXNjcmVlbiBiYWNrZHJvcCBcdTIwMTQgYSBjbGljayBhbnl3aGVyZSBvdXRzaWRlIHRoZSBjb250ZW50IGRpc21pc3Nlcy5cbiAgICAvLyBmZWVkYmFjazpmYWxzZSBcdTIwMTQgb3BhY2l0eSBmZWVkYmFjayBvbiBhIGNvbnRhaW5lciBtdWx0aXBsaWVzIHRocm91Z2ggdGhlXG4gICAgLy8gc3VidHJlZSwgd2hpY2ggbWFkZSB0aGUgd2hvbGUgcG9wb3ZlciBkaW0gb24gaG92ZXIuXG4gICAgb25QcmVzczogKCkgPT4gX3BvcG92ZXJTdG9yZS5jbG9zZShwLmlkKSxcbiAgICBmZWVkYmFjazogZmFsc2UsXG4gICAgc3R5bGU6IHsgcG9zaXRpb246ICdhYnNvbHV0ZScsIGxlZnQ6IDAsIHRvcDogMCwgd2lkdGg6IHdpblcsIGhlaWdodDogd2luSCwgekluZGV4OiA5MDAwIH0sXG4gIH0sXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChQcmVzc2FibGUsIHtcbiAgICAgIG9uUHJlc3M6ICgpID0+IHt9LCAvLyBhYnNvcmIgY2xpY2tzIGluc2lkZSB0aGUgcG9wb3ZlciBzbyBpdCBkb2Vzbid0IGRpc21pc3NcbiAgICAgIGZlZWRiYWNrOiBmYWxzZSxcbiAgICAgIHN0eWxlOiB7IHBvc2l0aW9uOiAnYWJzb2x1dGUnLCBsZWZ0LCB0b3AsIHdpZHRoOiBjdywgekluZGV4OiA5MDAxIH0sXG4gICAgfSwgcC5yZW5kZXIocC5pZCkpXG4gICk7XG59XG4iLCAiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZVJlZiwgdXNlQ2FsbGJhY2sgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQge1xuICByZWdpc3RlcklucHV0LCB1bnJlZ2lzdGVySW5wdXQsXG4gIHJlZ2lzdGVyRHJhZ2dhYmxlLCB1bnJlZ2lzdGVyRHJhZ2dhYmxlLFxuICByZWdpc3RlclByZXNzYWJsZSwgdW5yZWdpc3RlclByZXNzYWJsZSxcbiAgcmVnaXN0ZXJTY3JvbGxWaWV3LCB1bnJlZ2lzdGVyU2Nyb2xsVmlldyxcbiAgYWRkR2xvYmFsQ2xpY2tMaXN0ZW5lciwgcmVtb3ZlR2xvYmFsQ2xpY2tMaXN0ZW5lcixcbiAgYWRkS2V5TGlzdGVuZXIsXG59IGZyb20gJy4vZXZlbnRzLmpzJztcbmltcG9ydCB7IFZpZXcsIFRleHQsIEltYWdlLCBTY3JvbGxWaWV3LCBQcmVzc2FibGUsIG1lYXN1cmVUZXh0LCB1c2VXaW5kb3dTaXplIH0gZnJvbSAnLi9jb3JlLmpzJztcbmltcG9ydCB7IG9wZW5Qb3BvdmVyLCBjbG9zZVBvcG92ZXIgfSBmcm9tICcuL3BvcG92ZXIuanMnO1xuaW1wb3J0IHsgY2xpcGJvYXJkLCBkaWFsb2cgfSBmcm9tICcuL2FwaS5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMCBDb250cm9sIHdpZHRoIHJlc29sdXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gVEhFIHNpemluZyBjb250cmFjdCBmb3IgZml4ZWQtZm9vdHByaW50IGNvbnRyb2xzIChTZWxlY3QsIHBpY2tlcnMsIGlucHV0cyk6XG4vLyAgIDEuIElmIHRoZSBjYWxsZXIncyBzdHlsZSBjb250cm9scyB3aWR0aCBpbiBBTlkgd2F5ICh3aWR0aCwgZmxleCwgZmxleEdyb3csXG4vLyAgICAgIG1pbldpZHRoLCBhbGlnblNlbGYpLCB0aGUgY2FsbGVyIGlzIGluIGNoYXJnZSBcdTIwMTQgbGF5b3V0IGRlY2lkZXMsIG5vXG4vLyAgICAgIGRlZmF1bHQgaXMgYXBwbGllZC5cbi8vICAgMi4gT3RoZXJ3aXNlIHRoZSBjb250cm9sIGdldHMgYSBjb21wYWN0IGRlZmF1bHQ6IGFsaWduU2VsZiAnZmxleC1zdGFydCdcbi8vICAgICAgKHNvIHN0cmV0Y2ggcGFyZW50cyBkb24ndCBibG93IGl0IHVwKSArIGl0cyBkZWZhdWx0IHdpZHRoLlxuLy8gXCJVc2UgdGhlIGRlZmF1bHRzIG9yIG92ZXJyaWRlXCIgXHUyMDE0IHN0cmV0Y2hpbmcgaXMgb25lIHN0eWxlIGF3YXk6XG4vLyAgIHN0eWxlPXt7IGFsaWduU2VsZjogJ3N0cmV0Y2gnIH19ICAgb3IgICBzdHlsZT17eyBmbGV4OiAxIH19IChpbiBhIHJvdykuXG5mdW5jdGlvbiBfc2l6ZWRSb290U3R5bGUoc3R5bGUsIGRlZmF1bHRXaWR0aCkge1xuICBjb25zdCBzaXplZCA9ICEhc3R5bGUgJiYgKFxuICAgIHN0eWxlLndpZHRoICE9IG51bGwgfHwgc3R5bGUuZmxleCAhPSBudWxsIHx8IHN0eWxlLmZsZXhHcm93ICE9IG51bGwgfHxcbiAgICBzdHlsZS5taW5XaWR0aCAhPSBudWxsIHx8IHN0eWxlLmFsaWduU2VsZiAhPSBudWxsXG4gICk7XG4gIHJldHVybiBzaXplZFxuICAgID8geyAuLi5zdHlsZSB9XG4gICAgOiB7IGFsaWduU2VsZjogJ2ZsZXgtc3RhcnQnLCB3aWR0aDogZGVmYXVsdFdpZHRoLCAuLi5zdHlsZSB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgU2VsZWN0IGNvbG9yIGNvbnRleHQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gUHJvdmlkZXMgdGhlbWUtbWF0Y2hlZCBjb2xvcnMgdG8gZXZlcnkgU2VsZWN0IGluIHRoZSBzdWJ0cmVlLlxuLy8gQGdseXgtZGV2L2Rlc2lnbidzIFRoZW1lUHJvdmlkZXIgc2V0cyB0aGlzIGF1dG9tYXRpY2FsbHkuXG4vLyBUaGUgZGVmYXVsdHMgYmVsb3cgbWF0Y2ggdGhlIGRhcmsgKE1vY2hhKSB0aGVtZSBzbyBleGlzdGluZyBhcHBzXG4vLyB0aGF0IGRvbid0IHVzZSBUaGVtZVByb3ZpZGVyIHN0YXkgdW5jaGFuZ2VkLlxuXG5leHBvcnQgY29uc3QgU0VMRUNUX0NPTE9SU19EQVJLID0ge1xuICB0cmlnZ2VyQmc6ICAgICAgICAgICAnIzI2MmIzZicsXG4gIHRyaWdnZXJCZ0Rpc2FibGVkOiAgICcjMWExZDJlJyxcbiAgdHJpZ2dlckJvcmRlcjogICAgICAgJyMzYzQ0NjQnLFxuICB0cmlnZ2VyQm9yZGVyRm9jdXM6ICAnIzdhYTJmNycsXG4gIHRyaWdnZXJUZXh0OiAgICAgICAgICcjZTdlY2ZmJyxcbiAgdHJpZ2dlclBsYWNlaG9sZGVyOiAgJyM5YWEwYjYnLFxuICAvLyBjaGV2cm9uOiBhcnJvdyBpY29ucyBvbiB0cmlnZ2VycyBhbmQgY2FsZW5kYXIgbmF2IFx1MjAxNCBzdWJ0bGVyIHRoYW4gYWNjZW50XG4gIGNoZXZyb246ICAgICAgICAgICAgICcjOWFhMGI2JyxcbiAgZHJvcGRvd25CZzogICAgICAgICAgJyMxZTIyMzUnLFxuICBkcm9wZG93bkJvcmRlcjogICAgICAnIzNjNDQ2NCcsXG4gIG9wdGlvblRleHQ6ICAgICAgICAgICcjY2RkNmY0JyxcbiAgb3B0aW9uU2VsZWN0ZWRUZXh0OiAgJyM3YWEyZjcnLFxuICBvcHRpb25Ib3ZlckJnOiAgICAgICAnIzJhMzA0OCcsXG4gIG9wdGlvblNlbGVjdGVkQmc6ICAgICcjMmUzNTU1JyxcbiAgb3B0aW9uQ2hlY2s6ICAgICAgICAgJyM3YWEyZjcnLFxuICAvLyBjYWxDZWxsU2VsZWN0ZWRCZzogYWNjZW50IGZvciB0aGUgc2VsZWN0ZWQgZGF5IGNlbGwgKGtlZXAgYXMgcHJpbWFyeSlcbiAgY2FsQ2VsbFNlbGVjdGVkQmc6ICAgJyM3YWEyZjcnLFxuICBjYWxDZWxsU2VsZWN0ZWRUZXh0OiAnIzFlMWUyZScsXG4gIGNhbERheU5hbWU6ICAgICAgICAgICcjNmM3MDg2Jyxcbn07XG5cbmV4cG9ydCBjb25zdCBTZWxlY3RDb2xvcnNDb250ZXh0ID0gUmVhY3QuY3JlYXRlQ29udGV4dChTRUxFQ1RfQ09MT1JTX0RBUkspO1xuXG4vKiogV3JhcCBhIHN1YnRyZWUgdG8gb3ZlcnJpZGUgU2VsZWN0IGNvbG9ycyBcdTIwMTQgdXNlZCBpbnRlcm5hbGx5IGJ5IFRoZW1lUHJvdmlkZXIuICovXG5leHBvcnQgZnVuY3Rpb24gU2VsZWN0Q29sb3JzUHJvdmlkZXIoeyBjb2xvcnMsIGNoaWxkcmVuIH0pIHtcbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoU2VsZWN0Q29sb3JzQ29udGV4dC5Qcm92aWRlciwgeyB2YWx1ZTogY29sb3JzIH0sIGNoaWxkcmVuKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFRleHRJbnB1dCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGZ1bmN0aW9uIFRleHRJbnB1dCh7XG4gIHZhbHVlID0gJycsXG4gIG9uQ2hhbmdlVGV4dCxcbiAgb25TdWJtaXRFZGl0aW5nLFxuICBwbGFjZWhvbGRlciA9ICcnLFxuICBmb250U2l6ZSA9IDE2LFxuICBtdWx0aWxpbmUgPSBmYWxzZSxcbiAgd2lkdGgsICAgICAgICAgICAgICAgICAgICAgLy8gZXhwbGljaXQgd2lkdGg7IGRlZmF1bHQgMjQwIE9OTFkgd2hlbiBubyB3aWR0aC1hZmZlY3Rpbmcgc3R5bGUgaXMgZ2l2ZW5cbiAgaGVpZ2h0LCAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdDogNDQgc2luZ2xlLWxpbmU7IGF1dG8tc2l6ZWQgbXVsdGlsaW5lXG4gIG1heExlbmd0aCwgICAgICAgICAgICAgICAgIC8vIGhhcmQgY2hhcmFjdGVyIGxpbWl0IChpbnNlcnRpb25zIHRydW5jYXRlZClcbiAgbWluTGluZXMsICAgICAgICAgICAgICAgICAgLy8gbXVsdGlsaW5lIGF1dG8taGVpZ2h0IGZsb29yICAoZGVmYXVsdCAzKVxuICBtYXhMaW5lcywgICAgICAgICAgICAgICAgICAvLyBtdWx0aWxpbmUgYXV0by1oZWlnaHQgY2VpbGluZyAoZGVmYXVsdCAxMClcbiAgc2VjdXJlVGV4dEVudHJ5ID0gZmFsc2UsICAgLy8gbWFzayBjaGFyYWN0ZXJzIChwYXNzd29yZCBmaWVsZHMpXG4gIGtleWJvYXJkVHlwZSA9ICdkZWZhdWx0JywgIC8vICdkZWZhdWx0JyB8ICdudW1lcmljJyB8ICdkZWNpbWFsJ1xuICBzdHlsZSxcbiAgLi4ucHJvcHNcbn0pIHtcbiAgY29uc3Qgbm9kZUlkUmVmICAgPSB1c2VSZWYobnVsbCk7XG4gIGNvbnN0IGhhbmRsZXJzUmVmID0gdXNlUmVmKG51bGwpO1xuICBjb25zdCBbZm9jdXNlZCwgc2V0Rm9jdXNlZF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIC8vIExpdmUgbGF5b3V0IHdpZHRoIG9mIHRoZSBmaWVsZCBcdTIwMTQgZmxleC9zdHJldGNoIHN0eWxlcyByb3V0aW5lbHkgbWFrZSB0aGVcbiAgLy8gcmVhbCBub2RlIHdpZGVyIHRoYW4gdGhlIGB3aWR0aGAgcHJvcCAod2hpY2ggZGVmYXVsdHMgdG8gMjQwKSwgc28gdGV4dFxuICAvLyB3cmFwcGluZywgcGFubmluZywgYW5kIGF1dG8taGVpZ2h0IG11c3QgYWxsIHVzZSB0aGUgbWVhc3VyZWQgdmFsdWUuXG4gIGNvbnN0IFttZWFzdXJlZFcsIHNldE1lYXN1cmVkV10gPSB1c2VTdGF0ZSgwKTtcblxuICAvLyBhbmNob3I6IGZpeGVkIGVuZCBvZiBzZWxlY3Rpb247IGZvY3VzXzogbW92aW5nIGN1cnNvciBlbmQuXG4gIC8vIFdoZW4gYW5jaG9yID09PSBmb2N1c186IG5vIHNlbGVjdGlvbiwgY3Vyc29yIGJsaW5rcyBhdCB0aGF0IHBvc2l0aW9uLlxuICBjb25zdCBbYW5jaG9yLCBzZXRBbmNob3JdICAgPSB1c2VTdGF0ZSgoKSA9PiB2YWx1ZS5sZW5ndGgpO1xuICBjb25zdCBbZm9jdXNfLCAgc2V0Rm9jdXNfXSAgPSB1c2VTdGF0ZSgoKSA9PiB2YWx1ZS5sZW5ndGgpO1xuICBjb25zdCBbc2Nyb2xsWCwgc2V0U2Nyb2xsWF0gPSB1c2VTdGF0ZSgwKTtcbiAgY29uc3Qgc2Nyb2xsWFJlZiA9IHVzZVJlZigwKTtcbiAgLy8gVmVydGljYWwgc2Nyb2xsIGZvciBtdWx0aWxpbmUgbW9kZSAod2hlZWwsIHNjcm9sbGJhciBkcmFnLCBjYXJldC1mb2xsb3cpLlxuICBjb25zdCBbc2Nyb2xsWSwgc2V0U2Nyb2xsWV0gPSB1c2VTdGF0ZSgwKTtcbiAgY29uc3Qgc2Nyb2xsWVJlZiA9IHVzZVJlZigwKTtcbiAgY29uc3Qgc2V0U2Nyb2xsWUJvdGggPSAoeSkgPT4geyBzY3JvbGxZUmVmLmN1cnJlbnQgPSB5OyBzZXRTY3JvbGxZKHkpOyB9O1xuXG4gIC8vIERlcml2ZWQgc2VsZWN0aW9uIHJhbmdlIChhbHdheXMgb3JkZXJlZCkuXG4gIGNvbnN0IHNlbFN0YXJ0ID0gTWF0aC5taW4oYW5jaG9yLCBmb2N1c18pO1xuICBjb25zdCBzZWxFbmQgICA9IE1hdGgubWF4KGFuY2hvciwgZm9jdXNfKTtcblxuICAvLyBUZXh0IGFzIHJlbmRlcmVkOiBtYXNrZWQgZm9yIHBhc3N3b3JkIGZpZWxkcyAoc2FtZSBjaGFyIGNvdW50IGFzIHZhbHVlLFxuICAvLyBzbyBjdXJzb3IgaW5kaWNlcyBsaW5lIHVwKSwgcmF3IG90aGVyd2lzZS5cbiAgY29uc3QgcmVuZGVyVmFsdWUgPSBzZWN1cmVUZXh0RW50cnkgPyAnXHUyMDIyJy5yZXBlYXQoWy4uLnZhbHVlXS5sZW5ndGgpIDogdmFsdWU7XG5cbiAgLy8gQ29sbGFwc2UgY3Vyc29yIHRvIGBwb3NgLCBjbGFtcGVkIHRvIFswLCB2YWx1ZS5sZW5ndGhdLlxuICBjb25zdCBtb3ZlQ3Vyc29yID0gKHBvcykgPT4ge1xuICAgIGNvbnN0IGNsYW1wZWQgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihwb3MsIHZhbHVlLmxlbmd0aCkpO1xuICAgIHNldEFuY2hvcihjbGFtcGVkKTtcbiAgICBzZXRGb2N1c18oY2xhbXBlZCk7XG4gIH07XG5cbiAgLy8gRXh0ZW5kIG9ubHkgdGhlIG1vdmluZyBmb2N1cyBlbmQgKHNoaWZ0LXNlbGVjdGlvbikuXG4gIGNvbnN0IGV4dGVuZFRvID0gKHBvcykgPT4ge1xuICAgIHNldEZvY3VzXyhNYXRoLm1heCgwLCBNYXRoLm1pbihwb3MsIHZhbHVlLmxlbmd0aCkpKTtcbiAgfTtcblxuICAvLyBDZW50cmFsIGNvbW1pdCBwb2ludCBmb3IgZXZlcnkgdGV4dCBtdXRhdGlvbjogYXBwbGllcyB0aGUga2V5Ym9hcmRUeXBlXG4gIC8vIGZpbHRlciBhbmQgbWF4TGVuZ3RoIGNhcCwgdGhlbiBlbWl0cyArIHBvc2l0aW9ucyB0aGUgY3Vyc29yLlxuICBjb25zdCBjb21taXQgPSAobmV4dCwgbmV3UG9zKSA9PiB7XG4gICAgaWYgKGtleWJvYXJkVHlwZSA9PT0gJ251bWVyaWMnICYmICEvXi0/XFxkKiQvLnRlc3QobmV4dCkpIHJldHVybjtcbiAgICBpZiAoa2V5Ym9hcmRUeXBlID09PSAnZGVjaW1hbCcgJiYgIS9eLT9cXGQqXFwuP1xcZCokLy50ZXN0KG5leHQpKSByZXR1cm47XG4gICAgaWYgKG1heExlbmd0aCAhPSBudWxsICYmIG5leHQubGVuZ3RoID4gbWF4TGVuZ3RoKSB7XG4gICAgICBuZXh0ID0gbmV4dC5zbGljZSgwLCBtYXhMZW5ndGgpO1xuICAgIH1cbiAgICBvbkNoYW5nZVRleHQ/LihuZXh0KTtcbiAgICBjb25zdCBwb3MgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihuZXdQb3MsIG5leHQubGVuZ3RoKSk7XG4gICAgc2V0QW5jaG9yKHBvcyk7XG4gICAgc2V0Rm9jdXNfKHBvcyk7XG4gIH07XG5cbiAgLy8gTWVhc3VyZSB0aGUgZmllbGQncyByZWFsIGxheW91dCB3aWR0aCBcdTIwMTQgcnVucyBhZnRlciBldmVyeSByZW5kZXIgd2l0aCBhblxuICAvLyBlcXVhbGl0eSBndWFyZCwgc28gaXQgY29udmVyZ2VzIGluc3RlYWQgb2YgbG9vcGluZy4gIENvdmVycyBtb3VudCxcbiAgLy8gd2luZG93IHJlc2l6ZSwgYW5kIGZsZXggcmVmbG93LlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGlkID0gbm9kZUlkUmVmLmN1cnJlbnQ7XG4gICAgaWYgKGlkID09IG51bGwgfHwgdHlwZW9mIF9fZ2x5eF9nZXRMYXlvdXQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGwgPSBfX2dseXhfZ2V0TGF5b3V0KGlkKTtcbiAgICAgIGlmIChsICYmIGwud2lkdGggPiAwICYmIE1hdGguYWJzKGwud2lkdGggLSBtZWFzdXJlZFcpID4gMSkge1xuICAgICAgICBzZXRNZWFzdXJlZFcobC53aWR0aCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoXykge31cbiAgfSk7XG5cbiAgY29uc3QgaW5uZXJQYWRkaW5nID0gbXVsdGlsaW5lID8gMTAgOiA4O1xuICAvLyBXaWR0aCByZXNvbHV0aW9uOiBleHBsaWNpdCBgd2lkdGhgIHByb3Agd2luczsgb3RoZXJ3aXNlLCBpZiB0aGUgc3R5bGVcbiAgLy8gYWxyZWFkeSBjb250cm9scyB3aWR0aCAod2lkdGggLyBmbGV4IC8gc3RyZXRjaCksIGxldCBsYXlvdXQgZGVjaWRlOyBvbmx5XG4gIC8vIHdoZW4gTk9USElORyBzaXplcyB0aGUgZmllbGQgZG9lcyB0aGUgMjQwcHggZGVmYXVsdCBhcHBseS5cbiAgY29uc3Qgc3R5bGVTaXplc1dpZHRoID0gISFzdHlsZSAmJiAoXG4gICAgc3R5bGUud2lkdGggIT0gbnVsbCB8fCBzdHlsZS5mbGV4ICE9IG51bGwgfHwgc3R5bGUuZmxleEdyb3cgIT0gbnVsbCB8fFxuICAgIHN0eWxlLm1pbldpZHRoICE9IG51bGwgfHwgc3R5bGUuYWxpZ25TZWxmID09PSAnc3RyZXRjaCdcbiAgKTtcbiAgY29uc3Qgbm9kZVdpZHRoID0gd2lkdGggIT0gbnVsbCA/IHdpZHRoIDogKHN0eWxlU2l6ZXNXaWR0aCA/IHVuZGVmaW5lZCA6IDI0MCk7XG4gIGNvbnN0IGZpZWxkVyA9IG1lYXN1cmVkVyB8fCAodHlwZW9mIG5vZGVXaWR0aCA9PT0gJ251bWJlcicgPyBub2RlV2lkdGggOiAyNDApO1xuICBjb25zdCBpbm5lclcgPSBNYXRoLm1heCgxLCBmaWVsZFcgLSBpbm5lclBhZGRpbmcgKiAyKTtcblxuICAvLyBSZWNvbXB1dGUgaG9yaXpvbnRhbCBzY3JvbGwgb2Zmc2V0IHNvIHRoZSBjYXJldCBzdGF5cyB2aXNpYmxlLlxuICAvLyBPbmx5IGFwcGxpZXMgdG8gc2luZ2xlLWxpbmUgbW9kZSAobXVsdGlsaW5lIHNjcm9sbHMgdmVydGljYWxseSB2aWEgU2Nyb2xsVmlldykuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKG11bHRpbGluZSkgcmV0dXJuO1xuICAgIGlmICh0eXBlb2YgX19nbHl4X21lYXN1cmVfdGV4dCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICBjb25zdCB2aXNpYmxlVyAgID0gaW5uZXJXO1xuICAgIGNvbnN0IGNhcmV0WCAgICAgPSBfX2dseXhfbWVhc3VyZV90ZXh0KHJlbmRlclZhbHVlLnNsaWNlKDAsIGZvY3VzXyksIGZvbnRTaXplLCAxZTYpLndpZHRoO1xuICAgIGNvbnN0IHRleHRXICAgICAgPSBfX2dseXhfbWVhc3VyZV90ZXh0KHJlbmRlclZhbHVlLCBmb250U2l6ZSwgMWU2KS53aWR0aDtcbiAgICBsZXQgc3ggPSBzY3JvbGxYUmVmLmN1cnJlbnQ7XG4gICAgaWYgKGNhcmV0WCAtIHN4ID4gdmlzaWJsZVcpIHN4ID0gY2FyZXRYIC0gdmlzaWJsZVc7XG4gICAgaWYgKGNhcmV0WCAtIHN4IDwgMCkgICAgICAgIHN4ID0gY2FyZXRYO1xuICAgIC8vIFBhbiBiYWNrIHJpZ2h0IHdoZW4gdGV4dCBzaHJpbmtzIChkZWxldGlvbik6IG5ldmVyIGxlYXZlIGJsYW5rIHNwYWNlXG4gICAgLy8gb24gdGhlIHJpZ2h0IHdoaWxlIHRleHQgaXMgY2xpcHBlZCBvbiB0aGUgbGVmdC5cbiAgICBzeCA9IE1hdGgubWluKHN4LCBNYXRoLm1heCgwLCB0ZXh0VyAtIHZpc2libGVXKSk7XG4gICAgc3ggPSBNYXRoLm1heCgwLCBzeCk7XG4gICAgaWYgKHN4ICE9PSBzY3JvbGxYUmVmLmN1cnJlbnQpIHtcbiAgICAgIHNjcm9sbFhSZWYuY3VycmVudCA9IHN4O1xuICAgICAgc2V0U2Nyb2xsWChzeCk7XG4gICAgfVxuICB9LCBbZm9jdXNfLCByZW5kZXJWYWx1ZSwgZm9udFNpemUsIGlubmVyVywgbXVsdGlsaW5lXSk7XG5cbiAgLy8gTXVsdGlsaW5lIGF1dG8taGVpZ2h0OiBjb3VudCByZW5kZXJlZCBsaW5lcyAoZXhwbGljaXQgJ1xcbicgcGx1cyBzb2Z0XG4gIC8vIHdyYXBzIGF0IHRoZSByZWFsIGZpZWxkIHdpZHRoKSBhbmQgc2l6ZSB0aGUgYm94IGJldHdlZW4gbWluTGluZXMgYW5kXG4gIC8vIG1heExpbmVzLiAgQW4gZXhwbGljaXQgYGhlaWdodGAgcHJvcCBvcHRzIG91dC5cbiAgY29uc3QgbGluZUggPSBmb250U2l6ZSAqIDEuNDtcbiAgbGV0IGF1dG9IZWlnaHQ7XG4gIGlmIChtdWx0aWxpbmUgJiYgaGVpZ2h0ID09IG51bGwpIHtcbiAgICBjb25zdCBsbyA9IE1hdGgubWF4KDEsIG1pbkxpbmVzID8/IDMpO1xuICAgIGNvbnN0IGhpID0gTWF0aC5tYXgobG8sIG1heExpbmVzID8/IDEwKTtcbiAgICBsZXQgbGluZUNvdW50ID0gMDtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9tZWFzdXJlX3RleHQgIT09ICd1bmRlZmluZWQnICYmIGlubmVyVyA+IDEpIHtcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiByZW5kZXJWYWx1ZS5zcGxpdCgnXFxuJykpIHtcbiAgICAgICAgY29uc3QgdyA9IGxpbmUgPyBfX2dseXhfbWVhc3VyZV90ZXh0KGxpbmUsIGZvbnRTaXplLCAxZTYpLndpZHRoIDogMDtcbiAgICAgICAgbGluZUNvdW50ICs9IE1hdGgubWF4KDEsIE1hdGguY2VpbCh3IC8gaW5uZXJXKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpbmVDb3VudCA9IHJlbmRlclZhbHVlLnNwbGl0KCdcXG4nKS5sZW5ndGg7XG4gICAgfVxuICAgIGNvbnN0IGxpbmVzID0gTWF0aC5tYXgobG8sIE1hdGgubWluKGhpLCBNYXRoLm1heCgxLCBsaW5lQ291bnQpKSk7XG4gICAgYXV0b0hlaWdodCA9IE1hdGguY2VpbChsaW5lcyAqIGxpbmVIKSArIGlubmVyUGFkZGluZyAqIDIgKyA0O1xuICB9XG4gIGNvbnN0IHJlc29sdmVkSGVpZ2h0ID0gaGVpZ2h0ID8/IChtdWx0aWxpbmUgPyBhdXRvSGVpZ2h0IDogNDQpO1xuXG4gIC8vIEtlZXAgaGFuZGxlcnNSZWYgY3VycmVudCBzbyBpdCBhbHdheXMgY2FwdHVyZXMgdGhlIGxhdGVzdCBzdGF0ZS9wcm9wcy5cbiAgaGFuZGxlcnNSZWYuY3VycmVudCA9IHtcbiAgICBvbkZvY3VzOiAoKSA9PiB7XG4gICAgICBzZXRGb2N1c2VkKHRydWUpO1xuICAgICAgLy8gUGxhY2UgY3Vyc29yIGF0IGVuZCBvZiB0ZXh0IG9uIGZvY3VzLlxuICAgICAgY29uc3QgZW5kID0gdmFsdWUubGVuZ3RoO1xuICAgICAgc2V0QW5jaG9yKGVuZCk7XG4gICAgICBzZXRGb2N1c18oZW5kKTtcbiAgICB9LFxuICAgIG9uQmx1cjogKCkgPT4ge1xuICAgICAgc2V0Rm9jdXNlZChmYWxzZSk7XG4gICAgfSxcbiAgICBvbktleVByZXNzOiBhc3luYyAoeyBrZXksIHRleHQsIGN0cmwsIHNoaWZ0IH0pID0+IHtcbiAgICAgIGNvbnN0IHNzICAgICA9IE1hdGgubWluKGFuY2hvciwgZm9jdXNfKTtcbiAgICAgIGNvbnN0IHNlICAgICA9IE1hdGgubWF4KGFuY2hvciwgZm9jdXNfKTtcbiAgICAgIGNvbnN0IGhhc1NlbCA9IHNzIDwgc2U7XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCBDdHJsIHNob3J0Y3V0cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgIGlmIChjdHJsKSB7XG4gICAgICAgIGlmIChrZXkgPT09ICdLZXlBJykge1xuICAgICAgICAgIHNldEFuY2hvcigwKTtcbiAgICAgICAgICBzZXRGb2N1c18odmFsdWUubGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIGlmIChrZXkgPT09ICdLZXlDJykge1xuICAgICAgICAgIGlmIChoYXNTZWwpIHtcbiAgICAgICAgICAgIHRyeSB7IGF3YWl0IGNsaXBib2FyZC53cml0ZVRleHQodmFsdWUuc2xpY2Uoc3MsIHNlKSk7IH0gY2F0Y2ggKF8pIHt9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ0tleVgnKSB7XG4gICAgICAgICAgaWYgKGhhc1NlbCkge1xuICAgICAgICAgICAgdHJ5IHsgYXdhaXQgY2xpcGJvYXJkLndyaXRlVGV4dCh2YWx1ZS5zbGljZShzcywgc2UpKTsgfSBjYXRjaCAoXykge31cbiAgICAgICAgICAgIGNvbW1pdCh2YWx1ZS5zbGljZSgwLCBzcykgKyB2YWx1ZS5zbGljZShzZSksIHNzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSAnS2V5VicpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGFzdGVkID0gYXdhaXQgY2xpcGJvYXJkLnJlYWRUZXh0KCk7XG4gICAgICAgICAgICBpZiAocGFzdGVkKSB7XG4gICAgICAgICAgICAgIGNvbW1pdCh2YWx1ZS5zbGljZSgwLCBzcykgKyBwYXN0ZWQgKyB2YWx1ZS5zbGljZShzZSksIHNzICsgcGFzdGVkLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoXykge31cbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCBBcnJvdyAvIG5hdmlnYXRpb24ga2V5cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgIGlmICgoa2V5ID09PSAnQXJyb3dVcCcgfHwga2V5ID09PSAnQXJyb3dEb3duJykgJiYgbXVsdGlsaW5lKSB7XG4gICAgICAgIC8vIFNwbGl0IGF0IGN1cnJlbnQgYW5jaG9yIHRvIGZpbmQgbGluZSBpbmRleCArIGNvbHVtbi5cbiAgICAgICAgY29uc3QgbGluZXMgPSB2YWx1ZS5zcGxpdCgnXFxuJyk7XG4gICAgICAgIGxldCBsaW5lSWR4ID0gMCwgbGluZVN0YXJ0ID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IGxpbmVFbmQgPSBsaW5lU3RhcnQgKyBsaW5lc1tpXS5sZW5ndGg7XG4gICAgICAgICAgaWYgKGFuY2hvciA8PSBsaW5lRW5kIHx8IGkgPT09IGxpbmVzLmxlbmd0aCAtIDEpIHsgbGluZUlkeCA9IGk7IGJyZWFrOyB9XG4gICAgICAgICAgbGluZVN0YXJ0ICs9IGxpbmVzW2ldLmxlbmd0aCArIDE7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29sID0gYW5jaG9yIC0gbGluZVN0YXJ0O1xuICAgICAgICBpZiAoa2V5ID09PSAnQXJyb3dVcCcgJiYgbGluZUlkeCA+IDApIHtcbiAgICAgICAgICBjb25zdCBwcmV2TGluZVN0YXJ0ID0gbGluZVN0YXJ0IC0gbGluZXNbbGluZUlkeCAtIDFdLmxlbmd0aCAtIDE7XG4gICAgICAgICAgY29uc3QgbmV3UG9zID0gcHJldkxpbmVTdGFydCArIE1hdGgubWluKGNvbCwgbGluZXNbbGluZUlkeCAtIDFdLmxlbmd0aCk7XG4gICAgICAgICAgaWYgKHNoaWZ0KSB7IGV4dGVuZFRvKG5ld1Bvcyk7IH0gZWxzZSB7IG1vdmVDdXJzb3IobmV3UG9zKTsgfVxuICAgICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ0Fycm93RG93bicgJiYgbGluZUlkeCA8IGxpbmVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICBjb25zdCBuZXh0TGluZVN0YXJ0ID0gbGluZVN0YXJ0ICsgbGluZXNbbGluZUlkeF0ubGVuZ3RoICsgMTtcbiAgICAgICAgICBjb25zdCBuZXdQb3MgPSBuZXh0TGluZVN0YXJ0ICsgTWF0aC5taW4oY29sLCBsaW5lc1tsaW5lSWR4ICsgMV0ubGVuZ3RoKTtcbiAgICAgICAgICBpZiAoc2hpZnQpIHsgZXh0ZW5kVG8obmV3UG9zKTsgfSBlbHNlIHsgbW92ZUN1cnNvcihuZXdQb3MpOyB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGtleSA9PT0gJ0Fycm93TGVmdCcpIHtcbiAgICAgICAgaWYgKHNoaWZ0KSB7XG4gICAgICAgICAgZXh0ZW5kVG8oZm9jdXNfIC0gMSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaGFzU2VsKSB7XG4gICAgICAgICAgbW92ZUN1cnNvcihzcyk7ICAgICAgICAgICAvLyBjb2xsYXBzZSB0byBzdGFydCBvZiBzZWxlY3Rpb25cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtb3ZlQ3Vyc29yKGFuY2hvciAtIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChrZXkgPT09ICdBcnJvd1JpZ2h0Jykge1xuICAgICAgICBpZiAoc2hpZnQpIHtcbiAgICAgICAgICBleHRlbmRUbyhmb2N1c18gKyAxKTtcbiAgICAgICAgfSBlbHNlIGlmIChoYXNTZWwpIHtcbiAgICAgICAgICBtb3ZlQ3Vyc29yKHNlKTsgICAgICAgICAgIC8vIGNvbGxhcHNlIHRvIGVuZCBvZiBzZWxlY3Rpb25cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtb3ZlQ3Vyc29yKGFuY2hvciArIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChrZXkgPT09ICdIb21lJykge1xuICAgICAgICAvLyBNdWx0aWxpbmU6IHN0YXJ0IG9mIHRoZSBjdXJyZW50IExPR0lDQUwgbGluZSAoQ3RybCtIb21lID0gZG9jdW1lbnQgc3RhcnQpLlxuICAgICAgICBjb25zdCB0YXJnZXQgPSAobXVsdGlsaW5lICYmICFjdHJsKVxuICAgICAgICAgID8gdmFsdWUubGFzdEluZGV4T2YoJ1xcbicsIE1hdGgubWF4KDAsIGZvY3VzXyAtIDEpKSArIDFcbiAgICAgICAgICA6IDA7XG4gICAgICAgIGlmIChzaGlmdCkgeyBleHRlbmRUbyh0YXJnZXQpOyB9IGVsc2UgeyBtb3ZlQ3Vyc29yKHRhcmdldCk7IH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGtleSA9PT0gJ0VuZCcpIHtcbiAgICAgICAgLy8gTXVsdGlsaW5lOiBlbmQgb2YgdGhlIGN1cnJlbnQgTE9HSUNBTCBsaW5lIChDdHJsK0VuZCA9IGRvY3VtZW50IGVuZCkuXG4gICAgICAgIGxldCB0YXJnZXQgPSB2YWx1ZS5sZW5ndGg7XG4gICAgICAgIGlmIChtdWx0aWxpbmUgJiYgIWN0cmwpIHtcbiAgICAgICAgICBjb25zdCBubCA9IHZhbHVlLmluZGV4T2YoJ1xcbicsIGZvY3VzXyk7XG4gICAgICAgICAgdGFyZ2V0ID0gbmwgPT09IC0xID8gdmFsdWUubGVuZ3RoIDogbmw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNoaWZ0KSB7IGV4dGVuZFRvKHRhcmdldCk7IH0gZWxzZSB7IG1vdmVDdXJzb3IodGFyZ2V0KTsgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAobXVsdGlsaW5lICYmIChrZXkgPT09ICdQYWdlVXAnIHx8IGtleSA9PT0gJ1BhZ2VEb3duJykpIHtcbiAgICAgICAgLy8gTW92ZSB0aGUgQ0FSRVQgYSB2aWV3cG9ydCdzIHdvcnRoIG9mIGxpbmVzIChlZGl0b3Igc3RhbmRhcmQpIFx1MjAxNFxuICAgICAgICAvLyB0aGUgY2FyZXQtZm9sbG93IGVmZmVjdCB0aGVuIHNjcm9sbHMgdGhlIHZpZXcgYWxvbmcgd2l0aCBpdC5cbiAgICAgICAgY29uc3QgaWQgPSBub2RlSWRSZWYuY3VycmVudDtcbiAgICAgICAgY29uc3QgbCA9IChpZCAhPSBudWxsICYmIHR5cGVvZiBfX2dseXhfZ2V0TGF5b3V0ICE9PSAndW5kZWZpbmVkJykgPyBfX2dseXhfZ2V0TGF5b3V0KGlkKSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGxpbmVIID0gZm9udFNpemUgKiAxLjQ7XG4gICAgICAgIGNvbnN0IHBhZ2VMaW5lcyA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IoKChsID8gbC5oZWlnaHQgOiAzMDApIC0gaW5uZXJQYWRkaW5nICogMikgLyBsaW5lSCkgLSAxKTtcbiAgICAgICAgaWYgKHR5cGVvZiBfX2dseXhfbWVhc3VyZV90ZXh0ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgX19nbHl4X3RleHRfcG9zX2F0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGNvbnN0IGNhcmV0WSA9IF9fZ2x5eF9tZWFzdXJlX3RleHQocmVuZGVyVmFsdWUuc2xpY2UoMCwgZm9jdXNfKSB8fCAnICcsIGZvbnRTaXplLCBpbm5lclcpLmhlaWdodCAtIGxpbmVIIC8gMjtcbiAgICAgICAgICBjb25zdCBjYXJldFggPSAwOyAvLyBjb2x1bW4gcHJlc2VydmF0aW9uIHZpYSB4IHdvdWxkIG5lZWQgY2FyZXQgeCB0cmFja2luZzsgaG9tZS1jb2x1bW4gaXMgYWNjZXB0YWJsZVxuICAgICAgICAgIGNvbnN0IHRhcmdldFkgPSBrZXkgPT09ICdQYWdlVXAnID8gY2FyZXRZIC0gcGFnZUxpbmVzICogbGluZUggOiBjYXJldFkgKyBwYWdlTGluZXMgKiBsaW5lSDtcbiAgICAgICAgICBjb25zdCBwb3MgPSBfX2dseXhfdGV4dF9wb3NfYXQocmVuZGVyVmFsdWUsIGZvbnRTaXplLCBpbm5lclcsIGNhcmV0WCwgTWF0aC5tYXgoMCwgdGFyZ2V0WSkpO1xuICAgICAgICAgIGlmIChzaGlmdCkgeyBleHRlbmRUbyhwb3MpOyB9IGVsc2UgeyBtb3ZlQ3Vyc29yKHBvcyk7IH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFx1MjUwMFx1MjUwMCBEZWxldGUgLyBCYWNrc3BhY2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgICBpZiAoa2V5ID09PSAnQmFja3NwYWNlJykge1xuICAgICAgICBpZiAoaGFzU2VsKSB7XG4gICAgICAgICAgY29tbWl0KHZhbHVlLnNsaWNlKDAsIHNzKSArIHZhbHVlLnNsaWNlKHNlKSwgc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKGFuY2hvciA+IDApIHtcbiAgICAgICAgICAvLyBTcHJlYWQgdG8gaGFuZGxlIG11bHRpLWJ5dGUgVW5pY29kZSBjb3JyZWN0bHkuXG4gICAgICAgICAgY29uc3QgY2hhcnMgPSBbLi4udmFsdWVdO1xuICAgICAgICAgIGNoYXJzLnNwbGljZShhbmNob3IgLSAxLCAxKTtcbiAgICAgICAgICBjb21taXQoY2hhcnMuam9pbignJyksIGFuY2hvciAtIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChrZXkgPT09ICdEZWxldGUnKSB7XG4gICAgICAgIGlmIChoYXNTZWwpIHtcbiAgICAgICAgICBjb21taXQodmFsdWUuc2xpY2UoMCwgc3MpICsgdmFsdWUuc2xpY2Uoc2UpLCBzcyk7XG4gICAgICAgIH0gZWxzZSBpZiAoYW5jaG9yIDwgdmFsdWUubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc3QgY2hhcnMgPSBbLi4udmFsdWVdO1xuICAgICAgICAgIGNoYXJzLnNwbGljZShhbmNob3IsIDEpO1xuICAgICAgICAgIGNvbW1pdChjaGFycy5qb2luKCcnKSwgYW5jaG9yKTsgICAvLyBjdXJzb3Igc3RheXMgcHV0XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBcdTI1MDBcdTI1MDAgRW50ZXIgKG11bHRpbGluZSBvbmx5KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgIGlmIChrZXkgPT09ICdFbnRlcicpIHtcbiAgICAgICAgaWYgKG11bHRpbGluZSkge1xuICAgICAgICAgIGNvbW1pdCh2YWx1ZS5zbGljZSgwLCBzcykgKyAnXFxuJyArIHZhbHVlLnNsaWNlKHNlKSwgc3MgKyAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvblN1Ym1pdEVkaXRpbmc/Lih2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBcdTI1MDBcdTI1MDAgUHJpbnRhYmxlIGNoYXJhY3RlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICAgIGlmICh0ZXh0KSB7XG4gICAgICAgIC8vIGNvbW1pdCgpIGNsYW1wcyB0aGUgY3Vyc29yIHRvIHRoZSBORVcgdmFsdWUncyBsZW5ndGgsIHNvIHR5cGluZyB0aGVcbiAgICAgICAgLy8gZmlyc3QgY2hhcmFjdGVyIGludG8gYW4gZW1wdHkgZmllbGQgcG9zaXRpb25zIGNvcnJlY3RseS5cbiAgICAgICAgY29tbWl0KHZhbHVlLnNsaWNlKDAsIHNzKSArIHRleHQgKyB2YWx1ZS5zbGljZShzZSksIHNzICsgdGV4dC5sZW5ndGgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgLy8gQ2hhcmFjdGVyIHBvc2l0aW9uIHVuZGVyIGEgcG9pbnRlciBjb29yZGluYXRlIChzaGFyZWQgYnkgY2xpY2sgKyBkcmFnKS5cbiAgICBwb3NBdDogKHJlbFgsIHJlbFkpID0+IHtcbiAgICAgIGNvbnN0IHBhZGRpbmcgPSBtdWx0aWxpbmUgPyAxMCA6IDg7XG4gICAgICBjb25zdCB0ZXh0WCAgID0gcmVsWCAtIHBhZGRpbmc7XG5cbiAgICAgIGlmIChtdWx0aWxpbmUpIHtcbiAgICAgICAgLy8gTXVsdGlsaW5lOiBuYXRpdmUgMi1EIGhpdC10ZXN0IGFnYWluc3QgdGhlIFdSQVBQRUQgbGF5b3V0IChoYW5kbGVzXG4gICAgICAgIC8vIHNvZnQgd3JhcHMgKyAnXFxuJywgd2hpY2ggbmFpdmUgbGluZS1zcGxpdHRpbmcgY2Fubm90KS4gIFRoZSBjbGljayBZXG4gICAgICAgIC8vIGlzIGluIHZpZXdwb3J0IHNwYWNlIFx1MjAxNCBhZGQgdGhlIHNjcm9sbCBvZmZzZXQgdG8gbGFuZCBpbiBjb250ZW50IHNwYWNlLlxuICAgICAgICBjb25zdCBjb250ZW50WSA9IHJlbFkgLSBwYWRkaW5nICsgc2Nyb2xsWVJlZi5jdXJyZW50O1xuICAgICAgICBpZiAodHlwZW9mIF9fZ2x5eF90ZXh0X3Bvc19hdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICByZXR1cm4gX19nbHl4X3RleHRfcG9zX2F0KHJlbmRlclZhbHVlLCBmb250U2l6ZSwgaW5uZXJXLCBNYXRoLm1heCgwLCB0ZXh0WCksIE1hdGgubWF4KDAsIGNvbnRlbnRZKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRmFsbGJhY2s6ICdcXG4nLXNwbGl0IGxpbmUgbWFwcGluZyAoaW5hY2N1cmF0ZSB3aXRoIHNvZnQgd3JhcHMpLlxuICAgICAgICBjb25zdCBsaW5lSGVpZ2h0ID0gZm9udFNpemUgKiAxLjQ7XG4gICAgICAgIGNvbnN0IGxpbmVJZHggICAgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKGNvbnRlbnRZIC8gbGluZUhlaWdodCkpO1xuICAgICAgICBjb25zdCBsaW5lcyAgICAgID0gcmVuZGVyVmFsdWUuc3BsaXQoJ1xcbicpO1xuICAgICAgICBjb25zdCBjbGFtcGVkTGluZSA9IE1hdGgubWluKGxpbmVJZHgsIGxpbmVzLmxlbmd0aCAtIDEpO1xuICAgICAgICBjb25zdCBsaW5lVGV4dCAgID0gbGluZXNbY2xhbXBlZExpbmVdO1xuICAgICAgICBjb25zdCBjb2wgPSAodHlwZW9mIF9fZ2x5eF90ZXh0X2NoYXJfYXRfeCAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgICAgPyBfX2dseXhfdGV4dF9jaGFyX2F0X3gobGluZVRleHQsIGZvbnRTaXplLCAxZTYsIE1hdGgubWF4KDAsIHRleHRYKSlcbiAgICAgICAgICA6IE1hdGgubWF4KDAsIE1hdGgubWluKE1hdGgucm91bmQoTWF0aC5tYXgoMCwgdGV4dFgpIC8gKGZvbnRTaXplICogMC41NSkpLCBsaW5lVGV4dC5sZW5ndGgpKTtcbiAgICAgICAgbGV0IHBvcyA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2xhbXBlZExpbmU7IGkrKykgcG9zICs9IGxpbmVzW2ldLmxlbmd0aCArIDE7XG4gICAgICAgIHJldHVybiBwb3MgKyBjb2w7XG4gICAgICB9XG4gICAgICAvLyBTaW5nbGUtbGluZTogYWRkIHNjcm9sbFggb2Zmc2V0IHNvIGNsaWNrIG1hcHMgdG8gdGhlIGNvcnJlY3QgY2hhcmFjdGVyXG4gICAgICAvLyBldmVuIHdoZW4gdGhlIHRleHQgaXMgc2hpZnRlZCBsZWZ0LiAgTWVhc3VyZWQgYWdhaW5zdCByZW5kZXJWYWx1ZSBzb1xuICAgICAgLy8gbWFza2VkIChwYXNzd29yZCkgZ2x5cGggd2lkdGhzIGxpbmUgdXAgd2l0aCB3aGF0J3Mgb24gc2NyZWVuLlxuICAgICAgY29uc3QgbG9jYWxYID0gTWF0aC5tYXgoMCwgdGV4dFgpICsgc2Nyb2xsWFJlZi5jdXJyZW50O1xuICAgICAgcmV0dXJuICh0eXBlb2YgX19nbHl4X3RleHRfY2hhcl9hdF94ICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgPyBfX2dseXhfdGV4dF9jaGFyX2F0X3gocmVuZGVyVmFsdWUsIGZvbnRTaXplLCAxZTYsIGxvY2FsWClcbiAgICAgICAgOiBNYXRoLm1heCgwLCBNYXRoLm1pbihNYXRoLnJvdW5kKGxvY2FsWCAvIChmb250U2l6ZSAqIDAuNTUpKSwgcmVuZGVyVmFsdWUubGVuZ3RoKSk7XG4gICAgfSxcbiAgICBvbkNsaWNrQXQ6IChyZWxYLCByZWxZKSA9PiB7XG4gICAgICBtb3ZlQ3Vyc29yKGhhbmRsZXJzUmVmLmN1cnJlbnQucG9zQXQocmVsWCwgcmVsWSkpO1xuICAgIH0sXG4gICAgLy8gTW91c2UgZHJhZzoga2VlcCB0aGUgcHJlc3MtZG93biBhbmNob3IsIG1vdmUgb25seSB0aGUgZm9jdXMgZW5kLlxuICAgIG9uRHJhZ0F0OiAocmVsWCwgcmVsWSkgPT4ge1xuICAgICAgZXh0ZW5kVG8oaGFuZGxlcnNSZWYuY3VycmVudC5wb3NBdChyZWxYLCByZWxZKSk7XG4gICAgfSxcbiAgfTtcblxuICAvLyBDbGFtcCBhIHRhcmdldCBzY3JvbGwgb2Zmc2V0IGFnYWluc3QgdGhlIHJlYWwgKG5hdGl2ZS1tZWFzdXJlZCkgb3ZlcmZsb3cuXG4gIGNvbnN0IGNsYW1wU2Nyb2xsWSA9ICh5KSA9PiB7XG4gICAgY29uc3QgaWQgPSBub2RlSWRSZWYuY3VycmVudDtcbiAgICBpZiAoaWQgPT0gbnVsbCB8fCB0eXBlb2YgX19nbHl4X2dldExheW91dCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiAwO1xuICAgIGNvbnN0IGwgPSBfX2dseXhfZ2V0TGF5b3V0KGlkKTtcbiAgICBjb25zdCBtYXggPSAobCAmJiB0eXBlb2YgbC5jb250ZW50SGVpZ2h0ID09PSAnbnVtYmVyJylcbiAgICAgID8gTWF0aC5tYXgoMCwgbC5jb250ZW50SGVpZ2h0IC0gbC5oZWlnaHQpIDogMDtcbiAgICByZXR1cm4gTWF0aC5taW4obWF4LCBNYXRoLm1heCgwLCB5KSk7XG4gIH07XG5cbiAgY29uc3Qgb25Nb3VudCA9IHVzZUNhbGxiYWNrKChpZCkgPT4ge1xuICAgIG5vZGVJZFJlZi5jdXJyZW50ID0gaWQ7XG4gICAgcmVnaXN0ZXJJbnB1dChpZCwge1xuICAgICAgb25Gb2N1czogICAgKCkgPT4gaGFuZGxlcnNSZWYuY3VycmVudC5vbkZvY3VzKCksXG4gICAgICBvbkJsdXI6ICAgICAoKSA9PiBoYW5kbGVyc1JlZi5jdXJyZW50Lm9uQmx1cigpLFxuICAgICAgb25LZXlQcmVzczogKGV2KSA9PiBoYW5kbGVyc1JlZi5jdXJyZW50Lm9uS2V5UHJlc3MoZXYpLFxuICAgICAgb25DbGlja0F0OiAgKHJlbFgsIHJlbFkpID0+IGhhbmRsZXJzUmVmLmN1cnJlbnQub25DbGlja0F0KHJlbFgsIHJlbFkpLFxuICAgICAgb25EcmFnQXQ6ICAgKHJlbFgsIHJlbFkpID0+IGhhbmRsZXJzUmVmLmN1cnJlbnQub25EcmFnQXQocmVsWCwgcmVsWSksXG4gICAgfSk7XG4gICAgLy8gTXVsdGlsaW5lIGZpZWxkcyBzY3JvbGwgdmVydGljYWxseSBsaWtlIGEgU2Nyb2xsVmlldzogd2hlZWwgKyBuYXRpdmVcbiAgICAvLyBzY3JvbGxiYXIgdGh1bWIvdHJhY2sgZHJhZ3MgYm90aCByb3V0ZSBoZXJlLlxuICAgIGlmIChtdWx0aWxpbmUpIHtcbiAgICAgIHJlZ2lzdGVyU2Nyb2xsVmlldyhpZCwge1xuICAgICAgICBvblNjcm9sbDogICAgICAgICAoZHkpID0+IHNldFNjcm9sbFlCb3RoKGNsYW1wU2Nyb2xsWShzY3JvbGxZUmVmLmN1cnJlbnQgKyBkeSkpLFxuICAgICAgICBvbkFic29sdXRlU2Nyb2xsOiAoeSkgID0+IHNldFNjcm9sbFlCb3RoKGNsYW1wU2Nyb2xsWSh5KSksXG4gICAgICB9KTtcbiAgICB9XG4gIH0sIFtdKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpZiAobm9kZUlkUmVmLmN1cnJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgdW5yZWdpc3RlcklucHV0KG5vZGVJZFJlZi5jdXJyZW50KTtcbiAgICAgICAgdW5yZWdpc3RlclNjcm9sbFZpZXcobm9kZUlkUmVmLmN1cnJlbnQpO1xuICAgICAgfVxuICAgIH07XG4gIH0sIFtdKTtcblxuICAvLyBDYXJldCBmb2xsb3c6IHdoZW4gdHlwaW5nL21vdmluZyB0aGUgY2FyZXQgaW4gYSBzY3JvbGxlZCBtdWx0aWxpbmUgZmllbGQsXG4gIC8vIGtlZXAgdGhlIGNhcmV0J3MgbGluZSBpbnNpZGUgdGhlIHZpZXdwb3J0LlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghbXVsdGlsaW5lIHx8ICFmb2N1c2VkKSByZXR1cm47XG4gICAgaWYgKHR5cGVvZiBfX2dseXhfbWVhc3VyZV90ZXh0ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICAgIGNvbnN0IGlkID0gbm9kZUlkUmVmLmN1cnJlbnQ7XG4gICAgaWYgKGlkID09IG51bGwgfHwgdHlwZW9mIF9fZ2x5eF9nZXRMYXlvdXQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgY29uc3QgbCA9IF9fZ2x5eF9nZXRMYXlvdXQoaWQpO1xuICAgIGlmICghbCkgcmV0dXJuO1xuICAgIGNvbnN0IGxpbmVIID0gTWF0aC5jZWlsKGZvbnRTaXplICogMS40KTtcbiAgICAvLyBDYXJldCBib3R0b20geSB3aXRoaW4gdGhlIGNvbnRlbnQgPSBoZWlnaHQgb2YgdGhlIHRleHQgdXAgdG8gdGhlIGNhcmV0LlxuICAgIGNvbnN0IGNhcmV0Qm90dG9tID0gX19nbHl4X21lYXN1cmVfdGV4dChyZW5kZXJWYWx1ZS5zbGljZSgwLCBmb2N1c18pIHx8ICcgJywgZm9udFNpemUsIGlubmVyVykuaGVpZ2h0ICsgaW5uZXJQYWRkaW5nO1xuICAgIGNvbnN0IHZpZXdIID0gbC5oZWlnaHQ7XG4gICAgbGV0IHN5ID0gc2Nyb2xsWVJlZi5jdXJyZW50O1xuICAgIGlmIChjYXJldEJvdHRvbSAtIHN5ID4gdmlld0ggLSBpbm5lclBhZGRpbmcpIHN5ID0gY2FyZXRCb3R0b20gLSB2aWV3SCArIGlubmVyUGFkZGluZztcbiAgICBpZiAoY2FyZXRCb3R0b20gLSBsaW5lSCAtIHN5IDwgaW5uZXJQYWRkaW5nKSBzeSA9IE1hdGgubWF4KDAsIGNhcmV0Qm90dG9tIC0gbGluZUggLSBpbm5lclBhZGRpbmcpO1xuICAgIHN5ID0gY2xhbXBTY3JvbGxZKHN5KTtcbiAgICBpZiAoc3kgIT09IHNjcm9sbFlSZWYuY3VycmVudCkgc2V0U2Nyb2xsWUJvdGgoc3kpO1xuICB9LCBbZm9jdXNfLCByZW5kZXJWYWx1ZSwgbXVsdGlsaW5lLCBmb2N1c2VkXSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG5cbiAgY29uc3QgQyA9IFJlYWN0LnVzZUNvbnRleHQoU2VsZWN0Q29sb3JzQ29udGV4dCk7XG5cbiAgLy8gU2hvdyBwbGFjZWhvbGRlciBvbmx5IHdoZW4gdW5mb2N1c2VkIGFuZCB2YWx1ZSBpcyBlbXB0eSAobWFza2VkIGZvclxuICAvLyBwYXNzd29yZCBmaWVsZHMgc28gdGhlIHJlYWwgdGV4dCBuZXZlciByZW5kZXJzKS5cbiAgY29uc3QgZGlzcGxheVRleHQgID0gKGZvY3VzZWQgfHwgdmFsdWUpID8gcmVuZGVyVmFsdWUgOiBwbGFjZWhvbGRlcjtcbiAgY29uc3QgZGlzcGxheWluZ1BsYWNlaG9sZGVyID0gIWZvY3VzZWQgJiYgIXZhbHVlO1xuICBjb25zdCB0ZXh0Q29sb3IgICAgPSBkaXNwbGF5aW5nUGxhY2Vob2xkZXJcbiAgICA/IEMudHJpZ2dlclBsYWNlaG9sZGVyXG4gICAgOiAoKHN0eWxlICYmIHN0eWxlLmNvbG9yKSB8fCBDLnRyaWdnZXJUZXh0KTtcblxuICBjb25zdCBpbnB1dFN0eWxlID0ge1xuICAgIGJhY2tncm91bmRDb2xvcjogQy50cmlnZ2VyQmcsXG4gICAgYm9yZGVyUmFkaXVzOiA2LFxuICAgIGJvcmRlcldpZHRoOiBmb2N1c2VkID8gMiA6IDEsXG4gICAgYm9yZGVyQ29sb3I6IGZvY3VzZWQgPyBDLnRyaWdnZXJCb3JkZXJGb2N1cyA6IEMudHJpZ2dlckJvcmRlcixcbiAgICBqdXN0aWZ5Q29udGVudDogbXVsdGlsaW5lID8gJ2ZsZXgtc3RhcnQnIDogJ2NlbnRlcicsXG4gICAgYWxpZ25JdGVtczogJ2ZsZXgtc3RhcnQnLFxuICAgIHBhZGRpbmc6IGlubmVyUGFkZGluZyxcbiAgICBjbGlwOiB0cnVlLCAgIC8vIHByZXZlbnQgdGV4dCBmcm9tIHJlbmRlcmluZyBvdXRzaWRlIHRoZSBpbnB1dCBib3VuZHNcbiAgICAuLi5zdHlsZSxcbiAgICAvLyBWZXJ0aWNhbCBzY3JvbGwgc3RhdGUgKGFmdGVyIHRoZSB1c2VyLXN0eWxlIHNwcmVhZCBcdTIwMTQgbm90IG92ZXJyaWRhYmxlKS5cbiAgICAuLi4obXVsdGlsaW5lID8geyBzY3JvbGxPZmZzZXRZOiBzY3JvbGxZIH0gOiBudWxsKSxcbiAgfTtcblxuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcbiAgICAndmlldycsXG4gICAgeyBfZ2x5eE9uTW91bnQ6IG9uTW91bnQsIHN0eWxlOiBpbnB1dFN0eWxlLCB3aWR0aDogbm9kZVdpZHRoLCBoZWlnaHQ6IHJlc29sdmVkSGVpZ2h0LCAuLi5wcm9wcyB9LFxuICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoJ3RleHQnLCB7XG4gICAgICB0ZXh0OiAgICAgICAgICAgZGlzcGxheVRleHQsXG4gICAgICBmb250U2l6ZSxcbiAgICAgIC8vIFdyYXAgKG11bHRpbGluZSkgYXQgdGhlIFJFQUwgbWVhc3VyZWQgd2lkdGgsIG5vdCB0aGUgMjQwIHByb3AgZGVmYXVsdC5cbiAgICAgIHdpZHRoOiAgICAgICAgICBpbm5lclcsXG4gICAgICBoZWlnaHQ6ICAgICAgICAgbXVsdGlsaW5lID8gdW5kZWZpbmVkIDogcmVzb2x2ZWRIZWlnaHQgLSBpbm5lclBhZGRpbmcgKiAyLFxuICAgICAgc3R5bGU6ICAgICAgICAgIHsgY29sb3I6IHRleHRDb2xvciB9LFxuICAgICAgc2hvd0N1cnNvcjogICAgIGZvY3VzZWQsXG4gICAgICBjdXJzb3JQb3NpdGlvbjogZm9jdXNlZCA/IGZvY3VzXyA6IHVuZGVmaW5lZCxcbiAgICAgIHNlbGVjdGlvblN0YXJ0OiAoZm9jdXNlZCAmJiBzZWxTdGFydCA8IHNlbEVuZCkgPyBzZWxTdGFydCA6IHVuZGVmaW5lZCxcbiAgICAgIHNlbGVjdGlvbkVuZDogICAoZm9jdXNlZCAmJiBzZWxTdGFydCA8IHNlbEVuZCkgPyBzZWxFbmQgICA6IHVuZGVmaW5lZCxcbiAgICAgIHRleHRBbGlnbjogICAgICAnbGVmdCcsXG4gICAgICB0ZXh0U2Nyb2xsWDogICAgbXVsdGlsaW5lID8gdW5kZWZpbmVkIDogc2Nyb2xsWCxcbiAgICB9KVxuICApO1xufVxuXG4vKipcbiAqIFBhc3N3b3JkIGZpZWxkIFx1MjAxNCBhIHNpbmdsZS1saW5lIFRleHRJbnB1dCB0aGF0IG1hc2tzIGV2ZXJ5IGNoYXJhY3Rlci5cbiAqIEFsbCBUZXh0SW5wdXQgcHJvcHMgYXBwbHkgKG1heExlbmd0aCwgb25TdWJtaXRFZGl0aW5nLCBcdTIwMjYpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gUGFzc3dvcmRJbnB1dChwcm9wcykge1xuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChUZXh0SW5wdXQsIHsgLi4ucHJvcHMsIHNlY3VyZVRleHRFbnRyeTogdHJ1ZSwgbXVsdGlsaW5lOiBmYWxzZSB9KTtcbn1cblxuLyoqXG4gKiBOdW1lcmljIGZpZWxkIFx1MjAxNCBhIHNpbmdsZS1saW5lIFRleHRJbnB1dCB0aGF0IG9ubHkgYWNjZXB0cyBudW1iZXJzLlxuICogYGtleWJvYXJkVHlwZWAgZGVmYXVsdHMgdG8gYCdkZWNpbWFsJ2AgKGRpZ2l0cywgb25lIGRvdCwgbGVhZGluZyBtaW51cyk7XG4gKiBwYXNzIGBrZXlib2FyZFR5cGU6ICdudW1lcmljJ2AgZm9yIGludGVnZXJzIG9ubHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBOdW1lcmljSW5wdXQocHJvcHMpIHtcbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGV4dElucHV0LCB7IGtleWJvYXJkVHlwZTogJ2RlY2ltYWwnLCAuLi5wcm9wcywgbXVsdGlsaW5lOiBmYWxzZSB9KTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIEZvcm0gZmllbGQgY29tcG9uZW50cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBUaWVyIDE6IHB1cmUgUmVhY3QgY29tcG9uZW50cywgbm8gbmV3IG5hdGl2ZSBiaW5kaW5ncy5cbi8vIEFsbCBzdHlsZWQgZm9yIHRoZSBHbHl4IGRhcmstYmx1ZSBhZXN0aGV0aWMuXG5cbi8qKlxuICogQ29udHJvbGxlZCBjaGVja2JveC5cbiAqXG4gKiBAcGFyYW0ge3sgY2hlY2tlZD86IGJvb2xlYW4sIG9uQ2hhbmdlPzogZnVuY3Rpb24sIGRpc2FibGVkPzogYm9vbGVhbixcbiAqICAgICAgICAgICBsYWJlbD86IHN0cmluZywgc3R5bGU/OiBvYmplY3QgfX0gcHJvcHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIENoZWNrYm94KHsgY2hlY2tlZCA9IGZhbHNlLCBvbkNoYW5nZSwgZGlzYWJsZWQgPSBmYWxzZSwgbGFiZWwsIHN0eWxlLCAuLi5yZXN0IH0pIHtcbiAgY29uc3QgU0laRSA9IDIwO1xuICBjb25zdCBhY3RpdmUgPSBjaGVja2VkICYmICFkaXNhYmxlZDtcbiAgY29uc3QgYm94ID0gUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7XG4gICAgc3R5bGU6IHtcbiAgICAgIHdpZHRoOiBTSVpFLCBoZWlnaHQ6IFNJWkUsXG4gICAgICBib3JkZXJXaWR0aDogMixcbiAgICAgIGJvcmRlckNvbG9yOiBkaXNhYmxlZCA/ICcjNTU1JyA6IChhY3RpdmUgPyAnIzdhYTJmNycgOiAnIzU1NScpLFxuICAgICAgYm9yZGVyUmFkaXVzOiA0LFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBhY3RpdmUgPyAnIzdhYTJmNycgOiAndHJhbnNwYXJlbnQnLFxuICAgICAganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLFxuICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXG4gICAgfSxcbiAgfSxcbiAgICAvLyBEcmF3IHRoZSBjaGVjayBpbmRpY2F0b3IgYXMgYSBzbWFsbCBpbm5lciBWaWV3IChubyBmb250IGRlcGVuZGVuY3kpLlxuICAgIGFjdGl2ZSA/IFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywge1xuICAgICAgc3R5bGU6IHsgd2lkdGg6IDEwLCBoZWlnaHQ6IDEwLCBiYWNrZ3JvdW5kQ29sb3I6ICcjMTcxOTIzJywgYm9yZGVyUmFkaXVzOiAyIH0sXG4gICAgfSkgOiBudWxsLFxuICApO1xuXG4gIGNvbnN0IGxibCA9IGxhYmVsICE9IG51bGxcbiAgICA/IFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGV4dCwgeyBzdHlsZTogeyBjb2xvcjogZGlzYWJsZWQgPyAnIzU1NScgOiAnI2U3ZWNmZicsIGZvbnRTaXplOiAxNCB9IH0sIFN0cmluZyhsYWJlbCkpXG4gICAgOiBudWxsO1xuXG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFByZXNzYWJsZSwge1xuICAgIG9uUHJlc3M6ICgpID0+IHsgaWYgKCFkaXNhYmxlZCAmJiBvbkNoYW5nZSkgb25DaGFuZ2UoIWNoZWNrZWQpOyB9LFxuICAgIHN0eWxlOiB7IGZsZXhEaXJlY3Rpb246ICdyb3cnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiA4LCAuLi5zdHlsZSB9LFxuICAgIC4uLnJlc3QsXG4gIH0sIGJveCwgbGJsKTtcbn1cblxuLyoqXG4gKiBUb2dnbGUgc3dpdGNoLlxuICpcbiAqIEBwYXJhbSB7eyB2YWx1ZT86IGJvb2xlYW4sIG9uVmFsdWVDaGFuZ2U/OiBmdW5jdGlvbiwgZGlzYWJsZWQ/OiBib29sZWFuLFxuICogICAgICAgICAgIHN0eWxlPzogb2JqZWN0IH19IHByb3BzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBTd2l0Y2goeyB2YWx1ZSA9IGZhbHNlLCBvblZhbHVlQ2hhbmdlLCBkaXNhYmxlZCA9IGZhbHNlLCBzdHlsZSwgLi4ucmVzdCB9KSB7XG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFByZXNzYWJsZSwge1xuICAgIG9uUHJlc3M6ICgpID0+IHsgaWYgKCFkaXNhYmxlZCAmJiBvblZhbHVlQ2hhbmdlKSBvblZhbHVlQ2hhbmdlKCF2YWx1ZSk7IH0sXG4gICAgc3R5bGU6IHtcbiAgICAgIHdpZHRoOiA0OCwgaGVpZ2h0OiAyNCxcbiAgICAgIGJhY2tncm91bmRDb2xvcjogZGlzYWJsZWQgPyAnIzMzMycgOiAodmFsdWUgPyAnIzdhYTJmNycgOiAnIzNjNDQ2NCcpLFxuICAgICAgYm9yZGVyUmFkaXVzOiAxMixcbiAgICAgIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJyxcbiAgICAgIGFsaWduSXRlbXM6IHZhbHVlID8gJ2ZsZXgtZW5kJyA6ICdmbGV4LXN0YXJ0JyxcbiAgICAgIHBhZGRpbmc6IDIsXG4gICAgICAuLi5zdHlsZSxcbiAgICB9LFxuICAgIC4uLnJlc3QsXG4gIH0sXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7XG4gICAgICBzdHlsZTogeyB3aWR0aDogMjAsIGhlaWdodDogMjAsIGJhY2tncm91bmRDb2xvcjogZGlzYWJsZWQgPyAnIzY2NicgOiAnI2ZmZicsIGJvcmRlclJhZGl1czogMTAgfSxcbiAgICB9KVxuICApO1xufVxuXG4vLyBDb250ZXh0IGZvciBSYWRpb0dyb3VwIFx1MjE5MiBSYWRpbyBjb21tdW5pY2F0aW9uLlxuY29uc3QgX1JhZGlvQ3R4ID0gUmVhY3QuY3JlYXRlQ29udGV4dChudWxsKTtcblxuLyoqXG4gKiBSYWRpbyBidXR0b24gZ3JvdXAgd3JhcHBlci4gUHJvdmlkZXMgY29udGV4dCBmb3IgY2hpbGQgUmFkaW8gY29tcG9uZW50cy5cbiAqXG4gKiBAcGFyYW0ge3sgdmFsdWU6IGFueSwgb25WYWx1ZUNoYW5nZT86IGZ1bmN0aW9uLCBjaGlsZHJlbiwgc3R5bGU/OiBvYmplY3QgfX0gcHJvcHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIFJhZGlvR3JvdXAoeyB2YWx1ZSwgb25WYWx1ZUNoYW5nZSwgY2hpbGRyZW4sIHN0eWxlLCAuLi5yZXN0IH0pIHtcbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXG4gICAgX1JhZGlvQ3R4LlByb3ZpZGVyLFxuICAgIHsgdmFsdWU6IHsgdmFsdWUsIG9uVmFsdWVDaGFuZ2UgfSB9LFxuICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywgeyBzdHlsZTogeyBnYXA6IDgsIC4uLnN0eWxlIH0sIC4uLnJlc3QgfSwgY2hpbGRyZW4pXG4gICk7XG59XG5cbi8qKlxuICogSW5kaXZpZHVhbCByYWRpbyBvcHRpb24uIE11c3QgYmUgYSBkZXNjZW5kYW50IG9mIFJhZGlvR3JvdXAuXG4gKlxuICogQHBhcmFtIHt7IHZhbHVlOiBhbnksIGxhYmVsPzogc3RyaW5nLCBkaXNhYmxlZD86IGJvb2xlYW4sIHN0eWxlPzogb2JqZWN0IH19IHByb3BzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBSYWRpbyh7IHZhbHVlLCBsYWJlbCwgZGlzYWJsZWQgPSBmYWxzZSwgc3R5bGUsIC4uLnJlc3QgfSkge1xuICBjb25zdCBjdHggICAgICA9IFJlYWN0LnVzZUNvbnRleHQoX1JhZGlvQ3R4KTtcbiAgY29uc3Qgc2VsZWN0ZWQgPSBjdHggIT0gbnVsbCAmJiBjdHgudmFsdWUgPT09IHZhbHVlO1xuICBjb25zdCByaW5nQ29sb3IgPSBkaXNhYmxlZCA/ICcjNTU1JyA6IChzZWxlY3RlZCA/ICcjN2FhMmY3JyA6ICcjNTU1Jyk7XG5cbiAgY29uc3QgY2lyY2xlID0gUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7XG4gICAgc3R5bGU6IHtcbiAgICAgIHdpZHRoOiAyMCwgaGVpZ2h0OiAyMCxcbiAgICAgIGJvcmRlcldpZHRoOiAyLFxuICAgICAgYm9yZGVyQ29sb3I6IHJpbmdDb2xvcixcbiAgICAgIGJvcmRlclJhZGl1czogMTAsXG4gICAgICBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXG4gICAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcbiAgICAgIGJhY2tncm91bmRDb2xvcjogJ3RyYW5zcGFyZW50JyxcbiAgICB9LFxuICB9LCBzZWxlY3RlZCA/IFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywge1xuICAgIHN0eWxlOiB7IHdpZHRoOiAxMCwgaGVpZ2h0OiAxMCwgYmFja2dyb3VuZENvbG9yOiBkaXNhYmxlZCA/ICcjNTU1JyA6ICcjN2FhMmY3JywgYm9yZGVyUmFkaXVzOiA1IH0sXG4gIH0pIDogbnVsbCk7XG5cbiAgY29uc3QgbGJsID0gbGFiZWwgIT0gbnVsbFxuICAgID8gUmVhY3QuY3JlYXRlRWxlbWVudChUZXh0LCB7IHN0eWxlOiB7IGNvbG9yOiBkaXNhYmxlZCA/ICcjNTU1JyA6ICcjZTdlY2ZmJywgZm9udFNpemU6IDE0IH0gfSwgU3RyaW5nKGxhYmVsKSlcbiAgICA6IG51bGw7XG5cbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoUHJlc3NhYmxlLCB7XG4gICAgb25QcmVzczogKCkgPT4geyBpZiAoIWRpc2FibGVkICYmIGN0eCAmJiBjdHgub25WYWx1ZUNoYW5nZSkgY3R4Lm9uVmFsdWVDaGFuZ2UodmFsdWUpOyB9LFxuICAgIHN0eWxlOiB7IGZsZXhEaXJlY3Rpb246ICdyb3cnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiA4LCAuLi5zdHlsZSB9LFxuICAgIC4uLnJlc3QsXG4gIH0sIGNpcmNsZSwgbGJsKTtcbn1cblxuLyoqXG4gKiBGaWxlIHBpY2tlciBidXR0b24uIE9wZW5zIHRoZSBPUyBmaWxlIGRpYWxvZyBhbmQgZmlyZXMgYG9uRmlsZXNTZWxlY3RlZGBcbiAqIHdpdGggYW4gYXJyYXkgb2Ygc2VsZWN0ZWQgYWJzb2x1dGUgcGF0aHMuXG4gKlxuICogUmVxdWlyZXMgYGRpYWxvZzogdHJ1ZWAgY2FwYWJpbGl0eSBpbiBnbHl4LmNvbmZpZy5qc29uLlxuICpcbiAqIGBhY2NlcHRgIGNvbnN0cmFpbnMgdGhlIG5hdGl2ZSBkaWFsb2cncyBmaWxlLXR5cGUgZmlsdGVyLiBUd28gZm9ybXM6XG4gKiAgIGFjY2VwdD1cIi5wbmcsLmpwZ1wiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjAxNCBleHRlbnNpb24gc2hvcnRoYW5kXG4gKiAgIGFjY2VwdD17W3sgbmFtZTogJ0ltYWdlcycsIGV4dGVuc2lvbnM6IFsncG5nJ10gfV19ICBcdTIwMTQgbmFtZWQgZmlsdGVyIGdyb3VwcyxcbiAqICAgICBzaG93biBhcyB0aGUgZHJvcGRvd24gbGFiZWxzIGluIHRoZSBPUyBkaWFsb2cgKGRpYWxvZy5vcGVuRmlsZSBzaGFwZSlcbiAqXG4gKiBAcGFyYW0ge3sgb25GaWxlc1NlbGVjdGVkPzogZnVuY3Rpb24sXG4gKiAgICAgICAgICAgYWNjZXB0Pzogc3RyaW5nIHwge25hbWU6c3RyaW5nLGV4dGVuc2lvbnM6c3RyaW5nW119W10sXG4gKiAgICAgICAgICAgbXVsdGlwbGU/OiBib29sZWFuLCBsYWJlbD86IHN0cmluZywgZGlzYWJsZWQ/OiBib29sZWFuLFxuICogICAgICAgICAgIHN0eWxlPzogb2JqZWN0IH19IHByb3BzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBGaWxlSW5wdXQoe1xuICBvbkZpbGVzU2VsZWN0ZWQsXG4gIGFjY2VwdCxcbiAgbXVsdGlwbGUgPSBmYWxzZSxcbiAgbGFiZWwgPSAnQnJvd3NlIGZpbGVzXHUyMDI2JyxcbiAgZGlzYWJsZWQgPSBmYWxzZSxcbiAgc3R5bGUsXG4gIC4uLnJlc3Rcbn0pIHtcbiAgY29uc3QgaGFuZGxlUHJlc3MgPSAoKSA9PiB7XG4gICAgaWYgKGRpc2FibGVkKSByZXR1cm47XG4gICAgbGV0IGZpbHRlcnMgPSBbXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShhY2NlcHQpKSB7XG4gICAgICBmaWx0ZXJzID0gYWNjZXB0OyAvLyBhbHJlYWR5IFt7IG5hbWUsIGV4dGVuc2lvbnMgfV1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBhY2NlcHQgPT09ICdzdHJpbmcnICYmIGFjY2VwdC50cmltKCkpIHtcbiAgICAgIGNvbnN0IGV4dGVuc2lvbnMgPSBhY2NlcHQuc3BsaXQoJywnKVxuICAgICAgICAubWFwKGUgPT4gZS50cmltKCkucmVwbGFjZSgvXlxcLi8sICcnKSlcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGlmIChleHRlbnNpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmlsdGVycyA9IFt7IG5hbWU6IGBBY2NlcHRlZCAoJHtleHRlbnNpb25zLm1hcChlID0+ICcuJyArIGUpLmpvaW4oJywgJyl9KWAsIGV4dGVuc2lvbnMgfV07XG4gICAgICB9XG4gICAgfVxuICAgIGRpYWxvZy5vcGVuRmlsZSh7IGZpbHRlcnMsIG11bHRpcGxlIH0pXG4gICAgICAudGhlbihwYXRocyA9PiB7XG4gICAgICAgIGlmIChwYXRocyAmJiBwYXRocy5sZW5ndGggPiAwICYmIG9uRmlsZXNTZWxlY3RlZCkgb25GaWxlc1NlbGVjdGVkKHBhdGhzKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZSA9PiBfX2dseXhfbG9nKCdbRmlsZUlucHV0XSBlcnJvcjogJyArIGUpKTtcbiAgfTtcblxuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChQcmVzc2FibGUsIHtcbiAgICBvblByZXNzOiBoYW5kbGVQcmVzcyxcbiAgICBzdHlsZToge1xuICAgICAgcGFkZGluZ1ZlcnRpY2FsOiA4LFxuICAgICAgcGFkZGluZ0hvcml6b250YWw6IDE0LFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBkaXNhYmxlZCA/ICcjMWYyMzMzJyA6ICcjMjYyYjNmJyxcbiAgICAgIGJvcmRlcldpZHRoOiAxLFxuICAgICAgYm9yZGVyQ29sb3I6IGRpc2FibGVkID8gJyMzYzQ0NjQnIDogJyM3YWEyZjcnLFxuICAgICAgYm9yZGVyUmFkaXVzOiA2LFxuICAgICAgZmxleERpcmVjdGlvbjogJ3JvdycsXG4gICAgICBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXG4gICAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcbiAgICAgIGZsZXhTaHJpbms6IDAsXG4gICAgICAuLi5zdHlsZSxcbiAgICB9LFxuICAgIC4uLnJlc3QsXG4gIH0sXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChUZXh0LCB7XG4gICAgICBzdHlsZTogeyBjb2xvcjogZGlzYWJsZWQgPyAnIzU1NScgOiAnIzdhYTJmNycsIGZvbnRTaXplOiAxNCB9LFxuICAgIH0sIGxhYmVsKVxuICApO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgRm9ybSBmaWVsZCBjb21wb25lbnRzIFx1MjAxNCBUaWVyIDIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gU2xpZGVyOiAgICBkcmFnZ2FibGUgdGh1bWIgYmFja2VkIGJ5IG5hdGl2ZSBkcmFnIGV2ZW50cy5cbi8vIFNlbGVjdDogICAgaW5saW5lLWV4cGFuZGFibGUgb3B0aW9uIGxpc3QgKGFjY29yZGlvbiBzdHlsZSkuXG4vLyBEYXRlUGlja2VyOiBpbmxpbmUgbW9udGggY2FsZW5kYXIuXG5cbi8qKlxuICogSG9yaXpvbnRhbCByYW5nZSBzbGlkZXIuXG4gKlxuICogQHBhcmFtIHt7IHZhbHVlPzogbnVtYmVyLCBvblZhbHVlQ2hhbmdlPzogZnVuY3Rpb24sXG4gKiAgICAgICAgICAgbWluPzogbnVtYmVyLCBtYXg/OiBudW1iZXIsIHN0ZXA/OiBudW1iZXIsXG4gKiAgICAgICAgICAgZGlzYWJsZWQ/OiBib29sZWFuLCBzdHlsZT86IG9iamVjdCB9fSBwcm9wc1xuICovXG5leHBvcnQgZnVuY3Rpb24gU2xpZGVyKHtcbiAgdmFsdWUgPSAwLCBvblZhbHVlQ2hhbmdlLCBvbkNoYW5nZSxcbiAgbWluID0gMCwgbWF4ID0gMSwgc3RlcCA9IDAsXG4gIGRpc2FibGVkID0gZmFsc2UsIHN0eWxlLFxuICB3aWR0aDogd2lkdGhQcm9wID0gMjAwLFxuICAuLi5yZXN0XG59KSB7XG4gIGNvbnN0IF9jYiA9IG9uVmFsdWVDaGFuZ2UgPz8gb25DaGFuZ2U7XG4gIGNvbnN0IFRIVU1CID0gMjA7XG4gIGNvbnN0IFRSQUNLID0gNDtcbiAgY29uc3QgYWNjZW50ID0gZGlzYWJsZWQgPyAnIzU1NScgOiAnIzdhYTJmNyc7XG5cbiAgLy8gVGhlIHJlbmRlcmVkIHdpZHRoIG1heSBjb21lIGZyb20gdGhlIGB3aWR0aGAgcHJvcCwgYHN0eWxlLndpZHRoYCwgb3IgZmxleCBcdTIwMTRcbiAgLy8gc28gbWVhc3VyZSB0aGUgQUNUVUFMIGxhaWQtb3V0IHdpZHRoIGFuZCBjb21wdXRlIGZpbGwvdGh1bWIgZnJvbSB0aGF0LlxuICAvLyBPdGhlcndpc2UgdGhlIHRodW1iIChzaXplZCBmcm9tIHdpZHRoUHJvcCkgYW5kIHRoZSBjbGljayBtYXBwaW5nIChmcm9tIHRoZVxuICAvLyByZWFsIHdpZHRoKSBkaXNhZ3JlZSwgYW5kIHRoZSBzbGlkZXIgZmVlbHMgYnJva2VuLlxuICBjb25zdCBzdHlsZVcgPSAoc3R5bGUgJiYgdHlwZW9mIHN0eWxlLndpZHRoID09PSAnbnVtYmVyJykgPyBzdHlsZS53aWR0aCA6IG51bGw7XG4gIGNvbnN0IFttZWFzdXJlZFcsIHNldE1lYXN1cmVkV10gPSB1c2VTdGF0ZShzdHlsZVcgPz8gd2lkdGhQcm9wKTtcbiAgY29uc3QgZWZmVyA9IG1lYXN1cmVkVyA+IDAgPyBtZWFzdXJlZFcgOiAoc3R5bGVXID8/IHdpZHRoUHJvcCk7XG5cbiAgY29uc3QgcGN0ICAgID0gbWF4ID09PSBtaW4gPyAwIDogTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgKE1hdGgubWluKG1heCwgTWF0aC5tYXgobWluLCB2YWx1ZSkpIC0gbWluKSAvIChtYXggLSBtaW4pKSk7XG4gIGNvbnN0IGZpbGxXICA9IE1hdGgubWF4KDAsIE1hdGgucm91bmQocGN0ICogKGVmZlcgLSBUSFVNQikpKTtcbiAgY29uc3QgcmlnaHRXID0gTWF0aC5tYXgoMCwgZWZmVyAtIFRIVU1CIC0gZmlsbFcpO1xuXG4gIC8vIE5hdGl2ZSBub2RlIElEIGZvciB0aGUgdHJhY2sgY29udGFpbmVyIFx1MjAxNCBkcmFnZ2FibGUgaXMgcmVnaXN0ZXJlZCBvbiBpdC5cbiAgY29uc3QgdHJhY2tOb2RlSWQgPSB1c2VSZWYobnVsbCk7XG5cbiAgLy8gQWx3YXlzLWN1cnJlbnQgcmVmcyBzbyB0aGUgc3RhYmxlIGRyYWcgaGFuZGxlciBuZXZlciBoYXMgc3RhbGUgY2xvc3VyZXMuXG4gIGNvbnN0IG1pblJlZiAgICAgID0gdXNlUmVmKG1pbik7ICAgbWluUmVmLmN1cnJlbnQgICAgICA9IG1pbjtcbiAgY29uc3QgbWF4UmVmICAgICAgPSB1c2VSZWYobWF4KTsgICBtYXhSZWYuY3VycmVudCAgICAgID0gbWF4O1xuICBjb25zdCBzdGVwUmVmICAgICA9IHVzZVJlZihzdGVwKTsgIHN0ZXBSZWYuY3VycmVudCAgICAgPSBzdGVwO1xuICBjb25zdCBkaXNhYmxlZFJlZiA9IHVzZVJlZihkaXNhYmxlZCk7IGRpc2FibGVkUmVmLmN1cnJlbnQgPSBkaXNhYmxlZDtcbiAgY29uc3Qgb25DaGFuZ2VSZWYgPSB1c2VSZWYoX2NiKTsgb25DaGFuZ2VSZWYuY3VycmVudCA9IF9jYjtcblxuICAvLyBTaGFyZWQgdXBkYXRlIGxvZ2ljOiBjb21wdXRlIHZhbHVlIGZyb20gYWJzb2x1dGUgY3Vyc29yIHggcG9zaXRpb24uXG4gIC8vIFVzaW5nIGFic29sdXRlIHggKG5vdCBkZWx0YSkgbWVhbnMgZWFjaCBkcmFnTW92ZSBpcyBpbmRlcGVuZGVudCBcdTIwMTQgbm9cbiAgLy8gYWNjdW11bGF0aW9uIGlzc3VlIHdpdGggc3RlcHBlZCBzbGlkZXJzLCBhbmQgY2xpY2tpbmcgdGhlIHJhaWwgd29ya3MgdG9vLlxuICBjb25zdCB1cGRhdGVGcm9tWCA9IHVzZUNhbGxiYWNrKCh4KSA9PiB7XG4gICAgaWYgKGRpc2FibGVkUmVmLmN1cnJlbnQgfHwgIW9uQ2hhbmdlUmVmLmN1cnJlbnQpIHJldHVybjtcbiAgICBjb25zdCBsYXlvdXQgPSBfX2dseXhfZ2V0TGF5b3V0KHRyYWNrTm9kZUlkLmN1cnJlbnQpO1xuICAgIGlmICghbGF5b3V0IHx8IGxheW91dC53aWR0aCA8PSAwKSByZXR1cm47XG4gICAgY29uc3QgcmFuZ2UgPSBtYXhSZWYuY3VycmVudCAtIG1pblJlZi5jdXJyZW50O1xuICAgIGNvbnN0IGZyYWMgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCAoeCAtIGxheW91dC54KSAvIGxheW91dC53aWR0aCkpO1xuICAgIGxldCB2ID0gbWluUmVmLmN1cnJlbnQgKyBmcmFjICogcmFuZ2U7XG4gICAgY29uc3QgcyA9IHN0ZXBSZWYuY3VycmVudDtcbiAgICBpZiAocyA+IDApIHYgPSBNYXRoLnJvdW5kKHYgLyBzKSAqIHM7XG4gICAgb25DaGFuZ2VSZWYuY3VycmVudCh2KTtcbiAgfSwgW10pO1xuXG4gIC8vIFJlZ2lzdGVyIHRoZSB0cmFjayBhcyBCT1RIIGRyYWdnYWJsZSAoY29udGludW91cyBkcmFnKSBhbmQgcHJlc3NhYmxlIChwbGFpblxuICAvLyBjbGlja3MgXHUyMDE0IGEgdGFwIGhhcyBubyBkcmFnLW1vdmVtZW50IHRocmVzaG9sZCwgc28gd2l0aG91dCB0aGlzLCBjbGlja2luZyB0aGVcbiAgLy8gcmFpbCB3b3VsZG4ndCBtb3ZlIHRoZSB0aHVtYikuIEJvdGggcGF0aHMgZmVlZCB0aGUgc2FtZSB1cGRhdGVGcm9tWCh4KS5cbiAgY29uc3QgbWVhc3VyZVdpZHRoID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGNvbnN0IGlkID0gdHJhY2tOb2RlSWQuY3VycmVudDtcbiAgICBpZiAoaWQgPT0gbnVsbCB8fCB0eXBlb2YgX19nbHl4X2dldExheW91dCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICBjb25zdCBsID0gX19nbHl4X2dldExheW91dChpZCk7XG4gICAgaWYgKGwgJiYgbC53aWR0aCA+IDApIHNldE1lYXN1cmVkVygocHJldikgPT4gKE1hdGguYWJzKGwud2lkdGggLSBwcmV2KSA+IDAuNSA/IGwud2lkdGggOiBwcmV2KSk7XG4gIH0sIFtdKTtcblxuICBjb25zdCBvblRyYWNrTW91bnQgPSB1c2VDYWxsYmFjaygoaWQpID0+IHtcbiAgICB0cmFja05vZGVJZC5jdXJyZW50ID0gaWQ7XG4gICAgcmVnaXN0ZXJEcmFnZ2FibGUoaWQsIHtcbiAgICAgIG9uRHJhZ1N0YXJ0KHsgeCB9KSB7IHVwZGF0ZUZyb21YKHgpOyB9LFxuICAgICAgb25EcmFnTW92ZSh7IHggfSkgIHsgdXBkYXRlRnJvbVgoeCk7IH0sXG4gICAgfSk7XG4gICAgcmVnaXN0ZXJQcmVzc2FibGUoaWQsIHtcbiAgICAgIG9uUHJlc3MoeyB4IH0pIHsgdXBkYXRlRnJvbVgoeCk7IH0sXG4gICAgICBvblByZXNzSW4oKSB7fSwgb25QcmVzc091dCgpIHt9LCBvbkhvdmVySW4oKSB7fSwgb25Ib3Zlck91dCgpIHt9LFxuICAgIH0pO1xuICAgIHNldFRpbWVvdXQobWVhc3VyZVdpZHRoLCAwKTsgLy8gbWVhc3VyZSBhZnRlciB0aGUgZmlyc3QgbmF0aXZlIGxheW91dCBwYXNzXG4gIH0sIFtdKTsgLy8gc3RhYmxlIFx1MjAxNCB1cGRhdGVGcm9tWCBhbmQgYWxsIHJlZnMgYXJlIHN0YWJsZVxuXG4gIC8vIFJlLW1lYXN1cmUgZWFjaCByZW5kZXIgKGNoZWFwLCBndWFyZGVkKSBzbyB0aGUgZmlsbCB0cmFja3MgdGhlIHJlYWwgd2lkdGhcbiAgLy8gYWZ0ZXIgc3R5bGUvZmxleC9yZXNpemUgY2hhbmdlcy5cbiAgdXNlRWZmZWN0KCgpID0+IHsgbWVhc3VyZVdpZHRoKCk7IH0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmICh0cmFja05vZGVJZC5jdXJyZW50ICE9PSBudWxsKSB7XG4gICAgICAgIHVucmVnaXN0ZXJEcmFnZ2FibGUodHJhY2tOb2RlSWQuY3VycmVudCk7XG4gICAgICAgIHVucmVnaXN0ZXJQcmVzc2FibGUodHJhY2tOb2RlSWQuY3VycmVudCk7XG4gICAgICB9XG4gICAgfTtcbiAgfSwgW10pO1xuXG4gIC8vIEV4cGxpY2l0IHBpeGVsIHdpZHRocyBmb3IgYWxsIHRocmVlIHBpZWNlcyBzbyBUYWZmeSB1cGRhdGVzIGNvcnJlY3RseS5cbiAgLy8gVGhlIGNvbnRhaW5lciBpcyByZWdpc3RlcmVkIGFzIGRyYWdnYWJsZSBcdTIwMTQgY2xpY2tpbmcgYW55d2hlcmUgb24gdGhlIHJhaWxcbiAgLy8gKGluY2x1ZGluZyB0aGUgdGh1bWIgYXJlYSkgZmlyZXMgdXBkYXRlRnJvbVguXG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFZpZXcsIHtcbiAgICBfZ2x5eE9uTW91bnQ6IG9uVHJhY2tNb3VudCxcbiAgICB3aWR0aDogd2lkdGhQcm9wLFxuICAgIHByZXNzYWJsZTogdHJ1ZSwgLy8gbWFyayBpbnRlcmFjdGl2ZSBzbyBjbGlja3MgaGl0LXRlc3QgdG8gdGhpcyBub2RlXG4gICAgc3R5bGU6IHsgZmxleERpcmVjdGlvbjogJ3JvdycsIGFsaWduSXRlbXM6ICdjZW50ZXInLCAuLi5zdHlsZSB9LFxuICAgIC4uLnJlc3QsXG4gIH0sXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7IHdpZHRoOiBmaWxsVywgIGhlaWdodDogVFJBQ0ssIHN0eWxlOiB7IGJhY2tncm91bmRDb2xvcjogYWNjZW50IH0gfSksXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7IHdpZHRoOiBUSFVNQiwgIGhlaWdodDogVEhVTUIsIHN0eWxlOiB7IGJvcmRlclJhZGl1czogVEhVTUIgLyAyLCBiYWNrZ3JvdW5kQ29sb3I6IGFjY2VudCB9IH0pLFxuICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywgeyB3aWR0aDogcmlnaHRXLCBoZWlnaHQ6IFRSQUNLLCBzdHlsZTogeyBiYWNrZ3JvdW5kQ29sb3I6ICcjM2M0NDY0JyB9IH0pLFxuICApO1xufVxuXG4vLyBPbmUgb3B0aW9uIHJvdyBpbiBhIFNlbGVjdCBkcm9wZG93biBcdTIwMTQgaG92ZXIgaGlnaGxpZ2h0ICsgc2VsZWN0ZWQgc3RhdGUgKyBjaGVjay5cbmZ1bmN0aW9uIF9TZWxlY3RPcHRpb24oeyBsYWJlbCwgc2VsZWN0ZWQsIG9uU2VsZWN0LCBDIH0pIHtcbiAgY29uc3QgW2hvdmVyLCBzZXRIb3Zlcl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFByZXNzYWJsZSwge1xuICAgIG9uUHJlc3M6IG9uU2VsZWN0LFxuICAgIG9uSG92ZXJJbjogICgpID0+IHNldEhvdmVyKHRydWUpLFxuICAgIG9uSG92ZXJPdXQ6ICgpID0+IHNldEhvdmVyKGZhbHNlKSxcbiAgICBoZWlnaHQ6IDQwLFxuICAgIHN0eWxlOiB7XG4gICAgICBhbGlnblNlbGY6ICdzdHJldGNoJywgICAvLyBmaWxsIHRoZSBmdWxsIHBvcHVwIHdpZHRoIHNvIGhvdmVyIHNwYW5zIHRoZSByb3dcbiAgICAgIGZsZXhEaXJlY3Rpb246ICdyb3cnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJyxcbiAgICAgIHBhZGRpbmdMZWZ0OiAxMiwgcGFkZGluZ1JpZ2h0OiAxMixcbiAgICAgIGJhY2tncm91bmRDb2xvcjogc2VsZWN0ZWQgPyBDLm9wdGlvblNlbGVjdGVkQmcgOiAoaG92ZXIgPyBDLm9wdGlvbkhvdmVyQmcgOiAndHJhbnNwYXJlbnQnKSxcbiAgICB9LFxuICB9LFxuICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGV4dCwgeyBoZWlnaHQ6IDE4LCBzdHlsZTogeyBjb2xvcjogc2VsZWN0ZWQgPyBDLm9wdGlvblNlbGVjdGVkVGV4dCA6IEMub3B0aW9uVGV4dCwgZm9udFNpemU6IDE0IH0gfSwgbGFiZWwpLFxuICAgIHNlbGVjdGVkID8gUmVhY3QuY3JlYXRlRWxlbWVudChUZXh0LCB7IHdpZHRoOiAxNCwgaGVpZ2h0OiAxNiwgc3R5bGU6IHsgY29sb3I6IEMub3B0aW9uQ2hlY2ssIGZvbnRTaXplOiAxMyB9IH0sICdcdTI3MTMnKSA6IG51bGwsXG4gICk7XG59XG5cbi8qKlxuICogSW5saW5lLWV4cGFuZGFibGUgc2VsZWN0IChhY2NvcmRpb24gc3R5bGUgXHUyMDE0IG5vIGFic29sdXRlIHBvc2l0aW9uaW5nIG5lZWRlZCkuXG4gKlxuICogQHBhcmFtIHt7IHZhbHVlPzogYW55LCBvcHRpb25zPzoge2xhYmVsOnN0cmluZyx2YWx1ZTphbnl9W10sXG4gKiAgICAgICAgICAgb25WYWx1ZUNoYW5nZT86IGZ1bmN0aW9uLCBkaXNhYmxlZD86IGJvb2xlYW4sXG4gKiAgICAgICAgICAgcGxhY2Vob2xkZXI/OiBzdHJpbmcsIHN0eWxlPzogb2JqZWN0IH19IHByb3BzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBTZWxlY3Qoe1xuICB2YWx1ZSwgb3B0aW9ucyA9IFtdLCBvblZhbHVlQ2hhbmdlLFxuICBkaXNhYmxlZCA9IGZhbHNlLCBwbGFjZWhvbGRlciA9ICdTZWxlY3RcdTIwMjYnLCBzdHlsZSxcbiAgLi4ucmVzdFxufSkge1xuICBjb25zdCBDICAgID0gUmVhY3QudXNlQ29udGV4dChTZWxlY3RDb2xvcnNDb250ZXh0KTtcbiAgY29uc3QgW29wZW4sIHNldE9wZW5dID0gUmVhY3QudXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBzZWxlY3RlZCA9IG9wdGlvbnMuZmluZChvID0+IG8udmFsdWUgPT09IHZhbHVlKTtcbiAgY29uc3QgY29udGFpbmVyTm9kZUlkID0gdXNlUmVmKG51bGwpO1xuICBjb25zdCBwb3BvdmVySWQgPSB1c2VSZWYobnVsbCk7XG4gIGNvbnN0IG9uQ29udGFpbmVyTW91bnQgPSB1c2VDYWxsYmFjaygoaWQpID0+IHsgY29udGFpbmVyTm9kZUlkLmN1cnJlbnQgPSBpZDsgfSwgW10pO1xuXG4gIGNvbnN0IE9QVElPTl9IID0gNDA7XG4gIGNvbnN0IGNsb3NlID0gKCkgPT4geyBpZiAocG9wb3ZlcklkLmN1cnJlbnQgIT0gbnVsbCkgeyBjbG9zZVBvcG92ZXIocG9wb3ZlcklkLmN1cnJlbnQpOyBwb3BvdmVySWQuY3VycmVudCA9IG51bGw7IH0gfTtcblxuICBjb25zdCB0b2dnbGUgPSAoKSA9PiB7XG4gICAgaWYgKGRpc2FibGVkKSByZXR1cm47XG4gICAgaWYgKG9wZW4pIHsgY2xvc2UoKTsgcmV0dXJuOyB9XG4gICAgY29uc3QgbCA9ICh0eXBlb2YgX19nbHl4X2dldExheW91dCAhPT0gJ3VuZGVmaW5lZCcpID8gX19nbHl4X2dldExheW91dChjb250YWluZXJOb2RlSWQuY3VycmVudCkgOiBudWxsO1xuICAgIGlmICghbCkgcmV0dXJuO1xuICAgIGNvbnN0IGN3ID0gbC53aWR0aDtcbiAgICBjb25zdCBkcm9wSCA9IE1hdGgubWluKG9wdGlvbnMubGVuZ3RoICogT1BUSU9OX0gsIDI4MCk7XG4gICAgc2V0T3Blbih0cnVlKTtcbiAgICBwb3BvdmVySWQuY3VycmVudCA9IG9wZW5Qb3BvdmVyKHtcbiAgICAgIHg6IGwueCwgeTogbC55LCBoOiBsLmhlaWdodCwgd2lkdGg6IGN3LCBjb250ZW50SDogZHJvcEggKyAyLFxuICAgICAgb25DbG9zZTogKCkgPT4geyBwb3BvdmVySWQuY3VycmVudCA9IG51bGw7IHNldE9wZW4oZmFsc2UpOyB9LFxuICAgICAgcmVuZGVyOiAoKSA9PiBSZWFjdC5jcmVhdGVFbGVtZW50KFNlbGVjdENvbG9yc1Byb3ZpZGVyLCB7IGNvbG9yczogQyB9LFxuICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFxuICAgICAgICAgIFNjcm9sbFZpZXcsXG4gICAgICAgICAgeyB3aWR0aDogY3csIGhlaWdodDogZHJvcEgsIGNvbnRlbnRIZWlnaHQ6IG9wdGlvbnMubGVuZ3RoICogT1BUSU9OX0gsXG4gICAgICAgICAgICBzdHlsZTogeyBiYWNrZ3JvdW5kQ29sb3I6IEMuZHJvcGRvd25CZywgYm9yZGVyUmFkaXVzOiA4LCBib3JkZXJXaWR0aDogMSwgYm9yZGVyQ29sb3I6IEMuZHJvcGRvd25Cb3JkZXIgfSB9LFxuICAgICAgICAgIC4uLm9wdGlvbnMubWFwKChvcHQsIGkpID0+IFJlYWN0LmNyZWF0ZUVsZW1lbnQoX1NlbGVjdE9wdGlvbiwge1xuICAgICAgICAgICAga2V5OiBTdHJpbmcoaSksXG4gICAgICAgICAgICBsYWJlbDogb3B0LmxhYmVsLFxuICAgICAgICAgICAgc2VsZWN0ZWQ6IG9wdC52YWx1ZSA9PT0gdmFsdWUsXG4gICAgICAgICAgICBvblNlbGVjdDogKCkgPT4geyBvblZhbHVlQ2hhbmdlPy4ob3B0LnZhbHVlKTsgY2xvc2UoKTsgfSxcbiAgICAgICAgICAgIEMsXG4gICAgICAgICAgfSkpLFxuICAgICAgICApLFxuICAgICAgKSxcbiAgICB9KTtcbiAgfTtcblxuICAvLyBDbG9zZSB0aGUgZmxvYXRpbmcgbGlzdCBpZiB0aGUgU2VsZWN0IHVubW91bnRzIHdoaWxlIG9wZW4uXG4gIHVzZUVmZmVjdCgoKSA9PiAoKSA9PiBjbG9zZSgpLCBbXSk7XG5cbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywge1xuICAgIF9nbHl4T25Nb3VudDogb25Db250YWluZXJNb3VudCxcbiAgICAvLyBEZWZhdWx0IHRvIGEgc2Vuc2libGUgd2lkdGggKG5vdCBmdWxsLXdpbmRvdykuIGFsaWduU2VsZjpmbGV4LXN0YXJ0IHN0b3BzXG4gICAgLy8gdGhlIHBhcmVudCdzIGRlZmF1bHQgYGFsaWduSXRlbXM6IHN0cmV0Y2hgIGZyb20gZXhwYW5kaW5nIGl0LiBVc2VyIGBzdHlsZWBcbiAgICAvLyAoaW5jbC4gd2lkdGgpIG92ZXJyaWRlcy5cbiAgICBzdHlsZTogX3NpemVkUm9vdFN0eWxlKHN0eWxlLCAyNDApLFxuICAgIC4uLnJlc3QsXG4gIH0sXG4gICAgLy8gVHJpZ2dlciBidXR0b24gXHUyMDE0IGZpeGVkIGhlaWdodCBzbyB0ZXh0IG5ldmVyIG92ZXJmbG93cy5cbiAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFByZXNzYWJsZSwge1xuICAgICAgb25QcmVzczogdG9nZ2xlLFxuICAgICAgc3R5bGU6IHtcbiAgICAgICAgZmxleERpcmVjdGlvbjogJ3JvdycsXG4gICAgICAgIGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsXG4gICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxuICAgICAgICBwYWRkaW5nTGVmdDogMTIsXG4gICAgICAgIHBhZGRpbmdSaWdodDogMTAsXG4gICAgICAgIGhlaWdodDogNDAsXG4gICAgICAgIGJvcmRlclJhZGl1czogOCxcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiBkaXNhYmxlZCA/IEMudHJpZ2dlckJnRGlzYWJsZWQgOiBDLnRyaWdnZXJCZyxcbiAgICAgICAgYm9yZGVyV2lkdGg6IDEsXG4gICAgICAgIGJvcmRlckNvbG9yOiBvcGVuID8gQy50cmlnZ2VyQm9yZGVyRm9jdXMgOiBDLnRyaWdnZXJCb3JkZXIsXG4gICAgICAgIGNsaXA6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgICAvLyBMYWJlbCBhdXRvLXNpemVzOyB0cmlnZ2VyIGNsaXA6dHJ1ZSBwcmV2ZW50cyBvdmVyZmxvdyBwYXN0IHRoZSBhcnJvdy5cbiAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGV4dCwge1xuICAgICAgICBoZWlnaHQ6IDIwLFxuICAgICAgICBzdHlsZTogeyBjb2xvcjogc2VsZWN0ZWQgPyBDLnRyaWdnZXJUZXh0IDogQy50cmlnZ2VyUGxhY2Vob2xkZXIsIGZvbnRTaXplOiAxNCB9LFxuICAgICAgfSwgc2VsZWN0ZWQgPyBzZWxlY3RlZC5sYWJlbCA6IHBsYWNlaG9sZGVyKSxcbiAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGV4dCwge1xuICAgICAgICBzdHlsZTogeyBjb2xvcjogQy5jaGV2cm9uLCBmb250U2l6ZTogMTEgfSxcbiAgICAgICAgd2lkdGg6IDE2LCBoZWlnaHQ6IDE2LFxuICAgICAgfSwgb3BlbiA/ICdcdTI1QjInIDogJ1x1MjVCQycpLFxuICAgICksXG4gICk7XG59XG5cbi8vIFNlbGYtY29udGFpbmVkIG1vbnRoIGNhbGVuZGFyIFx1MjAxNCBvd25zIGl0cyB2aWV3IG1vbnRoL3llYXIgc28gdGhlIHByZXYvbmV4dFxuLy8gYXJyb3dzIHJlLXJlbmRlciBpdCBpbiBwbGFjZSBpbnNpZGUgdGhlIHBvcG92ZXIgbGF5ZXIuXG4vLyBIb3Zlci1oaWdobGlnaHRlZCBzZWxlY3RhYmxlIGNlbGwgXHUyMDE0IHNoYXJlZCBieSBjYWxlbmRhciBkYXlzIGFuZCB0aW1lXG4vLyBjb2x1bW5zLiAgVXNlcyBhbiBleHBsaWNpdCBob3ZlciBiYWNrZ3JvdW5kIChQcmVzc2FibGUncyBvcGFjaXR5IGZlZWRiYWNrXG4vLyBpcyBpbnZpc2libGUgb24gdHJhbnNwYXJlbnQgYmFja2dyb3VuZHMpLlxuZnVuY3Rpb24gX0hvdmVyQ2VsbCh7IHNlbGVjdGVkLCBvblByZXNzLCB3ID0gMzYsIGggPSAzMiwgZm9udFNpemUgPSAxMywgY2hpbGRyZW4gfSkge1xuICBjb25zdCBDID0gUmVhY3QudXNlQ29udGV4dChTZWxlY3RDb2xvcnNDb250ZXh0KTtcbiAgY29uc3QgW2hvdiwgc2V0SG92XSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoUHJlc3NhYmxlLCB7XG4gICAgb25QcmVzcyxcbiAgICBmZWVkYmFjazogZmFsc2UsXG4gICAgb25Ib3ZlckluOiAgKCkgPT4gc2V0SG92KHRydWUpLFxuICAgIG9uSG92ZXJPdXQ6ICgpID0+IHNldEhvdihmYWxzZSksXG4gICAgd2lkdGg6IHcsIGhlaWdodDogaCxcbiAgICBzdHlsZToge1xuICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJywgYm9yZGVyUmFkaXVzOiA0LFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBzZWxlY3RlZCA/IEMuY2FsQ2VsbFNlbGVjdGVkQmcgOiBob3YgPyBDLm9wdGlvbkhvdmVyQmcgOiAndHJhbnNwYXJlbnQnLFxuICAgIH0sXG4gIH0sXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChUZXh0LCB7XG4gICAgICBoZWlnaHQ6IE1hdGgucm91bmQoZm9udFNpemUgKiAxLjQpLFxuICAgICAgc3R5bGU6IHsgY29sb3I6IHNlbGVjdGVkID8gQy5jYWxDZWxsU2VsZWN0ZWRUZXh0IDogQy5vcHRpb25UZXh0LCBmb250U2l6ZSwgdGV4dEFsaWduOiAnY2VudGVyJyB9LFxuICAgIH0sIGNoaWxkcmVuKVxuICApO1xufVxuXG4vLyBTbWFsbCBob3ZlcmFibGUgYXJyb3cgYnV0dG9uIHVzZWQgaW4gdGhlIGNhbGVuZGFyIGhlYWRlci5cbmZ1bmN0aW9uIF9DYWxBcnJvdyh7IG9uUHJlc3MsIGNoaWxkcmVuIH0pIHtcbiAgY29uc3QgQyA9IFJlYWN0LnVzZUNvbnRleHQoU2VsZWN0Q29sb3JzQ29udGV4dCk7XG4gIGNvbnN0IFtob3YsIHNldEhvdl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFByZXNzYWJsZSwge1xuICAgIG9uUHJlc3MsIGZlZWRiYWNrOiBmYWxzZSxcbiAgICBvbkhvdmVySW46ICgpID0+IHNldEhvdih0cnVlKSwgb25Ib3Zlck91dDogKCkgPT4gc2V0SG92KGZhbHNlKSxcbiAgICB3aWR0aDogMjgsIGhlaWdodDogMjgsXG4gICAgc3R5bGU6IHsganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgYm9yZGVyUmFkaXVzOiA0LCBiYWNrZ3JvdW5kQ29sb3I6IGhvdiA/IEMub3B0aW9uSG92ZXJCZyA6ICd0cmFuc3BhcmVudCcgfSxcbiAgfSwgUmVhY3QuY3JlYXRlRWxlbWVudChUZXh0LCB7IGhlaWdodDogMjIsIHN0eWxlOiB7IGNvbG9yOiBDLmNoZXZyb24sIGZvbnRTaXplOiAxOCB9IH0sIGNoaWxkcmVuKSk7XG59XG5cbmZ1bmN0aW9uIF9DYWxlbmRhcih7IHZhbHVlLCBvblNlbGVjdCB9KSB7XG4gIGNvbnN0IGJhc2UgPSB2YWx1ZSA/IG5ldyBEYXRlKHZhbHVlKSA6IG5ldyBEYXRlKCk7XG4gIGNvbnN0IFt2aWV3WWVhciwgc2V0Vmlld1llYXJdICAgPSB1c2VTdGF0ZShiYXNlLmdldEZ1bGxZZWFyKCkpO1xuICBjb25zdCBbdmlld01vbnRoLCBzZXRWaWV3TW9udGhdID0gdXNlU3RhdGUoYmFzZS5nZXRNb250aCgpKTtcbiAgLy8gJ2RheXMnIHwgJ21vbnRocycgfCAneWVhcnMnXG4gIGNvbnN0IFttb2RlLCBzZXRNb2RlXSA9IHVzZVN0YXRlKCdkYXlzJyk7XG4gIC8vIGFuY2hvciB5ZWFyIGZvciB0aGUgMTIteWVhciBncmlkIHNob3duIGluIHllYXIgbW9kZVxuICBjb25zdCBbeWVhckJhc2UsIHNldFllYXJCYXNlXSA9IHVzZVN0YXRlKCgpID0+IE1hdGguZmxvb3IoYmFzZS5nZXRGdWxsWWVhcigpIC8gMTIpICogMTIpO1xuXG4gIGNvbnN0IG1vbnRoTmFtZXMgPSBbJ0phbnVhcnknLCdGZWJydWFyeScsJ01hcmNoJywnQXByaWwnLCdNYXknLCdKdW5lJyxcbiAgICAgICAgICAgICAgICAgICAgICAnSnVseScsJ0F1Z3VzdCcsJ1NlcHRlbWJlcicsJ09jdG9iZXInLCdOb3ZlbWJlcicsJ0RlY2VtYmVyJ107XG4gIGNvbnN0IG1vbnRoU2hvcnQgPSBbJ0phbicsJ0ZlYicsJ01hcicsJ0FwcicsJ01heScsJ0p1bicsJ0p1bCcsJ0F1ZycsJ1NlcCcsJ09jdCcsJ05vdicsJ0RlYyddO1xuICBjb25zdCBkYXlOYW1lcyA9IFsnU3UnLCdNbycsJ1R1JywnV2UnLCdUaCcsJ0ZyJywnU2EnXTtcblxuICBjb25zdCBmaXJzdERvdyAgICA9IG5ldyBEYXRlKHZpZXdZZWFyLCB2aWV3TW9udGgsIDEpLmdldERheSgpO1xuICBjb25zdCBkYXlzSW5Nb250aCA9IG5ldyBEYXRlKHZpZXdZZWFyLCB2aWV3TW9udGggKyAxLCAwKS5nZXREYXRlKCk7XG4gIGNvbnN0IGNlbGxzID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZmlyc3REb3c7IGkrKykgY2VsbHMucHVzaChudWxsKTtcbiAgZm9yIChsZXQgZCA9IDE7IGQgPD0gZGF5c0luTW9udGg7IGQrKykgY2VsbHMucHVzaChkKTtcbiAgY29uc3Qgcm93cyA9IEFycmF5LmZyb20oeyBsZW5ndGg6IE1hdGguY2VpbChjZWxscy5sZW5ndGggLyA3KSB9LCAoXywgcikgPT4gY2VsbHMuc2xpY2UociAqIDcsIHIgKiA3ICsgNykpO1xuXG4gIGNvbnN0IHByZXZNb250aCA9ICgpID0+IHsgaWYgKHZpZXdNb250aCA9PT0gMCkgeyBzZXRWaWV3TW9udGgoMTEpOyBzZXRWaWV3WWVhcih5ID0+IHkgLSAxKTsgfSBlbHNlIHNldFZpZXdNb250aChtID0+IG0gLSAxKTsgfTtcbiAgY29uc3QgbmV4dE1vbnRoID0gKCkgPT4geyBpZiAodmlld01vbnRoID09PSAxMSkgeyBzZXRWaWV3TW9udGgoMCk7IHNldFZpZXdZZWFyKHkgPT4geSArIDEpOyB9IGVsc2Ugc2V0Vmlld01vbnRoKG0gPT4gbSArIDEpOyB9O1xuXG4gIGNvbnN0IENFTExfVyA9IDM2LCBDRUxMX0ggPSAzMiwgQ0FMX1cgPSBDRUxMX1cgKiA3O1xuICBjb25zdCBzZWwgPSB2YWx1ZSA/IG5ldyBEYXRlKHZhbHVlKSA6IG51bGw7XG5cbiAgLy8gLS0tIGhlYWRlciBsYWJlbCBob3ZlciAtLS1cbiAgY29uc3QgW2xhYmVsSG92LCBzZXRMYWJlbEhvdl0gPSB1c2VTdGF0ZShmYWxzZSk7XG5cbiAgLy8gLS0tIG1vbnRoIHBpY2tlciBncmlkIC0tLVxuICBjb25zdCByZW5kZXJNb250aHMgPSAoKSA9PiB7XG4gICAgY29uc3QgTUNXID0gTWF0aC5mbG9vcihDQUxfVyAvIDMpLCBNQ0ggPSAzNjtcbiAgICBjb25zdCBtcm93cyA9IFtbMCwxLDJdLFszLDQsNV0sWzYsNyw4XSxbOSwxMCwxMV1dO1xuICAgIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFZpZXcsIHsgd2lkdGg6IENBTF9XIH0sXG4gICAgICBtcm93cy5tYXAoKHJvdywgcmkpID0+IFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywge1xuICAgICAgICBrZXk6IHJpLCB3aWR0aDogQ0FMX1csIGhlaWdodDogTUNILFxuICAgICAgICBzdHlsZTogeyBmbGV4RGlyZWN0aW9uOiAncm93JyB9LFxuICAgICAgfSxcbiAgICAgICAgcm93Lm1hcChtID0+IFJlYWN0LmNyZWF0ZUVsZW1lbnQoX0hvdmVyQ2VsbCwge1xuICAgICAgICAgIGtleTogbSwgc2VsZWN0ZWQ6IG0gPT09IHZpZXdNb250aCwgb25QcmVzczogKCkgPT4geyBzZXRWaWV3TW9udGgobSk7IHNldE1vZGUoJ2RheXMnKTsgfSxcbiAgICAgICAgICB3OiBNQ1csIGg6IE1DSCwgZm9udFNpemU6IDEyLFxuICAgICAgICB9LCBtb250aFNob3J0W21dKSlcbiAgICAgICkpXG4gICAgKTtcbiAgfTtcblxuICAvLyAtLS0geWVhciBwaWNrZXIgZ3JpZCAoMTIgeWVhcnMpIC0tLVxuICBjb25zdCByZW5kZXJZZWFycyA9ICgpID0+IHtcbiAgICBjb25zdCBZQ1cgPSBNYXRoLmZsb29yKENBTF9XIC8gNCksIFlDSCA9IDM2O1xuICAgIGNvbnN0IHllYXJzID0gQXJyYXkuZnJvbSh7IGxlbmd0aDogMTIgfSwgKF8sIGkpID0+IHllYXJCYXNlICsgaSk7XG4gICAgY29uc3QgeXJvd3MgPSBbWzAsMSwyLDNdLFs0LDUsNiw3XSxbOCw5LDEwLDExXV07XG4gICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywgeyB3aWR0aDogQ0FMX1cgfSxcbiAgICAgIHlyb3dzLm1hcCgocm93LCByaSkgPT4gUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7XG4gICAgICAgIGtleTogcmksIHdpZHRoOiBDQUxfVywgaGVpZ2h0OiBZQ0gsXG4gICAgICAgIHN0eWxlOiB7IGZsZXhEaXJlY3Rpb246ICdyb3cnIH0sXG4gICAgICB9LFxuICAgICAgICByb3cubWFwKGkgPT4gUmVhY3QuY3JlYXRlRWxlbWVudChfSG92ZXJDZWxsLCB7XG4gICAgICAgICAga2V5OiBpLCBzZWxlY3RlZDogeWVhcnNbaV0gPT09IHZpZXdZZWFyLCBvblByZXNzOiAoKSA9PiB7IHNldFZpZXdZZWFyKHllYXJzW2ldKTsgc2V0TW9kZSgnbW9udGhzJyk7IH0sXG4gICAgICAgICAgdzogWUNXLCBoOiBZQ0gsIGZvbnRTaXplOiAxMixcbiAgICAgICAgfSwgU3RyaW5nKHllYXJzW2ldKSkpXG4gICAgICApKVxuICAgICk7XG4gIH07XG5cbiAgY29uc3Qgb25QcmV2ID0gKCkgPT4ge1xuICAgIGlmIChtb2RlID09PSAnZGF5cycpIHByZXZNb250aCgpO1xuICAgIGVsc2UgaWYgKG1vZGUgPT09ICdtb250aHMnKSBzZXRWaWV3WWVhcih5ID0+IHkgLSAxKTtcbiAgICBlbHNlIHNldFllYXJCYXNlKGIgPT4gYiAtIDEyKTtcbiAgfTtcbiAgY29uc3Qgb25OZXh0ID0gKCkgPT4ge1xuICAgIGlmIChtb2RlID09PSAnZGF5cycpIG5leHRNb250aCgpO1xuICAgIGVsc2UgaWYgKG1vZGUgPT09ICdtb250aHMnKSBzZXRWaWV3WWVhcih5ID0+IHkgKyAxKTtcbiAgICBlbHNlIHNldFllYXJCYXNlKGIgPT4gYiArIDEyKTtcbiAgfTtcblxuICBjb25zdCBoZWFkZXJMYWJlbCA9IG1vZGUgPT09ICd5ZWFycydcbiAgICA/IGAke3llYXJCYXNlfSBcdTIwMTMgJHt5ZWFyQmFzZSArIDExfWBcbiAgICA6IG1vZGUgPT09ICdtb250aHMnXG4gICAgPyBTdHJpbmcodmlld1llYXIpXG4gICAgOiBgJHttb250aE5hbWVzW3ZpZXdNb250aF19ICR7dmlld1llYXJ9YDtcblxuICBjb25zdCBDID0gUmVhY3QudXNlQ29udGV4dChTZWxlY3RDb2xvcnNDb250ZXh0KTtcbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywge1xuICAgIHN0eWxlOiB7IGJhY2tncm91bmRDb2xvcjogQy5kcm9wZG93bkJnLCBib3JkZXJSYWRpdXM6IDgsIHBhZGRpbmc6IDgsIGJvcmRlcldpZHRoOiAxLCBib3JkZXJDb2xvcjogQy5kcm9wZG93bkJvcmRlciB9LFxuICB9LFxuICAgIC8vIGhlYWRlciByb3dcbiAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFZpZXcsIHtcbiAgICAgIHdpZHRoOiBDQUxfVywgaGVpZ2h0OiAyOCxcbiAgICAgIHN0eWxlOiB7IGZsZXhEaXJlY3Rpb246ICdyb3cnLCBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgbWFyZ2luQm90dG9tOiA0IH0sXG4gICAgfSxcbiAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoX0NhbEFycm93LCB7IG9uUHJlc3M6IG9uUHJldiB9LCAnPCcpLFxuICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChQcmVzc2FibGUsIHtcbiAgICAgICAgZmVlZGJhY2s6IGZhbHNlLFxuICAgICAgICBvbkhvdmVySW46ICgpID0+IHNldExhYmVsSG92KHRydWUpLCBvbkhvdmVyT3V0OiAoKSA9PiBzZXRMYWJlbEhvdihmYWxzZSksXG4gICAgICAgIG9uUHJlc3M6ICgpID0+IHNldE1vZGUobSA9PiBtID09PSAnZGF5cycgPyAnbW9udGhzJyA6IG0gPT09ICdtb250aHMnID8gJ3llYXJzJyA6ICdkYXlzJyksXG4gICAgICAgIHN0eWxlOiB7IHBhZGRpbmdIb3Jpem9udGFsOiA2LCBoZWlnaHQ6IDI0LCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBib3JkZXJSYWRpdXM6IDQsIGJhY2tncm91bmRDb2xvcjogbGFiZWxIb3YgPyBDLm9wdGlvbkhvdmVyQmcgOiAndHJhbnNwYXJlbnQnIH0sXG4gICAgICB9LFxuICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFRleHQsIHsgaGVpZ2h0OiAxOCwgc3R5bGU6IHsgY29sb3I6IEMub3B0aW9uVGV4dCwgZm9udFNpemU6IDEzLCB0ZXh0QWxpZ246ICdjZW50ZXInIH0gfSwgaGVhZGVyTGFiZWwpXG4gICAgICApLFxuICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChfQ2FsQXJyb3csIHsgb25QcmVzczogb25OZXh0IH0sICc+JyksXG4gICAgKSxcbiAgICAvLyBib2R5XG4gICAgbW9kZSA9PT0gJ21vbnRocycgPyByZW5kZXJNb250aHMoKSA6XG4gICAgbW9kZSA9PT0gJ3llYXJzJyAgPyByZW5kZXJZZWFycygpICA6XG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCBudWxsLFxuICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7IHdpZHRoOiBDQUxfVywgaGVpZ2h0OiAyMCwgc3R5bGU6IHsgZmxleERpcmVjdGlvbjogJ3JvdycsIG1hcmdpbkJvdHRvbTogMiB9IH0sXG4gICAgICAgIC4uLmRheU5hbWVzLm1hcChkID0+IFJlYWN0LmNyZWF0ZUVsZW1lbnQoVmlldywgeyBrZXk6IGQsIHdpZHRoOiBDRUxMX1csIGhlaWdodDogMjAsIHN0eWxlOiB7IGFsaWduSXRlbXM6ICdjZW50ZXInLCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicgfSB9LFxuICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGV4dCwgeyBoZWlnaHQ6IDE0LCBzdHlsZTogeyBjb2xvcjogQy5jYWxEYXlOYW1lLCBmb250U2l6ZTogMTAsIHRleHRBbGlnbjogJ2NlbnRlcicgfSB9LCBkKSkpLFxuICAgICAgKSxcbiAgICAgIC4uLnJvd3MubWFwKChyb3csIHJpKSA9PiBSZWFjdC5jcmVhdGVFbGVtZW50KFZpZXcsIHtcbiAgICAgICAga2V5OiBgJHt2aWV3WWVhcn0tJHt2aWV3TW9udGh9LSR7cml9YCwgd2lkdGg6IENBTF9XLCBoZWlnaHQ6IENFTExfSCwgc3R5bGU6IHsgZmxleERpcmVjdGlvbjogJ3JvdycgfSxcbiAgICAgIH0sXG4gICAgICAgIC4uLnJvdy5tYXAoKGRheSwgY2kpID0+IHtcbiAgICAgICAgICBpZiAoZGF5ID09PSBudWxsKSByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7IGtleTogYGUke2NpfWAsIHdpZHRoOiBDRUxMX1csIGhlaWdodDogQ0VMTF9IIH0pO1xuICAgICAgICAgIGNvbnN0IGlzU2VsID0gc2VsICYmIHNlbC5nZXREYXRlKCkgPT09IGRheSAmJiBzZWwuZ2V0TW9udGgoKSA9PT0gdmlld01vbnRoICYmIHNlbC5nZXRGdWxsWWVhcigpID09PSB2aWV3WWVhcjtcbiAgICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChfSG92ZXJDZWxsLCB7XG4gICAgICAgICAgICBrZXk6IGNpLFxuICAgICAgICAgICAgc2VsZWN0ZWQ6ICEhaXNTZWwsXG4gICAgICAgICAgICBvblByZXNzOiAoKSA9PiBvblNlbGVjdChuZXcgRGF0ZSh2aWV3WWVhciwgdmlld01vbnRoLCBkYXkpKSxcbiAgICAgICAgICAgIHc6IENFTExfVywgaDogQ0VMTF9ILFxuICAgICAgICAgIH0sIFN0cmluZyhkYXkpKTtcbiAgICAgICAgfSksXG4gICAgICApKSxcbiAgICApLFxuICApO1xufVxuXG4vKipcbiAqIERhdGUgcGlja2VyLiBUaGUgY2FsZW5kYXIgZmxvYXRzIGluIHRoZSByb290IHBvcG92ZXIgbGF5ZXIgKG5ldmVyIGNsaXBwZWQpLFxuICogZmxpcHMgYWJvdmUgdGhlIHRyaWdnZXIgbmVhciB0aGUgd2luZG93IGJvdHRvbSwgYW5kIHRoZSBhcnJvd3MgbmF2aWdhdGVcbiAqIG1vbnRocyBpbiBwbGFjZS5cbiAqXG4gKiBAcGFyYW0ge3sgdmFsdWU/OiBEYXRlfG51bGwsIG9uVmFsdWVDaGFuZ2U/OiBmdW5jdGlvbixcbiAqICAgICAgICAgICBkaXNhYmxlZD86IGJvb2xlYW4sIHN0eWxlPzogb2JqZWN0IH19IHByb3BzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBEYXRlUGlja2VyKHsgdmFsdWUgPSBudWxsLCBvblZhbHVlQ2hhbmdlLCBkaXNhYmxlZCA9IGZhbHNlLCBzdHlsZSwgLi4ucmVzdCB9KSB7XG4gIGNvbnN0IEMgPSBSZWFjdC51c2VDb250ZXh0KFNlbGVjdENvbG9yc0NvbnRleHQpO1xuICBjb25zdCBbb3Blbiwgc2V0T3Blbl0gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IGNvbnRhaW5lck5vZGVJZCA9IHVzZVJlZihudWxsKTtcbiAgY29uc3QgcG9wb3ZlcklkID0gdXNlUmVmKG51bGwpO1xuICBjb25zdCBvbkNvbnRhaW5lck1vdW50ID0gdXNlQ2FsbGJhY2soKGlkKSA9PiB7IGNvbnRhaW5lck5vZGVJZC5jdXJyZW50ID0gaWQ7IH0sIFtdKTtcblxuICBjb25zdCBjbG9zZSA9ICgpID0+IHsgaWYgKHBvcG92ZXJJZC5jdXJyZW50ICE9IG51bGwpIHsgY2xvc2VQb3BvdmVyKHBvcG92ZXJJZC5jdXJyZW50KTsgcG9wb3ZlcklkLmN1cnJlbnQgPSBudWxsOyB9IH07XG4gIGNvbnN0IHRvZ2dsZSA9ICgpID0+IHtcbiAgICBpZiAoZGlzYWJsZWQpIHJldHVybjtcbiAgICBpZiAob3BlbikgeyBjbG9zZSgpOyByZXR1cm47IH1cbiAgICBjb25zdCBsID0gKHR5cGVvZiBfX2dseXhfZ2V0TGF5b3V0ICE9PSAndW5kZWZpbmVkJykgPyBfX2dseXhfZ2V0TGF5b3V0KGNvbnRhaW5lck5vZGVJZC5jdXJyZW50KSA6IG51bGw7XG4gICAgaWYgKCFsKSByZXR1cm47XG4gICAgc2V0T3Blbih0cnVlKTtcbiAgICBwb3BvdmVySWQuY3VycmVudCA9IG9wZW5Qb3BvdmVyKHtcbiAgICAgIHg6IGwueCwgeTogbC55LCBoOiBsLmhlaWdodCwgd2lkdGg6IDM2ICogNyArIDE4LCBjb250ZW50SDogOCArIDI4ICsgMjIgKyA2ICogMzIgKyA4LFxuICAgICAgb25DbG9zZTogKCkgPT4geyBwb3BvdmVySWQuY3VycmVudCA9IG51bGw7IHNldE9wZW4oZmFsc2UpOyB9LFxuICAgICAgcmVuZGVyOiAoKSA9PiBSZWFjdC5jcmVhdGVFbGVtZW50KFNlbGVjdENvbG9yc1Byb3ZpZGVyLCB7IGNvbG9yczogQyB9LFxuICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KF9DYWxlbmRhciwge1xuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIG9uU2VsZWN0OiAoZCkgPT4geyBvblZhbHVlQ2hhbmdlPy4oZCk7IGNsb3NlKCk7IH0sXG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICB9KTtcbiAgfTtcbiAgdXNlRWZmZWN0KCgpID0+ICgpID0+IGNsb3NlKCksIFtdKTtcblxuICBjb25zdCBkbGFiZWwgPSB2YWx1ZVxuICAgID8gYCR7bmV3IERhdGUodmFsdWUpLmdldEZ1bGxZZWFyKCl9LSR7U3RyaW5nKG5ldyBEYXRlKHZhbHVlKS5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgJzAnKX0tJHtTdHJpbmcobmV3IERhdGUodmFsdWUpLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKX1gXG4gICAgOiAnU2VsZWN0IGRhdGVcdTIwMjYnO1xuXG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFZpZXcsIHtcbiAgICBfZ2x5eE9uTW91bnQ6IG9uQ29udGFpbmVyTW91bnQsXG4gICAgc3R5bGU6IF9zaXplZFJvb3RTdHlsZShzdHlsZSwgMjQwKSxcbiAgICAuLi5yZXN0LFxuICB9LFxuICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoUHJlc3NhYmxlLCB7XG4gICAgICBvblByZXNzOiB0b2dnbGUsXG4gICAgICBzdHlsZToge1xuICAgICAgICBmbGV4RGlyZWN0aW9uOiAncm93JywganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJywgYWxpZ25JdGVtczogJ2NlbnRlcicsXG4gICAgICAgIHBhZGRpbmdMZWZ0OiAxMiwgcGFkZGluZ1JpZ2h0OiAxMCwgaGVpZ2h0OiA0MCwgYm9yZGVyUmFkaXVzOiA4LFxuICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGRpc2FibGVkID8gQy50cmlnZ2VyQmdEaXNhYmxlZCA6IEMudHJpZ2dlckJnLFxuICAgICAgICBib3JkZXJXaWR0aDogMSwgYm9yZGVyQ29sb3I6IG9wZW4gPyBDLnRyaWdnZXJCb3JkZXJGb2N1cyA6IEMudHJpZ2dlckJvcmRlcixcbiAgICAgIH0sXG4gICAgfSxcbiAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGV4dCwgeyBoZWlnaHQ6IDIwLCBzdHlsZTogeyBjb2xvcjogdmFsdWUgPyBDLnRyaWdnZXJUZXh0IDogQy50cmlnZ2VyUGxhY2Vob2xkZXIsIGZvbnRTaXplOiAxNCB9IH0sIGRsYWJlbCksXG4gICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFRleHQsIHsgd2lkdGg6IDE2LCBoZWlnaHQ6IDE2LCBzdHlsZTogeyBjb2xvcjogQy5jaGV2cm9uLCBmb250U2l6ZTogMTEgfSB9LCBvcGVuID8gJ1x1MjVCMicgOiAnXHUyNUJDJyksXG4gICAgKSxcbiAgKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIFRpbWVQaWNrZXIgLyBEYXRlVGltZVBpY2tlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIEZvcm1hdCBob3VyL21pbnV0ZSBmb3IgZGlzcGxheTogJzE0OjA1JyAoMjRoKSBvciAnMjowNSBQTScgKDEyaCkuICovXG5mdW5jdGlvbiBfZm10VGltZShob3VyLCBtaW51dGUsIHVzZTI0KSB7XG4gIGNvbnN0IG1tID0gU3RyaW5nKG1pbnV0ZSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgaWYgKHVzZTI0KSByZXR1cm4gYCR7U3RyaW5nKGhvdXIpLnBhZFN0YXJ0KDIsICcwJyl9OiR7bW19YDtcbiAgY29uc3QgaDEyID0gaG91ciAlIDEyID09PSAwID8gMTIgOiBob3VyICUgMTI7XG4gIHJldHVybiBgJHtoMTJ9OiR7bW19ICR7aG91ciA8IDEyID8gJ0FNJyA6ICdQTSd9YDtcbn1cblxuLy8gU2Nyb2xsYWJsZSBob3VyL21pbnV0ZSAoKyBBTS9QTSkgY29sdW1ucy4gIFNlbGVjdGluZyB1cGRhdGVzIGltbWVkaWF0ZWx5O1xuLy8gdGhlIHBvcG92ZXIgc3RheXMgb3BlbiBzbyBib3RoIHBhcnRzIGNhbiBiZSBzZXQsIGJhY2tkcm9wIGNsaWNrIGRpc21pc3Nlcy5cbmZ1bmN0aW9uIF9UaW1lQ29sdW1ucyh7IGhvdXIsIG1pbnV0ZSwgdXNlMjQsIG1pbnV0ZVN0ZXAsIG9uQ2hhbmdlIH0pIHtcbiAgY29uc3QgQ09MX0ggPSA2ICogMjg7XG4gIGNvbnN0IGhvdXJzICAgPSB1c2UyNCA/IEFycmF5LmZyb20oeyBsZW5ndGg6IDI0IH0sIChfLCBpKSA9PiBpKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiAxMiB9LCAoXywgaSkgPT4gKGkgPT09IDAgPyAxMiA6IGkpKTtcbiAgY29uc3QgbWludXRlcyA9IFtdO1xuICBmb3IgKGxldCBtID0gMDsgbSA8IDYwOyBtICs9IG1pbnV0ZVN0ZXApIG1pbnV0ZXMucHVzaChtKTtcbiAgY29uc3QgaXNQTSAgPSBob3VyID49IDEyO1xuICBjb25zdCBoMTIgICA9IGhvdXIgJSAxMiA9PT0gMCA/IDEyIDogaG91ciAlIDEyO1xuXG4gIGNvbnN0IGNvbCA9IChpdGVtcywgaXNTZWwsIHBpY2ssIHcpID0+IFJlYWN0LmNyZWF0ZUVsZW1lbnQoU2Nyb2xsVmlldywge1xuICAgIGhlaWdodDogQ09MX0gsIHNob3dTY3JvbGxiYXI6IGZhbHNlLCBzdHlsZTogeyB3aWR0aDogdyB9LFxuICAgIGNvbnRlbnRIZWlnaHQ6IGl0ZW1zLmxlbmd0aCAqIDI4LFxuICB9LCAuLi5pdGVtcy5tYXAoKGl0KSA9PiBSZWFjdC5jcmVhdGVFbGVtZW50KF9Ib3ZlckNlbGwsIHtcbiAgICBrZXk6IFN0cmluZyhpdCksIHNlbGVjdGVkOiBpc1NlbChpdCksIG9uUHJlc3M6ICgpID0+IHBpY2soaXQpLCB3LCBoOiAyOCxcbiAgfSwgU3RyaW5nKGl0KS5wYWRTdGFydCgyLCAnMCcpKSkpO1xuXG4gIGNvbnN0IEMgPSBSZWFjdC51c2VDb250ZXh0KFNlbGVjdENvbG9yc0NvbnRleHQpO1xuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7XG4gICAgc3R5bGU6IHtcbiAgICAgIGZsZXhEaXJlY3Rpb246ICdyb3cnLCBnYXA6IDQsIHBhZGRpbmc6IDgsXG4gICAgICBiYWNrZ3JvdW5kQ29sb3I6IEMuZHJvcGRvd25CZywgYm9yZGVyUmFkaXVzOiA4LCBib3JkZXJXaWR0aDogMSwgYm9yZGVyQ29sb3I6IEMuZHJvcGRvd25Cb3JkZXIsXG4gICAgfSxcbiAgfSxcbiAgICBjb2woaG91cnMsICAgKGgpID0+ICh1c2UyNCA/IGggPT09IGhvdXIgOiBoID09PSBoMTIpLFxuICAgICAgICAoaCkgPT4gb25DaGFuZ2UodXNlMjQgPyBoIDogKChoICUgMTIpICsgKGlzUE0gPyAxMiA6IDApKSwgbWludXRlKSwgNDgpLFxuICAgIGNvbChtaW51dGVzLCAobSkgPT4gbSA9PT0gbWludXRlLCAobSkgPT4gb25DaGFuZ2UoaG91ciwgbSksIDQ4KSxcbiAgICAhdXNlMjQgJiYgUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7IHN0eWxlOiB7IGdhcDogNCB9IH0sXG4gICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KF9Ib3ZlckNlbGwsIHsgc2VsZWN0ZWQ6ICFpc1BNLCBvblByZXNzOiAoKSA9PiBvbkNoYW5nZShob3VyICUgMTIsIG1pbnV0ZSksIHc6IDQ0LCBoOiAyOCB9LCAnQU0nKSxcbiAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoX0hvdmVyQ2VsbCwgeyBzZWxlY3RlZDogIGlzUE0sIG9uUHJlc3M6ICgpID0+IG9uQ2hhbmdlKChob3VyICUgMTIpICsgMTIsIG1pbnV0ZSksIHc6IDQ0LCBoOiAyOCB9LCAnUE0nKSxcbiAgICApLFxuICApO1xufVxuXG4vKipcbiAqIFRpbWUgcGlja2VyIFx1MjAxNCBmbG9hdGluZyBob3VyL21pbnV0ZSBjb2x1bW5zIChBTS9QTSBpbiAxMi1ob3VyIG1vZGUpLlxuICpcbiAqIEBwYXJhbSB7eyB2YWx1ZT86IHN0cmluZ3xudWxsLCBvblZhbHVlQ2hhbmdlPzogKGhobW06IHN0cmluZykgPT4gdm9pZCxcbiAqICAgICAgICAgICB1c2UyNEhvdXI/OiBib29sZWFuLCBtaW51dGVTdGVwPzogbnVtYmVyLFxuICogICAgICAgICAgIGRpc2FibGVkPzogYm9vbGVhbiwgc3R5bGU/OiBvYmplY3QgfX0gcHJvcHNcbiAqICAgYHZhbHVlYCBpcyBhbHdheXMgdGhlIDI0LWhvdXIgc3RyaW5nICdISDpNTScgKGRpc3BsYXkgaG9ub3JzIHVzZTI0SG91cikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBUaW1lUGlja2VyKHtcbiAgdmFsdWUgPSBudWxsLCBvblZhbHVlQ2hhbmdlLCB1c2UyNEhvdXIgPSBmYWxzZSwgbWludXRlU3RlcCA9IDUsXG4gIGRpc2FibGVkID0gZmFsc2UsIHN0eWxlLCAuLi5yZXN0XG59KSB7XG4gIGNvbnN0IEMgPSBSZWFjdC51c2VDb250ZXh0KFNlbGVjdENvbG9yc0NvbnRleHQpO1xuICBjb25zdCBbb3Blbiwgc2V0T3Blbl0gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IGNvbnRhaW5lck5vZGVJZCA9IHVzZVJlZihudWxsKTtcbiAgY29uc3QgcG9wb3ZlcklkID0gdXNlUmVmKG51bGwpO1xuICBjb25zdCBvbkNvbnRhaW5lck1vdW50ID0gdXNlQ2FsbGJhY2soKGlkKSA9PiB7IGNvbnRhaW5lck5vZGVJZC5jdXJyZW50ID0gaWQ7IH0sIFtdKTtcblxuICBjb25zdCBbaGgsIG1tXSA9ICh2YWx1ZSB8fCAnJykuc3BsaXQoJzonKS5tYXAoTnVtYmVyKTtcbiAgY29uc3QgaG91ciAgID0gTnVtYmVyLmlzRmluaXRlKGhoKSA/IE1hdGgubWF4KDAsIE1hdGgubWluKDIzLCBoaCkpIDogMTI7XG4gIGNvbnN0IG1pbnV0ZSA9IE51bWJlci5pc0Zpbml0ZShtbSkgPyBNYXRoLm1heCgwLCBNYXRoLm1pbig1OSwgbW0pKSA6IDA7XG5cbiAgY29uc3QgY2xvc2UgPSAoKSA9PiB7IGlmIChwb3BvdmVySWQuY3VycmVudCAhPSBudWxsKSB7IGNsb3NlUG9wb3Zlcihwb3BvdmVySWQuY3VycmVudCk7IHBvcG92ZXJJZC5jdXJyZW50ID0gbnVsbDsgfSB9O1xuICBjb25zdCBlbWl0ICA9IChoLCBtKSA9PiBvblZhbHVlQ2hhbmdlPy4oYCR7U3RyaW5nKGgpLnBhZFN0YXJ0KDIsICcwJyl9OiR7U3RyaW5nKG0pLnBhZFN0YXJ0KDIsICcwJyl9YCk7XG5cbiAgY29uc3QgdG9nZ2xlID0gKCkgPT4ge1xuICAgIGlmIChkaXNhYmxlZCkgcmV0dXJuO1xuICAgIGlmIChvcGVuKSB7IGNsb3NlKCk7IHJldHVybjsgfVxuICAgIGNvbnN0IGwgPSAodHlwZW9mIF9fZ2x5eF9nZXRMYXlvdXQgIT09ICd1bmRlZmluZWQnKSA/IF9fZ2x5eF9nZXRMYXlvdXQoY29udGFpbmVyTm9kZUlkLmN1cnJlbnQpIDogbnVsbDtcbiAgICBpZiAoIWwpIHJldHVybjtcbiAgICBzZXRPcGVuKHRydWUpO1xuICAgIHBvcG92ZXJJZC5jdXJyZW50ID0gb3BlblBvcG92ZXIoe1xuICAgICAgeDogbC54LCB5OiBsLnksIGg6IGwuaGVpZ2h0LFxuICAgICAgd2lkdGg6ICh1c2UyNEhvdXIgPyA0OCAqIDIgKyA0IDogNDggKiAyICsgNDQgKyA4KSArIDE4LFxuICAgICAgY29udGVudEg6IDYgKiAyOCArIDE4LFxuICAgICAgb25DbG9zZTogKCkgPT4geyBwb3BvdmVySWQuY3VycmVudCA9IG51bGw7IHNldE9wZW4oZmFsc2UpOyB9LFxuICAgICAgcmVuZGVyOiAoKSA9PiBSZWFjdC5jcmVhdGVFbGVtZW50KFNlbGVjdENvbG9yc1Byb3ZpZGVyLCB7IGNvbG9yczogQyB9LFxuICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KF9UaW1lQ29sdW1uc0xpdmUsIHtcbiAgICAgICAgICBpbml0aWFsOiB7IGhvdXIsIG1pbnV0ZSB9LCB1c2UyNDogdXNlMjRIb3VyLCBtaW51dGVTdGVwLCBvbkVtaXQ6IGVtaXQsXG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICB9KTtcbiAgfTtcbiAgdXNlRWZmZWN0KCgpID0+ICgpID0+IGNsb3NlKCksIFtdKTtcblxuICBjb25zdCBsYWJlbCA9IHZhbHVlICE9IG51bGwgJiYgdmFsdWUgIT09ICcnID8gX2ZtdFRpbWUoaG91ciwgbWludXRlLCB1c2UyNEhvdXIpIDogJ1NlbGVjdCB0aW1lXHUyMDI2JztcblxuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7XG4gICAgX2dseXhPbk1vdW50OiBvbkNvbnRhaW5lck1vdW50LFxuICAgIHN0eWxlOiBfc2l6ZWRSb290U3R5bGUoc3R5bGUsIDE2MCksXG4gICAgLi4ucmVzdCxcbiAgfSxcbiAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFByZXNzYWJsZSwge1xuICAgICAgb25QcmVzczogdG9nZ2xlLFxuICAgICAgc3R5bGU6IHtcbiAgICAgICAgZmxleERpcmVjdGlvbjogJ3JvdycsIGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIGFsaWduSXRlbXM6ICdjZW50ZXInLFxuICAgICAgICBwYWRkaW5nTGVmdDogMTIsIHBhZGRpbmdSaWdodDogMTAsIGhlaWdodDogNDAsIGJvcmRlclJhZGl1czogOCxcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiBkaXNhYmxlZCA/IEMudHJpZ2dlckJnRGlzYWJsZWQgOiBDLnRyaWdnZXJCZyxcbiAgICAgICAgYm9yZGVyV2lkdGg6IDEsIGJvcmRlckNvbG9yOiBvcGVuID8gQy50cmlnZ2VyQm9yZGVyRm9jdXMgOiBDLnRyaWdnZXJCb3JkZXIsXG4gICAgICB9LFxuICAgIH0sXG4gICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFRleHQsIHsgaGVpZ2h0OiAyMCwgc3R5bGU6IHsgY29sb3I6IHZhbHVlID8gQy50cmlnZ2VyVGV4dCA6IEMudHJpZ2dlclBsYWNlaG9sZGVyLCBmb250U2l6ZTogMTQgfSB9LCBsYWJlbCksXG4gICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFRleHQsIHsgd2lkdGg6IDE2LCBoZWlnaHQ6IDE2LCBzdHlsZTogeyBjb2xvcjogQy5jaGV2cm9uLCBmb250U2l6ZTogMTEgfSB9LCBvcGVuID8gJ1x1MjVCMicgOiAnXHUyNUJDJyksXG4gICAgKSxcbiAgKTtcbn1cblxuLy8gUG9wb3Zlci1sb2NhbCBzdGF0ZSB3cmFwcGVyOiBjZWxsIGNsaWNrcyByZS1yZW5kZXIgdGhlIGNvbHVtbnMgaW4gcGxhY2Vcbi8vIChjbG9zdXJlLXNuYXBzaG90IGNvbHVtbnMgY291bGRuJ3QgdXBkYXRlIHNlbGVjdGlvbiwgc2FtZSBsZXNzb24gYXMgdGhlXG4vLyBfQ2FsZW5kYXIgYXJyb3dzKS5cbmZ1bmN0aW9uIF9UaW1lQ29sdW1uc0xpdmUoeyBpbml0aWFsLCB1c2UyNCwgbWludXRlU3RlcCwgb25FbWl0IH0pIHtcbiAgY29uc3QgW2hvdXIsIHNldEhvdXJdICAgICA9IHVzZVN0YXRlKGluaXRpYWwuaG91cik7XG4gIGNvbnN0IFttaW51dGUsIHNldE1pbnV0ZV0gPSB1c2VTdGF0ZShpbml0aWFsLm1pbnV0ZSk7XG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KF9UaW1lQ29sdW1ucywge1xuICAgIGhvdXIsIG1pbnV0ZSwgdXNlMjQsIG1pbnV0ZVN0ZXAsXG4gICAgb25DaGFuZ2U6IChoLCBtKSA9PiB7IHNldEhvdXIoaCk7IHNldE1pbnV0ZShtKTsgb25FbWl0KGgsIG0pOyB9LFxuICB9KTtcbn1cblxuLyoqXG4gKiBDb21iaW5lZCBkYXRlICsgdGltZSBwaWNrZXI6IGNhbGVuZGFyIGFuZCB0aW1lIGNvbHVtbnMgc2lkZSBieSBzaWRlLlxuICpcbiAqIEBwYXJhbSB7eyB2YWx1ZT86IERhdGV8c3RyaW5nfG51bGwsIG9uVmFsdWVDaGFuZ2U/OiAoZDogRGF0ZSkgPT4gdm9pZCxcbiAqICAgICAgICAgICB1c2UyNEhvdXI/OiBib29sZWFuLCBtaW51dGVTdGVwPzogbnVtYmVyLFxuICogICAgICAgICAgIGRpc2FibGVkPzogYm9vbGVhbiwgc3R5bGU/OiBvYmplY3QgfX0gcHJvcHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIERhdGVUaW1lUGlja2VyKHtcbiAgdmFsdWUgPSBudWxsLCBvblZhbHVlQ2hhbmdlLCB1c2UyNEhvdXIgPSBmYWxzZSwgbWludXRlU3RlcCA9IDUsXG4gIGRpc2FibGVkID0gZmFsc2UsIHN0eWxlLCAuLi5yZXN0XG59KSB7XG4gIGNvbnN0IEMgPSBSZWFjdC51c2VDb250ZXh0KFNlbGVjdENvbG9yc0NvbnRleHQpO1xuICBjb25zdCBbb3Blbiwgc2V0T3Blbl0gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IGNvbnRhaW5lck5vZGVJZCA9IHVzZVJlZihudWxsKTtcbiAgY29uc3QgcG9wb3ZlcklkID0gdXNlUmVmKG51bGwpO1xuICBjb25zdCBvbkNvbnRhaW5lck1vdW50ID0gdXNlQ2FsbGJhY2soKGlkKSA9PiB7IGNvbnRhaW5lck5vZGVJZC5jdXJyZW50ID0gaWQ7IH0sIFtdKTtcblxuICBjb25zdCBkID0gdmFsdWUgPyBuZXcgRGF0ZSh2YWx1ZSkgOiBudWxsO1xuICBjb25zdCBjbG9zZSA9ICgpID0+IHsgaWYgKHBvcG92ZXJJZC5jdXJyZW50ICE9IG51bGwpIHsgY2xvc2VQb3BvdmVyKHBvcG92ZXJJZC5jdXJyZW50KTsgcG9wb3ZlcklkLmN1cnJlbnQgPSBudWxsOyB9IH07XG5cbiAgY29uc3QgdG9nZ2xlID0gKCkgPT4ge1xuICAgIGlmIChkaXNhYmxlZCkgcmV0dXJuO1xuICAgIGlmIChvcGVuKSB7IGNsb3NlKCk7IHJldHVybjsgfVxuICAgIGNvbnN0IGwgPSAodHlwZW9mIF9fZ2x5eF9nZXRMYXlvdXQgIT09ICd1bmRlZmluZWQnKSA/IF9fZ2x5eF9nZXRMYXlvdXQoY29udGFpbmVyTm9kZUlkLmN1cnJlbnQpIDogbnVsbDtcbiAgICBpZiAoIWwpIHJldHVybjtcbiAgICBzZXRPcGVuKHRydWUpO1xuICAgIHBvcG92ZXJJZC5jdXJyZW50ID0gb3BlblBvcG92ZXIoe1xuICAgICAgeDogbC54LCB5OiBsLnksIGg6IGwuaGVpZ2h0LFxuICAgICAgd2lkdGg6IDM2ICogNyArICh1c2UyNEhvdXIgPyA0OCAqIDIgKyA0IDogNDggKiAyICsgNDQgKyA4KSArIDM0LFxuICAgICAgY29udGVudEg6IDggKyAyOCArIDIyICsgNiAqIDMyICsgOCxcbiAgICAgIG9uQ2xvc2U6ICgpID0+IHsgcG9wb3ZlcklkLmN1cnJlbnQgPSBudWxsOyBzZXRPcGVuKGZhbHNlKTsgfSxcbiAgICAgIHJlbmRlcjogKCkgPT4gUmVhY3QuY3JlYXRlRWxlbWVudChTZWxlY3RDb2xvcnNQcm92aWRlciwgeyBjb2xvcnM6IEMgfSxcbiAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChfRGF0ZVRpbWVQYW5lbCwge1xuICAgICAgICAgIGluaXRpYWw6IGQsIHVzZTI0OiB1c2UyNEhvdXIsIG1pbnV0ZVN0ZXAsXG4gICAgICAgICAgb25FbWl0OiAobmQpID0+IG9uVmFsdWVDaGFuZ2U/LihuZCksXG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICB9KTtcbiAgfTtcbiAgdXNlRWZmZWN0KCgpID0+ICgpID0+IGNsb3NlKCksIFtdKTtcblxuICBjb25zdCBsYWJlbCA9IGRcbiAgICA/IGAke2QuZ2V0RnVsbFllYXIoKX0tJHtTdHJpbmcoZC5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgJzAnKX0tJHtTdHJpbmcoZC5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyl9ICR7X2ZtdFRpbWUoZC5nZXRIb3VycygpLCBkLmdldE1pbnV0ZXMoKSwgdXNlMjRIb3VyKX1gXG4gICAgOiAnU2VsZWN0IGRhdGUgJiB0aW1lXHUyMDI2JztcblxuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7XG4gICAgX2dseXhPbk1vdW50OiBvbkNvbnRhaW5lck1vdW50LFxuICAgIHN0eWxlOiBfc2l6ZWRSb290U3R5bGUoc3R5bGUsIDI4MCksXG4gICAgLi4ucmVzdCxcbiAgfSxcbiAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFByZXNzYWJsZSwge1xuICAgICAgb25QcmVzczogdG9nZ2xlLFxuICAgICAgc3R5bGU6IHtcbiAgICAgICAgZmxleERpcmVjdGlvbjogJ3JvdycsIGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIGFsaWduSXRlbXM6ICdjZW50ZXInLFxuICAgICAgICBwYWRkaW5nTGVmdDogMTIsIHBhZGRpbmdSaWdodDogMTAsIGhlaWdodDogNDAsIGJvcmRlclJhZGl1czogOCxcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiBkaXNhYmxlZCA/IEMudHJpZ2dlckJnRGlzYWJsZWQgOiBDLnRyaWdnZXJCZyxcbiAgICAgICAgYm9yZGVyV2lkdGg6IDEsIGJvcmRlckNvbG9yOiBvcGVuID8gQy50cmlnZ2VyQm9yZGVyRm9jdXMgOiBDLnRyaWdnZXJCb3JkZXIsXG4gICAgICB9LFxuICAgIH0sXG4gICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFRleHQsIHsgaGVpZ2h0OiAyMCwgc3R5bGU6IHsgY29sb3I6IGQgPyBDLnRyaWdnZXJUZXh0IDogQy50cmlnZ2VyUGxhY2Vob2xkZXIsIGZvbnRTaXplOiAxNCB9IH0sIGxhYmVsKSxcbiAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGV4dCwgeyB3aWR0aDogMTYsIGhlaWdodDogMTYsIHN0eWxlOiB7IGNvbG9yOiBDLmNoZXZyb24sIGZvbnRTaXplOiAxMSB9IH0sIG9wZW4gPyAnXHUyNUIyJyA6ICdcdTI1QkMnKSxcbiAgICApLFxuICApO1xufVxuXG5mdW5jdGlvbiBfRGF0ZVRpbWVQYW5lbCh7IGluaXRpYWwsIHVzZTI0LCBtaW51dGVTdGVwLCBvbkVtaXQgfSkge1xuICBjb25zdCBbZHQsIHNldER0XSA9IHVzZVN0YXRlKGluaXRpYWwgfHwgbmV3IERhdGUoKSk7XG4gIGNvbnN0IGVtaXQgPSAobmV4dCkgPT4geyBzZXREdChuZXh0KTsgb25FbWl0KG5leHQpOyB9O1xuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChWaWV3LCB7IHN0eWxlOiB7IGZsZXhEaXJlY3Rpb246ICdyb3cnLCBnYXA6IDYsIGFsaWduSXRlbXM6ICdmbGV4LXN0YXJ0JyB9IH0sXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChfQ2FsZW5kYXIsIHtcbiAgICAgIHZhbHVlOiBkdCxcbiAgICAgIG9uU2VsZWN0OiAoZGF5KSA9PiBlbWl0KG5ldyBEYXRlKFxuICAgICAgICBkYXkuZ2V0RnVsbFllYXIoKSwgZGF5LmdldE1vbnRoKCksIGRheS5nZXREYXRlKCksIGR0LmdldEhvdXJzKCksIGR0LmdldE1pbnV0ZXMoKSkpLFxuICAgIH0pLFxuICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoX1RpbWVDb2x1bW5zLCB7XG4gICAgICBob3VyOiBkdC5nZXRIb3VycygpLCBtaW51dGU6IGR0LmdldE1pbnV0ZXMoKSwgdXNlMjQsIG1pbnV0ZVN0ZXAsXG4gICAgICBvbkNoYW5nZTogKGgsIG0pID0+IGVtaXQobmV3IERhdGUoXG4gICAgICAgIGR0LmdldEZ1bGxZZWFyKCksIGR0LmdldE1vbnRoKCksIGR0LmdldERhdGUoKSwgaCwgbSkpLFxuICAgIH0pLFxuICApO1xufVxuIiwgImltcG9ydCBSZWFjdCwgeyB1c2VSZWYsIHVzZUNhbGxiYWNrIH0gZnJvbSAncmVhY3QnO1xuXG4vLyBcdTI1MDBcdTI1MDAgQ2FudmFzIDJEIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy9cbi8vIDxDYW52YXMgcmVmPXtjYW52YXNSZWZ9IHN0eWxlPXt7IHdpZHRoOiAzMDAsIGhlaWdodDogMjAwIH19IC8+XG4vL1xuLy8gRXhwb3NlcyBhIGxpZ2h0d2VpZ2h0IDJEIGRyYXdpbmcgY29udGV4dCB2aWEgcmVmOlxuLy8gICBjb25zdCBjdHggPSBjYW52YXNSZWYuY3VycmVudDtcbi8vICAgY3R4LmZpbGxTdHlsZSA9ICcjZmYwMDAwJzsgICAgICAvLyBvciBbcixnLGIsYV1cbi8vICAgY3R4LnN0cm9rZVN0eWxlID0gJyNmZmZmZmYnO1xuLy8gICBjdHgubGluZVdpZHRoID0gMjtcbi8vICAgY3R4LmZpbGxSZWN0KHgsIHksIHcsIGgpO1xuLy8gICBjdHguc3Ryb2tlUmVjdCh4LCB5LCB3LCBoKTtcbi8vICAgY3R4LmZpbGxDaXJjbGUoY3gsIGN5LCByKTtcbi8vICAgY3R4LnN0cm9rZUNpcmNsZShjeCwgY3ksIHIpO1xuLy8gICBjdHguc3Ryb2tlTGluZSh4MCwgeTAsIHgxLCB5MSk7XG4vLyAgIGN0eC5maWxsVGV4dCh0ZXh0LCB4LCB5LCBmb250U2l6ZSk7XG4vLyAgIGN0eC5jbGVhcigpO1xuLy8gICBjdHguZmx1c2goKTsgICAgIC8vIG9yIGNvbW1hbmRzIGFyZSBmbHVzaGVkIGF1dG9tYXRpY2FsbHkgb24gdGhlIG5leHQgZnJhbWVcblxuZnVuY3Rpb24gX3BhcnNlQ29sb3IoYykge1xuICBpZiAoQXJyYXkuaXNBcnJheShjKSkgcmV0dXJuIGM7XG4gIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycgJiYgYy5zdGFydHNXaXRoKCcjJykpIHtcbiAgICBjb25zdCBoID0gYy5zbGljZSgxKTtcbiAgICBpZiAoaC5sZW5ndGggPT09IDMpIHtcbiAgICAgIGNvbnN0IFtyLCBnLCBiXSA9IGguc3BsaXQoJycpLm1hcCh4ID0+IHBhcnNlSW50KHggKyB4LCAxNikpO1xuICAgICAgcmV0dXJuIFtyLCBnLCBiLCAyNTVdO1xuICAgIH1cbiAgICBpZiAoaC5sZW5ndGggPT09IDYpIHtcbiAgICAgIHJldHVybiBbXG4gICAgICAgIHBhcnNlSW50KGguc2xpY2UoMCwgMiksIDE2KSxcbiAgICAgICAgcGFyc2VJbnQoaC5zbGljZSgyLCA0KSwgMTYpLFxuICAgICAgICBwYXJzZUludChoLnNsaWNlKDQsIDYpLCAxNiksXG4gICAgICAgIDI1NSxcbiAgICAgIF07XG4gICAgfVxuICAgIGlmIChoLmxlbmd0aCA9PT0gOCkge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgcGFyc2VJbnQoaC5zbGljZSgwLCAyKSwgMTYpLFxuICAgICAgICBwYXJzZUludChoLnNsaWNlKDIsIDQpLCAxNiksXG4gICAgICAgIHBhcnNlSW50KGguc2xpY2UoNCwgNiksIDE2KSxcbiAgICAgICAgcGFyc2VJbnQoaC5zbGljZSg2LCA4KSwgMTYpLFxuICAgICAgXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFsyNTUsIDI1NSwgMjU1LCAyNTVdO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgQ2FudmFzMkQgYmluYXJ5IHRyYW5zcG9ydCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBXaGVuIHRoZSBydW50aW1lIGV4cG9zZXMgYSBzaGFyZWQgY29tbWFuZCBidWZmZXIgKGRlZmF1bHQpLCBkcmF3IGNhbGxzIHdyaXRlXG4vLyBvcGNvZGVzICsgYXJncyBzdHJhaWdodCBpbnRvIHR5cGVkIGFycmF5cyB0aGF0IFJ1c3QgcmVhZHMgd2l0aCBubyBKU09OXG4vLyBzdHJpbmdpZnkvcGFyc2UuIEZhbGxzIGJhY2sgdG8gdGhlIEpTT04gYF9fZ2x5eF9jYW52YXNfdXBkYXRlYCBwYXRoIHdoZW4gdGhlXG4vLyBidWZmZXIgaXNuJ3QgYXZhaWxhYmxlIChlLmcuIGBjYW52YXMucHJvdG9jb2w6IFwianNvblwiYCBvciBzbmFwc2hvdC90ZXN0KS5cbi8vXG4vLyBOT1RFOiB0aGUgY29tbWFuZCBidWZmZXIgaXMgcHJvY2Vzcy1nbG9iYWwgYW5kIHNoYXJlZCBieSBhbGwgY2FudmFzIGNvbnRleHRzLlxuLy8gQmVjYXVzZSBKUyBpcyBzaW5nbGUtdGhyZWFkZWQgYW5kIGVhY2ggZmx1c2goKSBzZW5kcyBzeW5jaHJvbm91c2x5LCBhIGNvbnRleHRcbi8vIG11c3QgZmluaXNoIGl0cyBkcmF3K2ZsdXNoIGJlZm9yZSBhbm90aGVyIGNvbnRleHQgZHJhd3MuIEludGVybGVhdmluZyBkcmF3cyBvZlxuLy8gdHdvIGNvbnRleHRzIHdpdGhvdXQgZmx1c2hpbmcgYmV0d2VlbiBpcyB1bnN1cHBvcnRlZCBpbiBiaW5hcnkgbW9kZSAodXNlIHRoZVxuLy8ganNvbiBwcm90b2NvbCBmb3IgdGhhdCB1bnVzdWFsIHBhdHRlcm4pLlxuLy8gT3Bjb2RlcyBcdTIwMTQgbXVzdCBtYXRjaCBgY2FudmFzX29wYCBpbiBnbHl4LXJ1bnRpbWUvc3JjL2JpbmRpbmdzLnJzLlxuY29uc3QgX09QX0NMRUFSID0gMCwgX09QX0ZJTExSRUNUID0gMSwgX09QX1NUUk9LRVJFQ1QgPSAyLCBfT1BfRklMTENJUkNMRSA9IDMsXG4gICAgICBfT1BfU1RST0tFQ0lSQ0xFID0gNCwgX09QX1NUUk9LRUxJTkUgPSA1LCBfT1BfRklMTFRFWFQgPSA2LFxuICAgICAgX09QX0ZJTExQQVRIID0gNywgX09QX1NUUk9LRVBBVEggPSA4O1xuXG4vLyBQYWNrIGEgY29sb3IgaW50byBvbmUgbGl0dGxlLWVuZGlhbiB1MzIgd2hvc2UgYnl0ZXMgYXJlIFtyLCBnLCBiLCBhXS5cbmZ1bmN0aW9uIF9wYWNrQ29sb3IoYykge1xuICBjb25zdCBjb2wgPSBfcGFyc2VDb2xvcihjKTtcbiAgcmV0dXJuICgoY29sWzBdICYgMjU1KSB8ICgoY29sWzFdICYgMjU1KSA8PCA4KSB8ICgoY29sWzJdICYgMjU1KSA8PCAxNikgfCAoKGNvbFszXSAmIDI1NSkgPDwgMjQpKSA+Pj4gMDtcbn1cblxuLy8gTGF6aWx5IHJlc29sdmUgdGhlIGJpbmFyeSBjb21tYW5kIGJ1ZmZlci4gTVVTVCBiZSBydW50aW1lLWV2YWx1YXRlZCAobm90IGFcbi8vIG1vZHVsZS1sZXZlbCBjb25zdCk6IGluIHNuYXBzaG90L3BhY2thZ2VkIGJ1aWxkcyB0aGUgbW9kdWxlIGJvZHkgcnVucyBhdFxuLy8gc25hcHNob3QtQlVJTEQgdGltZSwgYmVmb3JlIHRoZSBydW50aW1lIGluc3RhbGxzIHRoZSByZWFsIGJhY2tpbmctc3RvcmVcbi8vIGdsb2JhbHMuIFByb2Jpbmcgb24gZmlyc3QgY2FudmFzIHVzZSAoYWx3YXlzIGF0IGFwcCBydW50aW1lKSBzZWVzIHRoZW0uXG4vLyBNZW1vaXplZDogYGZhbHNlYCA9IHVuYXZhaWxhYmxlICh1c2UgSlNPTik7IG9iamVjdCA9IHRoZSBzaGFyZWQgYnVmZmVycy5cbmxldCBfY2FudmFzQmluOyAvLyB1bmRlZmluZWQgPSBub3QgeWV0IHByb2JlZFxuZnVuY3Rpb24gX2NhbnZhc0JpbmFyeUVudigpIHtcbiAgaWYgKF9jYW52YXNCaW4gIT09IHVuZGVmaW5lZCkgcmV0dXJuIF9jYW52YXNCaW47XG4gIGNvbnN0IG9rID1cbiAgICB0eXBlb2YgX19nbHl4X2NhbnZhc19wcm90b2NvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgX19nbHl4X2NhbnZhc19wcm90b2NvbCA9PT0gJ2JpbmFyeScgJiZcbiAgICB0eXBlb2YgX19nbHl4X2NhbnZhc19jbWRidWZfZjMyICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHR5cGVvZiBfX2dseXhfY2FudmFzX2NtZGJ1Zl91MzIgIT09ICd1bmRlZmluZWQnICYmXG4gICAgdHlwZW9mIF9fZ2x5eF9jYW52YXNfc3RyYnVmICAgICAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICB0eXBlb2YgX19nbHl4X2NhbnZhc19mbHVzaCAgICAgICE9PSAndW5kZWZpbmVkJztcbiAgX2NhbnZhc0JpbiA9IG9rID8ge1xuICAgIGYzMjogICAgX19nbHl4X2NhbnZhc19jbWRidWZfZjMyLFxuICAgIHUzMjogICAgX19nbHl4X2NhbnZhc19jbWRidWZfdTMyLFxuICAgIHN0cjogICAgX19nbHl4X2NhbnZhc19zdHJidWYsXG4gICAgY2FwOiAgICBfX2dseXhfY2FudmFzX2NtZGJ1Zl9mMzIubGVuZ3RoLFxuICAgIHN0ckNhcDogX19nbHl4X2NhbnZhc19zdHJidWYubGVuZ3RoLFxuICAgIGVuYzogICAgKHR5cGVvZiBUZXh0RW5jb2RlciAhPT0gJ3VuZGVmaW5lZCcpID8gbmV3IFRleHRFbmNvZGVyKCkgOiBudWxsLFxuICB9IDogZmFsc2U7XG4gIHJldHVybiBfY2FudmFzQmluO1xufVxuXG5jbGFzcyBHbHl4Q2FudmFzQ29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKG5hdGl2ZUlkKSB7XG4gICAgdGhpcy5faWQgICAgPSBuYXRpdmVJZDtcbiAgICB0aGlzLl9iaW4gICA9IF9jYW52YXNCaW5hcnlFbnYoKTsgLy8gc2hhcmVkIGJ1ZmZlcnMsIG9yIGZhbHNlIGZvciBKU09OXG4gICAgdGhpcy5fY21kcyAgPSBbXTsgICAgICAgIC8vIEpTT04gZmFsbGJhY2sgYnVmZmVyXG4gICAgdGhpcy5fZmMgICAgPSAwOyAgICAgICAgIC8vIGJpbmFyeTogZjMyIGNvbW1hbmQgY3Vyc29yXG4gICAgdGhpcy5fc2MgICAgPSAwOyAgICAgICAgIC8vIGJpbmFyeTogc3RyaW5nIGJ5dGUgY3Vyc29yXG4gICAgdGhpcy5fZmlyc3RDaHVuayA9IHRydWU7IC8vIGJpbmFyeTogZmlyc3QgZmx1c2ggb2YgYSBmcmFtZSByZXBsYWNlcywgcmVzdCBhcHBlbmRcbiAgICB0aGlzLl9wYXRoICAgPSBbXTsgICAgICAgLy8gY3VycmVudCBwYXRoOiBmbGF0IFt4MCx5MCx4MSx5MSxcdTIwMjZdXG4gICAgdGhpcy5fcGF0aENsb3NlZCA9IGZhbHNlO1xuICAgIHRoaXMuZmlsbFN0eWxlICAgPSBbMjU1LCAyNTUsIDI1NSwgMjU1XTtcbiAgICB0aGlzLnN0cm9rZVN0eWxlID0gWzI1NSwgMjU1LCAyNTUsIDI1NV07XG4gICAgdGhpcy5saW5lV2lkdGggICA9IDE7XG4gIH1cblxuICAvLyBFbnN1cmUgYHNsb3RzYCBmMzIgY29tbWFuZCBzbG90cyBhcmUgZnJlZTsgZmx1c2ggYSBjb250aW51YXRpb24gY2h1bmsgaWYgbm90LlxuICBfZW5zdXJlKHNsb3RzKSB7XG4gICAgaWYgKHRoaXMuX2ZjICsgc2xvdHMgPiB0aGlzLl9iaW4uY2FwKSB0aGlzLl9mbHVzaENodW5rKCk7XG4gIH1cblxuICAvLyBTZW5kIHRoZSBjdXJyZW50IGJ1ZmZlciBjb250ZW50cyB0byBSdXN0IGFuZCByZXNldCBjdXJzb3JzLiBUaGUgZmlyc3QgY2h1bmtcbiAgLy8gb2YgYSBmcmFtZSByZXBsYWNlcyB0aGUgY2FudmFzIGNvbW1hbmQgbGlzdDsgb3ZlcmZsb3cgY29udGludWF0aW9ucyBhcHBlbmQuXG4gIF9mbHVzaENodW5rKCkge1xuICAgIGNvbnN0IGIgPSB0aGlzLl9iaW47XG4gICAgdHJ5IHtcbiAgICAgIF9fZ2x5eF9jYW52YXNfZmx1c2godGhpcy5faWQsIGIuZjMyLCB0aGlzLl9mYywgYi5zdHIsIHRoaXMuX3NjLCAhdGhpcy5fZmlyc3RDaHVuayk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgX19nbHl4X2xvZygnW2NhbnZhc10gZmx1c2ggZXJyb3I6ICcgKyBlKTtcbiAgICB9XG4gICAgdGhpcy5fZmlyc3RDaHVuayA9IGZhbHNlO1xuICAgIHRoaXMuX2ZjID0gMDtcbiAgICB0aGlzLl9zYyA9IDA7XG4gIH1cblxuICBjbGVhcigpIHtcbiAgICBpZiAoIXRoaXMuX2JpbikgeyB0aGlzLl9jbWRzLmxlbmd0aCA9IDA7IHRoaXMuX2NtZHMucHVzaCh7IHR5cGU6ICdjbGVhcicgfSk7IHJldHVybjsgfVxuICAgIC8vIFN0YXJ0IGEgZnJlc2ggZnJhbWU6IGRpc2NhcmQgcGVuZGluZyBkcmF3cyBhbmQgZW1pdCBhIGNsZWFyLlxuICAgIHRoaXMuX2ZjID0gMDsgdGhpcy5fc2MgPSAwOyB0aGlzLl9maXJzdENodW5rID0gdHJ1ZTtcbiAgICB0aGlzLl9iaW4uZjMyWzBdID0gX09QX0NMRUFSOyB0aGlzLl9mYyA9IDE7XG4gIH1cblxuICBmaWxsUmVjdCh4LCB5LCB3LCBoKSB7XG4gICAgaWYgKCF0aGlzLl9iaW4pIHsgdGhpcy5fY21kcy5wdXNoKHsgdHlwZTogJ2ZpbGxSZWN0JywgeCwgeSwgdywgaCwgY29sb3I6IF9wYXJzZUNvbG9yKHRoaXMuZmlsbFN0eWxlKSB9KTsgcmV0dXJuOyB9XG4gICAgdGhpcy5fZW5zdXJlKDYpO1xuICAgIGNvbnN0IGYgPSB0aGlzLl9iaW4uZjMyLCBwID0gdGhpcy5fZmM7XG4gICAgZltwXSA9IF9PUF9GSUxMUkVDVDsgZltwKzFdID0geDsgZltwKzJdID0geTsgZltwKzNdID0gdzsgZltwKzRdID0gaDtcbiAgICB0aGlzLl9iaW4udTMyW3ArNV0gPSBfcGFja0NvbG9yKHRoaXMuZmlsbFN0eWxlKTtcbiAgICB0aGlzLl9mYyA9IHAgKyA2O1xuICB9XG4gIHN0cm9rZVJlY3QoeCwgeSwgdywgaCkge1xuICAgIGlmICghdGhpcy5fYmluKSB7IHRoaXMuX2NtZHMucHVzaCh7IHR5cGU6ICdzdHJva2VSZWN0JywgeCwgeSwgdywgaCwgY29sb3I6IF9wYXJzZUNvbG9yKHRoaXMuc3Ryb2tlU3R5bGUpLCBsaW5lV2lkdGg6IHRoaXMubGluZVdpZHRoIH0pOyByZXR1cm47IH1cbiAgICB0aGlzLl9lbnN1cmUoNyk7XG4gICAgY29uc3QgZiA9IHRoaXMuX2Jpbi5mMzIsIHAgPSB0aGlzLl9mYztcbiAgICBmW3BdID0gX09QX1NUUk9LRVJFQ1Q7IGZbcCsxXSA9IHg7IGZbcCsyXSA9IHk7IGZbcCszXSA9IHc7IGZbcCs0XSA9IGg7XG4gICAgdGhpcy5fYmluLnUzMltwKzVdID0gX3BhY2tDb2xvcih0aGlzLnN0cm9rZVN0eWxlKTsgZltwKzZdID0gdGhpcy5saW5lV2lkdGg7XG4gICAgdGhpcy5fZmMgPSBwICsgNztcbiAgfVxuICBmaWxsQ2lyY2xlKGN4LCBjeSwgcikge1xuICAgIGlmICghdGhpcy5fYmluKSB7IHRoaXMuX2NtZHMucHVzaCh7IHR5cGU6ICdmaWxsQ2lyY2xlJywgY3gsIGN5LCByLCBjb2xvcjogX3BhcnNlQ29sb3IodGhpcy5maWxsU3R5bGUpIH0pOyByZXR1cm47IH1cbiAgICB0aGlzLl9lbnN1cmUoNSk7XG4gICAgY29uc3QgZiA9IHRoaXMuX2Jpbi5mMzIsIHAgPSB0aGlzLl9mYztcbiAgICBmW3BdID0gX09QX0ZJTExDSVJDTEU7IGZbcCsxXSA9IGN4OyBmW3ArMl0gPSBjeTsgZltwKzNdID0gcjtcbiAgICB0aGlzLl9iaW4udTMyW3ArNF0gPSBfcGFja0NvbG9yKHRoaXMuZmlsbFN0eWxlKTtcbiAgICB0aGlzLl9mYyA9IHAgKyA1O1xuICB9XG4gIHN0cm9rZUNpcmNsZShjeCwgY3ksIHIpIHtcbiAgICBpZiAoIXRoaXMuX2JpbikgeyB0aGlzLl9jbWRzLnB1c2goeyB0eXBlOiAnc3Ryb2tlQ2lyY2xlJywgY3gsIGN5LCByLCBjb2xvcjogX3BhcnNlQ29sb3IodGhpcy5zdHJva2VTdHlsZSksIGxpbmVXaWR0aDogdGhpcy5saW5lV2lkdGggfSk7IHJldHVybjsgfVxuICAgIHRoaXMuX2Vuc3VyZSg2KTtcbiAgICBjb25zdCBmID0gdGhpcy5fYmluLmYzMiwgcCA9IHRoaXMuX2ZjO1xuICAgIGZbcF0gPSBfT1BfU1RST0tFQ0lSQ0xFOyBmW3ArMV0gPSBjeDsgZltwKzJdID0gY3k7IGZbcCszXSA9IHI7XG4gICAgdGhpcy5fYmluLnUzMltwKzRdID0gX3BhY2tDb2xvcih0aGlzLnN0cm9rZVN0eWxlKTsgZltwKzVdID0gdGhpcy5saW5lV2lkdGg7XG4gICAgdGhpcy5fZmMgPSBwICsgNjtcbiAgfVxuICBzdHJva2VMaW5lKHgwLCB5MCwgeDEsIHkxKSB7XG4gICAgaWYgKCF0aGlzLl9iaW4pIHsgdGhpcy5fY21kcy5wdXNoKHsgdHlwZTogJ3N0cm9rZUxpbmUnLCB4MCwgeTAsIHgxLCB5MSwgY29sb3I6IF9wYXJzZUNvbG9yKHRoaXMuc3Ryb2tlU3R5bGUpLCBsaW5lV2lkdGg6IHRoaXMubGluZVdpZHRoIH0pOyByZXR1cm47IH1cbiAgICB0aGlzLl9lbnN1cmUoNyk7XG4gICAgY29uc3QgZiA9IHRoaXMuX2Jpbi5mMzIsIHAgPSB0aGlzLl9mYztcbiAgICBmW3BdID0gX09QX1NUUk9LRUxJTkU7IGZbcCsxXSA9IHgwOyBmW3ArMl0gPSB5MDsgZltwKzNdID0geDE7IGZbcCs0XSA9IHkxO1xuICAgIHRoaXMuX2Jpbi51MzJbcCs1XSA9IF9wYWNrQ29sb3IodGhpcy5zdHJva2VTdHlsZSk7IGZbcCs2XSA9IHRoaXMubGluZVdpZHRoO1xuICAgIHRoaXMuX2ZjID0gcCArIDc7XG4gIH1cbiAgZmlsbFRleHQodGV4dCwgeCwgeSwgZm9udFNpemUgPSAxNikge1xuICAgIGlmICghdGhpcy5fYmluKSB7IHRoaXMuX2NtZHMucHVzaCh7IHR5cGU6ICdmaWxsVGV4dCcsIHRleHQ6IFN0cmluZyh0ZXh0KSwgeCwgeSwgZm9udFNpemUsIGNvbG9yOiBfcGFyc2VDb2xvcih0aGlzLmZpbGxTdHlsZSkgfSk7IHJldHVybjsgfVxuICAgIGNvbnN0IGIgPSB0aGlzLl9iaW4sIHMgPSBTdHJpbmcodGV4dCk7XG4gICAgLy8gVGhlIGNvbW1hbmQgYW5kIGl0cyBVVEYtOCBieXRlcyBtdXN0IGxpdmUgaW4gdGhlIHNhbWUgY2h1bmsgKG9mZnNldCBpc1xuICAgIC8vIGNodW5rLXJlbGF0aXZlKSwgc28gZmx1c2ggdXAtZnJvbnQgaWYgZWl0aGVyIHJlZ2lvbiBsYWNrcyByb29tLlxuICAgIGlmICh0aGlzLl9mYyArIDcgPiBiLmNhcCB8fCB0aGlzLl9zYyArIHMubGVuZ3RoICogNCA+IGIuc3RyQ2FwKSB0aGlzLl9mbHVzaENodW5rKCk7XG4gICAgY29uc3Qgb2ZmID0gdGhpcy5fc2M7XG4gICAgbGV0IGxlbiA9IDA7XG4gICAgaWYgKGIuZW5jKSB7IGxlbiA9IChiLmVuYy5lbmNvZGVJbnRvKHMsIGIuc3RyLnN1YmFycmF5KHRoaXMuX3NjKSkud3JpdHRlbikgfCAwOyB9XG4gICAgdGhpcy5fc2MgKz0gbGVuO1xuICAgIGNvbnN0IGYgPSBiLmYzMiwgcCA9IHRoaXMuX2ZjO1xuICAgIGZbcF0gPSBfT1BfRklMTFRFWFQ7IGZbcCsxXSA9IHg7IGZbcCsyXSA9IHk7IGZbcCszXSA9IGZvbnRTaXplO1xuICAgIGIudTMyW3ArNF0gPSBfcGFja0NvbG9yKHRoaXMuZmlsbFN0eWxlKTsgZltwKzVdID0gb2ZmOyBmW3ArNl0gPSBsZW47XG4gICAgdGhpcy5fZmMgPSBwICsgNztcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBQYXRoIEFQSSAoY2FudmFzLWxpa2UpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBDdXJ2ZXMgYXJlIHRlc3NlbGxhdGVkIHRvIGxpbmUgc2VnbWVudHMgaW4gSlM7IHRoZSBuYXRpdmUgc2lkZSBvbmx5IGRlYWxzXG4gIC8vIHdpdGggcG9seWxpbmVzL3BvbHlnb25zLiBTaW5nbGUgc3VicGF0aCBwZXIgYmVnaW5cdTIxOTJmaWxsL3N0cm9rZS5cblxuICBiZWdpblBhdGgoKSB7IHRoaXMuX3BhdGgubGVuZ3RoID0gMDsgdGhpcy5fcGF0aENsb3NlZCA9IGZhbHNlOyB9XG4gIG1vdmVUbyh4LCB5KSB7IHRoaXMuX3BhdGgucHVzaCh4LCB5KTsgfVxuICBsaW5lVG8oeCwgeSkgeyB0aGlzLl9wYXRoLnB1c2goeCwgeSk7IH1cbiAgY2xvc2VQYXRoKCkgeyB0aGlzLl9wYXRoQ2xvc2VkID0gdHJ1ZTsgfVxuXG4gIC8qKiBBcmMgZnJvbSBgYTBgXHUyMTkyYGExYCByYWRpYW5zIChzZXQgYGNjd2AgZm9yIGNvdW50ZXItY2xvY2t3aXNlKS4gKi9cbiAgYXJjKGN4LCBjeSwgciwgYTAsIGExLCBjY3cgPSBmYWxzZSkge1xuICAgIGxldCBzdGFydCA9IGEwLCBlbmQgPSBhMTtcbiAgICBpZiAoY2N3ICYmIGVuZCA+IHN0YXJ0KSBlbmQgLT0gTWF0aC5QSSAqIDI7XG4gICAgaWYgKCFjY3cgJiYgZW5kIDwgc3RhcnQpIGVuZCArPSBNYXRoLlBJICogMjtcbiAgICBjb25zdCBzd2VlcCA9IE1hdGguYWJzKGVuZCAtIHN0YXJ0KTtcbiAgICBjb25zdCBzZWdzICA9IE1hdGgubWF4KDYsIE1hdGguY2VpbChzd2VlcCAvIChNYXRoLlBJIC8gMTYpKSk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gc2VnczsgaSsrKSB7XG4gICAgICBjb25zdCB0ID0gc3RhcnQgKyAoZW5kIC0gc3RhcnQpICogKGkgLyBzZWdzKTtcbiAgICAgIHRoaXMuX3BhdGgucHVzaChjeCArIE1hdGguY29zKHQpICogciwgY3kgKyBNYXRoLnNpbih0KSAqIHIpO1xuICAgIH1cbiAgfVxuXG4gIHF1YWRyYXRpY0N1cnZlVG8oY3B4LCBjcHksIHgsIHkpIHtcbiAgICBjb25zdCBuID0gdGhpcy5fcGF0aC5sZW5ndGg7XG4gICAgY29uc3QgeDAgPSBuID49IDIgPyB0aGlzLl9wYXRoW24gLSAyXSA6IGNweDtcbiAgICBjb25zdCB5MCA9IG4gPj0gMiA/IHRoaXMuX3BhdGhbbiAtIDFdIDogY3B5O1xuICAgIGNvbnN0IHNlZ3MgPSAxNjtcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8PSBzZWdzOyBpKyspIHtcbiAgICAgIGNvbnN0IHQgPSBpIC8gc2VncywgbXQgPSAxIC0gdDtcbiAgICAgIHRoaXMuX3BhdGgucHVzaChtdCAqIG10ICogeDAgKyAyICogbXQgKiB0ICogY3B4ICsgdCAqIHQgKiB4LFxuICAgICAgICAgICAgICAgICAgICAgIG10ICogbXQgKiB5MCArIDIgKiBtdCAqIHQgKiBjcHkgKyB0ICogdCAqIHkpO1xuICAgIH1cbiAgfVxuXG4gIGJlemllckN1cnZlVG8oYzF4LCBjMXksIGMyeCwgYzJ5LCB4LCB5KSB7XG4gICAgY29uc3QgbiA9IHRoaXMuX3BhdGgubGVuZ3RoO1xuICAgIGNvbnN0IHgwID0gbiA+PSAyID8gdGhpcy5fcGF0aFtuIC0gMl0gOiBjMXg7XG4gICAgY29uc3QgeTAgPSBuID49IDIgPyB0aGlzLl9wYXRoW24gLSAxXSA6IGMxeTtcbiAgICBjb25zdCBzZWdzID0gMjA7XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPD0gc2VnczsgaSsrKSB7XG4gICAgICBjb25zdCB0ID0gaSAvIHNlZ3MsIG10ID0gMSAtIHQ7XG4gICAgICBjb25zdCBhID0gbXQgKiBtdCAqIG10LCBiID0gMyAqIG10ICogbXQgKiB0LCBjID0gMyAqIG10ICogdCAqIHQsIGQgPSB0ICogdCAqIHQ7XG4gICAgICB0aGlzLl9wYXRoLnB1c2goYSAqIHgwICsgYiAqIGMxeCArIGMgKiBjMnggKyBkICogeCxcbiAgICAgICAgICAgICAgICAgICAgICBhICogeTAgKyBiICogYzF5ICsgYyAqIGMyeSArIGQgKiB5KTtcbiAgICB9XG4gIH1cblxuICAvKiogRmlsbCB0aGUgY3VycmVudCBwYXRoIGFzIGEgcG9seWdvbiAoYXV0by1jbG9zZWQpLiAqL1xuICBmaWxsKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmxlbmd0aCA8IDYpIHJldHVybjsgLy8gbmVlZCBcdTIyNjUzIHBvaW50c1xuICAgIGlmICh0aGlzLl9iaW4pIHtcbiAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fcGF0aC5sZW5ndGggPj4gMTtcbiAgICAgIGNvbnN0IHNsb3RzID0gMyArIHRoaXMuX3BhdGgubGVuZ3RoOyAvLyBvcCArIGNvdW50ICsgY29sb3IgKyBwb2ludHNcbiAgICAgIGlmIChzbG90cyA+IHRoaXMuX2Jpbi5jYXApIHJldHVybjsgICAvLyBwYXRoIGxhcmdlciB0aGFuIGJ1ZmZlciBcdTIwMTQgc2tpcFxuICAgICAgaWYgKHRoaXMuX2ZjICsgc2xvdHMgPiB0aGlzLl9iaW4uY2FwKSB0aGlzLl9mbHVzaENodW5rKCk7XG4gICAgICBjb25zdCBmID0gdGhpcy5fYmluLmYzMiwgcCA9IHRoaXMuX2ZjO1xuICAgICAgZltwXSA9IF9PUF9GSUxMUEFUSDsgZltwICsgMV0gPSBjb3VudDtcbiAgICAgIHRoaXMuX2Jpbi51MzJbcCArIDJdID0gX3BhY2tDb2xvcih0aGlzLmZpbGxTdHlsZSk7XG4gICAgICBjb25zdCBvID0gcCArIDM7XG4gICAgICBmb3IgKGxldCBrID0gMDsgayA8IHRoaXMuX3BhdGgubGVuZ3RoOyBrKyspIGZbbyArIGtdID0gdGhpcy5fcGF0aFtrXTtcbiAgICAgIHRoaXMuX2ZjID0gbyArIHRoaXMuX3BhdGgubGVuZ3RoO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jbWRzLnB1c2goeyB0eXBlOiAnZmlsbFBhdGgnLCBwb2ludHM6IHRoaXMuX3BhdGguc2xpY2UoKSwgY29sb3I6IF9wYXJzZUNvbG9yKHRoaXMuZmlsbFN0eWxlKSB9KTtcbiAgICB9XG4gIH1cblxuICAvKiogU3Ryb2tlIHRoZSBjdXJyZW50IHBhdGggYXMgYSBwb2x5bGluZSAoY2xvc2VkIGlmIGBjbG9zZVBhdGgoKWAgd2FzIGNhbGxlZCkuICovXG4gIHN0cm9rZSgpIHtcbiAgICBpZiAodGhpcy5fcGF0aC5sZW5ndGggPCA0KSByZXR1cm47XG4gICAgaWYgKHRoaXMuX2Jpbikge1xuICAgICAgY29uc3QgY291bnQgPSB0aGlzLl9wYXRoLmxlbmd0aCA+PiAxO1xuICAgICAgY29uc3Qgc2xvdHMgPSA1ICsgdGhpcy5fcGF0aC5sZW5ndGg7IC8vIG9wICsgY291bnQgKyBjb2xvciArIGxpbmVXICsgY2xvc2VkICsgcG9pbnRzXG4gICAgICBpZiAoc2xvdHMgPiB0aGlzLl9iaW4uY2FwKSByZXR1cm47XG4gICAgICBpZiAodGhpcy5fZmMgKyBzbG90cyA+IHRoaXMuX2Jpbi5jYXApIHRoaXMuX2ZsdXNoQ2h1bmsoKTtcbiAgICAgIGNvbnN0IGYgPSB0aGlzLl9iaW4uZjMyLCBwID0gdGhpcy5fZmM7XG4gICAgICBmW3BdID0gX09QX1NUUk9LRVBBVEg7IGZbcCArIDFdID0gY291bnQ7XG4gICAgICB0aGlzLl9iaW4udTMyW3AgKyAyXSA9IF9wYWNrQ29sb3IodGhpcy5zdHJva2VTdHlsZSk7XG4gICAgICBmW3AgKyAzXSA9IHRoaXMubGluZVdpZHRoOyBmW3AgKyA0XSA9IHRoaXMuX3BhdGhDbG9zZWQgPyAxIDogMDtcbiAgICAgIGNvbnN0IG8gPSBwICsgNTtcbiAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgdGhpcy5fcGF0aC5sZW5ndGg7IGsrKykgZltvICsga10gPSB0aGlzLl9wYXRoW2tdO1xuICAgICAgdGhpcy5fZmMgPSBvICsgdGhpcy5fcGF0aC5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2NtZHMucHVzaCh7IHR5cGU6ICdzdHJva2VQYXRoJywgcG9pbnRzOiB0aGlzLl9wYXRoLnNsaWNlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogX3BhcnNlQ29sb3IodGhpcy5zdHJva2VTdHlsZSksIGxpbmVXaWR0aDogdGhpcy5saW5lV2lkdGgsIGNsb3NlZDogdGhpcy5fcGF0aENsb3NlZCB9KTtcbiAgICB9XG4gIH1cblxuICAvKiogU2VuZCBhY2N1bXVsYXRlZCBkcmF3IGNvbW1hbmRzIHRvIHRoZSBuYXRpdmUgbGF5ZXIuICovXG4gIGZsdXNoKCkge1xuICAgIGlmICh0aGlzLl9iaW4pIHtcbiAgICAgIHRoaXMuX2ZsdXNoQ2h1bmsoKTtcbiAgICAgIHRoaXMuX2ZpcnN0Q2h1bmsgPSB0cnVlOyAvLyBuZXh0IGZyYW1lJ3MgZmlyc3QgY2h1bmsgcmVwbGFjZXMgYWdhaW5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gSlNPTiBmYWxsYmFjay4gQWx3YXlzIGNsZWFyIHRoZSBidWZmZXIsIGV2ZW4gd2hlbiB0aGUgYmluZGluZyBpcyBtaXNzaW5nXG4gICAgLy8gKHNuYXBzaG90L3Rlc3QpLCBzbyBfY21kcyBjYW4ndCBncm93IHVuYm91bmRlZCBhY3Jvc3MgZnJhbWVzLlxuICAgIGlmICh0eXBlb2YgX19nbHl4X2NhbnZhc191cGRhdGUgPT09ICd1bmRlZmluZWQnKSB7IHRoaXMuX2NtZHMubGVuZ3RoID0gMDsgcmV0dXJuOyB9XG4gICAgdHJ5IHtcbiAgICAgIF9fZ2x5eF9jYW52YXNfdXBkYXRlKHRoaXMuX2lkLCBKU09OLnN0cmluZ2lmeSh0aGlzLl9jbWRzKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgX19nbHl4X2xvZygnW2NhbnZhc10gZmx1c2ggZXJyb3I6ICcgKyBlKTtcbiAgICB9XG4gICAgdGhpcy5fY21kcy5sZW5ndGggPSAwO1xuICB9XG59XG5cbi8qKlxuICogQSAyRCBjYW52YXMgbm9kZSBiYWNrZWQgYnkgVmVsbG8gcHJpbWl0aXZlcy5cbiAqXG4gKiBAcGFyYW0ge3sgc3R5bGU/OiBvYmplY3QsIHJlZj86IFJlYWN0LlJlZjxHbHl4Q2FudmFzQ29udGV4dD4gfX0gcHJvcHNcbiAqL1xuZXhwb3J0IGNvbnN0IENhbnZhcyA9IFJlYWN0LmZvcndhcmRSZWYoZnVuY3Rpb24gQ2FudmFzKHsgc3R5bGUsIC4uLnByb3BzIH0sIHJlZikge1xuICBjb25zdCBjdHhSZWYgICA9IHVzZVJlZihudWxsKTtcbiAgY29uc3QgbmF0aXZlSWQgPSB1c2VSZWYobnVsbCk7XG5cbiAgY29uc3Qgb25Nb3VudCA9IHVzZUNhbGxiYWNrKChpZCkgPT4ge1xuICAgIG5hdGl2ZUlkLmN1cnJlbnQgPSBpZDtcbiAgICBjb25zdCBjdHggPSBuZXcgR2x5eENhbnZhc0NvbnRleHQoaWQpO1xuICAgIGN0eFJlZi5jdXJyZW50ID0gY3R4O1xuICAgIGlmIChyZWYpIHtcbiAgICAgIGlmICh0eXBlb2YgcmVmID09PSAnZnVuY3Rpb24nKSByZWYoY3R4KTtcbiAgICAgIGVsc2UgcmVmLmN1cnJlbnQgPSBjdHg7XG4gICAgfVxuICB9LCBbcmVmXSk7XG5cbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycsIHtcbiAgICBfZ2x5eE9uTW91bnQ6IG9uTW91bnQsXG4gICAgc3R5bGUsXG4gICAgLi4ucHJvcHMsXG4gIH0pO1xufSk7XG5cbi8vIFx1MjUwMFx1MjUwMCBDYW52YXMgM0QgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gPENhbnZhczNEIHJlZj17YzNkUmVmfSBzdHlsZT17eyB3aWR0aDogNDAwLCBoZWlnaHQ6IDMwMCB9fSAvPlxuLy9cbi8vIEV4cG9zZXM6XG4vLyAgIGMzZFJlZi5jdXJyZW50LnVwZGF0ZVNjZW5lKHNjZW5lKTsgICAvLyBwdXNoIFNjZW5lM0QgSlNPTiBkZXNjcmlwdGlvblxuLy8gICBjM2RSZWYuY3VycmVudC5sb2FkR2x0ZihwYXRoKTsgICAgICAgLy8gcHJlbG9hZCBhIEdMVEYgZmlsZVxuLy9cbi8vIFNjZW5lIHNoYXBlIChhbGwgb3B0aW9uYWwgZmllbGRzKTpcbi8vICAge1xuLy8gICAgIGJhY2tncm91bmQ6IFtyLCBnLCBiLCBhXSwgICAgICAgICAgLy8gYmFja2dyb3VuZCBmaWxsIGNvbG9yIDAuMFx1MjAxMzEuMFxuLy8gICAgIGNhbWVyYToge1xuLy8gICAgICAgcG9zaXRpb246IFt4LCB5LCB6XSxcbi8vICAgICAgIHRhcmdldDogICBbeCwgeSwgel0sXG4vLyAgICAgICB1cDogICAgICAgW3gsIHksIHpdLFxuLy8gICAgICAgZm92RGVnOiAgIDYwLFxuLy8gICAgICAgbmVhcjogICAgIDAuMSxcbi8vICAgICAgIGZhcjogICAgICAxMDAwLFxuLy8gICAgIH0sXG4vLyAgICAgbGlnaHRzOiBbXG4vLyAgICAgICB7IHR5cGU6ICdhbWJpZW50JywgICAgIGNvbG9yOiBbcixnLGIsYV0sIGludGVuc2l0eTogMC4zIH0sXG4vLyAgICAgICB7IHR5cGU6ICdkaXJlY3Rpb25hbCcsIGNvbG9yOiBbcixnLGIsYV0sIGludGVuc2l0eTogMS4wLCBkaXJlY3Rpb246IFt4LHksel0gfSxcbi8vICAgICBdLFxuLy8gICAgIG1lc2hlczogW1xuLy8gICAgICAge1xuLy8gICAgICAgICBnZW9tZXRyeTogeyB0eXBlOiAnYm94JywgICAgd2lkdGg6IDEsIGhlaWdodDogMSwgZGVwdGg6IDEgfSxcbi8vICAgICAgICAgLy8gb3I6ICAgIHsgdHlwZTogJ3NwaGVyZScsIHJhZGl1czogMSwgcmluZ3M6IDIwLCBzZWN0b3JzOiAyMCB9LFxuLy8gICAgICAgICAvLyBvcjogICAgeyB0eXBlOiAncGxhbmUnLCAgd2lkdGg6IDEwLCBkZXB0aDogMTAgfSxcbi8vICAgICAgICAgLy8gb3I6ICAgIHsgdHlwZTogJ2dsdGYnLCAgIHBhdGg6ICcvcGF0aC90by9tb2RlbC5nbGInIH0sXG4vLyAgICAgICAgIHRyYW5zZm9ybTogWzE2IGZsb2F0cywgcm93LW1ham9yIDR4NCBtYXRyaXhdLCAgLy8gaWRlbnRpdHkgYnkgZGVmYXVsdFxuLy8gICAgICAgICBjb2xvcjogICAgIFtyLCBnLCBiLCBhXSxcbi8vICAgICAgIH0sXG4vLyAgICAgXSxcbi8vICAgfVxuXG5jbGFzcyBHbHl4Q2FudmFzM0RDb250ZXh0IHtcbiAgY29uc3RydWN0b3IobmF0aXZlSWQpIHtcbiAgICB0aGlzLl9pZCA9IG5hdGl2ZUlkO1xuICB9XG5cbiAgdXBkYXRlU2NlbmUoc2NlbmUpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9jYW52YXMzZF91cGRhdGUgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIF9fZ2x5eF9jYW52YXMzZF91cGRhdGUodGhpcy5faWQsIEpTT04uc3RyaW5naWZ5KHNjZW5lKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgX19nbHl4X2xvZygnW2NhbnZhczNkXSB1cGRhdGVTY2VuZSBlcnJvcjogJyArIGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRHbHRmKHBhdGgpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9jYW52YXMzZF9sb2FkX2dsdGYgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIF9fZ2x5eF9jYW52YXMzZF9sb2FkX2dsdGYodGhpcy5faWQsIHBhdGgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIF9fZ2x5eF9sb2coJ1tjYW52YXMzZF0gbG9hZEdsdGYgZXJyb3I6ICcgKyBlKTtcbiAgICB9XG4gIH1cblxuICB1bmxvYWRHbHRmKHBhdGgpIHtcbiAgICBpZiAodHlwZW9mIF9fZ2x5eF9jYW52YXMzZF91bmxvYWRfZ2x0ZiA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICBfX2dseXhfY2FudmFzM2RfdW5sb2FkX2dsdGYocGF0aCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIDNEIGNhbnZhcyBub2RlIHJlbmRlcmVkIHZpYSB3Z3B1IGFzIGEgcG9zdC1WZWxsbyBvdmVybGF5LlxuICpcbiAqIEBwYXJhbSB7eyBzdHlsZT86IG9iamVjdCwgcmVmPzogUmVhY3QuUmVmPEdseXhDYW52YXMzRENvbnRleHQ+IH19IHByb3BzXG4gKi9cbmV4cG9ydCBjb25zdCBDYW52YXMzRCA9IFJlYWN0LmZvcndhcmRSZWYoZnVuY3Rpb24gQ2FudmFzM0QoeyBzdHlsZSwgLi4ucHJvcHMgfSwgcmVmKSB7XG4gIGNvbnN0IG9uTW91bnQgPSB1c2VDYWxsYmFjaygoaWQpID0+IHtcbiAgICBjb25zdCBjdHggPSBuZXcgR2x5eENhbnZhczNEQ29udGV4dChpZCk7XG4gICAgaWYgKHJlZikge1xuICAgICAgaWYgKHR5cGVvZiByZWYgPT09ICdmdW5jdGlvbicpIHJlZihjdHgpO1xuICAgICAgZWxzZSByZWYuY3VycmVudCA9IGN0eDtcbiAgICB9XG4gIH0sIFtyZWZdKTtcblxuICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudCgnY2FudmFzM2QnLCB7XG4gICAgX2dseXhPbk1vdW50OiBvbk1vdW50LFxuICAgIHN0eWxlLFxuICAgIC4uLnByb3BzLFxuICB9KTtcbn0pO1xuIiwgImltcG9ydCBSZWFjdCwgeyB1c2VSZWYsIHVzZUVmZmVjdCwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyB2aWRlbyB9IGZyb20gJy4vYXBpLmpzJztcblxuLy8gXHUyNTAwXHUyNTAwIENhbWVyYSBjb21wb25lbnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vL1xuLy8gUmVuZGVycyBhIGxpdmUgY2FtZXJhIHByZXZpZXcgYXMgYSBuYXRpdmUgbm9kZSBcdTIwMTQgZnJhbWVzIE5FVkVSIGNyb3NzIHRoZSBKU1xuLy8gYnJpZGdlLiBKUyBvbmx5IGNvbnRyb2xzIGxpZmVjeWNsZSAob3BlbiAvIGNsb3NlIC8gY2FwdHVyZSAvIHJlY29yZCkuXG4vL1xuLy8gVXNhZ2U6XG4vLyAgIGNvbnN0IGNhbVJlZiA9IHVzZVJlZigpO1xuLy8gICA8Q2FtZXJhIHJlZj17Y2FtUmVmfSBtaXJyb3Igc3R5bGU9e3sgd2lkdGg6IDY0MCwgaGVpZ2h0OiA0ODAgfX0gLz5cbi8vICAgYXdhaXQgY2FtUmVmLmN1cnJlbnQuc3RhcnQoMCk7ICAgICAgIC8vIG9wZW4gZGV2aWNlIGluZGV4IDBcbi8vICAgY29uc3QgcGF0aCA9IGF3YWl0IGNhbVJlZi5jdXJyZW50LmNhcHR1cmUoKTsgICAvLyB0YWtlIHBob3RvIFx1MjE5MiBQTkcgcGF0aFxuLy8gICBjYW1SZWYuY3VycmVudC5zdGFydFJlY29yZCgnL3RtcC9vdXQubXA0Jyk7XG4vLyAgIGNvbnN0IG1wNCA9IGF3YWl0IGNhbVJlZi5jdXJyZW50LnN0b3BSZWNvcmQoKTsgLy8gZmx1c2ggXHUyMTkyIE1QNCBwYXRoXG4vLyAgIGNhbVJlZi5jdXJyZW50LnN0b3AoKTtcblxuZXhwb3J0IGNvbnN0IENhbWVyYSA9IFJlYWN0LmZvcndhcmRSZWYoZnVuY3Rpb24gQ2FtZXJhKHsgbWlycm9yLCBzdHlsZSwgLi4ucmVzdCB9LCByZWYpIHtcbiAgY29uc3QgW2NhbWVyYUhhbmRsZSwgc2V0Q2FtZXJhSGFuZGxlXSA9IFJlYWN0LnVzZVN0YXRlKG51bGwpO1xuXG4gIC8vIEF1dG8tY2xvc2UgdGhlIGNhbWVyYSB3aGVuIHRoaXMgY29tcG9uZW50IHVubW91bnRzIChlLmcuIHRhYiBzd2l0Y2gsIG5hdmlnYXRpb24pLlxuICAvLyBXaXRob3V0IHRoaXMgdGhlIG5hdGl2ZSBjYXB0dXJlIHNlc3Npb24ga2VlcHMgcnVubmluZyBpbiB0aGUgYmFja2dyb3VuZC5cbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKGNhbWVyYUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgICBfX2dseXhfY2FtZXJhX2Nsb3NlKFN0cmluZyhjYW1lcmFIYW5kbGUpKTtcbiAgICAgIH1cbiAgICB9O1xuICB9LCBbY2FtZXJhSGFuZGxlXSk7XG5cbiAgUmVhY3QudXNlSW1wZXJhdGl2ZUhhbmRsZShyZWYsICgpID0+ICh7XG4gICAgLyoqIEByZXR1cm5zIHtudW1iZXJ8bnVsbH0gY3VycmVudCBoYW5kbGUsIG9yIG51bGwgaWYgbm90IG9wZW4gKi9cbiAgICBnZXQgaGFuZGxlKCkgeyByZXR1cm4gY2FtZXJhSGFuZGxlOyB9LFxuXG4gICAgYXN5bmMgc3RhcnQoZGV2aWNlSW5kZXggPSAwKSB7XG4gICAgICBjb25zdCBoYW5kbGUgPSBwYXJzZUludChhd2FpdCBfX2dseXhfY2FtZXJhX29wZW4oZGV2aWNlSW5kZXgpKTtcbiAgICAgIHNldENhbWVyYUhhbmRsZShoYW5kbGUpO1xuICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9LFxuICAgIHN0b3AoKSB7XG4gICAgICBpZiAoY2FtZXJhSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICAgIF9fZ2x5eF9jYW1lcmFfY2xvc2UoU3RyaW5nKGNhbWVyYUhhbmRsZSkpO1xuICAgICAgICBzZXRDYW1lcmFIYW5kbGUobnVsbCk7XG4gICAgICB9XG4gICAgfSxcbiAgICAvKiogQ2FwdHVyZSBjdXJyZW50IGZyYW1lIFx1MjE5MiBQTkcuIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZz59IHBhdGggKi9cbiAgICBhc3luYyBjYXB0dXJlKCkge1xuICAgICAgaWYgKGNhbWVyYUhhbmRsZSA9PT0gbnVsbCkgdGhyb3cgbmV3IEVycm9yKCdDYW1lcmEgbm90IG9wZW4nKTtcbiAgICAgIHJldHVybiBfX2dseXhfY2FtZXJhX2NhcHR1cmUoU3RyaW5nKGNhbWVyYUhhbmRsZSkpO1xuICAgIH0sXG4gICAgLyoqIFN0YXJ0IE1QNCByZWNvcmRpbmcgdmlhIGZmbXBlZy4gQHBhcmFtIHtzdHJpbmd9IG91dHB1dFBhdGggKi9cbiAgICBzdGFydFJlY29yZChvdXRwdXRQYXRoKSB7XG4gICAgICBpZiAoY2FtZXJhSGFuZGxlID09PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoJ0NhbWVyYSBub3Qgb3BlbicpO1xuICAgICAgX19nbHl4X2NhbWVyYV9yZWNvcmRfc3RhcnQoU3RyaW5nKGNhbWVyYUhhbmRsZSksIG91dHB1dFBhdGgpO1xuICAgIH0sXG4gICAgLyoqIFN0b3AgcmVjb3JkaW5nIGFuZCBmbHVzaCBNUDQuIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZz59IHBhdGggKi9cbiAgICBhc3luYyBzdG9wUmVjb3JkKCkge1xuICAgICAgaWYgKGNhbWVyYUhhbmRsZSA9PT0gbnVsbCkgdGhyb3cgbmV3IEVycm9yKCdDYW1lcmEgbm90IG9wZW4nKTtcbiAgICAgIHJldHVybiBfX2dseXhfY2FtZXJhX3JlY29yZF9zdG9wKFN0cmluZyhjYW1lcmFIYW5kbGUpKTtcbiAgICB9LFxuICB9KSwgW2NhbWVyYUhhbmRsZV0pO1xuXG4gIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KCdjYW1lcmEnLCB7XG4gICAgY2FtZXJhSGFuZGxlOiBjYW1lcmFIYW5kbGUsXG4gICAgbWlycm9yOiBtaXJyb3IgPT09IHRydWUsXG4gICAgc3R5bGUsXG4gICAgLi4ucmVzdCxcbiAgfSk7XG59KTtcblxuLy8gXHUyNTAwXHUyNTAwIFZpZGVvIGNvbXBvbmVudCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vXG4vLyBSZW5kZXJzIGEgdmlkZW8gZmlsZSAvIFVSTCBhcyBhIG5hdGl2ZSBub2RlIFx1MjAxNCBmcmFtZXMgTkVWRVIgY3Jvc3MgdGhlIEpTXG4vLyBicmlkZ2UuIFJlcXVpcmVzIGB2aWRlbzogdHJ1ZWAgaW4gZ2x5eC5jb25maWcuanNvbiBBTkQgdGhlIGdseXgtbWVkaWEgRExMXG4vLyB0byBiZSBwcmVzZW50IGluIH4vLmdseXgvY2FjaGUvbWVkaWEvLlxuLy9cbi8vIFVzYWdlOlxuLy8gICBjb25zdCB2aWRSZWYgPSB1c2VSZWYoKTtcbi8vICAgPFZpZGVvIHJlZj17dmlkUmVmfSBzcmM9XCIvcGF0aC90by9tb3ZpZS5tcDRcIlxuLy8gICAgICAgICAgc3R5bGU9e3sgd2lkdGg6IDY0MCwgaGVpZ2h0OiAzNjAgfX1cbi8vICAgICAgICAgIG9uRW5kZWQ9eygpID0+IGNvbnNvbGUubG9nKCdkb25lJyl9IC8+XG4vLyAgIGF3YWl0IHZpZFJlZi5jdXJyZW50LnNlZWsoMzApOyAgIC8vIGp1bXAgdG8gMzAgc1xuLy8gICB2aWRSZWYuY3VycmVudC5jbG9zZSgpOyAgICAgICAgICAvLyByZWxlYXNlIGhhbmRsZSBlYXJseVxuXG5leHBvcnQgY29uc3QgVmlkZW8gPSBSZWFjdC5mb3J3YXJkUmVmKGZ1bmN0aW9uIFZpZGVvKFxuICB7IHNyYywgYXV0b1BsYXkgPSB0cnVlLCBsb29wID0gZmFsc2UsIG9uRW5kZWQsIG9uTWV0YWRhdGEsIG9uVGltZVVwZGF0ZSwgb25FcnJvciwgc3R5bGUsIC4uLnJlc3QgfSxcbiAgcmVmXG4pIHtcbiAgY29uc3QgW3ZpZGVvSGFuZGxlLCBzZXRWaWRlb0hhbmRsZV0gPSBSZWFjdC51c2VTdGF0ZShudWxsKTtcbiAgLy8gTXV0YWJsZSByZWZzIFx1MjAxNCB1cGRhdGVkIGZyb20gZXZlbnQgY2FsbGJhY2tzIHdpdGhvdXQgY2F1c2luZyByZS1yZW5kZXJzLlxuICBjb25zdCBjdXJyZW50VGltZVJlZiA9IFJlYWN0LnVzZVJlZigwKTtcbiAgY29uc3QgZHVyYXRpb25SZWYgICAgPSBSZWFjdC51c2VSZWYoLTEpO1xuXG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFzcmMpIHJldHVybjtcbiAgICBsZXQgaGFuZGxlID0gbnVsbDtcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XG4gICAgY3VycmVudFRpbWVSZWYuY3VycmVudCA9IDA7XG4gICAgZHVyYXRpb25SZWYuY3VycmVudCAgICA9IC0xO1xuICAgIHZpZGVvLm9wZW4oc3JjLCB7XG4gICAgICBvbkVuZGVkOiBsb29wID8gKCkgPT4geyBpZiAoaGFuZGxlICE9PSBudWxsKSB2aWRlby5zZWVrKGhhbmRsZSwgMCk7IH0gOiBvbkVuZGVkLFxuICAgICAgb25NZXRhZGF0YTogKG0pID0+IHtcbiAgICAgICAgZHVyYXRpb25SZWYuY3VycmVudCA9IG0uZHVyYXRpb25TZWNzID8/IC0xO1xuICAgICAgICBpZiAob25NZXRhZGF0YSkgb25NZXRhZGF0YShtKTtcbiAgICAgIH0sXG4gICAgICBvblRpbWVVcGRhdGU6ICh0KSA9PiB7XG4gICAgICAgIGN1cnJlbnRUaW1lUmVmLmN1cnJlbnQgPSB0O1xuICAgICAgICBpZiAob25UaW1lVXBkYXRlKSBvblRpbWVVcGRhdGUodCk7XG4gICAgICB9LFxuICAgICAgb25FcnJvcixcbiAgICB9KS50aGVuKGggPT4ge1xuICAgICAgaWYgKGNhbmNlbGxlZCkgeyB2aWRlby5jbG9zZShoKTsgcmV0dXJuOyB9XG4gICAgICBoYW5kbGUgPSBoO1xuICAgICAgc2V0VmlkZW9IYW5kbGUoaCk7XG4gICAgfSkuY2F0Y2goZSA9PiB7XG4gICAgICBpZiAob25FcnJvcikgb25FcnJvcihlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpO1xuICAgIH0pO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjYW5jZWxsZWQgPSB0cnVlO1xuICAgICAgaWYgKGhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgICB2aWRlby5jbG9zZShoYW5kbGUpO1xuICAgICAgICBoYW5kbGUgPSBudWxsO1xuICAgICAgICBzZXRWaWRlb0hhbmRsZShudWxsKTtcbiAgICAgIH1cbiAgICB9O1xuICB9LCBbc3JjXSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG5cbiAgUmVhY3QudXNlSW1wZXJhdGl2ZUhhbmRsZShyZWYsICgpID0+ICh7XG4gICAgZ2V0IGhhbmRsZSgpICAgICAgeyByZXR1cm4gdmlkZW9IYW5kbGU7IH0sXG4gICAgZ2V0IGN1cnJlbnRUaW1lKCkgeyByZXR1cm4gY3VycmVudFRpbWVSZWYuY3VycmVudDsgfSxcbiAgICBnZXQgZHVyYXRpb24oKSAgICB7IHJldHVybiBkdXJhdGlvblJlZi5jdXJyZW50OyB9LFxuICAgIHNlZWsoc2Vjb25kcykge1xuICAgICAgaWYgKHZpZGVvSGFuZGxlICE9PSBudWxsKSB2aWRlby5zZWVrKHZpZGVvSGFuZGxlLCBzZWNvbmRzKTtcbiAgICB9LFxuICAgIHNldFZvbHVtZSh2b2wpIHtcbiAgICAgIGlmICh2aWRlb0hhbmRsZSAhPT0gbnVsbCkgdmlkZW8uc2V0Vm9sdW1lKHZpZGVvSGFuZGxlLCB2b2wpO1xuICAgIH0sXG4gICAgcGF1c2UoKSB7XG4gICAgICBpZiAodmlkZW9IYW5kbGUgIT09IG51bGwpIHZpZGVvLnBhdXNlKHZpZGVvSGFuZGxlKTtcbiAgICB9LFxuICAgIHBsYXkoKSB7XG4gICAgICBpZiAodmlkZW9IYW5kbGUgIT09IG51bGwpIHZpZGVvLnBsYXkodmlkZW9IYW5kbGUpO1xuICAgIH0sXG4gICAgY2xvc2UoKSB7XG4gICAgICBpZiAodmlkZW9IYW5kbGUgIT09IG51bGwpIHtcbiAgICAgICAgdmlkZW8uY2xvc2UodmlkZW9IYW5kbGUpO1xuICAgICAgICBzZXRWaWRlb0hhbmRsZShudWxsKTtcbiAgICAgIH1cbiAgICB9LFxuICB9KSwgW3ZpZGVvSGFuZGxlXSk7XG5cbiAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoJ3ZpZGVvJywgeyB2aWRlb0hhbmRsZSwgc3R5bGUsIC4uLnJlc3QgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBU2EsVUFBSSxJQUFFLHVCQUFPLElBQUksZUFBZTtBQUFoQyxVQUFrQyxJQUFFLHVCQUFPLElBQUksY0FB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QUFFLENBQUM7QUFBRSxZQUFFLFdBQVM7QUFBQSxRQUFDO0FBQUMsWUFBRyxLQUFHLEVBQUUsYUFBYSxNQUFJLEtBQUssSUFBRSxFQUFFLGNBQWEsRUFBRSxZQUFTLEVBQUUsQ0FBQyxNQUFJLEVBQUUsQ0FBQyxJQUFFLEVBQUUsQ0FBQztBQUFHLGVBQU0sRUFBQyxVQUFTLEdBQUUsTUFBSyxHQUFFLEtBQUksR0FBRSxLQUFJLEdBQUUsT0FBTSxHQUFFLFFBQU8sRUFBRSxRQUFPO0FBQUEsTUFBQztBQUM3YSxlQUFTLEVBQUUsR0FBRSxHQUFFO0FBQUMsZUFBTSxFQUFDLFVBQVMsR0FBRSxNQUFLLEVBQUUsTUFBSyxLQUFJLEdBQUUsS0FBSSxFQUFFLEtBQUksT0FBTSxFQUFFLE9BQU0sUUFBTyxFQUFFLE9BQU07QUFBQSxNQUFDO0FBQUMsZUFBUyxFQUFFLEdBQUU7QUFBQyxlQUFNLGFBQVcsT0FBTyxLQUFHLFNBQU8sS0FBRyxFQUFFLGFBQVc7QUFBQSxNQUFDO0FBQUMsZUFBUyxPQUFPLEdBQUU7QUFBQyxZQUFJLElBQUUsRUFBQyxLQUFJLE1BQUssS0FBSSxLQUFJO0FBQUUsZUFBTSxNQUFJLEVBQUUsUUFBUSxTQUFRLFNBQVNBLElBQUU7QUFBQyxpQkFBTyxFQUFFQSxFQUFDO0FBQUEsUUFBQyxDQUFDO0FBQUEsTUFBQztBQUFDLFVBQUksSUFBRTtBQUFPLGVBQVMsRUFBRSxHQUFFLEdBQUU7QUFBQyxlQUFNLGFBQVcsT0FBTyxLQUFHLFNBQU8sS0FBRyxRQUFNLEVBQUUsTUFBSSxPQUFPLEtBQUcsRUFBRSxHQUFHLElBQUUsRUFBRSxTQUFTLEVBQUU7QUFBQSxNQUFDO0FBQy9XLGVBQVMsRUFBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxZQUFJLElBQUUsT0FBTztBQUFFLFlBQUcsZ0JBQWMsS0FBRyxjQUFZLEVBQUUsS0FBRTtBQUFLLFlBQUksSUFBRTtBQUFHLFlBQUcsU0FBTyxFQUFFLEtBQUU7QUFBQSxZQUFRLFNBQU8sR0FBRTtBQUFBLFVBQUMsS0FBSztBQUFBLFVBQVMs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O0FBQVEsZ0JBQUcsU0FBTyxLQUFHLEdBQUcsR0FBRSxFQUFFLElBQUksR0FBRTtBQUFDLGdCQUFFLGdCQUFjLEdBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFO0FBQUEsWUFBTTtBQUFBLFVBQUM7QUFBQyxZQUFFLFNBQU87QUFBRSxZQUFFLGdCQUFjLEdBQUcsSUFBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsaUJBQU8sR0FBRyxTQUFRLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsaUJBQU8sR0FBRyxNQUFLLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsaUJBQU8sR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsaUJBQU8sR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBQztBQUNoWCxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUcsZUFBYSxPQUFPLEVBQUUsUUFBTyxJQUFFLEVBQUUsR0FBRSxFQUFFLENBQUMsR0FBRSxXQUFVO0FBQUMsY0FBRSxJQUFJO0FBQUEsVUFBQztBQUFFLGNBQUcsU0FBTyxLQUFHLFdBQVMsRUFBRSxRQUFPLElBQUUsRUFBRSxHQUFFLEVBQUUsVUFBUSxHQUFFLFdBQVU7QUFBQyxjQUFFLFVBQVE7QUFBQSxVQUFJO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFFLFNBQU8sS0FBRyxXQUFTLElBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUU7QUFBSyxpQkFBTyxHQUFHLEdBQUUsR0FBRSxHQUFHLEtBQUssTUFBSyxHQUFFLENBQUMsR0FBRSxDQUFDO0FBQUEsUUFBQztBQUFDLGlCQUFTLEtBQUk7QUFBQSxRQUFDO0FBQUMsaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxjQUFJLElBQUUsR0FBRztBQUFFLGNBQUUsV0FBUyxJQUFFLE9BQUs7QUFBRSxjQUFJLElBQUUsRUFBRTtBQUFjLGNBQUcsU0FBTyxLQUFHLFNBQU8sS0FBRyxHQUFHLEdBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFPLEVBQUUsQ0FBQztBQUFFLFlBQUUsZ0JBQWMsQ0FBQyxHQUFFLENBQUM7QUFBRSxpQkFBTztBQUFBLFFBQUM7QUFDN1osaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxjQUFJLElBQUUsR0FBRztBQUFFLGNBQUUsV0FBUyxJQUFFLE9BQUs7QUFBRSxjQUFJLElBQUUsRUFBRTtBQUFjLGNBQUcsU0FBTyxLQUFHLFNBQU8sS0FBRyxHQUFHLEdBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFPLEVBQUUsQ0FBQztBQUFFLGNBQUUsRUFBRTtBQUFFLFlBQUUsZ0JBQWMsQ0FBQyxHQUFFLENBQUM7QUFBRSxpQkFBTztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRyxPQUFLLEtBQUcsSUFBSSxRQUFPLEVBQUUsY0FBWSxFQUFFLFlBQVUsT0FBRyxJQUFFLE9BQUksRUFBRSxnQkFBYztBQUFFLGFBQUcsR0FBRSxDQUFDLE1BQUksSUFBRSxHQUFHLEdBQUUsRUFBRSxTQUFPLEdBQUUsTUFBSSxHQUFFLEVBQUUsWUFBVTtBQUFJLGlCQUFPO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFO0FBQUUsY0FBRSxNQUFJLEtBQUcsSUFBRSxJQUFFLElBQUU7QUFBRSxZQUFFLElBQUU7QUFBRSxjQUFJLElBQUUsR0FBRztBQUFXLGFBQUcsYUFBVyxDQUFDO0FBQUUsY0FBRztBQUFDLGNBQUUsS0FBRSxHQUFFLEVBQUU7QUFBQSxVQUFDLFVBQUM7QUFBUSxnQkFBRSxHQUFFLEdBQUcsYUFBVztBQUFBLFVBQUM7QUFBQSxRQUFDO0FBQUMsaUJBQVMsS0FBSTtBQUFDLGlCQUFPLEdBQUcsRUFBRTtBQUFBLFFBQWE7QUFDemQsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxHQUFHLENBQUM7QUFBRSxjQUFFLEVBQUMsTUFBSyxHQUFFLFFBQU8sR0FBRSxlQUFjLE9BQUcsWUFBVyxNQUFLLE1BQUssS0FBSTtBQUFFLGNBQUcsR0FBRyxDQUFDLEVBQUUsSUFBRyxHQUFFLENBQUM7QUFBQSxtQkFBVSxJQUFFLEdBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQyxHQUFFLFNBQU8sR0FBRTtBQUFDLGdCQUFJLElBQUUsRUFBRTtBQUFFLGVBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLGVBQUcsR0FBRSxHQUFFLENBQUM7QUFBQSxVQUFDO0FBQUEsUUFBQztBQUMvSyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEdBQUcsQ0FBQyxHQUFFLElBQUUsRUFBQyxNQUFLLEdBQUUsUUFBTyxHQUFFLGVBQWMsT0FBRyxZQUFXLE1BQUssTUFBSyxLQUFJO0FBQUUsY0FBRyxHQUFHLENBQUMsRUFBRSxJQUFHLEdBQUUsQ0FBQztBQUFBLGVBQU07QUFBQyxnQkFBSSxJQUFFLEVBQUU7QUFBVSxnQkFBRyxNQUFJLEVBQUUsVUFBUSxTQUFPLEtBQUcsTUFBSSxFQUFFLFdBQVMsSUFBRSxFQUFFLHFCQUFvQixTQUFPLEdBQUcsS0FBRztBQUFDLGtCQUFJLElBQUUsRUFBRSxtQkFBa0IsSUFBRSxFQUFFLEdBQUUsQ0FBQztBQUFFLGdCQUFFLGdCQUFjO0FBQUcsZ0JBQUUsYUFBVztBQUFFLGtCQUFHLEdBQUcsR0FBRSxDQUFDLEdBQUU7QUFBQyxvQkFBSSxJQUFFLEVBQUU7QUFBWSx5QkFBTyxLQUFHLEVBQUUsT0FBSyxHQUFFLEdBQUcsQ0FBQyxNQUFJLEVBQUUsT0FBSyxFQUFFLE1BQUssRUFBRSxPQUFLO0FBQUcsa0JBQUUsY0FBWTtBQUFFO0FBQUEsY0FBTTtBQUFBLFlBQUMsU0FBTyxHQUFFO0FBQUEsWUFBQyxVQUFDO0FBQUEsWUFBUTtBQUFDLGdCQUFFLEdBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLHFCQUFPLE1BQUksSUFBRSxFQUFFLEdBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDLEdBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFVBQUU7QUFBQSxRQUFDO0FBQy9jLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFO0FBQVUsaUJBQU8sTUFBSSxLQUFHLFNBQU8sS0FBRyxNQUFJO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsZUFBRyxLQUFHO0FBQUcsY0FBSSxJQUFFLEVBQUU7QUFBUSxtQkFBTyxJQUFFLEVBQUUsT0FBSyxLQUFHLEVBQUUsT0FBSyxFQUFFLE1BQUssRUFBRSxPQUFLO0FBQUcsWUFBRSxVQUFRO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFHLE9BQUssSUFBRSxVQUFTO0FBQUMsZ0JBQUksSUFBRSxFQUFFO0FBQU0saUJBQUcsRUFBRTtBQUFhLGlCQUFHO0FBQUUsY0FBRSxRQUFNO0FBQUUsZUFBRyxHQUFFLENBQUM7QUFBQSxVQUFDO0FBQUEsUUFBQztBQUM5UCxZQUFJLEtBQUcsRUFBQyxhQUFZLElBQUcsYUFBWSxHQUFFLFlBQVcsR0FBRSxXQUFVLEdBQUUscUJBQW9CLEdBQUUsb0JBQW1CLEdBQUUsaUJBQWdCLEdBQUUsU0FBUSxHQUFFLFlBQVcsR0FBRSxRQUFPLEdBQUUsVUFBUyxHQUFFLGVBQWMsR0FBRSxrQkFBaUIsR0FBRSxlQUFjLEdBQUUsa0JBQWlCLEdBQUUsc0JBQXFCLEdBQUUsT0FBTSxHQUFFLDBCQUF5QixNQUFFLEdBQUUsS0FBRyxFQUFDLGFBQVksSUFBRyxhQUFZLFNBQVMsR0FBRSxHQUFFO0FBQUMsYUFBRyxFQUFFLGdCQUFjLENBQUMsR0FBRSxXQUFTLElBQUUsT0FBSyxDQUFDO0FBQUUsaUJBQU87QUFBQSxRQUFDLEdBQUUsWUFBVyxJQUFHLFdBQVUsSUFBRyxxQkFBb0IsU0FBUyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUUsU0FBTyxLQUFHLFdBQVMsSUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBRTtBQUFLLGlCQUFPO0FBQUEsWUFBRztBQUFBLFlBQzNmO0FBQUEsWUFBRSxHQUFHLEtBQUssTUFBSyxHQUFFLENBQUM7QUFBQSxZQUFFO0FBQUEsVUFBQztBQUFBLFFBQUMsR0FBRSxpQkFBZ0IsU0FBUyxHQUFFLEdBQUU7QUFBQyxpQkFBTyxHQUFHLFNBQVEsR0FBRSxHQUFFLENBQUM7QUFBQSxRQUFDLEdBQUUsb0JBQW1CLFNBQVMsR0FBRSxHQUFFO0FBQUMsaUJBQU8sR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBQyxHQUFFLFNBQVEsU0FBUyxHQUFFLEdBQUU7QUFBQyxjQUFJLElBQUUsR0FBRztBQUFFLGNBQUUsV0FBUyxJQUFFLE9BQUs7QUFBRSxjQUFFLEVBQUU7QUFBRSxZQUFFLGdCQUFjLENBQUMsR0FBRSxDQUFDO0FBQUUsaUJBQU87QUFBQSxRQUFDLEdBQUUsWUFBVyxTQUFTLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEdBQUc7QUFBRSxjQUFFLFdBQVMsSUFBRSxFQUFFLENBQUMsSUFBRTtBQUFFLFlBQUUsZ0JBQWMsRUFBRSxZQUFVO0FBQUUsY0FBRSxFQUFDLFNBQVEsTUFBSyxhQUFZLE1BQUssT0FBTSxHQUFFLFVBQVMsTUFBSyxxQkFBb0IsR0FBRSxtQkFBa0IsRUFBQztBQUFFLFlBQUUsUUFBTTtBQUFFLGNBQUUsRUFBRSxXQUFTLEdBQUcsS0FBSyxNQUFLLEdBQUUsQ0FBQztBQUFFLGlCQUFNLENBQUMsRUFBRSxlQUFjLENBQUM7QUFBQSxRQUFDLEdBQUUsUUFBTyxTQUFTLEdBQUU7QUFBQyxjQUFJLElBQ3JmLEdBQUc7QUFBRSxjQUFFLEVBQUMsU0FBUSxFQUFDO0FBQUUsaUJBQU8sRUFBRSxnQkFBYztBQUFBLFFBQUMsR0FBRSxVQUFTLElBQUcsZUFBYyxJQUFHLGtCQUFpQixTQUFTLEdBQUU7QUFBQyxpQkFBTyxHQUFHLEVBQUUsZ0JBQWM7QUFBQSxRQUFDLEdBQUUsZUFBYyxXQUFVO0FBQUMsY0FBSSxJQUFFLEdBQUcsS0FBRSxHQUFFLElBQUUsRUFBRSxDQUFDO0FBQUUsY0FBRSxHQUFHLEtBQUssTUFBSyxFQUFFLENBQUMsQ0FBQztBQUFFLGFBQUcsRUFBRSxnQkFBYztBQUFFLGlCQUFNLENBQUMsR0FBRSxDQUFDO0FBQUEsUUFBQyxHQUFFLGtCQUFpQixXQUFVO0FBQUEsUUFBQyxHQUFFLHNCQUFxQixTQUFTLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEdBQUUsSUFBRSxHQUFHO0FBQUUsY0FBRyxHQUFFO0FBQUMsZ0JBQUcsV0FBUyxFQUFFLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLGdCQUFFLEVBQUU7QUFBQSxVQUFDLE9BQUs7QUFBQyxnQkFBRSxFQUFFO0FBQUUsZ0JBQUcsU0FBTyxFQUFFLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLG1CQUFLLEtBQUcsT0FBSyxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUEsVUFBQztBQUFDLFlBQUUsZ0JBQWM7QUFBRSxjQUFJLElBQUUsRUFBQyxPQUFNLEdBQUUsYUFBWSxFQUFDO0FBQUUsWUFBRSxRQUFNO0FBQUUsYUFBRyxHQUFHO0FBQUEsWUFBSztBQUFBLFlBQUs7QUFBQSxZQUNwZjtBQUFBLFlBQUU7QUFBQSxVQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUM7QUFBRSxZQUFFLFNBQU87QUFBSyxhQUFHLEdBQUUsR0FBRyxLQUFLLE1BQUssR0FBRSxHQUFFLEdBQUUsQ0FBQyxHQUFFLFFBQU8sSUFBSTtBQUFFLGlCQUFPO0FBQUEsUUFBQyxHQUFFLE9BQU0sV0FBVTtBQUFDLGNBQUksSUFBRSxHQUFHLEdBQUUsSUFBRSxFQUFFO0FBQWlCLGNBQUcsR0FBRTtBQUFDLGdCQUFJLElBQUU7QUFBRyxnQkFBSSxJQUFFO0FBQUcsaUJBQUcsSUFBRSxFQUFFLEtBQUcsS0FBRyxHQUFHLENBQUMsSUFBRSxJQUFJLFNBQVMsRUFBRSxJQUFFO0FBQUUsZ0JBQUUsTUFBSSxJQUFFLE1BQUk7QUFBRSxnQkFBRTtBQUFLLGdCQUFFLE1BQUksS0FBRyxNQUFJLEVBQUUsU0FBUyxFQUFFO0FBQUcsaUJBQUc7QUFBQSxVQUFHLE1BQU0sS0FBRSxNQUFLLElBQUUsTUFBSSxJQUFFLE1BQUksRUFBRSxTQUFTLEVBQUUsSUFBRTtBQUFJLGlCQUFPLEVBQUUsZ0JBQWM7QUFBQSxRQUFDLEdBQUUsMEJBQXlCLE1BQUUsR0FBRSxLQUFHO0FBQUEsVUFBQyxhQUFZO0FBQUEsVUFBRyxhQUFZO0FBQUEsVUFBRyxZQUFXO0FBQUEsVUFBRyxXQUFVO0FBQUEsVUFBRyxxQkFBb0I7QUFBQSxVQUFHLG9CQUFtQjtBQUFBLFVBQUcsaUJBQWdCO0FBQUEsVUFBRyxTQUFRO0FBQUEsVUFBRyxZQUFXO0FBQUEsVUFBRyxRQUFPO0FBQUEsVUFBRyxVQUFTLFdBQVU7QUFBQyxtQkFBTyxHQUFHLEVBQUU7QUFBQSxVQUFDO0FBQUEsVUFDcmhCLGVBQWM7QUFBQSxVQUFHLGtCQUFpQixTQUFTLEdBQUU7QUFBQyxnQkFBSSxJQUFFLEdBQUc7QUFBRSxtQkFBTyxHQUFHLEdBQUUsRUFBRSxlQUFjLENBQUM7QUFBQSxVQUFDO0FBQUEsVUFBRSxlQUFjLFdBQVU7QUFBQyxnQkFBSSxJQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRSxJQUFFLEdBQUcsRUFBRTtBQUFjLG1CQUFNLENBQUMsR0FBRSxDQUFDO0FBQUEsVUFBQztBQUFBLFVBQUUsa0JBQWlCO0FBQUEsVUFBRyxzQkFBcUI7QUFBQSxVQUFHLE9BQU07QUFBQSxVQUFHLDBCQUF5QjtBQUFBLFFBQUUsR0FBRSxLQUFHLEVBQUMsYUFBWSxJQUFHLGFBQVksSUFBRyxZQUFXLElBQUcsV0FBVSxJQUFHLHFCQUFvQixJQUFHLG9CQUFtQixJQUFHLGlCQUFnQixJQUFHLFNBQVEsSUFBRyxZQUFXLElBQUcsUUFBTyxJQUFHLFVBQVMsV0FBVTtBQUFDLGlCQUFPLEdBQUcsRUFBRTtBQUFBLFFBQUMsR0FBRSxlQUFjLElBQUcsa0JBQWlCLFNBQVMsR0FBRTtBQUFDLGNBQUksSUFBRSxHQUFHO0FBQUUsaUJBQU8sU0FDemYsSUFBRSxFQUFFLGdCQUFjLElBQUUsR0FBRyxHQUFFLEVBQUUsZUFBYyxDQUFDO0FBQUEsUUFBQyxHQUFFLGVBQWMsV0FBVTtBQUFDLGNBQUksSUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUUsSUFBRSxHQUFHLEVBQUU7QUFBYyxpQkFBTSxDQUFDLEdBQUUsQ0FBQztBQUFBLFFBQUMsR0FBRSxrQkFBaUIsSUFBRyxzQkFBcUIsSUFBRyxPQUFNLElBQUcsMEJBQXlCLE1BQUU7QUFBRSxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUcsS0FBRyxFQUFFLGNBQWE7QUFBQyxnQkFBRSxHQUFHLENBQUMsR0FBRSxDQUFDO0FBQUUsZ0JBQUUsRUFBRTtBQUFhLHFCQUFRLEtBQUssRUFBRSxZQUFTLEVBQUUsQ0FBQyxNQUFJLEVBQUUsQ0FBQyxJQUFFLEVBQUUsQ0FBQztBQUFHLG1CQUFPO0FBQUEsVUFBQztBQUFDLGlCQUFPO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUUsRUFBRTtBQUFjLGNBQUUsRUFBRSxHQUFFLENBQUM7QUFBRSxjQUFFLFNBQU8sS0FBRyxXQUFTLElBQUUsSUFBRSxHQUFHLENBQUMsR0FBRSxHQUFFLENBQUM7QUFBRSxZQUFFLGdCQUFjO0FBQUUsZ0JBQUksRUFBRSxVQUFRLEVBQUUsWUFBWSxZQUFVO0FBQUEsUUFBRTtBQUN2ZCxZQUFJLEtBQUcsRUFBQyxXQUFVLFNBQVMsR0FBRTtBQUFDLGtCQUFPLElBQUUsRUFBRSxtQkFBaUIsR0FBRyxDQUFDLE1BQUksSUFBRTtBQUFBLFFBQUUsR0FBRSxpQkFBZ0IsU0FBUyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUUsRUFBRTtBQUFnQixjQUFJLElBQUUsRUFBRSxHQUFFLElBQUUsR0FBRyxDQUFDLEdBQUUsSUFBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLFlBQUUsVUFBUTtBQUFFLHFCQUFTLEtBQUcsU0FBTyxNQUFJLEVBQUUsV0FBUztBQUFHLGNBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLG1CQUFPLE1BQUksR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDLEdBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFFBQUUsR0FBRSxxQkFBb0IsU0FBUyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUUsRUFBRTtBQUFnQixjQUFJLElBQUUsRUFBRSxHQUFFLElBQUUsR0FBRyxDQUFDLEdBQUUsSUFBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLFlBQUUsTUFBSTtBQUFFLFlBQUUsVUFBUTtBQUFFLHFCQUFTLEtBQUcsU0FBTyxNQUFJLEVBQUUsV0FBUztBQUFHLGNBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLG1CQUFPLE1BQUksR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDLEdBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFFBQUUsR0FBRSxvQkFBbUIsU0FBUyxHQUFFLEdBQUU7QUFBQyxjQUFFLEVBQUU7QUFBZ0IsY0FBSSxJQUFFLEVBQUUsR0FBRSxJQUNuZixHQUFHLENBQUMsR0FBRSxJQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUUsWUFBRSxNQUFJO0FBQUUscUJBQVMsS0FBRyxTQUFPLE1BQUksRUFBRSxXQUFTO0FBQUcsY0FBRSxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUUsbUJBQU8sTUFBSSxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBRSxFQUFDO0FBQUUsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRSxFQUFFO0FBQVUsaUJBQU0sZUFBYSxPQUFPLEVBQUUsd0JBQXNCLEVBQUUsc0JBQXNCLEdBQUUsR0FBRSxDQUFDLElBQUUsRUFBRSxhQUFXLEVBQUUsVUFBVSx1QkFBcUIsQ0FBQyxHQUFHLEdBQUUsQ0FBQyxLQUFHLENBQUMsR0FBRyxHQUFFLENBQUMsSUFBRTtBQUFBLFFBQUU7QUFDMVMsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxPQUFHLElBQUU7QUFBRyxjQUFJLElBQUUsRUFBRTtBQUFZLHVCQUFXLE9BQU8sS0FBRyxTQUFPLElBQUUsSUFBRSxHQUFHLENBQUMsS0FBRyxJQUFFLEVBQUUsQ0FBQyxJQUFFLEtBQUcsRUFBRSxTQUFRLElBQUUsRUFBRSxjQUFhLEtBQUcsSUFBRSxTQUFPLEtBQUcsV0FBUyxLQUFHLEdBQUcsR0FBRSxDQUFDLElBQUU7QUFBSSxjQUFFLElBQUksRUFBRSxHQUFFLENBQUM7QUFBRSxZQUFFLGdCQUFjLFNBQU8sRUFBRSxTQUFPLFdBQVMsRUFBRSxRQUFNLEVBQUUsUUFBTTtBQUFLLFlBQUUsVUFBUTtBQUFHLFlBQUUsWUFBVTtBQUFFLFlBQUUsa0JBQWdCO0FBQUUsZ0JBQUksSUFBRSxFQUFFLFdBQVUsRUFBRSw4Q0FBNEMsR0FBRSxFQUFFLDRDQUEwQztBQUFHLGlCQUFPO0FBQUEsUUFBQztBQUMzWixpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFFLEVBQUU7QUFBTSx5QkFBYSxPQUFPLEVBQUUsNkJBQTJCLEVBQUUsMEJBQTBCLEdBQUUsQ0FBQztBQUFFLHlCQUFhLE9BQU8sRUFBRSxvQ0FBa0MsRUFBRSxpQ0FBaUMsR0FBRSxDQUFDO0FBQUUsWUFBRSxVQUFRLEtBQUcsR0FBRyxvQkFBb0IsR0FBRSxFQUFFLE9BQU0sSUFBSTtBQUFBLFFBQUM7QUFDcFEsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUU7QUFBVSxZQUFFLFFBQU07QUFBRSxZQUFFLFFBQU0sRUFBRTtBQUFjLFlBQUUsT0FBSyxDQUFDO0FBQUUsYUFBRyxDQUFDO0FBQUUsY0FBSSxJQUFFLEVBQUU7QUFBWSx1QkFBVyxPQUFPLEtBQUcsU0FBTyxJQUFFLEVBQUUsVUFBUSxHQUFHLENBQUMsS0FBRyxJQUFFLEVBQUUsQ0FBQyxJQUFFLEtBQUcsRUFBRSxTQUFRLEVBQUUsVUFBUSxHQUFHLEdBQUUsQ0FBQztBQUFHLFlBQUUsUUFBTSxFQUFFO0FBQWMsY0FBRSxFQUFFO0FBQXlCLHlCQUFhLE9BQU8sTUFBSSxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUMsR0FBRSxFQUFFLFFBQU0sRUFBRTtBQUFlLHlCQUFhLE9BQU8sRUFBRSw0QkFBMEIsZUFBYSxPQUFPLEVBQUUsMkJBQXlCLGVBQWEsT0FBTyxFQUFFLDZCQUEyQixlQUFhLE9BQU8sRUFBRSx1QkFBcUIsSUFBRSxFQUFFLE9BQ3BmLGVBQWEsT0FBTyxFQUFFLHNCQUFvQixFQUFFLG1CQUFtQixHQUFFLGVBQWEsT0FBTyxFQUFFLDZCQUEyQixFQUFFLDBCQUEwQixHQUFFLE1BQUksRUFBRSxTQUFPLEdBQUcsb0JBQW9CLEdBQUUsRUFBRSxPQUFNLElBQUksR0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUMsR0FBRSxFQUFFLFFBQU0sRUFBRTtBQUFlLHlCQUFhLE9BQU8sRUFBRSxzQkFBb0IsRUFBRSxTQUFPO0FBQUEsUUFBUTtBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsY0FBRztBQUFDLGdCQUFJLElBQUUsSUFBRyxJQUFFO0FBQUU7QUFBRyxtQkFBRyxHQUFHLENBQUMsR0FBRSxJQUFFLEVBQUU7QUFBQSxtQkFBYTtBQUFHLGdCQUFJLElBQUU7QUFBQSxVQUFDLFNBQU8sR0FBRTtBQUFDLGdCQUFFLCtCQUE2QixFQUFFLFVBQVEsT0FBSyxFQUFFO0FBQUEsVUFBSztBQUFDLGlCQUFNLEVBQUMsT0FBTSxHQUFFLFFBQU8sR0FBRSxPQUFNLEdBQUUsUUFBTyxLQUFJO0FBQUEsUUFBQztBQUMxZCxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsaUJBQU0sRUFBQyxPQUFNLEdBQUUsUUFBTyxNQUFLLE9BQU0sUUFBTSxJQUFFLElBQUUsTUFBSyxRQUFPLFFBQU0sSUFBRSxJQUFFLEtBQUk7QUFBQSxRQUFDO0FBQUMsaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxjQUFHO0FBQUMsb0JBQVEsTUFBTSxFQUFFLEtBQUs7QUFBQSxVQUFDLFNBQU8sR0FBRTtBQUFDLHVCQUFXLFdBQVU7QUFBQyxvQkFBTTtBQUFBLFlBQUUsQ0FBQztBQUFBLFVBQUM7QUFBQSxRQUFDO0FBQUMsWUFBSSxLQUFHLGVBQWEsT0FBTyxVQUFRLFVBQVE7QUFBSSxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRSxHQUFHLElBQUcsQ0FBQztBQUFFLFlBQUUsTUFBSTtBQUFFLFlBQUUsVUFBUSxFQUFDLFNBQVEsS0FBSTtBQUFFLGNBQUksSUFBRSxFQUFFO0FBQU0sWUFBRSxXQUFTLFdBQVU7QUFBQyxtQkFBSyxLQUFHLE1BQUcsS0FBRztBQUFHLGVBQUcsR0FBRSxDQUFDO0FBQUEsVUFBQztBQUFFLGlCQUFPO0FBQUEsUUFBQztBQUNyVyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRSxHQUFHLElBQUcsQ0FBQztBQUFFLFlBQUUsTUFBSTtBQUFFLGNBQUksSUFBRSxFQUFFLEtBQUs7QUFBeUIsY0FBRyxlQUFhLE9BQU8sR0FBRTtBQUFDLGdCQUFJLElBQUUsRUFBRTtBQUFNLGNBQUUsVUFBUSxXQUFVO0FBQUMscUJBQU8sRUFBRSxDQUFDO0FBQUEsWUFBQztBQUFFLGNBQUUsV0FBUyxXQUFVO0FBQUMsaUJBQUcsR0FBRSxDQUFDO0FBQUEsWUFBQztBQUFBLFVBQUM7QUFBQyxjQUFJLElBQUUsRUFBRTtBQUFVLG1CQUFPLEtBQUcsZUFBYSxPQUFPLEVBQUUsc0JBQW9CLEVBQUUsV0FBUyxXQUFVO0FBQUMsZUFBRyxHQUFFLENBQUM7QUFBRSwyQkFBYSxPQUFPLE1BQUksU0FBTyxLQUFHLEtBQUcsb0JBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFFLEdBQUcsSUFBSSxJQUFJO0FBQUcsZ0JBQUlELEtBQUUsRUFBRTtBQUFNLGlCQUFLLGtCQUFrQixFQUFFLE9BQU0sRUFBQyxnQkFBZSxTQUFPQSxLQUFFQSxLQUFFLEdBQUUsQ0FBQztBQUFBLFVBQUM7QUFBRyxpQkFBTztBQUFBLFFBQUM7QUFDbmIsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFO0FBQVUsY0FBRyxTQUFPLEdBQUU7QUFBQyxnQkFBRSxFQUFFLFlBQVUsSUFBSTtBQUFHLGdCQUFJLElBQUUsb0JBQUk7QUFBSSxjQUFFLElBQUksR0FBRSxDQUFDO0FBQUEsVUFBQyxNQUFNLEtBQUUsRUFBRSxJQUFJLENBQUMsR0FBRSxXQUFTLE1BQUksSUFBRSxvQkFBSSxPQUFJLEVBQUUsSUFBSSxHQUFFLENBQUM7QUFBRyxZQUFFLElBQUksQ0FBQyxNQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUUsSUFBRSxHQUFHLEtBQUssTUFBSyxHQUFFLEdBQUUsQ0FBQyxHQUFFLEVBQUUsS0FBSyxHQUFFLENBQUM7QUFBQSxRQUFFO0FBQUMsaUJBQVMsR0FBRyxHQUFFO0FBQUMsYUFBRTtBQUFDLGdCQUFJO0FBQUUsZ0JBQUcsSUFBRSxPQUFLLEVBQUUsSUFBSSxLQUFFLEVBQUUsZUFBYyxJQUFFLFNBQU8sSUFBRSxTQUFPLEVBQUUsYUFBVyxPQUFHLFFBQUc7QUFBRyxnQkFBRyxFQUFFLFFBQU87QUFBRSxnQkFBRSxFQUFFO0FBQUEsVUFBTSxTQUFPLFNBQU87QUFBRyxpQkFBTztBQUFBLFFBQUk7QUFDaFcsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFHLE9BQUssRUFBRSxPQUFLLEdBQUcsUUFBTyxNQUFJLElBQUUsRUFBRSxTQUFPLFNBQU8sRUFBRSxTQUFPLEtBQUksRUFBRSxTQUFPLFFBQU8sRUFBRSxTQUFPLFFBQU8sTUFBSSxFQUFFLFFBQU0sU0FBTyxFQUFFLFlBQVUsRUFBRSxNQUFJLE1BQUksSUFBRSxHQUFHLElBQUcsQ0FBQyxHQUFFLEVBQUUsTUFBSSxHQUFFLEdBQUcsR0FBRSxHQUFFLENBQUMsS0FBSSxFQUFFLFNBQU8sSUFBRztBQUFFLFlBQUUsU0FBTztBQUFNLFlBQUUsUUFBTTtBQUFFLGlCQUFPO0FBQUEsUUFBQztBQUFDLFlBQUksS0FBRyxHQUFHLG1CQUFrQixJQUFFO0FBQUcsaUJBQVMsRUFBRSxHQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsWUFBRSxRQUFNLFNBQU8sSUFBRSxHQUFHLEdBQUUsTUFBSyxHQUFFLENBQUMsSUFBRSxHQUFHLEdBQUUsRUFBRSxPQUFNLEdBQUUsQ0FBQztBQUFBLFFBQUM7QUFDalYsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFFLEVBQUU7QUFBTyxjQUFJLElBQUUsRUFBRTtBQUFJLGFBQUcsR0FBRSxDQUFDO0FBQUUsY0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsY0FBRSxHQUFHO0FBQUUsY0FBRyxTQUFPLEtBQUcsQ0FBQyxFQUFFLFFBQU8sRUFBRSxjQUFZLEVBQUUsYUFBWSxFQUFFLFNBQU8sT0FBTSxFQUFFLFNBQU8sQ0FBQyxHQUFFLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSxlQUFHLEtBQUcsR0FBRyxDQUFDO0FBQUUsWUFBRSxTQUFPO0FBQUUsWUFBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsaUJBQU8sRUFBRTtBQUFBLFFBQUs7QUFDdk4saUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFHLFNBQU8sR0FBRTtBQUFDLGdCQUFJLElBQUUsRUFBRTtBQUFLLGdCQUFHLGVBQWEsT0FBTyxLQUFHLENBQUMsR0FBRyxDQUFDLEtBQUcsV0FBUyxFQUFFLGdCQUFjLFNBQU8sRUFBRSxXQUFTLFdBQVMsRUFBRSxhQUFhLFFBQU8sRUFBRSxNQUFJLElBQUcsRUFBRSxPQUFLLEdBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxnQkFBRSxHQUFHLEVBQUUsTUFBSyxNQUFLLEdBQUUsR0FBRSxFQUFFLE1BQUssQ0FBQztBQUFFLGNBQUUsTUFBSSxFQUFFO0FBQUksY0FBRSxTQUFPO0FBQUUsbUJBQU8sRUFBRSxRQUFNO0FBQUEsVUFBQztBQUFDLGNBQUUsRUFBRTtBQUFNLGNBQUcsT0FBSyxFQUFFLFFBQU0sSUFBRztBQUFDLGdCQUFJLElBQUUsRUFBRTtBQUFjLGdCQUFFLEVBQUU7QUFBUSxnQkFBRSxTQUFPLElBQUUsSUFBRTtBQUFHLGdCQUFHLEVBQUUsR0FBRSxDQUFDLEtBQUcsRUFBRSxRQUFNLEVBQUUsSUFBSSxRQUFPLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBQSxVQUFDO0FBQUMsWUFBRSxTQUFPO0FBQUUsY0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLFlBQUUsTUFBSSxFQUFFO0FBQUksWUFBRSxTQUFPO0FBQUUsaUJBQU8sRUFBRSxRQUFNO0FBQUEsUUFBQztBQUMxYixpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUcsU0FBTyxHQUFFO0FBQUMsZ0JBQUksSUFBRSxFQUFFO0FBQWMsZ0JBQUcsR0FBRyxHQUFFLENBQUMsS0FBRyxFQUFFLFFBQU0sRUFBRSxJQUFJLEtBQUcsSUFBRSxPQUFHLEVBQUUsZUFBYSxJQUFFLEdBQUUsT0FBSyxFQUFFLFFBQU0sR0FBRyxRQUFLLEVBQUUsUUFBTSxZQUFVLElBQUU7QUFBQSxnQkFBUyxRQUFPLEVBQUUsUUFBTSxFQUFFLE9BQU0sR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFVBQUM7QUFBQyxpQkFBTyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFBLFFBQUM7QUFDdE4saUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFLGNBQWEsSUFBRSxFQUFFLFVBQVMsSUFBRSxTQUFPLElBQUUsRUFBRSxnQkFBYztBQUFLLGNBQUcsYUFBVyxFQUFFLEtBQUssS0FBRyxPQUFLLEVBQUUsT0FBSyxHQUFHLEdBQUUsZ0JBQWMsRUFBQyxXQUFVLEdBQUUsV0FBVSxNQUFLLGFBQVksS0FBSSxHQUFFLEVBQUUsSUFBRyxFQUFFLEdBQUUsTUFBSTtBQUFBLGVBQU07QUFBQyxnQkFBRyxPQUFLLElBQUUsWUFBWSxRQUFPLElBQUUsU0FBTyxJQUFFLEVBQUUsWUFBVSxJQUFFLEdBQUUsRUFBRSxRQUFNLEVBQUUsYUFBVyxZQUFXLEVBQUUsZ0JBQWMsRUFBQyxXQUFVLEdBQUUsV0FBVSxNQUFLLGFBQVksS0FBSSxHQUFFLEVBQUUsY0FBWSxNQUFLLEVBQUUsSUFBRyxFQUFFLEdBQUUsTUFBSSxHQUFFO0FBQUssY0FBRSxnQkFBYyxFQUFDLFdBQVUsR0FBRSxXQUFVLE1BQUssYUFBWSxLQUFJO0FBQUUsZ0JBQUUsU0FBTyxJQUFFLEVBQUUsWUFBVTtBQUFFLGNBQUUsSUFBRyxFQUFFO0FBQUUsa0JBQUk7QUFBQSxVQUFDO0FBQUEsY0FBTSxVQUN0ZixLQUFHLElBQUUsRUFBRSxZQUFVLEdBQUUsRUFBRSxnQkFBYyxRQUFNLElBQUUsR0FBRSxFQUFFLElBQUcsRUFBRSxHQUFFLE1BQUk7QUFBRSxZQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxpQkFBTyxFQUFFO0FBQUEsUUFBSztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUU7QUFBSSxjQUFHLFNBQU8sS0FBRyxTQUFPLEtBQUcsU0FBTyxLQUFHLEVBQUUsUUFBTSxFQUFFLEdBQUUsU0FBTyxLQUFJLEVBQUUsU0FBTztBQUFBLFFBQU87QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFLENBQUMsSUFBRSxLQUFHLEVBQUU7QUFBUSxjQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUUsYUFBRyxHQUFFLENBQUM7QUFBRSxjQUFFLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxjQUFFLEdBQUc7QUFBRSxjQUFHLFNBQU8sS0FBRyxDQUFDLEVBQUUsUUFBTyxFQUFFLGNBQVksRUFBRSxhQUFZLEVBQUUsU0FBTyxPQUFNLEVBQUUsU0FBTyxDQUFDLEdBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLGVBQUcsS0FBRyxHQUFHLENBQUM7QUFBRSxZQUFFLFNBQU87QUFBRSxZQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxpQkFBTyxFQUFFO0FBQUEsUUFBSztBQUM5WixpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUcsRUFBRSxDQUFDLEdBQUU7QUFBQyxnQkFBSSxJQUFFO0FBQUcsZUFBRyxDQUFDO0FBQUEsVUFBQyxNQUFNLEtBQUU7QUFBRyxhQUFHLEdBQUUsQ0FBQztBQUFFLGNBQUcsU0FBTyxFQUFFLFVBQVUsSUFBRyxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsR0FBRSxDQUFDLEdBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDLEdBQUUsSUFBRTtBQUFBLG1CQUFXLFNBQU8sR0FBRTtBQUFDLGdCQUFJLElBQUUsRUFBRSxXQUFVLElBQUUsRUFBRTtBQUFjLGNBQUUsUUFBTTtBQUFFLGdCQUFJLElBQUUsRUFBRSxTQUFRLElBQUUsRUFBRTtBQUFZLHlCQUFXLE9BQU8sS0FBRyxTQUFPLElBQUUsSUFBRSxHQUFHLENBQUMsS0FBRyxJQUFFLEVBQUUsQ0FBQyxJQUFFLEtBQUcsRUFBRSxTQUFRLElBQUUsR0FBRyxHQUFFLENBQUM7QUFBRyxnQkFBSSxJQUFFLEVBQUUsMEJBQXlCLElBQUUsZUFBYSxPQUFPLEtBQUcsZUFBYSxPQUFPLEVBQUU7QUFBd0IsaUJBQUcsZUFBYSxPQUFPLEVBQUUsb0NBQWtDLGVBQWEsT0FBTyxFQUFFLDhCQUE0QixNQUNyZixLQUFHLE1BQUksTUFBSSxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxpQkFBRztBQUFHLGdCQUFJLElBQUUsRUFBRTtBQUFjLGNBQUUsUUFBTTtBQUFFLGVBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLGdCQUFFLEVBQUU7QUFBYyxrQkFBSSxLQUFHLE1BQUksS0FBRyxFQUFFLFdBQVMsTUFBSSxlQUFhLE9BQU8sTUFBSSxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUMsR0FBRSxJQUFFLEVBQUUsaUJBQWdCLElBQUUsTUFBSSxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLENBQUMsTUFBSSxLQUFHLGVBQWEsT0FBTyxFQUFFLDZCQUEyQixlQUFhLE9BQU8sRUFBRSx1QkFBcUIsZUFBYSxPQUFPLEVBQUUsc0JBQW9CLEVBQUUsbUJBQW1CLEdBQUUsZUFBYSxPQUFPLEVBQUUsNkJBQTJCLEVBQUUsMEJBQTBCLElBQUcsZUFBYSxPQUFPLEVBQUUsc0JBQW9CLEVBQUUsU0FBTyxhQUM1ZSxlQUFhLE9BQU8sRUFBRSxzQkFBb0IsRUFBRSxTQUFPLFVBQVMsRUFBRSxnQkFBYyxHQUFFLEVBQUUsZ0JBQWMsSUFBRyxFQUFFLFFBQU0sR0FBRSxFQUFFLFFBQU0sR0FBRSxFQUFFLFVBQVEsR0FBRSxJQUFFLE1BQUksZUFBYSxPQUFPLEVBQUUsc0JBQW9CLEVBQUUsU0FBTyxVQUFTLElBQUU7QUFBQSxVQUFHLE9BQUs7QUFBQyxnQkFBRSxFQUFFO0FBQVUsZUFBRyxHQUFFLENBQUM7QUFBRSxnQkFBRSxFQUFFO0FBQWMsZ0JBQUUsRUFBRSxTQUFPLEVBQUUsY0FBWSxJQUFFLEdBQUcsRUFBRSxNQUFLLENBQUM7QUFBRSxjQUFFLFFBQU07QUFBRSxnQkFBRSxFQUFFO0FBQWEsZ0JBQUUsRUFBRTtBQUFRLGdCQUFFLEVBQUU7QUFBWSx5QkFBVyxPQUFPLEtBQUcsU0FBTyxJQUFFLElBQUUsR0FBRyxDQUFDLEtBQUcsSUFBRSxFQUFFLENBQUMsSUFBRSxLQUFHLEVBQUUsU0FBUSxJQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUcsZ0JBQUksSUFBRSxFQUFFO0FBQXlCLGFBQUMsSUFBRSxlQUFhLE9BQU8sS0FBRyxlQUFhLE9BQU8sRUFBRSw0QkFDN2UsZUFBYSxPQUFPLEVBQUUsb0NBQWtDLGVBQWEsT0FBTyxFQUFFLDhCQUE0QixNQUFJLEtBQUcsTUFBSSxNQUFJLEdBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLGlCQUFHO0FBQUcsZ0JBQUUsRUFBRTtBQUFjLGNBQUUsUUFBTTtBQUFFLGVBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLGdCQUFJLElBQUUsRUFBRTtBQUFjLGtCQUFJLEtBQUcsTUFBSSxLQUFHLEVBQUUsV0FBUyxNQUFJLGVBQWEsT0FBTyxNQUFJLEdBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQyxHQUFFLElBQUUsRUFBRSxpQkFBZ0IsSUFBRSxNQUFJLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQyxLQUFHLFVBQUssS0FBRyxlQUFhLE9BQU8sRUFBRSw4QkFBNEIsZUFBYSxPQUFPLEVBQUUsd0JBQXNCLGVBQWEsT0FBTyxFQUFFLHVCQUFxQixFQUFFLG9CQUFvQixHQUFFLEdBQUUsQ0FBQyxHQUFFLGVBQWEsT0FBTyxFQUFFLDhCQUMzZixFQUFFLDJCQUEyQixHQUFFLEdBQUUsQ0FBQyxJQUFHLGVBQWEsT0FBTyxFQUFFLHVCQUFxQixFQUFFLFNBQU8sSUFBRyxlQUFhLE9BQU8sRUFBRSw0QkFBMEIsRUFBRSxTQUFPLFVBQVEsZUFBYSxPQUFPLEVBQUUsc0JBQW9CLE1BQUksRUFBRSxpQkFBZSxNQUFJLEVBQUUsa0JBQWdCLEVBQUUsU0FBTyxJQUFHLGVBQWEsT0FBTyxFQUFFLDJCQUF5QixNQUFJLEVBQUUsaUJBQWUsTUFBSSxFQUFFLGtCQUFnQixFQUFFLFNBQU8sT0FBTSxFQUFFLGdCQUFjLEdBQUUsRUFBRSxnQkFBYyxJQUFHLEVBQUUsUUFBTSxHQUFFLEVBQUUsUUFBTSxHQUFFLEVBQUUsVUFBUSxHQUFFLElBQUUsTUFBSSxlQUFhLE9BQU8sRUFBRSxzQkFBb0IsTUFBSSxFQUFFLGlCQUFlLE1BQ2pmLEVBQUUsa0JBQWdCLEVBQUUsU0FBTyxJQUFHLGVBQWEsT0FBTyxFQUFFLDJCQUF5QixNQUFJLEVBQUUsaUJBQWUsTUFBSSxFQUFFLGtCQUFnQixFQUFFLFNBQU8sT0FBTSxJQUFFO0FBQUEsVUFBRztBQUFDLGlCQUFPLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSxRQUFDO0FBQ25LLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxhQUFHLEdBQUUsQ0FBQztBQUFFLGNBQUksSUFBRSxPQUFLLEVBQUUsUUFBTTtBQUFLLGNBQUcsQ0FBQyxLQUFHLENBQUMsRUFBRSxRQUFPLEtBQUcsR0FBRyxHQUFFLEdBQUUsS0FBRSxHQUFFLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSxjQUFFLEVBQUU7QUFBVSxhQUFHLFVBQVE7QUFBRSxjQUFJLElBQUUsS0FBRyxlQUFhLE9BQU8sRUFBRSwyQkFBeUIsT0FBSyxFQUFFLE9BQU87QUFBRSxZQUFFLFNBQU87QUFBRSxtQkFBTyxLQUFHLEtBQUcsRUFBRSxRQUFNLEdBQUcsR0FBRSxFQUFFLE9BQU0sTUFBSyxDQUFDLEdBQUUsRUFBRSxRQUFNLEdBQUcsR0FBRSxNQUFLLEdBQUUsQ0FBQyxLQUFHLEVBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLFlBQUUsZ0JBQWMsRUFBRTtBQUFNLGVBQUcsR0FBRyxHQUFFLEdBQUUsSUFBRTtBQUFFLGlCQUFPLEVBQUU7QUFBQSxRQUFLO0FBQUMsaUJBQVMsR0FBRyxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUU7QUFBVSxZQUFFLGlCQUFlLEdBQUcsR0FBRSxFQUFFLGdCQUFlLEVBQUUsbUJBQWlCLEVBQUUsT0FBTyxJQUFFLEVBQUUsV0FBUyxHQUFHLEdBQUUsRUFBRSxTQUFRLEtBQUU7QUFBRSxhQUFHLEdBQUUsRUFBRSxhQUFhO0FBQUEsUUFBQztBQUMzZSxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGFBQUc7QUFBRSxhQUFHLENBQUM7QUFBRSxZQUFFLFNBQU87QUFBSSxZQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxpQkFBTyxFQUFFO0FBQUEsUUFBSztBQUFDLFlBQUksS0FBRyxFQUFDLFlBQVcsTUFBSyxhQUFZLE1BQUssV0FBVSxFQUFDO0FBQUUsaUJBQVMsR0FBRyxHQUFFO0FBQUMsaUJBQU0sRUFBQyxXQUFVLEdBQUUsV0FBVSxNQUFLLGFBQVksS0FBSTtBQUFBLFFBQUM7QUFDak0saUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFLGNBQWEsSUFBRSxFQUFFLFNBQVEsSUFBRSxPQUFHLElBQUUsT0FBSyxFQUFFLFFBQU0sTUFBSztBQUFFLFdBQUMsSUFBRSxPQUFLLElBQUUsU0FBTyxLQUFHLFNBQU8sRUFBRSxnQkFBYyxRQUFHLE9BQUssSUFBRTtBQUFJLGNBQUcsRUFBRSxLQUFFLE1BQUcsRUFBRSxTQUFPO0FBQUEsbUJBQWEsU0FBTyxLQUFHLFNBQU8sRUFBRSxjQUFjLE1BQUc7QUFBRSxZQUFFLEdBQUUsSUFBRSxDQUFDO0FBQUUsY0FBRyxTQUFPLEdBQUU7QUFBQyxlQUFHLENBQUM7QUFBRSxnQkFBRSxFQUFFO0FBQWMsZ0JBQUcsU0FBTyxNQUFJLElBQUUsRUFBRSxZQUFXLFNBQU8sR0FBRyxRQUFPLE9BQUssRUFBRSxPQUFLLEtBQUcsRUFBRSxRQUFNLElBQUUsR0FBRyxDQUFDLElBQUUsRUFBRSxRQUFNLElBQUUsRUFBRSxRQUFNLFlBQVc7QUFBSyxnQkFBRSxFQUFFO0FBQVMsZ0JBQUUsRUFBRTtBQUFTLG1CQUFPLEtBQUcsSUFBRSxFQUFFLE1BQUssSUFBRSxFQUFFLE9BQU0sSUFBRSxFQUFDLE1BQUssVUFBUyxVQUFTLEVBQUMsR0FBRSxPQUFLLElBQUUsTUFBSSxTQUFPLEtBQUcsRUFBRSxhQUFXLEdBQUUsRUFBRSxlQUFhLEtBQ2xmLElBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxJQUFJLEdBQUUsSUFBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLElBQUksR0FBRSxFQUFFLFNBQU8sR0FBRSxFQUFFLFNBQU8sR0FBRSxFQUFFLFVBQVEsR0FBRSxFQUFFLFFBQU0sR0FBRSxFQUFFLE1BQU0sZ0JBQWMsR0FBRyxDQUFDLEdBQUUsRUFBRSxnQkFBYyxJQUFHLEtBQUcsR0FBRyxHQUFFLENBQUM7QUFBQSxVQUFDO0FBQUMsY0FBRSxFQUFFO0FBQWMsY0FBRyxTQUFPLE1BQUksSUFBRSxFQUFFLFlBQVcsU0FBTyxHQUFHLFFBQU8sR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsY0FBRyxHQUFFO0FBQUMsZ0JBQUUsRUFBRTtBQUFTLGdCQUFFLEVBQUU7QUFBSyxnQkFBRSxFQUFFO0FBQU0sZ0JBQUUsRUFBRTtBQUFRLGdCQUFJLElBQUUsRUFBQyxNQUFLLFVBQVMsVUFBUyxFQUFFLFNBQVE7QUFBRSxtQkFBSyxJQUFFLE1BQUksRUFBRSxVQUFRLEtBQUcsSUFBRSxFQUFFLE9BQU0sRUFBRSxhQUFXLEdBQUUsRUFBRSxlQUFhLEdBQUUsRUFBRSxZQUFVLFNBQU8sSUFBRSxHQUFHLEdBQUUsQ0FBQyxHQUFFLEVBQUUsZUFBYSxFQUFFLGVBQWE7QUFBVSxxQkFBTyxJQUFFLElBQUUsR0FBRyxHQUFFLENBQUMsS0FBRyxJQUFFLEdBQUcsR0FBRSxHQUFFLEdBQUUsSUFBSSxHQUFFLEVBQUUsU0FBTztBQUFHLGNBQUUsU0FDaGY7QUFBRSxjQUFFLFNBQU87QUFBRSxjQUFFLFVBQVE7QUFBRSxjQUFFLFFBQU07QUFBRSxnQkFBRTtBQUFFLGdCQUFFLEVBQUU7QUFBTSxnQkFBRSxFQUFFLE1BQU07QUFBYyxnQkFBRSxTQUFPLElBQUUsR0FBRyxDQUFDLElBQUUsRUFBQyxXQUFVLEVBQUUsWUFBVSxHQUFFLFdBQVUsTUFBSyxhQUFZLEVBQUUsWUFBVztBQUFFLGNBQUUsZ0JBQWM7QUFBRSxjQUFFLGFBQVcsRUFBRSxhQUFXLENBQUM7QUFBRSxjQUFFLGdCQUFjO0FBQUcsbUJBQU87QUFBQSxVQUFDO0FBQUMsY0FBRSxFQUFFO0FBQU0sY0FBRSxFQUFFO0FBQVEsY0FBRSxHQUFHLEdBQUUsRUFBQyxNQUFLLFdBQVUsVUFBUyxFQUFFLFNBQVEsQ0FBQztBQUFFLGlCQUFLLEVBQUUsT0FBSyxPQUFLLEVBQUUsUUFBTTtBQUFHLFlBQUUsU0FBTztBQUFFLFlBQUUsVUFBUTtBQUFLLG1CQUFPLE1BQUksSUFBRSxFQUFFLFdBQVUsU0FBTyxLQUFHLEVBQUUsWUFBVSxDQUFDLENBQUMsR0FBRSxFQUFFLFNBQU8sTUFBSSxFQUFFLEtBQUssQ0FBQztBQUFHLFlBQUUsUUFBTTtBQUFFLFlBQUUsZ0JBQWM7QUFBSyxpQkFBTztBQUFBLFFBQUM7QUFDbmQsaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxjQUFFLEdBQUcsRUFBQyxNQUFLLFdBQVUsVUFBUyxFQUFDLEdBQUUsRUFBRSxNQUFLLEdBQUUsSUFBSTtBQUFFLFlBQUUsU0FBTztBQUFFLGlCQUFPLEVBQUUsUUFBTTtBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxtQkFBTyxLQUFHLEdBQUcsQ0FBQztBQUFFLGFBQUcsR0FBRSxFQUFFLE9BQU0sTUFBSyxDQUFDO0FBQUUsY0FBRSxHQUFHLEdBQUUsRUFBRSxhQUFhLFFBQVE7QUFBRSxZQUFFLFNBQU87QUFBRSxZQUFFLGdCQUFjO0FBQUssaUJBQU87QUFBQSxRQUFDO0FBQy9OLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUcsR0FBRTtBQUFDLGdCQUFHLEVBQUUsUUFBTSxJQUFJLFFBQU8sRUFBRSxTQUFPLE1BQUssSUFBRSxHQUFHLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFFLEdBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLGdCQUFHLFNBQU8sRUFBRSxjQUFjLFFBQU8sRUFBRSxRQUFNLEVBQUUsT0FBTSxFQUFFLFNBQU8sS0FBSTtBQUFLLGdCQUFFLEVBQUU7QUFBUyxnQkFBRSxFQUFFO0FBQUssZ0JBQUUsR0FBRyxFQUFDLE1BQUssV0FBVSxVQUFTLEVBQUUsU0FBUSxHQUFFLEdBQUUsR0FBRSxJQUFJO0FBQUUsZ0JBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxJQUFJO0FBQUUsY0FBRSxTQUFPO0FBQUUsY0FBRSxTQUFPO0FBQUUsY0FBRSxTQUFPO0FBQUUsY0FBRSxVQUFRO0FBQUUsY0FBRSxRQUFNO0FBQUUsbUJBQUssRUFBRSxPQUFLLE1BQUksR0FBRyxHQUFFLEVBQUUsT0FBTSxNQUFLLENBQUM7QUFBRSxjQUFFLE1BQU0sZ0JBQWMsR0FBRyxDQUFDO0FBQUUsY0FBRSxnQkFBYztBQUFHLG1CQUFPO0FBQUEsVUFBQztBQUFDLGNBQUcsT0FBSyxFQUFFLE9BQUssR0FBRyxRQUFPLEdBQUcsR0FBRSxHQUFFLEdBQUUsSUFBSTtBQUFFLGNBQUcsR0FBRyxDQUFDLEVBQUUsUUFBTyxJQUFFLEdBQUcsQ0FBQyxFQUFFLFFBQU8sSUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUUsSUFBRTtBQUFBLFlBQUc7QUFBQSxZQUNuZjtBQUFBLFlBQUU7QUFBQSxVQUFNLEdBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsY0FBRSxPQUFLLElBQUUsRUFBRTtBQUFZLGNBQUcsS0FBRyxHQUFFO0FBQUMsZ0JBQUU7QUFBRSxnQkFBRyxTQUFPLEdBQUU7QUFBQyxzQkFBTyxJQUFFLENBQUMsR0FBRTtBQUFBLGdCQUFDLEtBQUs7QUFBRSxzQkFBRTtBQUFFO0FBQUEsZ0JBQU0sS0FBSztBQUFHLHNCQUFFO0FBQUU7QUFBQSxnQkFBTSxLQUFLO0FBQUEsZ0JBQUcsS0FBSztBQUFBLGdCQUFJLEtBQUs7QUFBQSxnQkFBSSxLQUFLO0FBQUEsZ0JBQUksS0FBSztBQUFBLGdCQUFLLEtBQUs7QUFBQSxnQkFBSyxLQUFLO0FBQUEsZ0JBQUssS0FBSztBQUFBLGdCQUFLLEtBQUs7QUFBQSxnQkFBTSxLQUFLO0FBQUEsZ0JBQU0sS0FBSztBQUFBLGdCQUFNLEtBQUs7QUFBQSxnQkFBTyxLQUFLO0FBQUEsZ0JBQU8sS0FBSztBQUFBLGdCQUFPLEtBQUs7QUFBQSxnQkFBUSxLQUFLO0FBQUEsZ0JBQVEsS0FBSztBQUFBLGdCQUFRLEtBQUs7QUFBQSxnQkFBUSxLQUFLO0FBQUEsZ0JBQVMsS0FBSztBQUFBLGdCQUFTLEtBQUs7QUFBUyxzQkFBRTtBQUFHO0FBQUEsZ0JBQU0sS0FBSztBQUFVLHNCQUFFO0FBQVU7QUFBQSxnQkFBTTtBQUFRLHNCQUFFO0FBQUEsY0FBQztBQUFDLGtCQUFFLE9BQUssS0FBRyxFQUFFLGlCQUFlLE1BQUksSUFBRTtBQUFFLG9CQUFJLEtBQUcsTUFBSSxFQUFFLGNBQVksRUFBRSxZQUFVLEdBQUUsR0FBRyxHQUFFLENBQUMsR0FBRTtBQUFBLGdCQUFHO0FBQUEsZ0JBQUU7QUFBQSxnQkFDcGY7QUFBQSxnQkFBRTtBQUFBLGNBQUU7QUFBQSxZQUFFO0FBQUMsZUFBRztBQUFFLGdCQUFFLEdBQUcsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQUUsbUJBQU8sR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsVUFBQztBQUFDLGNBQUcsR0FBRyxDQUFDLEVBQUUsUUFBTyxFQUFFLFNBQU8sS0FBSSxFQUFFLFFBQU0sRUFBRSxPQUFNLElBQUUsR0FBRyxLQUFLLE1BQUssQ0FBQyxHQUFFLEdBQUcsR0FBRSxDQUFDLEdBQUU7QUFBSyxjQUFFLEVBQUU7QUFBWSxpQkFBSyxLQUFHLEdBQUcsQ0FBQyxHQUFFLEtBQUcsR0FBRSxJQUFFLE1BQUcsS0FBRyxNQUFLLEtBQUcsT0FBRyxTQUFPLE1BQUksR0FBRyxJQUFJLElBQUUsSUFBRyxHQUFHLElBQUksSUFBRSxJQUFHLEdBQUcsSUFBSSxJQUFFLElBQUcsS0FBRyxFQUFFLElBQUcsS0FBRyxFQUFFLFVBQVMsS0FBRztBQUFJLGNBQUUsR0FBRyxHQUFFLEVBQUUsUUFBUTtBQUFFLFlBQUUsU0FBTztBQUFLLGlCQUFPO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxZQUFFLFNBQU87QUFBRSxjQUFJLElBQUUsRUFBRTtBQUFVLG1CQUFPLE1BQUksRUFBRSxTQUFPO0FBQUcsYUFBRyxFQUFFLFFBQU8sR0FBRSxDQUFDO0FBQUEsUUFBQztBQUNsWSxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFO0FBQWMsbUJBQU8sSUFBRSxFQUFFLGdCQUFjLEVBQUMsYUFBWSxHQUFFLFdBQVUsTUFBSyxvQkFBbUIsR0FBRSxNQUFLLEdBQUUsTUFBSyxHQUFFLFVBQVMsRUFBQyxLQUFHLEVBQUUsY0FBWSxHQUFFLEVBQUUsWUFBVSxNQUFLLEVBQUUscUJBQW1CLEdBQUUsRUFBRSxPQUFLLEdBQUUsRUFBRSxPQUFLLEdBQUUsRUFBRSxXQUFTO0FBQUEsUUFBRTtBQUMzTyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUUsY0FBYSxJQUFFLEVBQUUsYUFBWSxJQUFFLEVBQUU7QUFBSyxZQUFFLEdBQUUsR0FBRSxFQUFFLFVBQVMsQ0FBQztBQUFFLGNBQUUsRUFBRTtBQUFRLGNBQUcsT0FBSyxJQUFFLEdBQUcsS0FBRSxJQUFFLElBQUUsR0FBRSxFQUFFLFNBQU87QUFBQSxlQUFRO0FBQUMsZ0JBQUcsU0FBTyxLQUFHLE9BQUssRUFBRSxRQUFNLEtBQUssR0FBRSxNQUFJLElBQUUsRUFBRSxPQUFNLFNBQU8sS0FBRztBQUFDLGtCQUFHLE9BQUssRUFBRSxJQUFJLFVBQU8sRUFBRSxpQkFBZSxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUEsdUJBQVUsT0FBSyxFQUFFLElBQUksSUFBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLHVCQUFVLFNBQU8sRUFBRSxPQUFNO0FBQUMsa0JBQUUsTUFBTSxTQUFPO0FBQUUsb0JBQUUsRUFBRTtBQUFNO0FBQUEsY0FBUTtBQUFDLGtCQUFHLE1BQUksRUFBRSxPQUFNO0FBQUUscUJBQUssU0FBTyxFQUFFLFdBQVM7QUFBQyxvQkFBRyxTQUFPLEVBQUUsVUFBUSxFQUFFLFdBQVMsRUFBRSxPQUFNO0FBQUUsb0JBQUUsRUFBRTtBQUFBLGNBQU07QUFBQyxnQkFBRSxRQUFRLFNBQU8sRUFBRTtBQUFPLGtCQUFFLEVBQUU7QUFBQSxZQUFPO0FBQUMsaUJBQUc7QUFBQSxVQUFDO0FBQUMsWUFBRSxHQUFFLENBQUM7QUFBRSxjQUFHLE9BQUssRUFBRSxPQUFLLEdBQUcsR0FBRSxnQkFDOWU7QUFBQSxjQUFVLFNBQU8sR0FBRTtBQUFBLFlBQUMsS0FBSztBQUFXLGtCQUFFLEVBQUU7QUFBTSxtQkFBSSxJQUFFLE1BQUssU0FBTyxJQUFHLEtBQUUsRUFBRSxXQUFVLFNBQU8sS0FBRyxTQUFPLEdBQUcsQ0FBQyxNQUFJLElBQUUsSUFBRyxJQUFFLEVBQUU7QUFBUSxrQkFBRTtBQUFFLHVCQUFPLEtBQUcsSUFBRSxFQUFFLE9BQU0sRUFBRSxRQUFNLFNBQU8sSUFBRSxFQUFFLFNBQVEsRUFBRSxVQUFRO0FBQU0saUJBQUcsR0FBRSxPQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUU7QUFBQSxZQUFNLEtBQUs7QUFBWSxrQkFBRTtBQUFLLGtCQUFFLEVBQUU7QUFBTSxtQkFBSSxFQUFFLFFBQU0sTUFBSyxTQUFPLEtBQUc7QUFBQyxvQkFBRSxFQUFFO0FBQVUsb0JBQUcsU0FBTyxLQUFHLFNBQU8sR0FBRyxDQUFDLEdBQUU7QUFBQyxvQkFBRSxRQUFNO0FBQUU7QUFBQSxnQkFBSztBQUFDLG9CQUFFLEVBQUU7QUFBUSxrQkFBRSxVQUFRO0FBQUUsb0JBQUU7QUFBRSxvQkFBRTtBQUFBLGNBQUM7QUFBQyxpQkFBRyxHQUFFLE1BQUcsR0FBRSxNQUFLLENBQUM7QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFXLGlCQUFHLEdBQUUsT0FBRyxNQUFLLE1BQUssTUFBTTtBQUFFO0FBQUEsWUFBTTtBQUFRLGdCQUFFLGdCQUFjO0FBQUEsVUFBSTtBQUFDLGlCQUFPLEVBQUU7QUFBQSxRQUFLO0FBQzdkLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsaUJBQUssRUFBRSxPQUFLLE1BQUksU0FBTyxNQUFJLEVBQUUsWUFBVSxNQUFLLEVBQUUsWUFBVSxNQUFLLEVBQUUsU0FBTztBQUFBLFFBQUU7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsbUJBQU8sTUFBSSxFQUFFLGVBQWEsRUFBRTtBQUFjLGdCQUFJLEVBQUU7QUFBTSxjQUFHLE9BQUssSUFBRSxFQUFFLFlBQVksUUFBTztBQUFLLGNBQUcsU0FBTyxLQUFHLEVBQUUsVUFBUSxFQUFFLE1BQU0sT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsY0FBRyxTQUFPLEVBQUUsT0FBTTtBQUFDLGdCQUFFLEVBQUU7QUFBTSxnQkFBRSxHQUFHLEdBQUUsRUFBRSxZQUFZO0FBQUUsY0FBRSxRQUFNO0FBQUUsaUJBQUksRUFBRSxTQUFPLEdBQUUsU0FBTyxFQUFFLFVBQVMsS0FBRSxFQUFFLFNBQVEsSUFBRSxFQUFFLFVBQVEsR0FBRyxHQUFFLEVBQUUsWUFBWSxHQUFFLEVBQUUsU0FBTztBQUFFLGNBQUUsVUFBUTtBQUFBLFVBQUk7QUFBQyxpQkFBTyxFQUFFO0FBQUEsUUFBSztBQUM5YSxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsa0JBQU8sRUFBRSxLQUFJO0FBQUEsWUFBQyxLQUFLO0FBQUUsaUJBQUcsQ0FBQztBQUFFLGlCQUFHO0FBQUU7QUFBQSxZQUFNLEtBQUs7QUFBRSxpQkFBRyxDQUFDO0FBQUU7QUFBQSxZQUFNLEtBQUs7QUFBRSxnQkFBRSxFQUFFLElBQUksS0FBRyxHQUFHLENBQUM7QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFFLGlCQUFHLEdBQUUsRUFBRSxVQUFVLGFBQWE7QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFHLGlCQUFHLEdBQUUsRUFBRSxLQUFLLFVBQVMsRUFBRSxjQUFjLEtBQUs7QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFHLGtCQUFJLElBQUUsRUFBRTtBQUFjLGtCQUFHLFNBQU8sR0FBRTtBQUFDLG9CQUFHLFNBQU8sRUFBRSxXQUFXLFFBQU8sRUFBRSxHQUFFLEVBQUUsVUFBUSxDQUFDLEdBQUUsRUFBRSxTQUFPLEtBQUk7QUFBSyxvQkFBRyxPQUFLLElBQUUsRUFBRSxNQUFNLFlBQVksUUFBTyxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUUsa0JBQUUsR0FBRSxFQUFFLFVBQVEsQ0FBQztBQUFFLG9CQUFFLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSx1QkFBTyxTQUFPLElBQUUsRUFBRSxVQUFRO0FBQUEsY0FBSTtBQUFDLGdCQUFFLEdBQUUsRUFBRSxVQUFRLENBQUM7QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFHLGtCQUFFLE9BQUssSUFBRSxFQUFFO0FBQVksa0JBQUcsT0FBSyxFQUFFLFFBQU0sTUFBSztBQUFDLG9CQUFHLEVBQUUsUUFBTztBQUFBLGtCQUFHO0FBQUEsa0JBQ25nQjtBQUFBLGtCQUFFO0FBQUEsZ0JBQUM7QUFBRSxrQkFBRSxTQUFPO0FBQUEsY0FBRztBQUFDLGtCQUFJLElBQUUsRUFBRTtBQUFjLHVCQUFPLE1BQUksRUFBRSxZQUFVLE1BQUssRUFBRSxPQUFLLE1BQUssRUFBRSxhQUFXO0FBQU0sZ0JBQUUsR0FBRSxFQUFFLE9BQU87QUFBRSxrQkFBRyxFQUFFO0FBQUEsa0JBQVcsUUFBTztBQUFBLFlBQUssS0FBSztBQUFBLFlBQUcsS0FBSztBQUFHLHFCQUFPLEVBQUUsUUFBTSxHQUFFLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBQSxVQUFDO0FBQUMsaUJBQU8sR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxZQUFFLFNBQU87QUFBQSxRQUFDO0FBQUMsaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxjQUFHLFNBQU8sS0FBRyxFQUFFLFVBQVEsRUFBRSxNQUFNLFFBQU07QUFBRyxjQUFHLE9BQUssRUFBRSxRQUFNLElBQUksUUFBTTtBQUFHLGVBQUksSUFBRSxFQUFFLE9BQU0sU0FBTyxLQUFHO0FBQUMsZ0JBQUcsT0FBSyxFQUFFLFFBQU0sVUFBUSxPQUFLLEVBQUUsZUFBYSxPQUFPLFFBQU07QUFBRyxnQkFBRSxFQUFFO0FBQUEsVUFBTztBQUFDLGlCQUFNO0FBQUEsUUFBRTtBQUFDLFlBQUksSUFBRyxJQUFHLElBQUc7QUFDamIsWUFBRyxHQUFHLE1BQUcsU0FBUyxHQUFFLEdBQUU7QUFBQyxtQkFBUSxJQUFFLEVBQUUsT0FBTSxTQUFPLEtBQUc7QUFBQyxnQkFBRyxNQUFJLEVBQUUsT0FBSyxNQUFJLEVBQUUsSUFBSSxJQUFHLEdBQUUsRUFBRSxTQUFTO0FBQUEscUJBQVUsTUFBSSxFQUFFLE9BQUssU0FBTyxFQUFFLE9BQU07QUFBQyxnQkFBRSxNQUFNLFNBQU87QUFBRSxrQkFBRSxFQUFFO0FBQU07QUFBQSxZQUFRO0FBQUMsZ0JBQUcsTUFBSSxFQUFFO0FBQU0sbUJBQUssU0FBTyxFQUFFLFdBQVM7QUFBQyxrQkFBRyxTQUFPLEVBQUUsVUFBUSxFQUFFLFdBQVMsRUFBRTtBQUFPLGtCQUFFLEVBQUU7QUFBQSxZQUFNO0FBQUMsY0FBRSxRQUFRLFNBQU8sRUFBRTtBQUFPLGdCQUFFLEVBQUU7QUFBQSxVQUFPO0FBQUEsUUFBQyxHQUFFLEtBQUcsV0FBVTtBQUFBLFFBQUMsR0FBRSxLQUFHLFNBQVMsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRSxFQUFFO0FBQWMsY0FBRyxNQUFJLEdBQUU7QUFBQyxnQkFBSSxJQUFFLEVBQUUsV0FBVSxJQUFFLEdBQUcsR0FBRyxPQUFPO0FBQUUsZ0JBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLGFBQUMsRUFBRSxjQUFZLE1BQUksR0FBRyxDQUFDO0FBQUEsVUFBQztBQUFBLFFBQUMsR0FBRSxLQUFHLFNBQVMsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGdCQUFJLEtBQUcsR0FBRyxDQUFDO0FBQUEsUUFBQztBQUFBLGlCQUFVLElBQUc7QUFBQyxlQUFHLFNBQVMsR0FDcmYsR0FBRSxHQUFFLEdBQUU7QUFBQyxxQkFBUSxJQUFFLEVBQUUsT0FBTSxTQUFPLEtBQUc7QUFBQyxrQkFBRyxNQUFJLEVBQUUsS0FBSTtBQUFDLG9CQUFJLElBQUUsRUFBRTtBQUFVLHFCQUFHLE1BQUksSUFBRSxHQUFHLEdBQUUsRUFBRSxNQUFLLEVBQUUsZUFBYyxDQUFDO0FBQUcsbUJBQUcsR0FBRSxDQUFDO0FBQUEsY0FBQyxXQUFTLE1BQUksRUFBRSxJQUFJLEtBQUUsRUFBRSxXQUFVLEtBQUcsTUFBSSxJQUFFLEdBQUcsR0FBRSxFQUFFLGVBQWMsQ0FBQyxJQUFHLEdBQUcsR0FBRSxDQUFDO0FBQUEsdUJBQVUsTUFBSSxFQUFFO0FBQUksb0JBQUcsT0FBSyxFQUFFLE9BQUssU0FBTyxFQUFFLGNBQWMsS0FBRSxFQUFFLE9BQU0sU0FBTyxNQUFJLEVBQUUsU0FBTyxJQUFHLEdBQUcsR0FBRSxHQUFFLE1BQUcsSUFBRTtBQUFBLHlCQUFVLFNBQU8sRUFBRSxPQUFNO0FBQUMsb0JBQUUsTUFBTSxTQUFPO0FBQUUsc0JBQUUsRUFBRTtBQUFNO0FBQUEsZ0JBQVE7QUFBQTtBQUFDLGtCQUFHLE1BQUksRUFBRTtBQUFNLHFCQUFLLFNBQU8sRUFBRSxXQUFTO0FBQUMsb0JBQUcsU0FBTyxFQUFFLFVBQVEsRUFBRSxXQUFTLEVBQUU7QUFBTyxvQkFBRSxFQUFFO0FBQUEsY0FBTTtBQUFDLGdCQUFFLFFBQVEsU0FBTyxFQUFFO0FBQU8sa0JBQUUsRUFBRTtBQUFBLFlBQU87QUFBQSxVQUFDO0FBQUUsY0FBSSxLQUFHLFNBQVMsR0FDcGYsR0FBRSxHQUFFLEdBQUU7QUFBQyxxQkFBUSxJQUFFLEVBQUUsT0FBTSxTQUFPLEtBQUc7QUFBQyxrQkFBRyxNQUFJLEVBQUUsS0FBSTtBQUFDLG9CQUFJLElBQUUsRUFBRTtBQUFVLHFCQUFHLE1BQUksSUFBRSxHQUFHLEdBQUUsRUFBRSxNQUFLLEVBQUUsZUFBYyxDQUFDO0FBQUcsbUJBQUcsR0FBRSxDQUFDO0FBQUEsY0FBQyxXQUFTLE1BQUksRUFBRSxJQUFJLEtBQUUsRUFBRSxXQUFVLEtBQUcsTUFBSSxJQUFFLEdBQUcsR0FBRSxFQUFFLGVBQWMsQ0FBQyxJQUFHLEdBQUcsR0FBRSxDQUFDO0FBQUEsdUJBQVUsTUFBSSxFQUFFO0FBQUksb0JBQUcsT0FBSyxFQUFFLE9BQUssU0FBTyxFQUFFLGNBQWMsS0FBRSxFQUFFLE9BQU0sU0FBTyxNQUFJLEVBQUUsU0FBTyxJQUFHLEdBQUcsR0FBRSxHQUFFLE1BQUcsSUFBRTtBQUFBLHlCQUFVLFNBQU8sRUFBRSxPQUFNO0FBQUMsb0JBQUUsTUFBTSxTQUFPO0FBQUUsc0JBQUUsRUFBRTtBQUFNO0FBQUEsZ0JBQVE7QUFBQTtBQUFDLGtCQUFHLE1BQUksRUFBRTtBQUFNLHFCQUFLLFNBQU8sRUFBRSxXQUFTO0FBQUMsb0JBQUcsU0FBTyxFQUFFLFVBQVEsRUFBRSxXQUFTLEVBQUU7QUFBTyxvQkFBRSxFQUFFO0FBQUEsY0FBTTtBQUFDLGdCQUFFLFFBQVEsU0FBTyxFQUFFO0FBQU8sa0JBQUUsRUFBRTtBQUFBLFlBQU87QUFBQSxVQUFDO0FBQUUsZUFBRyxTQUFTLEdBQUUsR0FBRTtBQUFDLGdCQUFJLElBQ3pmLEVBQUU7QUFBVSxnQkFBRyxDQUFDLEdBQUcsR0FBRSxDQUFDLEdBQUU7QUFBQyxrQkFBRSxFQUFFO0FBQWMsa0JBQUksSUFBRSxHQUFHLENBQUM7QUFBRSxpQkFBRyxHQUFFLEdBQUUsT0FBRyxLQUFFO0FBQUUsZ0JBQUUsa0JBQWdCO0FBQUUsaUJBQUcsQ0FBQztBQUFFLGlCQUFHLEdBQUUsQ0FBQztBQUFBLFlBQUM7QUFBQSxVQUFDO0FBQUUsZUFBRyxTQUFTLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGdCQUFJLElBQUUsRUFBRSxXQUFVLElBQUUsRUFBRTtBQUFjLGlCQUFJLElBQUUsR0FBRyxHQUFFLENBQUMsTUFBSSxNQUFJLEVBQUUsR0FBRSxZQUFVO0FBQUEsaUJBQU07QUFBQyxrQkFBSSxJQUFFLEVBQUUsV0FBVSxJQUFFLEdBQUcsR0FBRyxPQUFPLEdBQUUsSUFBRTtBQUFLLG9CQUFJLE1BQUksSUFBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUcsbUJBQUcsU0FBTyxJQUFFLEVBQUUsWUFBVSxLQUFHLElBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQyxLQUFHLEdBQUcsQ0FBQyxHQUFFLEVBQUUsWUFBVSxHQUFFLElBQUUsR0FBRyxDQUFDLElBQUUsR0FBRyxHQUFFLEdBQUUsT0FBRyxLQUFFO0FBQUEsWUFBRTtBQUFBLFVBQUM7QUFBRSxlQUFHLFNBQVMsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGtCQUFJLEtBQUcsSUFBRSxHQUFHLEdBQUcsT0FBTyxHQUFFLElBQUUsR0FBRyxHQUFHLE9BQU8sR0FBRSxFQUFFLFlBQVUsR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDLEdBQUUsR0FBRyxDQUFDLEtBQUcsRUFBRSxZQUFVLEVBQUU7QUFBQSxVQUFTO0FBQUEsUUFBQyxNQUFNLE1BQzFmLFdBQVU7QUFBQSxRQUFDLEdBQUUsS0FBRyxXQUFVO0FBQUEsUUFBQyxHQUFFLEtBQUcsV0FBVTtBQUFBLFFBQUM7QUFBRSxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUcsQ0FBQyxFQUFFLFNBQU8sRUFBRSxVQUFTO0FBQUEsWUFBQyxLQUFLO0FBQVMsa0JBQUUsRUFBRTtBQUFLLHVCQUFRLElBQUUsTUFBSyxTQUFPLElBQUcsVUFBTyxFQUFFLGNBQVksSUFBRSxJQUFHLElBQUUsRUFBRTtBQUFRLHVCQUFPLElBQUUsRUFBRSxPQUFLLE9BQUssRUFBRSxVQUFRO0FBQUs7QUFBQSxZQUFNLEtBQUs7QUFBWSxrQkFBRSxFQUFFO0FBQUssdUJBQVEsSUFBRSxNQUFLLFNBQU8sSUFBRyxVQUFPLEVBQUUsY0FBWSxJQUFFLElBQUcsSUFBRSxFQUFFO0FBQVEsdUJBQU8sSUFBRSxLQUFHLFNBQU8sRUFBRSxPQUFLLEVBQUUsT0FBSyxPQUFLLEVBQUUsS0FBSyxVQUFRLE9BQUssRUFBRSxVQUFRO0FBQUEsVUFBSTtBQUFBLFFBQUM7QUFDelgsaUJBQVMsRUFBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLFNBQU8sRUFBRSxhQUFXLEVBQUUsVUFBVSxVQUFRLEVBQUUsT0FBTSxJQUFFLEdBQUUsSUFBRTtBQUFFLGNBQUcsRUFBRSxVQUFRLElBQUUsRUFBRSxPQUFNLFNBQU8sSUFBRyxNQUFHLEVBQUUsUUFBTSxFQUFFLFlBQVcsS0FBRyxFQUFFLGVBQWEsVUFBUyxLQUFHLEVBQUUsUUFBTSxVQUFTLEVBQUUsU0FBTyxHQUFFLElBQUUsRUFBRTtBQUFBLGNBQWEsTUFBSSxJQUFFLEVBQUUsT0FBTSxTQUFPLElBQUcsTUFBRyxFQUFFLFFBQU0sRUFBRSxZQUFXLEtBQUcsRUFBRSxjQUFhLEtBQUcsRUFBRSxPQUFNLEVBQUUsU0FBTyxHQUFFLElBQUUsRUFBRTtBQUFRLFlBQUUsZ0JBQWM7QUFBRSxZQUFFLGFBQVc7QUFBRSxpQkFBTztBQUFBLFFBQUM7QUFDN1YsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFO0FBQWEsYUFBRyxDQUFDO0FBQUUsa0JBQU8sRUFBRSxLQUFJO0FBQUEsWUFBQyxLQUFLO0FBQUEsWUFBRSxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUEsWUFBRSxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUEsWUFBRSxLQUFLO0FBQUEsWUFBRSxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUEsWUFBRSxLQUFLO0FBQUcscUJBQU8sRUFBRSxDQUFDLEdBQUU7QUFBQSxZQUFLLEtBQUs7QUFBRSxxQkFBTyxFQUFFLEVBQUUsSUFBSSxLQUFHLEdBQUcsR0FBRSxFQUFFLENBQUMsR0FBRTtBQUFBLFlBQUssS0FBSztBQUFFLGtCQUFFLEVBQUU7QUFBVSxpQkFBRztBQUFFLGdCQUFFLENBQUM7QUFBRSxnQkFBRSxDQUFDO0FBQUUsaUJBQUc7QUFBRSxnQkFBRSxtQkFBaUIsRUFBRSxVQUFRLEVBQUUsZ0JBQWUsRUFBRSxpQkFBZTtBQUFNLGtCQUFHLFNBQU8sS0FBRyxTQUFPLEVBQUUsTUFBTSxJQUFHLENBQUMsSUFBRSxHQUFHLENBQUMsSUFBRSxTQUFPLEtBQUcsRUFBRSxjQUFjLGdCQUFjLE9BQUssRUFBRSxRQUFNLFNBQU8sRUFBRSxTQUFPLE1BQUssU0FBTyxPQUFLLEdBQUcsRUFBRSxHQUFFLEtBQUc7QUFBTyxpQkFBRyxHQUFFLENBQUM7QUFBRSxnQkFBRSxDQUFDO0FBQUUscUJBQU87QUFBQSxZQUFLLEtBQUs7QUFBRSxpQkFBRyxDQUFDO0FBQUUsa0JBQUUsR0FBRyxHQUFHLE9BQU87QUFBRSxrQkFBSSxJQUN4ZixFQUFFO0FBQUssa0JBQUcsU0FBTyxLQUFHLFFBQU0sRUFBRSxVQUFVLElBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDLEdBQUUsRUFBRSxRQUFNLEVBQUUsUUFBTSxFQUFFLFNBQU8sS0FBSSxFQUFFLFNBQU87QUFBQSxtQkFBYTtBQUFDLG9CQUFHLENBQUMsR0FBRTtBQUFDLHNCQUFHLFNBQU8sRUFBRSxVQUFVLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLG9CQUFFLENBQUM7QUFBRSx5QkFBTztBQUFBLGdCQUFJO0FBQUMsb0JBQUUsR0FBRyxHQUFHLE9BQU87QUFBRSxvQkFBRyxHQUFHLENBQUMsR0FBRTtBQUFDLHNCQUFHLENBQUMsR0FBRyxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxzQkFBRSxHQUFHLEVBQUUsV0FBVSxFQUFFLE1BQUssRUFBRSxlQUFjLEdBQUUsR0FBRSxHQUFFLENBQUMsRUFBRTtBQUFFLG9CQUFFLGNBQVk7QUFBRSwyQkFBTyxLQUFHLEdBQUcsQ0FBQztBQUFBLGdCQUFDLE9BQUs7QUFBQyxzQkFBSSxJQUFFLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUscUJBQUcsR0FBRSxHQUFFLE9BQUcsS0FBRTtBQUFFLG9CQUFFLFlBQVU7QUFBRSxxQkFBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLENBQUMsS0FBRyxHQUFHLENBQUM7QUFBQSxnQkFBQztBQUFDLHlCQUFPLEVBQUUsUUFBTSxFQUFFLFNBQU8sS0FBSSxFQUFFLFNBQU87QUFBQSxjQUFRO0FBQUMsZ0JBQUUsQ0FBQztBQUFFLHFCQUFPO0FBQUEsWUFBSyxLQUFLO0FBQUUsa0JBQUcsS0FBRyxRQUFNLEVBQUUsVUFBVSxJQUFHLEdBQUUsR0FBRSxFQUFFLGVBQWMsQ0FBQztBQUFBLG1CQUMvZTtBQUFDLG9CQUFHLGFBQVcsT0FBTyxLQUFHLFNBQU8sRUFBRSxVQUFVLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLG9CQUFFLEdBQUcsR0FBRyxPQUFPO0FBQUUsb0JBQUUsR0FBRyxHQUFHLE9BQU87QUFBRSxvQkFBRyxHQUFHLENBQUMsR0FBRTtBQUFDLHNCQUFHLENBQUMsR0FBRyxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxzQkFBRSxFQUFFO0FBQVUsc0JBQUUsRUFBRTtBQUFjLHNCQUFHLElBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDLEVBQUU7QUFBRSx3QkFBRyxJQUFFLElBQUcsU0FBTyxFQUFFLFNBQU8sRUFBRSxLQUFJO0FBQUEsc0JBQUMsS0FBSztBQUFFLDJCQUFHLEVBQUUsVUFBVSxlQUFjLEdBQUUsR0FBRSxPQUFLLEVBQUUsT0FBSyxFQUFFO0FBQUU7QUFBQSxzQkFBTSxLQUFLO0FBQUUsMkJBQUcsRUFBRSxNQUFLLEVBQUUsZUFBYyxFQUFFLFdBQVUsR0FBRSxHQUFFLE9BQUssRUFBRSxPQUFLLEVBQUU7QUFBQSxvQkFBQztBQUFBO0FBQUMsdUJBQUcsR0FBRyxDQUFDO0FBQUEsZ0JBQUMsTUFBTSxHQUFFLFlBQVUsR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsY0FBQztBQUFDLGdCQUFFLENBQUM7QUFBRSxxQkFBTztBQUFBLFlBQUssS0FBSztBQUFHLGdCQUFFLENBQUM7QUFBRSxrQkFBRSxFQUFFO0FBQWMsa0JBQUcsU0FBTyxLQUFHLFNBQU8sRUFBRSxpQkFBZSxTQUFPLEVBQUUsY0FBYyxZQUFXO0FBQUMsb0JBQUcsS0FDN2YsU0FBTyxNQUFJLE9BQUssRUFBRSxPQUFLLE1BQUksT0FBSyxFQUFFLFFBQU0sS0FBSyxJQUFHLEdBQUUsR0FBRyxHQUFFLEVBQUUsU0FBTyxPQUFNLElBQUU7QUFBQSx5QkFBVyxJQUFFLEdBQUcsQ0FBQyxHQUFFLFNBQU8sS0FBRyxTQUFPLEVBQUUsWUFBVztBQUFDLHNCQUFHLFNBQU8sR0FBRTtBQUFDLHdCQUFHLENBQUMsRUFBRSxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSx3QkFBRyxDQUFDLEdBQUcsT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsd0JBQUUsRUFBRTtBQUFjLHdCQUFFLFNBQU8sSUFBRSxFQUFFLGFBQVc7QUFBSyx3QkFBRyxDQUFDLEVBQUUsT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsdUJBQUcsR0FBRSxDQUFDO0FBQUEsa0JBQUMsTUFBTSxJQUFHLEdBQUUsT0FBSyxFQUFFLFFBQU0sU0FBTyxFQUFFLGdCQUFjLE9BQU0sRUFBRSxTQUFPO0FBQUUsb0JBQUUsQ0FBQztBQUFFLHNCQUFFO0FBQUEsZ0JBQUUsTUFBTSxVQUFPLE9BQUssR0FBRyxFQUFFLEdBQUUsS0FBRyxPQUFNLElBQUU7QUFBRyxvQkFBRyxDQUFDLEVBQUUsUUFBTyxFQUFFLFFBQU0sUUFBTSxJQUFFO0FBQUEsY0FBSTtBQUFDLGtCQUFHLE9BQUssRUFBRSxRQUFNLEtBQUssUUFBTyxFQUFFLFFBQU0sR0FBRTtBQUFFLGtCQUFFLFNBQU87QUFBRSxxQkFBSyxTQUFPLEtBQUcsU0FBTyxFQUFFLGtCQUN6ZSxNQUFJLEVBQUUsTUFBTSxTQUFPLE1BQUssT0FBSyxFQUFFLE9BQUssT0FBSyxTQUFPLEtBQUcsT0FBSyxFQUFFLFVBQVEsS0FBRyxNQUFJLE1BQUksSUFBRSxLQUFHLEdBQUc7QUFBSSx1QkFBTyxFQUFFLGdCQUFjLEVBQUUsU0FBTztBQUFHLGdCQUFFLENBQUM7QUFBRSxxQkFBTztBQUFBLFlBQUssS0FBSztBQUFFLHFCQUFPLEdBQUcsR0FBRSxHQUFHLEdBQUUsQ0FBQyxHQUFFLFNBQU8sS0FBRyxHQUFHLEVBQUUsVUFBVSxhQUFhLEdBQUUsRUFBRSxDQUFDLEdBQUU7QUFBQSxZQUFLLEtBQUs7QUFBRyxxQkFBTyxHQUFHLEVBQUUsS0FBSyxRQUFRLEdBQUUsRUFBRSxDQUFDLEdBQUU7QUFBQSxZQUFLLEtBQUs7QUFBRyxxQkFBTyxFQUFFLEVBQUUsSUFBSSxLQUFHLEdBQUcsR0FBRSxFQUFFLENBQUMsR0FBRTtBQUFBLFlBQUssS0FBSztBQUFHLGdCQUFFLENBQUM7QUFBRSxrQkFBRSxFQUFFO0FBQWMsa0JBQUcsU0FBTyxFQUFFLFFBQU8sRUFBRSxDQUFDLEdBQUU7QUFBSyxrQkFBRSxPQUFLLEVBQUUsUUFBTTtBQUFLLGtCQUFFLEVBQUU7QUFBVSxrQkFBRyxTQUFPLEVBQUUsS0FBRyxFQUFFLElBQUcsR0FBRSxLQUFFO0FBQUEsbUJBQU07QUFBQyxvQkFBRyxNQUFJLEtBQUcsU0FBTyxLQUFHLE9BQUssRUFBRSxRQUFNLEtBQUssTUFBSSxJQUFFLEVBQUUsT0FBTSxTQUFPLEtBQUc7QUFBQyxzQkFBRSxHQUFHLENBQUM7QUFBRSxzQkFBRyxTQUN2ZixHQUFFO0FBQUMsc0JBQUUsU0FBTztBQUFJLHVCQUFHLEdBQUUsS0FBRTtBQUFFLHdCQUFFLEVBQUU7QUFBWSw2QkFBTyxNQUFJLEVBQUUsY0FBWSxHQUFFLEVBQUUsU0FBTztBQUFHLHNCQUFFLGVBQWE7QUFBRSx3QkFBRTtBQUFFLHlCQUFJLElBQUUsRUFBRSxPQUFNLFNBQU8sSUFBRyxLQUFFLEdBQUUsSUFBRSxHQUFFLEVBQUUsU0FBTyxVQUFTLElBQUUsRUFBRSxXQUFVLFNBQU8sS0FBRyxFQUFFLGFBQVcsR0FBRSxFQUFFLFFBQU0sR0FBRSxFQUFFLFFBQU0sTUFBSyxFQUFFLGVBQWEsR0FBRSxFQUFFLGdCQUFjLE1BQUssRUFBRSxnQkFBYyxNQUFLLEVBQUUsY0FBWSxNQUFLLEVBQUUsZUFBYSxNQUFLLEVBQUUsWUFBVSxTQUFPLEVBQUUsYUFBVyxFQUFFLFlBQVcsRUFBRSxRQUFNLEVBQUUsT0FBTSxFQUFFLFFBQU0sRUFBRSxPQUFNLEVBQUUsZUFBYSxHQUFFLEVBQUUsWUFBVSxNQUFLLEVBQUUsZ0JBQWMsRUFBRSxlQUFjLEVBQUUsZ0JBQWMsRUFBRSxlQUFjLEVBQUUsY0FBWSxFQUFFLGFBQ3RmLEVBQUUsT0FBSyxFQUFFLE1BQUssSUFBRSxFQUFFLGNBQWEsRUFBRSxlQUFhLFNBQU8sSUFBRSxPQUFLLEVBQUMsT0FBTSxFQUFFLE9BQU0sY0FBYSxFQUFFLGFBQVksSUFBRyxJQUFFLEVBQUU7QUFBUSxzQkFBRSxHQUFFLEVBQUUsVUFBUSxJQUFFLENBQUM7QUFBRSwyQkFBTyxFQUFFO0FBQUEsa0JBQUs7QUFBQyxzQkFBRSxFQUFFO0FBQUEsZ0JBQU87QUFBQyx5QkFBTyxFQUFFLFFBQU0sRUFBRSxJQUFFLE9BQUssRUFBRSxTQUFPLEtBQUksSUFBRSxNQUFHLEdBQUcsR0FBRSxLQUFFLEdBQUUsRUFBRSxRQUFNO0FBQUEsY0FBUTtBQUFBLG1CQUFLO0FBQUMsb0JBQUcsQ0FBQyxFQUFFLEtBQUcsSUFBRSxHQUFHLENBQUMsR0FBRSxTQUFPLEdBQUU7QUFBQyxzQkFBRyxFQUFFLFNBQU8sS0FBSSxJQUFFLE1BQUcsSUFBRSxFQUFFLGFBQVksU0FBTyxNQUFJLEVBQUUsY0FBWSxHQUFFLEVBQUUsU0FBTyxJQUFHLEdBQUcsR0FBRSxJQUFFLEdBQUUsU0FBTyxFQUFFLFFBQU0sYUFBVyxFQUFFLFlBQVUsQ0FBQyxFQUFFLGFBQVcsQ0FBQyxFQUFFLFFBQU8sRUFBRSxDQUFDLEdBQUU7QUFBQSxnQkFBSSxNQUFNLEtBQUUsRUFBRSxJQUFFLEVBQUUscUJBQW1CLE1BQUksZUFBYSxNQUFJLEVBQUUsU0FBTyxLQUFJLElBQUUsTUFBRyxHQUFHLEdBQUUsS0FBRSxHQUFFLEVBQUUsUUFDdGY7QUFBUyxrQkFBRSxlQUFhLEVBQUUsVUFBUSxFQUFFLE9BQU0sRUFBRSxRQUFNLE1BQUksSUFBRSxFQUFFLE1BQUssU0FBTyxJQUFFLEVBQUUsVUFBUSxJQUFFLEVBQUUsUUFBTSxHQUFFLEVBQUUsT0FBSztBQUFBLGNBQUU7QUFBQyxrQkFBRyxTQUFPLEVBQUUsS0FBSyxRQUFPLElBQUUsRUFBRSxNQUFLLEVBQUUsWUFBVSxHQUFFLEVBQUUsT0FBSyxFQUFFLFNBQVEsRUFBRSxxQkFBbUIsRUFBRSxHQUFFLEVBQUUsVUFBUSxNQUFLLElBQUUsRUFBRSxTQUFRLEVBQUUsR0FBRSxJQUFFLElBQUUsSUFBRSxJQUFFLElBQUUsQ0FBQyxHQUFFO0FBQUUsZ0JBQUUsQ0FBQztBQUFFLHFCQUFPO0FBQUEsWUFBSyxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUcscUJBQU8sR0FBRyxHQUFFLElBQUUsU0FBTyxFQUFFLGVBQWMsU0FBTyxLQUFHLFNBQU8sRUFBRSxrQkFBZ0IsTUFBSSxFQUFFLFNBQU8sT0FBTSxLQUFHLE9BQUssRUFBRSxPQUFLLEtBQUcsT0FBSyxLQUFHLGdCQUFjLEVBQUUsQ0FBQyxHQUFFLE1BQUksRUFBRSxlQUFhLE1BQUksRUFBRSxTQUFPLFNBQU8sRUFBRSxDQUFDLEdBQUU7QUFBQSxZQUFLLEtBQUs7QUFBRyxxQkFBTztBQUFBLFlBQUssS0FBSztBQUFHLHFCQUFPO0FBQUEsVUFBSTtBQUFDLGdCQUFNLE1BQU07QUFBQSxZQUFFO0FBQUEsWUFDL2YsRUFBRTtBQUFBLFVBQUcsQ0FBQztBQUFBLFFBQUU7QUFDUixpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGFBQUcsQ0FBQztBQUFFLGtCQUFPLEVBQUUsS0FBSTtBQUFBLFlBQUMsS0FBSztBQUFFLHFCQUFPLEVBQUUsRUFBRSxJQUFJLEtBQUcsR0FBRyxHQUFFLElBQUUsRUFBRSxPQUFNLElBQUUsU0FBTyxFQUFFLFFBQU0sSUFBRSxTQUFPLEtBQUksS0FBRztBQUFBLFlBQUssS0FBSztBQUFFLHFCQUFPLEdBQUcsR0FBRSxFQUFFLENBQUMsR0FBRSxFQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsSUFBRSxFQUFFLE9BQU0sT0FBSyxJQUFFLFVBQVEsT0FBSyxJQUFFLFFBQU0sRUFBRSxRQUFNLElBQUUsU0FBTyxLQUFJLEtBQUc7QUFBQSxZQUFLLEtBQUs7QUFBRSxxQkFBTyxHQUFHLENBQUMsR0FBRTtBQUFBLFlBQUssS0FBSztBQUFHLGdCQUFFLENBQUM7QUFBRSxrQkFBRSxFQUFFO0FBQWMsa0JBQUcsU0FBTyxLQUFHLFNBQU8sRUFBRSxZQUFXO0FBQUMsb0JBQUcsU0FBTyxFQUFFLFVBQVUsT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsbUJBQUc7QUFBQSxjQUFDO0FBQUMsa0JBQUUsRUFBRTtBQUFNLHFCQUFPLElBQUUsU0FBTyxFQUFFLFFBQU0sSUFBRSxTQUFPLEtBQUksS0FBRztBQUFBLFlBQUssS0FBSztBQUFHLHFCQUFPLEVBQUUsQ0FBQyxHQUFFO0FBQUEsWUFBSyxLQUFLO0FBQUUscUJBQU8sR0FBRyxHQUFFO0FBQUEsWUFBSyxLQUFLO0FBQUcscUJBQU8sR0FBRyxFQUFFLEtBQUssUUFBUSxHQUFFO0FBQUEsWUFBSyxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUcscUJBQU8sR0FBRyxHQUMzZ0I7QUFBQSxZQUFLLEtBQUs7QUFBRyxxQkFBTztBQUFBLFlBQUs7QUFBUSxxQkFBTztBQUFBLFVBQUk7QUFBQSxRQUFDO0FBQUMsWUFBSSxLQUFHLE9BQUcsSUFBRSxPQUFHLEtBQUcsZUFBYSxPQUFPLFVBQVEsVUFBUSxLQUFJLElBQUU7QUFBSyxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFO0FBQUksY0FBRyxTQUFPLEVBQUUsS0FBRyxlQUFhLE9BQU8sRUFBRSxLQUFHO0FBQUMsY0FBRSxJQUFJO0FBQUEsVUFBQyxTQUFPLEdBQUU7QUFBQyxjQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsVUFBQztBQUFBLGNBQU0sR0FBRSxVQUFRO0FBQUEsUUFBSTtBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFHO0FBQUMsY0FBRTtBQUFBLFVBQUMsU0FBTyxHQUFFO0FBQUMsY0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFBLFVBQUM7QUFBQSxRQUFDO0FBQUMsWUFBSSxLQUFHO0FBQ3hSLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsYUFBRyxFQUFFLGFBQWE7QUFBRSxlQUFJLElBQUUsR0FBRSxTQUFPLElBQUcsS0FBRyxJQUFFLEdBQUUsSUFBRSxFQUFFLE9BQU0sT0FBSyxFQUFFLGVBQWEsU0FBTyxTQUFPLEVBQUUsR0FBRSxTQUFPLEdBQUUsSUFBRTtBQUFBLGNBQU8sUUFBSyxTQUFPLEtBQUc7QUFBQyxnQkFBRTtBQUFFLGdCQUFHO0FBQUMsa0JBQUksSUFBRSxFQUFFO0FBQVUsa0JBQUcsT0FBSyxFQUFFLFFBQU0sTUFBTSxTQUFPLEVBQUUsS0FBSTtBQUFBLGdCQUFDLEtBQUs7QUFBQSxnQkFBRSxLQUFLO0FBQUEsZ0JBQUcsS0FBSztBQUFHO0FBQUEsZ0JBQU0sS0FBSztBQUFFLHNCQUFHLFNBQU8sR0FBRTtBQUFDLHdCQUFJLElBQUUsRUFBRSxlQUFjLElBQUUsRUFBRSxlQUFjLElBQUUsRUFBRSxXQUFVLElBQUUsRUFBRSx3QkFBd0IsRUFBRSxnQkFBYyxFQUFFLE9BQUssSUFBRSxHQUFHLEVBQUUsTUFBSyxDQUFDLEdBQUUsQ0FBQztBQUFFLHNCQUFFLHNDQUFvQztBQUFBLGtCQUFDO0FBQUM7QUFBQSxnQkFBTSxLQUFLO0FBQUUsd0JBQUksR0FBRyxFQUFFLFVBQVUsYUFBYTtBQUFFO0FBQUEsZ0JBQU0sS0FBSztBQUFBLGdCQUFFLEtBQUs7QUFBQSxnQkFBRSxLQUFLO0FBQUEsZ0JBQUUsS0FBSztBQUFHO0FBQUEsZ0JBQ3BmO0FBQVEsd0JBQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFBLGNBQUU7QUFBQSxZQUFDLFNBQU8sR0FBRTtBQUFDLGdCQUFFLEdBQUUsRUFBRSxRQUFPLENBQUM7QUFBQSxZQUFDO0FBQUMsZ0JBQUUsRUFBRTtBQUFRLGdCQUFHLFNBQU8sR0FBRTtBQUFDLGdCQUFFLFNBQU8sRUFBRTtBQUFPLGtCQUFFO0FBQUU7QUFBQSxZQUFLO0FBQUMsZ0JBQUUsRUFBRTtBQUFBLFVBQU07QUFBQyxjQUFFO0FBQUcsZUFBRztBQUFHLGlCQUFPO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFJLElBQUUsRUFBRTtBQUFZLGNBQUUsU0FBTyxJQUFFLEVBQUUsYUFBVztBQUFLLGNBQUcsU0FBTyxHQUFFO0FBQUMsZ0JBQUksSUFBRSxJQUFFLEVBQUU7QUFBSyxlQUFFO0FBQUMsbUJBQUksRUFBRSxNQUFJLE9BQUssR0FBRTtBQUFDLG9CQUFJLElBQUUsRUFBRTtBQUFRLGtCQUFFLFVBQVE7QUFBTywyQkFBUyxLQUFHLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBQSxjQUFDO0FBQUMsa0JBQUUsRUFBRTtBQUFBLFlBQUksU0FBTyxNQUFJO0FBQUEsVUFBRTtBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUUsRUFBRTtBQUFZLGNBQUUsU0FBTyxJQUFFLEVBQUUsYUFBVztBQUFLLGNBQUcsU0FBTyxHQUFFO0FBQUMsZ0JBQUksSUFBRSxJQUFFLEVBQUU7QUFBSyxlQUFFO0FBQUMsbUJBQUksRUFBRSxNQUFJLE9BQUssR0FBRTtBQUFDLG9CQUFJLElBQUUsRUFBRTtBQUFPLGtCQUFFLFVBQVEsRUFBRTtBQUFBLGNBQUM7QUFBQyxrQkFBRSxFQUFFO0FBQUEsWUFBSSxTQUFPLE1BQUk7QUFBQSxVQUFFO0FBQUEsUUFBQztBQUNoZixpQkFBUyxHQUFHLEdBQUU7QUFBQyxjQUFJLElBQUUsRUFBRTtBQUFJLGNBQUcsU0FBTyxHQUFFO0FBQUMsZ0JBQUksSUFBRSxFQUFFO0FBQVUsb0JBQU8sRUFBRSxLQUFJO0FBQUEsY0FBQyxLQUFLO0FBQUUsb0JBQUUsR0FBRyxDQUFDO0FBQUU7QUFBQSxjQUFNO0FBQVEsb0JBQUU7QUFBQSxZQUFDO0FBQUMsMkJBQWEsT0FBTyxJQUFFLEVBQUUsQ0FBQyxJQUFFLEVBQUUsVUFBUTtBQUFBLFVBQUM7QUFBQSxRQUFDO0FBQUMsaUJBQVMsR0FBRyxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUU7QUFBVSxtQkFBTyxNQUFJLEVBQUUsWUFBVSxNQUFLLEdBQUcsQ0FBQztBQUFHLFlBQUUsUUFBTTtBQUFLLFlBQUUsWUFBVTtBQUFLLFlBQUUsVUFBUTtBQUFLLGdCQUFJLEVBQUUsUUFBTSxJQUFFLEVBQUUsV0FBVSxTQUFPLEtBQUcsR0FBRyxDQUFDO0FBQUcsWUFBRSxZQUFVO0FBQUssWUFBRSxTQUFPO0FBQUssWUFBRSxlQUFhO0FBQUssWUFBRSxnQkFBYztBQUFLLFlBQUUsZ0JBQWM7QUFBSyxZQUFFLGVBQWE7QUFBSyxZQUFFLFlBQVU7QUFBSyxZQUFFLGNBQVk7QUFBQSxRQUFJO0FBQ2pjLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGlCQUFPLE1BQUksRUFBRSxPQUFLLE1BQUksRUFBRSxPQUFLLE1BQUksRUFBRTtBQUFBLFFBQUc7QUFBQyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxZQUFFLFlBQU87QUFBQyxtQkFBSyxTQUFPLEVBQUUsV0FBUztBQUFDLGtCQUFHLFNBQU8sRUFBRSxVQUFRLEdBQUcsRUFBRSxNQUFNLEVBQUUsUUFBTztBQUFLLGtCQUFFLEVBQUU7QUFBQSxZQUFNO0FBQUMsY0FBRSxRQUFRLFNBQU8sRUFBRTtBQUFPLGlCQUFJLElBQUUsRUFBRSxTQUFRLE1BQUksRUFBRSxPQUFLLE1BQUksRUFBRSxPQUFLLE9BQUssRUFBRSxPQUFLO0FBQUMsa0JBQUcsRUFBRSxRQUFNLEVBQUUsVUFBUztBQUFFLGtCQUFHLFNBQU8sRUFBRSxTQUFPLE1BQUksRUFBRSxJQUFJLFVBQVM7QUFBQSxrQkFBTyxHQUFFLE1BQU0sU0FBTyxHQUFFLElBQUUsRUFBRTtBQUFBLFlBQUs7QUFBQyxnQkFBRyxFQUFFLEVBQUUsUUFBTSxHQUFHLFFBQU8sRUFBRTtBQUFBLFVBQVM7QUFBQSxRQUFDO0FBQy9XLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFJLElBQUUsRUFBRTtBQUFJLGNBQUcsTUFBSSxLQUFHLE1BQUksRUFBRSxLQUFFLEVBQUUsV0FBVSxJQUFFLEdBQUcsR0FBRSxHQUFFLENBQUMsSUFBRSxHQUFHLEdBQUUsQ0FBQztBQUFBLG1CQUFVLE1BQUksTUFBSSxJQUFFLEVBQUUsT0FBTSxTQUFPLEdBQUcsTUFBSSxHQUFHLEdBQUUsR0FBRSxDQUFDLEdBQUUsSUFBRSxFQUFFLFNBQVEsU0FBTyxJQUFHLElBQUcsR0FBRSxHQUFFLENBQUMsR0FBRSxJQUFFLEVBQUU7QUFBQSxRQUFPO0FBQUMsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFO0FBQUksY0FBRyxNQUFJLEtBQUcsTUFBSSxFQUFFLEtBQUUsRUFBRSxXQUFVLElBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQyxJQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUEsbUJBQVUsTUFBSSxNQUFJLElBQUUsRUFBRSxPQUFNLFNBQU8sR0FBRyxNQUFJLEdBQUcsR0FBRSxHQUFFLENBQUMsR0FBRSxJQUFFLEVBQUUsU0FBUSxTQUFPLElBQUcsSUFBRyxHQUFFLEdBQUUsQ0FBQyxHQUFFLElBQUUsRUFBRTtBQUFBLFFBQU87QUFBQyxZQUFJLElBQUUsTUFBSyxLQUFHO0FBQUcsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGVBQUksSUFBRSxFQUFFLE9BQU0sU0FBTyxJQUFHLElBQUcsR0FBRSxHQUFFLENBQUMsR0FBRSxJQUFFLEVBQUU7QUFBQSxRQUFPO0FBQy9hLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFHLE1BQUksZUFBYSxPQUFPLEdBQUcscUJBQXFCLEtBQUc7QUFBQyxlQUFHLHFCQUFxQixJQUFHLENBQUM7QUFBQSxVQUFDLFNBQU8sR0FBRTtBQUFBLFVBQUM7QUFBQyxrQkFBTyxFQUFFLEtBQUk7QUFBQSxZQUFDLEtBQUs7QUFBRSxtQkFBRyxHQUFHLEdBQUUsQ0FBQztBQUFBLFlBQUUsS0FBSztBQUFFLGtCQUFHLElBQUc7QUFBQyxvQkFBSSxJQUFFLEdBQUUsSUFBRTtBQUFHLG9CQUFFO0FBQUssbUJBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSxvQkFBRTtBQUFFLHFCQUFHO0FBQUUseUJBQU8sTUFBSSxLQUFHLEdBQUcsR0FBRSxFQUFFLFNBQVMsSUFBRSxHQUFHLEdBQUUsRUFBRSxTQUFTO0FBQUEsY0FBRSxNQUFNLElBQUcsR0FBRSxHQUFFLENBQUM7QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFHLG9CQUFJLFNBQU8sTUFBSSxLQUFHLEdBQUcsR0FBRSxFQUFFLFNBQVMsSUFBRSxHQUFHLEdBQUUsRUFBRSxTQUFTO0FBQUc7QUFBQSxZQUFNLEtBQUs7QUFBRSxvQkFBSSxJQUFFLEdBQUUsSUFBRSxJQUFHLElBQUUsRUFBRSxVQUFVLGVBQWMsS0FBRyxNQUFHLEdBQUcsR0FBRSxHQUFFLENBQUMsR0FBRSxJQUFFLEdBQUUsS0FBRyxNQUFJLE9BQUssSUFBRSxFQUFFLFVBQVUsZUFBYyxJQUFFLEdBQUcsQ0FBQyxHQUFFLEdBQUcsR0FBRSxDQUFDLElBQUcsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFHO0FBQUEsWUFBTSxLQUFLO0FBQUEsWUFBRSxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUcsa0JBQUcsQ0FBQyxNQUNwZ0IsSUFBRSxFQUFFLGFBQVksU0FBTyxNQUFJLElBQUUsRUFBRSxZQUFXLFNBQU8sS0FBSTtBQUFDLG9CQUFFLElBQUUsRUFBRTtBQUFLLG1CQUFFO0FBQUMsc0JBQUksSUFBRSxHQUFFLElBQUUsRUFBRTtBQUFRLHNCQUFFLEVBQUU7QUFBSSw2QkFBUyxNQUFJLE9BQUssSUFBRSxLQUFHLEdBQUcsR0FBRSxHQUFFLENBQUMsSUFBRSxPQUFLLElBQUUsTUFBSSxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUcsc0JBQUUsRUFBRTtBQUFBLGdCQUFJLFNBQU8sTUFBSTtBQUFBLGNBQUU7QUFBQyxpQkFBRyxHQUFFLEdBQUUsQ0FBQztBQUFFO0FBQUEsWUFBTSxLQUFLO0FBQUUsa0JBQUcsQ0FBQyxNQUFJLEdBQUcsR0FBRSxDQUFDLEdBQUUsSUFBRSxFQUFFLFdBQVUsZUFBYSxPQUFPLEVBQUUsc0JBQXNCLEtBQUc7QUFBQyxrQkFBRSxRQUFNLEVBQUUsZUFBYyxFQUFFLFFBQU0sRUFBRSxlQUFjLEVBQUUscUJBQXFCO0FBQUEsY0FBQyxTQUFPLEdBQUU7QUFBQyxrQkFBRSxHQUFFLEdBQUUsQ0FBQztBQUFBLGNBQUM7QUFBQyxpQkFBRyxHQUFFLEdBQUUsQ0FBQztBQUFFO0FBQUEsWUFBTSxLQUFLO0FBQUcsaUJBQUcsR0FBRSxHQUFFLENBQUM7QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFHLGdCQUFFLE9BQUssS0FBRyxLQUFHLElBQUUsTUFBSSxTQUFPLEVBQUUsZUFBYyxHQUFHLEdBQUUsR0FBRSxDQUFDLEdBQUUsSUFBRSxLQUFHLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBRTtBQUFBLFlBQU07QUFBUTtBQUFBLGdCQUFHO0FBQUEsZ0JBQUU7QUFBQSxnQkFDcGY7QUFBQSxjQUFDO0FBQUEsVUFBQztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxjQUFJLElBQUUsRUFBRTtBQUFZLGNBQUcsU0FBTyxHQUFFO0FBQUMsY0FBRSxjQUFZO0FBQUssZ0JBQUksSUFBRSxFQUFFO0FBQVUscUJBQU8sTUFBSSxJQUFFLEVBQUUsWUFBVSxJQUFJO0FBQUksY0FBRSxRQUFRLFNBQVNELElBQUU7QUFBQyxrQkFBSSxJQUFFLEdBQUcsS0FBSyxNQUFLLEdBQUVBLEVBQUM7QUFBRSxnQkFBRSxJQUFJQSxFQUFDLE1BQUksRUFBRSxJQUFJQSxFQUFDLEdBQUVBLEdBQUUsS0FBSyxHQUFFLENBQUM7QUFBQSxZQUFFLENBQUM7QUFBQSxVQUFDO0FBQUEsUUFBQztBQUMzTSxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFO0FBQVUsY0FBRyxTQUFPLEVBQUUsVUFBUSxJQUFFLEdBQUUsSUFBRSxFQUFFLFFBQU8sS0FBSTtBQUFDLGdCQUFJLElBQUUsRUFBRSxDQUFDO0FBQUUsZ0JBQUc7QUFBQyxrQkFBSSxJQUFFLEdBQUUsSUFBRTtBQUFFLGtCQUFHLElBQUc7QUFBQyxvQkFBSSxJQUFFO0FBQUUsa0JBQUUsUUFBSyxTQUFPLEtBQUc7QUFBQywwQkFBTyxFQUFFLEtBQUk7QUFBQSxvQkFBQyxLQUFLO0FBQUUsMEJBQUUsRUFBRTtBQUFVLDJCQUFHO0FBQUcsNEJBQU07QUFBQSxvQkFBRSxLQUFLO0FBQUUsMEJBQUUsRUFBRSxVQUFVO0FBQWMsMkJBQUc7QUFBRyw0QkFBTTtBQUFBLG9CQUFFLEtBQUs7QUFBRSwwQkFBRSxFQUFFLFVBQVU7QUFBYywyQkFBRztBQUFHLDRCQUFNO0FBQUEsa0JBQUM7QUFBQyxzQkFBRSxFQUFFO0FBQUEsZ0JBQU07QUFBQyxvQkFBRyxTQUFPLEVBQUUsT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsbUJBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSxvQkFBRTtBQUFLLHFCQUFHO0FBQUEsY0FBRSxNQUFNLElBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSxrQkFBSSxJQUFFLEVBQUU7QUFBVSx1QkFBTyxNQUFJLEVBQUUsU0FBTztBQUFNLGdCQUFFLFNBQU87QUFBQSxZQUFJLFNBQU8sR0FBRTtBQUFDLGdCQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsWUFBQztBQUFBLFVBQUM7QUFBQyxjQUFHLEVBQUUsZUFBYSxNQUFNLE1BQUksSUFBRSxFQUFFLE9BQU0sU0FBTyxJQUFHLElBQUcsR0FBRSxDQUFDLEdBQUUsSUFBRSxFQUFFO0FBQUEsUUFBTztBQUMzZixpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFLFdBQVUsSUFBRSxFQUFFO0FBQU0sa0JBQU8sRUFBRSxLQUFJO0FBQUEsWUFBQyxLQUFLO0FBQUEsWUFBRSxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUEsWUFBRyxLQUFLO0FBQUcsaUJBQUcsR0FBRSxDQUFDO0FBQUUsaUJBQUcsQ0FBQztBQUFFLGtCQUFHLElBQUUsR0FBRTtBQUFDLG9CQUFHO0FBQUMscUJBQUcsR0FBRSxHQUFFLEVBQUUsTUFBTSxHQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUEsZ0JBQUMsU0FBTyxHQUFFO0FBQUMsb0JBQUUsR0FBRSxFQUFFLFFBQU8sQ0FBQztBQUFBLGdCQUFDO0FBQUMsb0JBQUc7QUFBQyxxQkFBRyxHQUFFLEdBQUUsRUFBRSxNQUFNO0FBQUEsZ0JBQUMsU0FBTyxHQUFFO0FBQUMsb0JBQUUsR0FBRSxFQUFFLFFBQU8sQ0FBQztBQUFBLGdCQUFDO0FBQUEsY0FBQztBQUFDO0FBQUEsWUFBTSxLQUFLO0FBQUUsaUJBQUcsR0FBRSxDQUFDO0FBQUUsaUJBQUcsQ0FBQztBQUFFLGtCQUFFLE9BQUssU0FBTyxLQUFHLEdBQUcsR0FBRSxFQUFFLE1BQU07QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFFLGlCQUFHLEdBQUUsQ0FBQztBQUFFLGlCQUFHLENBQUM7QUFBRSxrQkFBRSxPQUFLLFNBQU8sS0FBRyxHQUFHLEdBQUUsRUFBRSxNQUFNO0FBQUUsa0JBQUcsSUFBRztBQUFDLG9CQUFHLEVBQUUsUUFBTSxJQUFHO0FBQUMsc0JBQUksSUFBRSxFQUFFO0FBQVUsc0JBQUc7QUFBQyx1QkFBRyxDQUFDO0FBQUEsa0JBQUMsU0FBTyxHQUFFO0FBQUMsc0JBQUUsR0FBRSxFQUFFLFFBQU8sQ0FBQztBQUFBLGtCQUFDO0FBQUEsZ0JBQUM7QUFBQyxvQkFBRyxJQUFFLE1BQUksSUFBRSxFQUFFLFdBQVUsUUFBTSxJQUFHO0FBQUMsc0JBQUksSUFBRSxFQUFFO0FBQWMsc0JBQUUsU0FBTyxJQUFFLEVBQUUsZ0JBQWM7QUFBRSxzQkFBRSxFQUFFO0FBQUssc0JBQ3BmLEVBQUU7QUFBWSxvQkFBRSxjQUFZO0FBQUssc0JBQUcsU0FBTyxFQUFFLEtBQUc7QUFBQyx1QkFBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFBLGtCQUFDLFNBQU8sR0FBRTtBQUFDLHNCQUFFLEdBQUUsRUFBRSxRQUFPLENBQUM7QUFBQSxrQkFBQztBQUFBLGdCQUFDO0FBQUEsY0FBQztBQUFDO0FBQUEsWUFBTSxLQUFLO0FBQUUsaUJBQUcsR0FBRSxDQUFDO0FBQUUsaUJBQUcsQ0FBQztBQUFFLGtCQUFHLElBQUUsS0FBRyxJQUFHO0FBQUMsb0JBQUcsU0FBTyxFQUFFLFVBQVUsT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsb0JBQUUsRUFBRTtBQUFVLG9CQUFFLEVBQUU7QUFBYyxvQkFBRSxTQUFPLElBQUUsRUFBRSxnQkFBYztBQUFFLG9CQUFHO0FBQUMscUJBQUcsR0FBRSxHQUFFLENBQUM7QUFBQSxnQkFBQyxTQUFPLEdBQUU7QUFBQyxvQkFBRSxHQUFFLEVBQUUsUUFBTyxDQUFDO0FBQUEsZ0JBQUM7QUFBQSxjQUFDO0FBQUM7QUFBQSxZQUFNLEtBQUs7QUFBRSxpQkFBRyxHQUFFLENBQUM7QUFBRSxpQkFBRyxDQUFDO0FBQUUsa0JBQUcsSUFBRSxHQUFFO0FBQUMsb0JBQUcsTUFBSSxNQUFJLFNBQU8sS0FBRyxFQUFFLGNBQWMsYUFBYSxLQUFHO0FBQUMscUJBQUcsRUFBRSxhQUFhO0FBQUEsZ0JBQUMsU0FBTyxHQUFFO0FBQUMsb0JBQUUsR0FBRSxFQUFFLFFBQU8sQ0FBQztBQUFBLGdCQUFDO0FBQUMsb0JBQUcsSUFBRztBQUFDLHNCQUFFLEVBQUU7QUFBYyxzQkFBRSxFQUFFO0FBQWdCLHNCQUFHO0FBQUMsdUJBQUcsR0FBRSxDQUFDO0FBQUEsa0JBQUMsU0FBTyxHQUFFO0FBQUMsc0JBQUUsR0FBRSxFQUFFLFFBQU8sQ0FBQztBQUFBLGtCQUFDO0FBQUEsZ0JBQUM7QUFBQSxjQUFDO0FBQUM7QUFBQSxZQUFNLEtBQUs7QUFBRTtBQUFBLGdCQUFHO0FBQUEsZ0JBQzVmO0FBQUEsY0FBQztBQUFFLGlCQUFHLENBQUM7QUFBRSxrQkFBRyxJQUFFLEtBQUcsSUFBRztBQUFDLG9CQUFFLEVBQUU7QUFBVSxvQkFBRSxFQUFFO0FBQWMsb0JBQUUsRUFBRTtBQUFnQixvQkFBRztBQUFDLHFCQUFHLEdBQUUsQ0FBQztBQUFBLGdCQUFDLFNBQU8sR0FBRTtBQUFDLG9CQUFFLEdBQUUsRUFBRSxRQUFPLENBQUM7QUFBQSxnQkFBQztBQUFBLGNBQUM7QUFBQztBQUFBLFlBQU0sS0FBSztBQUFHLGlCQUFHLEdBQUUsQ0FBQztBQUFFLGlCQUFHLENBQUM7QUFBRSxrQkFBRSxFQUFFO0FBQU0sZ0JBQUUsUUFBTSxTQUFPLElBQUUsU0FBTyxFQUFFLGVBQWMsRUFBRSxVQUFVLFdBQVMsR0FBRSxDQUFDLEtBQUcsU0FBTyxFQUFFLGFBQVcsU0FBTyxFQUFFLFVBQVUsa0JBQWdCLEtBQUcsRUFBRTtBQUFJLGtCQUFFLEtBQUcsR0FBRyxDQUFDO0FBQUU7QUFBQSxZQUFNLEtBQUs7QUFBRyxrQkFBSSxJQUFFLFNBQU8sS0FBRyxTQUFPLEVBQUU7QUFBYyxnQkFBRSxPQUFLLEtBQUcsS0FBRyxJQUFFLE1BQUksR0FBRSxHQUFHLEdBQUUsQ0FBQyxHQUFFLElBQUUsS0FBRyxHQUFHLEdBQUUsQ0FBQztBQUFFLGlCQUFHLENBQUM7QUFBRSxrQkFBRyxJQUFFLE1BQUs7QUFBQyxvQkFBRSxTQUFPLEVBQUU7QUFBYyxxQkFBSSxFQUFFLFVBQVUsV0FBUyxNQUFJLENBQUMsS0FBRyxPQUFLLEVBQUUsT0FBSyxHQUFHLE1BQUksSUFBRSxHQUFFLElBQUUsRUFBRSxPQUFNLFNBQzllLEtBQUc7QUFBQyx1QkFBSSxJQUFFLElBQUUsR0FBRSxTQUFPLEtBQUc7QUFBQyx3QkFBRTtBQUFFLHdCQUFJLElBQUUsRUFBRTtBQUFNLDRCQUFPLEVBQUUsS0FBSTtBQUFBLHNCQUFDLEtBQUs7QUFBQSxzQkFBRSxLQUFLO0FBQUEsc0JBQUcsS0FBSztBQUFBLHNCQUFHLEtBQUs7QUFBRywyQkFBRyxHQUFFLEdBQUUsRUFBRSxNQUFNO0FBQUU7QUFBQSxzQkFBTSxLQUFLO0FBQUUsMkJBQUcsR0FBRSxFQUFFLE1BQU07QUFBRSw0QkFBSSxJQUFFLEVBQUU7QUFBVSw0QkFBRyxlQUFhLE9BQU8sRUFBRSxzQkFBcUI7QUFBQyw4QkFBSSxJQUFFLEdBQUUsSUFBRSxFQUFFO0FBQU8sOEJBQUc7QUFBQyxnQ0FBSSxJQUFFO0FBQUUsOEJBQUUsUUFBTSxFQUFFO0FBQWMsOEJBQUUsUUFBTSxFQUFFO0FBQWMsOEJBQUUscUJBQXFCO0FBQUEsMEJBQUMsU0FBTyxHQUFFO0FBQUMsOEJBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSwwQkFBQztBQUFBLHdCQUFDO0FBQUM7QUFBQSxzQkFBTSxLQUFLO0FBQUUsMkJBQUcsR0FBRSxFQUFFLE1BQU07QUFBRTtBQUFBLHNCQUFNLEtBQUs7QUFBRyw0QkFBRyxTQUFPLEVBQUUsZUFBYztBQUFDLDZCQUFHLENBQUM7QUFBRTtBQUFBLHdCQUFRO0FBQUEsb0JBQUM7QUFBQyw2QkFBTyxLQUFHLEVBQUUsU0FBTyxHQUFFLElBQUUsS0FBRyxHQUFHLENBQUM7QUFBQSxrQkFBQztBQUFDLHNCQUFFLEVBQUU7QUFBQSxnQkFBTztBQUFDLG9CQUFHO0FBQUcsb0JBQUUsS0FBRyxJQUFFLE1BQUssR0FBRyxNQUFJLElBQUUsT0FBSTtBQUFDLHdCQUFHLE1BQUksRUFBRSxLQUFJO0FBQUMsMEJBQUcsU0FDbmYsR0FBRTtBQUFDLDRCQUFFO0FBQUUsNEJBQUc7QUFBQyw4QkFBRSxFQUFFLFdBQVUsSUFBRSxHQUFHLENBQUMsSUFBRSxHQUFHLEVBQUUsV0FBVSxFQUFFLGFBQWE7QUFBQSx3QkFBQyxTQUFPLEdBQUU7QUFBQyw0QkFBRSxHQUFFLEVBQUUsUUFBTyxDQUFDO0FBQUEsd0JBQUM7QUFBQSxzQkFBQztBQUFBLG9CQUFDLFdBQVMsTUFBSSxFQUFFLEtBQUk7QUFBQywwQkFBRyxTQUFPLEVBQUUsS0FBRztBQUFDLDRCQUFFLEVBQUUsV0FBVSxJQUFFLEdBQUcsQ0FBQyxJQUFFLEdBQUcsR0FBRSxFQUFFLGFBQWE7QUFBQSxzQkFBQyxTQUFPLEdBQUU7QUFBQywwQkFBRSxHQUFFLEVBQUUsUUFBTyxDQUFDO0FBQUEsc0JBQUM7QUFBQSxvQkFBQyxZQUFVLE9BQUssRUFBRSxPQUFLLE9BQUssRUFBRSxPQUFLLFNBQU8sRUFBRSxpQkFBZSxNQUFJLE1BQUksU0FBTyxFQUFFLE9BQU07QUFBQyx3QkFBRSxNQUFNLFNBQU87QUFBRSwwQkFBRSxFQUFFO0FBQU07QUFBQSxvQkFBUTtBQUFDLHdCQUFHLE1BQUksRUFBRSxPQUFNO0FBQUUsMkJBQUssU0FBTyxFQUFFLFdBQVM7QUFBQywwQkFBRyxTQUFPLEVBQUUsVUFBUSxFQUFFLFdBQVMsRUFBRSxPQUFNO0FBQUUsNEJBQUksTUFBSSxJQUFFO0FBQU0sMEJBQUUsRUFBRTtBQUFBLG9CQUFNO0FBQUMsMEJBQUksTUFBSSxJQUFFO0FBQU0sc0JBQUUsUUFBUSxTQUFPLEVBQUU7QUFBTyx3QkFBRSxFQUFFO0FBQUEsa0JBQU87QUFBQTtBQUFBLGNBQUM7QUFBQztBQUFBLFlBQU0sS0FBSztBQUFHLGlCQUFHLEdBQUUsQ0FBQztBQUFFLGlCQUFHLENBQUM7QUFDeGYsa0JBQUUsS0FBRyxHQUFHLENBQUM7QUFBRTtBQUFBLFlBQU0sS0FBSztBQUFHO0FBQUEsWUFBTTtBQUFRLGlCQUFHLEdBQUUsQ0FBQyxHQUFFLEdBQUcsQ0FBQztBQUFBLFVBQUM7QUFBQSxRQUFDO0FBQUMsaUJBQVMsR0FBRyxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUU7QUFBTSxjQUFHLElBQUUsR0FBRTtBQUFDLGdCQUFHO0FBQUMsa0JBQUcsSUFBRztBQUFDLG1CQUFFO0FBQUMsMkJBQVEsSUFBRSxFQUFFLFFBQU8sU0FBTyxLQUFHO0FBQUMsd0JBQUcsR0FBRyxDQUFDLEdBQUU7QUFBQywwQkFBSSxJQUFFO0FBQUUsNEJBQU07QUFBQSxvQkFBQztBQUFDLHdCQUFFLEVBQUU7QUFBQSxrQkFBTTtBQUFDLHdCQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBQSxnQkFBRTtBQUFDLHdCQUFPLEVBQUUsS0FBSTtBQUFBLGtCQUFDLEtBQUs7QUFBRSx3QkFBSSxJQUFFLEVBQUU7QUFBVSxzQkFBRSxRQUFNLE9BQUssR0FBRyxDQUFDLEdBQUUsRUFBRSxTQUFPO0FBQUssd0JBQUksSUFBRSxHQUFHLENBQUM7QUFBRSx1QkFBRyxHQUFFLEdBQUUsQ0FBQztBQUFFO0FBQUEsa0JBQU0sS0FBSztBQUFBLGtCQUFFLEtBQUs7QUFBRSx3QkFBSSxJQUFFLEVBQUUsVUFBVSxlQUFjLElBQUUsR0FBRyxDQUFDO0FBQUUsdUJBQUcsR0FBRSxHQUFFLENBQUM7QUFBRTtBQUFBLGtCQUFNO0FBQVEsMEJBQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFBLGdCQUFFO0FBQUEsY0FBQztBQUFBLFlBQUMsU0FBTyxHQUFFO0FBQUMsZ0JBQUUsR0FBRSxFQUFFLFFBQU8sQ0FBQztBQUFBLFlBQUM7QUFBQyxjQUFFLFNBQU87QUFBQSxVQUFFO0FBQUMsY0FBRSxTQUFPLEVBQUUsU0FBTztBQUFBLFFBQU07QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRTtBQUFFLGFBQUcsR0FBRSxHQUFFLENBQUM7QUFBQSxRQUFDO0FBQ3hlLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxtQkFBUSxJQUFFLE9BQUssRUFBRSxPQUFLLElBQUcsU0FBTyxLQUFHO0FBQUMsZ0JBQUksSUFBRSxHQUFFLElBQUUsRUFBRTtBQUFNLGdCQUFHLE9BQUssRUFBRSxPQUFLLEdBQUU7QUFBQyxrQkFBSSxJQUFFLFNBQU8sRUFBRSxpQkFBZTtBQUFHLGtCQUFHLENBQUMsR0FBRTtBQUFDLG9CQUFJLElBQUUsRUFBRSxXQUFVLElBQUUsU0FBTyxLQUFHLFNBQU8sRUFBRSxpQkFBZTtBQUFFLG9CQUFFO0FBQUcsb0JBQUksSUFBRTtBQUFFLHFCQUFHO0FBQUUscUJBQUksSUFBRSxNQUFJLENBQUMsRUFBRSxNQUFJLElBQUUsR0FBRSxTQUFPLElBQUcsS0FBRSxHQUFFLElBQUUsRUFBRSxPQUFNLE9BQUssRUFBRSxPQUFLLFNBQU8sRUFBRSxnQkFBYyxHQUFHLENBQUMsSUFBRSxTQUFPLEtBQUcsRUFBRSxTQUFPLEdBQUUsSUFBRSxLQUFHLEdBQUcsQ0FBQztBQUFFLHVCQUFLLFNBQU8sSUFBRyxLQUFFLEdBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQyxHQUFFLElBQUUsRUFBRTtBQUFRLG9CQUFFO0FBQUUscUJBQUc7QUFBRSxvQkFBRTtBQUFBLGNBQUM7QUFBQyxpQkFBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFlBQUMsTUFBTSxRQUFLLEVBQUUsZUFBYSxTQUFPLFNBQU8sS0FBRyxFQUFFLFNBQU8sR0FBRSxJQUFFLEtBQUcsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFVBQUM7QUFBQSxRQUFDO0FBQ3ZjLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGlCQUFLLFNBQU8sS0FBRztBQUFDLGdCQUFJLElBQUU7QUFBRSxnQkFBRyxPQUFLLEVBQUUsUUFBTSxPQUFNO0FBQUMsa0JBQUksSUFBRSxFQUFFO0FBQVUsa0JBQUc7QUFBQyxvQkFBRyxPQUFLLEVBQUUsUUFBTSxNQUFNLFNBQU8sRUFBRSxLQUFJO0FBQUEsa0JBQUMsS0FBSztBQUFBLGtCQUFFLEtBQUs7QUFBQSxrQkFBRyxLQUFLO0FBQUcseUJBQUcsR0FBRyxHQUFFLENBQUM7QUFBRTtBQUFBLGtCQUFNLEtBQUs7QUFBRSx3QkFBSSxJQUFFLEVBQUU7QUFBVSx3QkFBRyxFQUFFLFFBQU0sS0FBRyxDQUFDLEVBQUUsS0FBRyxTQUFPLEVBQUUsR0FBRSxrQkFBa0I7QUFBQSx5QkFBTTtBQUFDLDBCQUFJLElBQUUsRUFBRSxnQkFBYyxFQUFFLE9BQUssRUFBRSxnQkFBYyxHQUFHLEVBQUUsTUFBSyxFQUFFLGFBQWE7QUFBRSx3QkFBRSxtQkFBbUIsR0FBRSxFQUFFLGVBQWMsRUFBRSxtQ0FBbUM7QUFBQSxvQkFBQztBQUFDLHdCQUFJLElBQUUsRUFBRTtBQUFZLDZCQUFPLEtBQUcsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFO0FBQUEsa0JBQU0sS0FBSztBQUFFLHdCQUFJLElBQUUsRUFBRTtBQUFZLHdCQUFHLFNBQU8sR0FBRTtBQUFDLDBCQUFFO0FBQUssMEJBQUcsU0FBTyxFQUFFLE1BQU0sU0FBTyxFQUFFLE1BQU0sS0FBSTtBQUFBLHdCQUFDLEtBQUs7QUFBRSw4QkFDamhCLEdBQUcsRUFBRSxNQUFNLFNBQVM7QUFBRTtBQUFBLHdCQUFNLEtBQUs7QUFBRSw4QkFBRSxFQUFFLE1BQU07QUFBQSxzQkFBUztBQUFDLHlCQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUEsb0JBQUM7QUFBQztBQUFBLGtCQUFNLEtBQUs7QUFBRSx3QkFBSSxJQUFFLEVBQUU7QUFBVSw2QkFBTyxLQUFHLEVBQUUsUUFBTSxLQUFHLEdBQUcsR0FBRSxFQUFFLE1BQUssRUFBRSxlQUFjLENBQUM7QUFBRTtBQUFBLGtCQUFNLEtBQUs7QUFBRTtBQUFBLGtCQUFNLEtBQUs7QUFBRTtBQUFBLGtCQUFNLEtBQUs7QUFBRztBQUFBLGtCQUFNLEtBQUs7QUFBRyx3QkFBRyxNQUFJLFNBQU8sRUFBRSxlQUFjO0FBQUMsMEJBQUksSUFBRSxFQUFFO0FBQVUsMEJBQUcsU0FBTyxHQUFFO0FBQUMsNEJBQUksSUFBRSxFQUFFO0FBQWMsNEJBQUcsU0FBTyxHQUFFO0FBQUMsOEJBQUksSUFBRSxFQUFFO0FBQVcsbUNBQU8sS0FBRyxHQUFHLENBQUM7QUFBQSx3QkFBQztBQUFBLHNCQUFDO0FBQUEsb0JBQUM7QUFBQztBQUFBLGtCQUFNLEtBQUs7QUFBQSxrQkFBRyxLQUFLO0FBQUEsa0JBQUcsS0FBSztBQUFBLGtCQUFHLEtBQUs7QUFBQSxrQkFBRyxLQUFLO0FBQUEsa0JBQUcsS0FBSztBQUFHO0FBQUEsa0JBQU07QUFBUSwwQkFBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUEsZ0JBQUU7QUFBQyxxQkFBRyxFQUFFLFFBQU0sT0FBSyxHQUFHLENBQUM7QUFBQSxjQUFDLFNBQU8sR0FBRTtBQUFDLGtCQUFFLEdBQUUsRUFBRSxRQUFPLENBQUM7QUFBQSxjQUFDO0FBQUEsWUFBQztBQUFDLGdCQUFHLE1BQUksR0FBRTtBQUFDLGtCQUFFO0FBQUs7QUFBQSxZQUFLO0FBQUMsZ0JBQUUsRUFBRTtBQUNwZixnQkFBRyxTQUFPLEdBQUU7QUFBQyxnQkFBRSxTQUFPLEVBQUU7QUFBTyxrQkFBRTtBQUFFO0FBQUEsWUFBSztBQUFDLGdCQUFFLEVBQUU7QUFBQSxVQUFNO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGlCQUFLLFNBQU8sS0FBRztBQUFDLGdCQUFJLElBQUU7QUFBRSxnQkFBRyxNQUFJLEdBQUU7QUFBQyxrQkFBRTtBQUFLO0FBQUEsWUFBSztBQUFDLGdCQUFJLElBQUUsRUFBRTtBQUFRLGdCQUFHLFNBQU8sR0FBRTtBQUFDLGdCQUFFLFNBQU8sRUFBRTtBQUFPLGtCQUFFO0FBQUU7QUFBQSxZQUFLO0FBQUMsZ0JBQUUsRUFBRTtBQUFBLFVBQU07QUFBQSxRQUFDO0FBQ3ZMLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGlCQUFLLFNBQU8sS0FBRztBQUFDLGdCQUFJLElBQUU7QUFBRSxnQkFBRztBQUFDLHNCQUFPLEVBQUUsS0FBSTtBQUFBLGdCQUFDLEtBQUs7QUFBQSxnQkFBRSxLQUFLO0FBQUEsZ0JBQUcsS0FBSztBQUFHLHNCQUFJLElBQUUsRUFBRTtBQUFPLHNCQUFHO0FBQUMsdUJBQUcsR0FBRSxDQUFDO0FBQUEsa0JBQUMsU0FBTyxHQUFFO0FBQUMsc0JBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSxrQkFBQztBQUFDO0FBQUEsZ0JBQU0sS0FBSztBQUFFLHNCQUFJLElBQUUsRUFBRTtBQUFVLHNCQUFHLGVBQWEsT0FBTyxFQUFFLG1CQUFrQjtBQUFDLHdCQUFJLElBQUUsRUFBRTtBQUFPLHdCQUFHO0FBQUMsd0JBQUUsa0JBQWtCO0FBQUEsb0JBQUMsU0FBTyxHQUFFO0FBQUMsd0JBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSxvQkFBQztBQUFBLGtCQUFDO0FBQUMsc0JBQUksSUFBRSxFQUFFO0FBQU8sc0JBQUc7QUFBQyx1QkFBRyxDQUFDO0FBQUEsa0JBQUMsU0FBTyxHQUFFO0FBQUMsc0JBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSxrQkFBQztBQUFDO0FBQUEsZ0JBQU0sS0FBSztBQUFFLHNCQUFJLElBQUUsRUFBRTtBQUFPLHNCQUFHO0FBQUMsdUJBQUcsQ0FBQztBQUFBLGtCQUFDLFNBQU8sR0FBRTtBQUFDLHNCQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsa0JBQUM7QUFBQSxjQUFDO0FBQUEsWUFBQyxTQUFPLEdBQUU7QUFBQyxnQkFBRSxHQUFFLEVBQUUsUUFBTyxDQUFDO0FBQUEsWUFBQztBQUFDLGdCQUFHLE1BQUksR0FBRTtBQUFDLGtCQUFFO0FBQUs7QUFBQSxZQUFLO0FBQUMsZ0JBQUksSUFBRSxFQUFFO0FBQVEsZ0JBQUcsU0FBTyxHQUFFO0FBQUMsZ0JBQUUsU0FBTyxFQUFFO0FBQU8sa0JBQUU7QUFBRTtBQUFBLFlBQUs7QUFBQyxnQkFBRSxFQUFFO0FBQUEsVUFBTTtBQUFBLFFBQUM7QUFDN2QsWUFBSSxLQUFHLEdBQUUsS0FBRyxHQUFFLEtBQUcsR0FBRSxLQUFHLEdBQUUsS0FBRztBQUFFLFlBQUcsZUFBYSxPQUFPLFVBQVEsT0FBTyxLQUFJO0FBQUMsY0FBSSxLQUFHLE9BQU87QUFBSSxlQUFHLEdBQUcsb0JBQW9CO0FBQUUsZUFBRyxHQUFHLDJCQUEyQjtBQUFFLGVBQUcsR0FBRyxlQUFlO0FBQUUsZUFBRyxHQUFHLGtCQUFrQjtBQUFFLGVBQUcsR0FBRyxlQUFlO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGNBQUksSUFBRSxHQUFHLENBQUM7QUFBRSxjQUFHLFFBQU0sR0FBRTtBQUFDLGdCQUFHLGFBQVcsT0FBTyxFQUFFLGNBQWMsZUFBZSxFQUFFLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLG1CQUFPO0FBQUEsVUFBQztBQUFDLGNBQUUsR0FBRyxDQUFDO0FBQUUsY0FBRyxTQUFPLEVBQUUsT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsaUJBQU8sRUFBRSxVQUFVO0FBQUEsUUFBTztBQUM3WixpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGtCQUFPLEVBQUUsVUFBUztBQUFBLFlBQUMsS0FBSztBQUFHLGtCQUFHLEVBQUUsU0FBTyxFQUFFLE1BQU0sUUFBTTtBQUFHO0FBQUEsWUFBTSxLQUFLO0FBQUcsaUJBQUU7QUFBQyxvQkFBRSxFQUFFO0FBQU0sb0JBQUUsQ0FBQyxHQUFFLENBQUM7QUFBRSx5QkFBUSxJQUFFLEdBQUUsSUFBRSxFQUFFLFVBQVE7QUFBQyxzQkFBSSxJQUFFLEVBQUUsR0FBRyxHQUFFLElBQUUsRUFBRSxHQUFHLEdBQUUsSUFBRSxFQUFFLENBQUM7QUFBRSxzQkFBRyxNQUFJLEVBQUUsT0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFFO0FBQUMsMkJBQUssUUFBTSxLQUFHLEdBQUcsR0FBRSxDQUFDLElBQUcsTUFBSSxJQUFFLEVBQUUsQ0FBQztBQUFFLHdCQUFHLE1BQUksRUFBRSxRQUFPO0FBQUMsMEJBQUU7QUFBRyw0QkFBTTtBQUFBLG9CQUFDLE1BQU0sTUFBSSxJQUFFLEVBQUUsT0FBTSxTQUFPLElBQUcsR0FBRSxLQUFLLEdBQUUsQ0FBQyxHQUFFLElBQUUsRUFBRTtBQUFBLGtCQUFPO0FBQUEsZ0JBQUM7QUFBQyxvQkFBRTtBQUFBLGNBQUU7QUFBQyxxQkFBTztBQUFBLFlBQUUsS0FBSztBQUFHLGtCQUFHLE1BQUksRUFBRSxPQUFLLEdBQUcsRUFBRSxXQUFVLEVBQUUsS0FBSyxFQUFFLFFBQU07QUFBRztBQUFBLFlBQU0sS0FBSztBQUFHLGtCQUFHLE1BQUksRUFBRSxPQUFLLE1BQUksRUFBRTtBQUFJLG9CQUFHLElBQUUsR0FBRyxDQUFDLEdBQUUsU0FBTyxLQUFHLEtBQUcsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQU07QUFBQTtBQUFHO0FBQUEsWUFBTSxLQUFLO0FBQUcsa0JBQUcsTUFBSSxFQUFFLFFBQU0sSUFBRSxFQUFFLGNBQWMsZUFBZSxHQUMzZ0IsYUFBVyxPQUFPLEtBQUcsRUFBRSxZQUFZLE1BQUksRUFBRSxNQUFNLFlBQVksR0FBRyxRQUFNO0FBQUc7QUFBQSxZQUFNO0FBQVEsb0JBQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFBLFVBQUU7QUFBQyxpQkFBTTtBQUFBLFFBQUU7QUFBQyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxrQkFBTyxFQUFFLFVBQVM7QUFBQSxZQUFDLEtBQUs7QUFBRyxxQkFBTSxPQUFLLEdBQUcsRUFBRSxLQUFLLEtBQUcsYUFBVztBQUFBLFlBQUksS0FBSztBQUFHLHFCQUFNLFdBQVMsR0FBRyxDQUFDLEtBQUcsTUFBSTtBQUFBLFlBQUksS0FBSztBQUFHLHFCQUFNLFlBQVUsRUFBRSxRQUFNO0FBQUEsWUFBSyxLQUFLO0FBQUcscUJBQU0sTUFBSSxFQUFFLFFBQU07QUFBQSxZQUFJLEtBQUs7QUFBRyxxQkFBTSxxQkFBbUIsRUFBRSxRQUFNO0FBQUEsWUFBSztBQUFRLG9CQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBQSxVQUFFO0FBQUEsUUFBQztBQUN4WCxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxDQUFDO0FBQUUsY0FBRSxDQUFDLEdBQUUsQ0FBQztBQUFFLG1CQUFRLElBQUUsR0FBRSxJQUFFLEVBQUUsVUFBUTtBQUFDLGdCQUFJLElBQUUsRUFBRSxHQUFHLEdBQUUsSUFBRSxFQUFFLEdBQUcsR0FBRSxJQUFFLEVBQUUsQ0FBQztBQUFFLGdCQUFHLE1BQUksRUFBRSxPQUFLLENBQUMsR0FBRyxDQUFDLEdBQUU7QUFBQyxxQkFBSyxRQUFNLEtBQUcsR0FBRyxHQUFFLENBQUMsSUFBRyxNQUFJLElBQUUsRUFBRSxDQUFDO0FBQUUsa0JBQUcsTUFBSSxFQUFFLE9BQU8sR0FBRSxLQUFLLENBQUM7QUFBQSxrQkFBTyxNQUFJLElBQUUsRUFBRSxPQUFNLFNBQU8sSUFBRyxHQUFFLEtBQUssR0FBRSxDQUFDLEdBQUUsSUFBRSxFQUFFO0FBQUEsWUFBTztBQUFBLFVBQUM7QUFBQyxpQkFBTztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUcsQ0FBQyxHQUFHLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLGNBQUUsR0FBRyxDQUFDO0FBQUUsY0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLGNBQUUsQ0FBQztBQUFFLGNBQUUsTUFBTSxLQUFLLENBQUM7QUFBRSxtQkFBUSxJQUFFLEdBQUUsSUFBRSxFQUFFLFVBQVE7QUFBQyxnQkFBSSxJQUFFLEVBQUUsR0FBRztBQUFFLGdCQUFHLE1BQUksRUFBRSxJQUFJLElBQUcsQ0FBQyxLQUFHLEVBQUUsS0FBSyxFQUFFLFNBQVM7QUFBQSxnQkFBTyxNQUFJLElBQUUsRUFBRSxPQUFNLFNBQU8sSUFBRyxHQUFFLEtBQUssQ0FBQyxHQUFFLElBQUUsRUFBRTtBQUFBLFVBQU87QUFBQyxpQkFBTztBQUFBLFFBQUM7QUFDcmMsWUFBSSxLQUFHLEtBQUssTUFBSyxLQUFHLEdBQUcsd0JBQXVCLEtBQUcsR0FBRyxtQkFBa0IsSUFBRSxHQUFHLHlCQUF3QixJQUFFLEdBQUUsSUFBRSxNQUFLLElBQUUsTUFBSyxJQUFFLEdBQUUsS0FBRyxHQUFFLEtBQUcsR0FBRyxDQUFDLEdBQUUsSUFBRSxHQUFFLEtBQUcsTUFBSyxLQUFHLEdBQUUsS0FBRyxHQUFFLEtBQUcsR0FBRSxLQUFHLE1BQUssS0FBRyxNQUFLLEtBQUcsR0FBRSxLQUFHLFVBQVMsS0FBRztBQUFLLGlCQUFTLEtBQUk7QUFBQyxlQUFHLEVBQUUsSUFBRTtBQUFBLFFBQUc7QUFBQyxZQUFJLEtBQUcsT0FBRyxLQUFHLE1BQUssS0FBRyxNQUFLLEtBQUcsT0FBRyxLQUFHLE1BQUssS0FBRyxHQUFFLEtBQUcsR0FBRSxLQUFHLE1BQUssS0FBRyxJQUFHLEtBQUc7QUFBRSxpQkFBUyxJQUFHO0FBQUMsaUJBQU8sT0FBSyxJQUFFLEtBQUcsRUFBRSxJQUFFLE9BQUssS0FBRyxLQUFHLEtBQUcsRUFBRTtBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxjQUFHLE9BQUssRUFBRSxPQUFLLEdBQUcsUUFBTztBQUFFLGNBQUcsT0FBSyxJQUFFLE1BQUksTUFBSSxFQUFFLFFBQU8sSUFBRSxDQUFDO0FBQUUsY0FBRyxTQUFPLEdBQUcsV0FBVyxRQUFPLE1BQUksT0FBSyxLQUFHLEdBQUcsSUFBRztBQUFHLGNBQUU7QUFBRSxpQkFBTyxNQUFJLElBQUUsSUFBRSxHQUFHO0FBQUEsUUFBQztBQUNsZixpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFHLEtBQUcsR0FBRyxPQUFNLEtBQUcsR0FBRSxLQUFHLE1BQUssTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLGFBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSxjQUFHLE9BQUssSUFBRSxNQUFJLE1BQUksRUFBRSxPQUFJLE1BQUksT0FBSyxJQUFFLE9BQUssTUFBSSxJQUFHLE1BQUksS0FBRyxHQUFHLEdBQUUsQ0FBQyxJQUFHLEdBQUcsR0FBRSxDQUFDLEdBQUUsTUFBSSxLQUFHLE1BQUksS0FBRyxPQUFLLEVBQUUsT0FBSyxPQUFLLEdBQUcsR0FBRSxNQUFJLEdBQUc7QUFBQSxRQUFFO0FBQzdMLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUU7QUFBYSxhQUFHLEdBQUUsQ0FBQztBQUFFLGNBQUksSUFBRSxHQUFHLEdBQUUsTUFBSSxJQUFFLElBQUUsQ0FBQztBQUFFLGNBQUcsTUFBSSxFQUFFLFVBQU8sS0FBRyxHQUFHLENBQUMsR0FBRSxFQUFFLGVBQWEsTUFBSyxFQUFFLG1CQUFpQjtBQUFBLG1CQUFVLElBQUUsSUFBRSxDQUFDLEdBQUUsRUFBRSxxQkFBbUIsR0FBRTtBQUFDLG9CQUFNLEtBQUcsR0FBRyxDQUFDO0FBQUUsZ0JBQUcsTUFBSSxFQUFFLE9BQUksRUFBRSxNQUFJLEdBQUcsR0FBRyxLQUFLLE1BQUssQ0FBQyxDQUFDLElBQUUsR0FBRyxHQUFHLEtBQUssTUFBSyxDQUFDLENBQUMsR0FBRSxLQUFHLEdBQUcsV0FBVTtBQUFDLHFCQUFLLElBQUUsTUFBSSxHQUFHO0FBQUEsWUFBQyxDQUFDLElBQUUsR0FBRyxJQUFHLEVBQUUsR0FBRSxJQUFFO0FBQUEsaUJBQVM7QUFBQyxzQkFBTyxHQUFHLENBQUMsR0FBRTtBQUFBLGdCQUFDLEtBQUs7QUFBRSxzQkFBRTtBQUFHO0FBQUEsZ0JBQU0sS0FBSztBQUFFLHNCQUFFO0FBQUc7QUFBQSxnQkFBTSxLQUFLO0FBQUcsc0JBQUU7QUFBRztBQUFBLGdCQUFNLEtBQUs7QUFBVSxzQkFBRTtBQUFHO0FBQUEsZ0JBQU07QUFBUSxzQkFBRTtBQUFBLGNBQUU7QUFBQyxrQkFBRSxHQUFHLEdBQUUsR0FBRyxLQUFLLE1BQUssQ0FBQyxDQUFDO0FBQUEsWUFBQztBQUFDLGNBQUUsbUJBQWlCO0FBQUUsY0FBRSxlQUFhO0FBQUEsVUFBQztBQUFBLFFBQUM7QUFDMWQsaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxlQUFHO0FBQUcsZUFBRztBQUFFLGNBQUcsT0FBSyxJQUFFLEdBQUcsT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsY0FBSSxJQUFFLEVBQUU7QUFBYSxjQUFHLEdBQUcsS0FBRyxFQUFFLGlCQUFlLEVBQUUsUUFBTztBQUFLLGNBQUksSUFBRSxHQUFHLEdBQUUsTUFBSSxJQUFFLElBQUUsQ0FBQztBQUFFLGNBQUcsTUFBSSxFQUFFLFFBQU87QUFBSyxjQUFHLE9BQUssSUFBRSxPQUFLLE9BQUssSUFBRSxFQUFFLGlCQUFlLEVBQUUsS0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFBLGVBQU07QUFBQyxnQkFBRTtBQUFFLGdCQUFJLElBQUU7QUFBRSxpQkFBRztBQUFFLGdCQUFJLElBQUUsR0FBRztBQUFFLGdCQUFHLE1BQUksS0FBRyxNQUFJLEVBQUUsTUFBRyxNQUFLLEdBQUcsR0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFFO0FBQUcsa0JBQUc7QUFBQyxtQkFBRztBQUFFO0FBQUEsY0FBSyxTQUFPLEdBQUU7QUFBQyxtQkFBRyxHQUFFLENBQUM7QUFBQSxjQUFDO0FBQUEsbUJBQU87QUFBRyxlQUFHO0FBQUUsZUFBRyxVQUFRO0FBQUUsZ0JBQUU7QUFBRSxxQkFBTyxJQUFFLElBQUUsS0FBRyxJQUFFLE1BQUssSUFBRSxHQUFFLElBQUU7QUFBQSxVQUFFO0FBQUMsY0FBRyxNQUFJLEdBQUU7QUFBQyxrQkFBSSxNQUFJLElBQUUsR0FBRyxDQUFDLEdBQUUsTUFBSSxNQUFJLElBQUUsR0FBRSxJQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUksZ0JBQUcsTUFBSSxFQUFFLE9BQU0sSUFBRSxJQUFHLEdBQUcsR0FBRSxDQUFDLEdBQUUsR0FBRyxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsRUFBRSxDQUFDLEdBQUU7QUFBRSxnQkFBRyxNQUFJLEVBQUUsSUFBRyxHQUFFLENBQUM7QUFBQSxpQkFBTTtBQUFDLGtCQUN0ZixFQUFFLFFBQVE7QUFBVSxrQkFBRyxPQUFLLElBQUUsT0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFJLElBQUUsR0FBRyxHQUFFLENBQUMsR0FBRSxNQUFJLE1BQUksSUFBRSxHQUFHLENBQUMsR0FBRSxNQUFJLE1BQUksSUFBRSxHQUFFLElBQUUsR0FBRyxHQUFFLENBQUMsS0FBSSxNQUFJLEdBQUcsT0FBTSxJQUFFLElBQUcsR0FBRyxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsQ0FBQyxHQUFFLEdBQUcsR0FBRSxFQUFFLENBQUMsR0FBRTtBQUFFLGdCQUFFLGVBQWE7QUFBRSxnQkFBRSxnQkFBYztBQUFFLHNCQUFPLEdBQUU7QUFBQSxnQkFBQyxLQUFLO0FBQUEsZ0JBQUUsS0FBSztBQUFFLHdCQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBQSxnQkFBRSxLQUFLO0FBQUUscUJBQUcsR0FBRSxJQUFHLEVBQUU7QUFBRTtBQUFBLGdCQUFNLEtBQUs7QUFBRSxxQkFBRyxHQUFFLENBQUM7QUFBRSx1QkFBSSxJQUFFLGVBQWEsTUFBSSxJQUFFLEtBQUcsTUFBSSxFQUFFLEdBQUUsS0FBRyxJQUFHO0FBQUMsd0JBQUcsTUFBSSxHQUFHLEdBQUUsQ0FBQyxFQUFFO0FBQU0sd0JBQUUsRUFBRTtBQUFlLHlCQUFJLElBQUUsT0FBSyxHQUFFO0FBQUMsd0JBQUU7QUFBRSx3QkFBRSxlQUFhLEVBQUUsaUJBQWU7QUFBRTtBQUFBLG9CQUFLO0FBQUMsc0JBQUUsZ0JBQWMsR0FBRyxHQUFHLEtBQUssTUFBSyxHQUFFLElBQUcsRUFBRSxHQUFFLENBQUM7QUFBRTtBQUFBLGtCQUFLO0FBQUMscUJBQUcsR0FBRSxJQUFHLEVBQUU7QUFBRTtBQUFBLGdCQUFNLEtBQUs7QUFBRSxxQkFBRyxHQUFFLENBQUM7QUFBRSx1QkFBSSxJQUFFLGFBQVcsRUFBRTtBQUN0ZixzQkFBRSxFQUFFO0FBQVcsdUJBQUksSUFBRSxJQUFHLElBQUUsS0FBRztBQUFDLHdCQUFJLElBQUUsS0FBRyxHQUFHLENBQUM7QUFBRSx3QkFBRSxLQUFHO0FBQUUsd0JBQUUsRUFBRSxDQUFDO0FBQUUsd0JBQUUsTUFBSSxJQUFFO0FBQUcseUJBQUcsQ0FBQztBQUFBLGtCQUFDO0FBQUMsc0JBQUU7QUFBRSxzQkFBRSxFQUFFLElBQUU7QUFBRSx1QkFBRyxNQUFJLElBQUUsTUFBSSxNQUFJLElBQUUsTUFBSSxPQUFLLElBQUUsT0FBSyxPQUFLLElBQUUsT0FBSyxNQUFJLElBQUUsTUFBSSxPQUFLLElBQUUsT0FBSyxPQUFLLEdBQUcsSUFBRSxJQUFJLEtBQUc7QUFBRSxzQkFBRyxLQUFHLEdBQUU7QUFBQyxzQkFBRSxnQkFBYyxHQUFHLEdBQUcsS0FBSyxNQUFLLEdBQUUsSUFBRyxFQUFFLEdBQUUsQ0FBQztBQUFFO0FBQUEsa0JBQUs7QUFBQyxxQkFBRyxHQUFFLElBQUcsRUFBRTtBQUFFO0FBQUEsZ0JBQU0sS0FBSztBQUFFLHFCQUFHLEdBQUUsSUFBRyxFQUFFO0FBQUU7QUFBQSxnQkFBTTtBQUFRLHdCQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBQSxjQUFFO0FBQUEsWUFBQztBQUFBLFVBQUM7QUFBQyxhQUFHLEdBQUUsRUFBRSxDQUFDO0FBQUUsaUJBQU8sRUFBRSxpQkFBZSxJQUFFLEdBQUcsS0FBSyxNQUFLLENBQUMsSUFBRTtBQUFBLFFBQUk7QUFDN1csaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxjQUFJLElBQUU7QUFBRyxZQUFFLFFBQVEsY0FBYyxpQkFBZSxHQUFHLEdBQUUsQ0FBQyxFQUFFLFNBQU87QUFBSyxjQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUUsZ0JBQUksTUFBSSxJQUFFLElBQUcsS0FBRyxHQUFFLFNBQU8sS0FBRyxHQUFHLENBQUM7QUFBRyxpQkFBTztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxtQkFBTyxLQUFHLEtBQUcsSUFBRSxHQUFHLEtBQUssTUFBTSxJQUFHLENBQUM7QUFBQSxRQUFDO0FBQzVMLGlCQUFTLEdBQUcsR0FBRTtBQUFDLG1CQUFRLElBQUUsT0FBSTtBQUFDLGdCQUFHLEVBQUUsUUFBTSxPQUFNO0FBQUMsa0JBQUksSUFBRSxFQUFFO0FBQVksa0JBQUcsU0FBTyxNQUFJLElBQUUsRUFBRSxRQUFPLFNBQU8sR0FBRyxVQUFRLElBQUUsR0FBRSxJQUFFLEVBQUUsUUFBTyxLQUFJO0FBQUMsb0JBQUksSUFBRSxFQUFFLENBQUMsR0FBRSxJQUFFLEVBQUU7QUFBWSxvQkFBRSxFQUFFO0FBQU0sb0JBQUc7QUFBQyxzQkFBRyxDQUFDLEdBQUcsRUFBRSxHQUFFLENBQUMsRUFBRSxRQUFNO0FBQUEsZ0JBQUUsU0FBTyxHQUFFO0FBQUMseUJBQU07QUFBQSxnQkFBRTtBQUFBLGNBQUM7QUFBQSxZQUFDO0FBQUMsZ0JBQUUsRUFBRTtBQUFNLGdCQUFHLEVBQUUsZUFBYSxTQUFPLFNBQU8sRUFBRSxHQUFFLFNBQU8sR0FBRSxJQUFFO0FBQUEsaUJBQU07QUFBQyxrQkFBRyxNQUFJLEVBQUU7QUFBTSxxQkFBSyxTQUFPLEVBQUUsV0FBUztBQUFDLG9CQUFHLFNBQU8sRUFBRSxVQUFRLEVBQUUsV0FBUyxFQUFFLFFBQU07QUFBRyxvQkFBRSxFQUFFO0FBQUEsY0FBTTtBQUFDLGdCQUFFLFFBQVEsU0FBTyxFQUFFO0FBQU8sa0JBQUUsRUFBRTtBQUFBLFlBQU87QUFBQSxVQUFDO0FBQUMsaUJBQU07QUFBQSxRQUFFO0FBQ2xhLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsZUFBRyxDQUFDO0FBQUcsZUFBRyxDQUFDO0FBQUcsWUFBRSxrQkFBZ0I7QUFBRSxZQUFFLGVBQWEsQ0FBQztBQUFFLGVBQUksSUFBRSxFQUFFLGlCQUFnQixJQUFFLEtBQUc7QUFBQyxnQkFBSSxJQUFFLEtBQUcsR0FBRyxDQUFDLEdBQUUsSUFBRSxLQUFHO0FBQUUsY0FBRSxDQUFDLElBQUU7QUFBRyxpQkFBRyxDQUFDO0FBQUEsVUFBQztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxjQUFHLE9BQUssSUFBRSxHQUFHLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLGFBQUc7QUFBRSxjQUFJLElBQUUsR0FBRyxHQUFFLENBQUM7QUFBRSxjQUFHLE9BQUssSUFBRSxHQUFHLFFBQU8sR0FBRyxHQUFFLEVBQUUsQ0FBQyxHQUFFO0FBQUssY0FBSSxJQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUUsY0FBRyxNQUFJLEVBQUUsT0FBSyxNQUFJLEdBQUU7QUFBQyxnQkFBSSxJQUFFLEdBQUcsQ0FBQztBQUFFLGtCQUFJLE1BQUksSUFBRSxHQUFFLElBQUUsR0FBRyxHQUFFLENBQUM7QUFBQSxVQUFFO0FBQUMsY0FBRyxNQUFJLEVBQUUsT0FBTSxJQUFFLElBQUcsR0FBRyxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsQ0FBQyxHQUFFLEdBQUcsR0FBRSxFQUFFLENBQUMsR0FBRTtBQUFFLGNBQUcsTUFBSSxFQUFFLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLFlBQUUsZUFBYSxFQUFFLFFBQVE7QUFBVSxZQUFFLGdCQUFjO0FBQUUsYUFBRyxHQUFFLElBQUcsRUFBRTtBQUFFLGFBQUcsR0FBRSxFQUFFLENBQUM7QUFBRSxpQkFBTztBQUFBLFFBQUk7QUFDdmQsaUJBQVMsR0FBRyxHQUFFO0FBQUMsbUJBQU8sTUFBSSxNQUFJLEdBQUcsT0FBSyxPQUFLLElBQUUsTUFBSSxHQUFHO0FBQUUsY0FBSSxJQUFFO0FBQUUsZUFBRztBQUFFLGNBQUksSUFBRSxFQUFFLFlBQVcsSUFBRTtBQUFFLGNBQUc7QUFBQyxnQkFBRyxFQUFFLGFBQVcsTUFBSyxJQUFFLEdBQUUsRUFBRSxRQUFPLEVBQUU7QUFBQSxVQUFDLFVBQUM7QUFBUSxnQkFBRSxHQUFFLEVBQUUsYUFBVyxHQUFFLElBQUUsR0FBRSxPQUFLLElBQUUsTUFBSSxHQUFHO0FBQUEsVUFBQztBQUFBLFFBQUM7QUFBQyxpQkFBUyxLQUFJO0FBQUMsZUFBRyxHQUFHO0FBQVEsWUFBRSxFQUFFO0FBQUEsUUFBQztBQUNyTixpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLFlBQUUsZUFBYTtBQUFLLFlBQUUsZ0JBQWM7QUFBRSxjQUFJLElBQUUsRUFBRTtBQUFjLGdCQUFJLE9BQUssRUFBRSxnQkFBYyxJQUFHLEdBQUcsQ0FBQztBQUFHLGNBQUcsU0FBTyxFQUFFLE1BQUksSUFBRSxFQUFFLFFBQU8sU0FBTyxLQUFHO0FBQUMsZ0JBQUksSUFBRTtBQUFFLGVBQUcsQ0FBQztBQUFFLG9CQUFPLEVBQUUsS0FBSTtBQUFBLGNBQUMsS0FBSztBQUFFLG9CQUFFLEVBQUUsS0FBSztBQUFrQix5QkFBTyxLQUFHLFdBQVMsS0FBRyxHQUFHO0FBQUU7QUFBQSxjQUFNLEtBQUs7QUFBRSxtQkFBRztBQUFFLGtCQUFFLENBQUM7QUFBRSxrQkFBRSxDQUFDO0FBQUUsbUJBQUc7QUFBRTtBQUFBLGNBQU0sS0FBSztBQUFFLG1CQUFHLENBQUM7QUFBRTtBQUFBLGNBQU0sS0FBSztBQUFFLG1CQUFHO0FBQUU7QUFBQSxjQUFNLEtBQUs7QUFBRyxrQkFBRSxDQUFDO0FBQUU7QUFBQSxjQUFNLEtBQUs7QUFBRyxrQkFBRSxDQUFDO0FBQUU7QUFBQSxjQUFNLEtBQUs7QUFBRyxtQkFBRyxFQUFFLEtBQUssUUFBUTtBQUFFO0FBQUEsY0FBTSxLQUFLO0FBQUEsY0FBRyxLQUFLO0FBQUcsbUJBQUc7QUFBQSxZQUFDO0FBQUMsZ0JBQUUsRUFBRTtBQUFBLFVBQU07QUFBQyxjQUFFO0FBQUUsY0FBRSxJQUFFLEdBQUcsRUFBRSxTQUFRLElBQUk7QUFBRSxjQUFFLEtBQUc7QUFBRSxjQUFFO0FBQUUsZUFBRztBQUFLLGVBQUcsS0FBRyxLQUFHO0FBQUUsZUFBRyxLQUFHO0FBQUssY0FBRyxTQUFPLElBQUc7QUFBQyxpQkFBSSxJQUN6ZixHQUFFLElBQUUsR0FBRyxRQUFPLElBQUksS0FBRyxJQUFFLEdBQUcsQ0FBQyxHQUFFLElBQUUsRUFBRSxhQUFZLFNBQU8sR0FBRTtBQUFDLGdCQUFFLGNBQVk7QUFBSyxrQkFBSSxJQUFFLEVBQUUsTUFBSyxJQUFFLEVBQUU7QUFBUSxrQkFBRyxTQUFPLEdBQUU7QUFBQyxvQkFBSSxJQUFFLEVBQUU7QUFBSyxrQkFBRSxPQUFLO0FBQUUsa0JBQUUsT0FBSztBQUFBLGNBQUM7QUFBQyxnQkFBRSxVQUFRO0FBQUEsWUFBQztBQUFDLGlCQUFHO0FBQUEsVUFBSTtBQUFDLGlCQUFPO0FBQUEsUUFBQztBQUMzSyxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGFBQUU7QUFBQyxnQkFBSSxJQUFFO0FBQUUsZ0JBQUc7QUFBQyxpQkFBRztBQUFFLGlCQUFHLFVBQVE7QUFBRyxrQkFBRyxJQUFHO0FBQUMseUJBQVEsSUFBRSxFQUFFLGVBQWMsU0FBTyxLQUFHO0FBQUMsc0JBQUksSUFBRSxFQUFFO0FBQU0sMkJBQU8sTUFBSSxFQUFFLFVBQVE7QUFBTSxzQkFBRSxFQUFFO0FBQUEsZ0JBQUk7QUFBQyxxQkFBRztBQUFBLGNBQUU7QUFBQyxtQkFBRztBQUFFLGtCQUFFLElBQUUsSUFBRTtBQUFLLG1CQUFHO0FBQUcsbUJBQUc7QUFBRSxpQkFBRyxVQUFRO0FBQUssa0JBQUcsU0FBTyxLQUFHLFNBQU8sRUFBRSxRQUFPO0FBQUMsb0JBQUU7QUFBRSxxQkFBRztBQUFFLG9CQUFFO0FBQUs7QUFBQSxjQUFLO0FBQUMsaUJBQUU7QUFBQyxvQkFBSSxJQUFFLEdBQUUsSUFBRSxFQUFFLFFBQU8sSUFBRSxHQUFFLElBQUU7QUFBRSxvQkFBRTtBQUFFLGtCQUFFLFNBQU87QUFBTSxvQkFBRyxTQUFPLEtBQUcsYUFBVyxPQUFPLEtBQUcsZUFBYSxPQUFPLEVBQUUsTUFBSztBQUFDLHNCQUFJLElBQUUsR0FBRSxJQUFFLEdBQUUsSUFBRSxFQUFFO0FBQUksc0JBQUcsT0FBSyxFQUFFLE9BQUssT0FBSyxNQUFJLEtBQUcsT0FBSyxLQUFHLE9BQUssSUFBRztBQUFDLHdCQUFJLElBQUUsRUFBRTtBQUFVLHlCQUFHLEVBQUUsY0FBWSxFQUFFLGFBQVksRUFBRSxnQkFBYyxFQUFFLGVBQ3hlLEVBQUUsUUFBTSxFQUFFLFVBQVEsRUFBRSxjQUFZLE1BQUssRUFBRSxnQkFBYztBQUFBLGtCQUFLO0FBQUMsc0JBQUksSUFBRSxHQUFHLENBQUM7QUFBRSxzQkFBRyxTQUFPLEdBQUU7QUFBQyxzQkFBRSxTQUFPO0FBQUssdUJBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsc0JBQUUsT0FBSyxLQUFHLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSx3QkFBRTtBQUFFLHdCQUFFO0FBQUUsd0JBQUksSUFBRSxFQUFFO0FBQVksd0JBQUcsU0FBTyxHQUFFO0FBQUMsMEJBQUksSUFBRSxvQkFBSTtBQUFJLHdCQUFFLElBQUksQ0FBQztBQUFFLHdCQUFFLGNBQVk7QUFBQSxvQkFBQyxNQUFNLEdBQUUsSUFBSSxDQUFDO0FBQUUsMEJBQU07QUFBQSxrQkFBQyxPQUFLO0FBQUMsd0JBQUcsT0FBSyxJQUFFLElBQUc7QUFBQyx5QkFBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLHlCQUFHO0FBQUUsNEJBQU07QUFBQSxvQkFBQztBQUFDLHdCQUFFLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBQSxrQkFBQztBQUFBLGdCQUFDLFdBQVMsS0FBRyxFQUFFLE9BQUssR0FBRTtBQUFDLHNCQUFJLEtBQUcsR0FBRyxDQUFDO0FBQUUsc0JBQUcsU0FBTyxJQUFHO0FBQUMsMkJBQUssR0FBRyxRQUFNLFdBQVMsR0FBRyxTQUFPO0FBQUssdUJBQUcsSUFBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsdUJBQUcsR0FBRyxHQUFFLENBQUMsQ0FBQztBQUFFLDBCQUFNO0FBQUEsa0JBQUM7QUFBQSxnQkFBQztBQUFDLG9CQUFFLElBQUUsR0FBRyxHQUFFLENBQUM7QUFBRSxzQkFBSSxNQUFJLElBQUU7QUFBRyx5QkFBTyxLQUFHLEtBQUcsQ0FBQyxDQUFDLElBQUUsR0FBRyxLQUFLLENBQUM7QUFBRSxvQkFBRTtBQUFFLG1CQUFFO0FBQUMsMEJBQU8sRUFBRSxLQUFJO0FBQUEsb0JBQUMsS0FBSztBQUFFLHdCQUFFLFNBQ2xmO0FBQU0sMkJBQUcsQ0FBQztBQUFFLHdCQUFFLFNBQU87QUFBRSwwQkFBSSxJQUFFLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSx5QkFBRyxHQUFFLENBQUM7QUFBRSw0QkFBTTtBQUFBLG9CQUFFLEtBQUs7QUFBRSwwQkFBRTtBQUFFLDBCQUFJLElBQUUsRUFBRSxNQUFLLElBQUUsRUFBRTtBQUFVLDBCQUFHLE9BQUssRUFBRSxRQUFNLFNBQU8sZUFBYSxPQUFPLEVBQUUsNEJBQTBCLFNBQU8sS0FBRyxlQUFhLE9BQU8sRUFBRSxzQkFBb0IsU0FBTyxNQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSTtBQUFDLDBCQUFFLFNBQU87QUFBTSw2QkFBRyxDQUFDO0FBQUUsMEJBQUUsU0FBTztBQUFFLDRCQUFJLEtBQUcsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLDJCQUFHLEdBQUUsRUFBRTtBQUFFLDhCQUFNO0FBQUEsc0JBQUM7QUFBQSxrQkFBQztBQUFDLHNCQUFFLEVBQUU7QUFBQSxnQkFBTSxTQUFPLFNBQU87QUFBQSxjQUFFO0FBQUMsaUJBQUcsQ0FBQztBQUFBLFlBQUMsU0FBTyxJQUFHO0FBQUMsa0JBQUU7QUFBRyxvQkFBSSxLQUFHLFNBQU8sTUFBSSxJQUFFLElBQUUsRUFBRTtBQUFRO0FBQUEsWUFBUTtBQUFDO0FBQUEsVUFBSyxTQUFPO0FBQUEsUUFBRTtBQUFDLGlCQUFTLEtBQUk7QUFBQyxjQUFJLElBQUUsR0FBRztBQUFRLGFBQUcsVUFBUTtBQUFHLGlCQUFPLFNBQU8sSUFBRSxLQUFHO0FBQUEsUUFBQztBQUM3ZCxpQkFBUyxLQUFJO0FBQUMsY0FBRyxNQUFJLEtBQUcsTUFBSSxLQUFHLE1BQUksRUFBRSxLQUFFO0FBQUUsbUJBQU8sS0FBRyxPQUFLLEtBQUcsY0FBWSxPQUFLLEtBQUcsY0FBWSxHQUFHLEdBQUUsQ0FBQztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRTtBQUFFLGVBQUc7QUFBRSxjQUFJLElBQUUsR0FBRztBQUFFLGNBQUcsTUFBSSxLQUFHLE1BQUksRUFBRSxNQUFHLE1BQUssR0FBRyxHQUFFLENBQUM7QUFBRTtBQUFHLGdCQUFHO0FBQUMsaUJBQUc7QUFBRTtBQUFBLFlBQUssU0FBTyxHQUFFO0FBQUMsaUJBQUcsR0FBRSxDQUFDO0FBQUEsWUFBQztBQUFBLGlCQUFPO0FBQUcsYUFBRztBQUFFLGNBQUU7QUFBRSxhQUFHLFVBQVE7QUFBRSxjQUFHLFNBQU8sRUFBRSxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxjQUFFO0FBQUssY0FBRTtBQUFFLGlCQUFPO0FBQUEsUUFBQztBQUFDLGlCQUFTLEtBQUk7QUFBQyxpQkFBSyxTQUFPLElBQUcsSUFBRyxDQUFDO0FBQUEsUUFBQztBQUFDLGlCQUFTLEtBQUk7QUFBQyxpQkFBSyxTQUFPLEtBQUcsQ0FBQyxHQUFHLElBQUcsSUFBRyxDQUFDO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGNBQUksSUFBRSxHQUFHLEVBQUUsV0FBVSxHQUFFLEVBQUU7QUFBRSxZQUFFLGdCQUFjLEVBQUU7QUFBYSxtQkFBTyxJQUFFLEdBQUcsQ0FBQyxJQUFFLElBQUU7QUFBRSxhQUFHLFVBQVE7QUFBQSxRQUFJO0FBQzFkLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGNBQUksSUFBRTtBQUFFLGFBQUU7QUFBQyxnQkFBSSxJQUFFLEVBQUU7QUFBVSxnQkFBRSxFQUFFO0FBQU8sZ0JBQUcsT0FBSyxFQUFFLFFBQU0sUUFBTztBQUFDLGtCQUFHLElBQUUsR0FBRyxHQUFFLEdBQUUsRUFBRSxHQUFFLFNBQU8sR0FBRTtBQUFDLG9CQUFFO0FBQUU7QUFBQSxjQUFNO0FBQUEsWUFBQyxPQUFLO0FBQUMsa0JBQUUsR0FBRyxHQUFFLENBQUM7QUFBRSxrQkFBRyxTQUFPLEdBQUU7QUFBQyxrQkFBRSxTQUFPO0FBQU0sb0JBQUU7QUFBRTtBQUFBLGNBQU07QUFBQyxrQkFBRyxTQUFPLEVBQUUsR0FBRSxTQUFPLE9BQU0sRUFBRSxlQUFhLEdBQUUsRUFBRSxZQUFVO0FBQUEsbUJBQVM7QUFBQyxvQkFBRTtBQUFFLG9CQUFFO0FBQUs7QUFBQSxjQUFNO0FBQUEsWUFBQztBQUFDLGdCQUFFLEVBQUU7QUFBUSxnQkFBRyxTQUFPLEdBQUU7QUFBQyxrQkFBRTtBQUFFO0FBQUEsWUFBTTtBQUFDLGdCQUFFLElBQUU7QUFBQSxVQUFDLFNBQU8sU0FBTztBQUFHLGdCQUFJLE1BQUksSUFBRTtBQUFBLFFBQUU7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEdBQUUsSUFBRSxFQUFFO0FBQVcsY0FBRztBQUFDLGNBQUUsYUFBVyxNQUFLLElBQUUsR0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSxVQUFDLFVBQUM7QUFBUSxjQUFFLGFBQVcsR0FBRSxJQUFFO0FBQUEsVUFBQztBQUFDLGlCQUFPO0FBQUEsUUFBSTtBQUM3YixpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQztBQUFHLGVBQUc7QUFBQSxpQkFBUSxTQUFPO0FBQUksY0FBRyxPQUFLLElBQUUsR0FBRyxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxjQUFFLEVBQUU7QUFBYSxjQUFJLElBQUUsRUFBRTtBQUFjLGNBQUcsU0FBTyxFQUFFLFFBQU87QUFBSyxZQUFFLGVBQWE7QUFBSyxZQUFFLGdCQUFjO0FBQUUsY0FBRyxNQUFJLEVBQUUsUUFBUSxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxZQUFFLGVBQWE7QUFBSyxZQUFFLG1CQUFpQjtBQUFFLGNBQUksSUFBRSxFQUFFLFFBQU0sRUFBRTtBQUFXLGFBQUcsR0FBRSxDQUFDO0FBQUUsZ0JBQUksTUFBSSxJQUFFLElBQUUsTUFBSyxJQUFFO0FBQUcsaUJBQUssRUFBRSxlQUFhLFNBQU8sT0FBSyxFQUFFLFFBQU0sU0FBTyxPQUFLLEtBQUcsTUFBRyxHQUFHLElBQUcsV0FBVTtBQUFDLGVBQUc7QUFBRSxtQkFBTztBQUFBLFVBQUksQ0FBQztBQUFHLGNBQUUsT0FBSyxFQUFFLFFBQU07QUFBTyxjQUFHLE9BQUssRUFBRSxlQUFhLFVBQVEsR0FBRTtBQUFDLGdCQUFFLEVBQUU7QUFBVyxjQUFFLGFBQVc7QUFBSyxnQkFBSSxJQUN2ZjtBQUFFLGdCQUFFO0FBQUUsZ0JBQUksSUFBRTtBQUFFLGlCQUFHO0FBQUUsZUFBRyxVQUFRO0FBQUssZUFBRyxHQUFFLENBQUM7QUFBRSxlQUFHLEdBQUUsQ0FBQztBQUFFLGVBQUcsRUFBRSxhQUFhO0FBQUUsY0FBRSxVQUFRO0FBQUUsZUFBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLGVBQUc7QUFBRSxnQkFBRTtBQUFFLGdCQUFFO0FBQUUsY0FBRSxhQUFXO0FBQUEsVUFBQyxNQUFNLEdBQUUsVUFBUTtBQUFFLGlCQUFLLEtBQUcsT0FBRyxLQUFHLEdBQUUsS0FBRztBQUFHLGNBQUUsRUFBRTtBQUFhLGdCQUFJLE1BQUksS0FBRztBQUFNLGFBQUcsRUFBRSxXQUFVLENBQUM7QUFBRSxhQUFHLEdBQUUsRUFBRSxDQUFDO0FBQUUsY0FBRyxTQUFPLEVBQUUsTUFBSSxJQUFFLEVBQUUsb0JBQW1CLElBQUUsR0FBRSxJQUFFLEVBQUUsUUFBTyxJQUFJLEtBQUUsRUFBRSxDQUFDLEdBQUUsRUFBRSxFQUFFLE9BQU0sRUFBQyxnQkFBZSxFQUFFLE9BQU0sUUFBTyxFQUFFLE9BQU0sQ0FBQztBQUFFLGNBQUcsR0FBRyxPQUFNLEtBQUcsT0FBRyxJQUFFLElBQUcsS0FBRyxNQUFLO0FBQUUsaUJBQUssS0FBRyxNQUFJLE1BQUksRUFBRSxPQUFLLEdBQUc7QUFBRSxjQUFFLEVBQUU7QUFBYSxpQkFBSyxJQUFFLEtBQUcsTUFBSSxLQUFHLFFBQU0sS0FBRyxHQUFFLEtBQUcsS0FBRyxLQUFHO0FBQUUsYUFBRztBQUFFLGlCQUFPO0FBQUEsUUFBSTtBQUN4ZCxpQkFBUyxLQUFJO0FBQUMsY0FBRyxTQUFPLElBQUc7QUFBQyxnQkFBSSxJQUFFLEdBQUcsRUFBRSxHQUFFLElBQUUsRUFBRSxZQUFXLElBQUU7QUFBRSxnQkFBRztBQUFDLGdCQUFFLGFBQVc7QUFBSyxrQkFBRSxLQUFHLElBQUUsS0FBRztBQUFFLGtCQUFHLFNBQU8sR0FBRyxLQUFJLElBQUU7QUFBQSxtQkFBTztBQUFDLG9CQUFFO0FBQUcscUJBQUc7QUFBSyxxQkFBRztBQUFFLG9CQUFHLE9BQUssSUFBRSxHQUFHLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLG9CQUFJLElBQUU7QUFBRSxxQkFBRztBQUFFLHFCQUFJLElBQUUsRUFBRSxTQUFRLFNBQU8sS0FBRztBQUFDLHNCQUFJLElBQUUsR0FBRSxJQUFFLEVBQUU7QUFBTSxzQkFBRyxPQUFLLEVBQUUsUUFBTSxLQUFJO0FBQUMsd0JBQUksSUFBRSxFQUFFO0FBQVUsd0JBQUcsU0FBTyxHQUFFO0FBQUMsK0JBQVEsSUFBRSxHQUFFLElBQUUsRUFBRSxRQUFPLEtBQUk7QUFBQyw0QkFBSSxJQUFFLEVBQUUsQ0FBQztBQUFFLDZCQUFJLElBQUUsR0FBRSxTQUFPLEtBQUc7QUFBQyw4QkFBSSxJQUFFO0FBQUUsa0NBQU8sRUFBRSxLQUFJO0FBQUEsNEJBQUMsS0FBSztBQUFBLDRCQUFFLEtBQUs7QUFBQSw0QkFBRyxLQUFLO0FBQUcsaUNBQUcsR0FBRSxHQUFFLENBQUM7QUFBQSwwQkFBQztBQUFDLDhCQUFJLElBQUUsRUFBRTtBQUFNLDhCQUFHLFNBQU8sRUFBRSxHQUFFLFNBQU8sR0FBRSxJQUFFO0FBQUEsOEJBQU8sUUFBSyxTQUFPLEtBQUc7QUFBQyxnQ0FBRTtBQUFFLGdDQUFJLElBQUUsRUFBRSxTQUFRLElBQUUsRUFBRTtBQUFPLCtCQUFHLENBQUM7QUFBRSxnQ0FBRyxNQUNqZixHQUFFO0FBQUMsa0NBQUU7QUFBSztBQUFBLDRCQUFLO0FBQUMsZ0NBQUcsU0FBTyxHQUFFO0FBQUMsZ0NBQUUsU0FBTztBQUFFLGtDQUFFO0FBQUU7QUFBQSw0QkFBSztBQUFDLGdDQUFFO0FBQUEsMEJBQUM7QUFBQSx3QkFBQztBQUFBLHNCQUFDO0FBQUMsMEJBQUksSUFBRSxFQUFFO0FBQVUsMEJBQUcsU0FBTyxHQUFFO0FBQUMsNEJBQUksSUFBRSxFQUFFO0FBQU0sNEJBQUcsU0FBTyxHQUFFO0FBQUMsNEJBQUUsUUFBTTtBQUFLLDZCQUFFO0FBQUMsZ0NBQUksS0FBRyxFQUFFO0FBQVEsOEJBQUUsVUFBUTtBQUFLLGdDQUFFO0FBQUEsMEJBQUUsU0FBTyxTQUFPO0FBQUEsd0JBQUU7QUFBQSxzQkFBQztBQUFDLDBCQUFFO0FBQUEsb0JBQUM7QUFBQSxrQkFBQztBQUFDLHNCQUFHLE9BQUssRUFBRSxlQUFhLFNBQU8sU0FBTyxFQUFFLEdBQUUsU0FBTyxHQUFFLElBQUU7QUFBQSxzQkFBTyxHQUFFLFFBQUssU0FBTyxLQUFHO0FBQUMsd0JBQUU7QUFBRSx3QkFBRyxPQUFLLEVBQUUsUUFBTSxNQUFNLFNBQU8sRUFBRSxLQUFJO0FBQUEsc0JBQUMsS0FBSztBQUFBLHNCQUFFLEtBQUs7QUFBQSxzQkFBRyxLQUFLO0FBQUcsMkJBQUcsR0FBRSxHQUFFLEVBQUUsTUFBTTtBQUFBLG9CQUFDO0FBQUMsd0JBQUksSUFBRSxFQUFFO0FBQVEsd0JBQUcsU0FBTyxHQUFFO0FBQUMsd0JBQUUsU0FBTyxFQUFFO0FBQU8sMEJBQUU7QUFBRSw0QkFBTTtBQUFBLG9CQUFDO0FBQUMsd0JBQUUsRUFBRTtBQUFBLGtCQUFNO0FBQUEsZ0JBQUM7QUFBQyxvQkFBSSxJQUFFLEVBQUU7QUFBUSxxQkFBSSxJQUFFLEdBQUUsU0FBTyxLQUFHO0FBQUMsc0JBQUU7QUFBRSxzQkFBSSxJQUFFLEVBQUU7QUFBTSxzQkFBRyxPQUFLLEVBQUUsZUFBYSxTQUFPLFNBQ3BmLEVBQUUsR0FBRSxTQUFPLEdBQUUsSUFBRTtBQUFBLHNCQUFPLEdBQUUsTUFBSSxJQUFFLEdBQUUsU0FBTyxLQUFHO0FBQUMsd0JBQUU7QUFBRSx3QkFBRyxPQUFLLEVBQUUsUUFBTSxNQUFNLEtBQUc7QUFBQyw4QkFBTyxFQUFFLEtBQUk7QUFBQSx3QkFBQyxLQUFLO0FBQUEsd0JBQUUsS0FBSztBQUFBLHdCQUFHLEtBQUs7QUFBRyw2QkFBRyxHQUFFLENBQUM7QUFBQSxzQkFBQztBQUFBLG9CQUFDLFNBQU8sSUFBRztBQUFDLHdCQUFFLEdBQUUsRUFBRSxRQUFPLEVBQUU7QUFBQSxvQkFBQztBQUFDLHdCQUFHLE1BQUksR0FBRTtBQUFDLDBCQUFFO0FBQUssNEJBQU07QUFBQSxvQkFBQztBQUFDLHdCQUFJLEtBQUcsRUFBRTtBQUFRLHdCQUFHLFNBQU8sSUFBRztBQUFDLHlCQUFHLFNBQU8sRUFBRTtBQUFPLDBCQUFFO0FBQUcsNEJBQU07QUFBQSxvQkFBQztBQUFDLHdCQUFFLEVBQUU7QUFBQSxrQkFBTTtBQUFBLGdCQUFDO0FBQUMsb0JBQUU7QUFBRSxtQkFBRztBQUFFLG9CQUFHLE1BQUksZUFBYSxPQUFPLEdBQUcsc0JBQXNCLEtBQUc7QUFBQyxxQkFBRyxzQkFBc0IsSUFBRyxDQUFDO0FBQUEsZ0JBQUMsU0FBTyxJQUFHO0FBQUEsZ0JBQUM7QUFBQyxvQkFBRTtBQUFBLGNBQUU7QUFBQyxxQkFBTztBQUFBLFlBQUMsVUFBQztBQUFRLGtCQUFFLEdBQUUsRUFBRSxhQUFXO0FBQUEsWUFBQztBQUFBLFVBQUM7QUFBQyxpQkFBTTtBQUFBLFFBQUU7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLGNBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLGNBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLGNBQUUsRUFBRTtBQUFFLG1CQUFPLE1BQUksR0FBRyxHQUFFLEdBQUUsQ0FBQyxHQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUEsUUFBRTtBQUM1ZSxpQkFBUyxFQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRyxNQUFJLEVBQUUsSUFBSSxJQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUEsY0FBTyxRQUFLLFNBQU8sS0FBRztBQUFDLGdCQUFHLE1BQUksRUFBRSxLQUFJO0FBQUMsaUJBQUcsR0FBRSxHQUFFLENBQUM7QUFBRTtBQUFBLFlBQUssV0FBUyxNQUFJLEVBQUUsS0FBSTtBQUFDLGtCQUFJLElBQUUsRUFBRTtBQUFVLGtCQUFHLGVBQWEsT0FBTyxFQUFFLEtBQUssNEJBQTBCLGVBQWEsT0FBTyxFQUFFLHNCQUFvQixTQUFPLE1BQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFHO0FBQUMsb0JBQUUsR0FBRyxHQUFFLENBQUM7QUFBRSxvQkFBRSxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUUsb0JBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLG9CQUFFLEVBQUU7QUFBRSx5QkFBTyxNQUFJLEdBQUcsR0FBRSxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFHO0FBQUEsY0FBSztBQUFBLFlBQUM7QUFBQyxnQkFBRSxFQUFFO0FBQUEsVUFBTTtBQUFBLFFBQUM7QUFDblYsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFO0FBQVUsbUJBQU8sS0FBRyxFQUFFLE9BQU8sQ0FBQztBQUFFLGNBQUUsRUFBRTtBQUFFLFlBQUUsZUFBYSxFQUFFLGlCQUFlO0FBQUUsZ0JBQUksTUFBSSxJQUFFLE9BQUssTUFBSSxNQUFJLEtBQUcsTUFBSSxNQUFJLElBQUUsZUFBYSxLQUFHLE1BQUksRUFBRSxJQUFFLEtBQUcsR0FBRyxHQUFFLENBQUMsSUFBRSxNQUFJO0FBQUcsYUFBRyxHQUFFLENBQUM7QUFBQSxRQUFDO0FBQUMsaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxnQkFBSSxNQUFJLE9BQUssRUFBRSxPQUFLLEtBQUcsSUFBRSxLQUFHLElBQUUsSUFBRyxPQUFLLEdBQUUsT0FBSyxLQUFHLGVBQWEsS0FBRztBQUFXLGNBQUksSUFBRSxFQUFFO0FBQUUsY0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLG1CQUFPLE1BQUksR0FBRyxHQUFFLEdBQUUsQ0FBQyxHQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUEsUUFBRTtBQUFDLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGNBQUksSUFBRSxFQUFFLGVBQWMsSUFBRTtBQUFFLG1CQUFPLE1BQUksSUFBRSxFQUFFO0FBQVcsYUFBRyxHQUFFLENBQUM7QUFBQSxRQUFDO0FBQ2paLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFO0FBQUUsa0JBQU8sRUFBRSxLQUFJO0FBQUEsWUFBQyxLQUFLO0FBQUcsa0JBQUksSUFBRSxFQUFFO0FBQVUsa0JBQUksSUFBRSxFQUFFO0FBQWMsdUJBQU8sTUFBSSxJQUFFLEVBQUU7QUFBVztBQUFBLFlBQU0sS0FBSztBQUFHLGtCQUFFLEVBQUU7QUFBVTtBQUFBLFlBQU07QUFBUSxvQkFBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUEsVUFBRTtBQUFDLG1CQUFPLEtBQUcsRUFBRSxPQUFPLENBQUM7QUFBRSxhQUFHLEdBQUUsQ0FBQztBQUFBLFFBQUM7QUFBQyxZQUFJO0FBQ2xOLGFBQUcsU0FBUyxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUcsU0FBTyxFQUFFLEtBQUcsRUFBRSxrQkFBZ0IsRUFBRSxnQkFBYyxFQUFFLFFBQVEsS0FBRTtBQUFBLGVBQU87QUFBQyxnQkFBRyxPQUFLLEVBQUUsUUFBTSxNQUFJLE9BQUssRUFBRSxRQUFNLEtBQUssUUFBTyxJQUFFLE9BQUcsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLGdCQUFFLE9BQUssRUFBRSxRQUFNLFVBQVEsT0FBRztBQUFBLFVBQUU7QUFBQSxjQUFNLEtBQUUsT0FBRyxLQUFHLE9BQUssRUFBRSxRQUFNLFlBQVUsR0FBRyxHQUFFLElBQUcsRUFBRSxLQUFLO0FBQUUsWUFBRSxRQUFNO0FBQUUsa0JBQU8sRUFBRSxLQUFJO0FBQUEsWUFBQyxLQUFLO0FBQUUsa0JBQUksSUFBRSxFQUFFO0FBQUssaUJBQUcsR0FBRSxDQUFDO0FBQUUsa0JBQUUsRUFBRTtBQUFhLGtCQUFJLElBQUUsR0FBRyxHQUFFLEVBQUUsT0FBTztBQUFFLGlCQUFHLEdBQUUsQ0FBQztBQUFFLGtCQUFFLEdBQUcsTUFBSyxHQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxrQkFBSSxJQUFFLEdBQUc7QUFBRSxnQkFBRSxTQUFPO0FBQUUsMkJBQVcsT0FBTyxLQUFHLFNBQU8sS0FBRyxlQUFhLE9BQU8sRUFBRSxVQUFRLFdBQVMsRUFBRSxZQUFVLEVBQUUsTUFBSSxHQUFFLEVBQUUsZ0JBQWMsTUFBSyxFQUFFLGNBQVksTUFDamYsRUFBRSxDQUFDLEtBQUcsSUFBRSxNQUFHLEdBQUcsQ0FBQyxLQUFHLElBQUUsT0FBRyxFQUFFLGdCQUFjLFNBQU8sRUFBRSxTQUFPLFdBQVMsRUFBRSxRQUFNLEVBQUUsUUFBTSxNQUFLLEdBQUcsQ0FBQyxHQUFFLEVBQUUsVUFBUSxJQUFHLEVBQUUsWUFBVSxHQUFFLEVBQUUsa0JBQWdCLEdBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDLEdBQUUsSUFBRSxHQUFHLE1BQUssR0FBRSxHQUFFLE1BQUcsR0FBRSxDQUFDLE1BQUksRUFBRSxNQUFJLEdBQUUsS0FBRyxLQUFHLEdBQUcsQ0FBQyxHQUFFLEVBQUUsTUFBSyxHQUFFLEdBQUUsQ0FBQyxHQUFFLElBQUUsRUFBRTtBQUFPLHFCQUFPO0FBQUEsWUFBRSxLQUFLO0FBQUcsa0JBQUUsRUFBRTtBQUFZLGlCQUFFO0FBQUMsbUJBQUcsR0FBRSxDQUFDO0FBQUUsb0JBQUUsRUFBRTtBQUFhLG9CQUFFLEVBQUU7QUFBTSxvQkFBRSxFQUFFLEVBQUUsUUFBUTtBQUFFLGtCQUFFLE9BQUs7QUFBRSxvQkFBRSxFQUFFLE1BQUksR0FBRyxDQUFDO0FBQUUsb0JBQUUsR0FBRyxHQUFFLENBQUM7QUFBRSx3QkFBTyxHQUFFO0FBQUEsa0JBQUMsS0FBSztBQUFFLHdCQUFFLEdBQUcsTUFBSyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsMEJBQU07QUFBQSxrQkFBRSxLQUFLO0FBQUUsd0JBQUUsR0FBRyxNQUFLLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSwwQkFBTTtBQUFBLGtCQUFFLEtBQUs7QUFBRyx3QkFBRSxHQUFHLE1BQUssR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLDBCQUFNO0FBQUEsa0JBQUUsS0FBSztBQUFHLHdCQUFFLEdBQUcsTUFBSyxHQUFFLEdBQUUsR0FBRyxFQUFFLE1BQUssQ0FBQyxHQUFFLENBQUM7QUFBRSwwQkFBTTtBQUFBLGdCQUFDO0FBQUMsc0JBQU0sTUFBTTtBQUFBLGtCQUFFO0FBQUEsa0JBQ2hnQjtBQUFBLGtCQUFFO0FBQUEsZ0JBQUUsQ0FBQztBQUFBLGNBQUU7QUFBQyxxQkFBTztBQUFBLFlBQUUsS0FBSztBQUFFLHFCQUFPLElBQUUsRUFBRSxNQUFLLElBQUUsRUFBRSxjQUFhLElBQUUsRUFBRSxnQkFBYyxJQUFFLElBQUUsR0FBRyxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFBLFlBQUUsS0FBSztBQUFFLHFCQUFPLElBQUUsRUFBRSxNQUFLLElBQUUsRUFBRSxjQUFhLElBQUUsRUFBRSxnQkFBYyxJQUFFLElBQUUsR0FBRyxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFBLFlBQUUsS0FBSztBQUFFLGlCQUFFO0FBQUMsbUJBQUcsQ0FBQztBQUFFLG9CQUFHLFNBQU8sRUFBRSxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxvQkFBRSxFQUFFO0FBQWEsb0JBQUUsRUFBRTtBQUFjLG9CQUFFLEVBQUU7QUFBUSxtQkFBRyxHQUFFLENBQUM7QUFBRSxtQkFBRyxHQUFFLEdBQUUsTUFBSyxDQUFDO0FBQUUsb0JBQUksSUFBRSxFQUFFO0FBQWMsb0JBQUUsRUFBRTtBQUFRLG9CQUFHLE1BQUksRUFBRSxhQUFhLEtBQUcsSUFBRSxFQUFDLFNBQVEsR0FBRSxjQUFhLE9BQUcsT0FBTSxFQUFFLE9BQU0sMkJBQTBCLEVBQUUsMkJBQTBCLGFBQVksRUFBRSxZQUFXLEdBQUUsRUFBRSxZQUFZLFlBQ3BmLEdBQUUsRUFBRSxnQkFBYyxHQUFFLEVBQUUsUUFBTSxLQUFJO0FBQUMsc0JBQUUsR0FBRyxNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUUsQ0FBQztBQUFFLHNCQUFFLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsd0JBQU07QUFBQSxnQkFBQyxXQUFTLE1BQUksR0FBRTtBQUFDLHNCQUFFLEdBQUcsTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFFLENBQUM7QUFBRSxzQkFBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFFLHdCQUFNO0FBQUEsZ0JBQUMsTUFBTSxNQUFJLE9BQUssS0FBRyxHQUFHLEVBQUUsVUFBVSxhQUFhLEdBQUUsS0FBRyxHQUFFLElBQUUsTUFBRyxLQUFHLE1BQUssS0FBRyxRQUFJLElBQUUsR0FBRyxHQUFFLE1BQUssR0FBRSxDQUFDLEdBQUUsRUFBRSxRQUFNLEdBQUUsSUFBRyxHQUFFLFFBQU0sRUFBRSxRQUFNLEtBQUcsTUFBSyxJQUFFLEVBQUU7QUFBQSxxQkFBWTtBQUFDLHFCQUFHO0FBQUUsc0JBQUcsTUFBSSxHQUFFO0FBQUMsd0JBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLDBCQUFNO0FBQUEsa0JBQUM7QUFBQyxvQkFBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsZ0JBQUM7QUFBQyxvQkFBRSxFQUFFO0FBQUEsY0FBSztBQUFDLHFCQUFPO0FBQUEsWUFBRSxLQUFLO0FBQUUscUJBQU8sR0FBRyxDQUFDLEdBQUUsU0FBTyxLQUFHLEdBQUcsQ0FBQyxHQUFFLElBQUUsRUFBRSxNQUFLLElBQUUsRUFBRSxjQUFhLElBQUUsU0FBTyxJQUFFLEVBQUUsZ0JBQWMsTUFBSyxJQUFFLEVBQUUsVUFBUyxHQUFHLEdBQUUsQ0FBQyxJQUFFLElBQUUsT0FBSyxTQUFPLEtBQUcsR0FBRyxHQUFFLENBQUMsTUFBSSxFQUFFLFNBQU8sS0FDbmYsR0FBRyxHQUFFLENBQUMsR0FBRSxFQUFFLEdBQUUsR0FBRSxHQUFFLENBQUMsR0FBRSxFQUFFO0FBQUEsWUFBTSxLQUFLO0FBQUUscUJBQU8sU0FBTyxLQUFHLEdBQUcsQ0FBQyxHQUFFO0FBQUEsWUFBSyxLQUFLO0FBQUcscUJBQU8sR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFlBQUUsS0FBSztBQUFFLHFCQUFPLEdBQUcsR0FBRSxFQUFFLFVBQVUsYUFBYSxHQUFFLElBQUUsRUFBRSxjQUFhLFNBQU8sSUFBRSxFQUFFLFFBQU0sR0FBRyxHQUFFLE1BQUssR0FBRSxDQUFDLElBQUUsRUFBRSxHQUFFLEdBQUUsR0FBRSxDQUFDLEdBQUUsRUFBRTtBQUFBLFlBQU0sS0FBSztBQUFHLHFCQUFPLElBQUUsRUFBRSxNQUFLLElBQUUsRUFBRSxjQUFhLElBQUUsRUFBRSxnQkFBYyxJQUFFLElBQUUsR0FBRyxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFBLFlBQUUsS0FBSztBQUFFLHFCQUFPLEVBQUUsR0FBRSxHQUFFLEVBQUUsY0FBYSxDQUFDLEdBQUUsRUFBRTtBQUFBLFlBQU0sS0FBSztBQUFFLHFCQUFPLEVBQUUsR0FBRSxHQUFFLEVBQUUsYUFBYSxVQUFTLENBQUMsR0FBRSxFQUFFO0FBQUEsWUFBTSxLQUFLO0FBQUcscUJBQU8sRUFBRSxHQUFFLEdBQUUsRUFBRSxhQUFhLFVBQVMsQ0FBQyxHQUFFLEVBQUU7QUFBQSxZQUFNLEtBQUs7QUFBRyxpQkFBRTtBQUFDLG9CQUFFLEVBQUUsS0FBSztBQUFTLG9CQUFFLEVBQUU7QUFBYSxvQkFBRSxFQUFFO0FBQzdlLG9CQUFFLEVBQUU7QUFBTSxtQkFBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLG9CQUFHLFNBQU8sRUFBRSxLQUFHLEdBQUcsRUFBRSxPQUFNLENBQUMsR0FBRTtBQUFDLHNCQUFHLEVBQUUsYUFBVyxFQUFFLFlBQVUsQ0FBQyxFQUFFLFNBQVE7QUFBQyx3QkFBRSxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUUsMEJBQU07QUFBQSxrQkFBQztBQUFBLGdCQUFDLE1BQU0sTUFBSSxJQUFFLEVBQUUsT0FBTSxTQUFPLE1BQUksRUFBRSxTQUFPLElBQUcsU0FBTyxLQUFHO0FBQUMsc0JBQUksSUFBRSxFQUFFO0FBQWEsc0JBQUcsU0FBTyxHQUFFO0FBQUMsd0JBQUUsRUFBRTtBQUFNLDZCQUFRLElBQUUsRUFBRSxjQUFhLFNBQU8sS0FBRztBQUFDLDBCQUFHLEVBQUUsWUFBVSxHQUFFO0FBQUMsNEJBQUcsTUFBSSxFQUFFLEtBQUk7QUFBQyw4QkFBRSxHQUFHLElBQUcsSUFBRSxDQUFDLENBQUM7QUFBRSw0QkFBRSxNQUFJO0FBQUUsOEJBQUksSUFBRSxFQUFFO0FBQVksOEJBQUcsU0FBTyxHQUFFO0FBQUMsZ0NBQUUsRUFBRTtBQUFPLGdDQUFJLElBQUUsRUFBRTtBQUFRLHFDQUFPLElBQUUsRUFBRSxPQUFLLEtBQUcsRUFBRSxPQUFLLEVBQUUsTUFBSyxFQUFFLE9BQUs7QUFBRyw4QkFBRSxVQUFRO0FBQUEsMEJBQUM7QUFBQSx3QkFBQztBQUFDLDBCQUFFLFNBQU87QUFBRSw0QkFBRSxFQUFFO0FBQVUsaUNBQU8sTUFBSSxFQUFFLFNBQU87QUFBRywyQkFBRyxFQUFFLFFBQU8sR0FBRSxDQUFDO0FBQUUsMEJBQUUsU0FBTztBQUFFO0FBQUEsc0JBQUs7QUFBQywwQkFBRSxFQUFFO0FBQUEsb0JBQUk7QUFBQSxrQkFBQyxXQUFTLE9BQ2xnQixFQUFFLElBQUksS0FBRSxFQUFFLFNBQU8sRUFBRSxPQUFLLE9BQUssRUFBRTtBQUFBLDJCQUFjLE9BQUssRUFBRSxLQUFJO0FBQUMsd0JBQUUsRUFBRTtBQUFPLHdCQUFHLFNBQU8sRUFBRSxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxzQkFBRSxTQUFPO0FBQUUsd0JBQUUsRUFBRTtBQUFVLDZCQUFPLE1BQUksRUFBRSxTQUFPO0FBQUcsdUJBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSx3QkFBRSxFQUFFO0FBQUEsa0JBQU8sTUFBTSxLQUFFLEVBQUU7QUFBTSxzQkFBRyxTQUFPLEVBQUUsR0FBRSxTQUFPO0FBQUEsc0JBQU8sTUFBSSxJQUFFLEdBQUUsU0FBTyxLQUFHO0FBQUMsd0JBQUcsTUFBSSxHQUFFO0FBQUMsMEJBQUU7QUFBSztBQUFBLG9CQUFLO0FBQUMsd0JBQUUsRUFBRTtBQUFRLHdCQUFHLFNBQU8sR0FBRTtBQUFDLHdCQUFFLFNBQU8sRUFBRTtBQUFPLDBCQUFFO0FBQUU7QUFBQSxvQkFBSztBQUFDLHdCQUFFLEVBQUU7QUFBQSxrQkFBTTtBQUFDLHNCQUFFO0FBQUEsZ0JBQUM7QUFBQyxrQkFBRSxHQUFFLEdBQUUsRUFBRSxVQUFTLENBQUM7QUFBRSxvQkFBRSxFQUFFO0FBQUEsY0FBSztBQUFDLHFCQUFPO0FBQUEsWUFBRSxLQUFLO0FBQUUscUJBQU8sSUFBRSxFQUFFLE1BQUssSUFBRSxFQUFFLGFBQWEsVUFBUyxHQUFHLEdBQUUsQ0FBQyxHQUFFLElBQUUsR0FBRyxDQUFDLEdBQUUsSUFBRSxFQUFFLENBQUMsR0FBRSxFQUFFLFNBQU8sR0FBRSxFQUFFLEdBQUUsR0FBRSxHQUFFLENBQUMsR0FBRSxFQUFFO0FBQUEsWUFBTSxLQUFLO0FBQUcscUJBQU8sSUFBRSxFQUFFLE1BQUssSUFBRSxHQUFHLEdBQUUsRUFBRSxZQUFZLEdBQzdmLElBQUUsR0FBRyxFQUFFLE1BQUssQ0FBQyxHQUFFLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsWUFBRSxLQUFLO0FBQUcscUJBQU8sR0FBRyxHQUFFLEdBQUUsRUFBRSxNQUFLLEVBQUUsY0FBYSxDQUFDO0FBQUEsWUFBRSxLQUFLO0FBQUcscUJBQU8sSUFBRSxFQUFFLE1BQUssSUFBRSxFQUFFLGNBQWEsSUFBRSxFQUFFLGdCQUFjLElBQUUsSUFBRSxHQUFHLEdBQUUsQ0FBQyxHQUFFLEdBQUcsR0FBRSxDQUFDLEdBQUUsRUFBRSxNQUFJLEdBQUUsRUFBRSxDQUFDLEtBQUcsSUFBRSxNQUFHLEdBQUcsQ0FBQyxLQUFHLElBQUUsT0FBRyxHQUFHLEdBQUUsQ0FBQyxHQUFFLEdBQUcsR0FBRSxHQUFFLENBQUMsR0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUMsR0FBRSxHQUFHLE1BQUssR0FBRSxHQUFFLE1BQUcsR0FBRSxDQUFDO0FBQUEsWUFBRSxLQUFLO0FBQUcscUJBQU8sR0FBRyxHQUFFLEdBQUUsQ0FBQztBQUFBLFlBQUUsS0FBSztBQUFHLHFCQUFPLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBQSxVQUFDO0FBQUMsZ0JBQU0sTUFBTSxFQUFFLEtBQUksRUFBRSxHQUFHLENBQUM7QUFBQSxRQUFFO0FBQUUsaUJBQVMsR0FBRyxHQUFFLEdBQUU7QUFBQyxpQkFBTyxHQUFHLEdBQUUsQ0FBQztBQUFBLFFBQUM7QUFDelYsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsZUFBSyxNQUFJO0FBQUUsZUFBSyxNQUFJO0FBQUUsZUFBSyxVQUFRLEtBQUssUUFBTSxLQUFLLFNBQU8sS0FBSyxZQUFVLEtBQUssT0FBSyxLQUFLLGNBQVk7QUFBSyxlQUFLLFFBQU07QUFBRSxlQUFLLE1BQUk7QUFBSyxlQUFLLGVBQWE7QUFBRSxlQUFLLGVBQWEsS0FBSyxnQkFBYyxLQUFLLGNBQVksS0FBSyxnQkFBYztBQUFLLGVBQUssT0FBSztBQUFFLGVBQUssZUFBYSxLQUFLLFFBQU07QUFBRSxlQUFLLFlBQVU7QUFBSyxlQUFLLGFBQVcsS0FBSyxRQUFNO0FBQUUsZUFBSyxZQUFVO0FBQUEsUUFBSTtBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGlCQUFPLElBQUksR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGNBQUUsRUFBRTtBQUFVLGlCQUFNLEVBQUUsQ0FBQyxLQUFHLENBQUMsRUFBRTtBQUFBLFFBQWlCO0FBQ3BkLGlCQUFTLEdBQUcsR0FBRTtBQUFDLGNBQUcsZUFBYSxPQUFPLEVBQUUsUUFBTyxHQUFHLENBQUMsSUFBRSxJQUFFO0FBQUUsY0FBRyxXQUFTLEtBQUcsU0FBTyxHQUFFO0FBQUMsZ0JBQUUsRUFBRTtBQUFTLGdCQUFHLE1BQUksR0FBRyxRQUFPO0FBQUcsZ0JBQUcsTUFBSSxHQUFHLFFBQU87QUFBQSxVQUFFO0FBQUMsaUJBQU87QUFBQSxRQUFDO0FBQy9JLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUU7QUFBVSxtQkFBTyxLQUFHLElBQUUsR0FBRyxFQUFFLEtBQUksR0FBRSxFQUFFLEtBQUksRUFBRSxJQUFJLEdBQUUsRUFBRSxjQUFZLEVBQUUsYUFBWSxFQUFFLE9BQUssRUFBRSxNQUFLLEVBQUUsWUFBVSxFQUFFLFdBQVUsRUFBRSxZQUFVLEdBQUUsRUFBRSxZQUFVLE1BQUksRUFBRSxlQUFhLEdBQUUsRUFBRSxPQUFLLEVBQUUsTUFBSyxFQUFFLFFBQU0sR0FBRSxFQUFFLGVBQWEsR0FBRSxFQUFFLFlBQVU7QUFBTSxZQUFFLFFBQU0sRUFBRSxRQUFNO0FBQVMsWUFBRSxhQUFXLEVBQUU7QUFBVyxZQUFFLFFBQU0sRUFBRTtBQUFNLFlBQUUsUUFBTSxFQUFFO0FBQU0sWUFBRSxnQkFBYyxFQUFFO0FBQWMsWUFBRSxnQkFBYyxFQUFFO0FBQWMsWUFBRSxjQUFZLEVBQUU7QUFBWSxjQUFFLEVBQUU7QUFBYSxZQUFFLGVBQWEsU0FBTyxJQUFFLE9BQUssRUFBQyxPQUFNLEVBQUUsT0FBTSxjQUFhLEVBQUUsYUFBWTtBQUMzZixZQUFFLFVBQVEsRUFBRTtBQUFRLFlBQUUsUUFBTSxFQUFFO0FBQU0sWUFBRSxNQUFJLEVBQUU7QUFBSSxpQkFBTztBQUFBLFFBQUM7QUFDeEQsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRTtBQUFFLGNBQUU7QUFBRSxjQUFHLGVBQWEsT0FBTyxFQUFFLElBQUcsQ0FBQyxNQUFJLElBQUU7QUFBQSxtQkFBVyxhQUFXLE9BQU8sRUFBRSxLQUFFO0FBQUEsY0FBTyxHQUFFLFNBQU8sR0FBRTtBQUFBLFlBQUMsS0FBSztBQUFHLHFCQUFPLEdBQUcsRUFBRSxVQUFTLEdBQUUsR0FBRSxDQUFDO0FBQUEsWUFBRSxLQUFLO0FBQUcsa0JBQUU7QUFBRSxtQkFBRztBQUFFO0FBQUEsWUFBTSxLQUFLO0FBQUcscUJBQU8sSUFBRSxHQUFHLElBQUcsR0FBRSxHQUFFLElBQUUsQ0FBQyxHQUFFLEVBQUUsY0FBWSxJQUFHLEVBQUUsUUFBTSxHQUFFO0FBQUEsWUFBRSxLQUFLO0FBQUcscUJBQU8sSUFBRSxHQUFHLElBQUcsR0FBRSxHQUFFLENBQUMsR0FBRSxFQUFFLGNBQVksSUFBRyxFQUFFLFFBQU0sR0FBRTtBQUFBLFlBQUUsS0FBSztBQUFHLHFCQUFPLElBQUUsR0FBRyxJQUFHLEdBQUUsR0FBRSxDQUFDLEdBQUUsRUFBRSxjQUFZLElBQUcsRUFBRSxRQUFNLEdBQUU7QUFBQSxZQUFFLEtBQUs7QUFBRyxxQkFBTyxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSxZQUFFO0FBQVEsa0JBQUcsYUFBVyxPQUFPLEtBQUcsU0FBTyxFQUFFLFNBQU8sRUFBRSxVQUFTO0FBQUEsZ0JBQUMsS0FBSztBQUFHLHNCQUFFO0FBQUcsd0JBQU07QUFBQSxnQkFBRSxLQUFLO0FBQUcsc0JBQUU7QUFBRSx3QkFBTTtBQUFBLGdCQUFFLEtBQUs7QUFBRyxzQkFBRTtBQUNwZix3QkFBTTtBQUFBLGdCQUFFLEtBQUs7QUFBRyxzQkFBRTtBQUFHLHdCQUFNO0FBQUEsZ0JBQUUsS0FBSztBQUFHLHNCQUFFO0FBQUcsc0JBQUU7QUFBSyx3QkFBTTtBQUFBLGNBQUM7QUFBQyxvQkFBTSxNQUFNLEVBQUUsS0FBSSxRQUFNLElBQUUsSUFBRSxPQUFPLEdBQUUsRUFBRSxDQUFDO0FBQUEsVUFBRTtBQUFDLGNBQUUsR0FBRyxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsWUFBRSxjQUFZO0FBQUUsWUFBRSxPQUFLO0FBQUUsWUFBRSxRQUFNO0FBQUUsaUJBQU87QUFBQSxRQUFDO0FBQUMsaUJBQVMsR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRSxHQUFHLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxZQUFFLFFBQU07QUFBRSxpQkFBTztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFFLEdBQUcsSUFBRyxHQUFFLEdBQUUsQ0FBQztBQUFFLFlBQUUsY0FBWTtBQUFHLFlBQUUsUUFBTTtBQUFFLFlBQUUsWUFBVSxFQUFDLFVBQVMsTUFBRTtBQUFFLGlCQUFPO0FBQUEsUUFBQztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFFLEdBQUcsR0FBRSxHQUFFLE1BQUssQ0FBQztBQUFFLFlBQUUsUUFBTTtBQUFFLGlCQUFPO0FBQUEsUUFBQztBQUM1VyxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRSxHQUFHLEdBQUUsU0FBTyxFQUFFLFdBQVMsRUFBRSxXQUFTLENBQUMsR0FBRSxFQUFFLEtBQUksQ0FBQztBQUFFLFlBQUUsUUFBTTtBQUFFLFlBQUUsWUFBVSxFQUFDLGVBQWMsRUFBRSxlQUFjLGlCQUFnQixNQUFLLGdCQUFlLEVBQUUsZUFBYztBQUFFLGlCQUFPO0FBQUEsUUFBQztBQUN0TCxpQkFBUyxHQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGVBQUssTUFBSTtBQUFFLGVBQUssZ0JBQWM7QUFBRSxlQUFLLGVBQWEsS0FBSyxZQUFVLEtBQUssVUFBUSxLQUFLLGtCQUFnQjtBQUFLLGVBQUssZ0JBQWM7QUFBRyxlQUFLLGVBQWEsS0FBSyxpQkFBZSxLQUFLLFVBQVE7QUFBSyxlQUFLLG1CQUFpQjtBQUFFLGVBQUssYUFBVyxHQUFHLENBQUM7QUFBRSxlQUFLLGtCQUFnQixHQUFHLEVBQUU7QUFBRSxlQUFLLGlCQUFlLEtBQUssZ0JBQWMsS0FBSyxtQkFBaUIsS0FBSyxlQUFhLEtBQUssY0FBWSxLQUFLLGlCQUFlLEtBQUssZUFBYTtBQUFFLGVBQUssZ0JBQWMsR0FBRyxDQUFDO0FBQUUsZUFBSyxtQkFBaUI7QUFBRSxlQUFLLHFCQUFtQjtBQUFFLGlCQUFLLEtBQUssa0NBQ3BmO0FBQUEsUUFBSztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFFLElBQUksR0FBRyxHQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBRSxnQkFBSSxLQUFHLElBQUUsR0FBRSxTQUFLLE1BQUksS0FBRyxNQUFJLElBQUU7QUFBRSxjQUFFLEdBQUcsR0FBRSxNQUFLLE1BQUssQ0FBQztBQUFFLFlBQUUsVUFBUTtBQUFFLFlBQUUsWUFBVTtBQUFFLFlBQUUsZ0JBQWMsRUFBQyxTQUFRLEdBQUUsY0FBYSxHQUFFLE9BQU0sTUFBSyxhQUFZLE1BQUssMkJBQTBCLEtBQUk7QUFBRSxhQUFHLENBQUM7QUFBRSxpQkFBTztBQUFBLFFBQUM7QUFDMVAsaUJBQVMsR0FBRyxHQUFFO0FBQUMsY0FBRyxDQUFDLEVBQUUsUUFBTztBQUFHLGNBQUUsRUFBRTtBQUFnQixhQUFFO0FBQUMsZ0JBQUcsR0FBRyxDQUFDLE1BQUksS0FBRyxNQUFJLEVBQUUsSUFBSSxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxnQkFBSSxJQUFFO0FBQUUsZUFBRTtBQUFDLHNCQUFPLEVBQUUsS0FBSTtBQUFBLGdCQUFDLEtBQUs7QUFBRSxzQkFBRSxFQUFFLFVBQVU7QUFBUSx3QkFBTTtBQUFBLGdCQUFFLEtBQUs7QUFBRSxzQkFBRyxFQUFFLEVBQUUsSUFBSSxHQUFFO0FBQUMsd0JBQUUsRUFBRSxVQUFVO0FBQTBDLDBCQUFNO0FBQUEsa0JBQUM7QUFBQSxjQUFDO0FBQUMsa0JBQUUsRUFBRTtBQUFBLFlBQU0sU0FBTyxTQUFPO0FBQUcsa0JBQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFBLFVBQUU7QUFBQyxjQUFHLE1BQUksRUFBRSxLQUFJO0FBQUMsZ0JBQUksSUFBRSxFQUFFO0FBQUssZ0JBQUcsRUFBRSxDQUFDLEVBQUUsUUFBTyxHQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUEsVUFBQztBQUFDLGlCQUFPO0FBQUEsUUFBQztBQUNsVyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxjQUFJLElBQUUsRUFBRTtBQUFnQixjQUFHLFdBQVMsR0FBRTtBQUFDLGdCQUFHLGVBQWEsT0FBTyxFQUFFLE9BQU8sT0FBTSxNQUFNLEVBQUUsR0FBRyxDQUFDO0FBQUUsZ0JBQUUsT0FBTyxLQUFLLENBQUMsRUFBRSxLQUFLLEdBQUc7QUFBRSxrQkFBTSxNQUFNLEVBQUUsS0FBSSxDQUFDLENBQUM7QUFBQSxVQUFFO0FBQUMsY0FBRSxHQUFHLENBQUM7QUFBRSxpQkFBTyxTQUFPLElBQUUsT0FBSyxFQUFFO0FBQUEsUUFBUztBQUFDLGlCQUFTLEdBQUcsR0FBRSxHQUFFO0FBQUMsY0FBRSxFQUFFO0FBQWMsY0FBRyxTQUFPLEtBQUcsU0FBTyxFQUFFLFlBQVc7QUFBQyxnQkFBSSxJQUFFLEVBQUU7QUFBVSxjQUFFLFlBQVUsTUFBSSxLQUFHLElBQUUsSUFBRSxJQUFFO0FBQUEsVUFBQztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUUsR0FBRTtBQUFDLGFBQUcsR0FBRSxDQUFDO0FBQUUsV0FBQyxJQUFFLEVBQUUsY0FBWSxHQUFHLEdBQUUsQ0FBQztBQUFBLFFBQUM7QUFBQyxpQkFBUyxHQUFHLEdBQUU7QUFBQyxjQUFFLEdBQUcsQ0FBQztBQUFFLGlCQUFPLFNBQU8sSUFBRSxPQUFLLEVBQUU7QUFBQSxRQUFTO0FBQUMsaUJBQVMsS0FBSTtBQUFDLGlCQUFPO0FBQUEsUUFBSTtBQUMzYixRQUFBRixTQUFRLDZCQUEyQixTQUFTLEdBQUU7QUFBQyxjQUFHLE9BQUssRUFBRSxLQUFJO0FBQUMsZ0JBQUksSUFBRSxHQUFHLEdBQUUsU0FBUztBQUFFLGdCQUFHLFNBQU8sR0FBRTtBQUFDLGtCQUFJLElBQUUsRUFBRTtBQUFFLGlCQUFHLEdBQUUsR0FBRSxXQUFVLENBQUM7QUFBQSxZQUFDO0FBQUMsZUFBRyxHQUFFLFNBQVM7QUFBQSxVQUFDO0FBQUEsUUFBQztBQUFFLFFBQUFBLFNBQVEsMkJBQXlCLFNBQVMsR0FBRTtBQUFDLGNBQUcsT0FBSyxFQUFFLEtBQUk7QUFBQyxnQkFBSSxJQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUUsZ0JBQUcsU0FBTyxHQUFFO0FBQUMsa0JBQUksSUFBRSxFQUFFO0FBQUUsaUJBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQztBQUFBLFlBQUM7QUFBQyxlQUFHLEdBQUUsQ0FBQztBQUFBLFVBQUM7QUFBQSxRQUFDO0FBQUUsUUFBQUEsU0FBUSxvQ0FBa0MsU0FBUyxHQUFFO0FBQUMsY0FBRyxPQUFLLEVBQUUsS0FBSTtBQUFDLGdCQUFJLElBQUUsR0FBRyxDQUFDLEdBQUUsSUFBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLGdCQUFHLFNBQU8sR0FBRTtBQUFDLGtCQUFJLElBQUUsRUFBRTtBQUFFLGlCQUFHLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSxZQUFDO0FBQUMsZUFBRyxHQUFFLENBQUM7QUFBQSxVQUFDO0FBQUEsUUFBQztBQUM5WSxRQUFBQSxTQUFRLDhCQUE0QixTQUFTLEdBQUU7QUFBQyxrQkFBTyxFQUFFLEtBQUk7QUFBQSxZQUFDLEtBQUs7QUFBRSxrQkFBSSxJQUFFLEVBQUU7QUFBVSxrQkFBRyxFQUFFLFFBQVEsY0FBYyxjQUFhO0FBQUMsb0JBQUksSUFBRSxHQUFHLEVBQUUsWUFBWTtBQUFFLHNCQUFJLE1BQUksR0FBRyxHQUFFLElBQUUsQ0FBQyxHQUFFLEdBQUcsR0FBRSxFQUFFLENBQUMsR0FBRSxPQUFLLElBQUUsT0FBSyxHQUFHLEdBQUUsR0FBRztBQUFBLGNBQUc7QUFBQztBQUFBLFlBQU0sS0FBSztBQUFHLGlCQUFHLFdBQVU7QUFBQyxvQkFBSUUsS0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLG9CQUFHLFNBQU9BLElBQUU7QUFBQyxzQkFBSUMsS0FBRSxFQUFFO0FBQUUscUJBQUdELElBQUUsR0FBRSxHQUFFQyxFQUFDO0FBQUEsZ0JBQUM7QUFBQSxjQUFDLENBQUMsR0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFBLFVBQUM7QUFBQSxRQUFDO0FBQUUsUUFBQUgsU0FBUSxpQkFBZSxTQUFTLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRTtBQUFFLGVBQUc7QUFBRSxjQUFHO0FBQUMsbUJBQU8sRUFBRSxDQUFDO0FBQUEsVUFBQyxVQUFDO0FBQVEsZ0JBQUUsR0FBRSxNQUFJLE1BQUksR0FBRyxHQUFFLE1BQUksR0FBRztBQUFBLFVBQUU7QUFBQSxRQUFDO0FBQUUsUUFBQUEsU0FBUSwwQkFBd0IsU0FBUyxHQUFFO0FBQUMsaUJBQU0sRUFBQyxVQUFTLElBQUcsT0FBTSxFQUFDO0FBQUEsUUFBQztBQUNyZCxRQUFBQSxTQUFRLGtCQUFnQixTQUFTLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxpQkFBTyxHQUFHLEdBQUUsR0FBRSxPQUFHLE1BQUssR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUEsUUFBQztBQUFFLFFBQUFBLFNBQVEsK0JBQTZCLFNBQVMsR0FBRTtBQUFDLGlCQUFNLEVBQUMsVUFBUyxJQUFHLE9BQU0sRUFBQztBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLDJCQUF5QixTQUFTLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBRSxHQUFHLEdBQUUsR0FBRSxNQUFHLEdBQUUsR0FBRSxHQUFFLEdBQUUsR0FBRSxDQUFDO0FBQUUsWUFBRSxVQUFRLEdBQUcsSUFBSTtBQUFFLGNBQUUsRUFBRTtBQUFRLGNBQUUsRUFBRTtBQUFFLGNBQUUsR0FBRyxDQUFDO0FBQUUsY0FBRSxHQUFHLEdBQUUsQ0FBQztBQUFFLFlBQUUsV0FBUyxXQUFTLEtBQUcsU0FBTyxJQUFFLElBQUU7QUFBSyxhQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUUsWUFBRSxRQUFRLFFBQU07QUFBRSxhQUFHLEdBQUUsR0FBRSxDQUFDO0FBQUUsYUFBRyxHQUFFLENBQUM7QUFBRSxpQkFBTztBQUFBLFFBQUM7QUFDMVksUUFBQUEsU0FBUSxlQUFhLFNBQVMsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFJLElBQUUsSUFBRSxVQUFVLFVBQVEsV0FBUyxVQUFVLENBQUMsSUFBRSxVQUFVLENBQUMsSUFBRTtBQUFLLGlCQUFNLEVBQUMsVUFBUyxJQUFHLEtBQUksUUFBTSxJQUFFLE9BQUssS0FBRyxHQUFFLFVBQVMsR0FBRSxlQUFjLEdBQUUsZ0JBQWUsRUFBQztBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLHFCQUFtQixTQUFTLEdBQUU7QUFBQyxpQkFBTSxFQUFDLFVBQVMsSUFBRyxPQUFNLEVBQUM7QUFBQSxRQUFDO0FBQUUsUUFBQUEsU0FBUSx5QkFBdUIsU0FBUyxHQUFFO0FBQUMsaUJBQU0sRUFBQyxVQUFTLElBQUcsT0FBTSxFQUFDO0FBQUEsUUFBQztBQUFFLFFBQUFBLFNBQVEscUJBQW1CLFNBQVMsR0FBRTtBQUFDLGlCQUFNLEVBQUMsVUFBUyxJQUFHLE9BQU0sRUFBQztBQUFBLFFBQUM7QUFDNVksUUFBQUEsU0FBUSxrQkFBZ0IsU0FBUyxHQUFFO0FBQUMsY0FBSSxJQUFFLEdBQUUsSUFBRSxFQUFFO0FBQVcsY0FBRztBQUFDLG1CQUFPLEVBQUUsYUFBVyxNQUFLLElBQUUsSUFBRyxFQUFFO0FBQUEsVUFBQyxVQUFDO0FBQVEsZ0JBQUUsR0FBRSxFQUFFLGFBQVc7QUFBQSxVQUFDO0FBQUEsUUFBQztBQUFFLFFBQUFBLFNBQVEsa0JBQWdCLFNBQVMsR0FBRSxHQUFFLEdBQUUsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEdBQUUsSUFBRSxFQUFFO0FBQVcsY0FBRztBQUFDLG1CQUFPLEVBQUUsYUFBVyxNQUFLLElBQUUsR0FBRSxFQUFFLEdBQUUsR0FBRSxHQUFFLENBQUM7QUFBQSxVQUFDLFVBQUM7QUFBUSxnQkFBRSxHQUFFLEVBQUUsYUFBVyxHQUFFLE1BQUksS0FBRyxHQUFHO0FBQUEsVUFBQztBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLGVBQWE7QUFDM1MsUUFBQUEsU0FBUSxvQkFBa0IsU0FBUyxHQUFFLEdBQUU7QUFBQyxjQUFHLENBQUMsR0FBRyxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxjQUFFLEdBQUcsR0FBRSxDQUFDO0FBQUUsY0FBRSxDQUFDO0FBQUUsbUJBQVEsSUFBRSxHQUFFLElBQUUsRUFBRSxRQUFPLElBQUksR0FBRSxLQUFLLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUFFLGVBQUksSUFBRSxFQUFFLFNBQU8sR0FBRSxJQUFFLEdBQUUsS0FBSTtBQUFDLGdCQUFFLEVBQUUsQ0FBQztBQUFFLHFCQUFRLElBQUUsRUFBRSxHQUFFLElBQUUsSUFBRSxFQUFFLE9BQU0sSUFBRSxFQUFFLEdBQUUsSUFBRSxJQUFFLEVBQUUsUUFBTyxJQUFFLElBQUUsR0FBRSxLQUFHLEdBQUUsSUFBSSxLQUFHLE1BQUksR0FBRTtBQUFDLGtCQUFJLElBQUUsRUFBRSxDQUFDLEdBQUUsSUFBRSxFQUFFLEdBQUUsSUFBRSxJQUFFLEVBQUUsT0FBTSxJQUFFLEVBQUUsR0FBRSxJQUFFLElBQUUsRUFBRTtBQUFPLGtCQUFHLEtBQUcsS0FBRyxLQUFHLEtBQUcsS0FBRyxLQUFHLEtBQUcsR0FBRTtBQUFDLGtCQUFFLE9BQU8sR0FBRSxDQUFDO0FBQUU7QUFBQSxjQUFLLFdBQVMsRUFBRSxNQUFJLEtBQUcsRUFBRSxVQUFRLEVBQUUsU0FBTyxJQUFFLEtBQUcsSUFBRSxJQUFHO0FBQUMsb0JBQUUsTUFBSSxFQUFFLFVBQVEsSUFBRSxHQUFFLEVBQUUsSUFBRTtBQUFHLG9CQUFFLE1BQUksRUFBRSxTQUFPLElBQUU7QUFBRyxrQkFBRSxPQUFPLEdBQUUsQ0FBQztBQUFFO0FBQUEsY0FBSyxXQUFTLEVBQUUsTUFBSSxLQUFHLEVBQUUsV0FBUyxFQUFFLFVBQVEsSUFBRSxLQUFHLElBQUUsSUFBRztBQUFDLG9CQUFFLE1BQUksRUFBRSxTQUMvZSxJQUFFLEdBQUUsRUFBRSxJQUFFO0FBQUcsb0JBQUUsTUFBSSxFQUFFLFFBQU0sSUFBRTtBQUFHLGtCQUFFLE9BQU8sR0FBRSxDQUFDO0FBQUU7QUFBQSxjQUFLO0FBQUEsWUFBQztBQUFBLFVBQUM7QUFBQyxpQkFBTztBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLG1CQUFpQjtBQUFHLFFBQUFBLFNBQVEsZ0NBQThCLFNBQVMsR0FBRTtBQUFDLGNBQUUsR0FBRyxDQUFDO0FBQUUsY0FBRSxTQUFPLElBQUUsR0FBRyxDQUFDLElBQUU7QUFBSyxpQkFBTyxTQUFPLElBQUUsT0FBSyxFQUFFO0FBQUEsUUFBUztBQUFFLFFBQUFBLFNBQVEsOEJBQTRCLFNBQVMsR0FBRTtBQUFDLGlCQUFPLEdBQUcsQ0FBQztBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLGtCQUFnQixTQUFTLEdBQUU7QUFBQyxjQUFJLElBQUU7QUFBRSxlQUFHO0FBQUUsY0FBSSxJQUFFLEVBQUUsWUFBVyxJQUFFO0FBQUUsY0FBRztBQUFDLGNBQUUsYUFBVyxNQUFLLElBQUUsR0FBRSxFQUFFO0FBQUEsVUFBQyxVQUFDO0FBQVEsZ0JBQUUsR0FBRSxFQUFFLGFBQVcsR0FBRSxJQUFFLEdBQUUsTUFBSSxNQUFJLEdBQUcsR0FBRSxHQUFHO0FBQUEsVUFBRTtBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLHNCQUFvQjtBQUFHLFFBQUFBLFNBQVEsWUFBVTtBQUNyZCxRQUFBQSxTQUFRLGNBQVksU0FBUyxHQUFFLEdBQUU7QUFBQyxjQUFHLENBQUMsR0FBRyxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxjQUFFLEdBQUcsQ0FBQztBQUFFLGNBQUUsR0FBRyxHQUFFLENBQUM7QUFBRSxjQUFFLE1BQU0sS0FBSyxDQUFDO0FBQUUsZUFBSSxJQUFFLEdBQUUsSUFBRSxFQUFFLFVBQVE7QUFBQyxnQkFBSSxJQUFFLEVBQUUsR0FBRztBQUFFLGdCQUFHLENBQUMsR0FBRyxDQUFDLEdBQUU7QUFBQyxrQkFBRyxNQUFJLEVBQUUsT0FBSyxHQUFHLEVBQUUsU0FBUyxFQUFFLFFBQU07QUFBRyxtQkFBSSxJQUFFLEVBQUUsT0FBTSxTQUFPLElBQUcsR0FBRSxLQUFLLENBQUMsR0FBRSxJQUFFLEVBQUU7QUFBQSxZQUFPO0FBQUEsVUFBQztBQUFDLGlCQUFNO0FBQUEsUUFBRTtBQUFFLFFBQUFBLFNBQVEsMkJBQXlCLFdBQVU7QUFBQyxpQkFBTztBQUFBLFFBQUM7QUFDaFMsUUFBQUEsU0FBUSxvQ0FBa0MsU0FBUyxHQUFFLEdBQUU7QUFBQyxjQUFHLENBQUMsR0FBRyxPQUFNLE1BQU0sRUFBRSxHQUFHLENBQUM7QUFBRSxjQUFJLElBQUUsR0FBRSxJQUFFLENBQUM7QUFBRSxjQUFFLENBQUMsR0FBRyxDQUFDLEdBQUUsQ0FBQztBQUFFLG1CQUFRLElBQUUsR0FBRSxJQUFFLEVBQUUsVUFBUTtBQUFDLGdCQUFJLElBQUUsRUFBRSxHQUFHLEdBQUUsSUFBRSxFQUFFLEdBQUcsR0FBRSxJQUFFLEVBQUUsQ0FBQztBQUFFLGdCQUFHLE1BQUksRUFBRSxPQUFLLENBQUMsR0FBRyxDQUFDO0FBQUUsa0JBQUcsR0FBRyxHQUFFLENBQUMsTUFBSSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRSxLQUFJLElBQUUsTUFBSSxJQUFFLEtBQUksSUFBRSxFQUFFLE9BQU8sTUFBSSxJQUFFLEVBQUUsT0FBTSxTQUFPLElBQUcsR0FBRSxLQUFLLEdBQUUsQ0FBQyxHQUFFLElBQUUsRUFBRTtBQUFBO0FBQUEsVUFBTztBQUFDLGNBQUcsSUFBRSxFQUFFLFFBQU87QUFBQyxpQkFBSSxJQUFFLENBQUMsR0FBRSxJQUFFLEVBQUUsUUFBTyxJQUFJLEdBQUUsS0FBSyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFBRSxtQkFBTSw4REFBNEQsRUFBRSxLQUFLLEtBQUssSUFBRSxrREFBZ0QsRUFBRSxLQUFLLEtBQUs7QUFBQSxVQUFDO0FBQUMsaUJBQU87QUFBQSxRQUFJO0FBQzllLFFBQUFBLFNBQVEsd0JBQXNCLFNBQVMsR0FBRTtBQUFDLGNBQUUsRUFBRTtBQUFRLGNBQUcsQ0FBQyxFQUFFLE1BQU0sUUFBTztBQUFLLGtCQUFPLEVBQUUsTUFBTSxLQUFJO0FBQUEsWUFBQyxLQUFLO0FBQUUscUJBQU8sR0FBRyxFQUFFLE1BQU0sU0FBUztBQUFBLFlBQUU7QUFBUSxxQkFBTyxFQUFFLE1BQU07QUFBQSxVQUFTO0FBQUEsUUFBQztBQUN2SyxRQUFBQSxTQUFRLHFCQUFtQixTQUFTLEdBQUU7QUFBQyxjQUFFLEVBQUMsWUFBVyxFQUFFLFlBQVcsU0FBUSxFQUFFLFNBQVEscUJBQW9CLEVBQUUscUJBQW9CLGdCQUFlLEVBQUUsZ0JBQWUsbUJBQWtCLE1BQUssNkJBQTRCLE1BQUssNkJBQTRCLE1BQUssZUFBYyxNQUFLLHlCQUF3QixNQUFLLHlCQUF3QixNQUFLLGlCQUFnQixNQUFLLG9CQUFtQixNQUFLLGdCQUFlLE1BQUssc0JBQXFCLEdBQUcsd0JBQXVCLHlCQUF3QixJQUFHLHlCQUF3QixFQUFFLDJCQUN6ZSxJQUFHLDZCQUE0QixNQUFLLGlCQUFnQixNQUFLLGNBQWEsTUFBSyxtQkFBa0IsTUFBSyxpQkFBZ0IsTUFBSyxtQkFBa0IsU0FBUTtBQUFFLGNBQUcsZ0JBQWMsT0FBTywrQkFBK0IsS0FBRTtBQUFBLGVBQU87QUFBQyxnQkFBSSxJQUFFO0FBQStCLGdCQUFHLEVBQUUsY0FBWSxDQUFDLEVBQUUsY0FBYyxLQUFFO0FBQUEsaUJBQU87QUFBQyxrQkFBRztBQUFDLHFCQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUUsS0FBRztBQUFBLGNBQUMsU0FBTyxHQUFFO0FBQUEsY0FBQztBQUFDLGtCQUFFLEVBQUUsV0FBUyxPQUFHO0FBQUEsWUFBRTtBQUFBLFVBQUM7QUFBQyxpQkFBTztBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLHFCQUFtQixXQUFVO0FBQUMsaUJBQU07QUFBQSxRQUFFO0FBQ25aLFFBQUFBLFNBQVEsc0JBQW9CLFNBQVMsR0FBRSxHQUFFLEdBQUUsR0FBRTtBQUFDLGNBQUcsQ0FBQyxHQUFHLE9BQU0sTUFBTSxFQUFFLEdBQUcsQ0FBQztBQUFFLGNBQUUsR0FBRyxHQUFFLENBQUM7QUFBRSxjQUFJLElBQUUsR0FBRyxHQUFFLEdBQUUsQ0FBQyxFQUFFO0FBQVcsaUJBQU0sRUFBQyxZQUFXLFdBQVU7QUFBQyxjQUFFO0FBQUEsVUFBQyxFQUFDO0FBQUEsUUFBQztBQUFFLFFBQUFBLFNBQVEsb0NBQWtDLFNBQVMsR0FBRSxHQUFFO0FBQUMsY0FBSSxJQUFFLEVBQUU7QUFBWSxjQUFFLEVBQUUsRUFBRSxPQUFPO0FBQUUsa0JBQU0sRUFBRSxrQ0FBZ0MsRUFBRSxrQ0FBZ0MsQ0FBQyxHQUFFLENBQUMsSUFBRSxFQUFFLGdDQUFnQyxLQUFLLEdBQUUsQ0FBQztBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLGtCQUFnQixTQUFTLEdBQUUsR0FBRTtBQUFDLGNBQUksSUFBRTtBQUFFLGNBQUc7QUFBQyxtQkFBTyxJQUFFLEdBQUUsRUFBRTtBQUFBLFVBQUMsVUFBQztBQUFRLGdCQUFFO0FBQUEsVUFBQztBQUFBLFFBQUM7QUFBRSxRQUFBQSxTQUFRLGNBQVksV0FBVTtBQUFDLGlCQUFPO0FBQUEsUUFBSTtBQUNuZSxRQUFBQSxTQUFRLGdCQUFjLFdBQVU7QUFBQyxpQkFBTTtBQUFBLFFBQUU7QUFBRSxRQUFBQSxTQUFRLGtCQUFnQixTQUFTLEdBQUUsR0FBRSxHQUFFLEdBQUU7QUFBQyxjQUFJLElBQUUsRUFBRSxTQUFRLElBQUUsRUFBRSxHQUFFLElBQUUsR0FBRyxDQUFDO0FBQUUsY0FBRSxHQUFHLENBQUM7QUFBRSxtQkFBTyxFQUFFLFVBQVEsRUFBRSxVQUFRLElBQUUsRUFBRSxpQkFBZTtBQUFFLGNBQUUsR0FBRyxHQUFFLENBQUM7QUFBRSxZQUFFLFVBQVEsRUFBQyxTQUFRLEVBQUM7QUFBRSxjQUFFLFdBQVMsSUFBRSxPQUFLO0FBQUUsbUJBQU8sTUFBSSxFQUFFLFdBQVM7QUFBRyxjQUFFLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBRSxtQkFBTyxNQUFJLEdBQUcsR0FBRSxHQUFFLEdBQUUsQ0FBQyxHQUFFLEdBQUcsR0FBRSxHQUFFLENBQUM7QUFBRyxpQkFBTztBQUFBLFFBQUM7QUFFMVMsZUFBT0E7QUFBQSxNQUNYO0FBQUE7QUFBQTs7O0FDek9BO0FBQUE7QUFBQTtBQUVBLFVBQUksTUFBdUM7QUFDekMsZUFBTyxVQUFVO0FBQUEsTUFDbkIsT0FBTztBQUNMLGVBQU8sVUFBVTtBQUFBLE1BQ25CO0FBQUE7QUFBQTs7O0FDTkE7QUFBQTtBQUFBO0FBU2EsY0FBUSxpQkFBZTtBQUFFLGNBQVEsMEJBQXdCO0FBQUUsY0FBUSx1QkFBcUI7QUFBRyxjQUFRLHdCQUFzQjtBQUFFLGNBQVEsb0JBQWtCO0FBQVUsY0FBUSxhQUFXO0FBQUE7QUFBQTs7O0FDVC9MO0FBQUE7QUFBQTtBQUVBLFVBQUksTUFBdUM7QUFDekMsZUFBTyxVQUFVO0FBQUEsTUFDbkIsT0FBTztBQUNMLGVBQU8sVUFBVTtBQUFBLE1BQ25CO0FBQUE7QUFBQTs7O0FDTkEsTUFBQWEsZ0JBQWtCOzs7QUNPbEIsTUFBSSxPQUFPLGdCQUFnQixhQUFhO0FBQ3RDLGVBQVcsY0FBYztBQUFBLE1BQ3ZCLEtBQUssTUFBTSxPQUFPLGVBQWUsQ0FBQztBQUFBLElBQ3BDO0FBQUEsRUFDRjtBQUtBLE1BQUk7QUFDRixRQUFJLGNBQWMsR0FBRztBQUFBLEVBQ3ZCLFFBQVE7QUFFTixXQUFPLFVBQVUsZ0JBQWdCLFNBQVUsT0FBTztBQUNoRCxZQUFNLElBQUksT0FBTyxJQUFJLEdBQUcsSUFBSSxPQUFPLEtBQUs7QUFDeEMsYUFBTyxJQUFJLElBQUksS0FBSyxJQUFJLElBQUksSUFBSTtBQUFBLElBQ2xDO0FBQUEsRUFDRjtBQUVBLE1BQUksT0FBTyxlQUFlLGFBQWE7QUFDckMsUUFBSSxlQUFlO0FBQ25CLFVBQU0saUJBQWlCLG9CQUFJLElBQUk7QUFFL0IsZUFBVyxhQUFhLENBQUMsSUFBSSxPQUFPO0FBQ2xDLFlBQU0sS0FBSztBQUNYLFlBQU0sUUFBUSxLQUFLLElBQUksS0FBSztBQUM1QixxQkFBZSxJQUFJLElBQUksRUFBRSxJQUFJLEtBQUssWUFBWSxJQUFJLElBQUksTUFBTSxDQUFDO0FBQzdELFVBQUksT0FBTyx5QkFBeUIsYUFBYTtBQUMvQyw2QkFBcUIsS0FBSztBQUFBLE1BQzVCO0FBQ0EsYUFBTztBQUFBLElBQ1Q7QUFFQSxlQUFXLGVBQWUsQ0FBQyxPQUFPO0FBQUUscUJBQWUsT0FBTyxFQUFFO0FBQUEsSUFBRztBQUUvRCxlQUFXLG1CQUFtQixNQUFNO0FBQ2xDLFVBQUksZUFBZSxTQUFTLEVBQUc7QUFDL0IsWUFBTSxNQUFNLFlBQVksSUFBSTtBQUM1QixZQUFNLE1BQU0sQ0FBQztBQUNiLGlCQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssZ0JBQWdCO0FBQ3BDLFlBQUksRUFBRSxPQUFPLElBQUssS0FBSSxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztBQUFBLE1BQ3ZDO0FBQ0EsaUJBQVcsQ0FBQyxFQUFFLEtBQUssSUFBSyxnQkFBZSxPQUFPLEVBQUU7QUFDaEQsaUJBQVcsQ0FBQyxFQUFFLEVBQUUsS0FBSyxJQUFLLElBQUc7QUFBQSxJQUMvQjtBQUFBLEVBQ0Y7QUFFQSxNQUFJLE9BQU8sZ0JBQWdCLGFBQWE7QUFDdEMsUUFBSSxrQkFBa0I7QUFDdEIsVUFBTSxvQkFBb0Isb0JBQUksSUFBSTtBQUVsQyxlQUFXLGNBQWMsQ0FBQyxJQUFJLE9BQU87QUFDbkMsWUFBTSxLQUFRO0FBQ2QsWUFBTSxRQUFRLEtBQUssSUFBSSxLQUFLO0FBQzVCLHdCQUFrQixJQUFJLElBQUksRUFBRSxJQUFJLElBQUksT0FBTyxTQUFTLFlBQVksSUFBSSxJQUFJLE1BQU0sQ0FBQztBQUMvRSxVQUFJLE9BQU8seUJBQXlCLFlBQWEsc0JBQXFCLEtBQUs7QUFDM0UsYUFBTztBQUFBLElBQ1Q7QUFFQSxlQUFXLGdCQUFnQixDQUFDLE9BQU87QUFBRSx3QkFBa0IsT0FBTyxFQUFFO0FBQUEsSUFBRztBQUVuRSxVQUFNLGFBQWEsV0FBVztBQUM5QixlQUFXLG1CQUFtQixNQUFNO0FBQ2xDLG1CQUFhO0FBQ2IsVUFBSSxrQkFBa0IsU0FBUyxFQUFHO0FBQ2xDLFlBQU0sTUFBTSxZQUFZLElBQUk7QUFDNUIsVUFBSSxXQUFXO0FBQ2YsaUJBQVcsQ0FBQyxFQUFFLENBQUMsS0FBSyxtQkFBbUI7QUFDckMsWUFBSSxPQUFPLEVBQUUsU0FBUztBQUNwQixZQUFFLFVBQVUsTUFBTSxFQUFFO0FBQ3BCLFlBQUUsR0FBRztBQUFBLFFBQ1A7QUFDQSxZQUFJLEVBQUUsVUFBVSxTQUFVLFlBQVcsRUFBRTtBQUFBLE1BQ3pDO0FBS0EsVUFBSSxXQUFXLFlBQVksT0FBTyx5QkFBeUIsYUFBYTtBQUN0RSw2QkFBcUIsS0FBSyxJQUFJLEdBQUcsV0FBVyxZQUFZLElBQUksQ0FBQyxDQUFDO0FBQUEsTUFDaEU7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUVBLE1BQUksT0FBTyxtQkFBbUIsYUFBYTtBQUN6QyxlQUFXLGlCQUFpQixDQUFDLE9BQU8sUUFBUSxRQUFRLEVBQUUsS0FBSyxFQUFFO0FBQUEsRUFDL0Q7QUFFQSxNQUFJLE9BQU8sbUJBQW1CLGFBQWE7QUFDekMsZUFBVyxpQkFBaUIsTUFBTSxlQUFlO0FBQUEsTUFDL0MsY0FBYztBQUNaLGNBQU0sS0FBSztBQUNYLFdBQUcsUUFBUTtBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsWUFBWSxLQUFLO0FBQUUsZUFBRyxNQUFNLFlBQVksRUFBRSxNQUFNLElBQUksQ0FBQztBQUFBLFVBQUc7QUFBQSxRQUMxRDtBQUNBLFdBQUcsUUFBUTtBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsWUFBWSxLQUFLO0FBQUUsZUFBRyxNQUFNLFlBQVksRUFBRSxNQUFNLElBQUksQ0FBQztBQUFBLFVBQUc7QUFBQSxRQUMxRDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjs7O0FDekdBLE1BQUFDLGdCQUFrQjtBQUNsQixnQ0FBdUI7OztBQ0l2Qix5QkFBcUM7OztBQ2NyQyxNQUFNLG9CQUFvQixvQkFBSSxJQUFJO0FBR2xDLE1BQU0sZ0JBQWdCLG9CQUFJLElBQUk7QUFLOUIsTUFBTSxpQkFBaUIsb0JBQUksSUFBSTtBQUkvQixNQUFNLGVBQWUsb0JBQUksSUFBSTtBQUk3QixNQUFNLG1CQUFtQixvQkFBSSxJQUFJO0FBSWpDLE1BQU0sNEJBQTRCLG9CQUFJLElBQUk7QUFLMUMsTUFBTSxZQUFZLG9CQUFJLElBQUk7QUFNMUIsTUFBTSxnQkFBZ0IsQ0FBQztBQUl2QixNQUFNLFlBQVksb0JBQUksSUFBSTtBQUcxQixNQUFJLGVBQWU7QUFHbkIsTUFBTSxxQkFBcUIsb0JBQUksSUFBSTtBQUduQyxNQUFNLHNCQUFzQixvQkFBSSxJQUFJO0FBR3BDLE1BQU0sc0JBQXNCLENBQUM7QUFHN0IsTUFBTSxlQUFlLENBQUM7QUFLdEIsTUFBTSx1QkFBdUIsQ0FBQztBQUc5QixNQUFJLGdCQUFnQjtBQUdwQixNQUFJLGtCQUFrQjtBQUl0QixNQUFJLHFCQUFxQjtBQUd6QixNQUFJLFdBQVk7QUFDaEIsTUFBSSxZQUFZO0FBR2hCLE1BQUksVUFBVTtBQUNkLE1BQUksVUFBVTtBQVNQLFdBQVMsa0JBQWtCLFFBQVEsVUFBVTtBQUNsRCxzQkFBa0IsSUFBSSxRQUFRLFFBQVE7QUFBQSxFQUN4QztBQTJCTyxXQUFTLG9CQUFvQixRQUFRO0FBQzFDLHNCQUFrQixPQUFPLE1BQU07QUFBQSxFQUNqQztBQThETyxXQUFTLHFCQUFxQixRQUFRLFVBQVU7QUFDckQsUUFBSSxVQUFVO0FBQ1osdUJBQWlCLElBQUksUUFBUSxJQUFJO0FBQUEsSUFDbkMsT0FBTztBQUNMLHVCQUFpQixPQUFPLE1BQU07QUFBQSxJQUNoQztBQUFBLEVBQ0Y7QUFNTyxXQUFTLHVCQUF1QixRQUFRO0FBQzdDLHFCQUFpQixPQUFPLE1BQU07QUFBQSxFQUNoQztBQWdCTyxXQUFTLGNBQWMsUUFBUTtBQUNwQyxrQkFBYyxLQUFLLE1BQU07QUFBQSxFQUMzQjtBQU1PLFdBQVMsZ0JBQWdCLFFBQVE7QUFDdEMsVUFBTSxJQUFJLGNBQWMsUUFBUSxNQUFNO0FBQ3RDLFFBQUksTUFBTSxHQUFJLGVBQWMsT0FBTyxHQUFHLENBQUM7QUFBQSxFQUN6QztBQVFPLFdBQVMsY0FBYyxTQUFTLFVBQVU7QUFDL0MsY0FBVSxJQUFJLFNBQVMsUUFBUTtBQUFBLEVBQ2pDO0FBT08sV0FBUyxtQkFBbUIsUUFBUTtBQUN6QyxjQUFVLE9BQU8sTUFBTTtBQUN2QixvQkFBZ0IsTUFBTTtBQUN0QixjQUFVLE9BQU8sTUFBTTtBQUFBLEVBQ3pCO0FBUU8sV0FBUyxjQUFjLFFBQVEsUUFBUTtBQUM1QyxRQUFJLFdBQVcsR0FBRztBQUNoQixnQkFBVSxJQUFJLFFBQVEsTUFBTTtBQUFBLElBQzlCLE9BQU87QUFDTCxnQkFBVSxPQUFPLE1BQU07QUFBQSxJQUN6QjtBQUFBLEVBQ0Y7QUFjTyxXQUFTLHNCQUFzQixJQUFJO0FBQ3hDLHdCQUFvQixLQUFLLEVBQUU7QUFBQSxFQUM3QjtBQU1PLFdBQVMseUJBQXlCLElBQUk7QUFDM0MsVUFBTSxNQUFNLG9CQUFvQixRQUFRLEVBQUU7QUFDMUMsUUFBSSxPQUFPLEVBQUcscUJBQW9CLE9BQU8sS0FBSyxDQUFDO0FBQUEsRUFDakQ7QUFNTyxXQUFTLGVBQWUsSUFBSTtBQUNqQyxpQkFBYSxLQUFLLEVBQUU7QUFBQSxFQUN0QjtBQWlDTyxXQUFTLFNBQVMsUUFBUTtBQUMvQixRQUFJLGtCQUFrQixRQUFRO0FBQzVCLFVBQUksa0JBQWtCLE1BQU07QUFDMUIsY0FBTSxPQUFPLGNBQWMsSUFBSSxhQUFhO0FBQzVDLGNBQU0sU0FBUztBQUFBLE1BQ2pCO0FBQ0Esc0JBQWdCO0FBQ2hCLFlBQU0sV0FBVyxjQUFjLElBQUksTUFBTTtBQUN6QyxnQkFBVSxVQUFVO0FBQUEsSUFDdEI7QUFBQSxFQUNGO0FBSUEsV0FBUyxRQUFRLFFBQVEsSUFBSSxJQUFJO0FBQy9CLFFBQUksMEJBQTBCLElBQUksTUFBTSxFQUFHLFFBQU87QUFDbEQsVUFBTSxTQUFTLGlCQUFpQixNQUFNO0FBQ3RDLFFBQUksQ0FBQyxPQUFRLFFBQU87QUFDcEIsV0FDRSxNQUFNLE9BQU8sS0FBSyxLQUFLLE9BQU8sSUFBSSxPQUFPLFNBQ3pDLE1BQU0sT0FBTyxLQUFLLEtBQUssT0FBTyxJQUFJLE9BQU87QUFBQSxFQUU3QztBQUdBLFdBQVMsV0FBVyxRQUFRO0FBQzFCLFdBQU8saUJBQWlCLElBQUksTUFBTTtBQUFBLEVBQ3BDO0FBU0EsV0FBUyxpQkFBaUIsWUFBWTtBQUNwQyxRQUFJLGVBQWUsTUFBTTtBQUN2QixVQUFJLEtBQUssVUFBVSxJQUFJLFVBQVU7QUFDakMsYUFBTyxPQUFPLFFBQVc7QUFDdkIsWUFBSSxlQUFlLElBQUksRUFBRSxFQUFHLFFBQU87QUFDbkMsYUFBSyxVQUFVLElBQUksRUFBRTtBQUFBLE1BQ3ZCO0FBQUEsSUFDRjtBQUNBLGVBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxHQUFHLGNBQWMsRUFBRSxRQUFRLEdBQUc7QUFDcEQsVUFBSSxRQUFRLFFBQVEsU0FBUyxPQUFPLEVBQUcsUUFBTztBQUFBLElBQ2hEO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFHQSxXQUFTLGFBQWEsWUFBWSxjQUFjO0FBQzlDLFFBQUksS0FBSyxVQUFVLElBQUksWUFBWTtBQUNuQyxXQUFPLE9BQU8sUUFBVztBQUN2QixVQUFJLE9BQU8sV0FBWSxRQUFPO0FBQzlCLFdBQUssVUFBVSxJQUFJLEVBQUU7QUFBQSxJQUN2QjtBQUNBLFdBQU87QUFBQSxFQUNUO0FBZUEsV0FBUyxpQkFBaUIsR0FBRyxHQUFHO0FBQzlCLFVBQU0sV0FBVyxDQUFDO0FBQ2xCLGVBQVcsTUFBTSxlQUFlO0FBQzlCLFVBQUksUUFBUSxJQUFJLEdBQUcsQ0FBQyxFQUFHLFVBQVMsS0FBSyxFQUFFO0FBQUEsSUFDekM7QUFDQSxRQUFJLFNBQVMsV0FBVyxFQUFHLFFBQU87QUFDbEMsUUFBSSxTQUFTLFdBQVcsRUFBRyxRQUFPLFNBQVMsQ0FBQztBQUU1QyxVQUFNLFVBQVUsU0FBUztBQUFBLE1BQ3ZCLFFBQU0sQ0FBQyxTQUFTLEtBQUssV0FBUyxVQUFVLE1BQU0sYUFBYSxJQUFJLEtBQUssQ0FBQztBQUFBLElBQ3ZFO0FBQ0EsUUFBSSxRQUFRLFdBQVcsRUFBRyxRQUFPLFFBQVEsQ0FBQztBQVMxQyxVQUFNLGFBQWEsQ0FBQyxPQUFPO0FBQ3pCLFVBQUksSUFBSSxVQUFVLElBQUksRUFBRSxLQUFLO0FBQzdCLFVBQUksSUFBSSxVQUFVLElBQUksRUFBRTtBQUN4QixhQUFPLE1BQU0sUUFBVztBQUN0QixjQUFNLEtBQUssVUFBVSxJQUFJLENBQUM7QUFDMUIsWUFBSSxPQUFPLFVBQWEsS0FBSyxFQUFHLEtBQUk7QUFDcEMsWUFBSSxVQUFVLElBQUksQ0FBQztBQUFBLE1BQ3JCO0FBQ0EsYUFBTztBQUFBLElBQ1Q7QUFDQSxRQUFJLFNBQVMsUUFBUSxDQUFDO0FBQ3RCLFFBQUksVUFBVSxjQUFjLFlBQVksUUFBUSxDQUFDLENBQUM7QUFDbEQsUUFBSSxRQUFVLFdBQVcsUUFBUSxDQUFDLENBQUM7QUFDbkMsYUFBUyxJQUFJLEdBQUcsSUFBSSxRQUFRLFFBQVEsS0FBSztBQUN2QyxZQUFNLElBQU0sV0FBVyxRQUFRLENBQUMsQ0FBQztBQUNqQyxZQUFNLE1BQU0sY0FBYyxZQUFZLFFBQVEsQ0FBQyxDQUFDO0FBQ2hELFVBQUksSUFBSSxTQUFVLE1BQU0sU0FBUyxNQUFNLFNBQVU7QUFDL0MsaUJBQVUsUUFBUSxDQUFDO0FBQ25CLGtCQUFVO0FBQ1YsZ0JBQVU7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUNBLFdBQU87QUFBQSxFQUNUO0FBUU8sV0FBUyxpQkFBaUI7QUFDL0IsVUFBTSxTQUFTLGtCQUFrQjtBQUNqQyxRQUFJLENBQUMsVUFBVSxPQUFPLFdBQVcsRUFBRztBQUVwQyxRQUFJLHVCQUF1QjtBQUUzQixlQUFXLE1BQU0sUUFBUTtBQUN2QixjQUFRLEdBQUcsTUFBTTtBQUFBLFFBRWYsS0FBSyxlQUFlO0FBQ2xCLGNBQUksQ0FBQyxHQUFHLFNBQVM7QUFDZiw4QkFBa0I7QUFDbEI7QUFBQSxVQUNGO0FBRUEsZ0JBQU0sVUFBVSxHQUFHLFdBQVc7QUFJOUIsY0FBSSxxQkFBcUIsU0FBUyxHQUFHO0FBQ25DLGtCQUFNLE1BQU0sRUFBRSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxRQUFRLEdBQUcsT0FBTztBQUNsRCx1QkFBVyxNQUFNLHFCQUFzQixLQUFJO0FBQUUsaUJBQUcsR0FBRztBQUFBLFlBQUcsUUFBUTtBQUFBLFlBQUM7QUFBQSxVQUNqRTtBQUtBLGdCQUFNLFlBQVksaUJBQWlCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFFN0MsY0FBSSxjQUFjLE1BQU07QUFLdEIsZ0JBQUksa0JBQWtCO0FBQ3RCLG1CQUFPLG9CQUFvQixVQUFhLENBQUMsa0JBQWtCLElBQUksZUFBZSxHQUFHO0FBQy9FLGdDQUFrQixVQUFVLElBQUksZUFBZTtBQUFBLFlBQ2pEO0FBQ0EsZ0JBQUksb0JBQW9CLFFBQVc7QUFDakMsb0JBQU0sS0FBSyxrQkFBa0IsSUFBSSxlQUFlO0FBQ2hELGtCQUFJLE1BQU0sQ0FBQyxXQUFXLGVBQWUsR0FBRztBQUN0QyxzQkFBTSxTQUFTLGlCQUFpQixlQUFlO0FBQy9DLHNCQUFNLE1BQU07QUFBQSxrQkFDVixHQUFHLEdBQUc7QUFBQSxrQkFBRyxHQUFHLEdBQUc7QUFBQSxrQkFDZixXQUFXLFNBQVMsR0FBRyxJQUFJLE9BQU8sSUFBSTtBQUFBLGtCQUN0QyxXQUFXLFNBQVMsR0FBRyxJQUFJLE9BQU8sSUFBSTtBQUFBLGdCQUN4QztBQUVBLG9CQUFJLFFBQVMsSUFBRyxlQUFlLEdBQUc7QUFBQSxvQkFDckIsSUFBRyxVQUFVLEdBQUc7QUFBQSxjQUMvQjtBQUFBLFlBQ0Y7QUFJQSxrQkFBTSxLQUFLLGNBQWMsSUFBSSxTQUFTO0FBQ3RDLGdCQUFJLE1BQU0sQ0FBQyxXQUFXLFNBQVMsR0FBRztBQUNoQyx1QkFBUyxTQUFTO0FBQ2xCLG9CQUFNLFNBQVMsaUJBQWlCLFNBQVM7QUFDekMsa0JBQUksT0FBUSxJQUFHLFlBQVksR0FBRyxJQUFJLE9BQU8sR0FBRyxHQUFHLElBQUksT0FBTyxDQUFDO0FBRzNELGtCQUFJLENBQUMsUUFBUyxtQkFBa0I7QUFBQSxZQUNsQztBQUFBLFVBQ0Y7QUFHQSxjQUFJLGtCQUFrQixRQUFRLGtCQUFrQixXQUFXO0FBQ3pELDBCQUFjLElBQUksYUFBYSxHQUFHLFNBQVM7QUFDM0MsNEJBQWdCO0FBQUEsVUFDbEI7QUFDQTtBQUFBLFFBQ0Y7QUFBQSxRQUVBLEtBQUssWUFBWTtBQUVmLGNBQUksR0FBRyxRQUFRLGlCQUFpQixHQUFHLFFBQVEsZ0JBQWdCO0FBQ3pELHVCQUFXLEdBQUc7QUFDZDtBQUFBLFVBQ0Y7QUFDQSxjQUFJLEdBQUcsUUFBUSxlQUFlLEdBQUcsUUFBUSxjQUFjO0FBQ3JELHdCQUFZLEdBQUc7QUFDZjtBQUFBLFVBQ0Y7QUFHQSxjQUFJLGFBQWEsU0FBUyxHQUFHO0FBQzNCLGtCQUFNLE1BQU0sRUFBRSxLQUFLLEdBQUcsS0FBSyxNQUFNLFVBQVUsT0FBTyxXQUFXLFNBQVMsR0FBRyxRQUFRO0FBQ2pGLHVCQUFXLE1BQU0sYUFBYyxLQUFJO0FBQUUsaUJBQUcsR0FBRztBQUFBLFlBQUcsUUFBUTtBQUFBLFlBQUM7QUFBQSxVQUN6RDtBQUVBLGNBQUksQ0FBQyxHQUFHLFFBQVM7QUFNakI7QUFDRSxrQkFBTSxJQUFJLEdBQUc7QUFDYixrQkFBTSxVQUFhLGtCQUFrQjtBQUNyQyxrQkFBTSxhQUFjLE1BQU0sWUFBWSxNQUFNLGVBQWU7QUFDM0Qsa0JBQU0sWUFBYSxhQUFhLE1BQU0sVUFBVSxNQUFNLFVBQVU7QUFDaEUsa0JBQU0sY0FBYyxNQUFNLGFBQWEsTUFBTSxnQkFBZ0I7QUFDN0QsZ0JBQUksYUFBYSxhQUFhLFlBQVk7QUFDeEMsb0JBQU0sU0FBUyxpQkFBaUIsYUFBYTtBQUM3QyxrQkFBSSxXQUFXLE1BQU07QUFDbkIsc0JBQU0sS0FBUyxlQUFlLElBQUksTUFBTTtBQUN4QyxzQkFBTSxTQUFTLGlCQUFpQixNQUFNO0FBQ3RDLHNCQUFNLFFBQVMsU0FBUyxPQUFPLFNBQVM7QUFDeEMsc0JBQU0sT0FBUztBQUNmLG9CQUFTLE1BQU0sVUFBYSxJQUFHLFdBQVcsQ0FBRSxJQUFLO0FBQUEseUJBQ3hDLE1BQU0sWUFBYSxJQUFHLFdBQVcsSUFBSTtBQUFBLHlCQUNyQyxNQUFNLFNBQWEsSUFBRyxXQUFXLEVBQUUsUUFBUSxLQUFLO0FBQUEseUJBQ2hELE1BQU0sV0FBYSxJQUFHLFdBQVcsUUFBUSxJQUFJO0FBQUEseUJBQzdDLE1BQU0sT0FBYSxJQUFHLG1CQUFtQixDQUFDO0FBQUEseUJBQzFDLE1BQU0sTUFBYSxJQUFHLG1CQUFtQixNQUFNO0FBQUEsY0FDMUQ7QUFDQTtBQUFBLFlBQ0Y7QUFBQSxVQUNGO0FBRUEsY0FBSSxrQkFBa0IsS0FBTTtBQUU1QixnQkFBTSxXQUFXLGNBQWMsSUFBSSxhQUFhO0FBQ2hELGNBQUksQ0FBQyxTQUFVO0FBRWYsbUJBQVMsYUFBYSxFQUFFLEtBQUssR0FBRyxLQUFLLE1BQU0sR0FBRyxNQUFNLE1BQU0sVUFBVSxPQUFPLFVBQVUsQ0FBQztBQUN0RjtBQUFBLFFBQ0Y7QUFBQSxRQUVBLEtBQUssZUFBZTtBQUdsQixvQkFBVSxHQUFHO0FBQ2Isb0JBQVUsR0FBRztBQUNiLGlDQUF1QjtBQUd2QixjQUFJLG9CQUFvQixNQUFNO0FBQzVCLGtCQUFNLEtBQUssY0FBYyxJQUFJLGVBQWU7QUFDNUMsZ0JBQUksTUFBTSxHQUFHLFVBQVU7QUFDckIsb0JBQU0sU0FBUyxpQkFBaUIsZUFBZTtBQUMvQyxrQkFBSSxPQUFRLElBQUcsU0FBUyxHQUFHLElBQUksT0FBTyxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUM7QUFBQSxZQUMxRDtBQUFBLFVBQ0Y7QUFDQTtBQUFBLFFBQ0Y7QUFBQSxRQUVBLEtBQUssVUFBVTtBQUtiLGNBQUksU0FBUztBQUNiLGNBQUksaUJBQWlCO0FBQ3JCLHFCQUFXLENBQUMsUUFBUSxRQUFRLEtBQUssZ0JBQWdCO0FBQy9DLGdCQUFJLENBQUMsUUFBUSxRQUFRLFNBQVMsT0FBTyxLQUFLLFdBQVcsTUFBTSxFQUFHO0FBQzlELGdCQUFJLFdBQVcsUUFBUSxhQUFhLFFBQVEsTUFBTSxHQUFHO0FBQ25ELHVCQUFTO0FBQ1QsK0JBQWlCO0FBQUEsWUFDbkI7QUFBQSxVQUNGO0FBQ0EsMEJBQWdCLFdBQVcsR0FBRyxNQUFNO0FBQ3BDO0FBQUEsUUFDRjtBQUFBLFFBRUEsS0FBSyxpQkFBaUI7QUFHcEIsZ0JBQU0sV0FBVyxlQUFlLElBQUksR0FBRyxNQUFNO0FBQzdDLG9CQUFVLG1CQUFtQixHQUFHLE9BQU87QUFDdkM7QUFBQSxRQUNGO0FBQUEsUUFFQSxLQUFLLFVBQVU7QUFDYixnQkFBTSxPQUFPLEVBQUUsT0FBTyxHQUFHLE9BQU8sUUFBUSxHQUFHLE9BQU87QUFDbEQscUJBQVcsTUFBTSxvQkFBcUIsSUFBRyxJQUFJO0FBQzdDO0FBQUEsUUFDRjtBQUFBLFFBRUEsS0FBSyxlQUFlO0FBR2xCLGdCQUFNLEtBQUssb0JBQW9CLElBQUksR0FBRyxFQUFFO0FBQ3hDLGNBQUksSUFBSTtBQUNOLGdCQUFJLE1BQU07QUFDVixnQkFBSTtBQUFFLG9CQUFNLEtBQUssTUFBTSxHQUFHLE9BQU87QUFBQSxZQUFHLFFBQVE7QUFBRSxvQkFBTSxHQUFHO0FBQUEsWUFBUztBQUNoRSxnQkFBSTtBQUFFLGlCQUFHLEdBQUc7QUFBQSxZQUFHLFNBQVMsR0FBRztBQUFFLGtCQUFJLE9BQU8sZUFBZSxZQUFhLFlBQVcsb0NBQW9DLENBQUM7QUFBQSxZQUFHO0FBQUEsVUFDekg7QUFDQTtBQUFBLFFBQ0Y7QUFBQSxRQUVBLEtBQUssY0FBYztBQUNqQixnQkFBTSxVQUFVLG1CQUFtQixJQUFJLEdBQUcsT0FBTztBQUNqRCxjQUFJLFFBQVMsS0FBSTtBQUFFLG9CQUFRLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQztBQUFBLFVBQUcsUUFBUTtBQUFBLFVBQUM7QUFDeEQ7QUFBQSxRQUNGO0FBQUEsUUFFQSxLQUFLLGFBQWE7QUFDaEIscUJBQVcsQ0FBQyxRQUFRLFFBQVEsS0FBSyxjQUFjO0FBQzdDLGdCQUFJLFFBQVEsUUFBUSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUc7QUFDL0Isa0JBQUksV0FBVyxNQUFNLEVBQUc7QUFDeEIsNkJBQWU7QUFDZix1QkFBUyxjQUFjLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUMzQztBQUFBLFlBQ0Y7QUFBQSxVQUNGO0FBQ0E7QUFBQSxRQUNGO0FBQUEsUUFFQSxLQUFLLFlBQVk7QUFDZixjQUFJLGlCQUFpQixNQUFNO0FBQ3pCLGtCQUFNLFdBQVcsYUFBYSxJQUFJLFlBQVk7QUFDOUMsc0JBQVUsYUFBYSxFQUFFLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksR0FBRyxJQUFJLElBQUksR0FBRyxHQUFHLENBQUM7QUFBQSxVQUNuRTtBQUNBO0FBQUEsUUFDRjtBQUFBLFFBRUEsS0FBSyxXQUFXO0FBQ2QsY0FBSSxpQkFBaUIsTUFBTTtBQUN6QixrQkFBTSxXQUFXLGFBQWEsSUFBSSxZQUFZO0FBQzlDLHNCQUFVLFlBQVksRUFBRSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQzFDLDJCQUFlO0FBQUEsVUFDakI7QUFDQTtBQUFBLFFBQ0Y7QUFBQSxRQUVBO0FBQ0U7QUFBQSxNQUNKO0FBQUEsSUFDRjtBQVFBLFFBQUksc0JBQXNCO0FBQ3hCLFlBQU0sV0FBVyxpQkFBaUIsU0FBUyxPQUFPO0FBRWxELFVBQUksVUFBVTtBQUNkLGFBQU8sWUFBWSxVQUFhLENBQUMsa0JBQWtCLElBQUksT0FBTyxHQUFHO0FBQy9ELGtCQUFVLFVBQVUsSUFBSSxPQUFPO0FBQUEsTUFDakM7QUFDQSxZQUFNLGVBQWdCLFlBQVksVUFBYSxDQUFDLFdBQVcsT0FBTyxJQUFLLFVBQVU7QUFFakYsVUFBSSxpQkFBaUIsb0JBQW9CO0FBQ3ZDLFlBQUksdUJBQXVCLE1BQU07QUFDL0IsNEJBQWtCLElBQUksa0JBQWtCLEdBQUcsYUFBYTtBQUFBLFFBQzFEO0FBQ0EsWUFBSSxpQkFBaUIsTUFBTTtBQUN6Qiw0QkFBa0IsSUFBSSxZQUFZLEdBQUcsWUFBWTtBQUFBLFFBQ25EO0FBQ0EsNkJBQXFCO0FBQUEsTUFDdkI7QUFBQSxJQUNGO0FBQUEsRUFDRjs7O0FEbnNCQSxXQUFTLGVBQWUsTUFBTSxPQUFPO0FBTW5DLFVBQU0sRUFBRSxVQUFVLE9BQU8sS0FBSyxNQUFNLGNBQWMsZUFBZSxHQUFHLEtBQUssSUFBSTtBQUM3RSxVQUFNLFlBQVksRUFBRSxHQUFHLE1BQU0sR0FBRyxNQUFNO0FBQ3RDLFFBQUksY0FBZSxXQUFVLFlBQVk7QUFDekMsVUFBTSxLQUFLLGtCQUFrQixNQUFNLFNBQVM7QUFHNUMsUUFBSSxTQUFTLFFBQVE7QUFDbkIsb0JBQWMsRUFBRTtBQUNoQixVQUFJLFVBQVUsT0FBUSxlQUFjLElBQUksVUFBVSxNQUFNO0FBQUEsSUFDMUQ7QUFHQSxRQUFJLE9BQU8saUJBQWlCLFlBQVk7QUFDdEMsbUJBQWEsRUFBRTtBQUFBLElBQ2pCO0FBQ0EsV0FBTyxFQUFFLEdBQUc7QUFBQSxFQUNkO0FBS0EsV0FBUyxtQkFBbUIsTUFBTTtBQUNoQyxlQUFXLG9DQUFvQyxPQUFPLHlCQUFvQjtBQUMxRSxXQUFPLEVBQUUsSUFBSSxHQUFHO0FBQUEsRUFDbEI7QUFLQSxXQUFTLG1CQUFtQixnQkFBZ0IsT0FBTztBQUNqRCxRQUFJLE1BQU0sT0FBTyxJQUFJO0FBQ25CLHlCQUFtQixlQUFlLElBQUksTUFBTSxFQUFFO0FBQzlDLG9CQUFjLE1BQU0sSUFBSSxlQUFlLEVBQUU7QUFBQSxJQUMzQztBQUFBLEVBQ0Y7QUFJQSxXQUFTLFlBQVksZ0JBQWdCLE9BQU87QUFDMUMsUUFBSSxNQUFNLE9BQU8sSUFBSTtBQUNuQix5QkFBbUIsZUFBZSxJQUFJLE1BQU0sRUFBRTtBQUM5QyxvQkFBYyxNQUFNLElBQUksZUFBZSxFQUFFO0FBQUEsSUFDM0M7QUFBQSxFQUNGO0FBRUEsV0FBUyx1QkFBdUIsWUFBWSxPQUFPO0FBR2pELFFBQUksTUFBTSxPQUFPLElBQUk7QUFDbkIscUJBQWUsTUFBTSxFQUFFO0FBQUEsSUFDekI7QUFBQSxFQUNGO0FBRUEsV0FBUyxhQUFhLGdCQUFnQixPQUFPLGFBQWE7QUFDeEQsUUFBSSxNQUFNLE9BQU8sSUFBSTtBQUNuQixVQUFJLGVBQWUsWUFBWSxPQUFPLElBQUk7QUFDeEMsNEJBQW9CLGVBQWUsSUFBSSxNQUFNLElBQUksWUFBWSxFQUFFO0FBQUEsTUFDakUsT0FBTztBQUNMLDJCQUFtQixlQUFlLElBQUksTUFBTSxFQUFFO0FBQUEsTUFDaEQ7QUFDQSxvQkFBYyxNQUFNLElBQUksZUFBZSxFQUFFO0FBQUEsSUFDM0M7QUFBQSxFQUNGO0FBRUEsV0FBUyx3QkFBd0IsWUFBWSxPQUFPLGNBQWM7QUFDaEUsUUFBSSxNQUFNLE9BQU8sSUFBSTtBQUNuQixxQkFBZSxNQUFNLEVBQUU7QUFBQSxJQUN6QjtBQUFBLEVBQ0Y7QUFJQSxXQUFTLFlBQVksaUJBQWlCLE9BQU87QUFDM0MsUUFBSSxNQUFNLE9BQU8sSUFBSTtBQUNuQix3QkFBa0IsTUFBTSxFQUFFO0FBQUEsSUFDNUI7QUFBQSxFQUNGO0FBRUEsV0FBUyx5QkFBeUIsWUFBWSxPQUFPO0FBQ25ELFFBQUksTUFBTSxPQUFPLElBQUk7QUFDbkIsd0JBQWtCLE1BQU0sRUFBRTtBQUFBLElBQzVCO0FBQUEsRUFDRjtBQUVBLFdBQVMsZUFBZSxZQUFZO0FBQUEsRUFFcEM7QUFHQSxXQUFTLHNCQUFzQixVQUFVO0FBQ3ZDLFFBQUksU0FBUyxPQUFPLElBQUk7QUFDdEIsd0JBQWtCLFNBQVMsRUFBRTtBQUM3Qix5QkFBbUIsU0FBUyxFQUFFO0FBQUEsSUFDaEM7QUFBQSxFQUNGO0FBT0EsV0FBUyxjQUFjLFdBQVcsT0FBTyxVQUFVLFVBQVU7QUFDM0QsVUFBTSxPQUFPLENBQUMsWUFBWSxPQUFPLGdCQUFnQixlQUFlO0FBQ2hFLFVBQU0sVUFBVSxPQUFPLEtBQUssUUFBUSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQztBQUNyRSxVQUFNLFVBQVUsT0FBTyxLQUFLLFFBQVEsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUM7QUFDckUsUUFBSSxRQUFRLFdBQVcsUUFBUSxPQUFRLFFBQU87QUFDOUMsZUFBVyxLQUFLLFNBQVM7QUFDdkIsVUFBSSxTQUFTLENBQUMsTUFBTSxTQUFTLENBQUMsRUFBRyxRQUFPO0FBQUEsSUFDMUM7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUVBLFdBQVMsYUFBYSxVQUFVLGVBQWU7QUFDN0MsVUFBTSxFQUFFLFVBQVUsT0FBTyxLQUFLLE1BQU0sY0FBYyxlQUFlLEdBQUcsS0FBSyxJQUFJO0FBQzdFLFVBQU0sWUFBWSxFQUFFLEdBQUcsTUFBTSxHQUFHLE1BQU07QUFDdEMsUUFBSSxjQUFlLFdBQVUsWUFBWTtBQUN6QyxzQkFBa0IsU0FBUyxJQUFJLFNBQVM7QUFDeEMsa0JBQWMsU0FBUyxJQUFJLFVBQVUsVUFBVSxDQUFDO0FBQUEsRUFDbEQ7QUFFQSxXQUFTLG1CQUFtQjtBQUFBLEVBRTVCO0FBRUEsV0FBUyxjQUFjO0FBQUEsRUFFdkI7QUFJQSxXQUFTLDBCQUEwQjtBQUVqQyxXQUFPO0FBQUEsRUFDVDtBQUVBLFdBQVMscUJBQXFCO0FBQUEsRUFBQztBQUkvQixXQUFTLHFCQUFzQjtBQUFFLFdBQU8sQ0FBQztBQUFBLEVBQUc7QUFDNUMsV0FBUyxzQkFBc0I7QUFBRSxXQUFPLENBQUM7QUFBQSxFQUFHO0FBQzVDLFdBQVMsa0JBQWtCLFVBQVU7QUFBRSxXQUFPO0FBQUEsRUFBVTtBQUl4RCxXQUFTLG1CQUFvQjtBQUFFLFdBQU87QUFBQSxFQUFNO0FBQzVDLFdBQVMsbUJBQW9CO0FBQUEsRUFBQztBQU05QixXQUFTLHVCQUF1QjtBQUFFLFdBQU87QUFBQSxFQUFPO0FBSWhELFdBQVMsZ0JBQWdCLElBQUksT0FBTztBQUFFLFdBQU8sV0FBVyxJQUFJLEtBQUs7QUFBQSxFQUFHO0FBQ3BFLFdBQVMsY0FBYyxJQUFhO0FBQUUsaUJBQWEsRUFBRTtBQUFBLEVBQUc7QUFJeEQsV0FBUywwQkFBMEI7QUFBRSxXQUFPO0FBQUEsRUFBc0I7QUFJbEUsV0FBUyxzQkFBdUI7QUFBRSxXQUFPO0FBQUEsRUFBTTtBQUMvQyxXQUFTLDJCQUEyQjtBQUFBLEVBQUM7QUFDckMsV0FBUywwQkFBMkI7QUFBQSxFQUFDO0FBQ3JDLFdBQVMscUJBQTJCO0FBQUEsRUFBQztBQUNyQyxXQUFTLHVCQUEyQjtBQUFFLFdBQU87QUFBQSxFQUFNO0FBSW5ELE1BQU0sYUFBYTtBQUFBO0FBQUEsSUFFakI7QUFBQSxJQUNBO0FBQUE7QUFBQSxJQUdBO0FBQUE7QUFBQSxJQUdBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBO0FBQUEsSUFHQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBO0FBQUEsSUFHQTtBQUFBLElBQ0E7QUFBQTtBQUFBLElBR0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBO0FBQUEsSUFHQTtBQUFBLElBQ0E7QUFBQTtBQUFBLElBR0E7QUFBQTtBQUFBLElBR0E7QUFBQSxJQUNBO0FBQUEsSUFDQSxXQUFXO0FBQUE7QUFBQSxJQUdYLGtCQUFxQjtBQUFBLElBQ3JCLHFCQUFxQjtBQUFBLElBQ3JCLG1CQUFxQjtBQUFBLElBQ3JCLG1CQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNckIsb0JBQW9CO0FBQUEsSUFDcEIsbUJBQW9CLENBQUMsT0FBTyxRQUFRLFFBQVEsRUFBRSxLQUFLLEVBQUU7QUFBQTtBQUFBLElBR3JEO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBRUEsTUFBTyxxQkFBUTs7O0FFOVBSLE1BQU0saUJBQWlCLG9CQUFJLElBQUk7QUFLL0IsTUFBTSxnQkFBZ0IsQ0FBQztBQU92QixNQUFNLHFCQUFxQixDQUFDO0FBQzVCLE1BQU0sd0JBQXdCO0FBRTlCLFdBQVMsaUJBQWlCO0FBRS9CLFFBQUksQ0FBQyx5QkFBeUIsbUJBQW1CLFNBQVMsR0FBRztBQUMzRCw4QkFBd0I7QUFDeEIsVUFBSSxPQUFPLGtDQUFrQyxhQUFhO0FBQ3hELFlBQUk7QUFDRixnQkFBTSxNQUFNLDhCQUE4QjtBQUMxQyxjQUFJLEtBQUs7QUFDUCx1QkFBVyxNQUFNLG9CQUFvQjtBQUNuQyxrQkFBSTtBQUFFLG1CQUFHLEdBQUc7QUFBQSxjQUFHLFNBQVMsR0FBRztBQUFFLDJCQUFXLGdDQUFnQyxDQUFDO0FBQUEsY0FBRztBQUFBLFlBQzlFO0FBQUEsVUFDRjtBQUFBLFFBQ0YsUUFBUTtBQUFBLFFBQUM7QUFBQSxNQUNYO0FBQUEsSUFDRjtBQUdBLFFBQUksT0FBTyx5QkFBeUIsWUFBYTtBQUNqRCxRQUFJO0FBQ0osUUFBSTtBQUFFLFlBQU0scUJBQXFCO0FBQUEsSUFBRyxRQUFRO0FBQUU7QUFBQSxJQUFRO0FBQ3RELFFBQUksQ0FBQyxPQUFPLFFBQVEsS0FBTTtBQUMxQixRQUFJO0FBQ0osUUFBSTtBQUFFLGFBQU8sS0FBSyxNQUFNLEdBQUc7QUFBQSxJQUFHLFFBQVE7QUFBRTtBQUFBLElBQVE7QUFDaEQsZUFBVyxPQUFPLE1BQU07QUFDdEIsaUJBQVcsTUFBTSxvQkFBb0I7QUFDbkMsWUFBSTtBQUFFLGFBQUcsR0FBRztBQUFBLFFBQUcsU0FBUyxHQUFHO0FBQUUscUJBQVcsZ0NBQWdDLENBQUM7QUFBQSxRQUFHO0FBQUEsTUFDOUU7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUtPLE1BQU0sMkJBQTJCLG9CQUFJLElBQUk7QUFFekMsV0FBUyx1QkFBdUI7QUFDckMsUUFBSSxPQUFPLHlCQUF5QixZQUFhO0FBQ2pELFFBQUkseUJBQXlCLFNBQVMsRUFBRztBQUN6QyxRQUFJO0FBQ0osUUFBSTtBQUFFLFlBQU0scUJBQXFCO0FBQUEsSUFBRyxRQUFRO0FBQUU7QUFBQSxJQUFRO0FBQ3RELFFBQUksQ0FBQyxPQUFPLFFBQVEsS0FBTTtBQUMxQixRQUFJO0FBQ0osUUFBSTtBQUFFLFlBQU0sS0FBSyxNQUFNLEdBQUc7QUFBQSxJQUFHLFFBQVE7QUFBRTtBQUFBLElBQVE7QUFDL0MsZUFBVyxNQUFNLEtBQUs7QUFDcEIsWUFBTSxLQUFLLHlCQUF5QixJQUFJLEVBQUU7QUFDMUMsVUFBSSxHQUFJLEtBQUk7QUFBRSxXQUFHO0FBQUEsTUFBRyxTQUFTLEdBQUc7QUFBRSxtQkFBVyxnQ0FBZ0MsQ0FBQztBQUFBLE1BQUc7QUFBQSxJQUNuRjtBQUFBLEVBQ0Y7QUFFTyxXQUFTLGdCQUFnQjtBQUM5QixRQUFJLE9BQU8sd0JBQXdCLFlBQWE7QUFDaEQsUUFBSSxDQUFDLFdBQVcscUJBQXFCLFdBQVcsa0JBQWtCLFdBQVcsRUFBRztBQUNoRixRQUFJO0FBQ0osUUFBSTtBQUFFLFlBQU0sb0JBQW9CO0FBQUEsSUFBRyxRQUFRO0FBQUU7QUFBQSxJQUFRO0FBQ3JELFFBQUksQ0FBQyxPQUFPLFFBQVEsS0FBTTtBQUMxQixRQUFJO0FBQ0osUUFBSTtBQUFFLFlBQU0sS0FBSyxNQUFNLEdBQUc7QUFBQSxJQUFHLFFBQVE7QUFBRTtBQUFBLElBQVE7QUFDL0MsZUFBVyxNQUFNLEtBQUs7QUFDcEIsaUJBQVcsTUFBTSxXQUFXLG1CQUFtQjtBQUM3QyxZQUFJO0FBQUUsYUFBRyxFQUFFO0FBQUEsUUFBRyxTQUFTLEdBQUc7QUFBRSxxQkFBVywrQkFBK0IsQ0FBQztBQUFBLFFBQUc7QUFBQSxNQUM1RTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBTU8sTUFBTSxrQkFBa0Isb0JBQUksSUFBSTtBQUt2QyxXQUFTLGNBQWMsVUFBVTtBQUMvQixRQUFJLGFBQWEsS0FBSyxRQUFRLEVBQUssUUFBTyxTQUFTLENBQUMsRUFBRSxZQUFZO0FBQ2xFLFFBQUksWUFBWSxLQUFLLFFBQVEsRUFBTSxRQUFPLFNBQVMsQ0FBQztBQUNwRCxXQUFPLFNBQVMsWUFBWTtBQUFBLEVBQzlCO0FBR0EsaUJBQWUsU0FBUyx3QkFBd0IsRUFBRSxLQUFLLE1BQU0sT0FBTyxRQUFRLEdBQUc7QUFDN0UsUUFBSSxDQUFDLFdBQVcsZ0JBQWdCLFNBQVMsRUFBRztBQUM1QyxVQUFNLE9BQU8sY0FBYyxHQUFHO0FBQzlCLGVBQVcsRUFBRSxNQUFNLEtBQUssTUFBTSxHQUFHLEtBQUssZ0JBQWdCLE9BQU8sR0FBRztBQUM5RCxVQUFJLFNBQVMsUUFBUSxLQUFLLFNBQVMsUUFBUSxLQUFLLFVBQVUsT0FBTztBQUMvRCxZQUFJO0FBQUUsYUFBRztBQUFBLFFBQUcsU0FBUyxHQUFHO0FBQUUscUJBQVcsc0NBQXNDLENBQUM7QUFBQSxRQUFHO0FBQUEsTUFDakY7QUFBQSxJQUNGO0FBQUEsRUFDRixDQUFDO0FBSU0sTUFBTSx1QkFBdUIsQ0FBQztBQUM5QixNQUFNLHFCQUF1QixDQUFDO0FBRTlCLFdBQVMsc0JBQXNCO0FBQ3BDLFFBQUksT0FBTyxnQ0FBZ0MsWUFBYTtBQUN4RCxRQUFJLHFCQUFxQixXQUFXLEVBQUc7QUFDdkMsUUFBSTtBQUNKLFFBQUk7QUFBRSxZQUFNLDRCQUE0QjtBQUFBLElBQUcsUUFBUTtBQUFFO0FBQUEsSUFBUTtBQUM3RCxRQUFJLENBQUMsT0FBTyxRQUFRLEtBQU07QUFDMUIsUUFBSTtBQUNKLFFBQUk7QUFBRSxtQkFBYSxLQUFLLE1BQU0sR0FBRztBQUFBLElBQUcsUUFBUTtBQUFFO0FBQUEsSUFBUTtBQUN0RCxlQUFXLEtBQUssWUFBWTtBQUMxQixpQkFBVyxNQUFNLHNCQUFzQjtBQUNyQyxZQUFJO0FBQUUsYUFBRyxDQUFDO0FBQUEsUUFBRyxTQUFTLEdBQUc7QUFBRSxxQkFBVyw2Q0FBNkMsQ0FBQztBQUFBLFFBQUc7QUFBQSxNQUN6RjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRU8sV0FBUyxvQkFBb0I7QUFDbEMsUUFBSSxPQUFPLG1DQUFtQyxZQUFhO0FBQzNELFFBQUksbUJBQW1CLFdBQVcsRUFBRztBQUNyQyxRQUFJO0FBQ0osUUFBSTtBQUFFLFlBQU0sK0JBQStCO0FBQUEsSUFBRyxRQUFRO0FBQUU7QUFBQSxJQUFRO0FBQ2hFLFFBQUksQ0FBQyxPQUFPLFFBQVEsS0FBTTtBQUMxQixRQUFJO0FBQ0osUUFBSTtBQUFFLGlCQUFXLEtBQUssTUFBTSxHQUFHO0FBQUEsSUFBRyxRQUFRO0FBQUU7QUFBQSxJQUFRO0FBQ3BELGVBQVcsS0FBSyxVQUFVO0FBQ3hCLGlCQUFXLE1BQU0sb0JBQW9CO0FBQ25DLFlBQUk7QUFBRSxhQUFHLENBQUM7QUFBQSxRQUFHLFNBQVMsR0FBRztBQUFFLHFCQUFXLDJDQUEyQyxDQUFDO0FBQUEsUUFBRztBQUFBLE1BQ3ZGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFPTyxNQUFNLGtCQUFrQixvQkFBSSxJQUFJO0FBRWhDLFdBQVMsYUFBYTtBQUMzQixRQUFJLE9BQU8sc0JBQXNCLFlBQWE7QUFDOUMsUUFBSTtBQUNKLFFBQUk7QUFBRSxZQUFNLGtCQUFrQjtBQUFBLElBQUcsUUFBUTtBQUFFO0FBQUEsSUFBUTtBQUNuRCxRQUFJLENBQUMsT0FBTyxRQUFRLEtBQU07QUFDMUIsUUFBSTtBQUNKLFFBQUk7QUFBRSxlQUFTLEtBQUssTUFBTSxHQUFHO0FBQUEsSUFBRyxRQUFRO0FBQUU7QUFBQSxJQUFRO0FBQ2xELGVBQVcsTUFBTSxRQUFRO0FBQ3ZCLFlBQU0sTUFBTSxPQUFPLEdBQUcsTUFBTTtBQUM1QixZQUFNLE1BQU0sZ0JBQWdCLElBQUksR0FBRztBQUNuQyxVQUFJLEtBQUs7QUFDUCxtQkFBVyxNQUFNLEtBQUs7QUFDcEIsY0FBSSxHQUFHLFVBQVUsV0FBVyxHQUFHLFNBQVM7QUFDdEMsZ0JBQUk7QUFBRSxpQkFBRyxRQUFRO0FBQUEsWUFBRyxTQUFTLEdBQUc7QUFBRSx5QkFBVyw0QkFBNEIsQ0FBQztBQUFBLFlBQUc7QUFBQSxVQUMvRTtBQUFBLFFBQ0Y7QUFDQSxZQUFJLEdBQUcsVUFBVSxRQUFTLGlCQUFnQixPQUFPLEdBQUc7QUFBQSxNQUN0RDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBYUEsTUFBTSxhQUFhLENBQUMsU0FBUyxRQUFRLE9BQU8sSUFBSSxNQUFNLEdBQUcsSUFBSSx5QkFBeUIsQ0FBQztBQWtEdkYsTUFBTSxvQkFBb0Isb0JBQUksSUFBSTtBQUUzQixXQUFTLGVBQWU7QUFDN0IsUUFBSSxPQUFPLHlCQUF5QixZQUFhO0FBQ2pELFVBQU0sTUFBTSxxQkFBcUI7QUFDakMsUUFBSSxDQUFDLE9BQU8sUUFBUSxLQUFNO0FBQzFCLFFBQUk7QUFDSixRQUFJO0FBQUUsZUFBUyxLQUFLLE1BQU0sR0FBRztBQUFBLElBQUcsUUFBUTtBQUFFO0FBQUEsSUFBUTtBQUNsRCxlQUFXLE1BQU0sUUFBUTtBQUN2QixZQUFNLEtBQUssa0JBQWtCLElBQUksR0FBRyxFQUFFO0FBQ3RDLFVBQUksR0FBSSxJQUFHLEVBQUUsTUFBTSxHQUFHLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQztBQUFBLElBQzdDO0FBQUEsRUFDRjtBQW1qQkEsTUFBTSxjQUFOLE1BQU0sYUFBWTtBQUFBLElBQ2hCLFlBQVksTUFBTTtBQUNoQixXQUFLLEtBQUssb0JBQUksSUFBSTtBQUNsQixVQUFJLENBQUMsS0FBTTtBQUNYLFVBQUksZ0JBQWdCLGNBQWE7QUFBRSxhQUFLLFFBQVEsQ0FBQyxHQUFHLE1BQU0sS0FBSyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFBRyxXQUNsRSxNQUFNLFFBQVEsSUFBSSxHQUFPO0FBQUUsbUJBQVcsQ0FBQyxHQUFHLENBQUMsS0FBSyxLQUFNLE1BQUssT0FBTyxHQUFHLENBQUM7QUFBQSxNQUFHLFdBQ3pFLE9BQU8sS0FBSyxZQUFZLFlBQVk7QUFBRSxhQUFLLFFBQVEsQ0FBQyxHQUFHLE1BQU0sS0FBSyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFBRyxPQUNsRjtBQUFFLG1CQUFXLEtBQUssT0FBTyxLQUFLLElBQUksRUFBRyxNQUFLLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQztBQUFBLE1BQUc7QUFBQSxJQUNsRTtBQUFBLElBQ0EsSUFBSSxHQUFHLEdBQU87QUFBRSxXQUFLLEdBQUcsSUFBSSxPQUFPLENBQUMsRUFBRSxZQUFZLEdBQUcsT0FBTyxDQUFDLENBQUM7QUFBQSxJQUFHO0FBQUEsSUFDakUsT0FBTyxHQUFHLEdBQUk7QUFBRSxZQUFNLEtBQUssT0FBTyxDQUFDLEVBQUUsWUFBWTtBQUFHLFdBQUssR0FBRyxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksRUFBRSxJQUFJLEdBQUcsS0FBSyxHQUFHLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLE9BQU8sQ0FBQyxDQUFDO0FBQUEsSUFBRztBQUFBLElBQy9ILElBQUksR0FBVTtBQUFFLFlBQU0sSUFBSSxLQUFLLEdBQUcsSUFBSSxPQUFPLENBQUMsRUFBRSxZQUFZLENBQUM7QUFBRyxhQUFPLEtBQUssT0FBTyxPQUFPO0FBQUEsSUFBRztBQUFBLElBQzdGLElBQUksR0FBVTtBQUFFLGFBQU8sS0FBSyxHQUFHLElBQUksT0FBTyxDQUFDLEVBQUUsWUFBWSxDQUFDO0FBQUEsSUFBRztBQUFBLElBQzdELE9BQU8sR0FBTztBQUFFLFdBQUssR0FBRyxPQUFPLE9BQU8sQ0FBQyxFQUFFLFlBQVksQ0FBQztBQUFBLElBQUc7QUFBQSxJQUN6RCxRQUFRLElBQUksR0FBRTtBQUFFLFdBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxNQUFNLEdBQUcsS0FBSyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFBQSxJQUFHO0FBQUEsSUFDbkUsT0FBYztBQUFFLGFBQU8sS0FBSyxHQUFHLEtBQUs7QUFBQSxJQUFHO0FBQUEsSUFDdkMsU0FBYztBQUFFLGFBQU8sS0FBSyxHQUFHLE9BQU87QUFBQSxJQUFHO0FBQUEsSUFDekMsVUFBYztBQUFFLGFBQU8sS0FBSyxHQUFHLFFBQVE7QUFBQSxJQUFHO0FBQUEsSUFDMUMsQ0FBQyxPQUFPLFFBQVEsSUFBSTtBQUFFLGFBQU8sS0FBSyxHQUFHLFFBQVE7QUFBQSxJQUFHO0FBQUEsSUFDaEQsV0FBYztBQUFFLFlBQU0sSUFBSSxDQUFDO0FBQUcsV0FBSyxHQUFHLFFBQVEsQ0FBQyxHQUFHLE1BQU07QUFBRSxVQUFFLENBQUMsSUFBSTtBQUFBLE1BQUcsQ0FBQztBQUFHLGFBQU87QUFBQSxJQUFHO0FBQUEsRUFDcEY7QUFLQSxXQUFTLGNBQWMsTUFBTSxLQUFLO0FBQ2hDLFVBQU0sVUFBVyxJQUFJLFlBQVksS0FBSyxXQUFXLENBQUMsQ0FBQztBQUNuRCxVQUFNLFdBQVcsS0FBSyxRQUFRO0FBQzlCLFFBQUksT0FBTztBQUNYLFVBQU0sVUFBVSxNQUFNO0FBQUUsVUFBSSxLQUFNLE9BQU0sSUFBSSxVQUFVLGlDQUFpQztBQUFHLGFBQU87QUFBQSxJQUFNO0FBQ3ZHLFVBQU0sVUFBVSxNQUFNO0FBQ3BCLFVBQUksT0FBTyxnQkFBZ0IsWUFBYSxRQUFPLElBQUksWUFBWSxFQUFFLE9BQU8sUUFBUTtBQUNoRixZQUFNLEtBQUssSUFBSSxXQUFXLFNBQVMsTUFBTTtBQUN6QyxlQUFTLElBQUksR0FBRyxJQUFJLFNBQVMsUUFBUSxJQUFLLElBQUcsQ0FBQyxJQUFJLFNBQVMsV0FBVyxDQUFDLElBQUk7QUFDM0UsYUFBTztBQUFBLElBQ1Q7QUFDQSxXQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssT0FBTztBQUFBLE1BQUssUUFBUSxLQUFLO0FBQUEsTUFBUSxJQUFJLEtBQUs7QUFBQSxNQUFJLFlBQVksS0FBSztBQUFBLE1BQ3pFO0FBQUEsTUFBUyxZQUFZO0FBQUEsTUFBTyxNQUFNO0FBQUEsTUFDbEMsSUFBSSxXQUFXO0FBQUUsZUFBTztBQUFBLE1BQU07QUFBQSxNQUM5QixNQUFhLE1BQU07QUFBRSxnQkFBUTtBQUFHLGVBQU8sUUFBUSxRQUFRLFFBQVE7QUFBQSxNQUFHO0FBQUEsTUFDbEUsTUFBYSxNQUFNO0FBQUUsZ0JBQVE7QUFBRyxlQUFPLFFBQVEsUUFBUSxLQUFLLE1BQU0sUUFBUSxDQUFDO0FBQUEsTUFBRztBQUFBLE1BQzlFLGFBQWEsTUFBTTtBQUFFLGdCQUFRO0FBQUcsZUFBTyxRQUFRLFFBQVEsUUFBUSxFQUFFLE1BQU07QUFBQSxNQUFHO0FBQUEsTUFDMUUsTUFBYSxNQUFNO0FBQ2pCLGdCQUFRO0FBQ1IsY0FBTSxLQUFLLFFBQVE7QUFDbkIsZUFBTyxRQUFRLFFBQVE7QUFBQSxVQUNyQixNQUFNLEdBQUc7QUFBQSxVQUFRLE1BQU0sUUFBUSxJQUFJLGNBQWMsS0FBSztBQUFBLFVBQ3RELGFBQWEsTUFBTSxRQUFRLFFBQVEsR0FBRyxNQUFNO0FBQUEsVUFDNUMsTUFBYSxNQUFNLFFBQVEsUUFBUSxRQUFRO0FBQUEsUUFDN0MsQ0FBQztBQUFBLE1BQ0g7QUFBQSxNQUNBLE9BQU8sTUFBTSxjQUFjLE1BQU0sR0FBRztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUVBLGlCQUFzQixNQUFNLEtBQUssVUFBVSxDQUFDLEdBQUc7QUFDN0MsUUFBSSxPQUFPLGlCQUFpQixhQUFhO0FBQ3ZDLFlBQU0sSUFBSSxNQUFNLDhDQUE4QztBQUFBLElBQ2hFO0FBR0EsVUFBTSxPQUFPLEVBQUUsR0FBRyxRQUFRO0FBQzFCLFVBQU0sT0FBTyxJQUFJLFlBQVksS0FBSyxPQUFPO0FBQ3pDLFFBQUksS0FBSyxRQUFRLFFBQVEsT0FBTyxLQUFLLFNBQVMsWUFBWSxDQUFDLEtBQUssV0FBVztBQUN6RSxZQUFNLElBQUksS0FBSztBQUNmLFlBQU0sV0FBVyxhQUFhLGVBQWUsWUFBWSxPQUFPLENBQUM7QUFDakUsVUFBSSxDQUFDLFlBQVksT0FBTyxNQUFNLFVBQVU7QUFFdEMsYUFBSyxPQUFPLEtBQUssVUFBVSxDQUFDO0FBQzVCLFlBQUksQ0FBQyxLQUFLLElBQUksY0FBYyxFQUFHLE1BQUssSUFBSSxnQkFBZ0Isa0JBQWtCO0FBQUEsTUFDNUUsV0FBVyxDQUFDLFVBQVU7QUFDcEIsYUFBSyxPQUFPLE9BQU8sQ0FBQztBQUFBLE1BQ3RCO0FBQUEsSUFHRjtBQUNBLFNBQUssVUFBVSxLQUFLLFNBQVM7QUFFN0IsVUFBTSxNQUFNLE1BQU0sYUFBYSxLQUFLLEtBQUssVUFBVSxJQUFJLENBQUM7QUFDeEQsV0FBTyxjQUFjLEtBQUssTUFBTSxHQUFHLEdBQUcsR0FBRztBQUFBLEVBQzNDO0FBVUEsTUFBSSxPQUFPLFdBQVcsVUFBVSxZQUFlLFlBQVcsUUFBUTtBQUNsRSxNQUFJLE9BQU8sV0FBVyxZQUFZLFlBQWEsWUFBVyxVQUFVO0FBTzdELFdBQVMsa0JBQWtCO0FBQ2hDLGVBQVcsQ0FBQyxJQUFJLFFBQVEsS0FBSyxnQkFBZ0I7QUFDM0MsVUFBSTtBQUNKLFVBQUk7QUFBRSxjQUFNLGVBQWUsRUFBRTtBQUFBLE1BQUcsUUFBUTtBQUFFO0FBQUEsTUFBVTtBQUNwRCxVQUFJLENBQUMsSUFBSztBQUNWLFVBQUk7QUFDSixVQUFJO0FBQUUsZUFBTyxLQUFLLE1BQU0sR0FBRztBQUFBLE1BQUcsUUFBUTtBQUFFO0FBQUEsTUFBVTtBQUNsRCxpQkFBVyxLQUFLLE1BQU07QUFDcEIsWUFBSSxNQUFNLHNCQUFzQjtBQUM5QixtQkFBUyxVQUFVO0FBQ25CLHlCQUFlLE9BQU8sRUFBRTtBQUN4QjtBQUFBLFFBQ0YsT0FBTztBQUNMLG1CQUFTLFlBQVksRUFBRSxNQUFNLEVBQUUsQ0FBQztBQUFBLFFBQ2xDO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBa0VPLFdBQVMsV0FBVztBQUN6QixRQUFJLE9BQU8sb0JBQW9CLFlBQWE7QUFDNUMsUUFBSTtBQUNKLFFBQUk7QUFBRSxZQUFNLGdCQUFnQjtBQUFBLElBQUcsUUFBUTtBQUFFO0FBQUEsSUFBUTtBQUNqRCxRQUFJLENBQUMsSUFBSztBQUNWLFFBQUk7QUFDSixRQUFJO0FBQUUsYUFBTyxLQUFLLE1BQU0sR0FBRztBQUFBLElBQUcsUUFBUTtBQUFFO0FBQUEsSUFBUTtBQUNoRCxlQUFXLE9BQU8sTUFBTTtBQUN0QixpQkFBVyxNQUFNLGVBQWU7QUFDOUIsWUFBSTtBQUFFLGFBQUcsR0FBRztBQUFBLFFBQUcsUUFBUTtBQUFBLFFBQUM7QUFBQSxNQUMxQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBYU8sTUFBTSxNQUFNO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBTWpCLEtBQUssY0FBYyxTQUFTO0FBQzFCLFVBQUksT0FBTyxvQkFBb0IsYUFBYTtBQUMxQyx3QkFBZ0IsY0FBYyxPQUFPLE9BQU8sQ0FBQztBQUFBLE1BQy9DO0FBQUEsSUFDRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBUUEsR0FBRyxPQUFPLFVBQVU7QUFDbEIsVUFBSSxVQUFVLFVBQVcsUUFBTyxNQUFNO0FBQUEsTUFBQztBQUN2QyxvQkFBYyxLQUFLLFFBQVE7QUFDM0IsYUFBTyxNQUFNO0FBQ1gsY0FBTSxNQUFNLGNBQWMsUUFBUSxRQUFRO0FBQzFDLFlBQUksUUFBUSxHQUFJLGVBQWMsT0FBTyxLQUFLLENBQUM7QUFBQSxNQUM3QztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBbUJPLE1BQU0sYUFBYTtBQUFBLElBQ3hCLGVBQWlCLENBQUMsU0FBVSxPQUFPLHlCQUEyQixlQUFlLHFCQUFxQixJQUFJO0FBQUEsSUFDdEcsY0FBaUIsQ0FBQyxRQUFVLE9BQU8sd0JBQTJCLGVBQWUsb0JBQW9CLEdBQUc7QUFBQSxJQUNwRyxjQUFpQixNQUFXLE9BQU8sd0JBQTJCLGVBQWUsb0JBQW9CO0FBQUEsSUFDakcsY0FBaUIsTUFBVyxPQUFPLHdCQUEyQixjQUFjLG9CQUFvQixJQUFPO0FBQUEsSUFDdkcsYUFBaUIsTUFBVyxPQUFPLHVCQUEyQixjQUFjLG1CQUFtQixJQUFRO0FBQUEsSUFDdkcsZUFBaUIsTUFBVyxPQUFPLHlCQUEyQixjQUFjLHFCQUFxQixJQUFNLEVBQUUsT0FBTyxHQUFHLFFBQVEsRUFBRTtBQUFBLElBQzdILGVBQWlCLE1BQVcsT0FBTyx5QkFBMkIsY0FBYyxxQkFBcUIsSUFBTSxFQUFFLE9BQU8sR0FBRyxRQUFRLEVBQUU7QUFBQSxJQUM3SCxnQkFBaUIsQ0FBQyxPQUFVLE9BQU8sMEJBQTJCLGVBQWUsc0JBQXNCLEVBQUU7QUFBQSxJQUNyRyxVQUFpQixDQUFDLFVBQVUsT0FBTyxvQkFBMkIsZUFBZSxnQkFBZ0IsS0FBSztBQUFBO0FBQUE7QUFBQTtBQUFBLElBSWxHLFdBQWlCLENBQUMsU0FBVSxPQUFPLHFCQUEyQixlQUFlLGlCQUFpQixJQUFJO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJbEcsZUFBaUIsTUFBVyxPQUFPLDBCQUEyQixlQUFlLHNCQUFzQjtBQUFBO0FBQUEsSUFFbkcsY0FBaUIsQ0FBQyxRQUFVLE9BQU8seUJBQTJCLGVBQWUscUJBQXFCLEdBQUc7QUFBQSxFQUN2RztBQUVBLGFBQVcsU0FBUyxTQUFTLE9BQU8sT0FBTyxDQUFDLEdBQUc7QUFDN0MsUUFBSSxPQUFPLHlCQUF5QixZQUFhLFFBQU8sV0FBVyxtQkFBbUI7QUFDdEYsV0FBTyxxQkFBcUIsS0FBSyxVQUFVLElBQUksQ0FBQyxFQUFFLEtBQUssV0FBUztBQUM5RCxZQUFNLEtBQUssT0FBTyxLQUFLO0FBQ3ZCLGFBQU87QUFBQSxRQUNMLElBQUksS0FBSztBQUFFLGlCQUFPO0FBQUEsUUFBSTtBQUFBLFFBQ3RCLEtBQUssS0FBSztBQUFFLGNBQUksS0FBSyxJQUFJLEdBQUc7QUFBQSxRQUFHO0FBQUEsTUFDakM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBTUEsYUFBVyxPQUFPLFNBQVMsT0FBTztBQUNoQyxRQUFJLE9BQU8sZ0JBQWdCLFlBQWEsYUFBWTtBQUFBLEVBQ3REO0FBTUEsYUFBVyxVQUFVLFNBQVMsVUFBVTtBQUN0QyxRQUFJLE9BQU8sbUJBQW1CLFlBQWEsZ0JBQWU7QUFBQSxFQUM1RDtBQU1BLGFBQVcsUUFBUSxTQUFTLFFBQVE7QUFDbEMsUUFBSSxPQUFPLHdCQUF3QixZQUFhLHFCQUFvQjtBQUFBLEVBQ3RFO0FBR0EsTUFBSSxpQkFBaUI7QUFNckIsYUFBVyxXQUFXLFNBQVMsV0FBVztBQUN4QyxRQUFJLG1CQUFtQixLQUFNLFFBQU87QUFDcEMscUJBQWlCLE9BQU8sb0JBQW9CLGNBQWMsZ0JBQWdCLElBQUk7QUFDOUUsV0FBTztBQUFBLEVBQ1Q7QUFTQSxhQUFXLGFBQWEsU0FBUyxhQUFhO0FBQzVDLFFBQUksT0FBTyx1QkFBdUIsWUFBYSxvQkFBbUI7QUFBQSxFQUNwRTtBQTZDQSxHQUFDLFNBQVMsd0JBQXdCO0FBQ2hDLGFBQVMsUUFBUSxNQUFNO0FBQ3JCLFVBQUk7QUFDRixZQUFJLE9BQU8sMkJBQTJCLGFBQWE7QUFDakQsaUNBQXVCLEtBQUssVUFBVSxJQUFJLENBQUM7QUFBQSxRQUM3QztBQUFBLE1BQ0YsU0FBUyxHQUFHO0FBQUEsTUFBQztBQUFBLElBQ2Y7QUFFQSxVQUFNLGNBQWMsV0FBVztBQUMvQixlQUFXLFVBQVUsU0FBUyxLQUFLLEtBQUssTUFBTSxLQUFLLEtBQUs7QUFDdEQsY0FBUTtBQUFBLFFBQ04sTUFBUztBQUFBLFFBQ1QsV0FBVyxLQUFLLElBQUk7QUFBQSxRQUNwQixTQUFTLE9BQU8sT0FBTyxFQUFFO0FBQUEsUUFDekIsUUFBUyxPQUFPLE9BQU8sRUFBRTtBQUFBLFFBQ3pCLE1BQVMsUUFBUTtBQUFBLFFBQ2pCLEtBQVMsT0FBUTtBQUFBLFFBQ2pCLE9BQVMsT0FBTyxJQUFJLFFBQVEsT0FBTyxJQUFJLEtBQUssSUFBSTtBQUFBLE1BQ2xELENBQUM7QUFDRCxVQUFJLE9BQU8sZ0JBQWdCLFdBQVksYUFBWSxLQUFLLEtBQUssTUFBTSxLQUFLLEdBQUc7QUFBQSxJQUM3RTtBQUVBLFVBQU0sZ0JBQWdCLFdBQVc7QUFDakMsZUFBVyx1QkFBdUIsU0FBUyxPQUFPO0FBQ2hELFlBQU0sU0FBUyxTQUFTLE1BQU07QUFDOUIsY0FBUTtBQUFBLFFBQ04sTUFBUztBQUFBLFFBQ1QsV0FBVyxLQUFLLElBQUk7QUFBQSxRQUNwQixTQUFTLGtCQUFrQixRQUFRLE9BQU8sVUFBVSxPQUFPLFVBQVUsRUFBRTtBQUFBLFFBQ3ZFLE9BQVMsa0JBQWtCLFNBQVMsT0FBTyxRQUFRLE9BQU8sT0FBTyxLQUFLLElBQUk7QUFBQSxNQUM1RSxDQUFDO0FBQ0QsVUFBSSxPQUFPLGtCQUFrQixXQUFZLGVBQWMsS0FBSztBQUFBLElBQzlEO0FBQUEsRUFDRixHQUFHO0FBeUJILFdBQVMsYUFBYSxLQUFLLE1BQU07QUFDL0IsUUFBSSxPQUFPLFNBQVMsU0FBWSxPQUFPLEtBQUssVUFBVSxJQUFJO0FBQzFELFdBQU8sb0JBQW9CLEtBQUssSUFBSSxFQUFFLEtBQUssU0FBUyxLQUFLO0FBQ3ZELFVBQUk7QUFBRSxlQUFPLEtBQUssTUFBTSxHQUFHO0FBQUEsTUFBRyxTQUFTLEdBQUc7QUFBRSxlQUFPO0FBQUEsTUFBSztBQUFBLElBQzFELENBQUM7QUFBQSxFQUNIO0FBRUEsV0FBUyxXQUFXLFFBQVE7QUFHMUIsV0FBTyxJQUFJLE1BQU0sV0FBVztBQUFBLElBQUMsR0FBRztBQUFBLE1BQzlCLEtBQUssU0FBUyxHQUFHLElBQUk7QUFDbkIsWUFBSSxPQUFPLE9BQU8sU0FBVSxRQUFPO0FBQ25DLGVBQU8sU0FBUyxNQUFNO0FBQUUsaUJBQU8sYUFBYSxTQUFTLE1BQU0sSUFBSSxJQUFJO0FBQUEsUUFBRztBQUFBLE1BQ3hFO0FBQUEsTUFDQSxPQUFPLFNBQVMsR0FBRyxJQUFJLEdBQUc7QUFBRSxlQUFPLGFBQWEsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUFBLE1BQUc7QUFBQSxJQUNqRSxDQUFDO0FBQUEsRUFDSDtBQUVPLE1BQU0sVUFBVSxJQUFJLE1BQU0sdUJBQU8sT0FBTyxJQUFJLEdBQUc7QUFBQSxJQUNwRCxLQUFLLFNBQVMsR0FBRyxNQUFNO0FBQ3JCLFVBQUksT0FBTyxTQUFTLFNBQVUsUUFBTztBQUNyQyxhQUFPLFdBQVcsSUFBSTtBQUFBLElBQ3hCO0FBQUEsRUFDRixDQUFDO0FBb2lCTSxNQUFNLGtCQUFrQixvQkFBSSxJQUFJO0FBQ2hDLFdBQVMsYUFBYTtBQUMzQixRQUFJLE9BQU8sc0JBQXNCLFlBQWE7QUFDOUMsVUFBTSxTQUFTLEtBQUssTUFBTSxrQkFBa0IsQ0FBQztBQUM3QyxlQUFXLE1BQU0sUUFBUTtBQUN2QixZQUFNLE1BQU0sZ0JBQWdCLElBQUksR0FBRyxFQUFFO0FBQ3JDLFVBQUksQ0FBQyxJQUFLO0FBQ1YsVUFBUyxHQUFHLFNBQVMsV0FBZ0IsSUFBSSxRQUFjLEtBQUksUUFBUTtBQUFBLGVBQzFELEdBQUcsU0FBUyxjQUFnQixJQUFJLFdBQWMsS0FBSSxXQUFXLEVBQUU7QUFBQSxlQUMvRCxHQUFHLFNBQVMsZ0JBQWdCLElBQUksYUFBYyxLQUFJLGFBQWEsR0FBRyxXQUFXO0FBQUEsZUFDN0UsR0FBRyxTQUFTLFdBQWdCLElBQUksUUFBYyxLQUFJLFFBQVEsR0FBRyxPQUFPO0FBQUEsSUFDL0U7QUFBQSxFQUNGO0FBRU8sTUFBTSxRQUFRO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFPbkIsTUFBTSxLQUFLLEtBQUssRUFBRSxTQUFTLFlBQVksY0FBYyxRQUFRLElBQUksQ0FBQyxHQUFHO0FBQ25FLFlBQU0sV0FBVyxTQUFTLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQztBQUN0RCxzQkFBZ0IsSUFBSSxVQUFVLEVBQUUsU0FBUyxZQUFZLGNBQWMsUUFBUSxDQUFDO0FBQzVFLGFBQU87QUFBQSxJQUNUO0FBQUE7QUFBQSxJQUVBLEtBQUssVUFBVSxTQUFTO0FBQ3RCLHdCQUFrQixPQUFPLFFBQVEsR0FBRyxLQUFLLElBQUksR0FBRyxPQUFPLENBQUM7QUFBQSxJQUMxRDtBQUFBO0FBQUEsSUFFQSxVQUFVLFVBQVUsUUFBUTtBQUMxQiw4QkFBd0IsT0FBTyxRQUFRLEdBQUcsTUFBTTtBQUFBLElBQ2xEO0FBQUE7QUFBQSxJQUVBLE1BQU0sVUFBVTtBQUNkLHlCQUFtQixPQUFPLFFBQVEsQ0FBQztBQUFBLElBQ3JDO0FBQUE7QUFBQSxJQUVBLEtBQUssVUFBVTtBQUNiLHdCQUFrQixPQUFPLFFBQVEsQ0FBQztBQUFBLElBQ3BDO0FBQUE7QUFBQSxJQUVBLE1BQU0sVUFBVTtBQUNkLHlCQUFtQixPQUFPLFFBQVEsQ0FBQztBQUNuQyxzQkFBZ0IsT0FBTyxRQUFRO0FBQUEsSUFDakM7QUFBQSxFQUNGOzs7QUN4MERBLHFCQUEyRjtBQWNwRixNQUFNLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxHQUFHLE1BQU0sTUFDL0MsYUFBQUMsUUFBTSxjQUFjLFFBQVEsRUFBRSxPQUFPLEdBQUcsTUFBTSxHQUFHLFFBQVE7QUFvQnBELFdBQVMsS0FBSyxFQUFFLFVBQVUsT0FBTyxZQUFZLEdBQUcsTUFBTSxHQUFHO0FBRzlELFVBQU0sT0FBTyxNQUFNLFFBQVEsUUFBUSxJQUMvQixTQUFTLElBQUksT0FBTSxLQUFLLE9BQU8sS0FBSyxPQUFPLENBQUMsQ0FBRSxFQUFFLEtBQUssRUFBRSxJQUN0RCxZQUFZLE9BQU8sS0FBSyxPQUFPLFFBQVE7QUFDNUMsV0FBTyxhQUFBQyxRQUFNLGNBQWMsUUFBUSxFQUFFLE1BQU0sT0FBTyxZQUFZLEdBQUcsTUFBTSxDQUFDO0FBQUEsRUFDMUU7QUF5Q08sV0FBUyxVQUFVLEVBQUUsVUFBVSxTQUFTLGNBQWMsV0FBVyxZQUFZLFdBQVcsWUFBWSxVQUFVLFdBQVcsTUFBTSxPQUFPLEdBQUcsTUFBTSxHQUFHO0FBQ3ZKLFVBQU0sZ0JBQWUscUJBQU8sSUFBSTtBQUNoQyxVQUFNLGtCQUFlLHFCQUFPLElBQUk7QUFDaEMsVUFBTSxDQUFDLFNBQVMsVUFBVSxRQUFJLHVCQUFTLEtBQUs7QUFDNUMsVUFBTSxDQUFDLFNBQVMsVUFBVSxRQUFJLHVCQUFTLEtBQUs7QUFHNUMsZ0JBQVksVUFBVTtBQUFBLE1BQ3BCLFNBQWMsQ0FBQyxNQUFNLFVBQVUsQ0FBQztBQUFBLE1BQ2hDLGNBQWMsQ0FBQyxNQUFNLGVBQWUsQ0FBQztBQUFBLE1BQ3JDLFdBQVksTUFBTTtBQUFFLG1CQUFXLElBQUk7QUFBSSxvQkFBWTtBQUFBLE1BQUc7QUFBQSxNQUN0RCxZQUFZLE1BQU07QUFBRSxtQkFBVyxLQUFLO0FBQUcscUJBQWE7QUFBQSxNQUFHO0FBQUEsTUFDdkQsV0FBWSxNQUFNO0FBQUUsbUJBQVcsSUFBSTtBQUFJLG9CQUFZO0FBQUEsTUFBRztBQUFBLE1BQ3RELFlBQVksTUFBTTtBQUFFLG1CQUFXLEtBQUs7QUFBRyxxQkFBYTtBQUFBLE1BQUc7QUFBQSxJQUN6RDtBQUdBLFVBQU0sY0FBVSwwQkFBWSxDQUFDLE9BQU87QUFDbEMsZ0JBQVUsVUFBVTtBQUVwQix3QkFBa0IsSUFBSTtBQUFBLFFBQ3BCLFNBQWMsQ0FBQyxNQUFNLFlBQVksUUFBUSxRQUFRLENBQUM7QUFBQSxRQUNsRCxjQUFjLENBQUMsTUFBTSxZQUFZLFFBQVEsYUFBYSxDQUFDO0FBQUEsUUFDdkQsV0FBWSxNQUFNLFlBQVksUUFBUSxVQUFVO0FBQUEsUUFDaEQsWUFBWSxNQUFNLFlBQVksUUFBUSxXQUFXO0FBQUEsUUFDakQsV0FBWSxNQUFNLFlBQVksUUFBUSxVQUFVO0FBQUEsUUFDaEQsWUFBWSxNQUFNLFlBQVksUUFBUSxXQUFXO0FBQUEsTUFDbkQsQ0FBQztBQUNELDJCQUFxQixJQUFJLENBQUMsQ0FBQyxRQUFRO0FBQUEsSUFDckMsR0FBRyxDQUFDLFFBQVEsQ0FBQztBQUtiLGdDQUFVLE1BQU07QUFDZCxVQUFJLFVBQVUsWUFBWSxNQUFNO0FBQzlCLDZCQUFxQixVQUFVLFNBQVMsQ0FBQyxDQUFDLFFBQVE7QUFBQSxNQUNwRDtBQUNBLFVBQUksVUFBVTtBQUNaLG1CQUFXLEtBQUs7QUFDaEIsbUJBQVcsS0FBSztBQUFBLE1BQ2xCO0FBQUEsSUFDRixHQUFHLENBQUMsUUFBUSxDQUFDO0FBR2IsZ0NBQVUsTUFBTTtBQUNkLGFBQU8sTUFBTTtBQUNYLFlBQUksVUFBVSxZQUFZLE1BQU07QUFDOUIsOEJBQW9CLFVBQVUsT0FBTztBQUNyQyxpQ0FBdUIsVUFBVSxPQUFPO0FBQUEsUUFDMUM7QUFBQSxNQUNGO0FBQUEsSUFDRixHQUFHLENBQUMsQ0FBQztBQVlMLFVBQU0sWUFBWSxPQUFPLFVBQVU7QUFDbkMsVUFBTSxnQkFBZ0IsWUFBWSxNQUFNLEVBQUUsU0FBUyxRQUFRLENBQUMsSUFBSTtBQUNoRSxVQUFNLGNBQWMsZUFBZSxXQUFXO0FBQzlDLFVBQU0sY0FBZSxDQUFDLGFBQWEsWUFBWSxXQUFXLENBQUMsV0FDdkQsRUFBRSxHQUFHLGVBQWUsU0FBUyxjQUFjLEtBQUssSUFDL0MsQ0FBQyxhQUFhLFlBQVksV0FBVyxDQUFDLFdBQ3ZDLEVBQUUsR0FBRyxlQUFlLFNBQVMsY0FBYyxLQUFLLElBQ2hEO0FBRUosV0FBTyxhQUFBQyxRQUFNO0FBQUEsTUFDWDtBQUFBO0FBQUE7QUFBQSxNQUdBLEVBQUUsY0FBYyxTQUFTLE9BQU8sYUFBYSxXQUFXLE1BQU0sR0FBRyxNQUFNO0FBQUEsTUFDdkU7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQXlRTyxXQUFTLGdCQUFnQjtBQUM5QixVQUFNLENBQUMsTUFBTSxPQUFPLFFBQUksdUJBQVMsTUFBTTtBQUNyQyxZQUFNLElBQUksT0FBTyx5QkFBeUIsY0FBYyxxQkFBcUIsSUFBSTtBQUNqRixhQUFPLElBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxRQUFRLEVBQUUsT0FBTyxJQUFJLEVBQUUsT0FBTyxHQUFHLFFBQVEsRUFBRTtBQUFBLElBQzFFLENBQUM7QUFFRCxnQ0FBVSxNQUFNO0FBQ2QsWUFBTSxVQUFVLENBQUMsTUFBTSxRQUFRLENBQUM7QUFDaEMsNEJBQXNCLE9BQU87QUFDN0IsYUFBTyxNQUFNLHlCQUF5QixPQUFPO0FBQUEsSUFDL0MsR0FBRyxDQUFDLENBQUM7QUFFTCxXQUFPO0FBQUEsRUFDVDtBQXVFQSxNQUFNLG9CQUFnQiw0QkFBYyxJQUFJOzs7QUNoZ0J4QyxNQUFBQyxnQkFBMkM7QUFXM0MsTUFBSSxpQkFBaUI7QUFDZCxNQUFNLGdCQUFnQjtBQUFBLElBQzNCLFNBQVM7QUFBQTtBQUFBLElBQ1QsV0FBVyxvQkFBSSxJQUFJO0FBQUEsSUFDbkIsS0FBSyxHQUFHO0FBQUUsWUFBTSxLQUFLLEVBQUU7QUFBZ0IsV0FBSyxVQUFVLEVBQUUsSUFBSSxHQUFHLEVBQUU7QUFBRyxXQUFLLE1BQU07QUFBRyxhQUFPO0FBQUEsSUFBSTtBQUFBLElBQzdGLE1BQU0sSUFBSTtBQUNSLFVBQUksQ0FBQyxLQUFLLFFBQVM7QUFDbkIsVUFBSSxNQUFNLFFBQVEsS0FBSyxRQUFRLE9BQU8sR0FBSTtBQUMxQyxZQUFNLEtBQUssS0FBSyxRQUFRO0FBQ3hCLFdBQUssVUFBVTtBQUNmLFdBQUssTUFBTTtBQUNYLFVBQUksR0FBSSxJQUFHO0FBQUEsSUFDYjtBQUFBLElBQ0EsUUFBUTtBQUFFLGlCQUFXLEtBQUssS0FBSyxVQUFXLEdBQUU7QUFBQSxJQUFHO0FBQUEsRUFDakQ7QUFZTyxXQUFTLGNBQWM7QUFDNUIsVUFBTSxDQUFDLEVBQUUsS0FBSyxRQUFJLHdCQUFTLENBQUM7QUFDNUIsVUFBTSxFQUFFLE9BQU8sTUFBTSxRQUFRLEtBQUssSUFBSSxjQUFjO0FBQ3BELGlDQUFVLE1BQU07QUFDZCxZQUFNLElBQUksTUFBTSxNQUFNLENBQUMsTUFBTyxJQUFJLElBQUssQ0FBQztBQUN4QyxvQkFBYyxVQUFVLElBQUksQ0FBQztBQUM3QixhQUFPLE1BQU07QUFBRSxzQkFBYyxVQUFVLE9BQU8sQ0FBQztBQUFBLE1BQUc7QUFBQSxJQUNwRCxHQUFHLENBQUMsQ0FBQztBQUVMLFVBQU0sSUFBSSxjQUFjO0FBQ3hCLFFBQUksQ0FBQyxFQUFHLFFBQU87QUFFZixVQUFNLE1BQU07QUFDWixVQUFNLEtBQU0sRUFBRSxTQUFTO0FBQ3ZCLFVBQU0sS0FBTSxFQUFFLFlBQVk7QUFDMUIsVUFBTSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDM0IsVUFBTSxTQUFVLFNBQVMsS0FBSyxRQUFVLEVBQUUsSUFBSSxLQUFLLE9BQU87QUFDMUQsVUFBTSxNQUFPLFNBQVMsS0FBSyxJQUFJLEdBQUcsRUFBRSxJQUFJLEtBQUssR0FBRyxJQUFJO0FBQ3BELFVBQU0sT0FBTyxLQUFLLElBQUksR0FBRyxLQUFLLElBQUksRUFBRSxHQUFHLE9BQU8sS0FBSyxDQUFDLENBQUM7QUFFckQsV0FBTyxjQUFBQyxRQUFNO0FBQUEsTUFBYztBQUFBLE1BQVc7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQUlwQyxTQUFTLE1BQU0sY0FBYyxNQUFNLEVBQUUsRUFBRTtBQUFBLFFBQ3ZDLFVBQVU7QUFBQSxRQUNWLE9BQU8sRUFBRSxVQUFVLFlBQVksTUFBTSxHQUFHLEtBQUssR0FBRyxPQUFPLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSztBQUFBLE1BQzFGO0FBQUEsTUFDRSxjQUFBQSxRQUFNLGNBQWMsV0FBVztBQUFBLFFBQzdCLFNBQVMsTUFBTTtBQUFBLFFBQUM7QUFBQTtBQUFBLFFBQ2hCLFVBQVU7QUFBQSxRQUNWLE9BQU8sRUFBRSxVQUFVLFlBQVksTUFBTSxLQUFLLE9BQU8sSUFBSSxRQUFRLEtBQUs7QUFBQSxNQUNwRSxHQUFHLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQztBQUFBLElBQ25CO0FBQUEsRUFDRjs7O0FDdkVBLE1BQUFDLGdCQUFnRTtBQXdDekQsTUFBTSxxQkFBcUI7QUFBQSxJQUNoQyxXQUFxQjtBQUFBLElBQ3JCLG1CQUFxQjtBQUFBLElBQ3JCLGVBQXFCO0FBQUEsSUFDckIsb0JBQXFCO0FBQUEsSUFDckIsYUFBcUI7QUFBQSxJQUNyQixvQkFBcUI7QUFBQTtBQUFBLElBRXJCLFNBQXFCO0FBQUEsSUFDckIsWUFBcUI7QUFBQSxJQUNyQixnQkFBcUI7QUFBQSxJQUNyQixZQUFxQjtBQUFBLElBQ3JCLG9CQUFxQjtBQUFBLElBQ3JCLGVBQXFCO0FBQUEsSUFDckIsa0JBQXFCO0FBQUEsSUFDckIsYUFBcUI7QUFBQTtBQUFBLElBRXJCLG1CQUFxQjtBQUFBLElBQ3JCLHFCQUFxQjtBQUFBLElBQ3JCLFlBQXFCO0FBQUEsRUFDdkI7QUFFTyxNQUFNLHNCQUFzQixjQUFBQyxRQUFNLGNBQWMsa0JBQWtCO0FBMGhCekUsTUFBTSxZQUFZLGNBQUFDLFFBQU0sY0FBYyxJQUFJOzs7QUN4bEIxQyxNQUFBQyxnQkFBMkM7QUFvQjNDLFdBQVMsWUFBWSxHQUFHO0FBQ3RCLFFBQUksTUFBTSxRQUFRLENBQUMsRUFBRyxRQUFPO0FBQzdCLFFBQUksT0FBTyxNQUFNLFlBQVksRUFBRSxXQUFXLEdBQUcsR0FBRztBQUM5QyxZQUFNLElBQUksRUFBRSxNQUFNLENBQUM7QUFDbkIsVUFBSSxFQUFFLFdBQVcsR0FBRztBQUNsQixjQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksT0FBSyxTQUFTLElBQUksR0FBRyxFQUFFLENBQUM7QUFDMUQsZUFBTyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUc7QUFBQSxNQUN0QjtBQUNBLFVBQUksRUFBRSxXQUFXLEdBQUc7QUFDbEIsZUFBTztBQUFBLFVBQ0wsU0FBUyxFQUFFLE1BQU0sR0FBRyxDQUFDLEdBQUcsRUFBRTtBQUFBLFVBQzFCLFNBQVMsRUFBRSxNQUFNLEdBQUcsQ0FBQyxHQUFHLEVBQUU7QUFBQSxVQUMxQixTQUFTLEVBQUUsTUFBTSxHQUFHLENBQUMsR0FBRyxFQUFFO0FBQUEsVUFDMUI7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUNBLFVBQUksRUFBRSxXQUFXLEdBQUc7QUFDbEIsZUFBTztBQUFBLFVBQ0wsU0FBUyxFQUFFLE1BQU0sR0FBRyxDQUFDLEdBQUcsRUFBRTtBQUFBLFVBQzFCLFNBQVMsRUFBRSxNQUFNLEdBQUcsQ0FBQyxHQUFHLEVBQUU7QUFBQSxVQUMxQixTQUFTLEVBQUUsTUFBTSxHQUFHLENBQUMsR0FBRyxFQUFFO0FBQUEsVUFDMUIsU0FBUyxFQUFFLE1BQU0sR0FBRyxDQUFDLEdBQUcsRUFBRTtBQUFBLFFBQzVCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFDQSxXQUFPLENBQUMsS0FBSyxLQUFLLEtBQUssR0FBRztBQUFBLEVBQzVCO0FBZUEsTUFBTSxZQUFZO0FBQWxCLE1BQXFCLGVBQWU7QUFBcEMsTUFBdUMsaUJBQWlCO0FBQXhELE1BQTJELGlCQUFpQjtBQUE1RSxNQUNNLG1CQUFtQjtBQUR6QixNQUM0QixpQkFBaUI7QUFEN0MsTUFDZ0QsZUFBZTtBQUQvRCxNQUVNLGVBQWU7QUFGckIsTUFFd0IsaUJBQWlCO0FBR3pDLFdBQVMsV0FBVyxHQUFHO0FBQ3JCLFVBQU0sTUFBTSxZQUFZLENBQUM7QUFDekIsWUFBUyxJQUFJLENBQUMsSUFBSSxPQUFTLElBQUksQ0FBQyxJQUFJLFFBQVEsS0FBTyxJQUFJLENBQUMsSUFBSSxRQUFRLE1BQVEsSUFBSSxDQUFDLElBQUksUUFBUSxRQUFTO0FBQUEsRUFDeEc7QUFPQSxNQUFJO0FBQ0osV0FBUyxtQkFBbUI7QUFDMUIsUUFBSSxlQUFlLE9BQVcsUUFBTztBQUNyQyxVQUFNLEtBQ0osT0FBTywyQkFBMkIsZUFBZSwyQkFBMkIsWUFDNUUsT0FBTyw2QkFBNkIsZUFDcEMsT0FBTyw2QkFBNkIsZUFDcEMsT0FBTyx5QkFBNkIsZUFDcEMsT0FBTyx3QkFBNkI7QUFDdEMsaUJBQWEsS0FBSztBQUFBLE1BQ2hCLEtBQVE7QUFBQSxNQUNSLEtBQVE7QUFBQSxNQUNSLEtBQVE7QUFBQSxNQUNSLEtBQVEseUJBQXlCO0FBQUEsTUFDakMsUUFBUSxxQkFBcUI7QUFBQSxNQUM3QixLQUFTLE9BQU8sZ0JBQWdCLGNBQWUsSUFBSSxZQUFZLElBQUk7QUFBQSxJQUNyRSxJQUFJO0FBQ0osV0FBTztBQUFBLEVBQ1Q7QUFFQSxNQUFNLG9CQUFOLE1BQXdCO0FBQUEsSUFDdEIsWUFBWSxVQUFVO0FBQ3BCLFdBQUssTUFBUztBQUNkLFdBQUssT0FBUyxpQkFBaUI7QUFDL0IsV0FBSyxRQUFTLENBQUM7QUFDZixXQUFLLE1BQVM7QUFDZCxXQUFLLE1BQVM7QUFDZCxXQUFLLGNBQWM7QUFDbkIsV0FBSyxRQUFVLENBQUM7QUFDaEIsV0FBSyxjQUFjO0FBQ25CLFdBQUssWUFBYyxDQUFDLEtBQUssS0FBSyxLQUFLLEdBQUc7QUFDdEMsV0FBSyxjQUFjLENBQUMsS0FBSyxLQUFLLEtBQUssR0FBRztBQUN0QyxXQUFLLFlBQWM7QUFBQSxJQUNyQjtBQUFBO0FBQUEsSUFHQSxRQUFRLE9BQU87QUFDYixVQUFJLEtBQUssTUFBTSxRQUFRLEtBQUssS0FBSyxJQUFLLE1BQUssWUFBWTtBQUFBLElBQ3pEO0FBQUE7QUFBQTtBQUFBLElBSUEsY0FBYztBQUNaLFlBQU0sSUFBSSxLQUFLO0FBQ2YsVUFBSTtBQUNGLDRCQUFvQixLQUFLLEtBQUssRUFBRSxLQUFLLEtBQUssS0FBSyxFQUFFLEtBQUssS0FBSyxLQUFLLENBQUMsS0FBSyxXQUFXO0FBQUEsTUFDbkYsU0FBUyxHQUFHO0FBQ1YsbUJBQVcsMkJBQTJCLENBQUM7QUFBQSxNQUN6QztBQUNBLFdBQUssY0FBYztBQUNuQixXQUFLLE1BQU07QUFDWCxXQUFLLE1BQU07QUFBQSxJQUNiO0FBQUEsSUFFQSxRQUFRO0FBQ04sVUFBSSxDQUFDLEtBQUssTUFBTTtBQUFFLGFBQUssTUFBTSxTQUFTO0FBQUcsYUFBSyxNQUFNLEtBQUssRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUFHO0FBQUEsTUFBUTtBQUVyRixXQUFLLE1BQU07QUFBRyxXQUFLLE1BQU07QUFBRyxXQUFLLGNBQWM7QUFDL0MsV0FBSyxLQUFLLElBQUksQ0FBQyxJQUFJO0FBQVcsV0FBSyxNQUFNO0FBQUEsSUFDM0M7QUFBQSxJQUVBLFNBQVMsR0FBRyxHQUFHLEdBQUcsR0FBRztBQUNuQixVQUFJLENBQUMsS0FBSyxNQUFNO0FBQUUsYUFBSyxNQUFNLEtBQUssRUFBRSxNQUFNLFlBQVksR0FBRyxHQUFHLEdBQUcsR0FBRyxPQUFPLFlBQVksS0FBSyxTQUFTLEVBQUUsQ0FBQztBQUFHO0FBQUEsTUFBUTtBQUNqSCxXQUFLLFFBQVEsQ0FBQztBQUNkLFlBQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUs7QUFDbEMsUUFBRSxDQUFDLElBQUk7QUFBYyxRQUFFLElBQUUsQ0FBQyxJQUFJO0FBQUcsUUFBRSxJQUFFLENBQUMsSUFBSTtBQUFHLFFBQUUsSUFBRSxDQUFDLElBQUk7QUFBRyxRQUFFLElBQUUsQ0FBQyxJQUFJO0FBQ2xFLFdBQUssS0FBSyxJQUFJLElBQUUsQ0FBQyxJQUFJLFdBQVcsS0FBSyxTQUFTO0FBQzlDLFdBQUssTUFBTSxJQUFJO0FBQUEsSUFDakI7QUFBQSxJQUNBLFdBQVcsR0FBRyxHQUFHLEdBQUcsR0FBRztBQUNyQixVQUFJLENBQUMsS0FBSyxNQUFNO0FBQUUsYUFBSyxNQUFNLEtBQUssRUFBRSxNQUFNLGNBQWMsR0FBRyxHQUFHLEdBQUcsR0FBRyxPQUFPLFlBQVksS0FBSyxXQUFXLEdBQUcsV0FBVyxLQUFLLFVBQVUsQ0FBQztBQUFHO0FBQUEsTUFBUTtBQUNoSixXQUFLLFFBQVEsQ0FBQztBQUNkLFlBQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUs7QUFDbEMsUUFBRSxDQUFDLElBQUk7QUFBZ0IsUUFBRSxJQUFFLENBQUMsSUFBSTtBQUFHLFFBQUUsSUFBRSxDQUFDLElBQUk7QUFBRyxRQUFFLElBQUUsQ0FBQyxJQUFJO0FBQUcsUUFBRSxJQUFFLENBQUMsSUFBSTtBQUNwRSxXQUFLLEtBQUssSUFBSSxJQUFFLENBQUMsSUFBSSxXQUFXLEtBQUssV0FBVztBQUFHLFFBQUUsSUFBRSxDQUFDLElBQUksS0FBSztBQUNqRSxXQUFLLE1BQU0sSUFBSTtBQUFBLElBQ2pCO0FBQUEsSUFDQSxXQUFXLElBQUksSUFBSSxHQUFHO0FBQ3BCLFVBQUksQ0FBQyxLQUFLLE1BQU07QUFBRSxhQUFLLE1BQU0sS0FBSyxFQUFFLE1BQU0sY0FBYyxJQUFJLElBQUksR0FBRyxPQUFPLFlBQVksS0FBSyxTQUFTLEVBQUUsQ0FBQztBQUFHO0FBQUEsTUFBUTtBQUNsSCxXQUFLLFFBQVEsQ0FBQztBQUNkLFlBQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUs7QUFDbEMsUUFBRSxDQUFDLElBQUk7QUFBZ0IsUUFBRSxJQUFFLENBQUMsSUFBSTtBQUFJLFFBQUUsSUFBRSxDQUFDLElBQUk7QUFBSSxRQUFFLElBQUUsQ0FBQyxJQUFJO0FBQzFELFdBQUssS0FBSyxJQUFJLElBQUUsQ0FBQyxJQUFJLFdBQVcsS0FBSyxTQUFTO0FBQzlDLFdBQUssTUFBTSxJQUFJO0FBQUEsSUFDakI7QUFBQSxJQUNBLGFBQWEsSUFBSSxJQUFJLEdBQUc7QUFDdEIsVUFBSSxDQUFDLEtBQUssTUFBTTtBQUFFLGFBQUssTUFBTSxLQUFLLEVBQUUsTUFBTSxnQkFBZ0IsSUFBSSxJQUFJLEdBQUcsT0FBTyxZQUFZLEtBQUssV0FBVyxHQUFHLFdBQVcsS0FBSyxVQUFVLENBQUM7QUFBRztBQUFBLE1BQVE7QUFDakosV0FBSyxRQUFRLENBQUM7QUFDZCxZQUFNLElBQUksS0FBSyxLQUFLLEtBQUssSUFBSSxLQUFLO0FBQ2xDLFFBQUUsQ0FBQyxJQUFJO0FBQWtCLFFBQUUsSUFBRSxDQUFDLElBQUk7QUFBSSxRQUFFLElBQUUsQ0FBQyxJQUFJO0FBQUksUUFBRSxJQUFFLENBQUMsSUFBSTtBQUM1RCxXQUFLLEtBQUssSUFBSSxJQUFFLENBQUMsSUFBSSxXQUFXLEtBQUssV0FBVztBQUFHLFFBQUUsSUFBRSxDQUFDLElBQUksS0FBSztBQUNqRSxXQUFLLE1BQU0sSUFBSTtBQUFBLElBQ2pCO0FBQUEsSUFDQSxXQUFXLElBQUksSUFBSSxJQUFJLElBQUk7QUFDekIsVUFBSSxDQUFDLEtBQUssTUFBTTtBQUFFLGFBQUssTUFBTSxLQUFLLEVBQUUsTUFBTSxjQUFjLElBQUksSUFBSSxJQUFJLElBQUksT0FBTyxZQUFZLEtBQUssV0FBVyxHQUFHLFdBQVcsS0FBSyxVQUFVLENBQUM7QUFBRztBQUFBLE1BQVE7QUFDcEosV0FBSyxRQUFRLENBQUM7QUFDZCxZQUFNLElBQUksS0FBSyxLQUFLLEtBQUssSUFBSSxLQUFLO0FBQ2xDLFFBQUUsQ0FBQyxJQUFJO0FBQWdCLFFBQUUsSUFBRSxDQUFDLElBQUk7QUFBSSxRQUFFLElBQUUsQ0FBQyxJQUFJO0FBQUksUUFBRSxJQUFFLENBQUMsSUFBSTtBQUFJLFFBQUUsSUFBRSxDQUFDLElBQUk7QUFDdkUsV0FBSyxLQUFLLElBQUksSUFBRSxDQUFDLElBQUksV0FBVyxLQUFLLFdBQVc7QUFBRyxRQUFFLElBQUUsQ0FBQyxJQUFJLEtBQUs7QUFDakUsV0FBSyxNQUFNLElBQUk7QUFBQSxJQUNqQjtBQUFBLElBQ0EsU0FBUyxNQUFNLEdBQUcsR0FBRyxXQUFXLElBQUk7QUFDbEMsVUFBSSxDQUFDLEtBQUssTUFBTTtBQUFFLGFBQUssTUFBTSxLQUFLLEVBQUUsTUFBTSxZQUFZLE1BQU0sT0FBTyxJQUFJLEdBQUcsR0FBRyxHQUFHLFVBQVUsT0FBTyxZQUFZLEtBQUssU0FBUyxFQUFFLENBQUM7QUFBRztBQUFBLE1BQVE7QUFDekksWUFBTSxJQUFJLEtBQUssTUFBTSxJQUFJLE9BQU8sSUFBSTtBQUdwQyxVQUFJLEtBQUssTUFBTSxJQUFJLEVBQUUsT0FBTyxLQUFLLE1BQU0sRUFBRSxTQUFTLElBQUksRUFBRSxPQUFRLE1BQUssWUFBWTtBQUNqRixZQUFNLE1BQU0sS0FBSztBQUNqQixVQUFJLE1BQU07QUFDVixVQUFJLEVBQUUsS0FBSztBQUFFLGNBQU8sRUFBRSxJQUFJLFdBQVcsR0FBRyxFQUFFLElBQUksU0FBUyxLQUFLLEdBQUcsQ0FBQyxFQUFFLFVBQVc7QUFBQSxNQUFHO0FBQ2hGLFdBQUssT0FBTztBQUNaLFlBQU0sSUFBSSxFQUFFLEtBQUssSUFBSSxLQUFLO0FBQzFCLFFBQUUsQ0FBQyxJQUFJO0FBQWMsUUFBRSxJQUFFLENBQUMsSUFBSTtBQUFHLFFBQUUsSUFBRSxDQUFDLElBQUk7QUFBRyxRQUFFLElBQUUsQ0FBQyxJQUFJO0FBQ3RELFFBQUUsSUFBSSxJQUFFLENBQUMsSUFBSSxXQUFXLEtBQUssU0FBUztBQUFHLFFBQUUsSUFBRSxDQUFDLElBQUk7QUFBSyxRQUFFLElBQUUsQ0FBQyxJQUFJO0FBQ2hFLFdBQUssTUFBTSxJQUFJO0FBQUEsSUFDakI7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU1BLFlBQVk7QUFBRSxXQUFLLE1BQU0sU0FBUztBQUFHLFdBQUssY0FBYztBQUFBLElBQU87QUFBQSxJQUMvRCxPQUFPLEdBQUcsR0FBRztBQUFFLFdBQUssTUFBTSxLQUFLLEdBQUcsQ0FBQztBQUFBLElBQUc7QUFBQSxJQUN0QyxPQUFPLEdBQUcsR0FBRztBQUFFLFdBQUssTUFBTSxLQUFLLEdBQUcsQ0FBQztBQUFBLElBQUc7QUFBQSxJQUN0QyxZQUFZO0FBQUUsV0FBSyxjQUFjO0FBQUEsSUFBTTtBQUFBO0FBQUEsSUFHdkMsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxPQUFPO0FBQ2xDLFVBQUksUUFBUSxJQUFJLE1BQU07QUFDdEIsVUFBSSxPQUFPLE1BQU0sTUFBTyxRQUFPLEtBQUssS0FBSztBQUN6QyxVQUFJLENBQUMsT0FBTyxNQUFNLE1BQU8sUUFBTyxLQUFLLEtBQUs7QUFDMUMsWUFBTSxRQUFRLEtBQUssSUFBSSxNQUFNLEtBQUs7QUFDbEMsWUFBTSxPQUFRLEtBQUssSUFBSSxHQUFHLEtBQUssS0FBSyxTQUFTLEtBQUssS0FBSyxHQUFHLENBQUM7QUFDM0QsZUFBUyxJQUFJLEdBQUcsS0FBSyxNQUFNLEtBQUs7QUFDOUIsY0FBTSxJQUFJLFNBQVMsTUFBTSxVQUFVLElBQUk7QUFDdkMsYUFBSyxNQUFNLEtBQUssS0FBSyxLQUFLLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUM7QUFBQSxNQUM1RDtBQUFBLElBQ0Y7QUFBQSxJQUVBLGlCQUFpQixLQUFLLEtBQUssR0FBRyxHQUFHO0FBQy9CLFlBQU0sSUFBSSxLQUFLLE1BQU07QUFDckIsWUFBTSxLQUFLLEtBQUssSUFBSSxLQUFLLE1BQU0sSUFBSSxDQUFDLElBQUk7QUFDeEMsWUFBTSxLQUFLLEtBQUssSUFBSSxLQUFLLE1BQU0sSUFBSSxDQUFDLElBQUk7QUFDeEMsWUFBTSxPQUFPO0FBQ2IsZUFBUyxJQUFJLEdBQUcsS0FBSyxNQUFNLEtBQUs7QUFDOUIsY0FBTSxJQUFJLElBQUksTUFBTSxLQUFLLElBQUk7QUFDN0IsYUFBSyxNQUFNO0FBQUEsVUFBSyxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUssSUFBSSxNQUFNLElBQUksSUFBSTtBQUFBLFVBQzFDLEtBQUssS0FBSyxLQUFLLElBQUksS0FBSyxJQUFJLE1BQU0sSUFBSSxJQUFJO0FBQUEsUUFBQztBQUFBLE1BQzdEO0FBQUEsSUFDRjtBQUFBLElBRUEsY0FBYyxLQUFLLEtBQUssS0FBSyxLQUFLLEdBQUcsR0FBRztBQUN0QyxZQUFNLElBQUksS0FBSyxNQUFNO0FBQ3JCLFlBQU0sS0FBSyxLQUFLLElBQUksS0FBSyxNQUFNLElBQUksQ0FBQyxJQUFJO0FBQ3hDLFlBQU0sS0FBSyxLQUFLLElBQUksS0FBSyxNQUFNLElBQUksQ0FBQyxJQUFJO0FBQ3hDLFlBQU0sT0FBTztBQUNiLGVBQVMsSUFBSSxHQUFHLEtBQUssTUFBTSxLQUFLO0FBQzlCLGNBQU0sSUFBSSxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQzdCLGNBQU0sSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxLQUFLLEdBQUcsSUFBSSxJQUFJLEtBQUssSUFBSSxHQUFHLElBQUksSUFBSSxJQUFJO0FBQzdFLGFBQUssTUFBTTtBQUFBLFVBQUssSUFBSSxLQUFLLElBQUksTUFBTSxJQUFJLE1BQU0sSUFBSTtBQUFBLFVBQ2pDLElBQUksS0FBSyxJQUFJLE1BQU0sSUFBSSxNQUFNLElBQUk7QUFBQSxRQUFDO0FBQUEsTUFDcEQ7QUFBQSxJQUNGO0FBQUE7QUFBQSxJQUdBLE9BQU87QUFDTCxVQUFJLEtBQUssTUFBTSxTQUFTLEVBQUc7QUFDM0IsVUFBSSxLQUFLLE1BQU07QUFDYixjQUFNLFFBQVEsS0FBSyxNQUFNLFVBQVU7QUFDbkMsY0FBTSxRQUFRLElBQUksS0FBSyxNQUFNO0FBQzdCLFlBQUksUUFBUSxLQUFLLEtBQUssSUFBSztBQUMzQixZQUFJLEtBQUssTUFBTSxRQUFRLEtBQUssS0FBSyxJQUFLLE1BQUssWUFBWTtBQUN2RCxjQUFNLElBQUksS0FBSyxLQUFLLEtBQUssSUFBSSxLQUFLO0FBQ2xDLFVBQUUsQ0FBQyxJQUFJO0FBQWMsVUFBRSxJQUFJLENBQUMsSUFBSTtBQUNoQyxhQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxXQUFXLEtBQUssU0FBUztBQUNoRCxjQUFNLElBQUksSUFBSTtBQUNkLGlCQUFTLElBQUksR0FBRyxJQUFJLEtBQUssTUFBTSxRQUFRLElBQUssR0FBRSxJQUFJLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQztBQUNuRSxhQUFLLE1BQU0sSUFBSSxLQUFLLE1BQU07QUFBQSxNQUM1QixPQUFPO0FBQ0wsYUFBSyxNQUFNLEtBQUssRUFBRSxNQUFNLFlBQVksUUFBUSxLQUFLLE1BQU0sTUFBTSxHQUFHLE9BQU8sWUFBWSxLQUFLLFNBQVMsRUFBRSxDQUFDO0FBQUEsTUFDdEc7QUFBQSxJQUNGO0FBQUE7QUFBQSxJQUdBLFNBQVM7QUFDUCxVQUFJLEtBQUssTUFBTSxTQUFTLEVBQUc7QUFDM0IsVUFBSSxLQUFLLE1BQU07QUFDYixjQUFNLFFBQVEsS0FBSyxNQUFNLFVBQVU7QUFDbkMsY0FBTSxRQUFRLElBQUksS0FBSyxNQUFNO0FBQzdCLFlBQUksUUFBUSxLQUFLLEtBQUssSUFBSztBQUMzQixZQUFJLEtBQUssTUFBTSxRQUFRLEtBQUssS0FBSyxJQUFLLE1BQUssWUFBWTtBQUN2RCxjQUFNLElBQUksS0FBSyxLQUFLLEtBQUssSUFBSSxLQUFLO0FBQ2xDLFVBQUUsQ0FBQyxJQUFJO0FBQWdCLFVBQUUsSUFBSSxDQUFDLElBQUk7QUFDbEMsYUFBSyxLQUFLLElBQUksSUFBSSxDQUFDLElBQUksV0FBVyxLQUFLLFdBQVc7QUFDbEQsVUFBRSxJQUFJLENBQUMsSUFBSSxLQUFLO0FBQVcsVUFBRSxJQUFJLENBQUMsSUFBSSxLQUFLLGNBQWMsSUFBSTtBQUM3RCxjQUFNLElBQUksSUFBSTtBQUNkLGlCQUFTLElBQUksR0FBRyxJQUFJLEtBQUssTUFBTSxRQUFRLElBQUssR0FBRSxJQUFJLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQztBQUNuRSxhQUFLLE1BQU0sSUFBSSxLQUFLLE1BQU07QUFBQSxNQUM1QixPQUFPO0FBQ0wsYUFBSyxNQUFNLEtBQUs7QUFBQSxVQUFFLE1BQU07QUFBQSxVQUFjLFFBQVEsS0FBSyxNQUFNLE1BQU07QUFBQSxVQUM3QyxPQUFPLFlBQVksS0FBSyxXQUFXO0FBQUEsVUFBRyxXQUFXLEtBQUs7QUFBQSxVQUFXLFFBQVEsS0FBSztBQUFBLFFBQVksQ0FBQztBQUFBLE1BQy9HO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFHQSxRQUFRO0FBQ04sVUFBSSxLQUFLLE1BQU07QUFDYixhQUFLLFlBQVk7QUFDakIsYUFBSyxjQUFjO0FBQ25CO0FBQUEsTUFDRjtBQUdBLFVBQUksT0FBTyx5QkFBeUIsYUFBYTtBQUFFLGFBQUssTUFBTSxTQUFTO0FBQUc7QUFBQSxNQUFRO0FBQ2xGLFVBQUk7QUFDRiw2QkFBcUIsS0FBSyxLQUFLLEtBQUssVUFBVSxLQUFLLEtBQUssQ0FBQztBQUFBLE1BQzNELFNBQVMsR0FBRztBQUNWLG1CQUFXLDJCQUEyQixDQUFDO0FBQUEsTUFDekM7QUFDQSxXQUFLLE1BQU0sU0FBUztBQUFBLElBQ3RCO0FBQUEsRUFDRjtBQU9PLE1BQU0sU0FBUyxjQUFBQyxRQUFNLFdBQVcsU0FBU0MsUUFBTyxFQUFFLE9BQU8sR0FBRyxNQUFNLEdBQUcsS0FBSztBQUMvRSxVQUFNLGFBQVcsc0JBQU8sSUFBSTtBQUM1QixVQUFNLGVBQVcsc0JBQU8sSUFBSTtBQUU1QixVQUFNLGNBQVUsMkJBQVksQ0FBQyxPQUFPO0FBQ2xDLGVBQVMsVUFBVTtBQUNuQixZQUFNLE1BQU0sSUFBSSxrQkFBa0IsRUFBRTtBQUNwQyxhQUFPLFVBQVU7QUFDakIsVUFBSSxLQUFLO0FBQ1AsWUFBSSxPQUFPLFFBQVEsV0FBWSxLQUFJLEdBQUc7QUFBQSxZQUNqQyxLQUFJLFVBQVU7QUFBQSxNQUNyQjtBQUFBLElBQ0YsR0FBRyxDQUFDLEdBQUcsQ0FBQztBQUVSLFdBQU8sY0FBQUQsUUFBTSxjQUFjLFVBQVU7QUFBQSxNQUNuQyxjQUFjO0FBQUEsTUFDZDtBQUFBLE1BQ0EsR0FBRztBQUFBLElBQ0wsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQXFDRCxNQUFNLHNCQUFOLE1BQTBCO0FBQUEsSUFDeEIsWUFBWSxVQUFVO0FBQ3BCLFdBQUssTUFBTTtBQUFBLElBQ2I7QUFBQSxJQUVBLFlBQVksT0FBTztBQUNqQixVQUFJLE9BQU8sMkJBQTJCLFlBQWE7QUFDbkQsVUFBSTtBQUNGLCtCQUF1QixLQUFLLEtBQUssS0FBSyxVQUFVLEtBQUssQ0FBQztBQUFBLE1BQ3hELFNBQVMsR0FBRztBQUNWLG1CQUFXLG1DQUFtQyxDQUFDO0FBQUEsTUFDakQ7QUFBQSxJQUNGO0FBQUEsSUFFQSxTQUFTLE1BQU07QUFDYixVQUFJLE9BQU8sOEJBQThCLFlBQWE7QUFDdEQsVUFBSTtBQUNGLGtDQUEwQixLQUFLLEtBQUssSUFBSTtBQUFBLE1BQzFDLFNBQVMsR0FBRztBQUNWLG1CQUFXLGdDQUFnQyxDQUFDO0FBQUEsTUFDOUM7QUFBQSxJQUNGO0FBQUEsSUFFQSxXQUFXLE1BQU07QUFDZixVQUFJLE9BQU8sZ0NBQWdDLFlBQWE7QUFDeEQsa0NBQTRCLElBQUk7QUFBQSxJQUNsQztBQUFBLEVBQ0Y7QUFPTyxNQUFNLFdBQVcsY0FBQUEsUUFBTSxXQUFXLFNBQVNFLFVBQVMsRUFBRSxPQUFPLEdBQUcsTUFBTSxHQUFHLEtBQUs7QUFDbkYsVUFBTSxjQUFVLDJCQUFZLENBQUMsT0FBTztBQUNsQyxZQUFNLE1BQU0sSUFBSSxvQkFBb0IsRUFBRTtBQUN0QyxVQUFJLEtBQUs7QUFDUCxZQUFJLE9BQU8sUUFBUSxXQUFZLEtBQUksR0FBRztBQUFBLFlBQ2pDLEtBQUksVUFBVTtBQUFBLE1BQ3JCO0FBQUEsSUFDRixHQUFHLENBQUMsR0FBRyxDQUFDO0FBRVIsV0FBTyxjQUFBRixRQUFNLGNBQWMsWUFBWTtBQUFBLE1BQ3JDLGNBQWM7QUFBQSxNQUNkO0FBQUEsTUFDQSxHQUFHO0FBQUEsSUFDTCxDQUFDO0FBQUEsRUFDSCxDQUFDOzs7QUN4WkQsTUFBQUcsZ0JBQW1EO0FBaUI1QyxNQUFNLFNBQVMsY0FBQUMsUUFBTSxXQUFXLFNBQVNDLFFBQU8sRUFBRSxRQUFRLE9BQU8sR0FBRyxLQUFLLEdBQUcsS0FBSztBQUN0RixVQUFNLENBQUMsY0FBYyxlQUFlLElBQUksY0FBQUQsUUFBTSxTQUFTLElBQUk7QUFJM0Qsa0JBQUFBLFFBQU0sVUFBVSxNQUFNO0FBQ3BCLGFBQU8sTUFBTTtBQUNYLFlBQUksaUJBQWlCLE1BQU07QUFDekIsOEJBQW9CLE9BQU8sWUFBWSxDQUFDO0FBQUEsUUFDMUM7QUFBQSxNQUNGO0FBQUEsSUFDRixHQUFHLENBQUMsWUFBWSxDQUFDO0FBRWpCLGtCQUFBQSxRQUFNLG9CQUFvQixLQUFLLE9BQU87QUFBQTtBQUFBLE1BRXBDLElBQUksU0FBUztBQUFFLGVBQU87QUFBQSxNQUFjO0FBQUEsTUFFcEMsTUFBTSxNQUFNLGNBQWMsR0FBRztBQUMzQixjQUFNLFNBQVMsU0FBUyxNQUFNLG1CQUFtQixXQUFXLENBQUM7QUFDN0Qsd0JBQWdCLE1BQU07QUFDdEIsZUFBTztBQUFBLE1BQ1Q7QUFBQSxNQUNBLE9BQU87QUFDTCxZQUFJLGlCQUFpQixNQUFNO0FBQ3pCLDhCQUFvQixPQUFPLFlBQVksQ0FBQztBQUN4QywwQkFBZ0IsSUFBSTtBQUFBLFFBQ3RCO0FBQUEsTUFDRjtBQUFBO0FBQUEsTUFFQSxNQUFNLFVBQVU7QUFDZCxZQUFJLGlCQUFpQixLQUFNLE9BQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUM1RCxlQUFPLHNCQUFzQixPQUFPLFlBQVksQ0FBQztBQUFBLE1BQ25EO0FBQUE7QUFBQSxNQUVBLFlBQVksWUFBWTtBQUN0QixZQUFJLGlCQUFpQixLQUFNLE9BQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUM1RCxtQ0FBMkIsT0FBTyxZQUFZLEdBQUcsVUFBVTtBQUFBLE1BQzdEO0FBQUE7QUFBQSxNQUVBLE1BQU0sYUFBYTtBQUNqQixZQUFJLGlCQUFpQixLQUFNLE9BQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUM1RCxlQUFPLDBCQUEwQixPQUFPLFlBQVksQ0FBQztBQUFBLE1BQ3ZEO0FBQUEsSUFDRixJQUFJLENBQUMsWUFBWSxDQUFDO0FBRWxCLFdBQU8sY0FBQUEsUUFBTSxjQUFjLFVBQVU7QUFBQSxNQUNuQztBQUFBLE1BQ0EsUUFBUSxXQUFXO0FBQUEsTUFDbkI7QUFBQSxNQUNBLEdBQUc7QUFBQSxJQUNMLENBQUM7QUFBQSxFQUNILENBQUM7QUFnQk0sTUFBTSxRQUFRLGNBQUFBLFFBQU0sV0FBVyxTQUFTRSxPQUM3QyxFQUFFLEtBQUssV0FBVyxNQUFNLE9BQU8sT0FBTyxTQUFTLFlBQVksY0FBYyxTQUFTLE9BQU8sR0FBRyxLQUFLLEdBQ2pHLEtBQ0E7QUFDQSxVQUFNLENBQUMsYUFBYSxjQUFjLElBQUksY0FBQUYsUUFBTSxTQUFTLElBQUk7QUFFekQsVUFBTSxpQkFBaUIsY0FBQUEsUUFBTSxPQUFPLENBQUM7QUFDckMsVUFBTSxjQUFpQixjQUFBQSxRQUFNLE9BQU8sRUFBRTtBQUV0QyxrQkFBQUEsUUFBTSxVQUFVLE1BQU07QUFDcEIsVUFBSSxDQUFDLElBQUs7QUFDVixVQUFJLFNBQVM7QUFDYixVQUFJLFlBQVk7QUFDaEIscUJBQWUsVUFBVTtBQUN6QixrQkFBWSxVQUFhO0FBQ3pCLFlBQU0sS0FBSyxLQUFLO0FBQUEsUUFDZCxTQUFTLE9BQU8sTUFBTTtBQUFFLGNBQUksV0FBVyxLQUFNLE9BQU0sS0FBSyxRQUFRLENBQUM7QUFBQSxRQUFHLElBQUk7QUFBQSxRQUN4RSxZQUFZLENBQUMsTUFBTTtBQUNqQixzQkFBWSxVQUFVLEVBQUUsZ0JBQWdCO0FBQ3hDLGNBQUksV0FBWSxZQUFXLENBQUM7QUFBQSxRQUM5QjtBQUFBLFFBQ0EsY0FBYyxDQUFDLE1BQU07QUFDbkIseUJBQWUsVUFBVTtBQUN6QixjQUFJLGFBQWMsY0FBYSxDQUFDO0FBQUEsUUFDbEM7QUFBQSxRQUNBO0FBQUEsTUFDRixDQUFDLEVBQUUsS0FBSyxPQUFLO0FBQ1gsWUFBSSxXQUFXO0FBQUUsZ0JBQU0sTUFBTSxDQUFDO0FBQUc7QUFBQSxRQUFRO0FBQ3pDLGlCQUFTO0FBQ1QsdUJBQWUsQ0FBQztBQUFBLE1BQ2xCLENBQUMsRUFBRSxNQUFNLE9BQUs7QUFDWixZQUFJLFFBQVMsU0FBUSxhQUFhLFFBQVEsRUFBRSxVQUFVLE9BQU8sQ0FBQyxDQUFDO0FBQUEsTUFDakUsQ0FBQztBQUNELGFBQU8sTUFBTTtBQUNYLG9CQUFZO0FBQ1osWUFBSSxXQUFXLE1BQU07QUFDbkIsZ0JBQU0sTUFBTSxNQUFNO0FBQ2xCLG1CQUFTO0FBQ1QseUJBQWUsSUFBSTtBQUFBLFFBQ3JCO0FBQUEsTUFDRjtBQUFBLElBQ0YsR0FBRyxDQUFDLEdBQUcsQ0FBQztBQUVSLGtCQUFBQSxRQUFNLG9CQUFvQixLQUFLLE9BQU87QUFBQSxNQUNwQyxJQUFJLFNBQWM7QUFBRSxlQUFPO0FBQUEsTUFBYTtBQUFBLE1BQ3hDLElBQUksY0FBYztBQUFFLGVBQU8sZUFBZTtBQUFBLE1BQVM7QUFBQSxNQUNuRCxJQUFJLFdBQWM7QUFBRSxlQUFPLFlBQVk7QUFBQSxNQUFTO0FBQUEsTUFDaEQsS0FBSyxTQUFTO0FBQ1osWUFBSSxnQkFBZ0IsS0FBTSxPQUFNLEtBQUssYUFBYSxPQUFPO0FBQUEsTUFDM0Q7QUFBQSxNQUNBLFVBQVUsS0FBSztBQUNiLFlBQUksZ0JBQWdCLEtBQU0sT0FBTSxVQUFVLGFBQWEsR0FBRztBQUFBLE1BQzVEO0FBQUEsTUFDQSxRQUFRO0FBQ04sWUFBSSxnQkFBZ0IsS0FBTSxPQUFNLE1BQU0sV0FBVztBQUFBLE1BQ25EO0FBQUEsTUFDQSxPQUFPO0FBQ0wsWUFBSSxnQkFBZ0IsS0FBTSxPQUFNLEtBQUssV0FBVztBQUFBLE1BQ2xEO0FBQUEsTUFDQSxRQUFRO0FBQ04sWUFBSSxnQkFBZ0IsTUFBTTtBQUN4QixnQkFBTSxNQUFNLFdBQVc7QUFDdkIseUJBQWUsSUFBSTtBQUFBLFFBQ3JCO0FBQUEsTUFDRjtBQUFBLElBQ0YsSUFBSSxDQUFDLFdBQVcsQ0FBQztBQUVqQixXQUFPLGNBQUFBLFFBQU0sY0FBYyxTQUFTLEVBQUUsYUFBYSxPQUFPLEdBQUcsS0FBSyxDQUFDO0FBQUEsRUFDckUsQ0FBQzs7O0FSM0hELE1BQU0scUJBQWlCLHdCQUFBRyxTQUFXLGtCQUFVO0FBRTVDLE1BQU0sZ0JBQWdCLGVBQWU7QUFBQSxJQUNuQyxFQUFFLFlBQVksS0FBSztBQUFBLElBQ25CO0FBQUE7QUFBQSxJQUNBO0FBQUEsSUFBTTtBQUFBLElBQU87QUFBQSxJQUFNO0FBQUEsSUFDbkIsQ0FBQyxRQUFRLFdBQVcsZ0NBQWdDLElBQUksT0FBTztBQUFBLElBQy9EO0FBQUEsRUFDRjtBQU9BLGFBQVcsdUJBQXVCLFNBQVMsb0JBQW9CO0FBRzdELG1CQUFlLFVBQVUsTUFBTTtBQUU3QixpQkFBVyxtQkFBbUI7QUFDOUIsc0JBQWdCO0FBQ2hCLGVBQVM7QUFDVCxxQkFBZTtBQUNmLG9CQUFjO0FBQ2QsMkJBQXFCO0FBQ3JCLDBCQUFvQjtBQUNwQix3QkFBa0I7QUFDbEIsaUJBQVc7QUFDWCxpQkFBVztBQUNYLG1CQUFhO0FBQ2IscUJBQWU7QUFBQSxJQUNqQixDQUFDO0FBQUEsRUFDSDtBQUlPLFdBQVMsT0FBTyxTQUFTO0FBVTlCLG1CQUFlO0FBQUEsTUFDYixjQUFBQyxRQUFNO0FBQUEsUUFBYztBQUFBLFFBQU07QUFBQSxVQUN4QixPQUFPLEVBQUUsVUFBVSxZQUFZLGVBQWUsVUFBVSxVQUFVLEdBQUcsV0FBVyxVQUFVO0FBQUEsUUFDNUY7QUFBQSxRQUNFO0FBQUEsUUFDQSxjQUFBQSxRQUFNLGNBQWMsV0FBVztBQUFBLE1BQ2pDO0FBQUEsTUFDQTtBQUFBLE1BQWU7QUFBQSxNQUFNO0FBQUEsSUFDdkI7QUFBQSxFQUNGOzs7QUZsRkEsV0FBUyxNQUFNO0FBQ2IsV0FDRSw4QkFBQUMsUUFBQTtBQUFBLE1BQUM7QUFBQTtBQUFBLFFBQ0MsT0FBTztBQUFBLFVBQ0wsTUFBTTtBQUFBLFVBQ04sWUFBWTtBQUFBLFVBQ1osZ0JBQWdCO0FBQUEsVUFDaEIsaUJBQWlCO0FBQUEsUUFDbkI7QUFBQTtBQUFBLE1BRUEsOEJBQUFBLFFBQUEsY0FBQyxRQUFLLE9BQU8sRUFBRSxVQUFVLElBQUksWUFBWSxPQUFPLE9BQU8sVUFBVSxLQUFHLGVBRXBFO0FBQUEsSUFDRjtBQUFBLEVBRUo7QUFFQSxTQUFPLDhCQUFBQSxRQUFBLGNBQUMsU0FBSSxDQUFFOyIsCiAgIm5hbWVzIjogWyJhIiwgImIiLCAiZXhwb3J0cyIsICJhIiwgImIiLCAiYyIsICJkIiwgImYiLCAiZSIsICJnIiwgImgiLCAiayIsICJsIiwgIm0iLCAidyIsICJpbXBvcnRfcmVhY3QiLCAiaW1wb3J0X3JlYWN0IiwgIlJlYWN0IiwgIlJlYWN0IiwgIlJlYWN0IiwgImltcG9ydF9yZWFjdCIsICJSZWFjdCIsICJpbXBvcnRfcmVhY3QiLCAiUmVhY3QiLCAiUmVhY3QiLCAiaW1wb3J0X3JlYWN0IiwgIlJlYWN0IiwgIkNhbnZhcyIsICJDYW52YXMzRCIsICJpbXBvcnRfcmVhY3QiLCAiUmVhY3QiLCAiQ2FtZXJhIiwgIlZpZGVvIiwgIlJlY29uY2lsZXIiLCAiUmVhY3QiLCAiUmVhY3QiXQp9Cg==
