WITH s AS (
 SELECT e->>'qt' qt, e->>'cliente' cliente, upper(regexp_replace(coalesce(e->>'chassi',''),'[^A-Za-z0-9]','','g')) ch, e->>'vendedor' vend
 FROM contracts g, jsonb_array_elements(g.external_data->'sheet_rows') e WHERE g.contract_number='DEALFLOW_GLOBAL_SYNC'),
d AS (
 SELECT c.id, c.buyer_name, c.is_deleted,
  upper(regexp_replace(coalesce(c.external_data->>'chassis',''),'[^A-Za-z0-9]','','g')) ch1,
  upper(regexp_replace(coalesce(v.chassis,''),'[^A-Za-z0-9]','','g')) ch2
 FROM contracts c LEFT JOIN vehicles v ON v.id=c.vehicle_id WHERE c.contract_number<>'DEALFLOW_GLOBAL_SYNC')
SELECT
 (SELECT count(*) FROM s) linhas_planilha,
 (SELECT count(*) FROM s WHERE EXISTS (SELECT 1 FROM d WHERE length(s.ch)>=10 AND (d.ch1=s.ch OR d.ch2=s.ch))) casam_por_chassi,
 (SELECT count(*) FROM s WHERE NOT EXISTS (SELECT 1 FROM d WHERE (length(s.ch)>=10 AND (d.ch1=s.ch OR d.ch2=s.ch)))
    AND EXISTS (SELECT 1 FROM d WHERE upper(d.buyer_name)=upper(s.cliente))) casam_so_por_nome,
 (SELECT count(*) FROM s WHERE NOT EXISTS (SELECT 1 FROM d WHERE (length(s.ch)>=10 AND (d.ch1=s.ch OR d.ch2=s.ch)) OR upper(d.buyer_name)=upper(s.cliente))) sem_contrato,
 (SELECT count(*) FROM d) contratos_no_banco,
 (SELECT count(*) FROM d WHERE is_deleted) excluidos;
