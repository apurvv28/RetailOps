#!/usr/bin/env python3
"""
Weekly Cron Retraining Runner for KrishiLoop
Executed every week on Sunday at 06:00 AM IST (cron: 0 6 * * 0)
Synchronizes telemetry to AWS S3 and triggers AWS SageMaker model retraining.
"""

import os
import sys
import uuid
import logging
from datetime import datetime
from dotenv import load_dotenv

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Load environment
dotenv_path = os.path.join(project_root, "backend", ".env")
load_dotenv(dotenv_path, override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("krishiloop.weekly_cron")

def run_weekly_retraining():
    logger.info("==================================================================")
    logger.info(" KrishiLoop Weekly SageMaker Retraining Cron (Sunday 06:00 AM)   ")
    logger.info(f" Execution Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("==================================================================")

    from backend.training.aws_retrain_dispatcher import dispatch_retraining_job

    job_id = f"weekly_sun6am_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    trigger_source = "CRON_WEEKLY_SUNDAY_06AM"

    try:
        res = dispatch_retraining_job(job_id=job_id, trigger_source=trigger_source)
        logger.info(f"Weekly retraining job successfully submitted: {res}")
        return res
    except Exception as e:
        logger.error(f"Weekly retraining job submission failed: {e}")
        return {"status": "FAILED", "error": str(e)}

if __name__ == "__main__":
    run_weekly_retraining()
