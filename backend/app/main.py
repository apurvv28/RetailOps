from fastapi import FastAPI
import pandas as pd

import backend.app.model_loader as model_loader
from backend.app.schemas import PredictionRequest, PredictionResponse

app = FastAPI(
    title="Retail Ops Intelligence API",
    version="1.0.0",
    description="Backend service for stockout prediction"
)


@app.on_event("startup")
def startup():
    model_loader.load_production_model()

@app.get("/")
def root():
    return {
        "message": "Retail Ops Intelligence Backend is running!"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": model_loader.model_version
    }

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):

    # Convert request into DataFrame
    input_df = pd.DataFrame([request.model_dump()])

    # Predict probability
    probability = float(model_loader.model.predict(input_df)[0])

    # Convert probability into prediction
    prediction = 1 if probability >= 0.5 else 0

    return PredictionResponse(
        stockout_probability=probability,
        prediction=prediction
    )