"use client";

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizontal, Square, Sparkles } from "lucide-react";
import { Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (prompt: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

const MODES: { value: Mode; label: string; icon: string }[] = [
  { value: "agent", label: "Agent", icon: "🤖" },
  { value: "plan", label: "Plan", icon: "📋" },
  { value: "ask", label: "Ask", icon: "💬" },
];

export function ChatInput({
  onSend,
  onCancel,
  isLoading,
  mode,
  onModeChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  return (
    <div className="border-t bg-background px-3 pb-[env(safe-area-inset-bottom)] pt-2">
      {/* Mode selector row */}
      <div className="flex gap-1 mb-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onModeChange(m.value)}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              mode === m.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <span>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2 pb-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            className="min-h-[40px] max-h-[120px] resize-none pl-9 pr-3 py-2 text-sm rounded-xl"
            rows={1}
          />
        </div>

        {isLoading ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={onCancel}
            className="h-10 w-10 rounded-xl shrink-0"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
            className="h-10 w-10 rounded-xl shrink-0"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
