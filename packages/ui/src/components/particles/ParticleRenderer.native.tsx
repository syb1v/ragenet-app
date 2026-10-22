import type { ParticleMode, ParticleSphereSimulation } from '@ragenet/particles';
import { useEffect, useRef, useState } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

interface ParticleRendererProps {
  simulation: ParticleSphereSimulation;
  size: number;
  surfaceSize?: number;
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
export function ParticleRenderer({ simulation, size, surfaceSize, mode }: ParticleRendererProps) {
  const surface = surfaceSize ?? size;
  const offset = (surface - size) / 2;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [paths, setPaths] = useState<[string, string, string]>(['', '', '']);
  const colorRef = useRef<[number, number, number]>([118, 137, 166]);
  const glowRef = useRef(0.08);
  const [glow, setGlow] = useState(0.08);
  const [color, setColor] = useState('rgb(118, 137, 166)');
  const [strokeWidth, setStrokeWidth] = useState(1.2);
  const [waveRing, setWaveRing] = useState<{
    x: number;
    y: number;
    r: number;
    opacity: number;
  } | null>(null);

  useEffect(() => {
    let animation = 0;
    let last = Date.now();
    let lastPaint = 0;

    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      simulation.update(dt);

      if (now - lastPaint >= 16) {
        lastPaint = now;
        const projected = simulation.project(size);
        const buckets: [string[], string[], string[]] = [[], [], []];
        for (let index = 0; index < projected.length; index += 4) {
          const x = (projected[index] + offset).toFixed(1);
          const y = (projected[index + 1] + offset).toFixed(1);
          const radius = projected[index + 2];
          const bucket = radius < 1.1 ? 0 : radius < 1.75 ? 1 : 2;
          buckets[bucket].push(`M${x} ${y}l0.01 0`);
        }
        setPaths([buckets[0].join(''), buckets[1].join(''), buckets[2].join('')]);

        const target = colorForMode(modeRef.current, simulation.charge);
        const current = colorRef.current;
        const blend = Math.min(1, dt * 1.8);
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
        setStrokeWidth(1.35 + simulation.charge * 0.35 + simulation.reaction * 0.15);
        const targetGlow =
          (modeRef.current === 'connected' ? 0.24 : 0.03 + simulation.charge * 0.18) +
          simulation.burstGlow * 0.16;
        glowRef.current += (targetGlow - glowRef.current) * Math.min(1, dt * 1.8);
        setGlow(glowRef.current);
        const wave = simulation.getWave();
        setWaveRing(
          wave
            ? {
                x: offset + size / 2 + (wave.x * 2 - 1) * size * 0.37,
                y: offset + size / 2 + (wave.y * 2 - 1) * size * 0.37,
                r: wave.progress * size * 1.22,
                opacity: (1 - wave.progress) ** 1.5 * 0.07 * wave.strength,
              }
            : null,
        );
      }

      animation = requestAnimationFrame(loop);
    };

    animation = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animation);
  }, [offset, simulation, size]);

  return (
    <Svg width={surface} height={surface}>
      <Defs>
        <RadialGradient id="particleGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#9b8bff" stopOpacity={glow} />
          <Stop offset="0.5" stopColor="#6457cc" stopOpacity={glow * 0.22} />
          <Stop offset="1" stopColor="#0d0b18" stopOpacity="0" />
        </RadialGradient>
        <ClipPath id="particleClip">
          <Circle cx={offset + size / 2} cy={offset + size / 2} r={size * 0.37} />
        </ClipPath>
      </Defs>
      <Circle
        cx={offset + size / 2}
        cy={offset + size / 2}
        r={size * 0.48}
        fill="url(#particleGlow)"
      />
      <Path
        d={paths[0]}
        stroke={color}
        strokeWidth={strokeWidth * 0.78}
        strokeOpacity={0.58}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={paths[1]}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={0.82}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={paths[2]}
        stroke={color}
        strokeWidth={strokeWidth * 1.3}
        strokeLinecap="round"
        fill="none"
      />
      {waveRing && waveRing.opacity > 0.004 ? (
        <G clipPath="url(#particleClip)">
          <Circle
            cx={waveRing.x}
            cy={waveRing.y}
            r={waveRing.r}
            fill="none"
            stroke="#d8d1ff"
            strokeWidth={1}
            opacity={waveRing.opacity}
          />
        </G>
      ) : null}
    </Svg>
  );
}
