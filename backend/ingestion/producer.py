import os
import sys
import argparse
import pandas as pd
import numpy as np
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from queue_service import QueueService

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CROP_CSV = os.path.join(DATA_DIR, "crop_recommendation_real.csv")

FIELDS = [
    "FIELD_MH_01", "FIELD_MH_02", "FIELD_US_01", "FIELD_US_04",
    "FIELD_PB_01", "FIELD_KA_03", "FIELD_GJ_02", "FIELD_TN_05"
]

SOIL_TYPES = ["Loamy", "Clayey", "Sandy", "Black", "Red"]

def parse_args():
    parser = argparse.ArgumentParser(description="AgriTech Telemetry Ingestion Event Producer")
    parser.add_argument("--field-id", type=str, default="auto", help="Field ID or 'auto' to cycle fields")
    parser.add_argument("--limit", type=int, default=100, help="Number of records to publish (0 for unlimited)")
    parser.add_argument("--delay", type=float, default=0.4, help="Delay in seconds between messages")
    parser.add_argument("--continuous", action="store_true", help="Run producer continuously")
    parser.add_argument("--drift-step", type=float, default=0.015, help="Daily feature drift rate per batch (1.5 percent to 2.0 percent)")
    return parser.parse_args()

def run_producer():
    args = parse_args()
    
    if not os.path.exists(CROP_CSV):
        raise FileNotFoundError(f"Source AgriTech dataset missing at {CROP_CSV}.")
        
    print(f"Reading AgriTech sensor observations from {CROP_CSV}...")
    df = pd.read_csv(CROP_CSV)
    
    print("Initializing Queue Service client...")
    queue = QueueService()
    
    print(f"Starting AgriTech telemetry event stream. Randomized multi-crop mode & progressive {args.drift_step*100:.1f}% drift active...")
    
    sent_count = 0

    while True:
        # Shuffle dataset on every iteration to guarantee randomized crop distribution
        shuffled = df.sample(frac=1.0).reset_index(drop=True)
        
        for idx, row in shuffled.iterrows():
            field_id = args.field_id if args.field_id != "auto" else FIELDS[sent_count % len(FIELDS)]
            soil_type = SOIL_TYPES[sent_count % len(SOIL_TYPES)]
            
            # Calculate progressive natural daily feature drift (1.5% - 2.0% accumulation per batch)
            # Simulates realistic microclimate & seasonal soil degradation
            drift_accum_pct = min(0.40, (sent_count // 10) * args.drift_step)
            is_drifted = drift_accum_pct >= 0.15
            
            base_n = float(row.get("N", 50.0))
            base_p = float(row.get("P", 40.0))
            base_k = float(row.get("K", 40.0))
            base_temp = float(row.get("temperature", 25.0))
            base_hum = float(row.get("humidity", 60.0))
            base_ph = float(row.get("ph", 6.5))
            base_rain = float(row.get("rainfall", 100.0))
            
            # Apply progressive statistical drift
            n_val = base_n * (1.0 + drift_accum_pct * 0.8) + np.random.normal(0, 2)
            p_val = base_p * max(0.2, 1.0 - drift_accum_pct * 0.7) + np.random.normal(0, 2)
            k_val = base_k * (1.0 + drift_accum_pct * 0.5) + np.random.normal(0, 2)
            temp_val = base_temp * (1.0 + drift_accum_pct * 0.6) + np.random.normal(0, 1)
            hum_val = base_hum * max(0.2, 1.0 - drift_accum_pct * 0.5) + np.random.normal(0, 2)
            ph_val = base_ph + drift_accum_pct * 1.5 + np.random.normal(0, 0.05)
            
            # Soil moisture depletes progressively with drift accumulation
            base_sm = float(np.random.uniform(45.0, 75.0))
            soil_moisture = max(8.0, base_sm * (1.0 - drift_accum_pct * 0.85) + np.random.normal(0, 2))
            rainfall_val = max(0.0, base_rain * (1.0 - drift_accum_pct * 0.8) + np.random.normal(0, 5))

            event_payload = {
                "field_id": field_id,
                "nitrogen": round(max(0.0, n_val), 1),
                "phosphorus": round(max(0.0, p_val), 1),
                "potassium": round(max(0.0, k_val), 1),
                "temperature": round(temp_val, 1),
                "humidity": round(hum_val, 1),
                "ph": round(ph_val, 2),
                "soil_moisture": round(soil_moisture, 1),
                "rainfall": round(rainfall_val, 1),
                "soil_type": soil_type,
                "crop_type": str(row.get("label", "maize")),
                "timestamp": datetime.now().isoformat(),
                "drift_accum_pct": round(drift_accum_pct * 100, 1)
            }
            
            try:
                queue.publish(event_payload)
                sent_count += 1
                if sent_count % 10 == 0:
                    status_lbl = f"PROGRESSIVE DRIFT: +{drift_accum_pct*100:.1f}%" if is_drifted else "BASELINE"
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [{status_lbl}] Field: {field_id} | Crop: {event_payload['crop_type']:12s} | Temp: {temp_val:.1f}°C | SM: {soil_moisture:.1f}%")
            except Exception as e:
                print(f"Failed to publish telemetry event: {e}")
                
            if not args.continuous and args.limit > 0 and sent_count >= args.limit:
                break
                
            if args.delay > 0:
                time.sleep(args.delay)
                
        if not args.continuous and args.limit > 0 and sent_count >= args.limit:
            break
            
    print(f"AgriTech Telemetry Producer completed. Published {sent_count} events.")

if __name__ == "__main__":
    run_producer()
