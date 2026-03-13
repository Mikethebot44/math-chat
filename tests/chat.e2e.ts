import { expect, test } from "@playwright/test";

test("chat page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("textbox")).toBeVisible();
});

test("billing page renders and enforces the minimum top-up amount", async ({
  page,
}) => {
  await page.goto("/settings/billing");
  await expect(page).toHaveURL("/settings/billing");
  await expect(
    page.getByRole("heading", { name: "Billing & Credits" })
  ).toBeVisible();

  const amountInput = page.getByLabel("Amount to add");
  const submitButton = page.getByRole("button", {
    name: "Continue to Stripe",
  });

  await amountInput.fill("4");
  await expect(submitButton).toBeDisabled();
});

test("sidebar open cookie hydrates the expanded sidebar", async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: "sidebar_state",
      value: "true",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto("/");

  await expect(page.getByText("Projects")).toBeVisible();
  await expect(page.getByText("Chats")).toBeVisible();
});
