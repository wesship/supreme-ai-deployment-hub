export const CHAT_CONNECT_TIMEOUT_MS = 20_000;
export const CHAT_STREAM_IDLE_TIMEOUT_MS = 30_000;

export class ChatTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatTimeoutError';
  }
}

export function createLinkedAbortController(
  upstream?: AbortSignal,
  timeoutMs = CHAT_CONNECT_TIMEOUT_MS,
): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();

  const forwardAbort = () => controller.abort(upstream?.reason);
  if (upstream?.aborted) {
    forwardAbort();
  } else {
    upstream?.addEventListener('abort', forwardAbort, { once: true });
  }

  const timeout = window.setTimeout(() => {
    controller.abort(new ChatTimeoutError('D3VONN chat connection timed out. Please try again.'));
  }, timeoutMs);

  return {
    controller,
    clear: () => {
      window.clearTimeout(timeout);
      upstream?.removeEventListener('abort', forwardAbort);
    },
  };
}

export async function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs = CHAT_STREAM_IDLE_TIMEOUT_MS,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timeout: number | undefined;

  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(
          () => reject(new ChatTimeoutError('D3VONN stopped receiving a response. Please retry.')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}
