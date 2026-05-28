"""
Devonn.ai Tool Router

Uses the Prompt Engine and OpenAI to intelligently select the right tool
for a given user request based on tool descriptions.
"""
import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel

from app.config import get_settings
from intelligence.prompts.engine import prompt_engine

logger = logging.getLogger(__name__)

class ToolDefinition(BaseModel):
    name: str
    description: str

class RoutingResult(BaseModel):
    tool_name: str
    reason: str
    confidence: float = 1.0

class ToolRouter:
    """Intelligently routes requests to the appropriate tool."""
    
    def __init__(self):
        self.available_tools: List[ToolDefinition] = [
            ToolDefinition(name="github", description="Interact with GitHub repositories, issues, and PRs."),
            ToolDefinition(name="n8n", description="Execute n8n workflows for automation."),
            ToolDefinition(name="rag", description="Search internal documentation and knowledge base."),
            ToolDefinition(name="deployment", description="Trigger deployments or check deployment status."),
        ]
        
    def _format_tool_descriptions(self) -> str:
        """Format tool definitions for the prompt."""
        return "\n".join([f"- {t.name}: {t.description}" for t in self.available_tools])
        
    async def route_request(self, user_request: str, context: str = "") -> RoutingResult:
        """Route a user request to the best tool."""
        settings = get_settings()
        if not settings.openai_api_key:
            logger.warning("No OpenAI API key configured, falling back to 'none' router.")
            return RoutingResult(tool_name="none", reason="No API key configured")
            
        # Render prompt
        messages = prompt_engine.render(
            name="tool_router",
            variables={
                "tool_descriptions": self._format_tool_descriptions(),
                "user_request": user_request,
                "context": context
            }
        )
        
        # Call OpenAI
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    json={
                        "model": "gpt-4.1-mini",
                        "messages": messages,
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1
                    },
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json"
                    }
                )
                
            if resp.status_code != 200:
                logger.error("OpenAI router error: %s", resp.text)
                return RoutingResult(tool_name="none", reason=f"API error: {resp.status_code}")
                
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            result = json.loads(content)
            
            tool_name = result.get("tool_name", "none")
            # Validate tool name
            if tool_name != "none" and not any(t.name == tool_name for t in self.available_tools):
                logger.warning("LLM hallucinated tool: %s", tool_name)
                tool_name = "none"
                
            return RoutingResult(
                tool_name=tool_name,
                reason=result.get("reason", "No reason provided")
            )
            
        except Exception as e:
            logger.exception("Error routing request")
            return RoutingResult(tool_name="none", reason=str(e))

# Global singleton instance
tool_router = ToolRouter()
