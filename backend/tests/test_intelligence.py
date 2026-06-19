"""
Tests for the Devonn.ai Intelligence Layer.

Covers: Prompt Engine, Tool Router, Workflow Engine, Agent Executor, Memory, Orchestrator.
All LLM calls are mocked so tests run without API keys.
"""
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── Prompt Engine ─────────────────────────────────────────────────────────────

class TestPromptEngine:
    def setup_method(self):
        from intelligence.prompts.engine import PromptEngine, PromptTemplate
        self.engine = PromptEngine()
        self.PromptTemplate = PromptTemplate

    def test_default_templates_registered(self):
        assert "tool_router" in self.engine._templates
        assert "task_executor" in self.engine._templates

    def test_register_custom_template(self):
        t = self.PromptTemplate(
            name="test_template",
            system_message="System: {var1}",
            user_message_template="User: {var2}",
            required_variables=["var1", "var2"]
        )
        self.engine.register(t)
        assert "test_template" in self.engine._templates

    def test_render_template(self):
        t = self.PromptTemplate(
            name="render_test",
            system_message="Hello {name}",
            user_message_template="Task: {task}",
            required_variables=["name", "task"]
        )
        self.engine.register(t)
        messages = self.engine.render("render_test", {"name": "Devonn", "task": "test"})
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert "Devonn" in messages[0]["content"]
        assert messages[1]["role"] == "user"
        assert "test" in messages[1]["content"]

    def test_render_missing_variable_raises(self):
        with pytest.raises(ValueError, match="Missing required variables"):
            self.engine.render("tool_router", {"user_request": "hello"})  # missing tool_descriptions and context

    def test_get_nonexistent_template_raises(self):
        with pytest.raises(ValueError, match="not found"):
            self.engine.get_template("nonexistent_template")


# ── Tool Router ───────────────────────────────────────────────────────────────

class TestToolRouter:
    def setup_method(self):
        from intelligence.router.router import ToolRouter
        self.router = ToolRouter()

    def test_tool_definitions_loaded(self):
        assert len(self.router.available_tools) > 0
        tool_names = [t.name for t in self.router.available_tools]
        assert "github" in tool_names
        assert "rag" in tool_names

    @pytest.mark.asyncio
    async def test_route_returns_none_without_api_key(self):
        with patch("intelligence.router.router.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(openai_api_key=None)
            result = await self.router.route_request("test request")
            assert result.tool_name == "none"

    @pytest.mark.asyncio
    async def test_route_with_mocked_openai(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps({"tool_name": "github", "reason": "GitHub task"})}}]
        }

        with patch("intelligence.router.router.get_settings") as mock_settings, \
             patch("httpx.AsyncClient") as mock_client:
            mock_settings.return_value = MagicMock(openai_api_key="test-key")
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            result = await self.router.route_request("Create a GitHub issue")
            assert result.tool_name == "github"

    @pytest.mark.asyncio
    async def test_route_rejects_hallucinated_tool(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps({"tool_name": "fake_tool", "reason": "test"})}}]
        }

        with patch("intelligence.router.router.get_settings") as mock_settings, \
             patch("httpx.AsyncClient") as mock_client:
            mock_settings.return_value = MagicMock(openai_api_key="test-key")
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            result = await self.router.route_request("Use fake tool")
            assert result.tool_name == "none"


# ── Workflow Engine ───────────────────────────────────────────────────────────

class TestWorkflowEngine:
    def setup_method(self):
        from intelligence.workflows.engine import WorkflowEngine, WorkflowDefinition, WorkflowStep
        self.engine = WorkflowEngine()
        self.WorkflowDefinition = WorkflowDefinition
        self.WorkflowStep = WorkflowStep

    def test_register_workflow(self):
        wf = self.WorkflowDefinition(
            name="test_workflow",
            steps=[
                self.WorkflowStep(name="step1", step_type="test")
            ]
        )
        self.engine.register_workflow(wf)
        assert "test_workflow" in self.engine.list_workflows()

    @pytest.mark.asyncio
    async def test_execute_workflow_success(self):
        async def test_handler(step, context, results):
            return "step_result"

        self.engine.register_step_handler("test", test_handler)
        wf = self.WorkflowDefinition(
            name="exec_test",
            steps=[self.WorkflowStep(name="s1", step_type="test")]
        )
        self.engine.register_workflow(wf)
        run = await self.engine.execute("exec_test", {"key": "value"})
        assert run.status.value == "success"

    @pytest.mark.asyncio
    async def test_execute_unknown_workflow_raises(self):
        with pytest.raises(ValueError, match="not found"):
            await self.engine.execute("nonexistent_workflow")

    @pytest.mark.asyncio
    async def test_step_failure_marks_run_failed(self):
        async def failing_handler(step, context, results):
            raise RuntimeError("Step failed intentionally")

        self.engine.register_step_handler("failing", failing_handler)
        wf = self.WorkflowDefinition(
            name="fail_test",
            steps=[self.WorkflowStep(name="s1", step_type="failing")]
        )
        self.engine.register_workflow(wf)
        run = await self.engine.execute("fail_test")
        assert run.status.value == "failed"
        assert run.error is not None


# ── Memory ────────────────────────────────────────────────────────────────────

class TestConversationMemory:
    def setup_method(self):
        from intelligence.memory.memory import ConversationMemory
        self.memory = ConversationMemory()

    def test_add_and_retrieve_messages(self):
        self.memory.add_message("sess1", "user", "Hello")
        self.memory.add_message("sess1", "assistant", "Hi there")
        history = self.memory.get_history("sess1")
        assert len(history) == 2
        assert history[0]["role"] == "user"
        assert history[1]["role"] == "assistant"

    def test_rolling_window(self):
        from intelligence.memory.memory import MAX_SHORT_TERM_MESSAGES
        for i in range(MAX_SHORT_TERM_MESSAGES + 10):
            self.memory.add_message("sess2", "user", f"Message {i}")
        history = self.memory.get_history("sess2", max_messages=1000)
        assert len(history) <= MAX_SHORT_TERM_MESSAGES

    def test_clear_session(self):
        self.memory.add_message("sess3", "user", "test")
        self.memory.clear_session("sess3")
        history = self.memory.get_history("sess3")
        assert len(history) == 0

    def test_empty_session_returns_empty_list(self):
        history = self.memory.get_history("nonexistent_session")
        assert history == []


class TestLongTermMemory:
    def setup_method(self):
        from intelligence.memory.memory import LongTermMemory
        self.memory = LongTermMemory()  # No Supabase client — uses local fallback

    @pytest.mark.asyncio
    async def test_store_and_retrieve(self):
        ok = await self.memory.store("test_key", "test_value")
        assert ok is True
        value = await self.memory.retrieve("test_key")
        assert value == "test_value"

    @pytest.mark.asyncio
    async def test_retrieve_nonexistent_returns_none(self):
        value = await self.memory.retrieve("nonexistent_key_xyz")
        assert value is None

    @pytest.mark.asyncio
    async def test_ttl_expiry(self):
        await self.memory.store("expiring_key", "value", ttl_seconds=1)
        time.sleep(1.1)
        value = await self.memory.retrieve("expiring_key")
        assert value is None

    @pytest.mark.asyncio
    async def test_search_by_prefix(self):
        await self.memory.store("prefix:key1", "val1")
        await self.memory.store("prefix:key2", "val2")
        await self.memory.store("other:key3", "val3")
        results = await self.memory.search("prefix:")
        assert "prefix:key1" in results
        assert "prefix:key2" in results
        assert "other:key3" not in results


# ── Agent Executor ────────────────────────────────────────────────────────────

class TestAgentExecutor:
    def setup_method(self):
        from intelligence.executor.agent_executor import AgentExecutor
        self.executor = AgentExecutor()

    def test_register_tool(self):
        async def dummy_tool(**kwargs):
            return "result"
        self.executor.register_tool("dummy", dummy_tool)
        assert "dummy" in self.executor._tool_handlers

    @pytest.mark.asyncio
    async def test_execute_returns_failed_without_api_key(self):
        with patch("intelligence.executor.agent_executor.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(openai_api_key=None)
            # Should fail gracefully (no key = API error)
            result = await self.executor.execute("test task")
            assert result.status in ("failed", "max_steps_reached")

    @pytest.mark.asyncio
    async def test_execute_with_finish_action(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "thought": "I can answer this directly",
                        "action": "FINISH",
                        "action_input": {},
                        "final_answer": "Task completed successfully"
                    })
                }
            }]
        }

        with patch("intelligence.executor.agent_executor.get_settings") as mock_settings, \
             patch("httpx.AsyncClient") as mock_client:
            mock_settings.return_value = MagicMock(openai_api_key="test-key")
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            result = await self.executor.execute("simple task")
            assert result.status == "success"
            assert result.final_answer == "Task completed successfully"
