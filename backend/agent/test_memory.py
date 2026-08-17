from memory import IncidentMemory


memory = IncidentMemory(
    persist_directory="./test_chroma"
)

memory.add_incident(
    incident_id="incident_001",
    sku="SKU_001",
    prediction_probability=0.91,
    features={
        "demand_velocity": 0.88,
        "simulated_inventory": 4,
        "inventory_to_sales_ratio_7": 1.2
    },
    outcome="stockout"
)

memory.add_incident(
    incident_id="incident_002",
    sku="SKU_002",
    prediction_probability=0.78,
    features={
        "demand_velocity": 0.72,
        "simulated_inventory": 7,
        "inventory_to_sales_ratio_7": 2.1
    },
    outcome="stockout"
)

results = memory.retrieve_similar_incidents(
    sku="SKU_NEW",
    prediction_probability=0.85,
    features={
        "demand_velocity": 0.82,
        "simulated_inventory": 5,
        "inventory_to_sales_ratio_7": 1.5
    },
    top_k=3
)

print("\nSimilar incidents:")
for result in results:
    print(result)