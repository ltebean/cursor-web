#!/bin/bash

# Start both frontend and backend servers with hot reload
# Usage: ./start.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend with --reload for watching code changes
echo "Starting backend on port 8010 (with hot reload)..."
cd "$SCRIPT_DIR/backend"
uv run python main.py --reload &
BACKEND_PID=$!

# Start frontend (Next.js dev server has built-in hot reload)
echo "Starting frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8010 (hot reload enabled)"
echo "Frontend: http://localhost:3000 (hot reload enabled)"
echo ""
echo "Press Ctrl+C to stop both servers."

wait
