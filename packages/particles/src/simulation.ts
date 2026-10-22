export type ParticleMode = 'idle' | 'connecting' | 'connected';

export interface ParticleSphereOptions {
  count?: number;
  seed?: number;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Deterministic, renderer-agnostic particle sphere.
 *
 * The simulation runs on the JS thread for the prototype. The renderer only
 * reads `project()` output, so it can be swapped for a Skia worklet renderer
 * later without changing the physical model.
 */
export class ParticleSphereSimulation {
  readonly count: number;

  private readonly base: Float32Array;
  private readonly position: Float32Array;
  private readonly velocity: Float32Array;
  private readonly phase: Float32Array;
  private readonly pointSize: Float32Array;
  private readonly projected: Float32Array;

  private time = 0;
  private rotationX = 0;
  private rotationY = 0;
  private spinX = 0;
  private spinY = 0;
  private pointerStrength = 0;
  private pointerTargetStrength = 0;
  private pointerEnergy = 0;
  private pointerX = 0.5;
  private pointerY = 0.5;
  private autoSpin = 0.07;
  private jitterLevel = 0.0025;
  private radiusLevel = 1;
  private chargeLevel = 0;
  private reactionTime = 0;
  private reactionStrength = 0;
  private reactionActive = false;
  private waveAge = 0;
  private waveX = 0.5;
  private waveY = 0.5;
  private waveStrength = 0;
  private gatherLevel = 0;
  private vibrationLevel = 0;
  private vibrationTarget = 0;

  mode: ParticleMode = 'idle';
  charge = 0;
  impulse = 0;
  /** 0 = resting sphere, 1 = fully gathered for the burst. */
  gather = 0;
  /** Short-lived flash used by renderers after the release. */
  burstGlow = 0;
  /** Smooth 0→1→0 response used for glow, size and a soft ripple. */
  reaction = 0;

  constructor(options: ParticleSphereOptions = {}) {
    this.count = options.count ?? 1200;
    this.base = new Float32Array(this.count * 3);
    this.position = new Float32Array(this.count * 3);
    this.velocity = new Float32Array(this.count * 3);
    this.phase = new Float32Array(this.count);
    this.pointSize = new Float32Array(this.count);
    this.projected = new Float32Array(this.count * 4);

    const random = mulberry32(options.seed ?? 0x5eed);

    for (let index = 0; index < this.count; index += 1) {
      // A deterministic Fibonacci shell: golden-angle spacing, a quiet depth
      // layer, and only a few pixels of seeded jitter so the lattice reads as
      // an organic sphere rather than a generated grid.
      const y = 1 - ((index + 0.5) / Math.max(1, this.count)) * 2;
      const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * GOLDEN_ANGLE;

      let x = Math.cos(theta) * ringRadius;
      let yy = y;
      let z = Math.sin(theta) * ringRadius;

      const jitter = 0.012 + random() * 0.035;
      x += (random() - 0.5) * jitter;
      yy += (random() - 0.5) * jitter;
      z += (random() - 0.5) * jitter;
      const length = Math.max(0.001, Math.hypot(x, yy, z));
      x /= length;
      yy /= length;
      z /= length;

      const shellRoll = random();
      const radius =
        shellRoll < 0.84
          ? 0.965 + random() * 0.045
          : shellRoll < 0.96
            ? 0.82 + random() * 0.07
            : 0.68 + random() * 0.08;
      const offset = index * 3;
      this.base[offset] = x * radius;
      this.base[offset + 1] = yy * radius;
      this.base[offset + 2] = z * radius;

      this.position[offset] = this.base[offset];
      this.position[offset + 1] = this.base[offset + 1];
      this.position[offset + 2] = this.base[offset + 2];

      this.velocity[offset] = (random() - 0.5) * 0.02;
      this.velocity[offset + 1] = (random() - 0.5) * 0.02;
      this.velocity[offset + 2] = (random() - 0.5) * 0.02;

      this.phase[index] = random() * TAU;
      this.pointSize[index] = 0.82 + random() * 0.62;
    }
  }

  setPointer(x: number | null, y: number | null): void {
    if (x == null || y == null) {
      this.pointerTargetStrength = 0;
      return;
    }
    this.pointerTargetStrength = 1;
    this.pointerX = clamp(x, 0, 1);
    this.pointerY = clamp(y, 0, 1);
  }

  addSpin(deltaX: number, deltaY: number): void {
    this.spinY = clamp(this.spinY + deltaX * 1.6, -3, 3);
    this.spinX = clamp(this.spinX + deltaY * 1.1, -2.2, 2.2);
  }

  /** Local shiver around the finger while it moves across the sphere. */
  addPointerEnergy(value: number): void {
    this.pointerEnergy = clamp(this.pointerEnergy + value, 0, 1);
  }

  addImpulse(strength = 1): void {
    this.impulse = clamp(this.impulse + strength, 0, 1.8);
  }

  /**
   * A deliberate, smooth response to a user action or connection state change.
   * Unlike `addImpulse`, this never starts with a discontinuity.
   */
  triggerReaction(strength = 1): void {
    this.reactionStrength = clamp(strength, 0, 1.5);
    this.reactionTime = 0;
    this.reactionActive = true;
  }

  setCharge(value: number): void {
    this.charge = clamp(value, 0, 1);
  }

  /** Smoothly gather the whole cloud toward the centre before the release. */
  setGather(value: number): void {
    this.gatherLevel = clamp(value, 0, 1);
    this.gather = this.gatherLevel;
  }

  /** Visual tremble envelope. Kept separate from charge so it can ramp slowly. */
  setVibration(value: number): void {
    this.vibrationTarget = clamp(value, 0, 1.2);
  }

  /**
   * Release the gathered cloud with a short radial impulse. The normal spring
   * then produces a damped overshoot instead of a linear scale animation.
   */
  triggerBurst(strength = 1): void {
    this.burstGlow = clamp(strength, 0, 1.5);
    const power = 1.35 * clamp(strength, 0, 1.5);
    for (let index = 0; index < this.count; index += 1) {
      const offset = index * 3;
      const x = this.position[offset];
      const y = this.position[offset + 1];
      const z = this.position[offset + 2];
      const length = Math.max(0.001, Math.hypot(x, y, z));
      const variation = 0.72 + (this.phase[index] / TAU) * 0.56;
      this.velocity[offset] += (x / length) * power * variation;
      this.velocity[offset + 1] += (y / length) * power * variation;
      this.velocity[offset + 2] += (z / length) * power * variation;
    }
  }

  /** Start a liquid ripple from a normalized point on the sphere. */
  triggerWave(x: number, y: number, strength = 1): void {
    this.waveX = clamp(x, 0, 1);
    this.waveY = clamp(y, 0, 1);
    this.waveAge = 0;
    this.waveStrength = clamp(strength, 0, 1.4);
  }

  setMode(mode: ParticleMode): void {
    this.mode = mode;
  }

  update(dt: number): void {
    const step = clamp(dt, 0, 0.05);
    this.time += step;
    if (this.waveStrength > 0) {
      this.waveAge += step;
      if (this.waveAge >= 2.2) {
        this.waveStrength = 0;
      }
    }
    this.pointerStrength +=
      (this.pointerTargetStrength - this.pointerStrength) * Math.min(1, step * 14);
    this.pointerEnergy *= Math.exp(-5 * step);
    if (this.pointerEnergy < 0.001) this.pointerEnergy = 0;

    this.chargeLevel += (this.charge - this.chargeLevel) * Math.min(1, step * 8);
    this.vibrationLevel += (this.vibrationTarget - this.vibrationLevel) * Math.min(1, step * 4);

    if (this.reactionActive) {
      this.reactionTime += step;
      const progress = this.reactionTime / 0.56;
      if (progress >= 1) {
        this.reaction = 0;
        this.reactionActive = false;
      } else {
        this.reaction = Math.sin(Math.PI * progress) * this.reactionStrength;
      }
    }

    // Blend mode-dependent parameters instead of switching them abruptly.
    // This keeps the sphere from twitching when the connection state changes.
    const targetSpin =
      (this.mode === 'connecting' ? 0.32 : this.mode === 'connected' ? 0.16 : 0.07) +
      this.reaction * 0.2;
    this.autoSpin += (targetSpin - this.autoSpin) * Math.min(1, step * 4);
    this.rotationY += (this.autoSpin + this.spinY) * step;
    this.rotationX += this.spinX * step;
    this.spinY *= Math.exp(-4 * step);
    this.spinX *= Math.exp(-4 * step);

    const cosX = Math.cos(this.rotationX);
    const sinX = Math.sin(this.rotationX);
    const cosY = Math.cos(this.rotationY);
    const sinY = Math.sin(this.rotationY);

    const gatherScale = 1 - this.gatherLevel * 0.44;
    const targetRadius =
      (1 - this.chargeLevel * 0.03 + Math.sin(this.time * 1.1) * 0.003 - this.reaction * 0.02) *
      gatherScale;
    this.radiusLevel += (targetRadius - this.radiusLevel) * Math.min(1, step * 3);

    const stiffness = 18 + this.chargeLevel * 20 + this.gatherLevel * 10;
    const damping = 7 + this.chargeLevel * 3 + this.gatherLevel * 2;
    const targetJitter =
      0.0025 +
      this.vibrationLevel * 0.02 +
      (this.mode === 'connecting' ? 0.004 : 0) +
      (this.mode === 'connected' ? 0.0015 : 0) +
      this.impulse * 0.012;
    this.jitterLevel += (targetJitter - this.jitterLevel) * Math.min(1, step * 4);
    const jitter = this.jitterLevel;

    for (let index = 0; index < this.count; index += 1) {
      const offset = index * 3;
      const bx = this.base[offset];
      const by = this.base[offset + 1];
      const bz = this.base[offset + 2];

      // Rotate the rest position around X, then Y.
      const y1 = by * cosX - bz * sinX;
      const z1 = by * sinX + bz * cosX;
      const x2 = bx * cosY + z1 * sinY;
      const z2 = -bx * sinY + z1 * cosY;

      const targetX = x2 * this.radiusLevel;
      const targetY = y1 * this.radiusLevel;
      const targetZ = z2 * this.radiusLevel;

      const phase = this.phase[index];
      const noiseX = Math.sin(this.time * 2.7 + phase * 3.1) * jitter;
      const noiseY = Math.cos(this.time * 3.1 + phase * 2.3) * jitter;
      const noiseZ = Math.sin(this.time * 2.2 + phase * 4.7) * jitter;

      const px = this.position[offset];
      const py = this.position[offset + 1];
      const pz = this.position[offset + 2];
      const vx = this.velocity[offset];
      const vy = this.velocity[offset + 1];
      const vz = this.velocity[offset + 2];

      let ax = (targetX - px) * stiffness - vx * damping + noiseX;
      let ay = (targetY - py) * stiffness - vy * damping + noiseY;
      let az = (targetZ - pz) * stiffness - vz * damping + noiseZ;

      if (this.impulse > 0.001) {
        const length = Math.max(0.001, Math.hypot(px, py, pz));
        const wave = this.impulse * 1.8;
        ax += (px / length) * wave;
        ay += (py / length) * wave;
        az += (pz / length) * wave;
      }

      const nextVx = vx + ax * step;
      const nextVy = vy + ay * step;
      const nextVz = vz + az * step;
      const nextX = px + nextVx * step;
      const nextY = py + nextVy * step;
      const nextZ = pz + nextVz * step;

      const length = Math.hypot(nextX, nextY, nextZ);
      const scale = length > 1.45 ? 1.45 / length : 1;

      this.velocity[offset] = nextVx;
      this.velocity[offset + 1] = nextVy;
      this.velocity[offset + 2] = nextVz;
      this.position[offset] = nextX * scale;
      this.position[offset + 1] = nextY * scale;
      this.position[offset + 2] = nextZ * scale;
    }

    if (this.burstGlow > 0.001) {
      this.burstGlow *= Math.exp(-2.8 * step);
    } else {
      this.burstGlow = 0;
    }

    this.impulse *= Math.exp(-3.4 * step);
    if (this.impulse < 0.001) this.impulse = 0;
  }

  /** Current wave data for a subtle one-front renderer overlay. */
  getWave(): { x: number; y: number; progress: number; strength: number } | null {
    if (this.waveStrength <= 0.001) return null;
    return {
      x: this.waveX,
      y: this.waveY,
      progress: clamp(this.waveAge / 2.2, 0, 1),
      strength: this.waveStrength,
    };
  }

  /**
   * Project particles into a size×size square.
   * Returns a reused Float32Array: x, y, radius, alpha per particle.
   */
  project(size: number): Float32Array {
    const center = size / 2;
    const radius = size * 0.37;
    const pointerRadius = size * 0.36;
    const pointerScreenX = center + (this.pointerX * 2 - 1) * radius;
    const pointerScreenY = center + (this.pointerY * 2 - 1) * radius;
    const projected = this.projected;

    for (let index = 0; index < this.count; index += 1) {
      const offset = index * 3;
      const x = this.position[offset];
      const y = this.position[offset + 1];
      const z = this.position[offset + 2];
      const perspective = 1 / (1 + z * 0.32);

      let screenX = center + x * radius * perspective;
      let screenY = center + y * radius * perspective;

      if (this.pointerStrength > 0.001) {
        const dx = screenX - pointerScreenX;
        const dy = screenY - pointerScreenY;
        const distance = Math.hypot(dx, dy);
        if (distance < pointerRadius && distance > 0.001) {
          const force =
            (1 - distance / pointerRadius) ** 2 *
            pointerRadius *
            0.13 *
            this.pointerStrength *
            (1 - this.gatherLevel * 0.82);
          screenX += (dx / distance) * force;
          screenY += (dy / distance) * force;
        }
      }

      if (this.impulse > 0) {
        const dx = screenX - center;
        const dy = screenY - center;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const force = this.impulse * 9 * (0.4 + (z + 1) * 0.3);
        screenX += (dx / distance) * force;
        screenY += (dy / distance) * force;
      }

      if (this.pointerEnergy > 0.001 && this.pointerStrength > 0.001) {
        const dx = screenX - pointerScreenX;
        const dy = screenY - pointerScreenY;
        const distance = Math.hypot(dx, dy);
        const proximity = Math.max(0, 1 - distance / pointerRadius);
        if (proximity > 0) {
          const shiver = this.pointerEnergy * 2.8 * proximity;
          const shiverPhase = this.phase[index];
          screenX += Math.sin(this.time * 49 + shiverPhase * 17) * shiver;
          screenY += Math.cos(this.time * 43 + shiverPhase * 23) * shiver;
        }
      }

      let waveBoost = 0;
      if (this.waveStrength > 0) {
        const waveOriginX = center + (this.waveX * 2 - 1) * radius;
        const waveOriginY = center + (this.waveY * 2 - 1) * radius;
        const dx = screenX - waveOriginX;
        const dy = screenY - waveOriginY;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const progress = clamp(this.waveAge / 2.2, 0, 1);
        const front = progress * size * 1.22;
        const thickness = size * 0.12 + this.waveAge * size * 0.012;
        const angle = Math.atan2(dy, dx);
        const organicFront =
          1 +
          Math.sin(angle * 3.1 + this.time * 0.8) * 0.035 +
          Math.sin(angle * 6.7 - this.time * 0.6) * 0.018;
        const gaussian = Math.exp(-(((distance - front * organicFront) / thickness) ** 2));
        const envelope = Math.min(1, this.waveAge / 0.28) * (1 - progress) ** 1.5;
        const displacement = gaussian * envelope * size * 0.1 * this.waveStrength;
        waveBoost = gaussian * envelope * this.waveStrength;
        screenX += (dx / distance) * displacement;
        screenY += (dy / distance) * displacement;
      }

      const depth = clamp((z + 1) / 2, 0, 1);

      if (this.reaction > 0.001) {
        const dx = screenX - center;
        const dy = screenY - center;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const force = this.reaction * 5 * (0.25 + depth * 0.75);
        screenX += (dx / distance) * force;
        screenY += (dy / distance) * force;
      }

      // Charge feedback is a deliberate high-frequency tremble. It is applied
      // in screen space so it never destabilises the spring simulation.
      if (this.vibrationLevel > 0.001) {
        const tremble = this.vibrationLevel * 5.2;
        const phase = this.phase[index];
        const speed = 0.55 + this.vibrationLevel * 0.95;
        const tremorX =
          Math.sin(this.time * (10 + phase * 4) * speed + phase * 19) +
          Math.sin(this.time * (17 + phase * 3) * speed + phase * 7) * 0.35;
        const tremorY =
          Math.cos(this.time * (9 + phase * 5) * speed + phase * 23) +
          Math.cos(this.time * (15 + phase * 4) * speed + phase * 11) * 0.3;
        screenX += tremorX * tremble;
        screenY += tremorY * tremble;
      }

      const output = index * 4;
      projected[output] = screenX;
      projected[output + 1] = screenY;
      projected[output + 2] =
        (0.44 + depth * 1.15 + this.chargeLevel * 0.08) *
        (size / 300) *
        this.pointSize[index] *
        (1 + this.reaction * 0.18 + this.burstGlow * 0.2);
      projected[output + 3] = Math.min(
        1,
        0.38 +
          depth * 0.56 +
          this.reaction * 0.08 +
          this.chargeLevel * 0.08 +
          waveBoost * 0.03 +
          this.burstGlow * 0.16,
      );
    }

    return projected;
  }
}
