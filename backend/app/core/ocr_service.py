"""
Serviço de OCR usando múltiplos providers (OpenRouter, OpenAI, Gemini)
Extrai dados de cupons fiscais a partir de imagens.
Com fallback automático entre providers.
"""
import httpx
import base64
import json
import re
import os
from typing import Dict, Optional
from ..core.config import settings


RECEIPT_PROMPT = """
Analise esta imagem de um cupom fiscal brasileiro e extraia as informações em formato JSON.

Retorne EXATAMENTE neste formato JSON (sem texto adicional):
{
  "establishment_name": "Nome do estabelecimento",
  "establishment_cnpj": "XX.XXX.XXX/XXXX-XX",
  "receipt_date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "items": [
    {
      "description": "Descrição do item",
      "quantity": 1,
      "unit_price": 0.00,
      "total": 0.00
    }
  ],
  "payment_method": "dinheiro/cartão/pix",
  "confidence": 0.95
}

Instruções:
- Se não conseguir identificar algum campo, use null
- O confidence deve refletir sua confiança geral na extração (0.0 a 1.0)
- Valores monetários devem ser números decimais (ex: 45.90)
- Data no formato ISO (YYYY-MM-DD)
- CNPJ com pontuação padrão
"""


async def extract_with_openrouter(image_base64: str) -> Dict:
    """
    Extrai dados usando OpenRouter API.
    Suporta múltiplos modelos de visão.
    """
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        return {"error": "OPENROUTER_API_KEY não configurada", "provider": "openrouter"}
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://optuscontrol.com",
                    "X-Title": "Optus Control OCR"
                },
                json={
                    "model": "openai/gpt-4o-mini",  # GPT-4o-mini via OpenRouter
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": RECEIPT_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_base64}"
                                    }
                                }
                            ]
                        }
                    ]
                }
            )
            
            if response.status_code != 200:
                return {
                    "error": f"OpenRouter error: {response.status_code}",
                    "details": response.text,
                    "provider": "openrouter"
                }
            
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Extrair JSON
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                parsed = json.loads(json_match.group())
                parsed["provider"] = "openrouter"
                return parsed
            
            return {"error": "Não foi possível extrair JSON", "raw": content, "provider": "openrouter"}
            
    except Exception as e:
        return {"error": str(e), "provider": "openrouter"}


async def extract_with_openai(image_base64: str) -> Dict:
    """
    Extrai dados usando OpenAI API (GPT-4 Vision).
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return {"error": "OPENAI_API_KEY não configurada", "provider": "openai"}
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": RECEIPT_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_base64}"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 1000
                }
            )
            
            if response.status_code != 200:
                return {
                    "error": f"OpenAI error: {response.status_code}",
                    "details": response.text,
                    "provider": "openai"
                }
            
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Extrair JSON
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                parsed = json.loads(json_match.group())
                parsed["provider"] = "openai"
                return parsed
            
            return {"error": "Não foi possível extrair JSON", "raw": content, "provider": "openai"}
            
    except Exception as e:
        return {"error": str(e), "provider": "openai"}


async def extract_receipt_data(image_base64: str) -> Dict:
    """
    Extrai dados de um cupom fiscal usando o provider disponível.
    Tenta OpenRouter primeiro, depois OpenAI como fallback.
    
    Args:
        image_base64: Imagem em base64 (sem o prefixo data:image/...)
    
    Returns:
        Dicionário com os dados extraídos
    """
    # Tentar OpenRouter primeiro (tem modelos gratuitos)
    if settings.OPENROUTER_API_KEY:
        result = await extract_with_openrouter(image_base64)
        if not result.get("error"):
            return result
        print(f"OpenRouter falhou: {result.get('error')}, tentando OpenAI...")
    
    # Fallback para OpenAI
    if settings.OPENAI_API_KEY:
        result = await extract_with_openai(image_base64)
        if not result.get("error"):
            return result
        print(f"OpenAI falhou: {result.get('error')}")
    
    # Nenhum provider configurado ou todos falharam
    return {
        "error": "Nenhum provider de OCR disponível ou todos falharam",
        "confidence": 0
    }


async def process_receipt_image(image_bytes: bytes) -> Dict:
    """
    Processa uma imagem de cupom fiscal.
    
    Args:
        image_bytes: Bytes da imagem
    
    Returns:
        Dicionário com dados extraídos
    """
    # Converter para base64
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Extrair dados
    result = await extract_receipt_data(image_base64)
    
    return result
