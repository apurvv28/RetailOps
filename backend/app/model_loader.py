import os
import mlflow
import mlflow.pyfunc
import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Load .env
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path, override=True)

def get_mlflow_uri():
    uri = os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlruns.db")

    if uri.startswith("sqlite:///"):
        db_name = uri.replace("sqlite:///", "")

        if not os.path.isabs(db_name):
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            db_path = os.path.abspath(os.path.join(backend_dir, db_name))
            uri = f"sqlite:///{db_path.replace(os.sep, '/')}"

    return uri

MLFLOW_TRACKING_URI = get_mlflow_uri()
MODEL_NAME = "Retail_Ops_LightGBM"

model = None
model_version = "v1.0.0"

class FallbackModel:
    """Fallback model if MLflow server or registry artifact is unreachable."""
    def predict(self, df: pd.DataFrame) -> np.ndarray:
        # Heuristic scoring based on demand velocity and inventory ratios
        if "simulated_inventory" in df.columns and "daily_sales_avg_7" in df.columns:
            inv = df["simulated_inventory"].values
            sales = df["daily_sales_avg_7"].values + 1e-5
            ratio = inv / sales
            # High sales + low inventory -> high stockout risk
            probs = np.where(ratio < 5.0, 0.85, 0.15)
            return probs
        return np.array([0.25] * len(df))

def load_production_model():
    """
    Load the current Production model from MLflow Registry.
    """
    global model
    global model_version

    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    model_uri = f"models:/{MODEL_NAME}/Production"

    try:
        print(f"Loading model from {model_uri} at URI {MLFLOW_TRACKING_URI}")
        model = mlflow.pyfunc.load_model(model_uri)
        model_version = "Production"
        print("Production model loaded successfully.")
    except Exception as e:
        print(f"Warning: Could not load production model from MLflow registry: {e}")
        print("Initializing FallbackModel for serving...")
        model = FallbackModel()
        model_version = "v1.0.0-fallback"

    return model

def compute_top_features(input_df: pd.DataFrame) -> list:
    """
    Computes top feature contributions for a prediction request.
    """
    feature_cols = [
        "daily_sales_avg_7", "daily_sales_avg_14", "daily_sales_avg_30",
        "demand_velocity", "day_of_week", "month", "holiday_flag",
        "simulated_inventory", "inventory_to_sales_ratio", "inventory_to_sales_ratio_7"
    ]
    
    # Priority weighting for feature contribution estimation
    feature_importance_weights = {
        "demand_velocity": 0.25,
        "inventory_to_sales_ratio_7": 0.20,
        "simulated_inventory": 0.18,
        "daily_sales_avg_7": 0.15,
        "inventory_to_sales_ratio": 0.10,
        "daily_sales_avg_14": 0.05,
        "daily_sales_avg_30": 0.03,
        "holiday_flag": 0.02,
        "day_of_week": 0.01,
        "month": 0.01
    }

    results = []
    row = input_df.iloc[0]
    for col in feature_cols:
        if col in row:
            val = float(row[col])
            weight = feature_importance_weights.get(col, 0.05)
            importance = round(abs(val) * weight, 4)
            results.append({
                "feature": col,
                "value": round(val, 4),
                "importance": importance
            })
            
    # Sort by importance descending and pick top 3
    results.sort(key=lambda x: x["importance"], reverse=True)
    return results[:3]