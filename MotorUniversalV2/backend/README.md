# Backend - Flask API

API RESTful para Motor Universal V2

## Instalación

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Configuración

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

## Migraciones de Base de Datos

```bash
# Crear migración
flask db migrate -m "descripción"

# Aplicar migraciones
flask db upgrade

# Revertir
flask db downgrade
```

## Ejecutar

```bash
# Desarrollo
flask run

# Con hot-reload
flask run --reload

# Producción
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"
```

## Tests

```bash
pytest
pytest --cov=app tests/
pytest -v tests/test_auth.py
```

## Endpoints

Ver documentación en `/api/docs` cuando el servidor esté corriendo.

### Autenticación
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Exámenes
- `GET /api/exams` - Listar exámenes
- `POST /api/exams` - Crear examen
- `GET /api/exams/:id` - Obtener examen
- `PUT /api/exams/:id` - Actualizar examen
- `DELETE /api/exams/:id` - Eliminar examen

### Categorías
- `GET /api/exams/:id/categories` - Listar categorías
- `POST /api/exams/:id/categories` - Crear categoría

### Temas
- `GET /api/categories/:id/topics` - Listar temas
- `POST /api/categories/:id/topics` - Crear tema

### Preguntas
- `GET /api/topics/:id/questions` - Listar preguntas
- `POST /api/topics/:id/questions` - Crear pregunta
# Deployment timestamp: Tue Dec 23 18:44:57 UTC 2025
