import asyncio
import json
import os
import re
import sys
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Cursor vibe coding")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
conversations: dict = {}
active_processes: dict = {}

CURSOR_PATH = os.environ.get("CURSOR_PATH", "cursor")

AVAILABLE_MODELS = [
    {"id": "auto", "name": "Auto"},
    {"id": "claude-4-opus", "name": "Claude 4 Opus"},
    {"id": "claude-4-sonnet", "name": "Claude 4 Sonnet"},
    {"id": "gpt-5.2", "name": "GPT-5.2"},
    {"id": "gpt-5.3", "name": "GPT-5.3"},
    {"id": "gemini-3-flash", "name": "Gemini 3 Flash"},
    {"id": "gemini-3-pro", "name": "Gemini 3 Pro"},
]

ANSI_ESCAPE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub("", text)


class ChatRequest(BaseModel):
    prompt: str
    working_dir: str = "~"
    model: str = ""
    mode: str = "agent"
    conversation_id: Optional[str] = None


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/models")
async def get_models():
    return {"models": AVAILABLE_MODELS}


@app.get("/api/conversations")
async def list_conversations():
    result = []
    for cid, conv in conversations.items():
        result.append(
            {
                "id": cid,
                "title": conv["title"],
                "working_dir": conv["working_dir"],
                "created_at": conv["created_at"],
                "message_count": len(conv["messages"]),
            }
        )
    return {
        "conversations": sorted(result, key=lambda x: x["created_at"], reverse=True)
    }


@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    if conversation_id not in conversations:
        return {"error": "Not found"}
    return {"conversation": conversations[conversation_id]}


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    conversations.pop(conversation_id, None)
    return {"status": "ok"}


@app.get("/api/browse")
async def browse_directory(path: str = "~"):
    expanded = os.path.expanduser(path)
    if not os.path.isdir(expanded):
        return {
            "error": "Not a directory",
            "entries": [],
            "current": expanded,
            "parent": "",
        }

    entries = []
    try:
        for entry in sorted(os.listdir(expanded)):
            if entry.startswith("."):
                continue
            full_path = os.path.join(expanded, entry)
            entries.append(
                {
                    "name": entry,
                    "path": full_path,
                    "is_dir": os.path.isdir(full_path),
                }
            )
    except PermissionError:
        return {
            "error": "Permission denied",
            "entries": [],
            "current": expanded,
            "parent": "",
        }

    return {
        "current": expanded,
        "parent": os.path.dirname(expanded),
        "entries": entries,
    }


def _detect_tool_type(tool_call: dict) -> tuple[str, dict]:
    """Detect the tool type and return (type_name, tool_data)."""
    for key, value in tool_call.items():
        if key == "shellToolCall":
            return "shell", value
        elif key == "editToolCall":
            return "file_edit", value
        elif key == "readToolCall":
            return "read_file", value
        elif key == "grepToolCall":
            return "grep", value
        elif key == "globToolCall":
            return "list_files", value
        elif key == "codebaseSearchToolCall":
            return "search", value
    # Fallback: try to detect any *ToolCall key
    for key, value in tool_call.items():
        if key.endswith("ToolCall"):
            # Extract a readable name: "someToolCall" -> "some"
            name = key.replace("ToolCall", "")
            return name, value
    return "unknown", {}


def _parse_tool_call_started(event: dict) -> dict:
    """Parse a tool_call started event into a frontend-friendly format."""
    tool_call = event.get("tool_call", {})
    call_id = event.get("call_id", "")
    tool_type, data = _detect_tool_type(tool_call)
    args = data.get("args", {})

    base = {
        "type": "tool_call_start",
        "call_id": call_id,
        "tool_type": tool_type,
    }

    if tool_type == "shell":
        base["command"] = args.get("command", "")
    elif tool_type == "file_edit":
        base["path"] = args.get("path", "")
        base["content"] = args.get("streamContent", "")
    elif tool_type == "read_file":
        base["path"] = args.get("path", "")
    elif tool_type == "grep":
        base["pattern"] = args.get("pattern", "")
        base["path"] = args.get("path", "")
    elif tool_type == "list_files":
        base["path"] = args.get("targetDirectory", "")
        base["pattern"] = args.get("globPattern", "")
    elif tool_type == "search":
        base["query"] = args.get("query", "")

    return base


def _parse_tool_call_completed(event: dict) -> dict:
    """Parse a tool_call completed event into a frontend-friendly format."""
    tool_call = event.get("tool_call", {})
    call_id = event.get("call_id", "")
    tool_type, data = _detect_tool_type(tool_call)
    args = data.get("args", {})
    result = data.get("result", {})
    success = result.get("success", {})

    base = {
        "type": "tool_call_done",
        "call_id": call_id,
        "tool_type": tool_type,
    }

    if tool_type == "shell":
        base["command"] = args.get("command", "")
        base["exit_code"] = success.get("exitCode", -1)
        base["stdout"] = success.get("stdout", "")
        base["stderr"] = success.get("stderr", "")
    elif tool_type == "file_edit":
        base["path"] = args.get("path", "")
        base["message"] = success.get("message", "")
        base["diff"] = success.get("diffString", "")
        base["lines_added"] = success.get("linesAdded", 0)
        base["lines_removed"] = success.get("linesRemoved", 0)
    elif tool_type == "read_file":
        base["path"] = args.get("path", "")
        base["total_lines"] = success.get("totalLines", 0)
    elif tool_type == "grep":
        base["pattern"] = args.get("pattern", "")
        base["path"] = args.get("path", "")
    elif tool_type == "list_files":
        base["path"] = args.get("targetDirectory", "")
        base["pattern"] = args.get("globPattern", "")
    elif tool_type == "search":
        base["query"] = args.get("query", "")

    return base


@app.post("/api/chat")
async def chat(request: ChatRequest):
    conversation_id = request.conversation_id or str(uuid.uuid4())
    working_dir = os.path.expanduser(request.working_dir)

    if not os.path.isdir(working_dir):
        raise HTTPException(status_code=400, detail=f"Directory not found: {working_dir}")

    # Create or update conversation
    if conversation_id not in conversations:
        conversations[conversation_id] = {
            "id": conversation_id,
            "title": request.prompt[:60],
            "working_dir": working_dir,
            "created_at": datetime.now().isoformat(),
            "messages": [],
            "cli_session_id": None,  # Will be set from CLI's session_id
        }

    conversations[conversation_id]["messages"].append(
        {
            "role": "user",
            "content": request.prompt,
            "timestamp": datetime.now().isoformat(),
        }
    )

    # Build command with stream-json format for structured output
    cmd = [
        CURSOR_PATH, "agent", "-p", request.prompt,
        "--trust", "--yolo",
        "--output-format", "stream-json",
        "--stream-partial-output",
    ]

    # Resume CLI session if we have a previous session_id
    cli_session_id = conversations[conversation_id].get("cli_session_id")
    if cli_session_id:
        cmd.extend(["--resume", cli_session_id])

    if request.model and request.model != "auto":
        cmd.extend(["--model", request.model])
    if request.mode and request.mode != "agent":
        cmd.extend(["--mode", request.mode])

    async def generate():
        full_text = ""
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=working_dir,
            )
            active_processes[conversation_id] = process

            yield f"data: {json.dumps({'type': 'start', 'conversation_id': conversation_id})}\n\n"

            # Track the last assistant message text to only send deltas
            last_assistant_text = ""

            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").strip()
                if not text:
                    continue

                try:
                    event = json.loads(text)
                except json.JSONDecodeError:
                    # Not JSON, send as raw output
                    cleaned = strip_ansi(text)
                    yield f"data: {json.dumps({'type': 'output', 'data': cleaned})}\n\n"
                    continue

                event_type = event.get("type", "")
                event_subtype = event.get("subtype", "")

                # Capture CLI session_id from init event
                if event_type == "system" and event_subtype == "init":
                    new_session_id = event.get("session_id", "")
                    if new_session_id:
                        conversations[conversation_id]["cli_session_id"] = new_session_id
                        yield f"data: {json.dumps({'type': 'session_info', 'cli_session_id': new_session_id})}\n\n"
                    continue

                if event_type == "thinking" and event_subtype == "delta":
                    delta_text = event.get("text", "")
                    if delta_text:
                        yield f"data: {json.dumps({'type': 'thinking_delta', 'data': delta_text})}\n\n"

                elif event_type == "thinking" and event_subtype == "completed":
                    yield f"data: {json.dumps({'type': 'thinking_done'})}\n\n"

                elif event_type == "assistant":
                    # The assistant event contains the full accumulated text so far
                    msg = event.get("message", {})
                    content_parts = msg.get("content", [])
                    current_text = ""
                    for part in content_parts:
                        if part.get("type") == "text":
                            current_text += part.get("text", "")

                    # Only send the new delta
                    if len(current_text) > len(last_assistant_text):
                        delta = current_text[len(last_assistant_text):]
                        last_assistant_text = current_text
                        full_text = current_text
                        yield f"data: {json.dumps({'type': 'text_delta', 'data': delta})}\n\n"

                elif event_type == "tool_call" and event_subtype == "started":
                    parsed = _parse_tool_call_started(event)
                    yield f"data: {json.dumps(parsed)}\n\n"

                elif event_type == "tool_call" and event_subtype == "completed":
                    parsed = _parse_tool_call_completed(event)
                    yield f"data: {json.dumps(parsed)}\n\n"

                elif event_type == "result":
                    result_text = event.get("result", "")
                    if result_text:
                        full_text = result_text

                elif event_type == "user":
                    # Skip user echo events
                    continue

            exit_code = await process.wait()

            conversations[conversation_id]["messages"].append(
                {
                    "role": "assistant",
                    "content": full_text,
                    "timestamp": datetime.now().isoformat(),
                }
            )

            yield f"data: {json.dumps({'type': 'done', 'exit_code': exit_code})}\n\n"

        except FileNotFoundError:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Cursor CLI not found. Make sure cursor is installed and in your PATH.'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            active_processes.pop(conversation_id, None)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/cancel/{conversation_id}")
async def cancel(conversation_id: str):
    if conversation_id in active_processes:
        process = active_processes[conversation_id]
        try:
            process.terminate()
        except Exception:
            pass
        return {"status": "cancelled"}
    return {"status": "not_found"}


if __name__ == "__main__":
    import uvicorn

    use_reload = "--reload" in sys.argv
    uvicorn.run(
        "main:app" if use_reload else app,
        host="0.0.0.0",
        port=8010,
        reload=use_reload,
    )
