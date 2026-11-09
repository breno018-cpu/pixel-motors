UPDATE public.contract_templates
SET 
  signature_content = '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]


[signatures]VENDEDORA|{{LOJA_RAZAO_SOCIAL}}||COMPRADOR(A)|{{CLIENTE_NOME}}[/signatures]',
  updated_at = now()
WHERE template_type = 'venda_moto';

UPDATE public.contract_templates
SET 
  signature_content = '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]


[signatures]VENDEDORA|{{LOJA_RAZAO_SOCIAL}}||COMPRADOR(A)|{{CLIENTE_NOME}}[/signatures]',
  updated_at = now()
WHERE template_type IN ('venda_carro', 'repasse', 'generico')
  AND signature_content IS NOT NULL;