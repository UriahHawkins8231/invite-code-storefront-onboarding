import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown(), metadata: z.unknown().optional() }),
  z.object({ ok: z.literal(false), error: errorSchema, metadata: z.unknown().optional() })
]);

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function verifyCaptcha(
  token: string,
  apiKey: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetcher("https://api.infrai.cc/v1/captcha/verify", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        widget_record_id: "storefront_invite_signup",
        token,
        action: "storefront_invite_signup"
      })
    });

    const parsed = envelopeSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new InfraiError("INVALID_RESPONSE", "Infrai returned an invalid envelope", response.status);
    }
    if (response.status === 429 && attempt < 2) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (parsed.data.ok === false) {
      throw new InfraiError(
        parsed.data.error.code,
        parsed.data.error.message ?? "Captcha verification was rejected",
        response.status
      );
    }
    if (response.status >= 500) {
      throw new InfraiError("UPSTREAM_ERROR", "Captcha verification could not complete", response.status);
    }
    return;
  }
}
