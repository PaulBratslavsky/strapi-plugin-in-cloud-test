/**
 * Tests for AI SDK plugin MCP endpoint
 *
 * Run with: npx ts-node tests/mcp.test.ts
 *
 * Make sure:
 * 1. Strapi is running (yarn dev)
 * 2. The MCP endpoints are enabled in Users & Permissions (Public role)
 * 3. STRAPI_API_TOKEN is set (or pass a valid Strapi API token)
 */

const BASE_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const MCP_ENDPOINT = `${BASE_URL}/api/ai-sdk/mcp`;
const API_TOKEN = process.env.STRAPI_API_TOKEN || '';

if (!API_TOKEN) {
  console.log('\n❌ STRAPI_API_TOKEN environment variable is required');
  console.log('Set it in your environment or server/.env');
  process.exit(1);
}

const authHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'text/event-stream, application/json',
  Authorization: `Bearer ${API_TOKEN}`,
};

async function jsonRpc(method: string, params: Record<string, any> = {}, sessionId?: string) {
  const reqHeaders = { ...authHeaders };
  if (sessionId) {
    reqHeaders['mcp-session-id'] = sessionId;
  }

  return fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
}

/**
 * Parse a Streamable HTTP response that may return SSE events.
 * The MCP SDK uses SSE for the response stream.
 */
async function parseResponse(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';

  // Direct JSON response
  if (contentType.includes('application/json')) {
    return res.json();
  }

  // SSE response — collect all event data and find the JSON-RPC result
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    const lines = text.split('\n');
    const results: any[] = [];

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          results.push(parsed);
        } catch {
          // skip non-JSON data lines
        }
      }
    }

    // Return the JSON-RPC response (has "result" or "error" key)
    const rpcResponse = results.find((r) => r.jsonrpc === '2.0');
    if (rpcResponse) return rpcResponse;

    return results.length === 1 ? results[0] : results;
  }

  const text = await res.text();
  throw new Error(`Unexpected content-type "${contentType}": ${text}`);
}

/**
 * Create an MCP session (initialize + send initialized notification).
 * Returns the session ID.
 */
async function createSession(): Promise<string> {
  const initRes = await jsonRpc('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });

  const sessionId = initRes.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('No session ID returned');

  await parseResponse(initRes);

  // Send initialized notification (required by MCP protocol)
  await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: { ...authHeaders, 'mcp-session-id': sessionId },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  return sessionId;
}

async function cleanupSession(sessionId: string): Promise<void> {
  await fetch(MCP_ENDPOINT, {
    method: 'DELETE',
    headers: { ...authHeaders, 'mcp-session-id': sessionId },
  });
}

async function testInitializeAndListTools(): Promise<void> {
  console.log('\n--- Testing MCP Initialize + List Tools ---\n');

  // Test 1: Initialize session
  console.log('Test 1: Initialize MCP session');
  try {
    const initRes = await jsonRpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });

    if (initRes.status !== 200) {
      console.log('❌ Failed: expected 200, got', initRes.status);
      return;
    }

    const sessionId = initRes.headers.get('mcp-session-id');
    if (!sessionId) {
      console.log('❌ Failed: no session ID returned');
      return;
    }
    console.log('✅ Session created:', sessionId);

    const initData = await parseResponse(initRes);
    if (initData.result?.serverInfo?.name === 'ai-sdk-mcp') {
      console.log('✅ Server name: ai-sdk-mcp');
    } else {
      console.log('❌ Unexpected server name:', initData.result?.serverInfo?.name);
    }

    if (initData.result?.capabilities?.tools) {
      console.log('✅ Server declares tools capability');
    } else {
      console.log('❌ Server missing tools capability');
    }

    // Send initialized notification
    await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: { ...authHeaders, 'mcp-session-id': sessionId },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    // Test 2: List tools
    console.log('\nTest 2: List available tools');
    const toolsRes = await jsonRpc('tools/list', {}, sessionId);

    if (toolsRes.status !== 200) {
      console.log('❌ Failed: expected 200, got', toolsRes.status);
      await cleanupSession(sessionId);
      return;
    }

    const toolsData = await parseResponse(toolsRes);
    const tools: any[] = toolsData.result?.tools || [];

    console.log(`✅ Found ${tools.length} tools:`);
    for (const t of tools) {
      console.log(`   - ${t.name}: ${t.description?.slice(0, 60)}...`);
    }

    const toolNames = tools.map((t: any) => t.name);

    if (tools.length === 3) {
      console.log('✅ Correct tool count (3)');
    } else {
      console.log(`❌ Expected 3 tools, got ${tools.length}`);
    }

    if (toolNames.includes('list_content_types')) {
      console.log('✅ Has list_content_types');
    } else {
      console.log('❌ Missing list_content_types');
    }

    if (toolNames.includes('search_content')) {
      console.log('✅ Has search_content');
    } else {
      console.log('❌ Missing search_content');
    }

    if (toolNames.includes('write_content')) {
      console.log('✅ Has write_content');
    } else {
      console.log('❌ Missing write_content');
    }

    if (!toolNames.includes('trigger_animation')) {
      console.log('✅ trigger_animation correctly excluded');
    } else {
      console.log('❌ trigger_animation should NOT be exposed via MCP');
    }

    await cleanupSession(sessionId);
  } catch (error) {
    console.log('❌ Error:', error);
  }
}

async function testCallListContentTypes(): Promise<void> {
  console.log('\n--- Testing MCP tool call: list_content_types ---\n');

  console.log('Test 1: Call list_content_types');
  try {
    const sessionId = await createSession();

    const callRes = await jsonRpc('tools/call', {
      name: 'list_content_types',
      arguments: {},
    }, sessionId);

    if (callRes.status !== 200) {
      console.log('❌ Failed: expected 200, got', callRes.status);
      await cleanupSession(sessionId);
      return;
    }

    const callData = await parseResponse(callRes);
    const content = callData.result?.content;

    if (!Array.isArray(content)) {
      console.log('❌ Result missing content array');
      await cleanupSession(sessionId);
      return;
    }
    console.log('✅ Result has content array');

    if (content[0]?.type === 'text') {
      console.log('✅ Content is text type');
    } else {
      console.log('❌ Expected text type, got:', content[0]?.type);
    }

    const parsed = JSON.parse(content[0].text);

    if (Array.isArray(parsed.contentTypes)) {
      console.log(`✅ Found ${parsed.contentTypes.length} content types`);
      for (const ct of parsed.contentTypes.slice(0, 5)) {
        console.log(`   - ${ct.uid} (${ct.displayName})`);
      }
      if (parsed.contentTypes.length > 5) {
        console.log(`   ... and ${parsed.contentTypes.length - 5} more`);
      }
    } else {
      console.log('❌ Missing contentTypes array');
    }

    if (Array.isArray(parsed.components)) {
      console.log(`✅ Found ${parsed.components.length} components`);
    } else {
      console.log('❌ Missing components array');
    }

    await cleanupSession(sessionId);
  } catch (error) {
    console.log('❌ Error:', error);
  }
}

async function runTests(): Promise<void> {
  console.log('='.repeat(50));
  console.log('AI SDK Plugin MCP Endpoint Tests');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`MCP Endpoint: ${MCP_ENDPOINT}`);
  console.log('='.repeat(50));

  // Check if server is running
  try {
    const health = await fetch(`${BASE_URL}/_health`);
    if (!health.ok) {
      console.log('\n❌ Strapi server is not running or not healthy');
      console.log('Please start Strapi with: yarn dev');
      process.exit(1);
    }
    console.log('\n✅ Strapi server is running');
  } catch {
    console.log('\n❌ Cannot connect to Strapi server at', BASE_URL);
    console.log('Please start Strapi with: yarn dev');
    process.exit(1);
  }

  await testInitializeAndListTools();
  await testCallListContentTypes();

  console.log('\n' + '='.repeat(50));
  console.log('MCP Tests completed');
  console.log('='.repeat(50) + '\n');
}

runTests();
