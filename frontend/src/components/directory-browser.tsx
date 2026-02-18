"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, ChevronUp, Check } from "lucide-react";
import { browseDirectory } from "@/lib/api";
import { BrowseResult } from "@/lib/types";

interface DirectoryBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  onSelect: (path: string) => void;
}

export function DirectoryBrowser({
  open,
  onOpenChange,
  currentPath,
  onSelect,
}: DirectoryBrowserProps) {
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [pathInput, setPathInput] = useState(currentPath);
  const [loading, setLoading] = useState(false);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const result = await browseDirectory(path);
      setBrowseResult(result);
      setPathInput(result.current || path);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDirectory(currentPath);
    }
  }, [open, currentPath]);

  const handleGoUp = () => {
    if (browseResult?.parent) {
      loadDirectory(browseResult.parent);
    }
  };

  const handleSelect = () => {
    onSelect(pathInput);
    onOpenChange(false);
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDirectory(pathInput);
  };

  const directories = browseResult?.entries.filter((e) => e.is_dir) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Working Directory</DialogTitle>
        </DialogHeader>

        <form onSubmit={handlePathSubmit} className="flex gap-2">
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="/path/to/project"
            className="text-sm"
          />
          <Button type="submit" variant="outline" size="sm">
            Go
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoUp}
            disabled={!browseResult?.parent}
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            Up
          </Button>
          {browseResult?.error && (
            <span className="text-xs text-destructive">
              {browseResult.error}
            </span>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
          <div className="space-y-0.5 pr-4">
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Loading...
              </div>
            ) : directories.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No subdirectories
              </div>
            ) : (
              directories.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => loadDirectory(entry.path)}
                  className="flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                >
                  <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{entry.name}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <Button onClick={handleSelect} className="w-full">
          <Check className="h-4 w-4 mr-2" />
          Select This Directory
        </Button>
      </DialogContent>
    </Dialog>
  );
}
