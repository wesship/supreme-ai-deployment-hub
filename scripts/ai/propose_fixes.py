#!/usr/bin/env python3
"""
Autonomous Fix Engine - AI-powered code fix proposal system
Analyzes GitHub issues and generates structured fix proposals using LLM
"""

import os
import sys
import json
import re
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

# Try to import openai, fallback to urllib if not available
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    import urllib.request
    import urllib.error


# =============================================================================
# CONSTANTS & CONFIG
# =============================================================================

MAX_FILE_LINES = 50
MAX_FILES_TO_ANALYZE = 3
MAX_FILE_SIZE_MB = 1
ALLOWED_EXTENSIONS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml', '.md', '.sh', '.go', '.rs', '.java'}
FORBIDDEN_PATHS = {'..', '~', '/etc', '/usr', '/bin', '/sbin', '/lib', '/opt', '/var'}


# =============================================================================
# LOGGING & OUTPUT
# =============================================================================

def log(msg: str, level: str = "INFO"):
    """Print structured log message with GitHub Actions annotation support"""
    timestamp = datetime.utcnow().isoformat()
    
    if level == "ERROR":
        print(f"::error::{msg}")
    elif level == "WARN":
        print(f"::warning::{msg}")
    elif level == "DEBUG" and os.environ.get("DEBUG"):
        print(f"::debug::{msg}")
    
    print(f"[{timestamp}] [{level}] {msg}", file=sys.stderr if level == "ERROR" else sys.stdout)


def set_output(name: str, value: str):
    """Set GitHub Actions output variable"""
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a") as f:
            if "\n" in value:
                delimiter = f"ghadelimiter_{hashlib.sha256(name.encode()).hexdigest()[:8]}"
                f.write(f"{name}<<{delimiter}\n")
                f.write(f"{value}\n")
                f.write(f"{delimiter}\n")
            else:
                f.write(f"{name}={value}\n")


def set_summary(content: str):
    """Write to GitHub Actions step summary"""
    summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_file:
        with open(summary_file, "a") as f:
            f.write(content + "\n")


# =============================================================================
# SECURITY & SANITIZATION
# =============================================================================

def sanitize_file_path(file_path: str, repo_root: str = ".") -> Optional[str]:
    """Sanitize file path to prevent directory traversal attacks."""
    path = os.path.normpath(file_path)
    
    for forbidden in FORBIDDEN_PATHS:
        if forbidden in path:
            log(f"Path contains forbidden pattern '{forbidden}': {file_path}", "WARN")
            return None
    
    full_path = os.path.abspath(os.path.join(repo_root, path))
    repo_abs = os.path.abspath(repo_root)
    
    if not full_path.startswith(repo_abs):
        log(f"Path escapes repo root: {file_path}", "WARN")
        return None
    
    return full_path


def is_safe_to_read(file_path: str) -> bool:
    """Check if file is safe to read"""
    try:
        size = os.path.getsize(file_path)
        if size > MAX_FILE_SIZE_MB * 1024 * 1024:
            log(f"File too large ({size / 1024 / 1024:.1f}MB): {file_path}", "WARN")
            return False
        return True
    except OSError:
        return False


# =============================================================================
# OPENAI API
# =============================================================================

def call_openai_api(prompt: str, api_key: str, model: str = "gpt-4o-mini") -> str:
    """Call OpenAI API to generate fix proposal"""
    log(f"Calling OpenAI API with model: {model}")
    
    if HAS_OPENAI:
        client = openai.OpenAI(api_key=api_key)
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system", 
                        "content": """You are an expert software engineer specializing in debugging and code repair.
Analyze the issue and provide a structured fix proposal.
Be specific about file paths, line numbers, and exact code changes."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=3000
            )
            return response.choices[0].message.content
        except Exception as e:
            log(f"OpenAI API error: {e}", "ERROR")
            raise
    else:
        url = "https://api.openai.com/v1/chat/completions"
        data = json.dumps({
            "model": model,
            "messages": [
                {"role": "system", "content": "You are an expert software engineer specializing in debugging and code repair."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 3000
        }).encode('utf-8')
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result['choices'][0]['message']['content']
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            log(f"OpenAI API HTTP error {e.code}: {error_body}", "ERROR")
            raise


# =============================================================================
# ISSUE PARSING
# =============================================================================

def parse_issue_body(body: str) -> Dict[str, Any]:
    """Parse issue body to extract relevant technical signals"""
    log(f"Parsing issue body ({len(body)} chars)")
    
    findings = {
        "errors": [],
        "files": [],
        "stack_traces": [],
        "code_blocks": [],
        "description": body.strip() if body else "",
        "mentions_ci": False,
        "mentions_test": False,
        "mentions_dependency": False
    }
    
    if not body:
        return findings
    
    body_lower = body.lower()
    findings["mentions_ci"] = any(w in body_lower for w in ["workflow", "action", "ci", "cd", ".yml"])
    findings["mentions_test"] = any(w in body_lower for w in ["test", "spec", "jest", "pytest"])
    findings["mentions_dependency"] = any(w in body_lower for w in ["pip", "npm", "yarn", "requirements"])
    
    # Extract errors
    error_matches = re.findall(r'(?:Error|Exception|Failure):\s*(.+?)(?:\n|$)', body)
    findings["errors"] = error_matches[:5]
    
    # Extract file references
    file_refs = re.findall(r'(?:[\w\-]+/)*[\w\-]+\.(?:py|js|ts|jsx|tsx|json|yml|yaml)', body)
    findings["files"] = list(set(file_refs))[:10]
    
    return findings


# =============================================================================
# FILE DISCOVERY
# =============================================================================

def find_relevant_files(issue_data: Dict[str, Any], repo_root: str = ".") -> List[str]:
    """Find files in repo that might be relevant to the issue"""
    relevant = []
    
    # Check if files mentioned in issue exist
    for file_path in issue_data.get("files", []):
        safe_path = sanitize_file_path(file_path, repo_root)
        if safe_path and os.path.exists(safe_path) and is_safe_to_read(safe_path):
            relevant.append(safe_path)
    
    # If no specific files, look for common patterns
    if not relevant:
        log("No specific files found, searching for relevant code...")
        
        # Look for workflow files if issue mentions CI/CD
        if issue_data.get("mentions_ci"):
            workflows_dir = os.path.join(repo_root, ".github", "workflows")
            if os.path.exists(workflows_dir):
                for f in os.listdir(workflows_dir):
                    if f.endswith(('.yml', '.yaml')):
                        relevant.append(os.path.join(workflows_dir, f))
        
        # Look for scripts if issue mentions scripts
        if "script" in issue_data["description"].lower():
            scripts_dir = os.path.join(repo_root, "scripts")
            if os.path.exists(scripts_dir):
                for root, dirs, files in os.walk(scripts_dir):
                    for f in files:
                        if f.endswith(('.py', '.js', '.sh')):
                            relevant.append(os.path.join(root, f))
    
    return relevant[:MAX_FILES_TO_ANALYZE]


def read_file_content(file_path: str, max_lines: int = MAX_FILE_LINES) -> str:
    """Read file content with line limit"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()[:max_lines]
            return ''.join(lines)
    except Exception as e:
        log(f"Could not read {file_path}: {e}", "WARN")
        return f"[Error reading file: {e}]"


# =============================================================================
# PROMPT BUILDING
# =============================================================================

def build_prompt(issue_body: str, issue_data: Dict[str, Any], relevant_files: List[str]) -> str:
    """Build the prompt for the LLM with structured output format"""
    
    prompt = f"""# Issue Analysis Request

## Issue Description
{issue_body if issue_body else "No issue description provided."}

## Technical Signals Detected
"""
    
    # Add detected signals
    if issue_data["errors"]:
        prompt += "\n### Errors Found:\n"
        for err in issue_data["errors"][:5]:
            prompt += f"- {err}\n"
    
    if issue_data["files"]:
        prompt += "\n### Files Referenced:\n"
        for f in issue_data["files"][:5]:
            prompt += f"- {f}\n"
    
    # Add relevant file contents
    if relevant_files:
        prompt += "\n### Relevant File Contents:\n"
        for fp in relevant_files:
            content = read_file_content(fp)
            prompt += f"\n#### File: {fp}\n```\n{content}\n```\n"
    
    prompt += """
## Your Task

Analyze the issue and provide a structured fix proposal in this exact format:

## Autonomous Fix Proposal

### Detected Signals
- Error type: [e.g., ImportError, SyntaxError, RuntimeError]
- Likely failing file: [file path]
- Probable root cause: [brief description]

### Suggested Fix
- File: [path/to/file.py]
- Change: [description of what to change]
- Rationale: [why this fixes the issue]

### Code Changes (if applicable)
```python
# Before:
[existing code]

# After:
[fixed code]
```

### Confidence
- [low/medium/high]

### Next Action
- [open PR manually / trigger follow-up patch workflow / needs more context]

If you need more context to diagnose, list what information would help.
"""
    
    return prompt


# =============================================================================
# MAIN WORKFLOW
# =============================================================================

def generate_fix_proposal(issue_body: str, api_key: str) -> Dict[str, Any]:
    """Main function to generate fix proposal with structured output"""
    log("Starting fix proposal generation...")
    
    # Parse the issue
    issue_data = parse_issue_body(issue_body)
    log(f"Found {len(issue_data['errors'])} errors, {len(issue_data['files'])} file references")
    
    # Find relevant files
    relevant_files = find_relevant_files(issue_data)
    log(f"Found {len(relevant_files)} relevant files: {relevant_files}")
    
    # Build and send prompt
    prompt = build_prompt(issue_body, issue_data, relevant_files)
    log("Calling OpenAI API...")
    
    response = call_openai_api(prompt, api_key)
    
    return {
        "proposal": response,
        "files_analyzed": relevant_files,
        "errors_detected": issue_data["errors"],
        "timestamp": datetime.utcnow().isoformat()
    }


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Autonomous Fix Engine - Propose code fixes for GitHub issues")
    parser.add_argument("--issue-body", type=str, default="", help="The body of the GitHub issue")
    parser.add_argument("--issue-number", type=str, default="", help="The issue number")
    parser.add_argument("--repo", type=str, default=".", help="Path to repository root")
    parser.add_argument("--dry-run", action="store_true", help="Analyze only, don't post comment")
    parser.add_argument("--output-json", type=str, help="Save structured output to JSON file")
    
    args = parser.parse_args()
    
    # Get API key
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        log("Missing OPENAI_API_KEY environment variable", "ERROR")
        sys.exit(1)
    
    # Get issue body
    issue_body = args.issue_body or os.environ.get("ISSUE_BODY", "")
    
    if not issue_body:
        log("No issue body provided. Use --issue-body or set ISSUE_BODY env var.", "WARN")
        issue_body = "No issue description available."
    
    log(f"Processing issue #{args.issue_number or 'unknown'}")
    log(f"Issue body length: {len(issue_body)} chars")
    log(f"Dry run mode: {args.dry_run}")
    
    try:
        result = generate_fix_proposal(issue_body, api_key)
        proposal = result["proposal"]
        
        # Output the proposal
        print("\n" + "="*60)
        print("AI FIX PROPOSAL")
        print("="*60)
        print(proposal)
        print("="*60)
        
        # Set GitHub Actions outputs
        set_output("fix_proposal", proposal)
        set_output("has_proposal", "true")
        set_output("files_analyzed", json.dumps(result["files_analyzed"]))
        set_output("errors_detected", json.dumps(result["errors_detected"]))
        
        # Write step summary
        set_summary(f"## Autonomous Fix Engine Results\n\n")
        set_summary(f"- Issue: #{args.issue_number or 'unknown'}\n")
        set_summary(f"- Files analyzed: {len(result['files_analyzed'])}\n")
        set_summary(f"- Errors detected: {len(result['errors_detected'])}\n")
        set_summary(f"- Status: ✅ Proposal generated\n")
        
        # Save JSON artifact if requested
        if args.output_json:
            with open(args.output_json, 'w') as f:
                json.dump(result, f, indent=2)
            log(f"Saved structured output to {args.output_json}")
        
        log("Fix proposal generated successfully")
        return 0
        
    except Exception as e:
        log(f"Failed to generate proposal: {e}", "ERROR")
        
        # Set failure outputs
        set_output("has_proposal", "false")
        set_output("error", str(e))
        set_summary(f"## Autonomous Fix Engine Results\n\n❌ Failed: {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
