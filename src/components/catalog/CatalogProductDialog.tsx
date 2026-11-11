import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CatalogProduct } from "@/types/catalog";
import { Plus, Trash2, Image, Layers, DollarSign, Wrench } from "lucide-react";

interface CatalogProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: CatalogProduct | null;
  onSaveProduct: (product: CatalogProduct) => Promise<any>;
}

export function CatalogProductDialog({
  open,
  onOpenChange,
  product,
  onSaveProduct,
}: CatalogProductDialogProps) {
  // Aba Geral
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("Shineray");
  const [cat, setCat] = useState<"ele" | "semi" | "off" | "shineray">("shineray");
  const [sub, setSub] = useState("Street");
  const [desc, setDesc] = useState("");
  const [active, setActive] = useState(true);
  const [readyDelivery, setReadyDelivery] = useState(true);
  const [storeId, setStoreId] = useState<string>("all");
  const [video, setVideo] = useState("");
  const [disc, setDisc] = useState("");

  // Aba Preço & Estoque
  const [price, setPrice] = useState<string>("");
  const [oldPrice, setOldPrice] = useState<string>("");
  const [installments, setInstallments] = useState(true);
  const [stockType, setStockType] = useState<"fixed" | "unlimited" | "soldout">("unlimited");
  const [stockQty, setStockQty] = useState<number>(5);

  // Aba Fotos & Cores
  const [photosText, setPhotosText] = useState("");
  const [colors, setColors] = useState<{ name: string; hex: string; photoIdx: number }[]>([]);

  // Aba Ficha Técnica & Destaques
  const [specs, setSpecs] = useState<{ value: string; label: string }[]>([]);
  const [featsText, setFeatsText] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (product) {
        setId(product.id || "");
        setName(product.name || "");
        setBrand(product.brand || "Shineray");
        setCat(product.cat || "shineray");
        setSub(product.sub || "Street");
        setDesc(product.desc || "");
        setActive(product.active !== false);
        setReadyDelivery(!!product.readyDelivery);
        setStoreId(product.store_id || "all");
        setVideo(product.video || "");
        setDisc(product.disc || "");

        setPrice(product.price !== null && product.price !== undefined ? String(product.price) : "");
        setOldPrice(product.oldPrice !== null && product.oldPrice !== undefined ? String(product.oldPrice) : "");
        setInstallments(product.installments !== false);

        if (product.stock === 0) {
          setStockType("soldout");
          setStockQty(0);
        } else if (product.stock === null || product.stock === undefined) {
          setStockType("unlimited");
          setStockQty(5);
        } else {
          setStockType("fixed");
          setStockQty(product.stock);
        }

        setPhotosText((product.photos || []).join("\n"));
        setColors(
          (product.colors || []).map(([cName, hex, idx]) => ({
            name: cName,
            hex,
            photoIdx: idx,
          }))
        );

        setSpecs(
          (product.specs || []).map(([val, lbl]) => ({
            value: val,
            label: lbl,
          }))
        );
        setFeatsText((product.feat || []).join("\n"));
      } else {
        // Novo Produto
        setId("");
        setName("");
        setBrand("Shineray");
        setCat("shineray");
        setSub("Street");
        setDesc("");
        setActive(true);
        setReadyDelivery(true);
        setStoreId("all");
        setVideo("");
        setDisc("Imagens ilustrativas. Preços e condições sujeitos a alteração sem aviso prévio.");
        setPrice("");
        setOldPrice("");
        setInstallments(true);
        setStockType("unlimited");
        setStockQty(5);
        setPhotosText("");
        setColors([]);
        setSpecs([
          { value: "150 cc", label: "Cilindrada" },
          { value: "Gasolina", label: "Combustível" },
          { value: "Partida Elétrica", label: "Partida" },
        ]);
        setFeatsText("Freios a disco\nPainel 100% digital\nIluminação Full LED");
      }
    }
  }, [open, product]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!product) {
      // Auto gera id kebab case se for novo produto
      const autoId = val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setId(autoId);
    }
  };

  const handleAddSpec = () => {
    setSpecs([...specs, { value: "", label: "" }]);
  };

  const handleRemoveSpec = (index: number) => {
    setSpecs(specs.filter((_, i) => i !== index));
  };

  const handleAddColor = () => {
    setColors([...colors, { name: "Preto", hex: "#111111", photoIdx: 0 }]);
  };

  const handleRemoveColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!id.trim()) {
      toast.error("O ID único é obrigatório");
      return;
    }
    if (!name.trim()) {
      toast.error("O nome do veículo é obrigatório");
      return;
    }

    const photos = photosText
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const feat = featsText
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    let finalStock: number | null = null;
    if (stockType === "soldout") finalStock = 0;
    else if (stockType === "fixed") finalStock = Number(stockQty) || 0;
    else finalStock = null;

    const payload: CatalogProduct = {
      id: id.trim(),
      active,
      cat,
      sub: sub.trim(),
      brand: brand.trim(),
      name: name.trim(),
      price: price.trim() !== "" ? parseFloat(price) : null,
      oldPrice: oldPrice.trim() !== "" ? parseFloat(oldPrice) : undefined,
      installments,
      readyDelivery,
      store_id: storeId,
      store_name: storeId === "store-divinopolis" ? "Divinópolis" : storeId === "store-montesclaros" ? "Montes Claros" : "Todas as Lojas",
      stock: finalStock,
      desc: desc.trim(),
      photos: photos.length > 0 ? photos : ["https://placehold.co/600x400/png?text=Sem+Foto"],
      specs: specs
        .filter((s) => s.label.trim() && s.value.trim())
        .map((s) => [s.value.trim(), s.label.trim()]),
      feat,
      colors:
        colors.length > 0
          ? colors.map((c) => [c.name.trim(), c.hex.trim(), Number(c.photoIdx) || 0])
          : undefined,
      video: video.trim() || undefined,
      disc: disc.trim() || undefined,
      rotation360: product?.rotation360 || null,
    };

    setLoading(true);
    try {
      await onSaveProduct(payload);
      toast.success(`Veículo "${payload.name}" sincronizado com sucesso!`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao sincronizar veículo: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            {product ? `Editar no Catálogo: ${product.name}` : "Novo Veículo no Catálogo"}
          </DialogTitle>
          <DialogDescription>
            Sincroniza informações completas diretamente com a API do Catálogo L1MA Motors.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="geral" className="w-full mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="geral" className="text-xs sm:text-sm">Geral</TabsTrigger>
            <TabsTrigger value="preco" className="text-xs sm:text-sm">Preço & Estoque</TabsTrigger>
            <TabsTrigger value="fotos" className="text-xs sm:text-sm">Fotos & Cores</TabsTrigger>
            <TabsTrigger value="specs" className="text-xs sm:text-sm">Ficha Técnica</TabsTrigger>
          </TabsList>

          {/* ABA GERAL */}
          <TabsContent value="geral" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-name">Nome do Modelo *</Label>
                <Input
                  id="prod-name"
                  placeholder="Ex: SHI 175 EFI"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-id">ID Único (kebab-case) *</Label>
                <Input
                  id="prod-id"
                  placeholder="Ex: shineray-shi-175-efi"
                  value={id}
                  disabled={!!product}
                  onChange={(e) => setId(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Categoria Principal (cat) *</Label>
                <Select value={cat} onValueChange={(val: any) => setCat(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shineray">Concessionária Shineray</SelectItem>
                    <SelectItem value="ele">Elétricas Multimarcas</SelectItem>
                    <SelectItem value="semi">Semi-novos</SelectItem>
                    <SelectItem value="off">Off-Road Multimarcas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-sub">Subcategoria (sub)</Label>
                <Input
                  id="prod-sub"
                  placeholder="Ex: Trail, Street, Scooter, Custom"
                  value={sub}
                  onChange={(e) => setSub(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-brand">Marca</Label>
                <Input
                  id="prod-brand"
                  placeholder="Ex: Shineray, Voltz, Honda"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>
            </div>

            {/* Disponibilidade por Loja / Concessionária */}
            <div className="space-y-1.5 p-3 rounded-xl border bg-muted/30">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                🏢 Concessionária / Disponibilidade por Loja
              </Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione a loja..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏢 Todas as Lojas / Rede (Disponível em Divinópolis e Montes Claros)</SelectItem>
                  <SelectItem value="store-divinopolis">📍 Concessionária Divinópolis (Matriz Oeste)</SelectItem>
                  <SelectItem value="store-montesclaros">📍 Concessionária Montes Claros (Polo Norte)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Define se o veículo e estoque pertencem a uma loja específica ou estão disponíveis em toda a rede.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-desc">Descrição Comercial</Label>
              <Textarea
                id="prod-desc"
                rows={3}
                placeholder="Breve descrição dos principais atrativos e usabilidade do veículo..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Visível no Catálogo</Label>
                  <p className="text-xs text-muted-foreground">Exibir este veículo publicamente</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Pronta Entrega</Label>
                  <p className="text-xs text-muted-foreground">Selo de envio/retirada imediata</p>
                </div>
                <Switch checked={readyDelivery} onCheckedChange={setReadyDelivery} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-video">ID de Vídeo do YouTube (Opcional)</Label>
                <Input
                  id="prod-video"
                  placeholder="Ex: 1Y598CuK7kg"
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-disc">Aviso Legal de Rodapé (Opcional)</Label>
                <Input
                  id="prod-disc"
                  placeholder="Ex: Valores sujeitos a frete da fábrica..."
                  value={disc}
                  onChange={(e) => setDisc(e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          {/* ABA PREÇO & ESTOQUE */}
          <TabsContent value="preco" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-price" className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Preço À Vista (R$)
                </Label>
                <Input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 18990 (deixe em branco para 'Sob Consulta')"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-oldprice">Preço Original / De (R$)</Label>
                <Input
                  id="prod-oldprice"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 20490 (gera selo promocional 'De / Por')"
                  value={oldPrice}
                  onChange={(e) => setOldPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Habilitar Parcelamento no Cartão</Label>
                <p className="text-xs text-muted-foreground">Exibe simulação de parcelas em até 21x na página do veículo</p>
              </div>
              <Switch checked={installments} onCheckedChange={setInstallments} />
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-semibold">Disponibilidade de Estoque</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setStockType("unlimited")}
                  className={`p-3 text-left rounded-lg border text-sm transition-all ${
                    stockType === "unlimited"
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="font-semibold text-foreground">Pronta Entrega Ilimitada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sem número rígido de unidades (stock: null).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStockType("fixed")}
                  className={`p-3 text-left rounded-lg border text-sm transition-all ${
                    stockType === "fixed"
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="font-semibold text-foreground">Estoque Quantificado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Controla o número exato de unidades disponíveis.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setStockType("soldout")}
                  className={`p-3 text-left rounded-lg border text-sm transition-all ${
                    stockType === "soldout"
                      ? "border-destructive bg-destructive/10 font-medium"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="font-semibold text-destructive">Esgotado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exibe carimbo de "Esgotado" na foto (stock: 0).
                  </p>
                </button>
              </div>

              {stockType === "fixed" && (
                <div className="w-full sm:w-1/2 space-y-1.5 pt-2">
                  <Label htmlFor="stock-qty">Quantidade Disponível</Label>
                  <Input
                    id="stock-qty"
                    type="number"
                    min={1}
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* ABA FOTOS & CORES */}
          <TabsContent value="fotos" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="photos-input" className="flex items-center gap-1.5">
                <Image className="w-4 h-4 text-blue-500" />
                URLs das Fotos Oficiais (uma por linha)
              </Label>
              <Textarea
                id="photos-input"
                rows={4}
                placeholder="https://exemplo.com/foto1.jpg (A primeira foto é a capa principal)&#10;https://exemplo.com/foto2.jpg"
                value={photosText}
                onChange={(e) => setPhotosText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Dica: A primeira foto da lista é a que aparece no card do catálogo.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Cores Disponíveis</Label>
                  <p className="text-xs text-muted-foreground">
                    Define as bolinhas de cor com hex e a foto correspondente.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddColor} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Cor
                </Button>
              </div>

              {colors.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
                  <Input
                    type="color"
                    className="w-10 h-9 p-1 cursor-pointer"
                    value={c.hex}
                    onChange={(e) => {
                      const next = [...colors];
                      next[idx].hex = e.target.value;
                      setColors(next);
                    }}
                  />
                  <Input
                    placeholder="Nome da cor (ex: Vermelho Metálico)"
                    value={c.name}
                    className="flex-1"
                    onChange={(e) => {
                      const next = [...colors];
                      next[idx].name = e.target.value;
                      setColors(next);
                    }}
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">Índice Foto:</span>
                    <Input
                      type="number"
                      min={0}
                      className="w-16"
                      value={c.photoIdx}
                      onChange={(e) => {
                        const next = [...colors];
                        next[idx].photoIdx = Number(e.target.value);
                        setColors(next);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-9 w-9"
                    onClick={() => handleRemoveColor(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ABA FICHA TÉCNICA & DESTAQUES */}
          <TabsContent value="specs" className="space-y-4 pt-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    Ficha Técnica (Valor e Rótulo)
                  </Label>
                  <p className="text-xs text-muted-foreground">Exibido na tabela de especificações do catálogo.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddSpec} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Nova Especificação
                </Button>
              </div>

              <div className="space-y-2">
                {specs.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Valor (ex: 169 cc)"
                      value={s.value}
                      className="w-1/2"
                      onChange={(e) => {
                        const next = [...specs];
                        next[idx].value = e.target.value;
                        setSpecs(next);
                      }}
                    />
                    <Input
                      placeholder="Rótulo (ex: Cilindrada)"
                      value={s.label}
                      className="w-1/2"
                      onChange={(e) => {
                        const next = [...specs];
                        next[idx].label = e.target.value;
                        setSpecs(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-9 w-9 shrink-0"
                      onClick={() => handleRemoveSpec(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-3 border-t">
              <Label htmlFor="feats-input">Destaques Comerciais (um por linha)</Label>
              <Textarea
                id="feats-input"
                rows={3}
                placeholder="Injeção Eletrônica EFI&#10;Painel 100% digital com indicador de marcha&#10;Entrada USB para carregamento"
                value={featsText}
                onChange={(e) => setFeatsText(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 pt-2 border-t flex items-center justify-between sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Sincronizando..." : "Sincronizar Produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
