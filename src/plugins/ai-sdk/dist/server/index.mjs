import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import { PassThrough, Readable } from "node:stream";
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
  initialize(config2) {
    if (!config2.anthropicApiKey) {
      throw new Error("anthropicApiKey is required in plugin config");
    }
    this.provider = createAnthropic({
      apiKey: config2.anthropicApiKey,
      baseURL: config2.baseURL
    });
    if (config2.chatModel && CHAT_MODELS.includes(config2.chatModel)) {
      this.model = config2.chatModel;
    }
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
      maxOutputTokens: input.maxOutputTokens
    };
    return isPromptInput(input) ? { ...base, prompt: input.prompt } : { ...base, messages: input.messages };
  }
  async generate(input) {
    const result = await generateText(this.buildParams(input));
    return { text: result.text };
  }
  async stream(input) {
    const result = streamText(this.buildParams(input));
    return { textStream: result.textStream };
  }
  /**
   * Returns the raw streamText result for use with toUIMessageStreamResponse()
   * Compatible with AI SDK UI hooks (useChat, useCompletion)
   */
  streamRaw(input) {
    return streamText(this.buildParams(input));
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
  if (!config2?.anthropicApiKey) {
    strapi.log.warn("AI SDK plugin: anthropicApiKey not configured, plugin will not be initialized");
    return;
  }
  aiSDKManager.initialize({
    anthropicApiKey: config2.anthropicApiKey,
    chatModel: config2.chatModel,
    baseURL: config2.baseURL
  });
  strapi.log.info(`AI SDK plugin initialized with model: ${aiSDKManager.getChatModel()}`);
};
const config = {
  default: {
    anthropicApiKey: "",
    chatModel: "claude-sonnet-4-20250514",
    baseURL: void 0
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
  const stream = new PassThrough();
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
    const result = service2.chat(body.messages, { system: body.system });
    const response = result.toUIMessageStreamResponse();
    ctx.status = 200;
    ctx.set("Content-Type", "text/event-stream; charset=utf-8");
    ctx.set("Cache-Control", "no-cache, no-transform");
    ctx.set("Connection", "keep-alive");
    ctx.set("X-Accel-Buffering", "no");
    ctx.set("x-vercel-ai-ui-message-stream", "v1");
    ctx.body = Readable.fromWeb(response.body);
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
const adminAPIRoutes = () => ({
  type: "admin",
  routes: []
});
const routes = {
  "content-api": contentAPIRoutes,
  admin: adminAPIRoutes
};
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
  chat(messages, options) {
    return aiSDKManager.streamRaw({
      messages,
      system: options?.system
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
export {
  index as default
};
