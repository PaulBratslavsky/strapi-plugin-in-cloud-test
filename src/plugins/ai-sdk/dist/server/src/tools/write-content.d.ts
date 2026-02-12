import type { Core } from '@strapi/strapi';
export declare function createWriteContentTool(strapi: Core.Strapi): import("ai").Tool<{
    contentType: string;
    action: "create" | "update";
    data: Record<string, unknown>;
    documentId?: string;
    status?: "draft" | "published";
}, {
    error: string;
    action?: undefined;
    document?: undefined;
} | {
    action: string;
    document: import("@strapi/types/dist/modules/documents").AnyDocument;
    error?: undefined;
}>;
