# 🔐 Credenciales de Acceso - Motor Universal V2

## Usuarios de Prueba

La base de datos incluye tres usuarios de prueba con diferentes roles:

### 👨‍💼 Administrador
- **Usuario:** `admin`
- **Contraseña:** `admin123`
- **Email:** admin@evaluaasi.com
- **Permisos:** Acceso completo al sistema

### ✍️ Editor
- **Usuario:** `editor`
- **Contraseña:** `editor123`
- **Email:** editor@evaluaasi.com
- **Permisos:** Crear, editar y eliminar exámenes

### 👨‍🎓 Alumno
- **Usuario:** `alumno`
- **Contraseña:** `alumno123`
- **Email:** alumno@evaluaasi.com
- **Permisos:** Ver y tomar exámenes

## 🌐 URLs de Acceso

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api
- **Documentación API (Swagger):** http://localhost:5000/apidocs

## 🔄 Reiniciar Datos

Si necesitas reiniciar los datos de prueba:

```bash
cd /workspaces/Evaluaasiv3/MotorUniversalV2/backend
docker-compose exec backend python seed.py
```

## 📝 Notas

- Las contraseñas están hasheadas con **Argon2** (seguro para producción)
- Los tokens JWT expiran después de 15 minutos (access token)
- Los refresh tokens expiran después de 30 días
- En producción, **cambia estas credenciales inmediatamente**
