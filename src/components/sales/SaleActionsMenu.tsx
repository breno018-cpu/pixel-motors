import { normalizePickup } from '@/lib/pickupAuthorization';
import { useState, useMemo } from 'react';
import { 
  MoreHorizontal, 
  Eye, 
  Download, 
  Trash2,
  XCircle,
  FileCheck,
  UserCog,
  CalendarDays,
  Pencil,
  ImageDown,
  MessageSquareWarning,
  Wrench,
  CheckCircle2,
  Paperclip,
  Printer,
  Truck,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SaleDetailsDialog } from '@/components/sales/SaleDetailsDialog';
import { SaleEditDialog } from '@/components/sales/SaleEditDialog';
import { SaleManageModal } from '@/components/sales/SaleManageModal';
import { CompleteSaleModal } from '@/components/sales/CompleteSaleModal';
import { SaleReceiptsModal } from '@/components/sales/SaleReceiptsModal';
import { FreightCalculatorDialog } from '@/components/logistics/FreightCalculatorDialog';
import { getSaleReceipts } from '@/components/sales/ReceiptAttachmentManager';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/audit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getStoreFromDatabase } from '@/lib/storeResolution';
import { downloadOriginalContract } from '@/lib/originalContractExport';
import { downloadContractPDF } from '@/lib/contractPdf';
import { markVehicleAsSold } from '@/hooks/useVehicles';

interface Sale {
  id: string;
  contract_number: string;
  buyer_name: string;
  buyer_cpf: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_address: string | null;
  sale_price: number;
  down_payment: number | null;
  installments: number | null;
  installment_value: number | null;
  status: string;
  signed_contract_url: string | null;
  vehicle_id: string;
  store_id: string;
  reseller_id: string;
  notes: string | null;
  created_at: string;
  created_by?: string | null;
  review_status?: string | null;
  review_note?: string | null;
  sale_channel?: string | null;
  evidence_paths?: string[];
  external_data?: Record<string, unknown> | null;
  vehicle?: {
    id: string;
    brand: string;
    model: string;
    year: number;
    color: string | null;
    plate: string | null;
    chassis: string | null;
  };
  store?: { id: string; name: string };
  reseller?: { id: string; full_name: string };
}

interface SaleActionsMenuProps {
  sale: Sale;
  vehicleName?: string;
  storeName?: string;
  resellerName?: string;
}

export function SaleActionsMenu({ sale, vehicleName, storeName, resellerName }: SaleActionsMenuProps) {
  const { isAdmin, hasElevatedAccess, isSeller, user, can } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [operators, setOperators] = useState<{ id: string; full_name: string }[]>([]);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionNote, setQuestionNote] = useState('');
  const [reviewEditOpen, setReviewEditOpen] = useState(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [receiptsModalOpen, setReceiptsModalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageDefaultTab, setManageDefaultTab] = useState<'cadastro' | 'veiculo' | 'finalizacao' | 'documentos'>('cadastro');
  const [freightOpen, setFreightOpen] = useState(false);

  const receiptsCount = useMemo(() => {
    const local = getSaleReceipts(sale.id);
    const cloud = ((sale.external_data as any)?.receipts as any[]) || [];
    const evidencePaths = sale.evidence_paths || [];
    return Math.max(local.length, cloud.length, evidencePaths.length);
  }, [sale.id, sale.external_data, sale.evidence_paths]);

  const isQuestioned = sale.review_status === 'questionada';
  const isOwner = !!user && sale.created_by === user.id;
  const canFixQuestioned = isQuestioned && (hasElevatedAccess || (isSeller && isOwner));
  const canEditOwn = !isAdmin && isOwner && can('sales.edit');
  const canDeleteOwn = !isAdmin && isOwner && can('sales.delete');

  const questionSale = useMutation({
    mutationFn: async () => {
      const note = questionNote.trim();
      if (note.length < 3) throw new Error('Descreva a pendência identificada na proposta.');
      const { error } = await supabase
        .from('contracts')
        .update({
          review_status: 'questionada',
          review_note: note,
          review_requested_by: user?.id ?? null,
          review_requested_at: new Date().toISOString(),
          review_resolved_at: null,
          review_resolved_by: null,
        } as any)
        .eq('id', sale.id);
      if (error) throw error;
      logActivity('editar', 'venda', sale.id, { revisao: 'solicitada', observacao: note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Revisão solicitada', description: 'O vendedor responsável já pode ajustar a proposta.' });
      setQuestionOpen(false);
      setQuestionNote('');
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    },
  });

  const clearQuestion = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('contracts')
        .update({
          review_status: 'ok',
          review_resolved_at: new Date().toISOString(),
          review_resolved_by: user?.id ?? null,
        } as any)
        .eq('id', sale.id);
      logActivity('editar', 'venda', sale.id, { revisao: 'concluida' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Questionamento encerrado', description: 'A venda voltou ao estado normal.' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível encerrar.' }),
  });

  const loadOperators = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    if (data) setOperators(data);
    setSelectedOperator(sale.created_by || '');
    setOperatorDialogOpen(true);
  };

  const changeOperator = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('contracts')
        .update({ created_by: selectedOperator || null })
        .eq('id', sale.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Operador alterado', description: 'O operador da venda foi atualizado.' });
      setOperatorDialogOpen(false);
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao alterar operador.' });
    },
  });

  const changeSaleDate = useMutation({
    mutationFn: async () => {
      if (!newDate) throw new Error('Data inválida');
      const { error } = await supabase
        .from('contracts')
        .update({ created_at: new Date(newDate).toISOString() })
        .eq('id', sale.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Data alterada', description: 'A data da venda foi atualizada.' });
      setDateDialogOpen(false);
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao alterar data.' });
    },
  });

  // Mark as signed = auto quitado
  const markAsSigned = useMutation({
    mutationFn: async () => {
      // REGRA: Para sair de Pré-NF para venda concluída, precisa concluir todo o cadastro!
      if (sale.status === 'pre_venda') {
        const ext = (sale.external_data || {}) as any;
        const buyerPhone = sale.buyer_phone || ext.buyer_phone;
        const buyerAddress = sale.buyer_address || ext.buyer_address;
        const chassis = sale.vehicle?.chassis || ext.chassi || ext.vehicle_chassis_custom;
        const unmaskedCpf = (sale.buyer_cpf || '').replace(/\D/g, '');

        if (
          !sale.buyer_name ||
          unmaskedCpf.length < 11 ||
          !buyerPhone ||
          !buyerAddress ||
          !chassis ||
          chassis.includes('DEFINIR') ||
          chassis.includes('INFORMADO')
        ) {
          throw new Error('CADASTRO_INCOMPLETO');
        }
      }

      const { error } = await supabase
        .from('contracts')
        .update({ 
          status: 'concluido', 
          signed_at: new Date().toISOString() 
        })
        .eq('id', sale.id);
      if (error) throw error;

      // Also update vehicle status to vendido in all storages
      const targetVehicleId = sale.vehicle_id || (sale.vehicle?.chassis as string) || (sale.external_data as any)?.chassi;
      if (targetVehicleId) {
        await markVehicleAsSold(targetVehicleId, 'vendido');
      }
      if (sale.vehicle_id) {
        const { error: vehicleError } = await supabase
          .from('vehicles')
          .update({ status: 'vendido' })
          .eq('id', sale.vehicle_id);
        if (vehicleError) console.error('Error updating vehicle:', vehicleError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Venda aprovada', description: 'Venda quitada e veículo marcado como vendido.' });
    },
    onError: (err: any) => {
      if (err?.message === 'CADASTRO_INCOMPLETO') {
        toast({
          variant: 'destructive',
          title: 'Cadastro Incompleto',
          description: 'Para sair de Pré-NF para venda concluída, é obrigatório concluir todo o cadastro. Abrindo formulário completo...',
        });
        setFinalizeModalOpen(true);
        return;
      }
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao atualizar status.' });
    },
  });

  const cancelSale = useMutation({
    mutationFn: async () => {
      const wasCompleted = sale.status === 'concluido';
      const { error } = await supabase
        .from('contracts')
        .update({
          status: 'cancelado',
          ...(wasCompleted ? { signed_at: null } : {}),
        })
        .eq('id', sale.id);
      if (error) throw error;

      // Return vehicle to disponível
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'disponivel' })
        .eq('id', sale.vehicle_id);
      if (vehicleError) console.error('Error updating vehicle:', vehicleError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({ title: 'Venda cancelada', description: 'A venda foi cancelada.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao cancelar venda.' });
    },
  });

  const deleteSale = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', sale.id);
      if (error) throw error;

      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'disponivel' })
        .eq('id', sale.vehicle_id);

      if (vehicleError) throw vehicleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Venda excluída', description: 'Registro removido com sucesso.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao excluir venda.' });
    },
  });

  const handleExportSale = async () => {
    try {
      await downloadOriginalContract(sale);
      toast({ title: 'Contrato gerado', description: 'O PDF do contrato original foi baixado com sucesso.' });
    } catch (err: any) {
      console.warn('Erro ao emitir contrato original, tentando fallback:', err);
      try {
        const v = sale.vehicle || {};
        const ext = (sale.external_data || {}) as any;
        downloadContractPDF({
          contractNumber: sale.contract_number || `CTR-${Date.now().toString().slice(-6)}`,
          contractType: (sale as any).contract_type === 'repasse' ? 'repasse' : 'venda',
          createdAt: sale.created_at || new Date().toISOString(),
          storeName: storeName || sale.store?.name || 'CONCESSIONÁRIA',
          buyerName: sale.buyer_name || 'Comprador',
          buyerCpf: sale.buyer_cpf || '',
          buyerPhone: sale.buyer_phone || ext.buyer_phone,
          buyerAddress: sale.buyer_address || ext.buyer_address,
          vehicleBrand: v.brand || ext.marca || 'SHINERAY',
          vehicleModel: v.model || ext.modelo || vehicleName || 'MOTO',
          vehicleYear: Number(v.year || ext.ano || 2026),
          vehicleColor: v.color || ext.cor,
          vehicleChassis: v.chassis || ext.chassi,
          vehiclePlate: v.plate || ext.placa,
          salePrice: Number(sale.sale_price) || 0,
          downPayment: sale.down_payment ? Number(sale.down_payment) : undefined,
          installments: sale.installments || 1,
          installmentValue: sale.installment_value ? Number(sale.installment_value) : undefined,
          resellerName: resellerName || sale.reseller?.full_name,
        });
        toast({ title: 'Contrato gerado', description: 'O PDF do contrato foi baixado com sucesso.' });
      } catch (fallbackErr: any) {
        toast({
          variant: 'destructive',
          title: 'Erro ao gerar contrato',
          description: fallbackErr?.message || err?.message || 'Não foi possível gerar o PDF do contrato.',
        });
      }
    }
  };

  const handleEmitInvoicePng = async () => {
    try {
      const { downloadInvoiceRequestPng } = await import('@/lib/invoiceRequestPng');
      const v = sale.vehicle;
      const modelo = v ? `${v.brand} ${v.model} ${v.year}${v.color ? ' ' + v.color : ''}`.trim() : '';
      // A alienação precisa nomear o banco que fica com o veículo alienado.
      const bank = ((sale as any).financing_bank || '').trim();
      const financed = (sale as any).payment_method === 'financiamento'
        || !!bank
        || !!((sale as any).financing_installments && (sale as any).financing_installments > 0);
      const alienacao = financed
        ? await (await import('@/hooks/useFinancingBanks')).fetchAlienationText(bank)
        : 'AVISTA';
      const rawAddress = sale.buyer_address || '';
      const cepMatch = rawAddress.match(/\b(\d{5})-?(\d{3})\b/);
      const cep = cepMatch ? `${cepMatch[1]}-${cepMatch[2]}` : '';
      const endereco = (cepMatch
        ? rawAddress.replace(cepMatch[0], '')
        : rawAddress)
        .replace(/\s*,\s*,/g, ',')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[,\s-]+|[,\s-]+$/g, '')
        .trim() || 'Não informado';
      await downloadInvoiceRequestPng(
        {
          nomeCompleto: sale.buyer_name || '',
          cpf: sale.buyer_cpf || '',
          cep,
          endereco,
          chassi: v?.chassis || '',
          modeloMoto: modelo,
          valorNF: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(sale.sale_price) || 0),
          alienacao,
        },
        `solicitacao-nf-${sale.contract_number}.png`,
      );
      toast({ title: 'PNG gerado', description: 'Solicitação de emissão baixada.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Falha ao gerar PNG', description: e?.message });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => {
              setManageDefaultTab('documentos');
              setManageOpen(true);
            }}
            className="text-primary font-bold focus:text-primary"
          >
            <Printer className="w-4 h-4 mr-2 text-primary" />
            Emitir 2ª Via Oficial
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              setManageDefaultTab('cadastro');
              setManageOpen(true);
            }}
            className="font-medium"
          >
            <Pencil className="w-4 h-4 mr-2 text-primary" />
            Alterar Dados / Gestão
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
            <Eye className="w-4 h-4 mr-2" />
            Visualizar venda
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setReceiptsModalOpen(true)}>
            <Paperclip className="w-4 h-4 mr-2 text-primary" />
            <span>Comprovantes da venda</span>
            {receiptsCount > 0 && (
              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                {receiptsCount}
              </Badge>
            )}
          </DropdownMenuItem>

          {sale.status !== 'pre_venda' && (
            <DropdownMenuItem onClick={handleExportSale}>
              <Download className="w-4 h-4 mr-2" />
              Baixar contrato
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleEmitInvoicePng}>
            <ImageDown className="w-4 h-4 mr-2 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              {sale.status === 'pre_venda' ? 'Emitir Papel de NF (PNG)' : 'Solicitar NF (PNG)'}
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setFreightOpen(true)} className="text-emerald-600 dark:text-emerald-400 font-medium">
            <Truck className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
            Simular Frete & Logística
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {hasElevatedAccess && sale.status !== 'cancelado' && (
            <DropdownMenuItem onClick={() => { setQuestionNote(sale.review_note || ''); setQuestionOpen(true); }}>
              <MessageSquareWarning className="w-4 h-4 mr-2" />
              {isQuestioned ? 'Editar solicitação de revisão' : 'Solicitar revisão'}
            </DropdownMenuItem>
          )}

          {canFixQuestioned && (
            <DropdownMenuItem onClick={() => setReviewEditOpen(true)}>
              <Wrench className="w-4 h-4 mr-2" />
              Ajustar proposta
            </DropdownMenuItem>
          )}

          {isQuestioned && hasElevatedAccess && (
            <DropdownMenuItem onClick={() => clearQuestion.mutate()}>
              <FileCheck className="w-4 h-4 mr-2" />
              Concluir revisão
            </DropdownMenuItem>
          )}

          {sale.status === 'pre_venda' && (
            <DropdownMenuItem
              onClick={() => setFinalizeModalOpen(true)}
              className="text-emerald-600 dark:text-emerald-400 font-semibold focus:text-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
              Finalizar Venda (Concluir Cadastro & Emitir Contrato)
            </DropdownMenuItem>
          )}

          {sale.status === 'pendente' && hasElevatedAccess && (
            <DropdownMenuItem onClick={() => setSignDialogOpen(true)}>
              <FileCheck className="w-4 h-4 mr-2" />
              Aprovar e concluir venda
            </DropdownMenuItem>
          )}


          {sale.status !== 'cancelado' && sale.status !== 'concluido' && (hasElevatedAccess || canDeleteOwn) && (
            <DropdownMenuItem 
              onClick={() => setCancelDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar venda
            </DropdownMenuItem>
          )}

          {sale.status === 'concluido' && isAdmin && (
            <DropdownMenuItem
              onClick={() => setCancelDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar venda quitada
            </DropdownMenuItem>
          )}

          {(isAdmin || canEditOwn || canDeleteOwn) && <DropdownMenuSeparator />}
          {(isAdmin || canEditOwn) && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar venda
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <>
              <DropdownMenuItem onClick={loadOperators}>
                <UserCog className="w-4 h-4 mr-2" />
                Alterar operador
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNewDate(sale.created_at.split('T')[0]);
                setDateDialogOpen(true);
              }}>
                <CalendarDays className="w-4 h-4 mr-2" />
                Alterar data da venda
              </DropdownMenuItem>
            </>
          )}
          {(isAdmin || canDeleteOwn) && (
            <DropdownMenuItem 
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir venda
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SaleDetailsDialog
        sale={sale}
        vehicleName={vehicleName}
        storeName={storeName}
        resellerName={resellerName}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <SaleEditDialog
        sale={sale}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <SaleEditDialog
        sale={sale}
        open={reviewEditOpen}
        onOpenChange={setReviewEditOpen}
        reviewMode
      />

      {/* Solicitar revisão */}
      <AlertDialog open={questionOpen} onOpenChange={setQuestionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar revisão da venda</AlertDialogTitle>
            <AlertDialogDescription>
              Descreva o que está incorreto ou faltando. O vendedor responsável poderá corrigir a proposta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              value={questionNote}
              onChange={(e) => setQuestionNote(e.target.value)}
              rows={4}
              placeholder="Ex.: falta comprovante da entrada em PIX e o banco do financiamento está errado."
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); questionSale.mutate(); }}>
              Enviar solicitação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sign = Quitado Confirmation */}
      <AlertDialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar venda</AlertDialogTitle>
            <AlertDialogDescription>
              Ao aprovar, a venda será automaticamente definida como <strong>quitada</strong> e o veículo como <strong>vendido</strong>. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { markAsSigned.mutate(); setSignDialogOpen(false); }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sale.status === 'concluido' ? 'Cancelar venda quitada' : 'Cancelar venda'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sale.status === 'concluido'
                ? 'Esta venda está quitada. Ao cancelar, o status da venda voltará a ser cancelado e o veículo retornará ao estoque como disponível. Esta ação é restrita a administradores.'
                : 'O veículo será retornado ao estoque como disponível. Deseja continuar?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { cancelSale.mutate(); setCancelDialogOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                deleteSale.mutate();
                setDeleteDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Change Operator Dialog */}
      <AlertDialog open={operatorDialogOpen} onOpenChange={setOperatorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar Operador da Venda</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o operador responsável por esta venda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o operador" />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>{op.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => changeOperator.mutate()}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Date Dialog */}
      <AlertDialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar Data da Venda</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione a nova data para esta venda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => changeSaleDate.mutate()}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompleteSaleModal
        open={finalizeModalOpen}
        onOpenChange={setFinalizeModalOpen}
        initialPreSale={sale}
        initialPreSaleId={sale.id}
      />

      <SaleReceiptsModal
        open={receiptsModalOpen}
        onOpenChange={setReceiptsModalOpen}
        sale={sale}
        vehicleName={vehicleName}
      />

      <SaleManageModal
        sale={sale}
        open={manageOpen}
        onOpenChange={setManageOpen}
        defaultTab={manageDefaultTab}
      />

      <FreightCalculatorDialog
        open={freightOpen}
        onOpenChange={setFreightOpen}
        customerName={sale.buyer_name}
        vehicleModel={vehicleName}
        initialDestinationCity={sale.buyer_address || ''}
      />
    </>
  );
}
