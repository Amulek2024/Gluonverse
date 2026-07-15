from __future__ import annotations

from gluonverse.models.schemas import ColorCharge, ParticleState

COMPLEMENT: dict[ColorCharge, ColorCharge] = {
    ColorCharge.RED: ColorCharge.ANTI_RED,
    ColorCharge.GREEN: ColorCharge.ANTI_GREEN,
    ColorCharge.BLUE: ColorCharge.ANTI_BLUE,
    ColorCharge.ANTI_RED: ColorCharge.RED,
    ColorCharge.ANTI_GREEN: ColorCharge.GREEN,
    ColorCharge.ANTI_BLUE: ColorCharge.BLUE,
}

COLOR_VECTOR: dict[ColorCharge, tuple[int, int, int]] = {
    ColorCharge.RED: (1, 0, 0),
    ColorCharge.GREEN: (0, 1, 0),
    ColorCharge.BLUE: (0, 0, 1),
    ColorCharge.ANTI_RED: (-1, 0, 0),
    ColorCharge.ANTI_GREEN: (0, -1, 0),
    ColorCharge.ANTI_BLUE: (0, 0, -1),
}


def complementary_color(color: ColorCharge) -> ColorCharge:
    return COMPLEMENT[color]


def is_color(color: ColorCharge) -> bool:
    return color in {ColorCharge.RED, ColorCharge.GREEN, ColorCharge.BLUE}


def is_anticolor(color: ColorCharge) -> bool:
    return not is_color(color)


def color_neutrality_vector(particles: list[ParticleState]) -> tuple[int, int, int]:
    total = [0, 0, 0]
    for particle in particles:
        vector = COLOR_VECTOR[particle.color_charge]
        total = [total[index] + vector[index] for index in range(3)]
    return tuple(total)


def is_simplified_color_neutral(particles: list[ParticleState]) -> bool:
    return color_neutrality_vector(particles) == (0, 0, 0)

