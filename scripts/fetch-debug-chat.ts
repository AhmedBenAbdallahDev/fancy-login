import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { ChatMessageSchema } from "../src/lib/db/pg/schema.pg";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const threadId = "9863073e-2025-48fc-b054-71bbc26d8ef1";
  console.log(`Fetching messages for thread: ${threadId}`);

  const db = drizzle(process.env.POSTGRES_URL!);

  const messages = await db
    .select()
    .from(ChatMessageSchema)
    .where(eq(ChatMessageSchema.threadId, threadId))
    .orderBy(ChatMessageSchema.createdAt);

  console.log(JSON.stringify(messages, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
