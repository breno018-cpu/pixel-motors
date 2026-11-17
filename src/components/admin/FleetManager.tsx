import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Truck,
  Car,
  Fuel,
  Plus,
  Pencil,
  Trash2,
  Settings,
  Coffee,
  Utensils,
  Moon,
  Clock,
  Navigation,
  Calculator,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import {
  FleetVehicle,
  FleetTrailer,
  TravelExpenseSettings,
  getFleetVehicles,
  saveFleetVehicles,
  getFleetTrailers,
  saveFleetTrailers,
  getTravelExpenseSettings,
  saveTravelExpenseSettings,
  calculateFleetTrip,
  DEFAULT_FLEET_VEHICLES,
  DEFAULT_FLEET_TRAILERS,
  DEFAULT_TRAVEL_EXPENSES,
  type FuelType,
} from '@/lib/fleetLogistics';

export function FleetManager() {
  const { toast } = useToast();

  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [trailers, setTrailers] = useState<FleetTrailer[]>([]);
  const [expenses, setExpenses] = useState<TravelExpenseSettings>(DEFAULT_TRAVEL_EXPENSES);

  // Modais de Edição/Criação
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<FleetVehicle | null>(null);

  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [editingTrailer, setEditingTrailer] = useState<FleetTrailer | null>(null);

  // Simulador Rápido na Aba Mestre
  const [simVehicleId, setSimVehicleId] = useState<string>('');
  const [simTrailerId, setSimTrailerId] = useState<string>('carretinha_3');
  const [simDistanciaKm, setSimDistanciaKm] = useState<number>(45);
  const [simQtdMotos, setSimQtdMotos] = useState<number>(3);
  const [simEquipe, setSimEquipe] = useState<number>(1);
  const [simIdaEVolta, setSimIdaEVolta] = useState<boolean>(true);

  // Form State do Carro
  const [formNome, setFormNome] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formPlaca, setFormPlaca] = useState('');
  const [formCombustivel, setFormCombustivel] = useState<FuelType>('gasolina');
  const [formPrecoLitro, setFormPrecoLitro] = useState(5.89);
  const [formConsumoSozinho, setFormConsumoSozinho] = useState(12.0);
  const [formConsumoCarretinha, setFormConsumoCarretinha] = useState(9.0);
  const [formCapacidadeCarro, setFormCapacidadeCarro] = useState(2);
  const [formCustoKm, setFormCustoKm] = useState(0.25);
  const [formLojaNome, setFormLojaNome] = useState('Shineray & Multimarcas Divinópolis');

  // Form State da Carretinha
  const [formTraNome, setFormTraNome] = useState('');
  const [formTraPlaca, setFormTraPlaca] = useState('');
  const [formTraCapacidade, setFormTraCapacidade] = useState(3);
  const [formTraImpacto, setFormTraImpacto] = useState(25);
  const [formTraDesc, setFormTraDesc] = useState('');

  // Carrega dados
  const reloadData = () => {
    const vList = getFleetVehicles();
    const tList = getFleetTrailers();
    const exp = getTravelExpenseSettings();
    setVehicles(vList);
    setTrailers(tList);
    setExpenses(exp);
    if (vList.length > 0 && !simVehicleId) {
      setSimVehicleId(vList[0].id);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Abre modal de veículo
  const handleOpenVehicleModal = (veh?: FleetVehicle) => {
    if (veh) {
      setEditingVehicle(veh);
      setFormNome(veh.nome);
      setFormModelo(veh.modelo);
      setFormPlaca(veh.placa);
      setFormCombustivel(veh.tipoCombustivel);
      setFormPrecoLitro(veh.precoCombustivelLitro);
      setFormConsumoSozinho(veh.consumoKmPorLitroSozinho);
      setFormConsumoCarretinha(veh.consumoKmPorLitroComCarretinha);
      setFormCapacidadeCarro(veh.capacidadeMotosCarro);
      setFormCustoKm(veh.custoManutencaoPorKm);
      setFormLojaNome(veh.lojaOrigemNome);
    } else {
      setEditingVehicle(null);
      setFormNome('');
      setFormModelo('');
      setFormPlaca('');
      setFormCombustivel('gasolina');
      setFormPrecoLitro(5.89);
      setFormConsumoSozinho(12.0);
      setFormConsumoCarretinha(9.0);
      setFormCapacidadeCarro(2);
      setFormCustoKm(0.25);
      setFormLojaNome('Shineray Divinópolis');
    }
    setVehicleModalOpen(true);
  };

  // Salvar Veículo
  const handleSaveVehicle = () => {
    if (!formNome.trim() || !formPlaca.trim()) {
      toast({
        title: 'Dados Incompletos',
        description: 'Por favor, informe o nome do veículo e a placa.',
        variant: 'destructive',
      });
      return;
    }

    const newVeh: FleetVehicle = {
      id: editingVehicle ? editingVehicle.id : `veh_${Date.now()}`,
      nome: formNome.trim(),
      modelo: formModelo.trim() || formNome.trim(),
      placa: formPlaca.trim().toUpperCase(),
      tipoCombustivel: formCombustivel,
      precoCombustivelLitro: Number(formPrecoLitro) || 5.89,
      consumoKmPorLitroSozinho: Number(formConsumoSozinho) || 12.0,
      consumoKmPorLitroComCarretinha: Number(formConsumoCarretinha) || 9.0,
      capacidadeMotosCarro: Number(formCapacidadeCarro) || 2,
      custoManutencaoPorKm: Number(formCustoKm) || 0.25,
      lojaOrigemId: formLojaNome.toLowerCase().includes('montes') ? 'store-montesclaros' : 'store-divinopolis',
      lojaOrigemNome: formLojaNome,
      ativo: true,
    };

    let updated: FleetVehicle[];
    if (editingVehicle) {
      updated = vehicles.map((v) => (v.id === editingVehicle.id ? newVeh : v));
    } else {
      updated = [newVeh, ...vehicles];
    }

    saveFleetVehicles(updated);
    setVehicles(updated);
    setVehicleModalOpen(false);
    toast({
      title: 'Veículo Salvo!',
      description: `${newVeh.nome} (${newVeh.placa}) registrado com sucesso.`,
    });
  };

  // Excluir Veículo
  const handleDeleteVehicle = (id: string) => {
    if (vehicles.length <= 1) {
      toast({
        title: 'Operação Não Permitida',
        description: 'Mantenha pelo menos um veículo cadastrado na frota.',
        variant: 'destructive',
      });
      return;
    }
    const filtered = vehicles.filter((v) => v.id !== id);
    saveFleetVehicles(filtered);
    setVehicles(filtered);
    toast({ title: 'Veículo Removido', description: 'O veículo foi retirado da frota.' });
  };

  // Abre modal de Carretinha
  const handleOpenTrailerModal = (tra?: FleetTrailer) => {
    if (tra) {
      setEditingTrailer(tra);
      setFormTraNome(tra.nome);
      setFormTraPlaca(tra.placa);
      setFormTraCapacidade(tra.capacidadeMotos);
      setFormTraImpacto(tra.impactoConsumoPercentual);
      setFormTraDesc(tra.descricao || '');
    } else {
      setEditingTrailer(null);
      setFormTraNome('');
      setFormTraPlaca('');
      setFormTraCapacidade(3);
      setFormTraImpacto(25);
      setFormTraDesc('');
    }
    setTrailerModalOpen(true);
  };

  // Salvar Carretinha
  const handleSaveTrailer = () => {
    if (!formTraNome.trim() || !formTraPlaca.trim()) {
      toast({
        title: 'Dados Incompletos',
        description: 'Informe o nome e a placa da carretinha.',
        variant: 'destructive',
      });
      return;
    }

    const newTra: FleetTrailer = {
      id: editingTrailer ? editingTrailer.id : `tra_${Date.now()}`,
      nome: formTraNome.trim(),
      tipo: formTraCapacidade === 6 ? 'carretinha_6' : 'carretinha_3',
      placa: formTraPlaca.trim().toUpperCase(),
      capacidadeMotos: Number(formTraCapacidade) || 3,
      impactoConsumoPercentual: Number(formTraImpacto) || 25,
      ativo: true,
      descricao: formTraDesc.trim(),
    };

    let updated: FleetTrailer[];
    if (editingTrailer) {
      updated = trailers.map((t) => (t.id === editingTrailer.id ? newTra : t));
    } else {
      updated = [...trailers, newTra];
    }

    saveFleetTrailers(updated);
    setTrailers(updated);
    setTrailerModalOpen(false);
    toast({
      title: 'Carretinha Salva!',
      description: `${newTra.nome} (${newTra.placa}) registrada com sucesso.`,
    });
  };

  // Salvar Parâmetros de Despesas
  const handleSaveExpenses = () => {
    saveTravelExpenseSettings(expenses);
    toast({
      title: 'Parâmetros de Viagem Atualizados!',
      description: 'Valores de alimentação, pernoite e diárias salvos com sucesso.',
    });
  };

  // Resetar Padrões de Fábrica
  const handleResetDefaults = () => {
    saveFleetVehicles(DEFAULT_FLEET_VEHICLES);
    saveFleetTrailers(DEFAULT_FLEET_TRAILERS);
    saveTravelExpenseSettings(DEFAULT_TRAVEL_EXPENSES);
    reloadData();
    toast({
      title: 'Configurações Restauradas',
      description: 'Padrões de fábrica da frota Shineray/Multimarcas recarregados.',
    });
  };

  // Simulação em tempo real na aba mestre
  const tripSim = useMemo(() => {
    if (!vehicles.length) return null;
    const vId = simVehicleId || vehicles[0].id;
    return calculateFleetTrip({
      vehicleId: vId,
      trailerId: simTrailerId,
      distanciaIdaKm: simDistanciaKm,
      idaEVolta: simIdaEVolta,
      quantidadeMotos: simQtdMotos,
      membrosEquipe: simEquipe,
    });
  }, [vehicles, simVehicleId, simTrailerId, simDistanciaKm, simIdaEVolta, simQtdMotos, simEquipe]);

  return (
    <div className="space-y-6">
      {/* Header Principal da Aba Mestre */}
      <Card className="border-border/70 bg-gradient-to-r from-card to-muted/20 shadow-xs">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold font-display text-foreground flex items-center gap-2">
                  Gestão de Frota Própria & Fretes da Concessionária
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    Aba Mestre
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Cadastre os carros de transporte da loja, configure o consumo (com ou sem carretinhas de 3 ou 6 motos) e defina os custos de paradas (café, almoço, janta e pernoite).
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                className="h-8 text-xs gap-1.5"
                title="Restaurar veículos e despesas de fábrica"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Padrões
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenVehicleModal()}
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Carro
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sub-Abas Internas da Frota */}
      <Tabs defaultValue="veiculos" className="space-y-4">
        <TabsList className="bg-muted/70 p-1 rounded-xl">
          <TabsTrigger value="veiculos" className="text-xs font-semibold gap-1.5">
            <Car className="w-3.5 h-3.5 text-primary" />
            Carros & Pickups ({vehicles.length})
          </TabsTrigger>
          <TabsTrigger value="carretinhas" className="text-xs font-semibold gap-1.5">
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            Carretinhas / Reboques ({trailers.length})
          </TabsTrigger>
          <TabsTrigger value="despesas" className="text-xs font-semibold gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-amber-500" />
            Parâmetros de Viagem & Diárias
          </TabsTrigger>
          <TabsTrigger value="simulador" className="text-xs font-semibold gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-blue-500" />
            Simulador Operacional de Teste
          </TabsTrigger>
        </TabsList>

        {/* 1. ABA DE VEÍCULOS (CARROS DA LOJA) */}
        <TabsContent value="veiculos" className="space-y-4 mt-0">
          <Card className="border-border/70">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Veículos de Transporte Próprio da Loja
                </CardTitle>
                <CardDescription className="text-xs">
                  Carros utilizados nas entregas. Padrão operacional: <strong>2 motos transportadas no próprio carro (caçamba)</strong> mais a soma do reboque engatado.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenVehicleModal()}
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Carro
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-bold">Veículo / Modelo</TableHead>
                      <TableHead className="text-xs font-bold">Placa</TableHead>
                      <TableHead className="text-xs font-bold">Combustível</TableHead>
                      <TableHead className="text-xs font-bold">Consumo (Só Carro)</TableHead>
                      <TableHead className="text-xs font-bold">Consumo (C/ Carretinha)</TableHead>
                      <TableHead className="text-xs font-bold">Motos no Carro</TableHead>
                      <TableHead className="text-xs font-bold">Filial / Base</TableHead>
                      <TableHead className="text-xs font-bold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => (
                      <TableRow key={v.id} className="hover:bg-muted/20">
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              {v.nome}
                            </span>
                            <span className="text-[11px] text-muted-foreground">{v.modelo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="font-mono text-xs font-bold bg-muted/50 border-border/70">
                            {v.placa}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold capitalize text-foreground flex items-center gap-1">
                              <Fuel className="w-3 h-3 text-amber-500" />
                              {v.tipoCombustivel}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              R$ {v.precoCombustivelLitro.toFixed(2)}/L
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs font-bold text-foreground">
                            {v.consumoKmPorLitroSozinho.toFixed(1)} km/L
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            {v.consumoKmPorLitroComCarretinha.toFixed(1)} km/L
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            (-{Math.round((1 - v.consumoKmPorLitroComCarretinha / v.consumoKmPorLitroSozinho) * 100)}% rendimento)
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {v.capacidadeMotosCarro} motos
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {v.lojaOrigemNome}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenVehicleModal(v)}
                              title="Editar veículo"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteVehicle(v.id)}
                              title="Remover veículo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. ABA DE CARRETINHAS / REBOQUES */}
        <TabsContent value="carretinhas" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trailers.map((tr) => (
              <Card key={tr.id} className="border-border/70 hover:border-border transition-colors">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        tr.capacidadeMotos === 6
                          ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      }`}
                    >
                      {tr.capacidadeMotos === 6 ? 'Grande Porte (6 Motos)' : 'Médio Porte (3 Motos)'}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs font-bold">
                      {tr.placa}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-foreground mt-2">
                    {tr.nome}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {tr.descricao}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
                    <div className="p-2 rounded-xl bg-muted/40 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block">Capacidade na Carreta</span>
                      <span className="font-bold text-foreground text-sm">
                        {tr.capacidadeMotos} motocicletas
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/40 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block">Total com Carro (2 motos)</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        Até {2 + tr.capacidadeMotos} motos
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>Impacto médio no consumo do carro:</span>
                    <span className="font-bold text-foreground">+{tr.impactoConsumoPercentual}% combustível</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenTrailerModal(tr)}
                      className="h-7 text-xs gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 3. ABA DE PARÂMETROS DE VIAGEM & DIÁRIAS */}
        <TabsContent value="despesas" className="space-y-4 mt-0">
          <Card className="border-border/70">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Utensils className="w-4 h-4 text-primary" />
                Custos de Viagem, Paradas e Diárias de Equipe
              </CardTitle>
              <CardDescription className="text-xs">
                Defina os valores padrão que a calculadora aplica automaticamente com base na distância, tempo de estrada e necessidade de pernoite.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Café da manhã */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <Label className="text-xs font-bold text-foreground">Café da Manhã</Label>
                  </div>
                  <Input
                    type="number"
                    step="0.5"
                    value={expenses.precoCafeManha}
                    onChange={(e) =>
                      setExpenses({ ...expenses, precoCafeManha: Number(e.target.value) || 0 })
                    }
                    className="h-8 text-xs font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Por pessoa em viagens com saída cedo ou pernoite.</p>
                </div>

                {/* Almoço */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-600" />
                    <Label className="text-xs font-bold text-foreground">Almoço</Label>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    value={expenses.precoAlmoco}
                    onChange={(e) =>
                      setExpenses({ ...expenses, precoAlmoco: Number(e.target.value) || 0 })
                    }
                    className="h-8 text-xs font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Aplicado em viagens com duração $\ge$ {expenses.limiteHorasAlmoco} horas.</p>
                </div>

                {/* Janta */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-orange-600" />
                    <Label className="text-xs font-bold text-foreground">Janta</Label>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    value={expenses.precoJanta}
                    onChange={(e) =>
                      setExpenses({ ...expenses, precoJanta: Number(e.target.value) || 0 })
                    }
                    className="h-8 text-xs font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Aplicado em viagens com duração $\ge$ {expenses.limiteHorasJanta} horas.</p>
                </div>

                {/* Parada para Dormir / Hotel */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-purple-600" />
                    <Label className="text-xs font-bold text-foreground">Pernoite / Hotel</Label>
                  </div>
                  <Input
                    type="number"
                    step="5"
                    value={expenses.precoPernoiteHotel}
                    onChange={(e) =>
                      setExpenses({ ...expenses, precoPernoiteHotel: Number(e.target.value) || 0 })
                    }
                    className="h-8 text-xs font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Acionado em viagens $\ge$ {expenses.limiteHorasHotel}h ou $\ge$ {expenses.limiteKmHotel} km.</p>
                </div>
              </div>

              {/* Parâmetros Técnicos de Estrada */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-card border border-border/70">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Velocidade Média com Carga (km/h)
                  </Label>
                  <Input
                    type="number"
                    value={expenses.velocidadeMediaKmH}
                    onChange={(e) =>
                      setExpenses({ ...expenses, velocidadeMediaKmH: Number(e.target.value) || 65 })
                    }
                    className="h-8 text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground">Padrão: 60-70 km/h com carretinha tracionada.</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-primary" />
                    Pedágio Médio Estimado por 100 km (R$)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    value={expenses.custoPedagioMedioPor100Km}
                    onChange={(e) =>
                      setExpenses({ ...expenses, custoPedagioMedioPor100Km: Number(e.target.value) || 0 })
                    }
                    className="h-8 text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground">Média das praças de pedágio em MG (ex: BR-040 / BR-135).</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-primary" />
                    Km Mínimo para Pernoite Obrigatório
                  </Label>
                  <Input
                    type="number"
                    value={expenses.limiteKmHotel}
                    onChange={(e) =>
                      setExpenses({ ...expenses, limiteKmHotel: Number(e.target.value) || 500 })
                    }
                    className="h-8 text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground">Acima dessa distância ida+volta, a equipe dorme fora.</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveExpenses}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Salvar Parâmetros de Viagem
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. ABA DE SIMULADOR OPERACIONAL */}
        <TabsContent value="simulador" className="space-y-4 mt-0">
          <Card className="border-border/70">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                Simulação Operacional de Rota & Viagem da Frota
              </CardTitle>
              <CardDescription className="text-xs">
                Simule qualquer trajeto para ver o custo real de combustível, despesas de paradas, capacidade de motos e preço sugerido.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-5">
              {/* Controles de Simulação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-muted/40 border border-border/60">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Carro da Loja</Label>
                  <Select value={simVehicleId} onValueChange={setSimVehicleId}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Selecione o carro" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.nome} ({v.placa})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Configuração de Reboque</Label>
                  <Select value={simTrailerId} onValueChange={setSimTrailerId}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Selecione reboque" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma" className="text-xs">
                        🚗 Apenas Carro (Até 2 motos)
                      </SelectItem>
                      {trailers.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          🚗➕🛵 {t.nome} (Até {2 + t.capacidadeMotos} motos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Distância de Ida (Km)</Label>
                  <Input
                    type="number"
                    value={simDistanciaKm}
                    onChange={(e) => setSimDistanciaKm(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Qtd. Motos a Transportar</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={simQtdMotos}
                    onChange={(e) => setSimQtdMotos(Number(e.target.value) || 1)}
                    className="h-8 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Resultado do Teste da Frota */}
              {tripSim && (
                <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          {tripSim.idaEVolta ? 'Trajeto Completo (Ida e Volta)' : 'Apenas Ida'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {tripSim.tempoViagemFormatado} de estrada
                        </Badge>
                      </div>
                      <h4 className="text-sm font-bold text-foreground">
                        {tripSim.vehicle.nome} + {tripSim.trailer ? tripSim.trailer.nome : 'Sem Carretinha'}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {tripSim.distanciaTotalKm} km totais rodados | Capacidade: até {tripSim.capacidadeMaximaTotal} motos (2 no carro {tripSim.trailer ? `+ ${tripSim.capacidadeCarretinha} na carreta` : ''})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Custo Operacional Total
                      </span>
                      <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-display">
                        {tripSim.formatados.totalOperacional}
                      </span>
                      <span className="text-xs font-bold text-foreground block">
                        {tripSim.formatados.custoPorMoto} / moto ({tripSim.quantidadeMotos} motos)
                      </span>
                    </div>
                  </div>

                  {/* Alerta de Capacidade se Exceder */}
                  {tripSim.capacidadeExcedida && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-xs text-destructive font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Atenção: Você selecionou {tripSim.quantidadeMotos} motos, mas a capacidade máxima deste conjunto é de {tripSim.capacidadeMaximaTotal} motos. Engate uma carretinha maior ou faça 2 viagens.
                    </div>
                  )}

                  {/* Grade de Paradas e Custos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-amber-500" /> Combustível
                      </span>
                      <span className="font-bold text-foreground mt-0.5 block">
                        {tripSim.litrosCombustivelTotal} L ({tripSim.formatados.combustivel})
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Média: {tripSim.consumoMedioKmPorLitro.toFixed(1)} km/L
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                        <Utensils className="w-3 h-3 text-emerald-500" /> Refeições
                      </span>
                      <span className="font-bold text-foreground mt-0.5 block">
                        {tripSim.formatados.refeicoes}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tripSim.paradas.almoco.necessarias ? 'Almoço incluso ' : ''}
                        {tripSim.paradas.janta.necessarias ? '+ Janta' : ''}
                        {!tripSim.paradas.almoco.necessarias && !tripSim.paradas.janta.necessarias ? 'Sem refeição necessária' : ''}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                        <Moon className="w-3 h-3 text-purple-500" /> Parada Dormir / Hotel
                      </span>
                      <span className="font-bold text-foreground mt-0.5 block">
                        {tripSim.formatados.hotel}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tripSim.paradas.hotel.necessarias ? 'Pernoite obrigatório' : 'Retorno no mesmo dia'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-blue-500" /> Manutenção & Pedágio
                      </span>
                      <span className="font-bold text-foreground mt-0.5 block">
                        {tripSim.formatados.manutencaoEPedagio}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Desgaste e taxas de rodovia
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: CADASTRO / EDIÇÃO DE CARRO */}
      <Dialog open={vehicleModalOpen} onOpenChange={setVehicleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              {editingVehicle ? 'Editar Veículo da Frota' : 'Cadastrar Novo Carro da Frota'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure as especificações e médias de consumo do carro para cálculo automático de frete.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Nome de Identificação</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Fiat Strada Freedom 1.3 CS"
                className="h-8 text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Modelo / Versão</Label>
              <Input
                value={formModelo}
                onChange={(e) => setFormModelo(e.target.value)}
                placeholder="Ex: Strada Cabine Simples 1.3"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Placa do Veículo</Label>
              <Input
                value={formPlaca}
                onChange={(e) => setFormPlaca(e.target.value)}
                placeholder="Ex: RVE-4A20"
                className="h-8 text-xs font-mono font-bold uppercase"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo de Combustível</Label>
              <Select value={formCombustivel} onValueChange={(v) => setFormCombustivel(v as FuelType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasolina">Gasolina Comum</SelectItem>
                  <SelectItem value="diesel">Diesel S10</SelectItem>
                  <SelectItem value="etanol">Etanol</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Preço do Litro (R$)</Label>
              <Input
                type="number"
                step="0.05"
                value={formPrecoLitro}
                onChange={(e) => setFormPrecoLitro(Number(e.target.value) || 0)}
                className="h-8 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Consumo Só Carro (km/L)</Label>
              <Input
                type="number"
                step="0.1"
                value={formConsumoSozinho}
                onChange={(e) => setFormConsumoSozinho(Number(e.target.value) || 0)}
                className="h-8 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Consumo C/ Carretinha (km/L)</Label>
              <Input
                type="number"
                step="0.1"
                value={formConsumoCarretinha}
                onChange={(e) => setFormConsumoCarretinha(Number(e.target.value) || 0)}
                className="h-8 text-xs font-bold text-amber-600"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Capacidade de Motos no Carro</Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={formCapacidadeCarro}
                onChange={(e) => setFormCapacidadeCarro(Number(e.target.value) || 2)}
                className="h-8 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Custo Desgaste/Pneus (R$/km)</Label>
              <Input
                type="number"
                step="0.02"
                value={formCustoKm}
                onChange={(e) => setFormCustoKm(Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Filial / Concessionária Responsável</Label>
              <Input
                value={formLojaNome}
                onChange={(e) => setFormLojaNome(e.target.value)}
                placeholder="Ex: Shineray & Multimarcas Divinópolis"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setVehicleModalOpen(false)} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveVehicle} className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              Salvar Veículo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: CADASTRO / EDIÇÃO DE CARRETINHA */}
      <Dialog open={trailerModalOpen} onOpenChange={setTrailerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              {editingTrailer ? 'Editar Carretinha' : 'Cadastrar Carretinha / Reboque'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure a carretinha e sua capacidade adicional de transporte de motos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome / Identificação do Reboque</Label>
              <Input
                value={formTraNome}
                onChange={(e) => setFormTraNome(e.target.value)}
                placeholder="Ex: Carretinha Reboque 3 Motos"
                className="h-8 text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Placa do Reboque</Label>
                <Input
                  value={formTraPlaca}
                  onChange={(e) => setFormTraPlaca(e.target.value)}
                  placeholder="Ex: CAR-3M01"
                  className="h-8 text-xs font-mono font-bold uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Capacidade (Motos)</Label>
                <Select
                  value={String(formTraCapacidade)}
                  onValueChange={(v) => setFormTraCapacidade(Number(v) || 3)}
                >
                  <SelectTrigger className="h-8 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Motos (Média)</SelectItem>
                    <SelectItem value="6">6 Motos (Grande - Trucada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Acréscimo de Consumo do Carro (%)</Label>
              <Input
                type="number"
                value={formTraImpacto}
                onChange={(e) => setFormTraImpacto(Number(e.target.value) || 25)}
                className="h-8 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Descrição / Observações</Label>
              <Input
                value={formTraDesc}
                onChange={(e) => setFormTraDesc(e.target.value)}
                placeholder="Ex: Rampa embutida, amarração reforçada..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setTrailerModalOpen(false)} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveTrailer} className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              Salvar Carretinha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
