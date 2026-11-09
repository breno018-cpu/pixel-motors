import { DealershipsSettingsManager } from '@/components/settings/DealershipsSettingsManager';

export default function Stores({ embedded = false }: { embedded?: boolean } = {}) {
  return <DealershipsSettingsManager embedded={embedded} />;
}
