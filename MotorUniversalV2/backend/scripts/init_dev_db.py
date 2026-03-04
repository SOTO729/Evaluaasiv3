"""
Script para inicializar la base de datos de desarrollo.
Crea todas las tablas y el usuario admin.

USO: DATABASE_URL="mssql+pymssql://..." python scripts/init_dev_db.py
"""
import os
import sys

# Forzar la DATABASE_URL de dev si no se especifica
if not os.getenv('DATABASE_URL'):
    os.environ['DATABASE_URL'] = (
        'mssql+pymssql://evaluaasi_admin:EvalAasi2024_newpwd!'
        '@evaluaasi-motorv2-sql.database.windows.net/evaluaasi_dev'
    )

# Deshabilitar Redis para el script de inicialización (usar cache simple)
os.environ['CACHE_TYPE'] = 'SimpleCache'
os.environ['REDIS_URL'] = ''

# Agregar el directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Monkey-patch config para usar SimpleCache en lugar de Redis
import config as cfg
cfg.Config.CACHE_TYPE = 'SimpleCache'
cfg.Config.CACHE_REDIS_URL = None
cfg.DevelopmentConfig.CACHE_TYPE = 'SimpleCache'
cfg.DevelopmentConfig.CACHE_REDIS_URL = None

from argon2 import PasswordHasher
from app import create_app, db
from app.models.user import User
from app.models.question import QuestionType

ph = PasswordHasher()

def init_dev_database():
    app = create_app('development')
    
    with app.app_context():
        print("🔧 Conectando a:", os.getenv('DATABASE_URL', '').split('@')[-1])
        
        # Crear todas las tablas
        print("📦 Creando schema (db.create_all)...")
        db.create_all()
        print("✅ Schema creado")
        
        # Ejecutar auto-migraciones
        print("🔄 Ejecutando auto-migraciones...")
        try:
            from app.auto_migrate import (
                check_and_add_columns,
                check_and_add_study_interactive_columns,
                check_and_add_answers_columns,
                check_and_add_question_types,
                check_and_add_percentage_columns,
                check_and_add_group_exam_columns,
                check_and_create_bulk_upload_tables,
            )
            check_and_add_columns()
            check_and_add_study_interactive_columns()
            check_and_add_answers_columns()
            check_and_add_question_types()
            check_and_add_percentage_columns()
            check_and_add_group_exam_columns()
            check_and_create_bulk_upload_tables()
            print("✅ Auto-migraciones completadas")
        except Exception as e:
            print(f"⚠️  Auto-migración: {e}")
        
        # Crear usuario admin si no existe
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            print("👤 Creando usuario admin...")
            admin = User(
                email='admin@evaluaasi-dev.com',
                username='admin',
                name='Administrador',
                first_surname='Dev',
                role='admin',
                is_active=True,
                is_verified=True,
            )
            admin.set_password('Admin123!')
            db.session.add(admin)
            db.session.commit()
            print("✅ Admin creado (admin / Admin123!)")
        else:
            print("ℹ️  Admin ya existe, omitiendo")
        
        # Crear tipos de preguntas si no existen
        existing = QuestionType.query.count()
        if existing == 0:
            print("📝 Creando tipos de preguntas...")
            types = [
                QuestionType(name='multiple_choice', description='Opción múltiple'),
                QuestionType(name='multiple_select', description='Selección múltiple'),
                QuestionType(name='true_false', description='Verdadero/Falso'),
                QuestionType(name='ordering', description='Ordenar'),
                QuestionType(name='fill_blank', description='Llenar el espacio'),
                QuestionType(name='drag_drop', description='Arrastrar y soltar'),
                QuestionType(name='drag_order', description='Arrastrar y ordenar'),
            ]
            db.session.add_all(types)
            db.session.commit()
            print("✅ Tipos de preguntas creados")
        else:
            print(f"ℹ️  {existing} tipos de preguntas ya existen")
        
        print("\n🎉 Base de datos de desarrollo inicializada correctamente")
        print(f"   URL: https://dev.evaluaasi.com")
        print(f"   API: https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api")
        print(f"   Login: admin / Admin123!")


if __name__ == '__main__':
    init_dev_database()
