import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CatalogChatMessage } from "@/types/catalog";
import { Bot, Send, User, Sparkles, RefreshCw } from "lucide-react";

interface CatalogChatTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (messages: CatalogChatMessage[]) => Promise<any>;
}

export function CatalogChatTestDialog({
  open,
  onOpenChange,
  onSendMessage,
}: CatalogChatTestDialogProps) {
  const [messages, setMessages] = useState<CatalogChatMessage[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou a IA Assistente da L1MA Motors Concessionária. Como posso ajudar com os modelos, preços e condições de pagamento hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: CatalogChatMessage = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await onSendMessage(nextMessages);
      const replyContent = response.reply || response.message || "Entendido! Como posso ajudar mais?";
      setMessages([...nextMessages, { role: "assistant", content: replyContent }]);
    } catch (e: any) {
      toast.error(`Falha no assistente virtual: ${e.message}`);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `Não foi possível obter resposta do servidor da IA (${e.message}). Verifique a conexão com a API Node.js.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Olá! Sou a IA Assistente da L1MA Motors Concessionária. Como posso ajudar com os modelos, preços e condições de pagamento hoje?",
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl h-[80vh] flex flex-col p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base">
              <Bot className="w-5 h-5 text-primary" />
              Testar IA Assistente Virtual (POST /api/chat)
            </div>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary">
              Endpoint Ativo
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Teste como a inteligência artificial generativa responde aos clientes e recomenda as motos consultando os 79 modelos em tempo real.
          </DialogDescription>
        </DialogHeader>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-3 rounded-lg border bg-muted/10 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`p-2.5 rounded-xl max-w-[85%] leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                    : "bg-card border text-foreground rounded-tl-none shadow-2xs"
                }`}
              >
                {m.content}
              </div>

              {m.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>A IA da L1MA Motors está consultando o catálogo...</span>
            </div>
          )}
        </div>

        {/* Sugestões rápidas de perguntas */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-[11px]">
          <span className="text-muted-foreground text-[10px] shrink-0">Sugestões:</span>
          {["Quais motos estão em oferta?", "Qual a moto mais econômica?", "Como funciona em 21x?"].map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => setInput(sug)}
              className="px-2 py-0.5 rounded border bg-background hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            placeholder="Digite uma pergunta para a IA da concessionária..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading}
            className="text-xs"
          />
          <Button size="sm" onClick={handleSend} disabled={loading || !input.trim()} className="gap-1.5 shrink-0">
            <Send className="w-3.5 h-3.5" />
            Enviar
          </Button>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-muted-foreground">
            Limpar Conversa
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
