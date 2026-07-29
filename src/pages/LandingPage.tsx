import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Package, MapPin, ArrowRight, Heart, MessageCircle } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { withTimeout } from '../lib/withTimeout';
import { LogoIcon } from '../components/brand/Logo';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ImpactSection />
      <EventsPreviewSection />
      <TrustSection />
      <CTASection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-primary-800">
      <div className="absolute inset-0 court-grid-bg-light" />
      <div className="absolute -top-24 -left-24 w-[36rem] h-[36rem] rounded-full bg-primary-400/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-16 w-[32rem] h-[32rem] rounded-full bg-navy-300/20 blur-3xl" />
      <LogoIcon className="absolute right-[6%] top-[18%] h-40 w-40 md:h-56 md:w-56 opacity-[0.07] rotate-12 hidden md:block" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-24">
        <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            <span className="text-sm font-medium text-white/90">Launching in Livingston, NJ</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-[1.05] tracking-tight text-balance">
            Your local tennis
            <span className="block mt-1 text-primary-300">community, connected</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/75 mb-10 max-w-2xl mx-auto leading-relaxed">
            Find courts, join events, coordinate court time, match with hitting partners, and exchange gear &mdash;
            all in one place. Starting in Livingston, with plans to grow across Essex County. No club membership
            required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/signup" className="btn-primary btn-lg inline-flex items-center gap-2">
              Join Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/events"
              className="btn-lg inline-flex items-center gap-2 bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur"
            >
              Browse Events
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: MapPin,
      title: 'Local Courts & Schedule',
      description: 'Discover courts near you and coordinate court time with the community. CourtConnect does not officially reserve courts.',
      color: 'primary',
    },
    {
      icon: Calendar,
      title: 'Community Events',
      description: 'Affordable shootout tournaments and clinics for all skill levels. Compete, improve, and connect.',
      color: 'navy',
    },
    {
      icon: Heart,
      title: 'Partner Matching',
      description: 'Get matched with players at your level, with age-band safety built in from the ground up. Never hit alone again.',
      color: 'primary',
    },
    {
      icon: Package,
      title: 'Gear Exchange',
      description: 'Buy, sell, or trade tennis equipment locally. Great deals, no shipping, no fees.',
      color: 'navy',
    },
  ];

  return (
    <section className="section bg-white">
      <div className="container-custom">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-4">
            Everything You Need to Play More Tennis
          </h2>
          <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
            CourtConnect brings together all the tools you need to find games, improve your skills, and connect with the local tennis community.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="card-hover p-6 group">
                <div className={`w-14 h-14 rounded-2xl ${feature.color === 'primary' ? 'bg-primary-50 text-primary-700' : 'bg-navy-50 text-navy-600'} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-3">{feature.title}</h3>
                <p className="text-secondary-600 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    { num: '01', title: 'Create Your Profile', description: 'Sign up and tell us about your game - skill level, availability, and favorite courts.' },
    { num: '02', title: 'Find Players & Events', description: 'Browse upcoming tournaments, search for hitting partners, or list your gear.' },
    { num: '03', title: 'Connect & Play', description: 'Register for events, send partner requests, and start playing more tennis.' },
    { num: '04', title: 'Grow Together', description: 'Build lasting connections, improve your game, and help the community thrive.' },
  ];

  return (
    <section className="section" style={{ backgroundColor: 'var(--cc-surface-cream)' }}>
      <div className="container-custom">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
            Getting started with CourtConnect is easy. Here's how to join the community.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              <div className="font-display text-6xl font-extrabold text-primary-100 mb-4">{step.num}</div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-3">{step.title}</h3>
              <p className="text-secondary-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ImpactSection() {
  const [metrics, setMetrics] = useState<{ value: string; label: string }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const { data } = await withTimeout(
        supabase.from('impact_metrics').select('*'),
        15000,
        'Loading impact metrics timed out'
      );
      if (data && data.length > 0) {
        const metricMap = data.reduce((acc, m) => {
          acc[m.metric_type] = m.value;
          return acc;
        }, {} as Record<string, number>);

        setMetrics([
          { value: `${metricMap.players || 0}`, label: 'Active Players' },
          { value: `${metricMap.events || 0}`, label: 'Events Hosted' },
          { value: `$${Math.round((metricMap.savings || 0) / 1000)}K+`, label: 'Player Savings' },
          { value: `${metricMap.gear_exchanges || 0}`, label: 'Gear Exchanges' },
        ]);
      } else {
        setMetrics(null);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section bg-gradient-to-br from-primary-600 to-primary-800 text-white">
      <div className="container-custom">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Building Community in Livingston
          </h2>
          <p className="text-lg text-primary-100 max-w-2xl mx-auto">
            CourtConnect is launching in Livingston with plans to expand across Essex County. Be part of our founding community.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center p-6 md:p-8 rounded-2xl bg-white/10 backdrop-blur border border-white/20">
                <div className="h-10 bg-white/20 rounded animate-pulse mb-2" />
                <div className="h-4 bg-white/20 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {metrics.map((metric, i) => (
              <div key={i} className="text-center p-6 md:p-8 rounded-2xl bg-white/10 backdrop-blur border border-white/20">
                <div className="text-4xl md:text-5xl font-extrabold mb-2">
                  {metric.value}
                </div>
                <div className="text-primary-100 font-medium">{metric.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/10 backdrop-blur border border-white/20">
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              <span className="text-lg font-medium">Pilot launching soon</span>
            </div>
            <p className="text-primary-100 mt-4">Be the first to join our Livingston community!</p>
          </div>
        )}
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

  const defaultImages = [
    'https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/247167/pexels-photo-247167.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/3133638/pexels-photo-3133638.jpeg?auto=compress&cs=tinysrgb&w=600',
  ];

  return (
    <section className="section bg-white">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">
              Upcoming Events
            </h2>
            <p className="text-lg text-secondary-600">
              Don't miss out on these exciting tournaments and clinics.
            </p>
          </div>
          <Link to="/events" className="btn-outline">
            View All Events
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card overflow-hidden">
                <div className="aspect-[16/10] bg-secondary-200 animate-pulse" />
                <div className="p-6">
                  <div className="h-4 bg-secondary-200 rounded w-1/3 mb-4 animate-pulse" />
                  <div className="h-6 bg-secondary-200 rounded w-full mb-4 animate-pulse" />
                  <div className="h-4 bg-secondary-200 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">First Livingston event coming soon</h3>
            <p className="text-secondary-600">We're planning our inaugural event. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, i) => (
              <Link key={event.id} to={`/events/${event.id}`}>
                <div className="card-hover group">
                  <div className="aspect-[16/10] overflow-hidden">
                    <img
                      src={event.image_url || defaultImages[i % 3]}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="badge-primary">Tournament</span>
                      <span className="text-sm text-secondary-500">
                        {event.date ? format(parseISO(event.date), 'MMM d, yyyy') : 'TBD'}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                      {event.title}
                    </h3>
                    <p className="text-secondary-600 text-sm mb-4 line-clamp-2">
                      {event.description || 'Join us for this exciting event!'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-primary-600 font-semibold">
                        {event.entry_fee === 0 ? 'Free' : `$${event.entry_fee}`} entry
                      </span>
                      <span className="text-sm text-secondary-500">
                        {event.capacity - (event.registration_count || 0)} spots left
                      </span>
                    </div>
                  </div>
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
      icon: Heart,
      title: 'Safety built into the platform',
      description: 'Partner matching keeps minors matched only with other minors, and adults only with other adults - enforced at the database level, not just in the app.',
    },
    {
      icon: Users,
      title: 'Parent/guardian approval for minors',
      description: 'Players under 18 need a parent or guardian to approve matching and chat before they can use those features at all.',
    },
    {
      icon: MessageCircle,
      title: 'Report and block, anytime',
      description: 'Every match and chat can be reported or blocked in one tap. Blocking immediately closes any open match with that person.',
    },
  ];

  return (
    <section className="section bg-navy-800 text-white">
      <div className="container-custom">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold mb-4">
            Built for a Trustworthy Community
          </h2>
          <p className="text-lg text-navy-100 max-w-2xl mx-auto">
            We're a new, local platform - here's exactly how we keep matching and chat safe from day one.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {points.map((point, i) => {
            const Icon = point.icon;
            return (
              <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-primary-300" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{point.title}</h3>
                <p className="text-navy-100 leading-relaxed">{point.description}</p>
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
    <section className="section bg-white">
      <div className="container-custom">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-navy-700 p-8 md:p-16 text-center text-white">
          <div className="absolute inset-0 court-grid-bg-light opacity-60" />
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to Join the Community?
            </h2>
            <p className="text-lg text-primary-100 mb-8">
              Create your free profile today and start connecting with local tennis players, joining tournaments, and finding hitting partners.
            </p>
            <Link
              to="/auth/signup"
              className="btn btn-lg bg-white text-primary-700 hover:bg-primary-50 font-semibold"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
