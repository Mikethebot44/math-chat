"use client";

import { cn } from "@/lib/utils";

interface LoaderProps {
  className?: string;
  label?: string;
}

export function Loader({ className, label = "Searching..." }: LoaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-44 w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center",
        className
      )}
    >
      <div
        className="relative size-24 animate-[search-loader-rotate_2.6s_cubic-bezier(0.65,0,0.35,1)_infinite]"
        style={{ filter: "url(#search-loader-goo)" }}
      >
        <span className="absolute inset-0 m-auto size-9 animate-[search-loader-dot-1_2.6s_ease-in-out_infinite] rounded-full bg-primary shadow-[0_0_32px_color-mix(in_oklch,var(--primary)_35%,transparent)]" />
        <span className="absolute inset-0 m-auto size-9 animate-[search-loader-dot-2_2.6s_ease-in-out_infinite] rounded-full bg-[color:color-mix(in_oklch,var(--primary)_62%,white)] shadow-[0_0_32px_color-mix(in_oklch,var(--primary)_25%,transparent)] dark:bg-[color:color-mix(in_oklch,var(--primary)_78%,white)]" />
        <span className="absolute inset-0 m-auto size-9 animate-[search-loader-dot-3_2.6s_ease-in-out_infinite] rounded-full border border-blue-200/80 bg-white shadow-[0_0_28px_rgba(59,130,246,0.18)] dark:border-blue-300/20 dark:bg-slate-100 dark:shadow-[0_0_28px_rgba(30,64,175,0.35)]" />

        <svg aria-hidden="true" className="hidden">
          <defs>
            <filter id="search-loader-goo">
              <feGaussianBlur
                in="SourceGraphic"
                result="blur"
                stdDeviation="10"
              />
              <feColorMatrix
                in="blur"
                mode="matrix"
                result="goo"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -8"
              />
            </filter>
          </defs>
        </svg>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground text-xs">
          Looking across papers and theorem statements
        </p>
      </div>
    </div>
  );
}

export default Loader;
