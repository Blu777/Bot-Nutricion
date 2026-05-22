# Bot Nutricional Telegram 🥗🤖

Un bot de Telegram inteligente para el seguimiento nutricional y conteo de macros. Permite a los usuarios registrar sus comidas usando lenguaje natural (español rioplatense) y utiliza un sistema híbrido de diccionarios propios y la inteligencia artificial de Gemini para estimar valores nutricionales de alimentos desconocidos.

## ✨ Características Principales

- **Registro en Lenguaje Natural**: Simplemente decile al bot lo que comiste (ej: *"2 milanesas de pollo con ensalada de tomate y lechuga"*).
- **Inteligencia Artificial (Gemini)**: Si un alimento no está en la base de datos local, el bot se conecta automáticamente con Gemini para estimar sus macros (proteínas, carbohidratos, grasas y calorías) usando parámetros seguros.
- **Base de Datos Local (Semilla)**: Incluye un diccionario de alimentos argentinos precargados para mayor precisión sin depender exclusivamente de la IA.
- **Seguimiento Diario**: Mantiene un registro de las calorías y macros consumidos vs. tus objetivos diarios, adaptado a tu peso y metas (bajar grasa, mantener, ganar masa muscular).
- **Deshacer Errores**: Permite eliminar la última comida registrada si te equivocaste.
- **Recomendaciones Inteligentes**: Te sugiere opciones de comidas según lo que te falte para alcanzar tus objetivos del día.

## 🛠️ Tecnologías Utilizadas

- **Lenguaje**: TypeScript / Node.js
- **Bot Framework**: [grammY](https://grammy.dev/)
- **API Framework**: [Hono](https://hono.dev/)
- **Base de Datos**: PostgreSQL
- **IA**: Google Gemini API (`gemini-2.5-flash-lite`)
- **Infraestructura**: Docker & Docker Compose

## 🚀 Instalación y Despliegue (Docker)

La forma más fácil de desplegar el bot (por ejemplo en TrueNAS o cualquier servidor Linux) es usando Docker Compose.

### 1. Requisitos Previos
- Docker y Docker Compose instalados.
- Un token de bot de Telegram (crealo hablando con [@BotFather](https://t.me/botfather)).
- Una API Key de Google Gemini (podés obtenerla en [Google AI Studio](https://aistudio.google.com/)).

### 2. Configuración
Cloná el repositorio y configurá tus variables de entorno creando un archivo `.env` en la raíz del proyecto basándote en el `.env.example`:

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/nutrition
API_BASE_URL=http://api:3000
API_SECRET=una-clave-secreta-fuerte
TELEGRAM_BOT_TOKEN=tu_token_de_telegram
GEMINI_API_KEY=tu_api_key_de_gemini
GEMINI_MODEL=gemini-2.5-flash-lite
```

### 3. Levantar los servicios
Ejecutá el siguiente comando para levantar la base de datos, el inicializador, la API y el bot:

```bash
docker compose up -d
```

### 4. Poblar la base de datos (Seed)
Para que el bot reconozca los alimentos más comunes sin gastar tokens de Gemini, es necesario correr el script inicial para cargar el diccionario a PostgreSQL:

```bash
docker compose exec api node dist/db/seed/food-dictionary.js
```

*(Nota: si actualizás la aplicación, asegúrate de correr `docker compose up db-init` para aplicar las migraciones de tablas antes de ejecutar el seed nuevamente).*

## 📱 Comandos del Bot

Una vez iniciado, podés interactuar con el bot mediante los siguientes comandos:

- `/start` - Inicia el onboarding para configurar tu peso y objetivos.
- `/perfil` - Actualiza tu peso actual y metas.
- `/summary` - Muestra un resumen de lo que comiste en el día y cuánto te falta.
- `/recommend` - Te da ideas de comidas que encajan con los macros que te quedan en el día.
- `/undo` - Deshace el último registro de comida.
- `/reset` - Borra todos los registros del día actual.

¡Cualquier texto libre que le envíes será interpretado como un registro de comida!

## 🤝 Contribuciones
Si querés agregar más alimentos al diccionario, modificá el archivo `src/db/seed/food-dictionary.ts` y corré nuevamente el comando de seed.
