import json
import os
import signal
import sys
import time
from typing import Dict, Any, Optional
import pandas as pd
from kafka import KafkaProducer
from kafka.errors import KafkaError

from config import config
from utils import setup_logger

logger = setup_logger("EventProducer")

class RetailEventProducer:
    """Production-ready Kafka event producer for streaming retail transactions."""

    def __init__(self) -> None:
        self.running = True
        self.producer: Optional[KafkaProducer] = None
        self._setup_signal_handlers()
        self._init_producer()

    def _setup_signal_handlers(self) -> None:
        """Register signal handlers for graceful shutdown."""
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

    def _handle_shutdown(self, signum: int, frame: Any) -> None:
        logger.info("Shutdown signal received. Stopping EventProducer gracefully...")
        self.running = False

    def _init_producer(self) -> None:
        """Initialize KafkaProducer with retry logic."""
        attempts = 0
        while self.running and attempts < config.PRODUCER_MAX_RETRY_ATTEMPTS:
            try:
                logger.info(f"Connecting to Kafka brokers at: {config.KAFKA_BOOTSTRAP_SERVERS}")
                self.producer = KafkaProducer(
                    bootstrap_servers=config.KAFKA_BOOTSTRAP_SERVERS.split(","),
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    key_serializer=lambda k: str(k).encode("utf-8"),
                    acks="all",
                    retries=3,
                    max_in_flight_requests_per_connection=1
                )
                logger.info("KafkaProducer successfully connected.")
                return
            except Exception as e:
                attempts += 1
                wait_time = config.PRODUCER_RETRY_BACKOFF_FACTOR ** attempts
                logger.warning(
                    f"Failed to connect to Kafka (Attempt {attempts}/{config.PRODUCER_MAX_RETRY_ATTEMPTS}). "
                    f"Retrying in {wait_time:.1f}s... Error: {e}"
                )
                time.sleep(wait_time)

        if not self.producer:
            logger.error("Could not establish connection to Kafka broker. Exiting.")
            sys.exit(1)

    def load_dataset(self) -> pd.DataFrame:
        """Load and clean the retail dataset for streaming."""
        file_path = config.DATASET_PATH
        if not os.path.exists(file_path):
            logger.error(f"Dataset CSV not found at: {file_path}")
            logger.info("Generating inline dummy event batch for fallback streaming...")
            return pd.DataFrame([{
                "Invoice": "536365",
                "StockCode": "85123A",
                "Description": "WHITE HANGING HEART T-LIGHT HOLDER",
                "Quantity": 6,
                "InvoiceDate": "2026-07-23 08:00:00",
                "Price": 2.55,
                "Customer ID": "17850",
                "Country": "United Kingdom"
            }])

        logger.info(f"Loading dataset from CSV: {file_path}")
        df = pd.read_csv(file_path)
        logger.info(f"Dataset successfully loaded. Total rows: {len(df)}")
        return df

    def publish_event(self, record: Dict[str, Any]) -> bool:
        """Publish a single retail transaction event to Kafka."""
        stock_code = str(record.get("stock_code", "UNKNOWN"))
        topic = config.KAFKA_TOPIC_RAW_EVENTS

        try:
            future = self.producer.send(
                topic=topic,
                key=stock_code,
                value=record
            )
            record_metadata = future.get(timeout=10)
            logger.debug(
                f"Event sent -> Topic: {record_metadata.topic}, "
                f"Partition: {record_metadata.partition}, Offset: {record_metadata.offset}"
            )
            return True
        except KafkaError as e:
            logger.error(f"Kafka publishing error for SKU {stock_code}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error publishing record: {e}")
            return False

    def start_streaming(self) -> None:
        """Main producer execution loop."""
        df = self.load_dataset()
        sent_count = 0
        total_rows = len(df)

        logger.info(
            f"Starting real-time event streaming to topic '{config.KAFKA_TOPIC_RAW_EVENTS}' "
            f"with {config.PRODUCER_DELAY_SECONDS}s delay..."
        )

        for idx, row in df.iterrows():
            if not self.running:
                break

            customer_id = str(row['Customer ID']) if not pd.isna(row.get('Customer ID')) else None
            description = str(row['Description']) if not pd.isna(row.get('Description')) else None
            invoice_no = str(row.get('Invoice', row.get('invoice_no', ''))) if not pd.isna(row.get('Invoice')) else None
            stock_code = str(row.get('StockCode', row.get('stock_code', 'SKU_UNKNOWN')))
            
            event_payload = {
                "invoice_no": invoice_no,
                "stock_code": stock_code,
                "description": description,
                "quantity": int(row.get('Quantity', 1)),
                "invoice_date": str(row.get('InvoiceDate', '')),
                "unit_price": float(row.get('Price', 0.0)),
                "customer_id": customer_id,
                "country": str(row.get('Country', 'United Kingdom'))
            }

            success = self.publish_event(event_payload)
            if success:
                sent_count += 1
                if sent_count % 50 == 0 or sent_count == total_rows:
                    logger.info(f"Streamed {sent_count}/{total_rows} raw retail events.")

            time.sleep(config.PRODUCER_DELAY_SECONDS)

        logger.info(f"Producer finished. Successfully published {sent_count} events.")
        self.close()

    def close(self) -> None:
        """Flush and close producer connection."""
        if self.producer:
            logger.info("Flushing and closing KafkaProducer...")
            self.producer.flush()
            self.producer.close()
            logger.info("KafkaProducer closed.")

if __name__ == "__main__":
    producer = RetailEventProducer()
    producer.start_streaming()
