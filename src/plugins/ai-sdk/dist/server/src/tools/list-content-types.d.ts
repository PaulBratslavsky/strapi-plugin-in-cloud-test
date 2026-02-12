import type { Core } from '@strapi/strapi';
export interface RelationSummary {
    field: string;
    type: string;
    target: string;
    targetDisplayName: string;
}
export interface ContentTypeSummary {
    uid: string;
    kind: 'collectionType' | 'singleType';
    displayName: string;
    fields: string[];
    relations: RelationSummary[];
    components: string[];
}
export interface ComponentSummary {
    uid: string;
    category: string;
    displayName: string;
    fieldCount: number;
}
export declare function createListContentTypesTool(strapi: Core.Strapi): import("ai").Tool<Record<string, never>, {
    contentTypes: ContentTypeSummary[];
    components: ComponentSummary[];
}>;
