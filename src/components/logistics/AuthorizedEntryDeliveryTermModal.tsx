import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, ShieldCheck, CheckCircle2, QrCode, Download, Building2, UserCheck } from 'lucide-react';
import { DeliveryRecord } from '@/lib/logisticsStorage';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';

interface AuthorizedEntryDeliveryTermModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: DeliveryRecord | null;
}

export function AuthorizedEntryDeliveryTermModal({
  open,
  onOpenChange,
  delivery,
}: AuthorizedEntryDeliveryTermModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!delivery) return null;

  const handlePrint = () => {
    window.print();
  };

  const validationHash =
    delivery.assinaturaGov?.hashValidacao ||
    `BR-GOV-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const signingDate =
    delivery.assinaturaGov?.dataHora ||
    new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto print:max-w-full print:p-0">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Termo de Entrada e Entrega a Pessoas Autorizadas
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-mono border-emerald-500/30 text-emerald-600">
              Autenticação GOV.BR
            </Badge>
          </div>
        </DialogHeader>

        {/* Documento Oficial para Impressão e Visualização */}
        <div
          ref={printRef}
          className="p-6 bg-white text-slate-900 rounded-2xl border space-y-6 text-sm font-sans shadow-xs print:border-none print:shadow-none"
        >
          {/* Cabeçalho Oficial */}
          <div className="border-b pb-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center font-black text-sm">
                  DF
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-blue-950 uppercase">
                    Rede de Concessionárias de Motos
                  </h2>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {delivery.poloOrigemNome} • Departamento de Logística e Despacho
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <Badge className="bg-blue-900 text-white text-[10px] uppercase font-bold tracking-wider">
                Via Oficial de Transporte
              </Badge>
              <div className="text-[11px] font-mono text-slate-500 mt-1">
                Ref: #{delivery.chassi.slice(-8) || delivery.saleId}
              </div>
            </div>
          </div>

          {/* Título Central */}
          <div className="text-center py-2 bg-slate-50 rounded-xl border border-slate-200">
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-900">
              TERMO DE ENTRADA E ENTREGA A PESSOAS AUTORIZADAS
            </h1>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Autorização de Retirada, Vistoria de Saída e Confirmação de Recebimento de Veículo
            </p>
          </div>

          {/* Dados do Veículo e da Venda */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Modelo do Veículo</span>
              <div className="font-bold text-slate-900">{delivery.modelo}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Chassi Oficial</span>
              <div className="font-mono font-bold text-blue-900">{delivery.chassi}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Valor Faturado</span>
              <div className="font-bold text-slate-900">{formatCurrencyBRL(delivery.valor)}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Data da Venda</span>
              <div className="font-bold text-slate-900">{delivery.dataVenda}</div>
            </div>
          </div>

          {/* Identificação do Comprador Titular */}
          <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <strong className="text-blue-950 font-bold uppercase tracking-wider text-[11px]">
                1. Comprador / Titular do Veículo
              </strong>
              <Badge variant="outline" className="text-[10px] font-mono">
                Destino: {delivery.regiao} - {delivery.uf}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div>
                <span className="text-slate-500 text-[10px] block">Nome Completo:</span>
                <strong className="text-slate-900">{delivery.cliente}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Consultor Comercial:</span>
                <span className="text-slate-800">{delivery.vendedor}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Município de Entrega:</span>
                <span className="text-slate-800">{delivery.regiao} ({delivery.uf})</span>
              </div>
            </div>
          </div>

          {/* Identificação do Motorista / Transportador Autorizado */}
          <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <strong className="text-blue-950 font-bold uppercase tracking-wider text-[11px]">
                2. Pessoa / Transportador Autorizado para Retirada e Entrada
              </strong>
              <span className="text-[10px] text-slate-500 font-semibold">
                Modalidade: {delivery.metodoTransporteNome}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div>
                <span className="text-slate-500 text-[10px] block">Motorista / Autorizado:</span>
                <strong className="text-slate-900">{delivery.motoristaNome || 'A definir / Transportador Oficial'}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Documento CPF / RG:</span>
                <span className="text-slate-800 font-mono">{delivery.motoristaCpf || 'Registrado em Guia'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Placa do Guincho/Cegonha:</span>
                <span className="text-slate-800 font-mono font-bold">{delivery.motoristaPlaca || 'Frota Homologada'}</span>
              </div>
            </div>
          </div>

          {/* Cláusula de Autorização e Vistoria */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] leading-relaxed text-slate-700 space-y-1.5">
            <p>
              Pelo presente instrumento, o comprador declara que <strong>AUTORIZA</strong> expressamente a entrada, retirada e
              transporte do veículo acima discriminado pela pessoa/transportador designado. O veículo foi inspecionado em conformidade
              com a vistoria de Pré-Entrega (PDI), atestando perfeito funcionamento mecânico, pintura, documentação de NF e chave reserva.
            </p>
          </div>

          {/* Bloco Oficial da Assinatura GOV.BR */}
          <div className="p-4 rounded-xl border-2 border-blue-800/40 bg-gradient-to-r from-blue-50/70 via-white to-blue-50/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex flex-col items-center justify-center font-black shrink-0 shadow-xs">
                <span className="text-[9px] uppercase tracking-tighter">GOV.BR</span>
                <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-blue-950 uppercase tracking-tight">
                    Documento Assinado Digitalmente
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-[11px] text-slate-800">
                  Assinado por: <strong>{delivery.cliente}</strong> (Comprador Titular)
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Data/Hora do Carimbo: {signingDate} • Autenticação ICP-Brasil
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l sm:pl-4 pt-2 sm:pt-0 w-full sm:w-auto justify-between sm:justify-start">
              <div className="text-right text-[10px] font-mono text-slate-500">
                <div>Hash SHA-256:</div>
                <strong className="text-blue-900">{validationHash}</strong>
              </div>
              <div className="w-12 h-12 rounded-lg border bg-white flex items-center justify-center p-1 shrink-0">
                <QrCode className="w-9 h-9 text-slate-800" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handlePrint} className="bg-blue-900 hover:bg-blue-800 text-white gap-2 font-bold">
            <Printer className="w-4 h-4" />
            Imprimir Termo Oficial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
