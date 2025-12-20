# Guía de Desarrollo - Evaluaasi Motor Universal V2

## 🚀 Inicio Rápido

### Requisitos Previos
- Docker & Docker Compose
- Node.js 18+ (para desarrollo local)
- Python 3.11+ (para desarrollo local)
- PostgreSQL 15+ (opcional, para desarrollo sin Docker)

### Instalación con Docker (Recomendado)

```bash
# 1. Clonar el repositorio
cd MotorUniversalV2

# 2. Configurar variables de entorno
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Editar backend/.env con tus credenciales de Azure (opcional)
# SECRET_KEY, JWT_SECRET_KEY, DATABASE_URL, etc.

# 4. Iniciar servicios con Docker Compose
docker-compose up -d

# 5. Crear base de datos y ejecutar migraciones
docker-compose exec backend flask db upgrade

# 6. (Opcional) Cargar datos de prueba
docker-compose exec backend python seed.py

# 7. Acceder a la aplicación
# Frontend: http://localhost:5173
# Backend API: http://localhost:5000
# Swagger Docs: http://localhost:5000/api/docs
```

### Instalación Local (Sin Docker)

#### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Crear base de datos
flask db upgrade

# Cargar datos de prueba (opcional)
python seed.py

# Iniciar servidor de desarrollo
flask run --reload
```

#### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Iniciar servidor de desarrollo
npm run dev
```

## 📁 Estructura del Proyecto

```
MotorUniversalV2/
├── backend/                 # API Flask
│   ├── app/
│   │   ├── __init__.py      # Factory de aplicación
│   │   ├── models/          # Modelos SQLAlchemy
│   │   ├── routes/          # Endpoints API
│   │   ├── services/        # Lógica de negocio
│   │   └── utils/           # Utilidades (Azure, helpers)
│   ├── migrations/          # Migraciones de base de datos
│   ├── tests/               # Tests unitarios
│   ├── config.py            # Configuración multi-entorno
│   ├── run.py               # Punto de entrada
│   └── requirements.txt     # Dependencias Python
│
├── frontend/                # Aplicación React
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/           # Páginas/Vistas
│   │   ├── services/        # API clients
│   │   ├── store/           # Estado global (Zustand)
│   │   ├── hooks/           # Custom hooks
│   │   ├── types/           # TypeScript types
│   │   └── lib/             # Utilidades
│   ├── public/              # Assets estáticos
│   └── package.json         # Dependencias Node
│
├── docker/                  # Configuración Docker
├── docs/                    # Documentación
└── docker-compose.yml       # Orquestación de servicios
```

## 🔧 Desarrollo

### Backend (Flask)

#### Crear una migración
```bash
flask db migrate -m "descripcion del cambio"
flask db upgrade
```

#### Ejecutar tests
```bash
pytest
pytest --cov=app tests/  # Con cobertura
```

#### Crear un nuevo modelo

```python
# app/models/mi_modelo.py
from app import db
from datetime import datetime

class MiModelo(db.Model):
    __tablename__ = 'mi_tabla'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

#### Crear un nuevo endpoint

```python
# app/routes/mi_ruta.py
from flask import Blueprint, jsonify, request
from app.utils.decorators import jwt_required, role_required

mi_bp = Blueprint('mi_ruta', __name__)

@mi_bp.route('/mi-endpoint', methods=['GET'])
@jwt_required
@role_required(['admin', 'editor'])
def mi_funcion():
    return jsonify({'message': 'Éxito'}), 200
```

### Frontend (React + TypeScript)

#### Crear un nuevo componente

```typescript
// src/components/MiComponente.tsx
import React from 'react'

interface MiComponenteProps {
  titulo: string
}

const MiComponente: React.FC<MiComponenteProps> = ({ titulo }) => {
  return (
    <div className="card">
      <h2>{titulo}</h2>
    </div>
  )
}

export default MiComponente
```

#### Consumir API con React Query

```typescript
import { useQuery } from '@tanstack/react-query'
import { examService } from '../services/examService'

const MiComponente = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examService.getExams(),
  })

  if (isLoading) return <div>Cargando...</div>
  if (error) return <div>Error</div>

  return <div>{/* Renderizar data */}</div>
}
```

#### Ejecutar tests
```bash
npm run test
npm run test:coverage
```

#### Build de producción
```bash
npm run build
npm run preview  # Preview del build
```

## 🔐 Autenticación

El sistema utiliza JWT (JSON Web Tokens) con refresh tokens:

1. Login: `POST /api/auth/login` → Retorna `access_token` y `refresh_token`
2. Acceso a recursos protegidos: Header `Authorization: Bearer <access_token>`
3. Renovar token: `POST /api/auth/refresh` con `refresh_token`
4. Logout: `POST /api/auth/logout`

### Usuarios de Prueba (después de ejecutar seed.py)

```
Admin:
  username: admin
  password: Admin123!

Editor:
  username: editor
  password: Editor123!

Alumno:
  username: alumno
  password: Alumno123!
```

## 🐛 Debugging

### Backend
```bash
# Activar modo debug
export FLASK_DEBUG=1
flask run

# O con VS Code, usar launch.json configurado
```

### Frontend
- Usar React DevTools en el navegador
- Console logs con `console.log()`
- VS Code debugger con Chrome

## 📊 Base de Datos

### Conectarse a PostgreSQL (Docker)
```bash
docker-compose exec db psql -U evaluaasi_user -d evaluaasi
```

### Backup
```bash
docker-compose exec db pg_dump -U evaluaasi_user evaluaasi > backup.sql
```

### Restore
```bash
docker-compose exec -T db psql -U evaluaasi_user evaluaasi < backup.sql
```

## 🌐 Variables de Entorno

### Backend (.env)
```env
FLASK_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/evaluaasi
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=2592000

# Azure (opcional)
AZURE_STORAGE_ACCOUNT_NAME=
AZURE_STORAGE_ACCOUNT_KEY=
AZURE_STORAGE_CONTAINER_NAME=
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

## 🚢 Despliegue

Ver [docs/deployment.md](./deployment.md) para instrucciones de despliegue en Azure.

## 📝 Convenciones de Código

### Python (Backend)
- PEP 8 style guide
- Type hints recomendados
- Docstrings en funciones públicas
- Tests para nuevas funcionalidades

### TypeScript (Frontend)
- ESLint + Prettier configurados
- Functional components con hooks
- Props con interfaces TypeScript
- Tests con Vitest

## 🔍 Logs

### Ver logs de Docker
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Logs en producción
- Backend: Logs se envían a Azure Application Insights
- Frontend: Errores capturados con error boundaries

## ⚡ Performance

### Backend
- Redis para cache de consultas frecuentes
- Paginación en endpoints (20 items por defecto)
- Compresión gzip habilitada

### Frontend
- Code splitting automático con Vite
- Lazy loading de componentes
- React Query para cache de datos

## 📚 Recursos Adicionales

- [Documentación de Flask](https://flask.palletsprojects.com/)
- [Documentación de React](https://react.dev/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
- [React Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/)

## 🆘 Solución de Problemas

### "Cannot connect to database"
- Verificar que PostgreSQL esté corriendo: `docker-compose ps`
- Verificar DATABASE_URL en .env

### "CORS error" en frontend
- Verificar que VITE_API_URL apunte correctamente al backend
- Verificar configuración CORS en backend/app/__init__.py

### "Module not found" en backend
- Activar entorno virtual
- Reinstalar dependencias: `pip install -r requirements.txt`

### "npm install fails"
- Limpiar cache: `npm cache clean --force`
- Eliminar node_modules y package-lock.json, reinstalar
