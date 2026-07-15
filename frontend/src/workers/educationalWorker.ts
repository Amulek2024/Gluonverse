import { stepEducational } from "../simulations/educational";
import type { ParticleState, PotentialConfig } from "../types/physics";

interface WorkerMessage {
  particles: ParticleState[];
  potential: PotentialConfig;
  dt: number;
  steps: number;
  initialEnergy?: number;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  let particles = event.data.particles;
  let observables;
  for (let step = 0; step < event.data.steps; step += 1) {
    const result = stepEducational(
      particles,
      event.data.potential,
      event.data.dt,
      event.data.initialEnergy
    );
    particles = result.particles;
    observables = result.observables;
  }
  self.postMessage({ particles, observables });
};

