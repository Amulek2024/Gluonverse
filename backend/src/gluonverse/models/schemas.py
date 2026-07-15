from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Vector3 = list[float]


class Flavor(str, Enum):
    UP = "up"
    DOWN = "down"
    STRANGE = "strange"
    CHARM = "charm"
    BOTTOM = "bottom"
    TOP = "top"
    ANTI_UP = "anti-up"
    ANTI_DOWN = "anti-down"
    ANTI_STRANGE = "anti-strange"
    ANTI_CHARM = "anti-charm"
    ANTI_BOTTOM = "anti-bottom"
    ANTI_TOP = "anti-top"


class ColorCharge(str, Enum):
    RED = "red"
    GREEN = "green"
    BLUE = "blue"
    ANTI_RED = "anti-red"
    ANTI_GREEN = "anti-green"
    ANTI_BLUE = "anti-blue"


class IntegratorType(str, Enum):
    VELOCITY_VERLET = "velocity_verlet"
    LEAPFROG = "leapfrog"


class SimulationStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELED = "canceled"
    FAILED = "failed"


class ExportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"
    HDF5 = "hdf5"


# Constituent quark masses (not the bare/current masses of ~2-5 MeV for up/down): inside a
# hadron, chiral symmetry breaking and the surrounding gluon field give quarks an effective
# dynamical mass of a few hundred MeV. This model treats quarks as classical particles bound
# by a static potential, which is only consistent with the constituent picture - using the
# bare mass here makes acceleration (force/mass) unrealistically huge and the integrator
# diverges (a meson's energy blows up from ~0.5 GeV* to >10,000 GeV* within a couple of
# simulated seconds at the default potential).
MASS_GEV: dict[str, float] = {
    "up": 0.336,
    "down": 0.34,
    "strange": 0.486,
    "charm": 1.55,
    "bottom": 4.73,
    "top": 172.76,
}

ELECTRIC_CHARGE: dict[str, float] = {
    "up": 2.0 / 3.0,
    "down": -1.0 / 3.0,
    "strange": -1.0 / 3.0,
    "charm": 2.0 / 3.0,
    "bottom": -1.0 / 3.0,
    "top": 2.0 / 3.0,
}


def flavor_base(flavor: Flavor | str) -> str:
    value = flavor.value if isinstance(flavor, Flavor) else str(flavor)
    return value.replace("anti-", "")


def is_antiflavor(flavor: Flavor | str) -> bool:
    value = flavor.value if isinstance(flavor, Flavor) else str(flavor)
    return value.startswith("anti-")


class PotentialConfig(BaseModel):
    coulomb_strength: float = Field(0.5, ge=0.0, le=10.0)
    string_tension: float = Field(1.0, ge=0.0, le=20.0)
    # 0.01 lets the 1/r^2 Coulomb term spike hard enough on a close pass (common with the
    # 3-quark presets) that a single Velocity Verlet step can't resolve it accurately, causing
    # a permanent, non-physical jump in total energy. 0.1 keeps the same qualitative attractive
    # behavior while keeping the max force - and thus the per-step energy error - bounded.
    softening: float = Field(0.1, gt=0.0, le=10.0)
    min_distance: float = Field(0.001, gt=0.0, le=10.0)
    energy_limit: float = Field(10000.0, gt=0.0)
    # Phenomenological short-range core, not part of the Cornell potential: the Cornell
    # potential is purely attractive (dV/dr >= 0 everywhere), so without this term
    # particles have nothing stopping them from overlapping/passing through each other.
    repulsion_enabled: bool = False
    repulsion_strength: float = Field(0.02, ge=0.0, le=5.0)


class IntegratorConfig(BaseModel):
    kind: IntegratorType = IntegratorType.VELOCITY_VERLET
    energy_drift_tolerance: float = Field(0.05, ge=0.0, le=10.0)


class LatticeConfig(BaseModel):
    size: Literal[2, 3, 4] = 2
    temporal_size: Literal[2, 3, 4, 6, 8] = 4
    beta: float = Field(5.5, gt=0.0, le=20.0)
    temperature: float = Field(1.0, gt=0.0, le=100.0, description="Legacy educational parameter")
    iterations: int = Field(80, ge=1, le=100000)
    thermalization: int = Field(20, ge=0, le=100000)
    burn_in: int = Field(20, ge=0, le=100000)
    sampling_interval: int = Field(5, ge=1, le=10000)
    proposal_width: float = Field(0.08, gt=0.0, le=1.0)
    wilson_loop_r: int = Field(1, ge=1, le=8)
    wilson_loop_t: int = Field(1, ge=1, le=8)
    fermion_mode: Literal["quenched", "dynamical_staggered"] = "dynamical_staggered"
    quark_masses: list[float] = Field(default_factory=lambda: [0.1, 0.1], min_length=1, max_length=4)
    start: Literal["cold", "hot"] = "hot"

    @field_validator("quark_masses")
    @classmethod
    def positive_quark_masses(cls, value: list[float]) -> list[float]:
        if any(mass <= 0.0 or mass > 10.0 for mass in value):
            raise ValueError("Lattice quark masses must be in (0, 10]")
        return [float(mass) for mass in value]


class VisualizationConfig(BaseModel):
    show_fields: bool = True
    show_force_vectors: bool = True
    show_velocity_vectors: bool = True
    show_trajectories: bool = True
    quality: Literal["low", "medium", "high"] = "medium"
    reduced_motion: bool = False


class ExportConfig(BaseModel):
    formats: list[ExportFormat] = Field(default_factory=lambda: [ExportFormat.CSV, ExportFormat.HDF5])
    frame_stride: int = Field(10, ge=1, le=10000)


class ParticleConfig(BaseModel):
    id: str = Field(default_factory=lambda: f"p-{uuid4().hex[:10]}")
    flavor: Flavor = Flavor.UP
    mass: float | None = Field(default=None, gt=0.0)
    electric_charge: float | None = None
    color_charge: ColorCharge = ColorCharge.RED
    position: Vector3 = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    velocity: Vector3 = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    momentum: Vector3 | None = None
    energy: float = 0.0
    spin: float = 0.5
    is_antiparticle: bool | None = None

    @field_validator("position", "velocity", "momentum")
    @classmethod
    def vector3(cls, value: Vector3 | None) -> Vector3 | None:
        if value is None:
            return value
        if len(value) != 3:
            raise ValueError("Vector must have exactly three components")
        return [float(component) for component in value]

    @model_validator(mode="after")
    def set_particle_defaults(self) -> "ParticleConfig":
        base = flavor_base(self.flavor)
        anti = is_antiflavor(self.flavor)
        if self.mass is None:
            self.mass = MASS_GEV[base]
        if self.electric_charge is None:
            charge = ELECTRIC_CHARGE[base]
            self.electric_charge = -charge if anti else charge
        if self.is_antiparticle is None:
            self.is_antiparticle = anti
        if self.momentum is None:
            self.momentum = [self.mass * v for v in self.velocity]
        return self


class ParticleState(ParticleConfig):
    force: Vector3 = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    trajectory: list[Vector3] = Field(default_factory=list)


class SimulationConfig(BaseModel):
    name: str = "Untitled Gluonverse simulation"
    simulation_type: Literal[
        "educational",
        "quark_antiquark",
        "meson",
        "baryon",
        "lattice",
        "gauge_lattice",
    ] = "quark_antiquark"
    dimensions: Literal[2, 3, 4] = 3
    time_step: float = Field(0.001, gt=0.0, le=0.2)
    steps: int = Field(1000, ge=1, le=100000)
    integrator: IntegratorType = IntegratorType.VELOCITY_VERLET
    random_seed: int = Field(42, ge=0)
    particles: list[ParticleConfig] = Field(default_factory=list)
    potential: PotentialConfig = Field(default_factory=PotentialConfig)
    integrator_config: IntegratorConfig = Field(default_factory=IntegratorConfig)
    lattice: LatticeConfig = Field(default_factory=LatticeConfig)
    visualization: VisualizationConfig = Field(default_factory=VisualizationConfig)
    export: ExportConfig = Field(default_factory=ExportConfig)

    @model_validator(mode="after")
    def default_particles(self) -> "SimulationConfig":
        if self.simulation_type in {"quark_antiquark", "meson"} and not self.particles:
            self.particles = [
                ParticleConfig(
                    flavor=Flavor.UP,
                    color_charge=ColorCharge.RED,
                    position=[-0.5, 0.0, 0.0],
                    velocity=[0.0, 0.12, 0.0],
                ),
                ParticleConfig(
                    flavor=Flavor.ANTI_UP,
                    color_charge=ColorCharge.ANTI_RED,
                    position=[0.5, 0.0, 0.0],
                    velocity=[0.0, -0.12, 0.0],
                ),
            ]
        return self


class Observable(BaseModel):
    name: str
    value: float | int | str | dict[str, float]
    unit: str
    definition: str
    model: str
    limitations: str


class SimulationFrame(BaseModel):
    type: str = "simulation_frame"
    simulation_id: str
    step: int
    simulated_time: float
    particles: list[ParticleState] = Field(default_factory=list)
    fields: list[dict[str, Any]] = Field(default_factory=list)
    observables: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class SimulationRecord(BaseModel):
    simulation_id: str
    name: str
    model: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: SimulationStatus = SimulationStatus.CREATED
    config: SimulationConfig
    seed: int
    current_step: int = 0
    total_steps: int
    result_path: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    version: str = "0.2.0"


class RunRequest(BaseModel):
    steps: int | None = Field(default=None, ge=1, le=100000)
    sample_interval: int = Field(10, ge=1, le=10000)


class ExportRequest(BaseModel):
    format: ExportFormat = ExportFormat.HDF5


class ValidationResult(BaseModel):
    ok: bool
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    checks: dict[str, Any] = Field(default_factory=dict)
