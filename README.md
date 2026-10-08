# Sistema de Legajos de Personal

## Descripción

Sistema web del área de Legajos de la Oficina de Personal. Registra a los trabajadores con sus vínculos laborales y digitaliza su legajo personal en 13 secciones.

Incluye subida por partes y carga masiva de PDFs, descarga del legajo en ZIP, acceso restringido a documentos disciplinarios y médicos, auditoría de cada acción y copias de seguridad automáticas.

## Stack

| Capa | Tecnología | Uso |
|---|---|---|
| Frontend | HTML + TypeScript sin framework | Páginas HTML independientes, cada una con su módulo TypeScript |
| Empaquetado del frontend | Vite en modo multipágina | Compila el TypeScript, aplica hash a los recursos y deja todo en `dist` |
| Estilos | Tailwind CSS 4 | Integrado con Vite |
| Componentes reutilizables | Web Components nativos (`customElements`) | Tabla, visor de PDF, zona de subida, diálogo, menú |
| Visor de PDF | pdf.js (`pdfjs-dist`) | Vista en el navegador con carga progresiva por rangos |
| Subida de archivos | tus (`tus-js-client` y `@tus/server`) | Subida por partes y reanudable |
| API | NestJS 11 sobre Node 22 | REST, sesiones, subidas tus, ZIP en streaming, eventos SSE |
| Worker | NestJS 11 (mismo código, otro proceso) | Procesa PDFs, carga masiva, limpieza y backup |
| ORM | Prisma 7 | Esquema y migraciones; los índices especiales y triggers van en SQL dentro de las migraciones |
| Base de datos | PostgreSQL 17 con `pg_trgm` y `unaccent` | Datos y metadatos; los PDF van en disco |
| Colas, sesiones y eventos | Redis 7 + BullMQ | Colas de trabajo, sesiones de usuario y pub/sub de eventos |
| Procesamiento de PDF | Ghostscript y qpdf | Optimización, linealización, validación, conteo de folios y división |
| ZIP | `archiver` | ZIP en streaming, en modo `store` |
| Excel | `exceljs` en modo streaming | Exportación de reportes |
| Contraseñas | argon2id | Hash de contraseñas |
| Backup | `pg_dump` + restic | Copias incrementales, deduplicadas, comprimidas y cifradas |
| Servidor web | nginx | Estáticos, proxy, X-Accel-Redirect y gzip |
| Despliegue | Docker Compose | Instalación en el servidor de la entidad |
| Gestor de paquetes | pnpm (workspace) | `frontend`, `backend` y `compartido` |

## Arquitectura

```mermaid
flowchart LR
    subgraph cliente["Navegador del usuario"]
        UI["Páginas HTML + TypeScript<br/>Tailwind, Web Components"]
        TUS["tus-js-client<br/>subida por partes de 8 MB"]
        PDFJS["pdf.js<br/>visor por rangos"]
        SSE["EventSource<br/>estado de documentos"]
    end

    subgraph servidor["Servidor de la entidad - Docker Compose"]
        NGX["nginx<br/>estáticos, proxy /api,<br/>X-Accel-Redirect, gzip, TLS"]
        API["api - NestJS<br/>REST, sesiones, tus,<br/>ZIP en streaming, SSE"]
        WRK["worker - NestJS<br/>BullMQ: procesar-documento,<br/>carga-masiva, limpieza, backup"]
        PG[("PostgreSQL 17<br/>datos y metadatos")]
        RDS[("Redis 7<br/>sesiones, colas, pub/sub")]
        SUB[("Volumen subidas<br/>partes tus temporales")]
        ARC[("Volumen archivos<br/>PDF optimizados")]
    end

    REPO[("Repositorio restic<br/>disco secundario y copia remota")]

    UI -->|"HTTPS, cookie de sesión"| NGX
    TUS -->|"POST y PATCH /api/subidas"| NGX
    PDFJS -->|"GET con Range"| NGX
    SSE -->|"GET /api/eventos"| NGX
    NGX -->|"proxy /api"| API
    NGX -.->|"location interna /interno/archivos"| ARC
    API --> PG
    API --> RDS
    API -->|"escribe partes"| SUB
    API -->|"lee para el ZIP"| ARC
    WRK --> RDS
    WRK --> PG
    WRK -->|"lee original"| SUB
    WRK -->|"escribe optimizado"| ARC
    WRK -->|"pg_dump y restic"| REPO

    classDef borde fill:#1f3a5f,stroke:#16283f,color:#ffffff
    classDef proceso fill:#a96a00,stroke:#7d4f00,color:#ffffff
    classDef datos fill:#eef2f6,stroke:#9aa3a9,color:#1a1d21
    class NGX borde
    class API,WRK proceso
    class PG,RDS,SUB,ARC,REPO datos
```

- El worker corre aparte de la API para que Ghostscript no frene las pantallas.
- La sesión va en cookie HttpOnly. El frontend es multipágina y los enlaces de descarga y el visor la envían sin código adicional.
- Los PDF los entrega nginx con X-Accel-Redirect, con soporte de Range para el visor. La API solo valida permisos.
- El ZIP va en modo `store`: los PDF ya llegan optimizados desde la subida.
- Los archivos se guardan por trabajador y documento. Reclasificar un documento no mueve el archivo.
- Los documentos no se borran: se anulan con motivo.

## Despliegue

```mermaid
flowchart TB
    subgraph host["Servidor de la entidad"]
        subgraph compose["docker compose - proyecto legajos"]
            C_NGX["nginx<br/>puertos 80 y 443"]
            C_API["api<br/>puerto interno 3000"]
            C_WRK["worker<br/>sin puertos"]
            C_PG["postgres<br/>puerto interno 5432"]
            C_RDS["redis<br/>puerto interno 6379"]
        end
        V_PG[("vol: datos_pg")]
        V_RDS[("vol: datos_redis")]
        V_SUB[("vol: subidas<br/>/srv/legajos/subidas")]
        V_ARC[("vol: archivos<br/>/srv/legajos/archivos")]
        V_WEB[("vol: frontend dist<br/>solo lectura")]
        V_TLS[("certificados TLS<br/>solo lectura")]
        DISCO2[("Disco secundario<br/>/mnt/respaldo/restic")]
    end
    REMOTO[("Copia remota<br/>SFTP de la entidad")]

    C_NGX --- V_WEB
    C_NGX --- V_TLS
    C_NGX ---|"solo lectura"| V_ARC
    C_API --- V_SUB
    C_API ---|"solo lectura"| V_ARC
    C_WRK --- V_SUB
    C_WRK --- V_ARC
    C_WRK --- DISCO2
    C_PG --- V_PG
    C_RDS --- V_RDS
    C_NGX --> C_API
    C_API --> C_PG
    C_API --> C_RDS
    C_WRK --> C_PG
    C_WRK --> C_RDS
    C_WRK -->|"restic copy"| REMOTO
```

- Solo nginx publica puertos. PostgreSQL y Redis quedan en la red interna de Compose.
- La imagen del `worker` incluye `ghostscript`, `qpdf`, `restic` y `postgresql-client-17`. La imagen de la `api` no los necesita.
- La API monta el volumen de archivos en solo lectura. Solo el worker escribe ahí.

## Estructura del repositorio

```
legajos/
├── README.md
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
├── compartido/                  tipos TypeScript comunes a frontend y backend
│   └── src/
│       ├── permisos.ts          códigos de permiso
│       ├── enums.ts             estados, tipo de personal, motivos
│       └── dto/                 contratos de la API
├── backend/
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/          incluye SQL de pg_trgm, unaccent, índices y triggers
│   │   └── seed.ts              secciones, tipos de documento, regímenes, permisos y roles
│   └── src/
│       ├── main.ts              arranque de la API
│       ├── worker.ts            arranque del worker
│       ├── comun/               guard de sesión, guard de permisos, interceptor de auditoría, filtros
│       ├── auth/
│       ├── usuarios/            usuarios, roles y permisos
│       ├── catalogos/           secciones, tipos de documento, requisitos, regímenes, áreas, cargos
│       ├── personal/            trabajadores, familiares, vínculos
│       ├── legajo/              resumen por sección, completitud, ZIP
│       ├── documentos/          subidas tus, registro, descargas, versiones, anulación
│       ├── procesamiento/       procesadores BullMQ: PDF, carga masiva, limpieza
│       ├── carga-masiva/        lotes y bandeja de clasificación
│       ├── busqueda/
│       ├── reportes/
│       ├── auditoria/
│       ├── backup/
│       └── eventos/             SSE con Redis pub/sub
├── frontend/
│   ├── vite.config.ts           una entrada por cada página
│   ├── index.html               inicio de sesión
│   ├── paginas/                 un HTML por pantalla
│   └── src/
│       ├── api/                 cliente fetch tipado por módulo
│       ├── componentes/         Web Components
│       ├── paginas/             un módulo TS por pantalla
│       └── estilos/app.css
└── infra/
    ├── nginx/legajos.conf
    └── backup/restaurar.sh
```

## Estructura del legajo

Cada trabajador tiene una ficha de datos y 13 secciones de documentos.

```mermaid
flowchart LR
    T["Trabajador"] --> F["Ficha de datos<br/>identificación, contacto,<br/>familiares, vínculos"]
    T --> L["Legajo digital"]
    L --> S01["01 Información personal y familiar"]
    L --> S02["02 Incorporación"]
    L --> S03["03 Formación académica y capacitación"]
    L --> S04["04 Experiencia laboral"]
    L --> S05["05 Movimientos del personal"]
    L --> S06["06 Compensaciones"]
    L --> S07["07 Evaluación de desempeño y progresión en la carrera"]
    L --> S08["08 Reconocimientos y sanciones disciplinarias"]
    L --> S09["09 Relaciones laborales individuales y colectivas"]
    L --> S10["10 Seguridad y Salud en el Trabajo y bienestar social"]
    L --> S11["11 Desvinculación"]
    L --> S12["12 Otros que considere la entidad"]
    L --> S13["13 Vacaciones, licencias y permisos"]

    classDef restringida fill:#7a1f1f,stroke:#521414,color:#ffffff
    class S08,S10,S13 restringida
```

En rojo, las secciones con tipos de acceso restringido. La restricción va por tipo de documento: en la sección 08 los reconocimientos son visibles y las sanciones no.

### Reglas de clasificación

| Documento | Dónde va |
|---|---|
| Contratos con número (CAS N.° 036-2022, Contrato Administrativo N.° 0089-2022) | Tipo 0202 o 0203, con `036-2022` o `0089-2022` en el campo número |
| Tipo de personal, régimen, cargo, área y fecha de ingreso | Campos de la ficha y del vínculo, no se suben como PDF |
| Resolución de nombramiento y resolución CAS | 02 Incorporación |
| Resolución SERUMS | 04 Experiencia laboral |
| Descanso médico común | 13, restringido |
| Descanso médico por accidente de trabajo o enfermedad ocupacional | 10, restringido |
| Constancia de trabajo de un empleador anterior | 04 Experiencia laboral |
| Constancia de trabajo emitida al cese | 11 Desvinculación |
| Memorandos | Según su finalidad: rotación o encargatura en la 05, desempeño en la 07, reconocimiento o disciplina en la 08 |
| Licencias y permisos | 13. En la 10 solo los vinculados a seguridad y salud en el trabajo |
| Contrato de locación de servicios | 02 Incorporación, con régimen "Locación de servicios" (no laboral) |

### Catálogo de tipos de documento

Código de cuatro dígitos: sección y tipo. El 99 de cada sección es "Otro". R = restringido, Nº = número obligatorio, V = tiene vencimiento. El administrador puede agregar, desactivar o reordenar tipos.

**01 Información personal y familiar** (carpeta `01_Informacion_Personal_y_Familiar`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0101 | DNI | | | Sí |
| 0102 | Ficha de datos personales | | | |
| 0103 | Domicilio y contacto (sustento) | | | |
| 0104 | Datos familiares (partidas, actas y otros sustentos) | | | |
| 0105 | Declaración jurada personal | | | |
| 0199 | Otro documento de identificación del trabajador | | | |

**02 Incorporación** (carpeta `02_Incorporacion`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0201 | Currículum vitae | | | |
| 0202 | Contrato Administrativo de Servicios (CAS) | | Sí | Sí |
| 0203 | Contrato administrativo | | Sí | Sí |
| 0204 | Contrato de locación de servicios | | Sí | Sí |
| 0205 | Adenda | | Sí | Sí |
| 0206 | Renovación o prórroga | | Sí | Sí |
| 0207 | Resolución de nombramiento | | Sí | |
| 0208 | Resolución CAS | | Sí | |
| 0209 | Documentos presentados para la contratación (ficha curricular, solicitudes, copia de DNI, títulos, certificados y constancias laborales presentados en la convocatoria) | | | |
| 0210 | Declaración jurada de contratación | | | |
| 0211 | Anexo de convocatoria | | | |
| 0212 | Documento de adjudicación o resultado | | | |
| 0299 | Otro documento relacionado con el ingreso o la contratación | | | |

**03 Formación académica y capacitación** (carpeta `03_Formacion_Academica_y_Capacitacion`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0301 | Registro Nacional de Grados Académicos y Títulos Profesionales | | | |
| 0302 | Título profesional | | | |
| 0303 | Grado académico | | | |
| 0304 | Título técnico | | | |
| 0305 | Constancia de estudios | | | |
| 0306 | Colegiatura | | Sí | |
| 0307 | Constancia de habilitación profesional | | | Sí |
| 0308 | Especialización | | | |
| 0309 | Registro de especialidad | | Sí | |
| 0310 | Certificado | | | |
| 0311 | Curso | | | |
| 0312 | Diplomado | | | |
| 0313 | Taller | | | |
| 0314 | Seminario | | | |
| 0315 | Constancia de capacitación | | | |
| 0399 | Otro documento académico o de capacitación | | | |

**04 Experiencia laboral** (carpeta `04_Experiencia_Laboral`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0401 | Constancia de trabajo de empleador anterior | | | |
| 0402 | Certificado de trabajo | | | |
| 0403 | Resolución que acredita servicios anteriores | | Sí | |
| 0404 | Resolución SERUMS | | Sí | |
| 0499 | Otro documento que acredite experiencia laboral | | | |

**05 Movimientos del personal** (carpeta `05_Movimientos_del_Personal`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0501 | Memorando de rotación | | Sí | |
| 0502 | Memorando de encargatura | | Sí | |
| 0503 | Cambio de funciones | | Sí | |
| 0504 | Destaque | | Sí | Sí |
| 0505 | Reasignación | | Sí | |
| 0506 | Designación | | Sí | |
| 0507 | Resolución Directoral Regional | | Sí | |
| 0508 | Resolución relacionada con movimientos | | Sí | |
| 0599 | Otro memorando de acción de personal | | | |

**06 Compensaciones** (carpeta `06_Compensaciones`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0601 | Documento de remuneraciones | | | |
| 0602 | Bonificación | | | |
| 0603 | Asignación | | | |
| 0604 | Beneficio laboral | | | |
| 0699 | Otro documento económico | | | |

**07 Evaluación de desempeño y progresión en la carrera** (carpeta `07_Evaluacion_y_Progresion`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0701 | Evaluación de desempeño | | | |
| 0702 | Informe de desempeño o de jefatura | | | |
| 0703 | Evaluación periódica | | | |
| 0704 | Documento de ascenso o progresión | | Sí | |
| 0705 | Memorando relacionado con desempeño | | Sí | |
| 0799 | Otro documento de evaluación laboral | | | |

**08 Reconocimientos y sanciones disciplinarias** (carpeta `08_Reconocimientos_y_Sanciones`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0801 | Reconocimiento | | | |
| 0802 | Felicitación | | | |
| 0803 | Memorando de reconocimiento | | Sí | |
| 0804 | Amonestación | Sí | Sí | |
| 0805 | Memorando disciplinario | Sí | Sí | |
| 0806 | Resolución sancionadora | Sí | Sí | |
| 0807 | Proceso administrativo disciplinario | Sí | Sí | |
| 0808 | Suspensión | Sí | Sí | |
| 0899 | Otro documento disciplinario | Sí | | |

**09 Relaciones laborales individuales y colectivas** (carpeta `09_Relaciones_Laborales`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 0901 | Comunicación laboral | | | |
| 0902 | Solicitud sobre condiciones laborales | | | |
| 0903 | Documento de relación individual | | | |
| 0904 | Documento colectivo | | | |
| 0999 | Otro documento de relaciones laborales | | | |

**10 Seguridad y Salud en el Trabajo y bienestar social** (carpeta `10_SST_y_Bienestar_Social`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 1001 | Documento de SST | | | |
| 1002 | Evaluación ocupacional | Sí | | Sí |
| 1003 | Documento de bienestar social | | | |
| 1004 | Licencia o descanso médico de origen ocupacional | Sí | | |
| 1099 | Otro documento de SST o bienestar | | | |

**11 Desvinculación** (carpeta `11_Desvinculacion`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 1101 | Carta de renuncia | | | |
| 1102 | Resolución de cese | | Sí | |
| 1103 | Resolución por término o finalización de contrato | | Sí | |
| 1104 | Constancia de trabajo emitida por la entidad | | | |
| 1105 | Liquidación | | | |
| 1106 | Entrega de cargo | | | |
| 1199 | Otro documento de salida | | | |

**12 Otros que considere la entidad** (carpeta `12_Otros`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 1201 | Comunicación administrativa | | | |
| 1202 | Documentación complementaria | | | |
| 1203 | Anexo | | | |
| 1299 | Documento que no corresponde a otra sección | | | |

**13 Vacaciones, licencias y permisos** (carpeta `13_Vacaciones_Licencias_y_Permisos`)

| Código | Tipo | R | Nº | V |
|---|---|---|---|---|
| 1301 | Resolución de vacaciones | | Sí | |
| 1302 | Solicitud de vacaciones | | | |
| 1303 | Rol de vacaciones | | | |
| 1304 | Licencia con goce | | | |
| 1305 | Licencia sin goce | | | |
| 1306 | Permiso | | | |
| 1307 | Descanso médico | Sí | | |
| 1399 | Otro documento de ausencias autorizadas | | | |

## Módulos

| Módulo | Función |
|---|---|
| Usuarios | Crear usuarios, roles y permisos |
| Personal | Registrar trabajadores, familiares y vínculos laborales |
| Legajo | Consultar el expediente completo por secciones, ver y descargar documentos |
| Documentos | Subir PDFs y clasificarlos, de uno en uno o por carga masiva |
| Búsqueda | Por DNI, nombre, documento y fecha |
| Reportes | Listados y documentos faltantes |
| Auditoría | Registrar quién realizó cada acción |
| Backup | Copias de seguridad |
| Catálogos | Secciones, tipos de documento, documentos obligatorios, regímenes, áreas y cargos (lo administra el rol Administrador) |

## Modelo de datos

```mermaid
erDiagram
    ROL ||--o{ USUARIO : "asignado a"
    ROL ||--o{ ROL_PERMISO : agrupa
    PERMISO ||--o{ ROL_PERMISO : "incluido en"

    TRABAJADOR ||--o{ FAMILIAR : registra
    TRABAJADOR ||--o{ VINCULO : tiene
    REGIMEN ||--o{ VINCULO : clasifica
    CARGO ||--o{ VINCULO : ocupa
    AREA ||--o{ VINCULO : "ubica en"
    AREA |o--o{ AREA : "depende de"

    SECCION ||--|{ TIPO_DOCUMENTO : agrupa
    TIPO_DOCUMENTO ||--o{ REQUISITO : "es exigido por"
    REGIMEN |o--o{ REQUISITO : "filtra"

    TRABAJADOR ||--o{ DOCUMENTO : "legajo de"
    TIPO_DOCUMENTO ||--o{ DOCUMENTO : clasifica
    DOCUMENTO ||--|{ DOCUMENTO_ARCHIVO : versiones
    DOCUMENTO |o--o{ VINCULO : sustenta
    USUARIO ||--o{ DOCUMENTO : registra
    USUARIO ||--o{ DOCUMENTO_ARCHIVO : sube

    USUARIO ||--o{ LOTE_CARGA : crea
    LOTE_CARGA ||--|{ LOTE_ITEM : contiene
    DOCUMENTO |o--o| LOTE_ITEM : "se origina en"
    TRABAJADOR |o--o{ LOTE_ITEM : "se asigna a"
    TIPO_DOCUMENTO |o--o{ LOTE_ITEM : "se clasifica como"

    USUARIO |o--o{ AUDITORIA : genera
    TRABAJADOR |o--o{ AUDITORIA : "afecta a"
    USUARIO |o--o{ BACKUP_EJECUCION : "lanza manualmente"

    USUARIO {
        uuid id PK
        varchar usuario UK
        varchar nombre_completo
        varchar correo
        text clave_hash "argon2id"
        uuid rol_id FK
        bool activo
        int intentos_fallidos
        timestamptz bloqueado_hasta
        bool debe_cambiar_clave
        timestamptz ultimo_acceso
        timestamptz creado_en
        timestamptz actualizado_en
    }
    ROL {
        uuid id PK
        varchar nombre UK
        text descripcion
        bool es_sistema "no se puede borrar"
    }
    PERMISO {
        varchar codigo PK "ej. documentos.subir"
        varchar modulo
        text descripcion
    }
    ROL_PERMISO {
        uuid rol_id PK, FK
        varchar permiso_codigo PK, FK
    }
    REGIMEN {
        int id PK
        varchar codigo UK "DL276, DL728, DL1057, L30057, LOCACION"
        varchar nombre
        bool es_laboral "false en locación"
        bool activo
    }
    AREA {
        int id PK
        varchar nombre
        int padre_id FK "dependencia superior"
        bool activo
    }
    CARGO {
        int id PK
        varchar nombre UK
        bool activo
    }
    TRABAJADOR {
        uuid id PK
        varchar tipo_doc_identidad "DNI o CE"
        varchar numero_doc UK
        varchar apellido_paterno
        varchar apellido_materno
        varchar nombres
        text nombre_busqueda "columna generada sin tildes"
        date fecha_nacimiento
        varchar sexo
        varchar estado_civil
        text direccion
        varchar departamento
        varchar provincia
        varchar distrito
        varchar telefono
        varchar correo
        date fecha_ingreso "ingreso a la institución"
        varchar estado "ACTIVO o CESADO"
        timestamptz creado_en
        timestamptz actualizado_en
    }
    FAMILIAR {
        uuid id PK
        uuid trabajador_id FK
        varchar parentesco
        varchar numero_doc
        varchar nombres_apellidos
        date fecha_nacimiento
    }
    VINCULO {
        uuid id PK
        uuid trabajador_id FK
        int regimen_id FK
        varchar tipo_personal "ADMINISTRATIVO o ASISTENCIAL"
        int cargo_id FK
        int area_id FK
        date fecha_inicio
        date fecha_fin "nulo mientras está vigente"
        varchar motivo_fin
        uuid documento_sustento_id FK
        bool vigente "único vigente por trabajador"
    }
    SECCION {
        int id PK
        int numero UK "1 a 13"
        varchar nombre
        varchar carpeta "nombre de carpeta en el ZIP"
        text descripcion
    }
    TIPO_DOCUMENTO {
        int id PK
        int seccion_id FK
        varchar codigo UK "4 dígitos"
        varchar nombre
        bool restringido
        bool requiere_numero
        bool tiene_vencimiento
        bool activo
        int orden
    }
    REQUISITO {
        int id PK
        int tipo_documento_id FK
        int regimen_id FK "nulo = todos"
        varchar tipo_personal "nulo = ambos"
        varchar aplica_a "ACTIVO, CESADO o TODOS"
    }
    DOCUMENTO {
        uuid id PK
        uuid trabajador_id FK
        int tipo_documento_id FK
        varchar numero
        date fecha_emision
        date fecha_vencimiento
        varchar emisor
        text observaciones
        varchar ubicacion_fisica "caja o archivador del original"
        varchar estado "PROCESANDO, DISPONIBLE, ERROR, ANULADO"
        text detalle_error
        text motivo_anulacion
        uuid archivo_actual_id FK
        uuid creado_por FK
        timestamptz creado_en
        timestamptz actualizado_en
    }
    DOCUMENTO_ARCHIVO {
        uuid id PK
        uuid documento_id FK
        int version
        varchar ruta "relativa al volumen archivos"
        bigint tamano_original
        bigint tamano_final
        char hash_original "SHA-256 del PDF subido"
        char hash_final "SHA-256 del PDF guardado"
        int paginas "folios"
        bool optimizado
        uuid subido_por FK
        timestamptz creado_en
    }
    LOTE_CARGA {
        uuid id PK
        uuid usuario_id FK
        varchar estado "SUBIENDO, EN_BANDEJA, TERMINADO"
        int total
        int clasificados
        int pendientes
        int con_error
        timestamptz creado_en
        timestamptz terminado_en
    }
    LOTE_ITEM {
        uuid id PK
        uuid lote_id FK
        varchar nombre_archivo
        varchar subida_id "id tus"
        uuid trabajador_id FK
        int tipo_documento_id FK
        varchar estado "SUBIENDO, PENDIENTE, CLASIFICADO, DIVIDIDO, ERROR"
        text motivo_pendiente
        uuid documento_id FK
    }
    AUDITORIA {
        bigint id PK
        timestamptz fecha
        uuid usuario_id FK
        varchar accion
        varchar entidad
        varchar entidad_id
        uuid trabajador_id FK "para filtrar por legajo"
        inet ip
        text user_agent
        jsonb detalle "antes y después, filtros, lista de documentos"
    }
    BACKUP_EJECUCION {
        uuid id PK
        varchar origen "PROGRAMADO o MANUAL"
        uuid usuario_id FK
        timestamptz inicio
        timestamptz fin
        varchar estado "EN_CURSO, CORRECTO, ERROR"
        varchar snapshot_bd
        varchar snapshot_archivos
        bigint bytes_agregados
        bool verificado
        text error
    }
```

Restricciones e índices que se crean con SQL en las migraciones:

| Objeto | Definición | Para qué |
|---|---|---|
| `f_unaccent(text)` | Envoltorio `IMMUTABLE` de `unaccent` | Permite usar `unaccent` en columnas generadas e índices |
| `trabajador.nombre_busqueda` | Columna generada: `lower(f_unaccent(apellido_paterno || ' ' || apellido_materno || ' ' || nombres))` | Búsqueda sin tildes ni mayúsculas |
| `ix_trabajador_nombre_trgm` | GIN `gin_trgm_ops` sobre `nombre_busqueda` | Búsqueda parcial por nombre |
| `ux_trabajador_doc` | Único sobre `(tipo_doc_identidad, numero_doc)` | Un trabajador por documento de identidad |
| `ux_vinculo_vigente` | Único parcial sobre `trabajador_id` donde `vigente` | Solo un vínculo vigente a la vez |
| `ix_documento_numero_trgm` | GIN `gin_trgm_ops` sobre `lower(numero)` | Búsqueda por número de documento |
| `ix_documento_legajo` | B-tree sobre `(trabajador_id, tipo_documento_id, fecha_emision)` | Carga del legajo ordenado |
| `ix_documento_fecha` | B-tree sobre `fecha_emision` | Búsqueda por rango de fechas |
| `ux_archivo_hash` | Único sobre `(documento_id, hash_original)` | Impide subir dos veces el mismo PDF como versión del mismo documento |
| `ix_archivo_hash_original` | B-tree sobre `hash_original` | Detección de duplicados dentro del legajo |
| `ix_auditoria_legajo` | B-tree sobre `(trabajador_id, fecha DESC)` | Historial de un legajo |
| `ix_auditoria_usuario` | B-tree sobre `(usuario_id, fecha DESC)` | Actividad de un usuario |
| `tg_auditoria_inmutable` | Trigger `BEFORE UPDATE OR DELETE` que lanza una excepción | La auditoría no se puede modificar ni borrar |
| `tg_documento_archivo_inmutable` | Trigger `BEFORE UPDATE OR DELETE` | Las versiones de archivo no se modifican: se agrega una nueva |

## Ciclos de vida

### Trabajador y vínculo

Trabajador:

```mermaid
stateDiagram-v2
    [*] --> ACTIVO : registro con vínculo inicial
    ACTIVO --> ACTIVO : nuevo vínculo que reemplaza al vigente
    ACTIVO --> CESADO : se finaliza el vínculo vigente sin abrir otro
    CESADO --> ACTIVO : reingreso con un vínculo nuevo
```

Vínculo:

```mermaid
stateDiagram-v2
    [*] --> VIGENTE : alta, renovación, cambio de régimen, cargo o área
    VIGENTE --> FINALIZADO : fecha de fin y motivo
    FINALIZADO --> [*]
```

Motivos de fin de vínculo: `RENUNCIA`, `TERMINO_CONTRATO`, `CESE`, `CAMBIO_REGIMEN`, `CAMBIO_CARGO_O_AREA`, `RENOVACION`, `FALLECIMIENTO`, `OTRO`.

El trabajador no se borra. Al cesar, su legajo sigue consultable y en faltantes se le exigen los documentos de cese.

### Documento

```mermaid
stateDiagram-v2
    [*] --> PROCESANDO : registro con subida completa
    PROCESANDO --> DISPONIBLE : optimizado, linealizado y guardado
    PROCESANDO --> ERROR : PDF dañado, con contraseña, duplicado o falla tras 3 reintentos
    ERROR --> PROCESANDO : reintentar (falla técnica)
    ERROR --> ANULADO : descartar con motivo
    DISPONIBLE --> DISPONIBLE : editar metadatos o reclasificar
    DISPONIBLE --> PROCESANDO : reemplazar archivo (nueva versión)
    DISPONIBLE --> ANULADO : anular con motivo
    ANULADO --> [*]
```

- Mientras un reemplazo está en proceso, la versión anterior sigue visible.
- Un documento anulado no aparece en el legajo ni en las descargas, pero lo pueden ver con un filtro los roles con permiso `documentos.anular`.

## Flujos

### Alta de trabajador y cese

```mermaid
flowchart TD
    A(["Personal: Nuevo trabajador"]) --> B["Ingresa tipo y número de documento"]
    B --> C{"¿Ya existe?"}
    C -->|"sí, ACTIVO"| D["Abre su ficha<br/>sin duplicar"]
    C -->|"sí, CESADO"| E["Abre su ficha<br/>opción Reingreso: nuevo vínculo"]
    C -->|"no"| F["Datos personales<br/>nombres, nacimiento, sexo, estado civil"]
    F --> G["Domicilio y contacto"]
    G --> H["Vínculo inicial<br/>régimen, tipo de personal, cargo,<br/>área, fecha de inicio"]
    H --> I{"¿Fecha de ingreso indicada?"}
    I -->|"no"| J["fecha_ingreso = fecha de inicio del vínculo"]
    I -->|"sí"| K["Guarda la indicada"]
    J --> L["Transacción: trabajador + vínculo vigente<br/>auditoría TRABAJADOR_CREAR"]
    K --> L
    E --> H
    L --> M["Abre el legajo con las 13 secciones vacías<br/>y la lista de faltantes según su régimen"]
    M --> N["Familiares opcionales"]
    M --> O["Subida de documentos"]

    P(["Registrar cese"]) --> Q["Fecha de fin y motivo"]
    Q --> R["Documento sustento opcional<br/>ej. resolución de cese"]
    R --> S["Vínculo FINALIZADO<br/>trabajador CESADO<br/>auditoría VINCULO_FINALIZAR"]
    S --> T["Faltantes exige requisitos con aplica_a CESADO"]
```

### Inicio de sesión

```mermaid
sequenceDiagram
    actor U as Usuario
    participant N as Navegador
    participant X as nginx
    participant A as API
    participant R as Redis
    participant P as PostgreSQL

    U->>N: Ingresa usuario y contraseña
    N->>X: POST /api/auth/login
    X->>A: reenvía
    A->>A: límite de 10 intentos por minuto por IP
    A->>P: busca usuario activo
    alt usuario inexistente o inactivo
        A->>P: auditoría LOGIN_FALLIDO
        A-->>N: 401 credenciales inválidas
    else bloqueado_hasta en el futuro
        A-->>N: 423 cuenta bloqueada temporalmente
    else contraseña incorrecta
        A->>P: intentos_fallidos más 1
        A->>P: al llegar a 5, bloqueado_hasta = ahora más 15 minutos
        A->>P: auditoría LOGIN_FALLIDO
        A-->>N: 401 credenciales inválidas
    else contraseña correcta
        A->>P: intentos_fallidos = 0, ultimo_acceso = ahora
        A->>P: carga rol y permisos
        A->>R: SET sesion:sid con usuario y permisos, expira en 30 minutos
        A->>R: SADD usuario:id:sesiones sid
        A->>P: auditoría LOGIN
        A-->>N: 200 y cookie sid HttpOnly, Secure, SameSite=Strict
        alt debe_cambiar_clave
            N->>N: va a cambiar-clave.html
        else
            N->>N: va a inicio.html
        end
    end
```

- La sesión se renueva con cada petición y expira tras 30 minutos sin actividad.
- Al cambiar el rol de un usuario o los permisos de un rol, se borran las sesiones afectadas usando el conjunto `usuario:id:sesiones`: el cambio rige de inmediato.
- Al cerrar sesión se borra la clave en Redis y se registra `LOGOUT`.

### Autorización de cada petición

```mermaid
flowchart TD
    A(["Petición a /api"]) --> B{"¿Ruta pública?<br/>solo /auth/login"}
    B -->|"sí"| Z["Ejecuta"]
    B -->|"no"| C{"¿Cookie sid?"}
    C -->|"no"| E401["401: el frontend redirige al login"]
    C -->|"sí"| D{"¿sesion:sid existe en Redis?"}
    D -->|"no"| E401
    D -->|"sí"| F["Renueva la expiración a 30 minutos"]
    F --> G{"¿Método POST, PATCH o DELETE?"}
    G -->|"sí"| H{"¿Cabecera X-Legajos: 1?"}
    H -->|"no"| E403C["403: protección CSRF"]
    H -->|"sí"| I
    G -->|"no"| I{"¿La ruta exige un permiso?<br/>decorador Permiso"}
    I -->|"no"| K
    I -->|"sí"| J{"¿La sesión tiene ese permiso?"}
    J -->|"no"| E403["403 y auditoría ACCESO_DENEGADO"]
    J -->|"sí"| K{"¿Toca un documento de tipo restringido?"}
    K -->|"no"| Z
    K -->|"sí"| L{"¿Tiene documentos.restringidos?"}
    L -->|"no"| E404["404: no revela que el documento existe"]
    L -->|"sí"| Z
    Z --> M["Interceptor de auditoría"]
    M --> N(["Respuesta"])
```

Sin `documentos.restringidos`, los tipos restringidos se filtran en SQL: no salen en el legajo, la búsqueda, los conteos ni los ZIP.

### Subida de un documento

El archivo se empieza a subir al soltarlo, mientras el digitador llena los datos.

```mermaid
sequenceDiagram
    actor D as Digitador
    participant N as Navegador
    participant X as nginx
    participant A as API
    participant S as Volumen subidas
    participant P as PostgreSQL
    participant Q as Redis y BullMQ
    participant W as Worker
    participant F as Volumen archivos

    D->>N: Suelta el PDF en una sección del legajo
    N->>N: valida extensión .pdf y tamaño máximo de 200 MB
    par Subida del archivo
        N->>X: POST /api/subidas con Upload-Length
        X->>A: reenvía
        A->>A: valida sesión y permiso documentos.subir
        A->>S: crea el archivo vacío y su metadata con el usuario dueño
        A-->>N: 201 Location /api/subidas/id
        loop cada parte de 8 MB
            N->>X: PATCH /api/subidas/id con Upload-Offset
            X->>A: reenvía sin buffer
            A->>S: escribe la parte directo a disco
            A-->>N: 204 con el nuevo Upload-Offset
        end
        Note over N,A: si se corta la red, HEAD devuelve el offset y la subida continúa desde ahí
        A->>S: al completar, comprueba que el archivo empiece con la firma de PDF
    and Datos del documento
        D->>N: tipo, número, fecha de emisión, vencimiento, emisor, observaciones, ubicación física
        N->>N: valida número y vencimiento obligatorios según el tipo
    end
    N->>X: POST /api/documentos con subidaId y datos
    X->>A: reenvía
    A->>S: comprueba que la subida sea del usuario y esté completa
    A->>P: INSERT documento en PROCESANDO
    A->>Q: encola procesar-documento
    A->>P: auditoría DOCUMENTO_SUBIR
    A-->>N: 202 documento en proceso
    N-->>D: el documento aparece en la sección como Procesando
    Note over D,N: el digitador ya puede soltar el siguiente archivo
    Q->>W: entrega el trabajo
    W->>S: lee el original
    W->>W: valida, optimiza, linealiza, calcula hash y folios
    W->>F: escribe trabajador/documento/v1.pdf
    W->>P: INSERT documento_archivo y documento DISPONIBLE
    W->>S: borra la subida temporal
    W->>Q: PUBLISH evento documento-listo
    Q-->>A: recibe el evento por pub/sub
    A-->>N: SSE documento-listo
    N-->>D: el documento pasa a Disponible
```

- Hasta 3 archivos en paralelo; el resto queda en cola con barra de progreso.
- `/api/subidas` en nginx: `proxy_request_buffering off` y `client_max_body_size 10m`.
- Una subida que no se registra como documento en 24 horas la borra el trabajo `limpiar-subidas`, que corre cada hora.

### Procesamiento del PDF en el worker

```mermaid
flowchart TD
    I(["Trabajo procesar-documento"]) --> L["Lee la subida temporal"]
    L --> HO["Calcula SHA-256 del original"]
    HO --> DUP{"¿El mismo hash_original ya existe<br/>en un documento no anulado del trabajador?"}
    DUP -->|"sí"| E3["ERROR: duplicado del documento existente"]
    DUP -->|"no"| CHK{"qpdf --check"}
    CHK -->|"dañado"| E1["ERROR: PDF dañado"]
    CHK -->|"válido"| ENC{"¿Cifrado?"}
    ENC -->|"con contraseña de apertura"| E2["ERROR: PDF protegido con contraseña"]
    ENC -->|"solo restricciones de edición"| DEC["qpdf --decrypt"]
    ENC -->|"no"| GS
    DEC --> GS["Ghostscript pdfwrite<br/>imágenes a 150 ppp, JPEG,<br/>fuentes subconjunto"]
    GS --> GSOK{"¿Ghostscript terminó bien?"}
    GSOK -->|"no"| RT{"¿Quedan reintentos?<br/>3 con espera creciente"}
    RT -->|"sí"| GS
    RT -->|"no"| E4["ERROR: no se pudo procesar"]
    GSOK -->|"sí"| CMP{"¿Resultado menor al 95 %<br/>del tamaño original?"}
    CMP -->|"sí"| OPT["Usa el optimizado"]
    CMP -->|"no"| ORI["Conserva el original"]
    OPT --> LIN["qpdf --linearize --object-streams=generate"]
    ORI --> LIN
    LIN --> PAG["qpdf --show-npages: folios<br/>SHA-256 del final"]
    PAG --> MV["Escribe vN.pdf.tmp y rename atómico<br/>a trabajador/documento/vN.pdf"]
    MV --> TX["Transacción: INSERT documento_archivo,<br/>archivo_actual_id y estado DISPONIBLE"]
    TX --> DEL["Borra la subida temporal"]
    DEL --> OK(["Evento documento-listo"])
    E1 --> KO(["Evento documento-error con el motivo"])
    E2 --> KO
    E3 --> KO
    E4 --> KO
```

Parámetros de Ghostscript:

```
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.7 -dPDFSETTINGS=/ebook
   -dDownsampleColorImages=true -dColorImageResolution=150
   -dDownsampleGrayImages=true -dGrayImageResolution=150
   -dDownsampleMonoImages=true -dMonoImageResolution=300
   -dDetectDuplicateImages=true -dSubsetFonts=true
   -dNOPAUSE -dBATCH -dSAFER -dQUIET
   -sOutputFile=<salida> <entrada>
```

- `OPTIMIZAR_GRISES=true` agrega `-sColorConversionStrategy=Gray -dProcessColorModel=/DeviceGray`. Por defecto se mantiene el color (sellos y firmas).
- Resolución en `OPTIMIZAR_PPP`, 150 por defecto.
- Concurrencia en `WORKER_CONCURRENCIA`, por defecto núcleos menos uno.
- Del original solo se guarda el hash.

### Carga masiva

Para digitalizar los legajos en papel. Se selecciona una carpeta o varios PDFs.

Convención de nombres:

```
<DNI>_<CÓDIGO>[_<NÚMERO>][_<AAAAMMDD>].pdf

45781236_0101.pdf                          DNI del trabajador
45781236_0202_036-2022_20220115.pdf        Contrato CAS N.° 036-2022 del 15/01/2022
45781236_0302_20190520.pdf                 Título profesional del 20/05/2019
```

La fecha siempre va al final. Si hay un solo dato después del código y es una fecha válida de 8 dígitos, se toma como fecha; si no, como número.

```mermaid
flowchart TD
    A(["Carga masiva"]) --> B["Selecciona una carpeta o varios PDFs"]
    B --> C["El navegador interpreta cada nombre<br/>sin subir nada todavía"]
    C --> D["Vista previa: reconocidos y no reconocidos,<br/>trabajador y tipo detectados"]
    D --> E["POST /api/lotes con la lista de archivos"]
    E --> F["Sube con tus, 3 en paralelo,<br/>progreso por archivo y total"]
    F --> G["Al completar cada archivo:<br/>POST /api/lotes/id/items/id/completar"]
    G --> H{"¿El nombre sigue la convención?"}
    H -->|"no"| PEN["Ítem PENDIENTE<br/>motivo: nombre no reconocido"]
    H -->|"sí"| I{"¿Existe el trabajador con ese DNI?"}
    I -->|"no"| PEN2["Ítem PENDIENTE<br/>motivo: trabajador no registrado"]
    I -->|"sí"| J{"¿Existe el código de tipo y está activo?"}
    J -->|"no"| PEN3["Ítem PENDIENTE<br/>motivo: tipo desconocido"]
    J -->|"sí"| K{"¿El tipo exige número y no viene?"}
    K -->|"sí"| PEN4["Ítem PENDIENTE<br/>motivo: falta el número"]
    K -->|"no"| L["Crea documento PROCESANDO<br/>encola procesar-documento"]
    L --> M["Ítem CLASIFICADO"]

    PEN --> BAN
    PEN2 --> BAN
    PEN3 --> BAN
    PEN4 --> BAN
    BAN["Bandeja del lote"] --> O{"Acción del digitador"}
    O -->|"Clasificar"| P["Elige trabajador, tipo y datos<br/>viendo el PDF en el visor"]
    P --> L
    O -->|"Dividir"| Q["Ve las páginas del PDF,<br/>marca rangos y asigna tipo y datos a cada uno"]
    Q --> R["qpdf --pages extrae cada rango<br/>como una subida nueva"]
    R --> S["Un documento por rango<br/>ítem original DIVIDIDO"]
    S --> L
    O -->|"Descartar"| T["Ítem ERROR con motivo<br/>se borra la subida temporal"]

    M --> FIN{"¿Quedan ítems pendientes?"}
    T --> FIN
    FIN -->|"no"| U(["Lote TERMINADO"])
    FIN -->|"sí"| BAN
```

- Dividir: para cuando el escáner saca un solo PDF con todo el legajo.
- Cada PDF del lote pasa por el mismo procesamiento que una subida individual.
- Los totales del lote alimentan el reporte de digitalización.

### Ver y descargar un documento

```mermaid
sequenceDiagram
    actor U as Usuario
    participant N as Navegador
    participant X as nginx
    participant A as API
    participant P as PostgreSQL
    participant F as Volumen archivos

    U->>N: Abre un documento del legajo
    N->>X: GET /api/documentos/id/archivo
    X->>A: reenvía
    A->>A: sesión, permiso documentos.ver y regla de restringidos
    A->>P: busca la versión actual del archivo
    A->>P: auditoría DOCUMENTO_VER
    A-->>X: 200 con X-Accel-Redirect /interno/archivos/ruta, Content-Disposition inline
    X->>F: lee el archivo
    X-->>N: primeros bytes del PDF linealizado
    N-->>U: pdf.js muestra la primera página
    loop páginas siguientes a medida que se navega
        N->>X: GET con Range de bytes
        X->>F: lee solo ese rango
        X-->>N: 206 contenido parcial
    end

    U->>N: Descargar
    N->>X: GET /api/documentos/id/archivo?descarga=1
    X->>A: reenvía
    A->>A: además exige documentos.descargar
    A->>P: auditoría DOCUMENTO_DESCARGAR
    A-->>X: X-Accel-Redirect con Content-Disposition attachment
    X->>F: lee el archivo
    X-->>N: PDF completo
```

- `location /interno/archivos/` es `internal` en nginx.
- Nombre de descarga: `<CÓDIGO>_<TIPO>_<NÚMERO>_<AAAA-MM-DD>.pdf`.

### Descarga comprimida en ZIP

Legajo completo, secciones marcadas o documentos seleccionados.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant N as Navegador
    participant X as nginx
    participant A as API
    participant P as PostgreSQL
    participant F as Volumen archivos

    U->>N: Descargar legajo completo, secciones marcadas o documentos seleccionados
    N->>X: GET /api/legajos/id/zip?secciones=2,3,5
    X->>A: reenvía
    A->>A: sesión y permiso documentos.descargar
    A->>P: documentos DISPONIBLES del trabajador, sin restringidos si no tiene el permiso
    A->>P: auditoría LEGAJO_DESCARGAR con la lista de documentos incluidos
    A-->>X: 200 application/zip con X-Accel-Buffering no
    loop por cada documento, en orden de sección, tipo y fecha
        A->>F: abre el PDF como stream
        F-->>A: bytes
        A-->>X: entrada del ZIP en modo store
        X-->>N: envía el bloque
    end
    A-->>X: directorio central del ZIP
    X-->>N: fin de la descarga
    alt el usuario cancela
        N--xX: cierra la conexión
        X--xA: cierra la conexión
        A->>A: aborta el archivador y cierra los streams abiertos
    end
```

Estructura del ZIP:

```
45781236_PEREZ_QUISPE_JUAN.zip
└── 45781236_PEREZ_QUISPE_JUAN/
    ├── 01_Informacion_Personal_y_Familiar/
    │   ├── 0101_DNI.pdf
    │   └── 0102_Ficha_de_datos_personales.pdf
    ├── 02_Incorporacion/
    │   ├── 0201_Curriculum_vitae.pdf
    │   ├── 0202_Contrato_CAS_036-2022_2022-01-15.pdf
    │   └── 0203_Contrato_administrativo_0089-2022_2022-03-01.pdf
    └── 03_Formacion_Academica_y_Capacitacion/
        └── 0302_Titulo_profesional_2019-05-20.pdf
```

- Sin archivos temporales; memoria constante.
- Nombres repetidos llevan sufijo `_2`, `_3`.
- Selección de documentos: `POST /api/documentos/zip` con los ids, pueden ser de varios trabajadores.

### Búsqueda

```mermaid
flowchart TD
    A(["Texto de búsqueda y filtros"]) --> B{"¿El texto es un número de 8 dígitos?"}
    B -->|"sí"| C["Busca DNI exacto<br/>índice único"]
    B -->|"no"| D{"¿El texto tiene dígitos y guiones?"}
    D -->|"sí"| E["Busca número de documento<br/>trigramas sobre lower(numero)"]
    D -->|"no"| F["Normaliza: minúsculas y sin tildes"]
    F --> G["Busca nombre<br/>nombre_busqueda con trigramas,<br/>ordenado por similitud"]
    C --> H["Aplica filtros"]
    E --> H
    G --> H
    H --> I["Filtros: sección, tipo de documento,<br/>fecha de emisión desde y hasta,<br/>área, régimen, tipo de personal, estado"]
    I --> J{"¿Tiene documentos.restringidos?"}
    J -->|"no"| K["Excluye tipos restringidos en SQL"]
    J -->|"sí"| L["Sin exclusión"]
    K --> M["Resultados agrupados:<br/>trabajadores y documentos,<br/>paginados de 25 en 25"]
    L --> M
    M --> N(["Clic en un trabajador abre su legajo<br/>clic en un documento abre el visor"])
```

Búsqueda rápida en la cabecera de todas las pantallas. La búsqueda avanzada tiene todos los filtros y descarga en ZIP los documentos marcados.

### Documentos faltantes

Los obligatorios se configuran en Catálogos > Documentos obligatorios, por régimen, tipo de personal y estado del trabajador.

```mermaid
flowchart TD
    A(["Reporte de faltantes"]) --> B["Trabajadores según filtros:<br/>área, régimen, tipo de personal, estado"]
    B --> C["Para cada trabajador toma su vínculo vigente<br/>o el último si está cesado"]
    C --> D["Requisitos que aplican:<br/>regimen_id nulo o igual al del vínculo<br/>tipo_personal nulo o igual<br/>aplica_a TODOS o igual al estado"]
    D --> E{"¿El usuario tiene documentos.restringidos?"}
    E -->|"no"| F["Descarta requisitos de tipos restringidos"]
    E -->|"sí"| G["Todos los requisitos"]
    F --> H
    G --> H["Para cada requisito busca un documento<br/>DISPONIBLE de ese tipo"]
    H --> I{"¿Existe?"}
    I -->|"no"| J["FALTANTE"]
    I -->|"sí"| K{"¿El tipo vence y la fecha de vencimiento ya pasó?"}
    K -->|"sí"| L["VENCIDO"]
    K -->|"no"| M["COMPLETO"]
    J --> N["Completitud = completos / requisitos"]
    L --> N
    M --> N
    N --> O(["En pantalla o en Excel:<br/>por trabajador y consolidado por área"])
```

Se calcula en una sola consulta con `LEFT JOIN` entre trabajadores, requisitos y documentos.

Requisitos iniciales de la semilla:

| Tipo | Régimen | Tipo de personal | Estado |
|---|---|---|---|
| 0101 DNI | Todos | Ambos | Todos |
| 0102 Ficha de datos personales | Todos | Ambos | Todos |
| 0105 Declaración jurada personal | Todos | Ambos | Todos |
| 0201 Currículum vitae | Todos | Ambos | Todos |
| 0202 Contrato Administrativo de Servicios (CAS) | D. Leg. 1057 | Ambos | Todos |
| 0204 Contrato de locación de servicios | Locación de servicios | Ambos | Todos |
| 0207 Resolución de nombramiento | D. Leg. 276 | Ambos | Todos |
| 0302 Título profesional | Todos | Asistencial | Todos |
| 1102 Resolución de cese | D. Leg. 276 | Ambos | Cesado |
| 1103 Resolución por término o finalización de contrato | D. Leg. 1057 | Ambos | Cesado |

### Auditoría

```mermaid
flowchart TD
    A(["Controlador con el decorador Auditar"]) --> B{"¿Es lectura sensible?<br/>ver, descargar, ZIP, exportar"}
    B -->|"sí"| C["Inserta la auditoría ANTES de entregar el archivo"]
    C --> D["Entrega"]
    B -->|"no, es un cambio"| E["Ejecuta el cambio en una transacción"]
    E --> F["Inserta la auditoría en la MISMA transacción<br/>con los datos de antes y después"]
    F --> G{"¿Commit correcto?"}
    G -->|"sí"| H["Respuesta"]
    G -->|"no"| I["Rollback de los dos: no hay cambio sin auditoría"]
    J(["Intento de UPDATE o DELETE<br/>sobre la tabla auditoria"]) --> K["Trigger tg_auditoria_inmutable"]
    K --> L["Excepción: operación no permitida"]
```

Acciones registradas:

| Módulo | Acciones |
|---|---|
| Sesión | `LOGIN`, `LOGIN_FALLIDO`, `LOGOUT`, `CLAVE_CAMBIAR`, `ACCESO_DENEGADO` |
| Usuarios | `USUARIO_CREAR`, `USUARIO_EDITAR`, `USUARIO_DESACTIVAR`, `USUARIO_RESTABLECER_CLAVE`, `ROL_CREAR`, `ROL_EDITAR` |
| Catálogos | `CATALOGO_CREAR`, `CATALOGO_EDITAR`, `REQUISITO_CREAR`, `REQUISITO_EDITAR`, `REQUISITO_QUITAR` |
| Personal | `TRABAJADOR_CREAR`, `TRABAJADOR_EDITAR`, `FAMILIAR_CREAR`, `FAMILIAR_EDITAR`, `FAMILIAR_QUITAR`, `VINCULO_CREAR`, `VINCULO_FINALIZAR` |
| Documentos | `DOCUMENTO_SUBIR`, `DOCUMENTO_EDITAR`, `DOCUMENTO_RECLASIFICAR`, `DOCUMENTO_REEMPLAZAR`, `DOCUMENTO_ANULAR`, `DOCUMENTO_REINTENTAR`, `DOCUMENTO_VER`, `DOCUMENTO_DESCARGAR` |
| Legajo | `LEGAJO_VER`, `LEGAJO_DESCARGAR`, `DOCUMENTOS_DESCARGAR_SELECCION` |
| Carga masiva | `LOTE_CREAR`, `LOTE_ITEM_CLASIFICAR`, `LOTE_ITEM_DIVIDIR`, `LOTE_ITEM_DESCARTAR` |
| Reportes | `REPORTE_EXPORTAR` |
| Backup | `BACKUP_MANUAL`, `BACKUP_CORRECTO`, `BACKUP_ERROR` |

Cada registro: fecha, usuario, acción, entidad e id, trabajador, IP, navegador y detalle en JSON. Filtros por usuario, acción, trabajador y fechas, con exportación a Excel. En el legajo, la pestaña Historial muestra la auditoría del trabajador. No se depura.

### Copias de seguridad

```mermaid
sequenceDiagram
    participant Q as BullMQ
    participant W as Worker
    participant P as PostgreSQL
    participant F as Volumen archivos
    participant R as Repositorio restic local
    participant M as Repositorio remoto

    Q->>W: backup programado a la 01:00 o manual desde el panel
    W->>P: INSERT backup_ejecucion EN_CURSO
    W->>P: pg_dump en formato custom
    P-->>W: volcado por stdout
    W->>R: restic backup --stdin, etiqueta bd
    R-->>W: snapshot de la base
    W->>F: restic backup del volumen archivos, etiqueta archivos
    F-->>R: solo bloques nuevos o cambiados, comprimidos y cifrados
    R-->>W: snapshot de archivos y bytes agregados
    W->>R: restic forget --prune con 7 diarias, 4 semanales y 12 mensuales
    W->>M: restic copy al repositorio remoto
    opt domingo
        W->>R: restic check con lectura de una muestra del 5 %
        W->>P: verificado = true o error
    end
    alt todo correcto
        W->>P: backup_ejecucion CORRECTO con snapshots y bytes
    else algún paso falla
        W->>P: backup_ejecucion ERROR con el mensaje
        Note over W,P: el panel de Backup y la pantalla de inicio del Administrador muestran el aviso
    end
```

- Concurrencia 1.
- `pg_dump` corre en caliente.
- Repositorio cifrado con `RESTIC_PASSWORD`.
- Panel: última copia, historial, snapshots, espacio usado y copia manual. La restauración se hace por consola.

### Restauración

```mermaid
flowchart TD
    A(["infra/backup/restaurar.sh SNAPSHOT"]) --> B["Lista las snapshots si no se indica una"]
    B --> C["Confirmación escrita del operador"]
    C --> D["docker compose stop api worker"]
    D --> E["restic restore de archivos<br/>a una carpeta nueva"]
    E --> F["restic dump del volcado de la base"]
    F --> G["pg_restore --clean --if-exists"]
    G --> H["Cambia la carpeta de archivos por la restaurada<br/>la anterior queda renombrada con la fecha"]
    H --> I["docker compose start api worker"]
    I --> J["Verificación: cuenta documentos DISPONIBLES<br/>y comprueba que cada ruta exista en disco"]
    J --> K{"¿Coinciden?"}
    K -->|"sí"| L(["Restauración correcta"])
    K -->|"no"| M(["Reporte de rutas faltantes"])
```

## Roles y permisos

Roles en Usuarios > Roles. La semilla crea estos cuatro; se pueden crear otros.

| Permiso | Administrador | Jefe de Legajos | Digitador | Consulta |
|---|---|---|---|---|
| `usuarios.gestionar` | Sí | No | No | No |
| `catalogos.gestionar` | Sí | Sí | No | No |
| `personal.ver` | Sí | Sí | Sí | Sí |
| `personal.editar` | Sí | Sí | Sí | No |
| `documentos.ver` | Sí | Sí | Sí | Sí |
| `documentos.subir` | Sí | Sí | Sí | No |
| `documentos.editar` | Sí | Sí | Sí | No |
| `documentos.anular` | Sí | Sí | No | No |
| `documentos.descargar` | Sí | Sí | Sí | Sí |
| `documentos.restringidos` | Sí | Sí | No | No |
| `carga_masiva.usar` | Sí | Sí | Sí | No |
| `reportes.ver` | Sí | Sí | No | Sí |
| `reportes.exportar` | Sí | Sí | No | Sí |
| `auditoria.ver` | Sí | Sí | No | No |
| `backup.gestionar` | Sí | No | No | No |

Reglas:

- El digitador edita o reclasifica solo lo que subió en las últimas 48 horas. Después, el Jefe de Legajos.
- Nadie se quita a sí mismo `usuarios.gestionar` y siempre queda un Administrador activo.
- Los usuarios se desactivan, no se borran.

## Pantallas

```mermaid
flowchart LR
    LOGIN["index.html<br/>Inicio de sesión"] --> CC["cambiar-clave.html<br/>primer ingreso"]
    LOGIN --> INI["inicio.html<br/>búsqueda, accesos rápidos,<br/>avance de digitalización"]
    CC --> INI
    INI --> PER["personal.html<br/>listado con filtros"]
    PER --> TRA["trabajador.html?id<br/>ficha, familiares, vínculos"]
    TRA --> LEG["legajo.html?id<br/>13 secciones, visor,<br/>subida, ZIP, historial"]
    PER --> LEG
    INI --> BUS["busqueda.html<br/>búsqueda avanzada"]
    BUS --> LEG
    INI --> CM["carga-masiva.html<br/>nueva carga y lotes"]
    CM --> LOT["lote.html?id<br/>bandeja, clasificar, dividir"]
    INI --> REP["reportes.html<br/>personal, faltantes,<br/>digitalización, avance"]
    REP --> LEG
    INI --> AUD["auditoria.html"]
    INI --> USU["usuarios.html"]
    USU --> ROL["roles.html"]
    INI --> CAT["catalogos.html<br/>tipos, obligatorios,<br/>regímenes, áreas, cargos"]
    INI --> BAK["backup.html"]
```

El menú se arma según los permisos. Una pantalla sin permiso redirige a `inicio.html`.

### Pantalla del legajo

| Zona | Contenido |
|---|---|
| Cabecera | DNI, nombre, estado, régimen, tipo de personal, cargo, área, fecha de ingreso y completitud |
| Columna izquierda | 13 secciones en acordeón con conteo y faltantes; documentos por tipo y fecha con número, folios y estado |
| Panel derecho | Visor, datos, versiones y acciones: editar, reemplazar, anular, descargar |
| Barra de acciones | Subir (o soltar sobre una sección), ZIP del legajo, ZIP de secciones marcadas |
| Pestañas | Documentos, Faltantes, Vínculos, Historial |

### Componentes web

| Etiqueta | Función |
|---|---|
| `<app-cabecera>` | Logo, búsqueda global, usuario y cierre de sesión |
| `<app-menu>` | Menú lateral filtrado por permisos |
| `<tabla-datos>` | Tabla con paginación, orden y filtros desde la API |
| `<visor-pdf>` | pdf.js con zoom, páginas y miniaturas; también lo usa la división de PDFs |
| `<zona-subida>` | Arrastrar y soltar, cola de subidas tus, progreso y reanudación |
| `<dialogo-modal>` | Formularios y confirmaciones |
| `<selector-trabajador>` | Autocompletado por DNI o nombre |
| `<aviso-flotante>` | Mensajes de éxito y error |

Cada página llama a `GET /api/auth/yo` al cargar para obtener usuario y permisos.

## API

Todas las rutas van bajo `/api`, exigen sesión salvo `POST /auth/login` y responden JSON. Los listados se paginan con `pagina` y `por_pagina` (máximo 100).

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/auth/login` | Pública | Inicia sesión |
| POST | `/auth/logout` | Sesión | Cierra sesión |
| GET | `/auth/yo` | Sesión | Usuario y permisos |
| POST | `/auth/cambiar-clave` | Sesión | Cambia la contraseña propia |
| GET | `/eventos` | Sesión | SSE con el estado de documentos y lotes del usuario |
| GET, POST | `/usuarios` | `usuarios.gestionar` | Lista y crea usuarios |
| PATCH | `/usuarios/:id` | `usuarios.gestionar` | Edita, cambia rol, activa o desactiva |
| POST | `/usuarios/:id/restablecer-clave` | `usuarios.gestionar` | Genera una clave temporal y obliga a cambiarla |
| GET, POST | `/roles` | `usuarios.gestionar` | Lista y crea roles |
| PATCH | `/roles/:id` | `usuarios.gestionar` | Edita nombre y permisos |
| GET | `/permisos` | `usuarios.gestionar` | Catálogo de permisos |
| GET | `/secciones` | Sesión | Las 13 secciones con sus tipos |
| GET, POST, PATCH | `/tipos-documento` | `catalogos.gestionar` para escribir | Tipos de documento |
| GET, POST, PATCH, DELETE | `/requisitos` | `catalogos.gestionar` para escribir | Documentos obligatorios |
| GET, POST, PATCH | `/regimenes`, `/areas`, `/cargos` | `catalogos.gestionar` para escribir | Catálogos |
| GET, POST | `/trabajadores` | `personal.ver` y `personal.editar` | Lista con filtros y crea |
| GET, PATCH | `/trabajadores/:id` | `personal.ver` y `personal.editar` | Ficha |
| GET, POST, PATCH, DELETE | `/trabajadores/:id/familiares` | `personal.ver` y `personal.editar` | Familiares |
| GET, POST | `/trabajadores/:id/vinculos` | `personal.ver` y `personal.editar` | Historial y nuevo vínculo |
| POST | `/trabajadores/:id/vinculos/:vid/finalizar` | `personal.editar` | Fin de vínculo o cese |
| GET | `/legajos/:trabajadorId` | `documentos.ver` | Secciones, documentos, conteos y completitud |
| GET | `/legajos/:trabajadorId/zip` | `documentos.descargar` | ZIP del legajo o de las secciones indicadas |
| GET | `/legajos/:trabajadorId/historial` | `auditoria.ver` | Auditoría del legajo |
| POST, HEAD, PATCH, DELETE | `/subidas` y `/subidas/:id` | `documentos.subir` | Protocolo tus |
| POST | `/documentos` | `documentos.subir` | Registra un documento con una subida completa |
| GET | `/documentos/:id` | `documentos.ver` | Datos y versiones |
| PATCH | `/documentos/:id` | `documentos.editar` | Edita datos o reclasifica |
| POST | `/documentos/:id/reemplazar` | `documentos.editar` | Nueva versión con otra subida |
| POST | `/documentos/:id/anular` | `documentos.anular` | Anula con motivo |
| POST | `/documentos/:id/reintentar` | `documentos.subir` | Reintenta un procesamiento fallido |
| GET | `/documentos/:id/archivo` | `documentos.ver` (y `documentos.descargar` con `descarga=1`) | Entrega por X-Accel-Redirect |
| GET | `/documentos/:id/versiones/:version/archivo` | `documentos.ver` | Versión anterior |
| POST | `/documentos/zip` | `documentos.descargar` | ZIP de documentos seleccionados |
| GET, POST | `/lotes` | `carga_masiva.usar` | Lista y crea lotes |
| GET | `/lotes/:id` | `carga_masiva.usar` | Lote e ítems |
| POST | `/lotes/:id/items/:itemId/completar` | `carga_masiva.usar` | Avisa que terminó la subida e intenta clasificar |
| POST | `/lotes/:id/items/:itemId/clasificar` | `carga_masiva.usar` | Clasificación manual |
| POST | `/lotes/:id/items/:itemId/dividir` | `carga_masiva.usar` | Divide por rangos de páginas |
| POST | `/lotes/:id/items/:itemId/descartar` | `carga_masiva.usar` | Descarta con motivo |
| GET | `/busqueda` | `personal.ver` | Búsqueda por DNI, nombre, documento y fecha |
| GET | `/reportes/personal` | `reportes.ver` | Listado de personal |
| GET | `/reportes/faltantes` | `reportes.ver` | Faltantes consolidado |
| GET | `/reportes/faltantes/:trabajadorId` | `documentos.ver` | Faltantes de un trabajador |
| GET | `/reportes/digitalizacion` | `reportes.ver` | Documentos cargados por usuario y fecha |
| GET | `/reportes/avance` | `reportes.ver` | Legajos completos e incompletos por área |
| GET | `/auditoria` | `auditoria.ver` | Consulta con filtros |
| GET | `/backups` | `backup.gestionar` | Historial, snapshots y espacio usado |
| POST | `/backups` | `backup.gestionar` | Copia manual |

Reportes y auditoría aceptan `formato=xlsx` (con `reportes.exportar` o `auditoria.ver`), generado en streaming.

## Reportes

| Reporte | Contenido | Filtros |
|---|---|---|
| Listado de personal | DNI, nombre, régimen, tipo de personal, cargo, área, fecha de ingreso, estado, completitud | Área, régimen, tipo de personal, cargo, estado, fecha de ingreso desde y hasta |
| Faltantes por trabajador | Requisitos que le aplican con su estado: completo, faltante o vencido | Trabajador |
| Faltantes consolidado | Matriz trabajador por tipo obligatorio, con totales por área | Área, régimen, tipo de personal, estado, solo incompletos |
| Documentos por vencer y vencidos | Documentos con fecha de vencimiento próxima o pasada | Días de anticipación, área, tipo |
| Digitalización | Documentos cargados por usuario y por día, con folios y tamaño | Usuario, fecha desde y hasta |
| Avance de legajos | Legajos al 100 %, parciales y vacíos, por área | Área, régimen |

Todos se ven en pantalla y se exportan a Excel.

## Rendimiento

| Aspecto | Objetivo o límite |
|---|---|
| Tamaño máximo por PDF | 200 MB (`TAMANO_MAXIMO_MB`) |
| Parte de subida tus | 8 MB |
| Subidas paralelas por navegador | 3 |
| Reducción esperada en escaneos | Entre 60 y 80 % |
| Primera página en el visor | Menos de 1 segundo en la red local, gracias a la linealización |
| Búsqueda | Menos de 300 ms con 10 000 trabajadores y 500 000 documentos |
| Apertura del legajo | Una consulta para todo el legajo, menos de 200 ms |
| Memoria de la API durante un ZIP | Constante, sin importar el tamaño del legajo |
| JSON, JS y CSS | gzip en nginx |
| Recursos del frontend | Nombres con hash y caché de 1 año (`immutable`) |
| Páginas HTML | Sin caché, para que siempre carguen la versión vigente |

## Seguridad

- Contraseñas con argon2id, con mínimo de 10 caracteres. Bloqueo de 15 minutos tras 5 intentos fallidos. Cambio obligatorio en el primer ingreso y después de un restablecimiento.
- Cookie de sesión `HttpOnly`, `Secure` y `SameSite=Strict`. Las peticiones que modifican datos exigen además la cabecera `X-Legajos: 1`.
- Los archivos están fuera de la raíz pública de nginx y solo se entregan después de que la API valida los permisos.
- Los documentos restringidos se filtran en SQL y responden 404 a quien no tiene el permiso.
- Solo se aceptan PDF: se validan la extensión, la firma del archivo y la estructura con `qpdf --check`. Ghostscript corre con `-dSAFER`.
- Cabeceras en nginx: `Strict-Transport-Security`, `Content-Security-Policy` sin scripts en línea (todo el TypeScript va empaquetado), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` y `X-Frame-Options: SAMEORIGIN` (el visor carga el PDF desde el mismo origen).
- Validación de todas las entradas con `class-validator` en los DTO de NestJS.
- PostgreSQL y Redis no exponen puertos fuera de Docker.

## Configuración

| Variable | Ejemplo | Uso |
|---|---|---|
| `DOMINIO` | `legajos.entidad.gob.pe` | Dominio público |
| `DATABASE_URL` | `postgresql://legajos:***@postgres:5432/legajos` | Conexión de Prisma |
| `REDIS_URL` | `redis://redis:6379` | Sesiones, colas y eventos |
| `DIR_SUBIDAS` | `/srv/legajos/subidas` | Partes tus temporales |
| `DIR_ARCHIVOS` | `/srv/legajos/archivos` | PDF definitivos |
| `TAMANO_MAXIMO_MB` | `200` | Límite por archivo |
| `OPTIMIZAR_PPP` | `150` | Resolución de las imágenes optimizadas |
| `OPTIMIZAR_GRISES` | `false` | Convertir los escaneos a escala de grises |
| `WORKER_CONCURRENCIA` | `3` | PDFs procesados a la vez |
| `SESION_MINUTOS` | `30` | Expiración por inactividad |
| `RESTIC_REPOSITORY` | `/mnt/respaldo/restic` | Repositorio local de copias |
| `RESTIC_REPOSITORY_REMOTO` | `sftp:respaldo@servidor:/legajos` | Copia remota |
| `RESTIC_PASSWORD` | `***` | Clave de cifrado de las copias |
| `BACKUP_HORA` | `01:00` | Hora de la copia diaria |
| `ADMIN_USUARIO` | `admin` | Primer administrador que crea la semilla |
| `ADMIN_CLAVE` | `***` | Clave temporal del primer administrador |

## Orden de construcción

1. Base: Docker Compose, nginx, Prisma, semilla, sesión, roles, permisos y auditoría.
2. Usuarios y catálogos.
3. Personal: trabajadores, familiares, vínculos, alta, cese y reingreso.
4. Documentos: subida tus, worker, SSE, legajo, visor, descargas, ZIP, versiones y anulación.
5. Carga masiva: lotes, bandeja, clasificación y división.
6. Búsqueda y reportes.
7. Backup y script de restauración.
8. Seguridad, pruebas de carga con escaneos reales y manual de instalación.
