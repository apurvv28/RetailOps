# KrishiLoop — Streaming & Ingestion Service

## Overview

This directory contains the **Dockerfile** and supporting configuration for the KrishiLoop IoT telemetry ingestion services. The actual producer and consumer Python scripts live in `backend/ingestion/`.

## Current Architecture

```
backend/ingestion/producer.py   → Generates & publishes IoT sensor events
        ↓
QueueService (queue_service.py) → Routes to either:
        ├── LocalQueue (SQLite-backed, for local dev)
        └── GCPPubSubQueue (Google Cloud Pub/Sub, for production)
        ↓
backend/ingestion/consumer.py   → Reads events, runs ML inference, writes to DB
        ↓
retail_ops.db (raw_telemetry + decision_log tables)
```

## Running Locally

The services are managed by the root `docker-compose.yml`. Start everything with:

```bash
docker-compose up
```

Or run the producer/consumer individually for development:

```bash
# Start the telemetry producer (publishes events every 0.5s)
python -m backend.ingestion.producer --continuous --delay 0.5

# Start the consumer (reads events and runs ML inferences)
python -m backend.ingestion.consumer
```

## Queue Mode

Set the `QUEUE_TYPE` environment variable in `backend/.env`:

| Value | Description |
|-------|-------------|
| `local` (default) | Uses SQLite-backed queue in `backend/local_queue.db` — no external dependencies |
| `gcp` | Uses Google Cloud Pub/Sub — requires `GCP_PROJECT_ID`, `GCP_PUBSUB_TOPIC`, and GCP credentials |

## GCP Pub/Sub Setup (Production)

1. Create a GCP project and enable the Pub/Sub API
2. Create a service account with `Pub/Sub Publisher` and `Pub/Sub Subscriber` roles
3. Download the service account key JSON
4. Set in `backend/.env`:
   ```
   QUEUE_TYPE=gcp
   GCP_PROJECT_ID=your-project-id
   GCP_PUBSUB_TOPIC=agritech-telemetry-topic
   GCP_PUBSUB_SUB=agritech-telemetry-topic-sub
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

## Drift Simulation

The producer applies **progressive natural drift** to sensor readings to simulate realistic seasonal soil degradation (temperature rising, soil moisture depleting, NPK ratios shifting). This triggers the drift detector and validates the auto-retraining pipeline.

Drift accumulates at ~1.5% per 10 events and follows a cyclical pattern:
- **Baseline** → **Accumulating drift** → **Peak** → **Recovery** → repeat

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Docker image for the streaming services |
| `requirements.txt` | Python dependencies for the streaming container |
| `README.md` | This file |

> **Note:** `producer.py`, `consumer.py`, `config.py`, and `utils.py` were removed from this directory in Phase 1 cleanup. The active implementations are in `backend/ingestion/`.
