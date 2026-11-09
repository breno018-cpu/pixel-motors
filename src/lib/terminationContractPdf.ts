import jsPDF from 'jspdf';
import type { RescisaoResultado } from './rescisaoCalculo';
import type { FuncionarioConcessionaria } from '@/hooks/useFolhaConcessionaria';

function fmtMoney(val: number | undefined | null): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function maskCPF(cpf?: string | null): string {
  if (!cpf) return '—';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

export function generateTerminationContractPDF({
  funcionario,
  resultado,
  empresa,
}: {
  funcionario: FuncionarioConcessionaria;
  resultado: RescisaoResultado;
  empresa: {
    razaoSocial?: string;
    cnpj?: string;
    endereco?: string;
    cidade?: string;
    telefone?: string;
  };
}): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 14;
  const cw = pw - 2 * m;
  let y = m;

  const ensureSpace = (needed: number) => {
    if (y + needed > ph - 16) {
      doc.addPage();
      y = m;
    }
  };

  // ─── CABEÇALHO OFICIAL ───
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 25);
  doc.text('TERMO DE RESCISÃO DO CONTRATO DE TRABALHO (TRCT)', pw / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 95, 105);
  doc.text(
    'Instrumento de Homologação, Discriminação de Verbas Rescisórias e Quitação Contratual',
    pw / 2,
    y,
    { align: 'center' }
  );
  y += 4;

  // Linha fina separadora
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.6);
  doc.line(m, y, pw - m, y);
  y += 5;

  // ─── QUADRO 1: IDENTIFICAÇÃO DO EMPREGADOR ───
  const drawSectionTitle = (title: string) => {
    ensureSpace(8);
    doc.setFillColor(245, 246, 248);
    doc.rect(m, y, cw, 6, 'F');
    doc.setFillColor(220, 38, 38);
    doc.rect(m, y, 1.4, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 24, 30);
    doc.text(title.toUpperCase(), m + 3.5, y + 4.2);
    y += 8;
  };

  const drawRow = (fields: Array<{ label: string; value: string; widthRatio: number }>) => {
    ensureSpace(8);
    let curX = m;
    fields.forEach((f) => {
      const fieldW = cw * f.widthRatio;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(110, 115, 125);
      doc.text(f.label.toUpperCase(), curX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(20, 24, 30);
      const textVal = doc.splitTextToSize(f.value || '—', fieldW - 2)[0];
      doc.text(textVal, curX, y + 4);

      curX += fieldW;
    });
    y += 7.5;
  };

  // 1. EMPREGADOR
  drawSectionTitle('1. Identificação do Empregador');
  drawRow([
    { label: 'Razão Social / Nome Fantasia', value: empresa.razaoSocial || funcionario.storeName || 'CONCESSIONÁRIA SHINERAY', widthRatio: 0.55 },
    { label: 'CNPJ / MF', value: empresa.cnpj || '18.456.789/0001-01', widthRatio: 0.45 },
  ]);
  drawRow([
    { label: 'Endereço Completo', value: empresa.endereco || 'Av. Autorama, 1200 - Divinópolis/MG', widthRatio: 0.7 },
    { label: 'Telefone / Contato', value: empresa.telefone || '(37) 3222-1000', widthRatio: 0.3 },
  ]);

  // 2. TRABALHADOR
  drawSectionTitle('2. Identificação do Trabalhador');
  drawRow([
    { label: 'Nome Completo do Colaborador', value: funcionario.nome, widthRatio: 0.55 },
    { label: 'CPF', value: maskCPF(funcionario.cpf), widthRatio: 0.25 },
    { label: 'Matrícula', value: funcionario.matricula || 'MAT-001', widthRatio: 0.2 },
  ]);
  drawRow([
    { label: 'Cargo / Função', value: funcionario.cargo, widthRatio: 0.4 },
    { label: 'Departamento / Setor', value: funcionario.departamento || 'COMERCIAL', widthRatio: 0.3 },
    { label: 'Tipo de Vínculo', value: funcionario.tipoContrato || 'CLT', widthRatio: 0.3 },
  ]);

  // 3. DADOS CONTRATUAIS DO DESLIGAMENTO
  drawSectionTitle('3. Dados do Contrato e Afastamento');
  const motivoTextoMap: Record<string, string> = {
    SEM_JUSTA_CAUSA: 'Dispensa sem justa causa pelo empregador',
    PEDIDO_DEMISSAO: 'Pedido de demissão pelo empregado',
    ACORDO_MUTUO: 'Extinção do contrato por acordo mútuo (Art. 484-A CLT)',
    COM_JUSTA_CAUSA: 'Dispensa com justa causa pelo empregador',
    TERMINO_CONTRATO: 'Término de contrato de trabalho por prazo determinado',
  };

  drawRow([
    { label: 'Causa do Afastamento', value: motivoTextoMap[resultado.motivo] || resultado.motivo, widthRatio: 0.6 },
    { label: 'Maior Remuneração Rescisória', value: fmtMoney(resultado.baseCalculoRescisoria), widthRatio: 0.4 },
  ]);
  drawRow([
    { label: 'Data de Admissão', value: fmtDate(resultado.dataAdmissao), widthRatio: 0.25 },
    { label: 'Data do Desligamento', value: fmtDate(resultado.dataDemissao), widthRatio: 0.25 },
    { label: 'Projeção do Aviso Prévio', value: fmtDate(resultado.dataProjetadaAviso), widthRatio: 0.25 },
    { label: 'Tempo de Serviço', value: resultado.tempoServico.textoFormatado, widthRatio: 0.25 },
  ]);

  // 4. DISCRIMINAÇÃO DAS VERBAS RESCISÓRIAS (RUBRICAS TRCT)
  drawSectionTitle('4. Discriminação das Verbas Rescisórias');
  ensureSpace(12);

  // Cabeçalho da Tabela de Rubricas
  const colCod = m + 2;
  const colDesc = m + 14;
  const colRef = m + cw * 0.58;
  const colProv = m + cw * 0.78;
  const colDescVal = pw - m - 2;

  doc.setFillColor(30, 35, 45);
  doc.rect(m, y, cw, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('CÓD', colCod, y + 4.2);
  doc.text('RUBRICA / ESPECIFICAÇÃO DAS VERBAS', colDesc, y + 4.2);
  doc.text('REFERÊNCIA', colRef, y + 4.2);
  doc.text('PROVENTOS', colProv, y + 4.2, { align: 'right' });
  doc.text('DEDUÇÕES', colDescVal, y + 4.2, { align: 'right' });
  y += 6.5;

  resultado.rubricasTRCT.forEach((r, idx) => {
    ensureSpace(6);
    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 253);
      doc.rect(m, y - 0.5, cw, 5.5, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 105, 115);
    doc.text(r.codigo, colCod, y + 3.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(20, 24, 30);
    const descText = doc.splitTextToSize(r.descricao, colRef - colDesc - 2)[0];
    doc.text(descText, colDesc, y + 3.2);

    doc.setFontSize(7);
    doc.setTextColor(100, 105, 115);
    doc.text(r.referencia, colRef, y + 3.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (r.provento > 0) {
      doc.setTextColor(16, 120, 70);
      doc.text(fmtMoney(r.provento), colProv, y + 3.2, { align: 'right' });
    } else {
      doc.setTextColor(160, 165, 175);
      doc.text('—', colProv, y + 3.2, { align: 'right' });
    }

    if (r.desconto > 0) {
      doc.setTextColor(190, 30, 30);
      doc.text(`- ${fmtMoney(r.desconto)}`, colDescVal, y + 3.2, { align: 'right' });
    } else {
      doc.setTextColor(160, 165, 175);
      doc.text('—', colDescVal, y + 3.2, { align: 'right' });
    }

    y += 5.2;
    doc.setDrawColor(230, 233, 238);
    doc.setLineWidth(0.2);
    doc.line(m, y - 0.5, pw - m, y - 0.5);
  });

  // Linha de Totais e Saldo Líquido
  ensureSpace(20);
  y += 2;
  doc.setFillColor(242, 244, 248);
  doc.rect(m, y, cw, 12, 'F');
  doc.setDrawColor(210, 215, 222);
  doc.setLineWidth(0.3);
  doc.rect(m, y, cw, 12, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 75, 85);
  doc.text('TOTAL DE PROVENTOS BRUTOS:', m + 4, y + 4.5);
  doc.text('TOTAL DE DEDUÇÕES / DESCONTOS:', m + 4, y + 9);

  doc.setTextColor(20, 24, 30);
  doc.text(fmtMoney(resultado.totalBruto), m + 68, y + 4.5);
  doc.setTextColor(190, 30, 30);
  doc.text(`- ${fmtMoney(resultado.totalDescontos)}`, m + 68, y + 9);

  // Caixa do Valor Líquido
  doc.setFillColor(220, 38, 38);
  doc.rect(pw - m - 64, y + 1.5, 62, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR LÍQUIDO A RECEBER', pw - m - 33, y + 4.6, { align: 'center' });
  doc.setFontSize(9.5);
  doc.text(fmtMoney(resultado.liquidoRescisao), pw - m - 33, y + 8.8, { align: 'center' });
  y += 16;

  // 5. INFORMAÇÕES DE FGTS & SAQUE
  if (resultado.fgts.saqueLiberado) {
    ensureSpace(14);
    doc.setFillColor(245, 248, 255);
    doc.setDrawColor(190, 210, 245);
    doc.setLineWidth(0.3);
    doc.roundedRect(m, y, cw, 10, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(20, 60, 140);
    doc.text('FGTS RESCISÓRIO E GUIA RECOLHIMENTO (GRRF):', m + 4, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(50, 70, 110);
    doc.text(
      `Multa Rescisória de ${resultado.fgts.percentualMulta}% s/ Saldo de R$ ${fmtMoney(resultado.fgts.saldoInformado)}: ` +
        `Total a recolher via GRRF = ${fmtMoney(resultado.fgts.multaRescisoria)}. Código de Saque Autorizado (01/Chave Conectividade).`,
      m + 4,
      y + 7.5
    );
    y += 14;
  }

  // 6. TERMO DE HOMOLOGAÇÃO, QUITAÇÃO E REVOGAÇÃO DE ACESSO
  ensureSpace(28);
  drawSectionTitle('5. Termo de Quitação e Revogação de Credenciais');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(70, 75, 85);

  const clausulasTermo = [
    '5.1. O(A) empregado(a) dá plena e geral quitação exclusivamente dos valores e parcelas discriminados nas rubricas deste termo, sem prejuízo de eventuais diferenças ressalvadas.',
    '5.2. O pagamento das verbas rescisórias supra deverá ser efetuado na forma da legislação vigente (Art. 477 da CLT), no prazo máximo de 10 (dez) dias corridos.',
    '5.3. REVOGAÇÃO DE ACESSOS: Fica expressamente atestado que todas as credenciais de login, senhas e acessos operacionais do(a) colaborador(a) aos sistemas digitais e bancos de dados da concessionária foram formalmente revogados e desativados nesta data.',
  ];

  clausulasTermo.forEach((cl) => {
    const lines = doc.splitTextToSize(cl, cw);
    doc.text(lines, m, y);
    y += lines.length * 3.2 + 0.8;
  });
  y += 5;

  // 7. ASSINATURAS
  ensureSpace(28);
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 95, 105);
  doc.text(`Local e Data: ${empresa.cidade || 'Divinópolis/MG'}, ${dataHoje}`, m, y);
  y += 12;

  const sigW = 54;
  const colSig1 = m + cw * 0.25;
  const colSig2 = m + cw * 0.75;

  doc.setDrawColor(180, 185, 195);
  doc.setLineWidth(0.4);
  doc.line(colSig1 - sigW / 2, y, colSig1 + sigW / 2, y);
  doc.line(colSig2 - sigW / 2, y, colSig2 + sigW / 2, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(20, 24, 30);
  doc.text('EMPREGADOR (CONCESSIONÁRIA)', colSig1, y + 4, { align: 'center' });
  doc.text('TRABALHADOR / EMPREGADO', colSig2, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 95, 105);
  doc.text(empresa.razaoSocial || funcionario.storeName || 'CONCESSIONÁRIA SHINERAY', colSig1, y + 7.5, { align: 'center' });
  doc.text(`${funcionario.nome} — CPF: ${maskCPF(funcionario.cpf)}`, colSig2, y + 7.5, { align: 'center' });

  // Rodapé em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(210, 215, 222);
    doc.setLineWidth(0.3);
    doc.line(m, ph - 10, pw - m, ph - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 125, 135);
    doc.text(
      `TRCT emitido eletronicamente via Sistema Concessionária em ${new Date().toLocaleString('pt-BR')}`,
      m,
      ph - 6.5
    );
    doc.text(`Página ${i} de ${totalPages}`, pw - m, ph - 6.5, { align: 'right' });
  }

  return doc;
}

export function downloadTerminationContractPDF(params: {
  funcionario: FuncionarioConcessionaria;
  resultado: RescisaoResultado;
  empresa: {
    razaoSocial?: string;
    cnpj?: string;
    endereco?: string;
    cidade?: string;
    telefone?: string;
  };
}): void {
  const doc = generateTerminationContractPDF(params);
  const cleanName = params.funcionario.nome.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`TRCT_Rescisao_${cleanName}_${params.resultado.dataDemissao}.pdf`);
}
