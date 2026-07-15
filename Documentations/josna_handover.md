# Handover Guide — Phase 5 (Streaming) & Phase 6 (Frontend Dashboard)

Welcome to the **Retail Ops Intelligence** project! 🚀
This document serves as your guide for taking over the project to implement Phase 5 and Phase 6. 
Phases 1 & 2 (Data Foundation, Training Pipeline, and CI/CD/Drift Alerting) and Phases 3 & 4 (Model Deployment & Serving Backend) have been completed and merged into `main`.

Below is a detailed summary of the current system state, the architecture, your goals, a step-by-step TODO list, and an implementation prompt to kick off your development.

---

## 🏗️ Part 1: What Has Been Implemented So Far (Phases 1–4)

The project is structured with a modular Python backend, SQLite database integration (ready for PostgreSQL/CockroachDB serverless migrations), and a complete ML lifecycle pipeline. Here is a breakdown of what exists:

### 1. Data Ingestion & Validation (Phase 1)
*   **Dataset Setup**: Scripts are available in [download_dataset.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/ingestion/download_dataset.py) to download and stage the **UCI Online Retail II** dataset.
*   **Data Validation**: Integrated data quality checks using **Pandera** in `backend/training/data_validation.py` to enforce constraints (e.g., no negative invoice prices, non-null fields, consistent formats).
*   **Database Schema**: SQLite database file `backend/retail_ops.db` and a Postgres/CockroachDB-compatible DDL schema script in [database.sql](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/schema/database.sql) initialized dynamically via [init_db.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/schema/init_db.py).
    *   *Tables defined*: `raw_events`, `engineered_features`, `decision_log`, `outcomes`, and `actions_taken`.

### 2. Feature Engineering & Model Training (Phase 1)
*   **Feature Pipelines**: Rolling window sales averages (7/14/30 days), demand velocity, simulated inventory metrics, and holiday flags are computed in [feature_engineering.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/training/feature_engineering.py).
*   **MLflow Tracking**: Training script in [train.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/training/train.py) trains Logistic Regression and LightGBM models, logging parameters, performance metrics (ROC-AUC, Precision, Recall), and model artifacts to a local MLflow database (`backend/mlruns.db`).
*   **Gating Checks**: [gate_check.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/training/gate_check.py) queries the MLflow Model Registry and gates promotions—only registering and transitioning the LightGBM model to the `Production` stage if its performance beats the baseline or previous model by a threshold.

### 3. CI/CD & Drift Monitoring (Phase 2)
*   **GitHub Actions Workflow**: A complete pipeline configured in [ci-cd.yml](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/.github/workflows/ci-cd.yml) that performs code linting (`flake8`), runs unit tests, performs dry-run validations on database scripts and ML training, and handles Docker image builds. If GCP secrets are configured, it handles container registry pushing and 10% canary traffic deployments to Google Cloud Run.
*   **Drift Monitoring**: [drift_detector.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/monitoring/drift_detector.py) uses **Evidently AI** to perform statistical data drift analysis (PSI, KL divergence) between incoming event windows and training data. It publishes alert payloads to Slack/SNS if drift thresholds are breached.
*   **Email Alert Service**: An AWS SES integration in [alert_service.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/monitoring/alert_service.py) is wired up to dispatch automated email notifications when stockout risks or significant drift are detected.

### 4. FastAPI Model Serving API (Phase 3 & 4 Partials)
*   **Serving Core**: A FastAPI application in [main.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/app/main.py) that loads the currently approved `'Production'` model from the MLflow registry (`backend/mlruns.db`) at startup using [model_loader.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/app/model_loader.py).
*   **Serving Endpoints**:
    *   `GET /health`: Returns service health status and the loaded model details.
    *   `POST /predict`: Accepts a JSON payload of engineered features (mapped in [schemas.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/app/schemas.py)) and returns the stockout probability and binary risk flag.
*   **Containerization**: A [Dockerfile](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/Dockerfile) builds the application server, exposes port `8080`, and is ready for production hosting.

> [!IMPORTANT]
> **Pending Backend Additions**: In the current code merged in `main`, the Phase 4 FastAPI endpoints (`POST /outcomes`, `POST /actions/alert`, and the `/dashboard` read endpoints) and database request-logging middleware are not fully coded. You will need to implement these endpoints in [main.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/app/main.py) as part of your streaming and dashboard integration tasks (detailed in your TODO list below).

---

## 🎯 Part 2: Goals for Phase 5 & Phase 6

Your ownership covers the integration of a **Real-Time Streaming Layer** and the **Dashboard Frontend**, transforming the static API into a dynamic, event-driven visualization.

### Phase 5: Real-Time Streaming & Kafka Ingestion Layer
The goal is to transition the data ingestion path from a simple queue/file read to a high-throughput, real-time event stream.
1.  **Introduce Kafka Broker**: Spin up a local multi-topic Kafka cluster in Docker.
2.  **Continuous Simulation**: Develop a producer script that feeds row-by-row transaction events from the Online Retail dataset into a raw event topic.
3.  **Real-Time Predictions**: Build a streaming consumer that pulls these events, fetches/calculates features, queries the serving API's `/predict` endpoint, writes the results into the `decision_log` table in SQLite/CockroachDB, and forwards the prediction to an output prediction topic.
4.  **Preserve Ordering**: Enforce a partitioning strategy using the SKU (`stock_code`) as the message key to ensure transactions for any specific product are processed sequentially.

### Phase 6: Frontend Dashboard Development
The goal is to build a beautiful, high-fidelity UI that exposes predictions, alerts, and model telemetry.
1.  **Interactive Interface**: Build a responsive React/HTML dashboard displaying live prediction feeds.
2.  **Detailed Analysis**: Add detail panels showing SHAP feature importance charts (e.g., why a SKU is flagged for stockout risk).
3.  **Telemetry Visualization**: Render charts displaying data drift scores and model accuracy patterns.
4.  **Action Logs**: Expose alert histories showing what emails were triggered.

---

## 📋 Part 3: Josna's Task TODO List

Here is your checklist. Mark items with `[x]` as you complete them during development.

### Phase 5 Tasks: Kafka Streaming
- [ ] **Docker Compose Kafka Broker**:
  - Add a `docker-compose.yml` to the root or a new streaming directory that spins up a Kafka broker (and Zookeeper or KRaft controller) along with UI tools like Kafka UI or AKHQ for easy debugging.
  - Define two topics: `retail-events-raw` and `retail-predictions`.
- [ ] **Kafka Producer Script**:
  - Create `backend/ingestion/kafka_producer.py` using `confluent-kafka` or `kafka-python`.
  - Read from `backend/data/online_retail_II.csv` and publish transaction events to `retail-events-raw` with a configurable sleep delay to simulate a real-time feed.
  - Use `stock_code` (SKU) as the message key to partition data.
- [ ] **FastAPI Backend Extensions**:
  - Update [main.py](file:///d:/VIT/Sem%205/Machine%20Learning%20and%20Operations/Course-Project-RetailOps/backend/app/main.py) to support database persistence for predictions.
  - Implement a middleware or utility function to write records to `decision_log` during prediction.
  - Implement a `/outcomes` endpoint to record actual stockout events.
  - Implement `/dashboard/recent-predictions`, `/dashboard/drift-status`, and `/dashboard/alerts` API endpoints.
- [ ] **Kafka Consumer Script**:
  - Create `backend/ingestion/kafka_consumer.py`.
  - Listen on `retail-events-raw`, dynamically generate or query feature arrays for incoming SKUs, call the FastAPI `/predict` endpoint, log results to the `decision_log` database table, and push the final prediction payload to the `retail-predictions` topic.
- [ ] **Streaming Documentation**:
  - Create a short README in `backend/ingestion/` detailing how to start Kafka, run the scripts, and explaining the partitioning schema.

### Phase 6 Tasks: Frontend Dashboard
- [ ] **React Application Setup**:
  - Initialize a new React SPA in the root folder (e.g., `frontend/`) using Vite (`npm create vite@latest frontend -- --template react`).
  - Configure styling (premium aesthetics: glassmorphism, tailored neutral dark/light theme, custom typography).
- [ ] **Overview Panel**:
  - Display KPI cards: *Total SKUs at Risk*, *Current Active Model Version*, *Latest Data Drift Score*, and *Total Alerts Sent*.
- [ ] **Live Predictions Feed**:
  - Display a real-time table of predictions (SKU, Timestamp, Probability, Flag).
  - Implement periodic polling against `/dashboard/recent-predictions` or set up a WebSocket bridge over the Kafka topic.
  - Add row-expansion logic: Clicking a row shows a bar chart of feature contributions (e.g., SHAP value contributions).
- [ ] **Monitoring & Drift Charting**:
  - Implement line charts using `Recharts` showing historical data drift indices and accuracy percentages over time.
- [ ] **Alerts Hub**:
  - Renders a list of dispatched email/Slack alerts pulled from `/dashboard/alerts`.
- [ ] **UI Polish & Skeletons**:
  - Implement loading states with clean skeleton components and empty state messages.

---

## 🤖 Part 4: Implementation Prompt for Josna

Copy-paste the prompt below into your AI pair programmer (e.g., Antigravity) to begin code generation:

```text
You are an expert streaming and frontend developer pair programming with Josna to implement Phase 5 (Kafka event streaming) and Phase 6 (React dashboard UI) of the "Retail Ops Intelligence" project. 

The project has a trained LightGBM model served via a FastAPI API inside the `backend/app/` folder. The DB schema supports tables for `raw_events`, `engineered_features`, `decision_log`, `outcomes`, and `actions_taken`.

Please perform the following steps:

### STEP 1: Kafka Infrastructure & Streaming
1. Create a `docker-compose.yml` file at the project root to spin up a single-node Kafka broker (KRaft mode) and a Kafka UI manager on port 8080 or another open port. Pre-create the topics `retail-events-raw` and `retail-predictions`.
2. Write a Python Kafka producer `backend/ingestion/kafka_producer.py` that reads the transaction dataset at `backend/data/online_retail_II.csv`, simulates a live feed with configurable delay, and publishes events to `retail-events-raw` using the SKU (`stock_code`) as the partition key.
3. Write a Python Kafka consumer `backend/ingestion/kafka_consumer.py` that listens on `retail-events-raw`, queries the SQLite/CockroachDB database to construct/fetch engineered features for the SKU, makes a prediction request to the FastAPI `/predict` endpoint, writes the prediction log to the `decision_log` table in the database, and publishes the prediction result (SKU, probability, risk_flag, timestamp) to the `retail-predictions` topic.

### STEP 2: FastAPI Backend Enhancements
1. Update `backend/app/main.py` to:
   - Save all incoming `/predict` requests and outputs into the `decision_log` database table (with columns: SKU, prediction probability, risk flag, model version, and timestamp).
   - Implement `GET /dashboard/recent-predictions` to fetch the last N entries in the `decision_log` table.
   - Implement `GET /dashboard/drift-status` to return the latest drift scores and status.
   - Implement `GET /dashboard/alerts` to list records from the `actions_taken` table.
   - Implement `POST /outcomes` to insert ground-truth values into the `outcomes` table.
   - Add basic API Key auth checks for security using FastAPI dependencies.

### STEP 3: Frontend Dashboard
1. Initialize a React frontend app using Vite under a `frontend/` directory.
2. Build a single-page dashboard using beautiful, premium aesthetics (dark neutral theme, glassmorphism card layouts, smooth transitions, custom Google Fonts like Inter).
3. The dashboard must contain:
   - **Overview Tab**: Displays KPI summary cards showing count of at-risk SKUs, active model version, drift score, and alert counts.
   - **Predictions Tab**: A live table of recent SKU predictions with a polling interval of 2-3 seconds. Row clicking should expand to show a Recharts bar chart representing feature contributions.
   - **Telemetry/Monitoring Tab**: Renders historical line charts for data drift score and model accuracy over time.
   - **Alerts Tab**: Shows list of action alerts dispatched.
4. Ensure clean loading states, shimmer skeleton screens, and empty states.

Output production-grade, fully commented Python scripts, Docker compose YAML files, React components, and CSS files.
```

---

*Ready for Phase 5 & 6. Good luck, Josna! Feel free to ask questions as you begin.*
