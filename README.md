# Cursor Web

A web-based interface for [Cursor](https://www.cursor.com/) AI coding agent. Chat with AI to write, edit, and manage code directly from your browser.

## Features

- Chat with AI coding agent (powered by Cursor CLI)
- Multiple model support (Claude, GPT, Gemini)
- Real-time streaming responses with thinking, tool calls, and code diffs
- File editing, shell commands, grep, search, and file browsing
- Conversation history management
- Configurable working directory
- Mobile-friendly responsive UI

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (3.12+)
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- [Cursor CLI](https://www.cursor.com/) installed and available in PATH

## Quick Start

```bash
# Clone the repo
git clone <repo-url>
cd cursor-web

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start both frontend and backend
./start.sh
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8010

## Project Structure

```
cursor-web/
├── backend/           # FastAPI backend
│   ├── main.py        # API server (chat, models, conversations)
│   └── pyproject.toml
├── frontend/          # Next.js frontend
│   └── src/
│       ├── app/       # Pages
│       ├── components/# UI components
│       └── lib/       # API client, types, utils
├── start.sh           # Start both servers
└── README.md
```

## Configuration

- **Working directory**: Set via the settings menu in the UI
- **Model**: Select from the settings menu
- **Cursor CLI path**: Set via `CURSOR_PATH` environment variable (defaults to `cursor`)
