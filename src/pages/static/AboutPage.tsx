import { Heart, Users, Zap, Shield } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-4xl">
        <h1 className="text-4xl font-bold text-secondary-900 mb-6 text-center">About CourtConnect</h1>
        <p className="text-xl text-secondary-600 text-center mb-12 max-w-2xl mx-auto">
          Making competitive tennis affordable and accessible for everyone in Essex County
        </p>

        <div className="card p-8 mb-8">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">Our Mission</h2>
          <p className="text-secondary-600 leading-relaxed mb-6">
            CourtConnect was founded with a simple belief: competitive tennis shouldn't require expensive club memberships
            or tournament entry fees that keep players away. We're building a platform that connects local tennis players,
            hosts affordable community events, and makes it easier than ever to find people to play with.
          </p>
          <p className="text-secondary-600 leading-relaxed">
            Based in Essex County, New Jersey, we serve the local tennis community by providing the tools and connections
            players need to improve their game, meet others, and enjoy tennis at any skill level.
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
            <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-accent-600" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Inclusive for All</h3>
            <p className="text-secondary-600">From beginners to elite players, everyone has a place in our community.</p>
          </div>
          <div className="card p-6">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Affordable Access</h3>
            <p className="text-secondary-600">Our events and programs are designed to be budget-friendly for everyone.</p>
          </div>
          <div className="card p-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Safe & Trusted</h3>
            <p className="text-secondary-600">We verify members and moderate content to keep our community safe.</p>
          </div>
        </div>

        <div className="card p-8 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <h2 className="text-2xl font-bold mb-4">Join Our Community</h2>
          <p className="text-primary-100 mb-6">
            Whether you're looking to compete, find hitting partners, or just get more time on the court,
            CourtConnect is here to help. Sign up today and start connecting with local players.
          </p>
          <a href="/auth/signup" className="btn-lg bg-white text-primary-600 hover:bg-primary-50 font-semibold">
            Get Started Free
          </a>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-4xl">
        <h1 className="text-4xl font-bold text-secondary-900 mb-6">Privacy Policy</h1>
        <div className="card p-8">
          <p className="text-secondary-600 mb-6">Last updated: June 12, 2024</p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-secondary-900 mb-3">Information We Collect</h2>
            <p className="text-secondary-600 leading-relaxed">
              We collect information you provide directly to us, including name, email address, location,
              tennis skill level, and any other information you choose to provide when creating your profile
              or participating in community events.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-secondary-900 mb-3">How We Use Your Information</h2>
            <p className="text-secondary-600 leading-relaxed">
              We use the information we collect to provide, maintain, and improve our services, including
              connecting you with other players, managing event registrations, and facilitating gear exchanges.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-secondary-900 mb-3">Information Sharing</h2>
            <p className="text-secondary-600 leading-relaxed">
              We do not sell your personal information. We may share your information with other members
              to facilitate connections and events, or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-secondary-900 mb-3">Contact Us</h2>
            <p className="text-secondary-600 leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at privacy@courtconnect.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-4xl">
        <h1 className="text-4xl font-bold text-secondary-900 mb-6">Terms of Service</h1>
        <div className="card p-8">
          <p className="text-secondary-600 mb-6">Last updated: June 12, 2024</p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-secondary-900 mb-3">Acceptance of Terms</h2>
            <p className="text-secondary-600 leading-relaxed">
              By accessing and using CourtConnect, you agree to be bound by these Terms of Service
              and all applicable laws and regulations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-secondary-900 mb-3">User Responsibilities</h2>
            <p className="text-secondary-600 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account and for all activities
              that occur under your account. You agree to use the service only for lawful purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-secondary-900 mb-3">Community Guidelines</h2>
            <p className="text-secondary-600 leading-relaxed">
              Members are expected to treat each other with respect. Harassment, discrimination,
              or any form of abuse will not be tolerated and may result in account termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-secondary-900 mb-3">Limitation of Liability</h2>
            <p className="text-secondary-600 leading-relaxed">
              CourtConnect is not responsible for injuries, accidents, or disputes that occur during
              tennis activities arranged through our platform. Participants play at their own risk.
            </p>
          </section>
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

        <div className="card p-8">
          <form className="space-y-6">
            <div>
              <label className="label">Name</label>
              <input type="text" className="input" placeholder="Your name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Subject</label>
              <select className="input">
                <option>General Inquiry</option>
                <option>Partnership Opportunity</option>
                <option>Bug Report</option>
                <option>Feature Request</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input min-h-[150px]" placeholder="How can we help?" />
            </div>
            <button type="submit" className="btn-primary w-full">Send Message</button>
          </form>
        </div>
      </div>
    </div>
  );
}
