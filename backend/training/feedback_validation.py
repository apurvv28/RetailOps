import os
import sqlite3
import pandas as pd


# --------------------------------------------------
# PATHS
# --------------------------------------------------

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DB_PATH = os.path.join(BACKEND_DIR, "retail_ops.db")
TRAINING_FEATURES_PATH = os.path.join(
    BACKEND_DIR, "data", "training_features.csv"
)


# These are the exact features currently expected by train.py
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
    """Load the existing offline training dataset."""

    if not os.path.exists(TRAINING_FEATURES_PATH):
        raise FileNotFoundError(
            f"Training features not found: {TRAINING_FEATURES_PATH}"
        )

    df = pd.read_csv(TRAINING_FEATURES_PATH)

    print(f"Original training rows: {len(df)}")

    return df


def load_feedback_data():
    """
    Join prediction_features with outcomes.

    Only predictions that have an actual outcome are included.
    """

    conn = sqlite3.connect(DB_PATH)

    query = """
        SELECT
            pf.decision_log_id,
            pf.sku,
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


def validate_feedback(feedback_df):
    """Validate that feedback contains all model features and a label."""

    required_columns = MODEL_FEATURES + [
        "actual_stockout_occurred"
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in feedback_df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing required feedback columns: {missing_columns}"
        )

    print("All required model features are present.")

    # Check labels
    invalid_labels = ~feedback_df[
        "actual_stockout_occurred"
    ].isin([0, 1])

    if invalid_labels.any():
        raise ValueError(
            "Feedback contains invalid stockout labels."
        )

    print("Feedback labels are valid: 0/1.")


def main():

    print("\n========================================")
    print("PHASE 8 FEEDBACK VALIDATION")
    print("========================================\n")

    # 1. Existing training data
    training_df = load_original_training_data()

    # 2. New labeled feedback
    feedback_df = load_feedback_data()

    # 3. Validate feedback structure
    if len(feedback_df) > 0:
        validate_feedback(feedback_df)
    else:
        print("No completed feedback available yet.")

    # 4. Calculate expected combined dataset size
    expected_rows = len(training_df) + len(feedback_df)

    print("\n----------------------------------------")
    print(f"Original training rows : {len(training_df)}")
    print(f"Feedback rows          : {len(feedback_df)}")
    print(f"Expected combined rows : {expected_rows}")
    print("----------------------------------------")

    # 5. Display feedback examples
    if len(feedback_df) > 0:
        print("\nFeedback examples:")
        print(
            feedback_df[
                [
                    "decision_log_id",
                    "sku",
                    "actual_stockout_occurred"
                ]
            ].to_string(index=False)
        )

    print("\n========================================")
    print("VALIDATION COMPLETE")
    print("========================================")


if __name__ == "__main__":
    main()