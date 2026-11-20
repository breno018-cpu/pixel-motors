WITH sheet AS (
  SELECT e->>'id' sid, e->>'qt' qt, e->>'cliente' cliente, upper(regexp_replace(coalesce(e->>'chassi',''),'[^A-Za-z0-9]','','g')) ch, e->>'vendedor' vend, e->>'tipo_registro' tipo, e->>'data' dt
  FROM contracts g, jsonb_array_elements(g.external_data->'sheet_rows') e WHERE g.contract_number='DEALFLOW_GLOBAL_SYNC'),
db AS (
  SELECT id::text cid, contract_number, buyer_name, upper(regexp_replace(coalesce(external_data->>'chassis',''),'[^A-Za-z0-9]','','g')) ch, is_deleted, status
  FROM contracts WHERE contract_number<>'DEALFLOW_GLOBAL_SYNC')
SELECT s.qt, s.cliente, s.ch, s.vend, s.tipo, s.dt
FROM sheet s
WHERE NOT EXISTS (SELECT 1 FROM db d WHERE (length(s.ch)>=6 AND d.ch=s.ch) OR d.cid=s.sid OR upper(d.buyer_name)=upper(s.cliente))
ORDER BY s.dt;
