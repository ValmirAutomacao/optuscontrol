"""
Serviço de OCR usando múltiplos providers (OpenRouter, OpenAI, Gemini)
Extrai dados de cupons fiscais a partir de imagens.
Com fallback automático entre providers e pré-processamento de imagem.
"""
import httpx
import base64
import json
import re
import io
from typing import Dict, Optional
from PIL import Image, ImageEnhance, ImageFilter
from ..core.config import settings


RECEIPT_PROMPT = """
Analise esta imagem de um documento fiscal brasileiro (cupom, nota fiscal, recibo ou comprovante) e extraia as informações em formato JSON.

IMPORTANTE: Mesmo que a imagem esteja com baixa qualidade, tente extrair o máximo de informações possível.

Retorne EXATAMENTE neste formato JSON (sem texto adicional):
{
  "document_type": "nfce",
  "document_number": "000013330",
  "access_key": null,
  "establishment_name": "Nome do EMITENTE/REMETENTE (quem vendeu/forneceu)",
  "establishment_cnpj": "CNPJ do EMITENTE",
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
  "payment_method": "pix",
  "payment_type": "avista",
  "installments": 1,
  "confidence": 0.95
}

Instruções IMPORTANTES:
- document_type: identifique o tipo do documento:
  * "nfce" = Nota Fiscal de Consumidor Eletrônica (tem "NFC-e" ou "DANFE" escrito)
  * "nfe" = Nota Fiscal Eletrônica (tem "NF-e" escrito)
  * "recibo" = Recibo simples
  * "comprovante" = Comprovante de pagamento
  * "outro" = Não conseguiu identificar
  
- document_number: número do documento fiscal (obrigatório se visível)
  * Para NFC-e/NF-e: procure por "NFC-e nº" ou "Número:" 
  * Se não encontrar, use null
  
- access_key: chave de acesso de 44 dígitos (se houver, geralmente em NFC-e/NF-e)

- CRÍTICO para establishment_name e establishment_cnpj:
  * Em NF-e/NFC-e existem dois atores: EMITENTE (quem vende/fornece) e DESTINATÁRIO (quem compra/recebe)
  * Você DEVE extrair os dados do EMITENTE/REMETENTE (fornecedor), NÃO do destinatário
  * O EMITENTE geralmente aparece no TOPO do documento, com logo e dados completos
  * O DESTINATÁRIO aparece depois, como "DESTINATÁRIO / REMETENTE" ou similar
  * Exemplo: Se "Antonio Ozório" aparece no topo e "2P Engenharia" como destinatário,
    você deve retornar establishment_name = "Antonio Ozório" (o fornecedor)

- payment_method: forma de pagamento usada
  * "pix" = PIX, Pagamento Instantâneo
  * "dinheiro" = Dinheiro, Espécie
  * "credito" = Cartão de Crédito
  * "debito" = Cartão de Débito
  * "boleto" = Boleto Bancário
  * null = Não identificado

- payment_type: tipo de pagamento
  * "avista" = Pagamento à vista (PIX, dinheiro, débito)
  * "parcelado" = Pagamento parcelado (crédito parcelado)

- installments: número de parcelas
  * 1 = à vista
  * 2, 3, 4... = número de parcelas (se parcelado)

- Se não conseguir identificar algum campo, use null
- O confidence deve refletir sua confiança geral na extração (0.0 a 1.0)
- Valores monetários devem ser números decimais (ex: 45.90)
- Data no formato ISO (YYYY-MM-DD)
- CNPJ com pontuação padrão (XX.XXX.XXX/XXXX-XX)
"""


def preprocess_image(image_bytes: bytes) -> bytes:
    """
    Pré-processa a imagem para melhorar a qualidade do OCR.
    - Converte para escala de cinza
    - Aumenta contraste
    - Aplica filtro de nitidez
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # Converter para RGB se necessário (para RGBA, P, etc)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
        
        # Redimensionar se muito grande (max 2000px no maior lado)
        max_size = 2000
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Aumentar contraste
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.5)
        
        # Aumentar nitidez
        img = img.filter(ImageFilter.SHARPEN)
        
        # Converter de volta para bytes
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=90)
        return output.getvalue()
        
    except Exception as e:
        print(f"Erro no pré-processamento: {e}")
        return image_bytes  # Retorna original se falhar


async def extract_with_openrouter(image_base64: str, model: str = "openai/gpt-4o-mini") -> Dict:
    """
    Extrai dados usando OpenRouter API.
    Suporta múltiplos modelos de visão.
    """
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        return {"error": "OPENROUTER_API_KEY não configurada", "provider": "openrouter"}
    
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://optuscontrol.com",
                    "X-Title": "Optus Control OCR"
                },
                json={
                    "model": model,
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
                    "max_tokens": 2000
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
                parsed["model"] = model
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
        async with httpx.AsyncClient(timeout=90.0) as client:
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
                    "max_tokens": 2000
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
    Se confiança baixa, tenta modelo melhor.
    
    Args:
        image_base64: Imagem em base64 (sem o prefixo data:image/...)
    
    Returns:
        Dicionário com os dados extraídos
    """
    # Tentar OpenRouter primeiro com gpt-4o-mini
    if settings.OPENROUTER_API_KEY:
        result = await extract_with_openrouter(image_base64, "openai/gpt-4o-mini")
        if not result.get("error"):
            # Se confiança baixa, tentar modelo melhor
            confidence = result.get("confidence", 0)
            if confidence < 0.7:
                print(f"Confiança baixa ({confidence}), tentando modelo melhor...")
                better_result = await extract_with_openrouter(image_base64, "openai/gpt-4o")
                if not better_result.get("error") and better_result.get("confidence", 0) > confidence:
                    return better_result
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
    Aplica pré-processamento e extrai dados via OCR.
    
    Args:
        image_bytes: Bytes da imagem
    
    Returns:
        Dicionário com dados extraídos
    """
    # Aplicar pré-processamento
    processed_bytes = preprocess_image(image_bytes)
    
    # Converter para base64
    image_base64 = base64.b64encode(processed_bytes).decode('utf-8')
    
    # Extrair dados
    result = await extract_receipt_data(image_base64)
    
    return result
