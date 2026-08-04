import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Global scroll manager, mounted once inside the router above every page
// (see App.tsx's AppRoutes). React Router does not reset or manage scroll
// position on navigation on its own, so without this, links (footer,
// header, homepage CTAs, "View Events", etc.) would leave the user
// wherever they happened to be scrolled to on the previous page.
//
// Behavior:
// - No hash (e.g. "/events"): scroll to the top of the new page, instantly.
// - Hash present (e.g. "/about#mission"): scroll the matching element into
//   view instead of the top. The target element may not exist in the DOM
//   yet on the first render of a freshly-navigated page, so this retries
//   across a few animation frames rather than giving up after one attempt.
export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }

    const id = hash.slice(1);
    let attempts = 0;
    let frame: number;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        frame = requestAnimationFrame(tryScroll);
      }
    };

    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
    // `key` changes on every navigation (including re-clicking a link to
    // the same hash), so it's included to make that re-trigger the scroll.
  }, [pathname, hash, key]);

  return null;
}
