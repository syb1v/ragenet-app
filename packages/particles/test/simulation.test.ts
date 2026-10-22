import { describe, expect, it } from 'vitest';
import { ParticleSphereSimulation } from '../src';

describe('ParticleSphereSimulation', () => {
  it('creates a deterministic cloud', () => {
    const a = new ParticleSphereSimulation({ count: 64, seed: 7 });
    const b = new ParticleSphereSimulation({ count: 64, seed: 7 });
    for (let i = 0; i < 20; i += 1) {
      a.update(1 / 60);
      b.update(1 / 60);
    }
    const pa = a.project(300);
    const pb = b.project(300);
    expect(Array.from(pa)).toEqual(Array.from(pb));
  });

  it('reports every trembling particle in the haptic snapshot', () => {
    const simulation = new ParticleSphereSimulation({ count: 128, seed: 41 });
    expect(simulation.getHapticSnapshot()).toEqual({
      energy: 0,
      density: 0,
      frequency: 0,
      activeCount: 0,
    });

    simulation.setVibration(1);
    for (let i = 0; i < 180; i += 1) simulation.update(1 / 60);
    const snapshot = simulation.getHapticSnapshot();

    expect(snapshot.activeCount).toBe(128);
    expect(snapshot.density).toBe(1);
    expect(snapshot.energy).toBeGreaterThan(0.9);
    expect(snapshot.frequency).toBeGreaterThan(0);
  });

  it('stays finite under charge, impulse and drag', () => {
    const simulation = new ParticleSphereSimulation({ count: 128, seed: 11 });
    simulation.setPointer(0.8, 0.2);
    simulation.addSpin(0.4, -0.2);
    simulation.addImpulse(1.2);
    simulation.setCharge(1);
    simulation.setMode('connecting');

    for (let i = 0; i < 240; i += 1) simulation.update(1 / 60);
    const projected = simulation.project(300);

    expect(projected).toHaveLength(128 * 4);
    for (const value of projected) expect(Number.isFinite(value)).toBe(true);
  });

  it('does not jerk when the connection mode changes', () => {
    const simulation = new ParticleSphereSimulation({ count: 96, seed: 19 });
    for (let i = 0; i < 180; i += 1) simulation.update(1 / 60);

    const before = Float32Array.from(simulation.project(300));
    simulation.setMode('connecting');
    simulation.update(1 / 60);
    const after = simulation.project(300);

    let maxShift = 0;
    for (let i = 0; i < before.length; i += 4) {
      maxShift = Math.max(maxShift, Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1]));
    }
    expect(maxShift).toBeLessThan(3);
  });

  it('reacts in a smooth envelope without a one-frame jump', () => {
    const simulation = new ParticleSphereSimulation({ count: 96, seed: 31 });
    for (let i = 0; i < 120; i += 1) simulation.update(1 / 60);

    simulation.triggerReaction(1.2);
    let previous = Float32Array.from(simulation.project(300));
    let maxShift = 0;

    for (let frame = 0; frame < 60; frame += 1) {
      simulation.update(1 / 60);
      const current = Float32Array.from(simulation.project(300));
      for (let i = 0; i < current.length; i += 4) {
        maxShift = Math.max(
          maxShift,
          Math.hypot(current[i] - previous[i], current[i + 1] - previous[i + 1]),
        );
      }
      previous = current;
    }

    expect(maxShift).toBeLessThan(5);
    expect(simulation.reaction).toBe(0);
  });

  it('fades pointer influence instead of snapping particles back', () => {
    const simulation = new ParticleSphereSimulation({ count: 96, seed: 23 });
    for (let i = 0; i < 120; i += 1) simulation.update(1 / 60);
    simulation.setPointer(0.68, 0.42);
    for (let i = 0; i < 30; i += 1) simulation.update(1 / 60);

    const before = Float32Array.from(simulation.project(300));
    simulation.setPointer(null, null);
    simulation.update(1 / 60);
    const after = simulation.project(300);

    let maxShift = 0;
    for (let i = 0; i < before.length; i += 4) {
      maxShift = Math.max(maxShift, Math.hypot(after[i] - before[i], after[i + 1] - before[i + 1]));
    }
    expect(maxShift).toBeLessThan(4);
  });

  it('projects inside a reasonable square', () => {
    const simulation = new ParticleSphereSimulation({ count: 32, seed: 3 });
    for (let i = 0; i < 30; i += 1) simulation.update(1 / 60);
    const projected = simulation.project(300);
    for (let i = 0; i < projected.length; i += 4) {
      expect(projected[i]).toBeGreaterThan(0);
      expect(projected[i]).toBeLessThan(300);
      expect(projected[i + 1]).toBeGreaterThan(0);
      expect(projected[i + 1]).toBeLessThan(300);
    }
  });
});
