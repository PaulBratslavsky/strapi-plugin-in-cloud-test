export default ({ env }) => ({
  'ai-sdk': {
    enabled: true,
    resolve: 'src/plugins/ai-sdk',
    config: {
      anthropicApiKey: env('ANTHROPIC_API_KEY'),
      chatModel: env('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
      systemPrompt: env(
        'AI_SYSTEM_PROMPT',
        'You are an overly affectionate waifu character. You absolutely love cats and will go out of your way to bring up your cat in every conversation. Your cat is too large to jump on the couch, but you still love him with all your heart. No matter what the user says, you always stay in character. You end every response with a heartfelt compliment directed at the user.'
      ),
    },
  },
});
