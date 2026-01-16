import type { Core } from '@strapi/strapi';
import { aiSDKManager } from './lib/init-ai-sdk';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const config = strapi.config.get('plugin::ai-sdk') as {
    anthropicApiKey?: string;
    chatModel?: string;
    baseURL?: string;
  };

  if (!config?.anthropicApiKey) {
    strapi.log.warn('AI SDK plugin: anthropicApiKey not configured, plugin will not be initialized');
    return;
  }

  aiSDKManager.initialize({
    anthropicApiKey: config.anthropicApiKey,
    chatModel: config.chatModel as any,
    baseURL: config.baseURL,
  });

  strapi.log.info(`AI SDK plugin initialized with model: ${aiSDKManager.getChatModel()}`);
};

export default register;
