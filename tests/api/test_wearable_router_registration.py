from backend.api.v1.router import router


def _collect_paths(routes):
    paths = set()
    for route in routes:
        path = getattr(route, "path", None)
        if path:
            paths.add(path)

        nested = getattr(route, "routes", None)
        if nested:
            paths.update(_collect_paths(nested))

        original_router = getattr(route, "original_router", None)
        original_routes = getattr(original_router, "routes", None)
        if original_routes:
            paths.update(_collect_paths(original_routes))
    return paths


def test_wearable_ingress_is_registered_under_v1_router():
    assert "/vision/events" in _collect_paths(router.routes)
