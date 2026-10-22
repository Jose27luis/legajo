ALTER TABLE tipo_documento ADD COLUMN formulario JSONB NOT NULL DEFAULT '{}';

ALTER TABLE trabajador
  ADD COLUMN grado_instruccion VARCHAR(40),
  ADD COLUMN profesion VARCHAR(120),
  ADD COLUMN condicion_profesion VARCHAR(40);

CREATE TABLE remapeo_tipo (anterior CHAR(4) PRIMARY KEY, nuevo CHAR(4) NOT NULL);

INSERT INTO remapeo_tipo (anterior, nuevo) VALUES
  ('0401', '0401'), ('0402', '0401'), ('0403', '0401'), ('0404', '0402'), ('0405', '0402'), ('0406', '0402'),
  ('0501', '0501'), ('0502', '0502'), ('0503', '0503'), ('0504', '0503'), ('0505', '0504'),
  ('0506', '0505'), ('0507', '0505'), ('0508', '0505'), ('0509', '0505'), ('0510', '0505'),
  ('0511', '0505'), ('0512', '0505'), ('0513', '0505'), ('0514', '0505'), ('0515', '0505'),
  ('0601', '0601'), ('0602', '0602'), ('0603', '0602'), ('0604', '0603'), ('0605', '0603'), ('0606', '0603'), ('0607', '0604'),
  ('0701', '0701'), ('0702', '0701'), ('0703', '0701'), ('0704', '0701'), ('0705', '0702'), ('0706', '0702'),
  ('0707', '0703'), ('0708', '0704'), ('0709', '0705'), ('0710', '0706'), ('0711', '0707'), ('0712', '0708'),
  ('0801', '0801'), ('0802', '0801'), ('0803', '0801'), ('0804', '0801'), ('0805', '0801'),
  ('0806', '0802'), ('0807', '0803'), ('0808', '0804'), ('0809', '0804'), ('0810', '0804'),
  ('0811', '0805'), ('0812', '0805'), ('0813', '0805'),
  ('0901', '0901'), ('0902', '0902'), ('0903', '0903'), ('0904', '0903'), ('0905', '0903');

CREATE TABLE tipo_remapeado AS
SELECT t.id, r.nuevo,
       t.id = first_value(t.id) OVER (PARTITION BY r.nuevo ORDER BY r.anterior) AS conserva
FROM tipo_documento t
JOIN remapeo_tipo r ON r.anterior = t.codigo
WHERE t.activo;

CREATE TABLE tipo_destino AS
SELECT a.id AS anterior_id, c.id AS destino_id
FROM tipo_remapeado a
JOIN tipo_remapeado c ON c.nuevo = a.nuevo AND c.conserva
WHERE NOT a.conserva;

UPDATE documento d SET tipo_documento_id = x.destino_id FROM tipo_destino x WHERE d.tipo_documento_id = x.anterior_id;

UPDATE lote_item l SET tipo_documento_id = x.destino_id FROM tipo_destino x WHERE l.tipo_documento_id = x.anterior_id;

UPDATE requisito r SET tipo_documento_id = x.destino_id FROM tipo_destino x WHERE r.tipo_documento_id = x.anterior_id;

UPDATE tipo_documento t
SET codigo = '9' || lpad(t.id::text, 3, '0'), activo = false
FROM tipo_remapeado a
WHERE a.id = t.id;

UPDATE tipo_documento t
SET codigo = a.nuevo, activo = true
FROM tipo_remapeado a
WHERE a.id = t.id AND a.conserva;

DROP TABLE tipo_destino;
DROP TABLE tipo_remapeado;
DROP TABLE remapeo_tipo;
