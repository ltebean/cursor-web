"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { SettingsSheet } from "@/components/settings-sheet";
import { DirectoryBrowser } from "@/components/directory-browser";
import {
  fetchModels,
  fetchConversations,
  fetchConversation,
  deleteConversation,
  cancelExecution,
  streamChat,
} from "@/lib/api";
import type { ToolCallStartEvent, ToolCallDoneEvent } from "@/lib/api";
import { Message, MessagePart, Model, Conversation, Mode } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { Menu, Zap } from "lucide-react";

export default function Home() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("agent");
  const [model, setModel] = useState("auto");
  const [workingDir, setWorkingDir] = useState("~/projects");
  const [models, setModels] = useState<Model[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dirBrowserOpen, setDirBrowserOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    const savedWorkingDir = localStorage.getItem("cursor-vibe-working-dir");
    const savedModel = localStorage.getItem("cursor-vibe-model");

    if (savedWorkingDir) {
      setWorkingDir(savedWorkingDir);
    }
    if (savedModel) {
      setModel(savedModel);
    }
  }, []);

  // Save working directory to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("cursor-vibe-working-dir", workingDir);
  }, [workingDir]);

  // Save model to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("cursor-vibe-model", model);
  }, [model]);

  const loadConversations = async () => {
    try {
      const data = await fetchConversations();
      if (data.conversations) setConversations(data.conversations);
    } catch {
      // ignore
    }
  };

  // Load models and conversations on mount
  useEffect(() => {
    fetchModels()
      .then((data) => {
        if (data.models) setModels(data.models);
      })
      .catch(() => {});
    loadConversations();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Helper: update the last assistant message's parts
  const updateLastAssistantParts = (
    updater: (parts: MessagePart[]) => MessagePart[]
  ) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === "assistant") {
        const currentParts = last.parts || [];
        const newParts = updater(currentParts);
        // Also build a plain content string from text parts
        const content = newParts
          .filter((p) => p.type === "text")
          .map((p) => p.content)
          .join("");
        updated[updated.length - 1] = {
          ...last,
          parts: newParts,
          content,
        };
      }
      return updated;
    });
  };

  const handleSend = useCallback(
    (prompt: string) => {
      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: prompt,
        timestamp: new Date().toISOString(),
      };

      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        parts: [],
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      streamChat(
        {
          prompt,
          working_dir: workingDir,
          model,
          mode,
          conversation_id: conversationId || undefined,
        },
        {
          onStart: (convId) => {
            setConversationId(convId);
          },
          onThinkingDelta: (data) => {
            updateLastAssistantParts((parts) => {
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.type === "thinking" && !lastPart.isComplete) {
                // Append to existing thinking part
                return [
                  ...parts.slice(0, -1),
                  { ...lastPart, content: lastPart.content + data },
                ];
              }
              // Create new thinking part
              return [
                ...parts,
                { type: "thinking" as const, content: data, isComplete: false },
              ];
            });
          },
          onThinkingDone: () => {
            updateLastAssistantParts((parts) => {
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.type === "thinking") {
                return [
                  ...parts.slice(0, -1),
                  { ...lastPart, isComplete: true },
                ];
              }
              return parts;
            });
          },
          onTextDelta: (data) => {
            updateLastAssistantParts((parts) => {
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.type === "text") {
                // Append to existing text part
                return [
                  ...parts.slice(0, -1),
                  { ...lastPart, content: lastPart.content + data },
                ];
              }
              // Create new text part
              return [
                ...parts,
                { type: "text" as const, content: data },
              ];
            });
          },
          onToolCallStart: (event: ToolCallStartEvent) => {
            updateLastAssistantParts((parts) => {
              return [
                ...parts,
                {
                  type: "tool_call" as const,
                  callId: event.call_id,
                  toolType: event.tool_type,
                  status: "running" as const,
                  command: event.command,
                  path: event.path,
                  fileContent: event.content,
                  pattern: event.pattern,
                  query: event.query,
                },
              ];
            });
          },
          onToolCallDone: (event: ToolCallDoneEvent) => {
            updateLastAssistantParts((parts) => {
              return parts.map((part) => {
                if (
                  part.type === "tool_call" &&
                  part.callId === event.call_id
                ) {
                  return {
                    ...part,
                    status: "completed" as const,
                    exitCode: event.exit_code,
                    stdout: event.stdout,
                    stderr: event.stderr,
                    message: event.message,
                    diff: event.diff,
                    linesAdded: event.lines_added,
                    linesRemoved: event.lines_removed,
                    totalLines: event.total_lines,
                    pattern: event.pattern,
                    query: event.query,
                  };
                }
                return part;
              });
            });
          },
          onOutput: (data) => {
            // Fallback for raw output
            updateLastAssistantParts((parts) => {
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.type === "text") {
                return [
                  ...parts.slice(0, -1),
                  { ...lastPart, content: lastPart.content + data },
                ];
              }
              return [
                ...parts,
                { type: "text" as const, content: data },
              ];
            });
          },
          onDone: () => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  isStreaming: false,
                };
              }
              return updated;
            });
            setIsLoading(false);
            loadConversations();
          },
          onError: (message) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: message,
                  isStreaming: false,
                  isError: true,
                };
              }
              return updated;
            });
            setIsLoading(false);
          },
        },
        controller.signal
      );
    },
    [workingDir, model, mode, conversationId]
  );

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (conversationId) {
      cancelExecution(conversationId).catch(() => {});
    }
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === "assistant" && last.isStreaming) {
        updated[updated.length - 1] = {
          ...last,
          content: last.content + "\n\n[Cancelled]",
          isStreaming: false,
        };
      }
      return updated;
    });
    setIsLoading(false);
  }, [conversationId]);

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  const handleSelectConversation = async (id: string) => {
    try {
      const data = await fetchConversation(id);
      if (data.conversation) {
        setConversationId(id);
        setWorkingDir(data.conversation.working_dir);
        setMessages(
          data.conversation.messages.map(
            (m: { role: string; content: string; timestamp: string }) => ({
              id: generateId(),
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            })
          )
        );
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      if (conversationId === id) {
        handleNewConversation();
      }
      loadConversations();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setSettingsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-base">cursor</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={handleNewConversation}
        >
          + New
        </Button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        <div className="py-4 min-h-full min-w-0">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onCancel={handleCancel}
        isLoading={isLoading}
        mode={mode}
        onModeChange={setMode}
      />

      {/* Settings Sheet */}
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        model={model}
        onModelChange={setModel}
        models={models}
        workingDir={workingDir}
        onBrowseDir={() => setDirBrowserOpen(true)}
        workingDirLocked={messages.length > 0}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />

      {/* Directory Browser */}
      <DirectoryBrowser
        open={dirBrowserOpen}
        onOpenChange={setDirBrowserOpen}
        currentPath={workingDir}
        onSelect={setWorkingDir}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
        <Zap className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Cursor web</h2>
      <p className="text-muted-foreground text-sm max-w-[280px] leading-relaxed">
        Describe what you want to build and the AI agent will write the code for
        you. Tap the menu to configure your project directory and model.
      </p>
    </div>
  );
}
