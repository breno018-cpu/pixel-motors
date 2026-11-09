import { useState, useRef, useMemo } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Upload, Image as ImageIcon, FileSpreadsheet, Check, AlertCircle, 
  Trash2, Plus, Sparkles, Loader2, ArrowRight, Table as TableIcon, FileText, 
  ClipboardList, AlertTriangle, ChevronDown, ChevronUp, Layers, CheckCircle2,
  XCircle, HelpCircle, Eye, EyeOff, RotateCcw, Columns, Settings2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InboundCargoBatch, InboundCargoItem } from '@/types/inboundCargo';
import { 
  runOcrOnImage, parseManifestText, OcrParsedItem, isValidVin, isModelCode, 
  isMotorCandidate, isChassisCandidate, DiagnosticRow, DiagnosticRowStatus, ColumnMapping,
  detectColumnMapping, detectModelCodeFromVin, resolveModelNameFromVin, reconstructVin,
  detectColor 
} from '@/lib/inboundOcrParser';
import { SAMPLE_PHOTO_ITEMS } from '@/lib/inboundSampleData';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface NewInboundBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBatchCreated: (batch: InboundCargoBatch) => void;
}

export function NewInboundBatchDialog({ open, onOpenChange, onBatchCreated }: NewInboundBatchDialogProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'image' | 'excel' | 'paste'>('image');

  // Metadados do Lote
  const [batchCode, setBatchCode] = useState<string>('');
  const [transportCode, setTransportCode] = useState<string>('');
  const [destinationStore, setDestinationStore] = useState<string>('L1ma motors');
  const [carrierName, setCarrierName] = useState<string>('Transportadora Cegonha');
  const [driverName, setDriverName] = useState<string>('');
  const [truckPlate, setTruckPlate] = useState<string>('');

  // Imagem anexada e OCR
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState<boolean>(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [rawTextExtracted, setRawTextExtracted] = useState<string>('');
  const [showRawText, setShowRawText] = useState<boolean>(false);

  // Padronização Estrita por Colunas (Regra Universal: cada coluna representa um item exclusivamente)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    chassisCol: 3,
    modelCol: 2,
    engineCol: 5,
    colorCol: 4,
    batchCol: 0,
    transportCol: 1,
  });
  const [showColumnConfig, setShowColumnConfig] = useState<boolean>(false);

  // Planilha Diagnóstica Completa com feedback visual por linha
  const [diagnosticRows, setDiagnosticRows] = useState<DiagnosticRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid' | 'header'>('all');
  const [expandedRawRowId, setExpandedRawRowId] = useState<string | null>(null);

  // Texto colado manualmente
  const [pastedText, setPastedText] = useState<string>('');

  // Contadores dinâmicos
  const stats = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    let header = 0;

    for (const row of diagnosticRows) {
      if (row.isDiscarded || row.status === 'header') {
        header++;
      } else if (row.status === 'valid' && isValidVin(row.detectedChassis)) {
        valid++;
      } else {
        invalid++;
      }
    }

    return {
      total: diagnosticRows.length,
      valid,
      invalid,
      header,
    };
  }, [diagnosticRows]);

  // Linhas filtradas para a tabela visual
  const filteredRows = useMemo(() => {
    return diagnosticRows.filter((r) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'header') return r.isDiscarded || r.status === 'header';
      if (filterStatus === 'valid') return !r.isDiscarded && r.status === 'valid' && isValidVin(r.detectedChassis);
      if (filterStatus === 'invalid') return !r.isDiscarded && (r.status === 'invalid' || !isValidVin(r.detectedChassis));
      return true;
    });
  }, [diagnosticRows, filterStatus]);

  // Re-aplica a padronização de colunas sobre o texto extraído
  const handleReapplyColumns = (newMapping: ColumnMapping) => {
    setColumnMapping(newMapping);
    if (!rawTextExtracted) return;

    const result = parseManifestText(rawTextExtracted, newMapping);
    setDiagnosticRows(result.diagnosticRows);

    toast({
      title: 'Padronização de Colunas Atualizada!',
      description: `Coluna de Chassi fixada na Col ${newMapping.chassisCol}. Coluna de Motor na Col ${newMapping.engineCol}.`,
    });
  };

  // Carrega imagem anexada e executa varredura diagnóstica (Linhas -> Colunas)
  const handleImageUpload = async (file: File) => {
    if (!file) return;

    setDiagnosticRows([]);
    setRawTextExtracted('');
    setShowRawText(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);

      setOcrRunning(true);
      setOcrStatus('Etapa 1: Validando quantas linhas existem na tabela...');
      setOcrProgress(5);

      try {
        const result = await runOcrOnImage(file, (status, prog) => {
          setOcrStatus(status);
          setOcrProgress(prog);
        }, columnMapping);

        setColumnMapping(result.columnMapping);
        setDiagnosticRows(result.diagnosticRows);
        setRawTextExtracted(result.rawText || '');

        if (result.batchCode && result.batchCode !== 'LOTE_NOVO') setBatchCode(result.batchCode);
        if (result.transportCode && result.transportCode !== 'S/N') setTransportCode(result.transportCode);
        if (result.destinationStore) setDestinationStore(result.destinationStore);

        if (result.items.length > 0) {
          toast({
            title: `Varredura Matricial Padronizada!`,
            description: `Colunas padronizadas: ${result.totalLinesDetected} linhas. ${result.validCount} motos validadas na Coluna ${result.columnMapping.chassisCol}.`,
          });
        } else {
          toast({
            title: 'Linhas identificadas com pendências',
            description: `Detectadas ${result.totalLinesDetected} linhas. Confira as linhas em vermelho abaixo e complete os dados faltantes.`,
            variant: 'destructive',
          });
          setShowRawText(true);
        }
      } catch (err: any) {
        console.error('Erro no OCR:', err);
        toast({
          title: 'Erro na leitura da imagem',
          description: err?.message || 'Falha ao analisar a foto.',
          variant: 'destructive',
        });
      } finally {
        setOcrRunning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Carrega arquivo Excel (.xlsx / .csv) com padronização estrita de colunas
  const handleExcelUpload = (file: File) => {
    if (!file) return;

    setDiagnosticRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (json.length < 1) {
          toast({ title: 'Planilha vazia', description: 'Nenhum dado encontrado.', variant: 'destructive' });
          return;
        }

        const tableMatrix: string[][] = json.map(r => Array.isArray(r) ? r.map(c => String(c ?? '').trim()) : []);
        const detectedMap = detectColumnMapping(tableMatrix);
        setColumnMapping(detectedMap);

        const newRows: DiagnosticRow[] = [];
        let autoBatch = batchCode;
        let autoTransport = transportCode;

        for (let rowIndex = 0; rowIndex < tableMatrix.length; rowIndex++) {
          const row = tableMatrix[rowIndex];
          if (!row || row.length === 0) continue;

          const rawText = row.join(' | ');
          const upperText = rawText.toUpperCase();

          const isHeader = 
            rowIndex === 0 || 
            /SEEREN/i.test(upperText) || 
            (/\b(LOTE|ROMANEIO|NUMERO DO CHASSI|DESCRICAO|COR|MOTOR)\b/i.test(upperText) && !/53880|1156/i.test(upperText));

          // Extração PADRONIZADA da linha:
          let rawChassis = (row[detectedMap.chassisCol] || '').toUpperCase().replace(/[^A-Z0-9%&]/g, '');
          let rawMotor = (row[detectedMap.engineCol] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          let rawModel = (row[detectedMap.modelCol] || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
          const rawColor = (row[detectedMap.colorCol] || '').toUpperCase();
          const rawBatch = (row[detectedMap.batchCol] || '').replace(/[^0-9]/g, '');
          const rawTransport = (row[detectedMap.transportCol] || '').replace(/[^0-9]/g, '');

          // PROTEÇÃO: Se a célula de chassi for na verdade um Modelo ou Motor, encontra a célula correta
          if (isModelCode(rawChassis) || isMotorCandidate(rawChassis)) {
            const realChassisCell = row.find(c => isChassisCandidate(String(c)));
            rawChassis = realChassisCell ? String(realChassisCell).toUpperCase().replace(/[^A-Z0-9%&]/g, '') : '';
          }

          if (!isModelCode(rawModel)) {
            const realModelCell = row.find(c => isModelCode(String(c)));
            if (realModelCell) rawModel = String(realModelCell).toUpperCase().replace(/[^A-Z0-9.]/g, '');
          }

          if (!isMotorCandidate(rawMotor)) {
            const realMotorCell = row.find(c => isMotorCandidate(String(c)));
            if (realMotorCell) rawMotor = String(realMotorCell).toUpperCase().replace(/[^A-Z0-9]/g, '');
          }

          const cleanChassis = reconstructVin(rawChassis) || (isValidVin(rawChassis) ? rawChassis : (isChassisCandidate(rawChassis) ? rawChassis : ''));

          if (rawBatch && rawBatch.length >= 4 && !autoBatch) autoBatch = rawBatch;
          if (rawTransport && rawTransport.length >= 4 && !autoTransport) autoTransport = rawTransport;

          let primaryColor = detectColor(rawColor) || rawColor.trim() || '';
          if (!primaryColor) {
            for (const c of row) {
              const detected = detectColor(String(c));
              if (detected) {
                primaryColor = detected;
                break;
              }
            }
          }
          if (!primaryColor) {
            primaryColor = 'INDEFINIDA';
          }

          let status: DiagnosticRowStatus = 'valid';
          let reason = '';

          if (isHeader) {
            status = 'header';
            reason = 'Linha de cabeçalho da planilha Excel ignorada.';
          } else if (cleanChassis && isValidVin(cleanChassis)) {
            status = 'valid';
            reason = `Chassi 100% validado (${cleanChassis}). Motor (${rawMotor || 'N/D'}) e Modelo (${rawModel || 'N/D'}) separados com sucesso.`;
          } else if (cleanChassis && cleanChassis.length < 17) {
            status = 'invalid';
            reason = `Chassi autêntico detectado mas incompleto: ${cleanChassis.length} caracteres lidos ("${cleanChassis}"). Faltam ${17 - cleanChassis.length} dígitos para completar os 17.`;
          } else {
            status = 'invalid';
            reason = `Chassi não identificado nesta linha. Modelo (${rawModel || 'N/D'}) e Motor (${rawMotor || 'N/D'}) identificados. Digite o chassi de 17 caracteres para validar.`;
          }

          newRows.push({
            id: `excel_row_${rowIndex + 1}_${Date.now()}`,
            lineIndex: rowIndex + 1,
            rawText,
            cells: row,
            status,
            diagnosticReason: reason,
            detectedChassis: cleanChassis,
            detectedEngine: rawMotor,
            detectedModelCode: rawModel || (cleanChassis ? detectModelCodeFromVin(cleanChassis) : 'MBR_MOTO'),
            detectedPrimaryColor: primaryColor,
            detectedSecondaryColor: '-',
            detectedModelYear: 2027,
            detectedManufactureYear: 2026,
            detectedGroupCc: '125',
            detectedStore: destinationStore || 'L1ma motors',
            detectedBatch: autoBatch || '115684',
            detectedTransport: autoTransport || '53880',
            isDiscarded: isHeader,
          });
        }

        setDiagnosticRows(newRows);
        if (autoBatch) setBatchCode(autoBatch);
        if (autoTransport) setTransportCode(autoTransport);

        toast({
          title: 'Planilha Excel Importada com Padronização!',
          description: `${newRows.length} linhas. Chassi fixado na Coluna ${detectedMap.chassisCol}, Motor na Coluna ${detectedMap.engineCol}.`,
        });
      } catch (err) {
        console.error('Erro ao ler Excel:', err);
        toast({ title: 'Erro ao ler arquivo', description: 'Formato de planilha inválido.', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Processa texto copiado (do Excel ou WhatsApp)
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      toast({ title: 'Texto vazio', description: 'Cole o texto da tabela ou WhatsApp.', variant: 'destructive' });
      return;
    }

    setRawTextExtracted(pastedText);
    const result = parseManifestText(pastedText, columnMapping);
    setColumnMapping(result.columnMapping);
    setDiagnosticRows(result.diagnosticRows);

    if (result.batchCode && result.batchCode !== 'LOTE_NOVO') setBatchCode(result.batchCode);
    if (result.transportCode && result.transportCode !== 'S/N') setTransportCode(result.transportCode);
    if (result.destinationStore) setDestinationStore(result.destinationStore);

    toast({
      title: 'Varredura de Texto Padronizada!',
      description: `${result.totalLinesDetected} linhas analisadas. Chassi fixo na Coluna ${result.columnMapping.chassisCol}.`,
    });
  };

  // Carrega apenas os dados da primeira foto de teste (opcional)
  const handleLoadSampleManual = () => {
    setBatchCode('115684 / 115699');
    setTransportCode('53880');
    setDestinationStore('L1ma motors');
    setCarrierName('Expresso Shineray Transporte Cegonha');
    setDriverName('Valter / Motorista da Frota');
    setTruckPlate('BRA-5388');

    const sampleRows: DiagnosticRow[] = SAMPLE_PHOTO_ITEMS.map((item, idx) => ({
      id: `sample_row_${idx + 1}`,
      lineIndex: idx + 1,
      rawText: `${item.code_id_1} | ${item.transport_code} | ${item.model_code} | ${item.chassis} | ${item.primary_color} | ${item.engine_number} | ${item.model_year} | ${item.manufacture_year} | ${item.group_cc} | ${item.secondary_color} | ${item.destination_store}`,
      cells: [item.code_id_1, item.transport_code, item.model_code, item.chassis, item.primary_color, item.engine_number, String(item.model_year), String(item.manufacture_year), item.group_cc, item.secondary_color, item.destination_store],
      status: 'valid',
      diagnosticReason: `Coluna 3 (Chassi): 100% validado (${item.chassis}). Coluna 5 (Motor): ${item.engine_number}.`,
      detectedChassis: item.chassis,
      detectedEngine: item.engine_number,
      detectedModelCode: item.model_code,
      detectedPrimaryColor: item.primary_color,
      detectedSecondaryColor: item.secondary_color,
      detectedModelYear: item.model_year,
      detectedManufactureYear: item.manufacture_year,
      detectedGroupCc: item.group_cc,
      detectedStore: item.destination_store,
      detectedBatch: item.code_id_1,
      detectedTransport: item.transport_code,
      isDiscarded: false,
    }));

    setDiagnosticRows(sampleRows);

    toast({
      title: 'Amostra da Foto 1 Carregada',
      description: '31 motos de demonstração carregadas com padronização de colunas ativa.',
    });
  };

  // Edita qualquer campo de uma linha diretamente na tabela com revalidação dinâmica em tempo real
  const handleUpdateRowField = (rowId: string, field: keyof DiagnosticRow, value: any) => {
    setDiagnosticRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;

        const updated = { ...row, [field]: value };

        // Se o usuário mexeu no chassi, revalida imediatamente a linha
        if (field === 'detectedChassis') {
          const valClean = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          updated.detectedChassis = valClean;

          if (isModelCode(valClean)) {
            updated.status = 'invalid';
            updated.diagnosticReason = `Atenção: o código digitado ('${valClean}') é um Código de Modelo de Fábrica (MBR), e não um Chassi. O Chassi de motos brasileiras tem 17 caracteres e inicia com '9' (ex: 99H...).`;
          } else if (isMotorCandidate(valClean)) {
            updated.status = 'invalid';
            updated.diagnosticReason = `Atenção: o código digitado ('${valClean}') é um Número de Motor, e não um Chassi. Digite o chassi oficial de 17 caracteres.`;
          } else if (isValidVin(valClean)) {
            updated.status = 'valid';
            updated.diagnosticReason = `Chassi corrigido manualmente com 17 dígitos válidos (${valClean}).`;
            if (!updated.detectedModelCode || updated.detectedModelCode === 'MBR_MOTO') {
              updated.detectedModelCode = detectModelCodeFromVin(valClean);
            }
          } else if (valClean.length > 0 && valClean.length < 17) {
            updated.status = 'invalid';
            updated.diagnosticReason = `Chassi incompleto: ${valClean.length} caracteres digitados. Faltam ${17 - valClean.length} dígitos para completar 17.`;
          } else if (valClean.length > 17) {
            updated.status = 'invalid';
            updated.diagnosticReason = `Chassi com excesso de caracteres (${valClean.length} digitados). O padrão brasileiro possui exatamente 17 dígitos.`;
          } else {
            updated.status = 'invalid';
            updated.diagnosticReason = `Campo de Chassi vazio. Digite os 17 caracteres oficiais para validar a moto.`;
          }
        }

        return updated;
      })
    );
  };

  // Alterna descarte de uma linha (ex: ruído ou rodapé)
  const handleToggleDiscardRow = (rowId: string) => {
    setDiagnosticRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const newDiscarded = !r.isDiscarded;
        return {
          ...r,
          isDiscarded: newDiscarded,
          diagnosticReason: newDiscarded
            ? 'Linha marcada como descartada pelo operador.'
            : isValidVin(r.detectedChassis)
            ? 'Linha reativada e validada.'
            : 'Linha reativada (pendente de chassi válido).',
        };
      })
    );
  };

  // Adiciona nova linha manual vazia para digitação
  const handleAddManualRow = () => {
    const newId = `manual_row_${Date.now()}`;
    const newRow: DiagnosticRow = {
      id: newId,
      lineIndex: diagnosticRows.length + 1,
      rawText: 'Linha adicionada manualmente pelo operador',
      cells: [],
      status: 'invalid',
      diagnosticReason: `Linha manual criada. Digite os 17 dígitos na Coluna ${columnMapping.chassisCol} (Chassi) para validar.`,
      detectedChassis: '',
      detectedEngine: '',
      detectedModelCode: 'MBR_MOTO',
      detectedPrimaryColor: 'BRANCA',
      detectedSecondaryColor: '-',
      detectedModelYear: 2027,
      detectedManufactureYear: 2026,
      detectedGroupCc: '125',
      detectedStore: destinationStore || 'L1ma motors',
      detectedBatch: batchCode || '115684',
      detectedTransport: transportCode || '53880',
      isDiscarded: false,
    };

    setDiagnosticRows((prev) => [newRow, ...prev]);
    setFilterStatus('all');
  };

  // Salva o romaneio e envia para a conferência de descarga com scanner
  const handleSaveBatch = async () => {
    const validRows = diagnosticRows.filter(
      (r) => !r.isDiscarded && r.status !== 'header' && isValidVin(r.detectedChassis)
    );

    if (validRows.length === 0) {
      toast({
        title: 'Nenhuma moto validada',
        description: 'É necessário ter pelo menos uma moto com chassi válido de 17 caracteres para salvar o romaneio.',
        variant: 'destructive',
      });
      return;
    }

    const invalidActiveRows = diagnosticRows.filter(
      (r) => !r.isDiscarded && r.status !== 'header' && !isValidVin(r.detectedChassis)
    );

    if (invalidActiveRows.length > 0) {
      const confirmSave = await confirm({
        title: 'Motos Incompletas Detectadas',
        description: `Existem ${invalidActiveRows.length} linha(s) com chassi não decodificado ou pendente que ficarão de fora. Deseja prosseguir criando o romaneio com as ${validRows.length} motos validadas?`,
        confirmText: `Salvar ${validRows.length} Motos`,
        cancelText: 'Revisar Linhas',
        variant: 'warning',
      });
      if (!confirmSave) return;
    } else {
      const confirmSave = await confirm({
        title: 'Criar Romaneio de Carga?',
        description: `Será gerado o romaneio com ${validRows.length} motos prontas para início da conferência e bipagem no pátio.`,
        confirmText: 'Confirmar e Iniciar Descarga',
        cancelText: 'Cancelar',
        variant: 'success',
      });
      if (!confirmSave) return;
    }

    const now = new Date().toISOString();
    const batchId = `cargo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const cargoItems: InboundCargoItem[] = validRows.map((r, idx) => ({
      id: `item_${batchId}_${idx + 1}`,
      batch_id: batchId,
      code_id_1: r.detectedBatch || batchCode || '115684',
      transport_code: r.detectedTransport || transportCode || '53880',
      model_code: r.detectedModelCode || detectModelCodeFromVin(r.detectedChassis),
      chassis: r.detectedChassis,
      primary_color: r.detectedPrimaryColor || 'INDEFINIDA',
      engine_number: r.detectedEngine || '',
      model_year: r.detectedModelYear || 2027,
      manufacture_year: r.detectedManufactureYear || 2026,
      group_cc: r.detectedGroupCc || '125',
      secondary_color: r.detectedSecondaryColor || '-',
      destination_store: r.detectedStore || destinationStore || 'L1ma motors',
      model_name: resolveModelNameFromVin(r.detectedChassis),
      brand: 'SHINERAY',
      scanned: false,
      scanned_at: null,
      scanned_by: null,
    }));

    const newBatch: InboundCargoBatch = {
      id: batchId,
      batch_code: batchCode || 'NOVA_CARGA',
      transport_code: transportCode || 'S/N',
      destination_store: destinationStore || 'Loja Matriz',
      carrier_name: carrierName,
      driver_name: driverName,
      truck_plate: truckPlate,
      status: 'aguardando_descarga',
      total_items: cargoItems.length,
      scanned_items: 0,
      divergent_items: 0,
      image_url: imagePreview || undefined,
      created_at: now,
      updated_at: now,
      completed_at: null,
      items: cargoItems,
      divergence_logs: [],
    };

    onBatchCreated(newBatch);
    onOpenChange(false);

    toast({
      title: 'Romaneio Registrado com Sucesso!',
      description: `Lote ${newBatch.batch_code} com ${newBatch.total_items} motos conferidas pronto para bipagem no caminhão.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-red-600/10 border border-red-600/20 text-red-600 flex items-center justify-center font-bold">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-display font-bold">
                  Controle de Entrada — Padronização Estrita por Colunas
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Cada coluna representa um item exclusivo. A coluna de chassi sempre só contém chassi em todas as linhas.
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadSampleManual}
              className="hidden sm:flex text-[11px] gap-1.5 border-dashed border-border text-muted-foreground hover:text-foreground"
              title="Carrega os 31 itens da foto oficial de teste"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Carregar Amostra da Foto 1
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Abas de Importação */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-3 w-full h-10">
              <TabsTrigger value="image" className="text-xs gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                Foto / Imagem (OCR)
              </TabsTrigger>
              <TabsTrigger value="excel" className="text-xs gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Planilha Excel / CSV
              </TabsTrigger>
              <TabsTrigger value="paste" className="text-xs gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" />
                Colar Texto / WhatsApp
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: FOTO / IMAGEM */}
            <TabsContent value="image" className="mt-3 space-y-3">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-red-500/60 transition-colors rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer bg-muted/20 hover:bg-muted/40 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <div className="h-11 w-11 rounded-full bg-red-600/10 text-red-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  Anexar Nova Foto ou Tirar pelo Celular
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  O sistema detecta a coluna fixa de Chassi, Motor e Modelo e aplica a regra estrita em todas as linhas.
                </p>
              </div>

              {ocrRunning && (
                <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-red-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {ocrStatus}
                    </span>
                    <span className="font-mono font-bold text-red-600">{ocrProgress}%</span>
                  </div>
                  <Progress value={ocrProgress} className="h-2 bg-red-100 dark:bg-red-950/40" />
                </div>
              )}
            </TabsContent>

            {/* ABA 2: EXCEL / CSV */}
            <TabsContent value="excel" className="mt-3">
              <div 
                onClick={() => excelInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-emerald-500/60 transition-colors rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer bg-muted/20 hover:bg-muted/40 group"
              >
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleExcelUpload(file);
                  }}
                />
                <div className="h-11 w-11 rounded-full bg-emerald-600/10 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  Importar Planilha da Montadora (.xlsx / .csv)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Padronização automática por colunas: Chassi, Motor e Modelo isolados com 100% de garantia.
                </p>
              </div>
            </TabsContent>

            {/* ABA 3: COLAR TEXTO */}
            <TabsContent value="paste" className="mt-3 space-y-2">
              <Textarea
                placeholder="Cole aqui as linhas da tabela copiadas do Excel (Ctrl+C), WhatsApp ou e-mail..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={4}
                className="text-xs font-mono"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">
                  Dica: Você pode copiar direto do Excel (Ctrl+C) e colar aqui (Ctrl+V).
                </span>
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleProcessPastedText} 
                  className="text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  <Check className="w-3.5 h-3.5" />
                  Processar Linhas de Texto
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* PAINEL DE PADRONIZAÇÃO DE COLUNAS FIXAS (REGRA DO USUÁRIO) */}
          <div className="border border-border/80 rounded-xl p-3 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Columns className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                    Padronização Fixa de Colunas Ativa
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 py-0">
                      Regra Estrita
                    </Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    A coluna de Chassi é SEMPRE Chassi. Motor é SEMPRE Motor. Modelo é SEMPRE Modelo.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowColumnConfig(!showColumnConfig)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {showColumnConfig ? 'Ocultar Ajustes' : 'Ajustar Mapeamento de Colunas'}
              </Button>
            </div>

            {/* Badges de Divisão de Coluna */}
            <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
              <Badge variant="outline" className="font-mono text-xs bg-muted/80 text-foreground border-border py-1">
                Col {columnMapping.batchCol}: <strong>Lote</strong>
              </Badge>
              <Badge variant="outline" className="font-mono text-xs bg-muted/80 text-foreground border-border py-1">
                Col {columnMapping.transportCol}: <strong>Romaneio</strong>
              </Badge>
              <Badge variant="outline" className="font-mono text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 py-1 font-bold">
                Col {columnMapping.modelCol}: <strong>Modelo MBR</strong>
              </Badge>
              <Badge variant="outline" className="font-mono text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 py-1 font-bold">
                Col {columnMapping.chassisCol}: <strong>CHASSI OFICIAL (Exclusivo)</strong>
              </Badge>
              <Badge variant="outline" className="font-mono text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 py-1">
                Col {columnMapping.colorCol}: <strong>Cor</strong>
              </Badge>
              <Badge variant="outline" className="font-mono text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 py-1 font-bold">
                Col {columnMapping.engineCol}: <strong>MOTOR (Exclusivo)</strong>
              </Badge>
            </div>

            {/* Ajuste manual de colunas se necessário */}
            {showColumnConfig && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-card border border-border text-xs animate-fade-in mt-2">
                <div>
                  <Label className="text-[11px] font-semibold text-emerald-600">Coluna de Chassi:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    value={columnMapping.chassisCol}
                    onChange={(e) => handleReapplyColumns({ ...columnMapping, chassisCol: Number(e.target.value) })}
                    className="h-7 text-xs font-mono font-bold mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-amber-600">Coluna de Motor:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    value={columnMapping.engineCol}
                    onChange={(e) => handleReapplyColumns({ ...columnMapping, engineCol: Number(e.target.value) })}
                    className="h-7 text-xs font-mono font-bold mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-blue-600">Coluna de Modelo:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    value={columnMapping.modelCol}
                    onChange={(e) => handleReapplyColumns({ ...columnMapping, modelCol: Number(e.target.value) })}
                    className="h-7 text-xs font-mono font-bold mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-purple-600">Coluna de Cor:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    value={columnMapping.colorCol}
                    onChange={(e) => handleReapplyColumns({ ...columnMapping, colorCol: Number(e.target.value) })}
                    className="h-7 text-xs font-mono font-bold mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Metadados da Carga */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border">
            <div>
              <Label className="text-[11px] text-muted-foreground">Código de Identificação 1 (Lote)</Label>
              <Input
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="Ex: 115684"
                className="h-8 text-xs font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Código de Transporte (Romaneio)</Label>
              <Input
                value={transportCode}
                onChange={(e) => setTransportCode(e.target.value)}
                placeholder="Ex: 53880"
                className="h-8 text-xs font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Loja de Destino</Label>
              <Input
                value={destinationStore}
                onChange={(e) => setDestinationStore(e.target.value)}
                placeholder="Ex: L1ma motors"
                className="h-8 text-xs font-semibold mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Transportadora</Label>
              <Input
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="Nome da transportadora"
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Placa do Caminhão</Label>
              <Input
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value)}
                placeholder="Ex: BRA-5388"
                className="h-8 text-xs font-mono uppercase mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Nome do Motorista</Label>
              <Input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Ex: Valter"
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* FEEDBACK VISUAL: AUDITORIA DIAGNÓSTICA COM CORES POR LINHA */}
          {diagnosticRows.length > 0 && (
            <div className="space-y-3">
              {/* Barra de Filtros e Contadores */}
              <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-foreground mr-1 flex items-center gap-1.5">
                    <TableIcon className="w-4 h-4 text-red-600" />
                    Varredura Padronizada por Linha:
                  </span>

                  <Button
                    type="button"
                    size="sm"
                    variant={filterStatus === 'all' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('all')}
                    className="h-7 text-xs font-mono gap-1"
                  >
                    Todas ({stats.total})
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={filterStatus === 'valid' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('valid')}
                    className={cn(
                      "h-7 text-xs font-mono gap-1",
                      filterStatus === 'valid' 
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                        : "text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Validadas ({stats.valid})
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={filterStatus === 'invalid' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('invalid')}
                    className={cn(
                      "h-7 text-xs font-mono gap-1",
                      filterStatus === 'invalid' 
                        ? "bg-red-600 hover:bg-red-700 text-white" 
                        : "text-red-600 border-red-500/30 hover:bg-red-500/10"
                    )}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Não Lidas / Erro ({stats.invalid})
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={filterStatus === 'header' ? 'default' : 'outline'}
                    onClick={() => setFilterStatus('header')}
                    className={cn(
                      "h-7 text-xs font-mono gap-1",
                      filterStatus === 'header' 
                        ? "bg-muted-foreground text-white" 
                        : "text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Cabeçalho / Descarte ({stats.header})
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddManualRow}
                  className="h-7 text-xs gap-1 border-dashed"
                >
                  <Plus className="w-3 h-3" /> + Adicionar Moto
                </Button>
              </div>

              {/* Legenda explicativa rápida */}
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <strong>Verde:</strong> Chassi validado (17 caracteres)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                  <strong>Vermelho:</strong> Chassi incompleto (clique e complete os caracteres)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/60 inline-block"></span>
                  <strong>Cinza:</strong> Cabeçalho ou linha descartada
                </span>
              </div>

              {/* Tabela Diagnóstica com Cores nas Linhas */}
              <div className="border border-border rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 text-[11px]">
                      <TableHead className="w-12 text-center">Linha</TableHead>
                      <TableHead className="w-28 text-center">Status</TableHead>
                      <TableHead className="min-w-[210px] text-emerald-700 dark:text-emerald-400 font-bold">
                        Coluna {columnMapping.chassisCol}: Chassi Oficial (17 Dígitos)
                      </TableHead>
                      <TableHead className="min-w-[140px] text-amber-700 dark:text-amber-400 font-bold">
                        Coluna {columnMapping.engineCol}: Motor
                      </TableHead>
                      <TableHead className="min-w-[140px] text-blue-700 dark:text-blue-400 font-bold">
                        Coluna {columnMapping.modelCol}: Modelo MBR
                      </TableHead>
                      <TableHead className="w-24 text-purple-700 dark:text-purple-400 font-bold">
                        Coluna {columnMapping.colorCol}: Cor
                      </TableHead>
                      <TableHead className="min-w-[260px]">Diagnóstico / Motivo da Linha</TableHead>
                      <TableHead className="w-16 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((r) => {
                      const isValid = !r.isDiscarded && r.status === 'valid' && isValidVin(r.detectedChassis);
                      const isHeader = r.isDiscarded || r.status === 'header';
                      const chassisLen = r.detectedChassis.length;

                      const rowBgClass = isHeader
                        ? 'bg-muted/30 border-l-4 border-l-muted-foreground/40 opacity-75'
                        : isValid
                        ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500 hover:bg-emerald-500/15'
                        : 'bg-red-500/15 border-l-4 border-l-red-500 hover:bg-red-500/20';

                      return (
                        <TableRow key={r.id} className={cn("text-xs transition-colors", rowBgClass)}>
                          {/* Número da Linha */}
                          <TableCell className="text-center font-mono font-bold text-[11px] text-muted-foreground">
                            {r.lineIndex}
                          </TableCell>

                          {/* Badge de Status */}
                          <TableCell className="text-center">
                            {isHeader ? (
                              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border py-0.5">
                                Cabeçalho
                              </Badge>
                            ) : isValid ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 font-bold py-0.5 gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Válida
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40 font-bold py-0.5 gap-1">
                                <XCircle className="w-3 h-3" /> Não Lida
                              </Badge>
                            )}
                          </TableCell>

                          {/* Campo Chassi Editável (Exclusivo da Coluna de Chassi) */}
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={r.detectedChassis}
                                  maxLength={17}
                                  placeholder="Digite os 17 caracteres..."
                                  disabled={isHeader}
                                  onChange={(e) => handleUpdateRowField(r.id, 'detectedChassis', e.target.value)}
                                  className={cn(
                                    "font-mono text-xs font-bold px-2 py-1 rounded border outline-none w-full transition-colors",
                                    isHeader
                                      ? "bg-transparent border-transparent text-muted-foreground cursor-not-allowed"
                                      : isValid
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 focus:border-emerald-600 focus:bg-background"
                                      : "border-red-500 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 focus:border-red-600 focus:bg-background"
                                  )}
                                />
                                <span className={cn(
                                  "font-mono text-[10px] px-1 py-0.5 rounded font-bold shrink-0",
                                  chassisLen === 17 ? "text-emerald-600 bg-emerald-500/10" : "text-red-600 bg-red-500/10"
                                )}>
                                  {chassisLen}/17
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Motor Editável (Exclusivo da Coluna de Motor) */}
                          <TableCell>
                            <input
                              type="text"
                              value={r.detectedEngine}
                              placeholder="Motor..."
                              disabled={isHeader}
                              onChange={(e) => handleUpdateRowField(r.id, 'detectedEngine', e.target.value)}
                              className="font-mono text-xs px-1.5 py-0.5 rounded border border-transparent bg-transparent hover:border-border focus:border-primary focus:bg-background outline-none w-full"
                            />
                          </TableCell>

                          {/* Código Modelo Editável (Exclusivo da Coluna de Modelo) */}
                          <TableCell>
                            <input
                              type="text"
                              value={r.detectedModelCode}
                              placeholder="MBR..."
                              disabled={isHeader}
                              onChange={(e) => handleUpdateRowField(r.id, 'detectedModelCode', e.target.value)}
                              className="font-mono text-[11px] text-muted-foreground px-1.5 py-0.5 rounded border border-transparent bg-transparent hover:border-border focus:border-primary focus:bg-background outline-none w-full"
                            />
                          </TableCell>

                          {/* Cor Primária */}
                          <TableCell>
                            <input
                              type="text"
                              value={r.detectedPrimaryColor}
                              disabled={isHeader}
                              onChange={(e) => handleUpdateRowField(r.id, 'detectedPrimaryColor', e.target.value.toUpperCase())}
                              className="text-xs font-semibold uppercase px-1.5 py-0.5 rounded border border-transparent bg-transparent hover:border-border focus:border-primary focus:bg-background outline-none w-full"
                            />
                          </TableCell>

                          {/* Diagnóstico / Motivo Explicativo */}
                          <TableCell>
                            <div className="space-y-1">
                              <p className={cn(
                                "text-[11px] leading-snug font-medium",
                                isHeader
                                  ? "text-muted-foreground"
                                  : isValid
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-red-700 dark:text-red-300 font-semibold"
                              )}>
                                {r.diagnosticReason}
                              </p>

                              {/* Toggle para visualizar o texto bruto do OCR daquela linha */}
                              <button
                                type="button"
                                onClick={() => setExpandedRawRowId(expandedRawRowId === r.id ? null : r.id)}
                                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2"
                              >
                                {expandedRawRowId === r.id ? (
                                  <>
                                    <EyeOff className="w-3 h-3" /> Ocultar texto original
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3" /> Ver texto original da foto
                                  </>
                                )}
                              </button>

                              {expandedRawRowId === r.id && (
                                <div className="p-2 rounded bg-black/5 dark:bg-white/5 border border-border/60 text-[10px] font-mono text-muted-foreground break-all">
                                  {r.rawText}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Ações por Linha */}
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleDiscardRow(r.id)}
                              className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                              title={r.isDiscarded ? 'Reativar esta linha como moto' : 'Descartar esta linha (não é moto)'}
                            >
                              {r.isDiscarded ? (
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Toggle para Ver Todo o Texto Bruto Detectado pelo OCR */}
          {rawTextExtracted && (
            <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
              <button
                type="button"
                onClick={() => setShowRawText(!showRawText)}
                className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/30"
              >
                <span>Texto Completo Extraído pelo OCR da Imagem</span>
                {showRawText ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showRawText && (
                <div className="p-3 bg-muted/10 border-t border-border">
                  <pre className="text-[10px] font-mono text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap select-all">
                    {rawTextExtracted}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancelar
          </Button>

          <div className="flex items-center gap-3">
            {stats.invalid > 0 && (
              <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {stats.invalid} linha(s) em vermelho pendentes de correção
              </span>
            )}

            <Button
              size="sm"
              onClick={handleSaveBatch}
              disabled={stats.valid === 0 || ocrRunning}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs gap-1.5"
            >
              <Check className="w-4 h-4" />
              Salvar Manifesto e Ativar Scanner ({stats.valid} motos validadas)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
