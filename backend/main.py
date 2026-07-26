import os

from fastapi import FastAPI

app = FastAPI(title="Suivi élèves hors-ligne")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": os.getenv("ENVIRONMENT", "development")}
