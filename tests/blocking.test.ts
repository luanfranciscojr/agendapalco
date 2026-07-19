import { describe, expect, it } from "vitest";

import {
  buildCollectiveRehearsalNote,
  getCollectiveRehearsalTitle,
} from "@/lib/blocking";

describe("collective rehearsal blocks", () => {
  it("stores and restores the public rehearsal title", () => {
    const note = buildCollectiveRehearsalNote("  Ensaio do Ato Final  ");

    expect(note).toBe("Ensaio coletivo: Ensaio do Ato Final");
    expect(getCollectiveRehearsalTitle(note)).toBe("Ensaio do Ato Final");
  });

  it("keeps regular administrative blocks private", () => {
    expect(
      getCollectiveRehearsalTitle("Horário bloqueado pela coordenação."),
    ).toBeNull();
  });
});
