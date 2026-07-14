import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPublicReviewUrl,
  createPublicReviewToken,
  parsePublicReviewToken,
} from "@/lib/public-review";

describe("public review links", () => {
  beforeEach(() => {
    process.env.PUBLIC_REVIEW_SECRET = "segredo-teste";
    process.env.APP_BASE_URL = "http://palco.nibtabernaculo.org.br";
  });

  it("creates and validates approve tokens", () => {
    const token = createPublicReviewToken("req-1", "approve");
    const payload = parsePublicReviewToken(token);

    expect(payload.requestId).toBe("req-1");
    expect(payload.action).toBe("approve");
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it("builds public rejection url with token", () => {
    const url = buildPublicReviewUrl("req-2", "reject");

    expect(url.startsWith("http://palco.nibtabernaculo.org.br/reprovar?t=")).toBe(true);
  });

  it("rejects tampered tokens", () => {
    const token = createPublicReviewToken("req-3", "approve");
    const tampered = `${token}x`;

    expect(() => parsePublicReviewToken(tampered)).toThrow("Link inválido.");
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00Z"));

    const token = createPublicReviewToken("req-4", "reject");

    vi.setSystemTime(new Date("2026-07-17T13:00:01Z"));

    expect(() => parsePublicReviewToken(token)).toThrow("Link expirado.");

    vi.useRealTimers();
  });
});
