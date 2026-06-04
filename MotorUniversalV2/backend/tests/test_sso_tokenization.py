"""
Tests del módulo SSO Tokenización (API Tokenización Evaluaasi)
================================================================

Cubre el flujo completo:
  A. POST /api/sso/campuses/<id>/api-key — generar/rotar key (solo admin + step-up password)
  B. GET  /api/sso/campuses/<id>/api-key — info sin secreto
     DELETE /api/sso/campuses/<id>/api-key — revocar (solo admin + step-up password)
  C. POST /api/sso/generar_token         — emitir token SSO
  D. POST /api/auth/sso/exchange         — intercambiar token por JWT
  E. Single-use: el mismo token no puede consumirse dos veces.
  F. Permisos: coordinador ajeno no puede gestionar API key.
  G. Upsert idempotente: misma matrícula → mismo usuario.

Corre 100% local con SQLite en memoria (config 'testing'), sin tocar Azure.
Ejecutar:
    cd backend && python -m pytest tests/test_sso_tokenization.py -v --tb=short
"""
import os
import sys
import uuid

import pytest

# Asegurar que el backend está en el path antes de importar app
HERE = os.path.dirname(__file__)
BACKEND_DIR = os.path.abspath(os.path.join(HERE, '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import create_app, db  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.partner import Partner, Campus  # noqa: E402
from app.models.sso_token import SsoToken  # noqa: E402


# ─── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture()
def app():
    """App Flask con SQLite en memoria + schema creado."""
    os.environ.setdefault('SECRET_KEY', 'test-secret')
    os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret')
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_user(app):
    with app.app_context():
        user = User(
            id=str(uuid.uuid4()),
            username='admin_sso',
            email='admin_sso@test.local',
            name='Admin',
            first_surname='SSO',
            role='admin',
            is_active=True,
        )
        user.set_password('admin12345')
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture()
def coordinator_owner(app):
    with app.app_context():
        user = User(
            id=str(uuid.uuid4()),
            username='coord_owner',
            email='coord_owner@test.local',
            name='Coord',
            first_surname='Owner',
            role='coordinator',
            is_active=True,
        )
        user.set_password('coord12345')
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture()
def coordinator_other(app):
    with app.app_context():
        user = User(
            id=str(uuid.uuid4()),
            username='coord_other',
            email='coord_other@test.local',
            name='Coord',
            first_surname='Other',
            role='coordinator',
            is_active=True,
        )
        user.set_password('coord12345')
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture()
def partner(app, coordinator_owner):
    """Crea un Partner + un Campus dentro de él y devuelve el id del CAMPUS.

    La API SSO actual opera a nivel plantel, por lo que las pruebas usan
    siempre `campus_id`. Mantenemos el nombre del fixture (`partner`) por
    compatibilidad histórica con los tests existentes.
    """
    with app.app_context():
        p = Partner(
            name='Universidad de Prueba SSO',
            country='México',
            coordinator_id=coordinator_owner,
            is_active=True,
        )
        db.session.add(p)
        db.session.flush()
        c = Campus(
            partner_id=p.id,
            name='Plantel SSO Pruebas',
            code='PLT-SSO-001',
            coordinator_id=coordinator_owner,
            is_active=True,
            enable_sso_api=True,  # módulo SSO encendido (requerido por /generar_token)
        )
        db.session.add(c)
        db.session.commit()
        return c.id


def _login(client, username, password):
    r = client.post('/api/auth/login', json={'username': username, 'password': password})
    assert r.status_code == 200, r.get_json()
    return r.get_json()['access_token']


def _auth(token):
    return {'Authorization': f'Bearer {token}'}


# ─── A. Generar/rotar API key (solo admin + step-up password) ──────────────

def test_admin_can_generate_api_key(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    r = client.post(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'admin12345'},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.get_json()
    data = r.get_json()
    assert data['api_key'].startswith('evk_')
    assert len(data['api_key_prefix']) == 12
    assert 'warning' in data


def test_admin_rotate_without_password_is_blocked(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    r = client.post(
        f'/api/sso/campuses/{partner}/api-key',
        json={},
        headers=_auth(token),
    )
    assert r.status_code == 401
    assert r.get_json().get('error') == 'password_required'


def test_admin_rotate_with_wrong_password_is_blocked(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    r = client.post(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'wrong-password'},
        headers=_auth(token),
    )
    assert r.status_code == 401
    assert r.get_json().get('error') == 'password_incorrect'


def test_owner_coordinator_cannot_rotate_api_key(client, coordinator_owner, partner):
    token = _login(client, 'coord_owner', 'coord12345')
    r = client.post(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'coord12345'},
        headers=_auth(token),
    )
    assert r.status_code == 403


def test_other_coordinator_cannot_generate_api_key(client, coordinator_owner, coordinator_other, partner):
    token = _login(client, 'coord_other', 'coord12345')
    r = client.post(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'coord12345'},
        headers=_auth(token),
    )
    assert r.status_code == 403


# ─── B. GET info / DELETE revocar ──────────────────────────────────────────

def test_get_api_key_info_does_not_leak_secret(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    client.post(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'admin12345'},
        headers=_auth(token),
    )
    r = client.get(f'/api/sso/campuses/{partner}/api-key', headers=_auth(token))
    assert r.status_code == 200
    data = r.get_json()
    assert data['has_key'] is True
    assert data['api_key_active'] is True
    assert 'api_key' not in data  # nunca devuelve el secreto


def test_revoke_api_key(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    client.post(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'admin12345'},
        headers=_auth(token),
    )
    r = client.delete(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'admin12345'},
        headers=_auth(token),
    )
    assert r.status_code == 200
    info = client.get(f'/api/sso/campuses/{partner}/api-key', headers=_auth(token)).get_json()
    assert info['api_key_active'] is False


def test_revoke_without_password_is_blocked(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    client.post(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'admin12345'},
        headers=_auth(token),
    )
    r = client.delete(
        f'/api/sso/campuses/{partner}/api-key',
        json={},
        headers=_auth(token),
    )
    assert r.status_code == 401
    assert r.get_json().get('error') == 'password_required'


# ─── C. /generar_token ──────────────────────────────────────────────────────

def _generate_key(client, admin_user, partner_id):
    token = _login(client, 'admin_sso', 'admin12345')
    r = client.post(
        f'/api/sso/campuses/{partner_id}/api-key',
        json={'current_password': 'admin12345'},
        headers=_auth(token),
    )
    return r.get_json()['api_key']


def test_generar_token_success_urlencoded(client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)
    r = client.post(
        '/api/sso/generar_token',
        data={
            'apikey': api_key,
            'matricula': 'A001',
            'nombre': 'Diego',
            'apellido': 'Soto Pérez',
            'email': 'diego.sso@test.local',
        },
    )
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    # Contrato spec: éxito usa "mensaje_error", error usa "mensajeError"
    assert body['error'] is False
    assert body['mensaje_error'] == ''
    assert isinstance(body['token'], str) and len(body['token']) > 30


def test_generar_token_success_json(client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A002',
        'nombre': 'Ana',
        'apellido': 'López Martínez',
        'email': 'ana.lopez@test.local',
    })
    assert r.status_code == 200
    assert r.get_json()['error'] is False


def test_generar_token_apellido_single_word(app, client, admin_user, partner):
    """Si solo viene una palabra en `apellido` debe usarse como primer apellido y dejar el segundo en NULL."""
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A002b',
        'nombre': 'Ana',
        'apellido': 'López',
        'email': 'ana.unica@test.local',
    })
    assert r.status_code == 200, r.get_json()
    # Verifica el split correcto en BD
    with app.app_context():
        u = User.query.filter_by(external_id='A002b').first()
        assert u is not None
        assert u.first_surname == 'López'
        assert u.second_surname is None


def test_generar_token_apellido_compound_split(app, client, admin_user, partner):
    """Apellidos con espacios: la última palabra es el materno, el resto el paterno."""
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A002c',
        'nombre': 'María',
        'apellido': 'De la Cruz Hernández',
        'email': 'maria.delacruz@test.local',
    })
    assert r.status_code == 200, r.get_json()
    with app.app_context():
        u = User.query.filter_by(external_id='A002c').first()
        assert u is not None
        assert u.first_surname == 'De la Cruz'
        assert u.second_surname == 'Hernández'


def test_generar_token_missing_required(client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A003',
        # falta nombre y apellido
    })
    assert r.status_code == 400
    body = r.get_json()
    assert body['error'] is True
    assert 'mensajeError' in body  # nota: typo intencional del spec
    assert 'nombre' in body['mensajeError']
    assert 'apellido' in body['mensajeError']


def test_generar_token_email_is_optional(client, admin_user, partner):
    """El email es opcional: debe poder emitirse token sin enviarlo."""
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A003b',
        'nombre': 'Sin',
        'apellido': 'Email Anonimo',
    })
    assert r.status_code == 200, r.get_json()
    assert r.get_json()['error'] is False


def test_generar_token_invalid_email_format(client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A003c',
        'nombre': 'Mal',
        'apellido': 'Email Bad',
        'email': 'no-es-email',
    })
    assert r.status_code == 400
    assert 'email' in r.get_json()['mensajeError'].lower()


def test_generar_token_invalid_apikey(client, admin_user, partner):
    r = client.post('/api/sso/generar_token', json={
        'apikey': 'evk_clave_falsa_que_no_existe_xx',
        'matricula': 'A004',
        'nombre': 'X',
        'apellido': 'Y Z',
        'email': 'x@test.local',
    })
    assert r.status_code == 401
    assert r.get_json()['error'] is True


def test_generar_token_revoked_apikey(client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)
    token = _login(client, 'admin_sso', 'admin12345')
    client.delete(
        f'/api/sso/campuses/{partner}/api-key',
        json={'current_password': 'admin12345'},
        headers=_auth(token),
    )
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A005',
        'nombre': 'X',
        'apellido': 'Y Z',
        'email': 'x@test.local',
    })
    assert r.status_code == 401


# ─── D. /auth/sso/exchange ──────────────────────────────────────────────────

def test_exchange_success_returns_jwt(app, client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A100',
        'nombre': 'Juan',
        'apellido': 'García Mendoza',
        'email': 'juan.garcia@test.local',
    })
    sso_token = r.get_json()['token']

    r2 = client.post('/api/auth/sso/exchange', json={'token': sso_token})
    assert r2.status_code == 200, r2.get_json()
    body = r2.get_json()
    assert 'access_token' in body
    assert 'refresh_token' in body
    assert body['user']['role'] == 'candidato'
    assert body['user']['username']  # tiene algún username generado

    # Y el access_token sirve para llamar /auth/me
    me = client.get('/api/auth/me', headers=_auth(body['access_token']))
    assert me.status_code == 200


def test_exchange_token_is_single_use(client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)
    sso_token = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A101',
        'nombre': 'Single',
        'apellido': 'Use Once',
        'email': 'single.use@test.local',
    }).get_json()['token']

    ok = client.post('/api/auth/sso/exchange', json={'token': sso_token})
    assert ok.status_code == 200
    again = client.post('/api/auth/sso/exchange', json={'token': sso_token})
    assert again.status_code == 401
    assert again.get_json().get('code') == 'sso_invalid_token'


def test_exchange_invalid_token(client):
    r = client.post('/api/auth/sso/exchange', json={'token': 'nope_no_existe'})
    assert r.status_code == 401


def test_exchange_missing_token(client):
    r = client.post('/api/auth/sso/exchange', json={})
    assert r.status_code == 400


# ─── G. Upsert idempotente ──────────────────────────────────────────────────

def test_upsert_same_matricula_returns_same_user(app, client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)

    # 1ra emisión
    t1 = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'REPEAT-1',
        'nombre': 'Pedro',
        'apellido': 'Ruiz Hernández',
        'email': 'pedro.ruiz@test.local',
    }).get_json()['token']
    user1 = client.post('/api/auth/sso/exchange', json={'token': t1}).get_json()['user']

    # 2da emisión con la MISMA matrícula → mismo user.id
    t2 = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'REPEAT-1',
        'nombre': 'Pedro Actualizado',
        'apellido': 'Ruiz Hernández',
        'email': 'pedro.ruiz@test.local',
    }).get_json()['token']
    user2 = client.post('/api/auth/sso/exchange', json={'token': t2}).get_json()['user']

    assert user1['id'] == user2['id']

    # Y el modelo refleja la identidad externa estable
    with app.app_context():
        u = User.query.get(user2['id'])
        assert u.external_id == 'REPEAT-1'
        assert u.external_campus_id == partner


def test_sso_token_row_marked_consumed(app, client, admin_user, partner):
    api_key = _generate_key(client, admin_user, partner)
    sso_token = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'A200',
        'nombre': 'Mark',
        'apellido': 'Consumed Once',
        'email': 'mark.consumed@test.local',
    }).get_json()['token']

    # Pre-exchange: hay 1 fila, sin consumed_at
    with app.app_context():
        rows = SsoToken.query.all()
        assert len(rows) == 1
        assert rows[0].consumed_at is None

    client.post('/api/auth/sso/exchange', json={'token': sso_token})

    with app.app_context():
        rows = SsoToken.query.all()
        assert rows[0].consumed_at is not None


# ─── H. Campos legacy / módulo SSO deshabilitado ────────────────────────────

def test_generar_token_rejects_legacy_programa(client, admin_user, partner):
    """El campo legacy `programa` ya no es parte del contrato → 400."""
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'LEG-1',
        'nombre': 'Legacy',
        'apellido': 'Programa Field',
        'programa': 'Ingeniería',
    })
    assert r.status_code == 400
    body = r.get_json()
    assert body['error'] is True
    assert 'programa' in body['mensajeError']


def test_generar_token_rejects_legacy_grupo_codigo(client, admin_user, partner):
    """El campo legacy `grupo_codigo` fue reemplazado por `grupo` → 400."""
    api_key = _generate_key(client, admin_user, partner)
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'LEG-2',
        'nombre': 'Legacy',
        'apellido': 'Grupo Codigo',
        'grupo_codigo': 'G-001',
    })
    assert r.status_code == 400
    assert 'grupo_codigo' in r.get_json()['mensajeError']


def test_generar_token_disabled_sso_module(app, client, admin_user, partner):
    """Si `enable_sso_api` está apagado, /generar_token devuelve 403."""
    api_key = _generate_key(client, admin_user, partner)
    with app.app_context():
        c = Campus.query.get(partner)
        c.enable_sso_api = False
        db.session.commit()
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'OFF-1',
        'nombre': 'Sin',
        'apellido': 'Modulo Activo',
    })
    assert r.status_code == 403
    assert 'deshabilitado' in r.get_json()['mensajeError'].lower()


# ─── I. Multi-key CRUD (tabla campus_api_keys) ──────────────────────────────

def _create_multi_key(client, token, campus_id, description='Key principal', assignment=None):
    body = {'current_password': 'admin12345', 'description': description}
    if assignment is not None:
        body['assignment'] = assignment
    return client.post(
        f'/api/sso/campuses/{campus_id}/api-keys',
        json=body,
        headers=_auth(token),
    )


def test_create_multi_api_key(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    r = _create_multi_key(client, token, partner, description='Llave inscripciones')
    assert r.status_code == 201, r.get_json()
    data = r.get_json()
    assert data['api_key'].startswith('evk_')
    assert data['description'] == 'Llave inscripciones'
    assert data['is_active'] is True
    assert data['is_legacy'] is False


def test_create_multi_api_key_requires_step_up(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    r = client.post(
        f'/api/sso/campuses/{partner}/api-keys',
        json={'description': 'Sin password'},
        headers=_auth(token),
    )
    assert r.status_code == 401
    assert r.get_json().get('error') == 'password_required'


def test_create_multi_api_key_requires_description(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    r = client.post(
        f'/api/sso/campuses/{partner}/api-keys',
        json={'current_password': 'admin12345'},
        headers=_auth(token),
    )
    assert r.status_code == 400


def test_list_multi_api_keys(client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    _create_multi_key(client, token, partner, description='Key A')
    _create_multi_key(client, token, partner, description='Key B')
    r = client.get(f'/api/sso/campuses/{partner}/api-keys', headers=_auth(token))
    assert r.status_code == 200
    data = r.get_json()
    descriptions = {k['description'] for k in data['api_keys']}
    assert {'Key A', 'Key B'}.issubset(descriptions)


def test_other_coordinator_cannot_create_multi_key(client, coordinator_owner, coordinator_other, partner):
    token = _login(client, 'coord_other', 'coord12345')
    r = client.post(
        f'/api/sso/campuses/{partner}/api-keys',
        json={'current_password': 'coord12345', 'description': 'X'},
        headers=_auth(token),
    )
    assert r.status_code == 403


def test_reveal_rotate_revoke_multi_key(app, client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    created = _create_multi_key(client, token, partner, description='Ciclo de vida').get_json()
    key_id = created['id']
    original_raw = created['api_key']

    # Reveal → mismo secreto
    rev = client.post(f'/api/sso/api-keys/{key_id}/reveal',
                      json={}, headers=_auth(token))
    assert rev.status_code == 200
    assert rev.get_json()['api_key'] == original_raw

    # Rotate → nuevo secreto (requiere step-up)
    rot = client.post(f'/api/sso/api-keys/{key_id}/rotate',
                      json={'current_password': 'admin12345'}, headers=_auth(token))
    assert rot.status_code == 200
    assert rot.get_json()['api_key'] != original_raw

    # Revoke → key inactiva (requiere step-up)
    rvk = client.delete(f'/api/sso/api-keys/{key_id}',
                        json={'current_password': 'admin12345'}, headers=_auth(token))
    assert rvk.status_code == 200
    detail = client.get(f'/api/sso/api-keys/{key_id}', headers=_auth(token)).get_json()
    assert detail['is_active'] is False


def test_multi_key_generates_valid_token(client, admin_user, partner):
    """Una key multi sirve para /generar_token igual que la legacy."""
    token = _login(client, 'admin_sso', 'admin12345')
    api_key = _create_multi_key(client, token, partner, description='Para token').get_json()['api_key']
    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'MK-1',
        'nombre': 'Multi',
        'apellido': 'Key Token',
    })
    assert r.status_code == 200, r.get_json()
    assert r.get_json()['error'] is False


# ─── J. Asignaciones (plantillas de examen sobre la api key) ────────────────

def _create_exam(app, created_by_id, name='Examen SSO', ecm_id=None):
    from app.models.exam import Exam
    with app.app_context():
        e = Exam(
            name=name,
            version='1.0',
            stage_id=1,
            competency_standard_id=ecm_id,
            is_active=True,
            created_by=created_by_id,
        )
        db.session.add(e)
        db.session.commit()
        return e.id


def test_add_and_delete_assignment(app, client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    key_id = _create_multi_key(client, token, partner, description='Con plantilla').get_json()['id']
    exam_id = _create_exam(app, admin_user)

    add = client.post(
        f'/api/sso/api-keys/{key_id}/assignments',
        json={'exam_id': exam_id, 'assignment_type': 'all', 'max_attempts': 2},
        headers=_auth(token),
    )
    assert add.status_code == 201, add.get_json()
    assignment_id = add.get_json()['id']

    # Duplicado del mismo examen → 409
    dup = client.post(
        f'/api/sso/api-keys/{key_id}/assignments',
        json={'exam_id': exam_id},
        headers=_auth(token),
    )
    assert dup.status_code == 409

    # Delete
    dele = client.delete(
        f'/api/sso/api-keys/{key_id}/assignments/{assignment_id}',
        headers=_auth(token),
    )
    assert dele.status_code == 200


def test_assignment_unknown_exam_404(app, client, admin_user, partner):
    token = _login(client, 'admin_sso', 'admin12345')
    key_id = _create_multi_key(client, token, partner, description='Examen inexistente').get_json()['id']
    r = client.post(
        f'/api/sso/api-keys/{key_id}/assignments',
        json={'exam_id': 999999},
        headers=_auth(token),
    )
    assert r.status_code == 404


def test_assignment_materializes_group_exam_on_token(app, client, admin_user, partner):
    """Al emitir token con una key que tiene plantilla, se materializa el
    GroupExam y el candidato queda como GroupExamMember."""
    from app.models.partner import GroupExam, GroupExamMember
    token = _login(client, 'admin_sso', 'admin12345')
    exam_id = _create_exam(app, admin_user, name='Examen Materializable')
    created = _create_multi_key(
        client, token, partner, description='Con assignment inline',
        assignment={'exam_id': exam_id, 'assignment_type': 'all'},
    ).get_json()
    api_key = created['api_key']

    r = client.post('/api/sso/generar_token', json={
        'apikey': api_key,
        'matricula': 'MAT-1',
        'nombre': 'Mate',
        'apellido': 'Rializa Examen',
    })
    assert r.status_code == 200, r.get_json()

    with app.app_context():
        u = User.query.filter_by(external_id='MAT-1').first()
        assert u is not None
        ge = GroupExam.query.filter_by(exam_id=exam_id).first()
        assert ge is not None, 'el GroupExam debió materializarse'
        gem = GroupExamMember.query.filter_by(group_exam_id=ge.id, user_id=u.id).first()
        assert gem is not None, 'el candidato debió quedar como miembro del examen'


# ─── K. Cobro diferido (pending_billing) ────────────────────────────────────

def _setup_billing_scenario(app, admin_user, campus_id, cost):
    """Crea exam (sin ECM), key+assignment, user y grupo; materializa.

    Devuelve (user_id, group_exam_id).
    """
    from app.models.campus_api_key import CampusApiKey, CampusApiKeyAssignment
    from app.models.partner import CandidateGroup, GroupMember, GroupExam, GroupExamMember
    from app.models.exam import Exam
    from app.services.sso_service import apply_api_key_assignments

    with app.app_context():
        campus = Campus.query.get(campus_id)
        campus.certification_cost = cost
        db.session.commit()

        exam = Exam(name='Examen Cobro', version='1.0', stage_id=1,
                    is_active=True, created_by=admin_user)
        db.session.add(exam)
        db.session.flush()

        ak = CampusApiKey(campus_id=campus.id, description='Key cobro',
                          is_active=True, is_legacy=False, created_by_id=admin_user)
        ak.set_secret(CampusApiKey.generate_raw())
        db.session.add(ak)
        db.session.flush()

        assignment = CampusApiKeyAssignment(api_key_id=ak.id, exam_id=exam.id,
                                            assignment_type='all')
        db.session.add(assignment)

        user = User(
            id=str(uuid.uuid4()), username=f'cand_{uuid.uuid4().hex[:8]}',
            email=f'{uuid.uuid4().hex[:8]}@test.local', name='Cobro',
            first_surname='Diferido', role='candidato', is_active=True,
            external_id=f'EXT-{uuid.uuid4().hex[:6]}', external_campus_id=campus.id,
        )
        user.set_password('x12345678')
        db.session.add(user)
        db.session.flush()

        group = CandidateGroup(campus_id=campus.id, coordinator_id=campus.coordinator_id,
                               name='Grupo Cobro', code=f'gc_{uuid.uuid4().hex[:6]}',
                               is_active=True)
        db.session.add(group)
        db.session.flush()
        db.session.add(GroupMember(group_id=group.id, user_id=user.id, status='active'))
        db.session.commit()

        apply_api_key_assignments(ak, user, group)
        db.session.commit()

        ge = GroupExam.query.filter_by(group_id=group.id, exam_id=exam.id).first()
        return user.id, ge.id


def test_pending_billing_marked_on_paid_exam(app, admin_user, partner):
    from app.models.partner import GroupExamMember
    user_id, group_exam_id = _setup_billing_scenario(app, admin_user, partner, cost=150)
    with app.app_context():
        gem = GroupExamMember.query.filter_by(
            group_exam_id=group_exam_id, user_id=user_id).first()
        assert gem is not None
        assert gem.pending_billing is True


def test_pending_billing_not_marked_when_free(app, admin_user, partner):
    from app.models.partner import GroupExamMember
    user_id, group_exam_id = _setup_billing_scenario(app, admin_user, partner, cost=0)
    with app.app_context():
        gem = GroupExamMember.query.filter_by(
            group_exam_id=group_exam_id, user_id=user_id).first()
        assert gem is not None
        assert gem.pending_billing is False


def test_consume_pending_billing_debits_balance(app, admin_user, partner):
    from app.models.partner import GroupExamMember
    from app.models.balance import BalanceTransaction
    from app.services.sso_service import consume_pending_billing_for_exam
    user_id, group_exam_id = _setup_billing_scenario(app, admin_user, partner, cost=200)

    with app.app_context():
        charged = consume_pending_billing_for_exam(str(user_id), int(group_exam_id))
        assert charged is True
        gem = GroupExamMember.query.filter_by(
            group_exam_id=group_exam_id, user_id=user_id).first()
        assert gem.pending_billing is False
        tx = BalanceTransaction.query.filter_by(
            reference_type='group_exam', reference_id=group_exam_id,
            transaction_type='debit').first()
        assert tx is not None
        assert float(tx.amount) == 200.0


def test_consume_pending_billing_is_idempotent(app, admin_user, partner):
    from app.services.sso_service import consume_pending_billing_for_exam
    user_id, group_exam_id = _setup_billing_scenario(app, admin_user, partner, cost=120)
    with app.app_context():
        assert consume_pending_billing_for_exam(str(user_id), int(group_exam_id)) is True
        # Segunda llamada: ya no hay nada que cobrar
        assert consume_pending_billing_for_exam(str(user_id), int(group_exam_id)) is False


def test_consume_pending_billing_noop_when_free(app, admin_user, partner):
    from app.services.sso_service import consume_pending_billing_for_exam
    user_id, group_exam_id = _setup_billing_scenario(app, admin_user, partner, cost=0)
    with app.app_context():
        # No estaba pendiente → no cobra
        assert consume_pending_billing_for_exam(str(user_id), int(group_exam_id)) is False
