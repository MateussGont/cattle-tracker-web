import { describe, expect, it } from "vitest";
import { JsonLineDecoder } from "./deviceProvisioning";

describe("JsonLineDecoder", () => {
  it("preserves partial lines and returns every complete message", () => {
    const decoder = new JsonLineDecoder();
    expect(decoder.push('{"event":"boot"')).toEqual([]);
    expect(decoder.push('}\nnoise\n{"event":"device_info","requestId":"abc"}\n')).toEqual([
      { event: "boot" },
      { event: "device_info", requestId: "abc" },
    ]);
  });

  it("ignores malformed JSON without losing the next response", () => {
    const decoder = new JsonLineDecoder();
    expect(decoder.push('{bad}\n{"event":"device_info"}\n')).toEqual([{ event: "device_info" }]);
  });
});
