import sys
import os

# Adicionar o diretório backend ao path para que os imports funcionem corretamente na Vercel
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Importar a aplicação FastAPI
from app.main import app

# Exportar a aplicação para o Vercel Serverless Function
handler = app
