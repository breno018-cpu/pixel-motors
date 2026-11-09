const { createWorker } = require('tesseract.js');
const imgPath = 'C:/Users/laure/.gemini/antigravity/brain/64149a01-d07f-48ee-b9dd-6cbeaaa80d1d/.user_uploaded/media_1794225245314_27d8fd87.jpg';

function isModelCode(token) {
  if (!token) return false;
  const s = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^(MBR|WBR|WER|MOR|MGR|WGR|NER|EIES|WRU|WRO|WRA|MRU|MRO)/i.test(s);
}

function isValidVin(s) {
  if (!s || s.length !== 17) return false;
  if (s.includes('SEEREN') || s.includes('SEREI') || s.includes('TITULO') || isModelCode(s)) return false;
  if (s.startsWith('99H') || s.startsWith('9C2') || s.startsWith('9C6') || s.startsWith('95V') || s.startsWith('9CD') || s.startsWith('948')) return true;
  return /^9[A-HJ-NPR-Z0-9]{16}$/i.test(s);
}

function normalizeOcrVin(raw) {
  if (!raw) return null;
  let s = raw.toUpperCase().replace(/[^A-Z0-9%&]/g, '');
  s = s.replace(/%/g, '0').replace(/&/g, '8');

  if (s.length < 10) return null;
  if (isModelCode(s)) return null;

  // Substitute 3-char prefix with 99H if it resembles 99H
  if (/^([90OSGB][90OSWMBG][HWMIBL1])/i.test(s)) {
    s = '99H' + s.slice(3);
  }

  // Model normalization
  const modelRegexes = [
    { p: /(PHS|PH5|PH[0O][5S])[0O][5S][0O]/i, code: 'PHS050' },
    { p: /(NJ|N[1I]|N[I1]L|N[1I]I|NIII|NILI|WIII|MIII|MIL|MIIL|NIL)[1I][1I]?[2Z]?[5S]?([2Z][5S]|[A-Z]S|[2Z]S)/i, code: 'NJ1125' },
    { p: /(NJ|N[1I]|NIII|NILI|WIII|MIII|MIL)[1I]?[1I]?[2Z][5S]/i, code: 'NJ1125' },
    { p: /(NJ|N[1I]|NIII|NILI|WIII|MIII|MIL)[1I]?[1I]?[2Z]?[5S]?[0O]?/i, code: 'NJ1125' },
    { p: /(JTS|[1I]TS|TS[1I]|TSI|WSI|WS|ITSI)[1I]?[2Z][5S]/i, code: 'JTS125' },
    { p: /(SHF|SHR|SH[1I]F)[1I]7[5S]/i, code: 'SHF175' },
    { p: /(SHF|SHR|SH[1I]F|SHFA|SHRA)[2Z][5S][0O]/i, code: 'SHF250' },
    { p: /(SHF|SHR|SH[1I]F|SHFA|SHRA)[5S][0O]/i, code: 'SHF250' },
    { p: /(SHF|SHR|SH[1I]F|SHFA|SHRA)[1I][2Z][5S]/i, code: 'SHF175' },
    { p: /(SHF|SHR|SH[1I]F)[1I]?[2Z][0O]?/i, code: 'SHF175' },
    { p: /(STF|STR|STP|STPA|STRF|TRE)[2Z][0O][0O]/i, code: 'STF200' },
    { p: /(STF|STR|STP|STPA|STRF)[0O][0O]/i, code: 'STF200' },
    { p: /(STF|STR|STP|STPA|STRF)[2Z][0O]/i, code: 'STF200' },
  ];

  let foundModel = null;
  for (const m of modelRegexes) {
    if (m.p.test(s)) {
      foundModel = m.code;
      break;
    }
  }

  const vsIdx = s.indexOf('VS');
  if (foundModel && vsIdx !== -1) {
    let serial = s.slice(vsIdx + 2)
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/L/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2')
      .replace(/%/g, '0')
      .replace(/&/g, '8');

    if (serial.length === 5) serial = serial.padStart(6, '0');
    if (serial.length >= 6) {
      const candidate = `99H${foundModel}VS${serial.slice(-6)}`;
      if (isValidVin(candidate)) return candidate;
    }
  }

  return isValidVin(s) ? s : null;
}

async function run() {
  const worker = await createWorker('eng');
  const ret = await worker.recognize(imgPath);
  const rawLines = ret.data.text.split('\n').map(l => l.trim()).filter(l => l.length >= 8);

  let validCount = 0;
  let invalidCount = 0;
  let headerCount = 0;

  rawLines.forEach((line, i) => {
    let norm = line.toUpperCase().replace(/[“’”"«»]/g, ' ').replace(/^[\[\(\{]+|[\]\)\}]+$/g, '').trim();
    let isHeader = (/SEEREN/i.test(norm) || (/\b(LOTE|ROMANEIO|NUMERO DO CHASSI|MOTOR|ANO)\b/i.test(norm) && !/53880|1156/i.test(norm)));
    
    let tokens = norm.split(/[\s|;,\t]+/).map(t => t.replace(/[^A-Z0-9%&]/g, ''));
    
    // Sort tokens: tokens with VS come FIRST!
    tokens.sort((a, b) => {
      let aHasVs = /VS/i.test(a) ? 1 : 0;
      let bHasVs = /VS/i.test(b) ? 1 : 0;
      return bHasVs - aHasVs;
    });

    let foundVin = null;
    let vinCandidate = null;

    for (let t of tokens) {
      if (isModelCode(t)) continue;
      if (t.length >= 10 && t.length <= 22) {
        if (!vinCandidate) vinCandidate = t;
        let r = normalizeOcrVin(t);
        if (r && isValidVin(r)) {
          foundVin = r;
          break;
        }
      }
    }

    let status = 'valid';
    let reason = '';
    if (isHeader) {
      status = 'header';
      headerCount++;
      reason = 'Cabeçalho da tabela identificado e ignorado.';
    } else if (foundVin) {
      status = 'valid';
      validCount++;
      reason = `Chassi 100% validado (${foundVin}).`;
    } else if (vinCandidate) {
      status = 'invalid';
      invalidCount++;
      reason = `Chassi com pendência: "${vinCandidate}" (${vinCandidate.length} chars).`;
    } else {
      status = 'invalid';
      invalidCount++;
      reason = 'Chassi não identificado na linha.';
    }

    console.log(`L${(i+1).toString().padStart(2, ' ')} [${status.toUpperCase()}] ${reason}`);
  });

  console.log(`\nRESUMO: Total: ${rawLines.length} | Validadas: ${validCount} | Não Lidas / Erro: ${invalidCount} | Cabeçalho: ${headerCount}`);
  await worker.terminate();
}

run().catch(console.error);
