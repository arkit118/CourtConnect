import { Link } from 'react-router-dom';
import { AlertTriangle, MapPin, Users, Package, Flag, ShieldAlert } from 'lucide-react';
import { CONTACT_EMAIL } from '../../lib/legal';
import { ReportButton } from '../../components/ReportButton';

const EFFECTIVE_DATE = 'July 27, 2026';

function LegalSection({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-secondary-900 mb-3">
        {number}. {title}
      </h2>
      <div className="text-secondary-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="container-custom max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Terms of Service</h1>
        <p className="text-secondary-500 mb-8">Version v1 &middot; Effective Date: {EFFECTIVE_DATE}</p>

        <div className="card p-6 md:p-8">
          <LegalSection number={1} title="What CourtConnect Is">
            <p>
              CourtConnect is a local tennis community platform, starting in Livingston, NJ. It helps players find
              local tennis courts, view and register for events, coordinate community court time, and use gear
              exchange and related community features.
            </p>
          </LegalSection>

          <LegalSection number={2} title="Eligibility">
            <p>You must be at least 13 years old to create a CourtConnect account.</p>
            <p>If you are under 18, you should use CourtConnect with your parent or guardian's knowledge and permission.</p>
            <p>If you are under 13, you may not create an account or use CourtConnect.</p>
          </LegalSection>

          <LegalSection number={3} title="Accounts">
            <p>
              You are responsible for providing accurate account information and for keeping your account secure.
              You are responsible for activity that happens under your account.
            </p>
          </LegalSection>

          <LegalSection number={4} title="Community Conduct">
            <p>
              Be respectful, truthful, safe, and lawful. Do not harass, threaten, scam, spam, impersonate others, post
              inappropriate content, or behave unsafely toward other members.
            </p>
          </LegalSection>

          <LegalSection number={5} title="Court Scheduling Disclaimer">
            <p>CourtConnect does not officially reserve courts and does not control access to public, school, town, or private courts.</p>
            <p>The Schedule page is only for community coordination among players &mdash; it is not a reservation system.</p>
            <p>You must follow all town, school, park, facility, and posted court rules. Court availability is never guaranteed.</p>
          </LegalSection>

          <LegalSection number={6} title="No Paid Hitting / No Coaching Payments">
            <p>
              CourtConnect does not offer or facilitate paid hitting, paid lessons, paid coaching, or paid court
              services. Do not use CourtConnect to arrange paid hitting on courts where that is not allowed.
            </p>
          </LegalSection>

          <LegalSection number={7} title="Gear Exchange Disclaimer">
            <p>CourtConnect may provide local gear listing and exchange features. CourtConnect does not process gear payments and does not provide shipping.</p>
            <p>
              CourtConnect does not guarantee transactions, item quality, payment, delivery, refunds, or safety.
              Buyers and sellers coordinate local exchanges directly and at their own risk.
            </p>
            <p>Inspect items before paying and meet in public places.</p>
          </LegalSection>

          <LegalSection number={8} title="Events">
            <p>CourtConnect may list or organize community tennis events. Some external events may link to third-party registration platforms.</p>
            <p>CourtConnect does not claim UTR verification for events or players unless it has actually been verified.</p>
          </LegalSection>

          <LegalSection number={9} title="Safety">
            <p>Meet at public courts, in daylight when possible. Minors should involve a parent or guardian.</p>
            <p>Do not share sensitive personal information publicly. In an emergency, contact local emergency services directly &mdash; not CourtConnect.</p>
          </LegalSection>

          <LegalSection number={10} title="User Content">
            <p>
              You are responsible for information you post, including profiles, listings, bookings, event comments,
              or reports. CourtConnect may remove content that violates these rules or safety standards.
            </p>
          </LegalSection>

          <LegalSection number={11} title="Moderation">
            <p>CourtConnect may remove listings, bookings, content, or accounts that violate these rules, and may ban users for unsafe or abusive behavior.</p>
          </LegalSection>

          <LegalSection number={12} title="Third-Party Services">
            <p>Supabase, Vercel, and other services may power the app. External links are not fully controlled by CourtConnect.</p>
          </LegalSection>

          <LegalSection number={13} title="Disclaimers">
            <p>
              CourtConnect is provided "as-is." There is no guarantee that courts, events, listings, or users will be
              available, accurate, safe, or suitable for any particular purpose.
            </p>
          </LegalSection>

          <LegalSection number={14} title="Limitation of Liability">
            <p>
              To the fullest extent allowed by law, CourtConnect is not responsible for offline meetups, injuries,
              disputes between users, gear transactions, or third-party services arranged or coordinated through the
              platform.
            </p>
          </LegalSection>

          <LegalSection number={15} title="Changes">
            <p>CourtConnect may update these Terms. If major changes happen, you may be asked to accept the new version before continuing to use the app.</p>
          </LegalSection>

          <LegalSection number={16} title="Contact, Support, and Account Deletion">
            <p>
              Questions about these Terms, general support, or requests to delete your account? Email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </LegalSection>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="container-custom max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Privacy Policy</h1>
        <p className="text-secondary-500 mb-8">Version v1 &middot; Effective Date: {EFFECTIVE_DATE}</p>

        <div className="card p-6 md:p-8">
          <LegalSection number={1} title="Information We Collect">
            <p>We collect information such as:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Account information: name, email, and password, handled by Supabase Auth, plus profile details</li>
              <li>Date of birth, used to confirm age eligibility</li>
              <li>Tennis profile information: skill level, town, availability, bio, and similar details</li>
              <li>Court bookings: player name, partner/opponent name, court, date/time, and notes</li>
              <li>Event registrations</li>
              <li>Gear listings and interest/contact information, if you use gear exchange</li>
              <li>Reports and safety submissions you file</li>
              <li>Basic technical information such as browser/device details, auth/session data, and hosting/backend logs</li>
            </ul>
          </LegalSection>

          <LegalSection number={2} title="How We Use Information">
            <ul className="list-disc list-inside space-y-1">
              <li>Provide accounts and authentication</li>
              <li>Show courts, events, schedule entries, and listings</li>
              <li>Prevent under-13 signup</li>
              <li>Improve safety and moderation</li>
              <li>Communicate with you about your account or support requests</li>
              <li>Maintain security and debug issues</li>
            </ul>
          </LegalSection>

          <LegalSection number={3} title="What Is Public or Visible">
            <ul className="list-disc list-inside space-y-1">
              <li>Court listings are public</li>
              <li>Community schedule entries may be visible to other users and visitors</li>
              <li>Event information may be public</li>
              <li>Profile information may be visible depending on which features you use</li>
              <li>Gear listings may be visible</li>
              <li>Reports you submit are not public</li>
            </ul>
          </LegalSection>

          <LegalSection number={4} title="Sharing">
            <p>CourtConnect does not sell your personal information.</p>
            <p>Data may be processed by service providers such as Supabase and Vercel to run the app.</p>
            <p>Information may be disclosed if required for safety, legal compliance, or abuse prevention.</p>
          </LegalSection>

          <LegalSection number={5} title="Children and Minors">
            <p>You must be at least 13 to use CourtConnect. We do not knowingly allow users under 13 to create accounts.</p>
            <p>Users under 18 should use the app with parent/guardian involvement. We do not currently offer a verified parental consent process.</p>
          </LegalSection>

          <LegalSection number={6} title="Data Security">
            <p>We use reasonable safeguards to protect your information, but no system is perfectly secure.</p>
          </LegalSection>

          <LegalSection number={7} title="Data Retention">
            <p>We keep data as long as needed for the app to function, and for safety, legal, or operational purposes.</p>
          </LegalSection>

          <LegalSection number={8} title="Account Deletion">
            <p>
              You can request account deletion by emailing{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </LegalSection>

          <LegalSection number={9} title="Updates">
            <p>This Privacy Policy may be updated from time to time.</p>
          </LegalSection>

          <LegalSection number={10} title="Contact and Support">
            <p>
              Questions about this Privacy Policy, general support, or account deletion requests? Email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </LegalSection>
        </div>
      </div>
    </div>
  );
}

export function SafetyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="container-custom max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Safety</h1>
        <p className="text-secondary-600 mb-8">Practical guidance for staying safe while using CourtConnect.</p>

        <div className="space-y-6">
          <div className="card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-lg font-bold text-secondary-900">Court Scheduling Safety</h2>
            </div>
            <ul className="list-disc list-inside space-y-1 text-secondary-600">
              <li>CourtConnect does not officially reserve courts</li>
              <li>Follow all local and facility rules</li>
              <li>Be respectful if courts are already full</li>
              <li>Do not monopolize public courts</li>
              <li>Keep slots reasonable &mdash; ideally no more than 2 hours</li>
            </ul>
          </div>

          <div className="card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-accent-600" />
              </div>
              <h2 className="text-lg font-bold text-secondary-900">Meeting People</h2>
            </div>
            <ul className="list-disc list-inside space-y-1 text-secondary-600">
              <li>Meet at public courts</li>
              <li>Prefer daylight and busy locations</li>
              <li>Tell someone where you are going</li>
              <li>Minors should involve a parent or guardian</li>
              <li>Leave if something feels unsafe</li>
            </ul>
          </div>

          <div className="card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-secondary-900">Gear Exchange Safety</h2>
            </div>
            <ul className="list-disc list-inside space-y-1 text-secondary-600">
              <li>CourtConnect does not process payments</li>
              <li>Inspect gear before paying</li>
              <li>Use safe, traceable payment methods</li>
              <li>Meet in public places</li>
              <li>Do not ship items or prepay unless you understand the risk</li>
            </ul>
          </div>

          <div className="card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-secondary-900">Personal Information</h2>
            </div>
            <ul className="list-disc list-inside space-y-1 text-secondary-600">
              <li>Do not post sensitive information publicly</li>
              <li>Be careful sharing your phone number, address, or social media</li>
              <li>Minors should not share personal contact information without parent/guardian approval</li>
            </ul>
          </div>

          <div className="card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-secondary-900">Reporting</h2>
            </div>
            <p className="text-secondary-600 mb-2">
              If you see unsafe content, a suspicious listing, or a concerning user or booking, use the "Report"
              action where it's available on the relevant page.
            </p>
            <p className="text-secondary-600 flex items-start gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>Emergency situations should be handled by calling local emergency services (911) directly &mdash; not through CourtConnect.</span>
            </p>
            <p className="text-secondary-600 mb-3">
              Have a general safety concern that isn't tied to a specific listing, booking, or profile? Report it directly:
            </p>
            <ReportButton
              reportType="general"
              label="Report a Safety Concern"
              className="btn-outline"
            />
          </div>

          <p className="text-sm text-secondary-500">
            See also our <Link to="/community-guidelines" className="text-primary-600 hover:underline">Community Guidelines</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CommunityGuidelinesPage() {
  const rules = [
    'Be respectful to other players and community members',
    'No harassment, threats, or discrimination',
    'No scams, fraud, or deceptive listings',
    'No inappropriate content or behavior',
    'No paid hitting, coaching, or lesson arrangements through CourtConnect',
    'No fake listings, bookings, or events',
    'Follow all posted court, facility, and town rules',
    'Report safety issues instead of handling them yourself',
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="container-custom max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Community Guidelines</h1>
        <p className="text-secondary-600 mb-8">
          Simple rules that keep CourtConnect useful and safe for the whole local tennis community.
        </p>

        <div className="card p-6 md:p-8">
          <ul className="space-y-4">
            {rules.map((rule) => (
              <li key={rule} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                  &#10003;
                </span>
                <span className="text-secondary-700">{rule}</span>
              </li>
            ))}
          </ul>

          <p className="text-sm text-secondary-500 mt-8 pt-6 border-t border-secondary-100">
            Read the full <Link to="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>,{' '}
            <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>, and{' '}
            <Link to="/safety" className="text-primary-600 hover:underline">Safety page</Link> for more detail.
          </p>
        </div>
      </div>
    </div>
  );
}
