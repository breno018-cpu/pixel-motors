SELECT count(*) AS linhas_planilha_com_chassi_valido_sem_contrato_por_chassi FROM (
 SELECT upper(regexp_replace(coalesce(e->>'chassi',''),'[^A-Za-z0-9]','','g')) ch
 FROM contracts g, jsonb_array_elements(g.external_data->'sheet_rows') e WHERE g.contract_number='DEALFLOW_GLOBAL_SYNC') s
WHERE length(s.ch)>=10 AND s.ch !~ '(DISPENSADO|DEFINIR|PENDENTE|ESTOQUE)'
AND NOT EXISTS (SELECT 1 FROM contracts d WHERE d.contract_number<>'DEALFLOW_GLOBAL_SYNC' AND upper(regexp_replace(coalesce(d.external_data->>'chassis',''),'[^A-Za-z0-9]','','g'))=s.ch);
