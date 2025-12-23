# Guía de Pruebas para Verificar Logs del Backend

## Preparación
1. Abre una terminal y ejecuta el backend con logs visibles:
```bash
cd /workspaces/Evaluaasiv3/MotorUniversalV2/backend
python run.py
```

## Secuencia de Pruebas

### PRUEBA 1: Crear un nuevo ejercicio
**Acción:** 
1. Ve a la lista de ejercicios de un tema
2. Haz clic en "Nuevo Ejercicio"
3. Escribe un contenido de prueba
4. Haz clic en "Crear Ejercicio"
5. Se debe abrir automáticamente el editor visual

**Logs esperados:**
- No hay logs específicos para crear ejercicio (puedes agregar si quieres)
- El editor se abre automáticamente

---

### PRUEBA 2: Crear el primer paso
**Acción:**
1. En el editor visual, haz clic en "Nuevo Paso"
2. Escribe un título (ej: "Paso 1")
3. Sube una imagen
4. Haz clic en "Crear Paso"

**Logs esperados:**
```
=== CREAR PASO DE EJERCICIO ===
Exercise ID: [uuid]
Datos recibidos: {'title': 'Paso 1', 'description': '', 'image_url': '...'}
Número de paso asignado: 1
✓ Paso creado exitosamente: ID=[uuid], Número=1
=== FIN CREAR PASO ===
```

**Verificación:** El paso debe aparecer en la lista de pasos del editor

---

### PRUEBA 3: Crear un segundo paso
**Acción:**
1. Haz clic en "Nuevo Paso" nuevamente
2. Escribe un título (ej: "Paso 2")
3. Sube una imagen
4. Haz clic en "Crear Paso"

**Logs esperados:**
```
=== CREAR PASO DE EJERCICIO ===
Exercise ID: [uuid]
Datos recibidos: {'title': 'Paso 2', ...}
Número de paso asignado: 2
✓ Paso creado exitosamente: ID=[uuid], Número=2
=== FIN CREAR PASO ===
```

---

### PRUEBA 4: Actualizar un paso existente
**Acción:**
1. Haz clic en el botón "Editar" de uno de los pasos
2. Cambia el título (ej: "Paso 1 - Editado")
3. Haz clic en "Actualizar Paso"

**Logs esperados:**
```
=== ACTUALIZAR PASO ===
Step ID: [uuid]
Datos a actualizar: {'title': 'Paso 1 - Editado', ...}
✓ Paso actualizado exitosamente: ID=[uuid]
=== FIN ACTUALIZAR PASO ===
```

---

### PRUEBA 5: Crear una acción de botón
**Acción:**
1. Selecciona el primer paso
2. Haz clic en la herramienta "Agregar Botón Correcto"
3. Dibuja un área en la imagen (arrastra el mouse)
4. Suelta el mouse

**Logs esperados:**
```
=== CREAR ACCIÓN ===
Step ID: [uuid]
Datos recibidos: {'action_type': 'button', 'position_x': 100, 'position_y': 150, ...}
Número de acción asignado: 1
✓ Acción creada exitosamente: ID=[uuid], Tipo=button, Número=1
=== FIN CREAR ACCIÓN ===
```

**Verificación:** El botón debe aparecer en la imagen con borde azul

---

### PRUEBA 6: Crear una acción de campo de texto
**Acción:**
1. Haz clic en la herramienta "Agregar Campo de Texto"
2. Dibuja un área en la imagen
3. Suelta el mouse

**Logs esperados:**
```
=== CREAR ACCIÓN ===
Step ID: [uuid]
Datos recibidos: {'action_type': 'textbox', 'position_x': 200, 'position_y': 250, ...}
Número de acción asignado: 2
✓ Acción creada exitosamente: ID=[uuid], Tipo=textbox, Número=2
=== FIN CREAR ACCIÓN ===
```

---

### PRUEBA 7: Editar una acción
**Acción:**
1. Haz doble clic sobre uno de los botones/campos de texto creados
2. Se abre el modal "Editar Botón" o "Editar Campo de Texto"
3. Cambia el texto/etiqueta
4. Cambia algún otro campo (ej: color de texto, tipo de letra)
5. Haz clic en "Guardar"

**Logs esperados:**
```
=== ACTUALIZAR ACCIÓN ===
Action ID: [uuid]
Datos a actualizar: {'label': 'Nuevo texto', 'text_color': '#000000', ...}
✓ Acción actualizada exitosamente: ID=[uuid]
=== FIN ACTUALIZAR ACCIÓN ===
```

---

### PRUEBA 8: Eliminar una acción
**Acción:**
1. Selecciona una acción (clic sobre ella)
2. Presiona la tecla "Delete" o haz clic derecho y selecciona eliminar
3. Confirma la eliminación si hay modal de confirmación

**Logs esperados:**
```
=== ELIMINAR ACCIÓN ===
Action ID: [uuid]
Eliminando acción tipo 'button' del paso [uuid]
✓ Acción eliminada exitosamente
=== FIN ELIMINAR ACCIÓN ===
```

**Verificación:** La acción debe desaparecer de la imagen

---

### PRUEBA 9: Eliminar un paso (con renumeración)
**Acción:**
1. Haz clic en "Eliminar" en uno de los pasos (preferiblemente el paso 1 si tienes 2 o más)
2. Confirma la eliminación

**Logs esperados:**
```
=== ELIMINAR PASO ===
Step ID: [uuid]
Eliminando paso #1 del ejercicio [uuid]
✓ Paso eliminado de la base de datos
Renumerando 1 pasos restantes...
  Paso [uuid]: #2 → #1
✓ Renumeración completada
=== FIN ELIMINAR PASO ===
```

**Verificación crítica:** 
- El paso debe desaparecer
- Los pasos restantes deben renumerarse correctamente (#2 debe convertirse en #1)

---

### PRUEBA 10: Guardar y salir (actualizar ejercicio a completo)
**Acción:**
1. Asegúrate de tener al menos un paso creado
2. Haz clic en "Guardar y Salir"

**Logs esperados:**
- No hay logs específicos para esto aún, pero el ejercicio debe marcarse como "Completo" en la lista

**Verificación:** 
- El editor debe cerrarse
- El ejercicio debe aparecer con estado "Completo" en la lista de ejercicios

---

## Resumen de Verificaciones Importantes

### Base de Datos
Después de las pruebas, puedes verificar la base de datos:

```bash
# Conectar a PostgreSQL
docker exec -it motoruniversalv2-db-1 psql -U evaluaasi_user -d evaluaasi_db

# Ver pasos de un ejercicio específico
SELECT id, exercise_id, step_number, title FROM exercise_steps WHERE exercise_id = 'EXERCISE_ID' ORDER BY step_number;

# Ver acciones de un paso específico
SELECT id, step_id, action_number, action_type, label FROM exercise_actions WHERE step_id = 'STEP_ID' ORDER BY action_number;

# Salir
\q
```

### Puntos Críticos a Verificar

1. **Numeración secuencial:** Los pasos deben estar numerados 1, 2, 3... sin saltos
2. **Renumeración tras eliminar:** Al eliminar el paso #1, el paso #2 debe convertirse en #1
3. **Cascada de eliminación:** Al eliminar un paso, todas sus acciones deben eliminarse automáticamente
4. **Persistencia:** Todos los datos guardados deben permanecer después de cerrar el editor y volver a abrirlo

---

## Errores Comunes a Buscar

1. **Pasos duplicados:** Múltiples pasos con el mismo `step_number`
2. **Acciones huérfanas:** Acciones que referencian pasos eliminados
3. **Errores de imagen:** Problemas al subir imágenes a blob storage
4. **Errores de orden:** ORDER BY duplicado causando errores en las consultas

---

## Ejecución de las Pruebas

**Ejecuta las pruebas en este orden:**
1. PRUEBA 1 → 2 → 3 (crear ejercicio y pasos)
2. PRUEBA 5 → 6 (crear acciones)
3. PRUEBA 7 (editar acción)
4. PRUEBA 4 (editar paso)
5. PRUEBA 8 (eliminar acción)
6. PRUEBA 9 (eliminar paso - verificar renumeración)
7. PRUEBA 10 (guardar y salir)

Copia y pega los logs que veas en cada paso y compártalos conmigo si encuentras algún error o comportamiento inesperado.
