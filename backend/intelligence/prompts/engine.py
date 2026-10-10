"""
Devonn.ai Prompt Engine

Provides reusable, versioned prompt templates and context injection.
Manages system prompts, few-shot examples, and variable substitution.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PromptTemplate(BaseModel):
    """A versioned prompt template."""
    name: str
    version: str = "1.0.0"
    system_message: str
    user_message_template: str
    required_variables: List[str] = Field(default_factory=list)
    description: Optional[str] = None


class PromptEngine:
    """Manages prompt templates and context rendering."""
    
    def __init__(self):
        self._templates: Dict[str, PromptTemplate] = {}
        self._register_default_templates()
        
    def _register_default_templates(self) -> None:
        """Register core Devonn.ai prompt templates."""
        # Router Prompt
        self.register(PromptTemplate(
            name="tool_router",
            system_message="""You are the Devonn.ai Tool Router. 
Your job is to select the most appropriate tool to fulfill the user's request.
Available tools:
{tool_descriptions}

Rules:
1. Select exactly ONE tool.
2. Output ONLY a JSON object with 'tool_name' and 'reason'.
3. If no tool matches, select 'none'.
""",
            user_message_template="User Request: {user_request}\nContext: {context}",
            required_variables=["tool_descriptions", "user_request", "context"]
        ))
        
        # Executor Prompt
        self.register(PromptTemplate(
            name="task_executor",
            system_message="""You are a Devonn.ai Agent Executor.
You are tasked with executing a specific action autonomously.
You have access to the following context: {context}

Execute the task safely, concisely, and output the final result.
""",
            user_message_template="Task: {task_description}",
            required_variables=["context", "task_description"]
        ))
        
    def register(self, template: PromptTemplate) -> None:
        """Register a new prompt template."""
        self._templates[template.name] = template
        
    def get_template(self, name: str) -> PromptTemplate:
        """Retrieve a template by name."""
        if name not in self._templates:
            raise ValueError(f"Prompt template '{name}' not found.")
        return self._templates[name]
        
    def render(self, name: str, variables: Dict[str, Any]) -> List[Dict[str, str]]:
        """Render a prompt template with variables into an OpenAI-compatible message list."""
        template = self.get_template(name)
        
        # Validate variables
        missing = [v for v in template.required_variables if v not in variables]
        if missing:
            raise ValueError(f"Missing required variables for template '{name}': {missing}")
            
        # Format messages
        system_content = template.system_message.format(**variables)
        user_content = template.user_message_template.format(**variables)
        
        return [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content}
        ]

# Global singleton instance
prompt_engine = PromptEngine()
