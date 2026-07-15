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

if __name__ == "__main__":
    initialize_database()
