import os
import json
import sqlite3
import time
from google.cloud import pubsub_v1
from google.api_core.exceptions import AlreadyExists, NotFound
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

QUEUE_TYPE = os.getenv("QUEUE_TYPE", "local").lower()
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_PUBSUB_TOPIC = os.getenv("GCP_PUBSUB_TOPIC", "retail-ops-topic")
GCP_PUBSUB_SUB = os.getenv("GCP_PUBSUB_SUB", f"{GCP_PUBSUB_TOPIC}-sub")
LOCAL_QUEUE_DB = os.path.join(os.path.dirname(os.path.dirname(__file__)), "local_queue.db")

class LocalQueue:
    """A simple SQLite-backed queue for local development/testing."""
    def __init__(self):
        self.conn = sqlite3.connect(LOCAL_QUEUE_DB, isolation_level=None)
        self.conn.execute("PRAGMA journal_mode=WAL;")
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

    def publish(self, data: dict):
        self.conn.execute("INSERT INTO queue (data) VALUES (?)", (json.dumps(data),))

    def consume(self, callback_func):
        print("Starting local SQLite queue consumer loop...")
        while True:
            # Atomic fetch-and-lock
            cursor = self.conn.cursor()
            cursor.execute("BEGIN IMMEDIATE TRANSACTION;")
            cursor.execute(
                "SELECT id, data FROM queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1"
            )
            row = cursor.fetchone()
            if row:
                msg_id, data_str = row
                cursor.execute("UPDATE queue SET status = 'processing' WHERE id = ?", (msg_id,))
                cursor.execute("COMMIT;")
                
                try:
                    data = json.loads(data_str)
                    callback_func(data)
                    # Mark as acknowledged (delete or update status to acknowledged)
                    self.conn.execute("DELETE FROM queue WHERE id = ?", (msg_id,))
                except Exception as e:
                    print(f"Error processing message {msg_id}: {e}")
                    # Revert to pending
                    self.conn.execute("UPDATE queue SET status = 'pending' WHERE id = ?", (msg_id,))
            else:
                cursor.execute("COMMIT;")
                time.sleep(0.5)

class GCPPubSubQueue:
    """GCP Pub/Sub Queue Wrapper."""
    def __init__(self):
        if not GCP_PROJECT_ID:
            raise ValueError("GCP_PROJECT_ID must be set in .env when using GCP Pub/Sub.")
        
        self.publisher = pubsub_v1.PublisherClient()
        self.subscriber = pubsub_v1.SubscriberClient()
        self.topic_path = self.publisher.topic_path(GCP_PROJECT_ID, GCP_PUBSUB_TOPIC)
        self.subscription_path = self.subscriber.subscription_path(GCP_PROJECT_ID, GCP_PUBSUB_SUB)
        
        self._ensure_topic_and_subscription()

    def _ensure_topic_and_subscription(self):
        # Ensure Topic exists
        try:
            self.publisher.create_topic(request={"name": self.topic_path})
            print(f"Created GCP Pub/Sub Topic: {self.topic_path}")
        except AlreadyExists:
            print(f"GCP Pub/Sub Topic already exists: {self.topic_path}")
        except Exception as e:
            print(f"Checking topic {self.topic_path} failed, attempting to continue: {e}")

        # Ensure Subscription exists
        try:
            self.subscriber.create_subscription(
                request={"name": self.subscription_path, "topic": self.topic_path}
            )
            print(f"Created GCP Pub/Sub Subscription: {self.subscription_path}")
        except AlreadyExists:
            print(f"GCP Pub/Sub Subscription already exists: {self.subscription_path}")
        except Exception as e:
            print(f"Checking subscription {self.subscription_path} failed: {e}")

    def publish(self, data: dict):
        payload = json.dumps(data).encode("utf-8")
        future = self.publisher.publish(self.topic_path, payload)
        return future.result()

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
        
        # Block until cancelled or error
        try:
            streaming_pull_future.result()
        except KeyboardInterrupt:
            streaming_pull_future.cancel()
            print("Pub/Sub consumer stopped.")

class QueueService:
    def __init__(self):
        if QUEUE_TYPE == "gcp":
            print("Initializing GCP Pub/Sub client...")
            self.client = GCPPubSubQueue()
        else:
            print("Initializing Local SQLite client...")
            self.client = LocalQueue()

    def publish(self, data: dict):
        self.client.publish(data)

    def consume(self, callback_func):
        self.client.consume(callback_func)
