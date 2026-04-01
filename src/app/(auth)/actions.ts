"use server";

import { cookies } from "next/headers";
import { addDays } from "date-fns";

export async function offlineGithubLogin(token: string) {
  try {
    // 1. Verify Token with GitHub
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "DiffChat-Offline-Auth",
      },
    });

    if (!userRes.ok) {
      return { error: "Invalid GitHub Token" };
    }

    const githubUser = await userRes.json();
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "DiffChat-Offline-Auth",
      },
    });

    let email = githubUser.email;
    if (!email && emailRes.ok) {
      const emails = await emailRes.json();
      const primary = emails.find((e: any) => e.primary) || emails[0];
      email = primary?.email;
    }

    if (!email) {
      return { error: "Could not fetch email from GitHub" };
    }

    // 2. Construct User Object (No DB)
    const user = {
      id: githubUser.id.toString(), // Use GitHub ID as User ID
      name: githubUser.name || githubUser.login,
      email: email,
      image: githubUser.avatar_url,
    };

    // 3. Set Cookies
    const cookieStore = await cookies();
    const expiresAt = addDays(new Date(), 30); // Long-lived session

    // Store the Token (Securely)
    cookieStore.set("diffchat_offline_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    // Store User Info (Accessible to client if needed, but we'll keep it httpOnly for now and read via server)
    cookieStore.set("diffchat_offline_user", JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return { success: true };
  } catch (error) {
    console.error("Offline Login Error:", error);
    return { error: "Internal Server Error" };
  }
}

export async function offlineLogout() {
  try {
    const cookieStore = await cookies();

    // Clear offline cookies
    cookieStore.set("diffchat_offline_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/",
    });

    cookieStore.set("diffchat_offline_user", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
      path: "/",
    });

    return { success: true };
  } catch (error) {
    console.error("Offline Logout Error:", error);
    return { error: "Failed to logout" };
  }
}
