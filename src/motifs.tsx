/**
 * Faint line motifs for each genre era, drawn on a 24 by 24 grid.
 * The road repeats them as a pattern behind the songs, at low opacity.
 */
import type { ReactElement } from 'react';
import type { GenreFamily } from './genres';

type Motif = ReactElement;

const bolt = <path d="M13 2 4 14h7l-1 8 9-13h-7z" />;
const star = <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z" />;
const heart = <path d="M12 20s-8-4.6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.4-8 10-8 10z" />;
const vinyl = (
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5" />
  </>
);
const mic = (
  <>
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V22M8.5 22h7" />
  </>
);
const note = (
  <>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </>
);
const plectrum = <path d="M12 21C8 17 5 12.5 5 8.5 5 5 8 3 12 3s7 2 7 5.5c0 4-3 8.5-7 12.5z" />;
const waveform = <path d="M2 12h3l2-5 3 10 3-14 3 18 2-9h4" />;

const MOTIFS: Record<GenreFamily, Motif[]> = {
  punk: [
    // Safety pin
    <>
      <circle cx="6" cy="18" r="2.5" />
      <path d="M7.8 16.2 17 7M5.6 15.5l9.1-9.1M14 5.5l2-2 4.5 4.5-2 2z" />
    </>,
    // Circled A
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7 21 12 3l5 18M5 14h14" />
    </>,
    bolt,
    star,
    // Broken heart
    <>
      {heart}
      <path d="m12 7.2-1.6 3.6 2.6 2-1.6 3.6" />
    </>,
  ],
  metal: [
    bolt,
    // Spiked ring
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </>,
    // Skull
    <>
      <path d="M6 15v-5a6 6 0 0 1 12 0v5l-2 1v3H8v-3z" />
      <circle cx="9.5" cy="11" r="1.5" />
      <circle cx="14.5" cy="11" r="1.5" />
      <path d="M10.5 19v-2M13.5 19v-2" />
    </>,
    star,
  ],
  hiphop: [
    // Boombox
    <>
      <rect x="2" y="8" width="20" height="12" rx="2" />
      <circle cx="7" cy="14" r="3" />
      <circle cx="17" cy="14" r="3" />
      <path d="M6 8V5h12v3" />
    </>,
    mic,
    // Crown
    <path d="M3 18 5 7l4.5 5L12 5l2.5 7L19 7l2 11z" />,
    // Spray can
    <>
      <rect x="7" y="8" width="10" height="14" rx="1.5" />
      <path d="M10 8V5h4v3M18 4h.01M20.5 3h.01M20.5 6h.01" />
    </>,
  ],
  soul: [vinyl, mic, heart, note],
  jazz: [
    // Saxophone
    <>
      <path d="M14.5 2h4M16.5 2v4l-3 2v8a3.5 3.5 0 0 1-7 0v-1.5h3" />
      <path d="M13.5 11h.01M13.5 14h.01" />
    </>,
    // Piano keys
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M7.5 6v12M12 6v12M16.5 6v12M6 6v6h3V6M15 6v6h3V6" />
    </>,
    // Cocktail glass
    <path d="M5 4h14l-7 8zM12 12v8M8 20h8" />,
    note,
  ],
  classical: [
    // Single note
    <>
      <path d="M14 17V3c0 2 2 3 4 4" />
      <ellipse cx="11" cy="17" rx="3" ry="2.2" />
    </>,
    // Fermata
    <>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <circle cx="12" cy="13.5" r="1" />
    </>,
    // Stave with notes
    <>
      <path d="M2 7h20M2 11h20M2 15h20M2 19h20" />
      <ellipse cx="8" cy="13" rx="2" ry="1.5" />
      <ellipse cx="16" cy="9" rx="2" ry="1.5" />
    </>,
    note,
  ],
  electronic: [
    waveform,
    // Level bars
    <path d="M4 20v-6M8 20V8M12 20v-9M16 20V5M20 20v-4" />,
    // Speaker cone
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="10" />
    </>,
    // Sine wave
    <path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 5-6 7.5 0" />,
  ],
  reggae: [
    // Speaker cabinet
    <>
      <rect x="5" y="2" width="14" height="20" rx="1.5" />
      <circle cx="12" cy="15" r="4" />
      <circle cx="12" cy="7" r="2" />
    </>,
    // Sun
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </>,
    vinyl,
    note,
  ],
  folk: [
    // Acoustic guitar
    <>
      <path d="M10 10.5C7.5 9 4 10 3.5 13c-.4 2 1 3-.5 5 .5 2 2.5 3 4.5 2.5 1.5-.5 2-2 4.5-2.5 2-.5 2.5-3.5 1-6z" />
      <circle cx="8" cy="15" r="1.5" />
      <path d="M11.5 12.5 20 4M19 3l2 2" />
    </>,
    // Leaf
    <path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15zM5 19l8-8" />,
    // Harmonica
    <>
      <rect x="2" y="9" width="20" height="6" rx="1" />
      <path d="M6 9v6M10 9v6M14 9v6M18 9v6" />
    </>,
    star,
  ],
  indie: [
    // Cassette
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="8" cy="11" r="2" />
      <circle cx="16" cy="11" r="2" />
      <path d="M10 11h4M6 19l2-4h8l2 4" />
    </>,
    plectrum,
    // Headphones
    <>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <rect x="2" y="14" width="4" height="7" rx="1.5" />
      <rect x="18" y="14" width="4" height="7" rx="1.5" />
    </>,
    star,
  ],
  pop: [
    heart,
    star,
    // Sparkle
    <path d="m12 3 1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
    mic,
  ],
  rock: [
    // Electric guitar
    <>
      <path d="M9.5 10.5C7 9 4 10 3.5 13c-.5 2 1 3 .5 5 .5 2 2.5 3 4.5 2 1.5-.5 2-2 4.5-2.5 2-.5 2.5-3.5.5-7z" />
      <path d="M12 12 20 4M19 3l2 2M6.5 14.5l2 2" />
    </>,
    plectrum,
    bolt,
    // Amplifier
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <circle cx="12" cy="13" r="4.5" />
      <path d="M7 7h.01M10 7h.01M13 7h.01" />
    </>,
  ],
};

export function motifsFor(genre: GenreFamily): Motif[] {
  return MOTIFS[genre];
}

/** Where each motif sits in one pattern tile: position, size and turn. */
export const TILE_W = 540;
const TILE_H = 430;
const SPOTS = [
  { x: 24, y: 30, size: 44, turn: -12 },
  { x: 214, y: 12, size: 32, turn: 10 },
  { x: 392, y: 58, size: 48, turn: -4 },
  { x: 112, y: 152, size: 54, turn: 6 },
  { x: 300, y: 186, size: 36, turn: -18 },
  { x: 470, y: 230, size: 30, turn: 22 },
  { x: 30, y: 318, size: 34, turn: 14 },
  { x: 214, y: 352, size: 46, turn: -8 },
  { x: 404, y: 336, size: 40, turn: 4 },
];

/** A repeating SVG pattern of the motifs of one genre. The stroke takes the CSS colour of the SVG. */
export function MotifPattern({ id, genre, offset = 0 }: { id: string; genre: GenreFamily; offset?: number }) {
  const motifs = motifsFor(genre);
  return (
    <pattern id={id} x={offset} width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse">
      <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {SPOTS.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.turn} ${s.size / 2} ${s.size / 2}) scale(${s.size / 24})`}>
            {motifs[i % motifs.length]}
          </g>
        ))}
      </g>
    </pattern>
  );
}
