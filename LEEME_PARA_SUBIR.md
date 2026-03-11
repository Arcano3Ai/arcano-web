# Guía de Despliegue Seguro en Hostinger (Actualizado V3) - Arcano Solutions

Esta guía describe el paso a paso para desplegar el entorno híbrido de Arcano Solutions (PHP + Node.js) en Hostinger de una forma robusta y funcional.

### Arquitectura Actual
Esta web utiliza **PHP** para el manejo de sesiones y bases de datos, y **Node.js** para el Proxy de WebSockets con Google Gemini (Inteligencia Artificial). Ambos necesitan configurarse del lado del servidor.

---

## 1. Subida Base de Archivos
1. Ve a los archivos del proyecto en tu computadora.
2. Selecciona **TODO** exceptuando directorios como `.git`, `node_modules` (opcional ignorarlos en el zip porque se pueden instalar allá).
3. Haz un archivo `.zip` (ej. `arcano.zip`).
4. Ve al panel de **Hostinger -> Archivos -> Administrador de Archivos**.
5. Entra a la carpeta `/public_html`.
6. Sube el `.zip` y extráelo (Asegúrate de dejar todas la carpetas en la raíz de `public_html`).

## 2. Bases de Datos (PHP/MySQL)
1. En Hostinger ve a **Bases de Datos -> Gestión**.
2. Crea una base de datos nueva (ejemplo: `u123456_arcano`). Crea y anota la contraseña.
3. Entra a **phpMyAdmin**, busca tu base de datos y ve a la pestaña "Importar".
4. Sube el archivo `database.sql` para generar las tablas `users` y `leads`.

## 3. Configurar el Entorno Principal (.env)
1. En tu Administrador de Archivos de Hostinger, busca el archivo `.env.example` en tu `public_html` y **RENÓMBRALO** a `.env`.
2. Edita el archivo `.env` recién renombrado:
   - Rellena `DB_HOST`, `DB_NAME`, `DB_USER` y `DB_PASS` con los datos que generaste en el paso 2.
   - Pega tu `GEMINI_API_KEY` real para que el bot de voz funcione.
3. Guarda los cambios. (El `.htaccess` incluido en el repo protege y oculta el `.env` al público).

## 4. Configurar el Servidor Node.js (El Bot de IA)
Como estás en **Hostinger**, Apache despachará los PHP, pero necesitamos encender el "Proxy" de Node.js en paralelo.

1. Ve a tu Tablero de Control de Hostinger.
2. Busca la sección **Advanced (Avanzado)** o **Websites (Sitios)** y haz clic en **Node.js (o "Aplicaciones Node.js")**.
3. Haz clic en **"Crear Aplicación"**:
   - **App Version:** Selecciona Node.js v18 o superior.
   - **Application mode:** `Production`
   - **Application Root:** Pon el texto `/public_html` (o la ruta donde tienes tu `server.js`).
   - **Application URL:** Tu dominio principal, o crea un subdominio como `api.tudominio.com`.
   - **Application Startup File:** Escribe `server.js`.
4. Haz clic en **Crear y Guardar**.
5. Tras guardarse, verás un botón para correr `npm install` o se te dará acceso por terminal. Si no lo hace automático, haz click en **Instalar dependencias NPM** (Instalará todo desde tu `package.json`).
6. Asegúrate de que la Aplicación Node.js aparezca como **START** o  "Corriendo".

## 5. Pruebas Locales (Sin necesidad de Hostinger)
Si clonas esto en un equipo local o usas XAMPP:
1. Necesitas servidor local para PHP y Apache (Ej. XAMPP o Laragon).
2. Debes tener **Node.js** instalado.
3. Copia `.env.example` a `.env` y configura el parámetro tu Key de Gemini (y tu base de datos MySQL local si quieres que el login sirva).
4. En la terminal de la carpeta del proyecto, ejecuta el proxy con Node:
   ```bash
   npm install
   npm start
   ```
5. Accede a tu entorno en Apache abriendo: `http://localhost/tu-carpeta-arcano` en el navegador.

**Importante:** Nunca omitas ejecutar `npm start` (o `node server.js`) si quieres usar la IA; el frontend de JS busca conectarse al `ws://localhost:8080` de manera automática localmente, y a `ws://tudominio.com` en entorno público.

---

¡Tu página ahora será estable en producción y ocultará correctamente su API key del Frontend!
