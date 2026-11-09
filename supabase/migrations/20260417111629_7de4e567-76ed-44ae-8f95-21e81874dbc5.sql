UPDATE public.contract_templates
SET 
  header_content = '[center][b][size:14]CONTRATO DE COMPRA E VENDA DE MOTOCICLETA[/size][/b][/center]',
  body_content = '[b]VENDEDORA:[/b] {{LOJA_RAZAO_SOCIAL}} — {{LOJA_ENDERECO}}, {{LOJA_CIDADE}} — Tel: {{LOJA_TELEFONE}}

[b]COMPRADOR(A):[/b] {{CLIENTE_NOME}} — CPF/CNPJ: {{CLIENTE_CPF}}
Endereço: {{CLIENTE_ENDERECO}} — Tel: {{CLIENTE_TELEFONE}}

[b]MOTOCICLETA:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} — Ano: {{VEICULO_ANO}} — Cor: {{VEICULO_COR}}
Chassi: {{VEICULO_CHASSI}} — Placa: {{VEICULO_PLACA}} — Renavam: {{VEICULO_RENAVAM}}

[b]VALOR:[/b] {{VALOR_TOTAL}} — [b]Pagamento:[/b] {{FORMA_PAGAMENTO}} — Entrada: {{VALOR_ENTRADA}} — Parcelas: {{PARCELAS}} de {{VALOR_PARCELA}}',
  clauses_content = '[b]CLÁUSULAS:[/b]
[b]1.[/b] A VENDEDORA transfere ao(à) COMPRADOR(A) a propriedade e posse da motocicleta acima descrita, livre de ônus, na presente data.
[b]2.[/b] O(A) COMPRADOR(A) declara ter vistoriado a motocicleta e a recebe no estado em que se encontra, sem direito a reclamações posteriores quanto a defeitos aparentes.
[b]3.[/b] A partir desta data, todas as responsabilidades civis, criminais e tributárias (multas, IPVA, licenciamento) passam a ser exclusivas do(a) COMPRADOR(A).
[b]4.[/b] O emplacamento e a transferência junto ao DETRAN são de responsabilidade exclusiva do(a) COMPRADOR(A), devendo ser realizados em até 30 dias.
[b]5.[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questões oriundas deste contrato.',
  signature_content = '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]


[center]_______________________________          _______________________________
[b]VENDEDORA[/b]                                              [b]COMPRADOR(A)[/b]
{{LOJA_RAZAO_SOCIAL}}                                {{CLIENTE_NOME}}[/center]',
  fixed_clauses = ARRAY['O emplacamento da motocicleta é de responsabilidade exclusiva do(a) COMPRADOR(A).']::text[],
  updated_at = now()
WHERE template_type = 'venda_moto';