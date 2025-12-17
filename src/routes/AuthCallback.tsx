import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService, type OAuthProvider } from "@src/services/AuthService/AuthService";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const provider = params.get("state") as OAuthProvider;
    if (!code || !provider) {
      console.error("OAuth callback missing code");
      navigate("/login", { replace: true });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;

    authService
      .handleCallback(provider, code, redirectUri)
      .then(() => {
        navigate("/", { replace: true });
      })
      .catch((err) => {
        console.error("OAuth callback failed:", err);
        navigate("/login", { replace: true });
      });
  }, [navigate]);

  return null;
}
