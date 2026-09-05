import assert from "node:assert/strict";
import test from "node:test";
import { MemoryInviteStore, OnboardingRejection, onboardCustomer } from "../src/invite_onboarding.js";

const request = {
  email: "buyer@example.com",
  displayName: "Morgan Lee",
  inviteCode: "SHOP-FOUNDERS",
  captchaToken: "browser-captcha-token",
  orderUpdates: "email" as const,
  receiptDelivery: "account" as const,
  fulfillmentPreference: "pickup" as const
};

test("one invite admits one customer and carries storefront preferences", async () => {
  const invites = new MemoryInviteStore(["SHOP-FOUNDERS"]);
  const first = await onboardCustomer(request, invites, async () => undefined);

  assert.deepEqual(first, {
    status: "ready_for_checkout",
    customer: { email: "buyer@example.com", displayName: "Morgan Lee" },
    checkout: { access: "invited" },
    fulfillment: { preference: "pickup" },
    receipts: { delivery: "account" },
    orderUpdates: "email"
  });

  await assert.rejects(
    () => onboardCustomer(request, invites, async () => undefined),
    (error) => error instanceof OnboardingRejection && error.code === "invite_unavailable"
  );
});
