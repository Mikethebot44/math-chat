"use client";

import { ProjectIcon } from "@/components/project-icon";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { useGetChatById, useProject } from "@/hooks/chat-sync-hooks";
import { usePublicChat } from "@/hooks/use-shared-chat";
import type { Session } from "@/lib/auth";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
import { cn } from "@/lib/utils";
import { useChatId } from "@/providers/chat-id-provider";

interface HeaderBreadcrumbProps {
  chatId: string;
  className?: string;
  hasMessages?: boolean;
  isReadonly: boolean;
  projectId?: string;
  user?: Session["user"];
}

export function HeaderBreadcrumb({
  chatId: _chatId,
  projectId: _projectId,
  user,
  isReadonly: _isReadonly,
  hasMessages: _hasMessages,
  className,
}: HeaderBreadcrumbProps) {
  const { id: chatId, isPersisted, source } = useChatId();
  const isShared = source === "share";
  const isAuthenticated = !!user;

  const { data: chat } = useGetChatById(chatId, {
    enabled: !isShared && isPersisted,
  });
  const { data: publicChat } = usePublicChat(chatId, {
    enabled: isShared,
  });

  const resolvedProjectId = chat?.projectId ?? publicChat?.projectId ?? null;

  const { data: project, isFetching: isProjectLoading } = useProject(
    resolvedProjectId,
    { enabled: isAuthenticated && Boolean(resolvedProjectId) }
  );

  const projectLabel = resolvedProjectId
    ? (project?.name ?? (isProjectLoading ? "Loading project..." : undefined))
    : undefined;

  if (!(projectLabel && resolvedProjectId)) {
    return null;
  }

  return (
    <Breadcrumb className={cn("min-w-0", className)}>
      <BreadcrumbList className="flex-nowrap">
        <ProjectBreadcrumb
          projectColor={project?.iconColor as ProjectColorName | undefined}
          projectIcon={project?.icon as ProjectIconName | undefined}
          projectId={resolvedProjectId}
          projectLabel={projectLabel}
        />
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ProjectBreadcrumb({
  projectLabel,
  projectId,
  projectIcon,
  projectColor,
}: {
  projectLabel?: string;
  projectId: string | null;
  projectIcon?: ProjectIconName;
  projectColor?: ProjectColorName;
}) {
  if (!(projectLabel && projectId)) {
    return null;
  }

  return (
    <BreadcrumbItem>
      <BreadcrumbLink
        aria-label={projectLabel}
        className="flex items-center"
        href={`/project/${projectId}`}
        title={projectLabel}
      >
        {projectIcon && projectColor ? (
          <ProjectIcon color={projectColor} icon={projectIcon} size={16} />
        ) : (
          projectLabel
        )}
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}
