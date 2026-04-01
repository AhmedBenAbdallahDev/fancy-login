/**
 * GitHub Scope Test Action
 *
 * Server action to test GitHub OAuth scopes and permissions
 */

"use server";

import { getSession } from "@/lib/auth/server";
import {
  validateGitHubScopes,
  REQUIRED_GITHUB_SCOPES,
} from "@/lib/auth/github-scope-validator";
import { getGitHubAccessToken } from "@/lib/auth/github-helper";

/**
 * Test current user's GitHub permissions and scopes
 */
export async function testGitHubScopesAction() {
  try {
    // Get current session
    const session = await getSession();
    if (!session?.user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(session);
    if (!accessToken) {
      return {
        success: false,
        error: "No GitHub access token found",
        details: {
          userId: session.user.id,
          hasSession: true,
          hasGitHubToken: false,
        },
      };
    }

    // Validate GitHub scopes
    const scopeValidation = await validateGitHubScopes(session);

    // Test GitHub API access
    let apiTest: any = null;
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Luminar-AI-DiffDB/1.0",
        },
      });

      if (response.ok) {
        const userData = await response.json();
        apiTest = {
          success: true,
          username: userData.login,
          id: userData.id,
          name: userData.name,
          email: userData.email,
          publicRepos: userData.public_repos,
          privateRepos: userData.owned_private_repos,
        };
      } else {
        apiTest = {
          success: false,
          error: `API call failed: ${response.status} ${response.statusText}`,
        };
      }
    } catch (apiError: any) {
      apiTest = {
        success: false,
        error: `API call error: ${apiError.message}`,
      };
    }

    return {
      success: true,
      data: {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        },
        github: {
          hasToken: true,
          tokenLength: accessToken.length,
          scopes: scopeValidation.scopes,
          requiredScopes: REQUIRED_GITHUB_SCOPES,
          validation: scopeValidation,
          apiTest,
        },
      },
    };
  } catch (error: any) {
    console.error("GitHub scope test failed:", error);
    return {
      success: false,
      error: error.message || "Failed to test GitHub scopes",
    };
  }
}

/**
 * Get GitHub re-authentication URL for missing permissions
 */
export async function getReauthUrlAction() {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return {
        success: false,
        error: "GitHub Client ID not configured",
      };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      scope: REQUIRED_GITHUB_SCOPES.join(" "),
      prompt: "consent", // Force showing permission screen
      allow_signup: "true",
    });

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;

    return {
      success: true,
      data: {
        url,
        scopes: REQUIRED_GITHUB_SCOPES,
        message:
          "Visit this URL to re-authenticate with proper GitHub permissions",
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to generate re-auth URL",
    };
  }
}
