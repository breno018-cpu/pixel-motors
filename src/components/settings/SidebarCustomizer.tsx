import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutList, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';

export function SidebarCustomizer() {
  const { configurableItems, config, move, toggleHidden, reset } = useSidebarConfig();

  return (
    <Card className="card-interactive">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <LayoutList className="w-4 h-4 text-primary" />
          Barra Lateral
        </CardTitle>
        <CardDescription className="text-sm">
          Reordene os itens do menu lateral e oculte os que não usa. A preferência é salva neste navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {configurableItems.map((item, idx) => {
          const hidden = config.hidden.includes(item.path);
          const Icon = item.icon;
          return (
            <div
              key={item.path}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className={`text-sm flex-1 truncate ${hidden ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {item.label}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => move(item.path, -1)}
                disabled={idx === 0}
                title="Mover para cima"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => move(item.path, 1)}
                disabled={idx === configurableItems.length - 1}
                title="Mover para baixo"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => toggleHidden(item.path)}
                title={hidden ? 'Mostrar' : 'Ocultar'}
              >
                {hidden ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-primary" />}
              </Button>
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 gap-2"
          onClick={reset}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar padrão
        </Button>
      </CardContent>
    </Card>
  );
}