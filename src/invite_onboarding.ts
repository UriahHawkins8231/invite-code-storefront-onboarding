import { z } from "zod";
import { InfraiError } from "./infrai_captcha.js";

export const onboardingRequestSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(2).max(80),
  inviteCode: z.string().trim().min(6).max(32),
  captchaToken: z.string().min(1),
  orderUpdates: z.enum(["email", "sms", "none"]),
  receiptDelivery: z.enum(["email", "account"]),
  fulfillmentPreference: z.enum(["ship", "pickup"])
}).strict();

export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;

export interface InviteStore {
  claim(code: string, email: string): Promise<boolean>;
}

export interface CaptchaVerifier {
  (token: string): Promise<void>;
}

export type OnboardingResult = {
  status: "ready_for_checkout";
  customer: { email: string; displayName: string };
  checkout: { access: "invited" };
  fulfillment: { preference: "ship" | "pickup" };
  receipts: { delivery: "email" | "account" };
  orderUpdates: "email" | "sms" | "none";
};

export class OnboardingRejection extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function onboardCustomer(
  input: OnboardingRequest,
  invites: InviteStore,
  verifyCaptcha: CaptchaVerifier
): Promise<OnboardingResult> {
  try {
    await verifyCaptcha(input.captchaToken);
  } catch (error) {
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      throw new OnboardingRejection(422, "captcha_rejected", "Captcha verification was rejected");
    }
    throw error;
  }

  const claimed = await invites.claim(input.inviteCode, input.email);
  if (!claimed) {
    throw new OnboardingRejection(403, "invite_unavailable", "Invite code is invalid or already claimed");
  }

  return {
    status: "ready_for_checkout",
    customer: { email: input.email, displayName: input.displayName },
    checkout: { access: "invited" },
    fulfillment: { preference: input.fulfillmentPreference },
    receipts: { delivery: input.receiptDelivery },
    orderUpdates: input.orderUpdates
  };
}

export class MemoryInviteStore implements InviteStore {
  private readonly available: Set<string>;

  constructor(codes: string[]) {
    this.available = new Set(codes);
  }

  async claim(code: string): Promise<boolean> {
    if (!this.available.has(code)) return false;
    this.available.delete(code);
    return true;
  }
}
