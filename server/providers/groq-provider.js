import Groq from 'groq-sdk';
import { BaseProvider } from './base-provider.js';

export class GroqProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    this.model = config.model || 'llama-3.3-70b-versatile';
    this.abortControllers = new Map();
    // Store conversation history per chatId
    this.conversations = new Map();
  }

  get name() {
    return 'groq';
  }

  abort(chatId) {
    const controller = this.abortControllers.get(chatId);
    if (controller) {
      console.log('[Groq] Aborting query for chatId:', chatId);
      controller.abort();
      this.abortControllers.delete(chatId);
      return true;
    }
    return false;
  }

  async *query(params) {
    const {
      prompt,
      chatId,
      model
    } = params;

    const useModel = model || this.model;

    // Get or create conversation history
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, []);
    }
    const history = this.conversations.get(chatId);

    // Add user message to history
    history.push({
      role: 'user',
      content: prompt
    });

    console.log('[Groq] Calling Groq API with model:', useModel);
    console.log('[Groq] History length:', history.length);

    const abortController = new AbortController();
    if (chatId) {
      this.abortControllers.set(chatId, abortController);
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: useModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. You help users with coding, writing, research, and any other tasks they need. Be concise, accurate, and helpful.'
          },
          ...history
        ],
        stream: true,
        max_tokens: 4096
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          yield { type: 'aborted', provider: this.name };
          return;
        }

        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          yield {
            type: 'text',
            content: content,
            provider: this.name
          };
        }
      }

      // Save assistant response to history
      if (fullResponse) {
        history.push({
          role: 'assistant',
          content: fullResponse
        });
      }

      yield { type: 'done', provider: this.name };
      console.log('[Groq] Stream completed');

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[Groq] Query aborted for chatId:', chatId);
        yield { type: 'aborted', provider: this.name };
      } else {
        console.error('[Groq] Error:', error.message);
        throw error;
      }
    } finally {
      if (chatId) {
        this.abortControllers.delete(chatId);
      }
    }
  }

  async cleanup() {
    this.conversations.clear();
    await super.cleanup();
  }
}
