CREATE OR REPLACE FUNCTION "documento_archivo_inmutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('legajos.eliminar_documento', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Las versiones de archivo no se modifican: se agrega una nueva';
END;
$$;

INSERT INTO permiso (codigo, modulo, descripcion)
VALUES ('documentos.eliminar', 'documentos', 'Eliminar documentos de forma definitiva')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permiso (rol_id, permiso_codigo)
SELECT id, 'documentos.eliminar' FROM rol WHERE nombre = 'Administrador'
ON CONFLICT DO NOTHING;
