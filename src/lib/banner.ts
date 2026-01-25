import chalk from 'chalk';
import gradient from 'gradient-string';

// Clean ANSI shadow style logo (thin box-drawing characters)
const LOGO_LINES = ['  ┌─┐┬─┐┌─┐', '  ├─┘├┬┘└─┐', '  ┴  ┴└─└─┘'];

// Gradient definitions
const vice = gradient(['#ff2e97', '#00f0ff']);
const gold = gradient(['#bf953f', '#fcf6ba', '#b38728', '#fbf5b7', '#aa771c']);
const greenGlow = gradient(['#00ff87', '#60efff']);

export interface BannerOptions {
  version?: string;
  showTaglines?: boolean;
}

/**
 * Display the PRS CLI banner
 */
export function showBanner(options: BannerOptions = {}) {
  const { version = 'v0.1.0', showTaglines = true } = options;

  console.log(vice(LOGO_LINES[0]!));
  console.log(vice(LOGO_LINES[1]!) + '  ' + greenGlow(version));
  console.log(vice(LOGO_LINES[2]!));
  console.log('  ' + gold('✦ by HemSoft Developments ✦'));

  if (showTaglines) {
    console.log(chalk.dim('  ══════════════════════════════════'));
    console.log(chalk.hex('#ff2e97')('  ⚡ ') + chalk.bold('AI-Powered Pull Request Monitoring'));
    console.log(chalk.hex('#00f0ff')('  🤖 ') + chalk.dim('GitHub Copilot SDK'));
  }

  console.log();
}

/**
 * Get just the logo as a string (for embedding elsewhere)
 */
export function getLogo(): string {
  return LOGO_LINES.map((line) => vice(line)).join('\n');
}

/**
 * Get the HemSoft branding line
 */
export function getBranding(): string {
  return gold('✦ by HemSoft Developments ✦');
}
