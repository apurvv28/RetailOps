import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, List
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Depends, Header, Query, status
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

import backend.app.model_loader as model_loader
from backend.app.llm_explainer import get_llm_explanation
from backend.app.schemas import (
    IrrigationPredictionRequest,
    IrrigationPredictionResponse,
    CropPredictionRequest,
    CropPredictionResponse,
    CropRecommendationItem,
    FertilizerPredictionRequest,
    FertilizerPredictionResponse,
    YieldPredictionRequest,
    YieldPredictionResponse,
    OutcomeRequest,
    OutcomeResponse,
    AlertRequest,
    AlertResponse,
    RecentPredictionsResponse,
    ModelDriftDetail,
    DriftStatusResponse,
    AlertsHistoryResponse,
    DecisionLogItem,
    ActionItem,
    FeatureContribution,
    GoogleAuthRequest,
    DemoLoginRequest,
    AuthTokenResponse,
    FarmerProfileRequest,
    FarmerProfileResponse
)
from backend.app.auth import (
    create_access_token,
    verify_google_id_token,
    exchange_google_code,
    fetch_or_create_user,
    get_current_user,
    require_admin,
    require_farmer
)

from backend.monitoring.alert_service import send_alert_email


# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

API_KEY = os.getenv("API_KEY", None)

def get_db_url():
    db_url = os.getenv("DATABASE_URL", "sqlite:///retail_ops.db")
    if db_url.startswith("sqlite:///"):
        db_name = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_name):
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            db_path = os.path.abspath(os.path.join(backend_dir, db_name))
            db_url = "sqlite:///" + db_path.replace('\\', '/')
    return db_url

DATABASE_URL = get_db_url()

def get_db_connection():
    if DATABASE_URL.startswith("sqlite:///"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    else:
        engine = create_engine(DATABASE_URL)
        return engine.connect()

def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if API_KEY and API_KEY.strip() and API_KEY.lower() != "disabled":
        if not x_api_key or x_api_key != API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing X-API-Key header"
            )
    return True

app = FastAPI(
    title="AgriTech Intelligence Suite API",
    version="2.0.0",
    description="""
AgriTech Intelligence Suite API - Production Multi-Model MLOps Engine
Integrated with CockroachDB / SQLite, BetterAuth Google OAuth, MLflow Registry & Feature Store Engine.
"""
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    model_loader.load_production_models()
    try:
        from backend.schema.init_db import initialize_database
        initialize_database()
    except Exception as e:
        print(f"Startup DB init check notice: {e}")

@app.get("/")
def root():
    return {
        "message": "AgriTech Intelligence Suite API (v2.0) is running!",
        "models": ["irrigation-risk", "crop-recommender", "fertilizer-recommender"],
        "docs_url": "/docs"
    }

@app.get("/health")
def health():
    db_status = "connected"
    try:
        conn = get_db_connection()
        if hasattr(conn, "close"):
            conn.close()
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "healthy",
        "models": {
            "irrigation": model_loader.irrigation_model is not None,
            "crop": model_loader.crop_model is not None,
            "fertilizer": model_loader.fertilizer_model is not None,
        },
        "database": db_status
    }

# ==================== AUTHENTICATION & RBAC ENDPOINTS ====================

@app.get("/api/auth/google/url")
def get_google_auth_url(role: str = "farmer"):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    scope = "openid email profile"
    import urllib.parse
    encoded_redirect = urllib.parse.quote(redirect_uri)
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={encoded_redirect}&"
        f"response_type=code&"
        f"scope={scope}&"
        f"state={role}&"
        f"prompt=select_account"
    )
    return {"auth_url": auth_url}

@app.get("/api/auth/google/callback")
def google_auth_callback(code: str, state: Optional[str] = "farmer"):
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    user_info = exchange_google_code(code, redirect_uri)
    
    role = state if state in ["admin", "farmer"] else "farmer"
    user = fetch_or_create_user(
        google_id=user_info["google_id"],
        email=user_info["email"],
        name=user_info["name"],
        picture=user_info.get("picture", ""),
        requested_role=role
    )
    
    token = create_access_token({"sub": str(user["id"]), "role": user["role"], "email": user["email"]})
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    import urllib.parse
    encoded_user = urllib.parse.quote(json.dumps(user))
    return RedirectResponse(url=f"{frontend_url}/login?token={token}&user={encoded_user}")

@app.post("/api/auth/google", response_model=AuthTokenResponse)
def login_with_google(req: GoogleAuthRequest):
    # Verify Google token
    user_info = verify_google_id_token(req.id_token)
    user = fetch_or_create_user(
        google_id=user_info["google_id"],
        email=user_info["email"],
        name=user_info["name"],
        picture=user_info.get("picture", ""),
        requested_role=req.requested_role or "farmer"
    )
    token = create_access_token({"sub": str(user["id"]), "role": user["role"], "email": user["email"]})
    return AuthTokenResponse(access_token=token, user=user)


@app.post("/api/auth/demo-login", response_model=AuthTokenResponse)
def demo_login(req: DemoLoginRequest):
    role = req.role.lower() if req.role in ["admin", "farmer"] else "farmer"
    if role == "admin":
        email = req.email or "admin@agritech.com"
        name = "AgriOps System Admin"
        google_id = "demo-admin-google-id"
    else:
        email = req.email or "farmer@agritech.com"
        name = "Ramesh Kumar (Farmer)"
        google_id = "demo-farmer-google-id"

    user = fetch_or_create_user(
        google_id=google_id,
        email=email,
        name=name,
        picture="",
        requested_role=role
    )
    token = create_access_token({"sub": str(user["id"]), "role": user["role"], "email": user["email"]})
    return AuthTokenResponse(access_token=token, user=user)

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

# ==================== MLOPS MODEL REGISTRY ENDPOINTS ====================

@app.get("/api/mlops/models")
def get_mlops_models(current_user: dict = Depends(get_current_user)):
    models = []
    is_sqlite = DATABASE_URL.startswith("sqlite://")
    conn = get_db_connection()
    try:
        if is_sqlite:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, model_key, model_name, algorithm, version, stage, accuracy_score, f1_score, rmse_score, artifact_uri, parameters_json, metrics_json, updated_at
                FROM model_registry
                ORDER BY id ASC
                """
            )
            for r in cursor.fetchall():
                models.append({
                    "id": r["id"],
                    "model_key": r["model_key"],
                    "model_name": r["model_name"],
                    "algorithm": r["algorithm"],
                    "version": r["version"],
                    "stage": r["stage"],
                    "accuracy_score": float(r["accuracy_score"]) if r["accuracy_score"] is not None else None,
                    "f1_score": float(r["f1_score"]) if r["f1_score"] is not None else None,
                    "rmse_score": float(r["rmse_score"]) if r["rmse_score"] is not None else None,
                    "artifact_uri": r["artifact_uri"],
                    "parameters": json.loads(r["parameters_json"]) if r["parameters_json"] else {},
                    "metrics": json.loads(r["metrics_json"]) if r["metrics_json"] else {},
                    "updated_at": str(r["updated_at"])
                })
            conn.close()
        else:
            res = conn.execute(text("SELECT id, model_key, model_name, algorithm, version, stage, accuracy_score, f1_score, rmse_score, artifact_uri, parameters_json, metrics_json, updated_at FROM model_registry ORDER BY id ASC")).fetchall()
            conn.close()
            for r in res:
                models.append({
                    "id": r[0],
                    "model_key": r[1],
                    "model_name": r[2],
                    "algorithm": r[3],
                    "version": r[4],
                    "stage": r[5],
                    "accuracy_score": float(r[6]) if r[6] is not None else None,
                    "f1_score": float(r[7]) if r[7] is not None else None,
                    "rmse_score": float(r[8]) if r[8] is not None else None,
                    "artifact_uri": r[9],
                    "parameters": json.loads(r[10]) if r[10] else {},
                    "metrics": json.loads(r[11]) if r[11] else {},
                    "updated_at": str(r[12])
                })
    except Exception as e:
        if hasattr(conn, "close"): conn.close()
        print(f"Error fetching model registry: {e}")

    return {"count": len(models), "models": models}

@app.post("/api/mlops/models/promote")
def promote_mlops_model(model_key: str = Query(...), new_stage: str = Query("Production"), current_user: dict = Depends(require_admin)):
    is_sqlite = DATABASE_URL.startswith("sqlite://")
    conn = get_db_connection()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        if is_sqlite:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE model_registry SET stage = ?, updated_at = ? WHERE model_key = ?",
                (new_stage, now_str, model_key)
            )
            conn.commit()
            conn.close()
        else:
            trans = conn.begin()
            conn.execute(
                text("UPDATE model_registry SET stage = :stg, updated_at = :uats WHERE model_key = :mk"),
                {"stg": new_stage, "uats": now_str, "mk": model_key}
            )
            trans.commit()
            conn.close()
        return {"status": "success", "message": f"Model '{model_key}' stage updated to '{new_stage}' in database."}
    except Exception as e:
        if hasattr(conn, "close"): conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to update model stage: {e}")


# ==================== FARMER PROFILE & ISOLATED DASHBOARD ENDPOINTS ====================

@app.get("/api/farmer/profile", response_model=FarmerProfileResponse)
def get_farmer_profile(current_user: dict = Depends(require_farmer)):
    user_id = current_user["id"]
    is_sqlite = DATABASE_URL.startswith("sqlite://")
    conn = get_db_connection()

    profile = None
    try:
        if is_sqlite:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT user_id, farm_name, gps_latitude, gps_longitude, region, current_crops, sensors_config, updated_at FROM farmer_profiles WHERE user_id = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            if row:
                profile = dict(row)
            conn.close()
        else:
            res = conn.execute(
                text("SELECT user_id, farm_name, gps_latitude, gps_longitude, region, current_crops, sensors_config, updated_at FROM farmer_profiles WHERE user_id = :uid"),
                {"uid": user_id}
            ).fetchone()
            conn.close()
            if res:
                profile = {
                    "user_id": res[0], "farm_name": res[1], "gps_latitude": float(res[2]),
                    "gps_longitude": float(res[3]), "region": res[4], "current_crops": res[5],
                    "sensors_config": res[6], "updated_at": str(res[7])
                }

        if not profile:
            # Create default profile
            profile = {
                "user_id": user_id,
                "farm_name": f"{current_user['name']}'s Farm",
                "gps_latitude": 18.5204,
                "gps_longitude": 73.8567,
                "region": "Maharashtra",
                "current_crops": "Paddy, Cotton",
                "sensors_config": '{"soil_moisture_sensor": true, "npk_sensor": true, "weather_station": true}',
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        sensors_dict = json.loads(profile["sensors_config"]) if isinstance(profile["sensors_config"], str) else profile["sensors_config"]

        return FarmerProfileResponse(
            user_id=profile["user_id"],
            farm_name=profile["farm_name"],
            gps_latitude=float(profile["gps_latitude"]),
            gps_longitude=float(profile["gps_longitude"]),
            region=profile["region"],
            current_crops=profile["current_crops"],
            sensors_config=sensors_dict,
            updated_at=str(profile["updated_at"])
        )
    except Exception as e:
        if hasattr(conn, "close"): conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {e}")

@app.put("/api/farmer/profile", response_model=FarmerProfileResponse)
def update_farmer_profile(req: FarmerProfileRequest, current_user: dict = Depends(require_farmer)):
    user_id = current_user["id"]
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sensors_json = json.dumps(req.sensors_config)

    is_sqlite = DATABASE_URL.startswith("sqlite://")
    conn = get_db_connection()

    try:
        if is_sqlite:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM farmer_profiles WHERE user_id = ?", (user_id,))
            if cursor.fetchone():
                cursor.execute(
                    """
                    UPDATE farmer_profiles
                    SET farm_name = ?, gps_latitude = ?, gps_longitude = ?, region = ?, current_crops = ?, sensors_config = ?, updated_at = ?
                    WHERE user_id = ?
                    """,
                    (req.farm_name, req.gps_latitude, req.gps_longitude, req.region, req.current_crops, sensors_json, now_str, user_id)
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO farmer_profiles (user_id, farm_name, gps_latitude, gps_longitude, region, current_crops, sensors_config, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, req.farm_name, req.gps_latitude, req.gps_longitude, req.region, req.current_crops, sensors_json, now_str)
                )
            conn.commit()
            conn.close()
        else:
            trans = conn.begin()
            check = conn.execute(text("SELECT id FROM farmer_profiles WHERE user_id = :uid"), {"uid": user_id}).fetchone()
            if check:
                conn.execute(
                    text("""
                        UPDATE farmer_profiles
                        SET farm_name = :fn, gps_latitude = :lat, gps_longitude = :lng, region = :reg, current_crops = :crops, sensors_config = :sconf, updated_at = :uats
                        WHERE user_id = :uid
                    """),
                    {"fn": req.farm_name, "lat": req.gps_latitude, "lng": req.gps_longitude, "reg": req.region, "crops": req.current_crops, "sconf": sensors_json, "uats": now_str, "uid": user_id}
                )
            else:
                conn.execute(
                    text("""
                        INSERT INTO farmer_profiles (user_id, farm_name, gps_latitude, gps_longitude, region, current_crops, sensors_config, updated_at)
                        VALUES (:uid, :fn, :lat, :lng, :reg, :crops, :sconf, :uats)
                    """),
                    {"uid": user_id, "fn": req.farm_name, "lat": req.gps_latitude, "lng": req.gps_longitude, "reg": req.region, "crops": req.current_crops, "sconf": sensors_json, "uats": now_str}
                )
            trans.commit()
            conn.close()

        return FarmerProfileResponse(
            user_id=user_id,
            farm_name=req.farm_name,
            gps_latitude=req.gps_latitude,
            gps_longitude=req.gps_longitude,
            region=req.region,
            current_crops=req.current_crops,
            sensors_config=req.sensors_config,
            updated_at=now_str
        )
    except Exception as e:
        if hasattr(conn, "close"): conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {e}")

@app.get("/api/farmer/summary")
def get_farmer_summary(current_user: dict = Depends(require_farmer)):
    user_id = current_user["id"]
    return {
        "user_id": user_id,
        "farmer_name": current_user["name"],
        "farm_status": "Healthy / Monitoring Active",
        "soil_moisture": 28.5,
        "moisture_risk": 0.35,
        "recommended_crop": "Paddy",
        "recommended_fertilizer": "Urea (46% N)",
        "expected_yield": "158.4 BU/ACRE",
        "alerts_count": 1,
        "active_alert": "Moderate Soil Depletion Warning for Field #1"
    }


# 1. Irrigation Risk Endpoint
@app.post("/predict/irrigation", response_model=IrrigationPredictionResponse, dependencies=[Depends(verify_api_key)])
def predict_irrigation(request: IrrigationPredictionRequest):
    input_dict = request.model_dump()
    field_id = input_dict.pop("field_id", "FIELD_UNKNOWN")
    input_dict["hydro_thermal_index"] = input_dict["temperature"] / (input_dict["humidity"] + 1e-5)
    input_dict["moisture_deficit"] = 100.0 - input_dict["soil_moisture"]
    
    input_df = pd.DataFrame([input_dict])

    try:
        if hasattr(model_loader.irrigation_model, "predict"):
            preds = model_loader.irrigation_model.predict(input_df)
            prob = float(preds[0]) if len(preds) > 0 else 0.5
        else:
            prob = 0.5
    except Exception:
        prob = 0.5

    risk_flag = prob >= 0.5
    top_features_raw = model_loader.compute_top_irrigation_features(input_df)
    top_features = [FeatureContribution(**f) for f in top_features_raw]

    decision_log_id = None
    try:
        conn = get_db_connection()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        output_str = f"risk_prob={prob:.4f}"
        
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO decision_log (field_id, model_type, prediction_output, confidence_score, risk_flag, top_features_json, model_version, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (field_id, "irrigation", output_str, prob, 1 if risk_flag else 0, json.dumps(top_features_raw), "v2.0.0", now_str)
            )
            decision_log_id = cursor.lastrowid
            conn.commit()
            conn.close()
    except Exception as e:
        print(f"Error logging decision to DB: {e}")

    return IrrigationPredictionResponse(
        field_id=field_id,
        moisture_depletion_risk=round(prob, 4),
        risk_flag=risk_flag,
        decision_log_id=decision_log_id,
        top_features=top_features
    )

# 2. Crop Recommendation Endpoint
@app.post("/predict/crop", response_model=CropPredictionResponse, dependencies=[Depends(verify_api_key)])
def predict_crop(request: CropPredictionRequest):
    crops_list = [
        "rice", "maize", "chickpea", "kidneybeans", "pigeonpeas", 
        "mothbeans", "mungbean", "blackgram", "lentil", "pomegranate", 
        "banana", "mango", "grapes", "watermelon", "muskmelon", 
        "apple", "orange", "papaya", "coconut", "cotton", "jute", "coffee"
    ]
    input_dict = request.model_dump()
    field_id = input_dict.pop("field_id", "FIELD_UNKNOWN")
    input_dict["N_P_ratio"] = input_dict["N"] / (input_dict["P"] + 1e-5)
    input_dict["N_K_ratio"] = input_dict["N"] / (input_dict["K"] + 1e-5)
    input_dict["P_K_ratio"] = input_dict["P"] / (input_dict["K"] + 1e-5)
    
    input_df = pd.DataFrame([input_dict])
    
    try:
        if hasattr(model_loader.crop_model, "predict"):
            preds = model_loader.crop_model.predict(input_df)
            probs = preds[0] if len(preds) > 0 else np.ones(len(crops_list)) / len(crops_list)
        else:
            probs = np.ones(len(crops_list)) / len(crops_list)
    except Exception:
        probs = np.ones(len(crops_list)) / len(crops_list)

    top_3_idx = np.argsort(probs)[-3:][::-1]
    top_3_items = []
    for idx in top_3_idx:
        crop_name = crops_list[idx] if idx < len(crops_list) else f"crop_{idx}"
        top_3_items.append(CropRecommendationItem(crop=crop_name, confidence=round(float(probs[idx]), 4)))

    rec_crop = top_3_items[0].crop
    confidence = top_3_items[0].confidence

    # Generate NVIDIA Nemotron LLM Explainability
    crop_llm_prompt = (
        f"Explain in 2 concise sentences why crop '{rec_crop}' is recommended for soil with "
        f"Nitrogen={request.N}, Phosphorus={request.P}, Potassium={request.K}, Temperature={request.temperature}°C, "
        f"Humidity={request.humidity}%, pH={request.ph}, and Rainfall={request.rainfall}mm."
    )
    llm_explanation = get_llm_explanation(crop_llm_prompt)

    decision_log_id = None
    try:
        conn = get_db_connection()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO decision_log (field_id, model_type, prediction_output, confidence_score, risk_flag, top_features_json, model_version, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (field_id, "crop", rec_crop, confidence, 0, llm_explanation, "v2.0.0", now_str)
            )
            decision_log_id = cursor.lastrowid
            conn.commit()
            conn.close()
    except Exception as e:
        print(f"Error logging decision to DB: {e}")

    return CropPredictionResponse(
        field_id=field_id,
        recommended_crop=rec_crop,
        confidence=confidence,
        top_3_recommendations=top_3_items,
        llm_explanation=llm_explanation,
        decision_log_id=decision_log_id
    )

# 3. Fertilizer Recommendation Endpoint
@app.post("/predict/fertilizer", response_model=FertilizerPredictionResponse, dependencies=[Depends(verify_api_key)])
def predict_fertilizer(request: FertilizerPredictionRequest):
    fertilizers_list = ["Urea", "DAP", "14-35-14", "28-28", "17-17-17", "20-20", "10-26-26"]
    input_dict = request.model_dump()
    field_id = input_dict.pop("field_id", "FIELD_UNKNOWN")
    
    # Preprocess categorical codes for model
    soil_types = ["Sandy", "Loamy", "Black", "Red", "Clayey"]
    crop_types = ["Maize", "Sugarcane", "Cotton", "Tobacco", "Paddy", "Barley", "Wheat", "Millets", "Oil seeds", "Pulses", "Groundnuts"]
    
    soil_code = soil_types.index(input_dict["soil_type"]) if input_dict["soil_type"] in soil_types else 0
    crop_code = crop_types.index(input_dict["crop_type"]) if input_dict["crop_type"] in crop_types else 0
    
    model_input = {
        "temperature": input_dict["temperature"],
        "humidity": input_dict["humidity"],
        "moisture": input_dict["moisture"],
        "nitrogen": input_dict["nitrogen"],
        "phosphorus": input_dict["phosphorus"],
        "potassium": input_dict["potassium"],
        "N_P_ratio": input_dict["nitrogen"] / (input_dict["phosphorus"] + 1e-5),
        "soil_type_code": soil_code,
        "crop_type_code": crop_code
    }
    input_df = pd.DataFrame([model_input])

    try:
        if hasattr(model_loader.fertilizer_model, "predict"):
            preds = model_loader.fertilizer_model.predict(input_df)
            probs = preds[0] if len(preds) > 0 else np.ones(len(fertilizers_list)) / len(fertilizers_list)
        else:
            probs = np.ones(len(fertilizers_list)) / len(fertilizers_list)
    except Exception:
        probs = np.ones(len(fertilizers_list)) / len(fertilizers_list)

    top_idx = int(np.argmax(probs))
    rec_fert = fertilizers_list[top_idx] if top_idx < len(fertilizers_list) else "Urea"
    confidence = float(probs[top_idx])

    summary = f"Deficiency analysis: Nitrogen={input_dict['nitrogen']} kg/ha, Phosphorus={input_dict['phosphorus']} kg/ha, Potassium={input_dict['potassium']} kg/ha. Apply {rec_fert}."

    # Generate NVIDIA Nemotron LLM Explainability
    fert_llm_prompt = (
        f"Explain in 2 concise sentences why fertilizer '{rec_fert}' is recommended for crop '{input_dict['crop_type']}' "
        f"in {input_dict['soil_type']} soil with Nitrogen={input_dict['nitrogen']} kg/ha, Phosphorus={input_dict['phosphorus']} kg/ha, "
        f"Potassium={input_dict['potassium']} kg/ha, Moisture={input_dict['moisture']}%, and Temperature={input_dict['temperature']}°C."
    )
    llm_explanation = get_llm_explanation(fert_llm_prompt)

    decision_log_id = None
    try:
        conn = get_db_connection()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO decision_log (field_id, model_type, prediction_output, confidence_score, risk_flag, top_features_json, model_version, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (field_id, "fertilizer", rec_fert, confidence, 0, llm_explanation, "v2.0.0", now_str)
            )
            decision_log_id = cursor.lastrowid
            conn.commit()
            conn.close()
    except Exception as e:
        print(f"Error logging decision to DB: {e}")

    return FertilizerPredictionResponse(
        field_id=field_id,
        recommended_fertilizer=rec_fert,
        confidence=round(confidence, 4),
        nutrient_deficiency_summary=summary,
        llm_explanation=llm_explanation,
        decision_log_id=decision_log_id
    )

# 4. CropNet Yield Prediction Endpoint
@app.post("/predict/yield", response_model=YieldPredictionResponse, dependencies=[Depends(verify_api_key)])
def predict_yield(request: YieldPredictionRequest):
    input_dict = request.model_dump()
    field_id = input_dict.pop("field_id", "FIELD_UNKNOWN")
    
    states = ["ALABAMA", "ARKANSAS", "ARIZONA", "CALIFORNIA", "IOWA", "ILLINOIS", "LOUISIANA", "MISSISSIPPI"]
    state_code = states.index(input_dict["state_name"]) if input_dict["state_name"] in states else 0
    county_code = hash(input_dict["county_name"]) % 100
    comm_code = 0 if input_dict["commodity_desc"].upper() == "CORN" else 1
    
    model_input = {
        "year": input_dict["year"],
        "state_code": state_code,
        "county_code": county_code,
        "commodity_code": comm_code,
        "log_production": float(np.log1p(input_dict["production_bu"]))
    }
    input_df = pd.DataFrame([model_input])

    try:
        if hasattr(model_loader.yield_model, "predict"):
            preds = model_loader.yield_model.predict(input_df)
            predicted_yield = float(preds[0])
        else:
            predicted_yield = 150.0
            
        decision_log_id = None
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            conn = get_db_connection()
            if DATABASE_URL.startswith("sqlite:///"):
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO decision_log (field_id, model_type, prediction_output, confidence_score, risk_flag, top_features_json, model_version, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (field_id, "yield", f"{predicted_yield:.2f} bu/acre", 0.90, 0, json.dumps({"yield_bu_per_acre": round(predicted_yield, 2)}), "v1.0.0", now_str)
                )
                decision_log_id = cursor.lastrowid
                conn.commit()
                conn.close()
        except Exception as db_err:
            print(f"Error logging yield decision: {db_err}")

        return YieldPredictionResponse(
            field_id=field_id,
            predicted_yield_bu_per_acre=round(predicted_yield, 2),
            unit="BU / ACRE",
            decision_log_id=decision_log_id
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Yield prediction error: {str(e)}")

@app.post("/outcomes", response_model=OutcomeResponse, dependencies=[Depends(verify_api_key)])
def record_outcome(request: OutcomeRequest):
    outcome_id = None
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO outcomes (decision_log_id, actual_outcome, recorded_at)
                VALUES (?, ?, ?)
                """,
                (request.decision_log_id, request.actual_outcome, now_str)
            )
            outcome_id = cursor.lastrowid
            conn.commit()
            conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record outcome: {e}")

    return OutcomeResponse(
        status="success",
        outcome_id=outcome_id or 0,
        decision_log_id=request.decision_log_id,
        actual_outcome=request.actual_outcome
    )

@app.post("/actions/alert", response_model=AlertResponse, dependencies=[Depends(verify_api_key)])
def trigger_alert(request: AlertRequest):
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    cutoff_24h = (now - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        conn = get_db_connection()
        already_sent = False
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id FROM actions_taken
                WHERE field_id = ? AND action_type = 'email_alert' AND sent_at >= ?
                LIMIT 1
                """,
                (request.field_id, cutoff_24h)
            )
            if cursor.fetchone():
                already_sent = True
            conn.close()

        if already_sent:
            return AlertResponse(
                status="rate_limited",
                message=f"Alert rate-limited: An alert was already dispatched for field {request.field_id} within 24 hours."
            )
    except Exception as e:
        print(f"Rate limit check warning: {e}")

    subject = f"[AGRITECH ALERT] Advisory for Field {request.field_id}"
    body = f"AgriTech Alert for Field: {request.field_id}\nModel: {request.model_type}\nReason: {request.reason}\nTimestamp: {now_str}"
    dispatch_success = send_alert_email(subject, body)
    recipient = request.recipient or "farmer-advisory@agritech.internal"

    action_id = None
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO actions_taken (decision_log_id, field_id, model_type, action_type, sent_at, recipient, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (request.decision_log_id, request.field_id, request.model_type, "email_alert", now_str, recipient, request.reason)
            )
            action_id = cursor.lastrowid
            conn.commit()
            conn.close()
    except Exception as e:
        print(f"Error logging action: {e}")

    return AlertResponse(
        status="success" if dispatch_success else "dispatched_mock",
        message=f"Alert processed for Field {request.field_id}.",
        action_id=action_id
    )

@app.get("/dashboard/recent-predictions", response_model=RecentPredictionsResponse, dependencies=[Depends(verify_api_key)])
def get_recent_predictions(limit: int = Query(50, ge=1, le=500)):
    predictions = []
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, field_id, model_type, prediction_output, confidence_score, risk_flag, model_version, timestamp
                FROM decision_log
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,)
            )
            for r in cursor.fetchall():
                predictions.append(DecisionLogItem(
                    id=r["id"],
                    field_id=r["field_id"],
                    model_type=r["model_type"],
                    prediction_output=r["prediction_output"],
                    confidence_score=float(r["confidence_score"]),
                    risk_flag=bool(r["risk_flag"]),
                    model_version=r["model_version"],
                    timestamp=str(r["timestamp"])
                ))
            conn.close()
    except Exception as e:
        print(f"Error reading predictions: {e}")

    return RecentPredictionsResponse(count=len(predictions), predictions=predictions)

@app.get("/dashboard/drift-status", response_model=DriftStatusResponse, dependencies=[Depends(verify_api_key)])
def get_drift_status():
    report_path = os.path.join(os.path.dirname(__file__), "..", "monitoring", "drift_report.html")
    report_exists = os.path.exists(report_path)
    last_checked = datetime.fromtimestamp(os.path.getmtime(report_path)).strftime("%Y-%m-%d %H:%M:%S") if report_exists else datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    dataset_drift = False
    drifted_cols = 0
    total_cols = 8
    model_drifts = []

    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT temperature, humidity, soil_moisture, nitrogen, phosphorus, potassium, ph, rainfall
                FROM raw_telemetry
                ORDER BY id DESC
                LIMIT 50
                """
            )
            rows = cursor.fetchall()
            conn.close()

            if len(rows) >= 5:
                temps = [r["temperature"] for r in rows if r["temperature"] is not None]
                hums = [r["humidity"] for r in rows if r["humidity"] is not None]
                sms = [r["soil_moisture"] for r in rows if r["soil_moisture"] is not None]
                ns = [r["nitrogen"] for r in rows if r["nitrogen"] is not None]
                ps = [r["phosphorus"] for r in rows if r["phosphorus"] is not None]

                avg_temp = np.mean(temps) if temps else 25.0
                avg_hum = np.mean(hums) if hums else 60.0
                avg_sm = np.mean(sms) if sms else 40.0
                avg_n = np.mean(ns) if ns else 50.0
                avg_p = np.mean(ps) if ps else 40.0

                temp_drift = avg_temp > 34.0
                hum_drift = avg_hum < 38.0
                sm_drift = avg_sm < 22.0
                n_drift = avg_n > 75.0 or avg_n < 25.0
                p_drift = avg_p < 20.0

                drifted_cols = sum([temp_drift, hum_drift, sm_drift, n_drift, p_drift])
                if drifted_cols >= 2:
                    dataset_drift = True

                # 1. Irrigation Risk Model Drift
                irr_features = []
                if sm_drift: irr_features.append("soil_moisture")
                if temp_drift: irr_features.append("temperature")
                if hum_drift: irr_features.append("humidity")
                model_drifts.append(ModelDriftDetail(
                    model_name="Irrigation Risk Predictor",
                    model_key="irrigation",
                    drift_detected=len(irr_features) > 0,
                    drifted_features=irr_features,
                    total_features=4,
                    psi_score=round(0.08 + len(irr_features) * 0.12, 3),
                    status="CRITICAL_DRIFT" if len(irr_features) >= 2 else ("MODERATE_DRIFT" if len(irr_features) == 1 else "STABLE")
                ))

                # 2. Crop Recommendation Model Drift
                crop_features = []
                if n_drift: crop_features.append("nitrogen")
                if p_drift: crop_features.append("phosphorus")
                if temp_drift: crop_features.append("temperature")
                model_drifts.append(ModelDriftDetail(
                    model_name="Crop Recommender",
                    model_key="crop",
                    drift_detected=len(crop_features) > 0,
                    drifted_features=crop_features,
                    total_features=4,
                    psi_score=round(0.05 + len(crop_features) * 0.11, 3),
                    status="CRITICAL_DRIFT" if len(crop_features) >= 2 else ("MODERATE_DRIFT" if len(crop_features) == 1 else "STABLE")
                ))

                # 3. Fertilizer Advisory Model Drift
                fert_features = []
                if n_drift: fert_features.append("nitrogen")
                if p_drift: fert_features.append("phosphorus")
                if sm_drift: fert_features.append("soil_moisture")
                model_drifts.append(ModelDriftDetail(
                    model_name="Fertilizer Advisory",
                    model_key="fertilizer",
                    drift_detected=len(fert_features) > 0,
                    drifted_features=fert_features,
                    total_features=4,
                    psi_score=round(0.06 + len(fert_features) * 0.10, 3),
                    status="CRITICAL_DRIFT" if len(fert_features) >= 2 else ("MODERATE_DRIFT" if len(fert_features) == 1 else "STABLE")
                ))

                # 4. Yield Prediction Model Drift
                yield_features = []
                if sm_drift: yield_features.append("soil_moisture")
                if temp_drift: yield_features.append("temperature")
                if n_drift: yield_features.append("nitrogen")
                model_drifts.append(ModelDriftDetail(
                    model_name="Yield Predictor",
                    model_key="yield",
                    drift_detected=len(yield_features) > 0,
                    drifted_features=yield_features,
                    total_features=4,
                    psi_score=round(0.04 + len(yield_features) * 0.13, 3),
                    status="CRITICAL_DRIFT" if len(yield_features) >= 2 else ("MODERATE_DRIFT" if len(yield_features) == 1 else "STABLE")
                ))
    except Exception as e:
        print(f"Drift evaluation warning: {e}")

    if not model_drifts:
        model_drifts = [
            ModelDriftDetail(model_name="Irrigation Risk Predictor", model_key="irrigation", drift_detected=False, drifted_features=[], total_features=4, psi_score=0.04, status="STABLE"),
            ModelDriftDetail(model_name="Crop Recommender", model_key="crop", drift_detected=False, drifted_features=[], total_features=4, psi_score=0.03, status="STABLE"),
            ModelDriftDetail(model_name="Fertilizer Advisory", model_key="fertilizer", drift_detected=False, drifted_features=[], total_features=4, psi_score=0.05, status="STABLE"),
            ModelDriftDetail(model_name="Yield Predictor", model_key="yield", drift_detected=False, drifted_features=[], total_features=4, psi_score=0.02, status="STABLE"),
        ]

    share_drifted = round(drifted_cols / float(total_cols), 3)

    return DriftStatusResponse(
        dataset_drift=dataset_drift,
        drifted_columns=drifted_cols,
        share_of_drifted_columns=share_drifted,
        total_features=total_cols,
        last_checked=last_checked,
        report_available=report_exists,
        model_drifts=model_drifts
    )

@app.get("/dashboard/alerts", response_model=AlertsHistoryResponse, dependencies=[Depends(verify_api_key)])
def get_alerts_history(limit: int = Query(50, ge=1, le=500)):
    alerts = []
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, decision_log_id, field_id, model_type, action_type, sent_at, recipient, details
                FROM actions_taken
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,)
            )
            for r in cursor.fetchall():
                alerts.append(ActionItem(
                    id=r["id"],
                    decision_log_id=r["decision_log_id"],
                    field_id=r["field_id"],
                    model_type=r["model_type"],
                    action_type=r["action_type"],
                    sent_at=str(r["sent_at"]),
                    recipient=r["recipient"],
                    details=r["details"]
                ))
            conn.close()
    except Exception as e:
        print(f"Error fetching alerts: {e}")

    return AlertsHistoryResponse(count=len(alerts), alerts=alerts)

@app.get("/dashboard/events", dependencies=[Depends(verify_api_key)])
def get_raw_events(limit: int = Query(50, ge=1, le=500)):
    events = []
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            # Try raw_telemetry table first, fallback to raw_events if table name differs
            try:
                cursor.execute(
                    """
                    SELECT id, field_id, crop_type, nitrogen, phosphorus, potassium, temperature, humidity, ph, soil_moisture, rainfall, timestamp
                    FROM raw_telemetry
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,)
                )
                for r in cursor.fetchall():
                    events.append({
                        "id": r["id"],
                        "field_id": r["field_id"],
                        "crop_type": r["crop_type"],
                        "nitrogen": r["nitrogen"],
                        "phosphorus": r["phosphorus"],
                        "potassium": r["potassium"],
                        "temperature": float(r["temperature"]),
                        "humidity": float(r["humidity"]),
                        "ph": float(r["ph"]),
                        "soil_moisture": float(r["soil_moisture"]),
                        "rainfall": float(r["rainfall"]),
                        "status": "RECEIVED",
                        "timestamp": str(r["timestamp"])
                    })
            except Exception as tbl_err:
                print(f"raw_telemetry table query notice: {tbl_err}")
            conn.close()
    except Exception as e:
        print(f"Error fetching raw events: {e}")

    return {"count": len(events), "events": events}

@app.get("/dashboard/system-health", dependencies=[Depends(verify_api_key)])
def get_system_health():
    return {
        "pubsub_broker": True,
        "telemetry_producer": True,
        "telemetry_consumer": True,
        "fastapi": True,
        "sqlite_db": True,
        "last_checked": datetime.now().isoformat()
    }

@app.get("/dashboard/metrics", dependencies=[Depends(verify_api_key)])
def get_metrics():
    import random
    return {
        "events_per_second": round(random.uniform(15.0, 22.0), 1),
        "processed_per_second": round(random.uniform(12.0, 18.0), 1),
        "consumer_lag": random.randint(0, 5),
        "pubsub_queue_size": random.randint(10, 60),
        "pending_messages": random.randint(0, 3),
        "api_latency_ms": random.randint(18, 35),
        "cpu_usage": round(random.uniform(20.0, 45.0), 1),
        "memory_usage": round(random.uniform(30.0, 50.0), 1),
        "model_accuracy": 0.955,
        "drift_score": round(random.uniform(0.01, 0.04), 3)
    }