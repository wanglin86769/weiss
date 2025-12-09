from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime, timedelta
import httpx
import jwt
import os

TITLE = "WEISS Backend API"
VERSION = "0.1.0"

# JWT Config
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24  # 24h

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Microsoft ID Config
MS_TENANT_ID = os.getenv("MS_TENANT_ID", "common")
MS_CLIENT_ID = os.getenv("MS_CLIENT_ID")
MS_CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET")

MS_AUTHORIZE_URL = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/authorize"
MS_TOKEN_URL = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token"
MS_USERINFO_URL = "https://graph.microsoft.com/v1.0/me"

app = FastAPI(title=TITLE, version=VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# Models
class UserRole(str, Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    USER = "user"


class AuthProvider(str, Enum):
    MICROSOFT = "microsoft"
    # TODO: add other providers


class User(BaseModel):
    id: str
    username: str
    email: Optional[str]
    provider: AuthProvider
    provider_id: str
    role: UserRole = UserRole.USER
    created_at: datetime = Field(default_factory=datetime.now(datetime.timezone.utc))


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: str


# Storage - TODO: Replace with real database
users_db: dict[str, User] = {}


# JWT helpers
def create_access_token(subject: str, role: UserRole) -> str:
    payload = {
        "sub": subject,
        "role": role.value,
        "exp": datetime.now(datetime.timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
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


# Microsoft OAuth helpers
async def exchange_ms_code(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            MS_TOKEN_URL,
            data={
                "client_id": MS_CLIENT_ID,
                "client_secret": MS_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "scope": "openid profile email User.Read",
            },
        )
        res.raise_for_status()
        return res.json()


async def get_ms_user(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.get(
            MS_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        res.raise_for_status()
        return res.json()


# Routes
@app.get("/")
async def root():
    return {"service": TITLE, "version": VERSION}


@app.get("/auth/microsoft/authorize")
async def microsoft_authorize():
    redirect_uri = f"{FRONTEND_URL}/auth/callback"

    url = (
        f"{MS_AUTHORIZE_URL}"
        f"?client_id={MS_CLIENT_ID}"
        f"&response_type=code"
        f"&redirect_uri={redirect_uri}"
        f"&response_mode=query"
        f"&scope=openid profile email User.Read"
    )

    return {"authorize_url": url}


@app.post("/auth/microsoft/callback", response_model=TokenResponse)
async def microsoft_callback(payload: OAuthCallbackRequest):
    token_data = await exchange_ms_code(payload.code, payload.redirect_uri)
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(400, "Failed to obtain Microsoft access token")

    ms_user = await get_ms_user(access_token)

    provider_id = ms_user["id"]
    user_id = f"ms_{provider_id}"

    if user_id not in users_db:
        users_db[user_id] = User(
            id=user_id,
            username=ms_user.get("displayName") or ms_user.get("mail"),
            email=ms_user.get("mail") or ms_user.get("userPrincipalName"),
            provider=AuthProvider.MICROSOFT,
            provider_id=provider_id,
            role=UserRole.USER,
        )

    user = users_db[user_id]
    jwt_token = create_access_token(user.id, user.role)

    return TokenResponse(access_token=jwt_token, user=user)


@app.get("/auth/me", response_model=User)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/auth/logout")
async def logout():
    # Stateless JWT: frontend just discards token
    return {"message": "Logged out"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
