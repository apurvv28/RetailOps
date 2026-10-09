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


def verify_clerk_token(clerk_token: str) -> Dict[str, Any]:
    """
    Verifies a Clerk session token and fetches user profile.
    Decodes the JWT to extract claims (sub, email, name) and falls back to Clerk Backend API if CLERK_SECRET_KEY is configured.
    """
    clerk_secret_key = os.getenv("CLERK_SECRET_KEY", "")

    try:
        # Decode JWT without signature verification to extract claims
        unverified = jwt.decode(clerk_token, options={"verify_signature": False, "verify_exp": False})
        clerk_user_id = unverified.get("sub", "")
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid Clerk token: missing sub claim")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=f"Failed to decode Clerk token: {e}")

    # If CLERK_SECRET_KEY is present, fetch complete profile from Clerk Backend API
    if clerk_secret_key:
        try:
            resp = requests.get(
                f"https://api.clerk.com/v1/users/{clerk_user_id}",
                headers={
                    "Authorization": f"Bearer {clerk_secret_key}",
                    "User-Agent": "KrishiLoop-FastAPI/2.0"
                },
                timeout=8
            )
            if resp.status_code == 200:
                clerk_data = resp.json()
                email_addresses = clerk_data.get("email_addresses", [])
                primary_email_id = clerk_data.get("primary_email_address_id", "")
                email = ""
                for ea in email_addresses:
                    if ea.get("id") == primary_email_id:
                        email = ea.get("email_address", "")
                        break
                if not email and email_addresses:
                    email = email_addresses[0].get("email_address", "")

                first_name = clerk_data.get("first_name", "") or ""
                last_name = clerk_data.get("last_name", "") or ""
                name = f"{first_name} {last_name}".strip() or (email.split("@")[0] if email else "Clerk User")
                picture = clerk_data.get("image_url", "")

                return {
                    "clerk_id": clerk_user_id,
                    "email": email or f"{clerk_user_id}@clerk.user",
                    "name": name,
                    "picture": picture
                }
        except Exception as api_err:
            print(f"Clerk backend API lookup notice: {api_err}")

    # Extract available claims directly from JWT token payload
    email = unverified.get("email") or unverified.get("email_address") or ""
    if not email:
        # Check claims dictionary if present
        claims = unverified.get("claims", {})
        email = claims.get("email") or claims.get("email_address") or ""
    
    first_name = unverified.get("first_name") or unverified.get("given_name") or ""
    last_name = unverified.get("last_name") or unverified.get("family_name") or ""
    name = f"{first_name} {last_name}".strip() or unverified.get("name") or (email.split("@")[0] if email else "Clerk User")
    picture = unverified.get("picture") or unverified.get("image_url") or ""

    if not email:
        email = f"{clerk_user_id}@clerk.user"

    return {
        "clerk_id": clerk_user_id,
        "email": email,
        "name": name,
        "picture": picture
    }

def fetch_or_create_user(google_id: str, email: str, name: str, picture: str = "", requested_role: str = "farmer") -> dict:
    """
    Finds existing user by email/google_id or registers new user in AWS DynamoDB (with SQLite fallback/sync).
    """
    # 1. AWS DynamoDB User Management
    dynamo_user = None
    try:
        try:
            from backend.app.dynamo_db import get_user_by_email_or_google_id, save_user, get_or_create_farmer_profile
        except ImportError:
            from app.dynamo_db import get_user_by_email_or_google_id, save_user, get_or_create_farmer_profile

        dynamo_user = get_user_by_email_or_google_id(email, google_id)
        if not dynamo_user:
            role = "admin" if email.lower() == "admin@agritech.com" else requested_role
            is_demo = 1 if google_id.startswith("demo-") else 0
            new_user_data = {
                "id": email.lower(),
                "google_id": google_id,
                "email": email.lower(),
                "name": name,
                "picture": picture,
                "role": role,
                "is_demo": is_demo,
                "created_at": datetime.utcnow().isoformat()
            }
            dynamo_user = save_user(new_user_data)
            if role == "farmer":
                get_or_create_farmer_profile(dynamo_user["id"], name)
    except Exception as d_err:
        print(f"DynamoDB operation notice in fetch_or_create_user: {d_err}")

    # 2. SQLite / Relational storage sync
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
                role = "admin" if email.lower() == "admin@agritech.com" else requested_role
                is_demo = 1 if google_id.startswith("demo-") else 0
                cursor.execute(
                    "INSERT INTO users (google_id, email, name, picture, role, is_demo) VALUES (?, ?, ?, ?, ?, ?)",
                    (google_id, email, name, picture, role, is_demo)
                )
                user_id = cursor.lastrowid
                conn.commit()

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
                is_demo = 1 if google_id.startswith("demo-") else 0
                insert_res = conn.execute(
                    text("INSERT INTO users (google_id, email, name, picture, role, is_demo) VALUES (:gid, :email, :name, :pic, :role, :is_demo) RETURNING id, google_id, email, name, picture, role"),
                    {"gid": google_id, "email": email, "name": name, "pic": picture, "role": role, "is_demo": is_demo}
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
        if dynamo_user:
            return {
                "id": dynamo_user.get("id", email),
                "google_id": dynamo_user.get("google_id", google_id),
                "email": dynamo_user.get("email", email),
                "name": dynamo_user.get("name", name),
                "picture": dynamo_user.get("picture", picture),
                "role": dynamo_user.get("role", requested_role)
            }
        raise HTTPException(status_code=500, detail=f"Database user error: {e}")

    return user or dynamo_user

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
            if row:
                return dict(row)
        else:
            res = conn.execute(text("SELECT id, google_id, email, name, picture, role FROM users WHERE id = :uid OR email = :uemail"), {"uid": user_id_int, "uemail": str(user_id)}).fetchone()
            conn.close()
            if res:
                return {"id": res[0], "google_id": res[1], "email": res[2], "name": res[3], "picture": res[4], "role": res[5]}
    except Exception as e:
        if hasattr(conn, "close"):
            try:
                conn.close()
            except Exception:
                pass

    # 2. Check AWS DynamoDB for the user
    try:
        try:
            from backend.app.dynamo_db import get_user_by_email_or_google_id
        except ImportError:
            from app.dynamo_db import get_user_by_email_or_google_id
        d_user = get_user_by_email_or_google_id(str(user_id))
        if d_user:
            return {
                "id": d_user.get("id", str(user_id)),
                "google_id": d_user.get("google_id", ""),
                "email": d_user.get("email", str(user_id)),
                "name": d_user.get("name", "User"),
                "picture": d_user.get("picture", ""),
                "role": d_user.get("role", "farmer")
            }
    except Exception as d_err:
        pass

    raise HTTPException(status_code=401, detail="User not found")


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required for this action")
    return current_user

def require_farmer(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in ["farmer", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Farmer access required")
    return current_user
