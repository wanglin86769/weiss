from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.auth import auth
from api.repos import staging, deployed
from api.config import FRONTEND_URL, TITLE, VERSION

app = FastAPI(title=TITLE, version=VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


################
# Routes
################
app.include_router(auth.router)
app.include_router(staging.router)
app.include_router(deployed.router)


@app.get("/", operation_id="rootInfo")
async def root():
    return {"service": TITLE, "version": VERSION}


@app.get("/health", operation_id="healthCheck")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
