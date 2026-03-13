"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, CreditCard, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MIN_CREDIT_TOP_UP_DOLLARS } from "@/lib/credits/top-up";
import { SettingsPageContent } from "@/components/settings/settings-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
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

function getStatusCopy(status: string) {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "expired":
      return "Expired";
    case "pending":
      return "Pending";
    default:
      return "Initiated";
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "failed":
    case "expired":
      return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200";
    default:
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }
}

export function BillingSettings() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [amountDollars, setAmountDollars] = useState(
    String(MIN_CREDIT_TOP_UP_DOLLARS)
  );
  const handledSessionIdRef = useRef<string | null>(null);

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
        return 2_000;
      }
      return false;
    },
  });

  const parsedAmount = Number(amountDollars);
  const isValidAmount =
    Number.isInteger(parsedAmount) && parsedAmount >= MIN_CREDIT_TOP_UP_DOLLARS;

  const isTerminalStatus =
    topUpStatusQuery.data?.status === "completed" ||
    topUpStatusQuery.data?.status === "failed" ||
    topUpStatusQuery.data?.status === "expired";

  useEffect(() => {
    if (checkoutState !== "cancelled") {
      return;
    }

    toast.message("Stripe Checkout was cancelled");
    router.replace("/settings/billing", { scroll: false });
  }, [checkoutState, router]);

  useEffect(() => {
    if (!(checkoutState === "success" && sessionId && isTerminalStatus)) {
      return;
    }

    if (handledSessionIdRef.current === sessionId) {
      return;
    }

    handledSessionIdRef.current = sessionId;

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.credits.getAvailableCredits.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.credits.getBillingOverview.queryKey(),
      }),
    ]).finally(() => {
      if (topUpStatusQuery.data?.status === "completed") {
        toast.success(
          `Added ${formatUsd(topUpStatusQuery.data.creditsToAdd)} in credits`
        );
      } else {
        toast.error("Stripe payment did not complete");
      }
      router.replace("/settings/billing", { scroll: false });
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

    if (!isValidAmount || !overviewQuery.data?.stripeConfigured) {
      return;
    }

    await createTopUpMutation.mutateAsync({ amountDollars: parsedAmount });
  };

  return (
    <SettingsPageContent className="gap-6">
      {checkoutState === "success" && sessionId ? (
        <Alert>
          {topUpStatusQuery.data?.status === "completed" ? (
            <CheckCircle2 className="size-4" />
          ) : topUpStatusQuery.data?.status === "failed" ||
            topUpStatusQuery.data?.status === "expired" ? (
            <XCircle className="size-4" />
          ) : (
            <Clock3 className="size-4" />
          )}
          <AlertTitle>Stripe payment status</AlertTitle>
          <AlertDescription>
            {topUpStatusQuery.data?.status === "completed"
              ? "Your credits were added successfully."
              : topUpStatusQuery.data?.status === "failed" ||
                  topUpStatusQuery.data?.status === "expired"
                ? "The top-up did not complete. Your balance was not changed."
                : "Waiting for Stripe to confirm the payment and apply credits."}
          </AlertDescription>
        </Alert>
      ) : null}

      {!overviewQuery.data?.stripeConfigured ? (
        <Alert>
          <CreditCard className="size-4" />
          <AlertTitle>Stripe is not configured</AlertTitle>
          <AlertDescription>
            Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` before enabling
            credit purchases.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Current balance</CardTitle>
            <CardDescription>
              Credits are stored in cents and spent as you use models.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-3xl">
              {formatUsd(overviewQuery.data?.currentCredits ?? 0)}
            </div>
            <p className="mt-2 text-muted-foreground text-sm">
              {overviewQuery.data?.currentCredits ?? 0} credits available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add credits</CardTitle>
            <CardDescription>
              Minimum ${MIN_CREDIT_TOP_UP_DOLLARS}. Every $1 adds 100 credits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="font-medium text-sm" htmlFor="billing-amount">
                  Amount to add
                </label>
                <Input
                  id="billing-amount"
                  inputMode="numeric"
                  min={MIN_CREDIT_TOP_UP_DOLLARS}
                  onChange={(event) => setAmountDollars(event.target.value)}
                  step={1}
                  type="number"
                  value={amountDollars}
                />
                <p className="text-muted-foreground text-xs">
                  You will be charged {isValidAmount ? formatUsd(parsedAmount * 100) : "-"}.
                </p>
              </div>

              <Button
                className="w-full"
                disabled={
                  !isValidAmount ||
                  !overviewQuery.data?.stripeConfigured ||
                  createTopUpMutation.isPending
                }
                type="submit"
              >
                {createTopUpMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating Stripe Checkout...
                  </>
                ) : (
                  "Continue to Stripe"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent top-ups</CardTitle>
          <CardDescription>
            Review the latest Stripe credit purchases for this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overviewQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading recent purchases...
            </div>
          ) : overviewQuery.data?.recentTopUps.length ? (
            <div className="space-y-3">
              {overviewQuery.data.recentTopUps.map((topUp) => (
                <div
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={topUp.id}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {formatUsd(topUp.amountCents)} for {topUp.creditsToAdd} credits
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Created {formatDateTime(topUp.createdAt)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Completed {formatDateTime(topUp.completedAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full px-2.5 py-1 font-medium text-xs ${getStatusClasses(
                      topUp.status
                    )}`}
                  >
                    {getStatusCopy(topUp.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No Stripe credit purchases yet.
            </p>
          )}
        </CardContent>
      </Card>
    </SettingsPageContent>
  );
}
