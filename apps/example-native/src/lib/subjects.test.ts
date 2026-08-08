import { describe, expect, it } from "vitest";
import { capitalize, isSubject } from "./subjects";

describe("demo subjects", () => {
  it("accepts only configured demo identities", () => {
    expect(isSubject("alice")).toBe(true);
    expect(isSubject("denis")).toBe(false);
    expect(isSubject(null)).toBe(false);
  });

  it("capitalizes labels", () => {
    expect(capitalize("charlie")).toBe("Charlie");
    expect(capitalize("")).toBe("");
  });
});
