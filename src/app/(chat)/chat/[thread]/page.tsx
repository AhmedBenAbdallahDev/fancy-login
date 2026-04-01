import { selectThreadAction } from "@/app/api/chat/actions";
import ChatBot from "@/components/chat-bot";

import { ChatThread } from "app-types/chat";
import { redirect, RedirectType } from "next/navigation";

const fetchThread = async (threadId: string): Promise<ChatThread | null> => {
  return await selectThreadAction(threadId);
};

export default async function Page({
  params,
}: { params: Promise<{ thread: string }> }) {
  const { thread: threadId } = await params;

  const thread = await fetchThread(threadId);

  if (!thread) redirect("/", RedirectType.replace);

  // We pass empty messages initially to allow instant navigation.
  // The ChatBot component will fetch messages client-side (and use cache).
  return (
    <ChatBot
      threadId={threadId}
      initialMessages={[]}
      isRoleplay={!!thread.characterId}
    />
  );
}
