import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { maskCEP } from '@/lib/masks';
import {
  fetchAddressByCep,
  formatFullAddress,
  parseAddressString,
  type AddressData,
  INITIAL_ADDRESS,
} from '@/lib/cepService';

export interface AddressFormFieldsProps {
  value?: Partial<AddressData> | string;
  onChange: (data: AddressData, fullFormattedString: string) => void;
  required?: boolean;
  disabled?: boolean;
  showTitle?: boolean;
  title?: string;
  className?: string;
}

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const AddressFormFields: React.FC<AddressFormFieldsProps> = ({
  value,
  onChange,
  required = false,
  disabled = false,
  showTitle = true,
  title = 'Endereço Completo do Cliente',
  className = '',
}) => {
  // Inicializa a partir de string ou objeto
  const [address, setAddress] = useState<AddressData>(() => {
    if (typeof value === 'string') {
      return parseAddressString(value);
    }
    return { ...INITIAL_ADDRESS, ...(value || {}) };
  });

  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepStatus, setCepStatus] = useState<'idle' | 'success' | 'not_found'>('idle');
  const numberInputRef = useRef<HTMLInputElement>(null);
  const lastFetchedCepRef = useRef<string>('');

  // Sincroniza se o valor externo mudar significativamente
  useEffect(() => {
    if (typeof value === 'string') {
      const currentFormatted = formatFullAddress(address);
      if (value.trim() && value.trim() !== currentFormatted.trim()) {
        const parsed = parseAddressString(value);
        setAddress(parsed);
      }
    } else if (value && typeof value === 'object') {
      setAddress((prev) => ({ ...prev, ...value }));
    }
  }, [value]);

  const updateField = (field: keyof AddressData, val: string) => {
    const updated = { ...address, [field]: val };
    setAddress(updated);
    const formatted = formatFullAddress(updated);
    onChange(updated, formatted);
  };

  const handleLookupCep = async (cepToSearch: string) => {
    const clean = cepToSearch.replace(/\D/g, '');
    if (clean.length !== 8) return;
    if (lastFetchedCepRef.current === clean && cepStatus === 'success') return;

    setIsLoadingCep(true);
    setCepStatus('idle');

    try {
      const result = await fetchAddressByCep(clean);
      if (result) {
        lastFetchedCepRef.current = clean;
        setCepStatus('success');
        const updated: AddressData = {
          ...address,
          cep: maskCEP(clean),
          street: result.street || address.street,
          neighborhood: result.neighborhood || address.neighborhood,
          city: result.city || address.city,
          state: result.state || address.state || 'MG',
        };
        setAddress(updated);
        onChange(updated, formatFullAddress(updated));

        // Move o foco diretamente para o campo "Número"
        setTimeout(() => {
          numberInputRef.current?.focus();
        }, 120);
      } else {
        setCepStatus('not_found');
      }
    } catch {
      setCepStatus('not_found');
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const masked = maskCEP(raw);
    updateField('cep', masked);

    const clean = masked.replace(/\D/g, '');
    if (clean.length === 8) {
      handleLookupCep(clean);
    } else {
      setCepStatus('idle');
    }
  };

  return (
    <div className={`space-y-3.5 p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/40 ${className}`}>
      {showTitle && (
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {title}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Digite o CEP para preenchimento automático das informações de entrega e faturamento
              </p>
            </div>
          </div>
          {cepStatus === 'success' && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
              <CheckCircle2 className="w-3 h-3" /> CEP Identificado
            </Badge>
          )}
          {cepStatus === 'not_found' && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
              <AlertCircle className="w-3 h-3" /> Preencha manualmente
            </Badge>
          )}
        </div>
      )}

      {/* Linha 1: CEP (com busca), Cidade e Estado */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-4 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              CEP {required && <span className="text-destructive">*</span>}
            </Label>
            {isLoadingCep && (
              <span className="text-[10px] font-medium text-primary flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
              </span>
            )}
          </div>
          <div className="relative flex items-center">
            <Input
              value={address.cep}
              onChange={handleCepChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLookupCep(address.cep);
                }
              }}
              placeholder="00000-000"
              maxLength={9}
              disabled={disabled || isLoadingCep}
              className="h-9 text-xs font-mono pr-16 bg-background shadow-xs font-semibold"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || isLoadingCep || address.cep.replace(/\D/g, '').length < 8}
              onClick={() => handleLookupCep(address.cep)}
              className="absolute right-1 h-7 px-2 text-[10px] text-muted-foreground hover:text-primary gap-1"
              title="Buscar endereço por este CEP"
            >
              {isLoadingCep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Buscar</span>
            </Button>
          </div>
        </div>

        <div className="sm:col-span-6 space-y-1">
          <Label className="text-xs font-semibold text-foreground">
            Cidade {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            value={address.city}
            onChange={(e) => updateField('city', e.target.value)}
            placeholder="Ex: Montes Claros, Divinópolis, Belo Horizonte..."
            disabled={disabled}
            className="h-9 text-xs font-semibold bg-background shadow-xs"
            required={required}
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs font-semibold text-foreground">
            UF {required && <span className="text-destructive">*</span>}
          </Label>
          <select
            value={address.state || 'MG'}
            onChange={(e) => updateField('state', e.target.value.toUpperCase())}
            disabled={disabled}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs font-bold text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 2: Rua / Logradouro e Número */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-9 space-y-1">
          <Label className="text-xs font-semibold text-foreground">
            Rua / Logradouro / Avenida {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            value={address.street}
            onChange={(e) => updateField('street', e.target.value)}
            placeholder="Ex: Av. João XXIII, Rua das Flores..."
            disabled={disabled}
            className="h-9 text-xs bg-background shadow-xs font-medium"
            required={required}
          />
        </div>

        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs font-semibold text-foreground">
            Número {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            ref={numberInputRef}
            value={address.number}
            onChange={(e) => updateField('number', e.target.value)}
            placeholder="Ex: 990 ou S/N"
            disabled={disabled}
            className="h-9 text-xs font-semibold bg-background shadow-xs"
            required={required}
          />
        </div>
      </div>

      {/* Linha 3: Bairro e Complemento */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-6 space-y-1">
          <Label className="text-xs font-semibold text-foreground">
            Bairro {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            value={address.neighborhood}
            onChange={(e) => updateField('neighborhood', e.target.value)}
            placeholder="Ex: Centro, Cidade Cristo Rei, Industrial..."
            disabled={disabled}
            className="h-9 text-xs bg-background shadow-xs"
            required={required}
          />
        </div>

        <div className="sm:col-span-6 space-y-1">
          <Label className="text-xs font-semibold text-muted-foreground">
            Complemento <span className="text-[10px] font-normal text-muted-foreground/80">(Opcional)</span>
          </Label>
          <Input
            value={address.complement}
            onChange={(e) => updateField('complement', e.target.value)}
            placeholder="Ex: Apto 102, Bloco B, Casa dos Fundos, Galpão..."
            disabled={disabled}
            className="h-9 text-xs bg-background shadow-xs"
          />
        </div>
      </div>
    </div>
  );
};
