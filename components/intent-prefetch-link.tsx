"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

const prefetchedHrefs = new Set<string>();

type IntentPrefetchLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "prefetch"
> & {
  eagerPrefetch?: boolean;
  href: Route;
};

export function IntentPrefetchLink({
  eagerPrefetch = false,
  href,
  onFocus,
  onMouseEnter,
  onTouchStart,
  ...props
}: IntentPrefetchLinkProps) {
  const router = useRouter();
  const hrefString = useMemo(() => href.toString(), [href]);
  const [prefetchHref, setPrefetchHref] = useState<string | null>(
    eagerPrefetch ? hrefString : null
  );
  const shouldPrefetch = eagerPrefetch || prefetchHref === hrefString;

  const prefetchOnIntent = useCallback(() => {
    setPrefetchHref(hrefString);

    if (prefetchedHrefs.has(hrefString)) {
      return;
    }

    prefetchedHrefs.add(hrefString);
    router.prefetch(href);
  }, [href, hrefString, router]);

  useEffect(() => {
    setPrefetchHref(eagerPrefetch ? hrefString : null);
  }, [eagerPrefetch, hrefString]);

  useEffect(() => {
    if (eagerPrefetch) {
      prefetchOnIntent();
    }
  }, [eagerPrefetch, prefetchOnIntent]);

  return (
    <Link
      {...props}
      href={href}
      onFocus={(event) => {
        prefetchOnIntent();
        onFocus?.(event);
      }}
      onMouseEnter={(event) => {
        prefetchOnIntent();
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        prefetchOnIntent();
        onTouchStart?.(event);
      }}
      prefetch={shouldPrefetch ? null : false}
    />
  );
}
