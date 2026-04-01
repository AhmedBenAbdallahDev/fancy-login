import { getSession } from "@/lib/auth/server";
import { chatRepository } from "@/lib/db/repository";
import { convertToUIMessage } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const chatRepo = chatRepository;

  try {
    const thread = await chatRepo.selectThread(id);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (thread.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messages = await chatRepo.selectMessagesByThreadId(id);
    const uiMessages = messages.map(convertToUIMessage);

    return NextResponse.json(uiMessages);
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
