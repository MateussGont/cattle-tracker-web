// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createMapPopupContent } from "./mapPopup";

describe("createMapPopupContent", () => {
  it("renders device content as text instead of executable HTML", () => {
    const popup = createMapPopupContent({
      title: '<img src=x onerror="alert(1)">',
      details: ["ID LoRa: 7"],
    });

    expect(popup.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(popup.querySelector("img")).toBeNull();
  });
});
