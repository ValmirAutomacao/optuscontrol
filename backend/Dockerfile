FROM python:3.11-slim

WORKDIR /app

# Instalar dependências primeiro (melhor cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY app/ ./app/

# Expor porta
EXPOSE 8000

# Rodar com limite de workers para não sobrecarregar a VPS
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
