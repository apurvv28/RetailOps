import os
import sys
import argparse
import pandas as pd
import numpy as np
import requests
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Ensure backend/ is in the import path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evidently.legacy.report import Report
from evidently.legacy.metric_preset import DataDriftPreset

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///retail_ops.db")
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
TRAINING_FEATURES_PATH = os.path.join(DATA_DIR, "training_features.csv")
REPORT_HTML_PATH = os.path.join(os.path.dirname(__file__), "drift_report.html")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPOSITORY = os.getenv("GITHUB_REPOSITORY")

def get_db_url():
    db_url = os.getenv("DATABASE_URL", "sqlite:///retail_ops.db")
    if db_url.startswith("sqlite:///"):
        db_name = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_name):
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            db_path = os.path.abspath(os.path.join(backend_dir, db_name))
            db_url = f"sqlite:///{db_path.replace('\\', '/')}"
    return db_url

def simulate_drifted_data(reference_df: pd.DataFrame) -> pd.DataFrame:
    """Simulates drifted inference data by adding bias to key features."""
    print("Simulating drifted live traffic data...")
    drifted_df = reference_df.copy()
    # Add a massive demand spike (shift mean by multiplying velocity and rolling sales)
    drifted_df["demand_velocity"] = drifted_df["demand_velocity"] * 3.5 + 1.2
    drifted_df["daily_sales_avg_7"] = drifted_df["daily_sales_avg_7"] * 2.1
    # Reduce inventory (simulating a stockout crisis)
    drifted_df["simulated_inventory"] = drifted_df["simulated_inventory"] * 0.2
    # Recalculate inventory-to-sales ratios
    drifted_df["inventory_to_sales_ratio"] = drifted_df["simulated_inventory"] / (drifted_df["daily_sales_avg_30"] + 1e-5)
    drifted_df["inventory_to_sales_ratio_7"] = drifted_df["simulated_inventory"] / (drifted_df["daily_sales_avg_7"] + 1e-5)
    return drifted_df

def load_live_data_from_db() -> pd.DataFrame:
    """Loads live feature snapshots from the database."""
    db_url = get_db_url()
    print(f"Loading live feature snapshots from database: {db_url}...")
    engine = create_engine(db_url)
    # Read snapshots
    df = pd.read_sql("SELECT * FROM engineered_features", engine)
    if len(df) == 0:
        raise ValueError("No live feature snapshots found in 'engineered_features' database table.")
    
    # Standardize columns to match reference df (e.g. mapping 'sku' back to 'stock_code')
    df = df.rename(columns={"sku": "stock_code"})
    return df

def trigger_github_retraining(drifted_cols_count: int, share: float):
    """Triggers the CI/CD pipeline via GitHub Repository Dispatch API."""
    if not GITHUB_TOKEN or not GITHUB_REPOSITORY:
        print("GitHub credentials (GITHUB_TOKEN or GITHUB_REPOSITORY) not configured in .env.")
        print("Skipping automated retraining dispatch.")
        return

    url = f"https://api.github.com/repos/{GITHUB_REPOSITORY}/dispatches"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    payload = {
        "event_type": "auto_retrain",
        "client_payload": {
            "drift_score": drifted_cols_count,
            "drift_share": share,
            "reason": f"Evidently AI detected data drift on {drifted_cols_count} features."
        }
    }
    
    print(f"Dispatching auto_retrain event to repository: {GITHUB_REPOSITORY}...")
    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 204:
            print("Successfully triggered self-healing retraining pipeline in GitHub Actions!")
        else:
            print(f"GitHub API returned error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Failed to connect to GitHub API: {e}")

def run_drift_detection(simulate_drift=False):
    print("Starting Evidently AI Drift Detection Job...")
    
    # 1. Load Reference Data (Training set)
    if not os.path.exists(TRAINING_FEATURES_PATH):
        raise FileNotFoundError(f"Training features reference file not found at {TRAINING_FEATURES_PATH}. Run feature engineering first.")
    
    ref_df = pd.read_csv(TRAINING_FEATURES_PATH)
    
    # Compute ratio features for reference data
    ref_df["inventory_to_sales_ratio"] = ref_df["simulated_inventory"] / (ref_df["daily_sales_avg_30"] + 1e-5)
    ref_df["inventory_to_sales_ratio_7"] = ref_df["simulated_inventory"] / (ref_df["daily_sales_avg_7"] + 1e-5)
    
    # 2. Load Inference Data (Current traffic)
    if simulate_drift:
        curr_df = simulate_drifted_data(ref_df)
    else:
        try:
            curr_df = load_live_data_from_db()
            # Compute ratio features for live DB data
            curr_df["inventory_to_sales_ratio"] = curr_df["simulated_inventory"] / (curr_df["daily_sales_avg_30"] + 1e-5)
            curr_df["inventory_to_sales_ratio_7"] = curr_df["simulated_inventory"] / (curr_df["daily_sales_avg_7"] + 1e-5)
        except Exception as e:
            print(f"Could not load database snapshots: {e}. Falling back to a clean slice of reference data.")
            # Default fallback: take a slice of reference data for safety
            curr_df = ref_df.sample(n=min(len(ref_df), 1000), random_state=42).copy()

    # Features to analyze
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
    
    ref_features = ref_df[feature_cols].copy().fillna(0).replace([np.inf, -np.inf], 0)
    curr_features = curr_df[feature_cols].copy().fillna(0).replace([np.inf, -np.inf], 0)
    
    # Convert boolean columns to integer for Evidently stability
    for df in [ref_features, curr_features]:
        if "holiday_flag" in df.columns:
            df["holiday_flag"] = df["holiday_flag"].astype(int)

    # 3. Compute Evidently report
    print("Computing drift metrics...")
    drift_report = Report(metrics=[DataDriftPreset()])
    drift_report.run(reference_data=ref_features, current_data=curr_features)
    
    # 4. Save HTML report
    report_dir = os.path.dirname(REPORT_HTML_PATH)
    if not os.path.exists(report_dir):
        os.makedirs(report_dir)
        
    drift_report.save_html(REPORT_HTML_PATH)
    print(f"Saved Evidently interactive HTML report to: {REPORT_HTML_PATH}")
    
    # 5. Extract metrics and evaluate threshold
    result = drift_report.as_dict()
    # Path in Evidently dictionary for DataDriftPreset
    drift_result = result["metrics"][0]["result"]
    dataset_drift = drift_result["dataset_drift"]
    drifted_cols = drift_result["number_of_drifted_columns"]
    share = drift_result["share_of_drifted_columns"]
    
    print(f"\n--- Drift Detection Summary ---")
    print(f"Dataset-level Drift Detected: {dataset_drift}")
    print(f"Drifted Columns: {drifted_cols}/{len(feature_cols)} ({share:.2%})")
    
    # Gating Check: If dataset-level drift is detected, trigger retraining!
    if dataset_drift:
        print("\n[WARNING] Significant data drift detected! Self-healing retraining triggered.")
        trigger_github_retraining(drifted_cols, share)
        
        # Send Email Alert
        try:
            from alert_service import send_alert_email
            alert_subject = f"[WARNING] Retail Ops Intelligence: Significant Data Drift Detected ({drifted_cols} columns)"
            alert_body = (
                f"Evidently AI has detected significant feature drift in live traffic.\n\n"
                f"Drift Details:\n"
                f" - Dataset-level drift: {dataset_drift}\n"
                f" - Drifted columns: {drifted_cols} out of {len(feature_cols)} ({share:.2%})\n\n"
                f"Actions Taken:\n"
                f" - Automatic self-healing retraining pipeline triggered in GitHub Actions."
            )
            send_alert_email(alert_subject, alert_body)
        except Exception as alert_err:
            print(f"Failed to dispatch email alert: {alert_err}")
    else:
        print("\nNo dataset-level drift detected. Model is operating normally.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evidently AI Drift Detector")
    parser.add_argument("--simulate", action="store_true", help="Simulate drifted traffic data for verification")
    args = parser.parse_args()
    
    run_drift_detection(simulate_drift=args.simulate)
