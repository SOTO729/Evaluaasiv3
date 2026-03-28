"""
Tests para el logo/escudo del partner en certificados EUIT.

Verifica que generate_certificate_pdf() dibuja el logo del partner
cuando el resultado tiene un group_id que traza a un partner con logo_url.

Cadena: Result.group_id → CandidateGroup → Campus → Partner → logo_url
Posición esperada: x=910, y=1135 (puntos PDF)

Tests:
  1. Con partner logo: se llama drawImage con coordenadas (910, 1135)
  2. Sin group_id: no se intenta buscar el grupo
  3. Grupo sin campus: no falla
  4. Partner sin logo_url: no se intenta descargar
  5. Descarga del logo falla (HTTP error): no falla la generación
  6. Descarga del logo falla (excepción de red): no falla la generación
  7. group_id apunta a grupo inexistente: no falla
  8. Campus apunta a partner inexistente: no falla

USO:
  cd backend && python -m pytest tests/test_certificate_partner_logo.py -v
"""
import sys
import os
import uuid
from io import BytesIO
from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ─── Flask app fixture ───────────────────────────────────────

@pytest.fixture(scope='module')
def flask_app():
    """Crea la app Flask con BD SQLite en memoria."""
    os.environ['JWT_SECRET_KEY'] = 'test-secret'
    os.environ.setdefault('AZURE_STORAGE_CONNECTION_STRING',
                          'DefaultEndpointsProtocol=https;AccountName=fake;'
                          'AccountKey=ZmFrZWtleQ==;EndpointSuffix=core.windows.net')
    try:
        from app import create_app, db as flask_db
        app = create_app('testing')
        with app.app_context():
            flask_db.create_all()
            yield app, flask_db
            flask_db.drop_all()
    except Exception as e:
        pytest.skip(f"No se pudo crear la app Flask: {e}")


# ─── Helper: crear datos de prueba ───────────────────────────

def _create_base_data(flask_db):
    """Crea user, exam, result base (sin group_id). Retorna (user, exam, result)."""
    from app.models.user import User
    from app.models.exam import Exam
    from app.models.result import Result

    user = User(
        id=str(uuid.uuid4()),
        email='cert_test@evaluaasi.com',
        username=f'cert_test_{uuid.uuid4().hex[:8]}',
        name='María',
        first_surname='García',
        second_surname='López',
    )
    user.set_password('test1234')
    flask_db.session.add(user)
    flask_db.session.flush()

    exam = Exam(name='Excel Avanzado', version='1.0', stage_id=1,
                passing_score=70, created_by=user.id)
    flask_db.session.add(exam)
    flask_db.session.flush()

    result = Result(
        id=str(uuid.uuid4()),
        user_id=user.id,
        exam_id=exam.id,
        score=85,
        status=1,
        result=1,
        eduit_certificate_code=f'EC{uuid.uuid4().hex[:10].upper()}',
    )
    flask_db.session.add(result)
    flask_db.session.flush()

    return user, exam, result


def _create_partner_chain(flask_db, coordinator_id, logo_url='https://blob.example.com/logo.png'):
    """Crea Partner → Campus → CandidateGroup. Retorna (partner, campus, group)."""
    from app.models.partner import Partner, Campus, CandidateGroup

    partner = Partner(
        name='Instituto Test',
        coordinator_id=coordinator_id,
        logo_url=logo_url,
    )
    flask_db.session.add(partner)
    flask_db.session.flush()

    campus = Campus(
        partner_id=partner.id,
        name='Campus Central',
        code=f'CC-{uuid.uuid4().hex[:6].upper()}',
        coordinator_id=coordinator_id,
    )
    flask_db.session.add(campus)
    flask_db.session.flush()

    group = CandidateGroup(
        campus_id=campus.id,
        name='Grupo A',
        coordinator_id=coordinator_id,
    )
    flask_db.session.add(group)
    flask_db.session.flush()

    return partner, campus, group


# ─── Fake 1x1 PNG image ──────────────────────────────────────

def _fake_png():
    """Retorna bytes de un PNG 1x1 transparente válido."""
    import struct
    import zlib

    def _chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack('>I', len(data)) + c + crc

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = _chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
    raw = zlib.compress(b'\x00\xff\xff\xff')
    idat = _chunk(b'IDAT', raw)
    iend = _chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


# ─── Tests ────────────────────────────────────────────────────

class TestCertificatePartnerLogo:
    """Tests para el logo del partner en certificados EUIT."""

    def test_01_partner_logo_drawn_at_correct_position(self, flask_app):
        """Con partner con logo, drawImage se llama en (910, 1135)."""
        app, flask_db = flask_app
        with app.app_context():
            user, exam, result = _create_base_data(flask_db)
            _, _, group = _create_partner_chain(flask_db, user.id)
            result.group_id = group.id
            flask_db.session.commit()

            fake_resp = MagicMock()
            fake_resp.status_code = 200
            fake_resp.content = _fake_png()

            with patch('requests.get', return_value=fake_resp) as mock_get, \
                 patch('reportlab.pdfgen.canvas.Canvas.drawImage') as mock_draw:
                from app.utils.pdf_generator import generate_certificate_pdf
                pdf = generate_certificate_pdf(result, exam, user)

                assert pdf is not None
                assert isinstance(pdf, BytesIO)
                assert pdf.getbuffer().nbytes > 0

                # Verificar que se descargó el logo
                mock_get.assert_called()
                logo_url_called = mock_get.call_args[0][0]
                assert 'logo.png' in logo_url_called

                # Verificar que drawImage fue llamado con coordenadas (910, 1135)
                partner_logo_calls = [
                    c for c in mock_draw.call_args_list
                    if len(c[0]) >= 3 and c[0][1] == 910 and c[0][2] == 1135
                ]
                assert len(partner_logo_calls) == 1, \
                    f"Se esperaba 1 llamada a drawImage(_, 910, 1135, ...), " \
                    f"pero se encontraron {len(partner_logo_calls)}"

    def test_02_no_group_id_skips_logo(self, flask_app):
        """Sin group_id no se intenta buscar grupo ni descargar logo."""
        app, flask_db = flask_app
        with app.app_context():
            user, exam, result = _create_base_data(flask_db)
            result.group_id = None
            flask_db.session.commit()

            with patch('requests.get') as mock_get:
                from app.utils.pdf_generator import generate_certificate_pdf
                pdf = generate_certificate_pdf(result, exam, user)

                assert pdf is not None
                mock_get.assert_not_called()

    def test_03_group_without_campus_no_error(self, flask_app):
        """Grupo con campus_id inválido no causa error."""
        app, flask_db = flask_app
        with app.app_context():
            user, exam, result = _create_base_data(flask_db)
            from app.models.partner import CandidateGroup
            group = CandidateGroup(
                campus_id=99999,  # No existe
                name='Grupo Huérfano',
                coordinator_id=user.id,
            )
            flask_db.session.add(group)
            flask_db.session.flush()
            result.group_id = group.id
            flask_db.session.commit()

            with patch('requests.get') as mock_get:
                from app.utils.pdf_generator import generate_certificate_pdf
                pdf = generate_certificate_pdf(result, exam, user)

                assert pdf is not None
                mock_get.assert_not_called()

    def test_04_partner_without_logo_no_download(self, flask_app):
        """Partner sin logo_url no intenta descarga."""
        app, flask_db = flask_app
        with app.app_context():
            user, exam, result = _create_base_data(flask_db)
            _, _, group = _create_partner_chain(flask_db, user.id, logo_url=None)
            result.group_id = group.id
            flask_db.session.commit()

            with patch('requests.get') as mock_get:
                from app.utils.pdf_generator import generate_certificate_pdf
                pdf = generate_certificate_pdf(result, exam, user)

                assert pdf is not None
                mock_get.assert_not_called()

    def test_05_logo_http_error_does_not_fail(self, flask_app):
        """Si la descarga del logo retorna HTTP 404, el PDF se genera igual."""
        app, flask_db = flask_app
        with app.app_context():
            user, exam, result = _create_base_data(flask_db)
            _, _, group = _create_partner_chain(flask_db, user.id)
            result.group_id = group.id
            flask_db.session.commit()

            fake_resp = MagicMock()
            fake_resp.status_code = 404
            fake_resp.content = b''

            with patch('requests.get', return_value=fake_resp):
                from app.utils.pdf_generator import generate_certificate_pdf
                pdf = generate_certificate_pdf(result, exam, user)

                assert pdf is not None
                assert pdf.getbuffer().nbytes > 0

    def test_06_logo_network_error_does_not_fail(self, flask_app):
        """Si la descarga del logo lanza excepción, el PDF se genera igual."""
        app, flask_db = flask_app
        with app.app_context():
            user, exam, result = _create_base_data(flask_db)
            _, _, group = _create_partner_chain(flask_db, user.id)
            result.group_id = group.id
            flask_db.session.commit()

            with patch('requests.get', side_effect=ConnectionError('timeout')):
                from app.utils.pdf_generator import generate_certificate_pdf
                pdf = generate_certificate_pdf(result, exam, user)

                assert pdf is not None
                assert pdf.getbuffer().nbytes > 0

    def test_07_nonexistent_group_no_error(self, flask_app):
        """group_id apunta a grupo que no existe → no falla."""
        app, flask_db = flask_app
        with app.app_context():
            user, exam, result = _create_base_data(flask_db)
            result.group_id = 999888  # No existe
            flask_db.session.commit()

            with patch('requests.get') as mock_get:
                from app.utils.pdf_generator import generate_certificate_pdf
                pdf = generate_certificate_pdf(result, exam, user)

                assert pdf is not None
                mock_get.assert_not_called()

    def test_08_partner_nonexistent_no_error(self, flask_app):
        """Campus apunta a partner inexistente → no falla."""
        app, flask_db = flask_app
        with app.app_context():
            user, exam, result = _create_base_data(flask_db)
            from app.models.partner import Campus, CandidateGroup

            campus = Campus(
                partner_id=999777,  # No existe
                name='Campus Fantasma',
                code=f'CF-{uuid.uuid4().hex[:6].upper()}',
                coordinator_id=user.id,
            )
            flask_db.session.add(campus)
            flask_db.session.flush()

            group = CandidateGroup(
                campus_id=campus.id,
                name='Grupo Fantasma',
                coordinator_id=user.id,
            )
            flask_db.session.add(group)
            flask_db.session.flush()

            result.group_id = group.id
            flask_db.session.commit()

            with patch('requests.get') as mock_get:
                from app.utils.pdf_generator import generate_certificate_pdf
                pdf = generate_certificate_pdf(result, exam, user)

                assert pdf is not None
                mock_get.assert_not_called()
