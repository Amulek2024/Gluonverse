from gluonverse.models.schemas import ColorCharge, Flavor, ParticleConfig
from gluonverse.physics.hadrons import detect_baryons, detect_mesons
from gluonverse.physics.particles import make_particle


def test_particle_defaults_for_antiquark() -> None:
    particle = ParticleConfig(flavor=Flavor.ANTI_UP, color_charge=ColorCharge.ANTI_RED)

    assert particle.is_antiparticle is True
    assert particle.electric_charge == -2.0 / 3.0
    assert particle.mass > 0.0


def test_meson_detection_requires_complementary_color() -> None:
    particles = [
        make_particle(
            ParticleConfig(
                flavor=Flavor.UP,
                color_charge=ColorCharge.RED,
                position=[0.0, 0.0, 0.0],
            )
        ),
        make_particle(
            ParticleConfig(
                flavor=Flavor.ANTI_UP,
                color_charge=ColorCharge.ANTI_RED,
                position=[0.4, 0.0, 0.0],
            )
        ),
    ]

    mesons = detect_mesons(particles)

    assert len(mesons) == 1
    assert mesons[0]["kind"] == "meson"


def test_baryon_detection_requires_red_green_blue() -> None:
    particles = [
        make_particle(ParticleConfig(flavor=Flavor.UP, color_charge=ColorCharge.RED)),
        make_particle(
            ParticleConfig(
                flavor=Flavor.UP,
                color_charge=ColorCharge.GREEN,
                position=[0.2, 0.0, 0.0],
            )
        ),
        make_particle(
            ParticleConfig(
                flavor=Flavor.DOWN,
                color_charge=ColorCharge.BLUE,
                position=[0.1, 0.2, 0.0],
            )
        ),
    ]

    baryons = detect_baryons(particles)

    assert len(baryons) == 1
    assert baryons[0]["kind"] == "baryon"

