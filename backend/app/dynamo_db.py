import os
import boto3
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger("krishiloop.dynamodb")

AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
AWS_PROFILE = os.getenv("AWS_PROFILE", "krishiloop")
USERS_TABLE_NAME = os.getenv("DYNAMODB_USERS_TABLE", "krishiloop_users")
PROFILES_TABLE_NAME = os.getenv("DYNAMODB_PROFILES_TABLE", "krishiloop_farmer_profiles")

def get_dynamodb_resource():
    try:
        if AWS_PROFILE:
            session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
            return session.resource("dynamodb", region_name=AWS_REGION)
    except Exception:
        pass
    return boto3.resource("dynamodb", region_name=AWS_REGION)

def get_user_by_email_or_google_id(email: str, google_id: str = None) -> dict:
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(USERS_TABLE_NAME)
    
    # 1. Query by primary key (email)
    try:
        res = table.get_item(Key={"email": email.lower()})
        if "Item" in res:
            return res["Item"]
    except Exception as e:
        logger.warning(f"DynamoDB get_item error for email {email}: {e}")

    # 2. Query by GSI (google_id)
    if google_id:
        try:
            res = table.query(
                IndexName="google_id-index",
                KeyConditionExpression=boto3.dynamodb.conditions.Key("google_id").eq(google_id)
            )
            items = res.get("Items", [])
            if items:
                return items[0]
        except Exception as e:
            logger.warning(f"DynamoDB query error for google_id {google_id}: {e}")

    return None

def save_user(user_data: dict) -> dict:
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(USERS_TABLE_NAME)
    
    item = {
        "email": user_data["email"].lower(),
        "id": str(user_data.get("id", user_data["email"].lower())),
        "google_id": user_data.get("google_id", ""),
        "name": user_data.get("name", ""),
        "picture": user_data.get("picture", ""),
        "role": user_data.get("role", "farmer"),
        "is_demo": int(user_data.get("is_demo", 0)),
        "created_at": user_data.get("created_at", "")
    }
    
    table.put_item(Item=item)
    return item

def get_or_create_farmer_profile(user_id: str, name: str) -> dict:
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(PROFILES_TABLE_NAME)
    
    try:
        res = table.get_item(Key={"user_id": str(user_id)})
        if "Item" in res:
            return res["Item"]
    except Exception as e:
        logger.warning(f"DynamoDB get profile error: {e}")

    # Create default profile
    default_profile = {
        "user_id": str(user_id),
        "farm_name": f"{name}'s Farm",
        "gps_latitude": "18.5204",
        "gps_longitude": "73.8567",
        "region": "Maharashtra",
        "current_crops": "Paddy, Cotton",
        "sensors_config": '{"soil_moisture_sensor": true, "npk_sensor": true, "weather_station": true}'
    }
    try:
        table.put_item(Item=default_profile)
    except Exception as e:
        logger.warning(f"DynamoDB put default profile error: {e}")

    return default_profile
