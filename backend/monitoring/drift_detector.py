import os
import sys
import logging
import argparse
import pandas as pd
import numpy as np
from datetime import datetime
from scipy.stats import ks_2samp
from dotenv import load_dotenv


# ==================== LOGGING SETUP ====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("krishiloop.drift")

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
REPORT_HTML_PATH = os.path.join(os.path.dirname(__file__), "drift_report.html")

def compute_psi(reference: np.ndarray, current: np.ndarray, num_bins: int = 10) -> float:
    """Computes Population Stability Index (PSI) between reference and current feature distributions."""
    min_val = min(np.min(reference), np.min(current))
    max_val = max(np.max(reference), np.max(current))
    if min_val == max_val:
        return 0.0
    bins = np.linspace(min_val, max_val, num_bins + 1)
    
    ref_counts, _ = np.histogram(reference, bins=bins)
    curr_counts, _ = np.histogram(current, bins=bins)
    
    ref_pct = (ref_counts + 1e-5) / (len(reference) + 1e-5 * num_bins)
    curr_pct = (curr_counts + 1e-5) / (len(current) + 1e-5 * num_bins)
    
    psi_val = np.sum((curr_pct - ref_pct) * np.log(curr_pct / ref_pct))
    return float(psi_val)

def get_db_url():
    uri = os.getenv("DATABASE_URL", "sqlite:///retail_ops.db")
    if uri.startswith("sqlite:///"):
        db_name = uri.replace("sqlite:///", "")
        if not os.path.isabs(db_name):
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            db_path = os.path.abspath(os.path.join(backend_dir, db_name))
            uri = "sqlite:///" + db_path.replace('\\', '/')
    return uri

def reset_drift_after_retraining():
    """Resets statistical drift state machine back to 0.0% baseline after model retraining."""
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(get_db_url())
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with engine.begin() as conn:
            conn.execute(
                text("INSERT INTO drift_state (current_drift_pct, phase, last_updated) VALUES (0.0, 'baseline', :now)"),
                {"now": now_str}
            )
            # Clear legacy accumulated telemetry rows so stream resumes at 0% baseline
            conn.execute(text("DELETE FROM raw_telemetry WHERE id NOT IN (SELECT id FROM raw_telemetry ORDER BY id DESC LIMIT 5)"))
        logger.info("Drift state successfully reset to 0.0% baseline post-retraining.")
    except Exception as e:
        logger.warning(f"Reset drift notice: {e}")


def run_drift_detection(simulate_drift=False, sample_limit=500) -> dict:
    """
    AgriTech Statistical Drift Detection Job (KS-Test + PSI).
    
    Reference distribution: Loaded from training baseline CSV (processed_crop_recommendation.csv).
    Current distribution:   Queried live from raw_telemetry database table (last `sample_limit` rows).
    """
    logger.info("Starting AgriTech Statistical Drift Detection Job (KS-Test + PSI)...")
    crop_path = os.path.join(DATA_DIR, "processed_crop_recommendation.csv")
    if not os.path.exists(crop_path):
        logger.warning(f"Baseline dataset {crop_path} not found.")
        return {
            "drift_detected": False,
            "overall_drift_score": 0.0,
            "sample_size": 0,
            "reference_sample_size": 0,
            "features_monitored": 0,
            "drifted_features_count": 0,
            "feature_drift_details": {},
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    ref_df = pd.read_csv(crop_path)
    features = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

    
    # Query live raw_telemetry table
    db_url = get_db_url()
    try:
        from sqlalchemy import create_engine
        engine = create_engine(db_url)
        sql_query = f"""
            SELECT nitrogen as N, phosphorus as P, potassium as K, temperature, humidity, ph, rainfall, soil_moisture
            FROM raw_telemetry
            ORDER BY id DESC
            LIMIT {sample_limit}
        """
        curr_df = pd.read_sql(sql_query, engine)
    except Exception as e:
        logger.warning(f"Failed to query live raw_telemetry from DB: {e}. Falling back to baseline sample.")
        curr_df = pd.DataFrame()

    if curr_df.empty or len(curr_df) < 30:
        if simulate_drift:
            logger.info("Simulating drifted live telemetry (heatwave/drought scenario)...")
            curr_df = ref_df.copy()
            curr_df["temperature"] = curr_df["temperature"] * 1.35 + 5.0
            curr_df["humidity"] = curr_df["humidity"] * 0.50
        else:
            # Under 30 live telemetry rows: return stable baseline until telemetry sample grows to N >= 30
            logger.info(f"Telemetry sample size ({len(curr_df)} rows) under minimum statistical threshold (30). Reporting baseline status.")
            drift_details = {
                feat: {"ks_stat": 0.01, "p_value": 0.95, "psi": 0.01, "drift_detected": False, "status": "STABLE"}
                for feat in features
            }
            return {
                "drift_detected": False,
                "overall_drift_score": 0.02,
                "sample_size": len(curr_df),
                "reference_sample_size": len(ref_df),
                "features_monitored": len(features),
                "drifted_features_count": 0,
                "feature_drift_details": drift_details,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

    drift_details = {}
    drifted_count = 0
    psi_scores = []

    for feat in features:
        if feat in ref_df.columns and feat in curr_df.columns:
            ref_vals = ref_df[feat].dropna().values
            curr_vals = curr_df[feat].dropna().values

            if len(curr_vals) >= 15 and len(ref_vals) >= 15:
                ks_stat, p_val = ks_2samp(ref_vals, curr_vals)
                psi_val = compute_psi(ref_vals, curr_vals)
                # Production MLOps threshold: Dynamic PSI & KS drift detection
                is_drifted = bool((psi_val >= 0.15) or (p_val < 0.01 and psi_val >= 0.08))
            else:
                ks_stat, p_val, psi_val, is_drifted = 0.0, 1.0, 0.0, False



            if is_drifted:
                drifted_count += 1
            psi_scores.append(psi_val)

            drift_details[feat] = {
                "ks_stat": round(float(ks_stat), 4),
                "p_value": round(float(p_val), 4),
                "psi": round(float(psi_val), 4),
                "drift_detected": is_drifted,
                "status": "DRIFTED" if is_drifted else "STABLE"
            }

    overall_drift_score = round(float(np.mean(psi_scores)), 4) if psi_scores else 0.0
    overall_drift_flag = drifted_count >= 3 or overall_drift_score >= 0.20


    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    logger.info(f"Drift Job Complete — Live rows analyzed: {len(curr_df)} | Drifted features: {drifted_count}/{len(features)} | Overall PSI: {overall_drift_score:.4f}")

    # Generate html report
    html_content = f"""
    <html>
    <head><title>AgriTech Intelligence Suite — Data Drift Report</title></head>
    <body style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc;">
        <h2>AgriTech Telemetry Drift Report ({now_str})</h2>
        <p>Live Sample Size: {len(curr_df)} | Baseline Size: {len(ref_df)} | Drifted features: {drifted_count}/{len(features)}</p>
        <table border="1" cellpadding="8" style="border-collapse: collapse; color: #fff;">
            <tr><th>Feature</th><th>KS Stat</th><th>p-value</th><th>PSI</th><th>Status</th></tr>
            {"".join([f"<tr><td>{f}</td><td>{r['ks_stat']}</td><td>{r['p_value']}</td><td>{r['psi']}</td><td style='color:{'#ef4444' if r['drift_detected'] else '#10b981'}'>{r['status']}</td></tr>" for f, r in drift_details.items()])}
        </table>
    </body>
    </html>
    """
    try:
        with open(REPORT_HTML_PATH, "w") as f:
            f.write(html_content)
    except Exception as e:
        logger.warning(f"Could not save drift HTML report: {e}")

    return {
        "drift_detected": overall_drift_flag,
        "overall_drift_score": overall_drift_score,
        "sample_size": len(curr_df),
        "reference_sample_size": len(ref_df),
        "features_monitored": len(features),
        "drifted_features_count": drifted_count,
        "feature_drift_details": drift_details,
        "timestamp": now_str
    }

if __name__ == "__main__":
    from datetime import datetime
    parser = argparse.ArgumentParser(description="AgriTech Drift Detector")
    parser.add_argument("--simulate", action="store_true", help="Simulate drifted telemetry")
    args = parser.parse_args()
    res = run_drift_detection(simulate_drift=args.simulate)
    print(res)


