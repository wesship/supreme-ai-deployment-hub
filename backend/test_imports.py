"""Quick import smoke test — run from backend/ directory."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Set dummy env vars so modules that read them at import time don't crash
os.environ.setdefault("SUPABASE_URL", "https://dummy.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy")
os.environ.setdefault("JWT_SECRET", "dummy")
os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("PINECONE_API_KEY", "dummy")
os.environ.setdefault("PINECONE_INDEX", "dummy")

from fastapi import FastAPI
app = FastAPI()

from operator.occ_router import router as occ_router
app.include_router(occ_router)
print("✓ operator.occ_router")

from operator.hermes_router import router as hermes_op_router
app.include_router(hermes_op_router)
print("✓ operator.hermes_router")

from hermes.router import router as hermes_router
app.include_router(hermes_router)
print("✓ hermes.router")

from rag.router import router as rag_router
app.include_router(rag_router)
print("✓ rag.router")

print("\nAll routers imported successfully ✅")
