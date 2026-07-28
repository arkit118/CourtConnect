import { ShieldAlert } from 'lucide-react';

export function SocialSafetyBanner() {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">
        Keep it safe. Meet at public courts, avoid sharing sensitive personal information, and do not arrange paid
        hitting or coaching through CourtConnect. If you are under 18, involve a parent or guardian.
      </p>
    </div>
  );
}
