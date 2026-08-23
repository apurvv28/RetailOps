import os
import json
import logging
import pandas as pd
import numpy as np
import mlflow
import mlflow.sklearn
import mlflow.lightgbm
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, mean_squared_error, r2_score
import lightgbm as lgb
from dotenv import load_dotenv

# ==================== LOGGING SETUP ====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("krishiloop.train")

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
SAVED_MODELS_DIR = os.path.join(BACKEND_DIR, "models_saved")
os.makedirs(SAVED_MODELS_DIR, exist_ok=True)

def setup_mlflow():
    os.environ["MLFLOW_ALLOW_FILE_STORE"] = "true"
    mlflow_dir = os.path.join(BACKEND_DIR, "mlruns")
    os.makedirs(mlflow_dir, exist_ok=True)
    uri = "file:///" + os.path.abspath(mlflow_dir).replace('\\', '/')
    try:
        mlflow.set_tracking_uri(uri)
        mlflow.set_experiment("AgriTech_Intelligence_Suite")
        logger.info(f"MLflow tracking active at {uri}")
    except Exception as e:
        logger.warning(f"MLflow setup notice: {e}")


setup_mlflow()




DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
LATEST_RUN_FILE = os.path.join(os.path.dirname(__file__), "latest_run.txt")

def prepare_irrigation_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineers sensor-stream-compatible features from the raw Maharashtra soil moisture CSV.
    
    The IoT telemetry stream provides:
      soil_moisture, temperature, humidity, rainfall, N, P, K, ph
    
    This function maps those concepts onto features derivable from the Maharashtra NRSC dataset,
    ensuring the model trained here uses EXACTLY the same feature set as the inference pipeline.
    
    Feature mapping:
      soil_moisture      → sm_pct (NRSC soil moisture percentage at 15cm)
      temperature        → synthetic (30°C base + monsoon modulation)
      humidity           → synthetic (55% base + monsoon boost)
      rainfall           → depletion-rate proxy (low depletion = recent rainfall = higher synthetic mm)
      N, P, K            → synthetic NPK from soil moisture regime (nutrient-moisture coupling)
      ph                 → synthetic (6.8 base + slight monsoon acidification)
      moisture_deficit   → 100 - soil_moisture  (computed at inference time too)
      hydro_thermal_idx  → temperature / (humidity + 1e-5)
      is_monsoon         → month in [6,7,8,9]
    """
    out = pd.DataFrame()

    # Core: soil moisture as percentage
    out["soil_moisture"] = df["sm_pct"].clip(0, 100)

    # Temperature: Maharashtra monthly normals with monsoon cooling
    # (Base 32°C April-June, drops to 27°C July-Sept, rises Oct-Dec)
    month_temp_map = {1:24, 2:26, 3:30, 4:33, 5:35, 6:32, 7:28, 8:27, 9:28, 10:30, 11:27, 12:24}
    out["temperature"] = df["month"].astype(int).map(month_temp_map).fillna(28.0)
    # Add slight noise for variability
    np.random.seed(42)
    out["temperature"] = out["temperature"] + np.random.normal(0, 1.5, len(df))
    out["temperature"] = out["temperature"].clip(15.0, 45.0)

    # Humidity: higher in monsoon months
    out["humidity"] = np.where(df["is_monsoon"] == 1, 
                               (60 + out["soil_moisture"] * 0.3).clip(55, 92),
                               (40 + out["soil_moisture"] * 0.2).clip(25, 65))
    out["humidity"] = out["humidity"].astype(float)

    # Rainfall: estimated from depletion rate (negative depletion = soil gaining moisture = rainfall)
    # Clamp to [0, 300] mm range typical for Maharashtra
    depl = df["hist_depletion_rate"].fillna(0)
    out["rainfall"] = (-depl * 15).clip(0, 300)  # scale factor maps depletion units to mm

    # NPK: soil moisture correlated proxies (higher SM → better nutrient availability)
    out["nitrogen"] = (out["soil_moisture"] * 0.8 + 20 + np.random.normal(0, 5, len(df))).clip(0, 120)
    out["phosphorus"] = (out["soil_moisture"] * 0.4 + 10 + np.random.normal(0, 3, len(df))).clip(0, 80)
    out["potassium"] = (out["soil_moisture"] * 0.5 + 15 + np.random.normal(0, 4, len(df))).clip(0, 100)

    # pH: slightly acidic in monsoon, neutral otherwise
    out["ph"] = np.where(df["is_monsoon"] == 1, 
                         (6.5 + np.random.normal(0, 0.2, len(df))).clip(5.5, 7.5),
                         (7.0 + np.random.normal(0, 0.2, len(df))).clip(6.0, 8.5))
    out["ph"] = out["ph"].astype(float)

    # Computed features — mirror exactly what inference pipeline computes:
    out["moisture_deficit"] = (100.0 - out["soil_moisture"]).clip(0, 100)
    out["hydro_thermal_index"] = out["temperature"] / (out["humidity"] + 1e-5)
    out["is_monsoon"] = df["is_monsoon"].astype(int)

    return out


def train_irrigation_risk_model():
    logger.info("Training Irrigation Risk Model (5-Fold CV) — sensor-aligned features")
    csv_path = os.path.join(DATA_DIR, "processed_irrigation_maharashtra.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Processed dataset missing at {csv_path}")

    df = pd.read_csv(csv_path)

    # === FEATURE ENGINEERING: map Maharashtra NRSC data → sensor-stream features ===
    # These 10 features EXACTLY match what main.py sends at inference time.
    X = prepare_irrigation_dataset(df)
    y = df["target"].astype(int)

    # Feature column order must match inference exactly
    FEATURE_COLS = [
        "soil_moisture", "temperature", "humidity", "rainfall",
        "nitrogen", "phosphorus", "potassium", "ph",
        "moisture_deficit", "hydro_thermal_index", "is_monsoon"
    ]
    X = X[FEATURE_COLS].fillna(0)
    
    params = {
        "objective": "binary",
        "metric": "auc",
        "learning_rate": 0.05,
        "max_depth": 5,
        "num_leaves": 15,
        "min_child_samples": 20,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "reg_alpha": 1.0,
        "reg_lambda": 1.0,
        "verbosity": -1,
        "seed": 42
    }

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    train_aucs, val_aucs = [], []
    best_model = None
    best_val_auc = -1.0

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_train, y_train = X.iloc[train_idx], y.iloc[train_idx]
        X_val, y_val = X.iloc[val_idx], y.iloc[val_idx]

        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

        model = lgb.train(
            params,
            train_data,
            num_boost_round=200,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(stopping_rounds=20, verbose=False)]
        )

        tr_pred = model.predict(X_train)
        val_pred = model.predict(X_val)

        tr_auc = roc_auc_score(y_train, tr_pred)
        val_auc = roc_auc_score(y_val, val_pred)

        train_aucs.append(tr_auc)
        val_aucs.append(val_auc)
        logger.info(f"  Fold {fold+1}/5 — Train AUC: {tr_auc:.4f} | Val AUC: {val_auc:.4f}")

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            best_model = model

    mean_train_auc = float(np.mean(train_aucs))
    mean_val_auc = float(np.mean(val_aucs))
    overfit_gap = mean_train_auc - mean_val_auc

    logger.info(f"Irrigation Risk 5-CV -> Train AUC: {mean_train_auc:.4f} | Val AUC: {mean_val_auc:.4f} | Gap: {overfit_gap:+.4f}")
    logger.info(f"Features trained on: {list(X.columns)}")


    # Save model locally for guaranteed loading
    import joblib
    local_pkl_path = os.path.join(SAVED_MODELS_DIR, "irrigation_model.pkl")
    local_txt_path = os.path.join(SAVED_MODELS_DIR, "irrigation_model.txt")
    joblib.dump(best_model, local_pkl_path)
    best_model.save_model(local_txt_path)
    logger.info(f"Saved irrigation model to {local_pkl_path}")

    run_id = "local"
    try:
        with mlflow.start_run(run_name="Irrigation_Risk_LightGBM_v3_SensorAligned") as run:
            mlflow.log_params(params)
            mlflow.log_params({"feature_count": len(FEATURE_COLS), "feature_cols": str(FEATURE_COLS)})
            mlflow.log_metrics({
                "train_roc_auc": mean_train_auc,
                "val_roc_auc": mean_val_auc,
                "overfit_gap": overfit_gap
            })
            model_name = "irrigation-risk"
            try:
                mlflow.lightgbm.log_model(best_model, "model", registered_model_name=model_name)
            except Exception as e:
                logger.warning(f"MLflow model registration notice: {e}")
            run_id = run.info.run_id
    except Exception as mlflow_err:
        logger.warning(f"MLflow tracking run notice: {mlflow_err}")

    return {"model_name": "irrigation-risk", "run_id": run_id, "metric": mean_val_auc, "metric_name": "val_roc_auc", "overfit_gap": overfit_gap}


def train_crop_recommendation_model():
    print("\n==========================================")
    print(" 2. Training Crop Recommendation Model (5-Fold CV, Regularized) ")
    print("==========================================")
    csv_path = os.path.join(DATA_DIR, "processed_crop_recommendation.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Processed dataset missing at {csv_path}")
        
    df = pd.read_csv(csv_path)
    feature_cols = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall", "N_P_ratio", "N_K_ratio", "P_K_ratio"]
    target_col = "label"
    
    X = df[feature_cols].copy().fillna(0)
    le = LabelEncoder()
    y = le.fit_transform(df[target_col])
    num_classes = len(le.classes_)
    classes_dict = {i: cls_name for i, cls_name in enumerate(le.classes_)}

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    train_f1s, val_f1s = [], []
    best_model = None
    best_val_f1 = -1.0

    params = {
        "objective": "multiclass",
        "num_class": num_classes,
        "metric": "multi_logloss",
        "learning_rate": 0.03,
        "max_depth": 3,
        "num_leaves": 10,
        "min_child_samples": 25,
        "subsample": 0.7,
        "colsample_bytree": 0.7,
        "reg_alpha": 1.5,
        "reg_lambda": 1.5,
        "verbosity": -1,
        "seed": 42
    }

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_train, y_train = X.iloc[train_idx], y[train_idx]
        X_val, y_val = X.iloc[val_idx], y[val_idx]
        
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        model = lgb.train(
            params,
            train_data,
            num_boost_round=120,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(stopping_rounds=15, verbose=False)]
        )
        
        tr_pred = np.argmax(model.predict(X_train), axis=1)
        val_pred = np.argmax(model.predict(X_val), axis=1)
        
        tr_f1 = f1_score(y_train, tr_pred, average="macro", zero_division=0)
        val_f1 = f1_score(y_val, val_pred, average="macro", zero_division=0)
        
        train_f1s.append(tr_f1)
        val_f1s.append(val_f1)
        
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_model = model

    mean_train_f1 = float(np.mean(train_f1s))
    mean_val_f1 = float(np.mean(val_f1s))
    overfit_gap = mean_train_f1 - mean_val_f1

    print(f"Crop Recommendation 5-CV -> Train Macro F1: {mean_train_f1:.4f} | Val Macro F1: {mean_val_f1:.4f} | Overfit Gap: {overfit_gap:+.4f}")
    
    # Save model locally for guaranteed loading
    import joblib
    local_pkl_path = os.path.join(SAVED_MODELS_DIR, "crop_model.pkl")
    local_txt_path = os.path.join(SAVED_MODELS_DIR, "crop_model.txt")
    joblib.dump(best_model, local_pkl_path)
    best_model.save_model(local_txt_path)
    logger.info(f"Saved crop recommendation model to {local_pkl_path}")

    run_id = "local"
    try:
        with mlflow.start_run(run_name="Crop_Recommender_LightGBM_5CV") as run:
            mlflow.log_params(params)
            mlflow.log_metrics({
                "train_macro_f1": mean_train_f1,
                "val_macro_f1": mean_val_f1,
                "overfit_gap": overfit_gap
            })
            mlflow.log_dict(classes_dict, "label_encoder_classes.json")
            model_name = "crop-recommender"
            try:
                mlflow.lightgbm.log_model(best_model, "model", registered_model_name=model_name)
            except Exception as e:
                logger.warning(f"MLflow model registration notice: {e}")
            run_id = run.info.run_id
    except Exception as mlflow_err:
        logger.warning(f"MLflow tracking run notice: {mlflow_err}")

    return {"model_name": model_name, "run_id": run_id, "metric": mean_val_f1, "metric_name": "val_macro_f1", "classes": classes_dict, "overfit_gap": overfit_gap}

def train_fertilizer_recommendation_model():
    print("\n==========================================")
    print(" 3. Training Fertilizer Recommendation Model (5-Fold CV, Heavy Regularization) ")
    print("==========================================")
    csv_path = os.path.join(DATA_DIR, "processed_fertilizer_prediction.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Processed dataset missing at {csv_path}")
        
    df = pd.read_csv(csv_path)
    
    soil_le = LabelEncoder()
    crop_le = LabelEncoder()
    fert_le = LabelEncoder()
    
    df["soil_type_code"] = soil_le.fit_transform(df["soil_type"].astype(str))
    df["crop_type_code"] = crop_le.fit_transform(df["crop_type"].astype(str))
    y = fert_le.fit_transform(df["fertilizer_name"].astype(str))
    
    feature_cols = ["temperature", "humidity", "moisture", "nitrogen", "phosphorus", "potassium", "N_P_ratio", "soil_type_code", "crop_type_code"]
    X = df[feature_cols].copy().fillna(0)
    num_classes = len(fert_le.classes_)
    fert_classes_dict = {i: cls_name for i, cls_name in enumerate(fert_le.classes_)}

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    train_f1s, val_f1s = [], []
    best_model = None
    best_val_f1 = -1.0

    # Shallow trees & high regularization to prevent overfitting on 99 rows
    params = {
        "objective": "multiclass",
        "num_class": num_classes,
        "metric": "multi_logloss",
        "learning_rate": 0.03,
        "max_depth": 2,
        "num_leaves": 4,
        "min_child_samples": 8,
        "subsample": 0.6,
        "colsample_bytree": 0.6,
        "reg_alpha": 2.0,
        "reg_lambda": 2.0,
        "verbosity": -1,
        "seed": 42
    }

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_train, y_train = X.iloc[train_idx], y[train_idx]
        X_val, y_val = X.iloc[val_idx], y[val_idx]
        
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        model = lgb.train(
            params,
            train_data,
            num_boost_round=100,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(stopping_rounds=15, verbose=False)]
        )
        
        tr_pred = np.argmax(model.predict(X_train), axis=1)
        val_pred = np.argmax(model.predict(X_val), axis=1)
        
        tr_f1 = f1_score(y_train, tr_pred, average="macro", zero_division=0)
        val_f1 = f1_score(y_val, val_pred, average="macro", zero_division=0)
        
        train_f1s.append(tr_f1)
        val_f1s.append(val_f1)
        
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_model = model

    mean_train_f1 = float(np.mean(train_f1s))
    mean_val_f1 = float(np.mean(val_f1s))
    overfit_gap = mean_train_f1 - mean_val_f1

    print(f"Fertilizer Recommendation 5-CV -> Train Macro F1: {mean_train_f1:.4f} | Val Macro F1: {mean_val_f1:.4f} | Overfit Gap: {overfit_gap:+.4f}")
    
    # Save model locally for guaranteed loading
    import joblib
    local_pkl_path = os.path.join(SAVED_MODELS_DIR, "fertilizer_model.pkl")
    local_txt_path = os.path.join(SAVED_MODELS_DIR, "fertilizer_model.txt")
    joblib.dump(best_model, local_pkl_path)
    best_model.save_model(local_txt_path)
    logger.info(f"Saved fertilizer model to {local_pkl_path}")
    
    run_id = "local"
    try:
        with mlflow.start_run(run_name="Fertilizer_Recommender_LightGBM_5CV") as run:
            mlflow.log_params(params)
            mlflow.log_metrics({
                "train_macro_f1": mean_train_f1,
                "val_macro_f1": mean_val_f1,
                "overfit_gap": overfit_gap
            })
            mlflow.log_dict(fert_classes_dict, "fertilizer_classes.json")
            model_name = "fertilizer-recommender"
            try:
                mlflow.lightgbm.log_model(best_model, "model", registered_model_name=model_name)
            except Exception as e:
                logger.warning(f"MLflow model registration notice: {e}")
            run_id = run.info.run_id
    except Exception as mlflow_err:
        logger.warning(f"MLflow tracking run notice: {mlflow_err}")

    return {"model_name": model_name, "run_id": run_id, "metric": mean_val_f1, "metric_name": "val_macro_f1", "classes": fert_classes_dict, "overfit_gap": overfit_gap}

def prepare_india_yield_dataset() -> pd.DataFrame:
    """
    Engineers an India-relevant Crop Yield dataset using telemetry features:
      nitrogen, phosphorus, potassium, temperature, humidity, soil_moisture, rainfall, crop_type
    Target:
      yield_tonnes_per_hectare (t/ha)
      
    Base average yields in India (t/ha):
      Rice: 3.8, Maize: 3.2, Chickpea: 1.4, Cotton: 2.2, Wheat: 3.5, Banana: 42.0,
      Pomegranate: 12.0, Mango: 8.5, Grapes: 22.0, Coffee: 1.1, Jute: 2.5, etc.
    """
    crop_path = os.path.join(DATA_DIR, "processed_crop_recommendation.csv")
    if not os.path.exists(crop_path):
        raise FileNotFoundError(f"Processed dataset missing at {crop_path}")
        
    df = pd.read_csv(crop_path).copy()
    
    # Base yield dictionary by crop type (tonnes / hectare in India)
    base_yields = {
        "rice": 3.8, "maize": 3.2, "chickpea": 1.4, "kidneybeans": 1.2, "pigeonpeas": 1.0,
        "mothbeans": 0.8, "mungbean": 0.9, "blackgram": 0.9, "lentil": 1.1, "pomegranate": 12.5,
        "banana": 45.0, "mango": 9.0, "grapes": 24.0, "watermelon": 28.0, "muskmelon": 22.0,
        "apple": 14.0, "orange": 11.0, "papaya": 35.0, "coconut": 10.5, "cotton": 2.2,
        "jute": 2.6, "coffee": 1.2
    }
    
    np.random.seed(42)

    # 1. Base yield by crop label
    df["base_yield"] = df["label"].map(base_yields).fillna(2.5)

    # 2. Add soil_moisture (derived from humidity/rainfall in crop dataset)
    df["soil_moisture"] = (df["humidity"] * 0.4 + (df["rainfall"] / 10.0) * 0.6).clip(10.0, 95.0)

    # 3. Agronomic modifiers
    # Nutrient factor (optimal N=80, P=40, K=40)
    n_factor = (df["N"] / 80.0).clip(0.5, 1.3)
    p_factor = (df["P"] / 40.0).clip(0.6, 1.25)
    k_factor = (df["K"] / 40.0).clip(0.6, 1.25)
    nutrient_mult = (n_factor * 0.5 + p_factor * 0.25 + k_factor * 0.25)

    # Weather/moisture suitability factor
    moisture_mult = (df["soil_moisture"] / 40.0).clip(0.6, 1.3)
    temp_mult = np.where((df["temperature"] >= 20) & (df["temperature"] <= 32), 1.1, 0.85)

    # Target yield in tonnes/ha with slight random noise
    df["yield_tonnes_per_hectare"] = (
        df["base_yield"] * nutrient_mult * moisture_mult * temp_mult + np.random.normal(0, 0.15, len(df))
    ).clip(0.3, 85.0).round(2)

    return df

def train_yield_prediction_model():
    logger.info("Training Yield Prediction Model (India Telemetry, 5-Fold CV)")
    df = prepare_india_yield_dataset()

    comm_le = LabelEncoder()
    df["crop_code"] = comm_le.fit_transform(df["label"].astype(str))

    # Save crop_code mapping for inference
    crop_code_map = dict(zip(comm_le.classes_, range(len(comm_le.classes_))))
    with open(os.path.join(SAVED_MODELS_DIR, "yield_crop_encoder.json"), "w") as f:
        json.dump(crop_code_map, f, indent=2)

    feature_cols = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall", "soil_moisture", "crop_code"]
    target_col = "yield_tonnes_per_hectare"

    X = df[feature_cols].copy().fillna(0)
    y = df[target_col].copy()

    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    train_r2s, val_r2s = [], []
    train_rmses, val_rmses = [], []
    best_model = None
    best_val_r2 = -1.0

    params = {
        "objective": "regression",
        "metric": "rmse",
        "learning_rate": 0.05,
        "max_depth": 5,
        "num_leaves": 15,
        "min_child_samples": 20,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "reg_alpha": 1.0,
        "reg_lambda": 1.0,
        "verbosity": -1,
        "seed": 42
    }

    for fold, (train_idx, val_idx) in enumerate(kf.split(X, y)):
        X_train, y_train = X.iloc[train_idx], y.iloc[train_idx]
        X_val, y_val = X.iloc[val_idx], y.iloc[val_idx]

        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

        model = lgb.train(
            params,
            train_data,
            num_boost_round=150,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(stopping_rounds=20, verbose=False)]
        )

        tr_pred = model.predict(X_train)
        val_pred = model.predict(X_val)

        tr_r2 = r2_score(y_train, tr_pred)
        val_r2 = r2_score(y_val, val_pred)
        tr_rmse = np.sqrt(mean_squared_error(y_train, tr_pred))
        val_rmse = np.sqrt(mean_squared_error(y_val, val_pred))

        train_r2s.append(tr_r2)
        val_r2s.append(val_r2)
        train_rmses.append(tr_rmse)
        val_rmses.append(val_rmse)

        if val_r2 > best_val_r2:
            best_val_r2 = val_r2
            best_model = model

    mean_train_r2 = float(np.mean(train_r2s))
    mean_val_r2 = float(np.mean(val_r2s))
    mean_val_rmse = float(np.mean(val_rmses))
    overfit_gap = mean_train_r2 - mean_val_r2

    logger.info(f"India Yield Predictor 5-CV → Train R2: {mean_train_r2:.4f} | Val R2: {mean_val_r2:.4f} | Val RMSE: {mean_val_rmse:.4f} t/ha | Gap: {overfit_gap:+.4f}")

    # Save model locally
    import joblib
    local_pkl_path = os.path.join(SAVED_MODELS_DIR, "yield_model.pkl")
    local_txt_path = os.path.join(SAVED_MODELS_DIR, "yield_model.txt")
    joblib.dump(best_model, local_pkl_path)
    best_model.save_model(local_txt_path)
    logger.info(f"Saved yield model to {local_pkl_path}")

    run_id = "local"
    try:
        with mlflow.start_run(run_name="India_Yield_Predictor_LightGBM_5CV") as run:
            mlflow.log_params(params)
            mlflow.log_metrics({
                "train_r2": mean_train_r2,
                "val_r2": mean_val_r2,
                "val_rmse": mean_val_rmse,
                "overfit_gap": overfit_gap
            })
            model_name = "yield-predictor"
            try:
                mlflow.lightgbm.log_model(best_model, "model", registered_model_name=model_name)
            except Exception as e:
                logger.warning(f"MLflow model registration notice: {e}")
            run_id = run.info.run_id
    except Exception as mlflow_err:
        logger.warning(f"MLflow tracking run notice: {mlflow_err}")

    return {"model_name": "yield-predictor", "run_id": run_id, "metric": mean_val_r2, "metric_name": "val_r2", "val_rmse": mean_val_rmse, "overfit_gap": overfit_gap}


def run_all_training():
    res_irrigation = train_irrigation_risk_model()
    res_crop = train_crop_recommendation_model()
    res_fertilizer = train_fertilizer_recommendation_model()
    res_yield = train_yield_prediction_model()
    
    summary = {
        "irrigation-risk": res_irrigation,
        "crop-recommender": res_crop,
        "fertilizer-recommender": res_fertilizer,
        "yield-predictor": res_yield
    }
    
    with open(LATEST_RUN_FILE, "w") as f:
        json.dump(summary, f, indent=2)
        
    print("\n==========================================")
    print(" All 4 AgriTech Models Trained with 5-Fold Cross-Validation! ")
    print(f" Saved run summary to {LATEST_RUN_FILE}")
    print("==========================================")
    return summary

if __name__ == "__main__":
    run_all_training()




