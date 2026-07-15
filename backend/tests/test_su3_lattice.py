import numpy as np

from gluonverse.physics.lattice import GaugeLattice2D
from gluonverse.physics.su3 import determinant_error, random_su3, unitarity_error


def test_random_su3_is_approximately_unitary_with_unit_determinant() -> None:
    matrix = random_su3(42)

    assert unitarity_error(matrix) < 1e-10
    assert determinant_error(matrix) < 1e-10


def test_lattice_plaquette_action_and_wilson_loop_are_finite() -> None:
    lattice = GaugeLattice2D(size=4, beta=5.5, seed=12)

    plaquette = lattice.plaquette(0, 0)
    action = lattice.action()
    loop = lattice.wilson_loop(1, 1)

    assert plaquette.shape == (3, 3)
    assert np.isfinite(action)
    assert np.isfinite(loop)


def test_monte_carlo_is_reproducible_with_same_seed() -> None:
    first = GaugeLattice2D(size=4, beta=5.5, seed=123)
    second = GaugeLattice2D(size=4, beta=5.5, seed=123)

    first_stats = first.metropolis_sweep()
    second_stats = second.metropolis_sweep()

    assert first_stats["action"] == second_stats["action"]
    assert first_stats["acceptance_rate"] == second_stats["acceptance_rate"]

