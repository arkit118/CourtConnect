import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { CONTACT_EMAIL } from '../lib/legal';
import { Logo } from './brand/Logo';
import { CourtLines } from './brand/CourtMotif';

const footerLinks = {
  community: [
    { label: 'Events', to: '/events' },
    { label: 'Players', to: '/players' },
    { label: 'Partners', to: '/partners' },
    { label: 'Matches', to: '/matches' },
    { label: 'Gear Exchange', to: '/gear' },
    { label: 'Courts', to: '/courts' },
    { label: 'Schedule', to: '/schedule' },
  ],
  company: [
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ],
  legal: [
    { label: 'Terms of Service', to: '/terms' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Safety', to: '/safety' },
    { label: 'Community Guidelines', to: '/community-guidelines' },
  ],
};

const INSTAGRAM_URL = 'https://www.instagram.com/courtconnect_livingston/';

// Only Instagram is part of the launch social presence.
// Facebook/Twitter/YouTube are removed outright - not part of the launch
// social presence.

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navy-900 text-white">
      <CourtLines className="absolute -left-16 -bottom-24 h-72 w-72 text-white" strokeOpacity={0.06} />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-flex items-center mb-4 bg-white rounded-lg px-3 py-2">
              <Logo variant="lockup" className="h-7" />
            </Link>
            <p className="text-navy-200 text-sm mb-6">
              A Livingston tennis community pilot for finding hitting partners, joining local events, coordinating
              court time, and trading gear.
            </p>
            <div className="flex gap-3">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-white/5 text-navy-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                title="CourtConnect on Instagram"
                aria-label="CourtConnect on Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Community</h4>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-navy-200 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-navy-200 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-navy-200 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-navy-300 text-sm text-center md:text-left">
            © {new Date().getFullYear()} CourtConnect. All rights reserved.{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">
              {CONTACT_EMAIL}
            </a>
          </p>
          <div className="flex items-center gap-2 text-sm text-navy-300">
            <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            Piloting in Livingston, New Jersey
          </div>
        </div>
      </div>
    </footer>
  );
}
