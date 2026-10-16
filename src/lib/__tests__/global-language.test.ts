import { describe, expect, it } from "vitest";
import { isRtlLocale, normalizeLocale, translate } from "../global-language";

describe("global language foundation", () => {
  it("recognizes regional language tags", () => expect(normalizeLocale("es-MX")).toBe("es"));
  it("defaults unsupported languages to English", () => expect(normalizeLocale("xx-ZZ")).toBe("en"));
  it("handles Arabic direction", () => { expect(isRtlLocale("ar")).toBe(true); expect(isRtlLocale("en")).toBe(false); });
  it("returns localized strings", () => expect(translate("fr", "start")).toBe("Commencer"));
});
