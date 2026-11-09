# Vendas Externas completas

## Objetivo
Transformar a aba Vendas Externas em uma área completa de consulta e gestão, mantendo nela somente vendas externas.

## O que será feito
- Exibir todas as vendas externas permitidas ao usuário, com a mesma listagem, filtros, indicadores e ações da aba Vendas.
- Manter a visibilidade atual: administradores e gerentes veem todas; Vendedor ++ vê somente as próprias.
- Incluir os dados exclusivos da venda externa: origem do lead, anúncio/campanha, telefone, canal de contato, cidade, entrega, conversa, observações e quantidade de comprovantes.
- Abrir os detalhes completos da venda pelo mesmo menu usado em Vendas, incluindo contrato, edição e demais ações permitidas pelo cargo.
- Preservar comissão, metas, histórico e estoque em áreas separadas, sem misturar vendas internas.

## Detalhes técnicos
- Filtrar contratos por `sale_channel = externa` tanto nas consultas de desempenho quanto na listagem.
- Ampliar o tipo compartilhado de contrato para transportar `external_data`, `evidence_paths` e `sale_channel`.
- Reutilizar o menu e a tela de detalhes já existentes, acrescentando um bloco específico para dados externos.
- Validar como administrador e garantir que a tela de carregamento não reapareça durante a navegação.
