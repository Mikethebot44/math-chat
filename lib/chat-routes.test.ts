import { describe, expect, it } from "vitest";
import { getChatHref, getProjectHref } from "./chat-routes";

describe("chat-routes", () => {
  it("returns a root chat href when no project is provided", () => {
    expect(getChatHref({ chatId: "chat-123" })).toBe("/chat/chat-123");
  });

  it("returns a project chat href when a project is provided", () => {
    expect(getChatHref({ chatId: "chat-123", projectId: "proj-456" })).toBe(
      "/project/proj-456/chat/chat-123"
    );
  });

  it("returns a project page href", () => {
    expect(getProjectHref("proj-456")).toBe("/project/proj-456");
  });
});
