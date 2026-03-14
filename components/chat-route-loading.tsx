import { Skeleton } from "@/components/ui/skeleton";

export function ChatRouteLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-(--header-height) items-center justify-between gap-2 px-2 py-1.5 md:px-2">
        <Skeleton className="h-8 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-2 py-4 @[500px]:px-4 md:max-w-3xl">
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-20 w-4/5 rounded-2xl" />
        <div className="mt-auto">
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
