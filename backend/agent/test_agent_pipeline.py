from backend.agent.service import AgentService


class FakeLLM:
    def generate_explanation(self, prompt: str) -> str:
        return "TEST LLM: Stockout risk is elevated due to the supplied inventory and demand features."


agent = AgentService(llm=FakeLLM())


features = {
    "daily_sales_avg_7": 20,
    "daily_sales_avg_14": 18,
    "daily_sales_avg_30": 16,
    "demand_velocity": 0.88,
    "simulated_inventory": 4,
    "inventory_to_sales_ratio": 0.20,
    "inventory_to_sales_ratio_7": 1.2,
    "day_of_week": 3,
    "month": 8,
    "holiday_flag": 0
}


result = agent.analyze_prediction(
    sku="SKU_TEST",
    probability=0.80,
    features=features
)


print("\n===== AGENT RESULT =====")
print("SKU:", result["sku"])
print("Probability:", result["stockout_probability"])
print("Action:", result["action"])
print("LLM Status:", result["llm_status"])
print("Incident Count:", result["incident_count"])
print("Explanation:", result["explanation"])
print("========================\n")