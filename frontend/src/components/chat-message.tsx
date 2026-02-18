"use client";

import { useState } from "react";
import { Message, MessagePart, ToolCallPart, ThinkingPart } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Brain,
  Terminal,
  FileEdit,
  FileText,
  Search,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Plus,
  Minus,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface ChatMessageProps {
  message: Message;
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-5 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-muted-foreground/15 text-[0.9em] font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          "block p-3 rounded-md text-[0.85em] font-mono bg-muted-foreground/15 whitespace-pre",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-semibold mt-2 mb-1 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium mt-2 mb-1 first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-muted-foreground/40 pl-3 my-2 text-muted-foreground">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
};

function ThinkingBlock({ part }: { part: ThinkingPart }) {
  const [expanded, setExpanded] = useState(false);
  const content = part.content.trim();
  if (!content) return null;

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain className="h-3.5 w-3.5 text-purple-400" />
        <span className="font-medium">Thinking</span>
        {!part.isComplete && (
          <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
        )}
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="mt-1 ml-5 pl-2 border-l-2 border-purple-400/30 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
          {content}
        </div>
      )}
    </div>
  );
}

/** Get display info for any tool type */
function getToolDisplayInfo(part: ToolCallPart): {
  icon: React.ReactNode;
  label: string;
  detail: string;
  color: string;
} {
  const iconClass = "h-3.5 w-3.5 shrink-0";

  switch (part.toolType) {
    case "shell":
      return {
        icon: <Terminal className={cn(iconClass, "text-blue-400")} />,
        label: "Run",
        detail: part.command || "Running command...",
        color: "blue",
      };
    case "file_edit":
      return {
        icon: <FileEdit className={cn(iconClass, "text-amber-400")} />,
        label: "Edit",
        detail: part.path?.split("/").pop() || part.path || "file",
        color: "amber",
      };
    case "read_file":
      return {
        icon: <FileText className={cn(iconClass, "text-green-400")} />,
        label: "Read",
        detail: part.path?.split("/").pop() || part.path || "file",
        color: "green",
      };
    case "grep":
      return {
        icon: <Search className={cn(iconClass, "text-cyan-400")} />,
        label: "Grep",
        detail: part.pattern
          ? `"${part.pattern}"${part.path ? ` in ${part.path.split("/").pop()}` : ""}`
          : "Searching...",
        color: "cyan",
      };
    case "list_files":
      return {
        icon: <FolderOpen className={cn(iconClass, "text-orange-400")} />,
        label: "List",
        detail: part.path
          ? `${part.path.split("/").pop() || part.path}${part.pattern ? `/${part.pattern}` : ""}`
          : "Listing files...",
        color: "orange",
      };
    case "search":
      return {
        icon: <Search className={cn(iconClass, "text-violet-400")} />,
        label: "Search",
        detail: part.query || "Searching codebase...",
        color: "violet",
      };
    default:
      return {
        icon: <Terminal className={cn(iconClass, "text-muted-foreground")} />,
        label: part.toolType || "Tool",
        detail: part.command || part.path || part.pattern || part.query || "",
        color: "gray",
      };
  }
}

function ShellToolCallBlock({ part }: { part: ToolCallPart }) {
  const [expanded, setExpanded] = useState(true);
  const isRunning = part.status === "running";

  return (
    <div className="my-2 rounded-lg border border-border/60 overflow-hidden bg-card/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <Terminal className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        <code className="text-xs font-mono text-foreground truncate flex-1">
          {part.command || "Running command..."}
        </code>
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 shrink-0" />
        ) : (
          <CheckCircle2
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              part.exitCode === 0 ? "text-green-500" : "text-red-500"
            )}
          />
        )}
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded &&
        part.status === "completed" &&
        (part.stdout || part.stderr) && (
          <div className="border-t border-border/60 px-3 py-2 bg-black/20">
            {part.stdout && (
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre max-h-60 overflow-auto">
                {part.stdout.trim()}
              </pre>
            )}
            {part.stderr && (
              <pre className="text-xs font-mono text-red-400 whitespace-pre max-h-40 overflow-auto mt-1">
                {part.stderr.trim()}
              </pre>
            )}
          </div>
        )}
    </div>
  );
}

function FileEditToolCallBlock({ part }: { part: ToolCallPart }) {
  const [expanded, setExpanded] = useState(true);
  const isRunning = part.status === "running";
  const fileName = part.path?.split("/").pop() || part.path || "file";

  return (
    <div className="my-2 rounded-lg border border-border/60 overflow-hidden bg-card/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <FileEdit className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <code className="text-xs font-mono text-foreground truncate flex-1">
          {fileName}
        </code>
        {part.status === "completed" && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            {part.linesAdded !== undefined && part.linesAdded > 0 && (
              <span className="flex items-center text-green-500">
                <Plus className="h-3 w-3" />
                {part.linesAdded}
              </span>
            )}
            {part.linesRemoved !== undefined && part.linesRemoved > 0 && (
              <span className="flex items-center text-red-500">
                <Minus className="h-3 w-3" />
                {part.linesRemoved}
              </span>
            )}
          </span>
        )}
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400 shrink-0" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
        )}
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && part.status === "completed" && (
        <div className="border-t border-border/60 px-3 py-2 bg-black/20">
          {part.path && (
            <div className="text-xs text-muted-foreground mb-1 font-mono truncate" title={part.path}>
              {part.path}
            </div>
          )}
          {part.diff && (
            <pre className="text-xs font-mono whitespace-pre max-h-60 overflow-auto">
              {part.diff.split("\n").map((line, i) => (
                <span
                  key={i}
                  className={cn(
                    "block",
                    line.startsWith("+") && "text-green-500",
                    line.startsWith("-") && "text-red-500"
                  )}
                >
                  {line}
                </span>
              ))}
            </pre>
          )}
          {part.message && !part.diff && (
            <div className="text-xs text-muted-foreground">{part.message}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** Generic compact tool call block for read_file, grep, list_files, search, etc. */
function GenericToolCallBlock({ part }: { part: ToolCallPart }) {
  const isRunning = part.status === "running";
  const { icon, label, detail } = getToolDisplayInfo(part);

  return (
    <div className="my-1 flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted-foreground/5 text-xs">
      {icon}
      <span className="font-medium text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="text-muted-foreground truncate font-mono text-[11px]">
        {detail}
      </span>
      <span className="ml-auto shrink-0">
        {isRunning ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        )}
      </span>
    </div>
  );
}

function ToolCallBlock({ part }: { part: ToolCallPart }) {
  if (part.toolType === "shell") {
    return <ShellToolCallBlock part={part} />;
  }
  if (part.toolType === "file_edit") {
    return <FileEditToolCallBlock part={part} />;
  }
  // All other tool types use the compact generic block
  return <GenericToolCallBlock part={part} />;
}

function MessagePartRenderer({ part }: { part: MessagePart }) {
  switch (part.type) {
    case "thinking":
      return <ThinkingBlock part={part} />;
    case "tool_call":
      return <ToolCallBlock part={part} />;
    case "text": {
      const content = part.content.trim();
      if (!content) return null;
      return (
        <div className="chat-markdown break-words min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }
    default:
      return null;
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasParts = message.parts && message.parts.length > 0;

  return (
    <div
      className={cn(
        "flex px-4 py-3 min-w-0 w-full",
        isUser ? "flex-row-reverse" : ""
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-1 overflow-hidden",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed min-w-0 max-w-full overflow-hidden",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md",
            message.isError && "bg-destructive/10 text-destructive"
          )}
        >
          {message.isError && (
            <div className="flex items-center gap-1.5 mb-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Error
            </div>
          )}
          {isUser ? (
            <pre className="whitespace-pre-wrap break-words font-sans">
              {message.content}
            </pre>
          ) : hasParts ? (
            <div className="min-w-0 w-full">
              {message.parts!.map((part, index) => (
                <MessagePartRenderer key={index} part={part} />
              ))}
            </div>
          ) : (
            <div className="chat-markdown break-words min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}
