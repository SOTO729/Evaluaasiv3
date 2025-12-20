# 🎓 Evaluaasi Motor Universal V2

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![React](https://img.shields.io/badge/react-18.0-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)

Plataforma moderna de evaluación educativa construida con React, TypeScript, Flask y PostgreSQL.

## ✨ Características Principales

- 🎯 **Gestión Completa de Exámenes**: Creación, edición y aplicación de exámenes
- 🔐 **Autenticación Segura**: JWT con refresh tokens y Argon2 para contraseñas
- 👥 **Control de Acceso por Roles**: Admin, Editor y Alumno
- 📊 **Dashboard Analítico**: Métricas y estadísticas en tiempo real
- 🎨 **UI Moderna**: Interfaz responsive con Tailwind CSS
- ⚡ **Rendimiento Optimizado**: React Query para cache y Vite para builds rápidos
- 🐳 **Containerizado**: Docker Compose para desarrollo local
- ☁️ **Cloud Ready**: Preparado para Azure con costos optimizados (~$174/mes)

## 🏗️ Stack Tecnológico

### Backend
- **Framework**: Flask 3.0 + Python 3.11
- **ORM**: SQLAlchemy 2.0
- **Base de Datos**: PostgreSQL 15
- **Cache**: Redis 7
- **Auth**: JWT Extended + Argon2
- **Cloud**: Azure SDK (Blob Storage, Key Vault)

### Frontend  
- **Framework**: React 18 + TypeScript 5
- **Build**: Vite 5
- **Styling**: Tailwind CSS 3
- **State**: Zustand + React Query (TanStack Query)
- **Routing**: React Router 6
- **DevOps**: Docker + GitHub Actions

## 🚀 Quick Start

### Requisitos Previos

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Azure CLI (para deployment)

### Desarrollo Local

```bash
# 1. Clonar y configurar
git clone <repo>
cd MotorUniversalV2

# 2. Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus configuraciones

# Inicializar base de datos
flask db upgrade
python seed.py  # Datos de prueba

# Ejecutar
flask run

# 3. Frontend (en otra terminal)
cd frontend
npm install
cp .env.example .env.local
# Editar .env.local

npm run dev

# 4. Con Docker (alternativa)
docker-compose up
```

Acceder a:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- API Docs: http://localhost:5000/api/docs

## 📁 Estructura del Proyecto

```
MotorUniversalV2/
├── backend/                 # API Flask
│   ├── app/
│   │   ├── models/         # Modelos SQLAlchemy
│   │   ├── routes/         # Endpoints API
│   │   ├── services/       # Lógica de negocio
│   │   ├── utils/          # Utilidades
│   │   └── __init__.py     # Factory app
│   ├── migrations/         # Alembic migrations
│   ├── tests/             # Tests unitarios
│   ├── config.py          # Configuración
│   └── requirements.txt
│
├── frontend/               # App React
│   ├── src/
│   │   ├── components/    # Componentes UI
│   │   ├── pages/         # Páginas/rutas
│   │   ├── services/      # API clients
│   │   ├── store/         # Estado global
│   │   ├── hooks/         # Custom hooks
│   │   └── types/         # TypeScript types
│   ├── public/
│   └── package.json
│
├── docker/                 # Dockerfiles
├── docs/                   # Documentación
└── scripts/               # Scripts deployment
```

## 🔐 Seguridad

- JWT con tokens de corta duración (15 min)
- Refresh tokens para sesiones largas
- Argon2 para hashing de passwords
- Azure Key Vault para secretos
- CORS configurado
- Rate limiting en API
- HTTPS obligatorio en producción

## 📊 Módulos Implementados

### ✅ Fase 1 (MVP)
- [x] Sistema de autenticación
- [x] Gestión de usuarios y roles
- [x] CRUD de exámenes
- [x] CRUD de categorías y temas
- [x] CRUD de preguntas y respuestas
- [x] Upload de imágenes a Azure Blob

### 🚧 Fase 2 (En desarrollo)
- [ ] Aplicación de exámenes
- [ ] Sistema de vouchers
- [ ] Generación de certificados
- [ ] Dashboard de analytics

### 📋 Fase 3 (Planificado)
- [ ] Ejercicios prácticos
- [ ] Detección de fraude
- [ ] Reportes avanzados
- [ ] API pública

## 🧪 Testing

```bash
# Backend
cd backend
pytest --cov=app tests/

# Frontend
cd frontend
npm run test
npm run test:coverage
```

## 🚢 Deployment

### Azure (Producción)

```bash
# Configurar variables
./scripts/setup-azure.sh

# Deploy
./scripts/deploy.sh production
```

Ver [docs/deployment.md](docs/deployment.md) para más detalles.

## 📚 Documentación

- [Guía de Desarrollo](docs/development.md)
- [API Reference](docs/api-reference.md)
- [Arquitectura](docs/architecture.md)
- [Deployment](docs/deployment.md)

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

## 📝 Licencia

Copyright © 2025 Evaluaasi

## 👥 Equipo

- **Tech Stack**: React + Flask + PostgreSQL + Azure
- **Versión**: 2.0.0-beta
- **Última actualización**: Diciembre 2025
