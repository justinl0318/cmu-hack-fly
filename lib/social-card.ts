import type { Circuit } from '@/components/BrainView';
import { neuralStyle, type Racer, type NeuralFrame } from './battle';
import { raceTime } from './profile';

export const CARD_WIDTH = 960,
  CARD_HEIGHT = 720;
type Trace = { id: string; segments: number[][]; center: number[] };
const tracesCache = new WeakMap<Circuit, Trace[]>();
function traces(circuit: Circuit) {
  const cached = tracesCache.get(circuit);
  if (cached) return cached;
  const low = [Infinity, Infinity],
    high = [-Infinity, -Infinity];
  for (const neuron of circuit.neurons)
    for (const p of neuron.points) {
      low[0] = Math.min(low[0], p[0]);
      high[0] = Math.max(high[0], p[0]);
      low[1] = Math.min(low[1], p[1]);
      high[1] = Math.max(high[1], p[1]);
    }
  const scale = 180 / Math.max(1, high[0] - low[0], high[1] - low[1]);
  const point = (p: number[]) => [
    750 + (p[0] - (low[0] + high[0]) / 2) * scale,
    468 - (p[1] - (low[1] + high[1]) / 2) * scale,
  ];
  const result = circuit.neurons.map((n) => {
    const segments = n.segments
      .filter(
        (_, i) => i % Math.max(1, Math.ceil(n.segments.length / 220)) === 0,
      )
      .flatMap(([a, b]) =>
        n.points[a] && n.points[b]
          ? [[...point(n.points[a]), ...point(n.points[b])]]
          : [],
      );
    const centers = n.points.map(point);
    return {
      id: n.id,
      segments,
      center: centers.length
        ? [
            centers.reduce((s, p) => s + p[0], 0) / centers.length,
            centers.reduce((s, p) => s + p[1], 0) / centers.length,
          ]
        : [750, 468],
    };
  });
  tracesCache.set(circuit, result);
  return result;
}
function lines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  maxLines: number,
  lineHeight: number,
) {
  let line = '',
    row = 0;
  for (const char of text) {
    if (ctx.measureText(line + char).width > width) {
      ctx.fillText(
        row === maxLines - 1 ? line.slice(0, -2) + '…' : line,
        x,
        y + row * lineHeight,
      );
      line = '';
      row++;
      if (row >= maxLines) return;
    }
    line += char;
  }
  ctx.fillText(line, x, y + row * lineHeight);
}
export function drawSocialCard(
  ctx: CanvasRenderingContext2D,
  p: Racer,
  circuit: Circuit,
  avatar: CanvasImageSource | null,
  frame: NeuralFrame | undefined,
  raceClock: number,
) {
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = '#101d1c';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = p.color;
  ctx.fillRect(0, 0, CARD_WIDTH, 8);
  ctx.fillStyle = '#cce79a';
  ctx.font = '600 16px sans-serif';
  ctx.fillText('FLYCIRCUIT / THE FLY CLUB', 42, 48);
  ctx.fillStyle = '#f7f3e4';
  ctx.font = 'bold 36px sans-serif';
  lines(ctx, p.name, 42, 111, 535, 2, 40);
  ctx.fillStyle = '#c0cfc5';
  ctx.font = '22px sans-serif';
  lines(ctx, p.profile.school || 'Independent explorer', 42, 194, 510, 2, 26);
  ctx.fillStyle = p.color;
  ctx.font = '19px sans-serif';
  lines(
    ctx,
    p.profile.interests || 'Curious minds welcome.',
    42,
    250,
    510,
    2,
    24,
  );
  ctx.fillStyle = '#f7f3e4';
  ctx.font = '600 23px monospace';
  ctx.fillText(
    `Race: ${p.finishTime !== null ? raceTime(p.finishTime) : 'DNF'}`,
    42,
    327,
  );
  ctx.fillText(`Top Speed: ${p.topSpeed.toFixed(1)} m/s`, 42, 369);
  ctx.font = '20px sans-serif';
  ctx.fillText(`Neural Style: ${neuralStyle(p)}`, 42, 411);
  ctx.fillStyle = '#8fa69d';
  ctx.font = '14px sans-serif';
  ctx.fillText(
    p.finishTime !== null
      ? 'ONE-LAP FINISHER'
      : `Stopped when winner finished · ${raceTime(raceClock)}`,
    42,
    442,
  );
  ctx.fillStyle = '#e9edde';
  ctx.font = 'italic 21px sans-serif';
  lines(
    ctx,
    p.profile.bio ? `“${p.profile.bio}”` : '“Let’s build something together.”',
    42,
    496,
    510,
    3,
    27,
  );
  ctx.fillStyle = '#233c35';
  ctx.beginPath();
  ctx.roundRect(605, 60, 313, 264, 26);
  ctx.fill();
  if (avatar) ctx.drawImage(avatar, 620, 48, 285, 285);
  ctx.fillStyle = '#cfdfc8';
  ctx.font = '13px sans-serif';
  ctx.fillText(
    `${p.profile.look.hat.toUpperCase()} / ${p.profile.look.shoes.toUpperCase()}`,
    622,
    311,
  );
  ctx.fillStyle = '#172c29';
  ctx.beginPath();
  ctx.roundRect(590, 350, 330, 250, 20);
  ctx.fill();
  ctx.fillStyle = '#9cb1a7';
  ctx.font = '12px monospace';
  ctx.fillText('LAST NEURAL SIGNAL / RECORDED', 606, 376);
  const active = new Set(frame?.spikes ?? []);
  for (const n of traces(circuit)) {
    const firing = active.has(n.id);
    ctx.strokeStyle = firing ? '#d3ff75' : '#4d7d71';
    ctx.globalAlpha = firing ? 0.95 : 0.42;
    ctx.lineWidth = firing ? 1.8 : 0.65;
    ctx.beginPath();
    for (const [x, y, x2, y2] of n.segments) {
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    if (firing) {
      ctx.fillStyle = '#e8ff9b';
      ctx.beginPath();
      ctx.arc(n.center[0], n.center[1], 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 10; i++) {
    const value = frame?.activations[i] ?? 0;
    ctx.fillStyle = i < 5 ? '#d2f970' : '#b5a0ee';
    ctx.fillRect(622 + i * 26, 574 - value * 30, 17, 2 + value * 30);
  }
  ctx.fillStyle = '#8ba69a';
  ctx.font = '12px sans-serif';
  ctx.fillText(
    frame
      ? `t ${raceTime(frame.at)} · 2D neuron projection`
      : 'No recorded activity',
    606,
    594,
  );
  ctx.fillStyle = '#b6c9be';
  ctx.font = '15px sans-serif';
  lines(
    ctx,
    `Connect: ${p.profile.connectUrl || 'Ask me after the race'}`,
    42,
    620,
    870,
    1,
    19,
  );
  lines(
    ctx,
    `Profile: ${p.profile.profileUrl || 'Meet me in the room'}`,
    42,
    647,
    870,
    1,
    19,
  );
  ctx.fillStyle = '#829d91';
  ctx.font = '12px sans-serif';
  ctx.fillText(
    'MaleCNS / CC-BY 4.0 · Simulated activity · Style describes gameplay, not biology or personality.',
    42,
    689,
  );
}
export function replayFrame(p: Racer, index: number): NeuralFrame | undefined {
  return p.neuralReplay.length
    ? p.neuralReplay[index % p.neuralReplay.length]
    : undefined;
}
export async function exportSocialCard(
  p: Racer,
  circuit: Circuit,
  avatar: CanvasImageSource | null,
  raceClock: number,
  format: 'png' | 'gif',
  progress: (n: number) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  if (format === 'png') {
    const best = p.neuralReplay.reduce<NeuralFrame | undefined>(
      (best, frame) =>
        !best || frame.spikes.length > best.spikes.length ? frame : best,
      undefined,
    );
    drawSocialCard(ctx, p, circuit, avatar, best, raceClock);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error('PNG export failed'))),
        'image/png',
      ),
    );
  }
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const encoder = GIFEncoder();
  const scaled = document.createElement('canvas');
  scaled.width = 640;
  scaled.height = 480;
  const small = scaled.getContext('2d', { willReadFrequently: true })!;
  const count = Math.max(1, p.neuralReplay.length);
  for (let i = 0; i < count; i++) {
    drawSocialCard(ctx, p, circuit, avatar, replayFrame(p, i), raceClock);
    small.drawImage(canvas, 0, 0, 640, 480);
    const rgba = small.getImageData(0, 0, 640, 480).data,
      palette = quantize(rgba, 256);
    const next = p.neuralReplay[i + 1],
      current = p.neuralReplay[i];
    encoder.writeFrame(applyPalette(rgba, palette), 640, 480, {
      palette,
      delay:
        next && current ? Math.max(20, (next.at - current.at) * 1000) : 100,
      repeat: 0,
    });
    progress(Math.round(((i + 1) / count) * 100));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  encoder.finish();
  return new Blob([new Uint8Array(encoder.bytes())], { type: 'image/gif' });
}
