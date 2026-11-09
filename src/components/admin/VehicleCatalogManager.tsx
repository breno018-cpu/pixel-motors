import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bike } from 'lucide-react';
import { UnifiedVehicleCatalog } from './UnifiedVehicleCatalog';
import { ChassisYearCodeManager } from './ChassisYearCodeManager';
import { ColorCatalogManager } from './ColorCatalogManager';

/** Catálogo único de veículos: modelos oficiais, preços, promoções e padrões de chassi em uma única área unificada. */
export function VehicleCatalogManager() {
  return (
    <Card className="card-interactive">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Bike className="w-4 h-4 text-primary" />
          CATÁLOGO DE VEÍCULOS
        </CardTitle>
        <CardDescription className="text-sm">
          Modelos oficiais e padrões de chassi em um só lugar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="catalogo-unificado" className="space-y-4">
          <TabsList>
            <TabsTrigger value="catalogo-unificado">Modelos, Preços e Chassi (VIN)</TabsTrigger>
            <TabsTrigger value="ano">Ano/Modelo (VIN 10ª/11ª)</TabsTrigger>
            <TabsTrigger value="cores">Cores</TabsTrigger>
          </TabsList>
          <TabsContent value="catalogo-unificado" className="mt-0">
            <UnifiedVehicleCatalog />
          </TabsContent>
          <TabsContent value="ano" className="mt-0">
            <ChassisYearCodeManager />
          </TabsContent>
          <TabsContent value="cores" className="mt-0">
            <ColorCatalogManager />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
