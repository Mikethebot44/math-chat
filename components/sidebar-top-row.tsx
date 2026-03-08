"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useSidebar } from "@/components/ui/sidebar";
import { useMounted } from "@/hooks/use-mounted";
import { config } from "@/lib/config";
import logoDark from "@/logo-dark.png";
import logoLight from "@/logo-light.png";
import { useChatId } from "@/providers/chat-id-provider";

export function SidebarTopRow() {
  const { setOpenMobile, open, openMobile } = useSidebar();
  const { refreshChatID } = useChatId();
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const isExpanded = open || openMobile;
  const brandLogo = mounted && resolvedTheme === "dark" ? logoDark : logoLight;

  return (
    <div
      className={`flex w-full items-center ${
        isExpanded ? "justify-between gap-2" : "justify-center"
      }`}
    >
      {isExpanded ? (
        <Link
          className="min-w-0 flex-1"
          href="/"
          onClick={() => {
            setOpenMobile(false);
            refreshChatID();
          }}
        >
          <span className="flex cursor-pointer items-center rounded-md p-1 hover:bg-muted">
            <Image
              alt={config.appName}
              className="max-w-[112px] object-contain"
              loading="eager"
              src={brandLogo}
              style={{ height: "28px", width: "auto" }}
            />
          </span>
        </Link>
      ) : null}
      <div
        className={isExpanded ? "shrink-0 md:px-2" : "shrink-0 translate-y-px"}
      >
        <SidebarToggle />
      </div>
    </div>
  );
}
