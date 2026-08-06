import logging
import sys
import os
import sqlite3
from typing import Dict, Any, Optional
from sqlalchemy import create_engine, text
from config import config

def setup_logger(name: str) -> logging.Logger:
    """Configures structured console logging with timestamp and component context."""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, config.LOG_LEVEL, logging.INFO))
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    return logger

class DatabaseClient:
    """Database interface supporting CockroachDB, PostgreSQL, and SQLite fallback."""

    def __init__(self, db_url: str = config.DATABASE_URL):
        self.db_url = db_url
        self.logger = setup_logger("DatabaseClient")
        self._is_sqlite = db_url.startswith("sqlite:///")

        if not self._is_sqlite:
            self.engine = create_engine(self.db_url, pool_pre_ping=True)
        else:
            self.db_file = db_url.replace("sqlite:///", "")

    def save_decision_log(self, sku: str, prob: float, risk_flag: int, model_version: str, timestamp_str: str) -> Optional[int]:
        """Inserts prediction output directly into decision_log table."""
        try:
            if self._is_sqlite:
                conn = sqlite3.connect(self.db_file)
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO decision_log (sku, prediction_prob, risk_flag, model_version, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (sku, prob, risk_flag, model_version, timestamp_str)
                )
                log_id = cursor.lastrowid
                conn.commit()
                conn.close()
                return log_id
            else:
                with self.engine.connect() as conn:
                    query = text(
                        """
                        INSERT INTO decision_log (sku, prediction_prob, risk_flag, model_version, timestamp)
                        VALUES (:sku, :prob, :flag, :version, :ts)
                        RETURNING id
                        """
                    )
                    res = conn.execute(query, {
                        "sku": sku,
                        "prob": prob,
                        "flag": risk_flag,
                        "version": model_version,
                        "ts": timestamp_str
                    })
                    row = res.fetchone()
                    conn.commit()
                    return row[0] if row else None
        except Exception as e:
            self.logger.error(f"Failed to persist decision log to database: {e}")
            return None
