# Usa una imagen ligera de Node.js oficial
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de dependencias primero (optimiza el caché de Docker)
COPY package*.json ./

# Instala las dependencias (solo para producción)
RUN npm install --production

# Copia todo el código fuente al contenedor
COPY . .

# Expone el puerto que usará tu aplicación
EXPOSE 8080

# Comando para iniciar tu servidor
CMD ["npm", "start"]
