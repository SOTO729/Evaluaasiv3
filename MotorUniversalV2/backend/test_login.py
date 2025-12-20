from app import create_app, db
from app.models.user import User

app = create_app()

with app.app_context():
    user = User.query.filter_by(username='admin').first()
    if user:
        print(f"Usuario encontrado: {user.username}")
        print(f"Email: {user.email}")
        print(f"Activo: {user.is_active}")
        print(f"Hash: {user.password_hash[:50]}...")
        
        # Probar contraseña
        test_passwords = ['Admin123!', 'admin123', 'password']
        for pwd in test_passwords:
            result = user.check_password(pwd)
            print(f"Password '{pwd}': {result}")
    else:
        print("Usuario no encontrado")
