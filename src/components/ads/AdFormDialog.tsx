import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Megaphone, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useStores } from '@/hooks/useStores';
import { maskCurrency, parseCurrency } from '@/lib/masks';
import {
  AD_PLATFORM_LABEL,
  AD_STATUS_LABEL,
  type AdPlatform,
  type AdStatus,
  type StoreAd,
  uploadAdImage,
  useAdImageUrl,
  useCreateStoreAd,
  useStoreAds,
  useUpdateStoreAd,
} from '@/hooks/useStoreAds';

interface AdFormDialogProps {
  storeId: string;
  ad?: StoreAd | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdFormDialog({ storeId, ad, open, onOpenChange }: AdFormDialogProps) {
  const { toast } = useToast();
  const { data: stores = [] } = useStores();
  const create = useCreateStoreAd();
  const update = useUpdateStoreAd();
  const [selectedStoreId, setSelectedStoreId] = useState(storeId || 'store-divinopolis');
  const { data: existingAds } = useStoreAds(selectedStoreId);
  const campaigns = Array.from(new Set((existingAds || []).map((a) => a.campaign_name))).sort();

  const [campaign, setCampaign] = useState('');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<AdPlatform>('instagram');
  const [status, setStatus] = useState<AdStatus>('ativo');
  const [caption, setCaption] = useState('');
  const [adUrl, setAdUrl] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [budget, setBudget] = useState(maskCurrency(0));
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: currentImage } = useAdImageUrl(ad?.image_url);

  useEffect(() => {
    if (!open) return;
    setSelectedStoreId(ad?.store_id || storeId || 'store-divinopolis');
    setCampaign(ad?.campaign_name || '');
    setTitle(ad?.title || '');
    setPlatform(ad?.platform || 'instagram');
    setStatus(ad?.status || 'ativo');
    setCaption(ad?.caption || '');
    setAdUrl(ad?.ad_url || '');
    setStartedAt(ad?.started_at || new Date().toISOString().slice(0, 10));
    setEndedAt(ad?.ended_at || '');
    setBudget(maskCurrency(Number(ad?.budget_spent || 0)));
    setNotes(ad?.notes || '');
    setFile(null);
    setPreview(null);
  }, [open, ad]);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Arquivo inválido', description: 'Envie uma imagem (PNG ou JPG).' });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) pickFile(item.getAsFile());
  };

  const submit = async () => {
    if (campaign.trim().length < 2 || title.trim().length < 2) {
      toast({ variant: 'destructive', title: 'Preencha campanha e título do anúncio.' });
      return;
    }
    setSaving(true);
    try {
      let image_url = ad?.image_url ?? null;
      if (file) image_url = await uploadAdImage(selectedStoreId, file);
      const payload = {
        store_id: selectedStoreId,
        campaign_name: campaign.trim().toUpperCase(),
        title: title.trim(),
        platform,
        status,
        caption: caption.trim() || null,
        ad_url: adUrl.trim() || null,
        started_at: startedAt || null,
        ended_at: endedAt || null,
        budget_spent: parseCurrency(budget) || 0,
        notes: notes.trim() || null,
        image_url,
      };
      if (ad) await update.mutateAsync({ id: ad.id, ...payload });
      else await create.mutateAsync(payload);
      onOpenChange(false);
    } catch {
      /* toasts nos hooks */
    } finally {
      setSaving(false);
    }
  };

  const shownImage = preview || currentImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Megaphone className="w-5 h-5 text-primary" />
            {ad ? 'Editar anúncio' : 'Novo anúncio'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
          {/* Foto */}
          <div className="space-y-2">
            <Label>Foto do anúncio</Label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-full aspect-square rounded-lg border border-dashed bg-muted/30 hover:bg-muted/50 transition-colors overflow-hidden flex items-center justify-center"
            >
              {shownImage ? (
                <img src={shownImage} alt="Prévia do anúncio" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-3">
                  <ImagePlus className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Clique, arraste ou cole (Ctrl+V) um print do anúncio</p>
                </div>
              )}
            </button>
            {preview && (
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { setFile(null); setPreview(null); }}>
                <X className="w-3.5 h-3.5 mr-1" /> Remover nova foto
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
          </div>

          {/* Dados */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Concessionária *</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                <SelectContent>
                  {stores.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Campanha *</Label>
                <Input
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value.toUpperCase())}
                  placeholder="EX: SETEMBRO CG 160"
                  list="ad-campaigns"
                  className="h-9 uppercase"
                />
                <datalist id="ad-campaigns">
                  {campaigns.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Título do anúncio *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reels CG 160 vermelha" className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plataforma</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as AdPlatform)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AD_PLATFORM_LABEL) as AdPlatform[]).map((p) => (
                      <SelectItem key={p} value={p}>{AD_PLATFORM_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AdStatus)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AD_STATUS_LABEL) as AdStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{AD_STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label>Verba gasta</Label>
                <Input
                  value={budget}
                  onChange={(e) => setBudget(maskCurrency(e.target.value))}
                  inputMode="numeric"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Link do anúncio (Biblioteca de Anúncios ou post)</Label>
              <Input value={adUrl} onChange={(e) => setAdUrl(e.target.value)} placeholder="https://..." className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label>Texto / legenda do anúncio</Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Copie o texto do anúncio para identificar depois" />
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? 'Salvando...' : ad ? 'Salvar alterações' : 'Cadastrar anúncio'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
