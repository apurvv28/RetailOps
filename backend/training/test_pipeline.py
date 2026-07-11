import os
import sys
import pandas as pd
import pytest
import pandera as pa

# Ensure backend directory is in the path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from training.data_validation import validate_events_df
from training.feature_engineering import is_uk_holiday, simulate_inventory_for_sku

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
    # This should pass without raising exceptions
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
        "unit_price": [-1.0],  # Invalid negative price
        "customer_id": ["17850"],
        "country": ["United Kingdom"]
    })
    # This should raise SchemaError/SchemaErrors
    with pytest.raises(Exception):
        validate_events_df(invalid_df)

def test_data_validation_invalid_cancellation():
    invalid_df = pd.DataFrame({
        "invoice_no": ["536365"],  # Does NOT start with 'C'
        "stock_code": ["85123A"],
        "description": ["WHITE HANGING HEART T-LIGHT HOLDER"],
        "quantity": [-6],  # Negative quantity
        "invoice_date": ["2009-12-01 07:45:00"],
        "unit_price": [2.55],
        "customer_id": ["17850"],
        "country": ["United Kingdom"]
    })
    # This should raise SchemaError/SchemaErrors due to dataframe check failing
    with pytest.raises(Exception):
        validate_events_df(invalid_df)

def test_inventory_simulation():
    # Generate mock daily sales data
    dates = pd.date_range(start="2026-01-01", periods=20, freq="D")
    # Low sales days, then high sales days
    sales = [1, 1, 1, 1, 1, 1, 1, 10, 10, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1]
    
    sku_df = pd.DataFrame({
        "date": dates,
        "quantity": sales
    })
    
    simulated = simulate_inventory_for_sku(sku_df, "TEST_SKU")
    
    # Assertions
    assert "simulated_inventory" in simulated.columns
    assert "stockout_occurred" in simulated.columns
    assert "target" in simulated.columns
    assert len(simulated) == 20
    # Check target contains binary labels
    assert set(simulated["target"].unique()).issubset({0, 1})
