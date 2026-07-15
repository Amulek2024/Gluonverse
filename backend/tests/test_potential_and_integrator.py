import numpy as np

from gluonverse.models.schemas import ColorCharge, Flavor, ParticleConfig, PotentialConfig
from gluonverse.physics.cornell import cornell_potential, pairwise_forces
from gluonverse.physics.integrators import velocity_verlet_step
from gluonverse.physics.particles import make_particle


def test_cornell_potential_is_regularized_and_finite() -> None:
    potential = PotentialConfig(softening=0.01)

    value = cornell_potential(0.0, potential)

    assert np.isfinite(value)


def test_pairwise_forces_are_antisymmetric() -> None:
    particles = [
        make_particle(ParticleConfig(flavor=Flavor.UP, color_charge=ColorCharge.RED, position=[-0.5, 0.0, 0.0])),
        make_particle(
            ParticleConfig(
                flavor=Flavor.ANTI_UP,
                color_charge=ColorCharge.ANTI_RED,
                position=[0.5, 0.0, 0.0],
            )
        ),
    ]

    forces, _ = pairwise_forces(particles, PotentialConfig())

    assert np.allclose(forces[0], -forces[1])


def test_velocity_verlet_produces_finite_energy() -> None:
    particles = [
        make_particle(
            ParticleConfig(
                flavor=Flavor.UP,
                color_charge=ColorCharge.RED,
                position=[-0.5, 0.0, 0.0],
                velocity=[0.0, 0.1, 0.0],
            )
        ),
        make_particle(
            ParticleConfig(
                flavor=Flavor.ANTI_UP,
                color_charge=ColorCharge.ANTI_RED,
                position=[0.5, 0.0, 0.0],
                velocity=[0.0, -0.1, 0.0],
            )
        ),
    ]

    updated, energy = velocity_verlet_step(particles, PotentialConfig(), 0.001)

    assert len(updated) == 2
    assert np.isfinite(energy["total_energy"])
    assert updated[0].trajectory

