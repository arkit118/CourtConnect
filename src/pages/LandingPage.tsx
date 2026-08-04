/* IMPECCABLE DIRECTION CONTRACT
THESIS: CourtConnect reads as a real Livingston tennis program - court-line
  geometry, scoreboard-confident type, and committed navy/green fields -
  refusing the generic white-card-grid SaaS template the previous pass shipped.
OWN-WORLD: Full-bleed navy/deep-green section fields (not white cards on
  white), authored court-line SVG diagrams standing in for icon tiles and
  blurred gradient orbs, Bricolage Grotesque display type run large and
  confident, clay used only as a single accent stroke/underline. Asymmetric
  "match program" composition instead of uniform icon+heading+text grids.
STORY: A Livingston player lands, understands in one viewport that this is a
  real local tennis pilot (matching, events, court coordination, gear) built
  on one court location today, and has one clear next action.
FIRST VIEWPORT: Full-bleed navy hero, large court-line diagram bleeding off
  the right edge, display headline stating what CourtConnect is directly (no
  eyebrow pill), two CTAs (Join the beta / Find players).
FORM: Brief-pinned direction (user-supplied tennis moodboard + explicit
  palette/motif constraints) - overrides the concept-seed roll per
  new-work.md's "a user- or brief-pinned decision beats the roll, always."
FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and DESIGN.md */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Users2, MessageCircleWarning } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { withTimeout } from '../lib/withTimeout';
import { CourtLines, CourtCorner } from '../components/brand/CourtMotif';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <WhatItIsSection />
      <FlowSection />
      <EventsPreviewSection />
      <TrustSection />
      <CTASection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-navy-900">
      <CourtLines
        className="absolute -right-24 top-0 h-full w-[70%] text-white"
        strokeOpacity={0.16}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/95 to-navy-900/40" />

      <div className="relative z-10 container-custom py-20 md:py-28 lg:py-36">
        <div className="max-w-2xl">
          <p className="font-display text-sm font-bold tracking-[0.14em] text-primary-300 uppercase mb-5">
            Livingston, NJ &middot; Community pilot
          </p>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[1.03] tracking-tight mb-6">
            The local court for
            <span className="relative inline-block ml-3">
              Livingston tennis
              <svg
                viewBox="0 0 320 14"
                className="absolute left-0 -bottom-2 w-full h-3 text-clay-500"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M2 10.5C60 3 260 2 318 9" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
              </svg>
            </span>
            .
          </h1>
          <p className="text-lg sm:text-xl text-navy-100 leading-relaxed mb-10 max-w-xl">
            CourtConnect helps Livingston players find hitting partners, join community events, coordinate court
            time, and pass along gear &mdash; one local pilot, built for the community, not a business.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link to="/auth/signup" className="btn-primary btn-lg inline-flex items-center gap-2">
              Join the Beta
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/partners"
              className="btn-lg inline-flex items-center gap-2 bg-white/10 text-white hover:bg-white/20 border border-white/25 backdrop-blur-sm"
            >
              Find Players
            </Link>
          </div>

          <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 text-sm text-navy-200">
            <Link to="/events" className="hover:text-white transition-colors underline-offset-4 hover:underline">
              View events &rarr;
            </Link>
            <Link to="/schedule" className="hover:text-white transition-colors underline-offset-4 hover:underline">
              Coordinate court time &rarr;
            </Link>
            <Link to="/gear" className="hover:text-white transition-colors underline-offset-4 hover:underline">
              Browse the gear exchange &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// Deliberately not a 4-up icon+heading+text card grid - one featured block
// (Partner Matching, the product's actual core loop per the brief) plus a
// tighter cluster for the other three, so the page argues for what matters
// most instead of presenting four equal options.
function WhatItIsSection() {
  return (
    <section className="section bg-cream">
      <div className="container-custom">
        <div className="max-w-2xl mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary-900 mb-4">
            What CourtConnect actually is
          </h2>
          <p className="text-lg text-secondary-600 leading-relaxed">
            A Livingston tennis community pilot &mdash; not a booking platform, not a coaching marketplace. Four
            things it does, today, for local players.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <Link
            to="/partners"
            className="group lg:col-span-3 relative overflow-hidden rounded-3xl bg-navy-800 text-white p-8 md:p-10 flex flex-col justify-between min-h-[320px]"
          >
            <CourtLines className="absolute -right-10 -bottom-16 h-64 w-64 text-white" strokeOpacity={0.1} />
            <div className="relative z-10">
              <CourtCorner className="w-8 h-8 text-primary-300 mb-6" />
              <h3 className="font-display text-2xl md:text-3xl font-bold mb-3">Partner Matching</h3>
              <p className="text-navy-100 leading-relaxed max-w-md">
                The core of CourtConnect: get matched with players near your level, send a request, and chat once
                you're both in. Minors and adults are matched separately, and minors need parent/guardian approval
                before matching or chat unlock &mdash; enforced at the database level.
              </p>
            </div>
            <span className="relative z-10 mt-8 inline-flex items-center gap-2 font-semibold text-primary-300 group-hover:gap-3 transition-all">
              Find players <ArrowRight className="w-4 h-4" />
            </span>
          </Link>

          <div className="lg:col-span-2 grid sm:grid-cols-2 lg:grid-cols-1 gap-6">
            <FeatureTile
              to="/events"
              title="Community Events"
              description="Local shootouts and clinics, open to every skill level."
            />
            <FeatureTile
              to="/schedule"
              title="Court Coordination"
              description="Propose or claim court time with other members. Not an official reservation system."
              accent
            />
          </div>

          <div className="lg:col-span-5">
            <FeatureTile
              to="/gear"
              title="Gear Exchange"
              description="List, browse, and trade used tennis gear locally &mdash; no payments, no shipping. Just a local board for saying you're interested."
              wide
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureTile({
  to,
  title,
  description,
  accent = false,
  wide = false,
}: {
  to: string;
  title: string;
  description: string;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-3xl border p-6 flex flex-col justify-between transition-colors ${
        accent
          ? 'bg-clay-500 border-clay-600 text-white hover:bg-clay-600'
          : 'bg-white border-secondary-200 hover:border-primary-300'
      } ${wide ? 'sm:flex-row sm:items-center sm:gap-8' : 'min-h-[168px]'}`}
    >
      <div>
        <h3 className={`font-display text-xl font-bold mb-2 ${accent ? 'text-white' : 'text-secondary-900'}`}>
          {title}
        </h3>
        <p className={`text-sm leading-relaxed ${accent ? 'text-white/90' : 'text-secondary-600'} ${wide ? 'max-w-lg' : ''}`}>
          {description}
        </p>
      </div>
      <span
        className={`mt-4 sm:mt-0 shrink-0 inline-flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all ${
          accent ? 'text-white' : 'text-primary-600'
        }`}
      >
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}

// Replaces the old "01 / 02 / 03 / 04 How It Works" numbered grid with a
// scoreboard-style connected flow on a committed green field.
function FlowSection() {
  const steps = [
    { title: 'Create your profile', description: 'Skill level, availability, and what you\'re looking for.' },
    { title: 'Find your people', description: 'Match with players, register for events, or list your gear.' },
    { title: 'Play more tennis', description: 'Chat, coordinate court time, and build the Livingston community.' },
  ];

  return (
    <section className="section bg-primary-500 text-white relative overflow-hidden">
      <CourtLines className="absolute inset-0 w-full h-full text-white" strokeOpacity={0.06} />
      <div className="container-custom relative z-10">
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-14 max-w-xl">
          Getting on the court takes three steps.
        </h2>
        <div className="grid md:grid-cols-3 gap-x-8 gap-y-10">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-3 left-full w-8 h-px bg-white/30" />
              )}
              <div className="w-3 h-3 rounded-full bg-primary-200 mb-5" />
              <h3 className="font-display text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-primary-100 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EventsPreviewSection() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('events')
          .select('*')
          .eq('status', 'open')
          .order('date', { ascending: true })
          .limit(3),
        15000,
        'Loading upcoming events timed out'
      );

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section bg-cream">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary-900">Upcoming Events</h2>
          <Link to="/events" className="btn-outline shrink-0">
            View All Events
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-3xl bg-white border border-secondary-200 p-6 h-48 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl bg-white border border-secondary-200 p-12 text-center">
            <CourtCorner className="w-8 h-8 text-primary-400 mx-auto mb-4" />
            <h3 className="font-display text-lg font-bold text-secondary-900 mb-2">
              First Livingston event coming soon
            </h3>
            <p className="text-secondary-600">We're planning our inaugural event. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group rounded-3xl bg-white border border-secondary-200 hover:border-primary-300 p-6 flex flex-col transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold tracking-wide uppercase text-primary-600">
                    {event.date ? format(parseISO(event.date), 'MMM d, yyyy') : 'Date TBD'}
                  </span>
                  <CourtCorner className="w-5 h-5 text-secondary-300 group-hover:text-primary-400 transition-colors" />
                </div>
                <h3 className="font-display text-xl font-bold text-secondary-900 mb-2">{event.title}</h3>
                <p className="text-secondary-600 text-sm leading-relaxed mb-5 line-clamp-2 flex-1">
                  {event.description || 'Join us for this event!'}
                </p>
                <div className="flex items-center justify-between text-sm pt-4 border-t border-secondary-100">
                  <span className="font-semibold text-secondary-900">
                    {event.entry_fee === 0 ? 'Free' : `$${event.entry_fee}`}
                  </span>
                  <span className="text-secondary-500">
                    {event.capacity - (event.registration_count || 0)} spots left
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TrustSection() {
  const points = [
    {
      icon: ShieldCheck,
      title: 'Age-band safety, enforced in the database',
      description:
        'Minors are only ever matched with other minors, never adults - this is enforced at the database level, not just the interface.',
    },
    {
      icon: Users2,
      title: 'Parent/guardian approval for minors',
      description: 'Players under 18 need a parent or guardian to approve matching and chat before using either.',
    },
    {
      icon: MessageCircleWarning,
      title: 'Report and block, anytime',
      description: 'Every match and chat can be reported or blocked in one tap, immediately closing that match.',
    },
  ];

  return (
    <section className="section bg-navy-900 text-white">
      <div className="container-custom">
        <div className="max-w-xl mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Built for a trustworthy community</h2>
          <p className="text-lg text-navy-100 leading-relaxed">
            We're a new, local platform &mdash; here's exactly how matching and chat stay safe from day one.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-white/10 rounded-3xl overflow-hidden">
          {points.map((point) => {
            const Icon = point.icon;
            return (
              <div key={point.title} className="bg-navy-900 p-8">
                <Icon className="w-6 h-6 text-primary-300 mb-5" strokeWidth={1.75} />
                <h3 className="font-display font-bold text-lg mb-2">{point.title}</h3>
                <p className="text-navy-100 leading-relaxed text-sm">{point.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="section bg-cream">
      <div className="container-custom">
        <div className="relative overflow-hidden rounded-3xl bg-primary-600 p-10 md:p-16 text-white">
          <CourtLines className="absolute -left-16 -bottom-20 h-80 w-80 text-white" strokeOpacity={0.1} />
          <div className="relative z-10 max-w-xl">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-5">Ready to join the community?</h2>
            <p className="text-lg text-primary-100 mb-8 leading-relaxed">
              Create your free profile and start connecting with Livingston tennis players.
            </p>
            <Link to="/auth/signup" className="btn btn-lg bg-white text-primary-700 hover:bg-primary-50 font-semibold">
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
