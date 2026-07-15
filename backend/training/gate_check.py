import os
import sys
from mlflow.tracking import MlflowClient
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
LATEST_RUN_FILE = os.path.join(os.path.dirname(__file__), "latest_run.txt")

def run_gate_check():
    print("Starting Model Registry Gating Check...")
    
    # 1. Read latest run details
    if not os.path.exists(LATEST_RUN_FILE):
        print(f"Latest run info file not found at {LATEST_RUN_FILE}. Run train.py first.")
        sys.exit(1)
        
    run_details = {}
    with open(LATEST_RUN_FILE, "r") as f:
        for line in f:
            key, val = line.strip().split("=")
            run_details[key] = val
            
    candidate_run_id = run_details["RUN_ID"]
    candidate_auc = float(run_details["ROC_AUC"])
    model_name = run_details["MODEL_NAME"]
    
    print(f"Candidate Model: {model_name}")
    print(f"Candidate Run ID: {candidate_run_id}")
    print(f"Candidate ROC-AUC: {candidate_auc:.4f}")
    
    # 2. Connect to MLflow Registry
    client = MlflowClient(tracking_uri=MLFLOW_TRACKING_URI)
    
    # 3. Find current Production model
    try:
        prod_versions = client.get_latest_versions(model_name, stages=["Production"])
    except Exception as e:
        print(f"Error accessing Model Registry: {e}. If this is the first run, this is normal.")
        prod_versions = []
        
    if not prod_versions:
        print("No active model found in 'Production' stage. Automatically promoting candidate...")
        
        # Get the latest registered version of this model (which was just registered by train.py)
        latest_versions = client.get_latest_versions(model_name, stages=["None"])
        if not latest_versions:
            # Check all versions
            all_versions = client.search_model_versions(f"name='{model_name}'")
            if not all_versions:
                print(f"Error: Candidate version of model '{model_name}' not found in registry.")
                sys.exit(1)
            latest_version = all_versions[0].version
        else:
            latest_version = latest_versions[0].version
            
        print(f"Promoting model version {latest_version} to 'Production' stage...")
        client.transition_model_version_stage(
            name=model_name,
            version=latest_version,
            stage="Production",
            archive_existing_versions=True
        )
        print("Model promoted successfully!")
        sys.exit(0)
        
    # If a production version exists, check its run metrics
    prod_model = prod_versions[0]
    prod_version = prod_model.version
    prod_run_id = prod_model.run_id
    print(f"Current Production Model: Version {prod_version}, Run ID {prod_run_id}")
    
    # Retrieve ROC-AUC of the production model from its MLflow run
    try:
        prod_run = client.get_run(prod_run_id)
        prod_auc = float(prod_run.data.metrics.get("val_roc_auc", 0.0))
        print(f"Production Model ROC-AUC: {prod_auc:.4f}")
    except Exception as e:
        print(f"Failed to fetch current Production model run metrics: {e}")
        print("Assuming baseline performance of 0.0 and forcing promotion.")
        prod_auc = 0.0
        
    # Gating Check: Candidate must beat Production by at least 0.5% (0.005 in absolute terms)
    improvement = candidate_auc - prod_auc
    threshold = 0.005
    
    print(f"Comparison: Candidate ({candidate_auc:.4f}) vs Production ({prod_auc:.4f})")
    print(f"Required improvement: +{threshold:.4f}. Actual improvement: {improvement:+.4f}")
    
    if improvement >= threshold:
        print("Candidate model met the performance gate requirement!")
        # Find the latest registered version to promote
        # Since train.py just registered the model, it should be the latest version in stage "None" or "Staging"
        latest_versions = client.get_latest_versions(model_name, stages=["None"])
        if latest_versions:
            target_version = latest_versions[0].version
        else:
            all_versions = client.search_model_versions(f"name='{model_name}'")
            target_version = all_versions[0].version
            
        print(f"Promoting version {target_version} to 'Production' and archiving version {prod_version}...")
        client.transition_model_version_stage(
            name=model_name,
            version=target_version,
            stage="Production",
            archive_existing_versions=True
        )
        print("Model promotion complete. Gating check PASSED.")
        sys.exit(0)
    else:
        print("GATING FAILURE: Candidate model did not beat the current Production model by >= 0.5% ROC-AUC.")
        print("Model promotion aborted. Gating check FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    run_gate_check()
