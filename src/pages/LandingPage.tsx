import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Package, MapPin, ArrowRight, Star } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';
import { format, parseISO } from 'date-fns';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ImpactSection />
      <EventsPreviewSection />
      <TestimonialsSection />
      <CTASection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.pexels.com/photos/3133638/pexels-photo-3133638.jpeg?auto=compress&cs=tinysrgb&w=1600"
          alt="Tennis court"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-900/90 via-secondary-900/70 to-primary-900/50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            <span className="text-sm text-white/90">Launching in Livingston, NJ</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-tight">
            Affordable Competitive
            <span className="block mt-2 bg-gradient-to-r from-accent-400 to-accent-300 bg-clip-text text-transparent">
              Tennis for Everyone
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Starting in Livingston with plans to expand across Essex County. Join local tournaments, find hitting partners, and grow the tennis community. No club membership required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth/signup"
              className="btn-accent btn-lg inline-flex items-center gap-2"
            >
              Join Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/events"
              className="btn-lg inline-flex items-center gap-2 bg-white/10 text-white hover:bg-white/20 border border-white/20"
            >
              Browse Events
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Calendar,
      title: 'Community Tournaments',
      description: 'Affordable shootout tournaments for all skill levels. Compete, improve, and win prizes without breaking the bank.',
      color: 'primary',
    },
    {
      icon: Users,
      title: 'Hitting Partners',
      description: 'Find players matched to your skill level and availability. Never hit alone again.',
      color: 'accent',
    },
    {
      icon: Package,
      title: 'Gear Exchange',
      description: 'Buy, sell, or trade tennis equipment with local players. Great deals, no shipping.',
      color: 'primary',
    },
    {
      icon: MapPin,
      title: 'Local Courts',
      description: 'Discover the best courts in your area. Find lights, surfaces, and booking info.',
      color: 'accent',
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
              <div
                key={i}
                className="card-hover p-6 group"
              >
                <div className={`w-14 h-14 rounded-2xl ${feature.color === 'primary' ? 'bg-primary-100 text-primary-600' : 'bg-accent-100 text-accent-600'} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
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
    <section className="section bg-secondary-50">
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
              <div className="text-6xl font-bold text-secondary-200 mb-4">{step.num}</div>
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
      const { data } = await supabase.from('impact_metrics').select('*');
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
              <span className="w-3 h-3 rounded-full bg-accent-400 animate-pulse" />
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
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'open')
        .order('date', { ascending: true })
        .limit(3);

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

function TestimonialsSection() {
  const testimonials = [
    {
      quote: "CourtConnect helped me find my regular hitting partner. We've been playing together for 6 months now and my game has improved so much!",
      name: "Sarah Thompson",
      role: "USTA League Player",
      image: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100",
    },
    {
      quote: "Finally, affordable tournaments! I used to spend $100+ for club events. Now I play more often and spend way less.",
      name: "Michael Chen",
      role: "Competitive Player",
      image: "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=100",
    },
    {
      quote: "I bought a used racquet through the gear exchange and it was perfect. The seller lived 5 minutes away from me!",
      name: "Emily Watson",
      role: "Tennis Mom",
      image: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100",
    },
  ];

  return (
    <section className="section bg-secondary-900 text-white">
      <div className="container-custom">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Loved by the Tennis Community
          </h2>
          <p className="text-lg text-secondary-300 max-w-2xl mx-auto">
            Hear from players who are already benefiting from CourtConnect.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-secondary-800/50 p-8 rounded-2xl">
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-5 h-5 text-accent-400 fill-accent-400" />
                ))}
              </div>
              <p className="text-secondary-200 mb-6 leading-relaxed">"{t.quote}"</p>
              <div className="flex items-center gap-4">
                <img
                  src={t.image}
                  alt={t.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-secondary-400">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="section bg-white">
      <div className="container-custom">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 p-8 md:p-16 text-center text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to Join the Community?
            </h2>
            <p className="text-lg text-primary-100 mb-8">
              Create your free profile today and start connecting with local tennis players, joining tournaments, and finding hitting partners.
            </p>
            <Link
              to="/auth/signup"
              className="btn-lg bg-white text-primary-600 hover:bg-primary-50 font-semibold"
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
