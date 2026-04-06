import Groq from 'groq-sdk';
import { BaseProvider } from './base-provider.js';

export class GroqProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.model = config.model || 'llama-3.3-70b-versatile';
    this.abortControllers = new Map();
    this.conversations = new Map();
  }

  get name() { return 'groq'; }

  abort(chatId) {
    const controller = this.abortControllers.get(chatId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(chatId);
      return true;
    }
    return false;
  }

  async fetchComposioTools(mcpServers) {
    try {
      if (!mcpServers?.composio?.url) return [];
      const mcpUrl = mcpServers.composio.url;
      const mcpHeaders = mcpServers.composio.headers || {};

      console.log('[Groq] Fetching tools from Composio...');
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...mcpHeaders
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
      });

      const text = await response.text();
      // Parse SSE format: "event: message\ndata: {...}"
      const dataLine = text.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) return [];

      const data = JSON.parse(dataLine.replace('data: ', ''));
      const tools = data.result?.tools || [];
      console.log('[Groq] Fetched', tools.length, 'tools');

      return tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: (tool.description || '').slice(0, 100),
          parameters: tool.inputSchema || { type: 'object', properties: {} }
        }
      }));
    } catch (error) {
      console.error('[Groq] Error fetching tools:', error.message);
      return [];
    }
  }

  async executeTool(toolName, toolArgs, mcpServers) {
    try {
      const mcpUrl = mcpServers.composio.url;
      const mcpHeaders = mcpServers.composio.headers || {};

      console.log('[Groq] Executing tool:', toolName);
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...mcpHeaders
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: toolName, arguments: toolArgs }
        })
      });

      const text = await response.text();
      const dataLine = text.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) return 'No result returned';

      const data = JSON.parse(dataLine.replace('data: ', ''));
      const result = data.result?.content?.[0]?.text || JSON.stringify(data.result);
      console.log('[Groq] Tool result preview:', result?.slice(0, 100));
      return result;
    } catch (error) {
      console.error('[Groq] Tool error:', error.message);
      return `Error: ${error.message}`;
    }
  }

  async *query(params) {
    const { prompt, chatId, mcpServers = {}, model } = params;
    const useModel = model || this.model;

    if (!this.conversations.has(chatId)) this.conversations.set(chatId, []);
    const history = this.conversations.get(chatId);
    history.push({ role: 'user', content: prompt });

    const abortController = new AbortController();
    if (chatId) this.abortControllers.set(chatId, abortController);

    try {
      const tools = await this.fetchComposioTools(mcpServers);

      const messages = [
        {
          role: 'system',
          content: `You are a helpful AI assistant with access to real tools via Composio.
You can access Gmail, GitHub, Slack, Notion, Google Drive and 500+ other apps.
When asked to do something that requires these tools, USE THEM directly.
Never make up fake data — always use the tools to get real information. For Gmail, use GMAIL_FETCH_EMAILS to get emails. Use COMPOSIO_SEARCH_TOOLS first to find the right tool name before executing.
Be concise and helpful. IMPORTANT: When Composio search results suggest a tool name like GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER, always use that EXACT full name — never shorten it.`
        },
        ...history
      ];

      let fullResponse = '';
      let continueLoop = true;
      let maxLoops = 5;

      while (continueLoop && maxLoops > 0) {
        maxLoops--;
        if (abortController.signal.aborted) {
          yield { type: 'aborted', provider: this.name };
          return;
        }

        const requestParams = {
          model: useModel,
          messages,
          max_tokens: 4096,
          stream: false,
          ...(tools.length > 0 && { tools, tool_choice: 'auto' })
        };

        const response = await this.client.chat.completions.create(requestParams);
        const message = response.choices[0].message;

        if (message.tool_calls && message.tool_calls.length > 0) {
          messages.push(message);

          for (const toolCall of message.tool_calls) {
            yield {
              type: 'tool_use',
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments || '{}'),
              id: toolCall.id,
              provider: this.name
            };

            const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
            const toolResult = await this.executeTool(toolCall.function.name, toolArgs, mcpServers);

            yield {
              type: 'tool_result',
              result: toolResult,
              tool_use_id: toolCall.id,
              provider: this.name
            };

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: String(toolResult)
            });
          }
        } else {
          const content = message.content || '';
          if (content) {
            fullResponse += content;
            const words = content.split(' ');
            for (const word of words) {
              if (abortController.signal.aborted) break;
              yield { type: 'text', content: word + ' ', provider: this.name };
              await new Promise(r => setTimeout(r, 8));
            }
          }
          continueLoop = false;
        }
      }

      if (fullResponse) history.push({ role: 'assistant', content: fullResponse });
      yield { type: 'done', provider: this.name };
      console.log('[Groq] Completed');

    } catch (error) {
      if (error.name === 'AbortError') {
        yield { type: 'aborted', provider: this.name };
      } else {
        console.error('[Groq] Error:', error.message);
        throw error;
      }
    } finally {
      if (chatId) this.abortControllers.delete(chatId);
    }
  }

  async cleanup() {
    this.conversations.clear();
    await super.cleanup();
  }
}
