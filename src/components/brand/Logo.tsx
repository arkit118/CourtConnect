// CourtConnect brand mark. These three images are direct pixel crops of
// the chosen final logo (src/assets/brand/courtconnect-logo-reference.png,
// "Option 2B"), with the reference board's background chroma-keyed to
// transparent and auto-trimmed - not a redrawn/recreated interpretation.
// The lockup crop keeps the icon and wordmark's original relative sizing
// and spacing exactly as designed, rather than recomposing them from
// separately-sized pieces.
import logoIcon from '../../assets/brand/logo-icon.png';
import logoWordmark from '../../assets/brand/logo-wordmark.png';
import logoLockup from '../../assets/brand/logo-lockup.png';

export function LogoIcon({ className = 'h-8' }: { className?: string }) {
  return <img src={logoIcon} alt="CourtConnect" className={`${className} w-auto object-contain`} />;
}

export function LogoWordmark({ className = 'h-6' }: { className?: string }) {
  return <img src={logoWordmark} alt="CourtConnect" className={`${className} w-auto object-contain`} />;
}

interface LogoProps {
  variant?: 'icon' | 'wordmark' | 'lockup';
  className?: string;
}

export function Logo({ variant = 'lockup', className = 'h-9' }: LogoProps) {
  const src = variant === 'icon' ? logoIcon : variant === 'wordmark' ? logoWordmark : logoLockup;
  return <img src={src} alt="CourtConnect" className={`${className} w-auto object-contain`} />;
}
