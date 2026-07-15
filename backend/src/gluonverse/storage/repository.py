from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path
from typing import Any

import h5py
import numpy as np
from pydantic import ValidationError

from gluonverse.config import Settings
from gluonverse.models.schemas import (
    ExportFormat,
    SimulationConfig,
    SimulationFrame,
    SimulationRecord,
    SimulationStatus,
)


class SimulationRepository:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.settings.ensure_dirs()
        self.settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.settings.sqlite_path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self._create_schema()

    def _create_schema(self) -> None:
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS simulations (
                simulation_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL,
                config_json TEXT NOT NULL,
                seed INTEGER NOT NULL,
                current_step INTEGER NOT NULL,
                total_steps INTEGER NOT NULL,
                result_path TEXT,
                metadata_json TEXT NOT NULL,
                version TEXT NOT NULL
            )
            """
        )
        self.connection.commit()

    def create(self, record: SimulationRecord) -> SimulationRecord:
        self.connection.execute(
            """
            INSERT INTO simulations (
                simulation_id, name, model, created_at, status, config_json, seed,
                current_step, total_steps, result_path, metadata_json, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.simulation_id,
                record.name,
                record.model,
                record.created_at.isoformat(),
                record.status.value,
                json.dumps(record.config.model_dump(mode="json")),
                record.seed,
                record.current_step,
                record.total_steps,
                record.result_path,
                json.dumps(record.metadata),
                record.version,
            ),
        )
        self.connection.commit()
        return record

    def list(self) -> list[SimulationRecord]:
        rows = self.connection.execute(
            "SELECT * FROM simulations ORDER BY created_at DESC"
        ).fetchall()
        records: list[SimulationRecord] = []
        for row in rows:
            try:
                records.append(self._row_to_record(row))
            except ValidationError:
                # Rows saved under an older, looser schema (e.g. lattice sizes no
                # longer allowed) shouldn't take down the whole history listing.
                continue
        return records

    def get(self, simulation_id: str) -> SimulationRecord | None:
        row = self.connection.execute(
            "SELECT * FROM simulations WHERE simulation_id = ?",
            (simulation_id,),
        ).fetchone()
        return self._row_to_record(row) if row else None

    def update_status(
        self,
        simulation_id: str,
        status: SimulationStatus,
        current_step: int,
        result_path: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        record = self.get(simulation_id)
        merged_metadata = record.metadata if record else {}
        if metadata:
            merged_metadata = {**merged_metadata, **metadata}
        self.connection.execute(
            """
            UPDATE simulations
            SET status = ?, current_step = ?, result_path = COALESCE(?, result_path),
                metadata_json = ?
            WHERE simulation_id = ?
            """,
            (
                status.value,
                current_step,
                result_path,
                json.dumps(merged_metadata),
                simulation_id,
            ),
        )
        self.connection.commit()

    def delete(self, simulation_id: str) -> bool:
        record = self.get(simulation_id)
        self.connection.execute("DELETE FROM simulations WHERE simulation_id = ?", (simulation_id,))
        self.connection.commit()
        return record is not None

    def export(
        self,
        simulation_id: str,
        config: SimulationConfig,
        frames: list[SimulationFrame],
        observables: dict[str, Any],
        fmt: ExportFormat,
    ) -> Path:
        safe_id = "".join(char for char in simulation_id if char.isalnum() or char in "-_")
        if fmt == ExportFormat.JSON:
            path = self.settings.export_dir / f"{safe_id}.json"
            payload = {
                "simulation_id": simulation_id,
                "config": config.model_dump(mode="json"),
                "observables": observables,
                "frames": [frame.model_dump(mode="json") for frame in frames],
            }
            path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        elif fmt == ExportFormat.CSV:
            path = self.settings.export_dir / f"{safe_id}_observables.csv"
            self._export_csv(path, frames, observables)
        else:
            path = self.settings.export_dir / f"{safe_id}.h5"
            self._export_hdf5(path, simulation_id, config, frames, observables)
        self.update_status(
            simulation_id,
            self.get(simulation_id).status if self.get(simulation_id) else SimulationStatus.COMPLETED,
            frames[-1].step if frames else 0,
            result_path=str(path),
            metadata={"last_export_format": fmt.value},
        )
        return path

    def _export_csv(
        self,
        path: Path,
        frames: list[SimulationFrame],
        observables: dict[str, Any],
    ) -> None:
        keys = sorted(
            key
            for key, value in observables.items()
            if isinstance(value, (int, float, str))
        )
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["step", "simulated_time", *keys])
            if frames:
                for frame in frames:
                    writer.writerow(
                        [
                            frame.step,
                            frame.simulated_time,
                            *[frame.observables.get(key, observables.get(key, "")) for key in keys],
                        ]
                    )
            else:
                writer.writerow([0, 0.0, *[observables.get(key, "") for key in keys]])

    def _export_hdf5(
        self,
        path: Path,
        simulation_id: str,
        config: SimulationConfig,
        frames: list[SimulationFrame],
        observables: dict[str, Any],
    ) -> None:
        with h5py.File(path, "w") as handle:
            handle.attrs["simulation_id"] = simulation_id
            handle.attrs["model_version"] = self.settings.model_version
            handle.attrs["config_json"] = json.dumps(config.model_dump(mode="json"))
            handle.attrs["observables_json"] = json.dumps(observables, default=str)

            steps = np.asarray([frame.step for frame in frames], dtype=np.int64)
            times = np.asarray([frame.simulated_time for frame in frames], dtype=np.float64)
            handle.create_dataset("frames/steps", data=steps)
            handle.create_dataset("frames/simulated_time", data=times)

            if frames and frames[0].particles:
                max_particles = max(len(frame.particles) for frame in frames)
                positions = np.full((len(frames), max_particles, 3), np.nan, dtype=np.float64)
                velocities = np.full((len(frames), max_particles, 3), np.nan, dtype=np.float64)
                for frame_index, frame in enumerate(frames):
                    for particle_index, particle in enumerate(frame.particles):
                        positions[frame_index, particle_index] = particle.position
                        velocities[frame_index, particle_index] = particle.velocity
                handle.create_dataset("particles/positions", data=positions)
                handle.create_dataset("particles/velocities", data=velocities)

    def _row_to_record(self, row: sqlite3.Row) -> SimulationRecord:
        return SimulationRecord(
            simulation_id=row["simulation_id"],
            name=row["name"],
            model=row["model"],
            created_at=row["created_at"],
            status=SimulationStatus(row["status"]),
            config=SimulationConfig.model_validate(json.loads(row["config_json"])),
            seed=row["seed"],
            current_step=row["current_step"],
            total_steps=row["total_steps"],
            result_path=row["result_path"],
            metadata=json.loads(row["metadata_json"]),
            version=row["version"],
        )

