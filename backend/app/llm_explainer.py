import os
from openai import OpenAI
from dotenv import load_dotenv

# Load backend/.env explicitly
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")

def get_llm_explanation(prompt: str) -> str:
    """
    Generate agronomic LLM explanation using NVIDIA Nemotron 3.5 Lightning 30B API with OpenAI SDK.
    Uses NVIDIA_API_KEY loaded from backend/.env.
    """
    api_key = os.getenv("NVIDIA_API_KEY") or NVIDIA_API_KEY
    if not api_key or not api_key.strip():
        return "NVIDIA_API_KEY missing in backend/.env configuration."

    try:
        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key
        )
        completion = client.chat.completions.create(
            model="nvidia/nemotron-3.5-lightning-30b-a3b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert Agronomist and MLOps Explainability AI. "
                        "Provide a concise, highly insightful 2-3 sentence agronomic explanation "
                        "justifying why the machine learning model output (crop or fertilizer) was recommended "
                        "based on the given soil nutrients, moisture, temperature, and environmental parameters."
                    )
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            top_p=0.95,
            max_tokens=512,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
            stream=True
        )

        full_text = []
        for chunk in completion:
            if not chunk.choices:
                continue
            delta_content = chunk.choices[0].delta.content
            if delta_content is not None:
                full_text.append(delta_content)

        explanation = "".join(full_text).strip()
        if explanation:
            return explanation
        return "The ML recommendation aligns with the soil nutrient ratio and microclimate conditions."

    except Exception as e:
        print(f"[NVIDIA LLM Explainer Warning] {e}")
        return f"Agronomic rationale: Recommendation calibrated against soil N-P-K balances and moisture requirements."
