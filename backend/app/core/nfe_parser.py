"""
Parser de NF-e (Nota Fiscal Eletrônica) - XML
Extrai dados estruturados de arquivos XML de notas fiscais.
"""
from lxml import etree
from typing import Dict, List, Optional
from datetime import datetime

class NFEParser:
    """Parser para arquivos XML de NF-e."""
    
    NAMESPACES = {
        'nfe': 'http://www.portalfiscal.inf.br/nfe'
    }
    
    def __init__(self, xml_content: str):
        self.root = etree.fromstring(xml_content.encode())
        self.ns = self.NAMESPACES
    
    def _find(self, path: str, node=None) -> Optional[str]:
        """Encontra um elemento e retorna seu texto."""
        target = node if node is not None else self.root
        
        # Tenta com namespace
        elem = target.find(path, self.ns)
        if elem is not None and elem.text:
            return elem.text.strip()
        
        # Fallback sem namespace (alguns XMLs não têm)
        path_clean = path.replace('nfe:', '')
        for e in target.iter():
            if e.tag.endswith(path_clean.split('/')[-1]):
                if e.text:
                    return e.text.strip()
        return None
    
    def _find_node(self, path: str):
        """Encontra um nó específico."""
        elem = self.root.find(f'.//{path}', self.ns)
        if elem is None:
            # Fallback sem namespace
            for e in self.root.iter():
                if path.replace('nfe:', '') in e.tag:
                    return e
        return elem
    
    def get_access_key(self) -> Optional[str]:
        """Retorna a chave de acesso da NF-e."""
        # Tenta encontrar no infProt ou calcular do infNFe
        chave = self._find('.//nfe:chNFe')
        if not chave:
            # Pode estar no atributo Id do infNFe
            inf_nfe = self._find_node('nfe:infNFe')
            if inf_nfe is not None and 'Id' in inf_nfe.attrib:
                chave = inf_nfe.attrib['Id'].replace('NFe', '')
        return chave
    
    def get_invoice_number(self) -> Optional[str]:
        """Retorna o número da nota fiscal."""
        return self._find('.//nfe:ide/nfe:nNF')
    
    def get_series(self) -> Optional[str]:
        """Retorna a série da nota fiscal."""
        return self._find('.//nfe:ide/nfe:serie')
    
    def get_issue_date(self) -> Optional[datetime]:
        """Retorna a data de emissão."""
        date_str = self._find('.//nfe:ide/nfe:dhEmi')
        if date_str:
            try:
                # Remove timezone info se presente
                date_str = date_str[:19]
                return datetime.fromisoformat(date_str)
            except:
                pass
        return None
    
    def get_supplier_info(self) -> Dict:
        """Retorna informações do emissor (fornecedor)."""
        return {
            'cnpj': self._find('.//nfe:emit/nfe:CNPJ'),
            'name': self._find('.//nfe:emit/nfe:xNome'),
            'trade_name': self._find('.//nfe:emit/nfe:xFant'),
            'state': self._find('.//nfe:emit/nfe:enderEmit/nfe:UF'),
            'city': self._find('.//nfe:emit/nfe:enderEmit/nfe:xMun'),
        }
    
    def get_recipient_info(self) -> Dict:
        """Retorna informações do destinatário."""
        return {
            'cnpj': self._find('.//nfe:dest/nfe:CNPJ'),
            'cpf': self._find('.//nfe:dest/nfe:CPF'),
            'name': self._find('.//nfe:dest/nfe:xNome'),
        }
    
    def get_totals(self) -> Dict:
        """Retorna os totais da nota."""
        return {
            'products': self._to_float(self._find('.//nfe:total/nfe:ICMSTot/nfe:vProd')),
            'services': self._to_float(self._find('.//nfe:total/nfe:ISSQNtot/nfe:vServ')),
            'total': self._to_float(self._find('.//nfe:total/nfe:ICMSTot/nfe:vNF')),
            'icms': self._to_float(self._find('.//nfe:total/nfe:ICMSTot/nfe:vICMS')),
            'ipi': self._to_float(self._find('.//nfe:total/nfe:ICMSTot/nfe:vIPI')),
            'discount': self._to_float(self._find('.//nfe:total/nfe:ICMSTot/nfe:vDesc')),
            'freight': self._to_float(self._find('.//nfe:total/nfe:ICMSTot/nfe:vFrete')),
        }
    
    def get_items(self) -> List[Dict]:
        """Retorna os itens da nota fiscal."""
        items = []
        for det in self.root.iter():
            if 'det' in det.tag:
                item = {
                    'sequence': det.attrib.get('nItem'),
                    'code': self._find('nfe:prod/nfe:cProd', det),
                    'ean': self._find('nfe:prod/nfe:cEAN', det),
                    'description': self._find('nfe:prod/nfe:xProd', det),
                    'ncm': self._find('nfe:prod/nfe:NCM', det),
                    'cfop': self._find('nfe:prod/nfe:CFOP', det),
                    'unit': self._find('nfe:prod/nfe:uCom', det),
                    'quantity': self._to_float(self._find('nfe:prod/nfe:qCom', det)),
                    'unit_price': self._to_float(self._find('nfe:prod/nfe:vUnCom', det)),
                    'total': self._to_float(self._find('nfe:prod/nfe:vProd', det)),
                }
                if item['code']:  # Só adiciona se tiver código
                    items.append(item)
        return items
    
    def get_payment_info(self) -> List[Dict]:
        """Retorna informações de duplicatas/parcelas."""
        payments = []
        for dup in self.root.iter():
            if 'dup' in dup.tag:
                payment = {
                    'number': self._find('nfe:nDup', dup),
                    'due_date': self._find('nfe:dVenc', dup),
                    'amount': self._to_float(self._find('nfe:vDup', dup)),
                }
                if payment['amount']:
                    payments.append(payment)
        return payments
    
    def _to_float(self, value: Optional[str]) -> float:
        """Converte string para float."""
        if value:
            try:
                return float(value.replace(',', '.'))
            except:
                pass
        return 0.0
    
    def parse(self) -> Dict:
        """Parse completo da NF-e."""
        supplier = self.get_supplier_info()
        totals = self.get_totals()
        issue_date = self.get_issue_date()
        
        return {
            'access_key': self.get_access_key(),
            'number': self.get_invoice_number(),
            'series': self.get_series(),
            'issue_date': issue_date.isoformat() if issue_date else None,
            'supplier_cnpj': supplier['cnpj'],
            'supplier_name': supplier['name'],
            'supplier_state': supplier['state'],
            'total_products': totals['products'],
            'total_services': totals['services'],
            'total_value': totals['total'],
            'icms_value': totals['icms'],
            'ipi_value': totals['ipi'],
            'items': self.get_items(),
            'payments': self.get_payment_info(),
        }


def parse_nfe_xml(xml_content: str) -> Dict:
    """Função helper para parsear XML de NF-e."""
    parser = NFEParser(xml_content)
    return parser.parse()
