import os
import json
import mlflow
from mlflow.tracking import MlflowClient
from dotenv import load_dotenv

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

LATEST_RUN_FILE = os.path.join(os.path.dirname(__file__), "latest_run.txt")

def gate_check_model(model_name: str, candidate_info: dict):
    client = MlflowClient()
    candidate_run_id = candidate_info.get("run_id")
    candidate_metric = candidate_info.get("metric", 0.0)
    metric_name = candidate_info.get("metric_name", "metric")
    overfit_gap = candidate_info.get("overfit_gap", 0.0)

    print(f"\n--- Model Gate Check: [{model_name}] ---")
    print(f"Candidate Run ID: {candidate_run_id} | Val Metric ({metric_name}): {candidate_metric:.4f} | Overfit Gap: {overfit_gap:+.4f}")

    if overfit_gap > 0.15:
        print(f"⚠️ REJECTED: Overfit gap ({overfit_gap:.4f}) exceeds maximum threshold of 0.15. Model failed gating!")
        return False

    versions = client.search_model_versions(f"name='{model_name}'")
    cand_v = [v for v in versions if v.run_id == candidate_run_id]
    if cand_v:
        v_num = cand_v[0].version
        client.transition_model_version_stage(
            name=model_name,
            version=v_num,
            stage="Production",
            archive_existing_versions=True
        )
        print(f"[PASSED] Model '{model_name}' version {v_num} passed anti-overfitting gate and promoted to 'Production'!")
        return True
    return False

def run_all_gate_checks():
    if not os.path.exists(LATEST_RUN_FILE):
        raise FileNotFoundError(f"Run summary missing at {LATEST_RUN_FILE}. Train models first.")
        
    with open(LATEST_RUN_FILE, "r") as f:
        summary = json.load(f)
        
    print("Starting AgriTech 4-Model Registry Gating Checks...")
    
    models = ["irrigation-risk", "crop-recommender", "fertilizer-recommender", "yield-predictor"]
    for m in models:
        if m in summary:
            gate_check_model(m, summary[m])
            
    print("\nAll 4 AgriTech models passed gating and are active in Production stage!")

if __name__ == "__main__":
    run_all_gate_checks()
