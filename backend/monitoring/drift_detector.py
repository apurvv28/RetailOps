import os
import sys
import argparse
import pandas as pd
import numpy as np
from scipy.stats import ks_2samp
from dotenv import load_dotenv

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

def run_drift_detection(simulate_drift=False):
    print("Starting AgriTech Statistical Drift Detection Job (KS-Test + PSI)...")
    crop_path = os.path.join(DATA_DIR, "processed_crop_recommendation.csv")
    if not os.path.exists(crop_path):
        print(f"Dataset {crop_path} not found. Skipping drift run.")
        return

    ref_df = pd.read_csv(crop_path)
    if simulate_drift:
        print("Simulating drifted live telemetry (heatwave/drought scenario)...")
        curr_df = ref_df.copy()
        curr_df["temperature"] = curr_df["temperature"] * 1.35 + 5.0
        curr_df["humidity"] = curr_df["humidity"] * 0.50
    else:
        curr_df = ref_df.sample(n=min(len(ref_df), 300), random_state=42).copy()

    features = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall", "N_P_ratio"]
    drift_results = {}
    drifted_count = 0

    for feat in features:
        if feat in ref_df.columns and feat in curr_df.columns:
            ref_vals = ref_df[feat].dropna().values
            curr_vals = curr_df[feat].dropna().values
            
            ks_stat, p_val = ks_2samp(ref_vals, curr_vals)
            psi_val = compute_psi(ref_vals, curr_vals)
            
            is_drifted = (p_val < 0.05) or (psi_val > 0.25)
            if is_drifted:
                drifted_count += 1
                
            drift_results[feat] = {
                "ks_stat": round(float(ks_stat), 4),
                "p_value": round(float(p_val), 4),
                "psi": round(psi_val, 4),
                "drift_detected": is_drifted
            }

    print("\n--- AgriTech Drift Analysis Summary ---")
    for feat, res in drift_results.items():
        status_str = "DRIFTED" if res["drift_detected"] else "STABLE"
        print(f" - {feat:15s}: [{status_str:7s}] KS-p={res['p_value']:.4f}, PSI={res['psi']:.4f}")

    # Generate html report
    html_content = f"""
    <html>
    <head><title>AgriTech Intelligence Suite — Data Drift Report</title></head>
    <body style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc;">
        <h2>AgriTech Telemetry Drift Report</h2>
        <p>Total features monitored: {len(features)} | Drifted features: {drifted_count}</p>
        <table border="1" cellpadding="8" style="border-collapse: collapse; color: #fff;">
            <tr><th>Feature</th><th>KS Stat</th><th>p-value</th><th>PSI</th><th>Status</th></tr>
            {"".join([f"<tr><td>{f}</td><td>{r['ks_stat']}</td><td>{r['p_value']}</td><td>{r['psi']}</td><td style='color:{'#ef4444' if r['drift_detected'] else '#10b981'}'>{'DRIFT' if r['drift_detected'] else 'STABLE'}</td></tr>" for f, r in drift_results.items()])}
        </table>
    </body>
    </html>
    """
    with open(REPORT_HTML_PATH, "w") as f:
        f.write(html_content)
    print(f"\nSaved AgriTech drift report HTML to {REPORT_HTML_PATH}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AgriTech Drift Detector")
    parser.add_argument("--simulate", action="store_true", help="Simulate drifted telemetry")
    args = parser.parse_args()
    run_drift_detection(simulate_drift=args.simulate)

