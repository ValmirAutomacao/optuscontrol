"""
Gerador de arquivos SPED Fiscal (EFD ICMS/IPI)
Layout baseado no Guia Prático da Receita Federal

Estrutura:
- Bloco 0: Abertura, Identificação e Referências
- Bloco C: Documentos Fiscais I - Mercadorias (NF-e, NF)
- Bloco E: Apuração do ICMS e IPI
- Bloco H: Inventário Físico
- Bloco 9: Controle e Encerramento

Campos separados por pipe (|)
"""
from datetime import date, datetime
from typing import Dict, List, Optional
from io import StringIO


class SpedFiscalGenerator:
    """Gera arquivo texto no formato SPED Fiscal (EFD ICMS/IPI)."""
    
    def __init__(
        self,
        company_data: Dict,
        start_date: date,
        end_date: date,
        invoices: List[Dict],
        finalidade: str = "0"  # 0=Remessa regular, 1=Retificação
    ):
        self.company = company_data
        self.start_date = start_date
        self.end_date = end_date
        self.invoices = invoices
        self.finalidade = finalidade
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
    
    def _safe_str(self, value, max_len: int = None) -> str:
        """Retorna string segura, tratando None."""
        s = str(value) if value is not None else ""
        if max_len:
            return s[:max_len]
        return s
    
    def _add_line(self, *fields):
        """Adiciona linha ao arquivo."""
        # Registrar contagem por tipo de registro
        reg_type = fields[0] if fields else ""
        self.record_count[reg_type] = self.record_count.get(reg_type, 0) + 1
        
        line = "|" + "|".join(str(f) if f is not None else "" for f in fields) + "|"
        self.lines.append(line)
    
    def _generate_block_0(self):
        """Bloco 0 - Abertura, Identificação e Referências."""
        
        # Registro 0000 - Abertura do Arquivo Digital
        self._add_line(
            "0000",                                    # REG
            "018",                                     # COD_VER (versão do layout)
            "0",                                       # COD_FIN (finalidade: 0=Original)
            self._format_date(self.start_date.isoformat()),  # DT_INI
            self._format_date(self.end_date.isoformat()),    # DT_FIM
            self._safe_str(self.company.get("name"), 100),   # NOME
            self._format_cnpj(self.company.get("cnpj", "")), # CNPJ
            "",                                        # CPF
            self._safe_str(self.company.get("state") or "CE"), # UF
            "",                                        # IE (Inscrição Estadual)
            self._safe_str(self.company.get("city_code")),    # COD_MUN
            "",                                        # IM (Inscrição Municipal)
            "",                                        # SUFRAMA
            "0",                                       # IND_PERFIL (A=Completo)
            "1"                                        # IND_ATIV (Tipo atividade)
        )
        
        # Registro 0001 - Abertura do Bloco 0
        self._add_line("0001", "0")  # 0 = Com movimento
        
        # Registro 0005 - Dados Complementares da Entidade
        self._add_line(
            "0005",
            self._safe_str(self.company.get("fantasy_name") or self.company.get("name"), 60),
            self._safe_str(self.company.get("cep")),
            self._safe_str(self.company.get("address"), 60),
            self._safe_str(self.company.get("number")),
            "",  # Complemento
            self._safe_str(self.company.get("neighborhood")),
            self._safe_str(self.company.get("phone")),
            "",  # Fax
            self._safe_str(self.company.get("email"))
        )
        
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
        
        # Registro 0990 - Encerramento do Bloco 0
        # Será adicionado após contagem final
    
    def _generate_block_c(self):
        """Bloco C - Documentos Fiscais I - Mercadorias."""
        
        # Registro C001 - Abertura do Bloco C
        has_data = len(self.invoices) > 0
        self._add_line("C001", "0" if has_data else "1")
        
        if has_data:
            for inv in self.invoices:
                # Registro C100 - Nota Fiscal
                self._add_line(
                    "C100",
                    "0",                                      # IND_OPER (0=Entrada, 1=Saída)
                    "0",                                      # IND_EMIT (0=Emissão própria)
                    "00",                                     # COD_PART (código participante)
                    "55",                                     # COD_MOD (55=NF-e)
                    "00",                                     # COD_SIT (00=Regular)
                    "1",                                      # SER (série)
                    inv.get("number", ""),                    # NUM_DOC
                    inv.get("access_key", ""),                # CHV_NFE
                    self._format_date(inv.get("issue_date")), # DT_DOC
                    self._format_date(inv.get("issue_date")), # DT_E_S
                    self._format_value(inv.get("total_value", 0)),  # VL_DOC
                    "1",                                      # IND_PGTO
                    self._format_value(0),                    # VL_DESC
                    self._format_value(0),                    # VL_ABAT_NT
                    self._format_value(inv.get("total_value", 0)),  # VL_MERC
                    "0",                                      # IND_FRT
                    self._format_value(0),                    # VL_FRT
                    self._format_value(0),                    # VL_SEG
                    self._format_value(0),                    # VL_OUT_DA
                    self._format_value(inv.get("base_icms", 0)),  # VL_BC_ICMS
                    self._format_value(inv.get("icms_value", 0)), # VL_ICMS
                    self._format_value(0),                    # VL_BC_ICMS_ST
                    self._format_value(0),                    # VL_ICMS_ST
                    self._format_value(inv.get("ipi_value", 0)),  # VL_IPI
                    self._format_value(inv.get("pis_value", 0)),  # VL_PIS
                    self._format_value(inv.get("cofins_value", 0)), # VL_COFINS
                    self._format_value(0),                    # VL_PIS_ST
                    self._format_value(0)                     # VL_COFINS_ST
                )
    
    def _generate_block_e(self):
        """Bloco E - Apuração do ICMS e IPI."""
        
        # Registro E001 - Abertura do Bloco E
        self._add_line("E001", "0")
        
        # Registro E100 - Período da Apuração do ICMS
        self._add_line(
            "E100",
            self._format_date(self.start_date.isoformat()),
            self._format_date(self.end_date.isoformat())
        )
        
        # Calcular totais
        total_icms = sum(float(inv.get("icms_value", 0) or 0) for inv in self.invoices)
        
        # Registro E110 - Apuração do ICMS
        self._add_line(
            "E110",
            self._format_value(total_icms),  # VL_TOT_DEBITOS
            self._format_value(0),           # VL_AJ_DEBITOS
            self._format_value(total_icms),  # VL_TOT_AJ_DEBITOS
            self._format_value(0),           # VL_ESTORNOS_CRED
            self._format_value(0),           # VL_TOT_CREDITOS
            self._format_value(0),           # VL_AJ_CREDITOS
            self._format_value(0),           # VL_TOT_AJ_CREDITOS
            self._format_value(0),           # VL_ESTORNOS_DEB
            self._format_value(total_icms),  # VL_SLD_CREDOR_ANT
            self._format_value(total_icms),  # VL_SLD_APURADO
            self._format_value(0),           # VL_TOT_DED
            self._format_value(total_icms),  # VL_ICMS_RECOLHER
            self._format_value(0),           # VL_SLD_CREDOR_TRANSPORTAR
            self._format_value(0)            # DEB_ESP
        )
    
    def _generate_block_h(self):
        """Bloco H - Inventário Físico."""
        # Registro H001 - Abertura do Bloco H
        self._add_line("H001", "1")  # 1 = Sem movimento
    
    def _generate_block_1(self):
        """Bloco 1 - Outras Informações."""
        # Registro 1001 - Abertura do Bloco 1
        self._add_line("1001", "1")  # 1 = Sem movimento
    
    def _generate_block_9(self):
        """Bloco 9 - Controle e Encerramento."""
        
        # Registro 9001 - Abertura do Bloco 9
        self._add_line("9001", "0")
        
        # Registro 9900 - Registros do arquivo
        # Contar todos os registros por tipo
        total_lines = len(self.lines) + 5  # +5 para registros finais
        
        for reg_type, count in sorted(self.record_count.items()):
            self._add_line("9900", reg_type, str(count))
        
        # Adicionar contagem dos registros do bloco 9
        self._add_line("9900", "9001", "1")
        self._add_line("9900", "9900", str(len(self.record_count) + 3))
        self._add_line("9900", "9990", "1")
        self._add_line("9900", "9999", "1")
        
        # Registro 9990 - Encerramento do Bloco 9
        self._add_line("9990", str(len([l for l in self.lines if l.startswith("|9")]) + 2))
        
        # Registro 9999 - Encerramento do Arquivo Digital
        self._add_line("9999", str(len(self.lines) + 1))
    
    def generate(self) -> str:
        """Gera o arquivo SPED completo."""
        self.lines = []
        self.record_count = {}
        
        # Gerar blocos na ordem correta
        self._generate_block_0()
        self._generate_block_c()
        self._generate_block_e()
        self._generate_block_h()
        self._generate_block_1()
        
        # Inserir registro de encerramento do bloco 0
        block_0_count = len([l for l in self.lines if l.startswith("|0")])
        self.lines.insert(block_0_count, f"|0990|{block_0_count + 1}|")
        
        # Inserir encerramentos de outros blocos
        insertions = [
            ("|C", "|C990|"),
            ("|E", "|E990|"),
            ("|H", "|H990|"),
            ("|1", "|1990|"),
        ]
        
        for prefix, closing in insertions:
            count = len([l for l in self.lines if l.startswith(prefix)])
            idx = max(i for i, l in enumerate(self.lines) if l.startswith(prefix))
            self.lines.insert(idx + 1, f"{closing}{count + 1}|")
        
        # Gerar bloco 9 (encerramento)
        self._generate_block_9()
        
        return "\n".join(self.lines)


def generate_sped_fiscal(
    company_data: Dict,
    start_date: str,
    end_date: str,
    invoices: List[Dict]
) -> str:
    """
    Gera arquivo SPED Fiscal.
    
    Args:
        company_data: Dados da empresa
        start_date: Data início (YYYY-MM-DD)
        end_date: Data fim (YYYY-MM-DD)
        invoices: Lista de notas fiscais
    
    Returns:
        Conteúdo do arquivo SPED em formato texto
    """
    generator = SpedFiscalGenerator(
        company_data=company_data,
        start_date=date.fromisoformat(start_date),
        end_date=date.fromisoformat(end_date),
        invoices=invoices
    )
    return generator.generate()
