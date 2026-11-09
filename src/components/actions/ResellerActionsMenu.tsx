import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Eye, Pencil, Car, UserX, Package, UserCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useAuth } from '@/contexts/AuthContext';
import { useDeactivateReseller } from '@/hooks/useResellerMutations';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ResellerStockDialog } from '@/components/dialogs/ResellerStockDialog';
import { ResellerDetailsDialog } from '@/components/dialogs/ResellerDetailsDialog';
import { ResellerEditDialog } from '@/components/dialogs/ResellerEditDialog';
import { useStores } from '@/hooks/useStores';
import { useContracts } from '@/hooks/useContracts';

interface Reseller {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  store_id: string | null;
  commission_rate: number | null;
  is_active: boolean;
  created_at: string;
}

interface ResellerActionsMenuProps {
  reseller: Reseller;
}

export function ResellerActionsMenu({ reseller }: ResellerActionsMenuProps) {
  const navigate = useNavigate();
  const { isAdmin, hasElevatedAccess } = useAuth();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const deactivateReseller = useDeactivateReseller();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteResellerMutation = useMutation({
    mutationFn: async (id: string) => {
      // Nullify reseller_id on vehicles
      await supabase.from('vehicles').update({ reseller_id: null }).eq('reseller_id', id);
      // Delete consignment contracts
      await supabase.from('reseller_consignment_contracts').delete().eq('reseller_id', id);
      // Delete the reseller
      const { error } = await supabase.from('resellers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setDeleteOpen(false);
      toast({ title: 'Revendedor excluído permanentemente' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir. Verifique se não há contratos vinculados.' });
    },
  });
  
  const { data: stores } = useStores();
  const { data: contracts } = useContracts();
  
  const storeName = stores?.find(s => s.id === reseller.store_id)?.name;
  const contractCount = contracts?.filter(c => c.reseller_id === reseller.id).length || 0;

  const handleViewContracts = () => {
    navigate(`/contracts?reseller=${reseller.id}`);
  };

  const handleDeactivate = () => {
    deactivateReseller.mutate({ id: reseller.id, is_active: !reseller.is_active }, {
      onSuccess: () => setDeactivateOpen(false),
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-background border shadow-lg z-50">
          <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
            <Eye className="w-4 h-4 mr-2" />
            Visualizar perfil
          </DropdownMenuItem>
          
          {hasElevatedAccess && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar dados
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setStockOpen(true)}>
            <Package className="w-4 h-4 mr-2" />
            Ver Estoque
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleViewContracts}>
            <Car className="w-4 h-4 mr-2" />
            Ver contratos
          </DropdownMenuItem>
          
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeactivateOpen(true)}
                className={reseller.is_active ? "text-destructive focus:text-destructive" : "text-success focus:text-success"}
              >
                {reseller.is_active ? (
                  <UserX className="w-4 h-4 mr-2" />
                ) : (
                  <UserCheck className="w-4 h-4 mr-2" />
                )}
                {reseller.is_active ? 'Desativar conta' : 'Ativar conta'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir permanentemente
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResellerStockDialog
        reseller={reseller}
        open={stockOpen}
        onOpenChange={setStockOpen}
      />
      
      <ResellerDetailsDialog
        reseller={reseller}
        storeName={storeName}
        contractCount={contractCount}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
      
      <ResellerEditDialog
        reseller={reseller}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reseller.is_active ? 'Desativar revendedor?' : 'Ativar revendedor?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reseller.is_active 
                ? `O revendedor "${reseller.full_name}" não poderá mais realizar vendas enquanto estiver desativado.`
                : `O revendedor "${reseller.full_name}" poderá voltar a realizar vendas.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeactivate}
              className={reseller.is_active 
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-success text-success-foreground hover:bg-success/90"
              }
            >
              {reseller.is_active ? 'Desativar' : 'Ativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir revendedor permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-destructive">ATENÇÃO: Esta ação é irreversível!</span><br />
              O revendedor <strong>{reseller.full_name}</strong> será completamente removido do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteResellerMutation.mutate(reseller.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteResellerMutation.isPending}
            >
              {deleteResellerMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
