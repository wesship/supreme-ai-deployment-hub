import pytest

from backend.app.routers.primetime_scoring import GovernedScoringAdapter, LeadScore


class FakeScorer:
    async def score(self, *, lead_text: str, interaction_text: str) -> LeadScore:
        return LeadScore(score=91, intent=88, confidence=0.94, model="test", model_version="1")


class BadScorer:
    async def score(self, *, lead_text: str, interaction_text: str) -> LeadScore:
        return LeadScore(score=101, intent=20, confidence=0.5, model="test", model_version="1")


@pytest.mark.asyncio
async def test_scoring_result_is_validated():
    result = await GovernedScoringAdapter(FakeScorer()).score(lead_text="lead", interaction_text="hello")
    assert result.score == 91


@pytest.mark.asyncio
async def test_invalid_score_is_rejected():
    with pytest.raises(ValueError):
        await GovernedScoringAdapter(BadScorer()).score(lead_text="lead", interaction_text="hello")


@pytest.mark.asyncio
async def test_context_limit_is_enforced():
    with pytest.raises(ValueError):
        await GovernedScoringAdapter(FakeScorer()).score(lead_text="x" * 120001, interaction_text="")
