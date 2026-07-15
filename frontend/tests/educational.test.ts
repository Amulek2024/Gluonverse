import { describe, expect, it } from "vitest";
import { stepEducational } from "../src/simulations/educational";
import { particle } from "../src/utils/particles";

describe("educational simulation", () => {
  it("keeps pair momentum finite and computes energy", () => {
    const particles = [
      particle("q", "up", "red", [-0.5, 0, 0], [0, 0.1, 0]),
      particle("aq", "anti-up", "anti-red", [0.5, 0, 0], [0, -0.1, 0])
    ];

    const result = stepEducational(
      particles,
      {
        coulomb_strength: 0.5,
        string_tension: 1,
        softening: 0.01,
        min_distance: 0.001,
        energy_limit: 10000,
        repulsion_enabled: false,
        repulsion_strength: 0.02
      },
      0.001
    );

    expect(result.particles).toHaveLength(2);
    expect(Number.isFinite(result.observables.total_energy)).toBe(true);
    expect(Number.isFinite(result.observables.momentum_error)).toBe(true);
  });
});

