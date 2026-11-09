# Ajustes do Vendedor ++ e Vendas Externas

## Objetivo
Dar ao Vendedor ++ controle seguro sobre ano e câmbio no cadastro de motos e reorganizar Vendas Externas em áreas separadas, claras e focadas.

## O que será feito
- Permitir que o Vendedor ++ destrave somente os campos de ano modelo, ano de fabricação e câmbio preenchidos automaticamente.
- Manter modelo, marca, cilindrada, combustível, garantia e preços protegidos; administradores e gerentes continuam podendo liberar todos os campos automáticos.
- Reorganizar Vendas Externas com abas próprias:
  - **Vendas**: indicadores do período, busca, filtros e listagem completa com ações.
  - **Desempenho**: visão dos vendedores e metas.
  - **Comissões**: valores e regras de comissão separados da listagem.
  - **Histórico**: evolução mensal.
  - **Estoque**: veículos disponíveis.
- Mostrar apenas as abas compatíveis com o cargo: administração/gerência vê a equipe; Vendedor ++ vê apenas seus dados.
- Remover repetições, cartões fora de ordem e tabelas duplicadas, preservando os dados reais e as ações já disponíveis.

## Detalhes técnicos
- A liberação parcial será aplicada por campo no formulário, sem ampliar as permissões do cargo.
- A tela continuará consultando somente vendas com canal externo e respeitando a visibilidade por usuário.
- Os componentes visuais compartilhados do sistema serão usados para manter o padrão atual.
- Validar cadastro da moto e navegação entre todas as abas em desktop e tela estreita.
