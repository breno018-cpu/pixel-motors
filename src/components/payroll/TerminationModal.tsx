import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  UserMinus,
  Calculator,
  FileText,
  Download,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Plus,
  Trash2,
  Calendar,
  Building,
  CreditCard,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import type { FuncionarioConcessionaria, FolhaMensalItem } from '@/hooks/useFolhaConcessionaria';
import {
  calcularRescisaoCompleta,
  type MotivoRescisao,
  type ModalidadeAvisoPrevio,
  type AdicionalRescisorio,
  type RescisaoResultado,
} from '@/lib/rescisaoCalculo';
import {
  generateTerminationContractPDF,
  downloadTerminationContractPDF,
} from '@/lib/terminationContractPdf';
import {
  registrarUltimaFolhaRescisao,
  desativarCredenciaisColaborador,
  downloadFinalTerminationPayslipPDF,
} from '@/lib/terminationService';

interface TerminationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario: FuncionarioConcessionaria | null;
  folhas?: FolhaMensalItem[];
  onTerminationCompleted?: () => void;
}

export function TerminationModal({
  open,
  onOpenChange,
  funcionario,
  folhas = [],
  onTerminationCompleted,
}: TerminationModalProps) {
  const { toast } = useToast();

  // Estados de cálculo
  const [dataDemissao, setDataDemissao] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [motivo, setMotivo] = useState<MotivoRescisao>('SEM_JUSTA_CAUSA');
  const [modalidadeAviso, setModalidadeAviso] = useState<ModalidadeAvisoPrevio>(
    'INDENIZADO_EMPREGADOR'
  );
  const [saldoFGTS, setSaldoFGTS] = useState<number>(10000);
  const [feriasVencidas, setFeriasVencidas] = useState<boolean>(false);
  const [diasSaldoSalario, setDiasSaldoSalario] = useState<number>(new Date().getDate());
  const [adicionaisExtras, setAdicionaisExtras] = useState<AdicionalRescisorio[]>([]);

  // Novo adicional personalizado
  const [novoItemDesc, setNovoItemDesc] = useState('');
  const [novoItemValor, setNovoItemValor] = useState<number | ''>('');
  const [novoItemTipo, setNovoItemTipo] = useState<'provento' | 'desconto'>('provento');

  // Estado de submissão
  const [isProcessing, setIsProcessing] = useState(false);
  const [demissaoConcluida, setDemissaoConcluida] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState<RescisaoResultado | null>(null);

  // Calcula média de comissões do colaborador a partir do histórico de folhas
  const mediaComissoes = useMemo(() => {
    if (!funcionario) return 0;
    const folhasDoColab = folhas.filter((f) => f.funcionarioId === funcionario.id);
    if (folhasDoColab.length === 0) return 0;
    const soma = folhasDoColab.reduce(
      (acc, f) =>
        acc +
        (Number(f.resultado?.totalComissoes) || 0) +
        (Number(f.resultado?.comissaoDSR) || 0),
      0
    );
    return +(soma / folhasDoColab.length).toFixed(2);
  }, [funcionario, folhas]);

  // Atualiza dias de saldo de salário quando a data de demissão muda
  useEffect(() => {
    if (dataDemissao) {
      const d = new Date(`${dataDemissao}T12:00:00`);
      setDiasSaldoSalario(d.getDate());
    }
  }, [dataDemissao]);

  // Reseta estado quando o modal abre com novo funcionário
  useEffect(() => {
    if (open && funcionario) {
      setDataDemissao(new Date().toISOString().slice(0, 10));
      setMotivo('SEM_JUSTA_CAUSA');
      setModalidadeAviso('INDENIZADO_EMPREGADOR');
      setFeriasVencidas(false);
      setDiasSaldoSalario(new Date().getDate());
      setDemissaoConcluida(false);
      setResultadoFinal(null);

      // Adiciona bônus ou melhorias contratuais pré-configuradas do funcionário se houver
      const extrasIniciais: AdicionalRescisorio[] = [];
      if (funcionario.regularAdditions && funcionario.regularAdditions.length > 0) {
        funcionario.regularAdditions.forEach((ra) => {
          if (ra.name && ra.value > 0) {
            extrasIniciais.push({
              id: `reg-${ra.id}`,
              descricao: `Melhoria Contratual: ${ra.name}`,
              valor: Number(ra.value),
              tipo: ra.is_discount ? 'desconto' : 'provento',
            });
          }
        });
      }
      setAdicionaisExtras(extrasIniciais);
    }
  }, [open, funcionario]);

  // Ajusta modalidade de aviso prévio conforme motivo selecionado
  const handleMotivoChange = (novoMotivo: MotivoRescisao) => {
    setMotivo(novoMotivo);
    if (novoMotivo === 'PEDIDO_DEMISSAO') {
      setModalidadeAviso('TRABALHADO');
    } else if (novoMotivo === 'SEM_JUSTA_CAUSA' || novoMotivo === 'ACORDO_MUTUO') {
      setModalidadeAviso('INDENIZADO_EMPREGADOR');
    } else if (novoMotivo === 'COM_JUSTA_CAUSA' || novoMotivo === 'TERMINO_CONTRATO') {
      setModalidadeAviso('DISPENSADO');
    }
  };

  // Cálculo em tempo real
  const resultado = useMemo<RescisaoResultado | null>(() => {
    if (!funcionario) return null;
    const dataAdm = funcionario.dataAdmissao || '2024-01-01';
    return calcularRescisaoCompleta({
      funcionario,
      dataAdmissao: dataAdm,
      dataDemissao,
      motivo,
      modalidadeAviso,
      saldoFGTS,
      feriasVencidas,
      diasSaldoSalario,
      mediaComissoes,
      adicionaisContratuais: adicionaisExtras,
    });
  }, [
    funcionario,
    dataDemissao,
    motivo,
    modalidadeAviso,
    saldoFGTS,
    feriasVencidas,
    diasSaldoSalario,
    mediaComissoes,
    adicionaisExtras,
  ]);

  if (!funcionario) return null;

  const dadosEmpresa = {
    razaoSocial: funcionario.storeName || 'CONCESSIONÁRIA SHINERAY MOTOS',
    cnpj: '18.456.789/0001-01',
    endereco: 'Av. Autorama, 1200 - Divinópolis/MG',
    cidade: 'Divinópolis/MG',
    telefone: '(37) 3222-1000',
  };

  const handleAddExtra = () => {
    if (!novoItemDesc.trim() || !novoItemValor || Number(novoItemValor) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Dados incompletos',
        description: 'Informe a descrição e o valor da melhoria/adicional.',
      });
      return;
    }
    const novo: AdicionalRescisorio = {
      id: `custom-${Date.now()}`,
      descricao: novoItemDesc.trim(),
      valor: Number(novoItemValor),
      tipo: novoItemTipo,
    };
    setAdicionaisExtras([...adicionaisExtras, novo]);
    setNovoItemDesc('');
    setNovoItemValor('');
  };

  const handleRemoveExtra = (id: string) => {
    setAdicionaisExtras(adicionaisExtras.filter((item) => item.id !== id));
  };

  const fmt = (v?: number) =>
    (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Execução e homologação oficial da demissão
  const handleExecutarDemissao = async () => {
    if (!resultado) return;

    const confirmMsg =
      `CONFIRMAÇÃO DE DESLIGAMENTO OFICIAL:\n\n` +
      `Colaborador: ${funcionario.nome}\n` +
      `Cargo: ${funcionario.cargo}\n` +
      `Líquido Rescisório a Pagar: ${fmt(resultado.liquidoRescisao)}\n\n` +
      `ATENÇÃO: Ao confirmar, as credenciais de acesso ao sistema do colaborador serão IMEDIATAMENTE DESATIVADAS, e a última folha de pagamento será gerada. Deseja prosseguir?`;

    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      // 1. Registra a última folha de pagamento no banco
      await registrarUltimaFolhaRescisao({
        funcionario,
        resultado,
      });

      // 2. Desativa as credenciais de uso do sistema e atualiza o cadastro para DEMITIDO
      await desativarCredenciaisColaborador({
        funcionario,
        resultado,
      });

      // 3. Emite os downloads automáticos dos documentos
      downloadTerminationContractPDF({
        funcionario,
        resultado,
        empresa: dadosEmpresa,
      });

      downloadFinalTerminationPayslipPDF({
        funcionario,
        resultado,
        empresa: dadosEmpresa,
      });

      setResultadoFinal(resultado);
      setDemissaoConcluida(true);

      toast({
        title: 'Demissão Homologada com Sucesso!',
        description: `O TRCT e a Última Folha foram emitidos em PDF, e as credenciais de ${funcionario.nome} foram desativadas.`,
      });

      if (onTerminationCompleted) {
        onTerminationCompleted();
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar desligamento',
        description: err?.message || 'Falha ao desativar credenciais ou emitir documentos.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 bg-muted/30 border-b border-border/70 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-display font-bold">
                  Rescisão Contratual & Desativação de Acesso
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Cálculo automático de verbas rescisórias, emissão do TRCT, última folha e revogação de credenciais.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {funcionario.matricula || 'MAT-001'}
            </Badge>
          </div>

          {/* Cartão de Identificação do Colaborador */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-card border border-border/60 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Colaborador</span>
              <strong className="text-foreground">{funcionario.nome}</strong>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Cargo / Vínculo</span>
              <span className="text-foreground">{funcionario.cargo} ({funcionario.tipoContrato || 'CLT'})</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Salário Base</span>
              <span className="font-mono font-semibold text-foreground">{fmt(funcionario.salarioBase)}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Admissão</span>
              <span className="font-mono text-foreground">
                {funcionario.dataAdmissao ? new Date(`${funcionario.dataAdmissao}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-5 space-y-6">
          {demissaoConcluida && resultadoFinal ? (
            /* TELA DE SUCESSO APÓS HOMOLOGAÇÃO */
            <div className="space-y-5 py-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-display font-bold text-foreground">
                  Desligamento Concluído & Acessos Revogados!
                </h3>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                  A rescisão contratual de <strong>{funcionario.nome}</strong> foi registrada oficialmente.
                  O colaborador teve seu status atualizado para <strong>DEMITIDO</strong> e todas as suas credenciais de login no sistema foram <strong>desativadas</strong>.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadTerminationContractPDF({
                        funcionario,
                        resultado: resultadoFinal,
                        empresa: dadosEmpresa,
                      })
                    }
                    className="text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    Baixar Contrato TRCT (PDF)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadFinalTerminationPayslipPDF({
                        funcionario,
                        resultado: resultadoFinal,
                        empresa: dadosEmpresa,
                      })
                    }
                    className="text-xs"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Baixar Última Folha Rescisória (PDF)
                  </Button>
                </div>
              </div>

              {/* Resumo dos Valores Finais */}
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3 text-xs">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Demonstrativo do Pagamento Rescisório
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="text-[10px] text-muted-foreground uppercase block">Total Proventos Brutos</span>
                    <strong className="text-sm font-mono text-foreground">{fmt(resultadoFinal.totalBruto)}</strong>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="text-[10px] text-muted-foreground uppercase block">Total Deduções / Retenções</span>
                    <strong className="text-sm font-mono text-destructive">- {fmt(resultadoFinal.totalDescontos)}</strong>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold block">Líquido a Pagar</span>
                    <strong className="text-base font-mono text-emerald-600 dark:text-emerald-400 font-bold">{fmt(resultadoFinal.liquidoRescisao)}</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* FORMULÁRIO DE CÁLCULO E PARÂMETROS RESCISÓRIOS */
            <div className="space-y-6">
              {/* 1. PARÂMETROS DO DESLIGAMENTO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4 p-4 rounded-xl border border-border/70 bg-card">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    1. Dados do Desligamento
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data de Desligamento</Label>
                      <Input
                        type="date"
                        value={dataDemissao}
                        onChange={(e) => setDataDemissao(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Saldo de Salário (Dias)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={diasSaldoSalario}
                        onChange={(e) => setDiasSaldoSalario(Number(e.target.value))}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Causa / Modalidade da Demissão</Label>
                    <select
                      value={motivo}
                      onChange={(e) => handleMotivoChange(e.target.value as MotivoRescisao)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-medium"
                    >
                      <option value="SEM_JUSTA_CAUSA">Dispensa Sem Justa Causa (Empregador)</option>
                      <option value="PEDIDO_DEMISSAO">Pedido de Demissão (Colaborador)</option>
                      <option value="ACORDO_MUTUO">Demissão por Acordo Mútuo (Art. 484-A CLT)</option>
                      <option value="COM_JUSTA_CAUSA">Dispensa Com Justa Causa</option>
                      <option value="TERMINO_CONTRATO">Término de Contrato de Experiência / Prazo</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Modalidade do Aviso Prévio</Label>
                    <select
                      value={modalidadeAviso}
                      onChange={(e) => setModalidadeAviso(e.target.value as ModalidadeAvisoPrevio)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-medium"
                    >
                      <option value="INDENIZADO_EMPREGADOR">Indenizado pelo Empregador (Lei 12.506)</option>
                      <option value="TRABALHADO">Trabalhado</option>
                      <option value="DISPENSADO">Dispensado</option>
                      <option value="NAO_CUMPRIDO_DESCONTADO">Não Cumprido (Descontar 30 dias)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Saldo FGTS para Multa (R$)</Label>
                      <Input
                        type="number"
                        value={saldoFGTS}
                        onChange={(e) => setSaldoFGTS(Number(e.target.value))}
                        className="h-9 text-xs"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pb-2.5">
                      <Checkbox
                        checked={feriasVencidas}
                        onCheckedChange={(checked) => setFeriasVencidas(Boolean(checked))}
                      />
                      <span>Possui Férias Vencidas</span>
                    </label>
                  </div>
                </div>

                {/* 2. MELHORIAS E ADICIONAIS CONTRATUAIS ESPECÍFICOS */}
                <div className="space-y-4 p-4 rounded-xl border border-border/70 bg-card">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      2. Melhorias Contratuais & Adicionais
                    </h4>
                    <span className="text-[10px] text-muted-foreground">Específicos do colaborador</span>
                  </div>

                  {/* Adicionar novo item */}
                  <div className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border/60">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Ex: Bônus de Rescisão, Quebra de Caixa, etc."
                        value={novoItemDesc}
                        onChange={(e) => setNovoItemDesc(e.target.value)}
                        className="col-span-2 h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="R$ Valor"
                        value={novoItemValor}
                        onChange={(e) => setNovoItemValor(e.target.value ? Number(e.target.value) : '')}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="itemTipo"
                            checked={novoItemTipo === 'provento'}
                            onChange={() => setNovoItemTipo('provento')}
                            className="text-primary"
                          />
                          <span className="text-emerald-600 font-medium">+ Provento</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="itemTipo"
                            checked={novoItemTipo === 'desconto'}
                            onChange={() => setNovoItemTipo('desconto')}
                            className="text-primary"
                          />
                          <span className="text-destructive font-medium">- Desconto</span>
                        </label>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleAddExtra}
                        className="h-7 text-xs px-2.5"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                  </div>

                  {/* Lista de adicionais ativos */}
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {adicionaisExtras.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-4">
                        Nenhum adicional ou dedução personalizada adicionada.
                      </p>
                    ) : (
                      adicionaisExtras.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50 text-xs"
                        >
                          <div>
                            <span className="font-medium text-foreground block">{item.descricao}</span>
                            <span
                              className={`text-[10px] font-mono ${
                                item.tipo === 'provento' ? 'text-emerald-600' : 'text-destructive'
                              }`}
                            >
                              {item.tipo === 'provento' ? '+ Provento' : '- Desconto'}: {fmt(item.valor)}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveExtra(item.id)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 3. DEMONSTRATIVO DAS VERBAS RESCISÓRIAS */}
              {resultado && (
                <div className="space-y-4 p-4 rounded-xl border border-border/70 bg-card">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-primary" />
                      3. Demonstrativo de Verbas Rescisórias (TRCT)
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      Maior Remuneração: <strong className="text-foreground font-mono">{fmt(resultado.baseCalculoRescisoria)}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Proventos */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border border-border/60">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block border-b pb-1 border-border/60">
                        Proventos a Pagar
                      </span>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Saldo Salário ({resultado.saldoSalario.dias} dias)</span>
                        <span className="font-mono font-semibold text-foreground">{fmt(resultado.saldoSalario.valor)}</span>
                      </div>
                      {resultado.avisoPrevio.valor > 0 && resultado.avisoPrevio.tipo === 'provento' && (
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Aviso Prévio ({resultado.avisoPrevio.dias} dias)</span>
                          <span className="font-mono font-semibold text-foreground">{fmt(resultado.avisoPrevio.valor)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">13º Salário Proporcional</span>
                        <span className="font-mono font-semibold text-foreground">{fmt(resultado.decimoTerceiro.total)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Férias Proporcionais + 1/3</span>
                        <span className="font-mono font-semibold text-foreground">{fmt(resultado.ferias.total)}</span>
                      </div>
                      {resultado.adicionaisExtras.proventos > 0 && (
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Melhorias / Adicionais Extras</span>
                          <span className="font-mono font-semibold text-foreground">{fmt(resultado.adicionaisExtras.proventos)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border/60 font-semibold">
                        <span>Total Proventos Brutos</span>
                        <span className="font-mono text-emerald-600">{fmt(resultado.totalBruto)}</span>
                      </div>
                    </div>

                    {/* Deduções */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border border-border/60">
                      <span className="text-[10px] uppercase font-bold text-destructive block border-b pb-1 border-border/60">
                        Deduções & Retenções
                      </span>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">INSS Saldo + 13º</span>
                        <span className="font-mono text-destructive">- {fmt(resultado.descontos.totalINSS)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">IRRF na Fonte</span>
                        <span className="font-mono text-destructive">- {fmt(resultado.descontos.totalIRRF)}</span>
                      </div>
                      {resultado.descontos.avisoDescontado > 0 && (
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Aviso Não Cumprido</span>
                          <span className="font-mono text-destructive">- {fmt(resultado.descontos.avisoDescontado)}</span>
                        </div>
                      )}
                      {resultado.adicionaisExtras.descontos > 0 && (
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">Deduções / Vales Extras</span>
                          <span className="font-mono text-destructive">- {fmt(resultado.adicionaisExtras.descontos)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border/60 font-semibold">
                        <span>Total Deduções</span>
                        <span className="font-mono text-destructive">- {fmt(resultado.totalDescontos)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Barra Destaque Líquido */}
                  <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 block">
                        Líquido Rescisório Final
                      </span>
                      <span className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {fmt(resultado.liquidoRescisao)}
                      </span>
                    </div>

                    <div className="text-right text-xs text-muted-foreground space-y-0.5">
                      {resultado.fgts.multaRescisoria > 0 && (
                        <div>
                          Multa FGTS ({resultado.fgts.percentualMulta}%):{' '}
                          <strong className="text-foreground font-mono">{fmt(resultado.fgts.multaRescisoria)}</strong>
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        Prazo Legal: <strong>10 dias corridos</strong>
                      </div>
                    </div>
                  </div>

                  {/* Alerta de Segurança e Revogação de Credenciais */}
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2.5 text-xs text-destructive">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block">Aviso de Segurança & Bloqueio Automático de Acesso:</strong>
                      Ao clicar no botão de homologação abaixo, o sistema irá imediatamente <strong>desativar o perfil e revogar todas as credenciais de login</strong> de {funcionario.nome}, garantindo total conformidade e segurança da informação.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Rodapé com Botões de Ação */}
        <div className="p-4 bg-muted/30 border-t border-border/70 flex items-center justify-between flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            {demissaoConcluida ? 'Fechar' : 'Cancelar'}
          </Button>

          {!demissaoConcluida && resultado && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadTerminationContractPDF({
                    funcionario,
                    resultado,
                    empresa: dadosEmpresa,
                  })
                }
                className="text-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Prévia TRCT
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isProcessing}
                onClick={handleExecutarDemissao}
                className="text-xs font-semibold px-4"
              >
                {isProcessing ? (
                  <>Processando Desligamento...</>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    Homologar Rescisão, Emitir Documentos & Desativar Credenciais
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
