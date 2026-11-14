import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Eye, Pencil, ArrowRightLeft, Tag, Trash2, UserPlus, Undo2, FileText, FileCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { useStores } from '@/hooks/useStores';
import { useResellers } from '@/hooks/useResellers';
import { useUpdateVehicleStatus, useDeleteVehicle, useTransferVehicle, useReturnToStore } from '@/hooks/useVehicleMutations';
import { VehicleDetailsDialog } from '@/components/dialogs/VehicleDetailsDialog';
import { VehicleEditDialog } from '@/components/dialogs/VehicleEditDialog';
import { CreateConsignmentDialog } from '@/components/consignments/CreateConsignmentDialog';
import { CreateReservationDialog } from '@/components/reservations/CreateReservationDialog';
import { Vehicle } from '@/hooks/useVehicles';

interface VehicleActionsMenuProps {
  vehicle: Vehicle;
}

export function VehicleActionsMenu({ vehicle }: VehicleActionsMenuProps) {
  const navigate = useNavigate();
  const { isAdmin, isManager, canCreateSales } = useAuth();
  const { data: stores } = useStores();
  const { data: resellers } = useResellers();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [consignmentOpen, setConsignmentOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<typeof resellers extends (infer U)[] | undefined ? U : never | null>(null);
  
  const updateStatus = useUpdateVehicleStatus();
  const deleteVehicle = useDeleteVehicle();
  const transferVehicle = useTransferVehicle();
  const returnToStore = useReturnToStore();

  const storeName = stores?.find(s => s.id === vehicle.store_id)?.name;
  const resellerName = resellers?.find(r => r.id === vehicle.reseller_id)?.full_name;
  const otherStores = stores?.filter(s => s.id !== vehicle.store_id && s.is_active);
  const activeResellers = resellers?.filter(r => r.is_active && r.id !== vehicle.reseller_id);

  const handleTransfer = (storeId: string) => {
    transferVehicle.mutate({ id: vehicle.id, store_id: storeId });
  };

  const handleTransferToReseller = (reseller: NonNullable<typeof resellers>[number]) => {
    // Abrir diálogo de consignação ao invés de transferir diretamente
    setSelectedReseller(reseller);
    setConsignmentOpen(true);
  };

  const handleReturnToStore = () => {
    returnToStore.mutate(vehicle.id);
  };

  const handleDelete = () => {
    deleteVehicle.mutate(vehicle.id, {
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
            Visualizar detalhes
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => navigate('/inspections?search=' + encodeURIComponent(vehicle.plate || vehicle.chassis))}>
            <ShieldCheck className="w-4 h-4 mr-2 text-primary" />
            Dossiê & Investigação Veicular
          </DropdownMenuItem>
          
          {isAdmin || isManager ? (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar informações
            </DropdownMenuItem>
          ) : null}
          
          {isAdmin || isManager ? (otherStores && otherStores.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transferir loja
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherStores.map((store) => (
                  <DropdownMenuItem key={store.id} onClick={() => handleTransfer(store.id)}>
                    {store.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )) : null}

          {isAdmin || isManager ? (activeResellers && activeResellers.length > 0 && !vehicle.reseller_id && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserPlus className="w-4 h-4 mr-2" />
                <span className="flex items-center gap-1">
                  Transferir p/ Revendedor
                  <FileText className="w-3 h-3 text-muted-foreground" />
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {activeResellers.map((reseller) => (
                  <DropdownMenuItem key={reseller.id} onClick={() => handleTransferToReseller(reseller)}>
                    {reseller.full_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )) : null}

          {isAdmin || isManager ? (vehicle.reseller_id && (
            <DropdownMenuItem onClick={handleReturnToStore}>
              <Undo2 className="w-4 h-4 mr-2" />
              Devolver ao estoque
            </DropdownMenuItem>
          )) : null}
          
          <DropdownMenuSeparator />
          
          {/* Apenas disponível e reservado são manuais - vendido é automático após venda */}
          {(isAdmin || isManager || canCreateSales) && vehicle.status === 'disponivel' && (
            <DropdownMenuItem onClick={() => setReservationOpen(true)}>
              <Tag className="w-4 h-4 mr-2" />
              Reservar veículo
            </DropdownMenuItem>
          )}
          
          {(isAdmin || isManager) && vehicle.status === 'reservado' && (
            <DropdownMenuItem onClick={() => updateStatus.mutate({ id: vehicle.id, status: 'disponivel' })}>
              <Tag className="w-4 h-4 mr-2" />
              Marcar disponível
            </DropdownMenuItem>
          )}
          
          {(isAdmin || isManager) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir veículo
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <VehicleDetailsDialog
        vehicle={vehicle}
        storeName={storeName}
        resellerName={resellerName}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <VehicleEditDialog
        vehicle={vehicle}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <CreateReservationDialog
        open={reservationOpen}
        onOpenChange={setReservationOpen}
        initialVehicleId={vehicle.id}
      />

      {selectedReseller && (
        <CreateConsignmentDialog
          open={consignmentOpen}
          onOpenChange={(open) => {
            setConsignmentOpen(open);
            if (!open) setSelectedReseller(null);
          }}
          vehicle={{
            id: vehicle.id,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            chassis: vehicle.chassis || '',
            store_id: vehicle.store_id || '',
            sale_price: vehicle.sale_price || 0,
          }}
          reseller={{
            id: selectedReseller.id,
            full_name: selectedReseller.full_name,
            store_id: selectedReseller.store_id || '',
          }}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O veículo {vehicle.brand} {vehicle.model} será 
              removido permanentemente do sistema.
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
