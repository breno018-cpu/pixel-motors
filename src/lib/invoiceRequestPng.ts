// Gera um PNG "Solicitação de Emissão de Nota Fiscal" usando o template oficial
// (imagem original) como fundo e sobrepondo os dados do cliente/veículo, mantendo
// proporções e detalhes idênticos ao layout aprovado.

import templateUrl from "@/assets/nf-template.jpeg";

export interface InvoiceRequestData {
  nomeCompleto: string;
  cpf: string;
  cep: string;
  endereco: string;
  chassi: string;
  modeloMoto: string;
  valorNF: string;
  alienacao: string; // "AVISTA" se vazio
}

const DARK = "#1A1A1A";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = String(text).split(" ");
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function loadTemplate(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = templateUrl;
  });
}

// Coordenadas medidas a partir do template original (1055 × 1491 px).
// Cada retângulo é a área de preenchimento (abaixo do label vermelho).
const FIELDS = {
  nome: { x: 90, y: 395, w: 880, h: 110 },
  cpf: { x: 90, y: 615, w: 410, h: 110 },
  cep: { x: 565, y: 615, w: 410, h: 110 },
  endereco: { x: 90, y: 825, w: 880, h: 150 },
  chassi: { x: 90, y: 1030, w: 410, h: 110 },
  modelo: { x: 565, y: 1030, w: 410, h: 110 },
  valor: { x: 90, y: 1235, w: 410, h: 110 },
  alienacao: { x: 565, y: 1235, w: 410, h: 110 },
};

function maskCpf(v: string) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return v || "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskCep(v: string) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 8);
  if (d.length !== 8) return v || "";
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export async function generateInvoiceRequestBlob(data: InvoiceRequestData): Promise<Blob> {
  const img = await loadTemplate();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  ctx.fillStyle = DARK;
  ctx.textBaseline = "top";

  const draw = (
    text: string,
    box: { x: number; y: number; w: number; h: number },
    size = 24,
  ) => {
    ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
    wrapText(ctx, text || "", box.x, box.y, box.w, size + 6);
  };

  draw(data.nomeCompleto, FIELDS.nome);
  draw(maskCpf(data.cpf), FIELDS.cpf);
  draw(maskCep(data.cep), FIELDS.cep);
  draw(data.endereco, FIELDS.endereco);
  draw(data.chassi, FIELDS.chassi);
  draw(data.modeloMoto, FIELDS.modelo);
  draw(data.valorNF, FIELDS.valor);
  draw((data.alienacao || "").trim().toUpperCase() || "AVISTA", FIELDS.alienacao);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG"))),
      "image/png",
      0.95,
    );
  });
}

export async function generateInvoiceRequestPng(data: InvoiceRequestData): Promise<string> {
  const blob = await generateInvoiceRequestBlob(data);
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function downloadInvoiceRequestPng(
  data: InvoiceRequestData,
  filename = "solicitacao-nf.png",
) {
  const blob = await generateInvoiceRequestBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}