FROM python:3.11-slim

WORKDIR /app

# Instalar dependências do sistema (poppler para PDF, libgl para OpenCV)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências Python (melhor cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY app/ ./app/

# Expor porta
EXPOSE 8000

# Rodar com limite de workers para não sobrecarregar a VPS
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
