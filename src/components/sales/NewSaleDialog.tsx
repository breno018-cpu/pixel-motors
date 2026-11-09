import { CreateSaleModal } from './CreateSaleModal';

interface NewSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVehicleId?: string | null;
  initialPreSaleId?: string | null;
  channel?: 'interna' | 'externa';
}

export function NewSaleDialog({
  open,
  onOpenChange,
  initialVehicleId,
  initialPreSaleId,
  channel = 'interna',
}: NewSaleDialogProps) {
  return (
    <CreateSaleModal
      open={open}
      onOpenChange={onOpenChange}
      initialVehicleId={initialVehicleId}
      initialPreSaleId={initialPreSaleId}
      channel={channel}
    />
  );
}
