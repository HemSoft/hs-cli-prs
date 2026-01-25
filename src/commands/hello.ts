import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import logSymbols from 'log-symbols';
import { AIService } from '../lib/ai.js';

interface HelloOptions {
  name?: string;
  model?: string;
}

/**
 * Demo command showing AI integration, banner, and argument parsing
 */
export async function hello(options: HelloOptions) {
  const ai = new AIService(undefined, options.model);
  const spinner = ora();

  try {
    const name = options.name || 'World';

    spinner.start('Asking AI for a creative greeting...');

    const prompt = `Generate a creative and friendly greeting for someone named "${name}".
Make it fun and welcoming. Keep it to 1-2 sentences.
Include a relevant emoji.`;

    const greeting = await ai.prompt(prompt);

    spinner.succeed('Got a greeting from AI!');

    console.log(
      boxen(chalk.cyan(greeting), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      })
    );

    console.log(chalk.gray(`\nModel used: ${chalk.yellow(options.model || 'default')}`));
    console.log(
      chalk.dim("\nTip: Try different models with --model claude, --model gpt5, etc.\n")
    );
  } catch (error) {
    spinner.fail('Failed to generate greeting');
    console.error(
      chalk.red(logSymbols.error),
      error instanceof Error ? error.message : 'Unknown error'
    );
    process.exit(1);
  } finally {
    await ai.close();
  }
}
