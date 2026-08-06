from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class FeatureContribution(BaseModel):
    feature: str
    value: float
    importance: float

class PredictionRequest(BaseModel):
    sku: Optional[str] = "SKU_UNKNOWN"
    daily_sales_avg_7: float
    daily_sales_avg_14: float
    daily_sales_avg_30: float
    demand_velocity: float
    day_of_week: int
    month: int
    holiday_flag: int
    simulated_inventory: float
    inventory_to_sales_ratio: float
    inventory_to_sales_ratio_7: float

class PredictionResponse(BaseModel):
    sku: str
    stockout_probability: float
    prediction: int
    decision_log_id: Optional[int] = None
    top_features: List[FeatureContribution] = []

class OutcomeRequest(BaseModel):
    decision_log_id: int
    actual_stockout_occurred: bool

class OutcomeResponse(BaseModel):
    status: str
    outcome_id: int
    decision_log_id: int
    actual_stockout_occurred: bool

class AlertRequest(BaseModel):
    sku: str
    decision_log_id: Optional[int] = None
    reason: Optional[str] = "High stockout risk predicted"
    recipient: Optional[str] = None

class AlertResponse(BaseModel):
    status: str
    message: str
    action_id: Optional[int] = None

class DecisionLogItem(BaseModel):
    id: int
    sku: str
    prediction_prob: float
    risk_flag: int
    model_version: str
    timestamp: str

class RecentPredictionsResponse(BaseModel):
    count: int
    predictions: List[DecisionLogItem]

class DriftStatusResponse(BaseModel):
    dataset_drift: bool
    drifted_columns: int
    share_of_drifted_columns: float
    total_features: int
    last_checked: str
    report_available: bool

class ActionItem(BaseModel):
    id: int
    decision_log_id: Optional[int] = None
    sku: str
    action_type: str
    sent_at: str
    recipient: Optional[str] = None
    details: Optional[str] = None

class AlertsHistoryResponse(BaseModel):
    count: int
    alerts: List[ActionItem]