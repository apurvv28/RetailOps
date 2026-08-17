import os
import sqlite3
import argparse
from datetime import datetime, timedelta

import requests
from dotenv import load_dotenv


# ---------------------------------------------------------
# Environment
# ---------------------------------------------------------

BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))

dotenv_path = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///retail_ops.db"
)

API_URL = os.getenv(
    "API_URL",
    "http://127.0.0.1:8000"
)

API_KEY = os.getenv("API_KEY")


# ---------------------------------------------------------
# Database
# ---------------------------------------------------------

def get_sqlite_path():
    """
    Resolve the SQLite database path using the same convention
    used by the existing application.
    """

    db_url = DATABASE_URL

    if db_url.startswith("sqlite:///"):
        db_name = db_url.replace("sqlite:///", "")

        if not os.path.isabs(db_name):
            db_path = os.path.abspath(
                os.path.join(BACKEND_DIR, db_name)
            )
        else:
            db_path = db_name

        return db_path

    raise RuntimeError(
        "Phase 8 local outcome checker currently supports SQLite only."
    )


def get_connection():
    return sqlite3.connect(get_sqlite_path())


# ---------------------------------------------------------
# Find eligible predictions
# ---------------------------------------------------------

def get_predictions_due_for_outcome(days=7):
    """
    Returns predictions whose timestamp is at least `days`
    old and which do not already have an outcome.
    """

    conn = get_connection()

    cutoff = datetime.now() - timedelta(days=days)

    rows = conn.execute(
        """
        SELECT
            dl.id,
            dl.sku,
            dl.prediction_prob,
            dl.risk_flag,
            dl.model_version,
            dl.timestamp
        FROM decision_log dl
        LEFT JOIN outcomes o
            ON o.decision_log_id = dl.id
        WHERE
            datetime(dl.timestamp) <= datetime(?)
            AND o.id IS NULL
        ORDER BY dl.timestamp ASC
        """,
        (
            cutoff.strftime("%Y-%m-%d %H:%M:%S"),
        )
    ).fetchall()

    conn.close()

    return rows


# ---------------------------------------------------------
# Determine actual outcome
# ---------------------------------------------------------

def determine_outcome_from_events(
    sku,
    prediction_timestamp,
    test_mode=False,
    forced_outcome=None
):
    """
    Determines the observed stockout outcome.

    IMPORTANT:
    The current repository stores raw retail events rather than
    a physical inventory-level table.

    Therefore:
      - test mode can explicitly provide a deterministic outcome
      - production/local event-derived logic can be extended when
        actual inventory data becomes available
    """

    if test_mode:
        if forced_outcome is not None:
            return bool(forced_outcome)

        # Deterministic demo behaviour:
        # high-risk predictions are treated as stockout=True.
        return True

    # -----------------------------------------------------
    # Current repository limitation
    # -----------------------------------------------------
    #
    # raw_events contains sales transactions:
    #
    #   stock_code
    #   quantity
    #   invoice_date
    #
    # but does not contain actual inventory levels.
    #
    # Therefore we cannot honestly infer a physical stockout
    # from the current database alone.
    #
    raise RuntimeError(
        f"Actual inventory ground truth is not available for SKU "
        f"{sku}. raw_events contains transactions, but no physical "
        f"inventory-level field/table. Use --test for local Phase 8 "
        f"demonstration or connect the real inventory source."
    )


# ---------------------------------------------------------
# Record outcome
# ---------------------------------------------------------

def record_outcome(
    decision_log_id,
    actual_stockout_occurred
):
    """
    Uses the existing application's POST /outcomes endpoint.
    """

    url = f"{API_URL.rstrip('/')}/outcomes"

    headers = {}

    if API_KEY:
        headers["X-API-Key"] = API_KEY

    payload = {
        "decision_log_id": decision_log_id,
        "actual_stockout_occurred": actual_stockout_occurred
    }

    response = requests.post(
        url,
        json=payload,
        headers=headers,
        timeout=15
    )

    response.raise_for_status()

    return response.json()


# ---------------------------------------------------------
# Main job
# ---------------------------------------------------------

def run_outcome_checker(
    days=7,
    test_mode=False,
    forced_outcome=None
):
    print("=" * 60)
    print("PHASE 8 — OUTCOME CHECKER")
    print("=" * 60)

    print(f"Database: {get_sqlite_path()}")
    print(f"Outcome age threshold: {days} days")
    print(f"Test mode: {test_mode}")
    print()

    predictions = get_predictions_due_for_outcome(days)

    print(
        f"Found {len(predictions)} prediction(s) "
        f"eligible for outcome checking."
    )

    if not predictions:
        print("Nothing to process.")
        return

    processed = 0
    failed = 0

    for row in predictions:

        (
            decision_log_id,
            sku,
            probability,
            risk_flag,
            model_version,
            timestamp
        ) = row

        print()
        print("-" * 60)
        print(f"Decision ID : {decision_log_id}")
        print(f"SKU         : {sku}")
        print(f"Probability : {probability}")
        print(f"Risk flag   : {risk_flag}")
        print(f"Model       : {model_version}")
        print(f"Prediction  : {timestamp}")

        try:

            actual_outcome = determine_outcome_from_events(
                sku=sku,
                prediction_timestamp=timestamp,
                test_mode=test_mode,
                forced_outcome=forced_outcome
            )

            print(
                f"Actual stockout: {actual_outcome}"
            )

            result = record_outcome(
                decision_log_id=decision_log_id,
                actual_stockout_occurred=actual_outcome
            )

            print(
                f"Outcome recorded successfully: {result}"
            )

            processed += 1

        except Exception as exc:

            failed += 1

            print(
                f"Outcome processing failed: {exc}"
            )

    print()
    print("=" * 60)
    print("OUTCOME CHECK COMPLETE")
    print("=" * 60)
    print(f"Processed : {processed}")
    print(f"Failed    : {failed}")


# ---------------------------------------------------------
# CLI
# ---------------------------------------------------------

def parse_args():

    parser = argparse.ArgumentParser(
        description="Phase 8 outcome checking job"
    )

    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Prediction age threshold in days."
    )

    parser.add_argument(
        "--test",
        action="store_true",
        help="Run using deterministic local test outcomes."
    )

    parser.add_argument(
        "--outcome",
        type=int,
        choices=[0, 1],
        default=None,
        help="Forced test outcome: 1=stockout, 0=no stockout."
    )

    return parser.parse_args()


if __name__ == "__main__":

    args = parse_args()

    run_outcome_checker(
        days=args.days,
        test_mode=args.test,
        forced_outcome=args.outcome
    )