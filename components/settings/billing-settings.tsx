"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  isValidTopUpAmountDollars,
  MIN_CREDIT_TOP_UP_DOLLARS,
} from "@/lib/credits/top-up";
import { SettingsPageContent } from "@/components/settings/settings-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

export function BillingSettings() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [amountDollars, setAmountDollars] = useState(
    String(MIN_CREDIT_TOP_UP_DOLLARS)
  );
  const handledCancelRef = useRef(false);
  const handledOutcomeRef = useRef<string | null>(null);

  const overviewQuery = useQuery(trpc.credits.getBillingOverview.queryOptions());
  const checkoutState = searchParams.get("checkout");
  const sessionId = searchParams.get("session_id");

  const createTopUpMutation = useMutation(
    trpc.credits.createTopUpCheckoutSession.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to create Stripe Checkout session");
      },
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
    })
  );

  const topUpStatusQuery = useQuery({
    ...trpc.credits.getTopUpStatus.queryOptions({ sessionId: sessionId ?? "" }),
    enabled: checkoutState === "success" && !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "initiated" || status === "pending") {
        return 500;
      }
      return false;
    },
  });

  const parsedAmount = Number(amountDollars);
  const isValidAmount = isValidTopUpAmountDollars(parsedAmount);
  const stripeConfigured = overviewQuery.data?.stripeConfigured ?? false;

  const completedPayments = useMemo(
    () =>
      (overviewQuery.data?.recentTopUps ?? []).filter(
        (topUp) => topUp.status === "completed"
      ),
    [overviewQuery.data?.recentTopUps]
  );

  const isTerminalStatus =
    topUpStatusQuery.data?.status === "completed" ||
    topUpStatusQuery.data?.status === "failed" ||
    topUpStatusQuery.data?.status === "expired";

  useEffect(() => {
    if (checkoutState !== "cancelled") {
      handledCancelRef.current = false;
      return;
    }

    if (handledCancelRef.current) {
      return;
    }

    handledCancelRef.current = true;
    toast.message("Checkout cancelled");
    router.replace("/settings/billing", { scroll: false });
  }, [checkoutState, router]);

  useEffect(() => {
    if (!(checkoutState === "success" && sessionId && isTerminalStatus)) {
      handledOutcomeRef.current = null;
      return;
    }

    const outcomeKey = `${sessionId}:${topUpStatusQuery.data?.status ?? "unknown"}`;

    if (handledOutcomeRef.current === outcomeKey) {
      return;
    }

    handledOutcomeRef.current = outcomeKey;

    if (topUpStatusQuery.data?.status === "completed") {
      toast.success(`Added ${formatUsd(topUpStatusQuery.data.amountCents)}`);
    } else {
      toast.error("Payment did not complete");
    }

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.credits.getAvailableCredits.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.credits.getBillingOverview.queryKey(),
      }),
    ]).finally(() => {
      window.setTimeout(() => {
        router.replace("/settings/billing", { scroll: false });
      }, 50);
    });
  }, [
    checkoutState,
    isTerminalStatus,
    queryClient,
    router,
    sessionId,
    topUpStatusQuery.data,
    trpc.credits,
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidAmount || !stripeConfigured) {
      return;
    }

    await createTopUpMutation.mutateAsync({ amountDollars: parsedAmount });
  };

  return (
    <SettingsPageContent className="gap-4">
      {overviewQuery.isError ? (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertTitle>Billing could not be loaded</AlertTitle>
          <AlertDescription>
            {overviewQuery.error.message || "Try refreshing the page."}
          </AlertDescription>
        </Alert>
      ) : null}

      {overviewQuery.isSuccess && !stripeConfigured ? (
        <Alert>
          <AlertTitle>Stripe is not configured</AlertTitle>
          <AlertDescription>
            Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-6 pt-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Balance</p>
            <p className="font-semibold text-4xl">
              {formatUsd(overviewQuery.data?.currentCredits ?? 0)}
            </p>
          </div>

          <form
            className="flex w-full flex-col gap-3 md:max-w-sm"
            onSubmit={handleSubmit}
          >
            <label className="font-medium text-sm" htmlFor="billing-amount">
              Add funds
            </label>
            <Input
              id="billing-amount"
              autoComplete="off"
              placeholder={MIN_CREDIT_TOP_UP_DOLLARS.toFixed(2)}
              inputMode="numeric"
              min={MIN_CREDIT_TOP_UP_DOLLARS}
              onChange={(event) => setAmountDollars(event.target.value)}
              step="0.01"
              type="number"
              value={amountDollars}
            />
            <Button
              disabled={
                !isValidAmount || !stripeConfigured || createTopUpMutation.isPending
              }
              type="submit"
            >
              {createTopUpMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Opening Stripe...
                </>
              ) : (
                `Add ${isValidAmount ? formatUsd(parsedAmount * 100) : ""}`.trim()
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {overviewQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </div>
      ) : completedPayments.length > 0 ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Recent payments</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {completedPayments.map((topUp) => (
                <div
                  className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0"
                  key={topUp.id}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{formatUsd(topUp.amountCents)}</p>
                    <p className="text-muted-foreground text-sm">
                      {formatDateTime(topUp.completedAt ?? topUp.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </SettingsPageContent>
  );
}
