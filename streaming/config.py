import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from local .env or parent backend .env if available
current_dir = Path(__file__).resolve().parent
load_dotenv(current_dir / ".env")
load_dotenv(current_dir.parent / "backend" / ".env")

class Config:
    """Centralized streaming service configuration."""

    # Kafka Configuration
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    KAFKA_TOPIC_RAW_EVENTS: str = os.getenv("KAFKA_TOPIC_RAW_EVENTS", "retail-events-raw")
    KAFKA_TOPIC_PREDICTIONS: str = os.getenv("KAFKA_TOPIC_PREDICTIONS", "retail-predictions")
    KAFKA_CONSUMER_GROUP: str = os.getenv("KAFKA_CONSUMER_GROUP", "retail-ops-consumer-group")
    KAFKA_AUTO_OFFSET_RESET: str = os.getenv("KAFKA_AUTO_OFFSET_RESET", "latest")

    # FastAPI Prediction Service
    PREDICT_API_URL: str = os.getenv("PREDICT_API_URL", "http://localhost:8080/predict")
    PREDICT_API_TIMEOUT: int = int(os.getenv("PREDICT_API_TIMEOUT", "10"))
    API_KEY: str = os.getenv("API_KEY", "")

    # Database Configuration (CockroachDB / PostgreSQL / SQLite fallback)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///../backend/retail_ops.db")

    # Dataset Source Path
    DATASET_PATH: str = os.getenv(
        "DATASET_PATH",
        str((current_dir.parent / "backend" / "data" / "online_retail_II.csv").resolve())
    )

    # Producer Simulation Parameters
    PRODUCER_DELAY_SECONDS: float = float(os.getenv("PRODUCER_DELAY_SECONDS", "0.2"))
    PRODUCER_MAX_RETRY_ATTEMPTS: int = int(os.getenv("PRODUCER_MAX_RETRY_ATTEMPTS", "5"))
    PRODUCER_RETRY_BACKOFF_FACTOR: float = float(os.getenv("PRODUCER_RETRY_BACKOFF_FACTOR", "2.0"))

    # Consumer Parameters
    CONSUMER_MAX_RETRY_ATTEMPTS: int = int(os.getenv("CONSUMER_MAX_RETRY_ATTEMPTS", "3"))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()

config = Config()
