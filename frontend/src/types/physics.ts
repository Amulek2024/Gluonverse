export type Flavor =
  | "up"
  | "down"
  | "strange"
  | "charm"
  | "bottom"
  | "top"
  | "anti-up"
  | "anti-down"
  | "anti-strange"
  | "anti-charm"
  | "anti-bottom"
  | "anti-top";

export type ColorCharge =
  | "red"
  | "green"
  | "blue"
  | "anti-red"
  | "anti-green"
  | "anti-blue";

export type SimulationStatus =
  | "idle"
  | "created"
  | "running"
  | "paused"
  | "completed"
  | "canceled"
  | "failed";

export type ViewId =
  | "inicio"
  | "laboratorio"
  | "lattice"
  | "atomos"
  | "moleculas"
  | "gravedad"
  | "comparador"
  | "historial"
  | "documentacion";

export interface ParticleState {
  id: string;
  flavor: Flavor;
  mass: number;
  electric_charge: number;
  color_charge: ColorCharge;
  position: [number, number, number];
  velocity: [number, number, number];
  momentum: [number, number, number];
  energy: number;
  spin: number;
  is_antiparticle: boolean;
  force: [number, number, number];
  trajectory: [number, number, number][];
}

export interface PotentialConfig {
  coulomb_strength: number;
  string_tension: number;
  softening: number;
  min_distance: number;
  energy_limit: number;
  repulsion_enabled: boolean;
  repulsion_strength: number;
}

export interface LatticeCell {
  x: number;
  y: number;
  energy_density: number;
}

export interface Observables {
  total_energy: number;
  kinetic_energy: number;
  potential_energy: number;
  energy_drift: number;
  momentum_error: number;
  electric_charge: number;
  baryon_number: number;
  particle_count: number;
  antiparticle_count: number;
  action?: number;
  average_plaquette?: number;
  wilson_loop?: number;
  acceptance_rate?: number;
  effective_action?: number;
  fermion_logdet?: number;
  polyakov_loop_abs?: number;
  chiral_condensates?: number[];
  fermion_condition_number?: number | null;
  [key: string]: unknown;
}

export interface SimulationFrame {
  type: "simulation_frame";
  simulation_id: string;
  step: number;
  simulated_time: number;
  particles: ParticleState[];
  fields: unknown[];
  observables: Partial<Observables>;
  warnings: string[];
}

export interface SimulationConfig {
  name: string;
  simulation_type: string;
  dimensions: 2 | 3 | 4;
  time_step: number;
  steps: number;
  integrator: "velocity_verlet" | "leapfrog";
  random_seed: number;
  particles: ParticleState[];
  potential: PotentialConfig;
  lattice: {
    size: 2 | 3 | 4;
    temporal_size: 2 | 3 | 4 | 6 | 8;
    beta: number;
    temperature: number;
    iterations: number;
    thermalization: number;
    burn_in: number;
    sampling_interval: number;
    proposal_width: number;
    wilson_loop_r: number;
    wilson_loop_t: number;
    fermion_mode: "quenched" | "dynamical_staggered";
    quark_masses: number[];
    start: "cold" | "hot";
  };
}

export interface EnergyPoint {
  step: number;
  total: number;
  kinetic: number;
  potential: number;
  drift: number;
}
