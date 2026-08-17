import os
import sqlite3
import pandas as pd

import sys

sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        )
    )
)

from backend.training.train import run_training
# --------------------------------------------------
# PATHS
# --------------------------------------------------

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DB_PATH = os.path.join(BACKEND_DIR, "retail_ops.db")

TRAINING_FEATURES_PATH = os.path.join(
    BACKEND_DIR,
    "data",
    "training_features.csv"
)

FEEDBACK_TRAINING_FEATURES_PATH = os.path.join(
    BACKEND_DIR,
    "data",
    "feedback_training_features.csv"
)

MODEL_FEATURES = [
    "daily_sales_avg_7",
    "daily_sales_avg_14",
    "daily_sales_avg_30",
    "demand_velocity",
    "day_of_week",
    "month",
    "holiday_flag",
    "simulated_inventory",
    "inventory_to_sales_ratio",
    "inventory_to_sales_ratio_7",
]


def load_original_training_data():
    print("Loading original training data...")

    df = pd.read_csv(TRAINING_FEATURES_PATH)

    # Same derived features used by train.py
    df["inventory_to_sales_ratio"] = (
        df["simulated_inventory"]
        / (df["daily_sales_avg_30"] + 1e-5)
    )

    df["inventory_to_sales_ratio_7"] = (
        df["simulated_inventory"]
        / (df["daily_sales_avg_7"] + 1e-5)
    )

    print(f"Original training rows: {len(df)}")

    return df


def load_feedback_data():
    print("Loading completed feedback...")

    conn = sqlite3.connect(DB_PATH)

    query = """
        SELECT
            pf.daily_sales_avg_7,
            pf.daily_sales_avg_14,
            pf.daily_sales_avg_30,
            pf.demand_velocity,
            pf.day_of_week,
            pf.month,
            pf.holiday_flag,
            pf.simulated_inventory,
            pf.inventory_to_sales_ratio,
            pf.inventory_to_sales_ratio_7,
            o.actual_stockout_occurred
        FROM prediction_features pf
        INNER JOIN outcomes o
            ON pf.decision_log_id = o.decision_log_id
    """

    feedback_df = pd.read_sql_query(query, conn)

    conn.close()

    print(f"Completed feedback rows: {len(feedback_df)}")

    return feedback_df


def build_combined_dataset():

    original_df = load_original_training_data()

    feedback_df = load_feedback_data()

    if feedback_df.empty:
        raise RuntimeError(
            "No completed feedback rows available for retraining."
        )

    # Rename feedback label to the training target
    feedback_df = feedback_df.rename(
        columns={
            "actual_stockout_occurred": "target"
        }
    )

    # Keep only model features + target
    feedback_df = feedback_df[
        MODEL_FEATURES + ["target"]
    ]

    original_training = original_df[
        MODEL_FEATURES + ["target"]
    ].copy()

    # Combine original training data + feedback
    combined_df = pd.concat(
        [original_training, feedback_df],
        ignore_index=True
    )

    print("\n========================================")
    print("COMBINED RETRAINING DATASET")
    print("========================================")

    print(f"Original rows : {len(original_training)}")
    print(f"Feedback rows : {len(feedback_df)}")
    print(f"Combined rows : {len(combined_df)}")

    print("========================================")

    return combined_df

def main():

    print("\n========================================")
    print("PHASE 8 FEEDBACK RETRAINING")
    print("========================================\n")

    # 1. Build combined original + feedback dataset
    combined_df = build_combined_dataset()

    # 2. Save combined dataset for the existing training pipeline
    combined_df.to_csv(
        FEEDBACK_TRAINING_FEATURES_PATH,
        index=False
    )

    print(
        f"\nSaved combined training dataset to:\n"
        f"{FEEDBACK_TRAINING_FEATURES_PATH}"
    )

    print("\nTraining columns:")
    print(combined_df.columns.tolist())

    print("\nTarget distribution:")
    print(
        combined_df["target"]
        .value_counts()
        .sort_index()
    )

    # 3. Run the EXISTING training pipeline
    print("\n========================================")
    print("STARTING RETRAINING")
    print("========================================")

    run_training(FEEDBACK_TRAINING_FEATURES_PATH)

    print("\n========================================")
    print("PHASE 8 RETRAINING COMPLETE")
    print("========================================")

if __name__ == "__main__":
    main()