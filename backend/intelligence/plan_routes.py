from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user_id
from intelligence.command_workflow import route_parsed_command
from intelligence.commands import parse_command

router = APIRouter(prefix="/commands", tags=["primetime-commands"])


class PlanRequest(BaseModel):
    command: str = Field(min_length=1, max_length=8000)
    idempotency_key: str = Field(min_length=8, max_length=200)


@router.post("/plan")
async def create_plan(body: PlanRequest, user_id: str = Depends(get_current_user_id)):
    parsed = parse_command(body.command)
    return {
        "idempotencyKey": body.idempotency_key,
        "parsed": parsed,
        "routing": route_parsed_command(parsed),
        "requestedBy": user_id,
    }
