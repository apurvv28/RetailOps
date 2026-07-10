# Retail Ops Intelligence — Production Grade MLOps Project Plan

**A Self Healing, Closed Loop ML System for Predicting and Acting on Retail Operational Risk**

---

## 1. Detailed Project Overview

Retail Ops Intelligence is a system that watches retail data continuously (orders, inventory, transactions), predicts operational risk before it happens (stockouts, demand spikes, anomalies), explains that prediction in plain English using an LLM, and then takes an action automatically (send an alert, trigger a reorder flow). The system then checks whether that action was actually correct, and feeds that result back in as new training data. This means the model keeps improving on its own over time, without a human manually re-labeling everything.

Bhai, samajhne ke liye simple analogy le lo: normal dashboard tumhe batata hai "kal 50 units bik gaye." Yeh system tumhe batayega "agle 7 din mein yeh SKU stockout hone wala hai, isiliye kyunki demand velocity 2.3x badh gayi hai aur restock lead time 5 din hai, isliye abhi reorder trigger kar do." Aur agar system galat predict karta hai, toh woh khud seekh ke agli baar better predict karega.

The reason this is a strong project for placements (JPMC / Google style interviews) is because it is not "one LLM call wrapped in a UI." It has all four pillars that interviewers actually probe on:

1. A real ML pipeline (data → features → training → registry → serving)
2. A real deployment (containerized, versioned, health-checked)
3. Real monitoring (drift detection, dashboards, alerting)
4. Real CI/CD (automated testing, gated promotion, rollback)

---

## 2. Problem Statement — What Are We Actually Solving

Retail and e-commerce businesses generate a constant stream of transactional data (orders placed, inventory levels changing, items being returned or cancelled). Most companies only look at this data *after* something bad has already happened:

- A product goes out of stock and customers can't buy it (lost revenue)
- Excess inventory piles up because nobody predicted a demand drop (holding cost)
- A weird order pattern turns out to be fraud, but only noticed during a manual audit weeks later

The core problem has three separate parts, and most systems only solve one of them:

| Gap | What's Missing Today | What We Build |
|---|---|---|
| **Prediction** | Dashboards show past data, not future risk | A model that forecasts risk 7 days ahead |
| **Explanation** | Raw model scores (like "0.83") mean nothing to a store manager | An LLM layer that translates score into plain language reasoning |
| **Action** | Even if predicted, nobody acts on it in time | An automated action (alert/reorder) with a feedback loop that checks if the action was right |

Simple Hinglish version: Problem yeh hai ki companies ke paas data toh bahut hai, lekin woh reactive hain, proactive nahi. Hum ek system bana rahe hain jo future dekh ke pehle hi bata de, phir samjha de kyun, phir khud action bhi le le, aur phir apni galtiyon se seekh bhi le.

---

## 3. How We Will Solve It — High Level Approach

We break the system into two loops that connect to each other:

**Loop 1: The ML Core (prediction lifecycle)**
Raw events → cleaned structured data → engineered features → trained model → versioned and approved model → deployed model serving live predictions → drift monitoring on that live model → automatic retraining trigger when drift is detected.

**Loop 2: The Agentic Action Layer (reasoning and feedback lifecycle)**
Model prediction → LLM agent explains it using historical context (vector memory) → agent decides to trigger an action (send email alert) → outcome of that action is logged → outcome becomes a new labeled data point → that label flows back into Loop 1 for the next training cycle.

The connecting piece between both loops is what makes this "self healing" rather than a one time project. We'll cover exactly how in Section 8.

---

## 4. Prediction Target (Decide This First)

The single most important decision, because everything else (features, metrics, datasets, models) depends on it.

**Recommended default target: Stockout risk per SKU within the next 7 days** (binary classification: will this SKU run out of stock in the next 7 days, yes or no, with a probability score).

Why this target over alternatives:
- Clean, well understood public datasets exist to bootstrap it (see Section 5)
- Binary/probabilistic classification is easier to evaluate with standard metrics (ROC-AUC, precision/recall) which you already have strong experience with from your PIE project
- Business value is obvious and easy to explain in an interview: "we prevent lost sales by predicting stockouts before they happen"

**Alternative targets (can be added later using the same pipeline skeleton):**
- Demand forecasting (regression — predicting exact units sold next week)
- Order/transaction anomaly detection (unsupervised — flagging suspicious orders)

Agar time kam hai toh sirf stockout risk pe focus karo. Demand forecasting aur anomaly detection baad mein "Phase 2 roadmap" ke tarah pitch kar sakte ho, jaise tumne DevForge ke Phase 3.5 plan mein kiya tha.

---

## 5. Best Datasets for This Problem

Since real retail transaction data is hard to get, we bootstrap with public datasets that closely mimic real retail behavior.

| Dataset | Why It Fits | What You'll Use It For |
|---|---|---|
| **Online Retail II (UCI)** | Real UK based e-commerce transactions, includes invoice, stock code, quantity, date, customer country. Has enough time series depth to build velocity/seasonality features | Primary dataset for stockout risk features and baseline training |
| **Instacart Market Basket Analysis (Kaggle)** | Extremely rich order-level data with reorder patterns, product department hierarchy, order timing | Great for demand velocity features and reorder probability signals |
| **M5 Forecasting (Walmart, Kaggle)** | Large scale, hierarchical sales data across stores/products with actual stockout events (zero sales days) labeled implicitly | Best for validating your stockout label logic and testing at scale |
| **Retail Rocket / RetailRocket eCommerce dataset (Kaggle)** | Clickstream + transaction events, useful if you want to add anomaly/fraud detection as an extra model target later | Optional, for Phase 2 anomaly detection extension |
| **Synthetic Indian banking/retail stream (your own simulator)** | You already built a synthetic transaction stream simulator for PIE. Reuse and adapt that pattern here | Use to simulate the "live" Kinesis-style stream feeding into your pipeline during demos |

Practical tip: start with Online Retail II for the baseline model (clean, small, fast to iterate on), then layer in M5 or Instacart once your pipeline skeleton is working, to show it scales to messier, larger data.

---

## 6. Recommended Models

Match model complexity to the size and shape of your data. Don't jump to deep learning first, start simple and justify complexity with numbers (this is exactly what strong MLOps candidates get asked about in interviews: "why did you choose this model over a simpler one?").

| Stage | Model | Why |
|---|---|---|
| **Baseline** | Logistic Regression | Fast, interpretable, gives you a sanity check number before anything fancier. Always train this first so you can prove your fancier model is actually earning its complexity |
| **Primary model** | LightGBM or XGBoost | Handles tabular data with mixed feature types very well, trains fast, gives you feature importance out of the box, and you already have strong hands-on experience with these from PIE (ROC-AUC 0.95+). This should be your main production model |
| **Time aware option** | LightGBM with lag/rolling window features (not a separate architecture, just smarter feature engineering) | Stockout risk is fundamentally time series shaped, so instead of jumping to LSTM/Transformer, first squeeze time signal into LightGBM via rolling averages, velocity, and seasonality features. Simpler to deploy and monitor |
| **If you want a deep learning story for interviews** | A small Temporal Fusion Transformer or even a basic LSTM, trained only as a "Phase 2 comparison model" | Use this to demonstrate you know when NOT to reach for deep learning too. Comparing LightGBM vs a small TFT and showing LightGBM wins on this data size is a very strong interview talking point |

Bhai, recommendation seedhi baat: LightGBM ko primary model banao, wahi production mein jayega. Deep learning wala part sirf "I also benchmarked this" ke liye rakho, taaki tumhara story yeh bane ki tumne sochke, data ke size aur latency requirement dekh ke, simpler model choose kiya, na ki bina soche neural network laga diya.

---

## 7. Pipeline Configuration Plan

Since you're fine using AWS or GCP as long as it's free tier, this plan now uses cloud managed services wherever they genuinely make the implementation easier or more "production real," and keeps open source tools only where the cloud alternative would either cost money at real usage or add setup complexity for no real benefit. Here's the decision logic first, then the stage by stage plan.

**Cloud vs Open Source Decision Table**

| Component | Open Source Option | AWS Free Tier Option | GCP Free Tier Option | What We're Using and Why |
|---|---|---|---|---|
| Event ingestion | Custom queue (Redis/RabbitMQ self hosted) | SQS (1 million requests/month, always free) + Lambda (1M invocations/month, always free) | Pub/Sub (10GB/month, always free) | **AWS SQS + Lambda.** Both free tiers here are "always free," not a 12 month trial, so this is safe to leave running for the whole project without worrying about a surprise bill later |
| Raw event archive | Local disk / MinIO | S3 (5GB free for 12 months) | Cloud Storage (5GB always free in specific regions) | **S3.** Simple, standard, and instantly recognizable on a resume |
| Structured store (events, features, decision log) | Self hosted Postgres | RDS free tier (limited, 12 months only) | Cloud SQL (no permanent free tier) | **Keep CockroachDB Serverless free tier.** This one stays because CockroachDB's free tier (5GB, always free) genuinely beats AWS RDS and Cloud SQL's free tier for a long running student project, and it's Postgres compatible so nothing else changes |
| Feature engineering / aggregation | Pandas jobs on a VM | Glue (has free tier hours but fiddly to set up) | **BigQuery** (1TB of free queries every month, always free, no infra to manage) | **BigQuery.** Genuinely easier than Spark/Glue for a student, you just write SQL, and the free tier is generous enough you'll never come close to hitting it |
| Experiment tracking and registry | MLflow (self hosted) | SageMaker Training/Registry (free tier hours exist but real training jobs burn through them fast) | Vertex AI (free trial credits only, not a permanent free tier) | **Keep MLflow.** This is the one place cloud free tiers genuinely fall short, since continuous model training on SageMaker/Vertex AI will exceed free allowances quickly. MLflow stays as the honest, cost-safe choice |
| Model serving/deployment | Docker on a self managed VM | Lambda container images (free tier, but cold starts and size limits can be annoying) | **Cloud Run** (2 million requests/month, always free, serverless containers, autoscale to zero) | **Cloud Run.** A clear upgrade over a self managed VM or Kubernetes cluster: no servers to patch, scales to zero when idle (genuinely free when not being demoed), and deploying is a single `gcloud run deploy` command |
| Container registry | Self hosted registry | ECR (500MB free storage, always free) | Artifact Registry (0.5GB free) | **ECR or Artifact Registry**, whichever matches your serving choice, both are genuinely free at this project's scale |
| Monitoring (service health) | Self hosted Prometheus + Grafana | CloudWatch (free tier includes basic metrics + alarms) | **Cloud Monitoring** (free tier covers standard metrics, uptime checks, and alerting policies) | **Cloud Monitoring (if using Cloud Run) or CloudWatch (if using AWS serving).** Native cloud monitoring means zero infrastructure maintenance, versus self hosting Grafana which is one more thing that can break mid demo |
| Drift detection logic | Evidently AI (still the right choice, it's a library not infra) | No direct AWS equivalent at this scale | No direct GCP equivalent at this scale | **Keep Evidently AI.** This isn't really an open source vs cloud tradeoff, it's a Python library that computes drift math, so there's no cloud service to swap it for |
| Alerting | Slack/email webhook script | SNS (free tier, always free, 1 million publishes/month) | Cloud Monitoring Alerting Policies (free tier) | **SNS or Cloud Monitoring Alerting**, wired to email, matching whichever cloud you pick for serving |
| Action emails (stockout alerts) | Any SMTP library | **SES** (free tier: 3,000 emails/month always free, more if sent from within AWS) | No direct equivalent as clean as SES | **SES.** An easy win regardless of which cloud you pick for the rest, cheap, reliable, and a recognizable AWS service name |

Practical note: you don't have to mix AWS and GCP together. Pick one cloud as your primary (either works fine), and only cross over for a specific service if that cloud's free tier is clearly weaker there (like using AWS SES for email even if GCP is your primary, since GCP has no clean equivalent). Mixing is fine technically, but leaning mostly on one cloud makes your resume story cleaner in an interview: "I built this on GCP using Pub/Sub, BigQuery, and Cloud Run, with AWS SES for transactional email since GCP doesn't have a direct equivalent."

### Stage 1: Data Ingestion
- Producer script (or FastAPI endpoint) simulating live retail events pushes messages into SQS (AWS) or Pub/Sub (GCP), both genuinely always-free at this scale
- A Lambda function (AWS) or Cloud Function (GCP) picks up each message, does light transformation/enrichment, and writes it into CockroachDB
- Raw events also get archived to S3 or Cloud Storage, so you can always replay history if something breaks

### Stage 2: Data Validation
- Before any training run, validate schema (correct columns, correct types, no impossible values like negative stock)
- Use a library like Great Expectations or even simple Pandera schema checks
- This step fails loudly and stops the pipeline if data quality is broken, rather than silently training on garbage

### Stage 3: Feature Engineering
- Rolling aggregates (average daily sales over last 7/14/30 days)
- Velocity features (is demand accelerating or decelerating)
- Seasonality features (day of week, month, holiday flag)
- Run the heavier aggregation queries in BigQuery (free tier, no infra to manage, just SQL) instead of a self managed Spark/Glue job, this is genuinely simpler for a student project and still looks production grade on a resume
- Store the final engineered features back in a versioned feature table (CockroachDB table, with a feature version column, so you can always trace which feature definition produced which model)

### Stage 4: Experiment Tracking and Training
- Use MLflow (free, you already used it in PatternSense) to track every training run: parameters, metrics, artifacts
- Train baseline (Logistic Regression) then primary (LightGBM), log both to MLflow so comparison is easy
- Training itself can run on a small free tier compute instance (EC2 t2.micro or a Cloud Run job), MLflow just needs somewhere to log to, it doesn't need to be the training compute itself

### Stage 5: Model Registry and Gating
- Promote a model to "staging" only if it beats the current production model on held out validation data by an agreed margin (say, ROC-AUC improvement of at least 0.5%)
- Use MLflow Model Registry for this versioning and approval gating, this stays the same regardless of which cloud you deploy to, since SageMaker/Vertex AI registries only make sense if you're also training on those platforms

### Stage 6: Deployment
- Package the approved model inside a FastAPI service, containerized with Docker
- Deploy to Cloud Run (recommended, serverless and scales to zero) or a Lambda container image if you want to stay fully AWS
- Details in Section 9

### Stage 7: Monitoring
- Covered fully in Section 10

### Stage 8: Feedback Loop and Retraining Trigger
- Covered fully in Section 8

---

## 8. How This Becomes Self Healing

"Self healing" here means two different things, and both matter:

**A. Data drift self healing (the model notices the world has changed)**

We continuously compare the statistical distribution of live incoming data against the distribution the model was trained on. If a meaningful shift happens (say, average order quantity jumps because of a big sale event), a drift score crosses a threshold, and this automatically kicks off a retraining job. No human needs to notice it manually and file a ticket.

Practical tool: Evidently AI (free, open source) computes drift metrics (like Population Stability Index or KL divergence) on a schedule. Run this on a Cloud Scheduler + Cloud Run job (GCP) or an EventBridge scheduled rule + Lambda (AWS), both free tier and both mean you're not manually running a cron job on a VM somewhere. When drift crosses your set threshold, the job publishes to SNS (AWS) or triggers a Pub/Sub message (GCP), which kicks off the retraining pipeline.

**B. Outcome based self healing (the model learns from its own mistakes)**

Every time the system triggers an action (sends a stockout alert), we don't just fire and forget. We log:
- What was predicted
- What action was taken
- What actually happened afterward (did the SKU actually go out of stock, yes or no)

This outcome becomes a new labeled training example. Over time, this closes the loop: the model isn't just retrained on fresh data, it's retrained on the corrected results of its own past predictions. This is the part that separates "self healing" from just "scheduled retraining."

Hinglish mein samjho: Pehla part hai jab data ka nature badal jaye (jaise Diwali sale ke time demand pattern alag ho jata hai), system khud detect karke retrain kar leta hai. Doosra part hai jab model khud galat predict kare, toh system uss galti ko bhi record karke agli training mein use karta hai, taaki wahi galti dobara na ho. Yeh dono milke system ko genuinely "self healing" banate hain, sirf ek buzzword nahi.

**Concrete self healing flow:**
```
Live traffic → Drift check (every 6 hrs) → Drift found? → Yes → Trigger retraining pipeline
                                                    ↓ No
                                             Keep serving current model

Action taken → Outcome logged (after 7 days) → New labeled row → Added to training set
                                                                  ↓
                                                    Next scheduled retrain includes it
```

---

## 9. Deployment Plan

Keep this realistic and student budget friendly, not a full SageMaker or Vertex AI bill. Since you're okay using cloud free tier, the recommendation changes from "self managed VM or K8s" to a managed serverless container platform, because it's genuinely less setup work and stays free at student-project traffic levels.

1. **Containerize** the FastAPI model server with Docker (single Dockerfile, model artifact loaded from MLflow registry at startup)
2. **Version everything**: image tag matches model version, so you can always trace which container is running which model
3. **Deploy**, options in order of recommendation:
   - **Recommended: Cloud Run (GCP)**. Push the image to Artifact Registry, deploy with `gcloud run deploy`, and Cloud Run handles autoscaling, HTTPS, and scaling to zero automatically. Free tier covers 2 million requests a month, which is far more than a student demo will ever use, and it never sits idle burning free tier hours since it literally scales to zero when nobody's calling it
   - **AWS equivalent: Lambda container images or App Runner**. Works too, slightly more fiddly with cold starts and image size limits than Cloud Run, but a fine option if you want to stay fully within AWS for your resume story
   - **Skip self managed Kubernetes** unless a specific target company is known to be heavily K8s-focused and you want that on your resume specifically. For most placement purposes, a managed serverless deploy is actually the more "senior engineer" choice, since it shows you know not to over-engineer infra you don't need to run yourself
4. **Blue-green or canary style rollout**: Cloud Run natively supports traffic splitting between revisions (e.g., 90% old revision, 10% new revision) with a single command, so canary rollout doesn't need any custom infra, it's a built-in feature. This is a strong interview point: "I did a gated rollout using Cloud Run's native traffic splitting, not a custom script"
5. **Rollback plan**: keep the previous revision available (Cloud Run keeps old revisions by default), so if the new model underperforms, rollback is shifting traffic back to the previous revision in one command

---

## 10. Monitoring Plan — What Gets Watched and How

| What to Monitor | Tool | Why |
|---|---|---|
| **Data drift** (are incoming features statistically different from training data) | Evidently AI, run as a scheduled Cloud Run job or Lambda | Root cause detector for silent model decay, and running it as a managed scheduled job means no server to babysit |
| **Prediction drift** (is the model suddenly predicting very differently than before) | Evidently AI or custom stats check, results pushed as custom metrics to Cloud Monitoring (GCP) or CloudWatch (AWS) | Confirms whether drift is actually affecting output, not just input, and keeping it in the same monitoring dashboard as service health avoids juggling two separate tools |
| **Model performance metrics** (precision, recall, ROC-AUC on labeled feedback once outcomes come in) | Custom script pushing metrics to Cloud Monitoring / CloudWatch as custom metrics | Ground truth check, since drift alone doesn't prove the model is wrong |
| **Service health** (latency, uptime, error rate of the serving endpoint) | Cloud Monitoring (if deployed on Cloud Run) or CloudWatch (if deployed on AWS), both come with the deployment automatically | Zero extra setup, since Cloud Run and Lambda both auto-report these metrics out of the box, no need to self host Prometheus + Grafana and worry about that stack breaking mid-demo |
| **Unified dashboard** | Cloud Monitoring dashboard (GCP) or CloudWatch Dashboard (AWS), OR Grafana Cloud free tier if you want nicer visuals pulling from the same metrics | Native cloud dashboards are the zero-maintenance choice. If you specifically want the polished Grafana look for a demo, Grafana Cloud's free tier can pull from Cloud Monitoring/CloudWatch as a data source without you self hosting the Grafana server itself |
| **Alerting** | SNS (AWS) or Cloud Monitoring Alerting Policies (GCP), wired to email | So a human is notified the moment something crosses threshold, not just silently logged, and this ships as part of the same free tier as the rest of monitoring |

Build one dashboard with three panels: system health (latency/uptime), data drift score over time, and model accuracy over time (once feedback labels start coming in). Whether you build this natively in Cloud Monitoring/CloudWatch or pull it into Grafana Cloud's free tier, this single dashboard is what you'd actually show in an interview or a demo, so keep it clean and to those three panels.

---

## 11. CI/CD Pipeline — Which Type and Why

**Recommended: GitHub Actions, structured as a multi-stage pipeline with a manual approval gate before production deployment.**

Why GitHub Actions specifically over Jenkins here:
- Free for public/student repos, no infrastructure to maintain (you don't need a Jenkins server running somewhere)
- You already have strong hands on experience debugging GitHub Actions (your DevForge semantic-release pipeline work), so this plays to your strength directly in interviews
- Native integration with GitHub, so code review, tests, and deployment all live in one place

**Pipeline stages, in order:**

1. **Lint and unit test** (on every push/PR): code style checks, unit tests on feature engineering functions, schema validation tests
2. **Data validation test**: run the Great Expectations/Pandera checks against a sample dataset to make sure the pipeline logic itself hasn't broken
3. **Train and evaluate** (triggered on merge to main, or on a schedule, or on drift webhook): runs the training job, logs to MLflow, evaluates against the held out set
4. **Gate check**: pipeline compares new model's metric against current production model's metric. If it doesn't beat the threshold, pipeline stops here, no promotion happens
5. **Build and push Docker image**: only runs if gate check passes, image gets pushed to Artifact Registry (GCP) or ECR (AWS), both free tier at this project's scale
6. **Manual approval step**: a human (you, acting as the "senior engineer" reviewer) approves the promotion to production, this is your human-in-the-loop safety net
7. **Deploy**: `gcloud run deploy` (or the AWS equivalent) with traffic split, sending a small percentage to the new revision first, health check via Cloud Monitoring/CloudWatch, then full traffic shift once healthy
8. **Post deploy monitoring hook**: pipeline tags the new model version in the monitoring dashboard automatically (Cloud Monitoring/CloudWatch or Grafana Cloud if you're using that as your visual layer), so tracking starts immediately without a manual step

Why this structure is efficient: it separates "can this code run" (stage 1-2) from "is this model actually better" (stage 3-4) from "is this safe to ship" (stage 5-7). Most junior projects skip straight from training to deployment with no gate, which is exactly the mistake this pipeline avoids.

Simple Hinglish version: Har code push pe pehle basic tests chalenge. Phir naya model train hoga aur purane model se compare hoga. Agar naya model better nahi hai, toh pipeline wahin ruk jayega, production mein kuch nahi jayega. Agar better hai, toh Docker image banegi, ek insaan (tum) approve karoge, aur tab jaake dheere dheere (canary) production mein rollout hoga. Yeh poora process automated hai, bas final approval insaan ke haath mein hai, taaki galti se kuch bura model production mein na chala jaye.

---

## 12. Releasing the ML Model to Production — Step by Step

1. Model passes evaluation gate in CI/CD (Section 11, stage 4)
2. Model is registered and marked "staging" in MLflow Registry
3. Docker image built with this specific model version baked in, tagged clearly (e.g., `retail-ops-model:v1.4.0`), pushed to Artifact Registry or ECR
4. Manual approval given (human-in-the-loop, this is your governance checkpoint)
5. Canary deployment: deploy as a new Cloud Run revision, split traffic so it handles roughly 10% of live prediction requests (a single `gcloud run services update-traffic` command, no custom load balancer needed)
6. Automated health check window (say 30 minutes to a few hours): latency, error rate, and prediction distribution are watched via Cloud Monitoring/CloudWatch
7. If canary looks healthy, traffic is shifted to 100% on the new revision, old revision stays available (Cloud Run keeps it by default, for instant rollback)
8. Model is marked "production" in the MLflow Registry, old version marked "archived"
9. Monitoring dashboard automatically starts tracking the new production model's live metrics
10. If anything goes wrong post full rollout, rollback is a single command: shift traffic back to the previous Cloud Run revision

---

## 13. What Needs to Be Done — Checklist by Phase

**Phase 1: Foundation**
- [ ] Lock prediction target (stockout risk, 7 day horizon)
- [ ] Pick and download primary dataset (Online Retail II)
- [ ] Set up CockroachDB free tier cluster, design schema (events, features, decision log)
- [ ] Set up MLflow tracking server (can run locally or on a free tier compute instance)
- [ ] Pick your primary cloud (AWS or GCP) and set up the free tier account/billing alerts so you get notified if anything is about to exceed free tier

**Phase 2: ML Core**
- [ ] Set up SQS + Lambda (AWS) or Pub/Sub + Cloud Functions (GCP) for ingestion
- [ ] Build data validation checks (Great Expectations/Pandera)
- [ ] Build feature engineering queries in BigQuery (or Pandas job if you skip BigQuery)
- [ ] Train baseline Logistic Regression, log to MLflow
- [ ] Train primary LightGBM model, compare against baseline
- [ ] Set up MLflow Model Registry gating logic

**Phase 3: Deployment**
- [ ] Build FastAPI serving app with `/predict` and `/health` endpoints
- [ ] Dockerize the serving app
- [ ] Push image to Artifact Registry (GCP) or ECR (AWS)
- [ ] Deploy to Cloud Run (recommended) or Lambda container/App Runner
- [ ] Implement canary rollout using Cloud Run traffic splitting (or equivalent)

**Phase 4: Monitoring**
- [ ] Set up Evidently AI drift job as a scheduled Cloud Run job or Lambda
- [ ] Push drift and accuracy metrics into Cloud Monitoring or CloudWatch as custom metrics
- [ ] Build the unified dashboard (native cloud dashboard, or Grafana Cloud free tier pulling from it)
- [ ] Set up alerting via SNS or Cloud Monitoring Alerting Policies, wired to email

**Phase 5: CI/CD**
- [ ] Write GitHub Actions workflow: lint/test stage
- [ ] Add train/evaluate stage with MLflow logging
- [ ] Add gate check stage (compare metrics)
- [ ] Add Docker build/push stage (to Artifact Registry/ECR)
- [ ] Add manual approval step
- [ ] Add deployment stage with Cloud Run traffic-split canary logic

**Phase 6: Closing the Loop**
- [ ] Build the Bedrock/LLM agent explanation layer on top of predictions
- [ ] Build the action trigger using SES (works well regardless of primary cloud) with rate limiting
- [ ] Build outcome logging (did the predicted stockout actually happen)
- [ ] Wire outcome data back into the feature table as new labels
- [ ] Confirm retraining pipeline picks up this feedback data automatically

---

## 14. Final Note

This version of the plan deliberately mixes managed cloud services (SQS/Pub-Sub, BigQuery, Cloud Run, Cloud Monitoring/CloudWatch, SES) with a couple of open source tools (MLflow, Evidently AI) that stay because they're genuinely the safer or easier choice at student-project scale, not because of a blanket "avoid cloud" rule. The logic behind each choice, in one line: use the managed cloud service when it removes real infrastructure work and its free tier is generous enough to never worry about (ingestion, feature aggregation, deployment, monitoring), and keep the open source tool when the cloud equivalent would either cost real money under continuous use (SageMaker/Vertex AI training) or add no real benefit over the free/open alternative (Evidently AI's drift math has no cloud service to replace it with).

If asked in an interview why the stack looks like this, the honest and strong answer is: you made deliberate cost-aware and complexity-aware tradeoffs component by component, rather than either avoiding cloud entirely or throwing the most expensive managed service at every layer. That's a stronger signal of production judgment than either extreme.

Agar kisi specific company ke liye poora AWS-native ya poora GCP-native version dikhana ho (jaise agar woh company heavily ek hi cloud pe hai), toh yeh poora plan same skeleton ke saath fully swap ho sakta hai, kyunki underlying concepts (versioning, gating, drift detection, feedback loop, canary rollout) bilkul same rahenge, sirf tool/service names badlenge cloud ke hisaab se.