import { ReactNode } from 'react';
import { CourtLines } from './CourtMotif';

// Shared committed-color page header used across the redesigned app pages
// (Players, Matches, Schedule, Courts, Gear) - replaces the old plain
// "text-3xl font-bold" white-background page title with the same
// navy/green field + court-line motif language established on the
// homepage, so the whole app reads as one redesigned product rather than
// one restyled homepage bolted onto unchanged interior pages.
export function PageHero({
  eyebrow,
  title,
  description,
  tone = 'navy',
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: 'navy' | 'primary';
  children?: ReactNode;
}) {
  const bg = tone === 'navy' ? 'bg-navy-900' : 'bg-primary-600';
  return (
    <div className={`relative overflow-hidden ${bg} text-white`}>
      <CourtLines className="absolute -right-16 -top-10 h-[140%] w-1/2 text-white" strokeOpacity={0.1} />
      <div className="relative z-10 container-custom py-10 md:py-14">
        {eyebrow && (
          <p className="font-display text-xs font-bold tracking-[0.14em] uppercase text-primary-300 mb-3">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">{title}</h1>
        {description && <p className="text-white/75 max-w-2xl leading-relaxed">{description}</p>}
        {children}
      </div>
    </div>
  );
}
