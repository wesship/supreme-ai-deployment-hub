from fastapi import FastAPI, Depends, HTTPException, Request, Body, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
import os
import json
import uuid
from datetime import datetime
from urllib.parse import quote
from secret_manager.manager import get_api_key, list_available_keys, set_api_key, delete_api_key
from auth.token_utils import verify_token, get_current_user
from fastapi.middleware.cors import CORSMiddleware
from services.agui_listener import router as agui_router  # Import the AG-UI router

app = FastAPI(
    title="Devonn.ai - Model Control Panel",
    description="Unified API gateway for AI models, agents, and workflow execution",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the AG-UI router
app.include_router(agui_router)

# ===== In-Memory Run Storage (Replace with DB in production) =====
runs_db: Dict[str, Dict] = {}

# ===== Models =====
class ChatRequest(BaseModel):
    prompt: str
    model: str = "gpt-4o-mini"
    user: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None

class CompletionResult(BaseModel):
    completion: str
    model: str
    usage: Optional[Dict] = None

class TextToSpeechRequest(BaseModel):
    text: str
    voice_id: str = "EXAVITQu4vr4xnSDxMaL"  # Default voice ID (Eleven Labs - Sarah)
    model_id: str = "eleven_multilingual_v2"

class AudioResult(BaseModel):
    audio_url: str
    duration: Optional[float] = None

class VectorSearchRequest(BaseModel):
    query: str
    collection: str
    limit: int = 5

class VectorSearchResult(BaseModel):
    results: List[Dict[str, Any]]
    query: str

class APIKeyRequest(BaseModel):
    key: str
    service: str

class StatusResponse(BaseModel):
    status: str
    message: str

# ===== Devonn.ai Execution Loop Models =====
class RunPayload(BaseModel):
    job_type: str
    parameters: Dict[str, Any]
    agent_id: Optional[str] = None
    workflow_id: Optional[str] = None
    n8n_webhook_url: Optional[str] = None
    callback_url: Optional[str] = None

class RunLog(BaseModel):
    timestamp: str
    level: str = "info"
    message: str
    metadata: Optional[Dict[str, Any]] = None

class LogRunRequest(BaseModel):
    run_id: str
    log_data: RunLog

class FinishRunRequest(BaseModel):
    run_id: str
    result_data: Dict[str, Any]
    status: str = "completed"
    error: Optional[str] = None

class N8nDispatchPayload(BaseModel):
    run_id: str
    job_type: str
    parameters: Dict[str, Any]
    callback_url: str

# ===== Execution Loop Helpers =====
def create_run_in_db(payload: RunPayload) -> str:
    """Create a new run record in the database"""
    run_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    
    runs_db[run_id] = {
        "run_id": run_id,
        "status": "started",
        "job_type": payload.job_type,
        "parameters": payload.parameters,
        "created_at": now,
        "updated_at": now,
        "started_at": now,
        "logs": [],
        "result": None,
        "error": None,
        "progress": 0,
        "current_step": "Initializing..."
    }
    
    return run_id

async def dispatch_to_n8n(run_id: str, payload: RunPayload):
    """Dispatch job to n8n workflow via webhook"""
    n8n_webhook_url = payload.n8n_webhook_url or os.getenv(
        "N8N_WEBHOOK_URL", 
        "https://n8n.d3vonn.io/webhook/run-job"
    )
    
    callback_url = payload.callback_url or os.getenv(
        "API_CALLBACK_URL",
        "https://api.d3vonn.io"
    )
    
    dispatch_payload = {
        "run_id": run_id,
        "job_type": payload.job_type,
        "parameters": payload.parameters,
        "callback_url": callback_url,
        "agent_id": payload.agent_id,
        "workflow_id": payload.workflow_id
    }
    
    # Add log entry
    add_log(run_id, "info", f"Dispatching to n8n: {n8n_webhook_url}")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                n8n_webhook_url,
                json=dispatch_payload,
                timeout=30.0
            )
            
            if response.status_code == 200:
                add_log(run_id, "info", "Successfully dispatched to n8n")
                update_run_status(run_id, "running", current_step="Executing in n8n...")
            else:
                add_log(run_id, "error", f"n8n dispatch failed: {response.text}")
                update_run_status(run_id, "failed", error=f"n8n dispatch failed: {response.status_code}")
                
        except httpx.RequestError as e:
            add_log(run_id, "error", f"Failed to connect to n8n: {str(e)}")
            update_run_status(run_id, "failed", error=f"n8n connection error: {str(e)}")

def add_log(run_id: str, level: str, message: str, metadata: Dict = None):
    """Add a log entry to a run"""
    if run_id in runs_db:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "message": message,
            "metadata": metadata or {}
        }
        runs_db[run_id]["logs"].append(log_entry)
        runs_db[run_id]["updated_at"] = datetime.utcnow().isoformat() + "Z"

def update_run_status(run_id: str, status: str, **kwargs):
    """Update run status and optional fields"""
    if run_id in runs_db:
        runs_db[run_id]["status"] = status
        runs_db[run_id]["updated_at"] = datetime.utcnow().isoformat() + "Z"
        
        for key, value in kwargs.items():
            if key in runs_db[run_id]:
                runs_db[run_id][key] = value
        
        if status in ["completed", "failed", "cancelled"]:
            runs_db[run_id]["finished_at"] = datetime.utcnow().isoformat() + "Z"

# ===== Devonn.ai Execution Loop Endpoints =====
@app.post("/runs/start")
async def start_run(payload: RunPayload, background_tasks: BackgroundTasks):
    """
    Start a new execution run.
    Creates a run record and dispatches to n8n/Docker MCP.
    """
    run_id = create_run_in_db(payload)
    
    # Add initial log
    add_log(run_id, "info", f"Run started with job_type: {payload.job_type}")
    
    # Dispatch to n8n in background
    background_tasks.add_task(dispatch_to_n8n, run_id, payload)
    
    return {
        "run_id": run_id,
        "status": "started",
        "message": "Run has been dispatched to execution engine"
    }

@app.post("/runs/log")
async def log_run(request: LogRunRequest):
    """
    Append logs to a run record.
    Called by n8n/workers to report progress.
    """
    if request.run_id not in runs_db:
        raise HTTPException(status_code=404, detail=f"Run {request.run_id} not found")
    
    log_data = request.log_data
    add_log(
        request.run_id, 
        log_data.level, 
        log_data.message, 
        log_data.metadata
    )
    
    return {"status": "logged", "run_id": request.run_id}

@app.post("/runs/finish")
async def finish_run(request: FinishRunRequest):
    """
    Mark a run as completed or failed.
    Called by n8n/workers when job finishes.
    """
    if request.run_id not in runs_db:
        raise HTTPException(status_code=404, detail=f"Run {request.run_id} not found")
    
    final_status = request.status
    
    if final_status == "completed":
        add_log(request.run_id, "info", "Run completed successfully")
        update_run_status(
            request.run_id, 
            "completed", 
            result=request.result_data,
            progress=100
        )
    else:
        add_log(request.run_id, "error", f"Run failed: {request.error}")
        update_run_status(
            request.run_id, 
            "failed", 
            error=request.error
        )
    
    return {"status": final_status, "run_id": request.run_id}

@app.get("/runs/{run_id}/status")
async def get_run_status(run_id: str):
    """Get current status and details of a run"""
    if run_id not in runs_db:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    return {"run": runs_db[run_id]}

@app.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get full run details"""
    if run_id not in runs_db:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    return runs_db[run_id]

@app.get("/runs")
async def list_runs(
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    page: int = 1,
    per_page: int = 20
):
    """List all runs with optional filters"""
    filtered_runs = list(runs_db.values())
    
    if status:
        filtered_runs = [r for r in filtered_runs if r["status"] == status]
    
    if job_type:
        filtered_runs = [r for r in filtered_runs if r["job_type"] == job_type]
    
    # Sort by created_at descending
    filtered_runs.sort(key=lambda x: x["created_at"], reverse=True)
    
    # Paginate
    start = (page - 1) * per_page
    end = start + per_page
    paginated = filtered_runs[start:end]
    
    return {
        "runs": paginated,
        "total": len(filtered_runs),
        "page": page,
        "per_page": per_page
    }

@app.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str):
    """Cancel a running job"""
    if run_id not in runs_db:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    current_status = runs_db[run_id]["status"]
    if current_status in ["completed", "failed", "cancelled"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot cancel run with status: {current_status}"
        )
    
    add_log(run_id, "warn", "Run cancelled by user")
    update_run_status(run_id, "cancelled")
    
    return {"status": "cancelled", "run_id": run_id}

@app.post("/runs/{run_id}/retry")
async def retry_run(run_id: str, background_tasks: BackgroundTasks):
    """Retry a failed or cancelled run"""
    if run_id not in runs_db:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    original_run = runs_db[run_id]
    
    if original_run["status"] not in ["failed", "cancelled"]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only retry failed or cancelled runs"
        )
    
    # Create new run with same parameters
    new_payload = RunPayload(
        job_type=original_run["job_type"],
        parameters=original_run["parameters"]
    )
    
    new_run_id = create_run_in_db(new_payload)
    add_log(new_run_id, "info", f"Retry of run {run_id}")
    
    background_tasks.add_task(dispatch_to_n8n, new_run_id, new_payload)
    
    return {
        "run_id": new_run_id,
        "status": "started",
        "message": f"Retry of run {run_id} has been dispatched"
    }

# ===== n8n Integration Endpoints =====
@app.post("/n8n/dispatch")
async def dispatch_to_n8n_endpoint(payload: N8nDispatchPayload):
    """Proxy endpoint to dispatch jobs to n8n"""
    n8n_webhook_url = os.getenv("N8N_WEBHOOK_URL", "https://n8n.d3vonn.io/webhook/run-job")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                n8n_webhook_url,
                json=payload.dict(),
                timeout=30.0
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "execution_id": response.json().get("executionId"),
                    "message": "Dispatched to n8n successfully"
                }
            else:
                return {
                    "success": False,
                    "message": f"n8n returned status {response.status_code}"
                }
        except httpx.RequestError as e:
            return {
                "success": False,
                "message": f"Failed to connect to n8n: {str(e)}"
            }

@app.get("/n8n/execution/{execution_id}")
async def get_n8n_execution(execution_id: str):
    """Get n8n execution status"""
    n8n_base_url = os.getenv("N8N_BASE_URL", "https://n8n.d3vonn.io")
    n8n_api_key = get_api_key("N8N_API_KEY")
    
    if not n8n_api_key:
        raise HTTPException(status_code=403, detail="n8n API key not configured")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{n8n_base_url}/api/v1/executions/{quote(execution_id, safe='')}",
                headers={"X-N8N-API-KEY": n8n_api_key},
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "status": data.get("status", "unknown"),
                    "data": data.get("data")
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch n8n execution"
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Failed to connect to n8n: {str(e)}"
            )

# ===== API Key Management =====
@app.get("/admin/keys", response_model=List[str])
async def list_keys(user: str = Depends(get_current_user)):
    """List all available API keys (names only)"""
    if user != "admin":
        raise HTTPException(status_code=403, detail="Only admin users can list keys")
    
    return list_available_keys()

@app.put("/admin/keys/{service}", response_model=StatusResponse)
async def update_key(
    service: str, 
    data: APIKeyRequest,
    user: str = Depends(get_current_user)
):
    """Update or create an API key"""
    if user != "admin":
        raise HTTPException(status_code=403, detail="Only admin users can update keys")
    
    if set_api_key(service, data.key):
        return StatusResponse(
            status="success",
            message=f"API key for {service} has been updated"
        )
    else:
        raise HTTPException(status_code=500, detail="Failed to update API key")

@app.delete("/admin/keys/{service}", response_model=StatusResponse)
async def remove_key(
    service: str,
    user: str = Depends(get_current_user)
):
    """Remove an API key"""
    if user != "admin":
        raise HTTPException(status_code=403, detail="Only admin users can delete keys")
    
    if delete_api_key(service):
        return StatusResponse(
            status="success",
            message=f"API key for {service} has been removed"
        )
    else:
        raise HTTPException(status_code=500, detail="Failed to remove API key")

# ===== Proxy: OpenAI =====
@app.post("/proxy/openai/chat", response_model=CompletionResult)
async def proxy_openai_chat(data: ChatRequest, token: Dict = Depends(verify_token)):
    """Proxy endpoint for OpenAI chat completions"""
    openai_key = get_api_key("OPENAI_API_KEY")
    if not openai_key:
        raise HTTPException(status_code=403, detail="OpenAI API key not configured")

    headers = {
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": data.model,
        "messages": [{"role": "user", "content": data.prompt}],
        "temperature": data.temperature
    }
    
    if data.max_tokens:
        payload["max_tokens"] = data.max_tokens
        
    if data.user:
        payload["user"] = data.user

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post("https://api.openai.com/v1/chat/completions", 
                               headers=headers, 
                               json=payload, 
                               timeout=30.0)
            
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, 
                                  detail=f"OpenAI API error: {r.text}")
            
            response = r.json()
            return CompletionResult(
                completion=response["choices"][0]["message"]["content"],
                model=response["model"],
                usage=response.get("usage")
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, 
                              detail=f"Error communicating with OpenAI: {str(e)}")

# ===== Proxy: Hugging Face =====
@app.post("/proxy/huggingface/generate", response_model=CompletionResult)
async def proxy_huggingface_generate(data: ChatRequest, token: Dict = Depends(verify_token)):
    """Proxy endpoint for Hugging Face text generation"""
    hf_key = get_api_key("HUGGINGFACE_API_KEY")
    if not hf_key:
        raise HTTPException(status_code=403, detail="Hugging Face API key not configured")

    headers = {
        "Authorization": f"Bearer {hf_key}",
        "Content-Type": "application/json"
    }
    
    # Default to a good open model if none specified
    model_id = data.model if data.model != "gpt-4o-mini" else "mistralai/Mistral-7B-Instruct-v0.2"
    
    # HF Inference API endpoint
    model_parts = model_id.split("/", 1)
    if len(model_parts) != 2 or not all(model_parts):
        raise HTTPException(status_code=400, detail="Hugging Face model must be owner/model")
    encoded_model = "/".join(quote(part, safe="") for part in model_parts)
    api_url = f"https://api-inference.huggingface.co/models/{encoded_model}"
    
    payload = {
        "inputs": data.prompt,
        "parameters": {
            "temperature": data.temperature,
            "max_new_tokens": data.max_tokens or 512,
            "return_full_text": False
        }
    }

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(api_url, headers=headers, json=payload, timeout=30.0)
            
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, 
                                  detail=f"Hugging Face API error: {r.text}")
            
            response = r.json()
            
            # Handle different response formats
            if isinstance(response, list) and len(response) > 0:
                text = response[0].get("generated_text", "")
            else:
                text = response.get("generated_text", "")
                
            return CompletionResult(
                completion=text,
                model=model_id,
                usage={"prompt_tokens": len(data.prompt), "completion_tokens": len(text)}
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, 
                              detail=f"Error communicating with Hugging Face: {str(e)}")

# ===== Proxy: Eleven Labs =====
@app.post("/proxy/elevenlabs/tts", response_model=AudioResult)
async def proxy_elevenlabs_tts(data: TextToSpeechRequest, token: Dict = Depends(verify_token)):
    """Proxy endpoint for Eleven Labs text-to-speech"""
    elevenlabs_key = get_api_key("ELEVENLABS_API_KEY")
    if not elevenlabs_key:
        raise HTTPException(status_code=403, detail="Eleven Labs API key not configured")

    headers = {
        "xi-api-key": elevenlabs_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "text": data.text,
        "model_id": data.model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    api_url = f"https://api.elevenlabs.io/v1/text-to-speech/{quote(data.voice_id, safe='')}"

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(api_url, headers=headers, json=payload, timeout=30.0)
            
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, 
                                  detail=f"Eleven Labs API error: {r.text}")
            
            # This endpoint returns audio data directly
            # For this example, we'll return a mock URL
            # In a real implementation, you would save the audio file and return a URL
            
            # Mock response for demonstration
            return AudioResult(
                audio_url=f"/audio/generated/{data.voice_id}_{hash(data.text)}.mp3",
                duration=len(data.text) / 20  # Rough estimate
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, 
                              detail=f"Error communicating with Eleven Labs: {str(e)}")

# ===== Proxy: Vector Search =====
@app.post("/proxy/vector/search", response_model=VectorSearchResult)
async def proxy_vector_search(data: VectorSearchRequest, token: Dict = Depends(verify_token)):
    """Proxy endpoint for vector database search"""
    # This is a placeholder implementation
    # In a real system, you would integrate with Pinecone, Weaviate, Qdrant, etc.
    
    # Mock response for demonstration
    results = [
        {
            "id": f"doc_{i}",
            "score": 0.9 - (i * 0.1),
            "metadata": {
                "title": f"Sample Document {i}",
                "source": "mock-database"
            },
            "content": f"This is sample content related to '{data.query}'"
        }
        for i in range(data.limit)
    ]
    
    return VectorSearchResult(
        results=results,
        query=data.query
    )

# ===== System Status =====
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok", 
        "version": "2.0.0",
        "active_runs": len([r for r in runs_db.values() if r["status"] in ["started", "running"]])
    }

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Devonn.ai - Model Control Panel API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "runs": "/runs",
            "n8n": "/n8n/dispatch",
            "proxy": {
                "openai": "/proxy/openai/chat",
                "huggingface": "/proxy/huggingface/generate",
                "elevenlabs": "/proxy/elevenlabs/tts"
            }
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
