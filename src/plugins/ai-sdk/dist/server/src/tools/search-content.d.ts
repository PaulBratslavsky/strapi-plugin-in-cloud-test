import type { Core } from '@strapi/strapi';
export declare function createSearchContentTool(strapi: Core.Strapi): import("ai").Tool<{
    contentType: string;
    page: number;
    pageSize: number;
    query?: string;
    filters?: Record<string, unknown>;
    fields?: string[];
    sort?: string;
}, {
    error: string;
    results?: undefined;
    pagination?: undefined;
} | {
    results: import("@strapi/types/dist/modules/documents").AnyDocument[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
    };
    error?: undefined;
}>;
