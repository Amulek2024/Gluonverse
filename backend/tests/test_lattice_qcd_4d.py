import numpy as np

from gluonverse.physics.lattice import LatticeQCD4D
from gluonverse.physics.su3 import determinant_error, unitarity_error
from gluonverse.models.schemas import SimulationConfig
from gluonverse.simulations.lattice_engine import LatticeQCDEngine


def test_cold_4d_lattice_has_zero_wilson_gauge_action() -> None:
    lattice = LatticeQCD4D(
        spatial_size=2,
        temporal_size=2,
        beta=5.5,
        fermion_mode="quenched",
        start="cold",
    )

    assert lattice.volume == 16
    assert lattice.gauge_action() == 0.0
    assert lattice.average_plaquette() == 1.0
    assert lattice.wilson_loop(1, 1) == 1.0
    assert abs(lattice.polyakov_loop() - 1.0) < 1e-12


def test_staggered_operator_and_determinant_are_finite() -> None:
    mass = 0.2
    lattice = LatticeQCD4D(
        spatial_size=2,
        temporal_size=2,
        beta=5.5,
        seed=7,
        fermion_mode="dynamical_staggered",
        quark_masses=(mass, mass),
    )
    matrix = lattice.staggered_dirac_matrix(mass)
    kinetic = matrix - mass * np.eye(matrix.shape[0])

    assert matrix.shape == (48, 48)
    assert np.linalg.norm(kinetic + kinetic.conj().T) < 1e-10
    assert np.isfinite(lattice.fermion_log_determinant())
    assert all(np.isfinite(value) for value in lattice.chiral_condensates())


def test_4d_update_preserves_su3_and_is_reproducible() -> None:
    kwargs = {
        "spatial_size": 2,
        "temporal_size": 2,
        "beta": 5.5,
        "seed": 19,
        "fermion_mode": "quenched",
    }
    first = LatticeQCD4D(**kwargs)
    second = LatticeQCD4D(**kwargs)

    first_stats = first.metropolis_step()
    second_stats = second.metropolis_step()

    assert first_stats == second_stats
    for matrix in first.links.reshape(-1, 3, 3):
        assert unitarity_error(matrix) < 1e-10
        assert determinant_error(matrix) < 1e-10


def test_qcd_engine_emits_dynamical_observables_and_2d_projection() -> None:
    engine = LatticeQCDEngine("qcd-test")
    engine.initialize(
        SimulationConfig(
            simulation_type="gauge_lattice",
            dimensions=4,
            lattice={
                "size": 2,
                "temporal_size": 2,
                "iterations": 2,
                "fermion_mode": "dynamical_staggered",
                "quark_masses": [0.2, 0.2],
            },
        )
    )

    frame = engine.step()

    assert frame.observables["flavor_count"] == 2
    assert len(frame.observables["chiral_condensates"]) == 2
    assert np.isfinite(frame.observables["polyakov_loop_abs"])
    summary = frame.fields[0]["summary"]
    assert summary["extents"] == [2, 2, 2, 2]
    assert len(summary["energy_density"]) == 4
