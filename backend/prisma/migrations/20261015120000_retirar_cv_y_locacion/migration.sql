UPDATE requisito
SET tipo_documento_id = (SELECT id FROM tipo_documento WHERE codigo = '0215')
WHERE tipo_documento_id = (SELECT id FROM tipo_documento WHERE codigo = '0201')
  AND EXISTS (SELECT 1 FROM tipo_documento WHERE codigo = '0215')
  AND NOT EXISTS (
    SELECT 1
    FROM requisito existente
    WHERE existente.tipo_documento_id = (SELECT id FROM tipo_documento WHERE codigo = '0215')
      AND existente.regimen_id IS NOT DISTINCT FROM requisito.regimen_id
      AND existente.tipo_personal IS NOT DISTINCT FROM requisito.tipo_personal
      AND existente.aplica_a = requisito.aplica_a
  );

UPDATE tipo_documento SET activo = false WHERE codigo IN ('0201', '0204');
