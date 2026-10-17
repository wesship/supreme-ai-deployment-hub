from datetime import date, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.v1.insurance_capital_router import router
from backend.insurance_capital.analytics import BondInputs, approximate_ytm, concentration, current_yield, weighted_average_maturity


def test_current_yield():
    assert current_yield(1000, 0.05, 100) == 0.05
    assert current_yield(1000, 0.05, 0) is None


def test_approximate_ytm_missing_or_invalid_inputs():
    matured = BondInputs(100, 0.05, 100, date.today() - timedelta(days=1), date.today())
    assert approximate_ytm(matured) is None


def test_weighted_average_maturity():
    assert weighted_average_maturity([(100, 2), (300, 4)]) == 3.5
    assert weighted_average_maturity([]) is None


def test_concentration():
    result = concentration([("A", 75), ("B", 25)])
    assert result == {"A": 0.75, "B": 0.25}


def client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def security(identifier: str, issuer: str):
    return {
        "identifier": identifier,
        "issuer_name": issuer,
        "security_name": "Test Municipal Bond",
        "coupon_rate": 0.05,
        "clean_price": 100,
        "maturity_date": str(date.today() + timedelta(days=3650)),
        "evidence": [],
    }


def test_health_is_research_only():
    response = client().get("/insurance-capital/health")
    assert response.status_code == 200
    assert response.json()["trade_execution"] is False


def test_security_analysis_marks_missing_evidence():
    response = client().post("/insurance-capital/analyze-security", json=security("123456789", "Issuer A"))
    assert response.status_code == 200
    assert any("unverified" in item for item in response.json()["limitations"])


def test_portfolio_rejects_cross_bucket_commingling():
    payload = {
        "portfolio_id": "p1",
        "positions": [
            {"security": security("111111111", "Issuer A"), "market_value": 100, "bucket": "insurer"},
            {"security": security("222222222", "Issuer B"), "market_value": 100, "bucket": "trust_family_office"},
        ],
    }
    response = client().post("/insurance-capital/portfolio/concentration", json=payload)
    assert response.status_code == 422
    assert "cannot be silently commingled" in response.json()["detail"]
