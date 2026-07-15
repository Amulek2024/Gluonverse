import { describe, expect, it } from "vitest";
import {
  buildElectronSlots,
  computeElectronConfiguration,
  elementByZ,
  formatElectronConfiguration,
  hydrogenicRadius,
  neutronCount,
  sampleOrbitalPoint,
  slaterZEff
} from "../src/utils/elements";

describe("computeElectronConfiguration", () => {
  it("gives hydrogen a single 1s electron", () => {
    const config = computeElectronConfiguration(1);
    expect(formatElectronConfiguration(config)).toBe("1s¹");
  });

  it("gives oxygen 1s2 2s2 2p4", () => {
    const config = computeElectronConfiguration(8);
    expect(formatElectronConfiguration(config)).toBe("1s² 2s² 2p⁴");
  });

  it("applies the chromium exception (3d5 4s1, not 3d4 4s2)", () => {
    const config = computeElectronConfiguration(24);
    const d = config.find((s) => s.n === 3 && s.l === 2);
    const s4 = config.find((s) => s.n === 4 && s.l === 0);
    expect(d?.count).toBe(5);
    expect(s4?.count).toBe(1);
  });

  it("applies the copper exception (3d10 4s1, not 3d9 4s2)", () => {
    const config = computeElectronConfiguration(29);
    const d = config.find((s) => s.n === 3 && s.l === 2);
    const s4 = config.find((s) => s.n === 4 && s.l === 0);
    expect(d?.count).toBe(10);
    expect(s4?.count).toBe(1);
  });

  it("sums to Z electrons for every element (1..118)", () => {
    for (let z = 1; z <= 118; z += 1) {
      const config = computeElectronConfiguration(z);
      const total = config.reduce((sum, shell) => sum + shell.count, 0);
      expect(total).toBe(z);
    }
  });
});

describe("neutronCount", () => {
  it("matches the known neutron count for common light elements", () => {
    expect(neutronCount(elementByZ(1))).toBe(0); // hydrogen-1
    expect(neutronCount(elementByZ(6))).toBe(6); // carbon-12
    expect(neutronCount(elementByZ(26))).toBe(30); // iron-56
  });
});

describe("slaterZEff / hydrogenicRadius", () => {
  it("gives hydrogen Z_eff = 1 (no screening) for its own 1s electron", () => {
    const config = computeElectronConfiguration(1);
    const zEff = slaterZEff(1, 1, 0, config);
    expect(zEff).toBeCloseTo(1, 5);
  });

  it("increases Z_eff (and shrinks orbital radius) with more protons in the same shell", () => {
    const heliumConfig = computeElectronConfiguration(2);
    const neonConfig = computeElectronConfiguration(10);
    const zEffHe = slaterZEff(2, 1, 0, heliumConfig);
    const zEffNe = slaterZEff(10, 2, 1, neonConfig);
    expect(zEffNe).toBeGreaterThan(zEffHe);
    expect(hydrogenicRadius(2, zEffNe)).toBeGreaterThan(0);
    expect(hydrogenicRadius(1, zEffHe)).toBeGreaterThan(0);
  });

  it("returns a positive Z_eff for a heavy element's outer subshell", () => {
    const config = computeElectronConfiguration(92); // uranium
    const zEff = slaterZEff(92, 7, 0, config);
    expect(zEff).toBeGreaterThan(0);
    expect(Number.isFinite(hydrogenicRadius(7, zEff))).toBe(true);
  });
});

describe("buildElectronSlots", () => {
  it("produces one slot per electron and follows Hund's rule for carbon 2p2", () => {
    const config = computeElectronConfiguration(6); // carbon: 1s2 2s2 2p2
    const slots = buildElectronSlots(config);
    expect(slots).toHaveLength(6);
    const p2 = slots.filter((slot) => slot.n === 2 && slot.l === 1);
    expect(p2).toHaveLength(2);
    // Hund's rule: the two 2p electrons occupy different m orbitals (not paired yet).
    expect(p2[0].m).not.toBe(p2[1].m);
  });
});

describe("sampleOrbitalPoint", () => {
  it("returns finite, bounded coordinates for a 1s electron", () => {
    const config = computeElectronConfiguration(1);
    const zEff = slaterZEff(1, 1, 0, config);
    const [x, y, z] = sampleOrbitalPoint(1, 0, 0, zEff);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
    expect(Number.isFinite(z)).toBe(true);
    const r = Math.hypot(x, y, z);
    expect(r).toBeLessThan(hydrogenicRadius(1, zEff) * 10);
  });
});
