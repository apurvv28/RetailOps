import os
import json
import sqlite3
import time
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

QUEUE_TYPE = os.getenv("QUEUE_TYPE", "local").lower()
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_PUBSUB_TOPIC = os.getenv("GCP_PUBSUB_TOPIC", "agritech-telemetry-topic")
GCP_PUBSUB_SUB = os.getenv("GCP_PUBSUB_SUB", f"{GCP_PUBSUB_TOPIC}-sub")
LOCAL_QUEUE_DB = os.path.join(os.path.dirname(os.path.dirname(__file__)), "local_queue.db")

class LocalQueue:
    """Production-grade SQLite WAL-backed queue with batching and adaptive backoff for zero cloud cost."""
    def __init__(self):
        self.conn = sqlite3.connect(LOCAL_QUEUE_DB, isolation_level=None)
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self.conn.execute("PRAGMA synchronous=NORMAL;")
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_queue_status_id ON queue(status, id);")

    def publish(self, data: dict):
        self.conn.execute("INSERT INTO queue (data) VALUES (?)", (json.dumps(data),))

    def publish_batch(self, items: list):
        if not items:
            return
        tuples = [(json.dumps(item),) for item in items]
        self.conn.executemany("INSERT INTO queue (data) VALUES (?)", tuples)

    def consume(self, callback_func):
        print("Starting cost-optimized SQLite queue consumer loop with adaptive backoff...")
        idle_sleep = 0.1
        max_idle_sleep = 1.0

        while True:
            cursor = self.conn.cursor()
            cursor.execute("BEGIN IMMEDIATE TRANSACTION;")
            cursor.execute(
                "SELECT id, data FROM queue WHERE status = 'pending' ORDER BY id ASC LIMIT 25"
            )
            rows = cursor.fetchall()

            if rows:
                idle_sleep = 0.05  # Reset backoff when work is present
                processed_ids = []
                for row in rows:
                    msg_id, data_str = row
                    try:
                        data = json.loads(data_str)
                        callback_func(data)
                        processed_ids.append(msg_id)
                    except Exception as e:
                        print(f"Error processing message {msg_id}: {e}")
                        cursor.execute("UPDATE queue SET status = 'failed' WHERE id = ?", (msg_id,))

                if processed_ids:
                    id_placeholders = ",".join("?" * len(processed_ids))
                    cursor.execute(f"DELETE FROM queue WHERE id IN ({id_placeholders})", processed_ids)

                cursor.execute("COMMIT;")
            else:
                cursor.execute("COMMIT;")
                time.sleep(idle_sleep)
                idle_sleep = min(idle_sleep * 1.5, max_idle_sleep)

class GCPPubSubQueue:
    """GCP Pub/Sub Queue Wrapper with batching and cost-efficient configuration."""
    def __init__(self):
        if not GCP_PROJECT_ID:
            raise ValueError("GCP_PROJECT_ID must be set in .env when using GCP Pub/Sub.")
        
        from google.cloud import pubsub_v1
        from google.api_core.exceptions import AlreadyExists
        
        # Batch settings to group messages and cut API costs
        batch_settings = pubsub_v1.types.BatchSettings(
            max_messages=50,
            max_bytes=1024 * 1024,
            max_latency=0.5
        )
        self.publisher = pubsub_v1.PublisherClient(batch_settings=batch_settings)
        self.subscriber = pubsub_v1.SubscriberClient()
        self.topic_path = self.publisher.topic_path(GCP_PROJECT_ID, GCP_PUBSUB_TOPIC)
        self.subscription_path = self.subscriber.subscription_path(GCP_PROJECT_ID, GCP_PUBSUB_SUB)
        
        self._ensure_topic_and_subscription()

    def _ensure_topic_and_subscription(self):
        from google.api_core.exceptions import AlreadyExists
        try:
            self.publisher.create_topic(request={"name": self.topic_path})
            print(f"Created GCP Pub/Sub Topic: {self.topic_path}")
        except AlreadyExists:
            pass
        except Exception as e:
            print(f"Topic verify notice: {e}")

        try:
            self.subscriber.create_subscription(
                request={"name": self.subscription_path, "topic": self.topic_path}
            )
            print(f"Created GCP Pub/Sub Subscription: {self.subscription_path}")
        except AlreadyExists:
            pass
        except Exception as e:
            print(f"Subscription verify notice: {e}")

    def publish(self, data: dict):
        payload = json.dumps(data).encode("utf-8")
        future = self.publisher.publish(self.topic_path, payload)
        return future.result()

    def publish_batch(self, items: list):
        futures = []
        for item in items:
            payload = json.dumps(item).encode("utf-8")
            futures.append(self.publisher.publish(self.topic_path, payload))
        for f in futures:
            f.result()

    def consume(self, callback_func):
        def pubsub_callback(message):
            try:
                data = json.loads(message.data.decode("utf-8"))
                callback_func(data)
                message.ack()
            except Exception as e:
                print(f"Error handling Pub/Sub message: {e}")
                message.nack()

        print(f"Starting GCP Pub/Sub consumer subscribing to: {self.subscription_path}")
        streaming_pull_future = self.subscriber.subscribe(
            self.subscription_path, callback=pubsub_callback
        )
        try:
            streaming_pull_future.result()
        except KeyboardInterrupt:
            streaming_pull_future.cancel()
            print("Pub/Sub consumer stopped.")

class QueueService:
    def __init__(self):
        if QUEUE_TYPE == "gcp":
            print("Initializing GCP Pub/Sub queue...")
            self.client = GCPPubSubQueue()
        else:
            print("Initializing Local SQLite queue (Zero Cloud Cost)...")
            self.client = LocalQueue()

    def publish(self, data: dict):
        self.client.publish(data)

    def publish_batch(self, items: list):
        self.client.publish_batch(items)

    def consume(self, callback_func):
        self.client.consume(callback_func)
