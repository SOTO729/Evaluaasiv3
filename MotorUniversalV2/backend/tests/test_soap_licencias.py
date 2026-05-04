"""Tests SOAP-compat para Licencias.asmx (#9) y Storage.asmx UpXML2016 (#7).

Sobre SOAP idéntico al que envían los EXEs VB6 legacy.
"""

import pytest
from app import create_app, db
from app.models.office_exam import OfficeAppVersion


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


SOAP_ENVELOPE_LICENSE = '''<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <VerificarLicencia xmlns="http://www.evaluaasi.com/">
      <SubSistema>{sub}</SubSistema>
      <Version>{ver}</Version>
      <NombrePC>WORKSTATION-01</NombrePC>
    </VerificarLicencia>
  </soap:Body>
</soap:Envelope>'''


def _post_soap(client, action, body):
    return client.post(
        '/Licencias.asmx',
        data=body,
        headers={
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': f'"http://www.evaluaasi.com/{action}"',
        },
    )


def test_verificar_licencia_catalog_empty_returns_true(client):
    """Sin apps en catálogo, la licencia siempre es válida (compat legacy)."""
    body = SOAP_ENVELOPE_LICENSE.format(sub='AnyApp', ver='1.0.0')
    resp = _post_soap(client, 'VerificarLicencia', body)
    assert resp.status_code == 200
    assert b'<VerificarLicenciaResult>true</VerificarLicenciaResult>' in resp.data


def test_verificar_licencia_inactive_app_returns_false(client, app):
    """App registrada pero is_active=False → false."""
    with app.app_context():
        a = OfficeAppVersion(
            app_name='EvaluadorExcel2016',
            app_type='examen',
            is_active=False,
        )
        db.session.add(a)
        db.session.commit()
    body = SOAP_ENVELOPE_LICENSE.format(sub='EvaluadorExcel2016', ver='1.0.0')
    resp = _post_soap(client, 'VerificarLicencia', body)
    assert resp.status_code == 200
    assert b'<VerificarLicenciaResult>false</VerificarLicenciaResult>' in resp.data


def test_verificar_licencia_active_app_returns_true(client, app):
    """App registrada, activa, version OK → true."""
    with app.app_context():
        a = OfficeAppVersion(
            app_name='EvaluadorExcel2016',
            app_type='examen',
            min_version='1.0.0',
            is_active=True,
        )
        db.session.add(a)
        db.session.commit()
    body = SOAP_ENVELOPE_LICENSE.format(sub='EvaluadorExcel2016', ver='1.5.0')
    resp = _post_soap(client, 'VerificarLicencia', body)
    assert resp.status_code == 200
    assert b'<VerificarLicenciaResult>true</VerificarLicenciaResult>' in resp.data


def test_verificar_licencia_old_version_returns_false(client, app):
    """min_version=2.0.0 y EXE envía 1.0 → false."""
    with app.app_context():
        a = OfficeAppVersion(
            app_name='EvaluadorWord2016',
            app_type='examen',
            min_version='2.0.0',
            is_active=True,
        )
        db.session.add(a)
        db.session.commit()
    body = SOAP_ENVELOPE_LICENSE.format(sub='EvaluadorWord2016', ver='1.0.0')
    resp = _post_soap(client, 'VerificarLicencia', body)
    assert resp.status_code == 200
    assert b'<VerificarLicenciaResult>false</VerificarLicenciaResult>' in resp.data


def test_verificar_licencia_unknown_app_returns_true(client, app):
    """App desconocida pero catálogo no vacío → true (compat)."""
    with app.app_context():
        a = OfficeAppVersion(
            app_name='SomeOtherApp',
            app_type='examen',
            is_active=True,
        )
        db.session.add(a)
        db.session.commit()
    body = SOAP_ENVELOPE_LICENSE.format(sub='AppDesconocida', ver='1.0.0')
    resp = _post_soap(client, 'VerificarLicencia', body)
    assert resp.status_code == 200
    assert b'<VerificarLicenciaResult>true</VerificarLicenciaResult>' in resp.data


def test_verificar_licencia_unsupported_action(client):
    """Action distinto → SOAP fault."""
    body = SOAP_ENVELOPE_LICENSE.format(sub='X', ver='1.0')
    resp = client.post(
        '/Licencias.asmx',
        data=body,
        headers={
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': '"http://www.evaluaasi.com/AccionDesconocida"',
        },
    )
    assert resp.status_code in (200, 500)
    assert b'soap:Fault' in resp.data or b'fault' in resp.data.lower()
