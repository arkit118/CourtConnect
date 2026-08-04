import { Logo } from './brand/Logo';
import { CONTACT_EMAIL } from '../lib/legal';

// Shown to every visitor while MAINTENANCE_MODE_ENABLED is true and no
// local bypass is set (see lib/maintenance.ts / MaintenanceGate.tsx).
export function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-navy-900 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 78px, rgba(255,255,255,0.6) 78px, rgba(255,255,255,0.6) 80px), repeating-linear-gradient(90deg, transparent, transparent 78px, rgba(255,255,255,0.6) 78px, rgba(255,255,255,0.6) 80px)',
        }}
      />
      <div className="relative z-10 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center mb-8 bg-white rounded-2xl px-5 py-4 shadow-elevated">
          <Logo variant="lockup" className="h-8" />
        </div>
        <div className="w-16 h-16 rounded-2xl bg-primary-400/15 border border-primary-400/30 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl" aria-hidden="true">🎾</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3">
          We're restringing the racquets
        </h1>
        <p className="text-navy-100 leading-relaxed mb-8">
          CourtConnect is offline for a short while as we roll out improvements for the Livingston community.
          We'll be back shortly. Thanks for your patience.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-sm text-primary-300 hover:text-primary-200 underline underline-offset-2"
        >
          Questions? Contact {CONTACT_EMAIL}
        </a>
      </div>
    </div>
  );
}
