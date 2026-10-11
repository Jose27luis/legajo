CREATE INDEX "ix_documento_numero_trgm" ON "documento" USING gin (lower("numero") gin_trgm_ops);

CREATE INDEX "ix_documento_vencimiento" ON "documento"("fecha_vencimiento");

CREATE INDEX "ix_documento_creado" ON "documento"("creado_por", "creado_en");
