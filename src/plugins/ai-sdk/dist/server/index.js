"use strict";
const anthropic = require("@ai-sdk/anthropic");
const ai = require("ai");
const node_stream = require("node:stream");
const zod = require("zod");
const bootstrap = ({ strapi }) => {
};
const destroy = ({ strapi }) => {
};
const CHAT_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307"
];
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_TEMPERATURE = 0.7;
function isPromptInput(input) {
  return "prompt" in input;
}
class AISDKManager {
  constructor() {
    this.provider = null;
    this.model = DEFAULT_MODEL;
  }
  /**
   * Initialize the manager with plugin configuration
   * Returns false if config is missing required fields
   */
  initialize(config2) {
    const cfg = config2;
    if (!cfg?.anthropicApiKey) {
      return false;
    }
    this.provider = anthropic.createAnthropic({
      apiKey: cfg.anthropicApiKey,
      baseURL: cfg.baseURL
    });
    if (cfg.chatModel && CHAT_MODELS.includes(cfg.chatModel)) {
      this.model = cfg.chatModel;
    }
    return true;
  }
  getLanguageModel() {
    if (!this.provider) {
      throw new Error("AI SDK Manager not initialized");
    }
    return this.provider(this.model);
  }
  buildParams(input) {
    const base = {
      model: this.getLanguageModel(),
      system: input.system,
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: input.maxOutputTokens,
      tools: input.tools,
      stopWhen: input.stopWhen
    };
    return isPromptInput(input) ? { ...base, prompt: input.prompt } : { ...base, messages: input.messages };
  }
  async generate(input) {
    const result = await ai.generateText(this.buildParams(input));
    return { text: result.text };
  }
  async stream(input) {
    const result = ai.streamText(this.buildParams(input));
    return { textStream: result.textStream };
  }
  /**
   * Returns the raw streamText result for use with toUIMessageStreamResponse()
   * Compatible with AI SDK UI hooks (useChat, useCompletion)
   */
  streamRaw(input) {
    return ai.streamText(this.buildParams(input));
  }
  // Convenience methods for simple prompt-based calls
  async generateText(prompt, options) {
    return this.generate({ prompt, ...options });
  }
  async streamText(prompt, options) {
    return this.stream({ prompt, ...options });
  }
  getChatModel() {
    return this.model;
  }
  isInitialized() {
    return this.provider !== null;
  }
  destroy() {
    this.provider = null;
  }
}
const aiSDKManager = new AISDKManager();
const register = ({ strapi }) => {
  const config2 = strapi.config.get("plugin::ai-sdk");
  const initialized = aiSDKManager.initialize(config2);
  if (!initialized) {
    strapi.log.warn("AI SDK plugin: anthropicApiKey not configured, plugin will not be initialized");
    return;
  }
  strapi.log.info(`AI SDK plugin initialized with model: ${aiSDKManager.getChatModel()}`);
};
const config = {
  default: {
    anthropicApiKey: "",
    chatModel: "claude-sonnet-4-20250514",
    baseURL: void 0,
    systemPrompt: ""
  },
  validator(config2) {
    if (typeof config2 !== "object" || config2 === null) {
      throw new Error("Config must be an object");
    }
  }
};
const contentTypes = {};
function getService(strapi, ctx) {
  const service2 = strapi.plugin("ai-sdk").service("service");
  if (!service2.isInitialized()) {
    ctx.badRequest("AI SDK not initialized. Check plugin configuration.");
    return null;
  }
  return service2;
}
function validateBody(ctx) {
  const { prompt, system } = ctx.request.body;
  if (!prompt || typeof prompt !== "string") {
    ctx.badRequest("prompt is required and must be a string");
    return null;
  }
  return { prompt, system };
}
function validateChatBody(ctx) {
  const { messages, system } = ctx.request.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    ctx.badRequest("messages is required and must be a non-empty array");
    return null;
  }
  return { messages, system };
}
function createSSEStream(ctx) {
  ctx.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  const stream = new node_stream.PassThrough();
  ctx.body = stream;
  ctx.res.flushHeaders();
  return stream;
}
function writeSSE(stream, data) {
  stream.write(`data: ${JSON.stringify(data)}

`);
}
const controller = ({ strapi }) => ({
  async ask(ctx) {
    const body = validateBody(ctx);
    if (!body) return;
    const service2 = getService(strapi, ctx);
    if (!service2) return;
    const result = await service2.ask(body.prompt, { system: body.system });
    ctx.body = { data: { text: result } };
  },
  async askStream(ctx) {
    const body = validateBody(ctx);
    if (!body) return;
    const service2 = getService(strapi, ctx);
    if (!service2) return;
    const textStream = await service2.askStream(body.prompt, { system: body.system });
    const stream = createSSEStream(ctx);
    void (async () => {
      try {
        for await (const chunk of textStream) {
          writeSSE(stream, { text: chunk });
        }
        stream.write("data: [DONE]\n\n");
      } catch (error) {
        strapi.log.error("AI SDK stream error:", error);
        writeSSE(stream, { error: "Stream error" });
      } finally {
        stream.end();
      }
    })();
  },
  /**
   * Chat endpoint using AI SDK UI message stream protocol
   * Compatible with useChat hook from @ai-sdk/react
   */
  async chat(ctx) {
    const body = validateChatBody(ctx);
    if (!body) return;
    const service2 = getService(strapi, ctx);
    if (!service2) return;
    const config2 = strapi.config.get("plugin::ai-sdk");
    const system = body.system || config2.systemPrompt || void 0;
    const result = await service2.chat(body.messages, { system });
    const response = result.toUIMessageStreamResponse();
    ctx.status = 200;
    ctx.set("Content-Type", "text/event-stream; charset=utf-8");
    ctx.set("Cache-Control", "no-cache, no-transform");
    ctx.set("Connection", "keep-alive");
    ctx.set("X-Accel-Buffering", "no");
    ctx.set("x-vercel-ai-ui-message-stream", "v1");
    ctx.body = node_stream.Readable.fromWeb(response.body);
  }
});
const controllers = {
  controller
};
const middlewares = {};
const policies = {};
const contentAPIRoutes = {
  type: "content-api",
  routes: [
    {
      method: "POST",
      path: "/ask",
      handler: "controller.ask",
      config: {
        policies: []
      }
    },
    {
      method: "POST",
      path: "/ask-stream",
      handler: "controller.askStream",
      config: {
        policies: []
      }
    },
    {
      method: "POST",
      path: "/chat",
      handler: "controller.chat",
      config: {
        policies: []
      }
    }
  ]
};
const adminAPIRoutes = {
  type: "admin",
  routes: [
    {
      method: "POST",
      path: "/chat",
      handler: "controller.chat",
      config: {
        policies: []
      }
    }
  ]
};
const routes = {
  "content-api": contentAPIRoutes,
  admin: adminAPIRoutes
};
const INTERNAL_FIELDS = [
  "createdAt",
  "updatedAt",
  "publishedAt",
  "createdBy",
  "updatedBy",
  "locale",
  "localizations"
];
function createListContentTypesTool(strapi) {
  return ai.tool({
    description: "List all Strapi content types and components with their fields, relations, and structure.",
    inputSchema: ai.zodSchema(zod.z.object({})),
    execute: async () => {
      const contentTypes2 = strapi.contentTypes;
      const components = strapi.components;
      const apiContentTypes = [];
      for (const [uid, contentType] of Object.entries(contentTypes2)) {
        if (uid.startsWith("admin::") || uid.startsWith("strapi::")) continue;
        const ct = contentType;
        const kind = ct.kind || "collectionType";
        const fields = [];
        const relations = [];
        const usedComponents = [];
        for (const [attrName, attrDef] of Object.entries(ct.attributes || {})) {
          if (INTERNAL_FIELDS.includes(attrName)) continue;
          const attr = attrDef;
          fields.push(attrName);
          if (attr.type === "relation" && attr.target) {
            const targetCt = contentTypes2[attr.target];
            relations.push({
              field: attrName,
              type: attr.relation,
              target: attr.target,
              targetDisplayName: targetCt?.info?.displayName || attr.target
            });
          }
          if (attr.type === "component" && attr.component) {
            if (!usedComponents.includes(attr.component)) {
              usedComponents.push(attr.component);
            }
          }
          if (attr.type === "dynamiczone") {
            for (const comp of attr.components || []) {
              if (!usedComponents.includes(comp)) {
                usedComponents.push(comp);
              }
            }
          }
        }
        apiContentTypes.push({
          uid,
          kind,
          displayName: ct.info?.displayName || uid,
          fields,
          relations,
          components: usedComponents
        });
      }
      apiContentTypes.sort((a, b) => a.displayName.localeCompare(b.displayName));
      const componentSummaries = [];
      for (const [uid, component] of Object.entries(components)) {
        const comp = component;
        componentSummaries.push({
          uid,
          category: comp.category || "default",
          displayName: comp.info?.displayName || uid,
          fieldCount: Object.keys(comp.attributes || {}).length
        });
      }
      componentSummaries.sort((a, b) => {
        const cat = a.category.localeCompare(b.category);
        return cat !== 0 ? cat : a.displayName.localeCompare(b.displayName);
      });
      return {
        contentTypes: apiContentTypes,
        components: componentSummaries
      };
    }
  });
}
const MAX_PAGE_SIZE = 50;
function createSearchContentTool(strapi) {
  return ai.tool({
    description: "Search and query any Strapi content type. Use listContentTypes first to discover available content types and their fields, then use this tool to query specific collections.",
    inputSchema: ai.zodSchema(
      zod.z.object({
        contentType: zod.z.string().describe(
          'The content type UID to search, e.g. "api::article.article" or "plugin::users-permissions.user"'
        ),
        query: zod.z.string().optional().describe("Full-text search query string (searches across all searchable text fields)"),
        filters: zod.z.record(zod.z.string(), zod.z.unknown()).optional().describe(
          'Strapi filter object, e.g. { username: { $containsi: "john" } }'
        ),
        fields: zod.z.array(zod.z.string()).optional().describe("Specific fields to return. If omitted, returns all fields."),
        sort: zod.z.string().optional().describe('Sort order, e.g. "createdAt:desc"'),
        page: zod.z.number().optional().default(1).describe("Page number (starts at 1)"),
        pageSize: zod.z.number().optional().default(10).describe("Results per page (max 50)")
      })
    ),
    execute: async ({ contentType, query, filters, fields, sort, page, pageSize }) => {
      if (!strapi.contentTypes[contentType]) {
        return { error: `Content type "${contentType}" does not exist.` };
      }
      const clampedPageSize = Math.min(pageSize ?? 10, MAX_PAGE_SIZE);
      const results = await strapi.documents(contentType).findMany({
        ...query ? { _q: query } : {},
        ...filters ? { filters } : {},
        ...fields ? { fields } : {},
        ...sort ? { sort } : {},
        page,
        pageSize: clampedPageSize,
        populate: "*"
      });
      const total = await strapi.documents(contentType).count({
        ...query ? { _q: query } : {},
        ...filters ? { filters } : {}
      });
      return {
        results,
        pagination: {
          page: page ?? 1,
          pageSize: clampedPageSize,
          total
        }
      };
    }
  });
}
function createWriteContentTool(strapi) {
  return ai.tool({
    description: "Create or update a document in any Strapi content type. Use listContentTypes first to discover the schema, and searchContent to find existing documents for updates.",
    inputSchema: ai.zodSchema(
      zod.z.object({
        contentType: zod.z.string().describe('Content type UID, e.g. "api::article.article"'),
        action: zod.z.enum(["create", "update"]).describe("Whether to create a new document or update an existing one"),
        documentId: zod.z.string().optional().describe("Required for update — the document ID to update"),
        data: zod.z.record(zod.z.string(), zod.z.unknown()).describe("The field values to set. Must match the content type schema."),
        status: zod.z.enum(["draft", "published"]).optional().describe("Document status. Defaults to draft.")
      })
    ),
    execute: async ({ contentType, action, documentId, data, status }) => {
      if (!strapi.contentTypes[contentType]) {
        return { error: `Content type "${contentType}" does not exist.` };
      }
      if (action === "update" && !documentId) {
        return { error: "documentId is required for update actions." };
      }
      const docs = strapi.documents(contentType);
      if (action === "create") {
        const document2 = await docs.create({
          data,
          ...status ? { status } : {},
          populate: "*"
        });
        return { action: "create", document: document2 };
      }
      const document = await docs.update({
        documentId,
        data,
        ...status ? { status } : {},
        populate: "*"
      });
      return { action: "update", document };
    }
  });
}
function createTools(strapi) {
  return {
    listContentTypes: createListContentTypesTool(strapi),
    searchContent: createSearchContentTool(strapi),
    writeContent: createWriteContentTool(strapi)
  };
}
function describeTools(tools) {
  const lines = Object.entries(tools).map(
    ([name, t]) => `- ${name}: ${t.description ?? "No description"}`
  );
  return `You are a Strapi CMS assistant. You have these tools:
${lines.join("\n")}

Use them to fulfill user requests. When asked to create or update content, use the appropriate tool — do not tell the user you cannot.`;
}
const service = ({ strapi }) => ({
  async ask(prompt, options) {
    const result = await aiSDKManager.generateText(prompt, {
      system: options?.system
    });
    return result.text;
  },
  async askStream(prompt, options) {
    const result = await aiSDKManager.streamText(prompt, {
      system: options?.system
    });
    return result.textStream;
  },
  /**
   * Chat with messages - returns raw stream for UI message stream response
   * Compatible with AI SDK UI hooks (useChat)
   */
  async chat(messages, options) {
    const modelMessages = await ai.convertToModelMessages(messages);
    const tools = createTools(strapi);
    const toolsPrompt = describeTools(tools);
    const system = options?.system ? `${options.system}

${toolsPrompt}` : toolsPrompt;
    return aiSDKManager.streamRaw({
      messages: modelMessages,
      system,
      tools,
      stopWhen: ai.stepCountIs(5)
    });
  },
  isInitialized() {
    return aiSDKManager.isInitialized();
  }
});
const services = {
  service
};
const index = {
  register,
  bootstrap,
  destroy,
  config,
  controllers,
  routes,
  services,
  contentTypes,
  policies,
  middlewares
};
module.exports = index;
