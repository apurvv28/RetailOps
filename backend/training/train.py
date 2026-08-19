import os
import json
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

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

def get_mlflow_uri():
    uri = os.getenv("MLFLOW_TRACKING_URI", "sqlite:///mlruns.db")
    if uri.startswith("sqlite:///"):
        db_name = uri.replace("sqlite:///", "")
        if not os.path.isabs(db_name):
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            db_path = os.path.abspath(os.path.join(backend_dir, db_name))
            uri = "sqlite:///" + db_path.replace('\\', '/')
    return uri

MLFLOW_TRACKING_URI = get_mlflow_uri()
mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
mlflow.set_experiment("AgriTech_Intelligence_Suite")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
LATEST_RUN_FILE = os.path.join(os.path.dirname(__file__), "latest_run.txt")

def train_irrigation_risk_model():
    print("\n==========================================")
    print(" 1. Training Irrigation Risk Model (5-Fold CV, Regularized) ")
    print("==========================================")
    csv_path = os.path.join(DATA_DIR, "processed_irrigation_maharashtra.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Processed dataset missing at {csv_path}")
        
    df = pd.read_csv(csv_path)
    feature_cols = ["sm_level", "sm_pct", "sm_vol_pct", "sm_3d_avg", "sm_7d_avg", "hist_depletion_rate", "month", "day_of_year", "is_monsoon"]
    target_col = "target"
    
    X = df[feature_cols].copy().fillna(0)
    y = df[target_col].astype(int).copy()
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    train_aucs, val_aucs = [], []
    best_model = None
    best_val_auc = -1.0

    params = {
        "objective": "binary",
        "metric": "auc",
        "learning_rate": 0.03,
        "max_depth": 3,
        "num_leaves": 7,
        "min_child_samples": 30,
        "subsample": 0.7,
        "colsample_bytree": 0.7,
        "reg_alpha": 2.0,
        "reg_lambda": 2.0,
        "verbosity": -1,
        "seed": 42
    }

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_train, y_train = X.iloc[train_idx], y.iloc[train_idx]
        X_val, y_val = X.iloc[val_idx], y.iloc[val_idx]
        
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        model = lgb.train(
            params,
            train_data,
            num_boost_round=120,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(stopping_rounds=15, verbose=False)]
        )
        
        tr_pred = model.predict(X_train)
        val_pred = model.predict(X_val)
        
        tr_auc = roc_auc_score(y_train, tr_pred)
        val_auc = roc_auc_score(y_val, val_pred)
        
        train_aucs.append(tr_auc)
        val_aucs.append(val_auc)
        
        if val_auc > best_val_auc:
            best_val_auc = val_auc
            best_model = model

    mean_train_auc = float(np.mean(train_aucs))
    mean_val_auc = float(np.mean(val_aucs))
    overfit_gap = mean_train_auc - mean_val_auc

    print(f"Irrigation Risk 5-CV -> Train ROC-AUC: {mean_train_auc:.4f} | Val ROC-AUC: {mean_val_auc:.4f} | Overfit Gap: {overfit_gap:+.4f}")
    
    with mlflow.start_run(run_name="Irrigation_Risk_LightGBM_5CV") as run:
        mlflow.log_params(params)
        mlflow.log_metrics({
            "train_roc_auc": mean_train_auc,
            "val_roc_auc": mean_val_auc,
            "overfit_gap": overfit_gap
        })
        model_name = "irrigation-risk"
        mlflow.lightgbm.log_model(best_model, "model", registered_model_name=model_name)
        return {"model_name": model_name, "run_id": run.info.run_id, "metric": mean_val_auc, "metric_name": "val_roc_auc", "overfit_gap": overfit_gap}

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
    
    with mlflow.start_run(run_name="Crop_Recommender_LightGBM_5CV") as run:
        mlflow.log_params(params)
        mlflow.log_metrics({
            "train_macro_f1": mean_train_f1,
            "val_macro_f1": mean_val_f1,
            "overfit_gap": overfit_gap
        })
        mlflow.log_dict(classes_dict, "label_encoder_classes.json")
        model_name = "crop-recommender"
        mlflow.lightgbm.log_model(best_model, "model", registered_model_name=model_name)
        return {"model_name": model_name, "run_id": run.info.run_id, "metric": mean_val_f1, "metric_name": "val_macro_f1", "classes": classes_dict, "overfit_gap": overfit_gap}

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
    
    with mlflow.start_run(run_name="Fertilizer_Recommender_LightGBM_5CV") as run:
        mlflow.log_params(params)
        mlflow.log_metrics({
            "train_macro_f1": mean_train_f1,
            "val_macro_f1": mean_val_f1,
            "overfit_gap": overfit_gap
        })
        mlflow.log_dict(fert_classes_dict, "fertilizer_classes.json")
        model_name = "fertilizer-recommender"
        mlflow.lightgbm.log_model(best_model, "model", registered_model_name=model_name)
        return {"model_name": model_name, "run_id": run.info.run_id, "metric": mean_val_f1, "metric_name": "val_macro_f1", "classes": fert_classes_dict, "overfit_gap": overfit_gap}

def train_yield_prediction_model():
    print("\n==========================================")
    print(" 4. Training Yield Prediction Model (Full CropNet Data, 5-Fold CV) ")
    print("==========================================")
    csv_path = os.path.join(DATA_DIR, "processed_cropnet_yield.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Processed dataset missing at {csv_path}")
        
    df = pd.read_csv(csv_path)
    
    state_le = LabelEncoder()
    county_le = LabelEncoder()
    comm_le = LabelEncoder()
    
    df["state_code"] = state_le.fit_transform(df["state_name"].astype(str))
    df["county_code"] = county_le.fit_transform(df["county_name"].astype(str))
    df["commodity_code"] = comm_le.fit_transform(df["commodity_desc"].astype(str))
    
    feature_cols = ["year", "state_code", "county_code", "commodity_code", "log_production"]
    target_col = "yield_bu_per_acre"
    
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
        "learning_rate": 0.03,
        "max_depth": 3,
        "num_leaves": 8,
        "min_child_samples": 30,
        "subsample": 0.7,
        "colsample_bytree": 0.7,
        "reg_alpha": 1.5,
        "reg_lambda": 1.5,
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
            num_boost_round=120,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(stopping_rounds=15, verbose=False)]
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

    print(f"CropNet Yield 5-CV -> Train R2: {mean_train_r2:.4f} | Val R2: {mean_val_r2:.4f} | Val RMSE: {mean_val_rmse:.4f} bu/acre | Overfit Gap: {overfit_gap:+.4f}")
    
    with mlflow.start_run(run_name="CropNet_Yield_Predictor_LightGBM_5CV") as run:
        mlflow.log_params(params)
        mlflow.log_metrics({
            "train_r2": mean_train_r2,
            "val_r2": mean_val_r2,
            "val_rmse": mean_val_rmse,
            "overfit_gap": overfit_gap
        })
        model_name = "yield-predictor"
        mlflow.lightgbm.log_model(best_model, "model", registered_model_name=model_name)
        return {"model_name": model_name, "run_id": run.info.run_id, "metric": mean_val_r2, "metric_name": "val_r2", "overfit_gap": overfit_gap}

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

if __name__ == "__main__":
    run_all_training()



