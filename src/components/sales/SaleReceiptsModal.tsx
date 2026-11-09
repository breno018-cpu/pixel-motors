import React, { useState, useEffect } from 'react';
import {
  Paperclip,
  X,
  FileCheck2,
  Bike,
  User,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ReceiptAttachmentManager,
  getSaleReceipts,
  type PaymentReceipt,
} from '@/components/sales/ReceiptAttachmentManager';

interface SaleReceiptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: {
    id: string;
    contract_number?: string;
    buyer_name?: string;
    buyer_cpf?: string;
    sale_price?: number;
    status?: string;
    vehicle?: {
      brand?: string;
      model?: string;
      year?: number;
      plate?: string | null;
      chassis?: string | null;
    };
    external_data?: Record<string, unknown> | null;
  };
  vehicleName?: string;
}

export function SaleReceiptsModal({
  open,
  onOpenChange,
  sale,
  vehicleName,
}: SaleReceiptsModalProps) {
  const [receiptCount, setReceiptCount] = useState(0);

  const displayVehicle =
    vehicleName ||
    (sale.vehicle
      ? `${sale.vehicle.brand || ''} ${sale.vehicle.model || ''} ${sale.vehicle.year || ''}`.trim()
      : (sale.external_data as any)?.vehicle_model_custom || 'Veículo');

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(sale.sale_price) || 0);

  useEffect(() => {
    if (open && sale.id) {
      const current = getSaleReceipts(sale.id);
      setReceiptCount(current.length);
    }
  }, [open, sale.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Paperclip className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Comprovantes da Venda</span>
                  {sale.contract_number && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {sale.contract_number}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Anexe recibos, comprovantes PIX/TED, boletos autenticados e fotos de entrega
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="secondary"
              className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
            >
              {sale.status === 'concluido'
                ? 'Quitada'
                : sale.status === 'pre_venda'
                  ? 'Pré-venda'
                  : 'Pendente'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Resumo do Negócio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/70 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-muted-foreground block">Cliente</span>
              <span className="font-semibold text-foreground truncate block">
                {sale.buyer_name || 'Não informado'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Bike className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-muted-foreground block">Veículo</span>
              <span className="font-semibold text-foreground truncate block">
                {displayVehicle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground block">Valor Total</span>
              <span className="font-bold text-foreground">
                {formattedPrice}
              </span>
            </div>
          </div>
        </div>

        {/* Área Principal de Gerenciamento de Comprovantes */}
        <div className="pt-2">
          <ReceiptAttachmentManager
            saleId={sale.id}
            saleTitle={sale.buyer_name}
            onReceiptsChange={(items) => setReceiptCount(items.length)}
          />
        </div>

        <DialogFooter className="flex sm:justify-between items-center border-t border-border/60 pt-3 mt-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Arquivos vinculados permanentemente para auditoria da concessionária</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
