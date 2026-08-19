import os
import argparse
import pandas as pd
import numpy as np
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

MAHARASHTRA_SM_CSV = os.path.join(DATA_DIR, "sm_Maharashtra_2018.csv")
FERTILIZER_REAL_CSV = os.path.join(DATA_DIR, "fertilizer_prediction_real.csv")
CROP_REAL_CSV = os.path.join(DATA_DIR, "crop_recommendation_real.csv")
CROPNET_YIELD_CSV = os.path.join(DATA_DIR, "cropnet_yield.csv")

PROCESSED_IRRIGATION_CSV = os.path.join(DATA_DIR, "processed_irrigation_maharashtra.csv")
PROCESSED_CROP_CSV = os.path.join(DATA_DIR, "processed_crop_recommendation.csv")
PROCESSED_FERTILIZER_CSV = os.path.join(DATA_DIR, "processed_fertilizer_prediction.csv")
PROCESSED_YIELD_CSV = os.path.join(DATA_DIR, "processed_cropnet_yield.csv")

def process_maharashtra_irrigation_features():
    print("1. Engineering leak-free features for Maharashtra Soil Moisture (Irrigation Risk)...")
    if not os.path.exists(MAHARASHTRA_SM_CSV):
        raise FileNotFoundError(f"Missing {MAHARASHTRA_SM_CSV}")

    df = pd.read_csv(MAHARASHTRA_SM_CSV)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values(["DistrictName", "Date"]).reset_index(drop=True)

    # Clean numeric columns
    df["sm_level"] = pd.to_numeric(df["Average Soilmoisture Level (at 15cm)"], errors="coerce").fillna(0)
    df["sm_pct"] = pd.to_numeric(df["Aggregate Soilmoisture Percentage (at 15cm)"], errors="coerce").fillna(0)
    df["sm_vol_pct"] = pd.to_numeric(df["Volume Soilmoisture percentage (at 15cm)"], errors="coerce").fillna(0)
    df["month"] = df["Date"].dt.month
    df["day_of_year"] = df["Date"].dt.dayofyear
    df["is_monsoon"] = np.where(df["month"].isin([6, 7, 8, 9]), 1, 0)

    # Compute historical rolling features & forward 3-day target per district
    res = []
    for district, group in df.groupby("DistrictName"):
        group = group.copy()
        # Historical signals (PAST 3-7 days)
        group["sm_3d_avg"] = group["sm_pct"].rolling(3, min_periods=1).mean()
        group["sm_7d_avg"] = group["sm_pct"].rolling(7, min_periods=1).mean()
        group["hist_depletion_rate"] = group["sm_pct"] - group["sm_3d_avg"]
        
        # FORWARD TARGET: Predict if soil moisture 3 days in the future drops below 20.0%
        group["future_sm_pct"] = group["sm_pct"].shift(-3)
        group["target"] = np.where(group["future_sm_pct"] < 20.0, 1, 0)
        
        # Drop rows where future target is NaN (end of time series)
        group = group.dropna(subset=["future_sm_pct"])
        res.append(group)

    proc_df = pd.concat(res, ignore_index=True)
    proc_df.to_csv(PROCESSED_IRRIGATION_CSV, index=False)
    print(f"   Saved processed leak-free irrigation dataset to {PROCESSED_IRRIGATION_CSV} ({len(proc_df)} rows)")

def process_crop_recommendation_features():
    print("2. Engineering features for Real Crop Recommendation...")
    if not os.path.exists(CROP_REAL_CSV):
        raise FileNotFoundError(f"Missing {CROP_REAL_CSV}")

    df = pd.read_csv(CROP_REAL_CSV)
    df["N_P_ratio"] = df["N"] / (df["P"] + 1e-5)
    df["N_K_ratio"] = df["N"] / (df["K"] + 1e-5)
    df["P_K_ratio"] = df["P"] / (df["K"] + 1e-5)
    df.to_csv(PROCESSED_CROP_CSV, index=False)
    print(f"   Saved processed crop recommendation dataset to {PROCESSED_CROP_CSV} ({len(df)} rows)")

def process_fertilizer_recommendation_features():
    print("3. Engineering features for Real Fertilizer Prediction...")
    if not os.path.exists(FERTILIZER_REAL_CSV):
        raise FileNotFoundError(f"Missing {FERTILIZER_REAL_CSV}")

    df = pd.read_csv(FERTILIZER_REAL_CSV)
    # Clean column typos and spaces
    rename_map = {
        "Temparature": "temperature",
        "Humidity ": "humidity",
        "Moisture": "moisture",
        "Soil Type": "soil_type",
        "Crop Type": "crop_type",
        "Nitrogen": "nitrogen",
        "Potassium": "potassium",
        "Phosphorous": "phosphorus",
        "Fertilizer Name": "fertilizer_name"
    }
    df = df.rename(columns=rename_map)
    df["N_P_ratio"] = df["nitrogen"] / (df["phosphorus"] + 1e-5)
    df.to_csv(PROCESSED_FERTILIZER_CSV, index=False)
    print(f"   Saved processed fertilizer dataset to {PROCESSED_FERTILIZER_CSV} ({len(df)} rows)")

def process_cropnet_yield_features():
    print("4. Engineering features for CropNet Yield Prediction...")
    if not os.path.exists(CROPNET_YIELD_CSV):
        raise FileNotFoundError(f"Missing {CROPNET_YIELD_CSV}")

    df = pd.read_csv(CROPNET_YIELD_CSV)
    df["production_bu"] = df["production_bu"].fillna(0)
    df["log_production"] = np.log1p(df["production_bu"])
    df.to_csv(PROCESSED_YIELD_CSV, index=False)
    print(f"   Saved processed yield dataset to {PROCESSED_YIELD_CSV} ({len(df)} rows)")

def run_feature_engineering():
    print("==========================================")
    print(" Running Feature Engineering on Real Data ")
    print("==========================================")
    process_maharashtra_irrigation_features()
    process_crop_recommendation_features()
    process_fertilizer_recommendation_features()
    process_cropnet_yield_features()
    print("AgriTech feature engineering complete for all 4 real datasets!")

if __name__ == "__main__":
    run_feature_engineering()


