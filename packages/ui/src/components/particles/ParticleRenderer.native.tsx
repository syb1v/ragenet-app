import type { ParticleMode, ParticleSphereSimulation } from '@ragenet/particles';
import { useEffect, useRef, useState } from 'react';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

interface ParticleRendererProps {
  simulation: ParticleSphereSimulation;
  size: number;
  mode: ParticleMode;
}

function colorForMode(mode: ParticleMode, charge: number): [number, number, number] {
  if (mode === 'connected') return [196, 202, 240];
  if (charge > 0.01) return [178, 157, 255];
  if (mode === 'connecting') return [177, 157, 255];
  return [174, 178, 187];
}

/**
 * Android renderer without the Skia native build. One SVG path contains a
 * tiny round-capped segment per particle; this keeps the same simulation and
 * a visually equivalent point cloud while avoiding a long CMake step in CI.
 */
export function ParticleRenderer({ simulation, size, mode }: ParticleRendererProps) {
  const [path, setPath] = useState('');
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
        const commands: string[] = [];
        for (let index = 0; index < projected.length; index += 4) {
          const x = projected[index].toFixed(1);
          const y = projected[index + 1].toFixed(1);
          commands.push(`M${x} ${y}l0.01 0`);
        }
        setPath(commands.join(''));

        const target = colorForMode(mode, simulation.charge);
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
        setStrokeWidth(1.05 + simulation.charge * 0.45 + simulation.reaction * 0.2);
      }

      animation = requestAnimationFrame(loop);
    };

    animation = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animation);
  }, [simulation, size]);

  const glow = mode === 'connected' ? 0.24 : 0.03 + simulation.charge * 0.18;

  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="particleGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#9b8bff" stopOpacity={glow} />
          <Stop offset="0.5" stopColor="#6457cc" stopOpacity={glow * 0.22} />
          <Stop offset="1" stopColor="#0d0b18" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size * 0.48} fill="url(#particleGlow)" />
      <Path d={path} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
