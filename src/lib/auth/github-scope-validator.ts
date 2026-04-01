/**
 * GitHub Scope Validator
 *
 * Validates that users have granted the required GitHub permissions
 * for repository access in our DiffDB system.
 */

import { getGitHubAccessToken } from "./github-helper";

/**
 * Required GitHub scopes for DiffDB functionality
 */
export const REQUIRED_GITHUB_SCOPES = [
  "repo", // Full repository access (create, read, write, delete)
  "user:email", // Access to user's email addresses
  "read:user", // Access to user profile information
];

/**
 * Check if user's GitHub token has the required scopes
 */
export async function validateGitHubScopes(session: any): Promise<{
  isValid: boolean;
  hasRepo: boolean;
  hasEmail: boolean;
  hasUser: boolean;
  scopes: string[];
  message?: string;
}> {
  try {
    const accessToken = await getGitHubAccessToken(session);
    if (!accessToken) {
      return {
        isValid: false,
        hasRepo: false,
        hasEmail: false,
        hasUser: false,
        scopes: [],
        message: "No GitHub access token found",
      };
    }

    // Test the token by making a simple API call to get user info
    // and check what scopes are available
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Luminar-AI-DiffDB/1.0",
      },
    });

    if (!response.ok) {
      return {
        isValid: false,
        hasRepo: false,
        hasEmail: false,
        hasUser: false,
        scopes: [],
        message: `GitHub API error: ${response.status}`,
      };
    }

    // Extract scopes from response headers
    const scopeHeader = response.headers.get("x-oauth-scopes") || "";
    const scopes = scopeHeader
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Check individual scopes
    const hasRepo = scopes.includes("repo");
    const hasEmail = scopes.includes("user:email");
    const hasUser = scopes.includes("read:user") || scopes.includes("user"); // 'user' includes 'read:user'

    const isValid = hasRepo && hasEmail && hasUser;

    return {
      isValid,
      hasRepo,
      hasEmail,
      hasUser,
      scopes,
      message: isValid
        ? "All required permissions granted"
        : `Missing permissions: ${[
            !hasRepo && "repository access",
            !hasEmail && "email access",
            !hasUser && "profile access",
          ]
            .filter(Boolean)
            .join(", ")}`,
    };
  } catch (error) {
    return {
      isValid: false,
      hasRepo: false,
      hasEmail: false,
      hasUser: false,
      scopes: [],
      message: `Scope validation error: ${error}`,
    };
  }
}

/**
 * Get GitHub authorization URL with proper scopes
 * This can be used to re-authenticate users who don't have proper permissions
 */
export function getGitHubReauthUrl(): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GitHub Client ID not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: REQUIRED_GITHUB_SCOPES.join(" "),
    prompt: "consent", // Force showing permission screen
    allow_signup: "true",
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Check if user needs to re-authenticate for repository permissions
 */
export async function needsReauth(session: any): Promise<boolean> {
  const validation = await validateGitHubScopes(session);
  return !validation.isValid;
}

/**
 * Component helper to show scope permission status
 */
export async function getScopeStatusMessage(session: any): Promise<{
  type: "success" | "warning" | "error";
  title: string;
  message: string;
  action?: string;
}> {
  const validation = await validateGitHubScopes(session);

  if (validation.isValid) {
    return {
      type: "success",
      title: "✅ GitHub Permissions Ready",
      message:
        "All required permissions for repository access have been granted.",
    };
  }

  const missingPerms: string[] = [];
  if (!validation.hasRepo) missingPerms.push("Repository Access (repo)");
  if (!validation.hasEmail) missingPerms.push("Email Access (user:email)");
  if (!validation.hasUser) missingPerms.push("Profile Access (read:user)");

  return {
    type: "error",
    title: "❌ Missing GitHub Permissions",
    message: `Your GitHub account is missing required permissions: ${missingPerms.join(", ")}`,
    action: "Re-authenticate with GitHub to grant repository permissions",
  };
}
