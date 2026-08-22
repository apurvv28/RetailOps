# Multi-stage Dockerfile for KrishiLoop AI Ingestion & Telemetry Streaming
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY streaming/requirements.txt .
COPY backend/requirements.txt ./backend_reqs.txt
RUN pip install --no-cache-dir --user -r requirements.txt -r backend_reqs.txt

# Final Runner Stage
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/root/.local/bin:$PATH

COPY --from=builder /root/.local /root/.local
COPY . /app

CMD ["python", "backend/ingestion/consumer.py"]
