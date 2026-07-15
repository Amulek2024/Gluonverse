from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _project_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "docker-compose.yml").exists():
            return parent
    return current.parents[2]


PROJECT_ROOT = _project_root()


def _path_from_env(name: str, default: str) -> Path:
    raw = Path(os.getenv(name, default))
    if raw.is_absolute():
        return raw.resolve()
    return (PROJECT_ROOT / raw).resolve()


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("GLUONVERSE_ENV", "development")
    data_dir: Path = _path_from_env("GLUONVERSE_DATA_DIR", "data/simulations")
    export_dir: Path = _path_from_env("GLUONVERSE_EXPORT_DIR", "data/exports")
    database_url: str = os.getenv(
        "GLUONVERSE_DATABASE_URL",
        f"sqlite:///{(PROJECT_ROOT / 'data' / 'simulations' / 'gluonverse.sqlite3').resolve()}",
    )
    max_particles: int = int(os.getenv("GLUONVERSE_MAX_PARTICLES", "64"))
    max_lattice_size: int = int(os.getenv("GLUONVERSE_MAX_LATTICE_SIZE", "16"))
    max_steps: int = int(os.getenv("GLUONVERSE_MAX_STEPS", "100000"))
    model_version: str = "0.2.0"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    @property
    def sqlite_path(self) -> Path:
        if self.database_url.startswith("sqlite:///"):
            return Path(self.database_url.replace("sqlite:///", "", 1)).resolve()
        return self.data_dir / "gluonverse.sqlite3"
