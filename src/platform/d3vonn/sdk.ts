import type { DomainEvent } from "./contracts";

export type D3vonnClientOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

export class D3vonnClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: D3vonnClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async publishEvent<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const response = await this.fetchImpl(`${this.options.baseUrl}/api/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.token
          ? { authorization: `Bearer ${this.options.token}` }
          : {}),
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`D3VONN event publication failed: ${response.status}`);
    }
  }
}
