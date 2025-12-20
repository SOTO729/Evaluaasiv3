# Arquitectura - Evaluaasi Motor Universal V2

## 📐 Vista General

Evaluaasi V2 es una aplicación web moderna que sigue el patrón de arquitectura **cliente-servidor** con separación total entre frontend y backend.

```
┌─────────────────────────────────────────────────────────┐
│                      USUARIO                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Azure Front Door (CDN)                     │
│         - SSL/TLS Termination                           │
│         - Web Application Firewall                      │
│         - DDoS Protection                               │
└─────────────┬───────────────────────┬───────────────────┘
              │                       │
              │                       │
    ┌─────────▼─────────┐   ┌────────▼────────┐
    │   Static Web App  │   │  App Service    │
    │   (React SPA)     │   │  (Flask API)    │
    │   - Vite Build    │   │  - Python 3.11  │
    │   - Tailwind CSS  │   │  - Gunicorn     │
    │   - React Router  │   │  - 4 Workers    │
    └───────────────────┘   └─────────┬───────┘
                                      │
              ┌───────────────────────┼───────────────────┐
              │                       │                   │
    ┌─────────▼──────┐    ┌──────────▼────┐  ┌──────────▼───────┐
    │ PostgreSQL     │    │  Redis Cache  │  │  Azure Blob      │
    │ Flexible Server│    │  (C0 Basic)   │  │  Storage         │
    │ - Serverless   │    │  - Session    │  │  - Uploads       │
    │ - 2 vCores     │    │  - API Cache  │  │  - Certificates  │
    └────────────────┘    └───────────────┘  └──────────────────┘
```

## 🏛️ Principios de Diseño

### 1. Separation of Concerns
- **Frontend**: Solo presentación y experiencia de usuario
- **Backend**: Lógica de negocio, validación y persistencia
- **Database**: Almacenamiento estructurado de datos
- **Cache**: Optimización de consultas frecuentes

### 2. Stateless API
- El backend no mantiene estado de sesión
- JWT tokens para autenticación
- Cada request es independiente
- Escalabilidad horizontal facilitada

### 3. Security by Design
- Principio de mínimo privilegio
- Defense in depth (múltiples capas)
- Sanitización de entrada
- Secretos en Azure Key Vault
- HTTPS obligatorio

### 4. Cloud-Native
- Diseñado para Azure desde el inicio
- Uso de servicios PaaS
- Auto-scaling capabilities
- Monitoreo integrado

## 🔄 Flujo de Datos

### Autenticación

```
1. Usuario → Frontend: Ingresa credenciales
2. Frontend → Backend: POST /api/auth/login
3. Backend → Database: Valida usuario
4. Backend → Frontend: Retorna access_token + refresh_token
5. Frontend → Local Storage: Guarda tokens
6. Frontend → Backend: Todas las requests incluyen: Authorization: Bearer <token>
```

### Operación CRUD (Ejemplo: Crear Examen)

```
1. Usuario → Frontend: Completa formulario
2. Frontend: Valida datos (React Hook Form + Zod)
3. Frontend → Backend: POST /api/exams con JWT en header
4. Backend: Verifica JWT
5. Backend: Valida permisos (role-based)
6. Backend: Valida datos (Marshmallow)
7. Backend → Database: Inserta registro
8. Backend → Cache: Invalida cache de exams list
9. Backend → Frontend: Retorna examen creado
10. Frontend: Actualiza UI (React Query cache)
```

### Upload de Archivo

```
1. Usuario → Frontend: Selecciona imagen
2. Frontend: Valida formato y tamaño
3. Frontend → Backend: POST /api/upload con multipart/form-data
4. Backend: Valida archivo
5. Backend → Azure Blob: Sube archivo
6. Azure Blob → Backend: Retorna URL
7. Backend → Database: Guarda URL en registro
8. Backend → Frontend: Retorna URL
9. Frontend: Muestra imagen
```

## 🔧 Componentes del Backend

### 1. Application Factory (`app/__init__.py`)

Patrón de diseño Factory para crear instancia de Flask:

```python
def create_app(config_name='development'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Inicializar extensiones
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app)
    cors.init_app(app)
    cache.init_app(app)
    
    # Registrar blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(exams_bp)
    
    return app
```

**Beneficios**:
- Múltiples instancias (dev, test, prod)
- Testing facilitado
- Configuración centralizada

### 2. Modelos (`app/models/`)

SQLAlchemy ORM con relaciones:

```python
class Exam(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    
    # Relaciones
    categories = db.relationship('Category', backref='exam')
    results = db.relationship('Result', backref='exam')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            # ...
        }
```

**Patrones Utilizados**:
- Active Record (métodos en modelos)
- Lazy Loading de relaciones
- Soft deletes donde aplica

### 3. Rutas (`app/routes/`)

Blueprints organizados por dominio:

```
routes/
├── auth.py          # /api/auth/*
├── exams.py         # /api/exams/*
├── users.py         # /api/users/*
├── categories.py    # /api/categories/*
└── health.py        # /api/health
```

### 4. Servicios (`app/services/`)

Lógica de negocio separada de rutas:

```python
class ExamService:
    @staticmethod
    def create_exam(data, user_id):
        # Validación de negocio
        # Transformación de datos
        # Persistencia
        # Return DTO
```

**Beneficios**:
- Reusabilidad
- Testing más fácil
- Separación de responsabilidades

### 5. Utilidades (`app/utils/`)

```
utils/
├── decorators.py      # @jwt_required, @role_required
├── helpers.py         # Paginación, vouchers
├── azure_storage.py   # Upload/delete en Blob
└── validators.py      # Validaciones custom
```

## 📱 Componentes del Frontend

### 1. Arquitectura de Componentes

```
src/
├── components/           # Componentes reutilizables
│   ├── common/          # Button, Input, Card, Modal
│   ├── auth/            # ProtectedRoute, LoginForm
│   └── layout/          # Header, Sidebar, Layout
│
├── pages/               # Páginas completas
│   ├── auth/           # LoginPage, RegisterPage
│   ├── exams/          # ExamsListPage, ExamEditPage
│   └── DashboardPage.tsx
│
├── services/            # API communication
│   ├── api.ts          # Axios instance
│   ├── authService.ts  # Auth endpoints
│   └── examService.ts  # Exam endpoints
│
├── store/               # Estado global
│   └── authStore.ts    # Zustand store
│
├── hooks/               # Custom React hooks
│   ├── useAuth.ts
│   └── useExams.ts
│
└── types/               # TypeScript definitions
    └── index.ts
```

### 2. Estado Global (Zustand)

```typescript
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
)
```

### 3. Data Fetching (React Query)

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['exams'],
  queryFn: () => examService.getExams(),
  staleTime: 5 * 60 * 1000, // 5 minutos
})

const mutation = useMutation({
  mutationFn: (data) => examService.createExam(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['exams'] })
  },
})
```

**Beneficios**:
- Cache automático
- Revalidación en background
- Optimistic updates
- Menos código boilerplate

### 4. Routing

```typescript
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  
  <Route element={<ProtectedRoute />}>
    <Route element={<Layout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/exams" element={<ExamsListPage />} />
      <Route path="/exams/create" element={<ExamCreatePage />} />
      <Route path="/exams/:id/edit" element={<ExamEditPage />} />
    </Route>
  </Route>
</Routes>
```

## 🗄️ Modelo de Datos

### Diagrama ER

```
┌─────────────┐       ┌──────────────┐       ┌───────────┐
│    User     │       │     Exam     │       │  Voucher  │
├─────────────┤       ├──────────────┤       ├───────────┤
│ id          │       │ id           │       │ id        │
│ username    │       │ name         │       │ code      │
│ email       │       │ description  │       │ exam_id   │
│ password    │       │ version      │       │ user_id   │
│ role        │       │ created_by   │───┐   │ status    │
│ full_name   │   ┌───│ category_id  │   │   └───────────┘
└─────────────┘   │   └──────────────┘   │
                  │                      │
                  │   ┌──────────────┐   │   ┌───────────┐
                  └──→│  Category    │   └──→│  Result   │
                      ├──────────────┤       ├───────────┤
                      │ id           │       │ id        │
                      │ name         │       │ exam_id   │
                      │ description  │       │ user_id   │
                      └──────────────┘       │ score     │
                           │                 │ answers   │
                           │                 └───────────┘
                      ┌────▼─────┐
                      │  Topic   │
                      ├──────────┤
                      │ id       │
                      │ name     │
                      │ category │
                      └──────────┘
                           │
                      ┌────▼─────────┐
                      │  Question    │
                      ├──────────────┤
                      │ id           │
                      │ text         │
                      │ type         │
                      │ topic_id     │
                      └──────────────┘
                           │
                      ┌────▼─────┐
                      │  Answer  │
                      ├──────────┤
                      │ id       │
                      │ text     │
                      │ correct  │
                      │ question │
                      └──────────┘
```

### Relaciones

1. **User → Exam**: 1:N (Un usuario puede crear muchos exámenes)
2. **Exam → Category**: N:1 (Muchos exámenes pertenecen a una categoría)
3. **Category → Topic**: 1:N (Una categoría tiene muchos temas)
4. **Topic → Question**: 1:N (Un tema tiene muchas preguntas)
5. **Question → Answer**: 1:N (Una pregunta tiene muchas respuestas)
6. **User + Exam → Result**: N:M (Muchos usuarios pueden tomar muchos exámenes)
7. **User + Exam → Voucher**: N:M (Vouchers permiten acceso)

## 🔐 Seguridad en Profundidad

### Capa 1: Frontend
- Validación de formularios con Zod
- Sanitización de entrada
- CSRF tokens en forms
- Content Security Policy headers

### Capa 2: Network
- HTTPS obligatorio
- Azure Front Door WAF
- DDoS protection
- Rate limiting per IP

### Capa 3: Backend
- JWT verification
- Role-based access control (RBAC)
- Input validation con Marshmallow
- SQL injection prevention (ORM)

### Capa 4: Database
- Encrypted at rest (Azure)
- Encrypted in transit (SSL)
- Private endpoints
- Minimal privileges per app

### Capa 5: Secrets Management
- Azure Key Vault
- No hardcoded credentials
- Environment variables
- Rotation de keys

## 📊 Monitoreo y Observabilidad

### Logging

```python
# Backend
import logging

logger = logging.getLogger(__name__)
logger.info(f"User {user_id} created exam {exam_id}")
logger.error(f"Failed to upload file: {error}")
```

Logs enviados a:
- Azure Application Insights
- Azure Log Analytics
- Structured logging (JSON)

### Métricas

**Backend**:
- Request/response time
- Error rate
- Database query time
- Cache hit rate
- Active users

**Frontend**:
- Page load time
- Time to interactive
- API call latency
- Error boundaries triggered
- User actions tracking

### Alertas

Configuradas en Azure Monitor:
- Response time > 1s (95th percentile)
- Error rate > 1%
- Database CPU > 80%
- Available memory < 20%
- Failed login attempts > 10/min

## 🚀 Escalabilidad

### Horizontal Scaling

**Backend**:
- Stateless design permite múltiples instancias
- Azure App Service auto-scale rules
- Load balancing automático

**Database**:
- PostgreSQL read replicas
- Connection pooling
- Query optimization con índices

**Cache**:
- Redis cluster mode
- Cache de queries frecuentes
- Session storage distribuido

### Vertical Scaling

Fácil upgrade de SKUs en Azure:
- App Service: B1 → P1v2 → P3v3
- PostgreSQL: Burstable → General Purpose
- Redis: C0 → C6

## 🔄 CI/CD Pipeline

```
┌──────────┐
│   Git    │
│  Push    │
└────┬─────┘
     │
     ▼
┌─────────────────┐
│ GitHub Actions  │
│  - Lint         │
│  - Tests        │
│  - Build        │
└────┬────────────┘
     │
     ├──► Backend Tests Pass?
     │    ├─ Yes → Build Docker Image
     │    └─ No  → Fail Pipeline
     │
     ├──► Frontend Tests Pass?
     │    ├─ Yes → Build Static Files
     │    └─ No  → Fail Pipeline
     │
     ▼
┌─────────────────┐
│  Deploy Staging │
│  - Run E2E Tests│
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ Manual Approval │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│Deploy Production│
│  - Blue/Green   │
│  - Health Check │
│  - Rollback     │
└─────────────────┘
```

## 📚 Referencias

- [Flask Best Practices](https://flask.palletsprojects.com/patterns/)
- [React Architecture](https://react.dev/learn/thinking-in-react)
- [Azure Well-Architected Framework](https://docs.microsoft.com/azure/architecture/framework/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
