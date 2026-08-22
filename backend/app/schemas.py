from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class FeatureContribution(BaseModel):
    feature: str
    value: float
    importance: float

# 1. Irrigation Risk Schemas
class IrrigationPredictionRequest(BaseModel):
    field_id: Optional[str] = "FIELD_001"
    nitrogen: float = 50.0
    phosphorus: float = 30.0
    potassium: float = 30.0
    temperature: float = 28.5
    humidity: float = 65.0
    soil_moisture: float = 25.0
    rainfall: float = 0.0

class IrrigationPredictionResponse(BaseModel):
    field_id: str
    moisture_depletion_risk: float
    risk_flag: bool
    decision_log_id: Optional[int] = None
    top_features: List[FeatureContribution] = []

# 2. Crop Recommendation Schemas
class CropPredictionRequest(BaseModel):
    field_id: Optional[str] = "FIELD_001"
    N: float = 90.0
    P: float = 42.0
    K: float = 43.0
    temperature: float = 20.8
    humidity: float = 82.0
    ph: float = 6.5
    rainfall: float = 202.9

class CropRecommendationItem(BaseModel):
    crop: str
    confidence: float

class CropPredictionResponse(BaseModel):
    field_id: str
    recommended_crop: str
    confidence: float
    top_3_recommendations: List[CropRecommendationItem] = []
    llm_explanation: Optional[str] = None
    decision_log_id: Optional[int] = None

# 3. Fertilizer Recommendation Schemas
class FertilizerPredictionRequest(BaseModel):
    field_id: Optional[str] = "FIELD_001"
    temperature: float = 26.0
    humidity: float = 52.0
    moisture: float = 38.0
    soil_type: str = "Clayey"
    crop_type: str = "Paddy"
    nitrogen: float = 12.0
    phosphorus: float = 35.0
    potassium: float = 10.0

class FertilizerPredictionResponse(BaseModel):
    field_id: str
    recommended_fertilizer: str
    confidence: float
    nutrient_deficiency_summary: str
    llm_explanation: Optional[str] = None
    decision_log_id: Optional[int] = None

# 4. CropNet Yield Prediction Schemas
class YieldPredictionRequest(BaseModel):
    field_id: Optional[str] = "FIELD_001"
    year: int = 2024
    state_name: str = "ALABAMA"
    county_name: str = "BALDWIN"
    commodity_desc: str = "CORN"
    production_bu: float = 1177000.0

class YieldPredictionResponse(BaseModel):
    field_id: str
    predicted_yield_bu_per_acre: float
    unit: str = "BU / ACRE"
    decision_log_id: Optional[int] = None

# Generic & Monitoring Schemas
class OutcomeRequest(BaseModel):
    decision_log_id: int
    actual_outcome: str

class OutcomeResponse(BaseModel):
    status: str
    outcome_id: int
    decision_log_id: int
    actual_outcome: str

class AlertRequest(BaseModel):
    field_id: str
    model_type: str = "irrigation"
    decision_log_id: Optional[int] = None
    reason: Optional[str] = "High depletion risk or nutrient deficiency"
    recipient: Optional[str] = None

class AlertResponse(BaseModel):
    status: str
    message: str
    action_id: Optional[int] = None

class DecisionLogItem(BaseModel):
    id: int
    field_id: str
    model_type: str
    prediction_output: str
    confidence_score: float
    risk_flag: bool
    model_version: str
    timestamp: str

class RecentPredictionsResponse(BaseModel):
    count: int
    predictions: List[DecisionLogItem]

class ModelDriftDetail(BaseModel):
    model_name: str
    model_key: str
    drift_detected: bool
    drifted_features: List[str]
    total_features: int
    psi_score: float
    status: str

class DriftStatusResponse(BaseModel):
    dataset_drift: bool
    drifted_columns: int
    share_of_drifted_columns: float
    total_features: int
    last_checked: str
    report_available: bool
    model_drifts: Optional[List[ModelDriftDetail]] = []

class ActionItem(BaseModel):
    id: int
    decision_log_id: Optional[int] = None
    field_id: str
    model_type: str
    action_type: str
    sent_at: str
    recipient: Optional[str] = None
    details: Optional[str] = None

class AlertsHistoryResponse(BaseModel):
    count: int
    alerts: List[ActionItem]

# Auth & Farmer Profile Schemas
class GoogleAuthRequest(BaseModel):
    id_token: str
    requested_role: Optional[str] = "farmer"

class DemoLoginRequest(BaseModel):
    role: str = "farmer" # 'admin' or 'farmer'
    email: Optional[str] = None

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class FarmerProfileRequest(BaseModel):
    farm_name: str
    gps_latitude: float
    gps_longitude: float
    region: str
    current_crops: str
    sensors_config: Dict[str, bool]

class FarmerProfileResponse(BaseModel):
    user_id: int
    farm_name: str
    gps_latitude: float
    gps_longitude: float
    region: str
    current_crops: str
    sensors_config: Dict[str, bool]
    updated_at: str
