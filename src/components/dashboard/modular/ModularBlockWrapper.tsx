import React from 'react';
import { DashboardBlockConfig, getColSpanClass, WidgetColSpan } from './types';
import { RenderWidget } from './widgetRegistry';

interface ModularBlockWrapperProps {
  block: DashboardBlockConfig;
  index: number;
  totalBlocks: number;
  data: any;
  onChangeWidget?: (index: number, newWidgetId: string) => void;
  onChangeColSpan?: (index: number, newColSpan: WidgetColSpan) => void;
  onRemove?: (index: number) => void;
  onMove?: (index: number, direction: 'up' | 'down') => void;
  onOpenFullCustomizer?: () => void;
}

export function ModularBlockWrapper({
  block,
  data,
}: ModularBlockWrapperProps) {
  if (!block.visible) return null;

  const colSpanClass = getColSpanClass(block.colSpan);

  return (
    <div className={`relative flex flex-col min-w-0 transition-all ${colSpanClass}`}>
      <div className="flex-1 w-full min-w-0">
        <RenderWidget widgetId={block.widgetId} data={data} />
      </div>
    </div>
  );
}
