/**
 * Test chat endpoint with UI message stream protocol
 * Run with: node tests/test-chat.mjs
 */

const BASE_URL = process.env.STRAPI_URL || 'http://localhost:1337';

async function testChat() {
  console.log('Testing chat endpoint with UI message stream...\n');

  const messages = [
    { role: 'user', content: 'Hello! Can you tell me a short joke?' }
  ];

  console.log('Messages:', JSON.stringify(messages, null, 2));
  console.log('\n--- Stream output ---\n');

  const startTime = Date.now();
  let firstChunkTime = null;

  const response = await fetch(`${BASE_URL}/api/ai-sdk/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    console.error('Error:', response.status, await response.text());
    process.exit(1);
  }

  // Check for UI message stream header
  const streamHeader = response.headers.get('x-vercel-ai-ui-message-stream');
  console.log(`Stream protocol: ${streamHeader || 'not set'}\n`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (firstChunkTime === null) {
      firstChunkTime = Date.now();
    }

    const chunk = decoder.decode(value, { stream: true });

    // Parse the UI message stream format
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // UI message stream uses format: type:data
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const type = line.substring(0, colonIndex);
      const data = line.substring(colonIndex + 1);

      // Handle different message types
      switch (type) {
        case 'g': // text delta
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              process.stdout.write(parsed.text);
              fullText += parsed.text;
            }
          } catch {
            // Raw text
            process.stdout.write(data);
            fullText += data;
          }
          break;
        case 'e': // error
          console.error('\nError:', data);
          break;
        case 'd': // done
          // Stream finished
          break;
        default:
          // Other message types (a, b, c, f, etc.)
          // You can log these for debugging:
          // console.log(`[${type}]: ${data}`);
          break;
      }
    }
  }

  const endTime = Date.now();

  console.log('\n\n--- Stream Statistics ---');
  console.log(`Time to first chunk: ${firstChunkTime ? firstChunkTime - startTime : 'N/A'}ms`);
  console.log(`Total time: ${endTime - startTime}ms`);
  console.log(`Response length: ${fullText.length} characters`);
  console.log('--- Stream complete ---\n');
}

// Test with conversation history
async function testChatConversation() {
  console.log('\n=== Testing with conversation history ===\n');

  const messages = [
    { role: 'user', content: 'My name is Alice.' },
    { role: 'assistant', content: 'Nice to meet you, Alice! How can I help you today?' },
    { role: 'user', content: 'What is my name?' }
  ];

  console.log('Messages:', JSON.stringify(messages, null, 2));
  console.log('\n--- Stream output ---\n');

  const response = await fetch(`${BASE_URL}/api/ai-sdk/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      system: 'You are a helpful assistant. Be concise.'
    }),
  });

  if (!response.ok) {
    console.error('Error:', response.status, await response.text());
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const type = line.substring(0, colonIndex);
      const data = line.substring(colonIndex + 1);

      if (type === 'g') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            process.stdout.write(parsed.text);
          }
        } catch {
          process.stdout.write(data);
        }
      }
    }
  }

  console.log('\n\n--- Complete ---\n');
}

async function run() {
  await testChat();
  await testChatConversation();
}

run().catch(console.error);
