"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ConnectorsSettings } from "@/components/settings/connectors-settings";

export function ConnectorsSettingsShell() {
  return (
    <NuqsAdapter>
      <ConnectorsSettings />
    </NuqsAdapter>
  );
}
