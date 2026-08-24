from backend.hermes.worker import _required_capabilities
from backend.hermes.workflows.workers import InMemoryWorkerRegistry, WorkerCapabilities


def test_task_capabilities_are_normalized_for_routing() -> None:
    task = {
        "input_data": {
            "required_capabilities": ["Visual-QA", "browser-control", "visual-qa"]
        }
    }

    assert _required_capabilities(task) == ("browser-control", "visual-qa")


def test_mac_capabilities_select_mac_worker() -> None:
    registry = InMemoryWorkerRegistry()
    registry.register(
        worker_id="NVIDIA-01",
        hostname="nvidia",
        region="gpu",
        runtime="python",
        version="test",
        capabilities=WorkerCapabilities.from_names(("task-dispatch", "vision")),
        max_leases=1,
    )
    registry.register(
        worker_id="PRIMETIME-MAC-01",
        hostname="mac-mini",
        region="local-mac",
        runtime="python",
        version="test",
        capabilities=WorkerCapabilities.from_names(
            ("task-dispatch", "browser-control", "visual-qa", "computer-use")
        ),
        max_leases=1,
    )

    selected = registry.select_worker(("task-dispatch", "browser-control", "visual-qa"))

    assert selected is not None
    assert selected.worker_id == "PRIMETIME-MAC-01"
