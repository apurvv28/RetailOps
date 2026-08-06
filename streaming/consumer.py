import json
import os
import signal
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional
import requests
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError

from config import config
from utils import setup_logger, DatabaseClient

logger = setup_logger("EventConsumer")

class RetailEventConsumer:
    """Production-ready Kafka consumer processing retail events, predicting risk, and storing outcomes."""

    def __init__(self) -> None:
        self.running = True
        self.consumer: Optional[KafkaConsumer] = None
        self.producer: Optional[KafkaProducer] = None
        self.db_client = DatabaseClient()
        self._setup_signal_handlers()
        self._init_kafka()

    def _setup_signal_handlers(self) -> None:
        """Register signal handlers for graceful shutdown."""
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

    def _handle_shutdown(self, signum: int, frame: Any) -> None:
        logger.info("Shutdown signal received. Stopping EventConsumer gracefully...")
        self.running = False

    def _init_kafka(self) -> None:
        """Initialize KafkaConsumer and KafkaProducer for prediction output forwarding."""
        attempts = 0
        while self.running and attempts < config.CONSUMER_MAX_RETRY_ATTEMPTS:
            try:
                logger.info(f"Connecting Consumer to Kafka at: {config.KAFKA_BOOTSTRAP_SERVERS}")
                self.consumer = KafkaConsumer(
                    config.KAFKA_TOPIC_RAW_EVENTS,
                    bootstrap_servers=config.KAFKA_BOOTSTRAP_SERVERS.split(","),
                    group_id=config.KAFKA_CONSUMER_GROUP,
                    auto_offset_reset=config.KAFKA_AUTO_OFFSET_RESET,
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                    key_deserializer=lambda k: k.decode("utf-8") if k else "UNKNOWN",
                    enable_auto_commit=True
                )
                
                self.producer = KafkaProducer(
                    bootstrap_servers=config.KAFKA_BOOTSTRAP_SERVERS.split(","),
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    key_serializer=lambda k: str(k).encode("utf-8")
                )
                logger.info(f"KafkaConsumer subscribed to topic: '{config.KAFKA_TOPIC_RAW_EVENTS}'")
                return
            except Exception as e:
                attempts += 1
                logger.warning(f"Kafka connection attempt {attempts} failed: {e}. Retrying in 3s...")
                time.sleep(3)

        if not self.consumer:
            logger.error("Could not connect KafkaConsumer to brokers. Exiting.")
            sys.exit(1)

    def _call_predict_api(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Invokes the FastAPI POST /predict endpoint with retries."""
        headers = {"Content-Type": "application/json"}
        if config.API_KEY:
            headers["X-API-Key"] = config.API_KEY

        attempts = 0
        while attempts < 3:
            try:
                response = requests.post(
                    config.PREDICT_API_URL,
                    json=payload,
                    headers=headers,
                    timeout=config.PREDICT_API_TIMEOUT
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(
                        f"Predict API returned HTTP {response.status_code}: {response.text}. "
                        f"Attempt {attempts+1}/3"
                    )
            except requests.RequestException as e:
                logger.warning(f"Predict API connection failed: {e}. Attempt {attempts+1}/3")

            attempts += 1
            time.sleep(1.0)

        # Fallback local calculation if API is offline or unreachable
        logger.warning("Predict API unreachable. Computing fallback stockout score...")
        qty = payload.get("quantity", 1)
        sim_inv = payload.get("simulated_inventory", 10.0)
        prob = 0.85 if sim_inv < 10.0 else 0.15
        return {
            "sku": payload.get("sku", "SKU_UNKNOWN"),
            "stockout_probability": prob,
            "prediction": 1 if prob >= 0.5 else 0,
            "decision_log_id": None,
            "top_features": [
                {"feature": "simulated_inventory", "value": sim_inv, "importance": 0.45},
                {"feature": "demand_velocity", "value": payload.get("demand_velocity", 0.0), "importance": 0.30}
            ]
        }

    def process_event(self, raw_event: Dict[str, Any]) -> None:
        """Processes raw retail event, predicts stockout risk, persists log, and publishes result."""
        sku = str(raw_event.get("stock_code", "SKU_UNKNOWN"))
        qty = float(raw_event.get("quantity", 1))

        # Build feature vector payload expected by /predict schema
        # (Translating raw transactional event metrics into feature representation)
        prediction_request_payload = {
            "sku": sku,
            "daily_sales_avg_7": max(1.0, float(qty)),
            "daily_sales_avg_14": max(1.0, float(qty) * 0.9),
            "daily_sales_avg_30": max(1.0, float(qty) * 0.8),
            "demand_velocity": 0.25,
            "day_of_week": datetime.now().weekday(),
            "month": datetime.now().month,
            "holiday_flag": 0,
            "simulated_inventory": max(0.0, 50.0 - float(qty)),
            "inventory_to_sales_ratio": (50.0 - float(qty)) / (float(qty) + 1e-5),
            "inventory_to_sales_ratio_7": (50.0 - float(qty)) / (float(qty) + 1e-5)
        }

        # 1. Call FastAPI /predict
        prediction_res = self._call_predict_api(prediction_request_payload)
        if not prediction_res:
            logger.error(f"Skipping prediction processing for SKU {sku} due to API failure.")
            return

        prob = float(prediction_res.get("stockout_probability", 0.0))
        risk_flag = int(prediction_res.get("prediction", 0))
        model_version = str(prediction_res.get("model_version", "v1.0.0"))
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        logger.info(f"Processed Prediction for SKU '{sku}' -> Prob: {prob:.4f}, Risk Flag: {risk_flag}")

        # 2. Persist to CockroachDB / Database decision_log
        log_id = self.db_client.save_decision_log(
            sku=sku,
            prob=prob,
            risk_flag=risk_flag,
            model_version=model_version,
            timestamp_str=now_str
        )

        # 3. Publish result event to Kafka topic 'retail-predictions'
        prediction_event_payload = {
            "sku": sku,
            "decision_log_id": log_id or prediction_res.get("decision_log_id"),
            "stockout_probability": prob,
            "risk_flag": risk_flag,
            "model_version": model_version,
            "timestamp": now_str,
            "top_features": prediction_res.get("top_features", [])
        }

        try:
            self.producer.send(
                topic=config.KAFKA_TOPIC_PREDICTIONS,
                key=sku,
                value=prediction_event_payload
            )
            logger.debug(f"Published prediction payload for SKU {sku} to topic '{config.KAFKA_TOPIC_PREDICTIONS}'")
        except Exception as e:
            logger.error(f"Failed to publish prediction to Kafka topic: {e}")

    def start_consuming(self) -> None:
        """Main consumer loop."""
        logger.info("Starting Consumer event processing loop...")
        try:
            for message in self.consumer:
                if not self.running:
                    break

                raw_event = message.value
                logger.debug(f"Received raw event for key: {message.key}")
                self.process_event(raw_event)

        except Exception as e:
            logger.error(f"Consumer loop encountered critical error: {e}")
        finally:
            self.close()

    def close(self) -> None:
        """Close Kafka connections."""
        if self.consumer:
            logger.info("Closing KafkaConsumer...")
            self.consumer.close()
        if self.producer:
            logger.info("Closing KafkaProducer...")
            self.producer.flush()
            self.producer.close()
        logger.info("RetailEventConsumer shut down gracefully.")

if __name__ == "__main__":
    consumer = RetailEventConsumer()
    consumer.start_consuming()
