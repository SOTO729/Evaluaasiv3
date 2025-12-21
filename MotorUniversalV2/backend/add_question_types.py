"""
Script para agregar nuevos tipos de preguntas
"""
from app import create_app, db
from app.models.question import QuestionType

app = create_app()

with app.app_context():
    # Verificar tipos existentes
    existing_types = QuestionType.query.all()
    existing_names = [qt.name for qt in existing_types]
    
    print("Tipos de preguntas existentes:")
    for qt in existing_types:
        print(f"  - {qt.name}: {qt.description}")
    
    # Nuevos tipos de preguntas
    new_types = [
        {'name': 'ordering', 'description': 'Ordenar'},
        {'name': 'drag_drop', 'description': 'Arrastrar y soltar'},
        {'name': 'drag_order', 'description': 'Arrastrar y ordenar'}
    ]
    
    print("\nAgregando nuevos tipos de preguntas:")
    for new_type in new_types:
        if new_type['name'] not in existing_names:
            qt = QuestionType(
                name=new_type['name'],
                description=new_type['description']
            )
            db.session.add(qt)
            print(f"  + {new_type['name']}: {new_type['description']}")
        else:
            print(f"  - {new_type['name']} ya existe")
    
    db.session.commit()
    print("\n✓ Tipos de preguntas actualizados exitosamente")
    
    # Mostrar todos los tipos
    all_types = QuestionType.query.all()
    print(f"\nTotal de tipos de preguntas: {len(all_types)}")
    for qt in all_types:
        print(f"  {qt.id}. {qt.name}: {qt.description}")
