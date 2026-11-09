import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Eye, Pencil, Car, Users, Trash2 } from 'lucide-react';
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
import { useDeleteStore } from '@/hooks/useStoreMutations';
import { StoreDetailsDialog } from '@/components/dialogs/StoreDetailsDialog';
import { StoreEditDialog } from '@/components/dialogs/StoreEditDialog';
import { useVehicles } from '@/hooks/useVehicles';
import { useResellers } from '@/hooks/useResellers';

interface Store {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  manager_id?: string | null;
  created_at: string;
}

interface StoreActionsMenuProps {
  store: Store;
}

export function StoreActionsMenu({ store }: StoreActionsMenuProps) {
  const navigate = useNavigate();
  const { isAdmin, hasElevatedAccess } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const deleteStore = useDeleteStore();
  
  const { data: vehicles } = useVehicles();
  const { data: resellers } = useResellers();
  
  const vehicleCount = vehicles?.filter(v => v.store_id === store.id && v.status !== 'vendido').length || 0;
  const resellerCount = resellers?.filter(r => r.store_id === store.id).length || 0;

  const handleViewVehicles = () => {
    navigate(`/vehicles?store=${store.id}`);
  };

  const handleViewResellers = () => {
    navigate(`/organization?tab=revendedores&store=${store.id}`);
  };

  const handleDelete = () => {
    deleteStore.mutate(store.id, {
      onSuccess: () => setDeleteOpen(false),
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
        <DropdownMenuContent align="end" className="w-52 bg-background border shadow-lg z-50">
          <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
            <Eye className="w-4 h-4 mr-2" />
            Visualizar loja
          </DropdownMenuItem>
          
          {(isAdmin || hasElevatedAccess) && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar dados
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleViewVehicles}>
            <Car className="w-4 h-4 mr-2" />
            Ver veículos da loja
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleViewResellers}>
            <Users className="w-4 h-4 mr-2" />
            Ver revendedores
          </DropdownMenuItem>
          
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir loja
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <StoreDetailsDialog
        store={store as any}
        vehicleCount={vehicleCount}
        resellerCount={resellerCount}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <StoreEditDialog
        store={store as any}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir loja?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A loja "{store.name}" e todos os dados 
              relacionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
