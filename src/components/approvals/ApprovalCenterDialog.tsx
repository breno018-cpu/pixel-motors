import { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Car, 
  User, 
  Building2, 
  DollarSign, 
  Percent, 
  MessageSquare,
  AlertCircle,
  TrendingUp,
  Inbox
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApprovalRequests, ApprovalRequest } from '@/hooks/useApprovalRequests';
import { useAuth } from '@/contexts/AuthContext';

interface ApprovalCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApprovalCenterDialog({ open, onOpenChange }: ApprovalCenterDialogProps) {
  const { 
    approvals, 
    pendingApprovals, 
    approveRequest, 
    rejectRequest, 
    isApproving, 
    isRejecting 
  } = useApprovalRequests();
  const { isAdmin, isManager } = useAuth();
  const hasManagementAccess = isAdmin || isManager;

  const [activeTab, setActiveTab] = useState<'pendentes' | 'historico'>('pendentes');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const completedApprovals = approvals.filter((a) => a.status !== 'pendente');

  const handleApprove = async (id: string) => {
    await approveRequest({ id });
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert('Por favor, informe o motivo da recusa ou a contraproposta.');
      return;
    }
    await rejectRequest({ id, reason: rejectReason.trim() });
    setRejectingId(null);
    setRejectReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border/80 bg-card/60 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldAlert className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Central de Aprovação de Alçadas
                {pendingApprovals.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {pendingApprovals.length} pendente{pendingApprovals.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Avalie solicitações de desconto, contrapropostas e liberação de margens em tempo real.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="bg-muted/70 h-9">
              <TabsTrigger value="pendentes" className="text-xs gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5" />
                Pendentes ({pendingApprovals.length})
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs gap-1.5 font-medium">
                <Inbox className="w-3.5 h-3.5" />
                Histórico ({completedApprovals.length})
              </TabsTrigger>
            </TabsList>

            {/* ABA: PENDENTES */}
            <TabsContent value="pendentes" className="space-y-4 pt-3">
              {pendingApprovals.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-dashed border-border/80 space-y-2 bg-muted/20">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Nenhuma solicitação pendente
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Todas as propostas comerciais e descontos estão dentro das diretrizes aprovadas.
                  </p>
                </div>
              ) : (
                pendingApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/30 transition-all shadow-xs space-y-3"
                  >
                    {/* Header do Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Car className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-sm text-foreground">
                            {req.vehicle_label}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" /> {req.seller_name}
                            </span>
                            {req.store_name && (
                              <span className="flex items-center gap-1">
                                • <Building2 className="w-3 h-3" /> {req.store_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 self-start sm:self-auto font-medium">
                        Aguardando Decisão
                      </Badge>
                    </div>

                    {/* Comparativo de Preço e Desconto */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-muted/30 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Preço de Tabela:</span>
                        <span className="font-semibold text-foreground line-through decoration-muted-foreground/60">
                          R$ {req.original_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground block">Preço com Desconto:</span>
                        <span className="font-bold text-primary text-sm">
                          R$ {req.requested_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground block">Desconto Solicitado:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          R$ {req.discount_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({req.discount_percent.toFixed(1)}%)
                        </span>
                      </div>

                      {hasManagementAccess && req.projected_profit !== undefined && (
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Lucro / Margem Prevista:</span>
                          <span className={`font-semibold ${
                            (req.projected_profit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'
                          }`}>
                            R$ {(req.projected_profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} ({req.margin_percent?.toFixed(1) || '0'}%)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Justificativa do Vendedor */}
                    <div className="p-2.5 rounded-lg bg-muted/20 border border-border/40 text-xs">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">
                        Justificativa Comercial do Vendedor:
                      </span>
                      <p className="text-foreground italic">
                        "{req.reason}"
                      </p>
                    </div>

                    {/* Caixa de Recusa / Contraproposta */}
                    {rejectingId === req.id && (
                      <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 space-y-2">
                        <span className="text-xs font-semibold text-foreground block">
                          Motivo da Recusa ou Contraproposta:
                        </span>
                        <Input
                          placeholder="Ex: Baixa no máximo R$ 1.000 ou mantém o preço com tanque cheio..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason('');
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={isRejecting}
                            onClick={() => handleReject(req.id)}
                          >
                            Confirmar Recusa
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Botões de Ação para Gestores */}
                    {hasManagementAccess && rejectingId !== req.id && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-500/20"
                          onClick={() => setRejectingId(req.id)}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Recusar / Contraproposta
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          disabled={isApproving}
                          onClick={() => handleApprove(req.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Aprovar Desconto
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* ABA: HISTÓRICO */}
            <TabsContent value="historico" className="space-y-3 pt-3">
              {completedApprovals.length === 0 ? (
                <p className="text-center py-8 text-xs text-muted-foreground">
                  Nenhuma solicitação no histórico.
                </p>
              ) : (
                completedApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-lg border border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {req.vehicle_label}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            req.status === 'aprovado'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-600 border-red-500/20'
                          }`}
                        >
                          {req.status === 'aprovado' ? 'Aprovado' : 'Recusado'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Por {req.seller_name} • Desconto de R$ {req.discount_amount.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} ({req.discount_percent.toFixed(1)}%)
                      </p>
                      {req.review_note && (
                        <p className="text-[11px] text-foreground/80 italic mt-1">
                          Nota do Gerente: "{req.review_note}"
                        </p>
                      )}
                    </div>

                    <div className="text-right text-[10px] text-muted-foreground shrink-0">
                      {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString('pt-BR') : ''}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
