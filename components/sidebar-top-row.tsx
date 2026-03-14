"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useSidebar } from "@/components/ui/sidebar";
import { useMounted } from "@/hooks/use-mounted";
import { config } from "@/lib/config";
import logoDark from "@/logo-dark.png";
import logoLight from "@/logo-light.png";
import { useChatId } from "@/providers/chat-id-provider";

const SIDEBAR_COLLAPSE_ANIMATION_MS = 200;

export function SidebarTopRow() {
  const { setOpenMobile, open, openMobile, isSidebarHovered } = useSidebar();
  const { refreshChatID } = useChatId();
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const isExpanded = open || openMobile;
  const [isCollapseAnimating, setIsCollapseAnimating] = useState(false);
  const previousIsExpandedRef = useRef(isExpanded);
  const brandLogo = mounted && resolvedTheme === "dark" ? logoDark : logoLight;
  const showExpandedLogo = isExpanded || isCollapseAnimating;
  const showCollapsedLogoToggle = !showExpandedLogo && !isSidebarHovered;

  useEffect(() => {
    const wasExpanded = previousIsExpandedRef.current;
    previousIsExpandedRef.current = isExpanded;

    if (wasExpanded && !isExpanded) {
      setIsCollapseAnimating(true);

      const timeoutId = window.setTimeout(() => {
        setIsCollapseAnimating(false);
      }, SIDEBAR_COLLAPSE_ANIMATION_MS);

      return () => window.clearTimeout(timeoutId);
    }

    if (isExpanded) {
      setIsCollapseAnimating(false);
    }
  }, [isExpanded]);

  const brandMark = (
    <Image
      alt={config.appName}
      className="h-6 w-auto max-w-none object-contain"
      loading="eager"
      src={brandLogo}
    />
  );

  return (
    <div className="relative h-9 w-full">
      <div className="absolute inset-y-0 left-0 flex items-center">
        {showExpandedLogo ? (
          <Link
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
            href="/"
            onClick={() => {
              setOpenMobile(false);
              refreshChatID();
            }}
          >
            {brandMark}
          </Link>
        ) : (
          <SidebarToggle className="cursor-ew-resize group-data-[collapsible=icon]:cursor-ew-resize">
            {showCollapsedLogoToggle ? (
              <Image
                alt=""
                aria-hidden="true"
                className="h-6 w-auto max-w-none object-contain"
                loading="eager"
                src={brandLogo}
              />
            ) : undefined}
          </SidebarToggle>
        )}
      </div>

      {isExpanded ? (
        <div className="absolute inset-y-0 right-0 flex items-center md:px-2">
          <SidebarToggle />
        </div>
      ) : null}
    </div>
  );
}
