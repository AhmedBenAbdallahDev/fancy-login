import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId =
    process.env.GITHUB_CLIENT_ID_OFFLINE || process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${new URL(request.url).origin}/api/auth/offline-callback`;
  const scope = "repo user:email read:user";

  if (!clientId) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID_OFFLINE not configured" },
      { status: 500 },
    );
  }

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&prompt=consent`;

  return NextResponse.redirect(githubAuthUrl);
}
