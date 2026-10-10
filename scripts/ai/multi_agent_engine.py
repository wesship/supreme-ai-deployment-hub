"""
Devonn Multi-Agent System Core Engine
Runs Debug, Refactor, Security, and Performance agents in parallel.
"""
import os
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

# Try to import openai, fallback if not installed
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

class DevonnAgent:
    def __init__(self, name, role, system_prompt):
        self.name = name
        self.role = role
        self.system_prompt = system_prompt
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if OpenAI and self.api_key else None

    def analyze(self, codebase_context):
        if not self.client:
            return f"[{self.name}] OpenAI client not configured."
        
        print(f"🤖 {self.name} is analyzing the codebase...")
        try:
            resp = self.client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Analyze this codebase context and provide specific, actionable recommendations:\n\n{codebase_context[:4000]}"}
                ],
                max_tokens=1000,
                temperature=0.2
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            return f"[{self.name}] Analysis failed: {str(e)}"

def gather_context():
    """Gather a sample of the codebase for analysis."""
    context = ""
    # Look for Python files
    for p in Path(".").rglob("*.py"):
        if "venv" in p.parts or ".git" in p.parts or "__pycache__" in p.parts:
            continue
        try:
            content = p.read_text()
            context += f"\n--- {p} ---\n{content[:500]}\n"
        except Exception:
            pass
    
    # Look for JS/TS files if no Python
    if not context:
        for p in Path(".").rglob("*.ts"):
            if "node_modules" in p.parts or ".git" in p.parts:
                continue
            try:
                content = p.read_text()
                context += f"\n--- {p} ---\n{content[:500]}\n"
            except Exception:
                pass
                
    return context[:5000]

def run_multi_agent_system():
    print("🚀 Booting Devonn Multi-Agent System...")
    
    agents = [
        DevonnAgent(
            "DebugAgent", 
            "Bug Hunter", 
            "You are an expert debugging agent. Look for logical errors, edge cases, unhandled exceptions, and race conditions in the provided code."
        ),
        DevonnAgent(
            "RefactorAgent", 
            "Code Architect", 
            "You are an expert refactoring agent. Look for code smells, duplication, poor naming, and opportunities to improve maintainability and SOLID principles."
        ),
        DevonnAgent(
            "SecurityAgent", 
            "Security Auditor", 
            "You are an expert security agent. Look for vulnerabilities like injection flaws, hardcoded secrets, insecure dependencies, and broken authentication."
        ),
        DevonnAgent(
            "PerformanceAgent", 
            "Performance Optimizer", 
            "You are an expert performance agent. Look for inefficient algorithms, memory leaks, N+1 queries, and opportunities for caching or concurrency."
        )
    ]
    
    context = gather_context()
    if not context:
        print("⚠️ No code found to analyze.")
        return
        
    results = {}
    for agent in agents:
        analysis = agent.analyze(context)
        results[agent.name] = analysis
        
    # Save results to observability log
    os.makedirs(".devonn/observability", exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    
    report_path = f".devonn/observability/scan_{timestamp}.md"
    with open(report_path, "w") as f:
        f.write(f"# Devonn Multi-Agent Scan Report\nDate: {datetime.now(timezone.utc).isoformat()}\n\n")
        for name, analysis in results.items():
            f.write(f"## {name}\n\n{analysis}\n\n---\n\n")
            
    print(f"✅ Multi-agent scan complete. Report saved to {report_path}")
    
    # Generate Knowledge Graph update
    kg_path = ".devonn/knowledge_graph.json"
    kg_data = {"last_scan": timestamp, "agents_run": len(agents), "insights": {}}
    
    if os.path.exists(kg_path):
        try:
            with open(kg_path, "r") as f:
                kg_data = json.load(f)
                kg_data["last_scan"] = timestamp
        except Exception:
            pass
            
    with open(kg_path, "w") as f:
        json.dump(kg_data, f, indent=2)
        
    print(f"✅ Knowledge Graph updated at {kg_path}")

if __name__ == "__main__":
    run_multi_agent_system()
