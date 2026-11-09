# Cargos personalizados com permissões

## O que muda para você
- Nova tela **Configurações › Cargos e Permissões**: criar, editar, duplicar e desativar cargos.
- Para cada cargo você define:
  - **Telas que acessa** (Dashboard, Estoque, Vendas, Vendas Externas, Financiamentos, Contratos, Consignações, NF de Motos, Organização, Folha, Anúncios, Relatórios, Configurações).
  - **Ações permitidas**: criar/editar/excluir vendas, cadastrar/editar/excluir veículos, destravar campos do chassi (tudo ou só ano/câmbio), ver margens e custos, exportar dados, gerenciar contratos, gerenciar usuários, gerenciar folha.
  - **Alcance dos dados**: só as próprias vendas, só a loja dele, ou todas as lojas.
- Os cargos atuais (Gerente, Vendedor, Vendedor +, Vendedor ++, Revendedor, Visualizador) viram cargos editáveis já preenchidos com as permissões que têm hoje — nada muda até você alterar.
- **Administrador** fica fixo, com acesso total, e não pode ser editado nem removido.
- No cadastro/edição de usuário, a lista de cargos passa a mostrar também os cargos criados por você.
- Cargo com usuários vinculados não pode ser excluído, só desativado.

## Detalhes técnicos
- Novas tabelas: `custom_roles` (nome, descrição, cor, alcance `own|store|all`, ativo, `system_key` para mapear cargos atuais) e `role_permissions` (role_id, permission key). `user_roles` ganha `custom_role_id` (mantém o enum `app_role` para compatibilidade e para o admin).
- Seed: um `custom_role` por cargo atual com as permissões equivalentes às regras de hoje.
- Funções security definer: `has_permission(_user_id, _perm)` e `user_data_scope(_user_id)`; `can_create_sales`, `can_register_vehicles` e `has_elevated_access` passam a consultar permissões (admin sempre true). RLS das tabelas principais (contracts, vehicles) passa a respeitar o alcance.
- Frontend: `AuthContext` carrega `permissions` e `scope`; helper `can(perm)`; `sidebarMenu` e `ProtectedRoute` usam permissões de tela em vez de listas fixas de cargos; flags existentes (`canCreateSales`, `hasElevatedAccess`...) derivadas das permissões.
- Edge function `create-user` aceita `custom_role_id`.
- Todas as alterações de cargo registradas no log de auditoria.
- Validação: typecheck + teste no navegador como admin criando um cargo e conferindo menu/acessos.
