# Manual de instalación

Instalación del Sistema de Legajos de Personal en un servidor Linux de la entidad.

## Requisitos

| Recurso | Mínimo | Recomendado |
|---|---|---|
| Sistema operativo | Ubuntu 22.04 o Debian 12, 64 bits | Ubuntu 24.04 |
| Procesador | 2 núcleos | 4 núcleos o más |
| Memoria | 4 GB | 8 GB |
| Disco del sistema | 40 GB más el espacio de los PDF | SSD |
| Disco para copias | El mismo tamaño que los PDF más un 30 % | Un disco aparte del de los datos |

Software:

- Docker Engine 24 o superior, con el complemento `docker compose`.
- Git.
- Un nombre de dominio que apunte al servidor y un certificado TLS. Puede ser Cloudflare delante del servidor o un nginx del propio servidor con Let's Encrypt.

Instalar Docker en Ubuntu:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Cierra la sesión y vuelve a entrar para que el usuario quede en el grupo `docker`.

## 1. Descargar el sistema

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/Jose27luis/legajo.git legajos
sudo chown -R $USER:$USER legajos
cd legajos
```

## 2. Configurar las variables

```bash
cp .env.example .env
chmod 600 .env
```

Genera las claves sin escribirlas a mano:

```bash
openssl rand -hex 24   # para POSTGRES_PASSWORD
openssl rand -hex 32   # para RESTIC_PASSWORD
```

Llena el archivo `.env`:

| Variable | Qué poner |
|---|---|
| `POSTGRES_PASSWORD` | La primera clave generada |
| `DATABASE_URL` | `postgresql://legajos:<POSTGRES_PASSWORD>@postgres:5432/legajos` con la misma clave |
| `COOKIE_SEGURA` | `true` si el sistema se usa con HTTPS, que es lo normal |
| `SESION_MINUTOS` | Minutos de inactividad antes de cerrar la sesión. Por defecto 30 |
| `ADMIN_USUARIO` | Usuario del primer administrador, en minúsculas, de 4 a 30 caracteres |
| `ADMIN_NOMBRE` | Nombre completo del administrador |
| `ADMIN_CORREO` | Correo del administrador |
| `ADMIN_CLAVE` | Contraseña temporal del administrador, de 10 caracteres o más. Se pide cambiarla en el primer ingreso |
| `RESTIC_PASSWORD` | La segunda clave generada. Cifra las copias de seguridad |
| `RESPALDO_CRON` | Hora de la copia diaria en formato cron, hora de Lima. Por defecto `0 1 * * *` (01:00) |

**Guarda `RESTIC_PASSWORD` fuera del servidor**, por ejemplo impresa en sobre cerrado o en el gestor de contraseñas de la oficina. Si el servidor se pierde y no se tiene esa clave, las copias no se pueden abrir.

Variables opcionales, con su valor por defecto:

| Variable | Por defecto |
|---|---|
| `TAMANO_MAXIMO_MB` | 200 |
| `OPTIMIZAR_PPP` | 150 |
| `OPTIMIZAR_GRISES` | false |
| `WORKER_CONCURRENCIA` | 2. Conviene núcleos del servidor menos uno |

## 3. Disco de las copias

Las copias se guardan en el volumen `respaldos`. Para que estén en un disco distinto al de los datos, monta ese disco (por ejemplo en `/mnt/copias`) y crea el archivo `docker-compose.override.yml` en la carpeta del sistema:

```yaml
services:
  worker:
    volumes:
      - /mnt/copias/legajos:/data/respaldos

```

Y dale la carpeta al usuario del contenedor:

```bash
sudo mkdir -p /mnt/copias/legajos
sudo chown 100:101 /mnt/copias/legajos
```

Si no hay segundo disco, sáltate este paso: las copias quedan en el disco del sistema, que protege ante borrados y errores pero no ante la pérdida del disco.

## 4. Levantar el sistema

```bash
docker compose up -d --build
```

La primera vez tarda varios minutos porque compila el frontend y la API. Al arrancar, la API aplica las migraciones de la base de datos, carga los catálogos (secciones, tipos de documento, regímenes, requisitos) y crea el administrador de `.env`. Si el administrador ya existe, no lo toca.

Comprueba que todo esté arriba:

```bash
docker compose ps
curl -s http://127.0.0.1:3600/api/health
```

Los cinco servicios deben estar `Up` y la API `healthy`.

## 5. Publicar con HTTPS

El sistema escucha solo en `127.0.0.1:3600`. Delante va el nginx del servidor, que es el que tiene el certificado.

Ejemplo para `/etc/nginx/sites-available/legajos`, cambiando el dominio:

```nginx
server {
    listen 80;
    server_name legajos.entidad.gob.pe;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name legajos.entidad.gob.pe;

    ssl_certificate     /etc/letsencrypt/live/legajos.entidad.gob.pe/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/legajos.entidad.gob.pe/privkey.pem;

    client_max_body_size 1m;

    location ^~ /api/uploads {
        client_max_body_size 10m;
        proxy_request_buffering off;
        proxy_read_timeout 120s;
        proxy_pass http://127.0.0.1:3600;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_read_timeout 300s;
        proxy_pass http://127.0.0.1:3600;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

El bloque de `/api/uploads` es obligatorio: los PDF se suben en partes de 8 MB y, sin ese límite de 10 MB, nginx rechaza cualquier archivo de más de 1 MB.

```bash
sudo ln -s /etc/nginx/sites-available/legajos /etc/nginx/sites-enabled/
sudo certbot --nginx -d legajos.entidad.gob.pe
sudo nginx -t && sudo systemctl reload nginx
```

Si se usa Cloudflare, el modo SSL debe ser Full o Full (strict).

## 6. Primer ingreso

1. Entra al dominio con el usuario y la contraseña de `ADMIN_USUARIO` y `ADMIN_CLAVE`.
2. El sistema pide crear una contraseña nueva.
3. En **Catálogos**, registra las áreas y los cargos de la entidad. Los regímenes, tipos de documento y requisitos ya vienen cargados; revísalos.
4. En **Gestión de usuarios**, crea las cuentas del personal de la oficina con el rol que corresponda (Administrador, Operador o Consulta).
5. En **Copias de seguridad**, pulsa **Hacer una copia ahora** y espera a que termine como Correcta. Así se confirma que el repositorio de copias quedó creado.
6. Después de eso, borra `ADMIN_CLAVE` del `.env`; ya no se usa.

## Actualizar el sistema

```bash
cd /var/www/legajos
git pull
docker compose up -d --build
```

Las migraciones nuevas se aplican solas al arrancar la API. Haz antes una copia manual desde el panel.

## Copias de seguridad

- Se hacen solas todos los días a la hora de `RESPALDO_CRON`.
- Se conservan 7 diarias, 4 semanales y 12 mensuales.
- Los domingos se revisa una muestra del 5 % del repositorio.
- El estado, el historial y el id de cada copia se ven en **Copias de seguridad**. Si la última falla, el inicio del administrador muestra un aviso.

## Restaurar una copia

Sirve para volver el sistema completo (base de datos y PDF) al momento de una copia. Se hace en la consola del servidor:

```bash
cd /var/www/legajos
infra/restore.sh
```

Sin argumentos, lista las copias guardadas. Copia el id de la ejecución (el que aparece en el panel, en la columna "Id para restaurar") y ejecuta:

```bash
infra/restore.sh <id de la copia>
```

El script:

1. Pide escribir `RESTAURAR` para continuar.
2. Detiene la API y el worker. Durante la restauración nadie puede usar el sistema.
3. Restaura los PDF. Los que había antes quedan en una carpeta `.anterior-<fecha>` dentro del volumen de archivos, por si hay que recuperar algo.
4. Restaura la base de datos.
5. Vuelve a levantar el sistema.
6. Comprueba que cada documento disponible tenga su PDF y muestra los que falten.

Cuando se compruebe que todo está bien, la carpeta `.anterior-<fecha>` se puede borrar:

```bash
docker compose exec worker sh -c 'rm -rf /data/archivos/.anterior-*'
```

### Restaurar en un servidor nuevo

1. Instala el sistema en el servidor nuevo con los pasos 1 a 4, usando la misma `RESTIC_PASSWORD`.
2. Antes de restaurar, copia la carpeta del repositorio de copias del servidor anterior al disco de copias del nuevo.
3. Ejecuta `infra/restore.sh` como arriba.

## Consultas de mantenimiento

Ver los registros de cada servicio:

```bash
docker compose logs -f api
docker compose logs -f worker
```

Reiniciar un servicio:

```bash
docker compose restart api
```

Espacio usado por los volúmenes:

```bash
docker system df -v | grep legajos
```

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Los PDF de más de 1 MB no suben | Falta el bloque de `/api/uploads` en el nginx del servidor (paso 5) |
| La sesión se cierra apenas se inicia | `COOKIE_SEGURA=true` pero el sitio se abre por HTTP. Usa HTTPS |
| La API no arranca y el log dice "Variables de entorno inválidas" | Falta una variable obligatoria en `.env` o tiene un formato incorrecto; el mensaje dice cuál |
| El panel de copias dice que no están configuradas | Falta `RESTIC_PASSWORD` en `.env`. Agrégala y ejecuta `docker compose up -d` |
| Los PDF quedan mucho tiempo en "Procesando" | Revisa `docker compose logs worker`. Si el servidor tiene más núcleos, sube `WORKER_CONCURRENCIA` |
