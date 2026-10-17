CREATE TABLE codigo_anterior AS
SELECT id, codigo FROM tipo_documento;

UPDATE tipo_documento
SET codigo = '9' || lpad(id::text, 3, '0'),
    activo = false;

UPDATE tipo_documento
SET seccion_id = (SELECT id FROM seccion WHERE numero = 5)
WHERE seccion_id = (SELECT id FROM seccion WHERE numero = 13)
  AND EXISTS (SELECT 1 FROM seccion WHERE numero = 5);

DELETE FROM seccion
WHERE numero = 13
  AND NOT EXISTS (SELECT 1 FROM tipo_documento WHERE seccion_id = seccion.id)
  AND NOT EXISTS (SELECT 1 FROM rol_seccion_restringida WHERE seccion_id = seccion.id);

INSERT INTO tipo_documento (seccion_id, codigo, nombre, restringido, requiere_numero, tiene_vencimiento, accion)
SELECT s.id, n.codigo, n.nombre, false, n.requiere_numero, n.tiene_vencimiento, n.accion::"AccionDocumento"
FROM (
  VALUES
    (1, '0102', 'Copia del DNI o documento equivalente', false, true, 'NINGUNA'),
    (2, '0205', 'Resolución administrativa del servicio civil de carrera', true, false, 'VINCULO'),
    (2, '0206', 'Contrato', true, false, 'VINCULO'),
    (3, '0302', 'Títulos o grados de estudios superiores técnicos o universitarios', false, false, 'NINGUNA'),
    (5, '0502', 'Documento que sustenta el goce vacacional', false, false, 'NINGUNA'),
    (7, '0709', 'Documento de rotación', false, false, 'MOVIMIENTO'),
    (11, '1102', 'Resolución de término del servicio civil de carrera', false, false, 'CESE'),
    (11, '1103', 'Memorando de término de vínculo del servicio civil', false, false, 'CESE'),
    (11, '1107', 'Carta de no renovación de contrato a plazo determinado (D. Leg. N.º 1057)', false, false, 'CESE')
) AS n (numero, codigo, nombre, requiere_numero, tiene_vencimiento, accion)
JOIN seccion s ON s.numero = n.numero;

CREATE TABLE equivalencia AS
SELECT a.id AS anterior_id, t.id AS nuevo_id
FROM (
  VALUES
    ('0101', '0102'),
    ('0202', '0206'),
    ('0203', '0206'),
    ('0207', '0205'),
    ('0301', '0302'),
    ('0302', '0302'),
    ('0501', '0709'),
    ('1101', '1103'),
    ('1102', '1102'),
    ('1103', '1107'),
    ('1301', '0502')
) AS m (anterior, nuevo)
JOIN codigo_anterior a ON a.codigo = m.anterior
JOIN tipo_documento t ON t.codigo = m.nuevo;

UPDATE documento d
SET tipo_documento_id = e.nuevo_id
FROM equivalencia e
WHERE d.tipo_documento_id = e.anterior_id;

UPDATE requisito r
SET tipo_documento_id = e.nuevo_id
FROM equivalencia e
WHERE r.tipo_documento_id = e.anterior_id;

UPDATE documento
SET datos = (datos - 'clase') || jsonb_build_object('categoria', datos -> 'clase')
WHERE datos ? 'clase'
  AND tipo_documento_id = (SELECT id FROM tipo_documento WHERE codigo = '0502');

DROP TABLE equivalencia;
DROP TABLE codigo_anterior;
