"""
Script para crear datos de prueba
"""
from app import create_app, db
from app.models.user import User
from app.models.exam import Exam
from app.models.category import Category
from app.models.topic import Topic
from app.models.question import Question, QuestionType
from app.models.answer import Answer
from datetime import datetime


def seed_database():
    """Poblar base de datos con datos de prueba"""
    
    print("🌱 Creando datos de prueba...")
    
    # Limpiar datos existentes
    db.drop_all()
    db.create_all()
    
    # Tipos de preguntas
    question_types = [
        QuestionType(name='multiple_choice', description='Opción múltiple'),
        QuestionType(name='multiple_select', description='Selección múltiple (varias respuestas correctas)'),
        QuestionType(name='true_false', description='Verdadero/Falso'),
        QuestionType(name='ordering', description='Ordenar'),
        QuestionType(name='fill_blank', description='Llenar el espacio'),
        QuestionType(name='drag_drop', description='Arrastrar y soltar'),
        QuestionType(name='drag_order', description='Arrastrar y ordenar')
    ]
    
    for qt in question_types:
        db.session.add(qt)
    
    db.session.commit()
    print("✓ Tipos de preguntas creados")
    
    # Usuarios de prueba
    admin = User(
        email='admin@evaluaasi.com',
        username='admin',
        name='Administrador',
        first_surname='Sistema',
        role='admin',
        is_active=True,
        is_verified=True
    )
    admin.set_password('admin123')
    
    editor = User(
        email='editor@evaluaasi.com',
        username='editor',
        name='Editor',
        first_surname='Prueba',
        role='editor',
        is_active=True,
        is_verified=True
    )
    editor.set_password('editor123')
    
    alumno = User(
        email='alumno@evaluaasi.com',
        username='alumno',
        name='Alumno',
        first_surname='Prueba',
        role='alumno',
        is_active=True,
        is_verified=True
    )
    alumno.set_password('alumno123')
    
    db.session.add_all([admin, editor, alumno])
    db.session.commit()
    print("✓ Usuarios creados (admin, editor, alumno)")
    
    # Examen de prueba
    exam = Exam(
        name='Microsoft Office Specialist - Excel',
        version='2019',
        standard='MOS',
        stage_id=1,
        description='Examen de certificación Microsoft Office Specialist en Excel 2019',
        instructions='Lee cuidadosamente cada pregunta antes de responder.',
        duration_minutes=50,
        passing_score=70,
        is_published=True,
        created_by=admin.id
    )
    
    db.session.add(exam)
    db.session.commit()
    print("✓ Examen creado")
    
    # Categoría
    category = Category(
        exam_id=exam.id,
        name='Gestión de hojas de cálculo',
        description='Gestión de hojas de cálculo y libros',
        percentage=30,
        order=1,
        created_by=admin.id
    )
    
    db.session.add(category)
    db.session.commit()
    print("✓ Categoría creada")
    
    # Tema
    topic = Topic(
        category_id=category.id,
        name='Importar datos de archivos',
        description='Importación de datos desde archivos de texto',
        order=1,
        created_by=admin.id
    )
    
    db.session.add(topic)
    db.session.commit()
    print("✓ Tema creado")
    
    # Pregunta de ejemplo
    question = Question(
        topic_id=topic.id,
        question_type_id=1,  # multiple_choice
        question_number=1,
        question_text='¿Cuál es la extensión de archivo nativa de Excel 2019?',
        points=1,
        difficulty='easy',
        created_by=admin.id
    )
    
    db.session.add(question)
    db.session.flush()
    
    # Respuestas
    answers = [
        Answer(question_id=question.id, answer_number=1, answer_text='.xlsx', is_correct=True, created_by=admin.id),
        Answer(question_id=question.id, answer_number=2, answer_text='.xls', is_correct=False, created_by=admin.id),
        Answer(question_id=question.id, answer_number=3, answer_text='.csv', is_correct=False, created_by=admin.id),
        Answer(question_id=question.id, answer_number=4, answer_text='.txt', is_correct=False, created_by=admin.id),
    ]
    
    for answer in answers:
        db.session.add(answer)
    
    db.session.commit()
    print("✓ Pregunta y respuestas creadas")
    
    print("\n✅ Base de datos poblada exitosamente!")
    print("\n📝 Credenciales de prueba:")
    print("   Admin:  admin@evaluaasi.com / admin123")
    print("   Editor: editor@evaluaasi.com / editor123")
    print("   Alumno: alumno@evaluaasi.com / alumno123")


if __name__ == '__main__':
    app = create_app('development')
    with app.app_context():
        seed_database()
