"use client";

import { cn } from "@/lib/utils";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";
import { normalizeMathMarkdown } from "./normalize-math-markdown";

const plugins = { code, mermaid, math };

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ children, className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={plugins}
      {...props}
    >
      {typeof children === "string"
        ? normalizeMathMarkdown(children)
        : children}
    </Streamdown>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children && prevProps.isAnimating === nextProps.isAnimating && prevProps.mode === nextProps.mode
);

Response.displayName = "Response";
