import asyncio
from pathlib import Path

from fastapi.testclient import TestClient

from gluonverse.config import Settings
from gluonverse.main import app
from gluonverse.models.schemas import ExportFormat, SimulationConfig
from gluonverse.simulations import SimulationManager
from gluonverse.storage import SimulationRepository
from gluonverse.websocket import WebSocketManager


def test_api_health_validate_and_create() -> None:
    client = TestClient(app)

    assert client.get("/health").status_code == 200

    config = SimulationConfig(name="api test", steps=10)
    validation = client.post("/validate", json=config.model_dump(mode="json"))
    assert validation.status_code == 200
    assert validation.json()["ok"] is True

    response = client.post("/simulations", json=config.model_dump(mode="json"))
    assert response.status_code == 200
    assert response.json()["simulation_id"].startswith("sim-")


def test_manager_runs_and_exports_hdf5(tmp_path: Path) -> None:
    settings = Settings(
        data_dir=tmp_path / "simulations",
        export_dir=tmp_path / "exports",
        database_url=f"sqlite:///{tmp_path / 'simulations' / 'test.sqlite3'}",
    )
    repository = SimulationRepository(settings)
    manager = SimulationManager(settings, repository, WebSocketManager())
    record = manager.create_simulation(SimulationConfig(name="export test", steps=6))

    async def run_and_wait() -> None:
        await manager.start_run(record.simulation_id, steps=6, sample_interval=1)
        await manager.tasks[record.simulation_id]

    asyncio.run(run_and_wait())
    export = manager.export(record.simulation_id, ExportFormat.HDF5)

    assert Path(export["path"]).exists()
