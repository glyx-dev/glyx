import * as React from 'react';

// ── Route entry stored in the history stack ───────────────────────────────────

export interface RouteEntry {
  name:   string;
  params: Record<string, unknown>;
}

// ── navigate() options ────────────────────────────────────────────────────────

export interface NavigateOptions {
  /** Replace the top of the history stack instead of pushing. */
  replace?: boolean;
}

// ── navigate() function type ──────────────────────────────────────────────────

export type NavigateFn = (
  /** Route name, or 'back' to pop the stack. */
  name:    string,
  params?: Record<string, unknown>,
  opts?:   NavigateOptions,
) => void;

// ── useRoute() return type ────────────────────────────────────────────────────

export interface UseRouteResult {
  /** Name of the currently active route. */
  name:      string | null;
  /** Params passed to navigate() when this route was pushed. */
  params:    Record<string, unknown>;
  /** True when there is a route below the current one to pop back to. */
  canGoBack: boolean;
}

// ── Component props ───────────────────────────────────────────────────────────

export interface RouterProps {
  children?:     React.ReactNode;
  /** Name of the first route to show. Defaults to the first declared Route. */
  initialRoute?: string;
}

export interface RouteProps {
  /** Unique name used by navigate(). */
  name:      string;
  /** Component to mount when this route is active. Receives no props. */
  component: React.ComponentType;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export declare function Router(props: RouterProps): React.ReactElement | null;
export declare function Route(props: RouteProps):   null;
export declare function useNavigate():              NavigateFn;
export declare function useRoute():                 UseRouteResult;
