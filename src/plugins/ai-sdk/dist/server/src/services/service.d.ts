import type { Core } from '@strapi/strapi';
import type { ModelMessage } from 'ai';
import { type StreamTextRawResult } from '../lib/init-ai-sdk';
declare const service: ({ strapi }: {
    strapi: Core.Strapi;
}) => {
    ask(prompt: string, options?: {
        system?: string;
    }): Promise<string>;
    askStream(prompt: string, options?: {
        system?: string;
    }): Promise<AsyncIterable<string>>;
    /**
     * Chat with messages - returns raw stream for UI message stream response
     * Compatible with AI SDK UI hooks (useChat)
     */
    chat(messages: ModelMessage[], options?: {
        system?: string;
    }): StreamTextRawResult;
    isInitialized(): boolean;
};
export default service;
