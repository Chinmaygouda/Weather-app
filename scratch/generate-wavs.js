const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../src/assets/audio');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const SAMPLE_RATE = 44100;
const SECONDS = 30; // 30s loop so the loop crossfade isn't audible
const FADE_SECONDS = 1.5; // crossfade length at loop point
const NUM_SAMPLES = SAMPLE_RATE * SECONDS;
const FADE_SAMPLES = Math.floor(SAMPLE_RATE * FADE_SECONDS);
const MAX_INT16 = 32767;

/** white noise [-1, 1] */
function white() { return Math.random() * 2 - 1; }

/**
 * Simple biquad LP filter.
 * cutoff: normalized freq [0..1] (fraction of Nyquist)
 */
function makeLPF(cutoff) {
  const fc = Math.max(0.0001, Math.min(0.4999, cutoff));
  const omega = 2 * Math.PI * fc;
  const sin = Math.sin(omega);
  const cos = Math.cos(omega);
  const alpha = sin / (2 * 0.707); // Q = 0.707 = Butterworth
  const b0 = (1 - cos) / 2;
  const b1 = 1 - cos;
  const b2 = (1 - cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 / a0) * x + (b1 / a0) * x1 + (b2 / a0) * x2
              - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    return y;
  };
}

/**
 * Pink noise via Paul Kellet's filter (very common in practice).
 */
function makePinkNoise() {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = white();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    return out * 0.11; // roughly normalize to [-1, 1]
  };
}

/** Brown noise integrator */
function makeBrownNoise() {
  let last = 0;
  return () => {
    last += white() * 0.02;
    if (last > 1) last = 1;
    if (last < -1) last = -1;
    return last;
  };
}

/** Apply a crossfade so the loop point is seamless */
function crossfadeLoop(samples, fadeSamples) {
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples; // 0 → 1
    // linear crossfade: fade the tail into the head
    const head = samples[i];
    const tail = samples[samples.length - fadeSamples + i];
    samples[i] = tail * (1 - t) + head * t;
  }
  return samples;
}

/**
 * Generate samples array for a given atmosphere type.
 */
function generateSamples(type) {
  const samples = new Float32Array(NUM_SAMPLES);
  let gen, lpf, gain, lpf2;

  if (type === 'calm') {
    // Very soft, heavily filtered pink noise — peaceful hum
    gen = makePinkNoise();
    lpf = makeLPF(0.008); // very low cut
    lpf2 = makeLPF(0.012);
    gain = 0.28;
    for (let i = 0; i < NUM_SAMPLES; i++) {
      samples[i] = lpf(lpf2(gen())) * gain;
    }

  } else if (type === 'weeping') {
    // Rain: pink noise at mid frequencies
    gen = makePinkNoise();
    lpf = makeLPF(0.18);
    gain = 0.65;
    for (let i = 0; i < NUM_SAMPLES; i++) {
      samples[i] = lpf(gen()) * gain;
    }

  } else if (type === 'volatile') {
    // Thunder: brown noise with occasional low-rumble bursts
    const brown = makeBrownNoise();
    lpf = makeLPF(0.04);
    gain = 0.9;
    for (let i = 0; i < NUM_SAMPLES; i++) {
      samples[i] = lpf(brown()) * gain;
    }

  } else if (type === 'frozen') {
    // Wind: pink noise with slow LFO amplitude sweep
    gen = makePinkNoise();
    lpf = makeLPF(0.09);
    gain = 0.55;
    const lfoRate = 0.12 / SAMPLE_RATE; // ~0.12 Hz sweep
    for (let i = 0; i < NUM_SAMPLES; i++) {
      const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * lfoRate * i);
      samples[i] = lpf(gen()) * gain * (0.5 + 0.5 * lfo);
    }
  }

  return samples;
}

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const bufSize = 44 + numSamples * 2;
  const buf = Buffer.alloc(bufSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(bufSize - 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);          // PCM
  buf.writeUInt16LE(1, 22);          // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * MAX_INT16), 44 + i * 2);
  }

  const destPath = path.join(outputDir, filename);
  fs.writeFileSync(destPath, buf);
  console.log(`Written: ${destPath}`);
}

const types = ['calm', 'weeping', 'volatile', 'frozen'];
for (const type of types) {
  process.stdout.write(`Generating ${type}...`);
  let samples = generateSamples(type);
  // Make loop seamless: blend the very end back into the beginning
  const arr = Array.from(samples);
  crossfadeLoop(arr, FADE_SAMPLES);
  writeWav(`${type}.wav`, arr);
}
console.log('Done. All audio assets generated.');
