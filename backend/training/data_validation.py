import pandas as pd
import pandera as pa
from pandera import Column, Check, DataFrameSchema

# 1. Schema for Real Irrigation Telemetry (NRSC Maharashtra Soil Moisture)
maharashtra_sm_schema = DataFrameSchema(
    columns={
        "Date": Column(str, coerce=True, nullable=False),
        "DistrictName": Column(str, coerce=True, nullable=False),
        "Average Soilmoisture Level (at 15cm)": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=True),
        "Aggregate Soilmoisture Percentage (at 15cm)": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=True),
        "Volume Soilmoisture percentage (at 15cm)": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=True),
    }
)

# 2. Schema for Real Crop Recommendation Dataset
crop_recommendation_real_schema = DataFrameSchema(
    columns={
        "N": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=False),
        "P": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=False),
        "K": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=False),
        "temperature": Column(float, checks=[Check.greater_than_or_equal_to(-10.0), Check.less_than_or_equal_to(60.0)], coerce=True, nullable=False),
        "humidity": Column(float, checks=[Check.greater_than_or_equal_to(0.0), Check.less_than_or_equal_to(100.0)], coerce=True, nullable=False),
        "ph": Column(float, checks=[Check.greater_than_or_equal_to(0.0), Check.less_than_or_equal_to(14.0)], coerce=True, nullable=False),
        "rainfall": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=False),
        "label": Column(str, coerce=True, nullable=False),
    }
)

# 3. Schema for Real Fertilizer Recommendation Dataset
fertilizer_recommendation_real_schema = DataFrameSchema(
    columns={
        "Temparature": Column(float, checks=[Check.greater_than_or_equal_to(-10.0), Check.less_than_or_equal_to(60.0)], coerce=True, nullable=False),
        "Humidity ": Column(float, checks=[Check.greater_than_or_equal_to(0.0), Check.less_than_or_equal_to(100.0)], coerce=True, nullable=False),
        "Moisture": Column(float, checks=[Check.greater_than_or_equal_to(0.0), Check.less_than_or_equal_to(100.0)], coerce=True, nullable=False),
        "Soil Type": Column(str, coerce=True, nullable=False),
        "Crop Type": Column(str, coerce=True, nullable=False),
        "Nitrogen": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=False),
        "Potassium": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=False),
        "Phosphorous": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=False),
        "Fertilizer Name": Column(str, coerce=True, nullable=False),
    }
)

# 4. Schema for CropNet Yield Dataset
cropnet_yield_schema = DataFrameSchema(
    columns={
        "year": Column(int, coerce=True, nullable=False),
        "state_name": Column(str, coerce=True, nullable=False),
        "county_name": Column(str, coerce=True, nullable=False),
        "commodity_desc": Column(str, coerce=True, nullable=False),
        "yield_bu_per_acre": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=False),
    }
)

def validate_maharashtra_sm_df(df: pd.DataFrame) -> pd.DataFrame:
    print(f"Validating Maharashtra Soil Moisture dataset with Pandera... Rows: {len(df)}")
    return maharashtra_sm_schema.validate(df)

validate_irrigation_df = validate_maharashtra_sm_df

def validate_crop_df(df: pd.DataFrame) -> pd.DataFrame:
    print(f"Validating Crop Recommendation dataset with Pandera... Rows: {len(df)}")
    return crop_recommendation_real_schema.validate(df)

def validate_fertilizer_df(df: pd.DataFrame) -> pd.DataFrame:
    print(f"Validating Fertilizer Recommendation dataset with Pandera... Rows: {len(df)}")
    return fertilizer_recommendation_real_schema.validate(df)

def validate_cropnet_df(df: pd.DataFrame) -> pd.DataFrame:
    print(f"Validating CropNet Yield dataset with Pandera... Rows: {len(df)}")
    return cropnet_yield_schema.validate(df)

if __name__ == "__main__":
    print("Testing Pandera Validation on Real AgriTech datasets...")
    sample_crop = pd.DataFrame({
        "N": [90.0, 85.0],
        "P": [42.0, 58.0],
        "K": [43.0, 41.0],
        "temperature": [20.8, 21.7],
        "humidity": [82.0, 80.3],
        "ph": [6.5, 7.0],
        "rainfall": [202.9, 226.6],
        "label": ["rice", "rice"]
    })
    validate_crop_df(sample_crop)
    print("Crop data validation PASSED!")


