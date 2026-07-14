import { beforeEach, describe, expect, it } from "vitest";

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

    expect(url.startsWith("http://palco.nibtabernaculo.org.br/reprovar?token=")).toBe(true);
  });
});
