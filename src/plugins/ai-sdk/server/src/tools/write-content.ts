import type { Core } from '@strapi/strapi';
import { tool, zodSchema } from 'ai';
import { z } from 'zod';

export function createWriteContentTool(strapi: Core.Strapi) {
  return tool({
    description:
      'Create or update a document in any Strapi content type. Use listContentTypes first to discover the schema, and searchContent to find existing documents for updates.',
    inputSchema: zodSchema(
      z.object({
        contentType: z
          .string()
          .describe('Content type UID, e.g. "api::article.article"'),
        action: z
          .enum(['create', 'update'])
          .describe('Whether to create a new document or update an existing one'),
        documentId: z
          .string()
          .optional()
          .describe('Required for update — the document ID to update'),
        data: z
          .record(z.string(), z.unknown())
          .describe('The field values to set. Must match the content type schema.'),
        status: z
          .enum(['draft', 'published'])
          .optional()
          .describe('Document status. Defaults to draft.'),
      })
    ),
    execute: async ({ contentType, action, documentId, data, status }) => {
      if (!strapi.contentTypes[contentType as keyof typeof strapi.contentTypes]) {
        return { error: `Content type "${contentType}" does not exist.` };
      }

      if (action === 'update' && !documentId) {
        return { error: 'documentId is required for update actions.' };
      }

      const docs = strapi.documents(contentType as any);

      if (action === 'create') {
        const document = await docs.create({
          data,
          ...(status ? { status } : {}),
          populate: '*',
        } as any);
        return { action: 'create', document };
      }

      const document = await docs.update({
        documentId: documentId,
        data,
        ...(status ? { status } : {}),
        populate: '*',
      } as any);
      return { action: 'update', document };
    },
  });
}
