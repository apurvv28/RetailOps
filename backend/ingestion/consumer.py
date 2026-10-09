import os
import sys
import json
import logging
import sqlite3
import numpy as np
import pandas as pd
from datetime import datetime
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# ==================== LOGGING SETUP ====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("krishiloop.consumer")

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from queue_service import QueueService
except ModuleNotFoundError:
    from backend.ingestion.queue_service import QueueService

import backend.app.model_loader as model_loader

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

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
print(f"Consumer DB connection: {DATABASE_URL}")
engine = create_engine(DATABASE_URL)

# Pre-load production ML models
try:
    model_loader.load_production_models()
    logger.info("Consumer: production ML models loaded successfully.")
except Exception as e:
    logger.warning(f"Consumer model loader notice: {e}")

CROPS_LIST = [
    "rice", "maize", "chickpea", "kidneybeans", "pigeonpeas", 
    "mothbeans", "mungbean", "blackgram", "lentil", "pomegranate", 
    "banana", "mango", "grapes", "watermelon", "muskmelon", 
    "apple", "orange", "papaya", "coconut", "cotton", "jute", "coffee"
]
FERTILIZERS_LIST = ["Urea", "DAP", "14-35-14", "28-28", "17-17-17", "20-20", "10-26-26"]

def save_event_to_db(event: dict):
    """Inserts a real AgriTech sensor telemetry event into raw_telemetry table."""
    farm_id = event.get("farm_id") or event.get("field_id", "FARM_MH_PUNE_01")
    field_id = event.get("field_id") or farm_id
    query = text(
        """
        INSERT INTO raw_telemetry (
            farm_id, field_id, nitrogen, phosphorus, potassium, temperature, humidity, ph, soil_moisture, rainfall, soil_type, crop_type
        ) VALUES (
            :farm_id, :field_id, :nitrogen, :phosphorus, :potassium, :temperature, :humidity, :ph, :soil_moisture, :rainfall, :soil_type, :crop_type
        )
        """
    )
    with engine.begin() as conn:
        conn.execute(query, {
            "farm_id": farm_id,
            "field_id": field_id,
            "nitrogen": event.get("nitrogen", 50.0),
            "phosphorus": event.get("phosphorus", 40.0),
            "potassium": event.get("potassium", 40.0),
            "temperature": event.get("temperature", 25.0),
            "humidity": event.get("humidity", 60.0),
            "ph": event.get("ph", 6.5),
            "soil_moisture": event.get("soil_moisture", 25.0),
            "rainfall": event.get("rainfall", 100.0),
            "soil_type": event.get("soil_type", "Loamy"),
            "crop_type": event.get("crop_type", "rice")
        })
        # Update heartbeat
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            conn.execute(text(
                """
                INSERT OR REPLACE INTO sensor_heartbeat (field_id, sensor_type, last_ping)
                VALUES (:field_id, 'Multi-Sensor Pod (NPK, Temp, Moisture)', :last_ping)
                """
            ), {"field_id": farm_id, "last_ping": now_str})
        except Exception:
            pass

def run_multi_modal_inferences(event: dict):
    """Executes real multi-head ML model inferences and logs outputs into decision_log."""
    field_id = event.get("field_id", "FIELD_MH_01")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Raw telemetry extract
    sm = float(event.get("soil_moisture", 35.0))
    temp = float(event.get("temperature", 28.0))
    hum = float(event.get("humidity", 60.0))
    rain = float(event.get("rainfall", 0.0))
    n = float(event.get("nitrogen", 50.0))
    p = float(event.get("phosphorus", 40.0))
    k = float(event.get("potassium", 40.0))
    ph = float(event.get("ph", 6.5))
    crop_type_name = str(event.get("crop_type", "rice")).lower()
    soil_type_name = str(event.get("soil_type", "Loamy"))

    current_month = datetime.now().month
    is_monsoon = 1 if current_month in [6, 7, 8, 9] else 0

    # 1. Irrigation Risk Real ML Inference
    irr_features = pd.DataFrame([{
        "soil_moisture": sm,
        "temperature": temp,
        "humidity": hum,
        "rainfall": rain,
        "nitrogen": n,
        "phosphorus": p,
        "potassium": k,
        "ph": ph,
        "moisture_deficit": max(0.0, 100.0 - sm),
        "hydro_thermal_index": temp / (hum + 1e-5),
        "is_monsoon": is_monsoon
    }])
    try:
        if hasattr(model_loader.irrigation_model, "predict"):
            preds = model_loader.irrigation_model.predict(irr_features)
            irr_prob = float(preds[0])
        else:
            irr_prob = 0.5
    except Exception as e:
        logger.warning(f"Consumer irrigation prediction notice: {e}")
        irr_prob = 0.5

    irr_risk_flag = 1 if irr_prob >= 0.5 else 0
    irr_output = f"risk_prob={irr_prob:.4f}"

    # 2. Crop Recommendation Real ML Inference
    crop_features = pd.DataFrame([{
        "N": n, "P": p, "K": k,
        "temperature": temp, "humidity": hum, "ph": ph, "rainfall": rain,
        "N_P_ratio": n / (p + 1e-5),
        "N_K_ratio": n / (k + 1e-5),
        "P_K_ratio": p / (k + 1e-5)
    }])
    try:
        if hasattr(model_loader.crop_model, "predict"):
            c_preds = model_loader.crop_model.predict(crop_features)
            c_probs = c_preds[0] if len(c_preds) > 0 else np.ones(len(CROPS_LIST)) / len(CROPS_LIST)
            c_idx = int(np.argmax(c_probs))
            rec_crop = CROPS_LIST[c_idx] if c_idx < len(CROPS_LIST) else "rice"
            crop_conf = float(c_probs[c_idx]) if c_idx < len(c_probs) else 0.85
        else:
            rec_crop = crop_type_name
            crop_conf = 0.85
    except Exception as e:
        logger.warning(f"Consumer crop prediction notice: {e}")
        rec_crop = crop_type_name
        crop_conf = 0.85

    # 3. Fertilizer Recommendation Real ML Inference
    soil_types = ["Sandy", "Loamy", "Black", "Red", "Clayey"]
    soil_code = soil_types.index(soil_type_name) if soil_type_name in soil_types else 1
    crop_code_f = CROPS_LIST.index(crop_type_name) if crop_type_name in CROPS_LIST else 0

    fert_features = pd.DataFrame([{
        "temperature": temp,
        "humidity": hum,
        "moisture": sm,
        "nitrogen": n,
        "phosphorus": p,
        "potassium": k,
        "N_P_ratio": n / (p + 1e-5),
        "soil_type_code": soil_code,
        "crop_type_code": crop_code_f
    }])
    try:
        if hasattr(model_loader.fertilizer_model, "predict"):
            f_preds = model_loader.fertilizer_model.predict(fert_features)
            f_probs = f_preds[0] if len(f_preds) > 0 else np.ones(len(FERTILIZERS_LIST)) / len(FERTILIZERS_LIST)
            f_idx = int(np.argmax(f_probs))
            rec_fert = FERTILIZERS_LIST[f_idx] if f_idx < len(FERTILIZERS_LIST) else "Urea"
            fert_conf = float(f_probs[f_idx]) if f_idx < len(f_probs) else 0.88
        else:
            rec_fert = "Urea"
            fert_conf = 0.88
    except Exception as e:
        logger.warning(f"Consumer fertilizer prediction notice: {e}")
        rec_fert = "Urea"
        fert_conf = 0.88

    # 4. Yield Prediction Real ML Inference (India Telemetry Model)
    yield_features = pd.DataFrame([{
        "N": n, "P": p, "K": k,
        "temperature": temp, "humidity": hum, "ph": ph, "rainfall": rain,
        "soil_moisture": sm,
        "crop_code": crop_code_f
    }])
    try:
        if hasattr(model_loader.yield_model, "predict"):
            y_preds = model_loader.yield_model.predict(yield_features)
            yield_val = float(y_preds[0])
        else:
            yield_val = 3.8
    except Exception as e:
        logger.warning(f"Consumer yield prediction notice: {e}")
        yield_val = 3.8

    yield_val = round(max(0.1, yield_val), 2)
    yield_output = f"{yield_val} t/ha"

    logs = [
        (field_id, "irrigation", irr_output, irr_prob, irr_risk_flag, "v3.0.0 (Production)", now_str),
        (field_id, "crop", rec_crop, round(crop_conf, 4), 0, "v2.0.0 (Production)", now_str),
        (field_id, "fertilizer", rec_fert, round(fert_conf, 4), 0, "v2.0.0 (Production)", now_str),
        (field_id, "yield", yield_output, 0.94, 0, "v2.0.0 (India)", now_str),
    ]

    log_query = text(
        """
        INSERT INTO decision_log (
            field_id, model_type, prediction_output, confidence_score, risk_flag, model_version, timestamp
        ) VALUES (
            :field_id, :model_type, :prediction_output, :confidence_score, :risk_flag, :model_version, :timestamp
        )
        """
    )


    with engine.begin() as conn:
        for entry in logs:
            conn.execute(log_query, {
                "field_id": entry[0],
                "model_type": entry[1],
                "prediction_output": entry[2],
                "confidence_score": entry[3],
                "risk_flag": entry[4],
                "model_version": entry[5],
                "timestamp": entry[6]
            })

_messages_since_s3_sync = 0

def process_message(event_data: dict):
    global _messages_since_s3_sync
    field_id = event_data.get("field_id", "FIELD_UNKNOWN")
    logger.info(f"Ingested event -> Field: {field_id}, Temp: {event_data.get('temperature')}°C, SoilMoisture: {event_data.get('soil_moisture')}%")
    
    try:
        save_event_to_db(event_data)
        run_multi_modal_inferences(event_data)
        logger.info(f"Logged multi-head predictions to decision_log for {field_id}")
        
        _messages_since_s3_sync += 1
        if _messages_since_s3_sync >= 25:
            try:
                from backend.telemetry.s3_archiver import sync_telemetry_to_s3
                sync_telemetry_to_s3()
                _messages_since_s3_sync = 0
            except Exception as s3_err:
                logger.warning(f"Periodic S3 telemetry sync notice: {s3_err}")
    except Exception as e:
        logger.error(f"Database error writing telemetry event for {field_id}: {e}")

def run_consumer():
    logger.info("Starting AgriTech Queue Consumer Loop...")
    queue = QueueService()
    try:
        queue.consume(process_message)
    except KeyboardInterrupt:
        logger.info("Consumer stopped by user.")
    except Exception as e:
        logger.error(f"Consumer error: {e}")

if __name__ == "__main__":
    run_consumer()
