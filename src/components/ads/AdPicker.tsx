import { useMemo } from 'react';
import { ImageOff, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AD_STATUS_LABEL, useAdImageUrl, useStoreAds, type StoreAd } from '@/hooks/useStoreAds';

const NONE = '__none__';

export function AdThumb({ path, className }: { path?: string | null; className?: string }) {
  const { data: url } = useAdImageUrl(path);
  return (
    <div className={cn('rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0', className)}>
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <ImageOff className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}

interface AdPickerProps {
  storeId?: string | null;
  /** Restringe às plataformas compatíveis com a origem escolhida. */
  platformFilter?: 'instagram' | 'facebook' | null;
  campaignName: string;
  adId: string;
  onChange: (next: { campaignName: string; adId: string }) => void;
  compact?: boolean;
}

/**
 * Seleção de campanha e anúncio específico da loja.
 * Campanha é obrigatória para origens de anúncio; anúncio é opcional.
 */
export function AdPicker({ storeId, platformFilter, campaignName, adId, onChange, compact }: AdPickerProps) {
  const { data: ads = [], isLoading } = useStoreAds(storeId || undefined);

  const relevant = useMemo(
    () =>
      ads.filter((a) => {
        if (!platformFilter) return true;
        return a.platform === 'ambos' || a.platform === platformFilter;
      }),
    [ads, platformFilter],
  );

  const campaigns = useMemo(
    () => Array.from(new Set(relevant.map((a) => a.campaign_name))).sort(),
    [relevant],
  );

  const adsOfCampaign = useMemo(
    () =>
      relevant
        .filter((a) => !campaignName || a.campaign_name === campaignName)
        .sort((a, b) => (a.status === 'ativo' ? -1 : 1) - (b.status === 'ativo' ? -1 : 1)),
    [relevant, campaignName],
  );

  if (!storeId) {
    return <p className="text-xs text-muted-foreground">Selecione a loja para listar os anúncios dela.</p>;
  }

  if (!isLoading && relevant.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Megaphone className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Nenhum anúncio cadastrado para esta loja. Peça ao gerente para cadastrar em <strong>Anúncios</strong>; enquanto isso, descreva a campanha no campo abaixo.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Campanha *</Label>
        <Select
          value={campaignName || NONE}
          onValueChange={(v) => onChange({ campaignName: v === NONE ? '' : v, adId: '' })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecione a campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Selecione…</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {campaignName && (
        <div className="space-y-1.5">
          <Label className="text-xs">Anúncio específico (opcional)</Label>
          <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
            {adsOfCampaign.map((ad) => (
              <AdOption
                key={ad.id}
                ad={ad}
                selected={adId === ad.id}
                onClick={() => onChange({ campaignName, adId: adId === ad.id ? '' : ad.id })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdOption({ ad, selected, onClick }: { ad: StoreAd; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 text-left rounded-lg border p-2 transition-all duration-200 hover:border-primary/60 hover:bg-primary/5',
        selected ? 'border-primary bg-primary/10 ring-1 ring-primary/40' : 'border-border bg-card',
      )}
    >
      <AdThumb path={ad.image_url} className="w-12 h-12" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{ad.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant={ad.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
            {AD_STATUS_LABEL[ad.status]}
          </Badge>
          {ad.started_at && (
            <span className="text-[11px] text-muted-foreground">
              desde {new Date(ad.started_at + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
