import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Suivi élèves hors-ligne")

STATIC_DIR = (Path(__file__).parent / "static").resolve()


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": os.getenv("ENVIRONMENT", "development")}


if (STATIC_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


# Any new API route must be declared above this point: the catch-all below
# serves the built frontend (or falls back to index.html for client-side
# routing) for everything that isn't already matched, so a route declared
# after it would never be reached.
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str) -> FileResponse:
    if not STATIC_DIR.is_dir():
        raise HTTPException(status_code=404, detail="Frontend build not found")

    requested = (STATIC_DIR / full_path).resolve()
    if full_path and requested.is_relative_to(STATIC_DIR) and requested.is_file():
        return FileResponse(requested)

    index_file = STATIC_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Frontend build not found")
    return FileResponse(index_file)
