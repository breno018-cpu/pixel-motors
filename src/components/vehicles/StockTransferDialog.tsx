import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVehicles } from '@/hooks/useVehicles';
import { useStores } from '@/hooks/useStores';
import { useResellers } from '@/hooks/useResellers';
import {
  useCreateStockTransfer,
  TRANSFER_TYPE_LABEL,
  type TransferType,
  type TransferStatus,
} from '@/hooks/useStockTransfers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVehicleId?: string;
}

export function StockTransferDialog({ open, onOpenChange, defaultVehicleId }: Props) {
  const { data: vehicles } = useVehicles();
  const { data: stores } = useStores();
  const { data: resellers } = useResellers();
  const createTransfer = useCreateStockTransfer();

  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState<TransferType>('loja_para_revendedor');
  const [toStore, setToStore] = useState('');
  const [toReseller, setToReseller] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [agreed, setAgreed] = useState('');
  const [received, setReceived] = useState('');
  const [status, setStatus] = useState<TransferStatus>('concluida');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setVehicleId(defaultVehicleId || '');
      setType('loja_para_revendedor');
      setToStore('');
      setToReseller('');
      setPartnerName('');
      setAgreed('');
      setReceived('');
      setStatus('concluida');
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [open, defaultVehicleId]);

  const available = useMemo(
    () => (vehicles || []).filter((v) => v.status === 'disponivel' || v.status === 'reservado'),
    [vehicles],
  );
  const vehicle = available.find((v) => v.id === vehicleId);

  const needsStore = type === 'loja_para_loja';
  const needsReseller = type === 'loja_para_revendedor';
  const needsPartner = type === 'parceiro_externo';

  const valid =
    !!vehicleId &&
    (!needsStore || !!toStore) &&
    (!needsReseller || !!toReseller) &&
    (!needsPartner || partnerName.trim().length > 1);

  const handleSubmit = () => {
    if (!valid || !vehicle) return;
    createTransfer.mutate(
      {
        vehicle_id: vehicleId,
        transfer_type: type,
        from_store_id: vehicle.store_id,
        from_reseller_id: vehicle.reseller_id,
        to_store_id: needsStore ? toStore : type === 'revendedor_para_loja' ? toStore || vehicle.store_id : null,
        to_reseller_id: needsReseller ? toReseller : null,
        partner_name: needsPartner ? partnerName.trim() : null,
        agreed_amount: Number(agreed) || 0,
        received_amount: Number(received) || 0,
        status,
        transfer_date: date,
        notes: notes.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transferência de estoque</DialogTitle>
          <DialogDescription>
            Registre o envio de um veículo para outra loja, revendedor ou parceiro externo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Veículo *</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 max-h-72">
                {available.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.brand} {v.model} {v.year} {v.color ? `— ${v.color}` : ''}{' '}
                    {v.chassis ? `— ${v.chassis.slice(-6)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de transferência *</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransferType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {(Object.keys(TRANSFER_TYPE_LABEL) as TransferType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSFER_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(needsStore || type === 'revendedor_para_loja') && (
            <div className="space-y-2">
              <Label>Loja de destino {needsStore && '*'}</Label>
              <Select value={toStore} onValueChange={setToStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {stores?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsReseller && (
            <div className="space-y-2">
              <Label>Revendedor de destino *</Label>
              <Select value={toReseller} onValueChange={setToReseller}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o revendedor" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {resellers?.filter((r) => r.is_active).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsPartner && (
            <div className="space-y-2">
              <Label>Loja parceira / comprador *</Label>
              <Input
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Nome da loja parceira"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor acordado (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={agreed}
                onChange={(e) => setAgreed(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor recebido (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TransferStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <p className="text-xs text-muted-foreground">
            Ao marcar como <strong>Concluída</strong>, o veículo é movido automaticamente para o
            destino. Em venda a parceiro externo, ele sai do estoque como "Transferido".
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || createTransfer.isPending}>
            {createTransfer.isPending ? 'Salvando...' : 'Registrar transferência'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}