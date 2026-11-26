CREATE TYPE "TipoArea" AS ENUM ('DEPENDENCIA', 'MICRORED', 'EESS');

ALTER TABLE "area" ADD COLUMN "tipo" "TipoArea" NOT NULL DEFAULT 'DEPENDENCIA';

UPDATE area
SET tipo = 'MICRORED', activo = true
WHERE padre_id IS NULL
  AND nombre LIKE 'Microred %';

UPDATE area
SET tipo = 'EESS'
WHERE padre_id IN (
  SELECT id FROM area
  WHERE padre_id IS NULL
    AND (nombre LIKE 'Microred %' OR nombre = 'Establecimientos sin microred')
);
