from __future__ import annotations

import numpy as np

from gluonverse.models.schemas import ParticleState
from gluonverse.physics.color import color_neutrality_vector


def particle_observables(
    particles: list[ParticleState],
    energy_terms: dict[str, float],
    initial_energy: float | None = None,
    initial_momentum: list[float] | None = None,
) -> dict[str, object]:
    if particles:
        momenta = np.asarray([particle.momentum for particle in particles], dtype=float)
        positions = np.asarray([particle.position for particle in particles], dtype=float)
        total_momentum = np.sum(momenta, axis=0)
        angular = np.sum(np.cross(positions, momenta), axis=0)
    else:
        total_momentum = np.zeros(3)
        angular = np.zeros(3)

    total_energy = float(energy_terms.get("total_energy", 0.0))
    if initial_energy is None or abs(initial_energy) < 1e-12:
        energy_drift = 0.0
    else:
        energy_drift = abs(total_energy - initial_energy) / max(abs(initial_energy), 1e-12)

    if initial_momentum is None:
        momentum_error = float(np.linalg.norm(total_momentum))
    else:
        momentum_error = float(np.linalg.norm(total_momentum - np.asarray(initial_momentum)))

    electric_charge = float(sum(particle.electric_charge for particle in particles))
    baryon_number = float(sum((-1.0 if particle.is_antiparticle else 1.0) / 3.0 for particle in particles))

    return {
        "total_energy": total_energy,
        "kinetic_energy": float(energy_terms.get("kinetic_energy", 0.0)),
        "potential_energy": float(energy_terms.get("potential_energy", 0.0)),
        "energy_drift": float(energy_drift),
        "linear_momentum": total_momentum.tolist(),
        "momentum_error": momentum_error,
        "angular_momentum": angular.tolist(),
        "electric_charge": electric_charge,
        "simplified_color_charge": list(color_neutrality_vector(particles)),
        "baryon_number": baryon_number,
        "particle_count": len(particles),
        "antiparticle_count": len([p for p in particles if p.is_antiparticle]),
    }

