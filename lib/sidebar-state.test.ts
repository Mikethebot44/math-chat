import { describe, expect, it } from "vitest";
import { isSidebarInitiallyOpen, SIDEBAR_COOKIE_NAME } from "./sidebar-state";

describe("sidebar-state", () => {
  it("exports the shared sidebar cookie name", () => {
    expect(SIDEBAR_COOKIE_NAME).toBe("sidebar_state");
  });

  it("defaults to collapsed when the cookie is missing", () => {
    expect(isSidebarInitiallyOpen(undefined)).toBe(false);
    expect(isSidebarInitiallyOpen(null)).toBe(false);
  });

  it("returns true only for an explicit true cookie value", () => {
    expect(isSidebarInitiallyOpen("true")).toBe(true);
    expect(isSidebarInitiallyOpen("false")).toBe(false);
  });
});
