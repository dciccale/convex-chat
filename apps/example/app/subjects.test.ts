import { describe, expect, it } from "vitest";
import { isSubject } from "./subjects";

describe("isSubject", () => {
  it.each(["alice", "bob", "charlie"])("accepts %s", (subject) => {
    expect(isSubject(subject)).toBe(true);
  });

  it.each([undefined, "", "dana", ["alice", "bob"]])(
    "rejects %j",
    (subject) => {
      expect(isSubject(subject)).toBe(false);
    },
  );
});
