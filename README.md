# 🏭 Sistema Web de Cotización y Compra de Maquinaria Industrial

Sistema web desarrollado con Node.js, Express y PostgreSQL que permite a usuarios cotizar y comprar maquinaria industrial, con panel administrativo de ventas incluido.

---

## 📋 Requisitos Previos

Asegúrate de tener instalado lo siguiente antes de comenzar:

- [Node.js](https://nodejs.org/) (versión LTS recomendada)
- [PostgreSQL](https://www.postgresql.org/) (versión 13 o superior)
- [Git](https://git-scm.com/) (opcional, para clonar el repositorio)

---

## 🚀 Instalación y Configuración

### 1. Obtener el proyecto

```bash
# Opción A: Clonar con Git
git clone <url-del-repositorio>
cd <nombre-del-proyecto>

# Opción B: Si lo recibiste como .zip, extráelo y entra a la carpeta
cd ruta/del/proyecto
```

### 2. Instalar dependencias del Backend

```bash
cd Backend
npm install
```

Esto instalará automáticamente:

| Dependencia | Versión | Función |
|-------------|---------|---------|
| bcrypt | 5.1.1 | Encriptación de contraseñas |
| cors | 2.8.5 | Permite peticiones desde otros dominios |
| dotenv | 16.0.3 | Carga variables de entorno desde `.env` |
| express | 4.18.2 | Manejo de rutas y peticiones HTTP |
| pg | 8.11.0 | Conexión con PostgreSQL |
| nodemon | 2.0.22 | Reinicio automático del servidor en desarrollo |

### 3. Configurar variables de entorno

Dentro de la carpeta `/Backend`, crea un archivo llamado `.env` con el siguiente contenido:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nombre_de_tu_base_de_datos
DB_USER=tu_usuario_postgres
DB_PASSWORD=tu_contraseña_postgres
```

> ⚠️ **Importante:** Solicita estos valores al desarrollador original. Sin el `.env` correcto, el sistema no podrá conectarse a la base de datos.

### 4. Configurar la base de datos en PostgreSQL

```bash
# Entra a PostgreSQL
psql -U postgres

# Crea la base de datos
CREATE DATABASE nombre_de_tu_base_de_datos;

# Sal de PostgreSQL
\q
```

Si existe un archivo de esquema en la carpeta `/Data`, impórtalo así:

```bash
psql -U postgres -d nombre_de_tu_base_de_datos -f Data/script.sql
```

### 5. Iniciar el servidor Backend

```bash
cd Backend
npm start
```

Si todo está correcto, verás en consola algo como:

```
Servidor corriendo en el puerto 3000
Conexión a base de datos exitosa
```

### 6. Abrir el Frontend

Como el frontend está construido con HTML puro, puedes abrirlo directamente:

```bash
# Windows
start Frontend/index.html

# Mac
open Frontend/index.html

# Linux
xdg-open Frontend/index.html
```

> 💡 **Recomendación:** Usa la extensión **Live Server** de VS Code para evitar problemas con rutas relativas al abrir el HTML.

---

## 📁 Estructura del Proyecto

```
/
├── Backend/          # Servidor Node.js + Express
│   ├── .env          # Variables de entorno (NO subir a Git)
│   └── ...
├── Frontend/         # Archivos HTML, CSS y JavaScript del cliente
│   └── ...
└── Data/             # Scripts SQL de la base de datos
    └── ...
```

---

## ✅ Funcionalidades del Sistema

- 👤 Registro e inicio de sesión de usuarios
- 📄 Generación de cotizaciones de maquinaria
- 🛒 Compra de maquinaria industrial
- 📊 Dashboard de compras por usuario
- 📈 Dashboard de ventas para administrador

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Despliegue:** Render

---

## ☁️ Despliegue en Render (Opcional)

Si deseas desplegar el proyecto en la nube con [Render](https://render.com/):

1. Crea una cuenta en [render.com](https://render.com)
2. Conecta tu repositorio de Git
3. Crea un **Web Service** apuntando a la carpeta `/Backend`
4. Agrega las variables de entorno del archivo `.env` en el panel de Render
5. Crea una base de datos PostgreSQL desde el panel de Render y actualiza las variables de conexión

---

## 👨‍💻 Autor

**Obregón Núñez Maximiliano**  
Ing. Tecnologías de la Información y Comunicaciones  
Instituto Tecnológico de México
