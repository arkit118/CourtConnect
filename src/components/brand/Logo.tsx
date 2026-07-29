// CourtConnect brand mark, built as SVG/CSS rather than the reference
// presentation board image (src/assets/brand/courtconnect-logo-reference.png)
// so the app never renders the labeled board itself - only clean,
// app-ready assets derived from it: an icon (racquet head with a green/
// navy split outline, strings, and an interlocking "C"+"o" link mark at
// its center), a wordmark ("Court" in green, "Connect" in navy, set in
// the display typeface), and a lockup combining both.

const GREEN = '#0B5A2A';
const NAVY = '#0E3567';

export function LogoIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <clipPath id="cc-racquet-head">
          <ellipse cx="32" cy="24.5" rx="15.2" ry="17.5" />
        </clipPath>
      </defs>

      {/* tapered handle + throat, drawn first so the head outline sits on top of it */}
      <path
        d="M28.6,36 C28.2,39.5 27.8,42 28.6,45 L27.8,55.6 C27.7,57.5 29.1,59 31,59 L33,59 C34.9,59 36.3,57.5 36.2,55.6 L35.4,45 C36.2,42 35.8,39.5 35.4,36 Z"
        fill={GREEN}
      />

      {/* strings, clipped to the racquet head - kept sparse and faint so
          they read as texture, not competing with the center mark */}
      <g clipPath="url(#cc-racquet-head)" opacity="0.32">
        {[14, 24.5, 35].map((y) => (
          <line key={y} x1="17.2" y1={y} x2="46.8" y2={y} stroke={y < 24.5 ? GREEN : NAVY} strokeWidth="1" />
        ))}
        {[22, 32, 42].map((x) => (
          <line key={x} x1={x} y1="7.5" x2={x} y2="41.5" stroke={x < 32 ? GREEN : NAVY} strokeWidth="1" />
        ))}
      </g>

      {/* racquet head outline, split green (left) / navy (right) */}
      <path d="M32,7 A15.2,17.5 0 0 0 32,42" stroke={GREEN} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M32,7 A15.2,17.5 0 0 1 32,42" stroke={NAVY} strokeWidth="3.6" strokeLinecap="round" />

      {/* interlocking "C" + "o" connection mark, dominant at the head's center */}
      <circle cx="36" cy="24.5" r="8.6" fill="none" stroke={NAVY} strokeWidth="4" />
      <path
        d="M32.4,16.4 A8.6,8.6 0 1 0 32.4,32.6"
        fill="none"
        stroke={GREEN}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoWordmark({ className = 'text-2xl', dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={`font-display font-extrabold tracking-tight leading-none ${className}`}>
      <span style={{ color: dark ? '#4ECB70' : GREEN }}>Court</span>
      <span style={{ color: dark ? '#9DC3EE' : NAVY }}>Connect</span>
    </span>
  );
}

interface LogoProps {
  variant?: 'icon' | 'wordmark' | 'lockup';
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
}

export function Logo({ variant = 'lockup', className = '', iconClassName = 'h-9 w-9', wordmarkClassName = 'text-xl' }: LogoProps) {
  if (variant === 'icon') return <LogoIcon className={`${iconClassName} ${className}`} />;
  if (variant === 'wordmark') return <LogoWordmark className={`${wordmarkClassName} ${className}`} />;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon className={iconClassName} />
      <LogoWordmark className={wordmarkClassName} />
    </span>
  );
}
