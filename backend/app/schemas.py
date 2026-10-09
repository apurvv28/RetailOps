from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class FeatureContribution(BaseModel):
    feature: str
    value: float
    importance: float

# 1. Irrigation Risk Schemas
class IrrigationPredictionRequest(BaseModel):
    field_id: Optional[str] = "FIELD_001"
    nitrogen: float = Field(default=50.0, ge=0, le=200, description="Nitrogen content (kg/ha)")
    phosphorus: float = Field(default=30.0, ge=0, le=200, description="Phosphorus content (kg/ha)")
    potassium: float = Field(default=30.0, ge=0, le=200, description="Potassium content (kg/ha)")
    temperature: float = Field(default=28.5, ge=0.0, le=60.0, description="Ambient temperature (°C)")
    humidity: float = Field(default=65.0, ge=0.0, le=100.0, description="Relative humidity (%)")
    soil_moisture: float = Field(default=25.0, ge=0.0, le=100.0, description="Soil moisture content (%)")
    rainfall: float = Field(default=0.0, ge=0.0, le=500.0, description="Expected rainfall (mm)")
    ph: float = Field(default=6.5, ge=3.0, le=10.0, description="Soil pH")


class IrrigationPredictionResponse(BaseModel):
    field_id: str
    moisture_depletion_risk: float
    risk_flag: bool
    decision_log_id: Optional[int] = None
    top_features: List[FeatureContribution] = []

# 2. Crop Recommendation Schemas
class CropPredictionRequest(BaseModel):
    field_id: Optional[str] = "FIELD_001"
    N: float = Field(default=90.0, ge=0, le=200, description="Nitrogen (kg/ha)")
    P: float = Field(default=42.0, ge=0, le=200, description="Phosphorus (kg/ha)")
    K: float = Field(default=43.0, ge=0, le=200, description="Potassium (kg/ha)")
    temperature: float = Field(default=20.8, ge=0.0, le=60.0, description="Ambient temperature (°C)")
    humidity: float = Field(default=82.0, ge=0.0, le=100.0, description="Relative humidity (%)")
    ph: float = Field(default=6.5, ge=3.0, le=10.0, description="Soil pH")
    rainfall: float = Field(default=202.9, ge=0.0, le=500.0, description="Annual rainfall (mm)")

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
    temperature: float = Field(default=26.0, ge=0.0, le=60.0, description="Ambient temperature (°C)")
    humidity: float = Field(default=52.0, ge=0.0, le=100.0, description="Relative humidity (%)")
    moisture: float = Field(default=38.0, ge=0.0, le=100.0, description="Soil moisture (%)")
    soil_type: str = "Clayey"
    crop_type: str = "Paddy"
    nitrogen: float = Field(default=12.0, ge=0, le=200, description="Nitrogen (kg/ha)")
    phosphorus: float = Field(default=35.0, ge=0, le=200, description="Phosphorus (kg/ha)")
    potassium: float = Field(default=10.0, ge=0, le=200, description="Potassium (kg/ha)")

class FertilizerPredictionResponse(BaseModel):
    field_id: str
    recommended_fertilizer: str
    confidence: float
    nutrient_deficiency_summary: str
    llm_explanation: Optional[str] = None
    decision_log_id: Optional[int] = None

# 4. Crop Yield Prediction Schemas
class YieldPredictionRequest(BaseModel):
    field_id: Optional[str] = "FIELD_001"
    nitrogen: float = Field(default=90.0, ge=0.0, le=200.0, description="Nitrogen (kg/ha)")
    phosphorus: float = Field(default=42.0, ge=0.0, le=200.0, description="Phosphorus (kg/ha)")
    potassium: float = Field(default=43.0, ge=0.0, le=200.0, description="Potassium (kg/ha)")
    temperature: float = Field(default=25.0, ge=0.0, le=60.0, description="Ambient temperature (°C)")
    humidity: float = Field(default=70.0, ge=0.0, le=100.0, description="Relative humidity (%)")
    soil_moisture: float = Field(default=35.0, ge=0.0, le=100.0, description="Soil moisture (%)")
    rainfall: float = Field(default=200.0, ge=0.0, le=500.0, description="Annual rainfall (mm)")
    ph: float = Field(default=6.5, ge=3.0, le=10.0, description="Soil pH")
    crop_type: str = Field(default="rice", description="Crop type name")

class YieldPredictionResponse(BaseModel):
    field_id: str
    predicted_yield_tonnes_per_hectare: float
    unit: str = "tonnes / hectare"
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

class ClerkAuthRequest(BaseModel):
    clerk_token: str
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
