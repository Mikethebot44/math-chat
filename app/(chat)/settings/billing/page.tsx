import { BillingSettings } from "@/components/settings/billing-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function BillingSettingsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.credits.getBillingOverview.queryOptions());

  return (
    <HydrateClient>
      <SettingsPage>
        <SettingsPageHeader>
          <h2 className="font-semibold text-lg">Billing & Credits</h2>
          <p className="text-muted-foreground text-sm">
            Top up credits with Stripe Checkout and review your recent purchases.
          </p>
        </SettingsPageHeader>
        <BillingSettings />
      </SettingsPage>
    </HydrateClient>
  );
}
