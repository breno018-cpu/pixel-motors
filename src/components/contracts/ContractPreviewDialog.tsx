import { useState, useEffect } from 'react';
import { FileText, Download, Printer, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { generateContractPDF, downloadContractPDF } from '@/lib/contractPdf';

interface ContractData {
  contractNumber: string;
  contractType: 'venda' | 'repasse';
  createdAt: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  buyerName: string;
  buyerCpf: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerAddress?: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor?: string;
  vehicleChassis?: string;
  vehiclePlate?: string;
  vehicleRenavam?: string;
  salePrice: number;
  downPayment?: number;
  installments?: number;
  installmentValue?: number;
  paymentMethod?: string;
  resellerName?: string;
  notes?: string;
}

interface ContractPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ContractData | null;
  onConfirm?: () => void;
  confirmLabel?: string;
}

export function ContractPreviewDialog({ 
  open, 
  onOpenChange, 
  data,
  onConfirm,
  confirmLabel = 'Confirmar'
}: ContractPreviewDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');

  useEffect(() => {
    if (open && data) {
      const doc = generateContractPDF(data);
      const url = doc.output('dataurlstring');
      setPdfUrl(url);
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, data]);

  const handleDownload = () => {
    if (data) {
      downloadContractPDF(data);
    }
  };

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <FileText className="w-5 h-5 text-primary" />
            Pré-visualização do Contrato
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-muted/20">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full min-h-[500px]"
              title="Contrato PDF"
            />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[500px]">
              <p className="text-muted-foreground">Gerando PDF...</p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-4 border-t flex-shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Baixar PDF
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>
            {onConfirm && (
              <Button onClick={onConfirm}>
                {confirmLabel}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
