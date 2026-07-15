from __future__ import annotations

import numpy as np

from gluonverse.models.schemas import ParticleState, PotentialConfig
from gluonverse.physics.cornell import pairwise_forces


def _state_arrays(particles: list[ParticleState]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    positions = np.asarray([particle.position for particle in particles], dtype=float)
    velocities = np.asarray([particle.velocity for particle in particles], dtype=float)
    masses = np.asarray([particle.mass for particle in particles], dtype=float)
    return positions, velocities, masses


def velocity_verlet_step(
    particles: list[ParticleState],
    potential: PotentialConfig,
    dt: float,
) -> tuple[list[ParticleState], dict[str, float]]:
    if not particles:
        return [], {"kinetic_energy": 0.0, "potential_energy": 0.0, "total_energy": 0.0}

    positions, velocities, masses = _state_arrays(particles)
    forces, potential_energy = pairwise_forces(particles, potential)
    accelerations = forces / masses[:, None]
    next_positions = positions + velocities * dt + 0.5 * accelerations * dt * dt

    predicted_particles = []
    for index, particle in enumerate(particles):
        predicted = ParticleState.model_validate(particle.model_dump())
        predicted.position = next_positions[index].tolist()
        predicted_particles.append(predicted)

    next_forces, next_potential_energy = pairwise_forces(predicted_particles, potential)
    next_accelerations = next_forces / masses[:, None]
    next_velocities = velocities + 0.5 * (accelerations + next_accelerations) * dt

    kinetic_energy = 0.0
    updated: list[ParticleState] = []
    for index, particle in enumerate(predicted_particles):
        velocity = next_velocities[index]
        momentum = masses[index] * velocity
        kinetic = 0.5 * masses[index] * float(np.dot(velocity, velocity))
        kinetic_energy += kinetic
        trajectory = [*particle.trajectory, next_positions[index].tolist()][-600:]
        updated.append(
            ParticleState(
                **particle.model_dump(exclude={"velocity", "momentum", "energy", "force", "trajectory"}),
                velocity=velocity.tolist(),
                momentum=momentum.tolist(),
                energy=kinetic,
                force=next_forces[index].tolist(),
                trajectory=trajectory,
            )
        )

    return updated, {
        "kinetic_energy": float(kinetic_energy),
        "potential_energy": float(next_potential_energy),
        "total_energy": float(kinetic_energy + next_potential_energy),
        "previous_potential_energy": float(potential_energy),
    }

