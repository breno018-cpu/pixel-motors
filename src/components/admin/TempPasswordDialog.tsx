import { useState } from 'react';
import { Copy, Check, Key } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TempPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tempPassword: string;
  userName: string;
  userEmail: string;
}

export function TempPasswordDialog({ open, onOpenChange, tempPassword, userName, userEmail }: TempPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = tempPassword;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Senha Temporária Gerada
          </DialogTitle>
          <DialogDescription>
            Copie a senha abaixo e envie para <strong>{userName}</strong> ({userEmail}).
            O usuário deverá alterá-la no primeiro acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={tempPassword}
              readOnly
              className="font-mono text-lg tracking-wider text-center bg-muted"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          {copied && (
            <p className="text-xs text-success text-center font-medium">
              ✓ Senha copiada para a área de transferência!
            </p>
          )}

          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <p className="text-xs text-warning">
              ⚠️ Esta senha será exibida apenas uma vez. Certifique-se de copiá-la antes de fechar.
            </p>
          </div>

          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Entendi, Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
