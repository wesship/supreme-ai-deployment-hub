from backend.ai_films.movieflow_retry_router import router


def test_movieflow_retry_route_is_admin_protected():
    routes = {route.path: route for route in router.routes}
    path = "/ai-films/admin/movieflow/retry"
    assert path in routes

    dependency_names = {
        dependency.call.__name__
        for dependency in routes[path].dependant.dependencies
        if dependency.call is not None
    }
    assert "_require_admin" in dependency_names


def test_movieflow_retry_does_not_depend_on_drive_picker_module():
    endpoint = next(route.endpoint for route in router.routes if route.path.endswith("/retry"))
    names = set(endpoint.__code__.co_names)
    assert "bootstrap_sovereign_signal_movieflow_ingestion" in names
    assert "bootstrap_sovereign_signal_drive_ingestion" not in names
    assert "bootstrap_sovereign_signal_drive_direct_fallback" not in names
