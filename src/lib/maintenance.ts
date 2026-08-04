// Maintenance-mode switch for CourtConnect. The maintenance page,
// MaintenanceGate wrapper, and the bypass mechanism below are all kept in
// the codebase permanently and reused whenever the site needs to go down
// again - only this flag controls whether they're active.
//
// ============================================================================
// To put CourtConnect back into maintenance mode, set MAINTENANCE_MODE_ENABLED
// to true and deploy. That is the only change required - nothing else in the
// app needs to be touched, and no env var needs to be set on any deploy target.
// ============================================================================
export const MAINTENANCE_MODE_ENABLED = false;

// Bypass query params (see MaintenanceGate.tsx):
//   ?cc_bypass=arkit-dev      sets a persistent local bypass
//   ?cc_clear_bypass=true     clears it
const BYPASS_TOKEN = 'arkit-dev';
const BYPASS_STORAGE_KEY = 'cc_maintenance_bypass';

export function hasStoredBypass(): boolean {
  try {
    return localStorage.getItem(BYPASS_STORAGE_KEY) === BYPASS_TOKEN;
  } catch {
    // Storage can throw in some locked-down/private-browsing contexts -
    // fail closed (no bypass) rather than crash the whole app over it.
    return false;
  }
}

// Reads and applies ?cc_bypass=<token> / ?cc_clear_bypass=true from the
// given search params, persists the result to localStorage, and returns
// the params with those two keys stripped so callers can clean the visible
// URL (the token shouldn't linger in the address bar / browser history /
// anything that gets shared).
export function applyBypassParams(params: URLSearchParams): { changed: boolean; bypassed: boolean } {
  let changed = false;

  if (params.get('cc_clear_bypass') === 'true') {
    try {
      localStorage.removeItem(BYPASS_STORAGE_KEY);
    } catch {
      // ignore
    }
    params.delete('cc_clear_bypass');
    changed = true;
  }

  const bypassValue = params.get('cc_bypass');
  if (bypassValue === BYPASS_TOKEN) {
    try {
      localStorage.setItem(BYPASS_STORAGE_KEY, BYPASS_TOKEN);
    } catch {
      // ignore
    }
    params.delete('cc_bypass');
    changed = true;
  } else if (bypassValue !== null) {
    // Wrong token - don't silently strip it without effect, but also
    // don't grant a bypass. Remove it from the URL either way so a wrong
    // guess doesn't sit in the address bar.
    params.delete('cc_bypass');
    changed = true;
  }

  return { changed, bypassed: hasStoredBypass() };
}
