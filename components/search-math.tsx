"use client";

import { SigmaIcon } from "lucide-react";
import { useState } from "react";
import { SearchMathDialog } from "./search-math-dialog";
import { SidebarMenuButton } from "./ui/sidebar";

export function SearchMathButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SidebarMenuButton
        className="w-full justify-start"
        onClick={() => setOpen(true)}
        tooltip="Search math"
      >
        <SigmaIcon className="h-4 w-4" />
        <span>Search Math</span>
      </SidebarMenuButton>

      {open && <SearchMathDialog onOpenChange={setOpen} open={open} />}
    </>
  );
}
