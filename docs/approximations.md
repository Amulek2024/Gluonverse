# Approximations

Gluonverse uses explicit approximation labels throughout the API and UI.

## Educational Approximation

- Quarks and antiquarks are represented as inspectable state records.
- Field tubes, halos, flowing particles, and density shaders are visual
  metaphors.
- The Cornell-like potential is an effective teaching model.
- Hadron formation rules are color-neutrality heuristics.
- Particle sizes are visual scale markers, not physical radii.
- The Cornell potential `V(r) = -a/r + b*r` is purely attractive at every
  distance (`dV/dr >= 0` everywhere), so nothing in the base formulas stops
  particles from overlapping. An optional, disabled-by-default short-range
  repulsive core (`repulsion_enabled` / `repulsion_strength` in
  `PotentialConfig`) can be toggled on purely to prevent visual overlap. It is
  a phenomenological addition with no basis in the Cornell potential or QCD;
  it exists only for visual/numerical convenience.
- Particle dynamics use constituent quark masses (e.g. ~0.336 GeV for up,
  not the bare/current mass of ~0.0022 GeV) because this model treats quarks
  as classical particles bound by a static potential, which is only
  consistent with the constituent-mass picture. Using the bare mass makes
  acceleration (force/mass) unrealistically large for an explicit integrator
  and the total energy diverges within a couple of simulated seconds.

## Numerical Toy Model

- Velocity Verlet is used for stable educational dynamics.
- Energy and momentum conservation are approximate diagnostics.
- Softening prevents singular forces at very short range. The default
  (`0.1`) is chosen so that a close pass between two quarks (common in the
  3-quark presets) never spikes the Coulomb force enough to make a single
  integration step inject a permanent, non-physical jump in total energy.
  Lowering it below ~0.05 reintroduces this failure mode even at the
  recommended `dt`.
- Time-step sensitivity must be checked for serious comparisons.

## Finite-Lattice QCD Limits

- The lattice is 4D Euclidean and uses SU(3) links with the Wilson gauge action.
- Dynamical mode includes the exact finite-matrix determinant of staggered
  fermions at zero chemical potential; quenched mode omits it explicitly.
- Volumes are tiny and autocorrelation, thermalization, and finite-size effects
  dominate short interactive runs.
- Bare masses and beta are not converted to physical units without scale
  setting and renormalization.
- No continuum, infinite-volume, or physical-mass extrapolation is performed.
- Euclidean Monte Carlo configurations are not real-time particle trajectories.

## Atomic Model

- Electron positions are sampled from real hydrogen-like orbital wavefunctions
  `psi_nlm(r, theta, phi)` (closed-form radial part via associated Laguerre
  polynomials, real spherical harmonics for l=0..3), re-sampled periodically to
  convey that this is a probability cloud, not a classical trajectory.
- Multi-electron screening uses Slater's rules to compute an effective nuclear
  charge `Z_eff` per subshell. This is a standard, real approximation used in
  quantum chemistry, not an exact Hartree-Fock/DFT solution of the
  multi-electron Schrodinger equation.
- Electron configuration is computed via the Aufbau principle (Madelung's n+l
  rule) plus Pauli exclusion and Hund's rule, with the ~20 known irregular
  ground-state configurations (Cr, Cu, Nb, Mo, Ru, Rh, Pd, Ag, La, Ce, Gd, Pt,
  Au, Ac, Th, Pa, U, Np, Cm, Lr) hardcoded from experimental data. For Z >= 104
  (superheavy elements) the true ground-state configuration is experimentally
  unconfirmed/theoretical; the algorithmic Madelung pattern is extended as a
  declared approximation.
- The isotope used for each element is chosen by rounding the IUPAC standard
  atomic weight and subtracting Z, i.e. a "typical" isotope, not necessarily
  the most abundant real isotope (avoids needing a full isotopic-abundance
  table).
- The nucleus is built from real proton/neutron composites (reusing the
  quark-level hadron model), but rendered at a fixed, visually compact radius
  that is explicitly **not to real relative scale**: a real nucleus is roughly
  100,000 times smaller than the electron cloud, which would make it
  sub-pixel. A "ver nucleo" control jumps to the existing quark-level lab
  scene to inspect a proton/neutron at its real scale instead.

## Scientific Rigor Boundary

Only validated quantities with documented formulas should be treated as
computational results. The 4D lattice observables are calculated; the 2D height
map is a projection over hidden coordinates. Particle animation and shaders
remain illustrative unless a specific observable states otherwise.
