"""
Gerador de arquivos EFD Contribuições (PIS/COFINS)
Layout baseado no Guia Prático da Receita Federal

Estrutura:
- Bloco 0: Abertura, Identificação e Referências
- Bloco A: Documentos Fiscais - Serviços (ISS)
- Bloco C: Documentos Fiscais I - Mercadorias (ICMS/IPI)
- Bloco F: Demais Documentos e Operações
- Bloco M: Apuração da Contribuição e Crédito
- Bloco 1: Complemento da Escrituração
- Bloco 9: Controle e Encerramento

Campos separados por pipe (|)
"""
from datetime import date, datetime
from typing import Dict, List, Optional
from decimal import Decimal


class EfdContribuicoesGenerator:
    """Gera arquivo texto no formato EFD Contribuições (PIS/COFINS)."""
    
    # Alíquotas padrão
    ALIQUOTA_PIS = Decimal("1.65")      # Regime não-cumulativo
    ALIQUOTA_COFINS = Decimal("7.60")   # Regime não-cumulativo
    
    def __init__(
        self,
        company_data: Dict,
        start_date: date,
        end_date: date,
        invoices: List[Dict],
        expenses: List[Dict],
        tipo_escrituracao: str = "0"  # 0=Original
    ):
        self.company = company_data
        self.start_date = start_date
        self.end_date = end_date
        self.invoices = invoices
        self.expenses = expenses
        self.tipo_escrituracao = tipo_escrituracao
        self.lines = []
        self.record_count = {}
        
    def _format_date(self, dt: Optional[str]) -> str:
        """Formata data para DDMMAAAA."""
        if not dt:
            return ""
        try:
            if isinstance(dt, str):
                d = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            else:
                d = dt
            return d.strftime("%d%m%Y")
        except:
            return ""
    
    def _format_value(self, value: Optional[float], decimals: int = 2) -> str:
        """Formata valor numérico."""
        if value is None:
            return "0" + "," + "0" * decimals
        return f"{value:.{decimals}f}".replace(".", ",")
    
    def _format_cnpj(self, cnpj: Optional[str]) -> str:
        """Remove formatação do CNPJ."""
        if not cnpj:
            return ""
        return "".join(c for c in cnpj if c.isdigit())
    
    def _add_line(self, *fields):
        """Adiciona linha ao arquivo."""
        reg_type = fields[0] if fields else ""
        self.record_count[reg_type] = self.record_count.get(reg_type, 0) + 1
        line = "|" + "|".join(str(f) for f in fields) + "|"
        self.lines.append(line)
    
    def _generate_block_0(self):
        """Bloco 0 - Abertura, Identificação e Referências."""
        
        # Registro 0000 - Abertura do Arquivo Digital
        self._add_line(
            "0000",                                    # REG
            "006",                                     # COD_VER (versão do layout)
            self.tipo_escrituracao,                    # TIPO_ESCRIT
            "0",                                       # IND_SIT_ESP (situação especial)
            "",                                        # NUM_REC_ANTERIOR
            self._format_date(self.start_date.isoformat()),  # DT_INI
            self._format_date(self.end_date.isoformat()),    # DT_FIM
            self.company.get("name", "")[:100],        # NOME
            self._format_cnpj(self.company.get("cnpj", "")), # CNPJ
            self.company.get("state", "CE"),           # UF
            self.company.get("city_code", ""),         # COD_MUN
            "",                                        # SUFRAMA
            "1",                                       # IND_NAT_PJ (1=Lucro Real)
            "0"                                        # IND_ATIV (0=Industrial)
        )
        
        # Registro 0001 - Abertura do Bloco 0
        self._add_line("0001", "0")  # 0 = Com movimento
        
        # Registro 0100 - Dados do Contabilista
        self._add_line(
            "0100",
            "CONTADOR RESPONSÁVEL",
            "",  # CPF
            "CRC",
            "",  # CNPJ escritório
            "",  # CEP
            "",  # Endereço
            "",  # Número
            "",  # Complemento
            "",  # Bairro
            "",  # Telefone
            "",  # Fax
            "",  # Email
            self.company.get("city_code", "")
        )
        
        # Registro 0110 - Regimes de Apuração
        self._add_line(
            "0110",
            "1",   # COD_INC_TRIB (1=Escrituração consolidada)
            "2",   # IND_APRO_CRED (2=Proporcional)
            "1",   # COD_TIPO_CONT (1=Contribuinte)
            ""     # IND_REG_CUM
        )
    
    def _generate_block_a(self):
        """Bloco A - Documentos Fiscais - Serviços (ISS)."""
        # Registro A001 - Abertura do Bloco A
        self._add_line("A001", "1")  # 1 = Sem movimento
    
    def _generate_block_c(self):
        """Bloco C - Documentos Fiscais I - Mercadorias."""
        
        has_data = len(self.invoices) > 0
        self._add_line("C001", "0" if has_data else "1")
        
        if has_data:
            for inv in self.invoices:
                total_value = float(inv.get("total_value", 0) or 0)
                
                # Calcular PIS e COFINS
                vl_pis = total_value * float(self.ALIQUOTA_PIS) / 100
                vl_cofins = total_value * float(self.ALIQUOTA_COFINS) / 100
                
                # Registro C100 - Documento - Nota Fiscal
                self._add_line(
                    "C100",
                    "0",                                      # IND_OPER (0=Entrada)
                    "0",                                      # IND_EMIT (0=Terceiros)
                    "",                                       # COD_PART
                    "55",                                     # COD_MOD (55=NF-e)
                    "00",                                     # COD_SIT (00=Regular)
                    "1",                                      # SER
                    inv.get("number", ""),                    # NUM_DOC
                    inv.get("access_key", ""),                # CHV_NFE
                    self._format_date(inv.get("issue_date")), # DT_DOC
                    self._format_value(total_value),          # VL_DOC
                    "9",                                      # IND_PGTO
                    self._format_value(0),                    # VL_DESC
                    self._format_value(0),                    # VL_ABAT_NT
                    self._format_value(total_value)           # VL_MERC
                )
                
                # Registro C170 - Itens do Documento
                self._add_line(
                    "C170",
                    "1",                                      # NUM_ITEM
                    "",                                       # COD_ITEM
                    "MERCADORIA",                             # DESCR_COMPL
                    "1",                                      # QTD
                    "UN",                                     # UNID
                    self._format_value(total_value),          # VL_ITEM
                    self._format_value(0),                    # VL_DESC
                    "0",                                      # IND_MOV
                    "50",                                     # CST_ICMS
                    "01",                                     # CFOP
                    "9999.99.99",                             # COD_NAT
                    self._format_value(total_value),          # VL_BC_ICMS
                    self._format_value(self.ALIQUOTA_PIS, 4), # ALIQ_ICMS
                    self._format_value(vl_pis),               # VL_ICMS
                    self._format_value(total_value),          # VL_BC_ICMS_ST
                    self._format_value(self.ALIQUOTA_COFINS, 4),
                    self._format_value(vl_cofins)
                )
    
    def _generate_block_f(self):
        """Bloco F - Demais Documentos e Operações."""
        
        has_data = len(self.expenses) > 0
        self._add_line("F001", "0" if has_data else "1")
        
        if has_data:
            for exp in self.expenses:
                total_value = float(exp.get("total_amount", 0) or 0)
                
                # Registro F100 - Demais Documentos
                self._add_line(
                    "F100",
                    "0",                                      # IND_OPER (0=Aquisição)
                    "",                                       # COD_PART
                    "",                                       # COD_ITEM
                    self._format_date(exp.get("receipt_date")),
                    self._format_value(total_value),
                    "1",                                      # IND_NAT_FRT
                    "50",                                     # CST_PIS
                    self._format_value(total_value),          # VL_BC_PIS
                    self._format_value(self.ALIQUOTA_PIS, 4),
                    self._format_value(total_value * float(self.ALIQUOTA_PIS) / 100),
                    "50",                                     # CST_COFINS
                    self._format_value(total_value),          # VL_BC_COFINS
                    self._format_value(self.ALIQUOTA_COFINS, 4),
                    self._format_value(total_value * float(self.ALIQUOTA_COFINS) / 100),
                    "9999.99.99",                             # NAT_BC_CRED
                    "",                                       # IND_ORIG_CRED
                    "",                                       # COD_CTA
                    ""                                        # COD_CCUS
                )
    
    def _generate_block_m(self):
        """Bloco M - Apuração da Contribuição."""
        
        self._add_line("M001", "0")  # Com movimento
        
        # Calcular totais
        total_receita = sum(float(inv.get("total_value", 0) or 0) for inv in self.invoices)
        total_pis = total_receita * float(self.ALIQUOTA_PIS) / 100
        total_cofins = total_receita * float(self.ALIQUOTA_COFINS) / 100
        
        # Registro M200 - Contribuição para o PIS/PASEP
        self._add_line(
            "M200",
            self._format_value(total_pis),           # VL_TOT_CONT_NC_PER
            self._format_value(0),                   # VL_TOT_CRED_DESC
            self._format_value(0),                   # VL_TOT_CRED_DESC_ANT
            self._format_value(total_pis),           # VL_TOT_CONT_NC_DEV
            self._format_value(0),                   # VL_RET_NC
            self._format_value(0),                   # VL_OUT_DED_NC
            self._format_value(total_pis),           # VL_CONT_NC_REC
            self._format_value(0),                   # VL_TOT_CONT_CUM_PER
            self._format_value(0),                   # VL_RET_CUM
            self._format_value(0),                   # VL_OUT_DED_CUM
            self._format_value(0),                   # VL_CONT_CUM_REC
            self._format_value(total_pis)            # VL_TOT_CONT_REC
        )
        
        # Registro M210 - Detalhamento PIS
        self._add_line(
            "M210",
            "01",                                    # COD_CONT
            self._format_value(total_receita),       # VL_REC_BRT
            self._format_value(total_receita),       # VL_BC_CONT
            self._format_value(self.ALIQUOTA_PIS, 4),
            self._format_value(total_pis),
            "0",                                     # COD_CTA
            ""                                       # DESC_COMPL
        )
        
        # Registro M600 - Contribuição para COFINS
        self._add_line(
            "M600",
            self._format_value(total_cofins),        # VL_TOT_CONT_NC_PER
            self._format_value(0),
            self._format_value(0),
            self._format_value(total_cofins),
            self._format_value(0),
            self._format_value(0),
            self._format_value(total_cofins),
            self._format_value(0),
            self._format_value(0),
            self._format_value(0),
            self._format_value(0),
            self._format_value(total_cofins)
        )
        
        # Registro M610 - Detalhamento COFINS
        self._add_line(
            "M610",
            "01",
            self._format_value(total_receita),
            self._format_value(total_receita),
            self._format_value(self.ALIQUOTA_COFINS, 4),
            self._format_value(total_cofins),
            "0",
            ""
        )
    
    def _generate_block_1(self):
        """Bloco 1 - Complemento da Escrituração."""
        self._add_line("1001", "1")  # Sem movimento
    
    def _generate_block_9(self):
        """Bloco 9 - Controle e Encerramento."""
        
        self._add_line("9001", "0")
        
        # Registro 9900 - Registros do arquivo
        for reg_type, count in sorted(self.record_count.items()):
            self._add_line("9900", reg_type, str(count))
        
        self._add_line("9900", "9001", "1")
        self._add_line("9900", "9900", str(len(self.record_count) + 3))
        self._add_line("9900", "9990", "1")
        self._add_line("9900", "9999", "1")
        
        self._add_line("9990", str(len([l for l in self.lines if l.startswith("|9")]) + 2))
        self._add_line("9999", str(len(self.lines) + 1))
    
    def generate(self) -> str:
        """Gera o arquivo EFD Contribuições completo."""
        self.lines = []
        self.record_count = {}
        
        self._generate_block_0()
        self._generate_block_a()
        self._generate_block_c()
        self._generate_block_f()
        self._generate_block_m()
        self._generate_block_1()
        
        # Inserir encerramentos
        blocks = ['0', 'A', 'C', 'F', 'M', '1']
        for block in blocks:
            prefix = f"|{block}"
            count = len([l for l in self.lines if l.startswith(prefix)])
            if count > 0:
                idx = max(i for i, l in enumerate(self.lines) if l.startswith(prefix))
                self.lines.insert(idx + 1, f"|{block}990|{count + 1}|")
        
        self._generate_block_9()
        
        return "\n".join(self.lines)


def generate_efd_contribuicoes(
    company_data: Dict,
    start_date: str,
    end_date: str,
    invoices: List[Dict],
    expenses: List[Dict]
) -> str:
    """
    Gera arquivo EFD Contribuições.
    
    Args:
        company_data: Dados da empresa
        start_date: Data início (YYYY-MM-DD)
        end_date: Data fim (YYYY-MM-DD)
        invoices: Lista de notas fiscais
        expenses: Lista de despesas
    
    Returns:
        Conteúdo do arquivo EFD em formato texto
    """
    generator = EfdContribuicoesGenerator(
        company_data=company_data,
        start_date=date.fromisoformat(start_date),
        end_date=date.fromisoformat(end_date),
        invoices=invoices,
        expenses=expenses
    )
    return generator.generate()
