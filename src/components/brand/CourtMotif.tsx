// Authored tennis-court line diagram, standing in for the generic
// gradient-blur-orb decoration the old homepage used. Real court
// geometry (baseline, singles/doubles sidelines, service boxes, center
// service line, net) at a fixed viewBox aspect so it can be scaled and
// cropped per section without distortion - a graphic in the product's own
// visual language, not a stock shape.
export function CourtLines({ className = '', strokeOpacity = 1 }: { className?: string; strokeOpacity?: number }) {
  return (
    <svg
      viewBox="0 0 400 220"
      fill="none"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Doubles sidelines */}
      <rect x="12" y="12" width="376" height="196" stroke="currentColor" strokeOpacity={strokeOpacity} strokeWidth="2" />
      {/* Singles sidelines */}
      <rect x="42" y="12" width="316" height="196" stroke="currentColor" strokeOpacity={strokeOpacity * 0.75} strokeWidth="1.5" />
      {/* Net */}
      <line x1="12" y1="110" x2="388" y2="110" stroke="currentColor" strokeOpacity={strokeOpacity} strokeWidth="2.5" />
      {/* Service lines */}
      <line x1="42" y1="62" x2="358" y2="62" stroke="currentColor" strokeOpacity={strokeOpacity * 0.75} strokeWidth="1.5" />
      <line x1="42" y1="158" x2="358" y2="158" stroke="currentColor" strokeOpacity={strokeOpacity * 0.75} strokeWidth="1.5" />
      {/* Center service line */}
      <line x1="200" y1="62" x2="200" y2="158" stroke="currentColor" strokeOpacity={strokeOpacity * 0.75} strokeWidth="1.5" />
      {/* Center marks on baselines */}
      <line x1="200" y1="12" x2="200" y2="20" stroke="currentColor" strokeOpacity={strokeOpacity} strokeWidth="2" />
      <line x1="200" y1="200" x2="200" y2="208" stroke="currentColor" strokeOpacity={strokeOpacity} strokeWidth="2" />
    </svg>
  );
}

// A single service-box corner crop - used small, as a recurring corner
// mark on cards/sections instead of a rounded icon tile.
export function CourtCorner({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M2 2H46" stroke="currentColor" strokeWidth="2" />
      <path d="M2 2V46" stroke="currentColor" strokeWidth="2" />
      <path d="M2 24H30" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M24 2V24" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" />
    </svg>
  );
}

// A tennis ball's curved seam, isolated from the ball itself - the arc
// alone reads as "tennis" without drawing a literal cartoon ball. Used as
// a quiet corner/watermark accent on empty states and match-style cards,
// same role CourtCorner plays but with a softer, rounder line.
export function BallArc({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
      <path
        d="M32 2C24 12 24 52 32 62"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 2C40 12 40 52 32 62"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// A racquet's strung face - crossing warp/weft lines inside a rounded
// head, used small and low-opacity as a texture cue on gear/notice-board
// style surfaces (Gear Exchange, listings) rather than a literal racquet
// icon.
export function StringGrid({ className = '', strokeOpacity = 1 }: { className?: string; strokeOpacity?: number }) {
  const mains = [10, 18, 26, 34, 42, 50];
  const crosses = [10, 18, 26, 34, 42, 50];
  return (
    <svg viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="52" height="52" rx="26" stroke="currentColor" strokeWidth="2" strokeOpacity={strokeOpacity} />
      <g strokeOpacity={strokeOpacity * 0.55}>
        {mains.map((x) => (
          <line key={`m-${x}`} x1={x} y1="8" x2={x} y2="52" stroke="currentColor" strokeWidth="1" />
        ))}
        {crosses.map((y) => (
          <line key={`c-${y}`} x1="8" y1={y} x2="52" y2={y} stroke="currentColor" strokeWidth="1" />
        ))}
      </g>
    </svg>
  );
}

// Purposeful section divider inspired by a court's center mark: a thin
// baseline with a small tick at center, standing in for a plain <hr> or
// empty gap between major sections. Clay-accented by default since this
// is one of the few places the brief calls for the accent color on its
// own, not supporting another element.
export function CourtDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-current opacity-15" />
      <span className="w-1.5 h-1.5 rounded-full bg-clay-500" />
      <span className="h-px flex-1 bg-current opacity-15" />
    </div>
  );
}
