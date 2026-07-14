import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendWhatsAppTemplate } from "@/lib/whatsapp";

describe("whatsapp templates", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.SMSBARATO_API_KEY = "teste-chave";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses the ministry name in approved messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    });
    global.fetch = fetchMock as typeof fetch;

    await sendWhatsAppTemplate("approved", {
      recipientName: "Líder Teatro",
      ministryName: "Teatro",
      phone: "(92) 99999-0000",
      dateKey: "2026-07-14",
      hour: 19,
    });

    const url = new URL(fetchMock.mock.calls[0][0] as URL);

    expect(url.searchParams.getAll("prm[]")[0]).toBe("Ministério de Teatro");
  });

  it("falls back to the recipient name when there is no ministry name", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    });
    global.fetch = fetchMock as typeof fetch;

    await sendWhatsAppTemplate("rejected", {
      recipientName: "Líder Teatro",
      phone: "(92) 99999-0000",
      dateKey: "2026-07-14",
      hour: 19,
    });

    const url = new URL(fetchMock.mock.calls[0][0] as URL);

    expect(url.searchParams.getAll("prm[]")[0]).toBe("Líder Teatro");
  });
});
