import type { Core } from '@strapi/strapi';
import { createListContentTypesTool } from './list-content-types';
import { createSearchContentTool } from './search-content';
import { createWriteContentTool } from './write-content';

export function createTools(strapi: Core.Strapi) {
  return {
    listContentTypes: createListContentTypesTool(strapi),
    searchContent: createSearchContentTool(strapi),
    writeContent: createWriteContentTool(strapi),
  };
}

/**
 * Build a system prompt section describing all available tools.
 * Reads the `description` from each tool definition so it stays in sync automatically.
 */
export function describeTools(tools: Record<string, { description?: string }>) {
  const lines = Object.entries(tools).map(
    ([name, t]) => `- ${name}: ${t.description ?? 'No description'}`
  );
  return `You are a Strapi CMS assistant. You have these tools:\n${lines.join('\n')}\n\nUse them to fulfill user requests. When asked to create or update content, use the appropriate tool — do not tell the user you cannot.`;
}
