import { NextResponse } from "next/server";
import { auth } from "auth/server";
import { headers } from "next/headers";
import { pgDb } from "lib/db/pg/db.pg";
import { AccountSchema } from "lib/db/pg/schema.pg";
import { eq } from "drizzle-orm";

/**
 * GET /api/auth/user-auth-type
 *
 * Returns the authentication type for the current user:
 * - "github" - User authenticated via GitHub OAuth (uses DiffDB)
 * - "email" - User authenticated via email/password (uses PostgreSQL)
 * - "offline" - User authenticated via offline GitHub token (uses DiffDB)
 * - null - Not authenticated
 */
export async function GET() {
  try {
    const headersList = await headers();

    // Check for offline user first
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const offlineToken = cookieStore.get("diffchat_offline_token")?.value;
    const offlineUserStr = cookieStore.get("diffchat_offline_user")?.value;

    if (offlineToken && offlineUserStr) {
      return NextResponse.json({
        authType: "offline",
        storageMode: "diffdb",
      });
    }

    // Get Better Auth session
    const session = await auth.api
      .getSession({ headers: headersList })
      .catch(() => null);

    if (!session?.user?.id) {
      return NextResponse.json({
        authType: null,
        storageMode: null,
      });
    }

    // Check if user has GitHub OAuth account
    const githubAccount = await pgDb
      .select()
      .from(AccountSchema)
      .where(eq(AccountSchema.userId, session.user.id))
      .then((accounts) =>
        accounts.find((account) => account.providerId === "github"),
      );

    if (githubAccount?.accessToken) {
      return NextResponse.json({
        authType: "github",
        storageMode: "diffdb",
      });
    }

    // No GitHub account = email/password user
    return NextResponse.json({
      authType: "email",
      storageMode: "postgres",
    });
  } catch (error) {
    console.error("Error getting user auth type:", error);
    return NextResponse.json(
      { error: "Failed to get auth type" },
      { status: 500 },
    );
  }
}
