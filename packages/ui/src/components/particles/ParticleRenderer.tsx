import type { ParticleMode, ParticleSphereSimulation } from '@ragenet/particles';
import { useEffect, useRef } from 'react';

interface ParticleRendererProps {
  simulation: ParticleSphereSimulation;
  size: number;
  surfaceSize?: number;
  mode: ParticleMode;
}

function palette(mode: ParticleMode, charge: number): [number, number, number] {
  if (mode === 'connected') return [196, 202, 240];
  if (charge > 0.01) return [178, 157, 255];
  if (mode === 'connecting') return [177, 157, 255];
  return [174, 178, 187];
}

/**
 * Web renderer: Canvas2D with additive blending.
 *
 * The canvas is created through createElement so this file can live inside a
 * react-native-web tree without pulling a DOM-only component into native.
 */
export function ParticleRenderer({ simulation, size, surfaceSize, mode }: ParticleRendererProps) {
  const surface = surfaceSize ?? size;
  const offset = (surface - size) / 2;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorRef = useRef<[number, number, number]>([118, 137, 166]);
  const glowRef = useRef(0.08);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    canvas.width = Math.round(surface * dpr);
    canvas.height = Math.round(surface * dpr);
    const context = canvas.getContext('2d');
    if (!context) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    let frame = 0;
    let last = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let animation = 0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      simulation.update(dt);
      frame += 1;

      const center = size / 2;
      context.clearRect(0, 0, surface, surface);
      context.save();
      context.translate(offset, offset);

      const blend = Math.min(1, dt * 1.8);
      const reaction = simulation.reaction;
      const charge = simulation.charge;
      const targetGlow =
        (modeRef.current === 'connected' ? 0.25 : modeRef.current === 'connecting' ? 0.16 : 0.06) +
        charge * 0.16 +
        simulation.burstGlow * 0.2 +
        reaction * 0.08;
      glowRef.current += (targetGlow - glowRef.current) * blend;

      const glow = context.createRadialGradient(center, center, 0, center, center, size * 0.48);
      glow.addColorStop(0, `rgba(155, 139, 255, ${glowRef.current})`);
      glow.addColorStop(0.45, 'rgba(100, 87, 204, 0.035)');
      glow.addColorStop(1, 'rgba(108, 121, 219, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);

      context.globalCompositeOperation = 'lighter';
      const targetColor = palette(modeRef.current, charge);
      const color = colorRef.current;
      for (let channel = 0; channel < 3; channel += 1) {
        color[channel] += (targetColor[channel] - color[channel]) * blend;
      }
      const [red, green, blue] = color;
      const boost = reaction * 26;
      const renderRed = Math.min(255, Math.round(red + boost));
      const renderGreen = Math.min(255, Math.round(green + boost));
      const renderBlue = Math.min(255, Math.round(blue + boost));
      const points = simulation.project(size);

      for (let index = 0; index < points.length; index += 4) {
        const x = points[index];
        const y = points[index + 1];
        const radius = Math.max(0.25, points[index + 2]);
        const alpha = points[index + 3];
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${renderRed}, ${renderGreen}, ${renderBlue}, ${alpha})`;
        context.fill();
      }

      context.globalCompositeOperation = 'source-over';

      // A tiny deterministic twinkle every few frames keeps the sphere alive.
      if (modeRef.current !== 'connecting' && frame % 3 === 0) {
        context.beginPath();
        context.arc(center, center, 1.2, 0, Math.PI * 2);
        context.fillStyle = 'rgba(255, 255, 255, 0.4)';
        context.fill();
      }

      context.restore();
      animation = requestAnimationFrame(draw);
    };

    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [simulation, size, surface, offset]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ width: surface, height: surface, display: 'block' }}
    />
  );
}
