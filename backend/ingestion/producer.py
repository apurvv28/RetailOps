import os
import argparse
import pandas as pd
import time
from queue_service import QueueService

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "online_retail_II.csv")

def parse_args():
    parser = argparse.ArgumentParser(description="Retail Ops Ingestion Event Producer")
    parser.add_argument("--limit", type=int, default=100, help="Number of records to publish")
    parser.add_argument("--delay", type=float, default=0.1, help="Delay in seconds between messages")
    parser.add_argument("--sku", type=str, default=None, help="Filter for specific SKU / StockCode")
    return parser.parse_args()

def run_producer():
    args = parse_args()
    
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Source dataset not found at {CSV_PATH}. Please make sure Task 2 is complete.")
        
    print(f"Reading dataset from {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    
    # Apply SKU filter if specified
    if args.sku:
        df = df[df['StockCode'].astype(str) == args.sku]
        print(f"Filtered dataset for SKU={args.sku}. Rows found: {len(df)}")
        
    # Limit rows
    if args.limit and args.limit > 0:
        df = df.head(args.limit)
        
    print(f"Initializing Queue Service client...")
    queue = QueueService()
    
    print(f"Starting event stream simulation. Publishing {len(df)} events...")
    
    sent_count = 0
    for idx, row in df.iterrows():
        # Handle nan values for description or customer_id
        customer_id = str(row['Customer ID']) if not pd.isna(row['Customer ID']) else None
        description = str(row['Description']) if not pd.isna(row['Description']) else None
        invoice_no = str(row['Invoice']) if not pd.isna(row['Invoice']) else None
        
        # Build event payload matching database columns
        event_payload = {
            "invoice_no": invoice_no,
            "stock_code": str(row['StockCode']),
            "description": description,
            "quantity": int(row['Quantity']),
            "invoice_date": str(row['InvoiceDate']),
            "unit_price": float(row['Price']),
            "customer_id": customer_id,
            "country": str(row['Country'])
        }
        
        try:
            queue.publish(event_payload)
            sent_count += 1
            if sent_count % 20 == 0 or sent_count == len(df):
                print(f"Sent {sent_count}/{len(df)} events...")
        except Exception as e:
            print(f"Failed to publish event at row {idx}: {e}")
            
        if args.delay > 0:
            time.sleep(args.delay)
            
    print(f"Producer finished. Successfully published {sent_count} events.")

if __name__ == "__main__":
    run_producer()
