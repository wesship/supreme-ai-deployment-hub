from fastapi import APIRouter

router = APIRouter()

@router.post("/execute")
def execute(payload: dict):
    # forward to OpenClaw gateway
    return {"status": "sent to openclaw", "payload": payload}
