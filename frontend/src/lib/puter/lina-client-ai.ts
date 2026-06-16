'use client';

type PuterChatOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

type PuterQuickAssistTask = 'autocomplete' | 'draft_description' | 'text_cleanup' | 'form_suggestion';

type PuterQuickAssistInput = {
  task: PuterQuickAssistTask;
  prompt: string;
  context?: Record<string, unknown>;
  options?: PuterChatOptions;
};

type PuterChatResponse = string | { text?: string; message?: { content?: string } };

declare global {
  interface Window {
    puter?: {
      ai?: {
        chat: (prompt: string, options?: PuterChatOptions) => Promise<PuterChatResponse>;
      };
    };
  }
}

const PUTER_SCRIPT_URL = 'https://js.puter.com/v2/';
let puterLoadPromise: Promise<void> | null = null;

export function loadPuterJs(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Puter.js is available only in the browser'));
  }
  if (window.puter?.ai?.chat) return Promise.resolve();
  if (puterLoadPromise) return puterLoadPromise;

  puterLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PUTER_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Puter.js')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = PUTER_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Puter.js'));
    document.head.appendChild(script);
  });

  return puterLoadPromise;
}

function normalizePuterResponse(response: PuterChatResponse): string {
  if (typeof response === 'string') return response.trim();
  return `${response?.text || response?.message?.content || ''}`.trim();
}

function taskInstruction(task: PuterQuickAssistTask): string {
  switch (task) {
    case 'autocomplete':
      return 'Complete the field text concisely. Return only the suggested completion.';
    case 'draft_description':
      return 'Draft clean operational wording. Return only the draft text.';
    case 'text_cleanup':
      return 'Clean grammar and clarity without changing business meaning. Return only the cleaned text.';
    case 'form_suggestion':
      return 'Suggest short form text using the provided context. Return only the suggested field value.';
    default:
      return 'Return concise helper text only.';
  }
}

export async function runPuterQuickAssist(input: PuterQuickAssistInput): Promise<string> {
  await loadPuterJs();
  const puterChat = window.puter?.ai?.chat;
  if (!puterChat) throw new Error('Puter.js AI chat is not available');

  const context = input.context ? `\nContext JSON:\n${JSON.stringify(input.context, null, 2)}` : '';
  const prompt = [
    'You are Lina client-side quick assist for FamousGate Hotels.',
    'You are not the ERP source of truth and must not approve payments, audit findings, inventory movement, or database changes.',
    taskInstruction(input.task),
    `User text:\n${input.prompt}${context}`,
  ].join('\n\n');

  const response = await puterChat(prompt, {
    temperature: input.options?.temperature ?? 0.2,
    max_tokens: input.options?.max_tokens ?? 220,
    ...(input.options?.model ? { model: input.options.model } : {}),
  });

  return normalizePuterResponse(response);
}
