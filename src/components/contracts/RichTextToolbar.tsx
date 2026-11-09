import { useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const FONT_SIZES = [
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '10', value: '10' },
  { label: '11', value: '11' },
  { label: '12', value: '12' },
  { label: '14', value: '14' },
  { label: '16', value: '16' },
  { label: '18', value: '18' },
  { label: '20', value: '20' },
  { label: '24', value: '24' },
  { label: '28', value: '28' },
  { label: '32', value: '32' },
];

const COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#1a1a2e', '#16213e', '#0f3460', '#533483',
  '#e94560', '#ff6b6b', '#ee5a24', '#f39c12',
  '#27ae60', '#2ecc71', '#1abc9c', '#00cec9',
  '#2962ff', '#3498db', '#6c5ce7', '#a29bfe',
];

interface RichTextToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
}

export function RichTextToolbar({ textareaRef, value, onChange }: RichTextToolbarProps) {
  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    const newValue =
      value.substring(0, start) +
      before +
      selectedText +
      after +
      value.substring(end);

    onChange(newValue);

    // Restore cursor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 0);
  }, [textareaRef, value, onChange]);

  const wrapLine = useCallback((tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Find line boundaries
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;

    const selectedLines = value.substring(lineStart, lineEnd);

    // Check if lines already have the tag, toggle off
    const openTag = `[${tag}]`;
    const closeTag = `[/${tag}]`;

    let newLines: string;
    if (selectedLines.startsWith(openTag) && selectedLines.endsWith(closeTag)) {
      newLines = selectedLines.slice(openTag.length, -closeTag.length);
    } else {
      // Remove other alignment tags first
      let cleaned = selectedLines;
      ['center', 'right', 'left'].forEach(t => {
        cleaned = cleaned.replace(new RegExp(`\\[${t}\\]`, 'g'), '').replace(new RegExp(`\\[/${t}\\]`, 'g'), '');
      });
      newLines = `${openTag}${cleaned}${closeTag}`;
    }

    const newValue = value.substring(0, lineStart) + newLines + value.substring(lineEnd);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
    }, 0);
  }, [textareaRef, value, onChange]);

  const handleFontSize = useCallback((size: string) => {
    wrapSelection(`[size:${size}]`, '[/size]');
  }, [wrapSelection]);

  const handleColor = useCallback((color: string) => {
    wrapSelection(`[color:${color}]`, '[/color]');
  }, [wrapSelection]);

  return (
    <div className="flex items-center gap-1 p-1.5 bg-muted/60 rounded-lg border flex-wrap">
      {/* Font Size */}
      <Select onValueChange={handleFontSize}>
        <SelectTrigger className="h-7 w-[70px] text-xs">
          <Type className="w-3 h-3 mr-1" />
          <SelectValue placeholder="Tam" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map(s => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}pt
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Bold */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Negrito [b]"
        onClick={() => wrapSelection('[b]', '[/b]')}
      >
        <Bold className="w-3.5 h-3.5" />
      </Button>

      {/* Italic */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Itálico [i]"
        onClick={() => wrapSelection('[i]', '[/i]')}
      >
        <Italic className="w-3.5 h-3.5" />
      </Button>

      {/* Underline */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Sublinhado [u]"
        onClick={() => wrapSelection('[u]', '[/u]')}
      >
        <Underline className="w-3.5 h-3.5" />
      </Button>

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Color Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Cor do texto"
          >
            <Palette className="w-3.5 h-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {COLORS.map(color => (
              <button
                key={color}
                type="button"
                className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => handleColor(color)}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <input
              type="color"
              className="w-6 h-6 rounded cursor-pointer"
              onChange={(e) => handleColor(e.target.value)}
              title="Cor personalizada"
            />
            <span className="text-xs text-muted-foreground">Personalizada</span>
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Alignment */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Alinhar à esquerda"
        onClick={() => wrapLine('left')}
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Centralizar"
        onClick={() => wrapLine('center')}
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Alinhar à direita"
        onClick={() => wrapLine('right')}
      >
        <AlignRight className="w-3.5 h-3.5" />
      </Button>

      {/* Help hint */}
      <div className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
        Selecione o texto → aplique formatação
      </div>
    </div>
  );
}
