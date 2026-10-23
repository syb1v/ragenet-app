import type { ParticleMode, ParticleSphereSimulation } from '@ragenet/particles';
import { useEffect, useRef, useState } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

interface ParticleRendererProps {
  simulation: ParticleSphereSimulation;
  size: number;
  surfaceSize?: number;
  mode: ParticleMode;
  frameRate?: number;
}

const PROBE_COLOR: [number, number, number] = [104, 211, 255];

function mixColor(
  base: [number, number, number],
  target: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    base[0] + (target[0] - base[0]) * amount,
    base[1] + (target[1] - base[1]) * amount,
    base[2] + (target[2] - base[2]) * amount,
  ];
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
export function ParticleRenderer({
  simulation,
  size,
  surfaceSize,
  mode,
  frameRate = 60,
}: ParticleRendererProps) {
  const surface = surfaceSize ?? size;
  const offset = (surface - size) / 2;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const colorRef = useRef<[number, number, number]>([118, 137, 166]);
  const glowRef = useRef(0.08);
  const [visual, setVisual] = useState<{
    paths: [string, string, string];
    color: string;
    glow: number;
    strokeWidth: number;
    waveRing: { x: number; y: number; r: number; opacity: number } | null;
  }>({
    paths: ['', '', ''],
    color: 'rgb(118, 137, 166)',
    glow: 0.08,
    strokeWidth: 1.2,
    waveRing: null,
  });
  const { color, glow, paths, strokeWidth, waveRing } = visual;

  useEffect(() => {
    let animation = 0;
    let last = Date.now();
    let lastPaint = 0;
    const paintInterval = 1000 / Math.max(60, Math.min(120, frameRate));

    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      simulation.update(dt);

      if (now - lastPaint >= paintInterval) {
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
        const paths: [string, string, string] = [
          buckets[0].join(''),
          buckets[1].join(''),
          buckets[2].join(''),
        ];

        const probe = simulation.probeLevel;
        const target = mixColor(
          colorForMode(modeRef.current, simulation.charge),
          PROBE_COLOR,
          probe * 0.42,
        );
        const current = colorRef.current;
        const blend = Math.min(1, dt * 1.8);
        for (let channel = 0; channel < 3; channel += 1) {
          current[channel] += (target[channel] - current[channel]) * blend;
        }
        const boost = simulation.reaction * 26;
        const color = `rgb(${Math.min(255, Math.round(current[0] + boost))}, ${Math.min(
          255,
          Math.round(current[1] + boost),
        )}, ${Math.min(255, Math.round(current[2] + boost))})`;
        const strokeWidth =
          1.35 + simulation.charge * 0.35 + simulation.reaction * 0.15 + probe * 0.24;
        const targetGlow =
          (modeRef.current === 'connected' ? 0.24 : 0.03 + simulation.charge * 0.18) +
          simulation.burstGlow * 0.16 +
          probe * 0.14;
        glowRef.current += (targetGlow - glowRef.current) * Math.min(1, dt * 1.8);
        const wave = simulation.getWave();
        const waveRing = wave
          ? {
              x: offset + size / 2 + (wave.x * 2 - 1) * size * 0.37,
              y: offset + size / 2 + (wave.y * 2 - 1) * size * 0.37,
              r: wave.progress * size * 1.22,
              opacity: (1 - wave.progress) ** 1.5 * 0.07 * wave.strength,
            }
          : null;
        setVisual({
          paths,
          color,
          strokeWidth,
          glow: glowRef.current,
          waveRing,
        });
      }

      animation = requestAnimationFrame(loop);
    };

    animation = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animation);
  }, [frameRate, offset, simulation, size]);

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
