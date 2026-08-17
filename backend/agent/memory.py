import os
from typing import List, Dict, Any

import chromadb
from sentence_transformers import SentenceTransformer


class IncidentMemory:
    """
    Phase 7 historical incident memory.

    Stores historical retail incidents in ChromaDB
    and retrieves the most similar incidents for a
    new stockout-risk prediction.
    """

    def __init__(
        self,
        persist_directory: str = None,
        collection_name: str = "retail_incidents"
    ):
        if persist_directory is None:
            persist_directory = os.getenv(
                "CHROMA_PERSIST_DIR",
                os.path.join(
                    os.path.dirname(__file__),
                    "chroma_data"
                )
            )

        self.persist_directory = persist_directory

        # Persistent local ChromaDB
        self.client = chromadb.PersistentClient(
            path=self.persist_directory
        )

        self.collection = self.client.get_or_create_collection(
            name=collection_name
        )

        # Small, lightweight embedding model
        self.embedding_model = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

    def _build_incident_text(
        self,
        sku: str,
        prediction_probability: float,
        features: Dict[str, Any],
        outcome: str = None
    ) -> str:
        """
        Convert an incident into text suitable for embedding.
        """

        feature_text = ", ".join(
            f"{key}={value}"
            for key, value in features.items()
        )

        outcome_text = (
            f", outcome={outcome}"
            if outcome is not None
            else ""
        )

        return (
            f"SKU={sku}, "
            f"stockout_probability={prediction_probability:.4f}, "
            f"features=[{feature_text}]"
            f"{outcome_text}"
        )

    def add_incident(
        self,
        incident_id: str,
        sku: str,
        prediction_probability: float,
        features: Dict[str, Any],
        outcome: str = None
    ) -> None:
        """
        Store one historical incident.
        """

        text = self._build_incident_text(
            sku=sku,
            prediction_probability=prediction_probability,
            features=features,
            outcome=outcome
        )

        embedding = self.embedding_model.encode(
            text
        ).tolist()

        metadata = {
            "sku": sku,
            "prediction_probability": float(
                prediction_probability
            ),
            "outcome": outcome or "unknown"
        }

        self.collection.upsert(
            ids=[str(incident_id)],
            documents=[text],
            embeddings=[embedding],
            metadatas=[metadata]
        )

    def retrieve_similar_incidents(
        self,
        sku: str,
        prediction_probability: float,
        features: Dict[str, Any],
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the most similar historical incidents.
        """

        if self.collection.count() == 0:
            return []

        query_text = self._build_incident_text(
            sku=sku,
            prediction_probability=prediction_probability,
            features=features
        )

        query_embedding = self.embedding_model.encode(
            query_text
        ).tolist()

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=min(
                top_k,
                self.collection.count()
            )
        )

        incidents = []

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]

        for index, document in enumerate(documents):
            incidents.append({
                "id": ids[index],
                "document": document,
                "metadata": metadatas[index],
                "distance": distances[index]
            })

        return incidents