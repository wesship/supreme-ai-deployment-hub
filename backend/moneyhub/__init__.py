"""MoneyHub governed financial API package."""

# Package initialization composes the core ledger/policy router with the
# Agent P&L, strategy analytics, simulation-only execution, monitoring,
# governed market-data, promotion, and server-side integration routes.
from backend.moneyhub.router import router
from backend.moneyhub.analytics_router import router as analytics_router
from backend.moneyhub.engine_router import router as engine_router
from backend.moneyhub.monitor_router import router as monitor_router
from backend.moneyhub.market_router import router as market_router
from backend.moneyhub.integrations_router import router as integrations_router

router.include_router(analytics_router)
router.include_router(engine_router)
router.include_router(monitor_router)
router.include_router(market_router)
router.include_router(integrations_router)

__all__ = ["router"]
