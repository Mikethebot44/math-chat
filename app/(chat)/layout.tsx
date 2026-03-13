import { cookies, headers } from "next/headers";
import { getChatModels } from "@/app/actions/get-chat-models";
import { AppSidebar } from "@/components/app-sidebar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AppModelId } from "@/lib/ai/app-model-id";
import { DEFAULT_SCOUT_MODEL_ID } from "@/lib/ai/scout-models";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider } from "@/providers/session-provider";
import { TRPCReactProvider } from "@/trpc/react";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { isSidebarInitiallyOpen, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-state";
import { auth } from "../../lib/auth";
import { ChatProviders } from "./chat-providers";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cookieStore, headersRes, chatModels] = await Promise.all([
    cookies(),
    headers(),
    getChatModels(),
  ]);
  const session = await auth.api.getSession({ headers: headersRes });
  const isSidebarOpen = isSidebarInitiallyOpen(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value
  );

  const defaultModel: AppModelId = DEFAULT_SCOUT_MODEL_ID;

  // Prefetch sidebar data only when the sidebar will render immediately.
  if (session?.user?.id && isSidebarOpen) {
    const queryClient = getQueryClient();
    queryClient.prefetchQuery(trpc.project.list.queryOptions());
    queryClient.prefetchQuery(
      trpc.chat.getAllChats.queryOptions({ projectId: null })
    );
  }

  return (
    <TRPCReactProvider>
      <HydrateClient>
        <SessionProvider initialSession={session}>
          <ChatProviders>
            <SidebarProvider defaultOpen={isSidebarOpen}>
              <AppSidebar />
              <SidebarInset
                style={
                  {
                    "--header-height": "calc(var(--spacing) * 13)",
                  } as React.CSSProperties
                }
              >
                <ChatModelsProvider models={chatModels}>
                  <DefaultModelProvider defaultModel={defaultModel}>
                    <KeyboardShortcuts />

                    {children}
                  </DefaultModelProvider>
                </ChatModelsProvider>
              </SidebarInset>
            </SidebarProvider>
          </ChatProviders>
        </SessionProvider>
      </HydrateClient>
    </TRPCReactProvider>
  );
}
