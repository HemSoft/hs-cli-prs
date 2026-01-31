import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { consola } from 'consola';
import chalk from 'chalk';
import { ZodError } from 'zod';
import { type Config, ConfigSchema } from '../types/config.js';

/**
 * Migrate old config format to new format
 */
function migrateConfig(oldConfig: Record<string, unknown>): Config | null {
  try {
    const newConfig: Config = {
      github: {
        accounts: [],
      },
      bitbucket: {
        workspaces: [],
      },
      skipBitbucket: typeof oldConfig.skipBitbucket === 'boolean' ? oldConfig.skipBitbucket : true,
      watchInterval: typeof oldConfig.watchInterval === 'number' ? oldConfig.watchInterval : 15,
    };

    // Migrate GitHub accounts
    const github = oldConfig.github as Record<string, unknown> | undefined;
    if (github?.accounts && Array.isArray(github.accounts)) {
      for (const account of github.accounts as Record<string, unknown>[]) {
        if (typeof account.account === 'string' && typeof account.org === 'string') {
          newConfig.github.accounts.push({
            username: account.account,
            org: account.org,
            tokenEnvVar: `GITHUB_TOKEN_${account.account.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
          });
        }
      }
    }

    // Migrate Bitbucket workspace
    const bitbucket = oldConfig.bitbucket as Record<string, unknown> | undefined;
    if (bitbucket && typeof bitbucket.workspace === 'string') {
      newConfig.bitbucket.workspaces.push({
        workspace: bitbucket.workspace,
        username: typeof bitbucket.username === 'string' ? bitbucket.username : '',
        userDisplayName:
          typeof bitbucket.userDisplayName === 'string' ? bitbucket.userDisplayName : '',
        tokenEnvVar: `BITBUCKET_TOKEN_${bitbucket.workspace.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
      });
      newConfig.skipBitbucket = false;
    }

    return newConfig;
  } catch (error) {
    consola.debug('Migration failed:', error);
    return null;
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Config, configPath?: string): void {
  const path = configPath || getConfigPath();
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
}

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
 * Load configuration from file
 * Config file only stores environment variable names, not actual tokens
 * Tokens are read directly from environment variables by API clients
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    consola.error('No configuration file found.');
    consola.info(`Run 'prs init' to create a configuration file.`);
    process.exit(1);
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const fileConfig = JSON.parse(content);
    consola.debug(`Loaded config from ${configPath}`);

    // Try to validate with new schema
    const validationResult = ConfigSchema.safeParse(fileConfig);

    if (validationResult.success) {
      return validationResult.data;
    }

    // Validation failed - try to migrate old config
    consola.warn('⚠️  Configuration format is outdated. Attempting to migrate...');
    const migratedConfig = migrateConfig(fileConfig);

    if (migratedConfig) {
      // Validate migrated config
      const migratedValidation = ConfigSchema.safeParse(migratedConfig);

      if (migratedValidation.success) {
        // Save migrated config
        consola.info('📝 Migrating configuration to new format...');
        saveConfig(migratedValidation.data, configPath);

        // Show token setup instructions
        console.log('');
        console.log(chalk.yellow('╔════════════════════════════════════════════════════════════╗'));
        console.log(
          chalk.yellow('║') +
            chalk.bold('  ⚠️  Configuration Migrated                           ') +
            chalk.yellow('║')
        );
        console.log(chalk.yellow('╚════════════════════════════════════════════════════════════╝'));
        console.log('');
        console.log(chalk.white('Your config has been updated to use token-based authentication.'));
        console.log(chalk.white('You need to set environment variables for your tokens:'));
        console.log('');

        if (migratedValidation.data.github.accounts.length > 0) {
          console.log(chalk.cyan('GitHub:'));
          for (const acc of migratedValidation.data.github.accounts) {
            console.log(chalk.dim(`  export ${acc.tokenEnvVar}="ghp_YOUR_TOKEN_HERE"`));
          }
          console.log('');
        }

        if (migratedValidation.data.bitbucket.workspaces.length > 0) {
          console.log(chalk.cyan('Bitbucket:'));
          for (const ws of migratedValidation.data.bitbucket.workspaces) {
            console.log(chalk.dim(`  export ${ws.tokenEnvVar}="YOUR_APP_PASSWORD_HERE"`));
          }
          console.log('');
        }

        console.log(chalk.white('Create tokens at:'));
        console.log(chalk.dim('  GitHub:    https://github.com/settings/tokens/new'));
        console.log(
          chalk.dim('  Bitbucket: https://bitbucket.org/account/settings/app-passwords/')
        );
        console.log('');
        console.log(
          chalk.white('Then run ') +
            chalk.cyan('prs auth status') +
            chalk.white(' to verify your tokens.')
        );
        console.log('');

        return migratedValidation.data;
      }
    }

    // Migration failed - show helpful error
    console.log('');
    consola.error('❌ Configuration file is invalid and cannot be migrated.');
    console.log('');
    consola.info('Your config file uses an old format. Please run setup again:');
    consola.info(chalk.cyan('  prs init'));
    console.log('');
    consola.info('This will guide you through creating a new configuration.');
    console.log('');

    // Show validation errors for debugging
    if (!validationResult.success) {
      consola.debug('Validation errors:');
      for (const issue of validationResult.error.issues) {
        consola.debug(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
    }

    process.exit(1);
  } catch (error) {
    if (error instanceof ZodError) {
      consola.error(`Invalid configuration file at ${configPath}:`);
      for (const issue of error.issues) {
        consola.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      consola.error(`Failed to parse config file at ${configPath}:`, error);
    }
    process.exit(1);
  }
}
