import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Car, FileText, User, X, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVehicles } from '@/hooks/useVehicles';
import { useContracts } from '@/hooks/useContracts';
import { useResellers } from '@/hooks/useResellers';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  type: 'vehicle' | 'contract' | 'reseller';
  title: string;
  subtitle: string;
  path: string;
  icon: typeof Car;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: vehicles } = useVehicles();
  const { data: contracts } = useContracts();
  const { data: resellers } = useResellers();

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSearch('');
    }
  }, [open]);

  const results = useMemo(() => {
    if (!search || search.length < 2) return [];

    const searchLower = search.toLowerCase();
    const searchNumbers = search.replace(/\D/g, '');
    const items: SearchResult[] = [];

    // Search vehicles
    vehicles?.forEach(vehicle => {
      const matches = 
        vehicle.brand.toLowerCase().includes(searchLower) ||
        vehicle.model.toLowerCase().includes(searchLower) ||
        vehicle.chassis?.toLowerCase().includes(searchLower) ||
        vehicle.plate?.toLowerCase().includes(searchLower) ||
        (searchNumbers && vehicle.renavam?.includes(searchNumbers)) ||
        vehicle.color?.toLowerCase().includes(searchLower) ||
        String(vehicle.year).includes(search);
      
      if (matches) {
        items.push({
          id: vehicle.id,
          type: 'vehicle',
          title: `${vehicle.brand} ${vehicle.model} (${vehicle.year})`,
          subtitle: vehicle.plate || vehicle.chassis || 'Sem placa',
          path: '/vehicles',
          icon: Car,
        });
      }
    });

    // Search contracts
    contracts?.forEach(contract => {
      const matches = 
        contract.contract_number.toLowerCase().includes(searchLower) ||
        contract.buyer_name.toLowerCase().includes(searchLower) ||
        (searchNumbers && contract.buyer_cpf.includes(searchNumbers)) ||
        contract.vehicle?.brand?.toLowerCase().includes(searchLower) ||
        contract.vehicle?.model?.toLowerCase().includes(searchLower) ||
        contract.vehicle?.plate?.toLowerCase().includes(searchLower) ||
        contract.vehicle?.chassis?.toLowerCase().includes(searchLower);
      
      if (matches) {
        items.push({
          id: contract.id,
          type: 'contract',
          title: contract.contract_number,
          subtitle: contract.buyer_name,
          path: '/contracts',
          icon: FileText,
        });
      }
    });

    // Search resellers
    resellers?.forEach(reseller => {
      const matches = 
        reseller.full_name.toLowerCase().includes(searchLower) ||
        (searchNumbers && reseller.cpf?.includes(searchNumbers)) ||
        reseller.email?.toLowerCase().includes(searchLower) ||
        reseller.phone?.includes(search);
      
      if (matches) {
        items.push({
          id: reseller.id,
          type: 'reseller',
          title: reseller.full_name,
          subtitle: reseller.email || reseller.phone || 'Revendedor',
          path: '/organization?tab=revendedores',
          icon: User,
        });
      }
    });

    return items.slice(0, 20); // Limit results
  }, [search, vehicles, contracts, resellers]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      vehicle: [],
      contract: [],
      reseller: [],
    };

    results.forEach(result => {
      groups[result.type].push(result);
    });

    return groups;
  }, [results]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    onOpenChange(false);
  };

  const typeLabels: Record<string, { label: string; icon: typeof Car }> = {
    vehicle: { label: 'Veículos', icon: Car },
    contract: { label: 'Contratos', icon: FileText },
    reseller: { label: 'Revendedores', icon: User },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Busca Global</DialogTitle>
        </DialogHeader>
        <Command className="rounded-lg border-0">
          <div className="flex items-center border-b px-3">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar CPF, chassi, contrato, placa, cliente..."
              className="flex h-12 w-full bg-transparent py-3 px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setSearch('')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          <CommandList className="max-h-[400px] overflow-y-auto">
            {search.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Digite pelo menos 2 caracteres para buscar
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty className="py-6 text-center text-sm">
                Nenhum resultado encontrado para "{search}"
              </CommandEmpty>
            ) : (
              <>
                {Object.entries(groupedResults).map(([type, items]) => {
                  if (items.length === 0) return null;
                  const { label, icon: Icon } = typeLabels[type];
                  
                  return (
                    <CommandGroup 
                      key={type} 
                      heading={
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Icon className="w-3 h-3" />
                          {label}
                          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                            {items.length}
                          </Badge>
                        </div>
                      }
                    >
                      {items.map((result) => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="cursor-pointer"
                        >
                          <result.icon className="w-4 h-4 mr-2 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>
          
          <div className="border-t p-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pressione ESC para fechar</span>
              <span>⌘K para abrir</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
