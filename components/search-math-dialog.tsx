"use client";

import { ExternalLinkIcon, FileTextIcon } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
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
import {
  MATH_SEARCH_EXAMPLE_QUERIES,
  type MathSearchResult,
} from "@/lib/math-search/types";

interface SearchMathDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const EXAMPLE_TYPING_INTERVAL_MS = 75;
const EXAMPLE_ERASE_INTERVAL_MS = 40;
const EXAMPLE_HOLD_INTERVAL_MS = 3400;
const WWW_PREFIX_PATTERN = /^www\./;
const EXAMPLE_QUERIES = [...MATH_SEARCH_EXAMPLE_QUERIES];

const fetchMathResults = async (
  query: string,
  signal?: AbortSignal
): Promise<MathSearchResult[]> => {
  const response = await fetch("/api/math-search", {
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });

  const payload = (await response.json()) as {
    error?: string;
    results?: MathSearchResult[];
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Search failed");
  }

  return payload.results ?? [];
};

const truncateText = (text: string, maxLength: number): string => {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
};

const formatPublishedDate = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getHostname = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(WWW_PREFIX_PATTERN, "");
  } catch {
    return null;
  }
};

const getResultTitle = (result: MathSearchResult): string => result.title;

const getResultSubtitle = (result: MathSearchResult): string =>
  truncateText(result.abstract || "No abstract available.", 220);

const getResultMeta = (result: MathSearchResult): string | null => {
  const segments = [
    result.authors.length > 0
      ? truncateText(result.authors.join(", "), 80)
      : null,
    formatPublishedDate(result.publishedDate),
    getHostname(result.url),
  ].filter((segment): segment is string => Boolean(segment));

  if (segments.length === 0) {
    return null;
  }

  return segments.join(" | ");
};

const openPaperInNewTab = (url: string) => {
  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (newWindow) {
    newWindow.opener = null;
  }
};

interface SearchMathResultsListProps {
  error: string | null;
  hasPendingChanges: boolean;
  isLoading: boolean;
  onSelectResult: (result: MathSearchResult) => void;
  results: MathSearchResult[];
  submittedQuery: string;
}

const useAnimatedExamplePlaceholder = ({
  activeQuery,
  exampleCount,
  open,
  setActiveExampleIndex,
}: {
  activeQuery: string | null;
  exampleCount: number;
  open: boolean;
  setActiveExampleIndex: Dispatch<SetStateAction<number>>;
}) => {
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!(open && activeQuery)) {
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
    open,
    setActiveExampleIndex,
  ]);

  return animatedPlaceholder;
};

function SearchMathResultsList({
  error,
  hasPendingChanges,
  isLoading,
  onSelectResult,
  results,
  submittedQuery,
}: SearchMathResultsListProps) {
  const shouldShowSearchState = !hasPendingChanges && submittedQuery.length > 0;
  const isShortQuery = shouldShowSearchState && submittedQuery.length < 2;
  const canShowResults = shouldShowSearchState && submittedQuery.length >= 2;

  return (
    <CommandList className="max-h-[420px]">
      {isShortQuery && (
        <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
      )}

      {canShowResults && !isLoading && !error && results.length === 0 && (
        <CommandEmpty>No matching papers found.</CommandEmpty>
      )}

      {canShowResults && isLoading && (
        <div className="px-4">
          <Loader className="min-h-[240px]" label="Searching papers..." />
        </div>
      )}

      {canShowResults && error && <CommandEmpty>{error}</CommandEmpty>}

      {canShowResults &&
        !(isLoading || error) &&
        results.map((result) => {
          const metadataLine = getResultMeta(result);

          return (
            <CommandItem
              className="items-start gap-3 py-3"
              key={result.id}
              onSelect={() => onSelectResult(result)}
              value={`${result.id}-${result.title}`}
            >
              <FileTextIcon className="mt-0.5 h-4 w-4" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <span className="line-clamp-2 font-medium">
                    {getResultTitle(result)}
                  </span>
                  <ExternalLinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                {metadataLine ? (
                  <span className="line-clamp-1 text-muted-foreground text-xs">
                    {metadataLine}
                  </span>
                ) : null}
                <span className="line-clamp-2 text-muted-foreground text-xs">
                  {getResultSubtitle(result)}
                </span>
              </div>
            </CommandItem>
          );
        })}
    </CommandList>
  );
}

export function SearchMathDialog({
  open,
  onOpenChange,
}: SearchMathDialogProps) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<MathSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isShowingExamples = trimmedQuery.length === 0;
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);
  const activeExampleQuery =
    EXAMPLE_QUERIES[activeExampleIndex % EXAMPLE_QUERIES.length] ?? null;
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasPendingChanges =
    submittedQuery.length > 0 && submittedQuery !== trimmedQuery;
  const animatedExamplePlaceholder = useAnimatedExamplePlaceholder({
    activeQuery: isShowingExamples ? activeExampleQuery : null,
    exampleCount: EXAMPLE_QUERIES.length,
    open,
    setActiveExampleIndex,
  });

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setQuery("");
        setSubmittedQuery("");
        setResults([]);
        setActiveExampleIndex(0);
        setError(null);
        setIsLoading(false);
      }
    },
    [onOpenChange]
  );

  const handleSelectResult = useCallback(
    (result: MathSearchResult) => {
      openPaperInNewTab(result.url);
      handleOpenChange(false);
    },
    [handleOpenChange]
  );

  const handleSubmit = useCallback(async () => {
    if (!open) {
      return;
    }

    abortControllerRef.current?.abort();
    const nextSubmittedQuery = trimmedQuery;
    setSubmittedQuery(nextSubmittedQuery);
    setResults([]);
    setError(null);

    if (nextSubmittedQuery.length < 2) {
      setIsLoading(false);
      abortControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    try {
      setResults(await fetchMathResults(nextSubmittedQuery, controller.signal));
    } catch (fetchError) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        fetchError instanceof Error ? fetchError.message : "Search failed"
      );
      setResults([]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [open, trimmedQuery]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search Papers</DialogTitle>
        <DialogDescription>
          Search math research papers and open them directly.
        </DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput
              className="pr-20"
              containerClassName="pr-3"
              onKeyDown={async (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  await handleSubmit();
                }
              }}
              onValueChange={setQuery}
              placeholder={
                isShowingExamples && activeExampleQuery
                  ? animatedExamplePlaceholder
                  : "Search math research papers..."
              }
              value={query}
            />
            <Button
              className="absolute top-1/2 right-3 h-7 -translate-y-1/2 px-3 text-xs"
              disabled={isLoading || trimmedQuery.length === 0}
              onClick={handleSubmit}
              size="sm"
              type="button"
            >
              Search
            </Button>
          </div>
          <SearchMathResultsList
            error={error}
            hasPendingChanges={hasPendingChanges}
            isLoading={isLoading}
            onSelectResult={handleSelectResult}
            results={results}
            submittedQuery={submittedQuery}
          />
        </Command>
      </DialogContent>
    </Dialog>
  );
}
