import { useRef } from 'react';
import {
  Printer,
  Bike,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Wrench,
  Scale,
  FileCheck,
  QrCode,
  Award,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UsedMotoInspectionData } from '@/types/inspection';

interface InspectionPrintDialogProps {
  inspection: UsedMotoInspectionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InspectionPrintDialog({
  inspection,
  open,
  onOpenChange,
}: InspectionPrintDialogProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!inspection) return null;

  const handlePrint = () => {
    window.print();
  };

  const statusBadge = () => {
    if (inspection.final_status === 'aprovado') {
      return (
        <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 px-4 py-2.5 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-8 h-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="text-lg font-black tracking-tight uppercase font-display">
              MOTO APROVADA
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">
              Quadro alinhado, motor íntegro e documentação 100% liberada
            </div>
          </div>
        </div>
      );
    }
    if (inspection.final_status === 'aprovado_com_apontamentos') {
      return (
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 px-4 py-2.5 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-8 h-8 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <div className="text-lg font-black tracking-tight uppercase font-display">
              APROVADA COM APONTAMENTOS
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">
              Quadro preservado. Descontar débitos ou revisão na compra/troca
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 px-4 py-2.5 text-rose-700 dark:text-rose-400">
        <XCircle className="w-8 h-8 shrink-0 text-rose-600 dark:text-rose-400" />
        <div>
          <div className="text-lg font-black tracking-tight uppercase font-display">
            REPROVADA / RISCO CRÍTICO
          </div>
          <div className="text-[11px] font-medium text-muted-foreground">
            Bloqueio judicial, quadro soldado, motor danificado ou adulteração
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[96vh] overflow-y-auto p-0 rounded-2xl border bg-background print:max-w-none print:m-0 print:p-0 print:border-none print:shadow-none">
        {/* Barra superior de controle */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 backdrop-blur px-5 py-3 print:hidden">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" />
            <DialogTitle className="text-sm font-bold">
              Laudo de Vistoria de Moto Usada — {inspection.code}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button size="sm" className="gap-1.5 font-bold shadow-md shadow-primary/20" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" />
              Imprimir Laudo
            </Button>
          </div>
        </div>

        {/* DOCUMENTO OFICIAL TIMBRADO (1 PÁGINA) */}
        <div
          ref={printAreaRef}
          className="p-6 sm:p-10 space-y-4 bg-background text-foreground print:p-6 print:space-y-4 text-xs"
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b-2 border-foreground/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black uppercase font-display tracking-tight">
                  CONCESSIONÁRIA SHINERAY & MULTIMARCAS
                </span>
                <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[9px] font-black uppercase">
                  Laudo de Entrada / Troca
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Avaliação Técnica, Vistoria de Procedência & Laudo de Motos Usadas
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="font-mono font-black text-sm text-foreground">{inspection.code}</div>
              <div className="text-[10px] text-muted-foreground">
                Data: {new Date(inspection.created_at).toLocaleDateString('pt-BR')} às{' '}
                {new Date(inspection.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">
                Avaliador: {inspection.inspector_name}
              </div>
            </div>
          </div>

          {/* Banner de Parecer */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
            <div className="sm:col-span-3">{statusBadge()}</div>
            <div className="p-3 rounded-2xl border bg-muted/20 text-center">
              <span className="text-[9px] uppercase font-bold text-muted-foreground">Score da Moto</span>
              <div className="text-2xl font-black font-display text-primary mt-0.5">{inspection.score}/100</div>
            </div>
          </div>

          {/* 1. Dados da Moto Usada */}
          <div className="p-3.5 rounded-2xl bg-muted/15 border space-y-2">
            <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 text-[10px]">
              <Bike className="w-3.5 h-3.5 text-primary" />
              1. Identificação da Moto Avaliada
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold">MOTO / MODELO</span>
                <div className="font-bold text-sm text-foreground">{inspection.brand} {inspection.model}</div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold">PLACA</span>
                <div className="font-mono font-black text-sm uppercase bg-foreground/5 px-2 py-0.5 rounded inline-block">
                  {inspection.plate || 'SEM PLACA'}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold">ANO / COR</span>
                <div className="font-semibold">{inspection.year} • {inspection.color}</div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold">QUILOMETRAGEM</span>
                <div className="font-semibold">{inspection.mileage ? `${inspection.mileage.toLocaleString('pt-BR')} km` : 'Não informada'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t text-[11px]">
              <div>
                <span className="text-muted-foreground">Chassi Canote: </span>
                <strong className="font-mono uppercase">{inspection.chassis}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Cliente / Dono: </span>
                <strong>{inspection.client_name || 'Particular / Troca'}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Telefone: </span>
                <strong>{inspection.client_phone || 'Não informado'}</strong>
              </div>
            </div>
          </div>

          {/* 2. Procedência Legal & Multas */}
          <div className="p-3.5 rounded-2xl bg-muted/15 border space-y-2">
            <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              2. Procedência Legal, Restrições & Multas a Abater
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Furto / Roubo:</span>
                <strong className={inspection.theft_status === 'nada_consta' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {inspection.theft_status === 'nada_consta' ? '✓ Nada Consta' : '🚨 ALERTA ATIVO'}
                </strong>
              </div>
              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Bloqueio RENAJUD:</span>
                <strong className={inspection.renajud_status === 'nada_consta' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {inspection.renajud_status === 'nada_consta' ? '✓ Livre / Sem Bloqueio' : '🚨 Bloqueio Judicial'}
                </strong>
              </div>
              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Histórico Leilão:</span>
                <strong className={inspection.auction_status === 'sem_passagem' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {inspection.auction_status === 'sem_passagem' ? '✓ Sem Leilão' : 'Consta Registro'}
                </strong>
              </div>
              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Gravame:</span>
                <strong>{inspection.finance_status === 'quitado' ? '✓ Quitada' : 'Financiada'}</strong>
              </div>
            </div>

            {/* Total de débitos */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border bg-background text-[11px]">
              <div>
                <span className="font-semibold text-muted-foreground">Débitos e Multas a Descontar: </span>
                {inspection.debts.length === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Nenhum débito pendente.</span>
                ) : (
                  <span>{inspection.debts.map((d) => `${d.description} (R$ ${d.amount.toFixed(2)})`).join(', ')}</span>
                )}
              </div>
              <div className="font-black text-rose-600 dark:text-rose-400 text-xs shrink-0">
                Total Débitos: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inspection.total_debts)}
              </div>
            </div>
          </div>

          {/* 3. Vistoria Física da Moto */}
          <div className="p-3.5 rounded-2xl bg-muted/15 border space-y-2">
            <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 text-[10px]">
              <Wrench className="w-3.5 h-3.5 text-primary" />
              3. Vistoria Mecânica e Ciclística da Moto
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Quadro / Canote:</span>
                <strong className={inspection.frame_chassis === 'alinhado_original' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {inspection.frame_chassis === 'alinhado_original' ? '✓ Alinhado e Original' : '⚡ Soldado / Empenado'}
                </strong>
              </div>

              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Motor:</span>
                <strong className={inspection.engine_condition === 'otimo_silencioso' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {inspection.engine_condition === 'otimo_silencioso' ? '✓ Sereno / Sem Fumaça' : inspection.engine_condition.replace(/_/g, ' ')}
                </strong>
              </div>

              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Bengalas / Suspensão:</span>
                <strong className={inspection.front_fork === 'alinhada_sem_vazamento' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {inspection.front_fork === 'alinhada_sem_vazamento' ? '✓ Sem Vazamento' : 'Retentor Vazando'}
                </strong>
              </div>

              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Kit Relação:</span>
                <strong className={inspection.chain_kit === 'otimo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {inspection.chain_kit === 'otimo' ? '✓ Ótima' : inspection.chain_kit === 'meia_vida' ? 'Meia-vida' : '⚠️ Gasta / Trocar'}
                </strong>
              </div>

              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Pneus:</span>
                <strong className={inspection.tires === 'bons' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {inspection.tires === 'bons' ? '✓ Bons' : inspection.tires === 'meia_vida' ? 'Meia-vida' : '⚠️ Trocar'}
                </strong>
              </div>

              <div className="p-2 rounded-xl border bg-background">
                <span className="text-muted-foreground block text-[10px]">Carenagens:</span>
                <strong>{inspection.fairings_paint === 'original_impecavel' ? '✓ Impecáveis' : 'Riscos Normais'}</strong>
              </div>

              <div className="p-2 rounded-xl border bg-background sm:col-span-2">
                <span className="text-muted-foreground block text-[10px]">Numeração Canote e Motor:</span>
                <strong className={inspection.numbers_match ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {inspection.numbers_match ? '✓ Chassi e Motor Conferem 100%' : '✗ Numeração Adulterada'}
                </strong>
              </div>
            </div>
          </div>

          {/* 4. Resumo Financeiro da Troca */}
          <div className="p-4 rounded-2xl bg-muted/30 border-2 space-y-2">
            <span className="font-black uppercase tracking-wider text-muted-foreground text-[10px]">
              4. Fechamento Comercial da Troca
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl border bg-card">
                <span className="text-muted-foreground block text-[10px]">Débitos a Abater:</span>
                <strong className="text-rose-600 dark:text-rose-400 font-mono text-sm">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inspection.total_debts)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl border bg-card">
                <span className="text-muted-foreground block text-[10px]">Oficina / Revisão da Moto:</span>
                <strong className="text-amber-600 dark:text-amber-400 font-mono text-sm">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inspection.estimated_workshop_cost || 0)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl border bg-card">
                <span className="text-muted-foreground block text-[10px]">Sugerido Pagar na Troca:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {inspection.suggested_trade_in_value
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inspection.suggested_trade_in_value)
                    : 'A combinar'}
                </strong>
              </div>
            </div>

            {inspection.notes && (
              <div className="text-[11px] text-muted-foreground pt-1 italic">
                Obs: {inspection.notes}
              </div>
            )}
          </div>

          {/* Declaração de Fé Pública & Blindagem de Multas Retroativas */}
          <div className="p-2.5 rounded-xl border border-dashed border-foreground/20 bg-muted/10 text-[9px] text-muted-foreground leading-relaxed space-y-1">
            <div>
              <strong>1. CONFERÊNCIA FÍSICA & FÉ PÚBLICA:</strong> Atestamos a conferência presencial da motocicleta, com verificação física do número de chassi no canote da direção, numeração do motor e confronto direto com o documento oficial (CRLV-e / Extrato DETRAN).
            </div>
            <div>
              <strong>2. BLINDAGEM DE MULTAS RETROATIVAS:</strong> O proprietário/vendedor declara, sob as penas do art. 299 do Código Penal, integral responsabilidade financeira por quaisquer multas, autuações (municipais, DETRAN, PRF, DNIT) e débitos fiscais cuja infração tenha ocorrido até a data/hora da entrega deste veículo ({new Date(inspection.created_at).toLocaleDateString('pt-BR')} às {new Date(inspection.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}), mesmo que lançadas posteriormente no sistema pelos órgãos de trânsito, autorizando a cobrança ou ressarcimento imediato.
            </div>
          </div>

          {/* Assinaturas */}
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-6 items-end border-t border-foreground/20 text-[11px]">
            <div className="text-center space-y-1">
              <div className="border-b border-foreground/30 pb-1"></div>
              <div className="font-bold">{inspection.inspector_name}</div>
              <div className="text-[9px] text-muted-foreground uppercase">Avaliador da Concessionária</div>
            </div>

            <div className="text-center space-y-1">
              <div className="border-b border-foreground/30 pb-1"></div>
              <div className="font-bold">{inspection.client_name || 'Cliente / Dono da Moto'}</div>
              <div className="text-[9px] text-muted-foreground uppercase">Assinatura de Concordância</div>
            </div>

            <div className="hidden sm:flex flex-col items-center justify-center p-2 rounded-xl border-2 border-foreground/15 bg-muted/10 text-center space-y-1">
              <QrCode className="w-10 h-10 text-foreground/80" />
              <div className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider">
                Autenticidade #{inspection.id.slice(0, 8).toUpperCase()}
              </div>
              <div className="text-[7.5px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tight">
                ✓ Conforme CRLV-e Gov.br
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
