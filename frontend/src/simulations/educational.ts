import type { Observables, ParticleState, PotentialConfig } from "../types/physics";

const EPS = 1e-12;

function distanceVector(a: ParticleState, b: ParticleState): [number, number, number] {
  return [
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2]
  ];
}

function norm(v: [number, number, number]): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
}

function forceMagnitude(distance: number, potential: PotentialConfig): number {
  const r = Math.max(
    Math.sqrt(distance * distance + potential.softening * potential.softening),
    potential.min_distance
  );
  return Math.min(
    potential.coulomb_strength / (r * r) + potential.string_tension,
    potential.energy_limit
  );
}

function potentialEnergy(distance: number, potential: PotentialConfig): number {
  const r = Math.max(
    Math.sqrt(distance * distance + potential.softening * potential.softening),
    potential.min_distance
  );
  return Math.max(
    -potential.energy_limit,
    Math.min(-potential.coulomb_strength / r + potential.string_tension * r, potential.energy_limit)
  );
}

// Phenomenological short-range core, not part of the Cornell potential: without it,
// nothing stops particles from overlapping/passing through each other (dV/dr >= 0 everywhere
// for the pure Cornell potential). Only applied when repulsion_enabled is on.
function repulsiveForceMagnitude(distance: number, potential: PotentialConfig): number {
  if (!potential.repulsion_enabled || potential.repulsion_strength <= 0) return 0;
  const r = Math.max(
    Math.sqrt(distance * distance + potential.softening * potential.softening),
    potential.min_distance
  );
  return Math.min(potential.repulsion_strength / r ** 6, potential.energy_limit);
}

function repulsivePotential(distance: number, potential: PotentialConfig): number {
  if (!potential.repulsion_enabled || potential.repulsion_strength <= 0) return 0;
  const r = Math.max(
    Math.sqrt(distance * distance + potential.softening * potential.softening),
    potential.min_distance
  );
  return Math.min(potential.repulsion_strength / (5 * r ** 5), potential.energy_limit);
}

function pairwiseForces(particles: ParticleState[], potential: PotentialConfig) {
  const forces = particles.map(() => [0, 0, 0] as [number, number, number]);
  let potentialTotal = 0;
  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const vector = distanceVector(particles[i], particles[j]);
      const d = norm(vector);
      const direction: [number, number, number] =
        d < EPS ? [0, 0, 0] : [vector[0] / d, vector[1] / d, vector[2] / d];
      const magnitude = forceMagnitude(d, potential) - repulsiveForceMagnitude(d, potential);
      const f: [number, number, number] = [
        -magnitude * direction[0],
        -magnitude * direction[1],
        -magnitude * direction[2]
      ];
      forces[i][0] += f[0];
      forces[i][1] += f[1];
      forces[i][2] += f[2];
      forces[j][0] -= f[0];
      forces[j][1] -= f[1];
      forces[j][2] -= f[2];
      potentialTotal += potentialEnergy(d, potential) + repulsivePotential(d, potential);
    }
  }
  return { forces, potentialTotal };
}

export function stepEducational(
  particles: ParticleState[],
  potential: PotentialConfig,
  dt: number,
  initialEnergy?: number
): { particles: ParticleState[]; observables: Observables } {
  const { forces } = pairwiseForces(particles, potential);
  const predicted = particles.map((p, i) => {
    const ax = forces[i][0] / p.mass;
    const ay = forces[i][1] / p.mass;
    const az = forces[i][2] / p.mass;
    return {
      ...p,
      position: [
        p.position[0] + p.velocity[0] * dt + 0.5 * ax * dt * dt,
        p.position[1] + p.velocity[1] * dt + 0.5 * ay * dt * dt,
        p.position[2] + p.velocity[2] * dt + 0.5 * az * dt * dt
      ] as [number, number, number]
    };
  });
  const { forces: nextForces, potentialTotal } = pairwiseForces(predicted, potential);
  let kinetic = 0;
  const next = predicted.map((p, i) => {
    const v: [number, number, number] = [
      p.velocity[0] + 0.5 * (forces[i][0] / p.mass + nextForces[i][0] / p.mass) * dt,
      p.velocity[1] + 0.5 * (forces[i][1] / p.mass + nextForces[i][1] / p.mass) * dt,
      p.velocity[2] + 0.5 * (forces[i][2] / p.mass + nextForces[i][2] / p.mass) * dt
    ];
    const e = 0.5 * p.mass * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
    kinetic += e;
    return {
      ...p,
      velocity: v,
      momentum: [p.mass * v[0], p.mass * v[1], p.mass * v[2]] as [number, number, number],
      energy: e,
      force: nextForces[i],
      trajectory: [...p.trajectory, p.position].slice(-240)
    };
  });

  const total = kinetic + potentialTotal;
  const drift = initialEnergy ? Math.abs(total - initialEnergy) / Math.max(Math.abs(initialEnergy), EPS) : 0;
  const momentum = next.reduce<[number, number, number]>(
    (acc, p) =>
      [
        acc[0] + p.momentum[0],
        acc[1] + p.momentum[1],
        acc[2] + p.momentum[2]
      ] as [number, number, number],
    [0, 0, 0] as [number, number, number]
  );
  return {
    particles: next,
    observables: {
      total_energy: total,
      kinetic_energy: kinetic,
      potential_energy: potentialTotal,
      energy_drift: drift,
      momentum_error: norm(momentum),
      electric_charge: next.reduce((acc, p) => acc + p.electric_charge, 0),
      baryon_number: next.reduce((acc, p) => acc + (p.is_antiparticle ? -1 / 3 : 1 / 3), 0),
      particle_count: next.length,
      antiparticle_count: next.filter((p) => p.is_antiparticle).length
    }
  };
}
