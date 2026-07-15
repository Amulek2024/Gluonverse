# Validation

Validation in Gluonverse checks whether a simplified model behaves consistently
within its own documented assumptions.

## Educational Dynamics

- Energy drift must remain below the configured tolerance for stable presets.
- Total linear momentum should remain approximately conserved in closed
  two-particle systems.
- Pair forces must be antisymmetric.
- Smaller time steps should reduce drift for the same scenario.
- Re-running with the same seed must reproduce the same trajectory.

## Color Rules

- Meson detection requires complementary color and anticolor.
- Baryon detection requires red, green, and blue.
- Antibaryon detection requires anti-red, anti-green, and anti-blue.

## Lattice

- `U^dagger U` should be close to identity.
- `det(U)` should be close to 1.
- Plaquette values should be finite.
- Wilson loops should be finite and reproducible with a fixed seed.
- Monte Carlo acceptance rate should remain in a useful range for default
  settings.

## Reference Cases

1. `examples/quark_antiquark.json`
   - Two particles with complementary color.
   - Small time step.
   - Expected stable bounded motion for short runs.

2. `examples/baryon.json`
   - Three quarks with red, green, and blue.
   - Expected educational baryon detection when close enough.

3. `examples/lattice_demo.json`
   - 4x4 lattice.
   - Fixed seed.
   - Reproducible average plaquette and action history.

