import os
import pandas as pd
import numpy as np
import mlflow
import mlflow.sklearn
import mlflow.lightgbm
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import StandardScaler
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
mlflow.set_experiment("Retail_Ops_Stockout_Risk")

FEATURES_CSV = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "training_features.csv")

def run_training():
    print(f"Loading engineered training features from {FEATURES_CSV}...")
    if not os.path.exists(FEATURES_CSV):
        raise FileNotFoundError(f"Features file not found at {FEATURES_CSV}. Please run Feature Engineering first.")
        
    df = pd.read_csv(FEATURES_CSV)
    print(f"Dataset shape: {df.shape}")
    
    # 1. Prepare Features and Target
    # Convert date to datetime for split
    df["date"] = pd.to_datetime(df["date"])
    
    # Compute ratio features
    df["inventory_to_sales_ratio"] = df["simulated_inventory"] / (df["daily_sales_avg_30"] + 1e-5)
    df["inventory_to_sales_ratio_7"] = df["simulated_inventory"] / (df["daily_sales_avg_7"] + 1e-5)
    
    feature_cols = [
        "daily_sales_avg_7", 
        "daily_sales_avg_14", 
        "daily_sales_avg_30", 
        "demand_velocity", 
        "day_of_week", 
        "month", 
        "holiday_flag",
        "simulated_inventory",
        "inventory_to_sales_ratio",
        "inventory_to_sales_ratio_7"
    ]
    target_col = "target"
    
    # 2. Time-aware Train/Test Split
    # We use the last 30 days of data for testing/validation
    max_date = df["date"].max()
    split_date = max_date - pd.Timedelta(days=30)
    
    train_df = df[df["date"] < split_date].copy()
    test_df = df[df["date"] >= split_date].copy()
    
    print(f"Training period: {train_df['date'].min().strftime('%Y-%m-%d')} to {train_df['date'].max().strftime('%Y-%m-%d')} ({len(train_df)} rows)")
    print(f"Testing period: {test_df['date'].min().strftime('%Y-%m-%d')} to {test_df['date'].max().strftime('%Y-%m-%d')} ({len(test_df)} rows)")
    
    X_train, y_train = train_df[feature_cols].copy(), train_df[target_col].copy()
    X_test, y_test = test_df[feature_cols].copy(), test_df[target_col].copy()
    
    # Clean NaN/Inf values if any
    X_train = X_train.fillna(0).replace([np.inf, -np.inf], 0)
    X_test = X_test.fillna(0).replace([np.inf, -np.inf], 0)
    
    # Scale features for Logistic Regression baseline
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # --- BASELINE MODEL: LOGISTIC REGRESSION ---
    print("\n--- Training Baseline Logistic Regression Model ---")
    with mlflow.start_run(run_name="Logistic_Regression_Baseline"):
        model_lr = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)
        model_lr.fit(X_train_scaled, y_train)
        
        # Predict
        preds_probs = model_lr.predict_proba(X_test_scaled)[:, 1]
        
        # Optimize threshold on training data to maximize F1
        best_lr_th = 0.5
        best_lr_train_f1 = 0.0
        train_probs_lr = model_lr.predict_proba(X_train_scaled)[:, 1]
        for th in np.arange(0.05, 0.95, 0.01):
            th_preds = (train_probs_lr > th).astype(int)
            th_f1 = f1_score(y_train, th_preds, zero_division=0)
            if th_f1 > best_lr_train_f1:
                best_lr_train_f1 = th_f1
                best_lr_th = th
                
        # Evaluate on test data using optimized threshold
        preds = (preds_probs > best_lr_th).astype(int)
        roc_auc = roc_auc_score(y_test, preds_probs)
        precision = precision_score(y_test, preds, zero_division=0)
        recall = recall_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)
        
        print(f"LR Baseline (Opt Threshold={best_lr_th:.2f}) - ROC-AUC: {roc_auc:.4f}, F1-Score: {f1:.4f}, Precision: {precision:.4f}, Recall: {recall:.4f}")
        
        # Log to MLflow
        mlflow.log_params({
            "model_type": "LogisticRegression",
            "C": model_lr.C,
            "class_weight": "balanced",
            "opt_threshold": best_lr_th
        })
        mlflow.log_metrics({
            "val_roc_auc": roc_auc,
            "val_precision": precision,
            "val_recall": recall,
            "val_f1": f1
        })
        mlflow.sklearn.log_model(model_lr, "model")
        
    # --- PRIMARY MODEL: LIGHTGBM ---
    print("\n--- Training Primary LightGBM Model ---")
    with mlflow.start_run(run_name="LightGBM_Production_Candidate") as run:
        # Calculate scale_pos_weight for handling imbalance
        num_neg = np.sum(y_train == 0)
        num_pos = np.sum(y_train == 1)
        scale_pos_weight = num_neg / (num_pos + 1e-5)
        
        params_lgb = {
            "objective": "binary",
            "metric": "auc",
            "learning_rate": 0.03,
            "max_depth": 6,
            "num_leaves": 45,
            "scale_pos_weight": scale_pos_weight,
            "feature_fraction": 0.8,
            "verbosity": -1,
            "seed": 42
        }
        
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_test, label=y_test, reference=train_data)
        
        model_lgb = lgb.train(
            params_lgb,
            train_data,
            num_boost_round=300,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(stopping_rounds=25, verbose=False)]
        )
        
        # Predict
        preds_probs = model_lgb.predict(X_test)
        
        # Optimize threshold on training data to maximize F1
        best_lgb_th = 0.5
        best_lgb_train_f1 = 0.0
        train_probs_lgb = model_lgb.predict(X_train)
        for th in np.arange(0.05, 0.95, 0.01):
            th_preds = (train_probs_lgb > th).astype(int)
            th_f1 = f1_score(y_train, th_preds, zero_division=0)
            if th_f1 > best_lgb_train_f1:
                best_lgb_train_f1 = th_f1
                best_lgb_th = th
                
        # Evaluate on test data using optimized threshold
        preds = (preds_probs > best_lgb_th).astype(int)
        roc_auc = roc_auc_score(y_test, preds_probs)
        precision = precision_score(y_test, preds, zero_division=0)
        recall = recall_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)
        
        print(f"LightGBM Candidate (Opt Threshold={best_lgb_th:.2f}) - ROC-AUC: {roc_auc:.4f}, F1-Score: {f1:.4f}, Precision: {precision:.4f}, Recall: {recall:.4f}")
        
        # Log to MLflow
        mlflow.log_params({
            "model_type": "LightGBM",
            "learning_rate": params_lgb["learning_rate"],
            "max_depth": params_lgb["max_depth"],
            "num_leaves": params_lgb["num_leaves"],
            "scale_pos_weight": params_lgb["scale_pos_weight"],
            "opt_threshold": best_lgb_th
        })
        mlflow.log_metrics({
            "val_roc_auc": roc_auc,
            "val_precision": precision,
            "val_recall": recall,
            "val_f1": f1
        })
        
        # Log LightGBM model and register in Model Registry
        model_name = "Retail_Ops_LightGBM"
        mlflow.lightgbm.log_model(
            model_lgb, 
            "model", 
            registered_model_name=model_name
        )
        
        # Output the run ID and model URI for gate checking
        run_id = run.info.run_id
        model_uri = f"runs:/{run_id}/model"
        print(f"LightGBM Model logged. Run ID: {run_id}")
        print(f"Model URI: {model_uri}")
        
        # Save values for the gate check runner
        with open("backend/training/latest_run.txt", "w") as f:
            f.write(f"RUN_ID={run_id}\n")
            f.write(f"MODEL_URI={model_uri}\n")
            f.write(f"ROC_AUC={roc_auc}\n")
            f.write(f"MODEL_NAME={model_name}\n")
            
if __name__ == "__main__":
    run_training()
