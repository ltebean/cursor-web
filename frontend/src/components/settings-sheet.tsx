"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Folder, Trash2, MessageSquare, Lock } from "lucide-react";
import { Model, Conversation } from "@/lib/types";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: string;
  onModelChange: (model: string) => void;
  models: Model[];
  workingDir: string;
  onBrowseDir: () => void;
  workingDirLocked: boolean;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function SettingsSheet({
  open,
  onOpenChange,
  model,
  onModelChange,
  models,
  workingDir,
  onBrowseDir,
  workingDirLocked,
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
}: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] sm:w-[340px] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-lg">Settings</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Working Directory */}
          <div className="px-4 py-3 space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Working Directory
            </label>
            <Button
              variant="outline"
              className="w-full justify-start text-left h-auto py-2.5"
              onClick={onBrowseDir}
              disabled={workingDirLocked}
            >
              {workingDirLocked ? (
                <Lock className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
              ) : (
                <Folder className="h-4 w-4 mr-2 shrink-0" />
              )}
              <span className="truncate text-sm">{workingDir}</span>
            </Button>
            {workingDirLocked && (
              <p className="text-[10px] text-muted-foreground">
                Start a new conversation to change directory
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="px-4 py-3 space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Model
            </label>
            <Select value={model} onValueChange={onModelChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Conversations */}
          <div className="flex-1 flex flex-col min-h-0 py-3">
            <div className="flex items-center justify-between px-4 mb-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Conversations
              </label>
              <Button variant="ghost" size="sm" onClick={onNewConversation} className="h-7 text-xs">
                + New
              </Button>
            </div>

            <ScrollArea className="flex-1 px-2">
              <div className="space-y-0.5">
                {conversations.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => {
                        onSelectConversation(conv.id);
                        onOpenChange(false);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{conv.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Folder className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                          <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                            {conv.working_dir.split("/").filter(Boolean).pop() || conv.working_dir}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 truncate">
                            {conv.working_dir}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {conv.message_count} msgs
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
