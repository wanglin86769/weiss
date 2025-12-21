export const OAuthProviders = {
  MICROSOFT: "microsoft",
  DEMO: "demo",
} as const;

export type OAuthProvider = (typeof OAuthProviders)[keyof typeof OAuthProviders];

export const Roles = {
  ADMIN: "admin",
  USER: "user",
} as const;

export type Roles = (typeof Roles)[keyof typeof Roles];

export interface User {
  id: string;
  username: string;
  email?: string;
  provider: OAuthProvider;
  avatar_url?: string;
  role: Roles;
}

interface TokenResponse {
  access_token: string;
  user: User;
}

interface OAuthCallbackPayload {
  provider: OAuthProvider;
  code: string;
  redirect_uri: string;
}

const API_URL = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:8000/api/v1";

class AuthService {
  private tokenKey = "weiss_auth_token";
  private userKey = "weiss_user";

  private handleError(err: unknown, msg?: string) {
    const text = err instanceof Error ? err.message : String(err);
    window.alert(msg ? `${msg}: ${text}` : text);
  }

  private async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    try {
      const res = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Request failed: ${res.status} - ${msg}`);
      }

      return res.json() as Promise<T>;
    } catch (err: unknown) {
      this.handleError(err, "Error fetching data");
      throw err;
    }
  }

  async getAuthorizeUrl(provider: OAuthProvider, demoProfile?: Roles): Promise<string | null> {
    try {
      const params = new URLSearchParams();
      if (provider === OAuthProviders.DEMO && demoProfile) {
        params.append("demo_profile", demoProfile);
      }
      const url = `${API_URL}/auth/${provider}/authorize?${params.toString()}`;
      const data = await this.fetchJson<{ authorize_url: string }>(url, { method: "GET" });
      return data.authorize_url;
    } catch (err: unknown) {
      this.handleError(err, "Failed to get authorize URL");
      return null;
    }
  }

  async login(provider: OAuthProvider, demoProfile?: Roles) {
    try {
      const authorizeUrl = await this.getAuthorizeUrl(provider, demoProfile);
      if (!authorizeUrl) {
        throw new Error("No authorize URL returned");
      }
      window.location.href = authorizeUrl;
    } catch (err: unknown) {
      this.handleError(err, "Login failed");
    }
  }

  async handleCallback(provider: OAuthProvider, code: string, redirectUri: string) {
    try {
      const payload: OAuthCallbackPayload = { provider, code, redirect_uri: redirectUri };

      const data = await this.fetchJson<TokenResponse>(`${API_URL}/auth/callback`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const { access_token, user } = data;
      this.setSession(access_token, user);

      return user;
    } catch (err: unknown) {
      this.handleError(err, "Authentication callback failed");
      return null;
    }
  }

  setSession(token: string, user: User) {
    // TODO: implement proper session management with backend validation
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  logout() {
    // TODO: clean session on backend
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  getToken(): string | null {
    // temporary token fetch from localStorage
    // TODO: implement proper session management with backend validation
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): User | null {
    // temporary user fetch from localStorage
    // TODO: implement proper session management with backend validation
    const data = localStorage.getItem(this.userKey);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      if (
        typeof parsed.id === "string" &&
        typeof parsed.username === "string" &&
        typeof parsed.provider === "string" &&
        typeof parsed.role === "string"
      ) {
        return parsed as User;
      }
      return null;
    } catch (err: unknown) {
      this.handleError(err, "Failed to parse user data");
      return null;
    }
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }
}

export const authService = new AuthService();
