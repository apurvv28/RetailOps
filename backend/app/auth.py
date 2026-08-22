import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
import requests
from fastapi import HTTPException, status, Depends, Header
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)

JWT_SECRET = os.getenv("JWT_SECRET", "agritech-cockroach-rbac-secret-key-2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

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

def get_db_connection():
    if DATABASE_URL.startswith("sqlite:///"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    else:
        engine = create_engine(DATABASE_URL)
        return engine.connect()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def verify_google_id_token(id_token: str) -> Dict[str, Any]:
    """
    Verifies a Google OAuth ID Token via Google's tokeninfo endpoint.
    Returns payload containing email, name, picture, sub (google_id).
    """
    try:
        resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "google_id": data.get("sub"),
                "email": data.get("email"),
                "name": data.get("name") or data.get("email", "").split("@")[0],
                "picture": data.get("picture", "")
            }
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google OAuth token")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Google token verification failed: {e}")

def exchange_google_code(code: str, redirect_uri: str) -> Dict[str, Any]:
    """
    Exchanges Google OAuth Authorization Code for tokens and fetches user profile.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri
    }
    
    try:
        resp = requests.post(token_url, data=payload, timeout=8)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Google OAuth token exchange failed: {resp.text}")
        
        token_data = resp.json()
        access_token = token_data.get("access_token")
        
        # Get user info using access token
        user_info_resp = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5
        )
        if user_info_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user profile")
            
        user_info = user_info_resp.json()
        return {
            "google_id": user_info.get("id"),
            "email": user_info.get("email"),
            "name": user_info.get("name") or user_info.get("email", "").split("@")[0],
            "picture": user_info.get("picture", "")
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Google code exchange error: {e}")


def fetch_or_create_user(google_id: str, email: str, name: str, picture: str = "", requested_role: str = "farmer") -> dict:
    """
    Finds existing user by email/google_id or registers new user in CockroachDB/SQLite.
    """
    is_sqlite = DATABASE_URL.startswith("sqlite://")
    conn = get_db_connection()
    user = None

    try:
        if is_sqlite:
            cursor = conn.cursor()
            cursor.execute("SELECT id, google_id, email, name, picture, role FROM users WHERE email = ? OR google_id = ?", (email, google_id))
            row = cursor.fetchone()
            if row:
                user = dict(row)
            else:
                # Assign role: admin@agritech.com defaults to admin, otherwise requested_role
                role = "admin" if email.lower() == "admin@agritech.com" else requested_role
                cursor.execute(
                    "INSERT INTO users (google_id, email, name, picture, role) VALUES (?, ?, ?, ?, ?)",
                    (google_id, email, name, picture, role)
                )
                user_id = cursor.lastrowid
                conn.commit()

                # If farmer, create default farmer profile
                if role == "farmer":
                    cursor.execute(
                        """
                        INSERT INTO farmer_profiles (user_id, farm_name, gps_latitude, gps_longitude, region, current_crops, sensors_config)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (user_id, f"{name}'s Farm", 18.5204, 73.8567, "Maharashtra", "Paddy, Cotton", '{"soil_moisture_sensor": true, "npk_sensor": true, "weather_station": true}')
                    )
                    conn.commit()

                cursor.execute("SELECT id, google_id, email, name, picture, role FROM users WHERE id = ?", (user_id,))
                user = dict(cursor.fetchone())
            conn.close()
        else:
            trans = conn.begin()
            res = conn.execute(text("SELECT id, google_id, email, name, picture, role FROM users WHERE email = :email OR google_id = :gid"), {"email": email, "gid": google_id}).fetchone()
            if res:
                user = {"id": res[0], "google_id": res[1], "email": res[2], "name": res[3], "picture": res[4], "role": res[5]}
            else:
                role = "admin" if email.lower() == "admin@agritech.com" else requested_role
                insert_res = conn.execute(
                    text("INSERT INTO users (google_id, email, name, picture, role) VALUES (:gid, :email, :name, :pic, :role) RETURNING id, google_id, email, name, picture, role"),
                    {"gid": google_id, "email": email, "name": name, "pic": picture, "role": role}
                ).fetchone()
                user = {"id": insert_res[0], "google_id": insert_res[1], "email": insert_res[2], "name": insert_res[3], "picture": insert_res[4], "role": insert_res[5]}

                if role == "farmer":
                    conn.execute(
                        text("""
                            INSERT INTO farmer_profiles (user_id, farm_name, gps_latitude, gps_longitude, region, current_crops, sensors_config)
                            VALUES (:uid, :fname, 18.5204, 73.8567, 'Maharashtra', 'Paddy, Cotton', '{"soil_moisture_sensor": true, "npk_sensor": true, "weather_station": true}')
                        """),
                        {"uid": user["id"], "fname": f"{name}'s Farm"}
                    )
            trans.commit()
            conn.close()
    except Exception as e:
        if hasattr(conn, "close"):
            conn.close()
        raise HTTPException(status_code=500, detail=f"Database user error: {e}")

    return user

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization Bearer header"
        )
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")

    user_id_int = int(user_id) if str(user_id).isdigit() else user_id

    is_sqlite = DATABASE_URL.startswith("sqlite://")
    conn = get_db_connection()
    try:
        if is_sqlite:
            cursor = conn.cursor()
            cursor.execute("SELECT id, google_id, email, name, picture, role FROM users WHERE id = ? OR email = ?", (user_id_int, str(user_id)))
            row = cursor.fetchone()
            conn.close()
            if not row:
                raise HTTPException(status_code=401, detail="User not found")
            return dict(row)
        else:
            res = conn.execute(text("SELECT id, google_id, email, name, picture, role FROM users WHERE id = :uid OR email = :uemail"), {"uid": user_id_int, "uemail": str(user_id)}).fetchone()
            conn.close()
            if not res:
                raise HTTPException(status_code=401, detail="User not found")
            return {"id": res[0], "google_id": res[1], "email": res[2], "name": res[3], "picture": res[4], "role": res[5]}
    except Exception as e:
        if hasattr(conn, "close"):
            conn.close()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"User retrieval error: {e}")


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required for this action")
    return current_user

def require_farmer(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in ["farmer", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Farmer access required")
    return current_user
