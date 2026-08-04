import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CourtLines } from './CourtMotif';
import { Logo } from './Logo';

// Shared two-panel layout for Login/Signup/Forgot Password - replaces the
// old plain centered-card-on-gray-background pattern (identical on every
// auth screen and indistinguishable from any generic SaaS template) with a
// branded navy/court-line panel alongside the form, collapsing to a single
// column on mobile.
export function AuthLayout({
  backTo,
  backLabel,
  tagline,
  children,
}: {
  backTo: string;
  backLabel: string;
  tagline: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-4.5rem)] grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-navy-900 text-white p-12">
        <CourtLines className="absolute -left-24 top-0 h-full w-[70%] text-white" strokeOpacity={0.12} />
        <Link to="/" className="relative z-10 inline-flex items-center bg-white rounded-xl px-3 py-2 w-fit">
          <Logo variant="lockup" className="h-7" />
        </Link>
        <p className="relative z-10 font-display text-3xl font-bold leading-snug max-w-sm">{tagline}</p>
        <p className="relative z-10 text-sm text-navy-300 leading-snug">
          Livingston, NJ
          <br />
          Community pilot
        </p>
      </div>

      <div className="flex items-center justify-center py-12 px-4 bg-gray-50">
        <div className="w-full max-w-md">
          <Link to={backTo} className="inline-flex items-center gap-2 text-secondary-600 hover:text-secondary-900 mb-8">
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
          <div className="card p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
