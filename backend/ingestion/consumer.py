import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from queue_service import QueueService

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

def get_db_url():
    db_url = os.getenv("DATABASE_URL", "sqlite:///retail_ops.db")
    if db_url.startswith("sqlite:///"):
        db_name = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_name):
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            db_path = os.path.abspath(os.path.join(backend_dir, db_name))
            db_url = "sqlite:///" + db_path.replace('\\', '/')
    return db_url

DATABASE_URL = get_db_url()

print(f"Consumer DB connection: {DATABASE_URL}")
engine = create_engine(DATABASE_URL)

def save_event_to_db(event: dict):
    """Inserts a raw event dictionary into the database."""
    query = text(
        """
        INSERT INTO raw_events (
            invoice_no, stock_code, description, quantity, invoice_date, unit_price, customer_id, country
        ) VALUES (
            :invoice_no, :stock_code, :description, :quantity, :invoice_date, :unit_price, :customer_id, :country
        )
        """
    )
    
    with engine.begin() as conn:
        conn.execute(query, {
            "invoice_no": event.get("invoice_no"),
            "stock_code": event.get("stock_code"),
            "description": event.get("description"),
            "quantity": event.get("quantity"),
            "invoice_date": event.get("invoice_date"),
            "unit_price": event.get("unit_price"),
            "customer_id": event.get("customer_id"),
            "country": event.get("country")
        })

def process_message(event_data: dict):
    stock_code = event_data.get("stock_code")
    qty = event_data.get("quantity")
    print(f"Processing event: SKU={stock_code}, Qty={qty}, Country={event_data.get('country')}")
    
    # Save raw event to DB
    try:
        save_event_to_db(event_data)
        print(f"Successfully stored event for SKU {stock_code} in database.")
    except Exception as e:
        print(f"Database error writing event: {e}")
        raise e

def run_consumer():
    print("Starting Ingestion Queue Consumer...")
    queue = QueueService()
    
    try:
        queue.consume(process_message)
    except KeyboardInterrupt:
        print("Consumer stopped by user.")
    except Exception as e:
        print(f"Consumer encountered critical error: {e}")

if __name__ == "__main__":
    run_consumer()
