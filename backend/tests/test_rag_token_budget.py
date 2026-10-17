import pytest
from pydantic import ValidationError

from backend.app.models.proxy import RAGRetrieveRequest
from backend.app.services.token_governor import estimate_tokens


def test_rag_retrieval_fanout_is_capped_at_eight_chunks():
    request = RAGRetrieveRequest(query="token budget", topK=8)
    assert request.topK == 8

    with pytest.raises(ValidationError):
        RAGRetrieveRequest(query="token budget", topK=9)


def test_eight_maximum_sized_chunks_fit_utility_text_budget_estimate():
    maximum_retrieved_text = "x" * (8 * 4_000)
    assert estimate_tokens(maximum_retrieved_text) == 8_000
