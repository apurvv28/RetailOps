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

# Multi-model global instances
irrigation_model = None
crop_model = None
fertilizer_model = None
yield_model = None
model_version = "Production-v1.0"

class FallbackIrrigationModel:
    def predict(self, df: pd.DataFrame) -> np.ndarray:
        moisture = df.get("soil_moisture", pd.Series([30.0])).iloc[0]
        temp = df.get("temperature", pd.Series([25.0])).iloc[0]
        rainfall = df.get("rainfall", pd.Series([0.0])).iloc[0]
        risk = (35.0 - moisture) * 0.03 + (temp - 25.0) * 0.02 - (rainfall * 0.05)
        prob = 1 / (1 + np.exp(-risk))
        return np.array([prob])

class FallbackCropModel:
    def predict(self, df: pd.DataFrame) -> np.ndarray:
        crops = ["rice", "maize", "chickpea", "cotton", "wheat"]
        probs = np.array([[0.65, 0.15, 0.10, 0.05, 0.05]])
        return probs

class FallbackFertilizerModel:
    def predict(self, df: pd.DataFrame) -> np.ndarray:
        ferts = ["Urea", "DAP", "14-35-14", "28-28", "10-26-26"]
        probs = np.array([[0.55, 0.25, 0.10, 0.05, 0.05]])
        return probs

class FallbackYieldModel:
    def predict(self, df: pd.DataFrame) -> np.ndarray:
        return np.array([150.0])

def load_production_models():
    global irrigation_model, crop_model, fertilizer_model, yield_model, model_version
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    
    # 1. Load Irrigation Model
    try:
        irrigation_model = mlflow.pyfunc.load_model("models:/irrigation-risk/Production")
        print("Irrigation Risk model loaded from MLflow Production stage.")
    except Exception as e:
        print(f"Warning: Loading Irrigation model from MLflow failed: {e}. Using fallback.")
        irrigation_model = FallbackIrrigationModel()

    # 2. Load Crop Recommendation Model
    try:
        crop_model = mlflow.pyfunc.load_model("models:/crop-recommender/Production")
        print("Crop Recommendation model loaded from MLflow Production stage.")
    except Exception as e:
        print(f"Warning: Loading Crop model from MLflow failed: {e}. Using fallback.")
        crop_model = FallbackCropModel()

    # 3. Load Fertilizer Recommendation Model
    try:
        fertilizer_model = mlflow.pyfunc.load_model("models:/fertilizer-recommender/Production")
        print("Fertilizer Recommendation model loaded from MLflow Production stage.")
    except Exception as e:
        print(f"Warning: Loading Fertilizer model from MLflow failed: {e}. Using fallback.")
        fertilizer_model = FallbackFertilizerModel()

    # 4. Load CropNet Yield Prediction Model
    try:
        yield_model = mlflow.pyfunc.load_model("models:/yield-predictor/Production")
        print("Yield Prediction model loaded from MLflow Production stage.")
    except Exception as e:
        print(f"Warning: Loading Yield model from MLflow failed: {e}. Using fallback.")
        yield_model = FallbackYieldModel()

def compute_top_irrigation_features(input_df: pd.DataFrame) -> list:
    feature_cols = ["temperature", "humidity", "soil_moisture", "rainfall", "nitrogen", "phosphorus", "potassium"]
    weights = {"soil_moisture": 0.40, "temperature": 0.25, "rainfall": 0.15, "humidity": 0.10, "nitrogen": 0.04, "phosphorus": 0.03, "potassium": 0.03}
    results = []
    row = input_df.iloc[0]
    for col in feature_cols:
        if col in row:
            val = float(row[col])
            weight = weights.get(col, 0.05)
            importance = round(abs(val) * weight, 4)
            results.append({"feature": col, "value": round(val, 4), "importance": importance})
    results.sort(key=lambda x: x["importance"], reverse=True)
    return results[:3]