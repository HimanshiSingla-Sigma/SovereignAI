import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

def get_engine():
    """Create SQLAlchemy engine with automatic fallback to SQLite if PostgreSQL is unreachable."""
    db_url = settings.DATABASE_URL
    
    # If postgresql URL is specified, try connecting, otherwise fallback to SQLite
    if db_url.startswith("postgresql"):
        try:
            test_engine = create_engine(db_url, pool_pre_ping=True)
            with test_engine.connect() as conn:
                pass
            return test_engine
        except Exception as e:
            print(f"Notice: PostgreSQL connection failed ({e}). Falling back to SQLite for local sovereign execution.")
            sqlite_url = "sqlite:///./sovereign_workbench.db"
            return create_engine(sqlite_url, connect_args={"check_same_thread": False})
    else:
        # SQLite
        return create_engine(db_url, connect_args={"check_same_thread": False})

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """FastAPI database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
