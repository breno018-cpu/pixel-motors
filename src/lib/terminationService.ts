import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { deleteUserAccount } from '@/lib/userService';
import type { RescisaoResultado } from './rescisaoCalculo';
import type { FuncionarioConcessionaria } from '@/hooks/useFolhaConcessionaria';
import { packEmployeeFolhaPayload } from '@/hooks/useFolhaConcessionaria';

function fmtMoney(val: number | undefined | null): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function maskCPF(cpf?: string | null): string {
  if (!cpf) return '—';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

export interface FinalizarDemissaoResult {
  success: boolean;
  payslipId?: string;
  credentialsDeactivated: boolean;
  message: string;
}

/**
 * Registra a última folha de pagamento da rescisão no banco de dados
 */
export async function registrarUltimaFolhaRescisao({
  funcionario,
  resultado,
}: {
  funcionario: FuncionarioConcessionaria;
  resultado: RescisaoResultado;
}): Promise<string | undefined> {
  const dDem = new Date(`${resultado.dataDemissao}T12:00:00`);
  const mes = dDem.getMonth() + 1;
  const ano = dDem.getFullYear();
  const payslipNumber = `REC-${Date.now().toString().slice(-6)}`;

  try {
    const { data: userAuth } = await supabase.auth.getUser();

    // 1. Grava o contracheque de rescisão na tabela de payslips
    const { data, error } = await (supabase as any)
      .from('payslips')
      .upsert(
        {
          payslip_number: payslipNumber,
          employee_id: funcionario.id,
          store_id: funcionario.store_id || null,
          reference_month: mes,
          reference_year: ano,
          base_salary: resultado.salarioBase,
          commission_amount: resultado.mediaComissoes,
          commission_sales_total: 0,
          bonus: resultado.adicionaisExtras.proventos,
          overtime: 0,
          inss_discount: resultado.descontos.totalINSS,
          irrf_discount: resultado.descontos.totalIRRF,
          other_discounts: resultado.descontos.avisoDescontado + resultado.descontos.outrosDescontos,
          net_total: resultado.liquidoRescisao,
          payment_date: resultado.dataDemissao,
          payment_method: 'Rescisão TRCT - Quitação Final',
          status: 'pago',
          notes: `ÚLTIMA FOLHA DE PAGAMENTO (RESCISÃO CONTRATUAL TRCT)\nMotivo: ${resultado.motivo}\nData Desligamento: ${resultado.dataDemissao}\nTotal Proventos: R$ ${resultado.totalBruto}\nTotal Descontos: R$ ${resultado.totalDescontos}\nLíquido Rescisório: R$ ${resultado.liquidoRescisao}`,
          created_by: userAuth.user?.id || null,
        },
        { onConflict: 'employee_id, reference_month, reference_year' }
      )
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn('Aviso ao registrar payslip no banco, continuando:', error.message);
    }
    return data?.id || payslipNumber;
  } catch (err) {
    console.warn('Falha silenciosa ao gravar payslip rescisório no banco:', err);
    return payslipNumber;
  }
}

/**
 * Desativa imediatamente o acesso do colaborador ao sistema:
 * 1. Atualiza `employees`: status = 'DEMITIDO', is_active = false
 * 2. Atualiza `profiles`: is_active = false (revoga credenciais)
 */
export async function desativarCredenciaisColaborador({
  funcionario,
  resultado,
}: {
  funcionario: FuncionarioConcessionaria;
  resultado: RescisaoResultado;
}): Promise<boolean> {
  let credentialsDeactivated = false;

  // 1. Desativa no cadastro de funcionários
  try {
    const payload = packEmployeeFolhaPayload(
      {
        ...funcionario,
        status: 'DEMITIDO',
        motivoStatus: `Rescisão TRCT (${resultado.motivo})`,
        dataStatus: resultado.dataDemissao,
      },
      funcionario.regularAdditions
    );

    await (supabase as any)
      .from('employees')
      .update({
        is_active: false,
        salary_additions: payload.salary_additions,
        notes: `[DESLIGADO EM ${resultado.dataDemissao}] Motivo: ${resultado.motivo}. Acessos revogados.`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', funcionario.id);
  } catch (empErr) {
    console.warn('Erro ao atualizar employee para demitido:', empErr);
  }

  // Auth access is revoked through the existing admin function, never profile fields.
  try {
    let targetProfileId = funcionario.rawEmployee?.profile_id;
    if (!targetProfileId && funcionario.email?.trim()) {
      const { data, error } = await supabase.from('profiles').select('id')
        .eq('email', funcionario.email.trim().toLowerCase()).maybeSingle();
      if (error) throw error;
      targetProfileId = data?.id;
    }
    if (targetProfileId) {
      await deleteUserAccount(targetProfileId);
      credentialsDeactivated = true;
    }
  } catch (profileErr) {
    console.warn('Erro ao desativar acesso do colaborador:', profileErr);
  }

  // 3. Registra auditoria de desligamento
  try {
    const auditKey = 'system_audit_logs';
    const existing = JSON.parse(localStorage.getItem(auditKey) || '[]');
    existing.unshift({
      timestamp: new Date().toISOString(),
      action: 'COLABORADOR_DESLIGADO_RESCISAO',
      details: {
        funcionarioId: funcionario.id,
        nome: funcionario.nome,
        cpf: funcionario.cpf,
        dataDemissao: resultado.dataDemissao,
        motivo: resultado.motivo,
        liquidoRescisao: resultado.liquidoRescisao,
        credenciaisDesativadas: credentialsDeactivated,
      },
    });
    localStorage.setItem(auditKey, JSON.stringify(existing.slice(0, 100)));
  } catch {}

  return credentialsDeactivated;
}

/**
 * Gera e baixa o PDF do Holerite / Contracheque da Última Folha de Rescisão
 */
export function downloadFinalTerminationPayslipPDF({
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
  };
}): void {
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

  // Cabeçalho
  doc.setFillColor(30, 35, 45);
  doc.rect(m, y, cw, 18, 'F');
  doc.setFillColor(220, 38, 38);
  doc.rect(m, y + 18, cw, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(empresa.razaoSocial || funcionario.storeName || 'CONCESSIONÁRIA SHINERAY', m + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 205, 215);
  doc.text(`CNPJ: ${empresa.cnpj || '18.456.789/0001-01'}  •  ${empresa.endereco || 'Divinópolis/MG'}`, m + 5, y + 13);

  // Box recibo rescisão
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('RECIBO DE QUITAÇÃO', pw - m - 5, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(220, 38, 38);
  doc.text('ÚLTIMA FOLHA / RESCISÃO', pw - m - 5, y + 13, { align: 'right' });

  y += 24;

  // Dados do Colaborador
  doc.setFillColor(245, 246, 248);
  doc.rect(m, y, cw, 14, 'F');
  doc.setDrawColor(220, 224, 230);
  doc.setLineWidth(0.3);
  doc.rect(m, y, cw, 14, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(110, 115, 125);
  doc.text('COLABORADOR:', m + 4, y + 4.5);
  doc.text('CPF:', m + cw * 0.5, y + 4.5);
  doc.text('MATRÍCULA / CARGO:', m + cw * 0.75, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(20, 24, 30);
  doc.text(funcionario.nome, m + 4, y + 9);
  doc.text(maskCPF(funcionario.cpf), m + cw * 0.5, y + 9);
  doc.text(`${funcionario.matricula || 'MAT-001'} - ${funcionario.cargo}`, m + cw * 0.75, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(110, 115, 125);
  doc.text('DATA ADMISSÃO:', m + 4, y + 13);
  doc.text('DATA DEMISSÃO:', m + cw * 0.35, y + 13);
  doc.text('TIPO DE CONTRATO:', m + cw * 0.7, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 24, 30);
  doc.text(new Date(`${resultado.dataAdmissao}T12:00:00`).toLocaleDateString('pt-BR'), m + 28, y + 13);
  doc.text(new Date(`${resultado.dataDemissao}T12:00:00`).toLocaleDateString('pt-BR'), m + cw * 0.35 + 26, y + 13);
  doc.text(funcionario.tipoContrato || 'CLT', m + cw * 0.7 + 28, y + 13);

  y += 18;

  // Tabela de Proventos e Descontos Rescisórios
  const colCod = m + 3;
  const colDesc = m + 15;
  const colRef = m + cw * 0.55;
  const colProv = m + cw * 0.78;
  const colDescVal = pw - m - 3;

  doc.setFillColor(30, 35, 45);
  doc.rect(m, y, cw, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('CÓD', colCod, y + 4.2);
  doc.text('VERBA RESCISÓRIA', colDesc, y + 4.2);
  doc.text('REF.', colRef, y + 4.2);
  doc.text('VENCIMENTOS', colProv, y + 4.2, { align: 'right' });
  doc.text('DESCONTOS', colDescVal, y + 4.2, { align: 'right' });
  y += 6.5;

  resultado.rubricasTRCT.forEach((r, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 253);
      doc.rect(m, y - 0.4, cw, 5.4, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(110, 115, 125);
    doc.text(r.codigo, colCod, y + 3.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(20, 24, 30);
    doc.text(doc.splitTextToSize(r.descricao, colRef - colDesc - 2)[0], colDesc, y + 3.2);

    doc.setFontSize(7);
    doc.setTextColor(110, 115, 125);
    doc.text(r.referencia, colRef, y + 3.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (r.provento > 0) {
      doc.setTextColor(16, 120, 70);
      doc.text(fmtMoney(r.provento), colProv, y + 3.2, { align: 'right' });
    } else {
      doc.setTextColor(170, 175, 185);
      doc.text('—', colProv, y + 3.2, { align: 'right' });
    }

    if (r.desconto > 0) {
      doc.setTextColor(190, 30, 30);
      doc.text(`- ${fmtMoney(r.desconto)}`, colDescVal, y + 3.2, { align: 'right' });
    } else {
      doc.setTextColor(170, 175, 185);
      doc.text('—', colDescVal, y + 3.2, { align: 'right' });
    }

    y += 5.2;
    doc.setDrawColor(230, 233, 238);
    doc.setLineWidth(0.2);
    doc.line(m, y - 0.4, pw - m, y - 0.4);
  });

  // Totais
  y += 2;
  doc.setFillColor(242, 244, 248);
  doc.rect(m, y, cw, 14, 'F');
  doc.setDrawColor(210, 215, 222);
  doc.setLineWidth(0.3);
  doc.rect(m, y, cw, 14, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 85, 95);
  doc.text('TOTAL PROVENTOS BRUTOS:', m + 4, y + 5);
  doc.text('TOTAL DEDUÇÕES / RETENÇÕES:', m + 4, y + 10);

  doc.setTextColor(20, 24, 30);
  doc.text(fmtMoney(resultado.totalBruto), m + 68, y + 5);
  doc.setTextColor(190, 30, 30);
  doc.text(`- ${fmtMoney(resultado.totalDescontos)}`, m + 68, y + 10);

  // Valor Líquido Destaque
  doc.setFillColor(16, 120, 70);
  doc.rect(pw - m - 60, y + 2, 58, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR LÍQUIDO RESCISÓRIO', pw - m - 31, y + 5.5, { align: 'center' });
  doc.setFontSize(10);
  doc.text(fmtMoney(resultado.liquidoRescisao), pw - m - 31, y + 10, { align: 'center' });

  y += 20;

  // Dados Bancários para Pagamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(110, 115, 125);
  const chavePix = funcionario.chavePix ? `PIX: ${funcionario.chavePix}` : 'PIX não cadastrado';
  const bancoInfo = funcionario.banco ? `Banco: ${funcionario.banco} | Ag: ${funcionario.agencia || '—'} | C/C: ${funcionario.conta || '—'}` : 'Conta em folha';
  doc.text(`DADOS BANCÁRIOS P/ PAGAMENTO: ${chavePix}  •  ${bancoInfo}`, m, y);
  y += 7;

  // Termo de Quitação e Assinatura
  doc.setFillColor(248, 249, 251);
  doc.rect(m, y, cw, 34, 'F');
  doc.setDrawColor(220, 224, 230);
  doc.rect(m, y, cw, 34, 'D');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(70, 75, 85);
  const reciboTexto =
    'DECLARAÇÃO DE QUITAÇÃO DA ÚLTIMA FOLHA DE PAGAMENTO:\n' +
    'Declaro ter conferido e recebido da empresa acima qualificada a importância líquida supra descrita, dando plena e irrevogável quitação do saldo da última folha de pagamento e verbas rescisórias discriminadas. Atesto outrossim a ciência da revogação integral de todas as credenciais de acesso e uso aos sistemas informatizados da empresa nesta data.';
  doc.text(doc.splitTextToSize(reciboTexto, cw - 8), m + 4, y + 5);

  const sigLineW = 56;
  const colSig1 = m + cw * 0.25;
  const colSig2 = m + cw * 0.75;
  const sigY = y + 26;

  doc.setDrawColor(180, 185, 195);
  doc.setLineWidth(0.4);
  doc.line(colSig1 - sigLineW / 2, sigY, colSig1 + sigLineW / 2, sigY);
  doc.line(colSig2 - sigLineW / 2, sigY, colSig2 + sigLineW / 2, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(20, 24, 30);
  doc.text('EMPREGADOR / CONCESSIONÁRIA', colSig1, sigY + 3.5, { align: 'center' });
  doc.text('COLABORADOR (ASSINATURA DE QUITAÇÃO)', colSig2, sigY + 3.5, { align: 'center' });

  const cleanName = funcionario.nome.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Ultima_Folha_Rescisao_${cleanName}_${resultado.dataDemissao}.pdf`);
}
