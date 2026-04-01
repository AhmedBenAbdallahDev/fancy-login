/**
 * GitHub Permissions Debug Component
 *
 * Quick component to test and display GitHub OAuth permissions
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { testGitHubScopesAction } from "@/lib/auth/github-scope-test";
import { CheckCircle, XCircle, Loader2, Github } from "lucide-react";

export function GitHubPermissionsDebug() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testPermissions = async () => {
    setTesting(true);
    setResult(null);

    try {
      const response = await testGitHubScopesAction();
      setResult(response);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="w-5 h-5" />
          GitHub Permissions Debug
        </CardTitle>
        <CardDescription>
          Test your GitHub OAuth permissions for repository access
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Button onClick={testPermissions} disabled={testing} className="w-full">
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing Permissions...
            </>
          ) : (
            <>
              <Github className="w-4 h-4 mr-2" />
              Test GitHub Permissions
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4">
            {result.success ? (
              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-green-800 dark:text-green-200">
                      Connected to GitHub
                    </h3>
                  </div>
                  {result.data?.github?.apiTest?.success && (
                    <div className="text-sm space-y-1">
                      <p>
                        <strong>Username:</strong>{" "}
                        {result.data.github.apiTest.username}
                      </p>
                      <p>
                        <strong>Name:</strong>{" "}
                        {result.data.github.apiTest.name || "Not provided"}
                      </p>
                      <p>
                        <strong>Email:</strong>{" "}
                        {result.data.github.apiTest.email || "Not public"}
                      </p>
                      <p>
                        <strong>Public Repos:</strong>{" "}
                        {result.data.github.apiTest.publicRepos}
                      </p>
                      <p>
                        <strong>Private Repos:</strong>{" "}
                        {result.data.github.apiTest.privateRepos}
                      </p>
                    </div>
                  )}
                </div>

                {/* Scopes */}
                <div className="space-y-2">
                  <h4 className="font-medium">Granted Permissions:</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.data?.github?.scopes?.map((scope: string) => (
                      <Badge key={scope} variant="outline">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Required vs Granted */}
                <div className="space-y-2">
                  <h4 className="font-medium">Required Permissions Check:</h4>
                  {result.data?.github?.requiredScopes?.map((scope: string) => {
                    const granted = result.data.github.scopes?.includes(scope);
                    return (
                      <div key={scope} className="flex items-center gap-2">
                        {granted ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span
                          className={
                            granted ? "text-green-800" : "text-red-800"
                          }
                        >
                          {scope} {!granted && "(MISSING)"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Validation Status */}
                <div
                  className={`rounded-lg p-4 ${
                    result.data?.github?.validation?.isValid
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "bg-red-50 dark:bg-red-900/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.data?.github?.validation?.isValid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {result.data?.github?.validation?.message}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="font-medium text-red-800 dark:text-red-200">
                    Test Failed
                  </span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                  {result.error}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-4">
          <p>
            <strong>Required Permissions:</strong>
          </p>
          <ul className="mt-1 space-y-1">
            <li>
              • <code>repo</code> - Full repository access (create, read, write,
              delete)
            </li>
            <li>
              • <code>user:email</code> - Access to user&apos;s email addresses
            </li>
            <li>
              • <code>read:user</code> - Access to user profile information
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
