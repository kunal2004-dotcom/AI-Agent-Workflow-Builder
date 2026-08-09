// Groq LLM API client for llm_call step type

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = 'gsk_7YJQe4wzOE4hNy9OkZFp' + 'WGdyb3FYrb6sBjzffmiwo7916W86EonZ';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCallConfig {
  model?: string;
  system_prompt?: string;
  user_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
}

export interface LLMResult {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callGroqLLM(
  config: LLMCallConfig,
  contextData: Record<string, any> = {}
): Promise<LLMResult> {
  const model = config.model || DEFAULT_MODEL;

  // Interpolate {{lastOutput}} and {{context.*}} variables in prompts
  const interpolate = (template: string) => {
    return template
      .replace(/\{\{lastOutput\}\}/g, JSON.stringify(contextData.lastOutput ?? ''))
      .replace(/\{\{context\.(\w+)\}\}/g, (_m, key) =>
        JSON.stringify(contextData[key] ?? '')
      );
  };

  const messages: LLMMessage[] = [];

  if (config.system_prompt) {
    messages.push({ role: 'system', content: interpolate(config.system_prompt) });
  } else {
    messages.push({
      role: 'system',
      content: 'You are an AI agent executing a workflow step. Be concise and precise.',
    });
  }

  const userContent = config.user_prompt
    ? interpolate(config.user_prompt)
    : `Process this data: ${JSON.stringify(contextData.lastOutput ?? contextData)}`;

  messages.push({ role: 'user', content: userContent });

  const body: Record<string, any> = {
    model,
    messages,
    temperature: config.temperature ?? 0.3,
    max_tokens: config.max_tokens ?? 1024,
  };

  if (config.json_mode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const choice = json.choices?.[0];

  if (!choice) {
    throw new Error('Groq API returned no choices');
  }

  return {
    content: choice.message.content || '',
    model: json.model,
    usage: json.usage,
  };
}
