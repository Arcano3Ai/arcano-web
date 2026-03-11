# Guía de Despliegue en Hostinger - Arcano Solutions (v2)

Esta guía te llevará paso a paso para subir tu sitio web a Hostinger y conectar la funcionalidad del formulario de contacto.

## Paso 1: Preparar tus archivos
1. Ve a la carpeta de tu proyecto en tu computadora: `arcano-solutions`.
2. Selecciona **TODOS** los archivos y carpetas dentro de `arcano-solutions` (admin, api, dist, docs, services, index.html, styles.css, script.js, database.sql, etc.).
3. Haz clic derecho y selecciona **"Comprimir en archivo ZIP"** (o "Enviar a > Carpeta comprimida").
   - Nombra este archivo como `arcano_upload.zip`.

## Paso 2: Subir archivos a Hostinger
1. Inicia sesión en tu cuenta de **Hostinger**.
2. Ve al **Tablero (Dashboard)** de tu sitio web.
3. Busca la sección **Archivos** y haz clic en **Administrador de Archivos (File Manager)**.
4. Entra en la carpeta `public_html`.
   - *Nota: Si tienes archivos antiguos aquí que no necesitas, bórralos o muévelos a una carpeta de respaldo.*
5. Haz clic en el icono de **"Subir" (Upload)** en la barra superior derecha.
6. Selecciona tu archivo `arcano_upload.zip` y súbelo.
7. Una vez subido, haz clic derecho sobre `arcano_upload.zip` y selecciona **"Extract" (Extraer)**.
   - Extrae los archivos en la ubicación actual (`/public_html`). (Asegúrate de poner `.` o dejarlo en blanco si te pide nombre de carpeta para que no cree una subcarpeta extra).
8. Verifica que veas `index.html` directamente dentro de `public_html`.

## Paso 3: Crear la Base de Datos
Para que el formulario de contacto funcione, necesitamos una base de datos.
1. Vuelve al **Tablero (Dashboard)** de Hostinger.
2. Busca la sección **Bases de Datos** y haz clic en **Gestión de Bases de Datos (Management)**.
3. En "Crear una nueva base de datos MySQL":
   - **Nombre de la base de datos:** Escribe algo como `arcano_db`. (Hostinger le agregará un prefijo, ej: `u123456_arcano_db`).
   - **Usuario de la base de datos:** Escribe algo como `admin`. (Hostinger le agregará un prefijo, ej: `u123456_admin`).
   - **Contraseña:** Crea una contraseña segura (ej: `ArcanoSecure2026!`). **¡GUÁRDALA!**
4. Haz clic en **Crear**.

## Paso 4: Importar la Tabla
1. En la lista de bases de datos de Hostinger, busca la que acabas de crear y haz clic en **"Enter phpMyAdmin"**.
2. Una vez en phpMyAdmin, selecciona tu base de datos en la columna izquierda.
3. Ve a la pestaña **"Importar"** en el menú superior.
4. En "Seleccionar archivo", busca el archivo `database.sql` que subiste (o selecciónalo desde tu computadora si lo tienes a mano).
5. Haz clic en **"Importar"** o "Go" al final de la página.
   - Esto creará la tabla `leads`.

## Paso 5: Conectar el Sitio a la Base de Datos
1. Vuelve al **Administrador de Archivos** en Hostinger.
2. Entra a la carpeta `api`.
3. Haz clic derecho en el archivo `config.php` y selecciona **"Edit" (Editar)**.
4. Actualiza las siguientes líneas con los datos de LA BASE DE DATOS QUE CREASTE en el Paso 3:

```php
$host = "localhost"; // Normalmente se deja así en Hostinger.
$dbname = "u123456_arcano_db"; // ¡Usa el nombre COMPLETO que te dio Hostinger con el prefijo!
$username = "u123456_admin";   // ¡Usa el usuario COMPLETO con prefijo!
$password = "ArcanoSecure2026!"; // La contraseña que creaste.
```

5. Haz clic en **Guardar** (Save).

## Paso 6: Verificación Final
1. Abre tu dominio en el navegador (ej: `www.tudominio.com`).
2. Verifica que el sitio cargue con todas las animaciones.
3. Baja al formulario de contacto e intenta enviar un mensaje de prueba.
   - Si dice "¡Enviado!", todo está perfecto.
   - Si dice "Error", revisa los datos en `config.php`.

## Paso 7: Seguridad (Opcional pero recomendado)
1. Ve a la carpeta `admin`.
2. Edita `dashboard.php` y cambia la contraseña `$ADMIN_PASS` por una segura.
3. Si ya no necesitas `database.sql` ni el `.zip` en el servidor, bórralos desde el Administrador de Archivos.
