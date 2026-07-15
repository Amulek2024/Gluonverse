import type { ColorCharge, Flavor, ParticleState } from "../types/physics";

// Constituent quark masses (not the bare/current masses of ~2-5 MeV for up/down): inside a
// hadron, chiral symmetry breaking and the surrounding gluon field give quarks an effective
// dynamical mass of a few hundred MeV. This model treats quarks as classical particles bound
// by a static potential, which is only consistent with the constituent picture - using the
// bare mass here makes acceleration (force/mass) unrealistically huge and the integrator
// diverges (a meson's energy blows up from ~0.5 GeV* to >10,000 GeV* within a couple of
// simulated seconds at the default potential).
const massGeV: Record<string, number> = {
  up: 0.336,
  down: 0.34,
  strange: 0.486,
  charm: 1.55,
  bottom: 4.73,
  top: 172.76
};

const charge: Record<string, number> = {
  up: 2 / 3,
  down: -1 / 3,
  strange: -1 / 3,
  charm: 2 / 3,
  bottom: -1 / 3,
  top: 2 / 3
};

export function baseFlavor(flavor: Flavor): string {
  return flavor.replace("anti-", "");
}

export function isAntiflavor(flavor: Flavor): boolean {
  return flavor.startsWith("anti-");
}

export function particle(
  id: string,
  flavor: Flavor,
  color_charge: ColorCharge,
  position: [number, number, number],
  velocity: [number, number, number] = [0, 0, 0]
): ParticleState {
  const base = baseFlavor(flavor);
  const anti = isAntiflavor(flavor);
  const mass = massGeV[base];
  const electric = anti ? -charge[base] : charge[base];
  return {
    id,
    flavor,
    mass,
    electric_charge: electric,
    color_charge,
    position,
    velocity,
    momentum: [mass * velocity[0], mass * velocity[1], mass * velocity[2]],
    energy: 0.5 * mass * (velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2),
    spin: 0.5,
    is_antiparticle: anti,
    force: [0, 0, 0],
    trajectory: [position]
  };
}

export function visualColor(color: ColorCharge): string {
  const map: Record<ColorCharge, string> = {
    red: "#FF5D73",
    green: "#5BE49B",
    blue: "#62A8FF",
    "anti-red": "#FF9BA8",
    "anti-green": "#B8FFD9",
    "anti-blue": "#B8D6FF"
  };
  return map[color];
}

export function colorPattern(color: ColorCharge): string {
  return color.startsWith("anti-") ? "anticolor" : "color";
}

