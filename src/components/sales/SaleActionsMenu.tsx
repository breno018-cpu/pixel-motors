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
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
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
import { fetchConsolidatedUsers, DEFAULT_OFFICIAL_USERS } from '@/lib/userService';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getStoreFromDatabase } from '@/lib/storeResolution';
import { downloadOriginalContract } from '@/lib/originalContractExport';
import { downloadContractPDF } from '@/lib/contractPdf';
import { downloadVehicleDeliveryTermPDF } from '@/lib/secondCopyPdfs';
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
  const { isAdmin, isManager, hasElevatedAccess, isSeller, user, profile, can } = useAuth();
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
  const [popupOpen, setPopupOpen] = useState(false);

  const receiptsCount = useMemo(() => {
    const local = getSaleReceipts(sale.id);
    const cloud = ((sale.external_data as any)?.receipts as any[]) || [];
    const validEvidencePaths = (sale.evidence_paths || []).filter(
      (p) => p && (p.startsWith('http') || p.startsWith('data:') || p.startsWith('blob:') || p.startsWith('/'))
    );
    return Math.max(local.length, cloud.length, validEvidencePaths.length);
  }, [sale.id, sale.external_data, sale.evidence_paths]);

  const userFullName = (profile?.full_name || (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || '').toLowerCase().trim();
  const saleSellerName = (
    sale.external_data?.seller_name ||
    sale.external_data?.vendedor ||
    sale.operator?.full_name ||
    (sale as any).vendedor ||
    ''
  ).toLowerCase().trim();

  const isOwnerByName = Boolean(
    userFullName &&
    saleSellerName &&
    (userFullName.includes(saleSellerName) || saleSellerName.includes(userFullName))
  );

  const isPowerUser = isAdmin || isManager || hasElevatedAccess;
  const isOwner = Boolean(
    isPowerUser ||
    (!!user && sale.created_by === user.id) ||
    isOwnerByName
  );

  const isQuestioned = sale.review_status === 'questionada';
  const canFixQuestioned = isQuestioned && (hasElevatedAccess || (isSeller && isOwner));
  const canEditOwn = isPowerUser || (isOwner && can('sales.edit')) || isSeller;
  const canDeleteOwn = isPowerUser || (isOwner && can('sales.delete'));
  const canCancel = sale.status !== 'cancelado' && (isPowerUser || canDeleteOwn);
  const canDelete = isPowerUser || canDeleteOwn;

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
    try {
      await ensureSupabaseSession();
      const users = await fetchConsolidatedUsers();
      if (users && users.length > 0) {
        const list = users
          .filter((u) => u.is_active !== false)
          .map((u) => ({ id: u.id, full_name: u.full_name || u.email }));
        setOperators(list);
      } else {
        const { data } = await supabase.from('profiles').select('id, full_name');
        if (data && data.length > 0) {
          setOperators(data);
        } else {
          setOperators(DEFAULT_OFFICIAL_USERS.map((u) => ({ id: u.id, full_name: u.full_name })));
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar operadores do sistema:', err);
      const { data } = await supabase.from('profiles').select('id, full_name');
      if (data && data.length > 0) {
        setOperators(data);
      } else {
        setOperators(DEFAULT_OFFICIAL_USERS.map((u) => ({ id: u.id, full_name: u.full_name })));
      }
    }
    setSelectedOperator(sale.created_by || '');
    setOperatorDialogOpen(true);
  };

  const changeOperator = useMutation({
    mutationFn: async () => {
      const selectedOp = operators.find((o) => o.id === selectedOperator);
      const opName = selectedOp?.full_name || selectedOperator;

      const { error } = await supabase
        .from('contracts')
        .update({
          created_by: selectedOperator || null,
          external_data: {
            ...((sale.external_data as any) || {}),
            vendedor: opName,
            operator_name: opName,
          },
        } as any)
        .eq('id', sale.id);

      if (error) {
        console.warn('Erro ao atualizar operador no Supabase:', error);
      }
      logActivity('editar', 'venda', sale.id, { operador: opName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['cloud-monthly-sheet'] });
      queryClient.invalidateQueries({ queryKey: ['dealflow-cloud-monthly-sheet'] });
      toast({ title: 'Operador alterado', description: 'O operador da venda foi atualizado com sucesso.' });
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
      const isUuid = (val: any) =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (sale.id && isUuid(sale.id)) {
        const { error } = await supabase
          .from('contracts')
          .update({
            status: 'cancelado',
            ...(wasCompleted ? { signed_at: null } : {}),
          })
          .eq('id', sale.id);
        if (error) console.warn('[cancelSale] Erro ao cancelar contrato no Supabase:', error);
      }

      // Registra cancelamento no storage persistente para nunca ressurgir
      try {
        const cancKey = 'dealflow_cancelled_contract_ids';
        const existing: string[] = JSON.parse(localStorage.getItem(cancKey) || '[]');
        if (sale.id && !existing.includes(sale.id)) existing.push(sale.id);
        if (sale.contract_number && !existing.includes(sale.contract_number)) existing.push(sale.contract_number);
        localStorage.setItem(cancKey, JSON.stringify(existing));
      } catch {}

      // Retorna veículo para disponível
      const targetVehicleId = sale.vehicle_id;
      if (targetVehicleId && isUuid(targetVehicleId)) {
        await supabase
          .from('vehicles')
          .update({ status: 'disponivel' })
          .eq('id', targetVehicleId);
      }
      const ch = sale.vehicle?.chassis || (sale.external_data as any)?.chassi || (sale as any).chassi;
      if (ch && typeof ch === 'string' && ch.trim().length >= 4) {
        await supabase
          .from('vehicles')
          .update({ status: 'disponivel' })
          .ilike('chassis', `%${ch.trim()}%`);
      }

      // Atualiza também na planilha local com match abrangente
      try {
        const stored = localStorage.getItem('dealflow_cloud_monthly_sheet_v9');
        if (stored) {
          const list = JSON.parse(stored);
          const cleanQt = (sale.contract_number || '').replace(/^[A-Z]+-/, '').trim();
          const cleanCh = String(ch || '').trim().toUpperCase();
          const cleanBuyer = (sale.buyer_name || '').trim().toUpperCase();

          const updated = list.map((r: any) => {
            const isMatch =
              r.id === sale.id ||
              r.qt === sale.contract_number ||
              (cleanQt && String(r.qt).padStart(2, '0') === cleanQt.padStart(2, '0')) ||
              (cleanCh && r.chassi && String(r.chassi).toUpperCase() === cleanCh) ||
              (cleanBuyer && r.cliente && String(r.cliente).toUpperCase().includes(cleanBuyer.slice(0, 5)));

            if (isMatch) {
              return { ...r, tipo_registro: 'cancelado', is_permitted: false };
            }
            return r;
          });
          localStorage.setItem('dealflow_cloud_monthly_sheet_v9', JSON.stringify(updated));
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
      window.dispatchEvent(new CustomEvent('dealflow:sheet-updated'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Venda cancelada', description: 'A venda foi cancelada e a moto retornou ao estoque disponível.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao cancelar venda.' });
    },
  });

  const deleteSale = useMutation({
    mutationFn: async () => {
      const isUuid = (val: any) =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (sale.id && isUuid(sale.id)) {
        const { error } = await supabase
          .from('contracts')
          .delete()
          .eq('id', sale.id);
        if (error) {
          console.warn('[deleteSale] Delete direto falhou, aplicando cancelamento com nota:', error);
          await supabase
            .from('contracts')
            .update({ status: 'cancelado', notes: '[REGISTRO EXCLUÍDO]' })
            .eq('id', sale.id);
        }
      }

      // Registra exclusão na lista negra persistente
      try {
        const delKey = 'dealflow_deleted_contract_ids';
        const existing: string[] = JSON.parse(localStorage.getItem(delKey) || '[]');
        if (sale.id && !existing.includes(sale.id)) existing.push(sale.id);
        if (sale.contract_number && !existing.includes(sale.contract_number)) existing.push(sale.contract_number);
        localStorage.setItem(delKey, JSON.stringify(existing));
      } catch {}

      // Retorna veículo para disponível
      const targetVehicleId = sale.vehicle_id;
      if (targetVehicleId && isUuid(targetVehicleId)) {
        await supabase
          .from('vehicles')
          .update({ status: 'disponivel' })
          .eq('id', targetVehicleId);
      }
      const ch = sale.vehicle?.chassis || (sale.external_data as any)?.chassi || (sale as any).chassi;
      if (ch && typeof ch === 'string' && ch.trim().length >= 4) {
        await supabase
          .from('vehicles')
          .update({ status: 'disponivel' })
          .ilike('chassis', `%${ch.trim()}%`);
      }

      // Remove da planilha local
      try {
        const stored = localStorage.getItem('dealflow_cloud_monthly_sheet_v9');
        if (stored) {
          const list = JSON.parse(stored);
          const cleanQt = (sale.contract_number || '').replace(/^[A-Z]+-/, '').trim();
          const cleanCh = String(ch || '').trim().toUpperCase();
          const cleanBuyer = (sale.buyer_name || '').trim().toUpperCase();

          const filtered = list.filter((r: any) => {
            const isMatch =
              r.id === sale.id ||
              r.qt === sale.contract_number ||
              (cleanQt && String(r.qt).padStart(2, '0') === cleanQt.padStart(2, '0')) ||
              (cleanCh && r.chassi && String(r.chassi).toUpperCase() === cleanCh) ||
              (cleanBuyer && r.cliente && String(r.cliente).toUpperCase().includes(cleanBuyer.slice(0, 5)));
            return !isMatch;
          });
          localStorage.setItem('dealflow_cloud_monthly_sheet_v9', JSON.stringify(filtered));
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
      window.dispatchEvent(new CustomEvent('dealflow:sheet-updated'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Venda excluída', description: 'Registro removido com sucesso e veículo liberado no estoque.' });
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
        const v = (sale.vehicle || {}) as any;
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

  const handleDownloadPickupTerm = () => {
    try {
      const v = (sale.vehicle || {}) as any;
      const ext = (sale.external_data || {}) as any;
      const pickup = normalizePickup(ext?.pickup);
      const targetStoreId = sale.store_id || sale.store?.id;
      const resolvedStore = getStoreFromDatabase(targetStoreId || storeName || sale.store?.name);

      downloadVehicleDeliveryTermPDF({
        id: sale.id,
        contractNumber: sale.contract_number || 'CTR-2VIA',
        status: sale.status,
        createdAt: sale.created_at || new Date().toISOString(),
        completedAt: (sale as any).signed_at || sale.created_at,
        salePrice: Number(sale.sale_price) || 0,
        buyerName: sale.buyer_name || 'Comprador',
        buyerCpf: sale.buyer_cpf || '',
        buyerPhone: sale.buyer_phone || ext.buyer_phone || '',
        buyerEmail: sale.buyer_email || '',
        buyerAddress: sale.buyer_address || ext.buyer_address || '',
        vehicleBrand: v.brand || ext.marca || 'SHINERAY',
        vehicleModel: v.model || ext.modelo || vehicleName || 'MOTO',
        vehicleYear: Number(v.year || ext.ano || 2026),
        vehicleColor: v.color || ext.cor || 'Padrão',
        vehicleChassis: v.chassis || ext.chassi || '',
        vehiclePlate: v.plate || ext.placa || 'Sem placa',
        storeName: resolvedStore.storeName,
        storeCnpj: resolvedStore.cnpj,
        storeAddress: resolvedStore.address,
        storeCity: resolvedStore.city,
        storePhone: resolvedStore.phone,
        storeEmail: resolvedStore.email,
        authorizedPersonName: pickup?.name || ext.authorizedPersonName || undefined,
        authorizedPersonCpf: pickup?.cpf || ext.authorizedPersonCpf || undefined,
        authorizedPersonRg: pickup?.rg || ext.authorizedPersonRg || undefined,
        authorizedPersonPhone: pickup?.phone || ext.authorizedPersonPhone || undefined,
        authorizedPersonRelationship: pickup?.relationship || ext.authorizedPersonRelationship || undefined,
      });
      toast({
        title: 'Termo gerado',
        description: 'Termo de Entrada & Retirada a Pessoas Autorizadas (Gov.br) baixado com sucesso.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar termo',
        description: err?.message || 'Não foi possível gerar o termo de retirada.',
      });
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
      {/* Botão Oficial dos 3 Pontos */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setPopupOpen(true)}
        className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Abrir menu de ações da venda"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>

      {/* POP-UP OFICIAL DE AÇÕES DA VENDA (Sempre visível no centro da tela) */}
      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="sm:max-w-lg w-[94vw] p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          {/* Header do Pop-up */}
          <div className="p-4 sm:p-5 border-b border-border bg-muted/40">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-bold text-base sm:text-lg text-foreground">
                    Ações da Venda
                  </h3>
                  <Badge variant="outline" className="font-mono text-xs font-bold border-primary/30 text-primary">
                    {sale.contract_number}
                  </Badge>
                  {sale.status === 'concluido' || sale.status === 'assinado' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold">
                      Quitada
                    </Badge>
                  ) : sale.status === 'pre_venda' ? (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold">
                      Pré-Venda (NF)
                    </Badge>
                  ) : sale.status === 'cancelado' ? (
                    <Badge variant="destructive" className="text-[10px] font-semibold">
                      Cancelada
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      Pendente
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-sm">
                  Cliente: <strong className="text-foreground">{sale.buyer_name}</strong>
                  {vehicleName ? ` • ${vehicleName}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Ações em Seções */}
          <div className="p-4 sm:p-5 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
            {/* Bloco 1: Documentos & Emissão */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Documentos &amp; Emissões
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPopupOpen(false);
                    setManageDefaultTab('documentos');
                    setManageOpen(true);
                  }}
                  className="justify-start h-10 px-3 text-xs gap-2 font-bold text-primary border-primary/30 hover:bg-primary/5"
                >
                  <Printer className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">Emitir 2ª Via</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPopupOpen(false);
                    handleEmitInvoicePng();
                  }}
                  className="justify-start h-10 px-3 text-xs gap-2 font-semibold text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                >
                  <ImageDown className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate">Solicitação NF (PNG)</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPopupOpen(false);
                    setReceiptsModalOpen(true);
                  }}
                  className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                >
                  <Paperclip className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">Comprovantes</span>
                  {receiptsCount > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                      {receiptsCount}
                    </Badge>
                  )}
                </Button>

                {sale.status !== 'pre_venda' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPopupOpen(false);
                      handleExportSale();
                    }}
                    className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span className="truncate">Baixar Contrato (PDF)</span>
                  </Button>
                )}

                {sale.status !== 'pre_venda' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPopupOpen(false);
                      handleDownloadPickupTerm();
                    }}
                    className="justify-start h-10 px-3 text-xs gap-2 font-medium text-blue-600 dark:text-blue-400"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">Termo de Retirada</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Bloco 2: Gestão Comercial */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Gestão da Venda
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPopupOpen(false);
                    setDetailsOpen(true);
                  }}
                  className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                >
                  <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">Visualizar Venda</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPopupOpen(false);
                    setManageDefaultTab('cadastro');
                    setManageOpen(true);
                  }}
                  className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                >
                  <Pencil className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">Editar Venda</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPopupOpen(false);
                    setFreightOpen(true);
                  }}
                  className="justify-start h-10 px-3 text-xs gap-2 font-medium text-emerald-600 dark:text-emerald-400"
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span className="truncate">Calcular Frete</span>
                </Button>

                {sale.status === 'pre_venda' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setPopupOpen(false);
                      setFinalizeModalOpen(true);
                    }}
                    className="justify-start h-10 px-3 text-xs gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">Finalizar Venda &amp; Contrato</span>
                  </Button>
                )}

                {sale.status === 'pendente' && hasElevatedAccess && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setPopupOpen(false);
                      setSignDialogOpen(true);
                    }}
                    className="justify-start h-10 px-3 text-xs gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <FileCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">Aprovar e Concluir</span>
                  </Button>
                )}

                {hasElevatedAccess && sale.status !== 'cancelado' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPopupOpen(false);
                      setQuestionNote(sale.review_note || '');
                      setQuestionOpen(true);
                    }}
                    className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                  >
                    <MessageSquareWarning className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isQuestioned ? 'Editar Revisão' : 'Solicitar Revisão'}</span>
                  </Button>
                )}

                {canFixQuestioned && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPopupOpen(false);
                      setReviewEditOpen(true);
                    }}
                    className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                  >
                    <Wrench className="w-4 h-4 shrink-0" />
                    <span className="truncate">Ajustar Proposta</span>
                  </Button>
                )}

                {isQuestioned && hasElevatedAccess && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPopupOpen(false);
                      clearQuestion.mutate();
                    }}
                    className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                  >
                    <FileCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">Concluir Revisão</span>
                  </Button>
                )}

                {isPowerUser && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPopupOpen(false);
                        loadOperators();
                      }}
                      className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                    >
                      <UserCog className="w-4 h-4 shrink-0" />
                      <span className="truncate">Alterar Operador</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPopupOpen(false);
                        setNewDate(sale.created_at.split('T')[0]);
                        setDateDialogOpen(true);
                      }}
                      className="justify-start h-10 px-3 text-xs gap-2 font-medium"
                    >
                      <CalendarDays className="w-4 h-4 shrink-0" />
                      <span className="truncate">Alterar Data</span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Bloco 3: Cancelamento e Exclusão */}
            {(canCancel || canDelete) && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">
                  Ações Restritas
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {canCancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPopupOpen(false);
                        setCancelDialogOpen(true);
                      }}
                      className="justify-start h-10 px-3 text-xs gap-2 font-semibold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate">{sale.status === 'concluido' ? 'Cancelar venda quitada' : 'Cancelar venda'}</span>
                    </Button>
                  )}

                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPopupOpen(false);
                        setDeleteDialogOpen(true);
                      }}
                      className="justify-start h-10 px-3 text-xs gap-2 font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 text-destructive shrink-0" />
                      <span className="truncate">Excluir venda</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
