# Guía de Contribución

¡Gracias por tu interés en contribuir a Evaluaasi Motor Universal V2! 🎉

## 🤝 Código de Conducta

- Sé respetuoso y profesional
- Ayuda a crear un ambiente acogedor
- Acepta críticas constructivas
- Enfócate en lo mejor para el proyecto

## 🚀 Cómo Contribuir

### 1. Fork y Clone

```bash
# Fork el repositorio en GitHub
# Luego clona tu fork
git clone https://github.com/TU_USERNAME/evaluaasi.git
cd evaluaasi/MotorUniversalV2

# Agrega el repo original como upstream
git remote add upstream https://github.com/ORIGINAL_OWNER/evaluaasi.git
```

### 2. Crea una Rama

Usa nombres descriptivos siguiendo estas convenciones:

- `feature/nombre-feature` - Para nuevas características
- `fix/descripcion-bug` - Para correcciones de bugs
- `docs/descripcion` - Para documentación
- `refactor/descripcion` - Para refactoring
- `test/descripcion` - Para tests

```bash
git checkout -b feature/mi-nueva-caracteristica
```

### 3. Desarrollo

#### Backend (Python/Flask)

**Estándares de Código:**
- Seguir PEP 8
- Usar type hints cuando sea posible
- Docstrings en funciones públicas
- Máximo 100 caracteres por línea

**Ejemplo:**

```python
def create_exam(name: str, description: str, created_by: int) -> Exam:
    """
    Crea un nuevo examen.
    
    Args:
        name: Nombre del examen
        description: Descripción del examen
        created_by: ID del usuario creador
        
    Returns:
        Instancia del examen creado
        
    Raises:
        ValueError: Si los datos son inválidos
    """
    exam = Exam(name=name, description=description, created_by=created_by)
    db.session.add(exam)
    db.session.commit()
    return exam
```

**Tests:**

```bash
# Ejecutar tests
cd backend
pytest

# Con cobertura
pytest --cov=app tests/

# Test específico
pytest tests/test_exams.py::test_create_exam -v
```

**Linting:**

```bash
# Formatear código
black app/

# Lint
flake8 app/
pylint app/
```

#### Frontend (React/TypeScript)

**Estándares de Código:**
- Usar TypeScript estricto
- Functional components con hooks
- Props con interfaces TypeScript
- Nombres de componentes en PascalCase
- Nombres de archivos coinciden con componente principal

**Ejemplo:**

```typescript
interface ExamCardProps {
  exam: Exam
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}

const ExamCard: React.FC<ExamCardProps> = ({ exam, onEdit, onDelete }) => {
  return (
    <div className="card">
      <h3>{exam.name}</h3>
      <p>{exam.description}</p>
      <button onClick={() => onEdit(exam.id)}>Editar</button>
      <button onClick={() => onDelete(exam.id)}>Eliminar</button>
    </div>
  )
}

export default ExamCard
```

**Tests:**

```bash
cd frontend

# Ejecutar tests
npm run test

# Con cobertura
npm run test:coverage

# En modo watch
npm run test:watch
```

**Linting:**

```bash
# Lint
npm run lint

# Lint + fix
npm run lint:fix

# Format con Prettier
npm run format
```

### 4. Commits

Usa mensajes de commit descriptivos siguiendo [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>[scope opcional]: <descripción>

[cuerpo opcional]

[footer opcional]
```

**Tipos:**
- `feat`: Nueva característica
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Cambios de formato (no afectan código)
- `refactor`: Refactoring de código
- `test`: Agregar o modificar tests
- `chore`: Tareas de mantenimiento

**Ejemplos:**

```bash
git commit -m "feat(exams): add bulk delete functionality"
git commit -m "fix(auth): resolve JWT expiration issue"
git commit -m "docs(readme): update installation instructions"
git commit -m "refactor(api): simplify error handling"
```

### 5. Push y Pull Request

```bash
# Asegúrate de estar actualizado
git fetch upstream
git rebase upstream/main

# Push a tu fork
git push origin feature/mi-nueva-caracteristica
```

Luego crea un Pull Request en GitHub con:

**Título:** Breve descripción (50 caracteres max)

**Descripción:**
```markdown
## Descripción
Breve descripción de los cambios

## Tipo de cambio
- [ ] Bug fix (cambio que corrige un issue)
- [ ] Nueva característica (cambio que agrega funcionalidad)
- [ ] Breaking change (fix o feature que causa incompatibilidad)
- [ ] Documentación

## ¿Cómo se probó?
Describe las pruebas realizadas

## Checklist
- [ ] Mi código sigue las guías de estilo
- [ ] He realizado self-review
- [ ] He comentado código complejo
- [ ] He actualizado la documentación
- [ ] Mis cambios no generan warnings
- [ ] He agregado tests
- [ ] Tests nuevos y existentes pasan localmente
```

## 🧪 Testing

### Backend Tests

```python
# tests/test_exams.py
import pytest
from app.models import Exam

def test_create_exam(client, auth_token):
    """Test exam creation."""
    response = client.post(
        '/api/exams',
        json={'name': 'Test Exam', 'description': 'Test'},
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    assert response.status_code == 201
    assert response.json['exam']['name'] == 'Test Exam'

def test_create_exam_unauthorized(client):
    """Test exam creation without authentication."""
    response = client.post('/api/exams', json={'name': 'Test'})
    assert response.status_code == 401
```

### Frontend Tests

```typescript
// ExamCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import ExamCard from './ExamCard'

describe('ExamCard', () => {
  const mockExam = {
    id: 1,
    name: 'Test Exam',
    description: 'Test Description',
  }

  it('renders exam information', () => {
    render(<ExamCard exam={mockExam} onEdit={jest.fn()} onDelete={jest.fn()} />)
    
    expect(screen.getByText('Test Exam')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', () => {
    const onEdit = jest.fn()
    render(<ExamCard exam={mockExam} onEdit={onEdit} onDelete={jest.fn()} />)
    
    fireEvent.click(screen.getByText('Editar'))
    expect(onEdit).toHaveBeenCalledWith(1)
  })
})
```

## 📝 Documentación

Si agregas una nueva característica:

1. **Actualiza README.md** si es necesario
2. **Documenta la API** en Swagger (backend)
3. **Agrega ejemplos** de uso
4. **Actualiza docs/** si aplica

## 🐛 Reportar Bugs

Usa el [issue tracker](https://github.com/OWNER/evaluaasi/issues) con esta plantilla:

```markdown
**Descripción del Bug**
Descripción clara y concisa del problema.

**Pasos para Reproducir**
1. Ir a '...'
2. Click en '...'
3. Scroll hasta '...'
4. Ver error

**Comportamiento Esperado**
Lo que debería suceder.

**Screenshots**
Si aplica, agrega screenshots.

**Entorno:**
 - OS: [e.g. macOS 13.0]
 - Navegador: [e.g. Chrome 110]
 - Versión: [e.g. v2.1.0]

**Contexto Adicional**
Cualquier otra información relevante.
```

## ✨ Solicitar Features

Usa el issue tracker con etiqueta `enhancement`:

```markdown
**Problema a Resolver**
Descripción clara del problema que resuelve el feature.

**Solución Propuesta**
Describe cómo te gustaría que funcione.

**Alternativas Consideradas**
Otras soluciones que consideraste.

**Contexto Adicional**
Screenshots, mockups, etc.
```

## 📋 Checklist de PR

Antes de enviar tu PR, verifica:

- [ ] El código sigue las guías de estilo
- [ ] Todos los tests pasan
- [ ] Cobertura de tests no disminuyó
- [ ] No hay errores de linting
- [ ] Documentación actualizada
- [ ] Commits siguen convenciones
- [ ] Branch está actualizado con main
- [ ] PR tiene descripción clara
- [ ] Screenshots agregados si hay cambios UI

## 🎯 Áreas que Necesitan Ayuda

Busca issues con estas etiquetas:

- `good first issue` - Ideal para nuevos contribuidores
- `help wanted` - Necesitamos ayuda aquí
- `bug` - Bugs reportados
- `enhancement` - Nuevas características
- `documentation` - Mejoras a docs

## 💬 Preguntas

Si tienes preguntas:

1. Revisa la [documentación](./docs/)
2. Busca en issues cerrados
3. Crea un nuevo issue con etiqueta `question`
4. Únete a nuestro Discord/Slack (si aplica)

## 🏆 Reconocimiento

Los contribuidores serán agregados a:
- Sección de Contributors en README.md
- Archivo AUTHORS
- Release notes cuando aplique

## 📄 Licencia

Al contribuir, aceptas que tus contribuciones serán licenciadas bajo la misma licencia MIT del proyecto.

---

¡Gracias por contribuir a Evaluaasi! 🙏
