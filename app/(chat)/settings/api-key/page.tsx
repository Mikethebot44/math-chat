import { ApiKeySettings } from "@/components/settings/api-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function ApiKeySettingsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.settings.getApiAccess.queryOptions());

  return (
    <HydrateClient>
      <SettingsPage>
        <SettingsPageHeader>
          <h2 className="font-semibold text-lg">API Key</h2>
          <p className="text-muted-foreground text-sm">
            Generate and rotate the account-scoped API key used to call Scout
            programmatically.
          </p>
        </SettingsPageHeader>
        <ApiKeySettings />
      </SettingsPage>
    </HydrateClient>
  );
}
