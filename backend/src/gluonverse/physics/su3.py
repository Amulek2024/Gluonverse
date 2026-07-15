from __future__ import annotations

import numpy as np


def _rng(random_state: int | np.random.Generator | None = None) -> np.random.Generator:
    if isinstance(random_state, np.random.Generator):
        return random_state
    return np.random.default_rng(random_state)


def project_to_su3(matrix: np.ndarray) -> np.ndarray:
    q, r = np.linalg.qr(matrix)
    phases = np.diag(r)
    phases = np.where(np.abs(phases) < 1e-12, 1.0 + 0.0j, phases / np.abs(phases))
    q = q * phases.conjugate()
    det = np.linalg.det(q)
    if abs(det) < 1e-12:
        return np.eye(3, dtype=np.complex128)
    q = q / np.power(det, 1.0 / 3.0)
    return q.astype(np.complex128)


def random_su3(
    random_state: int | np.random.Generator | None = None,
    near_identity: bool = False,
    scale: float = 0.08,
) -> np.ndarray:
    rng = _rng(random_state)
    if near_identity:
        perturbation = scale * (
            rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3))
        )
        matrix = np.eye(3, dtype=np.complex128) + perturbation
    else:
        matrix = rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3))
    return project_to_su3(matrix)


def unitarity_error(matrix: np.ndarray) -> float:
    identity = np.eye(3, dtype=np.complex128)
    return float(np.linalg.norm(matrix.conj().T @ matrix - identity))


def determinant_error(matrix: np.ndarray) -> float:
    return float(abs(np.linalg.det(matrix) - 1.0))


def is_approximately_su3(matrix: np.ndarray, tolerance: float = 1e-8) -> bool:
    return unitarity_error(matrix) <= tolerance and determinant_error(matrix) <= tolerance

