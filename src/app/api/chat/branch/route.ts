"use server";

import { getSession } from "auth/server";
import { chatRepository } from "lib/db/repository";
import { generateUUID } from "lib/utils";
import { cookies } from "next/headers";
import { ChatMessage } from "app-types/chat";

// Helper to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const offlineUserStr = cookieStore.get("diffchat_offline_user")?.value;

  if (offlineUserStr) {
    try {
      const offlineUser = JSON.parse(offlineUserStr);
      return offlineUser.id;
    } catch {
      // Invalid cookie, fall through
    }
  }

  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * POST /api/chat/branch
 * Creates a new thread that branches from an existing thread at a specific message.
 * Copies all messages up to and including the specified message.
 *
 * Body: { threadId: string, messageId: string }
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { threadId, messageId } = await request.json();

    if (!threadId || !messageId) {
      return Response.json(
        { error: "threadId and messageId are required" },
        { status: 400 },
      );
    }

    // Get the original thread
    const originalThread = await chatRepository.selectThread(threadId);
    if (!originalThread) {
      return Response.json({ error: "Thread not found" }, { status: 404 });
    }

    if (originalThread.userId !== userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all messages from the original thread
    const allMessages = await chatRepository.selectMessagesByThreadId(threadId);

    // Find the message to branch from and get all messages up to and including it
    const branchPointIndex = allMessages.findIndex((m) => m.id === messageId);
    if (branchPointIndex === -1) {
      return Response.json(
        { error: "Message not found in thread" },
        { status: 404 },
      );
    }

    const messagesToCopy = allMessages.slice(0, branchPointIndex + 1);

    // Create the new branched thread
    const newThreadId = generateUUID();
    const newThread = await chatRepository.insertThread({
      id: newThreadId,
      title: `${originalThread.title} (Branch)`,
      userId,
      characterId: originalThread.characterId,
      personaId: originalThread.personaId,
      stylePresetId: originalThread.stylePresetId,
      parentThreadId: threadId,
      branchedFromMessageId: messageId,
    });

    // Copy messages to the new thread
    if (messagesToCopy.length > 0) {
      const messagesToInsert: PartialBy<ChatMessage, "createdAt">[] =
        messagesToCopy.map((msg) => ({
          id: generateUUID(), // New ID for the copied message
          threadId: newThreadId,
          role: msg.role,
          parts: msg.parts,
          attachments: msg.attachments,
          annotations: msg.annotations,
          model: msg.model,
        }));

      await chatRepository.insertMessages(messagesToInsert);
    }

    return Response.json({
      thread: newThread,
      copiedMessageCount: messagesToCopy.length,
    });
  } catch (error: any) {
    console.error("Failed to branch chat:", error);
    return Response.json(
      { error: error.message || "Failed to branch chat" },
      { status: 500 },
    );
  }
}