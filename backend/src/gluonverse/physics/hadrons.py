from __future__ import annotations

from itertools import combinations

import numpy as np

from gluonverse.models.schemas import ParticleState
from gluonverse.physics.color import complementary_color, is_anticolor, is_color


def _distance(a: ParticleState, b: ParticleState) -> float:
    return float(np.linalg.norm(np.asarray(a.position) - np.asarray(b.position)))


def _relative_kinetic(a: ParticleState, b: ParticleState) -> float:
    va = np.asarray(a.velocity, dtype=float)
    vb = np.asarray(b.velocity, dtype=float)
    reduced_mass = (a.mass * b.mass) / max(a.mass + b.mass, 1e-12)
    return 0.5 * reduced_mass * float(np.dot(va - vb, va - vb))


def detect_mesons(
    particles: list[ParticleState],
    max_distance: float = 1.2,
    energy_threshold: float = 0.5,
) -> list[dict[str, object]]:
    mesons: list[dict[str, object]] = []
    for a, b in combinations(particles, 2):
        if a.is_antiparticle == b.is_antiparticle:
            continue
        quark = b if a.is_antiparticle else a
        antiquark = a if a.is_antiparticle else b
        if complementary_color(quark.color_charge) != antiquark.color_charge:
            continue
        distance = _distance(quark, antiquark)
        relative_energy = _relative_kinetic(quark, antiquark)
        if distance <= max_distance and relative_energy <= energy_threshold:
            mesons.append(
                {
                    "kind": "meson",
                    "particle_ids": [quark.id, antiquark.id],
                    "distance": distance,
                    "relative_energy": relative_energy,
                    "approximation": "educational color-neutrality heuristic",
                }
            )
    return mesons


def _cluster_energy(particles: tuple[ParticleState, ...]) -> float:
    velocities = [np.asarray(p.velocity, dtype=float) for p in particles]
    mean_velocity = sum(velocities) / len(velocities)
    return float(
        sum(0.5 * particle.mass * np.dot(np.asarray(particle.velocity) - mean_velocity, np.asarray(particle.velocity) - mean_velocity) for particle in particles)
    )


def _max_pair_distance(particles: tuple[ParticleState, ...]) -> float:
    distances = [_distance(a, b) for a, b in combinations(particles, 2)]
    return max(distances) if distances else 0.0


def detect_baryons(
    particles: list[ParticleState],
    max_distance: float = 1.4,
    energy_threshold: float = 0.8,
) -> list[dict[str, object]]:
    baryons: list[dict[str, object]] = []
    quarks = [particle for particle in particles if not particle.is_antiparticle]
    for trio in combinations(quarks, 3):
        colors = {particle.color_charge for particle in trio}
        if not all(is_color(color) for color in colors):
            continue
        if {color.value for color in colors} != {"red", "green", "blue"}:
            continue
        spread = _max_pair_distance(trio)
        energy = _cluster_energy(trio)
        if spread <= max_distance and energy <= energy_threshold:
            baryons.append(
                {
                    "kind": "baryon",
                    "particle_ids": [particle.id for particle in trio],
                    "max_distance": spread,
                    "relative_energy": energy,
                    "approximation": "educational red-green-blue neutrality heuristic",
                }
            )
    return baryons


def detect_antibaryons(
    particles: list[ParticleState],
    max_distance: float = 1.4,
    energy_threshold: float = 0.8,
) -> list[dict[str, object]]:
    antibaryons: list[dict[str, object]] = []
    antiquarks = [particle for particle in particles if particle.is_antiparticle]
    for trio in combinations(antiquarks, 3):
        colors = {particle.color_charge for particle in trio}
        if not all(is_anticolor(color) for color in colors):
            continue
        if {color.value for color in colors} != {"anti-red", "anti-green", "anti-blue"}:
            continue
        spread = _max_pair_distance(trio)
        energy = _cluster_energy(trio)
        if spread <= max_distance and energy <= energy_threshold:
            antibaryons.append(
                {
                    "kind": "antibaryon",
                    "particle_ids": [particle.id for particle in trio],
                    "max_distance": spread,
                    "relative_energy": energy,
                    "approximation": "educational anti-color neutrality heuristic",
                }
            )
    return antibaryons

