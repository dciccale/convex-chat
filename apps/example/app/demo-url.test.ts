import { describe, expect, it } from "vitest";
import { buildDemoUrl } from "./demo-url";

describe("buildDemoUrl", () => {
  it("persists the selected identity with the open conversation", () => {
    expect(
      buildDemoUrl({
        pathname: "/",
        search: "?conversation=old",
        hash: "#messages",
        subjectId: "bob",
        conversationId: "next",
      }),
    ).toBe("/?conversation=next&as=bob#messages");
  });

  it("keeps the selected identity while clearing the conversation", () => {
    expect(
      buildDemoUrl({
        pathname: "/",
        search: "?conversation=old&preview=true",
        hash: "",
        subjectId: "charlie",
        conversationId: null,
      }),
    ).toBe("/?preview=true&as=charlie");
  });
});
