import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addDays } from "date-fns";

export async function GET(request: NextRequest) {
  console.log("[Offline Callback] Request received");
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  console.log("[Offline Callback] Code:", code ? "present" : "missing");
  console.log("[Offline Callback] Error:", error);

  if (error || !code) {
    console.log("[Offline Callback] Redirecting to sign-in with error");
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_failed", request.url),
    );
  }

  try {
    console.log("[Offline Callback] Starting token exchange");
    // 1. Exchange Code for Access Token
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id:
            process.env.GITHUB_CLIENT_ID_OFFLINE ||
            process.env.GITHUB_CLIENT_ID,
          client_secret:
            process.env.GITHUB_CLIENT_SECRET_OFFLINE ||
            process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      },
    );

    const tokenData = await tokenRes.json();
    console.log(
      "[Offline Callback] Token data received:",
      tokenData.error ? "ERROR" : "SUCCESS",
    );

    if (tokenData.error || !tokenData.access_token) {
      console.error(
        "[Offline Callback] GitHub Token Exchange Error:",
        tokenData,
      );
      return NextResponse.redirect(
        new URL("/sign-in?error=token_exchange_failed", request.url),
      );
    }

    const accessToken = tokenData.access_token;
    console.log("[Offline Callback] Access token obtained");

    // 2. Fetch User Profile
    console.log("[Offline Callback] Fetching user profile");
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DiffChat-Offline-Auth",
      },
    });

    if (!userRes.ok) {
      console.error("[Offline Callback] User fetch failed:", userRes.status);
      return NextResponse.redirect(
        new URL("/sign-in?error=user_fetch_failed", request.url),
      );
    }

    const githubUser = await userRes.json();
    console.log("[Offline Callback] User profile fetched:", githubUser.login);

    // 3. Fetch User Email (if not public)
    let email = githubUser.email;
    if (!email) {
      console.log("[Offline Callback] Fetching email separately");
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "DiffChat-Offline-Auth",
        },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        const primary = emails.find((e: any) => e.primary) || emails[0];
        email = primary?.email;
      }
    }

    // 4. Construct User Object
    const user = {
      id: githubUser.id.toString(),
      name: githubUser.name || githubUser.login,
      email: email,
      image: githubUser.avatar_url,
    };
    console.log("[Offline Callback] User object created:", user.email);

    // 5. Set Cookies
    console.log("[Offline Callback] Setting cookies");
    const cookieStore = await cookies();
    const expiresAt = addDays(new Date(), 30);

    cookieStore.set("diffchat_offline_token", accessToken, {
      httpOnly: false, // ← Allow JavaScript to read it
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    cookieStore.set("diffchat_offline_user", JSON.stringify(user), {
      httpOnly: false, // ← Allow JavaScript to read it
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    console.log("[Offline Callback] Cookies set, redirecting to home");
    // 6. Redirect to Home
    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    console.error("[Offline Callback] Error:", err);
    return NextResponse.redirect(
      new URL("/sign-in?error=internal_error", request.url),
    );
  }
}
