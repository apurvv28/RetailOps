# Handover Guide — Phase 3 & Phase 4 Serving Backend

Welcome to the **Retail Ops Intelligence** project handover! 
Phase 1 (ML Pipeline & Baseline Models) and Phase 2 (CI/CD & Monitoring Alert Loop) are fully implemented, verified, and pushed to `main`. 

This document provides setup instructions and outlines your tasks and prompts for **Phase 3** and **Phase 4**.

---

## 🛠️ Step 1: Local Setup

Follow these steps to synchronize and set up your local workspace:

1. **Pull the Latest Code**:
   ```bash
   git pull origin main
   ```
2. **Set up the Virtual Environment**:
   Navigate to the project root and create/activate the Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv backend/.venv
   backend/.venv/Scripts/Activate.ps1

   # Linux/macOS
   python -m venv backend/.venv
   source backend/.venv/bin/activate
   ```
3. **Install Dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. **Environment Variables (`.env`)**:
   A template has been prepared for you at [backend/.env.example](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/.env.example). Create a local `.env` file in the `backend/` directory:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Provide values for variables like:
   - `DATABASE_URL`: Defaults to `sqlite:///retail_ops.db` for local SQLite development, or your CockroachDB URI.
   - `MLFLOW_TRACKING_URI`: Defaults to `sqlite:///mlruns.db` containing the registered production model.
   - `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: For AWS SES email alerting integration.
   - `GITHUB_TOKEN` & `GITHUB_REPOSITORY`: For trigger dispatches in the self-healing retraining loop.

---

## 📂 Understanding the Current Workspace
- [backend/schema/database.sql](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/schema/database.sql) — Contains the database schema DDL (including the updated `engineered_features` table with `simulated_inventory`).
- [backend/schema/init_db.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/schema/init_db.py) — Recreates the tables dynamically on SQLite or PostgreSQL.
- [backend/training/train.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/training/train.py) — Trains the model and logs it to MLflow registry.
- [backend/training/gate_check.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/training/gate_check.py) — Gating checks to verify and transition model versions to `Production`.
- [backend/monitoring/drift_detector.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/monitoring/drift_detector.py) — Runs data drift reports via Evidently AI.
- [backend/monitoring/alert_service.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/monitoring/alert_service.py) — Connects to AWS SES to trigger alerts.
- [.github/workflows/ci-cd.yml](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/.github/workflows/ci-cd.yml) — GitHub Actions pipeline with linting, unit tests, docker builds, and GCP canary routing.

---

## 🎯 Phase 3 — Model Deployment & FastAPI Serving Backend
**Owner: Tanvi (Backend Engineer)**

### Goal
Take the approved model from the MLflow registry and expose it as a containerized, health-checked production FastAPI service.

### Tasks & Outcomes

| Task | Outcome |
| :--- | :--- |
| **Build FastAPI serving app** | `/predict` (returns stockout probability + SHAP feature contribution) and `/health` endpoints. |
| **Load model from MLflow Registry** | App pulls the model in `'Production'` stage from `backend/mlruns.db` on startup. |
| **Dockerize the serving app** | Complete [backend/Dockerfile](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/Dockerfile) to package uvicorn, fastapi, lightgbm, shap, and mlflow. |
| **Push image to Artifact Registry** | Image is built and pushed via the GHA pipeline. |
| **Deploy to Cloud Run / Canary Rollout** | Live HTTPS endpoints with a $10\% \to 100\%$ traffic split. |

### Phase 3 Implementation Prompt
```text
You are a backend engineer building the model-serving layer for "Retail Ops Intelligence."
A LightGBM model is already registered and versioned in MLflow Model Registry (from Phase 1), and gated promotion is handled by CI/CD (from Phase 2). Your job is to serve it.

Build the following:
1. A FastAPI application with:
   - GET /health returning service status and currently loaded model version
   - POST /predict accepting a SKU's feature vector (JSON body) and returning:
     stockout probability, binary risk flag, and the top 3 contributing features
     (using SHAP values from the LightGBM model)
   - Model loading logic that pulls the current "production" stage model from the MLflow
     Model Registry at container startup (not hardcoded to a local file)
2. A Dockerfile that packages this FastAPI app, installs dependencies (fastapi, uvicorn,
   lightgbm, shap, mlflow), and exposes port 8080
3. A deployment script (bash/PowerShell) that:
   - Tags the Docker image with the MLflow model version
   - Pushes to Artifact Registry (or ECR)
   - Deploys to Cloud Run with `gcloud run deploy`, splitting traffic 90/10 between the
     current and new revision
   - Includes a second command to shift to 100% traffic after health checks pass, and a
     rollback command that reverts to the prior revision
4. Basic request/response logging middleware so every prediction gets written to the
   `decision_log` table in CockroachDB/SQLite (host, timestamp, SKU, prediction, model version)
   for your own Phase 4 backend to build on.

Output production-quality FastAPI code, Dockerfile, and deploy scripts.
```

---

## 🎯 Phase 4 — Backend Services, Database Layer & Decision Logging
**Owner: Tanvi (Backend Engineer)**

### Goal
Build the backend service layer that everything else (frontend dashboard, LLM agent, feedback loop) reads from and writes to.

### Tasks & Outcomes

| Task | Outcome |
| :--- | :--- |
| **Finalize Database Schema** | Ensure SQLite/CockroachDB supports `decision_log`, `outcomes`, and `actions_taken` tables with proper indexes. |
| **Build Outcome Logging API** | Endpoint `/outcomes` to log whether a predicted stockout actually happened (ground truth). |
| **Build Action-Trigger Backend** | SES email alert integration with a rate-limit check (e.g., max 1 email per SKU per 24 hours). |
| **Build Query APIs for Frontend** | Endpoints: `/dashboard/recent-predictions`, `/dashboard/drift-status`, and `/dashboard/alerts` for Josna's frontend. |
| **Add API Key Authentication** | Basic API key dependency (`Depends`) verifying request keys against `.env`. |
| **Write Integration Tests** | Confirm ingestion → prediction → logging → outcome flow works end-to-end. |

### Phase 4 Implementation Prompt
```text
You are a backend engineer extending the FastAPI service from Phase 3 with the supporting backend layer for "Retail Ops Intelligence."

Build the following:
1. Finalize CockroachDB/SQLite schema (SQL DDL) for:
   - `decision_log` (id, sku, prediction_prob, risk_flag, model_version, timestamp)
   - `outcomes` (id, decision_log_id FK, actual_stockout_occurred boolean, recorded_at)
   - `actions_taken` (id, decision_log_id FK, action_type, sent_at, recipient)
2. New FastAPI endpoints:
   - POST /outcomes — records the ground truth for a past prediction (did the SKU
     actually go out of stock), used by the feedback loop in Phase 8
   - POST /actions/alert — triggers an AWS SES email alert for a high-risk SKU, with a
     rate limiter (max 1 alert per SKU per 24 hours) to avoid spam
   - GET /dashboard/recent-predictions — returns the last N predictions with risk scores,
     for the frontend to render
   - GET /dashboard/drift-status — returns the latest drift score from the monitoring
     job in Phase 2
   - GET /dashboard/alerts — returns alert history for the frontend
3. A simple API key authentication dependency (FastAPI Depends) applied to all endpoints,
   reading a valid key from an environment variable / secrets manager.
4. Integration tests (pytest + httpx) that simulate: an event flowing in -> a prediction
   being made -> a decision being logged -> an outcome being recorded -> confirm the full
   round trip persists correctly in CockroachDB/SQLite.

Output complete FastAPI route code, SQL migrations, and the test suite.
```

---

*Phase 1 & Phase 2 are complete. Ready for integration! Let us pair up when you begin.*
