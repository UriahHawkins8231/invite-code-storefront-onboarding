import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { verifyCaptcha } from "./infrai_captcha.js";
import {
  MemoryInviteStore,
  OnboardingRejection,
  onboardCustomer,
  onboardingRequestSchema
} from "./invite_onboarding.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const invites = new MemoryInviteStore(
  (process.env.INVITE_CODES ?? "SHOP-FOUNDERS").split(",").map((code) => code.trim())
);

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/onboarding") {
    send(response, 404, { error: { code: "route_not_found" } });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = onboardingRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await onboardCustomer(input, invites, (token) => verifyCaptcha(token, apiKey));
    send(response, 201, { data: result });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: { code: "invalid_request" } });
    } else if (error instanceof OnboardingRejection) {
      send(response, error.status, { error: { code: error.code, message: error.message } });
    } else {
      send(response, 503, { error: { code: "onboarding_unavailable" } });
    }
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Storefront onboarding listening on http://localhost:${port}`));
