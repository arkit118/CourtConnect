import { Link } from 'react-router-dom';
import { ShieldCheck, Users2, MessageCircleWarning } from 'lucide-react';
import { CONTACT_EMAIL } from '../../lib/legal';
import { PageHero } from '../../components/brand/PageHero';
import { CourtCorner } from '../../components/brand/CourtMotif';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        eyebrow="Livingston, NJ"
        title="About CourtConnect"
        description="A local tennis community pilot - not a business, not a club, not a booking platform."
      />

      <div className="container-custom max-w-3xl py-12 space-y-10">
        <section>
          <h2 className="font-display text-2xl font-bold text-secondary-900 mb-4">What it actually does</h2>
          <p className="text-secondary-700 leading-relaxed mb-4">
            CourtConnect is a local tennis community platform, currently piloting in Livingston. Create a profile
            and you can send and accept partner match requests, then chat with anyone you've matched with; browse
            and register for local events; coordinate court time with other members on the Schedule page; and buy,
            sell, or trade tennis gear locally. Players under 18 need a parent or guardian to approve matching and
            chat specifically - everything else is open right away.
          </p>
          <p className="text-secondary-700 leading-relaxed">
            We're starting small and deliberately: Livingston first, one real court location today. CourtConnect
            doesn't require a club membership, doesn't process payments of any kind, and doesn't track live court
            availability - gear exchanges and any event fees are handled directly between members.
          </p>
        </section>

        <section className="rounded-3xl bg-navy-900 text-white p-8">
          <h2 className="font-display text-2xl font-bold mb-6">How safety works here</h2>
          <div className="space-y-6">
            <SafetyPoint
              icon={ShieldCheck}
              title="Age-band separation is enforced in the database"
              description="Minors are only ever matched with other minors, adults only with adults - checked at the database level, not just the interface."
            />
            <SafetyPoint
              icon={Users2}
              title="Parent/guardian approval for minors"
              description="Players under 18 need a parent or guardian to approve partner matching and chat before either unlocks."
            />
            <SafetyPoint
              icon={MessageCircleWarning}
              title="Report and block, anytime"
              description="Every match, chat, and listing can be reported or blocked in one tap. See our Safety page for the full picture."
            />
          </div>
          <Link
            to="/safety"
            className="inline-block mt-6 text-sm font-semibold text-primary-300 hover:text-primary-200 underline underline-offset-2"
          >
            Read the full Safety page &rarr;
          </Link>
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-primary-600 text-white p-8 md:p-10">
          <CourtCorner className="absolute top-6 right-6 w-8 h-8 text-white/30" />
          <h2 className="font-display text-2xl font-bold mb-3">Join the pilot</h2>
          <p className="text-primary-100 mb-6 max-w-lg">
            Whether you're looking for a hitting partner, a community event, or just more time on the court,
            CourtConnect is built for Livingston players.
          </p>
          <Link to="/auth/signup" className="btn btn-lg bg-white text-primary-700 hover:bg-primary-50 font-semibold">
            Get Started Free
          </Link>
        </section>
      </div>
    </div>
  );
}

function SafetyPoint({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <Icon className="w-6 h-6 text-primary-300 shrink-0" strokeWidth={1.75} />
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-navy-100 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero title="Contact Us" description="Have a question or feedback? We'd love to hear from you." />
      <div className="container-custom max-w-xl py-12">
        <div className="rounded-3xl bg-white border border-secondary-200 p-8 text-center">
          <p className="text-secondary-600 mb-6">
            The best way to reach us right now is by email. Include your account email and as much detail as you
            can, and we'll get back to you.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="btn-primary">
            Email {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
}
