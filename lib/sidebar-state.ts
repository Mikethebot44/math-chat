export const SIDEBAR_COOKIE_NAME = "sidebar_state";

export function isSidebarInitiallyOpen(
  cookieValue: string | null | undefined
): boolean {
  return cookieValue === "true";
}
