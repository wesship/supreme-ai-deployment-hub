from backend.api.v1.router import router


def test_wearable_ingress_is_registered_under_v1_router():
    paths = {route.path for route in router.routes}
    assert "/vision/events" in paths
