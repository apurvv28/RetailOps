import os
import sys
import pandas as pd
import pytest
import pandera as pa
from fastapi.testclient import TestClient

# Ensure backend directory is in the path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from training.data_validation import validate_events_df
from training.feature_engineering import is_uk_holiday, simulate_inventory_for_sku
from app.main import app

client = TestClient(app)

def test_is_uk_holiday():
    # Christmas Day is a holiday
    assert is_uk_holiday(pd.Timestamp("2026-12-25")) is True
    # New Year's Day is a holiday
    assert is_uk_holiday(pd.Timestamp("2026-01-01")) is True
    # A regular day (e.g., Nov 10) is not a holiday
    assert is_uk_holiday(pd.Timestamp("2026-11-10")) is False
    # First Monday of May (May 4, 2026) is Early May Bank Holiday
    assert is_uk_holiday(pd.Timestamp("2026-05-04")) is True

def test_data_validation_valid():
    valid_df = pd.DataFrame({
        "invoice_no": ["536365", "C536370"],
        "stock_code": ["85123A", "22423"],
        "description": ["WHITE HANGING HEART T-LIGHT HOLDER", "REGENCY CAKESTAND 3 TIER"],
        "quantity": [6, -1],
        "invoice_date": ["2009-12-01 07:45:00", "2009-12-01 07:50:00"],
        "unit_price": [2.55, 12.75],
        "customer_id": ["17850", "12583"],
        "country": ["United Kingdom", "France"]
    })
    validated = validate_events_df(valid_df)
    assert len(validated) == 2
    assert validated["quantity"].iloc[0] == 6
    assert validated["invoice_no"].iloc[1] == "C536370"

def test_data_validation_invalid_price():
    invalid_df = pd.DataFrame({
        "invoice_no": ["536365"],
        "stock_code": ["85123A"],
        "description": ["WHITE HANGING HEART T-LIGHT HOLDER"],
        "quantity": [6],
        "invoice_date": ["2009-12-01 07:45:00"],
        "unit_price": [-1.0],
        "customer_id": ["17850"],
        "country": ["United Kingdom"]
    })
    with pytest.raises(Exception):
        validate_events_df(invalid_df)

def test_data_validation_invalid_cancellation():
    invalid_df = pd.DataFrame({
        "invoice_no": ["536365"],
        "stock_code": ["85123A"],
        "description": ["WHITE HANGING HEART T-LIGHT HOLDER"],
        "quantity": [-6],
        "invoice_date": ["2009-12-01 07:45:00"],
        "unit_price": [2.55],
        "customer_id": ["17850"],
        "country": ["United Kingdom"]
    })
    with pytest.raises(Exception):
        validate_events_df(invalid_df)

def test_inventory_simulation():
    dates = pd.date_range(start="2026-01-01", periods=20, freq="D")
    sales = [1, 1, 1, 1, 1, 1, 1, 10, 10, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1]
    
    sku_df = pd.DataFrame({
        "date": dates,
        "quantity": sales
    })
    
    simulated = simulate_inventory_for_sku(sku_df, "TEST_SKU")
    assert "simulated_inventory" in simulated.columns
    assert "stockout_occurred" in simulated.columns
    assert "target" in simulated.columns
    assert len(simulated) == 20
    assert set(simulated["target"].unique()).issubset({0, 1})

# --- FASTAPI SERVING & BACKEND TESTS (PHASE 3 & 4) ---

def test_api_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "model_version" in data

def test_predict_and_decision_logging():
    payload = {
        "sku": "SKU_TEST_001",
        "daily_sales_avg_7": 12.5,
        "daily_sales_avg_14": 10.0,
        "daily_sales_avg_30": 8.0,
        "demand_velocity": 0.56,
        "day_of_week": 2,
        "month": 7,
        "holiday_flag": 0,
        "simulated_inventory": 15.0,
        "inventory_to_sales_ratio": 1.875,
        "inventory_to_sales_ratio_7": 1.2
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "SKU_TEST_001"
    assert "stockout_probability" in data
    assert data["prediction"] in [0, 1]
    assert data["decision_log_id"] is not None
    assert len(data["top_features"]) <= 3

def test_outcomes_recording():
    # Make a prediction first
    pred_res = client.post("/predict", json={
        "sku": "SKU_OUTCOME_TEST",
        "daily_sales_avg_7": 5.0,
        "daily_sales_avg_14": 5.0,
        "daily_sales_avg_30": 5.0,
        "demand_velocity": 0.0,
        "day_of_week": 1,
        "month": 7,
        "holiday_flag": 0,
        "simulated_inventory": 50.0,
        "inventory_to_sales_ratio": 10.0,
        "inventory_to_sales_ratio_7": 10.0
    })
    log_id = pred_res.json()["decision_log_id"]

    # Record outcome
    outcome_payload = {
        "decision_log_id": log_id,
        "actual_stockout_occurred": False
    }
    response = client.post("/outcomes", json=outcome_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["decision_log_id"] == log_id
    assert data["actual_stockout_occurred"] is False

def test_alert_trigger_and_rate_limit():
    alert_payload = {
        "sku": "SKU_ALERT_TEST_99",
        "reason": "Test stockout prediction risk elevated"
    }
    # First request -> should succeed
    res1 = client.post("/actions/alert", json=alert_payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] in ["success", "dispatched_mock"]

    # Second request within 24h -> should be rate limited
    res2 = client.post("/actions/alert", json=alert_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "rate_limited"
    assert "rate-limited" in data2["message"].lower()

def test_dashboard_endpoints():
    # 1. Recent predictions
    res1 = client.get("/dashboard/recent-predictions?limit=10")
    assert res1.status_code == 200
    data1 = res1.json()
    assert "predictions" in data1
    assert isinstance(data1["predictions"], list)

    # 2. Drift status
    res2 = client.get("/dashboard/drift-status")
    assert res2.status_code == 200
    data2 = res2.json()
    assert "dataset_drift" in data2
    assert "total_features" in data2

    # 3. Alerts history
    res3 = client.get("/dashboard/alerts?limit=10")
    assert res3.status_code == 200
    data3 = res3.json()
    assert "alerts" in data3
    assert isinstance(data3["alerts"], list)
