// Geometry for the gooey bubble orb, in a 300x300 design space centred on (150, 150).
// Every blob starts in the middle and swings round an orbit centre placed in the direction of its
// start angle, so it bulges out of the body and is pulled back in (the same motion as the CSS blobs
// this was adapted from: a rotating pseudo-element with an off-centre transform-origin).
export const GOO_SIZE = 300;
export const GOO_CENTER = GOO_SIZE / 2;
export const GOO_BALL = { cx: GOO_CENTER, cy: GOO_CENTER, r: 58 };

// [start angle (deg), orbit radius, blob radius, seconds per turn, delay (s)]
// A few lumps give the body its wobble; the satellites break away from it and are pulled back in.
const BLUBBS = [
  [150, 38, 36, 2.7, 0.2],
  [276, 30, 35, 2.9, 0.4],
  [76, 22, 34, 3.1, 0.6],
  [215, 22, 32, 3.9, 1.4]
];

const SPARKLES = [
  [335, 61, 11, 3.7, 0.2],
  [47, 54, 9, 4.3, 0.8],
  [119, 59, 9, 4.1, 0.6],
  [191, 43, 14, 4.9, 1.4],
  [263, 50, 9, 4.5, 1.0]
];

const TONES = ['a', 'b', 'c'];

function toBlob(kind, index, [angle, orbit, r, duration, delay]) {
  const heading = ((angle + 45) * Math.PI) / 180;
  return {
    id: `${kind}-${index + 1}`,
    kind,
    cx: GOO_CENTER,
    cy: GOO_CENTER,
    r,
    ox: GOO_CENTER + orbit * Math.cos(heading),
    oy: GOO_CENTER + orbit * Math.sin(heading),
    orbit,
    duration,
    delay,
    tone: TONES[index % TONES.length]
  };
}

export function buildGooBlobs() {
  return [
    ...BLUBBS.map((spec, index) => toBlob('blubb', index, spec)),
    ...SPARKLES.map((spec, index) => toBlob('sparkle', index, spec))
  ];
}

// How far a blob's edge gets from the centre at the far end of its orbit.
export function maxReach(blob) {
  return 2 * blob.orbit + blob.r;
}

// Playback speed of the whole animation for each orb state; listening and speaking also follow the voice.
export const GOO_STATE_SPEED = {
  idle: 1,
  listening: 1.5,
  thinking: 2.4,
  speaking: 1.35,
  'processing-doc': 2.1,
  complete: 1.2
};

export function targetPlaybackRate(stateClass, audioLevel = 0) {
  const base = GOO_STATE_SPEED[stateClass] ?? 1;
  const voiceDriven = stateClass === 'listening' || stateClass === 'speaking';
  const energy = voiceDriven ? Math.max(0, Math.min(1, Number(audioLevel) || 0)) : 0;
  return base + energy * 1.1;
}

// The orb takes its colours from the atmosphere (the three --circadian-glow-N colours), exposed to the
// SVG as --goo-a/b/c. Each bubble tone is a glossy gradient built from one of them: a white highlight, the
// colour getting stronger, then a deeper edge that gives the bubble volume.
export const GOO_TONES = { a: 'var(--goo-a)', b: 'var(--goo-b)', c: 'var(--goo-c)' };
export const GOO_TONE_STOPS = [0, 0.16, 0.42, 0.74, 1];

export function toneStops(colour) {
  return [
    '#ffffff',
    `color-mix(in srgb, ${colour} 28%, white)`,
    `color-mix(in srgb, ${colour} 70%, white)`,
    colour,
    `color-mix(in srgb, ${colour} 74%, #0b1030)`
  ];
}

// Plain colours for browsers that cannot mix colours: the original cool palette.
export const GOO_FALLBACK_STOPS = {
  a: ['#ffffff', '#e6fbff', '#7fe3ff', '#4aa3ff', '#6b6bff'],
  b: ['#ffffff', '#eef0ff', '#a5b4fc', '#7c83ff', '#9b6bff'],
  c: ['#ffffff', '#f3e8ff', '#c9a7ff', '#a07bff', '#d17bff']
};
