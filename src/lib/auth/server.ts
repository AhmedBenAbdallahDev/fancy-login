import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { pgDb } from "lib/db/pg/db.pg";
import { headers } from "next/headers";
import { toast } from "sonner";
import {
  AccountSchema,
  SessionSchema,
  UserSchema,
  VerificationSchema,
} from "lib/db/pg/schema.pg";
import { sendEmail, getPasswordResetEmailHtml } from "lib/email";

import logger from "logger";
import { redirect } from "next/navigation";

export const auth = betterAuth({
  plugins: [nextCookies()],
  database: drizzleAdapter(pgDb, {
    provider: "pg",
    schema: {
      user: UserSchema,
      session: SessionSchema,
      account: AccountSchema,
      verification: VerificationSchema,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.DISABLE_SIGN_UP ? true : false,
    // Password reset configuration
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password - Anvil",
        html: getPasswordResetEmailHtml(url),
      });
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
  },

  advanced: {
    useSecureCookies:
      process.env.NO_HTTPS == "1"
        ? false
        : process.env.NODE_ENV === "production",
    database: {
      generateId: false,
    },
  },
  account: {
    accountLinking: {
      trustedProviders: ["google", "github"],
    },
  },
  fetchOptions: {
    onError(e) {
      if (e.error.status === 429) {
        toast.error("Too many requests. Please try again later.");
      }
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      // ⭐ CRITICAL: Repository access permissions for DiffDB
      // Full repository access + user info for GitHub-as-database
      scope: ["repo", "user:email", "read:user"] as string[],
      // Force consent screen to show permissions clearly
      extraAuthParams: {
        prompt: "consent",
        allow_signup: "true",
      },
    },
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            prompt: "select_account",
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
});

export const getSession = async () => {
  "use server";
  const session = await auth.api
    .getSession({
      headers: await headers(),
    })
    .catch((e) => {
      logger.error(e);
      return null;
    });

  // If no better-auth session, check for offline cookies
  if (!session) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const offlineUserStr = cookieStore.get("diffchat_offline_user")?.value;

    if (offlineUserStr) {
      try {
        const user = JSON.parse(offlineUserStr);
        // Create synthetic session for offline user
        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          session: {
            id: "offline-session",
            userId: user.id,
            token: cookieStore.get("diffchat_offline_token")?.value || "",
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
            createdAt: new Date(),
            updatedAt: new Date(),
            ipAddress: "127.0.0.1",
            userAgent: "Offline-Mode",
          },
        };
      } catch (e) {
        logger.error("Failed to parse offline user cookie", e);
      }
    }

    // No session at all
    logger.error("No session found");
    redirect("/sign-in");
  }
  return session!;
};
