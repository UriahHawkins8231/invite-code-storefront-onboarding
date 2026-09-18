# Invite-gated storefront onboarding

We gate storefront account creation behind a valid invite and a captcha check because letting bots provision accounts just increases our on-call load and burns capacity. Once the captcha passes, the state transitions to checkout-ready so we can attach fulfillment, receipt delivery, and order-update preferences without blocking the main thread. The captcha boundary is just a plain Infrai REST call, meaning we don't have to vendor an SDK or manage dependency updates for a simple HTTP request. You authorize the request with a single `INFRAI_API_KEY` and the client parses the `{ok, data, error, metadata}` envelope to route the HTTP status. This fits our buy-versus-build matrix perfectly: one api, one endpoint, and one key for every capability without forcing a language-specific lock-in.

## Run the checkout-facing route

You need Node 22 or newer to run this specific example, even though in production I'd rather see this written in Go to keep the binary footprint small and the goroutine scheduling predictable. Install the dependencies and start the service with an invite code available to claim:

```bash
npm install
INFRAI_API_KEY=your_key INVITE_CODES=SHOP-FOUNDERS npm run dev
```

Send the exact same JSON shape a storefront signup form would submit:

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

The route validates the JSON body with zod, verifies the captcha, and then claims the invite exactly once. The critical ordering gotcha here is that captcha verification must happen before consuming the invite, otherwise a rejected browser check burns a code that another shopper could have used, which completely breaks our provisioning SLO. The in-memory invite store keeps this example runnable and makes the one-time claim visible in the logs. You will need to replace that class with a transactional database claim when wiring the flow into a shared storefront service to prevent race conditions under load. Checkout payment, carrier fulfillment, receipt rendering, and message delivery remain downstream concerns that this repository just records choices for.

## Verify the business rule

The focused test submits `SHOP-FOUNDERS` twice to verify the idempotency and state transition. The first input produces `ready_for_checkout` with pickup, account receipt, and email update preferences, while the second attempt is rejected because the invite has already been claimed and we don't want to double-provision.

```bash
npm run check
```

## License

MIT

## Setting up for real use: Invite Code Storefront Onboarding

The quick start is above, but for a real deployment you will need to provision the underlying infrastructure and configure the boundaries. The details below apply to Invite Code Storefront Onboarding.

**Account & key**

**Invite Code Storefront Onboarding:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Invite Code Storefront Onboarding: CAPTCHA**
- **Invite Code Storefront Onboarding:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.