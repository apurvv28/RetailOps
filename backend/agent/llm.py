import os
from dotenv import load_dotenv
import boto3


# Load environment variables from backend/.env
dotenv_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    ".env"
)

load_dotenv(dotenv_path, override=True)


class BedrockExplanationProvider:
    """
    Real Amazon Bedrock LLM provider for Phase 7.

    The provider is responsible only for communicating
    with Amazon Bedrock and generating an explanation.

    Agent decision and guardrail logic is handled by service.py.
    """

    def __init__(self):
        self.region = os.getenv(
            "AWS_DEFAULT_REGION",
            "us-east-1"
        )

        self.model_id = os.getenv("BEDROCK_MODEL_ID")

        if not self.model_id:
            raise ValueError(
                "BEDROCK_MODEL_ID is not configured."
            )

        self.client = boto3.client(
            "bedrock-runtime",
            region_name=self.region
        )

    def generate_explanation(self, prompt: str) -> str:
        """
        Send a prompt to Amazon Bedrock using the
        Converse API.

        Converse provides a common interface across
        supported Bedrock foundation models.
        """

        response = self.client.converse(
            modelId=self.model_id,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            inferenceConfig={
                "maxTokens": 500,
                "temperature": 0.2
            }
        )

        output = response.get("output", {})
        message = output.get("message", {})
        content = message.get("content", [])

        texts = []

        for item in content:
            if "text" in item:
                texts.append(item["text"])

        return "\n".join(texts).strip()