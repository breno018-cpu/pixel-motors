import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SHEETS_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function gwHeaders() {
  return {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': SHEETS_KEY,
    'Content-Type': 'application/json',
  };
}

function sanitizeSpreadsheetId(raw: string): string {
  const s = (raw || '').trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  return s.split(/[/?#]/)[0];
}

async function gwFetch(path: string, init: RequestInit = {}) {
  const r = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gwHeaders(), ...(init.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Sheets ${r.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function ensureSheet(spreadsheetId: string, sheetName: string): Promise<number> {
  const meta = await gwFetch(`/spreadsheets/${spreadsheetId}?fields=sheets.properties`);
  const found = (meta.sheets || []).find((s: any) => s.properties?.title === sheetName);
  if (found) return found.properties.sheetId as number;
  const res = await gwFetch(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: sheetName, gridProperties: { rowCount: 2000, columnCount: 12 } } } }],
    }),
  });
  return res.replies[0].addSheet.properties.sheetId as number;
}

const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
};

function buildSections(vehicles: any[]) {
  // Only available + reserved
  const stock = vehicles.filter((v) => v.status === 'disponivel' || v.status === 'reservado');

  // Totals
  const totalDisp = stock.filter((v) => v.status === 'disponivel').length;
  const totalRes = stock.filter((v) => v.status === 'reservado').length;
  const total = stock.length;

  // By model
  const byModel = new Map<string, { disp: number; res: number }>();
  // By model + color
  const byModelColor = new Map<string, { model: string; color: string; disp: number; res: number }>();

  for (const v of stock) {
    const model = `${v.brand || ''} ${v.model || ''}`.trim() || '—';
    const color = v.color || '—';
    const m = byModel.get(model) || { disp: 0, res: 0 };
    if (v.status === 'disponivel') m.disp++; else m.res++;
    byModel.set(model, m);

    const mcKey = `${model}||${color}`;
    const mc = byModelColor.get(mcKey) || { model, color, disp: 0, res: 0 };
    if (v.status === 'disponivel') mc.disp++; else mc.res++;
    byModelColor.set(mcKey, mc);
  }

  // Detailed
  const detail = stock
    .slice()
    .sort((a, b) => (a.brand || '').localeCompare(b.brand || '') || (a.model || '').localeCompare(b.model || ''))
    .map((v) => [
      v.chassis || '',
      `${v.brand || ''} ${v.model || ''}`.trim(),
      v.year ?? '',
      v.color || '',
      v.plate || '',
      STATUS_LABEL[v.status] || v.status,
      v.sale_price != null ? Number(v.sale_price) : '',
    ]);

  return {
    totals: { total, disp: totalDisp, res: totalRes },
    byModel: Array.from(byModel.entries()).map(([m, c]) => [m, c.disp, c.res, c.disp + c.res])
      .sort((a: any, b: any) => (b[3] as number) - (a[3] as number)),
    byModelColor: Array.from(byModelColor.values())
      .map((m) => [m.model, m.color, m.disp, m.res, m.disp + m.res])
      .sort((a: any, b: any) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))),
    detail,
  };
}

// Color helpers
const C = (r: number, g: number, b: number) => ({ red: r / 255, green: g / 255, blue: b / 255 });
const HEADER_BG = C(30, 41, 59); // slate-800
const HEADER_FG = C(255, 255, 255);
const TITLE_BG = C(15, 118, 110); // teal-700
const SUB_BG = C(241, 245, 249); // slate-100
const ZEBRA_BG = C(248, 250, 252); // slate-50
const DISP_BG = C(220, 252, 231); // green-100
const RES_BG = C(254, 243, 199); // amber-100

async function pushPretty(supa: any, spreadsheetId: string, sheetName: string) {
  const sheetId = await ensureSheet(spreadsheetId, sheetName);

  const { data: vehicles, error } = await supa.from('vehicles').select('*');
  if (error) throw error;

  const sec = buildSections(vehicles || []);
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // Build values row by row
  const values: any[][] = [];
  const merges: Array<{ startRow: number; endRow: number; startCol: number; endCol: number }> = [];
  const titleRows: number[] = [];
  const headerRows: number[] = [];
  const statusCells: Array<{ row: number; col: number; status: string }> = [];

  // Row 0: Title
  values.push(['ESTOQUE DE VEÍCULOS', '', '', '', '', '', '']);
  merges.push({ startRow: 0, endRow: 1, startCol: 0, endCol: 7 });
  titleRows.push(0);

  // Row 1: Subtitle / timestamp
  values.push([`Atualizado em ${now}  •  Apenas Disponíveis e Reservados`, '', '', '', '', '', '']);
  merges.push({ startRow: 1, endRow: 2, startCol: 0, endCol: 7 });

  values.push([]); // spacer row 2

  // Totals section header (row 3)
  values.push(['RESUMO GERAL', '', '', '', '', '', '']);
  merges.push({ startRow: values.length - 1, endRow: values.length, startCol: 0, endCol: 7 });
  headerRows.push(values.length - 1);

  // Totals (row 4-5)
  values.push(['Estoque Total', 'Disponíveis', 'Reservados', '', '', '', '']);
  const totalsHeaderRow = values.length - 1;
  values.push([sec.totals.total, sec.totals.disp, sec.totals.res, '', '', '', '']);

  values.push([]); // spacer

  // By Model
  values.push(['QUANTIDADE POR MODELO', '', '', '', '', '', '']);
  merges.push({ startRow: values.length - 1, endRow: values.length, startCol: 0, endCol: 7 });
  headerRows.push(values.length - 1);

  values.push(['Modelo', 'Disponíveis', 'Reservados', 'Total', '', '', '']);
  const byModelHeaderRow = values.length - 1;
  const byModelStart = values.length;
  for (const row of sec.byModel) values.push([...row, '', '', '']);
  const byModelEnd = values.length - 1;

  values.push([]); // spacer

  // By Model + Color
  values.push(['QUANTIDADE POR MODELO E COR', '', '', '', '', '', '']);
  merges.push({ startRow: values.length - 1, endRow: values.length, startCol: 0, endCol: 7 });
  headerRows.push(values.length - 1);

  values.push(['Modelo', 'Cor', 'Disponíveis', 'Reservados', 'Total', '', '']);
  const byMcHeaderRow = values.length - 1;
  const byMcStart = values.length;
  for (const row of sec.byModelColor) values.push([...row, '', '']);
  const byMcEnd = values.length - 1;

  values.push([]); // spacer

  // Detailed
  values.push(['DETALHAMENTO DO ESTOQUE', '', '', '', '', '', '']);
  merges.push({ startRow: values.length - 1, endRow: values.length, startCol: 0, endCol: 7 });
  headerRows.push(values.length - 1);

  values.push(['Chassi', 'Modelo', 'Ano', 'Cor', 'Placa', 'Status', 'Preço']);
  const detailHeaderRow = values.length - 1;
  const detailStart = values.length;
  for (const row of sec.detail) {
    values.push(row);
    statusCells.push({ row: values.length - 1, col: 5, status: String(row[5]) });
  }
  const detailEnd = values.length - 1;

  // Normalize row lengths to 7 cols
  for (const r of values) while (r.length < 7) r.push('');

  // Clear + write
  await gwFetch(`/spreadsheets/${spreadsheetId}/values/${sheetName}!A:Z:clear`, {
    method: 'POST',
    body: '{}',
  });
  await gwFetch(
    `/spreadsheets/${spreadsheetId}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ range: `${sheetName}!A1`, majorDimension: 'ROWS', values }) },
  );

  // Build formatting requests
  const requests: any[] = [];

  // Merges
  for (const m of merges) {
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: m.startRow, endRowIndex: m.endRow, startColumnIndex: m.startCol, endColumnIndex: m.endCol },
        mergeType: 'MERGE_ALL',
      },
    });
  }

  // Title row format
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
      cell: {
        userEnteredFormat: {
          backgroundColor: TITLE_BG,
          horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
          textFormat: { foregroundColor: HEADER_FG, fontSize: 16, bold: true, fontFamily: 'Inter' },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 44 }, fields: 'pixelSize',
    },
  });

  // Subtitle
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 7 },
      cell: {
        userEnteredFormat: {
          backgroundColor: SUB_BG,
          horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
          textFormat: { italic: true, fontSize: 10, foregroundColor: C(71, 85, 105) },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    },
  });

  // Section title bars
  for (const r of titleRows) { /* title row 0 already styled */ }
  for (const r of headerRows) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: HEADER_FG, bold: true, fontSize: 12 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: r, endIndex: r + 1 },
        properties: { pixelSize: 32 }, fields: 'pixelSize',
      },
    });
  }

  // Sub-headers (column headers) styling
  for (const r of [totalsHeaderRow, byModelHeaderRow, byMcHeaderRow, detailHeaderRow]) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: SUB_BG,
            horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
            textFormat: { bold: true, fontSize: 11 },
            borders: {
              bottom: { style: 'SOLID_MEDIUM', color: HEADER_BG },
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat,borders)',
      },
    });
  }

  // Totals cards (row totalsHeaderRow+1) — big numbers
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: totalsHeaderRow + 1, endRowIndex: totalsHeaderRow + 2, startColumnIndex: 0, endColumnIndex: 3 },
      cell: {
        userEnteredFormat: {
          horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
          textFormat: { bold: true, fontSize: 22, foregroundColor: TITLE_BG },
          borders: {
            top: { style: 'SOLID', color: C(203, 213, 225) },
            bottom: { style: 'SOLID', color: C(203, 213, 225) },
            left: { style: 'SOLID', color: C(203, 213, 225) },
            right: { style: 'SOLID', color: C(203, 213, 225) },
          },
        },
      },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat,borders)',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: totalsHeaderRow + 1, endIndex: totalsHeaderRow + 2 },
      properties: { pixelSize: 56 }, fields: 'pixelSize',
    },
  });

  // Zebra + borders for data ranges
  const dataRanges: Array<{ start: number; end: number; cols: number }> = [
    { start: byModelStart, end: byModelEnd, cols: 4 },
    { start: byMcStart, end: byMcEnd, cols: 5 },
    { start: detailStart, end: detailEnd, cols: 7 },
  ];
  for (const dr of dataRanges) {
    if (dr.end < dr.start) continue;
    // Base borders
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: dr.start, endRowIndex: dr.end + 1, startColumnIndex: 0, endColumnIndex: dr.cols },
        cell: {
          userEnteredFormat: {
            verticalAlignment: 'MIDDLE',
            textFormat: { fontSize: 10 },
            borders: {
              top: { style: 'SOLID', color: C(226, 232, 240) },
              bottom: { style: 'SOLID', color: C(226, 232, 240) },
              left: { style: 'SOLID', color: C(226, 232, 240) },
              right: { style: 'SOLID', color: C(226, 232, 240) },
            },
          },
        },
        fields: 'userEnteredFormat(verticalAlignment,textFormat,borders)',
      },
    });
    // Zebra
    for (let i = dr.start; i <= dr.end; i++) {
      if ((i - dr.start) % 2 === 1) {
        requests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: i, endRowIndex: i + 1, startColumnIndex: 0, endColumnIndex: dr.cols },
            cell: { userEnteredFormat: { backgroundColor: ZEBRA_BG } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        });
      }
    }
  }

  // Status cells coloring (detail)
  for (const s of statusCells) {
    const bg = s.status === 'Disponível' ? DISP_BG : RES_BG;
    const fg = s.status === 'Disponível' ? C(20, 83, 45) : C(120, 53, 15);
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: s.row, endRowIndex: s.row + 1, startColumnIndex: s.col, endColumnIndex: s.col + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: bg,
            horizontalAlignment: 'CENTER',
            textFormat: { bold: true, foregroundColor: fg, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)',
      },
    });
  }

  // Price column currency format (detail col 6)
  if (detailEnd >= detailStart) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: detailStart, endRowIndex: detailEnd + 1, startColumnIndex: 6, endColumnIndex: 7 },
        cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '"R$" #,##0.00' }, horizontalAlignment: 'RIGHT' } },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    });
  }

  // Numeric center align for count columns
  const numericRanges = [
    { start: byModelStart, end: byModelEnd, startCol: 1, endCol: 4 },
    { start: byMcStart, end: byMcEnd, startCol: 2, endCol: 5 },
  ];
  for (const nr of numericRanges) {
    if (nr.end < nr.start) continue;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: nr.start, endRowIndex: nr.end + 1, startColumnIndex: nr.startCol, endColumnIndex: nr.endCol },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', textFormat: { bold: true } } },
        fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
      },
    });
  }

  // Column widths
  const widths = [220, 260, 80, 130, 110, 130, 130];
  widths.forEach((w, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: w }, fields: 'pixelSize',
      },
    });
  });

  // Freeze title rows
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  // Hide gridlines
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { hideGridlines: true, frozenRowCount: 2 } },
      fields: 'gridProperties.hideGridlines',
    },
  });

  // Send batchUpdate in chunks (Sheets caps at ~1000 requests, but keep safe)
  const CHUNK = 200;
  for (let i = 0; i < requests.length; i += CHUNK) {
    await gwFetch(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: requests.slice(i, i + CHUNK) }),
    });
  }

  await supa.from('stock_sync_config').update({
    last_pushed_at: new Date().toISOString(),
    last_error: null,
  }).neq('id', '00000000-0000-0000-0000-000000000000');

  return { total: sec.totals.total, disp: sec.totals.disp, res: sec.totals.res };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action } = await req.json().catch(() => ({ action: 'push' }));
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: cfg } = await supa.from('stock_sync_config').select('*').limit(1).maybeSingle();
    if (!cfg || !cfg.enabled || !cfg.spreadsheet_id) {
      return new Response(JSON.stringify({ skipped: true, reason: 'sync disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Throttle to avoid Google Sheets 429 (Read/Write requests per minute).
    // verify (on app load) → skip if synced in the last 5 minutes.
    // push  (from DB triggers) → coalesce bursts within 20 seconds.
    // "force" bypasses the throttle (used by the manual "Sincronizar agora" button).
    const lastPushed = cfg.last_pushed_at ? new Date(cfg.last_pushed_at).getTime() : 0;
    const ageMs = Date.now() - lastPushed;
    const minAge = 5 * 60_000; // sincroniza no máximo a cada 5 minutos
    if (action !== 'force' && lastPushed && ageMs < minAge) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'throttled', age_ms: ageMs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let result: any;
    try {
      result = await pushPretty(supa, cfg.spreadsheet_id, cfg.sheet_name || 'Estoque');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // On rate-limit, degrade gracefully instead of surfacing a 500 to every client.
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        await supa.from('stock_sync_config').update({ last_error: msg })
          .neq('id', '00000000-0000-0000-0000-000000000000');
        return new Response(
          JSON.stringify({ skipped: true, reason: 'rate_limited' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      // Sem permissão na planilha: não é erro de código — avisa e segue.
      if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('404')) {
        const friendly =
          'Sem permissão na planilha. Compartilhe a planilha como Editor com a conta Google conectada e confirme o ID da planilha nas Configurações.';
        await supa.from('stock_sync_config').update({ last_error: friendly })
          .neq('id', '00000000-0000-0000-0000-000000000000');
        return new Response(
          JSON.stringify({ skipped: true, reason: 'no_permission', message: friendly }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw e;
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
      await supa.from('stock_sync_config').update({ last_error: msg })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});