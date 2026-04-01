/**
 * DiffDB Server Actions
 *
 * Server-side actions for initializing and managing DiffDB.
 * These functions run on the server and handle GitHub authentication
 * integration with Better Auth.
 */

"use server";

import { getSession } from "@/lib/auth/server";
import { validateGitHubAuth } from "@/lib/auth/github-helper";
import {
  initializeDiffDB,
  isDiffDBEnabled,
  getDiffDBState,
} from "@/lib/diffdb";

/**
 * Initialize DiffDB for the current authenticated user
 */
export async function initializeDiffDBAction() {
  try {
    // Check if DiffDB is enabled
    if (!isDiffDBEnabled()) {
      return {
        success: false,
        error: "DiffDB is not enabled",
      };
    }

    // Get current session with GitHub validation
    const session = await getSession();
    if (!session?.user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    // Use the helper to get GitHub access token
    const githubAuth = await validateGitHubAuth(session);

    if (!githubAuth.hasAuth || !githubAuth.accessToken) {
      return {
        success: false,
        error: githubAuth.error || "GitHub authentication required",
      };
    }

    if (!githubAuth.hasRepoScope) {
      return {
        success: false,
        error:
          "GitHub account needs repository permissions. Please re-authenticate with GitHub.",
      };
    }

    // Initialize DiffDB
    const setup = await initializeDiffDB(githubAuth.accessToken, {
      repositoryName: process.env.DIFFDB_REPOSITORY_NAME,
    });

    return {
      success: true,
      data: {
        user: setup.user,
        repository: setup.repository,
        isNewRepository: setup.isNewRepository,
      },
    };
  } catch (error: any) {
    console.error("DiffDB initialization failed:", error);
    return {
      success: false,
      error: error.message || "Failed to initialize DiffDB",
    };
  }
}

/**
 * Get current DiffDB status
 */
export async function getDiffDBStatusAction() {
  try {
    const state = getDiffDBState();

    return {
      success: true,
      data: {
        isEnabled: isDiffDBEnabled(),
        isInitialized: state.isInitialized,
        userSetup: state.userSetup,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to get DiffDB status",
    };
  }
}

/**
 * Check if user has GitHub authentication with repo permissions
 */
export async function checkGitHubAuthAction() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    // Check for GitHub account with access token
    let hasGitHubAuth = false;
    let hasRepoPermissions = false;

    const sessionUser = session.user as any;

    if (sessionUser?.accounts) {
      const githubAccount = sessionUser.accounts.find(
        (account: any) => account.providerId === "github",
      );

      hasGitHubAuth = !!githubAccount;

      // Check if the token has repo permissions (would need to validate scope)
      // For now, assume if we have an access token, we have the right permissions
      hasRepoPermissions = !!githubAccount?.accessToken;
    }

    return {
      success: true,
      data: {
        hasGitHubAuth,
        hasRepoPermissions,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to check GitHub authentication",
    };
  }
}

/**
 * Validate GitHub repository setup
 */
export async function validateGitHubRepoAction() {
  try {
    // Check if DiffDB is enabled
    if (!isDiffDBEnabled()) {
      return {
        success: false,
        error: "DiffDB is not enabled",
      };
    }

    // Get current session with GitHub validation
    const session = await getSession();
    if (!session?.user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    // Use the helper to get GitHub access token
    const githubAuth = await validateGitHubAuth(session);

    if (!githubAuth.hasAuth || !githubAuth.accessToken) {
      return {
        success: false,
        error: githubAuth.error || "GitHub authentication required",
      };
    }

    // Test repository access by trying to read schema.json
    try {
      const { DiffDBClient } = await import("@/lib/diffdb/client");
      const client = new DiffDBClient(githubAuth.accessToken);
      await client.initialize();

      const repoName = process.env.DIFFDB_REPOSITORY_NAME || "diffchat-data";

      // Check if repository exists and has proper structure
      const repoExists = await client.repositoryExists(repoName);
      if (!repoExists) {
        return {
          success: false,
          error: "Repository not found",
        };
      }

      // Check if schema.json exists (validates structure)
      const schema = await client.readFile(repoName, "schema.json");
      if (!schema) {
        return {
          success: false,
          error: "Repository structure incomplete",
        };
      }

      return {
        success: true,
        data: {
          repositoryExists: true,
          structureValid: true,
          repositoryName: repoName,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Repository validation failed: ${error.message}`,
      };
    }
  } catch (error: any) {
    console.error("GitHub repository validation failed:", error);
    return {
      success: false,
      error: error.message || "Failed to validate GitHub repository",
    };
  }
}
