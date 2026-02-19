"""SQLite storage for conversations and messages."""

import json
import os
import sqlite3
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "cursor_web.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = _get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            working_dir TEXT NOT NULL,
            created_at TEXT NOT NULL,
            cli_session_id TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conversation
            ON messages(conversation_id);
        """
    )
    conn.commit()
    conn.close()


# ── Conversations ──────────────────────────────────────────────


def create_conversation(
    conversation_id: str,
    title: str,
    working_dir: str,
) -> dict:
    conn = _get_conn()
    now = datetime.now().isoformat()
    conn.execute(
        "INSERT OR IGNORE INTO conversations (id, title, working_dir, created_at) VALUES (?, ?, ?, ?)",
        (conversation_id, title, working_dir, now),
    )
    conn.commit()
    conv = get_conversation(conversation_id, conn)
    conn.close()
    return conv


def get_conversation(conversation_id: str, conn: Optional[sqlite3.Connection] = None) -> Optional[dict]:
    should_close = conn is None
    if conn is None:
        conn = _get_conn()

    row = conn.execute(
        "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
    ).fetchone()

    if not row:
        if should_close:
            conn.close()
        return None

    messages = conn.execute(
        "SELECT role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY id",
        (conversation_id,),
    ).fetchall()

    result = {
        "id": row["id"],
        "title": row["title"],
        "working_dir": row["working_dir"],
        "created_at": row["created_at"],
        "cli_session_id": row["cli_session_id"],
        "messages": [dict(m) for m in messages],
    }

    if should_close:
        conn.close()
    return result


def list_conversations() -> list[dict]:
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT c.id, c.title, c.working_dir, c.created_at,
               COUNT(m.id) as message_count
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
        """
    ).fetchall()
    result = [dict(r) for r in rows]
    conn.close()
    return result


def delete_conversation(conversation_id: str):
    conn = _get_conn()
    conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    conn.close()


def set_cli_session_id(conversation_id: str, cli_session_id: str):
    conn = _get_conn()
    conn.execute(
        "UPDATE conversations SET cli_session_id = ? WHERE id = ?",
        (cli_session_id, conversation_id),
    )
    conn.commit()
    conn.close()


def get_cli_session_id(conversation_id: str) -> Optional[str]:
    conn = _get_conn()
    row = conn.execute(
        "SELECT cli_session_id FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()
    conn.close()
    if row:
        return row["cli_session_id"]
    return None


# ── Messages ───────────────────────────────────────────────────


def add_message(conversation_id: str, role: str, content: str) -> dict:
    conn = _get_conn()
    now = datetime.now().isoformat()
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
        (conversation_id, role, content, now),
    )
    conn.commit()
    conn.close()
    return {"role": role, "content": content, "timestamp": now}
