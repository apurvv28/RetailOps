import os
import argparse
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///retail_ops.db")
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CSV_PATH = os.path.join(DATA_DIR, "online_retail_II.csv")
OUTPUT_FEATURES_CSV = os.path.join(DATA_DIR, "training_features.csv")

def get_db_url():
    db_url = os.getenv("DATABASE_URL", "sqlite:///retail_ops.db")
    if db_url.startswith("sqlite:///"):
        db_name = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_name):
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            db_path = os.path.abspath(os.path.join(backend_dir, db_name))
            db_url = "sqlite:///" + db_path.replace('\\', '/')
    return db_url

def is_uk_holiday(date):
    """Simple check for UK bank holidays (approximate standard bank holidays)."""
    year = date.year
    month = date.month
    day = date.day
    
    # New Year's Day
    if month == 1 and day == 1:
        return True
    # Christmas Day & Boxing Day
    if month == 12 and (day == 25 or day == 26):
        return True
    # Late August Bank Holiday (last Monday of August)
    if month == 8 and date.weekday() == 0 and day >= 25:
        return True
    # Early May Bank Holiday (first Monday of May)
    if month == 5 and date.weekday() == 0 and day <= 7:
        return True
    return False

def simulate_inventory_for_sku(sku_df, sku_id):
    """
    Simulates inventory levels over time for a single SKU's daily sales.
    Returns a dataframe with inventory levels and stockout label.
    """
    # Sort by date
    sku_df = sku_df.sort_values("date").reset_index(drop=True)
    
    # Calculate average daily sales over the whole period to size the policy
    avg_sales = sku_df["quantity"].mean()
    if avg_sales <= 0:
        avg_sales = 1.0
        
    # Reorder parameters based on average demand
    reorder_point = max(5.0, avg_sales * 5)
    reorder_qty = max(20.0, avg_sales * 20)
    lead_time = 5  # Days
    
    # State variables
    current_inventory = max(30.0, avg_sales * 15)
    pending_reorders = []  # List of dicts: {"eta": date, "qty": qty}
    
    inventory_levels = []
    stockout_occurred = []
    
    for idx, row in sku_df.iterrows():
        current_date = row["date"]
        daily_sales = row["quantity"]
        
        # 1. Process arriving reorders
        arrived_qty = 0
        reorders_still_pending = []
        for reorder in pending_reorders:
            if reorder["eta"] <= current_date:
                arrived_qty += reorder["qty"]
            else:
                reorders_still_pending.append(reorder)
        pending_reorders = reorders_still_pending
        current_inventory += arrived_qty
        
        # 2. Subtract daily sales
        current_inventory -= daily_sales
        
        # 3. Check for stockout
        if current_inventory <= 0:
            current_inventory = 0.0
            is_stockout = True
        else:
            is_stockout = False
            
        inventory_levels.append(current_inventory)
        stockout_occurred.append(is_stockout)
        
        # 4. Trigger reorder if inventory falls below reorder point
        # and no reorder is currently in transit
        if current_inventory <= reorder_point and len(pending_reorders) == 0:
            eta = current_date + pd.Timedelta(days=lead_time)
            pending_reorders.append({"eta": eta, "qty": reorder_qty})
            
    sku_df["simulated_inventory"] = inventory_levels
    sku_df["stockout_occurred"] = stockout_occurred
    
    # 5. Create Target Label: Will there be a stockout in the NEXT 7 DAYS?
    # Target = 1 if any stockout in window [t + 1, t + 7]
    target = []
    n_rows = len(sku_df)
    for i in range(n_rows):
        future_window = sku_df.iloc[i+1 : min(i+8, n_rows)]
        if len(future_window) > 0 and future_window["stockout_occurred"].any():
            target.append(1)
        else:
            target.append(0)
            
    sku_df["target"] = target
    return sku_df

def run_feature_engineering(source="csv", feature_version="v1.0.0", sample_skus=None):
    print(f"Starting Feature Engineering Pipeline. Source: {source}, Version: {feature_version}")
    
    # 1. Load raw data
    if source == "csv":
        if not os.path.exists(CSV_PATH):
            raise FileNotFoundError(f"Source dataset CSV not found at {CSV_PATH}.")
        print("Reading raw events from CSV...")
        df = pd.read_csv(CSV_PATH)
        # Rename columns to match database DDL
        rename_map = {
            "Invoice": "invoice_no",
            "StockCode": "stock_code",
            "Description": "description",
            "Quantity": "quantity",
            "InvoiceDate": "invoice_date",
            "Price": "unit_price",
            "Customer ID": "customer_id",
            "Country": "country"
        }
        df = df.rename(columns=rename_map)
    else:
        # Load from DB
        db_url = get_db_url()
        print(f"Reading raw events from Database: {db_url}...")
        engine = create_engine(db_url)
        df = pd.read_sql("SELECT * FROM raw_events", engine)
        
    if len(df) == 0:
        print("No raw events found. Ingestion must be run first.")
        return
        
    print(f"Loaded {len(df)} rows. Cleaning data...")
    # Filter out returns (negative quantities) from demand calculation
    # Note: returns are useful for return-rate features, but for sales velocity, we filter them
    df_sales = df[df["quantity"] > 0].copy()
    df_sales["invoice_date"] = pd.to_datetime(df_sales["invoice_date"])
    df_sales["stock_code"] = df_sales["stock_code"].astype(str)
    
    # Strip any spaces from stock codes
    df_sales["stock_code"] = df_sales["stock_code"].str.strip()
    
    # Optional sampling for speed during local testing
    if sample_skus:
        print(f"Filtering to top {sample_skus} SKUs for performance...")
        top_skus = df_sales["stock_code"].value_counts().head(sample_skus).index
        df_sales = df_sales[df_sales["stock_code"].isin(top_skus)].copy()
        
    print(f"Aggregating transactions to daily sales per SKU...")
    df_sales["date"] = df_sales["invoice_date"].dt.normalize()
    
    daily_sales = (
        df_sales.groupby(["stock_code", "date"])
        .agg({"quantity": "sum", "unit_price": "mean"})
        .reset_index()
    )
    
    # 2. Resample time-series per SKU to fill missing days with 0 sales
    print("Resampling time-series for zero-sales days...")
    resampled_list = []
    all_dates = pd.date_range(daily_sales["date"].min(), daily_sales["date"].max())
    
    grouped = daily_sales.groupby("stock_code")
    for sku, group in grouped:
        group = group.set_index("date")
        # Reindex to fill missing dates in the overall range
        group = group.reindex(all_dates, fill_value=0)
        group["stock_code"] = sku
        group = group.reset_index().rename(columns={"index": "date"})
        
        # Calculate Rolling Averages
        group["daily_sales_avg_7"] = group["quantity"].rolling(window=7, min_periods=1).mean()
        group["daily_sales_avg_14"] = group["quantity"].rolling(window=14, min_periods=1).mean()
        group["daily_sales_avg_30"] = group["quantity"].rolling(window=30, min_periods=1).mean()
        
        # Compute Demand Velocity
        # Acceleration / rate of change: (7day avg - 30day avg) / (30day avg)
        group["demand_velocity"] = (
            (group["daily_sales_avg_7"] - group["daily_sales_avg_30"]) /
            (group["daily_sales_avg_30"] + 1e-5)
        )
        
        # Seasonality features
        group["day_of_week"] = group["date"].dt.weekday
        group["month"] = group["date"].dt.month
        group["holiday_flag"] = group["date"].apply(is_uk_holiday)
        
        # Simulate Inventory & Generate stockout targets
        group = simulate_inventory_for_sku(group, sku)
        
        resampled_list.append(group)
        
    feature_df = pd.concat(resampled_list, ignore_index=True)
    print(f"Feature engineering complete. Total feature rows: {len(feature_df)}")
    
    # 3. SPLIT STORE: Save all history offline (CSV) and write only current snapshot to database (Online store)
    # Save offline features file
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    feature_df.to_csv(OUTPUT_FEATURES_CSV, index=False)
    print(f"Saved full historical training features to: {OUTPUT_FEATURES_CSV}")
    
    # Save the LATEST feature snapshot per SKU to CockroachDB/SQLite (Online Feature Store)
    print("Writing latest feature snapshots to Database (Online Store)...")
    latest_features = feature_df.sort_values("date").groupby("stock_code").last().reset_index()
    
    db_url = get_db_url()
    engine = create_engine(db_url)
    
    # Prepare dataframe matching database table columns
    # Table columns: sku, feature_version, daily_sales_avg_7, daily_sales_avg_14, daily_sales_avg_30, demand_velocity, day_of_week, month, holiday_flag, updated_at
    latest_features = latest_features.rename(columns={"stock_code": "sku"})
    latest_features["feature_version"] = feature_version
    latest_features["holiday_flag"] = latest_features["holiday_flag"].astype(bool)
    
    db_columns = [
        "sku", "feature_version", "daily_sales_avg_7", "daily_sales_avg_14", 
        "daily_sales_avg_30", "demand_velocity", "day_of_week", "month", "holiday_flag",
        "simulated_inventory"
    ]
    db_payload = latest_features[db_columns]
    
    # Insert snapshot into DB
    with engine.begin() as conn:
        # Clear previous records for this version to allow clean rerun
        conn.execute(
            text("DELETE FROM engineered_features WHERE feature_version = :version"),
            {"version": feature_version}
        )
        
        # Insert using pandas to_sql (faster)
        db_payload.to_sql(
            "engineered_features", 
            con=conn, 
            if_exists="append", 
            index=False,
            method="multi"
        )
        
    print(f"Successfully stored {len(db_payload)} online SKU feature snapshots in database.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Feature Engineering Pipeline")
    parser.add_argument("--source", type=str, default="csv", choices=["csv", "db"], help="Data source")
    parser.add_argument("--version", type=str, default="v1.0.0", help="Feature version name")
    parser.add_argument("--sample-skus", type=int, default=15, help="Limit to N top SKUs (for fast training run)")
    args = parser.parse_args()
    
    run_feature_engineering(source=args.source, feature_version=args.version, sample_skus=args.sample_skus)
