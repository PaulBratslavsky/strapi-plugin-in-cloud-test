import { createAnthropic, type AnthropicProvider } from '@ai-sdk/anthropic';
import { generateText, streamText, type LanguageModel } from 'ai';
import {
  CHAT_MODELS,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  isPromptInput,
  type PluginConfig,
  type ChatModelName,
  type GenerateInput,
  type GenerateTextResult,
  type StreamTextResult,
} from './types';

class AISDKManager {
  private provider: AnthropicProvider | null = null;
  private model: ChatModelName = DEFAULT_MODEL;

  initialize(config: PluginConfig): void {
    if (!config.anthropicApiKey) {
      throw new Error('anthropicApiKey is required in plugin config');
    }

    this.provider = createAnthropic({
      apiKey: config.anthropicApiKey,
      baseURL: config.baseURL,
    });

    if (config.chatModel && CHAT_MODELS.includes(config.chatModel)) {
      this.model = config.chatModel;
    }
  }

  private getLanguageModel(): LanguageModel {
    if (!this.provider) {
      throw new Error('AI SDK Manager not initialized');
    }
    return this.provider(this.model);
  }

  private buildParams(input: GenerateInput) {
    const base = {
      model: this.getLanguageModel(),
      system: input.system,
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: input.maxOutputTokens,
    };

    return isPromptInput(input)
      ? { ...base, prompt: input.prompt }
      : { ...base, messages: input.messages };
  }

  async generate(input: GenerateInput): Promise<GenerateTextResult> {
    const result = await generateText(this.buildParams(input));
    return { text: result.text };
  }

  async stream(input: GenerateInput): Promise<StreamTextResult> {
    const result = streamText(this.buildParams(input));
    return { textStream: result.textStream };
  }

  // Convenience methods for simple prompt-based calls
  async generateText(prompt: string, options?: Omit<GenerateInput, 'prompt' | 'messages'>): Promise<GenerateTextResult> {
    return this.generate({ prompt, ...options });
  }

  async streamText(prompt: string, options?: Omit<GenerateInput, 'prompt' | 'messages'>): Promise<StreamTextResult> {
    return this.stream({ prompt, ...options });
  }

  getChatModel(): ChatModelName {
    return this.model;
  }

  isInitialized(): boolean {
    return this.provider !== null;
  }

  destroy(): void {
    this.provider = null;
  }
}

export const aiSDKManager = new AISDKManager();
export { AISDKManager };

// Re-export types for convenience
export * from './types';
