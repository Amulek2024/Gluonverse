from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from gluonverse.physics.su3 import random_su3

Coordinate4D = tuple[int, int, int, int]


@dataclass
class GaugeLattice2D:
    size: int
    beta: float
    seed: int = 42
    proposal_width: float = 0.08
    links: np.ndarray = field(init=False)
    rng: np.random.Generator = field(init=False)
    accepted: int = 0
    proposed: int = 0

    def __post_init__(self) -> None:
        self.rng = np.random.default_rng(self.seed)
        self.links = np.empty((self.size, self.size, 2, 3, 3), dtype=np.complex128)
        for x in range(self.size):
            for y in range(self.size):
                for direction in range(2):
                    self.links[x, y, direction] = random_su3(self.rng, near_identity=True, scale=0.03)

    def shifted(self, x: int, y: int, direction: int, amount: int = 1) -> tuple[int, int]:
        if direction == 0:
            return (x + amount) % self.size, y
        return x, (y + amount) % self.size

    def plaquette(self, x: int, y: int) -> np.ndarray:
        xp, yp = self.shifted(x, y, 0)
        xq, yq = self.shifted(x, y, 1)
        u_x = self.links[x, y, 0]
        u_y_at_x_plus = self.links[xp, yp, 1]
        u_x_at_y_plus = self.links[xq, yq, 0]
        u_y = self.links[x, y, 1]
        return u_x @ u_y_at_x_plus @ u_x_at_y_plus.conj().T @ u_y.conj().T

    def average_plaquette(self) -> float:
        values = []
        for x in range(self.size):
            for y in range(self.size):
                values.append(np.real(np.trace(self.plaquette(x, y))) / 3.0)
        return float(np.mean(values))

    def action(self) -> float:
        total = 0.0
        for x in range(self.size):
            for y in range(self.size):
                total += 1.0 - np.real(np.trace(self.plaquette(x, y))) / 3.0
        return float(self.beta * total)

    def metropolis_sweep(self, temperature: float = 1.0) -> dict[str, float]:
        start_action = self.action()
        for x in range(self.size):
            for y in range(self.size):
                for direction in range(2):
                    old_link = self.links[x, y, direction].copy()
                    old_action = self.action()
                    proposal = random_su3(
                        self.rng,
                        near_identity=True,
                        scale=self.proposal_width,
                    ) @ old_link
                    self.links[x, y, direction] = proposal
                    new_action = self.action()
                    delta = new_action - old_action
                    self.proposed += 1
                    if delta <= 0.0 or self.rng.random() < np.exp(-delta / max(temperature, 1e-12)):
                        self.accepted += 1
                    else:
                        self.links[x, y, direction] = old_link
        end_action = self.action()
        return {
            "start_action": float(start_action),
            "action": float(end_action),
            "delta_action": float(end_action - start_action),
            "acceptance_rate": self.acceptance_rate,
            "average_plaquette": self.average_plaquette(),
        }

    @property
    def acceptance_rate(self) -> float:
        if self.proposed == 0:
            return 0.0
        return float(self.accepted / self.proposed)

    def wilson_loop(self, r: int = 1, t: int = 1) -> float:
        r = max(1, min(r, self.size))
        t = max(1, min(t, self.size))
        loops = []
        for x in range(self.size):
            for y in range(self.size):
                product = np.eye(3, dtype=np.complex128)
                cx, cy = x, y
                for _ in range(r):
                    product = product @ self.links[cx, cy, 0]
                    cx, cy = self.shifted(cx, cy, 0)
                for _ in range(t):
                    product = product @ self.links[cx, cy, 1]
                    cx, cy = self.shifted(cx, cy, 1)
                for _ in range(r):
                    cx, cy = self.shifted(cx, cy, 0, -1)
                    product = product @ self.links[cx, cy, 0].conj().T
                for _ in range(t):
                    cx, cy = self.shifted(cx, cy, 1, -1)
                    product = product @ self.links[cx, cy, 1].conj().T
                loops.append(np.real(np.trace(product)) / 3.0)
        return float(np.mean(loops))

    def energy_density_summary(self) -> list[dict[str, float]]:
        cells: list[dict[str, float]] = []
        for x in range(self.size):
            for y in range(self.size):
                plaquette_value = float(np.real(np.trace(self.plaquette(x, y))) / 3.0)
                cells.append(
                    {
                        "x": float(x),
                        "y": float(y),
                        "energy_density": float(max(0.0, 1.0 - plaquette_value)),
                    }
                )
        return cells


@dataclass
class LatticeQCD4D:
    """Small-volume Euclidean lattice QCD with exact finite-matrix fermion weights.

    This implementation is intentionally dense and serial.  It is useful for tiny
    lattices and validation, not for continuum extrapolations or production runs.
    """

    spatial_size: int
    temporal_size: int
    beta: float
    seed: int = 42
    proposal_width: float = 0.08
    fermion_mode: str = "dynamical_staggered"
    quark_masses: tuple[float, ...] = (0.1, 0.1)
    start: str = "hot"
    links: np.ndarray = field(init=False)
    rng: np.random.Generator = field(init=False)
    accepted: int = 0
    proposed: int = 0
    current_gauge_action: float = field(init=False)
    current_fermion_logdet: float = field(init=False)

    def __post_init__(self) -> None:
        self.extents = (
            self.spatial_size,
            self.spatial_size,
            self.spatial_size,
            self.temporal_size,
        )
        self.rng = np.random.default_rng(self.seed)
        self.links = np.empty((*self.extents, 4, 3, 3), dtype=np.complex128)
        for coordinate in self.coordinates():
            for direction in range(4):
                self.links[coordinate + (direction,)] = (
                    np.eye(3, dtype=np.complex128)
                    if self.start == "cold"
                    else random_su3(self.rng, near_identity=True, scale=0.12)
                )
        self.current_gauge_action = self.gauge_action()
        self.current_fermion_logdet = self.fermion_log_determinant()

    @property
    def volume(self) -> int:
        return int(np.prod(self.extents))

    @property
    def acceptance_rate(self) -> float:
        return float(self.accepted / self.proposed) if self.proposed else 0.0

    def coordinates(self):
        return np.ndindex(*self.extents)

    def shift(self, coordinate: Coordinate4D, direction: int, amount: int = 1) -> Coordinate4D:
        shifted = list(coordinate)
        shifted[direction] = (shifted[direction] + amount) % self.extents[direction]
        return tuple(shifted)  # type: ignore[return-value]

    def plaquette(self, coordinate: Coordinate4D, mu: int, nu: int) -> np.ndarray:
        x_mu = self.shift(coordinate, mu)
        x_nu = self.shift(coordinate, nu)
        return (
            self.links[coordinate + (mu,)]
            @ self.links[x_mu + (nu,)]
            @ self.links[x_nu + (mu,)].conj().T
            @ self.links[coordinate + (nu,)].conj().T
        )

    def gauge_action(self) -> float:
        total = 0.0
        for coordinate in self.coordinates():
            for mu in range(4):
                for nu in range(mu + 1, 4):
                    total += 1.0 - np.real(np.trace(self.plaquette(coordinate, mu, nu))) / 3.0
        return float(self.beta * total)

    def average_plaquette(self) -> float:
        total = 0.0
        count = 0
        for coordinate in self.coordinates():
            for mu in range(4):
                for nu in range(mu + 1, 4):
                    total += np.real(np.trace(self.plaquette(coordinate, mu, nu))) / 3.0
                    count += 1
        return float(total / count)

    def _site_index(self, coordinate: Coordinate4D) -> int:
        return int(np.ravel_multi_index(coordinate, self.extents))

    @staticmethod
    def staggered_phase(coordinate: Coordinate4D, direction: int) -> int:
        return -1 if sum(coordinate[:direction]) % 2 else 1

    def staggered_dirac_matrix(self, mass: float) -> np.ndarray:
        dimension = self.volume * 3
        matrix = np.eye(dimension, dtype=np.complex128) * mass
        for coordinate in self.coordinates():
            row = slice(3 * self._site_index(coordinate), 3 * self._site_index(coordinate) + 3)
            for direction in range(4):
                eta = self.staggered_phase(coordinate, direction)
                forward = self.shift(coordinate, direction)
                backward = self.shift(coordinate, direction, -1)
                forward_bc = -1.0 if direction == 3 and coordinate[3] == self.temporal_size - 1 else 1.0
                backward_bc = -1.0 if direction == 3 and coordinate[3] == 0 else 1.0
                forward_col = slice(3 * self._site_index(forward), 3 * self._site_index(forward) + 3)
                backward_col = slice(3 * self._site_index(backward), 3 * self._site_index(backward) + 3)
                matrix[row, forward_col] += 0.5 * eta * forward_bc * self.links[coordinate + (direction,)]
                matrix[row, backward_col] -= (
                    0.5
                    * eta
                    * backward_bc
                    * self.links[backward + (direction,)].conj().T
                )
        return matrix

    def fermion_log_determinant(self) -> float:
        if self.fermion_mode == "quenched":
            return 0.0
        total = 0.0
        for mass in self.quark_masses:
            matrix = self.staggered_dirac_matrix(mass)
            _, log_abs_det = np.linalg.slogdet(matrix.conj().T @ matrix)
            total += 0.5 * float(log_abs_det)
        return total

    def effective_action(self) -> float:
        return float(self.current_gauge_action - self.current_fermion_logdet)

    def metropolis_step(self) -> dict[str, float]:
        coordinate = tuple(int(self.rng.integers(extent)) for extent in self.extents)
        direction = int(self.rng.integers(4))
        key = coordinate + (direction,)
        old_link = self.links[key].copy()
        old_gauge = self.current_gauge_action
        old_logdet = self.current_fermion_logdet
        old_effective = old_gauge - old_logdet

        self.links[key] = random_su3(
            self.rng,
            near_identity=True,
            scale=self.proposal_width,
        ) @ old_link
        new_gauge = self.gauge_action()
        new_logdet = self.fermion_log_determinant()
        delta = (new_gauge - new_logdet) - old_effective
        self.proposed += 1
        accepted = delta <= 0.0 or self.rng.random() < np.exp(-min(delta, 700.0))
        if accepted:
            self.accepted += 1
            self.current_gauge_action = new_gauge
            self.current_fermion_logdet = new_logdet
        else:
            self.links[key] = old_link
            self.current_gauge_action = old_gauge
            self.current_fermion_logdet = old_logdet

        return {
            "action": self.current_gauge_action,
            "fermion_logdet": self.current_fermion_logdet,
            "effective_action": self.effective_action(),
            "delta_effective_action": float(delta),
            "acceptance_rate": self.acceptance_rate,
            "average_plaquette": self.average_plaquette(),
        }

    def wilson_loop(self, r: int = 1, t: int = 1, spatial_direction: int = 0) -> float:
        r = max(1, min(r, self.extents[spatial_direction]))
        t = max(1, min(t, self.temporal_size))
        values: list[float] = []
        for origin in self.coordinates():
            product = np.eye(3, dtype=np.complex128)
            coordinate = origin
            for _ in range(r):
                product = product @ self.links[coordinate + (spatial_direction,)]
                coordinate = self.shift(coordinate, spatial_direction)
            for _ in range(t):
                product = product @ self.links[coordinate + (3,)]
                coordinate = self.shift(coordinate, 3)
            for _ in range(r):
                coordinate = self.shift(coordinate, spatial_direction, -1)
                product = product @ self.links[coordinate + (spatial_direction,)].conj().T
            for _ in range(t):
                coordinate = self.shift(coordinate, 3, -1)
                product = product @ self.links[coordinate + (3,)].conj().T
            values.append(float(np.real(np.trace(product)) / 3.0))
        return float(np.mean(values))

    def polyakov_loop(self) -> complex:
        values: list[complex] = []
        for x in range(self.spatial_size):
            for y in range(self.spatial_size):
                for z in range(self.spatial_size):
                    product = np.eye(3, dtype=np.complex128)
                    for time in range(self.temporal_size):
                        product = product @ self.links[(x, y, z, time, 3)]
                    values.append(np.trace(product) / 3.0)
        return complex(np.mean(values))

    def chiral_condensates(self) -> list[float]:
        if self.fermion_mode == "quenched":
            return []
        values = []
        for mass in self.quark_masses:
            inverse = np.linalg.inv(self.staggered_dirac_matrix(mass))
            values.append(float(np.real(np.trace(inverse)) / (3.0 * self.volume)))
        return values

    def fermion_condition_number(self) -> float | None:
        if self.fermion_mode == "quenched":
            return None
        return float(np.linalg.cond(self.staggered_dirac_matrix(self.quark_masses[0])))

    def energy_density_summary(self) -> list[dict[str, float]]:
        cells: list[dict[str, float]] = []
        for x in range(self.spatial_size):
            for y in range(self.spatial_size):
                values = []
                for z in range(self.spatial_size):
                    for time in range(self.temporal_size):
                        coordinate = (x, y, z, time)
                        for mu in range(4):
                            for nu in range(mu + 1, 4):
                                plaquette = np.real(np.trace(self.plaquette(coordinate, mu, nu))) / 3.0
                                values.append(max(0.0, 1.0 - float(plaquette)))
                cells.append({"x": float(x), "y": float(y), "energy_density": float(np.mean(values))})
        return cells
