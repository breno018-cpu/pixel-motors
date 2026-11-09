import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import {
  Reservation,
  useConvertReservationToSale,
} from '@/hooks/useReservations';
import { useActiveTemplates } from '@/hooks/useContractTemplates';
import { maskCurrency, parseCurrency } from '@/lib/masks';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reservation: Reservation | null;
}

export function ConvertReservationDialog({ open, onOpenChange, reservation }: Props) {
  const { data: templates } = useActiveTemplates();
  const convert = useConvertReservationToSale();
  const [templateId, setTemplateId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [installments, setInstallments] = useState('1');
  const [installmentValue, setInstallmentValue] = useState('');

  const saleTemplates = (templates || []).filter(
    (t) => t.template_type !== 'reserva',
  );

  useEffect(() => {
    if (reservation && open) {
      setSalePrice(maskCurrency(Number(reservation.vehicle_price)));
      setTemplateId('');
      setInstallments('1');
      setInstallmentValue('');
    }
  }, [reservation, open]);

  if (!reservation) return null;

  const remaining =
    parseCurrency(salePrice) - Number(reservation.reservation_amount);

  const handleSubmit = async () => {
    if (!templateId) return;
    await convert.mutateAsync({
      reservation,
      template_id: templateId,
      sale_price: parseCurrency(salePrice),
      installments: Number(installments) || 1,
      installment_value: installmentValue
        ? parseCurrency(installmentValue)
        : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            Converter reserva em venda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-muted/40">
            <CardContent className="p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Cliente:</span>{' '}
                <strong>{reservation.buyer_name}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Veículo:</span>{' '}
                {reservation.vehicle?.brand} {reservation.vehicle?.model}{' '}
                {reservation.vehicle?.year}
              </p>
              <p>
                <span className="text-muted-foreground">Sinal pago:</span>{' '}
                <strong className="text-primary">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(Number(reservation.reservation_amount))}
                </strong>{' '}
                <span className="text-xs text-muted-foreground">
                  (será aplicado como entrada)
                </span>
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>Modelo de contrato de venda *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecionar modelo" />
              </SelectTrigger>
              <SelectContent>
                {saleTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor total da venda *</Label>
            <Input
              value={salePrice}
              onChange={(e) => setSalePrice(maskCurrency(e.target.value))}
              className="h-10"
            />
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                Restante a pagar:{' '}
                <strong>
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(remaining)}
                </strong>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Input
                type="number"
                min={1}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor da parcela</Label>
              <Input
                value={installmentValue}
                onChange={(e) =>
                  setInstallmentValue(maskCurrency(e.target.value))
                }
                placeholder="R$ 0,00"
                className="h-10"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!templateId || !salePrice || convert.isPending}
          >
            {convert.isPending ? 'Convertendo...' : 'Converter em venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}