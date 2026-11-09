import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShieldAlert, 
  Lock, 
  Percent, 
  DollarSign, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMarginPolicy, MarginPolicy } from '@/hooks/useMarginPolicy';
import { maskCurrency, parseCurrency } from '@/lib/masks';

export function MarginSettingsCard() {
  const { policy, savePolicy, isSaving } = useMarginPolicy();
  const [form, setForm] = useState<MarginPolicy>(policy);

  useEffect(() => {
    setForm(policy);
  }, [policy]);

  const handleSave = async () => {
    await savePolicy(form);
  };

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Diretrizes de Rentabilidade & Proteção de Margem
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                  Ativo no Caixa
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Defina o piso de rentabilidade comercial, limite de desconto para a equipe de vendas e travas contra prejuízo.
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Salvando...' : 'Salvar Diretrizes'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
        {/* Régua Visual de Margem */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Régua de Rentabilidade Comercial</span>
            <span className="text-[11px] text-muted-foreground font-normal">Baseada na margem bruta sobre a venda</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Margem Crítica / Risco
              </span>
              <span className="text-xs font-semibold text-foreground">
                Abaixo de {form.minMarginPercent}%
              </span>
              <p className="text-[10px] text-muted-foreground">
                Bloqueado para vendedores ou exige aprovação da gerência.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                Margem Atenção
              </span>
              <span className="text-xs font-semibold text-foreground">
                De {form.minMarginPercent}% a {form.targetMarginPercent}%
              </span>
              <p className="text-[10px] text-muted-foreground">
                Margem aceitável para giro rápido de estoque ou contra-proposta.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Margem Saudável
              </span>
              <span className="text-xs font-semibold text-foreground">
                Acima de {form.targetMarginPercent}%
              </span>
              <p className="text-[10px] text-muted-foreground">
                Rentabilidade ótima com liberação instantânea e comissão integral.
              </p>
            </div>
          </div>
        </div>

        {/* Inputs de Configuração */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Percent className="w-3 h-3 text-muted-foreground" />
              Margem Mínima de Segurança (%)
            </Label>
            <Input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={form.minMarginPercent}
              onChange={(e) => setForm({ ...form, minMarginPercent: parseFloat(e.target.value) || 0 })}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Piso aceitável de margem bruta sobre o valor do veículo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Percent className="w-3 h-3 text-muted-foreground" />
              Margem Alvo Desejada (%)
            </Label>
            <Input
              type="number"
              min="1"
              max="100"
              step="0.5"
              value={form.targetMarginPercent}
              onChange={(e) => setForm({ ...form, targetMarginPercent: parseFloat(e.target.value) || 0 })}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Meta padrão de rentabilidade para a equipe comercial.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Percent className="w-3 h-3 text-muted-foreground" />
              Teto de Desconto (%)
            </Label>
            <Input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={form.maxDiscountPercent}
              onChange={(e) => setForm({ ...form, maxDiscountPercent: parseFloat(e.target.value) || 0 })}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Desconto percentual máximo que o vendedor pode conceder.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-muted-foreground" />
              Teto de Desconto (R$)
            </Label>
            <Input
              value={maskCurrency(String(Math.round(form.maxDiscountAmount * 100)))}
              onChange={(e) => setForm({ ...form, maxDiscountAmount: parseCurrency(e.target.value) })}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Valor nominal máximo de desconto sem aval da gerência.
            </p>
          </div>
        </div>

        {/* Políticas de Bloqueio e Governança */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card/40">
            <div className="space-y-0.5 pr-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                Bloqueio Estrito Abaixo do Custo
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Impede que qualquer vendedor conclua uma venda com preço inferior ao custo de compra do veículo cadastrado.
              </p>
            </div>
            <Switch
              checked={form.blockBelowCost}
              onCheckedChange={(checked) => setForm({ ...form, blockBelowCost: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card/40">
            <div className="space-y-0.5 pr-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Exigir Liberação Gerencial de Desconto
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Se o vendedor aplicar desconto acima do teto ou margem abaixo do piso, a venda exige confirmação de gerente/admin.
              </p>
            </div>
            <Switch
              checked={form.requireManagerApproval}
              onCheckedChange={(checked) => setForm({ ...form, requireManagerApproval: checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
