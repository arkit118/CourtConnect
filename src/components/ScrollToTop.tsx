import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Resets scroll position to the top on every route change (footer/header
// links, homepage CTAs, "View Events", etc. all navigate via react-router,
// which does not reset scroll on its own). Skips the reset when the URL has
// a hash (e.g. "/page#section") so a real same-page anchor link -- none
// exist today, but this keeps the component correct if one is ever added --
// still scrolls to that anchor instead of being yanked back to the top.
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    // html has `scroll-behavior: smooth` globally (index.css) - the two-arg
    // scrollTo(0, 0) form inherits that and animates, which both looks like
    // a slow drift on every route change instead of an instant relocation,
    // and (worse) can silently no-op if something interrupts the animation
    // before it completes. behavior: 'instant' bypasses the CSS setting.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}
