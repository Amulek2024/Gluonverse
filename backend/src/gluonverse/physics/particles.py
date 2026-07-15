from __future__ import annotations

import numpy as np

from gluonverse.models.schemas import ParticleConfig, ParticleState


def make_particle(config: ParticleConfig) -> ParticleState:
    mass = float(config.mass or 1.0)
    velocity = np.asarray(config.velocity, dtype=float)
    momentum = (mass * velocity).tolist()
    kinetic = 0.5 * mass * float(np.dot(velocity, velocity))
    return ParticleState(
        **config.model_dump(exclude={"momentum", "energy"}),
        momentum=momentum,
        energy=kinetic,
        force=[0.0, 0.0, 0.0],
        trajectory=[list(config.position)],
    )


def clone_particles(particles: list[ParticleState]) -> list[ParticleState]:
    return [ParticleState.model_validate(particle.model_dump()) for particle in particles]

