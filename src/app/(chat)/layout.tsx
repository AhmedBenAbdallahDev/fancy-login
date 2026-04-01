import { SidebarProvider } from "ui/sidebar";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { AppHeader } from "@/components/layouts/app-header";
import { cookies, headers as getHeaders } from "next/headers";

import { auth } from "auth/server";
import { COOKIE_KEY_SIDEBAR_STATE } from "lib/const";
import { AppPopupProvider } from "@/components/layouts/app-popup-provider";
import { SWRConfigProvider } from "./swr-config";
import { GitHubDatabaseWrapper } from "@/components/github-database-wrapper";
import { CreatorProfileCheck } from "@/components/creator-profile-check";
import type { User } from "better-auth";

export const experimental_ppr = true;

export default async function ChatLayout({
  children,
}: { children: React.ReactNode }) {
  const [cookieStore, headers] = await Promise.all([cookies(), getHeaders()]);
  const session = await auth.api
    .getSession({
      headers,
    })
    .catch(() => null);
  const isCollapsed =
    cookieStore.get(COOKIE_KEY_SIDEBAR_STATE)?.value !== "true";

  let offlineUser: User | undefined = undefined;
  if (!session) {
    const offlineUserStr = cookieStore.get("diffchat_offline_user")?.value;
    console.log(
      "[ChatLayout] Offline user cookie:",
      offlineUserStr ? "found" : "not found",
    );
    if (offlineUserStr) {
      try {
        const parsed = JSON.parse(offlineUserStr);
        offlineUser = {
          id: parsed.id,
          name: parsed.name,
          email: parsed.email,
          image: parsed.image,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        console.log("[ChatLayout] Offline user parsed:", offlineUser?.email);
        console.log(
          "[ChatLayout] Passing offlineUser to wrapper:",
          JSON.stringify(offlineUser),
        );
      } catch (e) {
        console.error("Failed to parse offline user cookie", e);
      }
    }
  }

  // Get the user ID and name for creator profile check
  const userId = session?.user?.id || offlineUser?.id;
  const userName = session?.user?.name || offlineUser?.name;

  return (
    <GitHubDatabaseWrapper>
      <SidebarProvider defaultOpen={!isCollapsed}>
        <SWRConfigProvider>
          <AppPopupProvider />
          {/* Check if user needs to complete onboarding (name + username) */}
          <CreatorProfileCheck userId={userId} userName={userName} />
          <AppSidebar
            session={session || undefined}
            offlineUser={offlineUser}
          />
          <main className="relative bg-background  w-full flex flex-col h-screen">
            <AppHeader />
            <div className="flex-1 overflow-y-auto">{children}</div>
          </main>
        </SWRConfigProvider>
      </SidebarProvider>
    </GitHubDatabaseWrapper>
  );
}
