import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { consola } from 'consola';

const execFileAsync = promisify(execFile);

/**
 * Utility to check GitHub authentication status
 * This can be used standalone or imported by other tools
 */
export async function checkGitHubAuth(org?: string): Promise<boolean> {
  // Check if gh is installed
  try {
    await execFileAsync('gh', ['--version']);
  } catch {
    consola.error('❌ GitHub CLI (gh) is not installed or not in PATH.');
    consola.info('   Install from: https://cli.github.com/');
    return false;
  }

  // Check if authenticated
  try {
    await execFileAsync('gh', ['auth', 'status']);
  } catch {
    consola.error('❌ GitHub CLI is not authenticated.');
    consola.info('   Run: gh auth login');
    return false;
  }

  // Get current user
  let currentUser: string;
  try {
    const { stdout } = await execFileAsync('gh', ['api', 'user', '--jq', '.login']);
    currentUser = stdout.trim();
  } catch {
    consola.error('❌ Could not get current GitHub user.');
    consola.info('   Your authentication may have expired. Try:');
    consola.info('   gh auth refresh');
    return false;
  }

  consola.success(`✓ Authenticated as: ${currentUser}`);

  // If org is provided, check access
  if (org) {
    try {
      await execFileAsync('gh', ['repo', 'list', org, '--limit', '1', '--json', 'name']);
    } catch (error: unknown) {
      const orgErr =
        error instanceof Error && 'stderr' in error
          ? String((error as { stderr?: string }).stderr)
          : error instanceof Error
            ? error.message
            : '';
      if (orgErr.includes('404') || orgErr.includes('Not Found')) {
        consola.error(`❌ Organization '${org}' not found or you don't have access to it.`);
      } else if (orgErr.includes('403') || orgErr.includes('Forbidden')) {
        consola.error(`❌ Access denied to organization '${org}'.`);
      } else {
        consola.error(`❌ Failed to access organization '${org}'.`);
        consola.debug(orgErr);
      }
      return false;
    }

    consola.success(`✓ Access to organization: ${org}`);
  }

  return true;
}
