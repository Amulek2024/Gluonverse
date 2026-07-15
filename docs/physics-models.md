# Physics Models

## Particles

The MVP represents quarks and antiquarks as computational state records:

```text
id, flavor, mass, electric_charge, color_charge, position, velocity, momentum,
energy, spin, is_antiparticle
```

This is not a claim that quarks are small classical balls. The UI and exports
state that real quarks are excitations of quantum fields and normally appear in
color-neutral bound states due to confinement.

## Educational Cornell-Like Potential

The visual laboratory uses a regularized Cornell-like effective potential:

```text
V(r) = -a / sqrt(r^2 + eps^2) + b * sqrt(r^2 + eps^2)
```

`a` controls a short-range attractive term and `b` controls an effective string
tension. `eps` prevents division by zero. Forces are computed from `F = -dV/dr`
and integrated with Velocity Verlet by default.

This is an educational effective potential, not a derivation from full QCD.

## Hadron Detection

Mesons are detected when a quark and antiquark have complementary color charges,
are closer than a configurable distance, and have relative kinetic energy below
a threshold.

Baryons are detected when three quarks contain red, green, and blue and satisfy
proximity/energy thresholds. Antibaryons use anti-red, anti-green, and
anti-blue.

These are teaching rules, not production hadronization.

## Four-Dimensional Lattice QCD

The computational path uses a four-dimensional Euclidean hypercubic lattice
`Ns^3 x Nt`. Each site stores four outgoing complex 3x3 SU(3) link matrices.
Spatial gauge boundaries are periodic; staggered fermions are periodic in space
and antiperiodic in Euclidean time.

The plaquette at site `x` in directions `mu,nu` is:

```text
U_mu(x) U_nu(x + mu) U_mu(x + nu)^dagger U_nu(x)^dagger
```

The gauge action is the Wilson plaquette action:

```text
S = beta * sum_p (1 - ReTr(U_p) / 3)
```

For each bare quark mass, the staggered Dirac matrix is constructed explicitly.
In dynamical mode the finite-lattice path-integral weight includes
`det(M^dagger M)^(1/2)` per listed flavor. A local SU(3) proposal is accepted or
rejected against the resulting full effective action. Direct determinants make
the algorithm exact for the implemented finite matrix but restrict interactive
runs to at most 64 sites.

Calculated observables include the average plaquette, rectangular Wilson loop,
complex Polyakov loop, fermion log determinant, Dirac condition number, and
per-flavor chiral condensate `Re Tr(M^-1)/(3V)`.

This is lattice QCD, but it is not a production prediction: no scale setting,
renormalization, continuum extrapolation, infinite-volume extrapolation, or
real-time analytic continuation is performed. Production codes use large
parallel lattices and algorithms such as HMC/RHMC; see [openQCD](https://luscher.web.cern.ch/luscher/openQCD/)
and [Luscher's lattice QCD notes](https://luscher.web.cern.ch/lectures/LesHouches97.pdf).
