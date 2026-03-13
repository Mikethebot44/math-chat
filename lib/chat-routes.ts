import type { Route } from "next";

export function getProjectHref(projectId: string): Route {
  return `/project/${projectId}` as Route;
}

export function getChatHref({
  chatId,
  projectId,
}: {
  chatId: string;
  projectId?: string | null;
}): Route {
  if (projectId) {
    return `/project/${projectId}/chat/${chatId}` as Route;
  }

  return `/chat/${chatId}` as Route;
}
