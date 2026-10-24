import { useEffect, useRef } from 'react';

type Blob = [number, number, string];
type WaveLayer = [number, number, number, number, string];

const DARK_BLOBS: Blob[] = [
  [0.72, 0.3, 'rgba(124, 156, 255, 0.2)'],
  [0.25, 0.42, 'rgba(167, 139, 250, 0.16)'],
  [0.5, 0.16, 'rgba(40, 139, 145, 0.14)'],
];
const LIGHT_BLOBS: Blob[] = [
  [0.78, 0.34, 'rgba(255, 205, 140, 0.5)'],
  [0.2, 0.2, 'rgba(124, 156, 255, 0.18)'],
  [0.55, 0.4, 'rgba(40, 139, 145, 0.1)'],
];
const DARK_WAVES: WaveLayer[] = [
  [0.66, 0.011, 26, 0.00016, 'rgba(91, 120, 232, 0.1)'],
  [0.74, 0.013, 20, 0.00012, 'rgba(40, 139, 145, 0.1)'],
  [0.82, 0.009, 30, 0.0002, 'rgba(124, 156, 255, 0.08)'],
];
const LIGHT_WAVES: WaveLayer[] = [
  [0.68, 0.011, 22, 0.00016, 'rgba(91, 120, 232, 0.13)'],
  [0.76, 0.013, 18, 0.00012, 'rgba(40, 139, 145, 0.11)'],
  [0.85, 0.009, 26, 0.0002, 'rgba(70, 102, 220, 0.09)'],
];

function draw(canvas: HTMLCanvasElement, time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (dark) {
    sky.addColorStop(0, '#101625');
    sky.addColorStop(0.55, '#141d31');
    sky.addColorStop(1, '#0e1524');
  } else {
    sky.addColorStop(0, '#dce9f8');
    sky.addColorStop(0.6, '#eef4fb');
    sky.addColorStop(1, '#f6f9fd');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  (dark ? DARK_BLOBS : LIGHT_BLOBS).forEach(([x, y, color], index) => {
    const radius = Math.max(w, h) * 0.42;
    const cx = w * (x + Math.sin(time * 0.00006 + index * 2.1) * 0.04);
    const cy = h * (y + Math.cos(time * 0.00005 + index * 1.7) * 0.05);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  });

  (dark ? DARK_WAVES : LIGHT_WAVES).forEach(([base, freq, amp, speed, color], index) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y =
        h * base +
        Math.sin(x * freq + time * speed + index * 1.9) * amp +
        Math.sin(x * freq * 0.5 + time * speed * 0.6) * amp * 0.6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  });
}

export function AmbientBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let running = false;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(canvas, performance.now());
    };
    const loop = (time: number) => {
      if (!running) return;
      draw(canvas, time);
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas.parentElement ?? canvas);
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!reduced) start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const themeWatcher =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => draw(canvas, performance.now()))
        : null;
    themeWatcher?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    if (reduced) draw(canvas, 0);
    else start();

    return () => {
      stop();
      observer?.disconnect();
      themeWatcher?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="hero-ambient" aria-hidden="true" />;
}
