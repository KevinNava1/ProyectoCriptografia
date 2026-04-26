# ────────────────────────────────────────────────────────────────
#  SecureRx — backend (FastAPI + cryptography + MySQL)
#  Imagen slim + usuario no-root + CA persistente en volumen.
# ────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# gcc/libffi → argon2-cffi y cryptography llevan C-extensions.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        build-essential libffi-dev curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache de dependencias.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Fuente.
COPY . .

# Usuario no-root.
RUN useradd --create-home --shell /usr/sbin/nologin rxapp \
 && mkdir -p /app/ca \
 && chown -R rxapp:rxapp /app

USER rxapp

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fs http://127.0.0.1:8000/ || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
