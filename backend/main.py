from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.config import settings
from app.core.exceptions import CarnetError

app = FastAPI(title="Suivi élèves hors-ligne")

STATIC_DIR = (Path(__file__).parent / "static").resolve()


@app.exception_handler(CarnetError)
async def handle_carnet_error(_: Request, exc: CarnetError) -> JSONResponse:
    """Translates business errors into HTTP, so services never import FastAPI."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


# Mounted before the catch-all below, which would otherwise swallow every path.
app.include_router(api_router, prefix="/api/v1")


if (STATIC_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


# Any new API route must be declared above this point: the catch-all below
# serves the built frontend (or falls back to index.html for client-side
# routing) for everything that isn't already matched, so a route declared
# after it would never be reached.
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str) -> FileResponse:
    # An unknown API path must not fall through to the SPA shell: the client
    # would receive index.html with a 200 and try to parse it as JSON.
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    if not STATIC_DIR.is_dir():
        raise HTTPException(status_code=404, detail="Frontend build not found")

    requested = (STATIC_DIR / full_path).resolve()
    if full_path and requested.is_relative_to(STATIC_DIR) and requested.is_file():
        return FileResponse(requested)

    index_file = STATIC_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Frontend build not found")
    return FileResponse(index_file)
