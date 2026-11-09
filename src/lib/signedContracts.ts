import { supabase } from '@/integrations/supabase/client';

function getFileExtension(path: string) {
  const cleanPath = path.split('?')[0];
  const parts = cleanPath.split('.');
  return parts.length > 1 ? parts.pop() : 'pdf';
}

export function resolveSignedContractPath(contractRef: string) {
  if (!contractRef) return null;

  if (contractRef.startsWith('contracts/')) {
    return contractRef;
  }

  const bucketMarker = '/signed-contracts/';
  if (contractRef.includes(bucketMarker)) {
    return decodeURIComponent(contractRef.split(bucketMarker)[1].split('?')[0]);
  }

  if (contractRef.startsWith('signed-contracts/')) {
    return contractRef.replace('signed-contracts/', '');
  }

  return contractRef;
}

export async function downloadSignedContractFile(contractRef: string, fileNameBase?: string) {
  const filePath = resolveSignedContractPath(contractRef);

  if (!filePath) {
    throw new Error('Contrato assinado não encontrado.');
  }

  const { data, error } = await supabase.storage
    .from('signed-contracts')
    .download(filePath);

  if (error || !data) {
    throw error ?? new Error('Não foi possível baixar o contrato assinado.');
  }

  const extension = getFileExtension(filePath);
  const blobUrl = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${fileNameBase || 'contrato_assinado'}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}