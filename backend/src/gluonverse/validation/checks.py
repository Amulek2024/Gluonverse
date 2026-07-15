from __future__ import annotations

from typing import Any

import numpy as np

from gluonverse.config import Settings
from gluonverse.models.schemas import SimulationConfig, ValidationResult
from gluonverse.physics.su3 import determinant_error, unitarity_error


def validate_simulation_config(
    config: SimulationConfig,
    settings: Settings | None = None,
) -> ValidationResult:
    settings = settings or Settings()
    warnings: list[str] = []
    errors: list[str] = []
    checks: dict[str, Any] = {}

    if len(config.particles) > settings.max_particles:
        errors.append(f"Particle count exceeds max_particles={settings.max_particles}.")
    checks["particle_count"] = len(config.particles)

    if config.lattice.size > settings.max_lattice_size:
        errors.append(f"Lattice size exceeds max_lattice_size={settings.max_lattice_size}.")
    checks["lattice_size"] = config.lattice.size

    lattice_volume = config.lattice.size**3 * config.lattice.temporal_size
    checks["lattice_extents"] = [config.lattice.size] * 3 + [config.lattice.temporal_size]
    checks["lattice_volume"] = lattice_volume
    if config.lattice.fermion_mode == "dynamical_staggered" and lattice_volume > 64:
        errors.append(
            "Direct dynamical-fermion mode is limited to 64 sites; reduce spatial or temporal extent."
        )

    steps = config.lattice.iterations if config.simulation_type in {"lattice", "gauge_lattice"} else config.steps
    if steps > settings.max_steps:
        errors.append(f"Step count exceeds max_steps={settings.max_steps}.")
    checks["steps"] = steps

    if config.time_step > 0.05 and config.simulation_type != "lattice":
        warnings.append("Large time_step can cause energy drift in the educational integrator.")

    if config.simulation_type in {"quark_antiquark", "meson"} and len(config.particles) < 2:
        errors.append("Quark-antiquark simulations require at least two particles.")

    checks["scientific_scope"] = (
        "4D finite-volume Euclidean lattice QCD" if config.simulation_type in {"lattice", "gauge_lattice"}
        else "educational effective model"
    )
    if config.simulation_type in {"lattice", "gauge_lattice"}:
        warnings.append(
            "A finite lattice run is not a continuum-extrapolated or real-time QCD prediction."
        )
    return ValidationResult(ok=not errors, warnings=warnings, errors=errors, checks=checks)


def validate_su3_matrix(matrix: np.ndarray, tolerance: float = 1e-8) -> ValidationResult:
    unitary = unitarity_error(matrix)
    determinant = determinant_error(matrix)
    errors = []
    if unitary > tolerance:
        errors.append(f"Unitarity error {unitary:.3g} exceeds tolerance {tolerance:.3g}.")
    if determinant > tolerance:
        errors.append(f"Determinant error {determinant:.3g} exceeds tolerance {tolerance:.3g}.")
    return ValidationResult(
        ok=not errors,
        errors=errors,
        checks={
            "unitarity_error": unitary,
            "determinant_error": determinant,
            "tolerance": tolerance,
        },
    )
