"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  let theme: "dark" | "light" | "system" = "system";

  if (resolvedTheme === "dark") {
    theme = "dark";
  } else if (resolvedTheme === "light") {
    theme = "light";
  }

  return <Toaster position="top-center" theme={theme} />;
}
