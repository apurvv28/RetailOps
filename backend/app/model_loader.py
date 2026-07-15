

import os
import mlflow
import mlflow.pyfunc
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
model_version = None

def load_production_model():
    """
    Load the current Production model from MLflow Registry.
    """

    global model
    global model_version

    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)

    model_uri = f"models:/{MODEL_NAME}/Production"

    print(f"Loading model from {model_uri}")

    model = mlflow.pyfunc.load_model(model_uri)

    model_version = "Production"

    print("Production model loaded successfully.")

    return model