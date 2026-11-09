import { useState } from 'react';
import {
  FileCheck,
  Wrench,
  Globe2,
  ShieldCheck,
  Plus,
  Key,
  Trash2,
  SearchCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DossieInvestigacaoPanel } from '@/components/inspections/DossieInvestigacaoPanel';
import { LaudosTabPanel } from '@/components/inspections/LaudosTabPanel';
import { PdiInspectionPanel } from '@/components/inspections/PdiInspectionPanel';
import { OfficialPortalsPanel } from '@/components/inspections/OfficialPortalsPanel';
import { VehicleApiConfigDialog } from '@/components/inspections/VehicleApiConfigDialog';
import { NewInspectionDialog } from '@/components/inspections/NewInspectionDialog';
import { useInspections } from '@/hooks/useInspections';
import { useVehicles } from '@/hooks/useVehicles';
import { useToast } from '@/hooks/use-toast';

export default function Inspections() {
  const [activeTab, setActiveTab] = useState<'investigacao' | 'laudos' | 'pdi' | 'portais'>('investigacao');
  const [apiConfigOpen, setApiConfigOpen] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const { inspections, saveInspection, clearAllInspections } = useInspections();
  const { data: vehicles = [] } = useVehicles();
  const { toast } = useToast();

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <PageHeader
        eyebrow="Due Diligence Jurídica, Cautelar & PDI"
        title="Investigação, Laudos & Procedência Veicular"
        subtitle="Dossiê investigativo de antecedentes, bloqueios judiciais RENAJUD, histórico de leilão/sinistro, vistoria presencial e portais oficiais."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setApiConfigOpen(true)}
              size="sm"
              variant="outline"
              className="h-10 gap-2 font-semibold border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 shadow-sm"
            >
              <Key className="w-4 h-4 text-amber-500" />
              API DETRAN / SENATRAN
            </Button>

            <Button
              onClick={() => setNewDialogOpen(true)}
              size="sm"
              className="h-10 gap-2 font-bold shadow-md shadow-primary/25 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              Nova Vistoria (CRLV-e)
            </Button>
          </div>
        }
      />

      {/* ABAS DO MÓDULO DE INVESTIGAÇÃO & LAUDOS */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-5">
        <TabsList className="h-11 rounded-2xl border bg-muted/40 p-1 shadow-xs flex flex-wrap w-fit gap-1">
          <TabsTrigger
            value="investigacao"
            className="gap-2 text-xs font-bold px-4 rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Dossiê & Investigação Veicular
          </TabsTrigger>

          <TabsTrigger
            value="laudos"
            className="gap-2 text-xs font-bold px-4 rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <FileCheck className="h-4 w-4 text-sky-500" />
            Laudos Cautelares & Seminovos ({inspections.length})
          </TabsTrigger>

          <TabsTrigger
            value="pdi"
            className="gap-2 text-xs font-bold px-4 rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <Wrench className="h-4 w-4 text-indigo-500" />
            Vistoria PDI & Entrada 0km
          </TabsTrigger>

          <TabsTrigger
            value="portais"
            className="gap-2 text-xs font-bold px-4 rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <Globe2 className="h-4 w-4 text-amber-500" />
            Consultas DETRAN & Portais Oficiais
          </TabsTrigger>
        </TabsList>

        {/* ABA 0: DOSSIÊ DE INVESTIGAÇÃO */}
        <TabsContent value="investigacao" className="mt-0">
          <DossieInvestigacaoPanel />
        </TabsContent>

        {/* ABA 1: LAUDOS CAUTELARES E SEMINOVOS */}
        <TabsContent value="laudos" className="mt-0">
          <LaudosTabPanel vehiclesInStock={vehicles} />
        </TabsContent>

        {/* ABA 2: VISTORIA PDI E ENTRADA 0KM */}
        <TabsContent value="pdi" className="mt-0">
          <PdiInspectionPanel />
        </TabsContent>

        {/* ABA 3: PORTAIS OFICIAIS E DETRAN */}
        <TabsContent value="portais" className="mt-0">
          <OfficialPortalsPanel />
        </TabsContent>
      </Tabs>

      {/* MODAL NOVA VISTORIA */}
      <NewInspectionDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSave={async (data) => {
          await saveInspection(data);
          toast({
            title: 'Laudo Cadastrado!',
            description: 'Vistoria registrada com sucesso.',
          });
          setNewDialogOpen(false);
        }}
      />

      {/* MODAL CONFIGURAÇÃO DE API */}
      <VehicleApiConfigDialog
        open={apiConfigOpen}
        onOpenChange={setApiConfigOpen}
      />
    </div>
  );
}
