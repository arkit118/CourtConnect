import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from './useToast';
import { useLegalGateStore } from './useLegalGate';
import { hasAcceptedCurrentTerms, CONTACT_EMAIL } from '../lib/legal';

// Shared pre-flight check for any authenticated write action (creating a
// booking, gear listing, event registration, report, or profile edit):
// blocks banned users outright, and prompts existing users who haven't
// accepted the current Terms/Privacy version before letting them proceed.
export function useActionGate() {
  const { profile } = useAuth();
  const { addToast } = useToastStore();
  const requestLegalAcceptance = useLegalGateStore((s) => s.request);

  return async function canProceed(): Promise<boolean> {
    if (profile?.is_banned) {
      addToast({
        type: 'error',
        message: `Your account is restricted. Contact ${CONTACT_EMAIL} if you think this is a mistake.`,
      });
      return false;
    }

    if (!hasAcceptedCurrentTerms(profile)) {
      const accepted = await requestLegalAcceptance();
      if (!accepted) return false;
    }

    return true;
  };
}
