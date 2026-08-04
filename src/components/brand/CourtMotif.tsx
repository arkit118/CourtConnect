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
