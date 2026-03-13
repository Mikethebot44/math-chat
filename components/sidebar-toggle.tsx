import { PanelLeft } from "lucide-react";
import type { ComponentProps } from "react";

import { type SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "./ui/button";

export function SidebarToggle({
  className,
  children,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={className}
          onClick={toggleSidebar}
          size="icon"
          variant="ghost"
        >
          {children ?? <PanelLeft size={16} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start">Toggle Sidebar</TooltipContent>
    </Tooltip>
  );
}
