# AgriTech Intelligence Platform — Expanded Project Plan
### (Agri-Irrigate Ops → Multi-Model AgriTech MLOps Suite)

---

## 1. Why Expand — The Core Insight

Your existing Agri-Irrigate Ops model already ingests **N, P, K, temperature, humidity, soil moisture, and rainfall/weather forecast** telemetry. Two other classic agri-ML problems use **the exact same feature schema**:

| Model | Task | Reuses same inputs? |
|---|---|---|
| **1. Irrigation Risk (existing)** | Regression/Classification — 24h moisture depletion risk | — |
| **2. Crop Recommendation (new)** | Multi-class classification — best crop for a given soil+climate profile | ✅ N,P,K, temp, humidity, pH, rainfall |
| **3. Fertilizer Recommendation (new)** | Multi-class classification — right fertilizer given soil type, crop, and NPK deficiency | ✅ N,P,K, temp, humidity, soil type, crop type |

This means all three models can sit on **one shared feature store and one ingestion pipeline** instead of three disconnected projects — this is the strongest "systems thinking" story for your resume/interview: *one telemetry stream, three inference heads, one MLOps backbone.*

Optional 4th (stretch, if time permits): **Crop Yield Prediction (regression)** — forecasts yield using soil + weather + historical yield, positioned as a "downstream" model that consumes the Crop Recommendation output.

---

## 2. Datasets

| Model | Dataset | Notes |
|---|---|---|
| Irrigation Risk (existing) | UCI SMAP + Kaggle Smart Agriculture Dataset | Already locked |
| Crop Recommendation | [Crop Recommendation Dataset (Kaggle — Atharva Ingle)](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset) | 2200 rows, 22 crops, features: N, P, K, temperature, humidity, pH, rainfall. Clean, balanced (100/class) — good baseline. |
| Fertilizer Recommendation | [Fertilizer Prediction Dataset (Kaggle — gdabhishek)](https://www.kaggle.com/datasets/gdabhishek/fertilizer-prediction) | Features: temperature, humidity, moisture, soil type, crop type, N, P, K → fertilizer name label. Small (~99 rows) — plan to synthetically augment or merge with the larger [Fertilizer Recommendation Dataset (miadul)](https://www.kaggle.com/datasets/miadul/fertilizer-recommendation-dataset) for more volume. |
| Yield Prediction (optional stretch) | [Crop Yield Prediction using Soil and Weather (Kaggle)](https://www.kaggle.com/datasets/gurudathg/crop-yield-prediction-using-soil-and-weather) or [Agricultural Crop Yield in Indian States (Kaggle)](https://www.kaggle.com/datasets/akshatgupta7/crop-yield-in-indian-states-dataset) | Regression target = yield (tons/hectare); good for a LightGBM regressor reusing the same soil/weather features. |

All three primary datasets share N, P, K, temperature, humidity, and rainfall/moisture — so your **feature engineering + validation (Great Expectations) schema stays 90% common** across models, only the label/target differs.

---

## 3. Model Layer

| Model | Algorithm (baseline → primary) | Output |
|---|---|---|
| Irrigation Risk | Random Forest → LightGBM | Moisture depletion probability (24h) + SHAP explanation |
| Crop Recommendation | Random Forest → LightGBM (multi-class) | Top-3 recommended crops + confidence |
| Fertilizer Recommendation | Random Forest → LightGBM (multi-class) | Recommended fertilizer + SHAP-based nutrient deficiency explanation |
| Yield Prediction (stretch) | LightGBM Regressor | Predicted yield (t/ha), used as a secondary signal on the dashboard |

All models are registered under **one MLflow Model Registry** with separate registered-model names (`irrigation-risk`, `crop-recommender`, `fertilizer-recommender`) but a **shared experiment-tracking project** so you can compare metrics across model families in one place.

---

## 4. Updated Architecture (v2)

### Tier 0 — Version Control & Reproducibility
- **DVC** — versions raw + processed datasets and model artifacts; DVC remote backed by S3. Every training run is pinned to a `dvc.yaml` pipeline (ingest → validate → feature-engineer → train → evaluate).
- **Git + GitHub Actions** — code + DVC pointer versioning together.

### Tier 1 — Ingestion & Messaging
- **AWS SQS** — fault-tolerant buffering for real-time IoT telemetry (soil sensors, weather webhooks).
- **AWS Kinesis Data Streams** — high-throughput streaming layer for continuous telemetry (sits ahead of SQS for burst absorption before batching into inference/feature windows). Use Kinesis for the raw high-frequency sensor stream, SQS for discrete task-style events (retrain triggers, alert dispatch, action-fulfillment messages). This gives you a genuine "streaming vs. queueing" architecture story instead of one queue doing both jobs.
- **AWS Lambda** — stream consumers; apply Great Expectations schema validation at ingestion.
- **Amazon S3** — raw telemetry archive + DVC remote storage.

### Tier 2 — Storage
- **CockroachDB (Serverless)** — primary OLTP store for structured features, predictions, and outcome labels (distributed SQL, replaces the earlier single-purpose use — now the system of record for all three models, partitioned by `model_type`).

### Tier 3 — Experimentation & Registry
- **MLflow (on EC2 or ECS)** — experiment tracking + model registry across all three models; staging → production promotion gated by metric thresholds (accuracy/F1 for classifiers, RMSE for regressors).

### Tier 4 — CI/CD & Containerization
- **GitHub Actions** — on every merge to `main`: run tests → DVC repro (retrain if data changed) → build Docker image → push to **Amazon ECR** → deploy to **ECS Fargate**.
- **Docker** — one image per model-serving service (or one FastAPI app serving all three models behind different routes — see §5).
- **Amazon ECS + Fargate** — serverless container orchestration; scale-to-zero-friendly task definitions to control cost.

### Tier 5 — Serving
- **FastAPI** — single gateway service with routes:
  - `POST /predict/irrigation`
  - `POST /predict/crop`
  - `POST /predict/fertilizer`
  - `POST /predict/yield` (stretch)
  - `GET /health`, `GET /metrics`
- Deployed as an ECS Fargate service behind an **Application Load Balancer**, auto-scaling on request count/CPU.

### Tier 6 — Monitoring, Drift Detection & Auto-Retraining (the new closed loop)
- **Evidently AI** — computes drift reports on a schedule (or per-batch of new CockroachDB outcome rows).
- **Drift statistics:**
  - **KS-test (Kolmogorov–Smirnov)** — for continuous features (temperature, humidity, moisture, rainfall, N/P/K levels) to detect distribution shift vs. training baseline.
  - **PSI (Population Stability Index)** — for binned/categorical features (soil type, crop type, season) and for prediction-score distribution drift. Typical thresholds: PSI < 0.1 = stable, 0.1–0.25 = moderate drift (watch), > 0.25 = significant drift (act).
- **CloudWatch + SNS** — drift metrics pushed to CloudWatch custom metrics; alarm fires when KS p-value < 0.05 or PSI > 0.25 on any monitored feature/model.
- **Auto-retrain trigger:** SNS alarm → Lambda → triggers a **GitHub Actions `workflow_dispatch`** (via repository-dispatch API) → runs the DVC training pipeline → registers new model version in MLflow as `Staging` → if evaluation metrics beat the current `Production` model by your chosen margin, auto-promote; else, hold for manual review and notify via SES/SNS.
- **Amazon SES** — action alerts to farmers/users (irrigation trigger, fertilizer advisory) and internal retrain/drift notifications to the team.

---

## 5. Serving Pattern — Monolith Gateway vs. Microservices

Given hackathon/portfolio timelines, recommend: **one FastAPI gateway, three model-loading modules, shared CockroachDB connection pool.** This is faster to ship and still demonstrates multi-model MLOps maturity. If you want to show microservice design explicitly (nice-to-have for interviews), you can later split into 3 ECS services behind one ALB with path-based routing — same Docker base image, different `CMD`.

---

## 6. Closed-Loop Flow (updated)

```
Sensors/Weather → Kinesis (stream) → Lambda (validate: Great Expectations)
        → CockroachDB (raw features)
        → FastAPI (ECS Fargate) serves 3 models from MLflow Registry
        → Predictions + SHAP explanations → SES alerts / dashboard
        → Outcome logged back to CockroachDB (labeled data)
        → Evidently AI computes KS/PSI drift on schedule
        → CloudWatch alarm → SNS → Lambda → GitHub Actions retrain workflow
        → DVC pipeline re-runs → MLflow registers new version
        → Auto-promote if metrics improve → redeploy via CI/CD
```

---

## 7. Suggested Phases

| Phase | Scope |
|---|---|
| **Phase 1** | Add Crop Recommendation + Fertilizer Recommendation training pipelines (reuse existing feature engineering code); log to shared MLflow instance |
| **Phase 2** | Introduce DVC for all three datasets + pipelines; migrate CI to GitHub Actions with DVC repro step |
| **Phase 3** | Build unified FastAPI gateway with 3 (or 4) routes; containerize; deploy to ECS Fargate behind ALB |
| **Phase 4** | Wire CockroachDB as system of record for features + predictions + outcomes across all models |
| **Phase 5** | Implement Evidently AI drift jobs (KS + PSI) → CloudWatch/SNS → Lambda-triggered GitHub Actions retrain workflow |
| **Phase 6 (stretch)** | Add Yield Prediction as a 4th model consuming Crop Recommendation output |

---

## 8. What Makes This a Strong Portfolio Story

- Single shared telemetry pipeline feeding **three inference heads** = systems design maturity, not just "trained a model."
- Real drift math (KS-test + PSI) with defined thresholds, not just "we monitor accuracy."
- Fully automated retrain-on-drift loop closes the MLOps lifecycle end-to-end.
- CockroachDB + Kinesis + SQS combination shows you understand the difference between **streaming**, **queueing**, and **distributed SQL storage** — a common interview probe area (especially relevant for JPMC-style infra questions).