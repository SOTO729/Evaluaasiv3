import pymssql

# Conectar a la base de datos
conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_c949de16dad23b6d',
    database='evaluaasi'
)

cursor = conn.cursor()

# Nuevos tipos de preguntas
new_types = [
    ('ordering', 'Ordenar'),
    ('drag_drop', 'Arrastrar y soltar'),
    ('drag_order', 'Arrastrar y ordenar')
]

print("Agregando nuevos tipos de preguntas:")
for name, description in new_types:
    # Verificar si ya existe
    cursor.execute("SELECT id FROM question_types WHERE name = %s", (name,))
    if cursor.fetchone():
        print(f"  - {name} ya existe")
    else:
        cursor.execute(
            "INSERT INTO question_types (name, description) VALUES (%s, %s)",
            (name, description)
        )
        print(f"  + {name}: {description}")

conn.commit()

# Mostrar todos los tipos
cursor.execute("SELECT id, name, description FROM question_types ORDER BY id")
print("\n✓ Tipos de preguntas en la base de datos:")
for row in cursor.fetchall():
    print(f"  {row[0]}. {row[1]}: {row[2]}")

conn.close()
print("\n✓ Completado exitosamente")
