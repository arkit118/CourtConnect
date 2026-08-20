import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// Plain <a target="_blank"> can silently no-op inside the Capacitor iOS
// WebView (there's no browser chrome to open a new tab in). On native,
// route external links through an in-app SFSafariViewController instead
// so they never break out of - or get stuck inside - the app WebView. On
// web this is a no-op; the browser's own target="_blank" handling applies.
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function handleExternalLinkClick(url: string) {
  return (e: React.MouseEvent) => {
    if (Capacitor.isNativePlatform()) {
      e.preventDefault();
      void openExternalUrl(url);
    }
  };
}

// Supabase auth emails (signup confirmation, resend, password reset) need a
// real https:// URL to redirect back to. On native, window.location.origin
// is the Capacitor WebView's internal scheme (e.g. capacitor://localhost),
// which a link opened from the Mail app can't do anything with - so on
// native these must point at the deployed web app instead. The user
// finishes the email step there and signs back into the native app
// afterwards; true deep-linking back into the native app is tracked as a
// follow-up in docs/ios-app-store.md.
const PRODUCTION_WEB_ORIGIN = 'https://court-connect-three.vercel.app';

export function authRedirectOrigin(): string {
  return Capacitor.isNativePlatform() ? PRODUCTION_WEB_ORIGIN : window.location.origin;
}

// For same-app <Link target="_blank"> references (e.g. "Terms of Service"
// opened from the signup form so typed-in fields aren't lost). On web this
// opens a real new tab. On native there's no tab chrome to open one in, and
// Capacitor's WKWebView loads target="_blank" navigations in place against
// the local dist server, which 404s for any path but the one it booted
// from - so on native these links must fall through to React Router's
// normal in-app client-side navigation instead (target left unset).
export const inAppLinkTarget: '_blank' | undefined = Capacitor.isNativePlatform() ? undefined : '_blank';
