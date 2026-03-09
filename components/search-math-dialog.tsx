"use client";

import { ArrowLeftIcon, SigmaIcon } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Loader } from "@/components/loader";
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
import type { MathSearchExampleEntry } from "@/lib/math-search/types";
import { Button } from "./ui/button";

interface SearchMathDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const PAPER_TITLE_PATTERN = /(?:^|\n)Title:\s*(.+)/;
const PAPER_ABSTRACT_PATTERN = /(?:^|\n)Abstract:\s*([\s\S]+)/;
const EXAMPLE_TYPING_INTERVAL_MS = 75;
const EXAMPLE_ERASE_INTERVAL_MS = 40;
const EXAMPLE_HOLD_INTERVAL_MS = 3400;
let cachedExampleSearches: MathSearchExampleEntry[] | null = null;
let preloadExampleSearchesPromise: Promise<MathSearchExampleEntry[]> | null =
  null;

const fetchMathResults = async (
  query: string,
  signal?: AbortSignal
): Promise<SearchMathResult[]> => {
  const response = await fetch("/api/math-search", {
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });

  const payload = (await response.json()) as {
    error?: string;
    results?: SearchMathResult[];
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Search failed");
  }

  return payload.results ?? [];
};

const getRenderableExampleSearches = (
  exampleSearches: MathSearchExampleEntry[]
): MathSearchExampleEntry[] => {
  const examplesWithResults = exampleSearches.filter(
    (exampleSearch) => exampleSearch.results.length > 0
  );

  if (examplesWithResults.length >= 2) {
    return examplesWithResults;
  }

  return exampleSearches;
};

const preloadExampleSearches = (): Promise<MathSearchExampleEntry[]> => {
  if (!preloadExampleSearchesPromise) {
    preloadExampleSearchesPromise = fetch("/api/math-search/examples")
      .then(async (response) => {
        const payload = (await response.json()) as {
          error?: string;
          examples?: MathSearchExampleEntry[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Example cache fetch failed");
        }

        cachedExampleSearches = getRenderableExampleSearches(
          payload.examples ?? []
        );
        return cachedExampleSearches;
      })
      .finally(() => {
        preloadExampleSearchesPromise = null;
      });
  }

  return preloadExampleSearchesPromise;
};

const truncateText = (text: string, maxLength: number): string => {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
};

const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const getString = (
  metadata: Record<string, unknown>,
  key: string
): string | null => {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

const extractPaperTitle = (text: string): string | null => {
  const match = text.match(PAPER_TITLE_PATTERN);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
};

const extractPaperAbstract = (text: string): string | null => {
  const match = text.match(PAPER_ABSTRACT_PATTERN);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
};

const getTheoremSlogan = (metadata: Record<string, unknown>): string =>
  getString(metadata, "slogan") ?? "Untitled theorem";

const getPaperText = (metadata: Record<string, unknown>): string =>
  getString(metadata, "text") ?? "";

const getPaperTitle = (metadata: Record<string, unknown>): string => {
  const text = getPaperText(metadata);
  return (
    extractPaperTitle(text) ??
    getString(metadata, "arxiv_id") ??
    "Untitled paper"
  );
};

const getPaperAbstract = (metadata: Record<string, unknown>): string => {
  const text = getPaperText(metadata);
  return extractPaperAbstract(text) ?? "No abstract available.";
};

const getResultTitle = (result: SearchMathResult): string => {
  if (result.source === "theorem") {
    return truncateText(getTheoremSlogan(result.metadata), 88);
  }

  return getPaperTitle(result.metadata);
};

const getResultSubtitle = (result: SearchMathResult): string => {
  if (result.source === "theorem") {
    const theoremId = getString(result.metadata, "theorem_id");
    return theoremId ? `Theorem ID ${theoremId}` : "Topology theorem";
  }

  const arxivId = getString(result.metadata, "arxiv_id");
  const abstract = truncateText(getPaperAbstract(result.metadata), 220);
  return arxivId ? `${arxivId} - ${abstract}` : abstract;
};

const getSourceLabel = (source: SearchMathResult["source"]): string =>
  source === "paper" ? "Paper" : "Theorem";

const useExampleSearches = (open: boolean) => {
  const [exampleSearches, setExampleSearches] = useState<
    MathSearchExampleEntry[]
  >(() => cachedExampleSearches ?? []);
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);
  const [areExamplesLoading, setAreExamplesLoading] = useState(false);

  const activeExample = useMemo(() => {
    if (exampleSearches.length === 0) {
      return null;
    }

    return (
      exampleSearches[activeExampleIndex % exampleSearches.length] ??
      exampleSearches[0]
    );
  }, [activeExampleIndex, exampleSearches]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (cachedExampleSearches && cachedExampleSearches.length > 0) {
      setExampleSearches(cachedExampleSearches);
      setAreExamplesLoading(false);
      return;
    }

    let isActive = true;
    setAreExamplesLoading(true);

    const preloadPromise = preloadExampleSearches();
    preloadPromise
      .then((cachedExamples) => {
        if (isActive) {
          setExampleSearches(cachedExamples);
        }
      })
      .finally(() => {
        if (isActive) {
          setAreExamplesLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [open]);

  const resetExampleSearches = useCallback(() => {
    setActiveExampleIndex(0);
  }, []);

  return {
    activeExample,
    activeExampleIndex,
    areExamplesLoading,
    exampleSearches,
    resetExampleSearches,
    setActiveExampleIndex,
  };
};

interface SearchMathResultsListProps {
  activeExample: MathSearchExampleEntry | null;
  areExamplesLoading: boolean;
  error: string | null;
  isLoading: boolean;
  isShowingExamples: boolean;
  onSelectResult: (result: SearchMathResult) => void;
  results: SearchMathResult[];
  trimmedQuery: string;
}

const useAnimatedExamplePlaceholder = ({
  activeQuery,
  exampleCount,
  isShowingExamples,
  open,
  setActiveExampleIndex,
}: {
  activeQuery: string | null;
  exampleCount: number;
  isShowingExamples: boolean;
  open: boolean;
  setActiveExampleIndex: Dispatch<SetStateAction<number>>;
}) => {
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!(open && isShowingExamples && activeQuery)) {
      setAnimatedPlaceholder("");
      setIsDeleting(false);
      return;
    }

    if (isDeleting) {
      if (animatedPlaceholder.length === 0) {
        setIsDeleting(false);
        if (exampleCount > 1) {
          setActiveExampleIndex(
            (currentIndex) => (currentIndex + 1) % exampleCount
          );
        }
        return;
      }

      const timer = window.setTimeout(() => {
        setAnimatedPlaceholder(
          activeQuery.slice(0, animatedPlaceholder.length - 1)
        );
      }, EXAMPLE_ERASE_INTERVAL_MS);

      return () => {
        window.clearTimeout(timer);
      };
    }

    if (animatedPlaceholder.length < activeQuery.length) {
      const timer = window.setTimeout(() => {
        setAnimatedPlaceholder(
          activeQuery.slice(0, animatedPlaceholder.length + 1)
        );
      }, EXAMPLE_TYPING_INTERVAL_MS);

      return () => {
        window.clearTimeout(timer);
      };
    }

    if (exampleCount < 2) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsDeleting(true);
    }, EXAMPLE_HOLD_INTERVAL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activeQuery,
    animatedPlaceholder,
    exampleCount,
    isDeleting,
    isShowingExamples,
    open,
    setActiveExampleIndex,
  ]);

  return animatedPlaceholder;
};

function SearchMathResultsList({
  activeExample,
  areExamplesLoading,
  error,
  isLoading,
  isShowingExamples,
  onSelectResult,
  results,
  trimmedQuery,
}: SearchMathResultsListProps) {
  const visibleResults = isShowingExamples
    ? (activeExample?.results ?? [])
    : results;

  return (
    <CommandList className="max-h-[420px]">
      {isShowingExamples && areExamplesLoading && (
        <div className="px-4">
          <Loader
            className="min-h-[240px]"
            label="Loading example searches..."
          />
        </div>
      )}

      {!isShowingExamples && trimmedQuery.length < 2 && (
        <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
      )}

      {!isShowingExamples &&
        trimmedQuery.length >= 2 &&
        !isLoading &&
        !error &&
        results.length === 0 && (
          <CommandEmpty>No matching results found.</CommandEmpty>
        )}

      {!isShowingExamples && isLoading && (
        <div className="px-4">
          <Loader className="min-h-[240px]" label="Searching the library..." />
        </div>
      )}
      {error && <CommandEmpty>{error}</CommandEmpty>}

      {isShowingExamples &&
        !areExamplesLoading &&
        !error &&
        activeExample &&
        activeExample.results.length === 0 && (
          <CommandEmpty>Example searches are unavailable.</CommandEmpty>
        )}

      {!(isLoading || areExamplesLoading || error) &&
        visibleResults.map((result) => (
          <CommandItem
            className="items-start gap-3 py-3"
            key={`${result.source}-${result.id}`}
            onSelect={() => onSelectResult(result)}
            value={`${result.id}-${getResultTitle(result)}`}
          >
            <SigmaIcon className="mt-0.5 h-4 w-4" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">
                  {getResultTitle(result)}
                </span>
                <Badge variant="outline">{getSourceLabel(result.source)}</Badge>
              </div>
              <span className="line-clamp-2 text-muted-foreground text-xs">
                {getResultSubtitle(result)}
              </span>
            </div>
          </CommandItem>
        ))}
    </CommandList>
  );
}

export function SearchMathDialog({
  open,
  onOpenChange,
}: SearchMathDialogProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const trimmedQuery = query.trim();
  const trimmedDeferredQuery = deferredQuery.trim();
  const [results, setResults] = useState<SearchMathResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchMathResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isShowingExamples = trimmedQuery.length === 0;
  const {
    activeExample,
    areExamplesLoading,
    exampleSearches,
    resetExampleSearches,
    setActiveExampleIndex,
  } = useExampleSearches(open);
  const animatedExamplePlaceholder = useAnimatedExamplePlaceholder({
    activeQuery: activeExample?.query ?? null,
    exampleCount: exampleSearches.length,
    isShowingExamples,
    open,
    setActiveExampleIndex,
  });

  useEffect(() => {
    if (!open || trimmedDeferredQuery.length < 2) {
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
        setResults(
          await fetchMathResults(trimmedDeferredQuery, controller.signal)
        );
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
  }, [open, trimmedDeferredQuery]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        setQuery("");
        setResults([]);
        resetExampleSearches();
        setSelectedResult(null);
        setError(null);
        setIsLoading(false);
      }
    },
    [onOpenChange, resetExampleSearches]
  );

  return (
    <>
      <Dialog onOpenChange={handleOpenChange} open={open && !selectedResult}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search Math</DialogTitle>
          <DialogDescription>
            Search across papers and theorem statements.
          </DialogDescription>
        </DialogHeader>
        <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={setQuery}
              placeholder={
                isShowingExamples && activeExample
                  ? animatedExamplePlaceholder
                  : "Search math papers and theorems..."
              }
              value={query}
            />
            <SearchMathResultsList
              activeExample={activeExample}
              areExamplesLoading={areExamplesLoading}
              error={error}
              isLoading={isLoading}
              isShowingExamples={isShowingExamples}
              onSelectResult={setSelectedResult}
              results={results}
              trimmedQuery={trimmedQuery}
            />
          </Command>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(detailOpen) => !detailOpen && setSelectedResult(null)}
        open={!!selectedResult}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Math Search Result</DialogTitle>
          <DialogDescription>Selected math search result</DialogDescription>
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
            <Badge variant="outline">
              {selectedResult ? getSourceLabel(selectedResult.source) : null}
            </Badge>
          </div>
          {selectedResult?.source === "paper" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-base">
                  {getPaperTitle(selectedResult.metadata)}
                </h3>
                {getString(selectedResult.metadata, "arxiv_id") ? (
                  <p className="text-muted-foreground text-sm">
                    arXiv: {getString(selectedResult.metadata, "arxiv_id")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 rounded-md border bg-muted/20 p-4">
                <p className="font-medium text-sm">Abstract</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {getPaperAbstract(selectedResult.metadata)}
                </p>
              </div>
            </div>
          ) : null}
          {selectedResult?.source === "theorem" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-base">
                  {truncateText(getTheoremSlogan(selectedResult.metadata), 120)}
                </h3>
                {getString(selectedResult.metadata, "theorem_id") ? (
                  <p className="text-muted-foreground text-sm">
                    Theorem ID:{" "}
                    {getString(selectedResult.metadata, "theorem_id")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 rounded-md border bg-muted/20 p-4">
                <p className="font-medium text-sm">Statement</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {getTheoremSlogan(selectedResult.metadata)}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
