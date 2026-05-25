/**
 * Returns true only if all required GitHub App environment variables are set.
 * Used to conditionally show/hide GitHub App integration UI.
 */
export function isGitHubAppEnabled(): boolean {
  return !!(
    process.env.GITHUB_APP_ID &&
    process.env.GITHUB_APP_SLUG &&
    process.env.GITHUB_APP_PRIVATE_KEY &&
    process.env.GITHUB_WEBHOOK_SECRET
  );
}
