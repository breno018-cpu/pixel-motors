import { useState } from 'react';
import {
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Search,
  Building2,
  FileText,
  Scale,
  Car,
  Globe2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OFFICIAL_FREE_PORTALS, STATE_DETRANS } from '@/lib/officialLinks';

export function OfficialPortalsPanel() {
  const [selectedUf, setSelectedUf] = useState<string>('MG');

  const currentDetran = STATE_DETRANS[selectedUf] || STATE_DETRANS['MG'];

  return (
    <div className="space-y-6">
      {/* Header Informativo */}
      <Card className="rounded-3xl border shadow-sm bg-gradient-to-r from-card via-card to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold text-xs uppercase px-2.5 py-0.5">
                  Auditoria de Fé Pública
                </Badge>
                <Badge variant="secondary" className="font-semibold text-xs flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Portais Oficiais Gov.br & DETRANs
                </Badge>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                <Globe2 className="w-6 h-6 text-primary" />
                Consultas Oficiais & Débitos Veiculares
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Acesse diretamente as bases de dados públicas oficiais do Governo Federal, DETRANs estaduais, DNIT e PRF. Verifique a existência de multas em rodovias, restrições financeiras (gravames), bloqueios judiciais (RENAJUD) e alertas de furto/roubo antes de precificar qualquer moto de troca.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DETRAN Estadual Interativo */}
      <Card className="rounded-3xl border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Consulta de Débitos no DETRAN Estadual
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione o estado da placa para abrir o portal oficial de licenciamento e multas.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedUf} onValueChange={setSelectedUf}>
                <SelectTrigger className="w-48 h-9 text-xs font-bold rounded-xl border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATE_DETRANS).map(([uf, data]) => (
                    <SelectItem key={uf} value={uf} className="text-xs">
                      {data.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={() => window.open(currentDetran.url, '_blank')}
                className="h-9 gap-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Acessar {selectedUf}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          <div className="p-4 rounded-2xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-sm font-black text-foreground">{currentDetran.name}</h4>
              <p className="text-xs text-muted-foreground">
                Consulte IPVA, taxa de licenciamento anual, multas estaduais e emissão de Certidão Negativa de Débitos.
              </p>
            </div>
            <a
              href={currentDetran.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
            >
              {currentDetran.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Portais Oficiais Federais Gratuitos */}
      <div className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-500" />
          Bases Públicas Oficiais Federais
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {OFFICIAL_FREE_PORTALS.map((portal) => (
            <div
              key={portal.id}
              className="p-5 rounded-3xl border bg-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-3 shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                    {portal.badge}
                  </Badge>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-black text-foreground">{portal.name}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {portal.description}
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(portal.url, '_blank')}
                className="w-full h-9 text-xs font-bold gap-1.5 rounded-xl hover:bg-primary/5 hover:border-primary/40"
              >
                Abrir Portal Oficial
                <ExternalLink className="w-3 h-3 text-primary" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Guia Prático de Blindagem e Prevenção de Fraudes */}
      <Card className="rounded-3xl border border-destructive/20 bg-destructive/5 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <CardTitle className="text-xs font-black uppercase tracking-wider text-destructive">
              POP de Blindagem Jurídica na Entrada de Seminovos
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-2 text-xs space-y-2 text-foreground/80">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border bg-card/60 space-y-1">
              <strong className="text-foreground block">1. Conferência Física de Canote x CRLV-e:</strong>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Nunca emita laudo apenas pela foto da placa. Verifique os 17 caracteres do chassi fisicamente gravados no canote da moto com luz de lanterna para garantir ausência de soldas, amassados ou remarcação.
              </p>
            </div>

            <div className="p-3 rounded-xl border bg-card/60 space-y-1">
              <strong className="text-foreground block">2. Abatimento Pré-Contratual de Débitos:</strong>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Todas as multas e IPVAs detectados devem ser listados no laudo e subtraídos diretamente do valor de avaliação da moto de entrada no contrato de compra e venda.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
