import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const assistantLineWidths = ["w-full", "w-5/6", "w-2/3"];
const userLineWidths = ["w-full", "w-3/4"];

function MessageTextSkeleton({
  widths,
  className,
}: {
  widths: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {widths.map((width, index) => (
        <Skeleton className={cn("h-4", width)} key={`${width}-${index}`} />
      ))}
    </div>
  );
}

function AssistantMessageSkeleton({
  widths,
  className,
}: {
  widths: string[];
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-[80%] py-1", className)}>
      <MessageTextSkeleton widths={widths} />
    </div>
  );
}

function UserMessageSkeleton() {
  return (
    <div className="ml-auto w-full max-w-[80%] py-1">
      <div className="ml-auto flex w-full max-w-xl flex-col gap-2 rounded-lg bg-secondary px-4 py-3">
        <MessageTextSkeleton widths={userLineWidths} />
      </div>
    </div>
  );
}

function ComposerSkeleton() {
  return (
    <div className="w-full rounded-2xl border bg-card p-2 shadow-xs">
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="space-y-2 rounded-xl px-2 py-1">
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t px-1 pt-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md @[500px]:size-10" />
          <Skeleton className="h-8 w-24 rounded-full @[500px]:h-10" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="hidden h-5 w-16 rounded-full @[500px]:block" />
          <Skeleton className="size-8 rounded-md @[500px]:size-10" />
        </div>
      </div>
    </div>
  );
}

export function ChatRouteLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-(--header-height) items-center justify-between gap-2 px-2 py-1.5 md:px-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-hidden">
          <div className="mx-auto flex h-full w-full flex-col gap-6 px-2 py-4 @[500px]:px-4 sm:max-w-2xl md:max-w-3xl">
            <UserMessageSkeleton />
            <AssistantMessageSkeleton className="max-w-[72%]" widths={assistantLineWidths} />
          </div>
        </div>

        <div className="relative z-10 w-full shrink-0 @[500px]:bottom-4">
          <div className="mx-auto w-full p-2 @[500px]:px-4 @[500px]:pb-4 md:max-w-3xl @[500px]:md:pb-6">
            <ComposerSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
