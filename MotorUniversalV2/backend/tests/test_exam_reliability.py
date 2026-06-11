"""
Tests de confiabilidad del examen:
  - Idempotencia de save-result (mismo attempt_id no duplica el resultado).
  - Autosave en servidor: endpoints PUT/GET/DELETE /api/exams/<id>/progress
    (incluye anclaje de started_at).

USO:
  cd backend && python -m pytest tests/test_exam_reliability.py -v
"""
import sys
import os
import uuid

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope='module')
def app_and_db():
    os.environ['JWT_SECRET_KEY'] = 'test-secret-reliability'
    os.environ.setdefault(
        'AZURE_STORAGE_CONNECTION_STRING',
        'DefaultEndpointsProtocol=https;AccountName=fake;'
        'AccountKey=ZmFrZWtleQ==;EndpointSuffix=core.windows.net',
    )
    try:
        from app import create_app, db as flask_db
        from app.models.exam_progress import ExamProgress  # noqa: F401 (registrar tabla)
        app = create_app('testing')
        with app.app_context():
            flask_db.create_all()
            yield app, flask_db
            flask_db.drop_all()
    except Exception as e:
        pytest.skip(f'No se pudo crear la app Flask: {e}')


@pytest.fixture(scope='module')
def candidate(app_and_db):
    app, db = app_and_db
    from app.models.user import User
    from flask_jwt_extended import create_access_token
    with app.app_context():
        user = User(
            id=str(uuid.uuid4()),
            email=f'cand_{uuid.uuid4().hex[:6]}@evaluaasi.com',
            username=f'cand_{uuid.uuid4().hex[:6]}',
            name='Candidato',
            first_surname='Prueba',
            role='candidato',
        )
        user.set_password('test1234')
        db.session.add(user)
        db.session.commit()
        token = create_access_token(identity=user.id)
        return token, user.id


@pytest.fixture(scope='module')
def sample_exam(app_and_db, candidate):
    app, db = app_and_db
    _token, user_id = candidate
    from app.models.exam import Exam
    with app.app_context():
        exam = Exam(name='Examen Confiabilidad', version='1.0', stage_id=1,
                    passing_score=70, created_by=user_id)
        db.session.add(exam)
        db.session.commit()
        return exam.id


def _auth(token):
    return {'Authorization': f'Bearer {token}'}


class TestServerProgress:
    """Autosave en servidor (borrador de intento)."""

    def test_put_creates_and_get_returns_progress(self, app_and_db, candidate, sample_exam):
        app, _ = app_and_db
        token, _ = candidate
        with app.test_client() as client:
            put = client.put(
                f'/api/exams/{sample_exam}/progress',
                json={'attempt_id': 'att-progress-1', 'data': {'timeRemaining': 600}},
                headers=_auth(token),
            )
            assert put.status_code == 200

            get = client.get(f'/api/exams/{sample_exam}/progress', headers=_auth(token))
            assert get.status_code == 200
            body = get.get_json()
            assert body['progress'] is not None
            assert body['progress']['attempt_id'] == 'att-progress-1'
            assert body['progress']['started_at'] is not None  # anclado en servidor
            assert body['server_now'] is not None

    def test_delete_clears_progress(self, app_and_db, candidate, sample_exam):
        app, _ = app_and_db
        token, _ = candidate
        with app.test_client() as client:
            client.put(
                f'/api/exams/{sample_exam}/progress',
                json={'attempt_id': 'att-progress-2', 'data': {'x': 1}},
                headers=_auth(token),
            )
            dele = client.delete(f'/api/exams/{sample_exam}/progress', headers=_auth(token))
            assert dele.status_code == 200
            get = client.get(f'/api/exams/{sample_exam}/progress', headers=_auth(token))
            assert get.get_json()['progress'] is None


class TestSubmitIdempotency:
    """El mismo attempt_id no debe crear resultados duplicados."""

    def test_same_attempt_id_returns_same_result(self, app_and_db, candidate, sample_exam):
        app, db = app_and_db
        token, user_id = candidate
        from app.models.result import Result
        attempt = f'att-{uuid.uuid4().hex}'
        payload = {
            'score': 80, 'percentage': 80.0, 'status': 1, 'duration_seconds': 100,
            'answers_data': {'answers': {}, 'summary': {'percentage': 80.0}},
            'questions_order': [], 'attempt_id': attempt,
        }
        with app.test_client() as client:
            r1 = client.post(f'/api/exams/{sample_exam}/save-result', json=payload, headers=_auth(token))
            assert r1.status_code in (200, 201)
            id1 = r1.get_json()['result']['id']

            r2 = client.post(f'/api/exams/{sample_exam}/save-result', json=payload, headers=_auth(token))
            assert r2.status_code in (200, 201)
            id2 = r2.get_json()['result']['id']

            assert id1 == id2, 'El reintento con el mismo attempt_id debe devolver el mismo resultado'

        with app.app_context():
            count = Result.query.filter_by(
                user_id=str(user_id), exam_id=sample_exam, client_attempt_id=attempt
            ).count()
            assert count == 1, 'No debe haber resultados duplicados para el mismo intento'

    def test_different_attempt_ids_create_distinct_results(self, app_and_db, candidate, sample_exam):
        app, _ = app_and_db
        token, _ = candidate
        base = {
            'score': 75, 'percentage': 75.0, 'status': 1, 'duration_seconds': 90,
            'answers_data': {'answers': {}, 'summary': {'percentage': 75.0}},
            'questions_order': [],
        }
        with app.test_client() as client:
            a = client.post(f'/api/exams/{sample_exam}/save-result',
                            json={**base, 'attempt_id': f'att-{uuid.uuid4().hex}'}, headers=_auth(token))
            b = client.post(f'/api/exams/{sample_exam}/save-result',
                            json={**base, 'attempt_id': f'att-{uuid.uuid4().hex}'}, headers=_auth(token))
            assert a.status_code in (200, 201) and b.status_code in (200, 201)
            assert a.get_json()['result']['id'] != b.get_json()['result']['id']
