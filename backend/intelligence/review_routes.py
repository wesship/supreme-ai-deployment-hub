from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user_id
from intelligence.approval_ledger import add_record, is_satisfied, list_records
from intelligence.commands import parse_command

router = APIRouter(prefix="/commands", tags=["primetime-commands"])
ALLOWED_ROLES = {"manager", "compliance", "licensed_representative", "admin"}


class ReviewRequest(BaseModel):
    command: str = Field(min_length=1, max_length=8000)
    idempotency_key: str = Field(min_length=8, max_length=200)
    level: int = Field(ge=0, le=3)
    reviewer_role: str = Field(min_length=1, max_length=100)
    decision: str = Field(pattern="^(approved|rejected)$")
    reason: str = Field(default="", max_length=1000)


@router.post("/reviews")
async def create_review(body: ReviewRequest, user_id: str = Depends(get_current_user_id)):
    parsed = parse_command(body.command)
    if body.reviewer_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail="Unsupported reviewer role")
    if body.level < int(parsed["approvalLevel"]):
        raise HTTPException(status_code=422, detail="Review level is below the required level")
    if parsed["licensedReviewRequired"] and body.reviewer_role not in {"licensed_representative", "compliance", "admin"}:
        raise HTTPException(status_code=403, detail="Licensed or compliance reviewer required")
    record = add_record(body.command, body.level, user_id, body.reviewer_role, body.decision, body.reason)
    return {
        "idempotencyKey": body.idempotency_key,
        "record": record,
        "reviewSatisfied": is_satisfied(body.command, int(parsed["approvalLevel"])),
    }


@router.post("/reviews/list")
async def get_reviews(body: ReviewRequest, user_id: str = Depends(get_current_user_id)):
    return {
        "idempotencyKey": body.idempotency_key,
        "records": list_records(body.command),
        "requestedBy": user_id,
    }
