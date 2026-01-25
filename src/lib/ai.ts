import { CopilotClient, CopilotSession } from '@github/copilot-sdk';
import { getEffectiveModel } from './config.js';

/**
 * AI Service for interacting with GitHub Copilot CLI SDK
 * Uses your GitHub account authentication
 */
export class AIService {
  private client: CopilotClient;
  private session: CopilotSession | null = null;
  private systemMessage: string;
  private modelOverride: string | undefined;

  constructor(systemMessage?: string, modelOverride?: string) {
    this.client = new CopilotClient();
    this.modelOverride = modelOverride;
    this.systemMessage =
      systemMessage ||
      `You are a helpful AI assistant.
Provide concise, actionable responses.
Be professional but friendly.`;
  }

  private async ensureSession(): Promise<CopilotSession> {
    if (!this.session) {
      await this.client.start();
      const model = getEffectiveModel(this.modelOverride);
      this.session = await this.client.createSession({
        model,
        systemMessage: {
          mode: 'append',
          content: this.systemMessage,
        },
      });
    }
    return this.session;
  }

  /**
   * Send a prompt to the AI and get a response
   */
  async prompt(userPrompt: string): Promise<string> {
    const session = await this.ensureSession();
    const response = await session.sendAndWait({ prompt: userPrompt });
    return response?.data.content || '';
  }

  /**
   * Close the SDK connection
   */
  async close() {
    if (this.session) {
      await this.session.destroy();
    }
    await this.client.stop();
  }
}
