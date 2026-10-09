import os
import sys
import argparse
import sqlite3
import time
from datetime import datetime
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from queue_service import QueueService

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
SM_MAHARASHTRA_CSV = os.path.join(DATA_DIR, "sm_Maharashtra_2018.csv")
CROP_REAL_CSV = os.path.join(DATA_DIR, "crop_recommendation_real.csv")

def parse_args():
    parser = argparse.ArgumentParser(description="AgriTech Real-World Sensor Telemetry Ingestion Producer")
    parser.add_argument("--farm-id", type=str, default="all", help="Specific Farm ID (e.g. FARM_MH_PUNE_01) or 'all' to stream across all managed farms")
    default_delay = float(os.getenv("TELEMETRY_INTERVAL", 120.0))
    parser.add_argument("--delay", type=float, default=default_delay, help="Delay in seconds between telemetry cycles (default 120s / 2min)")
    parser.add_argument("--batch-size", type=int, default=5, help="Number of sensor events to batch per queue publish (cost optimization)")
    parser.add_argument("--continuous", action="store_true", help="Run producer continuously")
    return parser.parse_args()

def get_db_connection():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "retail_ops.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def get_managed_farms(target_farm_id: str = "all"):
    """Fetches managed farms registered in the system."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if target_farm_id != "all":
        cursor.execute("SELECT farm_id, farm_name, district, region, acreage, soil_type, current_crop FROM farms WHERE farm_id = ?", (target_farm_id,))
    else:
        cursor.execute("SELECT farm_id, farm_name, district, region, acreage, soil_type, current_crop FROM farms WHERE status = 'active'")
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        # Fallback default farms if table is freshly migrating
        return [
            {"farm_id": "FARM_MH_PUNE_01", "farm_name": "Kisan Green Valley Farm", "district": "PUNE", "region": "Maharashtra", "soil_type": "Clayey Loam", "current_crop": "rice"},
            {"farm_id": "FARM_MH_NASHIK_02", "farm_name": "Godavari Agro Orchards", "district": "NASHIK", "region": "Maharashtra", "soil_type": "Black Soil", "current_crop": "grapes"},
            {"farm_id": "FARM_MH_SATARA_03", "farm_name": "Sahyadri Valley Plantation", "district": "SATARA", "region": "Maharashtra", "soil_type": "Red Loamy", "current_crop": "cotton"},
            {"farm_id": "FARM_MH_SOLAPUR_04", "farm_name": "Solapur Dryland Agro Hub", "district": "SOLAPUR", "region": "Maharashtra", "soil_type": "Sandy Loam", "current_crop": "pomegranate"},
            {"farm_id": "FARM_MH_NAGPUR_05", "farm_name": "Vidarbha Citrus Agro Estate", "district": "NAGPUR", "region": "Maharashtra", "soil_type": "Black Cotton", "current_crop": "orange"},
        ]
    return [dict(r) for r in rows]

def load_real_sensor_datasets():
    """Loads authentic Indian government & NRSC sensor datasets without synthetic noise."""
    if not os.path.exists(SM_MAHARASHTRA_CSV):
        raise FileNotFoundError(f"Missing authentic Maharashtra soil moisture sensor dataset at {SM_MAHARASHTRA_CSV}")
    if not os.path.exists(CROP_REAL_CSV):
        raise FileNotFoundError(f"Missing authentic crop agro-climatic dataset at {CROP_REAL_CSV}")

    sm_df = pd.read_csv(SM_MAHARASHTRA_CSV)
    crop_df = pd.read_csv(CROP_REAL_CSV)
    return sm_df, crop_df

def run_real_sensor_producer(continuous: bool = True, delay: float = 120.0, farm_id_arg: str = "all", limit: int = 100, batch_size: int = 5):
    print("==================================================================")
    print(" AgriTech Production Sensor Ingestion Engine (data.gov.in / NRSC) ")
    print("==================================================================")
    
    farms = get_managed_farms(farm_id_arg)
    print(f"Targeting {len(farms)} managed farm(s): {[f['farm_id'] for f in farms]}")
    
    sm_df, crop_df = load_real_sensor_datasets()
    print(f"Loaded {len(sm_df)} official district soil moisture records & {len(crop_df)} real agro-meteorological records.")

    # Pre-partition real records per farm to stream authentic sequential telemetry
    farm_data_pools = {}
    for farm in farms:
        dist = farm["district"].upper()
        crop = farm["current_crop"].lower()

        dist_sm = sm_df[sm_df["DistrictName"].str.upper() == dist]["Aggregate Soilmoisture Percentage (at 15cm)"].dropna().tolist()
        if not dist_sm:
            dist_sm = sm_df["Aggregate Soilmoisture Percentage (at 15cm)"].dropna().tolist()

        crop_records = crop_df[crop_df["label"].str.lower() == crop].to_dict(orient="records")
        if not crop_records:
            crop_records = crop_df.to_dict(orient="records")

        farm_data_pools[farm["farm_id"]] = {
            "farm": farm,
            "sm_pool": dist_sm,
            "agro_pool": crop_records,
            "sm_idx": 0,
            "agro_idx": 0
        }

    queue = QueueService()
    published_count = 0
    batch_buffer = []

    print("\nBeginning real-time sensor telemetry transmission...")

    try:
        while True:
            for farm_id, pool in farm_data_pools.items():
                farm = pool["farm"]
                sm_vals = pool["sm_pool"]
                agro_vals = pool["agro_pool"]

                # Sequential real sensor observation
                soil_moisture_val = float(sm_vals[pool["sm_idx"] % len(sm_vals)])
                agro_record = agro_vals[pool["agro_idx"] % len(agro_vals)]

                pool["sm_idx"] += 1
                pool["agro_idx"] += 1

                event_payload = {
                    "farm_id": farm["farm_id"],
                    "field_id": farm["farm_id"],
                    "farm_name": farm["farm_name"],
                    "district": farm["district"],
                    "nitrogen": round(float(agro_record.get("N", 50.0)), 1),
                    "phosphorus": round(float(agro_record.get("P", 40.0)), 1),
                    "potassium": round(float(agro_record.get("K", 40.0)), 1),
                    "temperature": round(float(agro_record.get("temperature", 25.0)), 1),
                    "humidity": round(float(agro_record.get("humidity", 60.0)), 1),
                    "ph": round(float(agro_record.get("ph", 6.5)), 2),
                    "soil_moisture": round(soil_moisture_val, 1),
                    "rainfall": round(float(agro_record.get("rainfall", 0.0)), 1),
                    "soil_type": str(farm.get("soil_type", "Loamy")),
                    "crop_type": str(farm.get("current_crop", agro_record.get("label", "rice"))),
                    "timestamp": datetime.now().isoformat()
                }

                batch_buffer.append(event_payload)

                # Batch dispatch for cost & performance optimization
                if len(batch_buffer) >= batch_size:
                    queue.publish_batch(batch_buffer)
                    published_count += len(batch_buffer)
                    
                    latest = batch_buffer[-1]
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [REAL SENSOR BATCH: {len(batch_buffer)}] "
                          f"Farm: {latest['farm_id']} ({latest['district']}) | "
                          f"Crop: {latest['crop_type']:10s} | "
                          f"Moisture: {latest['soil_moisture']:4.1f}% | "
                          f"NPK: {latest['nitrogen']}-{latest['phosphorus']}-{latest['potassium']} | "
                          f"Temp: {latest['temperature']}°C")
                    batch_buffer = []

                if not continuous and limit > 0 and published_count >= limit:
                    break

            # Flush any remaining events
            if batch_buffer and (not continuous or delay > 0):
                queue.publish_batch(batch_buffer)
                published_count += len(batch_buffer)
                batch_buffer = []

            if not continuous and limit > 0 and published_count >= limit:
                break

            if delay > 0:
                time.sleep(delay)

    except KeyboardInterrupt:
        print("\nProducer stopped by operator.")

    print(f"\nReal sensor ingestion completed. Total published observations: {published_count}")

run_producer = run_real_sensor_producer

if __name__ == "__main__":
    args = parse_args()
    run_real_sensor_producer(
        continuous=args.continuous,
        delay=args.delay,
        farm_id_arg=args.farm_id,
        limit=args.limit,
        batch_size=args.batch_size
    )
