import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube } from 'lucide-react';
import { CONTACT_EMAIL } from '../lib/legal';
import { Logo } from './brand/Logo';

const footerLinks = {
  community: [
    { label: 'Events', to: '/events' },
    { label: 'Players', to: '/players' },
    { label: 'Partners', to: '/partners' },
    { label: 'Gear Exchange', to: '/gear' },
    { label: 'Courts', to: '/courts' },
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

const socialLinks = [
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Youtube, href: '#', label: 'YouTube' },
];

export function Footer() {
  return (
    <footer className="bg-secondary-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-flex items-center mb-4 bg-white rounded-lg px-3 py-2">
              <Logo variant="lockup" className="h-7" />
            </Link>
            <p className="text-secondary-400 text-sm mb-6">
              Connecting local tennis communities through affordable tournaments, partner matching, and gear exchange.
            </p>
            <div className="flex gap-3">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  className="w-10 h-10 rounded-lg bg-secondary-800 hover:bg-primary-500 flex items-center justify-center transition-colors"
                  aria-label={label}
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Community</h4>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-secondary-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-secondary-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-secondary-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-secondary-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-secondary-500 text-sm text-center md:text-left">
            © {new Date().getFullYear()} CourtConnect. All rights reserved.{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">
              {CONTACT_EMAIL}
            </a>
          </p>
          <div className="flex items-center gap-2 text-sm text-secondary-500">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            Serving Essex County, New Jersey
          </div>
        </div>
      </div>
    </footer>
  );
}
