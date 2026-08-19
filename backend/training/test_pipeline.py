import os
import sys
import pandas as pd
import pytest
from fastapi.testclient import TestClient

root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from training.data_validation import validate_crop_df, validate_fertilizer_df, validate_irrigation_df
from app.main import app

client = TestClient(app)

def test_data_validation_crop():
    crop_df = pd.DataFrame({
        "N": [90.0],
        "P": [42.0],
        "K": [43.0],
        "temperature": [20.8],
        "humidity": [82.0],
        "ph": [6.5],
        "rainfall": [202.9],
        "label": ["rice"]
    })
    validated = validate_crop_df(crop_df)
    assert len(validated) == 1

def test_api_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "models" in data

def test_predict_irrigation():
    payload = {
        "field_id": "FIELD_TEST_001",
        "temperature": 32.5,
        "humidity": 45.0,
        "soil_moisture": 18.0,
        "rainfall": 0.0
    }
    response = client.post("/predict/irrigation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == "FIELD_TEST_001"
    assert "moisture_depletion_risk" in data
    assert isinstance(data["risk_flag"], bool)
    assert data["decision_log_id"] is not None

def test_predict_crop():
    payload = {
        "field_id": "FIELD_TEST_002",
        "N": 90.0,
        "P": 42.0,
        "K": 43.0,
        "temperature": 20.8,
        "humidity": 82.0,
        "ph": 6.5,
        "rainfall": 202.9
    }
    response = client.post("/predict/crop", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == "FIELD_TEST_002"
    assert "recommended_crop" in data
    assert len(data["top_3_recommendations"]) == 3

def test_predict_fertilizer():
    payload = {
        "field_id": "FIELD_TEST_003",
        "temperature": 26.0,
        "humidity": 52.0,
        "moisture": 38.0,
        "soil_type": "Clayey",
        "crop_type": "Paddy",
        "nitrogen": 12.0,
        "phosphorus": 35.0,
        "potassium": 10.0
    }
    response = client.post("/predict/fertilizer", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == "FIELD_TEST_003"
    assert "recommended_fertilizer" in data

def test_predict_yield():
    payload = {
        "field_id": "FIELD_TEST_004",
        "year": 2024,
        "state_name": "ALABAMA",
        "county_name": "BALDWIN",
        "commodity_desc": "CORN",
        "production_bu": 1177000.0
    }
    response = client.post("/predict/yield", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == "FIELD_TEST_004"
    assert "predicted_yield_bu_per_acre" in data
    assert data["unit"] == "BU / ACRE"

def test_outcomes_and_alerts():
    # Outcome
    res1 = client.post("/outcomes", json={"decision_log_id": 1, "actual_outcome": "irrigation_triggered"})
    assert res1.status_code == 200
    
    # Alert
    res2 = client.post("/actions/alert", json={"field_id": "FIELD_TEST_001", "model_type": "irrigation", "reason": "High risk"})
    assert res2.status_code == 200

def test_dashboard():
    res1 = client.get("/dashboard/recent-predictions")
    assert res1.status_code == 200
    res2 = client.get("/dashboard/alerts")
    assert res2.status_code == 200


