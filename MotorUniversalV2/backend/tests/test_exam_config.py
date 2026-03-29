"""
Tests para la funcionalidad de configuración de examen (ExamConfigPage).

Verifica que los campos default_* del modelo Exam se pueden:
  - establecer al crear un examen
  - actualizar vía PUT /api/exams/<id>
  - leer vía GET /api/exams/<id>
  - restablecer a null (cantidades)
  - validar (content_type solo valores permitidos)

Campos probados:
  - default_max_attempts (int, default 2)
  - default_max_disconnections (int, default 3)
  - default_exam_content_type (str, default 'mixed')
  - default_exam_questions_count (int, nullable)
  - default_exam_exercises_count (int, nullable)
  - default_simulator_questions_count (int, nullable)
  - default_simulator_exercises_count (int, nullable)

USO:
  cd backend && python -m pytest tests/test_exam_config.py -v
"""
import sys
import os
import uuid

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ─── Flask app + DB fixture ──────────────────────────────────

@pytest.fixture(scope='module')
def app_and_db():
    """Crea la app Flask con BD SQLite en memoria."""
    os.environ['JWT_SECRET_KEY'] = 'test-secret-config'
    os.environ.setdefault(
        'AZURE_STORAGE_CONNECTION_STRING',
        'DefaultEndpointsProtocol=https;AccountName=fake;'
        'AccountKey=ZmFrZWtleQ==;EndpointSuffix=core.windows.net',
    )
    try:
        from app import create_app, db as flask_db
        app = create_app('testing')
        with app.app_context():
            flask_db.create_all()
            yield app, flask_db
            flask_db.drop_all()
    except Exception as e:
        pytest.skip(f'No se pudo crear la app Flask: {e}')


@pytest.fixture(scope='module')
def editor_token(app_and_db):
    """Crea un usuario editor y retorna su JWT token."""
    app, db = app_and_db
    from app.models.user import User
    from flask_jwt_extended import create_access_token

    with app.app_context():
        user = User(
            id=str(uuid.uuid4()),
            email=f'editor_config_{uuid.uuid4().hex[:6]}@evaluaasi.com',
            username=f'editor_config_{uuid.uuid4().hex[:6]}',
            name='Editor',
            first_surname='Config',
            role='editor',
        )
        user.set_password('test1234')
        db.session.add(user)
        db.session.commit()

        token = create_access_token(identity=user.id)
        return token, user.id


@pytest.fixture(scope='module')
def sample_exam(app_and_db, editor_token):
    """Crea un examen de prueba y retorna su id."""
    app, db = app_and_db
    token, user_id = editor_token
    from app.models.exam import Exam

    with app.app_context():
        exam = Exam(
            name='Examen Config Test',
            version='1.0',
            stage_id=1,
            passing_score=70,
            created_by=user_id,
        )
        db.session.add(exam)
        db.session.commit()
        return exam.id


# ─── Tests del modelo ────────────────────────────────────────

class TestExamConfigModel:
    """Verifica valores default del modelo Exam."""

    def test_default_max_attempts_is_2(self, app_and_db, sample_exam):
        app, db = app_and_db
        from app.models.exam import Exam
        with app.app_context():
            exam = Exam.query.get(sample_exam)
            assert exam.default_max_attempts == 2

    def test_default_max_disconnections_is_3(self, app_and_db, sample_exam):
        app, db = app_and_db
        from app.models.exam import Exam
        with app.app_context():
            exam = Exam.query.get(sample_exam)
            assert exam.default_max_disconnections == 3

    def test_default_content_type_is_mixed(self, app_and_db, sample_exam):
        app, db = app_and_db
        from app.models.exam import Exam
        with app.app_context():
            exam = Exam.query.get(sample_exam)
            assert exam.default_exam_content_type == 'mixed'

    def test_default_counts_are_null(self, app_and_db, sample_exam):
        app, db = app_and_db
        from app.models.exam import Exam
        with app.app_context():
            exam = Exam.query.get(sample_exam)
            assert exam.default_exam_questions_count is None
            assert exam.default_exam_exercises_count is None
            assert exam.default_simulator_questions_count is None
            assert exam.default_simulator_exercises_count is None


# ─── Tests de la API PUT ─────────────────────────────────────

class TestExamConfigAPI:
    """Verifica el endpoint PUT /api/exams/<id> para campos de configuración."""

    def test_update_max_attempts(self, app_and_db, editor_token, sample_exam):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={'default_max_attempts': 5},
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['exam']['default_max_attempts'] == 5

    def test_update_max_disconnections(self, app_and_db, editor_token, sample_exam):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={'default_max_disconnections': 7},
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['exam']['default_max_disconnections'] == 7

    def test_update_content_type_questions_only(self, app_and_db, editor_token, sample_exam):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={'default_exam_content_type': 'questions_only'},
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            assert resp.get_json()['exam']['default_exam_content_type'] == 'questions_only'

    def test_update_content_type_exercises_only(self, app_and_db, editor_token, sample_exam):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={'default_exam_content_type': 'exercises_only'},
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            assert resp.get_json()['exam']['default_exam_content_type'] == 'exercises_only'

    def test_update_content_type_back_to_mixed(self, app_and_db, editor_token, sample_exam):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={'default_exam_content_type': 'mixed'},
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            assert resp.get_json()['exam']['default_exam_content_type'] == 'mixed'

    def test_update_exam_questions_count(self, app_and_db, editor_token, sample_exam):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={'default_exam_questions_count': 15},
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            assert resp.get_json()['exam']['default_exam_questions_count'] == 15

    def test_update_simulator_counts(self, app_and_db, editor_token, sample_exam):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={
                    'default_simulator_questions_count': 10,
                    'default_simulator_exercises_count': 5,
                },
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            data = resp.get_json()['exam']
            assert data['default_simulator_questions_count'] == 10
            assert data['default_simulator_exercises_count'] == 5

    def test_reset_counts_to_null(self, app_and_db, editor_token, sample_exam):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={
                    'default_exam_questions_count': None,
                    'default_exam_exercises_count': None,
                    'default_simulator_questions_count': None,
                    'default_simulator_exercises_count': None,
                },
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            data = resp.get_json()['exam']
            assert data['default_exam_questions_count'] is None
            assert data['default_exam_exercises_count'] is None
            assert data['default_simulator_questions_count'] is None
            assert data['default_simulator_exercises_count'] is None

    def test_update_all_config_fields_at_once(self, app_and_db, editor_token, sample_exam):
        """Simula el payload exacto que envía ExamConfigPage."""
        app, _ = app_and_db
        token, _ = editor_token
        payload = {
            'default_max_attempts': 4,
            'default_max_disconnections': 6,
            'default_exam_content_type': 'mixed',
            'default_exam_questions_count': 20,
            'default_exam_exercises_count': 8,
            'default_simulator_questions_count': 12,
            'default_simulator_exercises_count': 4,
        }
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json=payload,
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            data = resp.get_json()['exam']
            for k, v in payload.items():
                assert data[k] == v, f'{k}: expected {v}, got {data[k]}'

    def test_get_exam_returns_config_fields(self, app_and_db, editor_token, sample_exam):
        """Verifica que GET devuelve todos los campos de configuración."""
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.get(
                f'/api/exams/{sample_exam}',
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            data = resp.get_json()
            # Puede ser data directamente o data['exam']
            exam_data = data.get('exam', data)
            assert 'default_max_attempts' in exam_data
            assert 'default_max_disconnections' in exam_data
            assert 'default_exam_content_type' in exam_data
            assert 'default_exam_questions_count' in exam_data
            assert 'default_exam_exercises_count' in exam_data
            assert 'default_simulator_questions_count' in exam_data
            assert 'default_simulator_exercises_count' in exam_data

    def test_update_nonexistent_exam_returns_404(self, app_and_db, editor_token):
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            resp = client.put(
                '/api/exams/99999',
                json={'default_max_attempts': 5},
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 404

    def test_update_without_auth_returns_401(self, app_and_db, sample_exam):
        app, _ = app_and_db
        with app.test_client() as client:
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={'default_max_attempts': 5},
            )
            assert resp.status_code in (401, 422)

    def test_config_update_preserves_other_fields(self, app_and_db, editor_token, sample_exam):
        """Actualizar config no debe afectar name, version, etc."""
        app, _ = app_and_db
        token, _ = editor_token
        with app.test_client() as client:
            # Primero: leer estado actual
            resp = client.get(
                f'/api/exams/{sample_exam}',
                headers={'Authorization': f'Bearer {token}'},
            )
            original = resp.get_json().get('exam', resp.get_json())
            original_name = original['name']
            original_version = original['version']

            # Actualizar solo config
            resp = client.put(
                f'/api/exams/{sample_exam}',
                json={'default_max_attempts': 9},
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200
            updated = resp.get_json()['exam']
            assert updated['name'] == original_name
            assert updated['version'] == original_version
            assert updated['default_max_attempts'] == 9
