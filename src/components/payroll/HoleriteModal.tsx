import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  Printer,
  Download,
  Loader2,
  X,
  MessageCircle,
  Copy,
  CheckCircle2,
  Clock,
  Building2,
  ShieldCheck,
  Check,
  Store,
  Save,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  EmpresaFolhaConfig,
  ResultadoFolhaFuncionario,
  sanitizarResultadoFolha,
} from '@/lib/folhaCalculos';
import { FuncionarioConcessionaria } from '@/hooks/useFolhaConcessionaria';
import { useStores, DEFAULT_DEALERSHIP_STORES } from '@/hooks/useStores';
import { resolveSaleStore } from '@/lib/storeResolution';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export interface HoleriteModalProps {
  dados: {
    empresa?: EmpresaFolhaConfig | null;
    funcionario?: FuncionarioConcessionaria | null;
    folha?: ResultadoFolhaFuncionario | null;
    isPago?: boolean;
    dataPagamento?: string | null;
    onTogglePago?: () => void;
    onDownloadPdf?: () => void;
    onSendWhatsapp?: () => void;
    onSalvarEmpresa?: (config: Partial<EmpresaFolhaConfig>) => Promise<void> | void;
  } | null;
  onClose: () => void;
}

/**
 * Sanitiza qualquer texto exibido no contracheque para remover terminantemente:
 * - Menções a leis e súmulas (ex: Lei 605/49, Súm. 27 TST, etc.)
 * - Menções a artigos (ex: Art. 457 §2º CLT, Artigo 477, etc.)
 * - Menções a indenização (ex: Indenizatória, Indenizatório, Indenização, etc.)
 * - Menções isoladas a CLT que possam poluir o comprovante
 */
export function sanitizarTextoHolerite(texto?: string | null): string {
  if (!texto) return '';
  return texto
    // Remove menções a leis e súmulas: (Lei 605/49), Lei 605, etc.
    .replace(/\(?\bLei\s+[\d\.\/-]+[a-zA-Z]?\b\)?/gi, '')
    .replace(/\(?\bSúm\.?\s*\d+\s*(?:do\s*)?TST\b\)?/gi, '')
    // Remove menções a artigos: (Art. 457 §2º CLT), Art. 457, Artigo 457, § 2º CLT, etc.
    .replace(/\(?\b(?:Art\.?|Artigo)\s+[\d\w\.\§\º\°\-\/\s]+(?:CLT|CF|CC|CDC)?\)?/gi, '')
    .replace(/\b§+\s*[\d\w\.\º\°\-]+\b/gi, '')
    // Remove menções a indenização/indenizatória/indenizatório
    .replace(/\(?\b(?:indenizatório|indenizatória|indenizatórios|indenizatórias|indenizatorio|indenizatoria|indenizatorios|indenizatorias|indenização|indenizacoes|indenizações|indenizacao)\b\)?/gi, '')
    // Remove menções isoladas a CLT
    .replace(/\(?\bCLT\b\)?/gi, '')
    // Limpa pontuação, parênteses ou traços residuais
    .replace(/\(\s*[-–/]?\s*\)/g, '')
    .replace(/\s*[-–/]\s*$/g, '')
    .replace(/^\s*[-–/]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Padroniza os nomes das rubricas respeitando sempre as descrições personalizadas preenchidas pelo usuário
 */
function formatarDescricaoRubrica(rubrica: string): string {
  if (!rubrica) return 'Provento';
  const r = rubrica.trim();

  // 1. Se o usuário digitou uma descrição personalizada (contém dois pontos ":"),
  // PRESERVA e destaca a descrição real que ele preencheu, removendo qualquer prefixo de comissão!
  if (r.includes(':')) {
    const parts = r.split(':');
    const prefixo = parts[0].trim();
    const textoCustom = parts.slice(1).join(':').trim();
    if (textoCustom) {
      const pLower = prefixo.toLowerCase();
      // Não exibe como comissão: exibe apenas a descrição!
      if (
        pLower === 'comissão' ||
        pLower === 'comissao' ||
        pLower.startsWith('comiss')
      ) {
        return sanitizarTextoHolerite(textoCustom);
      }
      if (pLower.includes('outro gasto') || pLower.includes('outro desconto')) {
        return sanitizarTextoHolerite(`Desconto: ${textoCustom}`);
      }
      if (pLower.includes('outro ganho') || pLower.includes('outro provento')) {
        return sanitizarTextoHolerite(`Provento: ${textoCustom}`);
      }
      return sanitizarTextoHolerite(`${prefixo}: ${textoCustom}`);
    }
  }

  const lower = r.toLowerCase();

  // 2. Remove prefixos caso venham sem espaço
  if (lower.startsWith('comissão:') || lower.startsWith('comissao:')) {
    return sanitizarTextoHolerite(r.substring(r.indexOf(':') + 1).trim());
  }

  // 3. Apenas se não houver descrição personalizada, aplica padronização contábil limpa (sem leis/artigos/indenizações)
  if (lower === 'salario base' || lower === 'salário base') return 'Salário Base Contratual';
  if (
    lower === 'volume loja' ||
    lower === 'comissao volume' ||
    lower === 'comissão volume'
  ) {
    return 'Comissão por Volume da Concessionária (Gerência)';
  }
  if (lower === 'comissao plus' || lower === 'comissão plus') {
    return 'Comissão de Vendas de Veículos (Modelo Plus)';
  }
  if (lower === 'marketing proprio' || lower === 'marketing próprio' || lower === 'comissao marketing proprio') {
    return 'Comissão por Captação / Marketing Próprio';
  }
  if (lower === 'comissao montagem' || lower === 'comissão montagem') {
    return 'Comissão Montagem de Motos (Mecânico)';
  }
  if (lower === 'comissao revisao' || lower === 'comissão revisão') {
    return 'Comissão Revisões Periódicas (Mecânico)';
  }
  if (lower === 'comissao f&i' || lower === 'comissão f&i' || lower === 'retorno f&i') {
    return 'Comissão de Financiamento & Seguros (F&I)';
  }
  if (lower === 'comissao' || lower === 'comissão' || lower === 'comissao motos') {
    return 'Comissão sobre Vendas de Motos / Veículos';
  }
  if (
    lower === 'bonus meta' ||
    lower === 'bônus meta' ||
    lower === 'meta atingida'
  ) {
    return 'Bônus por Atingimento de Metas da Loja';
  }
  if (
    lower.includes('dsr comiss') ||
    lower.includes('dsr s/ comiss') ||
    lower.includes('dsr sobre comiss')
  ) {
    return 'D.S.R. sobre Comissões e Prêmios';
  }
  if (lower === 'ajuda de custo' || lower.includes('ajuda de custo')) {
    return 'Ajuda de Custo';
  }
  if (lower === 'reembolso de despesas' || lower === 'reembolso de gastos' || lower.includes('reembolso')) {
    return 'Reembolso de Despesas da Loja';
  }
  if (lower === 'gastos com a loja' || lower === 'gastos diversos') {
    return 'Gastos com a Loja / Adiantamento Operacional';
  }
  if (lower === 'adicional de insalubridade' || lower === 'insalubridade') {
    return 'Adicional de Insalubridade';
  }
  if (lower.includes('periculosidade')) {
    return 'Adicional de Periculosidade (30%)';
  }
  if (lower === 'horas extras 50%' || lower === 'he 50%') {
    return 'Horas Extras (50%)';
  }
  if (lower === 'horas extras 100%' || lower === 'he 100%') {
    return 'Horas Extras (100%)';
  }
  if (lower === 'adicional noturno' || lower.includes('noturno (20%)')) {
    return 'Adicional Noturno';
  }
  if (lower.includes('dsr') && lower.includes('hora')) {
    return 'D.S.R. sobre Horas Extras e Noturno';
  }
  if (lower === 'inss' || lower.includes('desconto inss') || lower.includes('inss ')) {
    return 'INSS - Previdência Social';
  }
  if (lower === 'irrf' || lower.includes('desconto irrf') || lower.includes('irrf ')) {
    return 'IRRF - Imposto de Renda Retido na Fonte';
  }
  if (
    lower.includes('transporte') ||
    lower.includes('vale transporte') ||
    lower === 'vt'
  ) {
    return 'Desconto Vale-Transporte (6%)';
  }
  if (
    lower.includes('refeicao') ||
    lower.includes('refeição') ||
    lower.includes('alimentação') ||
    lower === 'vr'
  ) {
    return 'Desconto Vale-Refeição / Alimentação';
  }
  if (
    lower.includes('saude') ||
    lower.includes('saúde') ||
    lower.includes('medico') ||
    lower.includes('médico') ||
    lower.includes('odonto')
  ) {
    return 'Desconto Assistência Médica / Odontológica';
  }
  if (lower.includes('falta') || lower.includes('atraso')) {
    return 'Faltas Injustificadas e D.S.R.';
  }

  // Se nenhuma regra padrão bateu, retorna exatamente o que foi digitado sem menções legais/indenizatórias!
  return sanitizarTextoHolerite(r);
}

/**
 * Atribui códigos numéricos padrão de DP/eSocial para cada rubrica
 */
function obterCodigoRubrica(rubrica: string, isDesconto: boolean, idx: number): string {
  const lower = (rubrica || '').toLowerCase();
  if (isDesconto) {
    if (lower.includes('inss')) return '901';
    if (lower.includes('irrf')) return '905';
    if (lower.includes('transporte') || lower.includes('vt')) return '910';
    if (lower.includes('refeicao') || lower.includes('refeição') || lower.includes('vr')) return '915';
    if (lower.includes('saude') || lower.includes('saúde') || lower.includes('plano')) return '920';
    if (lower.includes('falta') || lower.includes('atraso')) return '950';
    if (lower.includes('pensao') || lower.includes('pensão')) return '960';
    return String(970 + idx).padStart(3, '0');
  } else {
    if (lower.includes('salario') || lower.includes('salário')) return '001';
    if (lower.includes('comissao') || lower.includes('comissão')) return '015';
    if (lower.includes('dsr')) return '020';
    if (lower.includes('bonus') || lower.includes('bônus') || lower.includes('meta')) return '030';
    if (lower.includes('montagem')) return '040';
    if (lower.includes('revisao') || lower.includes('revisão')) return '045';
    if (lower.includes('50%')) return '051';
    if (lower.includes('100%')) return '052';
    if (lower.includes('noturno')) return '060';
    if (lower.includes('ajuda de custo')) return '080';
    return String(100 + idx).padStart(3, '0');
  }
}

/**
 * Formata o mês de competência por extenso (ex: "Outubro de 2026")
 */
function formatarCompetenciaExtenso(mesAno?: string | null): string {
  if (!mesAno) return 'Competência Atual';
  const parts = String(mesAno).split('-');
  if (parts.length === 2) {
    const ano = parts[0];
    const mesNum = Number(parts[1]);
    const nomes = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    if (mesNum >= 1 && mesNum <= 12) {
      return `${nomes[mesNum - 1]} de ${ano} (${String(mesNum).padStart(2, '0')}/${ano})`;
    }
  }
  return mesAno;
}

function HoleriteModalContent({ dados, onClose }: HoleriteModalProps) {
  const { toast } = useToast();
  const [copiadoPix, setCopiadoPix] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [baixandoImagem, setBaixandoImagem] = useState(false);
  const [modalEditarEmpresaOpen, setModalEditarEmpresaOpen] = useState(false);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const holeriteRef = useRef<HTMLDivElement>(null);

  if (!dados) return null;

  const {
    empresa: empresaInicial,
    funcionario,
    isPago,
    dataPagamento,
    onTogglePago,
    onDownloadPdf,
    onSendWhatsapp,
    onSalvarEmpresa,
  } = dados;

  // Consulta oficial das lojas cadastradas centralmente na aba Organização
  const { data: stores = [] } = useStores();

  // 1. Identifica a loja oficial do colaborador a partir do cadastro em Organização
  const storeIdFuncionario = useMemo(() => {
    if (funcionario?.store_id && funcionario.store_id !== 'all') {
      return funcionario.store_id;
    }
    const resolved = resolveSaleStore({
      store_id: funcionario?.store_id,
      vendedor: funcionario?.nome,
    });
    return resolved.storeId;
  }, [funcionario]);

  // 2. Busca os dados cadastrais da concessionária diretamente de Organização (stores)
  const lojaOrganizacao = useMemo(() => {
    return (
      stores.find((s) => s.id === storeIdFuncionario) ||
      stores.find((s) => s.id === empresaInicial?.storeId) ||
      (storeIdFuncionario === 'store-montesclaros'
        ? stores.find((s) => s.city?.toLowerCase().includes('montes')) || DEFAULT_DEALERSHIP_STORES[1]
        : stores.find((s) => s.city?.toLowerCase().includes('divin')) || DEFAULT_DEALERSHIP_STORES[0])
    );
  }, [stores, storeIdFuncionario, empresaInicial]);

  // 3. Monta o perfil corporativo da concessionária usando como fonte primária a aba Organização
  const configLojaResolvida = useMemo((): EmpresaFolhaConfig => {
    const st = lojaOrganizacao;
    const isMontes = (st?.name || st?.city || storeIdFuncionario || '').toLowerCase().includes('montes');
    const base: Partial<EmpresaFolhaConfig> = (empresaInicial as any) || {};
    return {
      razaoSocial: st?.name || base.razaoSocial || (isMontes ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis'),
      nomeFantasia: st?.name || base.nomeFantasia || (isMontes ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis'),
      cnpj: (st?.cnpj && !st.cnpj.startsWith('00.000')) ? st.cnpj : (base.cnpj && !base.cnpj.startsWith('00.000')) ? base.cnpj : (isMontes ? '18.456.789/0002-82' : '18.456.789/0001-01'),
      inscricaoEstadual: base.inscricaoEstadual || '',
      endereco: st?.address || base.endereco || (isMontes ? 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG' : 'Av. Autorama, 1200 - Judeia, Divinópolis/MG'),
      bairro: base.bairro || (isMontes ? 'Centro' : 'Judeia'),
      cidade: st?.city || base.cidade || (isMontes ? 'Montes Claros' : 'Divinópolis'),
      uf: st?.state || base.uf || 'MG',
      cep: base.cep || (isMontes ? '39400-000' : '35500-000'),
      telefone: st?.phone || base.telefone || (isMontes ? '(38) 3221-2000' : '(37) 3222-1000'),
      logoUrl: base.logoUrl || '',
      regimeTributario: base.regimeTributario || 'LUCRO_PRESUMIDO',
      textoMarcaDagua: base.textoMarcaDagua || '',
      opacidadeMarcaDagua: base.opacidadeMarcaDagua ?? 0.04,
      exibirMarcaDagua: base.exibirMarcaDagua ?? 0,
      regrasComissao: base.regrasComissao || [],
      regrasComissaoPlus: base.regrasComissaoPlus || { valorMarketingProprio: 500, faixas: [] },
      tiposComissoesLoja: base.tiposComissoesLoja || [],
      regrasComissoesCargos: base.regrasComissoesCargos || ({} as any),
      storeId: st?.id || base.storeId || storeIdFuncionario,
      storeName: st?.name || base.storeName || '',
    };
  }, [lojaOrganizacao, empresaInicial, storeIdFuncionario]);

  // Estado local para o holerite — inicializado diretamente da loja oficial em Organização
  const [empresaState, setEmpresaState] = useState<EmpresaFolhaConfig>(configLojaResolvida);

  // Formulário de edição centralizado
  const [formEmpresa, setFormEmpresa] = useState({
    razaoSocial: configLojaResolvida.razaoSocial || '',
    nomeFantasia: configLojaResolvida.nomeFantasia || '',
    cnpj: configLojaResolvida.cnpj || '',
    inscricaoEstadual: configLojaResolvida.inscricaoEstadual || '',
    endereco: configLojaResolvida.endereco || '',
    bairro: configLojaResolvida.bairro || '',
    cidade: configLojaResolvida.cidade || '',
    uf: configLojaResolvida.uf || '',
    cep: configLojaResolvida.cep || '',
    telefone: configLojaResolvida.telefone || '',
    logoUrl: configLojaResolvida.logoUrl || '',
    textoMarcaDagua: configLojaResolvida.textoMarcaDagua || '',
    exibirMarcaDagua: Boolean(configLojaResolvida.exibirMarcaDagua),
  });

  // Atualiza automaticamente o holerite sempre que a loja correspondente em Organização for carregada
  useEffect(() => {
    if (configLojaResolvida) {
      setEmpresaState(configLojaResolvida);
      setFormEmpresa({
        razaoSocial: configLojaResolvida.razaoSocial || '',
        nomeFantasia: configLojaResolvida.nomeFantasia || '',
        cnpj: configLojaResolvida.cnpj || '',
        inscricaoEstadual: configLojaResolvida.inscricaoEstadual || '',
        endereco: configLojaResolvida.endereco || '',
        bairro: configLojaResolvida.bairro || '',
        cidade: configLojaResolvida.cidade || '',
        uf: configLojaResolvida.uf || '',
        cep: configLojaResolvida.cep || '',
        telefone: configLojaResolvida.telefone || '',
        logoUrl: configLojaResolvida.logoUrl || '',
        textoMarcaDagua: configLojaResolvida.textoMarcaDagua || '',
        exibirMarcaDagua: Boolean(configLojaResolvida.exibirMarcaDagua),
      });
    }
  }, [configLojaResolvida]);

  // Sanitiza a folha para garantir consistência em todos os campos
  const folha: ResultadoFolhaFuncionario = sanitizarResultadoFolha(dados.folha, funcionario);

  const formatarMoeda = (val?: number | string | null) => {
    return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCopyPix = () => {
    const pix = funcionario?.chavePix;
    if (!pix) return;
    navigator.clipboard.writeText(pix);
    setCopiadoPix(true);
    setTimeout(() => setCopiadoPix(false), 2000);
    toast({
      title: 'Chave PIX copiada!',
      description: `${pix} (${funcionario?.nome || folha.funcionarioNome}) • Líquido: ${formatarMoeda(folha.salarioLiquido)}`,
    });
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error('Erro ao imprimir:', e);
    }
  };

  // EXPORTAÇÃO EM IMAGEM ALTA DEFINIÇÃO (PNG 300 DPI)
  const handleDownloadImage = async () => {
    if (!holeriteRef.current) return;
    try {
      setBaixandoImagem(true);
      toast({
        title: 'Gerando imagem em alta resolução...',
        description: 'Processando holerite sem cortes e com proporções calibradas.',
      });

      const element = holeriteRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 840,
        scrollY: 0,
        scrollX: 0,
      });

      const nomeLimpo = (funcionario?.nome || folha.funcionarioNome || 'colaborador')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_');
      const mesLimpo = (folha.mesReferencia || 'competencia').replace(/[^a-z0-9]/g, '-');
      const fileName = `recibo_pagamento_${nomeLimpo}_${mesLimpo}.png`;

      const imageUri = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = imageUri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download da Imagem concluído!',
        description: `Arquivo ${fileName} salvo com sucesso.`,
      });
    } catch (err) {
      console.error('Erro ao gerar imagem do holerite:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar imagem',
        description: 'Não foi possível exportar a imagem. Tente a opção PDF ou Imprimir.',
      });
    } finally {
      setBaixandoImagem(false);
    }
  };

  // EXPORTAÇÃO EM PDF OFICIAL PADRÃO A4
  const handleDownloadPdf = async () => {
    if (!holeriteRef.current) {
      if (onDownloadPdf) onDownloadPdf();
      return;
    }

    try {
      setBaixandoPdf(true);
      toast({
        title: 'Gerando PDF oficial...',
        description: 'Estruturando o documento com proporção A4 padrão contábil.',
      });

      const element = holeriteRef.current;

      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 840,
        scrollY: 0,
        scrollX: 0,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const printableWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * printableWidth) / canvas.width;

      if (imgHeight <= pdfHeight - margin * 2) {
        pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = margin;

        pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
        heightLeft -= (pdfHeight - margin * 2);

        while (heightLeft > 0) {
          position = margin - (imgHeight - heightLeft);
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, position, printableWidth, imgHeight);
          heightLeft -= (pdfHeight - margin * 2);
        }
      }

      const nomeLimpo = (funcionario?.nome || folha.funcionarioNome || 'colaborador')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_');
      const mesLimpo = (folha.mesReferencia || 'competencia').replace(/[^a-z0-9]/g, '-');
      pdf.save(`recibo_pagamento_${nomeLimpo}_${mesLimpo}.pdf`);

      toast({
        title: 'Download concluído!',
        description: 'O holerite em PDF oficial foi baixado com sucesso.',
      });
    } catch (err) {
      console.error('Erro ao gerar PDF do holerite:', err);
      if (onDownloadPdf) {
        onDownloadPdf();
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao gerar PDF',
          description: 'Não foi possível gerar o arquivo. Tente usar a opção Imprimir ou Baixar Imagem.',
        });
      }
    } finally {
      setBaixandoPdf(false);
    }
  };

  const handleSalvarDadosEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSalvandoEmpresa(true);
      const updatePayload: Partial<EmpresaFolhaConfig> = {
        razaoSocial: formEmpresa.razaoSocial.trim() || 'Concessionária de Motos Ltda',
        nomeFantasia: formEmpresa.nomeFantasia.trim(),
        cnpj: formEmpresa.cnpj.trim(),
        inscricaoEstadual: formEmpresa.inscricaoEstadual.trim(),
        endereco: formEmpresa.endereco.trim(),
        bairro: formEmpresa.bairro.trim(),
        cidade: formEmpresa.cidade.trim(),
        uf: formEmpresa.uf.trim().toUpperCase(),
        cep: formEmpresa.cep.trim(),
        telefone: formEmpresa.telefone.trim(),
        logoUrl: formEmpresa.logoUrl.trim(),
        textoMarcaDagua: formEmpresa.textoMarcaDagua.trim() || formEmpresa.razaoSocial.trim(),
        exibirMarcaDagua: formEmpresa.exibirMarcaDagua ? 1 : 0,
        storeId: lojaOrganizacao?.id || storeIdFuncionario,
      };

      // Atualiza o estado visual instantaneamente
      setEmpresaState((prev) => ({ ...prev, ...updatePayload }));

      // Sincroniza diretamente na tabela central de Lojas do sistema (Aba Organização)
      const targetStoreId = lojaOrganizacao?.id || storeIdFuncionario;
      if (targetStoreId) {
        try {
          await supabase
            .from('stores')
            .update({
              name: updatePayload.razaoSocial,
              cnpj: updatePayload.cnpj,
              address: updatePayload.endereco,
              city: updatePayload.cidade,
              state: updatePayload.uf,
              phone: updatePayload.telefone,
            })
            .eq('id', targetStoreId);
        } catch (dbErr) {
          console.warn('Erro ao atualizar store no Supabase:', dbErr);
        }
      }

      // Persiste no backend / hook de configuração se o callback estiver disponível
      if (onSalvarEmpresa) {
        await onSalvarEmpresa(updatePayload);
      }

      setModalEditarEmpresaOpen(false);
      toast({
        title: 'Dados sincronizados com a Organização!',
        description: `Os dados da loja ${updatePayload.razaoSocial} foram salvos centralmente na aba Organização.`,
      });
    } catch (err) {
      console.error('Erro ao salvar dados da empresa:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar dados',
        description: 'Não foi possível persistir os dados da empresa.',
      });
    } finally {
      setSalvandoEmpresa(false);
    }
  };

  const isTerceiro =
    funcionario?.tipoContrato === 'TERCEIRIZADO' ||
    folha?.tipoContrato === 'TERCEIRIZADO' ||
    funcionario?.tipoContrato === 'PJ' ||
    folha?.tipoContrato === 'PJ';

  const proventos = Array.isArray(folha.proventos) ? folha.proventos : [];
  const descontos = Array.isArray(folha.descontos) ? folha.descontos : [];

  const nomeFuncionario = funcionario?.nome || folha.funcionarioNome || 'Colaborador';
  const cargoFuncionario = funcionario?.cargo || folha.cargo || 'Função Operacional';
  const setorFuncionario = funcionario?.departamento || folha.departamento || 'Comercial';
  const cpfFuncionario = funcionario?.cpf || folha.cpf || '—';
  const matriculaFuncionario =
    funcionario?.matricula ||
    (folha.funcionarioId ? `#${String(folha.funcionarioId).slice(0, 6)}` : '—');
  const dataAdmissao = (funcionario as any)?.dataAdmissao || 'Não informada';

  const aliquotaIrrf =
    folha.irrfDetalhe && typeof folha.irrfDetalhe === 'object'
      ? Number(folha.irrfDetalhe.aliquota) || 0
      : 0;

  // Verifica se o colaborador tem incidência de FGTS apurada nesta competência
  const temFGTS =
    !isTerceiro &&
    Number(folha.fgts || 0) > 0 &&
    Number(folha.baseFGTS || 0) > 0 &&
    (funcionario?.calcularFGTS === undefined || Number(funcionario.calcularFGTS) === 1);

  const competenciaFormatada = formatarCompetenciaExtenso(folha.mesReferencia);

  // Monta lista de linhas formatadas da tabela com sanitização completa de leis/artigos/indenizações
  const linhasTabela: Array<{
    id: string;
    codigo: string;
    descricao: string;
    referencia: string;
    vencimento?: number;
    desconto?: number;
  }> = [
    ...proventos.map((p, idx) => {
      const descLimpa = formatarDescricaoRubrica(p.rubrica);
      const rawRef = sanitizarTextoHolerite(p.referencia || '');
      const refFinal = rawRef || (descLimpa.includes('Reembolso') || descLimpa.includes('Ajuda de Custo') ? 'Operacional' : '—');
      return {
        id: `prov-${idx}`,
        codigo: obterCodigoRubrica(p.rubrica, false, idx),
        descricao: descLimpa,
        referencia: refFinal,
        vencimento: Number(p.valor) || 0,
      };
    }),
    ...descontos.map((d, idx) => {
      const aliqLabel = d.aliquota
        ? `${d.aliquota}%`
        : d.aliquotaEfetiva
          ? `${d.aliquotaEfetiva}%`
          : '';
      const descLimpa = formatarDescricaoRubrica(d.rubrica);
      const refFinal = sanitizarTextoHolerite(aliqLabel) || '—';
      return {
        id: `desc-${idx}`,
        codigo: obterCodigoRubrica(d.rubrica, true, idx),
        descricao: descLimpa,
        referencia: refFinal,
        desconto: Number(d.valor) || 0,
      };
    }),
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200 print:static print:p-0 print:m-0 print:bg-white print:overflow-visible print:inset-auto print:block">
        <div className="bg-card/95 backdrop-blur-2xl rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col text-foreground border border-white/20 dark:border-white/10 overflow-hidden print:static print:max-h-none print:max-w-none print:w-full print:border-none print:shadow-none print:overflow-visible print:bg-white print:text-black print:rounded-none">
          {/* BARRA SUPERIOR DE AÇÕES E CONTROLES */}
          <div className="flex flex-wrap justify-between items-center px-5 py-3.5 border-b border-border/60 gap-3 no-print bg-muted/40 shrink-0">
            <div>
              <h3 className="text-base font-display font-black text-foreground tracking-tight flex items-center gap-2">
                {isTerceiro ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Demonstrativo de Prestação de Serviços (PJ / Autônomo)
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 text-primary" />
                    Recibo de Pagamento de Salário (Holerite Oficial)
                  </>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Competência: <strong className="font-semibold text-foreground">{competenciaFormatada}</strong> •{' '}
                <span className="font-medium text-foreground">{empresaState.razaoSocial}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isPago !== undefined && (
                <Badge
                  variant="outline"
                  className={
                    isPago
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold gap-1 px-2.5 py-1'
                      : 'border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold gap-1 px-2.5 py-1'
                  }
                >
                  {isPago ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Pago {dataPagamento ? `(${dataPagamento})` : ''}
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      Pendente
                    </>
                  )}
                </Badge>
              )}

              {funcionario?.chavePix && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPix}
                  className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 font-bold"
                  title={`Chave PIX: ${funcionario.chavePix}`}
                >
                  {copiadoPix ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar PIX
                    </>
                  )}
                </Button>
              )}

              {onTogglePago && (
                <Button
                  type="button"
                  variant={isPago ? 'outline' : 'default'}
                  size="sm"
                  onClick={onTogglePago}
                  className={
                    isPago
                      ? 'h-8 text-xs font-bold'
                      : 'h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30'
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  {isPago ? 'Reverter para Pendente' : 'Confirmar Pagamento'}
                </Button>
              )}

              {onSendWhatsapp && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSendWhatsapp}
                  className="h-8 text-xs font-semibold"
                  title="Compartilhar demonstrativo via WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> WhatsApp
                </Button>
              )}

              {/* BOTÃO PARA EDITAR CNPJ, NOME DA LOJA E ENDEREÇO */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalEditarEmpresaOpen(true)}
                className="h-8 text-xs font-bold border-border/80 text-foreground hover:bg-muted"
                title="Configurar CNPJ, Razão Social, Nome Fantasia, Endereço e Logo da Loja"
              >
                <Store className="w-3.5 h-3.5 mr-1.5 text-primary" /> Dados da Loja
              </Button>

              {/* BAIXAR IMAGEM (PNG EM ALTA RESOLUÇÃO) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadImage}
                disabled={baixandoImagem}
                className="h-8 text-xs font-bold border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
                title="Download do holerite como Imagem PNG em alta resolução (300 DPI)"
              >
                {baixandoImagem ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Gerando Imagem...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> Baixar Imagem (PNG)
                  </>
                )}
              </Button>

              {/* BAIXAR PDF OFICIAL */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={baixandoPdf}
                className="h-8 text-xs font-bold border-sky-600/40 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10 shadow-xs"
                title="Download do holerite em formato PDF oficial padrão A4"
              >
                {baixandoPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Gerando PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 mr-1.5 text-sky-600 dark:text-sky-400" /> Baixar PDF
                  </>
                )}
              </Button>

              {/* IMPRIMIR */}
              <Button
                type="button"
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                title="Imprimir ou salvar diretamente pela impressora"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* CONTAINER DO DOCUMENTO COM DIMENSIONAMENTO OFICIAL A4 PADRÃO CONTÁBIL */}
          <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-slate-200/70 dark:bg-slate-950/70 print:p-0 print:m-0 print:overflow-visible print:bg-white print:block">
            <div className="min-w-fit mx-auto flex justify-center pb-6">
              <div
                ref={holeriteRef}
                id="holerite-folha-print"
                className="w-[820px] min-w-[820px] max-w-[820px] bg-white text-slate-900 border-2 border-slate-900 p-6 sm:p-7 font-sans text-xs shadow-2xl print-area rounded-none print:w-full print:min-w-0 print:max-w-none print:m-0 print:border-2 print:border-slate-900 print:p-6 print:shadow-none space-y-3.5 box-border select-text"
                style={{ boxSizing: 'border-box' }}
              >
                {/* 1. CABEÇALHO DO EMPREGADOR / CONCESSIONÁRIA */}
                <div className="border-b-2 border-slate-900 pb-3.5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {empresaState.logoUrl ? (
                      <img
                        src={empresaState.logoUrl}
                        alt="Logo Concessionária"
                        className="max-h-16 max-w-[140px] object-contain border border-slate-200 p-1 rounded bg-white shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-slate-900 text-white font-black flex items-center justify-center text-xl rounded shrink-0 shadow-sm">
                        {empresaState.nomeFantasia?.[0] || empresaState.razaoSocial?.[0] || 'M'}
                      </div>
                    )}

                    <div className="space-y-0.5 min-w-0 flex-1">
                      <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight leading-tight">
                        {empresaState.razaoSocial || 'CONCESSIONÁRIA DE MOTOCICLETAS LTDA'}
                      </h2>
                      {empresaState.nomeFantasia && (
                        <div className="text-xs font-bold text-slate-700">
                          {empresaState.nomeFantasia}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-700 font-medium flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
                        <span>
                          <strong>CNPJ:</strong> {empresaState.cnpj || 'Não informado'}
                        </span>
                        {empresaState.inscricaoEstadual && (
                          <span>
                            <strong>I.E.:</strong> {empresaState.inscricaoEstadual}
                          </span>
                        )}
                        {empresaState.telefone && (
                          <span>
                            <strong>Tel:</strong> {empresaState.telefone}
                          </span>
                        )}
                      </div>
                      {(empresaState.endereco || empresaState.cidade) && (
                        <div className="text-[10px] text-slate-600 leading-tight pt-0.5">
                          {empresaState.endereco ? `${empresaState.endereco}` : ''}
                          {empresaState.bairro ? ` - ${empresaState.bairro}` : ''}
                          {empresaState.cidade ? ` • ${empresaState.cidade}${empresaState.uf ? `/${empresaState.uf}` : ''}` : ''}
                          {empresaState.cep ? ` - CEP: ${empresaState.cep}` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 w-[240px]">
                    <div className="border border-slate-900 bg-slate-900 text-white py-1.5 px-3 text-center">
                      <span className="text-[10.5px] font-black uppercase tracking-wider block">
                        {isTerceiro
                          ? 'DEMONSTRATIVO DE PRESTAÇÃO DE SERVIÇOS'
                          : 'RECIBO DE PAGAMENTO DE SALÁRIO'}
                      </span>
                    </div>
                    <div className="border-x border-b border-slate-900 bg-slate-50 py-2 px-2.5 text-center">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">
                        Competência / Mês de Referência
                      </span>
                      <span className="text-base font-mono font-black text-slate-900 block leading-tight mt-0.5">
                        {folha.mesReferencia || '—'}
                      </span>
                      <span className="text-[9px] text-slate-600 font-medium block mt-0.5">
                        {isTerceiro
                          ? 'Via do Prestador • Sem Vínculo Empregatício'
                          : 'Folha Mensal • Via do Colaborador'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. QUADRO DE IDENTIFICAÇÃO DO COLABORADOR (RESPONSIVO E SEM CORTES) */}
                <div className="border border-slate-900 bg-slate-50/70 text-[11px]">
                  <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
                    <div className="col-span-2 py-2 px-2.5 flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        Cód. Matrícula
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-xs leading-normal">
                        {matriculaFuncionario}
                      </span>
                    </div>
                    <div className="col-span-6 py-2 px-2.5 flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        {isTerceiro ? 'Nome do Prestador / Razão Social' : 'Nome do Empregado'}
                      </span>
                      <span className="font-black text-slate-900 text-sm leading-normal break-words">
                        {nomeFuncionario}
                      </span>
                      {(funcionario?.razaoSocialPrestador || folha.razaoSocialPrestador) && (
                        <span className="text-[10px] text-slate-600 font-semibold leading-normal break-words mt-0.5">
                          PJ: {funcionario?.razaoSocialPrestador || folha.razaoSocialPrestador}{' '}
                          {(funcionario?.cnpjPrestador || folha.cnpjPrestador) &&
                            `(${funcionario?.cnpjPrestador || folha.cnpjPrestador})`}
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 py-2 px-2.5 flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        C.P.F.
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-xs leading-normal">
                        {cpfFuncionario}
                      </span>
                    </div>
                    <div className="col-span-2 py-2 px-2.5 flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        PIS / PASEP
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-xs leading-normal">
                        {(funcionario as any)?.pis || (funcionario as any)?.pisPasep || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 divide-x divide-slate-300">
                    <div className="col-span-4 py-2 px-2.5 flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        Cargo / Função
                      </span>
                      <span className="font-bold text-slate-900 text-xs leading-normal break-words">
                        {cargoFuncionario}
                      </span>
                    </div>
                    <div className="col-span-2 py-2 px-2.5 flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        CBO
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-xs leading-normal">
                        {(funcionario as any)?.cbo ||
                          (cargoFuncionario.toLowerCase().includes('mecanic')
                            ? '9144-05'
                            : cargoFuncionario.toLowerCase().includes('gerente')
                              ? '1423-05'
                              : '5211-10')}
                      </span>
                    </div>
                    <div className="col-span-3 py-2 px-2.5 flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        Departamento / Setor
                      </span>
                      <span className="font-bold text-slate-900 text-xs leading-normal break-words">
                        {setorFuncionario}
                      </span>
                    </div>
                    <div className="col-span-2 py-2 px-2.5 flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        {isTerceiro ? 'Vínculo' : 'Data Admissão'}
                      </span>
                      <span className="font-bold text-slate-900 text-xs leading-normal">
                        {isTerceiro ? 'Contrato PJ' : dataAdmissao}
                      </span>
                    </div>
                    <div className="col-span-1 py-2 px-1.5 text-center flex flex-col justify-between">
                      <span className="font-bold text-slate-500 text-[9px] uppercase tracking-wider leading-none mb-1">
                        Dep. IR
                      </span>
                      <span className="font-mono font-black text-slate-900 text-xs leading-normal">
                        {isTerceiro ? '—' : Number(funcionario?.dependentes) || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. TABELA DE LANÇAMENTOS (VENCIMENTOS E DESCONTOS) COM PROPORÇÃO FIXA */}
                <div className="border border-slate-900 min-h-[280px] flex flex-col justify-between">
                  <table className="w-full text-left border-collapse table-fixed text-[11px]">
                    <colgroup>
                      <col style={{ width: '54px' }} />
                      <col style={{ width: 'auto' }} />
                      <col style={{ width: '88px' }} />
                      <col style={{ width: '138px' }} />
                      <col style={{ width: '138px' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 text-[10px] font-black uppercase tracking-wider">
                        <th className="py-2.5 px-2 text-center border-r border-slate-300">CÓD.</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">DESCRIÇÃO DOS VENCIMENTOS / DESCONTOS</th>
                        <th className="py-2.5 px-2 text-center border-r border-slate-300">REFERÊNCIA</th>
                        <th className="py-2.5 px-3 text-right border-r border-slate-300">PROVENTOS (R$)</th>
                        <th className="py-2.5 px-3 text-right">DESCONTOS (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {linhasTabela.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2 text-center text-slate-500 font-mono text-[10px] border-r border-slate-200 align-top leading-normal">
                            {row.codigo}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200 break-words align-top leading-snug">
                            {row.descricao}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-600 font-mono text-[10px] border-r border-slate-200 align-top leading-normal">
                            {row.referencia || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200 tabular-nums align-top leading-normal">
                            {row.vencimento ? formatarMoeda(row.vencimento) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums align-top leading-normal">
                            {row.desconto ? formatarMoeda(row.desconto) : '—'}
                          </td>
                        </tr>
                      ))}
                      {/* Linhas vazias para manter a altura padronizada de folha contábil */}
                      {Array.from({ length: Math.max(0, 8 - linhasTabela.length) }).map((_, i) => (
                        <tr key={`empty-${i}`} className="h-7">
                          <td className="border-r border-slate-200 text-transparent select-none py-1">&nbsp;</td>
                          <td className="border-r border-slate-200 text-transparent select-none py-1">&nbsp;</td>
                          <td className="border-r border-slate-200 text-transparent select-none py-1">&nbsp;</td>
                          <td className="border-r border-slate-200 text-transparent select-none py-1">&nbsp;</td>
                          <td className="text-transparent select-none py-1">&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. QUADRO DE TOTAIS E VALOR LÍQUIDO */}
                <div className="grid grid-cols-12 border-2 border-slate-900 bg-slate-50">
                  <div className="col-span-4 p-2.5 border-r border-slate-300 text-right">
                    <span className="text-[10px] text-slate-600 block uppercase font-black tracking-wider leading-none">
                      Total de Vencimentos
                    </span>
                    <span className="text-base font-black text-slate-900 font-mono tabular-nums block mt-1">
                      {formatarMoeda(folha.totalProventos)}
                    </span>
                  </div>
                  <div className="col-span-4 p-2.5 border-r border-slate-300 text-right">
                    <span className="text-[10px] text-slate-600 block uppercase font-black tracking-wider leading-none">
                      Total de Descontos
                    </span>
                    <span className="text-base font-black text-slate-900 font-mono tabular-nums block mt-1">
                      {formatarMoeda(folha.totalDescontos)}
                    </span>
                  </div>
                  <div className="col-span-4 bg-slate-900 text-white p-2.5 text-center flex flex-col justify-center">
                    <span className="text-[9px] font-black text-slate-300 block uppercase tracking-widest leading-none">
                      Valor Líquido a Receber
                    </span>
                    <span className="text-xl font-black font-mono tracking-tight tabular-nums text-white block mt-1">
                      {formatarMoeda(folha.salarioLiquido)}
                    </span>
                  </div>
                </div>

                {/* 5. BASES LEGAIS CLT */}
                {!isTerceiro && (
                  <div className="border border-slate-800 bg-slate-50 p-2.5 text-center">
                    <div className="grid grid-cols-6 divide-x divide-slate-300 text-[10px]">
                      <div className="py-1 px-1">
                        <span className="block text-slate-500 font-bold uppercase text-[9px] leading-tight">Salário Base</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums block mt-0.5 leading-normal">
                          {formatarMoeda(folha.salarioBase)}
                        </span>
                      </div>
                      <div className="py-1 px-1">
                        <span className="block text-slate-500 font-bold uppercase text-[9px] leading-tight">Sal. Contr. INSS</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums block mt-0.5 leading-normal">
                          {formatarMoeda(folha.baseINSS)}
                        </span>
                      </div>
                      <div className="py-1 px-1">
                        <span className="block text-slate-500 font-bold uppercase text-[9px] leading-tight">Base Cálc. FGTS</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums block mt-0.5 leading-normal">
                          {temFGTS ? formatarMoeda(folha.baseFGTS) : '—'}
                        </span>
                      </div>
                      <div className="py-1 px-1">
                        <span className="block text-slate-500 font-bold uppercase text-[9px] leading-tight">FGTS do Mês (8%)</span>
                        <span className="font-mono font-black text-slate-900 tabular-nums block mt-0.5 leading-normal">
                          {temFGTS ? formatarMoeda(folha.fgts) : 'Isento'}
                        </span>
                      </div>
                      <div className="py-1 px-1">
                        <span className="block text-slate-500 font-bold uppercase text-[9px] leading-tight">Base Cálc. IRRF</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums block mt-0.5 leading-normal">
                          {formatarMoeda(folha.baseIRRF)}
                        </span>
                      </div>
                      <div className="py-1 px-1">
                        <span className="block text-slate-500 font-bold uppercase text-[9px] leading-tight">Faixa IRRF</span>
                        <span className="font-mono font-bold text-slate-900 block mt-0.5 leading-normal">
                          {aliquotaIrrf > 0 ? `${aliquotaIrrf}%` : 'Isento'}
                        </span>
                      </div>
                    </div>
                    {temFGTS && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[9px] text-slate-500 italic text-left">
                        Nota: O valor do FGTS é depositado mensalmente pelo empregador na Caixa Econômica Federal e não constitui desconto salarial.
                      </div>
                    )}
                  </div>
                )}

                {/* 6. DADOS BANCÁRIOS / PIX / LIQUIDAÇÃO */}
                {(funcionario?.chavePix || funcionario?.banco || funcionario?.conta) && (
                  <div className="border border-slate-300 bg-slate-50/70 p-2 text-[10px] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-700">
                      <strong>Pagamento via:</strong>{' '}
                      {funcionario?.banco
                        ? `${funcionario.banco} • Ag: ${funcionario.agencia || '—'} Conta: ${funcionario.conta || '—'}`
                        : 'Crédito em Conta Corrente'}
                    </span>
                    {funcionario?.chavePix && (
                      <span className="text-slate-700 font-mono text-[10px]">
                        <strong>Chave PIX:</strong> {funcionario.chavePix}
                      </span>
                    )}
                    {isPago && dataPagamento && (
                      <span className="text-emerald-700 font-bold">
                        Liquidado em: {dataPagamento}
                      </span>
                    )}
                  </div>
                )}

                {/* 6.1. CADERNO DE ATIVIDADES E SERVIÇOS REALIZADOS (ESPECIFICAÇÃO COMPLETA) */}
                {(((folha as any).comissoesDetalhadas && (folha as any).comissoesDetalhadas.length > 0) || (folha as any).cadernoAnotacoes) && (
                  <div className="border-2 border-slate-800 bg-slate-50/80 p-3 text-[10px] space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                      <span className="font-black text-slate-900 uppercase tracking-wider text-[10px]">
                        Caderno de Atividades & Serviços Realizados
                      </span>
                      <span className="text-[9px] font-semibold text-slate-500 font-mono">
                        {((folha as any).comissoesDetalhadas?.length || 0)} item(ns) especificado(s)
                      </span>
                    </div>

                    {(folha as any).comissoesDetalhadas && (folha as any).comissoesDetalhadas.length > 0 && (
                      <div className="divide-y divide-slate-200">
                        {(folha as any).comissoesDetalhadas.map((item: any, i: number) => (
                          <div key={i} className="py-1 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-900">{sanitizarTextoHolerite(item.nome)}</span>
                              {item.referencia && (
                                <span className="text-slate-500 ml-1.5 text-[9px]">({sanitizarTextoHolerite(item.referencia)})</span>
                              )}
                              {item.observacao && (
                                <p className="text-[8.5px] text-slate-600 italic mt-0.5 whitespace-pre-wrap">
                                  Nota: {sanitizarTextoHolerite(item.observacao)}
                                </p>
                              )}
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              {formatarMoeda(item.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(folha as any).cadernoAnotacoes && (
                      <div className="pt-2 border-t border-slate-300">
                        <span className="font-black text-slate-800 uppercase text-[9px] block mb-1">
                          Anotações Gerais / Diário de Bordo do Colaborador:
                        </span>
                        <div className="bg-white border border-slate-200 p-2 text-[9px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed rounded-none shadow-2xs">
                          {sanitizarTextoHolerite((folha as any).cadernoAnotacoes)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. CANHOTO OFICIAL DE QUITAÇÃO E ASSINATURA (ALINHAMENTO PERFEITO SEM CORTES) */}
                <div className="mt-4 pt-3.5 border-t-2 border-dashed border-slate-400 text-[10px]">
                  <div className="text-[9px] font-mono text-slate-400 uppercase text-center mb-2.5 tracking-wider">
                    --------------------------------------- CORTE AQUI • RECIBO DE QUITAÇÃO ---------------------------------------
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-end gap-6 pt-1">
                    <div className="max-w-md text-slate-600 leading-relaxed text-[9.5px]">
                      DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO, CORRESPONDENTE À MINHA REMUNERAÇÃO NO MÊS DE REFERÊNCIA INDICADO, DANDO POR ESTE A MAIS PLENA E GERAL QUITAÇÃO.
                    </div>
                    <div className="flex items-end gap-6 shrink-0">
                      <div className="text-center w-32">
                        <div className="border-b-2 border-slate-900 pb-1 font-mono text-[11px] text-slate-800 leading-normal">
                          ___/___/______
                        </div>
                        <span className="block text-[8.5px] uppercase font-bold text-slate-600 mt-1 tracking-wider">
                          Data
                        </span>
                      </div>
                      <div className="text-center w-64">
                        <div className="border-b-2 border-slate-900 pb-1 font-black text-[11px] text-slate-900 leading-normal break-words">
                          {nomeFuncionario}
                        </div>
                        <span className="block text-[8.5px] uppercase font-bold text-slate-600 mt-1 tracking-wider">
                          {isTerceiro ? 'Assinatura do Prestador' : 'Assinatura do Empregado'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RODAPÉ DO MODAL */}
          <div className="px-5 py-3 border-t border-border/60 bg-muted/40 flex justify-between items-center no-print shrink-0">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Padrão Contábil Oficial e eSocial • Exportação em alta resolução (Imagem PNG 300 DPI e PDF A4)
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="font-bold">
              Fechar
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL PARA EDITAR CNPJ, NOME DA LOJA, ENDEREÇO E LOGO */}
      <Dialog open={modalEditarEmpresaOpen} onOpenChange={setModalEditarEmpresaOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              Dados da Concessionária (Sincronizado com Organização)
            </DialogTitle>
          </DialogHeader>

          {/* ALERTA DE SINCRONIZAÇÃO CENTRAL COM A ABA ORGANIZAÇÃO */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs">
            <div className="flex items-center gap-2.5">
              <Store className="w-4 h-4 text-primary shrink-0" />
              <div>
                <span className="font-bold text-foreground">Sincronização com a Aba Organização</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Unidade: <strong>{lojaOrganizacao?.name || 'Matriz'}</strong> • Os dados vêm centralizados de <strong>Organização &gt; Lojas</strong>.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs font-semibold gap-1 shrink-0"
              onClick={() => window.open('/organization?tab=lojas', '_blank')}
            >
              <ExternalLink className="w-3 h-3" /> Abrir Organização
            </Button>
          </div>

          <form onSubmit={handleSalvarDadosEmpresa} className="space-y-4 text-xs pt-1">
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block border-b pb-1">
                Identificação Jurídica
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Razão Social (Nome da Empresa)</Label>
                  <Input
                    type="text"
                    placeholder="Ex: Concessionária Montes Claros de Motos Ltda"
                    value={formEmpresa.razaoSocial}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, razaoSocial: e.target.value })}
                    className="h-8 text-xs mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Nome Fantasia (Marca da Loja)</Label>
                  <Input
                    type="text"
                    placeholder="Ex: MotoLíder Honda"
                    value={formEmpresa.nomeFantasia}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, nomeFantasia: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">CNPJ da Concessionária</Label>
                  <Input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={formEmpresa.cnpj}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, cnpj: e.target.value })}
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Inscrição Estadual (Opcional)</Label>
                  <Input
                    type="text"
                    placeholder="Ex: 001.234.567.890"
                    value={formEmpresa.inscricaoEstadual}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, inscricaoEstadual: e.target.value })}
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Telefone / WhatsApp Comercial</Label>
                  <Input
                    type="text"
                    placeholder="Ex: (38) 3221-4400"
                    value={formEmpresa.telefone}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, telefone: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block border-b pb-1">
                Endereço e Localização
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Logradouro / Rua e Número</Label>
                  <Input
                    type="text"
                    placeholder="Ex: Av. Governador Magalhães Pinto, 1200"
                    value={formEmpresa.endereco}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, endereco: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Bairro</Label>
                  <Input
                    type="text"
                    placeholder="Ex: Centro"
                    value={formEmpresa.bairro}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, bairro: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Cidade</Label>
                  <Input
                    type="text"
                    placeholder="Ex: Montes Claros"
                    value={formEmpresa.cidade}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, cidade: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">UF (Estado)</Label>
                  <Input
                    type="text"
                    maxLength={2}
                    placeholder="MG"
                    value={formEmpresa.uf}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, uf: e.target.value.toUpperCase() })}
                    className="h-8 text-xs font-mono uppercase mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">CEP</Label>
                  <Input
                    type="text"
                    placeholder="39400-000"
                    value={formEmpresa.cep}
                    onChange={(e) => setFormEmpresa({ ...formEmpresa, cep: e.target.value })}
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block border-b pb-1">
                Logotipo e Identidade Visual
              </span>
              <div>
                <Label className="text-xs font-semibold">URL da Imagem do Logotipo</Label>
                <Input
                  type="url"
                  placeholder="https://exemplo.com/logo.png"
                  value={formEmpresa.logoUrl}
                  onChange={(e) => setFormEmpresa({ ...formEmpresa, logoUrl: e.target.value })}
                  className="h-8 text-xs font-mono mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Cole o link público de uma imagem PNG ou JPEG transparente da sua concessionária.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalEditarEmpresaOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={salvandoEmpresa}>
                {salvandoEmpresa ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar Dados da Loja
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function HoleriteModal(props: HoleriteModalProps) {
  if (!props.dados) return null;
  return (
    <ErrorBoundary
      fallbackTitle="Erro ao abrir holerite"
      fallbackDescription="Houve uma inconsistência nos dados do colaborador ou da folha deste mês. Tente novamente ou reabra o holerite."
      onReset={props.onClose}
    >
      <HoleriteModalContent {...props} />
    </ErrorBoundary>
  );
}
