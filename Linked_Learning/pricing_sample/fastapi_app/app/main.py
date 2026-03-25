from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.pricing_endpoints import router
from app.database import engine, Base
from app.models import PricingData  # noqa: F401 - ensures table is registered

app = FastAPI(title="Sample API", version="1.0.0")

# Create tables on startup
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4100", "http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Welcome to the Sample API", "docs": "/docs"}
