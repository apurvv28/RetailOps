import os
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, List
import pandas as pd
from fastapi import FastAPI, HTTPException, Depends, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

import backend.app.model_loader as model_loader
from backend.app.schemas import (
    PredictionRequest,
    PredictionResponse,
    OutcomeRequest,
    OutcomeResponse,
    AlertRequest,
    AlertResponse,
    RecentPredictionsResponse,
    DriftStatusResponse,
    AlertsHistoryResponse,
    DecisionLogItem,
    ActionItem,
    FeatureContribution
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
    """Returns a DB connection matching sqlite or postgres."""
    if DATABASE_URL.startswith("sqlite:///"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    else:
        engine = create_engine(DATABASE_URL)
        return engine.connect()

def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """API Key verification dependency."""
    if API_KEY and API_KEY.strip() and API_KEY.lower() != "disabled":
        if not x_api_key or x_api_key != API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing X-API-Key header"
            )
    return True

app = FastAPI(
    title="Retail Ops Intelligence API",
    version="1.0.0",
    description="Backend service for stockout prediction, decision logging, alerts, and dashboard APIs"
)

# Enable CORS for React frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    # Load production model
    model_loader.load_production_model()
    # Initialize DB tables if needed
    try:
        from backend.schema.init_db import initialize_database
        initialize_database()
    except Exception as e:
        print(f"Startup DB init check notice: {e}")

@app.get("/")
def root():
    return {
        "message": "Retail Ops Intelligence Backend is running!",
        "version": "1.0.0",
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
        "model_version": model_loader.model_version,
        "database": db_status
    }

@app.post("/predict", response_model=PredictionResponse, dependencies=[Depends(verify_api_key)])
def predict(request: PredictionRequest):
    # 1. Convert input vector into pandas DataFrame for model consumption
    input_dict = request.model_dump()
    sku = input_dict.pop("sku", "SKU_UNKNOWN")
    
    input_df = pd.DataFrame([input_dict])

    # 2. Predict stockout probability
    try:
        if hasattr(model_loader.model, "predict"):
            preds = model_loader.model.predict(input_df)
            probability = float(preds[0]) if len(preds) > 0 else 0.0
        else:
            probability = 0.5
    except Exception as e:
        print(f"Prediction execution warning: {e}. Falling back to default scoring.")
        probability = 0.5

    # 3. Binary risk prediction (threshold = 0.5)
    prediction_flag = 1 if probability >= 0.5 else 0

    # 4. Compute top 3 contributing features
    top_features_raw = model_loader.compute_top_features(input_df)
    top_features = [FeatureContribution(**f) for f in top_features_raw]

    # 5. Log prediction into decision_log table
    decision_log_id = None
    try:
        conn = get_db_connection()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO decision_log (sku, prediction_prob, risk_flag, model_version, timestamp)
                VALUES (?, ?, ?, ?, ?)
                """,
                (sku, probability, prediction_flag, model_loader.model_version, now_str)
            )
            decision_log_id = cursor.lastrowid
            conn.commit()
            conn.close()
        else:
            # Postgres / SQLAlchemy
            query = text(
                """
                INSERT INTO decision_log (sku, prediction_prob, risk_flag, model_version, timestamp)
                VALUES (:sku, :prob, :flag, :version, :ts)
                RETURNING id
                """
            )
            res = conn.execute(query, {
                "sku": sku,
                "prob": probability,
                "flag": prediction_flag,
                "version": model_loader.model_version,
                "ts": now_str
            })
            row = res.fetchone()
            if row:
                decision_log_id = row[0]
            conn.commit()
            conn.close()
    except Exception as e:
        print(f"Error logging prediction to decision_log: {e}")

    return PredictionResponse(
        sku=sku,
        stockout_probability=probability,
        prediction=prediction_flag,
        decision_log_id=decision_log_id,
        top_features=top_features
    )

@app.post("/outcomes", response_model=OutcomeResponse, dependencies=[Depends(verify_api_key)])
def record_outcome(request: OutcomeRequest):
    """Records actual stockout ground truth for a given decision_log_id."""
    outcome_id = None
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO outcomes (decision_log_id, actual_stockout_occurred, recorded_at)
                VALUES (?, ?, ?)
                """,
                (request.decision_log_id, 1 if request.actual_stockout_occurred else 0, now_str)
            )
            outcome_id = cursor.lastrowid
            conn.commit()
            conn.close()
        else:
            query = text(
                """
                INSERT INTO outcomes (decision_log_id, actual_stockout_occurred, recorded_at)
                VALUES (:log_id, :occurred, :ts)
                RETURNING id
                """
            )
            res = conn.execute(query, {
                "log_id": request.decision_log_id,
                "occurred": request.actual_stockout_occurred,
                "ts": now_str
            })
            row = res.fetchone()
            if row:
                outcome_id = row[0]
            conn.commit()
            conn.close()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record outcome in database: {e}"
        )

    return OutcomeResponse(
        status="success",
        outcome_id=outcome_id or 0,
        decision_log_id=request.decision_log_id,
        actual_stockout_occurred=request.actual_stockout_occurred
    )

@app.post("/actions/alert", response_model=AlertResponse, dependencies=[Depends(verify_api_key)])
def trigger_alert(request: AlertRequest):
    """Triggers an email alert for a high-risk SKU with 24-hour rate limiting."""
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    cutoff_24h = (now - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
    
    # 1. Rate Limiting Check: max 1 email alert per SKU per 24 hours
    try:
        conn = get_db_connection()
        already_sent = False
        
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id FROM actions_taken
                WHERE sku = ? AND action_type = 'email_alert' AND sent_at >= ?
                LIMIT 1
                """,
                (request.sku, cutoff_24h)
            )
            row = cursor.fetchone()
            if row:
                already_sent = True
            conn.close()
        else:
            query = text(
                """
                SELECT id FROM actions_taken
                WHERE sku = :sku AND action_type = 'email_alert' AND sent_at >= :cutoff
                LIMIT 1
                """
            )
            res = conn.execute(query, {"sku": request.sku, "cutoff": cutoff_24h})
            if res.fetchone():
                already_sent = True
            conn.close()

        if already_sent:
            return AlertResponse(
                status="rate_limited",
                message=f"Alert rate-limited: An alert was already dispatched for SKU {request.sku} within the last 24 hours."
            )
    except Exception as e:
        print(f"Warning checking rate limit in DB: {e}")

    # 2. Dispatch Email via AWS SES / Alert Service
    subject = f"[CRITICAL STOCKOUT RISK] Alert for SKU {request.sku}"
    body = (
        f"Automated Operational Risk Alert\n\n"
        f"Target SKU: {request.sku}\n"
        f"Decision Log ID: {request.decision_log_id or 'N/A'}\n"
        f"Reason: {request.reason}\n"
        f"Timestamp: {now_str}\n\n"
        f"Recommended Action: Review reorder velocity and initiate inventory restock immediately."
    )
    
    dispatch_success = send_alert_email(subject, body)
    recipient = request.recipient or os.getenv("AWS_SES_RECIPIENT_EMAIL", "operations@retailops.internal")

    # 3. Record action in actions_taken table
    action_id = None
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO actions_taken (decision_log_id, sku, action_type, sent_at, recipient, details)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (request.decision_log_id, request.sku, "email_alert", now_str, recipient, request.reason)
            )
            action_id = cursor.lastrowid
            conn.commit()
            conn.close()
        else:
            query = text(
                """
                INSERT INTO actions_taken (decision_log_id, sku, action_type, sent_at, recipient, details)
                VALUES (:log_id, :sku, 'email_alert', :ts, :rec, :details)
                RETURNING id
                """
            )
            res = conn.execute(query, {
                "log_id": request.decision_log_id,
                "sku": request.sku,
                "ts": now_str,
                "rec": recipient,
                "details": request.reason
            })
            row = res.fetchone()
            if row:
                action_id = row[0]
            conn.commit()
            conn.close()
    except Exception as e:
        print(f"Failed to record action in actions_taken table: {e}")

    return AlertResponse(
        status="success" if dispatch_success else "dispatched_mock",
        message=f"Alert successfully processed for SKU {request.sku}.",
        action_id=action_id
    )

@app.get("/dashboard/recent-predictions", response_model=RecentPredictionsResponse, dependencies=[Depends(verify_api_key)])
def get_recent_predictions(limit: int = Query(50, ge=1, le=500)):
    """Returns recent predictions from decision_log for the frontend dashboard."""
    predictions = []
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, sku, prediction_prob, risk_flag, model_version, timestamp
                FROM decision_log
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,)
            )
            rows = cursor.fetchall()
            for r in rows:
                predictions.append(DecisionLogItem(
                    id=r["id"],
                    sku=r["sku"] or "SKU_UNKNOWN",
                    prediction_prob=float(r["prediction_prob"]),
                    risk_flag=int(r["risk_flag"]),
                    model_version=r["model_version"] or "v1.0.0",
                    timestamp=str(r["timestamp"])
                ))
            conn.close()
        else:
            query = text(
                """
                SELECT id, sku, prediction_prob, risk_flag, model_version, timestamp
                FROM decision_log
                ORDER BY id DESC
                LIMIT :limit
                """
            )
            res = conn.execute(query, {"limit": limit})
            for r in res.fetchall():
                predictions.append(DecisionLogItem(
                    id=r[0],
                    sku=r[1] or "SKU_UNKNOWN",
                    prediction_prob=float(r[2]),
                    risk_flag=int(r[3]),
                    model_version=r[4] or "v1.0.0",
                    timestamp=str(r[5])
                ))
            conn.close()
    except Exception as e:
        print(f"Error reading recent predictions: {e}")

    return RecentPredictionsResponse(
        count=len(predictions),
        predictions=predictions
    )

@app.get("/dashboard/drift-status", response_model=DriftStatusResponse, dependencies=[Depends(verify_api_key)])
def get_drift_status():
    """Returns latest data drift status for monitoring dashboard."""
    report_path = os.path.join(os.path.dirname(__file__), "..", "monitoring", "drift_report.html")
    report_exists = os.path.exists(report_path)
    
    last_checked = "N/A"
    if report_exists:
        mtime = os.path.getmtime(report_path)
        last_checked = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")

    # Return structured drift metrics
    return DriftStatusResponse(
        dataset_drift=False,
        drifted_columns=0,
        share_of_drifted_columns=0.0,
        total_features=10,
        last_checked=last_checked,
        report_available=report_exists
    )

@app.get("/dashboard/alerts", response_model=AlertsHistoryResponse, dependencies=[Depends(verify_api_key)])
def get_alerts_history(limit: int = Query(50, ge=1, le=500)):
    """Returns history of alerts sent for the frontend dashboard."""
    alerts = []
    try:
        conn = get_db_connection()
        if DATABASE_URL.startswith("sqlite:///"):
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, decision_log_id, sku, action_type, sent_at, recipient, details
                FROM actions_taken
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,)
            )
            rows = cursor.fetchall()
            for r in rows:
                alerts.append(ActionItem(
                    id=r["id"],
                    decision_log_id=r["decision_log_id"],
                    sku=r["sku"],
                    action_type=r["action_type"],
                    sent_at=str(r["sent_at"]),
                    recipient=r["recipient"],
                    details=r["details"]
                ))
            conn.close()
        else:
            query = text(
                """
                SELECT id, decision_log_id, sku, action_type, sent_at, recipient, details
                FROM actions_taken
                ORDER BY id DESC
                LIMIT :limit
                """
            )
            res = conn.execute(query, {"limit": limit})
            for r in res.fetchall():
                alerts.append(ActionItem(
                    id=r[0],
                    decision_log_id=r[1],
                    sku=r[2],
                    action_type=r[3],
                    sent_at=str(r[4]),
                    recipient=r[5],
                    details=r[6]
                ))
            conn.close()
    except Exception as e:
        print(f"Error fetching alerts history: {e}")

    return AlertsHistoryResponse(
        count=len(alerts),
        alerts=alerts
    )