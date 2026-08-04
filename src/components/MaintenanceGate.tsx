import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MAINTENANCE_MODE_ENABLED, applyBypassParams, hasStoredBypass } from '../lib/maintenance';
import { MaintenancePage } from './MaintenancePage';

// Wraps the whole app. Must render inside <Router> (needs the current
// location's query string) but outside anything that talks to
// Supabase/Auth, so a maintenance-gated visitor never triggers those
// calls at all.
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [bypassed, setBypassed] = useState<boolean>(() => hasStoredBypass());

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hadBypassParams = params.has('cc_bypass') || params.has('cc_clear_bypass');
    if (!hadBypassParams) return;

    const result = applyBypassParams(params);
    setBypassed(result.bypassed);

    if (result.changed) {
      // Strip the bypass params from the visible URL without adding a
      // new history entry - the token shouldn't linger in the address
      // bar, browser history, or anything a user might copy/share.
      const newSearch = params.toString();
      navigate(
        { pathname: location.pathname, search: newSearch ? `?${newSearch}` : '', hash: location.hash },
        { replace: true }
      );
    }
    // Only re-run when the query string actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  if (MAINTENANCE_MODE_ENABLED && !bypassed) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}
