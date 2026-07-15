from __future__ import annotations

import numpy as np

from gluonverse.models.schemas import ParticleState, PotentialConfig


def regularized_distance(distance: float, potential: PotentialConfig) -> float:
    softened = float(np.sqrt(distance * distance + potential.softening * potential.softening))
    return max(softened, potential.min_distance)


def cornell_potential(distance: float, potential: PotentialConfig) -> float:
    r = regularized_distance(distance, potential)
    value = -potential.coulomb_strength / r + potential.string_tension * r
    return float(np.clip(value, -potential.energy_limit, potential.energy_limit))


def cornell_force_magnitude(distance: float, potential: PotentialConfig) -> float:
    r = regularized_distance(distance, potential)
    d_v_dr = potential.coulomb_strength / (r * r) + potential.string_tension
    return float(np.clip(d_v_dr, 0.0, potential.energy_limit))


def repulsive_potential(distance: float, potential: PotentialConfig) -> float:
    """Phenomenological short-range core (not part of Cornell/QCD): keeps particles
    from visually overlapping. Disabled unless `repulsion_enabled` is set."""
    if not potential.repulsion_enabled or potential.repulsion_strength <= 0:
        return 0.0
    r = regularized_distance(distance, potential)
    value = potential.repulsion_strength / (5.0 * r**5)
    return float(np.clip(value, 0.0, potential.energy_limit))


def repulsive_force_magnitude(distance: float, potential: PotentialConfig) -> float:
    if not potential.repulsion_enabled or potential.repulsion_strength <= 0:
        return 0.0
    r = regularized_distance(distance, potential)
    magnitude = potential.repulsion_strength / (r**6)
    return float(np.clip(magnitude, 0.0, potential.energy_limit))


def pairwise_forces(
    particles: list[ParticleState],
    potential: PotentialConfig,
) -> tuple[np.ndarray, float]:
    count = len(particles)
    forces = np.zeros((count, 3), dtype=float)
    total_potential = 0.0

    for i in range(count):
        pi = np.asarray(particles[i].position, dtype=float)
        for j in range(i + 1, count):
            pj = np.asarray(particles[j].position, dtype=float)
            r_vec = pi - pj
            distance = float(np.linalg.norm(r_vec))
            if distance < 1e-15:
                direction = np.zeros(3, dtype=float)
            else:
                direction = r_vec / distance
            magnitude = cornell_force_magnitude(distance, potential) - repulsive_force_magnitude(distance, potential)
            force_i = -magnitude * direction
            forces[i] += force_i
            forces[j] -= force_i
            total_potential += cornell_potential(distance, potential) + repulsive_potential(distance, potential)

    return forces, float(total_potential)

