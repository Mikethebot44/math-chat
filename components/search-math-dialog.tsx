"use client";

import { ArrowLeftIcon, SigmaIcon } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";

interface SearchMathResult {
  id: string;
  metadata: Record<string, unknown>;
  rerankScore: number;
  source: "paper" | "theorem" | "stack-exchange";
  vectorScore: number;
}

interface SearchMathDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const getTitleFromMetadata = (metadata: Record<string, unknown>): string => {
  const titleKeys = ["title", "name", "question", "theorem", "paper_title"];
  for (const key of titleKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "Untitled result";
};

const getSubtitleFromMetadata = (metadata: Record<string, unknown>): string => {
  const subtitleKeys = ["abstract", "summary", "snippet", "text", "body"];
  for (const key of subtitleKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "No preview available";
};

export function SearchMathDialog({
  open,
  onOpenChange,
}: SearchMathDialogProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<SearchMathResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchMathResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || deferredQuery.trim().length < 2) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/math-search", {
          body: JSON.stringify({ query: deferredQuery }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          error?: string;
          results?: SearchMathResult[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Search failed");
        }

        setResults(payload.results ?? []);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          fetchError instanceof Error ? fetchError.message : "Search failed"
        );
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, deferredQuery]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        setQuery("");
        setResults([]);
        setSelectedResult(null);
        setError(null);
      }
    },
    [onOpenChange]
  );

  const selectedMetadata = useMemo(
    () =>
      selectedResult ? JSON.stringify(selectedResult.metadata, null, 2) : "",
    [selectedResult]
  );

  return (
    <>
      <Dialog onOpenChange={handleOpenChange} open={open && !selectedResult}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search Math</DialogTitle>
          <DialogDescription>
            Search across papers, theorems, and Stack Exchange entries.
          </DialogDescription>
        </DialogHeader>
        <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={setQuery}
              placeholder="Search math papers, theorems, and Stack Exchange..."
              value={query}
            />
            <CommandList className="max-h-[420px]">
              {query.trim().length < 2 && (
                <CommandEmpty>
                  Type at least 2 characters to search.
                </CommandEmpty>
              )}

              {query.trim().length >= 2 &&
                !isLoading &&
                !error &&
                results.length === 0 && (
                  <CommandEmpty>No matching results found.</CommandEmpty>
                )}

              {isLoading && <CommandEmpty>Searching…</CommandEmpty>}
              {error && <CommandEmpty>{error}</CommandEmpty>}

              {!(isLoading || error) &&
                results.map((result) => (
                  <CommandItem
                    className="items-start gap-3 py-3"
                    key={`${result.source}-${result.id}`}
                    onSelect={() => setSelectedResult(result)}
                    value={`${result.id}-${getTitleFromMetadata(result.metadata)}`}
                  >
                    <SigmaIcon className="mt-0.5 h-4 w-4" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {getTitleFromMetadata(result.metadata)}
                        </span>
                        <Badge className="capitalize" variant="outline">
                          {result.source}
                        </Badge>
                      </div>
                      <span className="line-clamp-2 text-muted-foreground text-xs">
                        {getSubtitleFromMetadata(result.metadata)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(detailOpen) => !detailOpen && setSelectedResult(null)}
        open={!!selectedResult}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Math Search Result</DialogTitle>
          <DialogDescription>Selected result metadata</DialogDescription>
        </DialogHeader>
        <DialogContent className="gap-3 sm:max-w-2xl">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => setSelectedResult(null)}
              size="sm"
              variant="outline"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to search
            </Button>
            <Badge className="capitalize" variant="outline">
              {selectedResult?.source}
            </Badge>
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-xs leading-relaxed">
            {selectedMetadata}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
