from pydantic import BaseModel


class PredictionRequest(BaseModel):
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
    stockout_probability: float
    prediction: int