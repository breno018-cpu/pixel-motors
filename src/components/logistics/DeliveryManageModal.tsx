import React, { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Truck, UserCheck, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { DeliveryRecord, DeliveryStatus, saveCustomDelivery } from '@/lib/logisticsStorage';
import { TRANSPORT_LOGISTICS_METHODS, calculateFreightCost } from '@/lib/transportLogistics';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { useToast } from '@/hooks/use-toast';

interface DeliveryManageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: DeliveryRecord | null;
  onSaved: () => void;
}

export function DeliveryManageModal({
  open,
  onOpenChange,
  delivery,
  onSaved,
}: DeliveryManageModalProps) {
  const { toast } = useToast();

  const [status, setStatus] = useState<DeliveryStatus>('aguardando_despacho');
  const [metodoId, setMetodoId] = useState<string>('cegonha_coletiva');
  const [motoristaNome, setMotoristaNome] = useState('');
  const [motoristaCpf, setMotoristaCpf] = useState('');
  const [motoristaTelefone, setMotoristaTelefone] = useState('');
  const [motoristaPlaca, setMotoristaPlaca] = useState('');
  const [dataPrevisao, setDataPrevisao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [hasGovSignature, setHasGovSignature] = useState(true);

  useEffect(() => {
    if (delivery) {
      setStatus(delivery.status);
      setMetodoId(delivery.metodoTransporteId || 'cegonha_coletiva');
      setMotoristaNome(delivery.motoristaNome || '');
      setMotoristaCpf(delivery.motoristaCpf || '');
      setMotoristaTelefone(delivery.motoristaTelefone || '');
      setMotoristaPlaca(delivery.motoristaPlaca || '');
      setDataPrevisao(delivery.dataPrevisaoEntrega || '');
      setObservacoes(delivery.observacoes || '');
      setHasGovSignature(Boolean(delivery.assinaturaGov || true));
    }
  }, [delivery]);

  if (!delivery) return null;

  const currentFreight = calculateFreightCost(metodoId, delivery.distanciaKm, 1);

  const handleSave = () => {
    saveCustomDelivery(delivery.saleId, {
      status,
      metodoTransporteId: metodoId,
      metodoTransporteNome:
        TRANSPORT_LOGISTICS_METHODS.find((m) => m.id === metodoId)?.nome || 'Transporte',
      motoristaNome,
      motoristaCpf,
      motoristaTelefone,
      motoristaPlaca,
      dataPrevisaoEntrega: dataPrevisao,
      custoFreteEstimado: currentFreight.totalFrete,
      prazoEstimado: currentFreight.prazoEstimado,
      observacoes,
      assinaturaGov: hasGovSignature
        ? {
            assinadoPor: delivery.cliente,
            cpf: '***.***.***-**',
            dataHora: new Date().toLocaleString('pt-BR'),
            hashValidacao:
              delivery.assinaturaGov?.hashValidacao ||
              `BR-GOV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          }
        : undefined,
    });

    toast({
      title: 'Entrega Atualizada!',
      description: `Status e motorista do veículo ${delivery.modelo} foram salvos com sucesso.`,
    });

    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Gestão de Despacho & Motorista
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs font-bold text-primary">
              {delivery.chassi.slice(-8) || delivery.chassi}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            {delivery.modelo} • Destino: {delivery.regiao} ({delivery.distanciaKm} km)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Card Resumo do Veículo */}
          <div className="p-3 rounded-2xl bg-muted/40 border flex items-center justify-between">
            <div>
              <span className="text-muted-foreground block text-[11px]">Cliente Destinatário</span>
              <strong className="text-sm font-bold text-foreground">{delivery.cliente}</strong>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground block text-[11px]">Polo de Origem</span>
              <Badge variant="secondary" className="font-bold text-[11px]">
                {delivery.poloOrigemId === 'store-montesclaros' ? 'Montes Claros' : 'Divinópolis'}
              </Badge>
            </div>
          </div>

          {/* Status da Entrega */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Status do Transporte</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DeliveryStatus)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aguardando_despacho" className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Aguardando Despacho (Pátio / PDI)</span>
                  </div>
                </SelectItem>
                <SelectItem value="em_transporte" className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-500" />
                    <span>Em Transporte / Rota Rodoviária</span>
                  </div>
                </SelectItem>
                <SelectItem value="entregue" className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Entregue ao Cliente (Concluído)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Modalidade de Transporte e Frete */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Método de Transporte</Label>
              <Select value={metodoId} onValueChange={setMetodoId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a modalidade" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_LOGISTICS_METHODS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.nome}
                    </SelectItem>
                  ))}
                  <SelectItem value="retirada_balcao" className="text-xs">
                    Retirada Presencial no Balcão da Loja
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Frete Calculado</Label>
              <div className="h-9 px-3 rounded-lg border bg-muted/20 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{delivery.distanciaKm} km rodoviários</span>
                <strong className="text-primary font-bold">{formatCurrencyBRL(currentFreight.totalFrete)}</strong>
              </div>
            </div>
          </div>

          {/* Dados do Motorista / Transportador */}
          <div className="p-3.5 rounded-2xl border space-y-3 bg-card">
            <div className="flex items-center gap-2 border-b pb-2 font-bold text-xs text-foreground">
              <UserCheck className="w-4 h-4 text-primary" />
              Dados da Pessoa Autorizada / Motorista
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px]">Nome do Motorista / Autorizado</Label>
                <Input
                  value={motoristaNome}
                  onChange={(e) => setMotoristaNome(e.target.value)}
                  placeholder="Ex: Carlos Mendes"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">CPF do Motorista</Label>
                <Input
                  value={motoristaCpf}
                  onChange={(e) => setMotoristaCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Placa do Caminhão / Guincho</Label>
                <Input
                  value={motoristaPlaca}
                  onChange={(e) => setMotoristaPlaca(e.target.value)}
                  placeholder="ABC-1234 / BRA2E19"
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Previsão de Entrega</Label>
                <Input
                  type="date"
                  value={dataPrevisao}
                  onChange={(e) => setDataPrevisao(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Assinatura GOV.BR */}
          <div className="flex items-center justify-between p-3 rounded-2xl border bg-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <div>
                <span className="font-bold text-xs text-foreground block">
                  Termo com Assinatura Digital GOV.BR
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Emite termo de entrega autenticado em conformidade ICP-Brasil
                </span>
              </div>
            </div>
            <Switch checked={hasGovSignature} onCheckedChange={setHasGovSignature} />
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label className="text-[11px]">Instruções de Rota / Observações de Despacho</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Entregar com chave reserva e manual do proprietário. Ligar 1h antes..."
              className="text-xs min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white font-bold gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
