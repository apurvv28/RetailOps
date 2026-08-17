from typing import Dict, Any, List

from backend.agent.memory import IncidentMemory
from backend.agent.llm import BedrockExplanationProvider


class AgentService:
    """
    Phase 7 Agent Service.

    Responsible for:

    1. Receiving ML prediction
    2. Retrieving similar historical incidents
    3. Applying deterministic guardrails
    4. Generating explanation using Amazon Bedrock
    5. Returning structured agent decision
    """

    def __init__(
        self,
        memory: IncidentMemory = None,
        llm: BedrockExplanationProvider = None
    ):
        self.memory = memory or IncidentMemory()

        # LLM is initialized lazily so that the rest of
        # Phase 7 can be tested without AWS credentials.
        self.llm = llm

    def _get_llm(self):
        if self.llm is None:
            self.llm = BedrockExplanationProvider()

        return self.llm

    def determine_action(
        self,
        probability: float
    ) -> str:
        """
        Deterministic safety guardrail.

        > 0.70  -> auto_action
        0.40-0.70 -> human_review
        < 0.40 -> no_action
        """

        if probability > 0.70:
            return "auto_action"

        if probability >= 0.40:
            return "human_review"

        return "no_action"

    def build_prompt(
        self,
        sku: str,
        probability: float,
        features: Dict[str, Any],
        incidents: List[Dict[str, Any]],
        action: str
    ) -> str:
        """
        Build a controlled prompt for the Bedrock LLM.
        """

        feature_text = "\n".join(
            f"- {key}: {value}"
            for key, value in features.items()
        )

        if incidents:
            incident_text = "\n".join(
                f"- {incident['document']}"
                for incident in incidents
            )
        else:
            incident_text = "No similar historical incidents found."

        return f"""
You are the explanation component of a retail stockout-risk
decision system.

Your job is to explain the machine-learning prediction clearly
and concisely for an operations team.

IMPORTANT RULES:
- Do not invent facts.
- Only use the supplied prediction, features and historical incidents.
- Do not change the deterministic action decision.
- Do not claim that an action was executed.
- Clearly distinguish prediction from recommendation.

CURRENT PREDICTION

SKU: {sku}
Stockout probability: {probability:.4f}
Guardrail decision: {action}

FEATURES

{feature_text}

SIMILAR HISTORICAL INCIDENTS

{incident_text}

Return an explanation containing:

1. Risk assessment
2. Main contributing factors
3. Relevant historical evidence
4. Recommended operational response
5. A short reason for the guardrail decision

Keep the explanation concise and suitable for an operations dashboard.
"""

    def analyze_prediction(
        self,
        sku: str,
        probability: float,
        features: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Complete Phase 7 analysis pipeline.
        """

        # --------------------------------------------------
        # 1. Determine action using deterministic guardrail
        # --------------------------------------------------

        action = self.determine_action(probability)

        # --------------------------------------------------
        # 2. Retrieve historical incidents
        # --------------------------------------------------

        incidents = self.memory.retrieve_similar_incidents(
            sku=sku,
            prediction_probability=probability,
            features=features,
            top_k=3
        )

        # --------------------------------------------------
        # 3. Build LLM prompt
        # --------------------------------------------------

        prompt = self.build_prompt(
            sku=sku,
            probability=probability,
            features=features,
            incidents=incidents,
            action=action
        )

        # --------------------------------------------------
        # 4. Generate explanation
        # --------------------------------------------------

        explanation = None
        llm_status = "not_called"

        try:
            llm = self._get_llm()

            explanation = llm.generate_explanation(
                prompt
            )

            llm_status = "success"

        except Exception as exc:
            # LLM failure must NOT override the safety
            # guardrail decision.

            explanation = (
                f"LLM explanation unavailable. "
                f"Guardrail decision remains '{action}'. "
                f"Reason: {str(exc)}"
            )

            llm_status = "fallback"

        # --------------------------------------------------
        # 5. Return structured result
        # --------------------------------------------------

        return {
            "sku": sku,
            "stockout_probability": probability,
            "action": action,
            "explanation": explanation,
            "llm_status": llm_status,
            "similar_incidents": incidents,
            "incident_count": len(incidents)
        }