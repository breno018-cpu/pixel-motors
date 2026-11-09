UPDATE public.contract_templates
SET 
  header_content = '[center][b][size:13]CONTRATO PARTICULAR DE COMPRA E VENDA DE MOTOCICLETA[/size][/b][/center]',
  body_content = 'Pelo presente instrumento particular, de um lado [b]{{LOJA_RAZAO_SOCIAL}}[/b], com sede em {{LOJA_ENDERECO}} — {{LOJA_CIDADE}}, telefone {{LOJA_TELEFONE}}, doravante denominada [b]VENDEDORA[/b], e de outro lado [b]{{CLIENTE_NOME}}[/b], portador(a) do CPF/CNPJ nº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) [b]COMPRADOR(A)[/b], têm entre si justo e contratado a compra e venda da motocicleta abaixo descrita:

[b]MOTOCICLETA:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} — [b]Ano:[/b] {{VEICULO_ANO}} — [b]Cor:[/b] {{VEICULO_COR}}
[b]Chassi:[/b] {{VEICULO_CHASSI}} — [b]Placa:[/b] {{VEICULO_PLACA}} — [b]Renavam:[/b] {{VEICULO_RENAVAM}}

[b]VALOR DA VENDA:[/b] {{VALOR_TOTAL}} — [b]Forma de Pagamento:[/b] {{FORMA_PAGAMENTO}} — [b]Entrada:[/b] {{VALOR_ENTRADA}} — [b]Parcelas:[/b] {{PARCELAS}} de {{VALOR_PARCELA}}',
  clauses_content = '[center][b]TERMO DE RESPONSABILIDADE E GARANTIA[/b][/center]
Declaro que estou vendendo o veículo acima descrito e que assumo total responsabilidade por quaisquer ocorrências relacionadas ao mesmo até a presente data de venda, incluindo multas, danos materiais e pessoais, respondendo civil e criminalmente, bem como por todo e qualquer tipo de débito, de qualquer espécie ou natureza. A partir desta venda, tais responsabilidades passam a ser integralmente do comprador acima identificado. Declaro ainda que, conforme a legislação vigente, o veículo será de responsabilidade exclusiva do comprador a partir desta data.

[b]CLÁUSULAS:[/b]
[b]1.[/b] A VENDEDORA transfere ao(à) COMPRADOR(A) a propriedade e posse da motocicleta acima descrita, livre de ônus, na presente data.
[b]2.[/b] O(A) COMPRADOR(A) declara ter vistoriado a motocicleta e a recebe no estado em que se encontra, sem direito a reclamações posteriores quanto a defeitos aparentes.
[b]3.[/b] A partir desta data, todas as responsabilidades civis, criminais e tributárias (multas, IPVA, licenciamento) passam a ser exclusivas do(a) COMPRADOR(A).
[b]4.[/b] O emplacamento e a transferência junto ao DETRAN são de responsabilidade exclusiva do(a) COMPRADOR(A), devendo ser realizados em até 30 dias.
[b]5.[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questões oriundas deste contrato.',
  signature_content = '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]


[center]_______________________________          _______________________________
[b]VENDEDORA[/b]                                              [b]COMPRADOR(A)[/b]
{{LOJA_RAZAO_SOCIAL}}                                {{CLIENTE_NOME}}[/center]',
  fixed_clauses = ARRAY['O EMPLACAMENTO É DE RESPONSABILIDADE EXCLUSIVA DO COMPRADOR.']::text[],
  updated_at = now()
WHERE template_type = 'venda_moto';