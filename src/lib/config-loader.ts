import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { consola } from 'consola';
import { type Config, ConfigSchema } from '../types/config.js';

/**
 * Get the path to the HemSoft PRS config file
 */
export function getConfigPath(): string {
  // Priority order:
  // 1. Local project .prs.json
  // 2. ~/hemsoft/prs/config.json (new standard location)
  // 3. ~/.prs.json (legacy location)

  const localConfig = join(process.cwd(), '.prs.json');
  if (existsSync(localConfig)) {
    return localConfig;
  }

  const hemsoftConfig = join(homedir(), 'hemsoft', 'prs', 'config.json');
  if (existsSync(hemsoftConfig)) {
    return hemsoftConfig;
  }

  const legacyConfig = join(homedir(), '.prs.json');
  if (existsSync(legacyConfig)) {
    consola.warn(
      `Using legacy config location: ${legacyConfig}. Consider running 'prs init --global' to migrate.`
    );
    return legacyConfig;
  }

  return hemsoftConfig; // Default path for new configs
}

/**
 * Load configuration from multiple sources with precedence:
 * 1. Environment variables (highest priority)
 * 2. Local config file (./.prs.json)
 * 3. HemSoft config file (~/hemsoft/prs/config.json)
 * 4. Legacy config file (~/.prs.json)
 * 5. Defaults (lowest priority)
 */
export function loadConfig(): Config {
  let fileConfig: Partial<Config> = {};

  const configPath = getConfigPath();
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(content);
      consola.debug(`Loaded config from ${configPath}`);
    } catch (error) {
      consola.warn(`Failed to parse config file at ${configPath}:`, error);
    }
  }

  // Merge with environment variables (highest priority)
  const config: Partial<Config> = {
    github: {
      org: process.env.GITHUB_ORG || fileConfig.github?.org || 'your-org',
      token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || fileConfig.github?.token,
      // Support GITHUB_ACCOUNTS env var as JSON array
      accounts: process.env.GITHUB_ACCOUNTS
        ? JSON.parse(process.env.GITHUB_ACCOUNTS)
        : fileConfig.github?.accounts,
    },
    bitbucket: {
      workspace:
        process.env.BITBUCKET_WORKSPACE || fileConfig.bitbucket?.workspace || 'your-workspace',
      username: process.env.BITBUCKET_USERNAME || fileConfig.bitbucket?.username,
      apiKey: process.env.BITBUCKET_API_KEY || fileConfig.bitbucket?.apiKey,
      userDisplayName:
        process.env.BITBUCKET_USER_DISPLAY_NAME ||
        fileConfig.bitbucket?.userDisplayName ||
        'Your Name',
    },
    skipBitbucket: process.env.SKIP_BITBUCKET === 'true' || fileConfig.skipBitbucket || false,
    watchInterval: process.env.WATCH_INTERVAL
      ? Number.parseInt(process.env.WATCH_INTERVAL, 10)
      : fileConfig.watchInterval || 15,
  };

  // Validate and return
  return ConfigSchema.parse(config);
}
