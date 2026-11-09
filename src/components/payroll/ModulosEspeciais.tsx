import React, { useState } from 'react';
import { Palmtree, Gift, UserMinus, Calculator, Users, Printer, CheckCircle2, Lock } from 'lucide-react';
import {
  calcularFerias,
  calcularDecimoTerceiro,
  calcularRescisao,
} from '@/lib/folhaCalculos';
import { FuncionarioConcessionaria, FolhaMensalItem } from '@/hooks/useFolhaConcessionaria';
import { PanelCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { TerminationModal } from './TerminationModal';

interface ModulosEspeciaisProps {
  funcionarios: FuncionarioConcessionaria[];
  folhas?: FolhaMensalItem[];
  onDesligarColaborador?: (func: FuncionarioConcessionaria, motivo: string, dataDemissao: string) => Promise<void>;
}

export default function ModulosEspeciais({
  funcionarios = [],
  folhas = [],
  onDesligarColaborador,
}: ModulosEspeciaisProps) {
  const { toast } = useToast();
  const [moduloAtivo, setModuloAtivo] = useState<'FERIAS' | 'DECIMO_TERCEIRO' | 'RESCISAO'>(
    'FERIAS',
  );
  const [selectedFuncId, setSelectedFuncId] = useState<string>('');

  // Estados Férias
  const [feriasSalario, setFeriasSalario] = useState(4500);
  const [feriasMediaComissoes, setFeriasMediaComissoes] = useState(0);
  const [feriasDias, setFeriasDias] = useState(30);
  const [feriasVende10, setFeriasVende10] = useState(false);
  const [feriasAdiantar13, setFeriasAdiantar13] = useState(false);
  const [feriasDependentes, setFeriasDependentes] = useState(0);
  const [resultadoFerias, setResultadoFerias] = useState<any>(null);

  // Estados 13º Salário
  const [decimoSalario, setDecimoSalario] = useState(4500);
  const [decimoMediaComissoes, setDecimoMediaComissoes] = useState(0);
  const [decimoMeses, setDecimoMeses] = useState(12);
  const [decimoParcela, setDecimoParcela] = useState<'PRIMEIRA' | 'SEGUNDA'>('PRIMEIRA');
  const [decimoDependentes, setDecimoDependentes] = useState(0);
  const [resultadoDecimo, setResultadoDecimo] = useState<any>(null);

  // Estados Rescisão
  const [rescisaoSalario, setRescisaoSalario] = useState(4500);
  const [rescisaoMediaComissoes, setRescisaoMediaComissoes] = useState(0);
  const [rescisaoAdmissao, setRescisaoAdmissao] = useState('2023-01-10');
  const [rescisaoDemissao, setRescisaoDemissao] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [rescisaoMotivo, setRescisaoMotivo] = useState<
    'SEM_JUSTA_CAUSA' | 'PEDIDO_DEMISSAO' | 'ACORDO_MUTUO' | 'COM_JUSTA_CAUSA'
  >('SEM_JUSTA_CAUSA');
  const [rescisaoAvisoIndenizado, setRescisaoAvisoIndenizado] = useState(true);
  const [rescisaoSaldoDias, setRescisaoSaldoDias] = useState(15);
  const [rescisaoFeriasVencidas, setRescisaoFeriasVencidas] = useState(false);
  const [rescisaoSaldoFGTS, setRescisaoSaldoFGTS] = useState(12500);
  const [resultadoRescisao, setResultadoRescisao] = useState<any>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [terminationModalOpen, setTerminationModalOpen] = useState(false);

  const formatarMoeda = (v?: number) =>
    (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleSelectFuncionario = (funcId: string) => {
    setSelectedFuncId(funcId);
    setErroValidacao(null);
    const func = funcionarios.find((f) => f.id === funcId);
    if (!func) return;

    const sal = Number(func.salarioBase) || 0;
    const dep = Number(func.dependentes) || 0;
    const adm = func.dataAdmissao || '2024-01-10';

    const folhasColaborador = folhas.filter((fl) => fl.funcionarioId === func.id);
    const mediaComiss =
      folhasColaborador.length > 0
        ? +(
            folhasColaborador.reduce(
              (acc, fl) =>
                acc +
                (Number(fl.resultado?.totalComissoes) || 0) +
                (Number(fl.resultado?.comissaoDSR) || 0),
              0,
            ) / folhasColaborador.length
          ).toFixed(2)
        : 0;

    setFeriasSalario(sal);
    setFeriasMediaComissoes(mediaComiss);
    setFeriasDependentes(dep);
    setDecimoSalario(sal);
    setDecimoMediaComissoes(mediaComiss);
    setDecimoDependentes(dep);
    setRescisaoSalario(sal);
    setRescisaoMediaComissoes(mediaComiss);
    setRescisaoAdmissao(adm);
  };

  const handleCalcularFerias = () => {
    setErroValidacao(null);
    if (Number(feriasSalario) <= 0) {
      setErroValidacao('Informe um salário base maior que zero para calcular as férias.');
      return;
    }
    const res = calcularFerias(
      feriasSalario,
      feriasDias,
      feriasVende10,
      feriasAdiantar13,
      feriasDependentes,
      feriasMediaComissoes,
    );
    setResultadoFerias(res);
  };

  const handleCalcularDecimo = () => {
    setErroValidacao(null);
    if (Number(decimoSalario) <= 0) {
      setErroValidacao('Informe um salário base maior que zero para calcular o 13º salário.');
      return;
    }
    const res = calcularDecimoTerceiro(
      decimoSalario,
      decimoMeses,
      decimoParcela,
      decimoDependentes,
      decimoMediaComissoes,
    );
    setResultadoDecimo(res);
  };

  const handleCalcularRescisao = () => {
    setErroValidacao(null);
    if (Number(rescisaoSalario) <= 0) {
      setErroValidacao('Informe um salário base maior que zero para calcular a rescisão.');
      return;
    }
    if (
      rescisaoAdmissao &&
      rescisaoDemissao &&
      new Date(rescisaoDemissao) < new Date(rescisaoAdmissao)
    ) {
      setErroValidacao('A data de demissão não pode ser anterior à data de admissão.');
      return;
    }
    const res = calcularRescisao({
      salarioBase: rescisaoSalario,
      mediaComissoes: rescisaoMediaComissoes,
      dataAdmissao: rescisaoAdmissao,
      dataDemissao: rescisaoDemissao,
      motivo: rescisaoMotivo,
      avisoPrevioIndenizado: rescisaoAvisoIndenizado,
      saldoSalarioDias: rescisaoSaldoDias,
      feriasVencidas: rescisaoFeriasVencidas,
      saldoFGTSAtual: rescisaoSaldoFGTS,
    });
    setResultadoRescisao(res);
  };

  const selectedFunc = funcionarios.find((f) => f.id === selectedFuncId);

  return (
    <div className="space-y-5">
      {erroValidacao && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive px-4 py-3 text-xs font-medium">
          {erroValidacao}
        </div>
      )}

      {/* Seletor rápido de colaborador e abas */}
      <div className="rounded-xl border border-border/70 bg-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant={moduloAtivo === 'FERIAS' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setModuloAtivo('FERIAS')}
            className="h-9 text-xs"
          >
            <Palmtree className="w-3.5 h-3.5 mr-1.5" />
            Férias CLT (com 1/3)
          </Button>
          <Button
            type="button"
            variant={moduloAtivo === 'DECIMO_TERCEIRO' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setModuloAtivo('DECIMO_TERCEIRO')}
            className="h-9 text-xs"
          >
            <Gift className="w-3.5 h-3.5 mr-1.5" />
            13º Salário
          </Button>
          <Button
            type="button"
            variant={moduloAtivo === 'RESCISAO' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setModuloAtivo('RESCISAO')}
            className="h-9 text-xs"
          >
            <UserMinus className="w-3.5 h-3.5 mr-1.5" />
            Rescisão Trabalhista (TRCT)
          </Button>
        </div>

        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={selectedFuncId}
            onChange={(e) => handleSelectFuncionario(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground min-w-[260px]"
          >
            <option value="">Simulação Livre / Selecionar Colaborador...</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} ({f.cargo}) — {formatarMoeda(f.salarioBase)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. MÓDULO DE FÉRIAS */}
      {moduloAtivo === 'FERIAS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PanelCard
            title="Parâmetros de Férias"
            description="Configure os dias de descanso, abono pecuniário e adiantamento"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Salário Base de Cálculo (R$)</Label>
                  <Input
                    type="number"
                    value={feriasSalario}
                    onChange={(e) => setFeriasSalario(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Média de Comissões + DSR (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={feriasMediaComissoes}
                    onChange={(e) => setFeriasMediaComissoes(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dias de Gozo</Label>
                  <select
                    value={feriasDias}
                    onChange={(e) => setFeriasDias(Number(e.target.value))}
                    disabled={feriasVende10}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs disabled:opacity-50"
                  >
                    <option value={30}>30 dias integrais</option>
                    <option value={20}>20 dias</option>
                    <option value={15}>15 dias</option>
                    <option value={10}>10 dias</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dependentes IRRF</Label>
                  <Input
                    type="number"
                    value={feriasDependentes}
                    onChange={(e) => setFeriasDependentes(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                  <Checkbox
                    checked={feriasVende10}
                    onCheckedChange={(checked) => setFeriasVende10(Boolean(checked))}
                  />
                  <span>Abono Pecuniário (converter 10 dias em pecúnia)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                  <Checkbox
                    checked={feriasAdiantar13}
                    onCheckedChange={(checked) => setFeriasAdiantar13(Boolean(checked))}
                  />
                  <span>Adiantar 1ª Parcela do 13º Salário (50%)</span>
                </label>
              </div>

              <Button type="button" onClick={handleCalcularFerias} className="w-full">
                <Calculator className="w-4 h-4 mr-1.5" />
                Calcular Férias CLT
              </Button>
            </div>
          </PanelCard>

          <PanelCard
            title="Demonstrativo Estimado de Férias"
            description="CLT Art. 129 a 145"
            aside={
              <div className="flex items-center gap-2">
                {resultadoFerias && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="h-7 text-xs no-print"
                  >
                    <Printer className="w-3 h-3 mr-1" /> Imprimir
                  </Button>
                )}
                <Badge variant="outline" className="text-[10px]">Simulação</Badge>
              </div>
            }
          >
            {resultadoFerias ? (
              <div className="space-y-4">
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">
                      Remuneração dos Dias de Gozo ({resultadoFerias.diasGozo} dias)
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatarMoeda(resultadoFerias.valorGozo)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">1/3 Constitucional sobre Gozo</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatarMoeda(resultadoFerias.tercoConstitucional)}
                    </span>
                  </div>

                  {resultadoFerias.vendeu10Dias && (
                    <>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Abono Pecuniário (10 dias isento)</span>
                        <span className="font-mono font-semibold text-foreground">
                          {formatarMoeda(resultadoFerias.abonoPecuniario)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">1/3 sobre Abono Pecuniário</span>
                        <span className="font-mono font-semibold text-foreground">
                          {formatarMoeda(resultadoFerias.tercoAbono)}
                        </span>
                      </div>
                    </>
                  )}

                  {resultadoFerias.adiantamento13 > 0 && (
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Adiantamento 50% do 13º Salário</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatarMoeda(resultadoFerias.adiantamento13)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 font-semibold text-foreground">
                    <span>Total Proventos Brutos</span>
                    <span className="font-mono">{formatarMoeda(resultadoFerias.totalBruto)}</span>
                  </div>

                  <div className="flex justify-between text-destructive">
                    <span>(-) Desconto INSS Progressivo</span>
                    <span className="font-mono">- {formatarMoeda(resultadoFerias.inss?.valor)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>(-) Desconto IRRF Retido</span>
                    <span className="font-mono">- {formatarMoeda(resultadoFerias.irrf?.valor)}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Valor Líquido a Receber
                    </span>
                    <span className="text-xl font-display font-bold text-success font-mono">
                      {formatarMoeda(resultadoFerias.liquidoFerias)}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    Prazo legal de pagamento:
                    <strong className="block text-foreground">Até 2 dias antes do início</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Preencha os parâmetros ao lado e clique em &ldquo;Calcular Férias CLT&rdquo;.
              </div>
            )}
          </PanelCard>
        </div>
      )}

      {/* 2. MÓDULO 13º SALÁRIO */}
      {moduloAtivo === 'DECIMO_TERCEIRO' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PanelCard
            title="Gratificação Natalina (13º Salário)"
            description="Cálculo de 1ª parcela (adiantamento) e 2ª parcela (quitação)"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Salário Base (R$)</Label>
                  <Input
                    type="number"
                    value={decimoSalario}
                    onChange={(e) => setDecimoSalario(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Média de Comissões + DSR (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={decimoMediaComissoes}
                    onChange={(e) => setDecimoMediaComissoes(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Meses Trabalhados no Ano</Label>
                  <select
                    value={decimoMeses}
                    onChange={(e) => setDecimoMeses(Number(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} / 12 avos
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Parcela</Label>
                  <select
                    value={decimoParcela}
                    onChange={(e) => setDecimoParcela(e.target.value as 'PRIMEIRA' | 'SEGUNDA')}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-medium"
                  >
                    <option value="PRIMEIRA">1ª Parcela (Adiantamento 50%)</option>
                    <option value="SEGUNDA">2ª Parcela (Quitação com Encargos)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Dependentes IRRF</Label>
                <Input
                  type="number"
                  value={decimoDependentes}
                  onChange={(e) => setDecimoDependentes(Number(e.target.value))}
                  className="h-9"
                />
              </div>

              <Button type="button" onClick={handleCalcularDecimo} className="w-full">
                <Calculator className="w-4 h-4 mr-1.5" />
                Calcular 13º Salário
              </Button>
            </div>
          </PanelCard>

          <PanelCard
            title="Demonstrativo do 13º Salário"
            description="Lei 4.090/1962"
            aside={
              <div className="flex items-center gap-2">
                {resultadoDecimo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="h-7 text-xs no-print"
                  >
                    <Printer className="w-3 h-3 mr-1" /> Imprimir
                  </Button>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {decimoParcela === 'PRIMEIRA' ? '1ª Parcela' : '2ª Parcela'}
                </Badge>
              </div>
            }
          >
            {resultadoDecimo ? (
              <div className="space-y-4">
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Fração Proporcional</span>
                    <span className="font-mono font-semibold text-foreground">
                      {resultadoDecimo.mesesTrabalhados} / 12 avos
                    </span>
                  </div>

                  {decimoParcela === 'PRIMEIRA' ? (
                    <>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Valor Bruto da 1ª Parcela (50%)</span>
                        <span className="font-mono font-semibold text-foreground">
                          {formatarMoeda(resultadoDecimo.valorBruto)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground bg-muted/20 p-3 rounded-md border border-border/60">
                        A 1ª parcela é isenta de retenção de INSS e IRRF, com vencimento legal até 30 de Novembro.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Valor Integral Proporcional</span>
                        <span className="font-mono font-semibold text-foreground">
                          {formatarMoeda(resultadoDecimo.valorIntegral)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">(-) Adiantamento 1ª Parcela</span>
                        <span className="font-mono font-semibold text-foreground">
                          - {formatarMoeda(resultadoDecimo.adiantamentoJaPago)}
                        </span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>(-) INSS sobre 13º</span>
                        <span className="font-mono">- {formatarMoeda(resultadoDecimo.inss?.valor)}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>(-) IRRF Exclusivo na Fonte</span>
                        <span className="font-mono">- {formatarMoeda(resultadoDecimo.irrf?.valor)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Líquido da Parcela
                    </span>
                    <span className="text-xl font-display font-bold text-success font-mono">
                      {formatarMoeda(resultadoDecimo.valorLiquido)}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    FGTS (8% empregador):
                    <strong className="block font-mono text-foreground">
                      {formatarMoeda(
                        (resultadoDecimo.valorBruto || resultadoDecimo.valorIntegral) * 0.08,
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Selecione a parcela desejada e clique em &ldquo;Calcular 13º Salário&rdquo;.
              </div>
            )}
          </PanelCard>
        </div>
      )}

      {/* 3. MÓDULO RESCISÃO CONTRATUAL */}
      {moduloAtivo === 'RESCISAO' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PanelCard
            title="Parâmetros Rescisórios (TRCT)"
            description="Simulação de desligamento e verbas rescisórias"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de Admissão</Label>
                  <Input
                    type="date"
                    value={rescisaoAdmissao}
                    onChange={(e) => setRescisaoAdmissao(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de Desligamento</Label>
                  <Input
                    type="date"
                    value={rescisaoDemissao}
                    onChange={(e) => setRescisaoDemissao(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Salário Base (R$)</Label>
                  <Input
                    type="number"
                    value={rescisaoSalario}
                    onChange={(e) => setRescisaoSalario(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Média Comissões (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rescisaoMediaComissoes}
                    onChange={(e) => setRescisaoMediaComissoes(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Saldo FGTS p/ Multa (R$)</Label>
                  <Input
                    type="number"
                    value={rescisaoSaldoFGTS}
                    onChange={(e) => setRescisaoSaldoFGTS(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Modalidade de Desligamento</Label>
                <select
                  value={rescisaoMotivo}
                  onChange={(e) => setRescisaoMotivo(e.target.value as any)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-medium"
                >
                  <option value="SEM_JUSTA_CAUSA">Dispensa Sem Justa Causa (Empregador)</option>
                  <option value="PEDIDO_DEMISSAO">Pedido de Demissão (Colaborador)</option>
                  <option value="ACORDO_MUTUO">Demissão por Acordo Mútuo (Art. 484-A CLT)</option>
                  <option value="COM_JUSTA_CAUSA">Dispensa Com Justa Causa</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Saldo de Salário (Dias)</Label>
                  <Input
                    type="number"
                    value={rescisaoSaldoDias}
                    onChange={(e) => setRescisaoSaldoDias(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pb-2.5">
                  <Checkbox
                    checked={rescisaoFeriasVencidas}
                    onCheckedChange={(checked) => setRescisaoFeriasVencidas(Boolean(checked))}
                  />
                  <span>Possui Férias Vencidas</span>
                </label>
              </div>

              {rescisaoMotivo === 'SEM_JUSTA_CAUSA' && (
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <Checkbox
                    checked={rescisaoAvisoIndenizado}
                    onCheckedChange={(checked) => setRescisaoAvisoIndenizado(Boolean(checked))}
                  />
                  <span>Aviso Prévio Indenizado (Lei 12.506 Proporcional)</span>
                </label>
              )}

              <Button type="button" onClick={handleCalcularRescisao} className="w-full">
                <Calculator className="w-4 h-4 mr-1.5" />
                Calcular Rescisão TRCT
              </Button>
            </div>
          </PanelCard>

          <PanelCard
            title="Demonstrativo Rescisório (TRCT)"
            description="Resumo das verbas trabalhistas e FGTS"
            aside={
              <div className="flex items-center gap-2">
                {resultadoRescisao && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="h-7 text-xs no-print"
                  >
                    <Printer className="w-3 h-3 mr-1" /> Imprimir
                  </Button>
                )}
                <Badge variant="outline" className="text-[10px]">Homologação</Badge>
              </div>
            }
          >
            {resultadoRescisao ? (
              <div className="space-y-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tempo de Casa / Aviso Prévio</span>
                    <span className="font-mono font-semibold text-foreground">
                      {resultadoRescisao.anosTrabalhados} anos ({resultadoRescisao.diasAvisoPrevio} dias)
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Saldo de Salário ({rescisaoSaldoDias} dias)</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatarMoeda(resultadoRescisao.saldoSalario)}
                    </span>
                  </div>
                  {resultadoRescisao.valorAvisoPrevio > 0 && (
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Aviso Prévio Indenizado Proporcional</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatarMoeda(resultadoRescisao.valorAvisoPrevio)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">13º Salário Proporcional</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatarMoeda(resultadoRescisao.decimoTerceiroProp)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Férias Proporcionais + 1/3</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatarMoeda(
                        resultadoRescisao.feriasProporcionais + resultadoRescisao.tercoFerias,
                      )}
                    </span>
                  </div>
                  {resultadoRescisao.feriasVencidasValor > 0 && (
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Férias Vencidas Integrais</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatarMoeda(resultadoRescisao.feriasVencidasValor)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 font-semibold text-foreground">
                    <span>Total Verbas Rescisórias Brutas</span>
                    <span className="font-mono">{formatarMoeda(resultadoRescisao.totalBruto)}</span>
                  </div>

                  <div className="flex justify-between text-destructive">
                    <span>(-) Descontos Legais (INSS)</span>
                    <span className="font-mono">- {formatarMoeda(resultadoRescisao.totalINSS)}</span>
                  </div>

                  {resultadoRescisao.multaFGTS > 0 && (
                    <div className="mt-2 p-2.5 rounded-md bg-muted/30 border border-border/60 flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Multa Rescisória FGTS (GRRF)</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatarMoeda(resultadoRescisao.multaFGTS)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Líquido Rescisório
                    </span>
                    <span className="text-xl font-display font-bold text-success font-mono">
                      {formatarMoeda(resultadoRescisao.liquidoRescisao)}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    Prazo legal (Art. 477 CLT):
                    <strong className="block text-foreground">Até 10 dias corridos</strong>
                  </div>
                </div>

                {selectedFunc && selectedFunc.status !== 'DEMITIDO' && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setTerminationModalOpen(true)}
                    className="w-full text-xs font-semibold no-print shadow-sm"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    Abrir Sistema Oficial de Demissão (TRCT, Última Folha & Bloqueio)
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Configure os parâmetros ao lado e clique em &ldquo;Calcular Rescisão TRCT&rdquo;.
              </div>
            )}
          </PanelCard>
        </div>
      )}

      <TerminationModal
        open={terminationModalOpen}
        onOpenChange={setTerminationModalOpen}
        funcionario={selectedFunc || null}
        folhas={folhas}
        onTerminationCompleted={() => {
          if (selectedFunc && onDesligarColaborador) {
            onDesligarColaborador(selectedFunc, rescisaoMotivo, rescisaoDemissao);
          }
        }}
      />
    </div>
  );
}
