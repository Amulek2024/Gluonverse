import { create } from "zustand";
import type {
  EnergyPoint,
  LatticeCell,
  Observables,
  ParticleState,
  PotentialConfig,
  SimulationFrame,
  SimulationConfig,
  SimulationStatus,
  ViewId
} from "../types/physics";
import { stepEducational } from "../simulations/educational";
import { particle } from "../utils/particles";

const defaultPotential: PotentialConfig = {
  coulomb_strength: 0.5,
  string_tension: 1,
  // 0.01 lets the 1/r^2 Coulomb term spike hard enough on a close pass (common with the
  // 3-quark presets) that a single Velocity Verlet step can't resolve it accurately, causing
  // a permanent, non-physical jump in total energy. 0.1 keeps the same qualitative attractive
  // behavior while keeping the max force - and thus the per-step energy error - bounded.
  softening: 0.1,
  min_distance: 0.001,
  energy_limit: 10000,
  repulsion_enabled: false,
  repulsion_strength: 0.02
};

const DEFAULT_DEPTH_SPREAD = 0.35;
const DEFAULT_DT = 0.001;
const DEFAULT_PLAYBACK_SPEED = 1;
const DEFAULT_INTEGRATOR = "velocity_verlet" as const;

function withDepth(position: [number, number, number], depthSpread: number): [number, number, number] {
  if (depthSpread <= 0) return position;
  const [x, y] = position;
  return [x, y, (Math.random() - 0.5) * 2 * depthSpread];
}

function buildDefaultParticles(depthSpread: number) {
  return [
    particle("q-up-red", "up", "red", withDepth([-0.5, 0, 0], depthSpread), [0, 0.12, 0]),
    particle("aq-up-red", "anti-up", "anti-red", withDepth([0.5, 0, 0], depthSpread), [0, -0.12, 0])
  ];
}

const defaultParticles = buildDefaultParticles(DEFAULT_DEPTH_SPREAD);

const defaultObservables: Observables = {
  total_energy: 0,
  kinetic_energy: 0,
  potential_energy: 0,
  energy_drift: 0,
  momentum_error: 0,
  electric_charge: 0,
  baryon_number: 0,
  particle_count: 2,
  antiparticle_count: 1
};

interface StoreState {
  activeView: ViewId;
  status: SimulationStatus;
  simulationId?: string;
  backendOnline: boolean;
  backendMessage: string;
  step: number;
  simulatedTime: number;
  dt: number;
  playbackSpeed: number;
  depthSpread: number;
  cameraResetToken: number;
  controlsSlot: HTMLDivElement | null;
  integrator: "velocity_verlet" | "leapfrog";
  potential: PotentialConfig;
  particles: ParticleState[];
  selectedParticleId?: string;
  observables: Observables;
  energySeries: EnergyPoint[];
  warnings: string[];
  latticeCells: LatticeCell[];
  latticeSize: 2 | 3 | 4;
  latticeTemporalSize: 2 | 3 | 4 | 6 | 8;
  latticeBeta: number;
  latticeIterations: number;
  latticeFermionMode: "quenched" | "dynamical_staggered";
  latticeMass: number;
  colorblindMode: boolean;
  showFields: boolean;
  reducedMotion: boolean;
  selectedElementZ: number;
  setSelectedElement: (z: number) => void;
  setView: (view: ViewId) => void;
  setStatus: (status: SimulationStatus) => void;
  setBackend: (online: boolean, message?: string) => void;
  setSimulationId: (id?: string) => void;
  setSelectedParticle: (id?: string) => void;
  setPotential: (patch: Partial<PotentialConfig>) => void;
  setDt: (dt: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setDepthSpread: (spread: number) => void;
  setControlsSlot: (element: HTMLDivElement | null) => void;
  setIntegrator: (integrator: "velocity_verlet" | "leapfrog") => void;
  setLattice: (patch: Partial<Pick<StoreState, "latticeSize" | "latticeTemporalSize" | "latticeBeta" | "latticeIterations" | "latticeFermionMode" | "latticeMass">>) => void;
  toggleFields: () => void;
  toggleColorblind: () => void;
  toggleReducedMotion: () => void;
  applyPreset: (preset: "meson" | "proton" | "neutron" | "baryon" | "lattice") => void;
  addParticle: (position?: [number, number, number]) => void;
  reset: () => void;
  stepLocal: () => void;
  applyFrame: (frame: SimulationFrame) => void;
}

export const useSimulationStore = create<StoreState>((set, get) => ({
  activeView: "inicio",
  status: "idle",
  backendOnline: false,
  backendMessage: "Backend sin comprobar",
  step: 0,
  simulatedTime: 0,
  dt: DEFAULT_DT,
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  depthSpread: DEFAULT_DEPTH_SPREAD,
  cameraResetToken: 0,
  controlsSlot: null,
  integrator: DEFAULT_INTEGRATOR,
  potential: defaultPotential,
  particles: defaultParticles,
  selectedParticleId: defaultParticles[0].id,
  observables: defaultObservables,
  energySeries: [],
  warnings: ["Modelo educativo aproximado. No representa una simulacion completa de QCD."],
  latticeCells: Array.from({ length: 16 }, (_, index) => ({
    x: index % 4,
    y: Math.floor(index / 4),
    energy_density: 0.1 + (index % 3) * 0.08
  })),
  latticeSize: 2,
  latticeTemporalSize: 4,
  latticeBeta: 5.5,
  latticeIterations: 40,
  latticeFermionMode: "dynamical_staggered",
  latticeMass: 0.1,
  colorblindMode: false,
  showFields: true,
  reducedMotion: false,
  selectedElementZ: 1,
  setSelectedElement: (selectedElementZ) => set({ selectedElementZ }),
  setView: (activeView) => set({ activeView }),
  setStatus: (status) => set({ status }),
  setBackend: (backendOnline, backendMessage = "") => set({ backendOnline, backendMessage }),
  setSimulationId: (simulationId) => set({ simulationId }),
  setSelectedParticle: (selectedParticleId) => set({ selectedParticleId }),
  setPotential: (patch) => set((state) => ({ potential: { ...state.potential, ...patch } })),
  setDt: (dt) => set({ dt }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setDepthSpread: (depthSpread) => set({ depthSpread }),
  setControlsSlot: (controlsSlot) => set({ controlsSlot }),
  setIntegrator: (integrator) => set({ integrator }),
  setLattice: (patch) => set(patch),
  toggleFields: () => set((state) => ({ showFields: !state.showFields })),
  toggleColorblind: () => set((state) => ({ colorblindMode: !state.colorblindMode })),
  toggleReducedMotion: () => set((state) => ({ reducedMotion: !state.reducedMotion })),
  applyPreset: (preset) => {
    const depthSpread = get().depthSpread;
    if (preset === "proton") {
      set({
        particles: [
          particle("u-red", "up", "red", withDepth([-0.35, 0, 0], depthSpread), [0, 0.05, 0]),
          particle("u-green", "up", "green", withDepth([0.25, 0.25, 0], depthSpread), [-0.04, -0.03, 0]),
          particle("d-blue", "down", "blue", withDepth([0.1, -0.3, 0], depthSpread), [0.03, -0.02, 0])
        ],
        selectedParticleId: "u-red",
        step: 0,
        energySeries: []
      });
      return;
    }
    if (preset === "neutron" || preset === "baryon") {
      set({
        particles: [
          particle("u-red", "up", "red", withDepth([-0.35, 0, 0], depthSpread)),
          particle("d-green", "down", "green", withDepth([0.25, 0.25, 0], depthSpread)),
          particle("d-blue", "down", "blue", withDepth([0.1, -0.3, 0], depthSpread))
        ],
        selectedParticleId: "u-red",
        step: 0,
        energySeries: []
      });
      return;
    }
    if (preset === "lattice") {
      set({
        activeView: "lattice",
        latticeSize: 2,
        latticeTemporalSize: 4,
        latticeBeta: 5.5,
        latticeIterations: 40,
        latticeFermionMode: "dynamical_staggered",
        latticeMass: 0.1
      });
      return;
    }
    const mesonParticles = buildDefaultParticles(depthSpread);
    set({
      particles: mesonParticles,
      selectedParticleId: mesonParticles[0].id,
      step: 0,
      energySeries: []
    });
  },
  addParticle: (explicitPosition) => {
    const state = get();
    const index = state.particles.length + 1;
    const position = explicitPosition ?? withDepth([-0.6 + index * 0.18, 0.3 - index * 0.08, 0], state.depthSpread);
    set((current) => ({
      particles: [
        ...current.particles,
        particle(`q-extra-${index}`, index % 2 ? "down" : "anti-down", index % 2 ? "green" : "anti-green", position)
      ]
    }));
  },
  reset: () =>
    set((state) => {
      const particles = buildDefaultParticles(DEFAULT_DEPTH_SPREAD);
      return {
        status: "idle",
        simulationId: undefined,
        particles,
        selectedParticleId: particles[0].id,
        step: 0,
        simulatedTime: 0,
        observables: defaultObservables,
        energySeries: [],
        warnings: ["Modelo educativo aproximado. No representa una simulacion completa de QCD."],
        cameraResetToken: state.cameraResetToken + 1,
        dt: DEFAULT_DT,
        playbackSpeed: DEFAULT_PLAYBACK_SPEED,
        integrator: DEFAULT_INTEGRATOR,
        potential: defaultPotential,
        depthSpread: DEFAULT_DEPTH_SPREAD
      };
    }),
  stepLocal: () => {
    const state = get();
    const initialEnergy = state.energySeries[0]?.total;
    // "Velocidad visual" must only change how much simulated time passes per animation
    // frame, not the integration step size: enlarging dt itself degrades the integrator's
    // accuracy and can blow up the energy. So playbackSpeed >= 1 runs several sub-steps at
    // the same (accurate) base dt instead of one step at a larger, less stable dt.
    const subSteps = state.playbackSpeed >= 1 ? Math.max(1, Math.round(state.playbackSpeed)) : 1;
    const stepDt = state.playbackSpeed >= 1 ? state.dt : state.dt * state.playbackSpeed;
    let currentParticles = state.particles;
    let result = { particles: currentParticles, observables: state.observables };
    for (let i = 0; i < subSteps; i += 1) {
      result = stepEducational(currentParticles, state.potential, stepDt, initialEnergy);
      currentParticles = result.particles;
    }
    const step = state.step + subSteps;
    set({
      particles: result.particles,
      observables: result.observables,
      step,
      simulatedTime: state.simulatedTime + subSteps * stepDt,
      energySeries: [
        ...state.energySeries,
        {
          step,
          total: result.observables.total_energy,
          kinetic: result.observables.kinetic_energy,
          potential: result.observables.potential_energy,
          drift: result.observables.energy_drift
        }
      ].slice(-180)
    });
  },
  applyFrame: (frame) => {
    const energy = frame.observables;
    const fields = frame.fields as Array<{ summary?: { energy_density?: LatticeCell[] } }>;
    set((state) => ({
      simulationId: frame.simulation_id,
      status: "running",
      step: frame.step,
      simulatedTime: frame.simulated_time,
      particles: frame.particles.length ? frame.particles : state.particles,
      observables: { ...state.observables, ...energy },
      warnings: frame.warnings,
      latticeCells: fields[0]?.summary?.energy_density ?? state.latticeCells,
      energySeries: [
        ...state.energySeries,
        {
          step: frame.step,
          total: Number(energy.effective_action ?? energy.total_energy ?? state.observables.total_energy),
          kinetic: Number(energy.action ?? energy.kinetic_energy ?? state.observables.kinetic_energy),
          potential: -Number(energy.fermion_logdet ?? -state.observables.potential_energy),
          drift: Number(energy.acceptance_rate ?? energy.energy_drift ?? state.observables.energy_drift)
        }
      ].slice(-180)
    }));
  }
}));

export function currentConfig(): SimulationConfig {
  const state = useSimulationStore.getState();
  return {
    name: state.activeView === "lattice" ? "Gluonverse lattice run" : "Gluonverse educational run",
    simulation_type: state.activeView === "lattice" ? "gauge_lattice" : "quark_antiquark",
    dimensions: state.activeView === "lattice" ? 4 : 3,
    time_step: state.dt,
    steps: state.activeView === "lattice" ? state.latticeIterations : 1200,
    integrator: state.integrator,
    random_seed: 42,
    particles: state.particles,
    potential: state.potential,
    lattice: {
      size: state.latticeSize,
      temporal_size: state.latticeTemporalSize,
      beta: state.latticeBeta,
      temperature: 1,
      iterations: state.latticeIterations,
      thermalization: 20,
      burn_in: 20,
      sampling_interval: 4,
      proposal_width: 0.06,
      wilson_loop_r: 1,
      wilson_loop_t: 1,
      fermion_mode: state.latticeFermionMode,
      quark_masses: [state.latticeMass, state.latticeMass],
      start: "hot"
    }
  };
}
