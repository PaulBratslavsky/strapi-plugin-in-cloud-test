import type { Core } from '@strapi/strapi';
import { aiSDKManager } from '../lib/init-ai-sdk';

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

  isInitialized() {
    return aiSDKManager.isInitialized();
  },
});

export default service;
