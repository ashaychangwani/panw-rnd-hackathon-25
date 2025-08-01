# agentic_terminal.py
"""
Agentic Terminal Agent
======================

Uses Google Gen AI Python SDK (Gemini) function calling to let the model
generate and execute bash or python-3.9 commands on your local machine.

Usage:
    from agentic_terminal import TerminalAgent

    agent = TerminalAgent(api_key="GEMINI_API_KEY")
    answer = agent.run(
        context="You are on an Ubuntu 22.04 machine.",
        instruction="List files in /tmp and then print 'done'."
    )
    print(answer)
"""

import subprocess
import sys
import logging
from typing import List, Dict, Any

from google import genai
from google.genai import types

_LOG = logging.getLogger(__name__)


def run_bash(command: str) -> str:
    """Execute a Bash command and return combined stdout+stderr."""
    _LOG.info("[bash] %s", command)
    try:
        proc = subprocess.run(
            command,
            shell=True,
            executable="/bin/bash",
            capture_output=True,
            text=True,
            timeout=3,
        )
        _LOG.info("[bash] STDOUT: %s", proc.stdout)
        _LOG.info("[bash] STDERR: %s", proc.stderr)
        return (proc.stdout or "") + (proc.stderr or "")
    except subprocess.TimeoutExpired:
        _LOG.warning("[bash] Command timed out after 3 seconds: %s", command)
        return "ERROR: Command timed out after 3 seconds"


def run_python(code: str) -> str:
    """Execute Python-3.9 code in a subprocess and return combined stdout+stderr."""
    _LOG.info("[python]\n%s", code)
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=3,
        )
        _LOG.info("[python] STDOUT: %s", proc.stdout)
        _LOG.info("[python] STDERR: %s", proc.stderr)
        return (proc.stdout or "") + (proc.stderr or "")
    except subprocess.TimeoutExpired:
        _LOG.warning("[python] Code execution timed out after 3 seconds: %s", code)
        return "ERROR: Code execution timed out after 3 seconds"


def finish(answer: str) -> None:
    """Sentinel function for model to signal completion."""
    raise NotImplementedError("This should never be called locally.")


# --- Function Declarations for Gemini ---
_RUN_BASH_DECL = types.FunctionDeclaration(
    name="run_bash",
    description="Run a Bash command and return its combined output.",
    parameters_json_schema={
        "type": "object",
        "properties": {"command": {"type": "string"}},
        "required": ["command"],
    },
)

_RUN_PY_DECL = types.FunctionDeclaration(
    name="run_python",
    description="Run a Python-3.9 snippet and return its combined output.",
    parameters_json_schema={
        "type": "object",
        "properties": {"code": {"type": "string"}},
        "required": ["code"],
    },
)

_FINISH_DECL = types.FunctionDeclaration(
    name="finish",
    description="Signal that the agent has arrived at the final answer.",
    parameters_json_schema={
        "type": "object",
        "properties": {"result": {"type": "object"}},
        "required": ["result"],
    },
)

# Register all tools in one Tool declaration
_TOOLS = [
    types.Tool(function_declarations=[_RUN_BASH_DECL, _RUN_PY_DECL, _FINISH_DECL])
]

# Map function names to local implementations
_LOCAL_DISPATCH = {
    "run_bash": run_bash,
    "run_python": run_python,
}


class TerminalAgent:
    """
    A simple agent loop: user context + instruction → Gemini → (optional function call)
    → local execution → back to Gemini … until `finish` is called or max_turns exceeded.
    """

    def __init__(
        self,
        api_key: str | None = None,
        vertexai: bool = False,
        project: str | None = "panw-tdp-dev",
        location: str = "us-central1",
        model: str = "gemini-2.5-flash",
        max_turns: int = 20,
        temperature: float = 0.2,
    ):
        self.client = genai.Client(
            vertexai=True,
            project=project,
            location=location
        )
        self.model = model
        self.max_turns = max_turns
        self.temperature = temperature

    def run(self, *, context: str, instruction: str) -> str:
        # Initialize conversation with user context + instruction
        convo: List[types.Content] = [
            types.Content(role="user", parts=[types.Part.from_text(text="You are running on a Linux Machine with Python install. You can use bash or python commands to execute. All the files are in the /etc/log directory only. Do not try to access any other files or directories")]),
            types.Content(role="user", parts=[types.Part.from_text(text=context)]),
            types.Content(role="user", parts=[types.Part.from_text(text=instruction)]),
            types.Content(
                role="user",
                parts=[types.Part.from_text(
                    text=(
                        "Note: this is how to open a pcap file: "
                        "import pyshark\n"
                        "cap = pyshark.FileCapture(file_path, only_summaries=False)\n"
                        "packets_preview = [str(packet) for i, packet in enumerate(cap) if i < 10]\n"
                        "cap.close()"
                    )
                )]
            ),
            types.Content(
                role="user",
                parts=[types.Part.from_text(
                    text=(
                        "Note: if there is a encoded text/code anywhere in the output, "
                        "try to decode it as a separate command."
                    )
                )]
            ),
        ]

        cfg = types.GenerateContentConfig(
            tools=_TOOLS,
            temperature=self.temperature,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                maximum_remote_calls=self.max_turns
            ),
        )

        for turn in range(self.max_turns):
            resp = self.client.models.generate_content(
                model=self.model,
                contents=convo,
                config=cfg,
            )

            # If the model wants to call a function...
            if resp.function_calls:
                for fc in resp.function_calls:
                    name = fc.name
                    args = fc.args

                    # Finish sentinel
                    if name == "finish":
                        return args.get("result", {})

                    # Dispatch to our local runner
                    if name not in _LOCAL_DISPATCH:
                        raise RuntimeError(f"Unknown tool requested: {name}")

                    output = _LOCAL_DISPATCH[name](**args)

                    convo.append(resp.candidates[0].content) 
                    convo.append(
                        types.Content(
                            role="tool",
                            parts=[
                                types.Part.from_function_response(name=name, response={"result": output})
                            ],
                        )
                    )
                    break  # proceed to next turn

            else:
                return resp.text or ""



if __name__ == "__main__":
    import argparse, pprint

    logging.basicConfig(level=logging.INFO)
    context = "Web servers or other Java-based applications may be compromised by threat actors exploiting the Log4j (CVE-2021-44228) vulnerability. This could lead to remote code execution, the download of secondary payloads like coin miners or ransomware, and the establishment of persistent command and control channels."
    agent = TerminalAgent()
    instruction = "Search web server access logs, application logs, and network traffic for the JNDI lookup string pattern '${jndi:}' which is the primary indicator of an exploitation attempt."
    result = agent.run(context=context, instruction=instruction)
    pprint.pp(result)