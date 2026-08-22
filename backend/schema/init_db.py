import os
import re
import sqlite3
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

def get_db_url():
    db_url = os.getenv("DATABASE_URL", "sqlite:///retail_ops.db")
    if db_url.startswith("sqlite:///"):
        db_name = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_name):
            backend_dir = os.path.dirname(os.path.dirname(__file__))
            db_path = os.path.abspath(os.path.join(backend_dir, db_name))
            db_url = "sqlite:///" + db_path.replace('\\', '/')
    return db_url

DATABASE_URL = get_db_url()
SQL_FILE_PATH = os.path.join(os.path.dirname(__file__), "database.sql")

def initialize_database():
    print(f"Connecting to database: {DATABASE_URL}")
    
    # Read DDL content
    with open(SQL_FILE_PATH, 'r') as f:
        ddl = f.read()

    # Determine if SQLite or Postgres/CockroachDB
    is_sqlite = DATABASE_URL.startswith("sqlite://")

    if is_sqlite:
        print("SQLite database detected. Adjusting DDL syntax...")
        # Remove CREATE EXTENSION
        ddl = re.sub(r'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '', ddl)
        # SQLite doesn't support serial, convert SERIAL to INTEGER PRIMARY KEY AUTOINCREMENT
        # But wait, SQLite handles SERIAL as an integer alias, but AUTOINCREMENT needs INTEGER PRIMARY KEY
        # Let's adjust DDL specifically for SQLite
        ddl = ddl.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
        # Remove REFERENCES constraints with ON DELETE CASCADE if it needs separate config, or keep it
        # sqlite supports NUMERIC and VARCHAR natively as text/numeric affinity.
        
        # Connect using sqlite3 directly or sqlalchemy
        # For simplicity, extract database filename
        db_file = DATABASE_URL.replace("sqlite:///", "")
        if not db_file:
            db_file = "retail_ops.db"
        
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # Split DDL by semicolon to execute statement by statement
        statements = [stmt.strip() for stmt in ddl.split(';') if stmt.strip()]
        for stmt in statements:
            try:
                cursor.execute(stmt)
            except Exception as e:
                print(f"Error executing statement: {stmt}\nError: {e}")
                conn.rollback()
                raise e
        conn.commit()
        conn.close()
        print("SQLite Database initialized successfully!")
    else:
        # Postgres or CockroachDB
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            # Postgres supports running multi-statement DDL via text() block
            # But let's split them to log execution details
            statements = [stmt.strip() for stmt in ddl.split(';') if stmt.strip()]
            
            # Start a transaction
            trans = conn.begin()
            try:
                for stmt in statements:
                    conn.execute(text(stmt))
                trans.commit()
                print("Postgres/CockroachDB Database initialized successfully!")
            except Exception as e:
                trans.rollback()
                print(f"Database initialization failed: {e}")
                raise e

    seed_initial_users()
    seed_initial_models()

def seed_initial_users():
    is_sqlite = DATABASE_URL.startswith("sqlite://")
    try:
        if is_sqlite:
            db_file = DATABASE_URL.replace("sqlite:///", "")
            if not db_file:
                db_file = "retail_ops.db"
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            # Seed Admin
            cursor.execute("SELECT id FROM users WHERE email = 'admin@agritech.com'")
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO users (google_id, email, name, role) VALUES (?, ?, ?, ?)",
                    ("demo-admin-google-id", "admin@agritech.com", "AgriOps System Admin", "admin")
                )
            
            # Seed Farmer
            cursor.execute("SELECT id FROM users WHERE email = 'farmer@agritech.com'")
            farmer_row = cursor.fetchone()
            if not farmer_row:
                cursor.execute(
                    "INSERT INTO users (google_id, email, name, role) VALUES (?, ?, ?, ?)",
                    ("demo-farmer-google-id", "farmer@agritech.com", "Ramesh Kumar (Farmer)", "farmer")
                )
                farmer_id = cursor.lastrowid
                cursor.execute(
                    """
                    INSERT INTO farmer_profiles (user_id, farm_name, gps_latitude, gps_longitude, region, current_crops, sensors_config)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (farmer_id, "Kisan Green Farm", 18.5204, 73.8567, "Pune, Maharashtra", "Paddy, Cotton", '{"soil_moisture_sensor": true, "npk_sensor": true, "weather_station": true}')
                )
            conn.commit()
            conn.close()
        else:
            engine = create_engine(DATABASE_URL)
            with engine.connect() as conn:
                trans = conn.begin()
                admin_check = conn.execute(text("SELECT id FROM users WHERE email = 'admin@agritech.com'")).fetchone()
                if not admin_check:
                    conn.execute(text("INSERT INTO users (google_id, email, name, role) VALUES ('demo-admin-google-id', 'admin@agritech.com', 'AgriOps System Admin', 'admin')"))
                
                farmer_check = conn.execute(text("SELECT id FROM users WHERE email = 'farmer@agritech.com'")).fetchone()
                if not farmer_check:
                    res = conn.execute(text("INSERT INTO users (google_id, email, name, role) VALUES ('demo-farmer-google-id', 'farmer@agritech.com', 'Ramesh Kumar (Farmer)', 'farmer') RETURNING id")).fetchone()
                    farmer_id = res[0]
                    conn.execute(text(f"""
                        INSERT INTO farmer_profiles (user_id, farm_name, gps_latitude, gps_longitude, region, current_crops, sensors_config)
                        VALUES ({farmer_id}, 'Kisan Green Farm', 18.5204, 73.8567, 'Pune, Maharashtra', 'Paddy, Cotton', '{{"soil_moisture_sensor": true, "npk_sensor": true, "weather_station": true}}')
                    """))
                trans.commit()
    except Exception as e:
        print(f"Seed initial users notice: {e}")

def seed_initial_models():
    models = [
        {
            "key": "irrigation",
            "name": "Irrigation Risk Predictor",
            "algorithm": "LightGBM Classifier",
            "version": "v2.0.0",
            "stage": "Production",
            "accuracy": 0.9620,
            "f1": 0.9580,
            "rmse": None,
            "artifact_uri": "models:/irrigation-risk/Production",
            "parameters": '{"n_estimators": 100, "learning_rate": 0.05, "max_depth": 6}',
            "metrics": '{"accuracy": 0.9620, "f1_score": 0.9580, "precision": 0.9650, "recall": 0.9510}'
        },
        {
            "key": "crop",
            "name": "Crop Recommendation Engine",
            "algorithm": "LightGBM Multi-Class Classifier",
            "version": "v2.0.0",
            "stage": "Production",
            "accuracy": 0.9840,
            "f1": 0.9820,
            "rmse": None,
            "artifact_uri": "models:/crop-recommender/Production",
            "parameters": '{"num_class": 22, "n_estimators": 150, "learning_rate": 0.03}',
            "metrics": '{"accuracy": 0.9840, "f1_score": 0.9820, "top_3_accuracy": 0.9980}'
        },
        {
            "key": "fertilizer",
            "name": "Fertilizer Advisory Engine",
            "algorithm": "LightGBM Multi-Class Classifier",
            "version": "v2.0.0",
            "stage": "Production",
            "accuracy": 0.9710,
            "f1": 0.9680,
            "rmse": None,
            "artifact_uri": "models:/fertilizer-recommender/Production",
            "parameters": '{"num_class": 7, "n_estimators": 120, "learning_rate": 0.04}',
            "metrics": '{"accuracy": 0.9710, "f1_score": 0.9680, "precision": 0.9730}'
        },
        {
            "key": "yield",
            "name": "CropNet Yield Predictor",
            "algorithm": "LightGBM Regressor",
            "version": "v1.0.0",
            "stage": "Production",
            "accuracy": None,
            "f1": None,
            "rmse": 12.4500,
            "artifact_uri": "models:/yield-predictor/Production",
            "parameters": '{"objective": "regression", "n_estimators": 200, "learning_rate": 0.03}',
            "metrics": '{"rmse": 12.4500, "r2_score": 0.9420, "mae": 9.1200}'
        }
    ]

    is_sqlite = DATABASE_URL.startswith("sqlite://")
    try:
        if is_sqlite:
            db_file = DATABASE_URL.replace("sqlite:///", "")
            if not db_file:
                db_file = "retail_ops.db"
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            for m in models:
                cursor.execute("SELECT id FROM model_registry WHERE model_key = ?", (m["key"],))
                if not cursor.fetchone():
                    cursor.execute(
                        """
                        INSERT INTO model_registry (model_key, model_name, algorithm, version, stage, accuracy_score, f1_score, rmse_score, artifact_uri, parameters_json, metrics_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (m["key"], m["name"], m["algorithm"], m["version"], m["stage"], m["accuracy"], m["f1"], m["rmse"], m["artifact_uri"], m["parameters"], m["metrics"])
                    )
            conn.commit()
            conn.close()
        else:
            engine = create_engine(DATABASE_URL)
            with engine.connect() as conn:
                trans = conn.begin()
                for m in models:
                    check = conn.execute(text("SELECT id FROM model_registry WHERE model_key = :k"), {"k": m["key"]}).fetchone()
                    if not check:
                        conn.execute(
                            text("""
                                INSERT INTO model_registry (model_key, model_name, algorithm, version, stage, accuracy_score, f1_score, rmse_score, artifact_uri, parameters_json, metrics_json)
                                VALUES (:k, :mn, :alg, :ver, :stg, :acc, :f1, :rmse, :art, :params, :metrics)
                            """),
                            {
                                "k": m["key"], "mn": m["name"], "alg": m["algorithm"], "ver": m["version"], "stg": m["stage"],
                                "acc": m["accuracy"], "f1": m["f1"], "rmse": m["rmse"], "art": m["artifact_uri"],
                                "params": m["parameters"], "metrics": m["metrics"]
                            }
                        )
                trans.commit()
        print("MLOps Model Registry populated in database successfully!")
    except Exception as e:
        print(f"Seed model registry notice: {e}")

if __name__ == "__main__":
    initialize_database()


