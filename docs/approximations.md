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

## Molecular Orbitals (LCAO)

- Each bond in the Molecules view renders a molecular-orbital cloud built via LCAO (Linear
  Combination of Atomic Orbitals): the signed wavefunction amplitudes of the two bonding
  atoms' relevant valence orbitals are summed (`psi_A + psi_B`, constructive interference),
  and the resulting density (`(psi_A + psi_B)^2`) is sampled -- the same real, standard LCAO
  bonding-MO construction taught in introductory quantum chemistry. Only the bonding
  combination is shown; the antibonding combination (`psi_A - psi_B`) is not computed or
  rendered.
- For an atom with 2+ bonds, its valence s and p orbitals are first combined into sp/sp2/sp3
  hybrid orbitals (`hybrid = sqrt(s_character)*s + sqrt(1 - s_character)*p_directional`, with
  the standard %s-character values 1/2, 1/3, 1/4) before forming each bond -- real, standard
  hybridization formulas, generalized here to point along an arbitrary real bond-direction
  vector (via a directional p orbital, the dot-product projection of px/py/pz onto that
  direction) rather than only the canonical coordinate axes.
- The hybridization TYPE (sp vs sp2 vs sp3) is inferred from the real experimental angle
  between an atom's bond directions (already used for that molecule's fixed geometry, see
  `utils/molecules.ts`): angles near 180/120/109.5 degrees classify as sp/sp2/sp3
  respectively. This is a geometric classification heuristic, not a first-principles
  hybridization calculation, and does not construct a complete orthogonalized hybrid basis
  (lone-pair-directed hybrids are not built; see below).
- An atom with exactly 1 bond uses its bare valence orbital along the bond axis with no
  hybridization: a directional p orbital for heavier atoms, or the bare 1s for hydrogen
  (which has no valence p subshell at n=1). This also means simple diatomics (H2, N2, O2,
  HCl, CO) never trigger hybridization on either atom.
- Declared limitations: (1) lone pairs are not rendered as separate direction-resolved
  hybrid lobes -- those electrons remain visible only in the unmodified, unrelated isolated
  atomic cloud (see Atomic Model above), which is NOT reduced to account for electrons now
  also shown in a bond cloud, so the two layers visually overlap without a total-probability
  bookkeeping between them; (2) the LCAO cloud only represents a sigma-type combination --
  it does not distinguish or add pi-bond character for double/triple bonds, whose order is
  still indicated only by the separate schematic Lewis-line count; (3) no bond energy,
  equilibrium geometry, or antibonding orbital is computed; the molecule's geometry remains
  the fixed experimental value from `utils/molecules.ts`.

## Atom Sandbox (Free Interaction Model)

- Atoms placed in the sandbox reuse the same hybrid nucleus + electron-cloud model as the
  Atomic Model, just with positions driven by a live physics step instead of a fixed
  placement.
- The inter-atom force is a Lennard-Jones potential (`V(r) = 4*epsilon*[(sigma/r)^12 -
  (sigma/r)^6]`), used across TWO declared regimes rather than one: real bond formation and
  real non-bonded (van der Waals) contact are physically different phenomena with different
  potential shapes and depths, which this simplified model does not fully distinguish.
  - If neither atom is a noble gas, `sigma` is parameterized from real covalent radii (Cordero
    et al. 2008), so the potential's equilibrium (`2^(1/6) * sigma`) approximates a real bond
    length. This use of the LJ functional form as a stand-in for bond formation is a declared
    simplification: it has no real bond energy, no orbital overlap, and no Morse-like
    asymmetric shape a real bond potential would have.
  - If either atom is a noble gas (treated here as never forming bonds, a simplification that
    ignores real heavy-noble-gas compounds like XeF2), `sigma` is parameterized from real van
    der Waals radii (Bondi 1964), modeling generic non-bonded contact instead.
  - In both regimes, `sigma_ij = (radius_i + radius_j) / 2^(1/6)`: the tabulated radii are
    defined such that their SUM already approximates the real contact/bond distance, and
    `2^(1/6)` is the LJ potential's own sigma-to-equilibrium ratio, needed so the potential's
    minimum reproduces that real distance rather than half of it.
  - Elements without a tabulated covalent or van der Waals radius use a declared generic
    per-period extrapolation, not a measured value.
- `epsilon` (the potential well depth) is a single uniform constant across every element pair,
  bonded-regime or not. Real bond and dispersion energies vary by orders of magnitude per pair,
  which is not tabulated here; this is a declared simplification, not a per-pair measured value.
- Bond detection (the line drawn between two atoms) is a separate, purely geometric overlay,
  computed independently of the physics step: a pair is flagged as bonded when their live
  distance is within 1.3x the sum of their real covalent radii, the same "distance-based bond
  perception" heuristic used by cheminformatics tools (OpenBabel, RDKit, ASE) to infer bonds
  from raw coordinates. It does **not** check remaining valence capacity (an atom can appear
  bonded to more neighbors than its real valence allows), does **not** distinguish covalent
  from ionic bonding, and does **not** determine bond order (single/double/triple) -- every
  detected bond is drawn identically. Noble gases are never flagged as bonded.
- Velocity Verlet integration (same pattern as `gravity.ts`/`cornell.py`), with a regularized
  minimum distance (`0.55 * sigma`) to prevent the repulsive `r^-12` term from diverging within
  a single discrete time step.
- Per-step velocity damping is a numerical/visual stabilizer so the system settles instead of
  oscillating forever around the potential well (a real undamped Lennard-Jones system would
  oscillate indefinitely); it is not a physical friction force.
- Atom count is capped (16) because each atom renders a full nucleus + periodically-resampled
  electron cloud, the same per-atom cost as the Atomic Model view.

## Electromagnetism

- The force between two charges is the real Coulomb's law, `F = k*q1*q2/r^2`, repulsive for
  like signs and attractive for opposite signs. `k` and the softening length (which prevents an
  infinite force at zero separation, same Plummer-style regularization as `gravity.ts`) are
  dimensionless visualization constants, not the real SI value of the Coulomb constant.
- If the optional magnetic field is enabled, every moving charge additionally feels the real
  Lorentz force `F = q*(v x B)`, with `B` a UNIFORM field along the Z axis only -- not sourced
  by the charges themselves (no Biot-Savart law, no relativistic Lienard-Wiechert potentials,
  no electromagnetic radiation from accelerating charges).
- Because the Lorentz force depends on velocity (unlike Coulomb's force, which depends only on
  position), this module does **not** use the Velocity Verlet integrator shared by
  `gravity.ts`/`cornell.py`. It uses the Boris method (Boris, 1970), the standard integrator in
  plasma physics and particle-in-cell simulations for exactly this equation of motion: each
  step splits into a half electric "kick", an exact rotation by the magnetic field (which
  conserves the perpendicular speed with no angular truncation error), and a second half
  electric kick. With the magnetic field disabled, this reduces to a symplectic-Euler-like
  scheme (bounded energy error, no secular drift, but not as tightly energy-conserving
  per-step as Velocity Verlet) -- an accepted trade-off for using one unified integrator across
  both the electric-only and electric-plus-magnetic cases.
- The "Atomo clasico" (classical atom) preset is a deliberately unstable-in-reality
  demonstration: a negative charge in circular Coulomb orbit around a positive one, the
  pre-quantum Rutherford/Bohr model. A real orbiting (thus constantly accelerating) charge
  radiates electromagnetic energy per classical electrodynamics and would spiral into the
  nucleus in a fraction of a second -- the historical problem that motivated quantum mechanics
  (see the Atomic Model). Since this simulation does not model radiation, the orbit remains
  stable indefinitely, which is explicitly flagged as physically incorrect for a real charge.
- The electric-field lines are a direction-only visualization: fixed-length line segments
  (not scaled by the real field magnitude, to avoid oversized arrows near a charge) sampled on
  a grid in the z=0 plane, with opacity increasing with relative magnitude. They are not a true
  field-line integration (streamlines), just per-point direction samples.

## Scientific Rigor Boundary

Only validated quantities with documented formulas should be treated as
computational results. The 4D lattice observables are calculated; the 2D height
map is a projection over hidden coordinates. Particle animation and shaders
remain illustrative unless a specific observable states otherwise.
