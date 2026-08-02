import { Heart, Users, Zap, Shield } from 'lucide-react';
import { CONTACT_EMAIL } from '../../lib/legal';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-4xl">
        <h1 className="text-4xl font-bold text-secondary-900 mb-6 text-center">About CourtConnect</h1>
        <p className="text-xl text-secondary-600 text-center mb-12 max-w-2xl mx-auto">
          A Livingston tennis community pilot built to help local players match up, coordinate court time, join
          events, and exchange gear.
        </p>

        <div className="card p-8 mb-8">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">What CourtConnect Actually Does</h2>
          <p className="text-secondary-600 leading-relaxed mb-6">
            CourtConnect is a local tennis community platform, currently piloting in Livingston, NJ. Once you create
            a profile, you can send and accept partner match requests, then chat with anyone you've matched with;
            browse and register for local events and tournaments; coordinate court time with other members on the
            schedule; and buy, sell, or trade tennis gear locally. Players under 18 need a parent or guardian to
            approve matching and chat before using those two features specifically - everything else is open right
            away.
          </p>
          <p className="text-secondary-600 leading-relaxed">
            We're starting small and deliberately - Livingston first, with plans to expand across Essex County as
            the community grows. CourtConnect doesn't require a club membership or tournament entry fees, and it
            doesn't process payments of any kind - gear exchanges and any event fees are handled directly between
            members.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="card p-6">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Community First</h3>
            <p className="text-secondary-600">We prioritize building genuine connections between players over profit.</p>
          </div>
          <div className="card p-6">
            <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-navy-600" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Inclusive for All</h3>
            <p className="text-secondary-600">From beginners to elite players, everyone has a place in our community.</p>
          </div>
          <div className="card p-6">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-primary-700" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Affordable Access</h3>
            <p className="text-secondary-600">Our events and programs are designed to be budget-friendly for everyone.</p>
          </div>
          <div className="card p-6">
            <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-navy-600" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Safe & Trusted</h3>
            <p className="text-secondary-600">We moderate content and give every member tools to report and block anyone who makes them uncomfortable.</p>
          </div>
        </div>

        <div className="card p-8 bg-gradient-to-br from-primary-600 to-navy-700 text-white">
          <h2 className="text-2xl font-bold mb-4">Join Our Community</h2>
          <p className="text-primary-100 mb-6">
            Whether you're looking to compete, find hitting partners, or just get more time on the court,
            CourtConnect is here to help. Sign up today and start connecting with local players.
          </p>
          <a href="/auth/signup" className="btn btn-lg bg-white text-primary-700 hover:bg-primary-50 font-semibold">
            Get Started Free
          </a>
        </div>
      </div>
    </div>
  );
}

export function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-2xl">
        <h1 className="text-4xl font-bold text-secondary-900 mb-6 text-center">Contact Us</h1>
        <p className="text-xl text-secondary-600 text-center mb-12">
          Have a question or feedback? We'd love to hear from you.
        </p>

        <div className="card p-8 text-center">
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
