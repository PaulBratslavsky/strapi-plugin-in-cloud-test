import type { Core } from '@strapi/strapi';
import type { ModelMessage } from 'ai';
import { aiSDKManager, type StreamTextRawResult } from '../lib/init-ai-sdk';

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  async ask(prompt: string, options?: { system?: string }) {
    const result = await aiSDKManager.generateText(prompt, {
      system: options?.system,
    });
    return result.text;
  },

  async askStream(prompt: string, options?: { system?: string }) {
    const result = await aiSDKManager.streamText(prompt, {
      system: options?.system,
    });
    return result.textStream;
  },

  /**
   * Chat with messages - returns raw stream for UI message stream response
   * Compatible with AI SDK UI hooks (useChat)
   */
  chat(messages: ModelMessage[], options?: { system?: string }): StreamTextRawResult {
    return aiSDKManager.streamRaw({
      messages,
      system: options?.system,
    });
  },

  isInitialized() {
    return aiSDKManager.isInitialized();
  },
});

export default service;
