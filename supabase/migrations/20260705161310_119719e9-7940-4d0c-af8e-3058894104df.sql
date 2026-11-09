-- 1. contract_templates: optional_clauses + vehicle_types
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS optional_clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vehicle_types text[] NOT NULL DEFAULT ARRAY['carro','moto']::text[];

-- 2. vehicles: warranty + revision periods
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS warranty_months integer,
  ADD COLUMN IF NOT EXISTS revision_period_months integer,
  ADD COLUMN IF NOT EXISTS revision_period_km integer;

-- 3. contracts: snapshot das cláusulas ativas
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS active_clause_ids text[] NOT NULL DEFAULT ARRAY[]::text[];

-- 4. Desativa modelos antigos (histórico preservado, contratos assinados continuam apontando)
UPDATE public.contract_templates SET is_active = false WHERE is_active = true;

-- 5. Seed do Contrato Mestre
INSERT INTO public.contract_templates (
  name, template_type, is_active, version, vehicle_types,
  header_content, body_content, clauses_content, signature_content,
  fixed_clauses, optional_clauses
) VALUES (
  'Contrato Mestre de Venda',
  'generico',
  true,
  1,
  ARRAY['carro','moto']::text[],
  '[center][size:16][b]CONTRATO DE COMPRA E VENDA DE VEÍCULO[/b][/size][/center]

[b]VENDEDORA:[/b] {{LOJA_RAZAO_SOCIAL}}, CNPJ {{LOJA_CNPJ}}, com sede em {{LOJA_ENDERECO}}, {{LOJA_CIDADE}}.

[b]COMPRADOR(A):[/b] {{CLIENTE_NOME}}, CPF/CNPJ {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}.',
  '[b]OBJETO:[/b] O presente contrato tem por objeto a compra e venda do veículo abaixo descrito, livre e desembaraçado de quaisquer ônus:

Marca/Modelo: {{VEICULO_MARCA}} {{VEICULO_MODELO}}
Ano: {{VEICULO_ANO}}   Cor: {{VEICULO_COR}}
Chassi: {{VEICULO_CHASSI}}   Placa: {{VEICULO_PLACA}}
Renavam: {{VEICULO_RENAVAM}}

[b]PREÇO E PAGAMENTO:[/b] O valor total ajustado é de R$ {{VALOR_TOTAL}}, pago na forma {{FORMA_PAGAMENTO}}. Entrada de R$ {{VALOR_ENTRADA}}, saldo em {{PARCELAS}} parcela(s) de R$ {{VALOR_PARCELA}}.',
  '[b]CLÁUSULA 1ª — DA ENTREGA:[/b] O veículo é entregue no estado em que se encontra, tendo o(a) comprador(a) plena ciência de suas condições após vistoria prévia.

[b]CLÁUSULA 2ª — DA DOCUMENTAÇÃO:[/b] A vendedora entrega o veículo com toda a documentação em dia. Fica a cargo do(a) comprador(a) providenciar a transferência junto ao órgão competente no prazo legal.

[b]CLÁUSULA 3ª — DO FORO:[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questões oriundas deste contrato.',
  '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}.[/center]

_______________________________________
[center]{{LOJA_RAZAO_SOCIAL}}
VENDEDORA[/center]

_______________________________________
[center]{{CLIENTE_NOME}}
COMPRADOR(A)[/center]',
  ARRAY[]::text[],
  jsonb_build_array(
    jsonb_build_object(
      'id','emplacamento',
      'label','Emplacamento por conta da loja',
      'body_bbcode','[b]EMPLACAMENTO:[/b] A vendedora se compromete a providenciar o emplacamento do veículo, incluindo taxas de DETRAN, placa e primeiro licenciamento, sem custo adicional ao(à) comprador(a).',
      'enabled_by_default', true,
      'vehicle_types', jsonb_build_array('moto')
    ),
    jsonb_build_object(
      'id','garantia',
      'label','Garantia contratual',
      'body_bbcode','[b]GARANTIA:[/b] O veículo possui garantia de {{GARANTIA_MESES}} meses contra defeitos de fabricação ou vícios ocultos, contados da data deste contrato, limitada aos itens do motor e câmbio, excluídos itens de desgaste natural.',
      'enabled_by_default', true,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','revisoes',
      'label','Plano de revisões',
      'body_bbcode','[b]REVISÕES:[/b] Para manutenção da garantia, o(a) comprador(a) deverá realizar revisões periódicas a cada {{REVISAO_MESES}} meses ou {{REVISAO_KM}} km — o que ocorrer primeiro — em oficina credenciada.',
      'enabled_by_default', true,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','transferencia',
      'label','Transferência de titularidade por conta do comprador',
      'body_bbcode','[b]TRANSFERÊNCIA:[/b] Fica sob responsabilidade exclusiva do(a) comprador(a) providenciar a transferência de titularidade junto ao DETRAN no prazo de 30 dias, arcando com todas as taxas envolvidas.',
      'enabled_by_default', false,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','seguro',
      'label','Seguro opcional contratado',
      'body_bbcode','[b]SEGURO:[/b] O(a) comprador(a) declara ter contratado seguro do veículo por conta própria, isentando a vendedora de qualquer responsabilidade por sinistros ocorridos após a entrega.',
      'enabled_by_default', false,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','acessorios',
      'label','Acessórios inclusos',
      'body_bbcode','[b]ACESSÓRIOS:[/b] Acompanham o veículo os acessórios originais de fábrica e itens listados no laudo de vistoria, sendo qualquer acessório adicional cobrado à parte.',
      'enabled_by_default', false,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','troca_devolucao',
      'label','Política de troca/devolução',
      'body_bbcode','[b]TROCA/DEVOLUÇÃO:[/b] O veículo, por se tratar de bem usado adquirido após vistoria, não admite devolução ou troca, salvo por vício oculto comprovado nos termos do Código de Defesa do Consumidor.',
      'enabled_by_default', false,
      'vehicle_types', jsonb_build_array('carro','moto')
    )
  )
);