import { API_URL } from "@src/constants/constants";
import { notifyUser } from "@src/services/Notifications/Notification";

export const OAuthProviders = {
  MICROSOFT: "microsoft",
  DEMO: "demo",
} as const;

export type OAuthProvider = (typeof OAuthProviders)[keyof typeof OAuthProviders];

export const Roles = {
  DEVELOPER: "developer",
  OPERATOR: "operator",
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

interface OAuthCallbackPayload {
  provider: OAuthProvider;
  code: string;
  redirect_uri: string;
}

export const AuthStatuses = {
  AUTHENTICATED: 1,
  UNAUTHENTICATED: 0,
} as const;

export type AuthStatus = (typeof AuthStatuses)[keyof typeof AuthStatuses];

export interface AuthCallbacks {
  onAuthStatusChange?: (status: AuthStatus, user: User | null) => void;
  onLogin?: (user: User) => void;
  onLogout?: () => void;
  onAuthError?: (error: unknown) => void;
}

class AuthService {
  private callbacks = new Set<AuthCallbacks>();
  private currentUser: User | null = null;
  // Deduplicate Promise for handling OAuth callback requests.
  private callbackPromise: Promise<User | null> | null = null;

  subscribe(callbacks: AuthCallbacks): () => void {
    this.callbacks.add(callbacks);
    return () => this.callbacks.delete(callbacks);
  }

  private notifyAuthStatus(status: AuthStatus, user: User | null) {
    for (const cb of this.callbacks) {
      cb.onAuthStatusChange?.(status, user);
    }
  }

  private notifyLogin(user: User) {
    for (const cb of this.callbacks) {
      cb.onLogin?.(user);
    }
  }

  private notifyLogout() {
    for (const cb of this.callbacks) {
      cb.onLogout?.();
    }
  }

  private notifyError(err: unknown) {
    for (const cb of this.callbacks) {
      cb.onAuthError?.(err);
    }
  }

  /**
   * Internal error handler for reporting.
   * UI feedback (alerts) is handled at the caller level if necessary.
   */
  private logAndNotifyError(err: unknown) {
    console.error("[AuthService]", err);
    this.notifyError(err);
  }

  private async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
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
      this.logAndNotifyError(err);
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
      this.logAndNotifyError(err);
      notifyUser("Login failed. Please, try again. If problem persists, contact support", "error");
    }
  }

  async handleCallback(
    provider: OAuthProvider,
    code: string,
    redirectUri: string
  ): Promise<User | null> {
    if (this.callbackPromise) {
      return this.callbackPromise;
    }

    this.callbackPromise = (async () => {
      try {
        const payload: OAuthCallbackPayload = {
          provider,
          code,
          redirect_uri: redirectUri,
        };

        const user = await this.fetchJson<User>(`${API_URL}/auth/callback`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        this.currentUser = user;
        this.notifyLogin(user);
        this.notifyAuthStatus(AuthStatuses.AUTHENTICATED, user);

        return user;
      } catch (err) {
        this.logAndNotifyError(err);
        notifyUser(
          "Authentication failed. Auth code might have expired or was already used.",
          "error"
        );
        return null;
      } finally {
        this.callbackPromise = null;
      }
    })();

    return this.callbackPromise;
  }

  /**
   * Restore session on app startup if applicable
   */
  async restoreSession(): Promise<User | null> {
    try {
      const user = await this.fetchJson<User>(`${API_URL}/auth/me`);

      this.currentUser = user;
      this.notifyAuthStatus(AuthStatuses.AUTHENTICATED, user);

      return user;
    } catch {
      this.currentUser = null;
      this.notifyAuthStatus(AuthStatuses.UNAUTHENTICATED, null);
      return null;
    }
  }

  async logout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      this.logAndNotifyError(err);
    } finally {
      this.currentUser = null;
      this.notifyLogout();
      this.notifyAuthStatus(AuthStatuses.UNAUTHENTICATED, null);
    }
  }

  getUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();
