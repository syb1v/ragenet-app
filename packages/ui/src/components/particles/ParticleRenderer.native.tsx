import { Canvas, Points, type SkPoint } from '@shopify/react-native-skia';
import type { ParticleMode, ParticleSphereSimulation } from '@ragenet/particles';
import { useEffect, useRef, useState } from 'react';

interface ParticleRendererProps {
  simulation: ParticleSphereSimulation;
  size: number;
  mode: ParticleMode;
}

function colorForMode(mode: ParticleMode): [number, number, number] {
  if (mode === 'connected') return [144, 156, 255];
  if (mode === 'connecting') return [177, 157, 255];
  return [118, 137, 166];
}

/**
 * Native renderer. This is intentionally a small bridge around the same
 * simulation as the web renderer. The next step is moving the update loop
 * into a Reanimated worklet and passing a SharedValue<SkPoint[]> to Skia.
 */
export function ParticleRenderer({ simulation, size, mode }: ParticleRendererProps) {
  const [points, setPoints] = useState<SkPoint[]>([]);
  const colorRef = useRef<[number, number, number]>([118, 137, 166]);
  const [color, setColor] = useState('rgb(118, 137, 166)');
  const [strokeWidth, setStrokeWidth] = useState(1.2);

  useEffect(() => {
    let animation = 0;
    let last = Date.now();
    let lastPaint = 0;

    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      simulation.update(dt);

      if (now - lastPaint >= 33) {
        lastPaint = now;
        const projected = simulation.project(size);
        const next: SkPoint[] = [];
        for (let index = 0; index < projected.length; index += 4) {
          next.push({ x: projected[index], y: projected[index + 1] });
        }
        setPoints(next);

        const target = colorForMode(mode);
        const current = colorRef.current;
        const blend = Math.min(1, dt * 4);
        for (let channel = 0; channel < 3; channel += 1) {
          current[channel] += (target[channel] - current[channel]) * blend;
        }
        const boost = simulation.reaction * 26;
        setColor(
          `rgb(${Math.min(255, Math.round(current[0] + boost))}, ${Math.min(
            255,
            Math.round(current[1] + boost),
          )}, ${Math.min(255, Math.round(current[2] + boost))})`,
        );
        setStrokeWidth(1.2 + simulation.reaction * 0.25);
      }

      animation = requestAnimationFrame(loop);
    };

    animation = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animation);
  }, [simulation, size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Points
        points={points}
        mode="points"
        color={color}
        strokeWidth={strokeWidth}
        strokeCap="round"
      />
    </Canvas>
  );
}
