import os
import sys
import logging
import sqlite3
import pandas as pd
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

logger = logging.getLogger("krishiloop.s3_archiver")

# Load environment
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

AWS_PROFILE = os.getenv("AWS_PROFILE", "krishiloop")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "krishiloop-ml-artifacts")

def get_boto3_session():
    region = AWS_DEFAULT_REGION
    profile = AWS_PROFILE
    try:
        if profile:
            return boto3.Session(profile_name=profile, region_name=region)
    except Exception:
        pass
    return boto3.Session(
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=region
    )

def get_s3_client():
    session = get_boto3_session()
    return session.client('s3')

def get_db_connection():
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    db_path = os.path.join(backend_dir, "retail_ops.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def sync_telemetry_to_s3(limit: int = None) -> dict:
    """
    Dumps raw telemetry data from database to S3 bucket for SageMaker model retraining.
    Uploads both a master dataset and a partitioned daily archive.
    """
    try:
        conn = get_db_connection()
        query = "SELECT * FROM raw_telemetry ORDER BY id ASC"
        if limit and limit > 0:
            query += f" LIMIT {limit}"
        df = pd.read_sql_query(query, conn)
        conn.close()

        if df.empty:
            logger.info("No telemetry records found in database to sync.")
            return {"status": "empty", "records": 0, "message": "No telemetry records to sync."}

        s3 = get_s3_client()
        now = datetime.now()
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")

        # 1. Upload Master Telemetry Dataset for Retraining
        master_key = "telemetry/raw_telemetry_master.csv"
        csv_buffer = df.to_csv(index=False)
        s3.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=master_key,
            Body=csv_buffer.encode('utf-8'),
            ContentType='text/csv'
        )

        # 2. Upload Date-Partitioned Archive
        partition_key = f"telemetry/year={now.year}/month={now.strftime('%m')}/day={now.strftime('%d')}/telemetry_{timestamp_str}.csv"
        s3.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=partition_key,
            Body=csv_buffer.encode('utf-8'),
            ContentType='text/csv'
        )

        master_s3_uri = f"s3://{AWS_S3_BUCKET}/{master_key}"
        partition_s3_uri = f"s3://{AWS_S3_BUCKET}/{partition_key}"

        logger.info(f"Successfully archived {len(df)} telemetry rows to S3: {master_s3_uri} & {partition_s3_uri}")

        return {
            "status": "success",
            "records": len(df),
            "master_s3_uri": master_s3_uri,
            "partition_s3_uri": partition_s3_uri,
            "bucket": AWS_S3_BUCKET,
            "timestamp": now.isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to sync telemetry to S3: {e}")
        return {
            "status": "error",
            "error": str(e),
            "records": 0
        }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Testing Telemetry Sync to AWS S3...")
    result = sync_telemetry_to_s3()
    print("Result:", result)
