"""One-off: migra imágenes de examen guardadas como base64 (columna image_url) a
Azure Blob Storage, dejando solo la URL. Reduce el payload de /exams y el tamaño de
la BD. Idempotente: solo toca filas cuyo image_url empieza con 'data:'.

Ejecutar DENTRO del contenedor (tiene DATABASE_URL y AZURE_STORAGE_CONNECTION_STRING):
    az containerapp exec --name <app> --resource-group <rg> \
        --command "python migration_pg/migrate_exam_images.py"
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db  # noqa: E402
from app.models.exam import Exam  # noqa: E402
from app.utils.azure_storage import azure_storage  # noqa: E402

app = create_app(os.getenv('FLASK_ENV', 'production'))

with app.app_context():
    if not getattr(azure_storage, 'blob_service_client', None):
        print("ERROR: Azure Blob Storage no está configurado en este entorno. Aborto.")
        sys.exit(1)

    exams = Exam.query.filter(Exam.image_url.like('data:%')).all()
    print(f"Exámenes con imagen base64 a migrar: {len(exams)}")
    migrated = 0
    failed = 0
    for e in exams:
        size = len(e.image_url or '')
        try:
            url = azure_storage.upload_base64_image(e.image_url, folder='exam-images')
        except Exception as ex:
            url = None
            print(f"  exam {e.id}: EXCEPCIÓN {ex}")
        if url:
            e.image_url = url
            migrated += 1
            print(f"  exam {e.id}: {size} bytes base64 -> {url}")
        else:
            failed += 1
            print(f"  exam {e.id}: FALLÓ subida (se mantiene base64)")

    if migrated:
        db.session.commit()
    print(f"\nResultado: {migrated} migrados, {failed} fallidos de {len(exams)} totales.")
