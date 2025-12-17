from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime, timedelta, timezone
import httpx
import jwt
import os
import msal

TITLE = "WEISS Backend API"
VERSION = "0.1.0"

# ------------------------------------------------------------------------------
# JWT Config
# ------------------------------------------------------------------------------
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ------------------------------------------------------------------------------
# Microsoft Auth / MSAL Config
# ------------------------------------------------------------------------------
MS_AUTH_TENANT_ID = os.getenv("MS_AUTH_TENANT_ID", "common")
MS_AUTH_CLIENT_ID = os.getenv("MS_AUTH_CLIENT_ID")
MS_AUTH_CLIENT_SECRET = os.getenv("MS_AUTH_CLIENT_SECRET")

if not MS_AUTH_CLIENT_ID or not MS_AUTH_CLIENT_SECRET:
    raise RuntimeError("Microsoft OAuth client id/secret not configured")

MS_AUTHORITY = f"https://login.microsoftonline.com/{MS_AUTH_TENANT_ID}"
MS_SCOPES = ["email", "User.Read"]
MS_GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"

# ------------------------------------------------------------------------------
# FastAPI setup
# ------------------------------------------------------------------------------
app = FastAPI(title=TITLE, version=VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ------------------------------------------------------------------------------
# Models
# ------------------------------------------------------------------------------
class UserRole(str, Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    USER = "user"


class AuthProvider(str, Enum):
    MICROSOFT = "microsoft"
    DEMO = "demo"


class User(BaseModel):
    id: str
    username: str
    email: Optional[str]
    provider: AuthProvider
    provider_id: str
    role: UserRole = UserRole.USER
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


class OAuthCallbackRequest(BaseModel):
    provider: AuthProvider
    code: Optional[str] = None
    redirect_uri: Optional[str] = None


# ------------------------------------------------------------------------------
# Storage (temporary)
# ------------------------------------------------------------------------------
users_db: dict[str, User] = {}


# ------------------------------------------------------------------------------
# MSAL client
# ------------------------------------------------------------------------------
def get_msal_app() -> msal.ConfidentialClientApplication:
    return msal.ConfidentialClientApplication(
        client_id=MS_AUTH_CLIENT_ID,
        client_credential=MS_AUTH_CLIENT_SECRET,
        authority=MS_AUTHORITY,
    )


# ------------------------------------------------------------------------------
# JWT helpers
# ------------------------------------------------------------------------------
def create_access_token(subject: str, role: UserRole) -> str:
    payload = {
        "sub": subject,
        "role": role.value,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")

    if not user_id or user_id not in users_db:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return users_db[user_id]


# ------------------------------------------------------------------------------
# Provider helpers
# ------------------------------------------------------------------------------
async def get_ms_user(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.get(
            MS_GRAPH_ME_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        res.raise_for_status()
        return res.json()


async def handle_microsoft_callback(code: str, redirect_uri: str) -> TokenResponse:
    msal_app = get_msal_app()
    result = msal_app.acquire_token_by_authorization_code(
        code,
        scopes=MS_SCOPES,
        redirect_uri=redirect_uri,
    )

    if "access_token" not in result:
        raise HTTPException(
            status_code=400,
            detail=f"MSAL token acquisition failed: {result.get('error_description')}",
        )

    ms_user = await get_ms_user(result["access_token"])

    provider_id = ms_user["id"]
    user_id = f"ms_{provider_id}"

    if user_id not in users_db:
        users_db[user_id] = User(
            id=user_id,
            username=ms_user.get("displayName") or ms_user.get("userPrincipalName"),
            email=ms_user.get("mail") or ms_user.get("userPrincipalName"),
            provider=AuthProvider.MICROSOFT,
            provider_id=provider_id,
            role=UserRole.USER,
        )

    user = users_db[user_id]
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        user=user,
    )


async def handle_demo_login(role) -> TokenResponse:
    user_id = f"demo_user_{role.value}"

    if user_id not in users_db:
        users_db[user_id] = User(
            id=user_id,
            username=f"Demo {role.value.capitalize()}",
            email=None,
            provider=AuthProvider.DEMO,
            provider_id=AuthProvider.DEMO.value,
            role=role,
        )

    user = users_db[user_id]
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        user=user,
    )


# ------------------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------------------
@app.get("/")
async def root():
    return {"service": TITLE, "version": VERSION}


@app.get("/auth/{provider}/authorize")
async def authorize(provider: AuthProvider, demo_profile: UserRole | None):
    if provider == AuthProvider.MICROSOFT:
        redirect_uri = f"{FRONTEND_URL}/auth/callback"

        auth_url = get_msal_app().get_authorization_request_url(
            scopes=MS_SCOPES,
            redirect_uri=redirect_uri,
            state="microsoft",
            response_mode="query",
        )
        return {"authorize_url": auth_url}

    if provider == AuthProvider.DEMO:
        if demo_profile not in [role.value for role in UserRole]:
            raise HTTPException(status_code=400, detail="Invalid demo profile")

        dummy_code = f"demo_code_{demo_profile.value}"
        redirect_url = f"{FRONTEND_URL}/auth/callback?code={dummy_code}&state=demo"
        return {"authorize_url": redirect_url}

    raise HTTPException(status_code=400, detail="Unsupported provider")


@app.post("/auth/callback", response_model=TokenResponse)
async def oauth_callback(payload: OAuthCallbackRequest):
    if not payload.code or not payload.redirect_uri:
        raise HTTPException(status_code=400, detail="Missing OAuth parameters")
    if payload.provider == AuthProvider.MICROSOFT:
        return await handle_microsoft_callback(
            payload.code,
            payload.redirect_uri,
        )
    elif payload.provider == AuthProvider.DEMO:
        demo_role = payload.code.split("_")[-1]
        if demo_role not in [role.value for role in UserRole]:
            raise HTTPException(status_code=400, detail="Invalid demo profile")
        return await handle_demo_login(UserRole(demo_role))

    raise HTTPException(status_code=400, detail="Unsupported provider")


@app.get("/auth/me", response_model=User)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/auth/logout")
async def logout():
    return {"message": "Logged out"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
