import { describe, expect, it } from "vitest";

import { isValidTimezone, localDateForTimezone } from "./time";

describe("localDateForTimezone", () => {
  it("uses the user's local date at midnight boundaries", () => {
    expect(
      localDateForTimezone("2026-10-21T21:30:00.000Z", "Africa/Addis_Ababa"),
    ).toBe("2026-10-22");
  });

  it("rejects invalid timezone identifiers", () => {
    expect(isValidTimezone("Africa/Addis_Ababa")).toBe(true);
    expect(isValidTimezone("not/a-timezone")).toBe(false);
  });
});
