import { describe, expect, it } from "vitest";

import { createRunSchema } from "./index";

describe("createRunSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = createRunSchema.parse({
      projectId: "p1",
      targetUrl: "https://example.com",
    });
    expect(parsed.projectId).toBe("p1");
  });

  it("rejects a bad url", () => {
    expect(() => createRunSchema.parse({ projectId: "p1", targetUrl: "nope" })).toThrow();
  });

  it("rejects an empty projectId", () => {
    expect(() =>
      createRunSchema.parse({ projectId: "", targetUrl: "https://x.com" })
    ).toThrow();
  });
});
