# Retail Ops Intelligence — Team Execution Plan (8 Phases / 4 Engineers)

**Sequential Execution Plan mapped from the Production-Grade MLOps Project Brief**

Prepared as a system architecture breakdown: 8 phases, executed sequentially in 4 pairs, one pair per team member. Each phase later in the sequence depends on the outputs of the phase(s) before it, so the order below is not arbitrary — it mirrors the real dependency chain of the system (data → model → serving → streaming/UI → intelligence layer → closed loop).

---

## Team & Ownership Map

| Member | Role | Phases Owned | Why This Split |
|---|---|---|---|
| **Apurv** | Group Lead / MLOps + CI/CD Engineer | Phase 1 & Phase 2 | Owns the highest-leverage, hardest-to-recover-from parts of the system: the ML core, the automated CI/CD gate, cloud monitoring, and the self-healing retraining loop. If these are wrong, nothing downstream can be trusted. |
| **Tanvi** | Backend Engineer | Phase 3 & Phase 4 | Owns model deployment (FastAPI + containerization + canary rollout) and the backend service layer (database schema, decision log, outcome API) that everything else reads/writes to. |
| **Josna** | Frontend + Streaming Engineer | Phase 5 & Phase 6 | Owns the real-time ingestion path (Kafka streaming) and the human-facing dashboard that visualizes predictions, drift, and alerts. |
| **Devyani** | Applied AI / Integration Engineer | Phase 7 & Phase 8 | Owns the agentic LLM explanation + action layer, and the final feedback-loop wiring, testing, and documentation that closes the whole system. |

**Sequential dependency:** Phase 1–2 (Apurv) must produce a working, versioned model before Phase 3–4 (Tanvi) can deploy it. Phase 3–4 must expose a live `/predict` endpoint and a database before Phase 5–6 (Josna) can stream data into it and visualize it. Phase 5–6 must have live predictions flowing before Phase 7–8 (Devyani) can explain and act on them, and close the feedback loop.

---

## PHASE 1 — ML Foundation & Core Training Pipeline
**Owner: Apurv (Group Lead, MLOps)**

### Goal
Stand up the data foundation and produce a versioned, evaluated, registry-approved model before any deployment work begins. This is the bedrock every other phase depends on.

### Tasks & Outcomes

| Task | Outcome |
|---|---|
| Lock the prediction target | Written decision doc: stockout risk per SKU, 7-day horizon, binary classification |
| Set up CockroachDB Serverless (free tier) | Live Postgres-compatible cluster with schema for `events`, `features`, `decision_log` |
| Download and stage Online Retail II dataset | Raw dataset stored in S3/Cloud Storage, versioned by date |
| Set up SQS + Lambda (or Pub/Sub + Cloud Function) ingestion | Working ingestion path: producer → queue → function → CockroachDB write |
| Build data validation layer | Great Expectations/Pandera suite that fails loudly on schema violations |
| Build feature engineering pipeline in BigQuery | Versioned feature table with rolling averages, velocity, seasonality columns |
| Train baseline Logistic Regression | Logged to MLflow with metrics (ROC-AUC, precision, recall) |
| Train primary LightGBM model | Logged to MLflow, beats baseline by a documented margin |
| Set up MLflow Model Registry with gating logic | Model only promotable to "staging" if it beats current production ROC-AUC by ≥0.5% |

### Implementation Prompt
```
You are an MLOps engineer building the foundational data and training pipeline for
"Retail Ops Intelligence," a stockout-risk prediction system.

Context: We are predicting whether a SKU will run out of stock within the next 7 days
(binary classification), using the UCI Online Retail II dataset as the primary source.

Build the following, in order:
1. A CockroachDB Serverless schema with three tables: `raw_events`, `engineered_features`
   (with a `feature_version` column), and `decision_log`. Provide the DDL.
2. A Python ingestion script that reads Online Retail II, simulates a live event stream,
   and pushes messages to an AWS SQS queue (or GCP Pub/Sub topic).
3. A Lambda/Cloud Function handler that consumes from the queue, does light validation/
   enrichment, and writes rows into CockroachDB. Include error handling and archive raw
   events to S3/Cloud Storage.
4. A data validation module using Pandera (or Great Expectations) that checks: no negative
   stock quantities, correct dtypes, no null invoice IDs. It should raise and halt the
   pipeline on failure, not silently continue.
5. A BigQuery SQL feature engineering script producing: 7/14/30-day rolling average sales,
   demand velocity (rate of change), and seasonality flags (day-of-week, month, holiday).
6. A training script that: trains a Logistic Regression baseline, then a LightGBM model,
   logs both to MLflow (params, metrics, artifacts), and registers the LightGBM model in
   MLflow Model Registry with a gating function that only promotes to "staging" if
   ROC-AUC improves by at least 0.5% over the current production model.

Output clean, commented, production-style Python code with a requirements.txt file.
```

---

## PHASE 2 — CI/CD, Cloud Monitoring & Self-Healing Pipeline
**Owner: Apurv (Group Lead, MLOps)**

### Goal
Automate everything from Phase 1 into a gated, observable, self-correcting system: no model reaches production without passing tests and metric gates, and the system detects its own decay and retrains without manual intervention.

### Tasks & Outcomes

| Task | Outcome |
|---|---|
| Write GitHub Actions lint/test stage | Runs on every push/PR: linting + unit tests on feature engineering functions |
| Add data validation stage to CI | Pandera/Great Expectations checks run against a sample dataset in CI |
| Add train/evaluate stage | Triggered on merge to main; logs to MLflow automatically |
| Add gate check stage | Pipeline halts if new model doesn't beat production model's metric |
| Add Docker build/push stage | Image tagged with model version, pushed to ECR/Artifact Registry |
| Add manual approval step | Human-in-the-loop gate before production promotion |
| Add canary deployment stage | Traffic-split deploy (10% → 100%) via Cloud Run/Lambda |
| Set up Evidently AI drift job | Scheduled job (Cloud Scheduler + Cloud Run, or EventBridge + Lambda) computing PSI/KL divergence |
| Wire drift detection to auto-retrain | Drift crossing threshold publishes to SNS/Pub-Sub, which triggers the training pipeline automatically |
| Build unified monitoring dashboard | One dashboard, three panels: service health, data drift score, model accuracy over time |
| Set up alerting | SNS or Cloud Monitoring Alerting Policies wired to email |

### Implementation Prompt
```
You are a DevOps/MLOps engineer setting up the CI/CD and self-healing monitoring system
for "Retail Ops Intelligence," an ML system already producing versioned models via MLflow
(from Phase 1).

Build the following, in order:
1. A GitHub Actions workflow (.github/workflows/ci-cd.yml) with these sequential jobs:
   a. lint-and-test: run flake8/black check + pytest on feature engineering unit tests
   b. data-validation: run the Pandera/Great Expectations suite against a sample dataset
   c. train-and-evaluate: run the training script from Phase 1, log to MLflow
   d. gate-check: a Python script that pulls the latest registered model's metric and the
      current production model's metric from MLflow, and fails the job (exit 1) if the
      new model does not beat production by >= 0.5% ROC-AUC
   e. build-and-push: only runs if gate-check passes; builds a Docker image tagged with
      the MLflow model version, pushes to ECR or Artifact Registry
   f. manual-approval: use a GitHub Actions "environment" with required reviewers
   g. deploy-canary: deploy to Cloud Run with `gcloud run deploy` using a 10% traffic split
      to the new revision, then a follow-up job that shifts to 100% after a health check
      window
2. A scheduled Evidently AI drift-detection job (as a Cloud Run job or Lambda function,
   triggered every 6 hours by Cloud Scheduler/EventBridge) that computes Population
   Stability Index between the training distribution and the last 6 hours of live traffic,
   and publishes an SNS/Pub-Sub message if drift exceeds a threshold (e.g., PSI > 0.2).
3. A Lambda/Cloud Function subscribed to that SNS/Pub-Sub topic that triggers the
   train-and-evaluate GitHub Actions workflow via the GitHub REST API (repository dispatch
   event) — this is the "self-healing" trigger, fully automatic, no human involved.
4. A Cloud Monitoring/CloudWatch dashboard definition (as Terraform or a JSON dashboard
   config) with exactly three panels: (1) service latency/error rate/uptime, (2) drift
   score over time, (3) model accuracy over time once feedback labels exist.
5. An alerting policy (Cloud Monitoring Alerting Policy or SNS topic + email subscription)
   that fires when drift crosses the threshold or error rate exceeds 5%.

Output all configs, workflow YAML, and Python scripts, fully commented, ready to run.
```

---

## PHASE 3 — Model Deployment & FastAPI Serving Backend
**Owner: Tanvi (Backend Engineer)**

### Goal
Take the approved model from Phase 1/2 and expose it as a real, containerized, health-checked, safely-rolled-out production service.

### Tasks & Outcomes

| Task | Outcome |
|---|---|
| Build FastAPI serving app | `/predict` (returns stockout probability + SHAP-style feature contribution) and `/health` endpoints |
| Load model from MLflow Registry at startup | App always serves the currently-approved production model, no hardcoded paths |
| Dockerize the serving app | Single Dockerfile, image tagged with model version |
| Push image to Artifact Registry / ECR | Versioned image, matches the CI/CD pipeline from Phase 2 |
| Deploy to Cloud Run (or App Runner/Lambda container) | Live HTTPS endpoint, autoscale-to-zero |
| Implement canary rollout | Traffic-split via Cloud Run native traffic splitting, 10% → 100% |
| Implement rollback capability | One-command traffic shift back to previous revision |

### Implementation Prompt
```
You are a backend engineer building the model-serving layer for "Retail Ops Intelligence."
A LightGBM model is already registered and versioned in MLflow Model Registry (from
Phase 1), and gated promotion is handled by CI/CD (from Phase 2). Your job is to serve it.

Build the following:
1. A FastAPI application with:
   - `GET /health` returning service status and currently loaded model version
   - `POST /predict` accepting a SKU's feature vector (JSON body) and returning:
     stockout probability, binary risk flag, and the top 3 contributing features
     (using SHAP values from the LightGBM model)
   - Model loading logic that pulls the current "production" stage model from the MLflow
     Model Registry at container startup (not hardcoded to a local file)
2. A Dockerfile that packages this FastAPI app, installs dependencies (fastapi, uvicorn,
   lightgbm, shap, mlflow), and exposes port 8080
3. A deployment script (bash) that:
   - Tags the Docker image with the MLflow model version
   - Pushes to Artifact Registry (or ECR)
   - Deploys to Cloud Run with `gcloud run deploy`, splitting traffic 90/10 between the
     current and new revision
   - Includes a second command to shift to 100% traffic after health checks pass, and a
     rollback command that reverts to the prior revision
4. Basic request/response logging middleware so every prediction gets written to the
   `decision_log` table in CockroachDB (host, timestamp, SKU, prediction, model version)
   for Tanvi's own Phase 4 backend to build on.

Output production-quality FastAPI code, Dockerfile, and deploy scripts.
```

---

## PHASE 4 — Backend Services, Database Layer & Decision Logging
**Owner: Tanvi (Backend Engineer)**

### Goal
Build the backend service layer that everything else (frontend, LLM agent, feedback loop) reads from and writes to — the decision log, the outcome API, and the action-trigger backend.

### Tasks & Outcomes

| Task | Outcome |
|---|---|
| Finalize CockroachDB schema | `decision_log`, `outcomes`, `actions_taken` tables with proper indexes |
| Build outcome logging API | Endpoint to record whether a predicted stockout actually happened (used by Phase 8) |
| Build action-trigger backend | SES integration for stockout alert emails, with rate limiting |
| Build a query API for the frontend | Endpoints for Josna's dashboard: recent predictions, drift status, alert history |
| Add authentication/API key layer | Basic API key auth so the frontend and internal services can call these endpoints safely |
| Write integration tests | Confirm ingestion → prediction → logging → outcome flow works end-to-end |

### Implementation Prompt
```
You are a backend engineer extending the FastAPI service from Phase 3 with the supporting
backend layer for "Retail Ops Intelligence."

Build the following:
1. Finalize CockroachDB schema (SQL DDL) for:
   - `decision_log` (id, sku, prediction_prob, risk_flag, model_version, timestamp)
   - `outcomes` (id, decision_log_id FK, actual_stockout_occurred boolean, recorded_at)
   - `actions_taken` (id, decision_log_id FK, action_type, sent_at, recipient)
2. New FastAPI endpoints:
   - `POST /outcomes` — records the ground truth for a past prediction (did the SKU
     actually go out of stock), used by the feedback loop in Phase 8
   - `POST /actions/alert` — triggers an AWS SES email alert for a high-risk SKU, with a
     rate limiter (max 1 alert per SKU per 24 hours) to avoid spam
   - `GET /dashboard/recent-predictions` — returns the last N predictions with risk scores,
     for the frontend to render
   - `GET /dashboard/drift-status` — returns the latest drift score from the monitoring
     job in Phase 2
   - `GET /dashboard/alerts` — returns alert history for the frontend
3. A simple API key authentication dependency (FastAPI Depends) applied to all endpoints,
   reading a valid key from an environment variable / secrets manager.
4. Integration tests (pytest + httpx) that simulate: an event flowing in -> a prediction
   being made -> a decision being logged -> an outcome being recorded -> confirm the full
   round trip persists correctly in CockroachDB.

Output complete FastAPI route code, SQL migrations, and the test suite.
```

---

## PHASE 5 — Real-Time Streaming & Kafka Ingestion Layer
**Owner: Josna (Frontend + Streaming Engineer)**

### Goal
Introduce a real-time, replayable event streaming layer using Kafka so the system can demo live, continuous retail events flowing in — feeding both the backend prediction path and the live dashboard.

### Tasks & Outcomes

| Task | Outcome |
|---|---|
| Stand up Kafka cluster | Local (Docker Compose) or managed free tier (Confluent Cloud/Redpanda) Kafka broker |
| Build Kafka producer | Simulates live retail transaction/inventory events from the dataset, publishing to a topic |
| Build Kafka consumer | Reads events, calls the `/predict` endpoint (Phase 3) for each SKU, and forwards results to a topic the dashboard subscribes to |
| Bridge Kafka to CockroachDB | Consumer also persists processed events, keeping backend and stream in sync |
| Add topic partitioning strategy | Partition by SKU/store ID so ordering per-entity is preserved at scale |
| Document the streaming architecture | Diagram + README explaining producer → topic → consumer → prediction → dashboard flow |

### Implementation Prompt
```
You are a streaming/data engineer adding a real-time Kafka layer to "Retail Ops
Intelligence." The system already has a working FastAPI /predict endpoint (Phase 3) and
a CockroachDB backend (Phase 4). Your job is to make the data flow feel live.

Build the following:
1. A docker-compose.yml that spins up a single-node Kafka broker (using Confluent's or
   Bitnami's Kafka image) plus Zookeeper (or KRaft mode if using a newer Kafka version),
   with two topics: `retail-events-raw` and `retail-predictions`.
2. A Python Kafka producer script that reads the Online Retail II dataset row by row (or
   from the synthetic simulator already built for the PIE project) and publishes each
   transaction/inventory event to `retail-events-raw`, with a configurable delay to
   simulate live traffic, partitioned by `stock_code`.
3. A Python Kafka consumer script that:
   - Subscribes to `retail-events-raw`
   - For each event, calls the FastAPI `/predict` endpoint with the engineered features
   - Publishes the prediction result (SKU, probability, risk flag, timestamp) to the
     `retail-predictions` topic
   - Also writes the same result into the `decision_log` table in CockroachDB
4. A short architecture README (markdown) with a text/mermaid diagram showing:
   Producer -> retail-events-raw topic -> Consumer -> FastAPI /predict -> 
   retail-predictions topic -> Dashboard (WebSocket/polling)
   and explain the partitioning-by-SKU choice and why it preserves per-SKU ordering.

Output the docker-compose file, both Python scripts, and the README with diagram.
```

---

## PHASE 6 — Frontend Dashboard Development
**Owner: Josna (Frontend + Streaming Engineer)**

### Goal
Give humans a real interface into the system: live predictions, drift status, and alert history, consuming the backend APIs (Phase 4) and the streaming predictions (Phase 5).

### Tasks & Outcomes

| Task | Outcome |
|---|---|
| Build dashboard shell (React) | Layout with navigation: Overview, Predictions, Drift & Monitoring, Alerts |
| Build live predictions view | Table/list of recent SKU risk predictions, updating in near real-time (polling or WebSocket off the `retail-predictions` topic) |
| Build monitoring panel | Renders drift score and model accuracy trend, pulling from `GET /dashboard/drift-status` |
| Build alerts panel | Shows alert history from `GET /dashboard/alerts` |
| Add SKU detail view | Click into a SKU to see feature contribution explanation (from `/predict` SHAP output) |
| Polish UI/UX | Consistent design system, loading states, empty states, responsive layout |

### Implementation Prompt
```
You are a frontend engineer building the dashboard for "Retail Ops Intelligence." Backend
APIs already exist (Phase 4): GET /dashboard/recent-predictions, GET /dashboard/drift-status,
GET /dashboard/alerts. A Kafka-backed prediction stream also exists (Phase 5).

Build a React (with Tailwind) single-page dashboard with:
1. A navigation shell with four sections: Overview, Live Predictions, Monitoring, Alerts.
2. Overview: summary cards showing total SKUs at risk today, current model version,
   current drift score, and total alerts sent this week.
3. Live Predictions: a table of recent SKU predictions (SKU, risk probability, risk flag,
   timestamp) that refreshes every few seconds via polling GET /dashboard/recent-predictions
   (or a WebSocket bridge if one is exposed over the retail-predictions Kafka topic).
   Clicking a row expands to show the top contributing features for that prediction
   (bar chart of SHAP values).
4. Monitoring: a line chart of drift score over time and a line chart of model accuracy
   over time, both pulled from GET /dashboard/drift-status, using recharts.
5. Alerts: a list of past stockout alerts sent (SKU, recipient, sent_at) from
   GET /dashboard/alerts.
6. Sensible loading skeletons and empty states for all four views, and a clean, consistent
   visual style (dark/light neutral palette, card-based layout).

Output a single-file or component-organized React app with clear API integration code.
```

---

## PHASE 7 — LLM Agent Explanation Layer & Automated Action Triggering
**Owner: Devyani (Applied AI / Integration Engineer)**

### Goal
Add the reasoning layer that turns a raw prediction score into a plain-English explanation and an automated action — the "agentic" piece that makes this more than a dashboard.

### Tasks & Outcomes

| Task | Outcome |
|---|---|
| Build the LLM explanation agent | Given a prediction + features + historical context, generates a plain-English risk explanation |
| Add vector memory for historical context | Store past similar SKU incidents (embeddings) so the agent can reference precedent |
| Build the decision logic layer | Agent decides whether the risk level warrants triggering an action (alert/reorder) |
| Wire agent to the action-trigger backend | Calls `POST /actions/alert` (Phase 4) when a decision is made |
| Add rate limiting / guardrails | Prevent the agent from spamming alerts or acting on noisy/borderline predictions |
| Log every agent decision | Full trace of prediction → explanation → decision → action stored for auditability |

### Implementation Prompt
```
You are an applied AI engineer building the agentic explanation and action layer for
"Retail Ops Intelligence." A FastAPI /predict endpoint (Phase 3) returns stockout
probability and top contributing features. A backend action endpoint POST /actions/alert
(Phase 4) already exists to send stockout alert emails via SES.

Build the following:
1. A vector store (e.g., ChromaDB or FAISS) populated with embeddings of past
   prediction+outcome pairs (SKU, features summary, what happened), so the agent can
   retrieve similar historical incidents as context.
2. An LLM agent function that, given a new prediction (SKU, probability, top features),
   does the following:
   a. Retrieves the 3 most similar historical incidents from the vector store
   b. Generates a plain-English explanation of WHY this SKU is at risk, referencing the
      specific contributing features (e.g., demand velocity, restock lead time) and any
      relevant historical precedent
   c. Makes a decision: if probability exceeds a threshold (e.g., 0.7) AND there isn't
      already a recent alert for this SKU, decide to trigger an action
3. If the agent decides to act, it calls POST /actions/alert with the SKU, explanation
   text, and probability, letting the backend's existing rate limiter handle spam
   prevention.
4. A full audit logging function that records: input prediction, retrieved context,
   generated explanation, the decision made, and the action taken (or not), all written
   to a new `agent_decisions` table in CockroachDB for traceability.
5. Guardrail logic: the agent should refuse to act (return "no action needed") if the
   probability is between 0.4-0.7 (ambiguous zone) and instead flag it for human review
   in the dashboard, rather than auto-acting on borderline cases.

Output the agent code (Python), vector store setup script, and the CockroachDB migration
for the agent_decisions table.
```

---

## PHASE 8 — Feedback Loop, Retraining Integration, Testing & Documentation
**Owner: Devyani (Applied AI / Integration Engineer)**

### Goal
Close the loop end-to-end: outcomes become new training labels, confirm the whole system self-heals as designed, and leave the project fully tested and documented for demo/interview use.

### Tasks & Outcomes

| Task | Outcome |
|---|---|
| Build outcome-checking job | Scheduled job that checks, 7 days after a prediction, whether the SKU actually went out of stock |
| Wire outcomes into the feature/training table | Outcome writes back as a new labeled row via `POST /outcomes` (Phase 4) |
| Confirm retraining picks up feedback data | Verify Phase 1/2's training pipeline includes this new labeled data on next scheduled run |
| End-to-end system test | Full walkthrough: event → prediction → explanation → action → outcome → retrain, verified live |
| Write system documentation | Architecture diagram, README, and a "how this demos in an interview" one-pager |
| Prepare demo script | Step-by-step script to run a live demo showing prediction, drift, and self-healing in action |

### Implementation Prompt
```
You are the integration engineer responsible for closing the feedback loop and finalizing
"Retail Ops Intelligence" for demo and interview presentation. All other phases (ML core,
CI/CD, deployment, streaming, frontend, agent layer) are already built.

Build the following:
1. A scheduled job (Cloud Scheduler + Cloud Run job, or EventBridge + Lambda) that runs
   daily, queries the `decision_log` table for predictions made exactly 7 days ago, checks
   the actual inventory data for that SKU (from the CockroachDB events table) to determine
   if a stockout genuinely occurred, and calls POST /outcomes with the ground truth result.
2. Confirm the feature engineering job (Phase 1) includes a step that joins the `outcomes`
   table back into the training feature set as a new labeled example on every scheduled
   retraining run — write a small validation script that asserts the training dataset row
   count increases as new outcomes come in.
3. An end-to-end integration test script that:
   a. Publishes a synthetic high-risk event via the Kafka producer (Phase 5)
   b. Confirms a prediction appears in decision_log within N seconds
   c. Confirms the agent (Phase 7) generates an explanation and triggers an alert email
   d. Simulates the 7-day outcome check firing early (via a test flag) and confirms the
      outcome is written and appears in the next training data pull
4. A project README.md covering: system architecture diagram (mermaid), the two loops
   (ML core loop and agentic action loop), how self-healing works (drift-triggered and
   outcome-triggered retraining), and setup instructions for each phase's components.
5. A one-page "interview demo script" (markdown) — a scripted walkthrough: what to show
   first (dashboard), what to click next (a live prediction), what to explain (the drift
   panel and self-healing trigger), and how to tie it back to the four MLOps pillars
   (pipeline, deployment, monitoring, CI/CD) in under 5 minutes.

Output the scheduled job code, the validation script, the integration test, the README
with mermaid diagram, and the demo script.
```

---

## Sequential Handoff Summary

```
Apurv (Phase 1: Data + Training) 
   → Apurv (Phase 2: CI/CD + Monitoring + Self-Healing)
      → Tanvi (Phase 3: FastAPI Serving + Deployment)
         → Tanvi (Phase 4: Backend Services + Decision Log)
            → Josna (Phase 5: Kafka Streaming Layer)
               → Josna (Phase 6: Frontend Dashboard)
                  → Devyani (Phase 7: LLM Agent + Action Layer)
                     → Devyani (Phase 8: Feedback Loop + Testing + Docs)
```

Each arrow is a hard dependency, not just a suggested order — a later phase genuinely cannot be built (or tested meaningfully) until the phase before it has a working output. This also makes standups simple: at any point, the "blocking" phase and the "blocked" phase are always obvious from this chain.