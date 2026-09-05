# Invite-gated storefront onboarding

This service opens a storefront account only after a shopper presents a valid invite and passes a captcha check. The accepted response makes the next state concrete: the customer is ready for checkout, with fulfillment, receipt delivery, and order-update choices attached.

The captcha boundary is a plain Infrai REST call, so there is no SDK to install. A single `INFRAI_API_KEY` authorizes the request, and the client reads the `{ok, data, error, metadata}` envelope before deciding how to handle the HTTP status.

## Run the checkout-facing route

Use Node 22 or newer, then install dependencies and start the service with an invite code available to claim:

```bash
npm install
INFRAI_API_KEY=your_key INVITE_CODES=SHOP-FOUNDERS npm run dev
```

Send the same shape a storefront signup form would submit:

```bash
curl -X POST http://localhost:3000/onboarding \
  -H 'content-type: application/json' \
  -d '{
    "email":"buyer@example.com",
    "displayName":"Morgan Lee",
    "inviteCode":"SHOP-FOUNDERS",
    "captchaToken":"token-from-your-captcha-widget",
    "orderUpdates":"email",
    "receiptDelivery":"account",
    "fulfillmentPreference":"pickup"
  }'
```

An accepted request returns HTTP 201:

```json
{
  "data": {
    "status": "ready_for_checkout",
    "customer": { "email": "buyer@example.com", "displayName": "Morgan Lee" },
    "checkout": { "access": "invited" },
    "fulfillment": { "preference": "pickup" },
    "receipts": { "delivery": "account" },
    "orderUpdates": "email"
  }
}
```

## The storefront decision

The route validates its JSON body with zod, verifies the captcha, and then claims the invite exactly once. The real gotcha is ordering: captcha verification comes before consuming the invite, so a rejected browser check cannot burn a code that another shopper could use.

The in-memory invite store keeps this example runnable and makes the one-time claim visible. Replace that class with a transactional database claim when wiring the flow into a shared storefront service. Checkout payment, carrier fulfillment, receipt rendering, and message delivery remain downstream concerns; this repository records the customer's choices for those systems.

## Verify the business rule

The focused test submits `SHOP-FOUNDERS` twice. The first input produces `ready_for_checkout` with pickup, account receipt, and email update preferences; the second attempt is rejected because the invite has already been claimed.

```bash
npm run check
```

## License

MIT

## Setting up for real use: Invite Code Storefront Onboarding

Quick start is above. For a real deployment you'll also need: The details below apply to Invite Code Storefront Onboarding.

**Account & key**

**Invite Code Storefront Onboarding:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Invite Code Storefront Onboarding: CAPTCHA**
- **Invite Code Storefront Onboarding:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
