FROM python:3.11-slim

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/app ./app
COPY backend/tests ./tests
COPY .env.example ./.env

# Install Python packages
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    pydantic \
    pydantic-settings \
    sqlalchemy \
    psycopg2-binary \
    pyotp \
    qrcode \
    pyjwt \
    numpy \
    scipy \
    scikit-learn \
    pytest \
    pytest-asyncio \
    python-multipart \
    psutil \
    pypdfium2

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
