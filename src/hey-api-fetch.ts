import type { CreateClientConfig } from "./services/APIClient/client.gen";

// define custom fetch to always include credentials and throw on error
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const res = await fetch(input, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Request failed: ${res.status} - ${msg}`);
    }

    return res;
  },
});
