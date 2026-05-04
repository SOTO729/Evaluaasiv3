"""Tests para tareas #2 (version-check) y #3 (issue_office_badge)."""

import pytest
from app import create_app, db
from app.models.user import User
from app.models.office_exam import OfficeExamResult, OfficeAppVersion
from app.models.badge import BadgeTemplate
from app.services.badge_service import issue_office_badge


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


def _make_user(uid='u1', uname='cand1'):
    u = User(
        id=uid,
        username=uname,
        email=f'{uname}@test.local',
        password_hash='x',
        name='Cand',
        first_surname='Uno',
        role='candidato',
    )
    db.session.add(u)
    db.session.commit()
    return u


def _make_result(user_id, **kw):
    defaults = dict(
        id=kw.pop('id', 'oer-1'),
        user_id=user_id,
        session_type='examen',
        office_app='excel',
        level='basico',
        score=900,
        passing_score=400,
        passed=True,
        status='completed',
    )
    defaults.update(kw)
    r = OfficeExamResult(**defaults)
    db.session.add(r)
    db.session.commit()
    return r


# ─── #2 version-check ───────────────────────────────────────────────

def test_version_check_unknown_app(client):
    r = client.get('/api/downloads/office-apps/version-check?app_name=NoExiste')
    assert r.status_code == 200
    body = r.get_json()
    assert body['found'] is False
    assert body['update_required'] is False


def test_version_check_update_required(app, client):
    with app.app_context():
        a = OfficeAppVersion(
            app_name='EvalTest',
            app_type='examen',
            min_version='2.0.0',
            latest_version='3.0.0',
            download_url='https://example.com/app.exe',
            is_active=True,
        )
        db.session.add(a)
        db.session.commit()
    r = client.get('/api/downloads/office-apps/version-check?app_name=EvalTest&current_version=1.0.0')
    assert r.status_code == 200
    body = r.get_json()
    assert body['found'] is True
    assert body['update_required'] is True
    assert body['update_available'] is True
    assert body['download_url'] == 'https://example.com/app.exe'


def test_version_check_up_to_date(app, client):
    with app.app_context():
        a = OfficeAppVersion(
            app_name='EvalOk',
            app_type='examen',
            min_version='1.0.0',
            latest_version='1.5.0',
            is_active=True,
        )
        db.session.add(a)
        db.session.commit()
    r = client.get('/api/downloads/office-apps/version-check?app_name=EvalOk&current_version=1.5.0')
    assert r.status_code == 200
    body = r.get_json()
    assert body['update_required'] is False
    assert body['update_available'] is False


def test_version_check_missing_param(client):
    r = client.get('/api/downloads/office-apps/version-check')
    assert r.status_code == 400


# ─── #3 issue_office_badge ───────────────────────────────────────────

def test_office_badge_no_template_returns_none(app):
    with app.app_context():
        u = _make_user()
        r = _make_result(u.id, id='oer-no-tpl')
        badge = issue_office_badge(r, u)
        assert badge is None


def test_office_badge_matches_template_by_specific_tag(app):
    with app.app_context():
        u = _make_user()
        tpl = BadgeTemplate(
            name='Excel Básico',
            tags='office:excel:basico, office',
            is_active=True,
        )
        db.session.add(tpl)
        db.session.commit()
        tpl_id = tpl.id
        r = _make_result(u.id, id='oer-spec')
        badge = issue_office_badge(r, u)
        assert badge is not None
        assert badge.badge_template_id == tpl_id
        assert badge.badge_uuid is not None
        assert badge.status == 'active'
        badge2 = issue_office_badge(r, u)
        assert badge2.badge_uuid == badge.badge_uuid


def test_office_badge_matches_generic_office_tag(app):
    with app.app_context():
        u = _make_user()
        tpl = BadgeTemplate(name='Office Generic', tags='office', is_active=True)
        db.session.add(tpl)
        db.session.commit()
        tpl_id = tpl.id
        r = _make_result(u.id, id='oer-gen', office_app='word', session_type='simulador', score=600)
        badge = issue_office_badge(r, u)
        assert badge is not None
        assert badge.badge_template_id == tpl_id


def test_office_badge_skipped_when_not_passed(app):
    with app.app_context():
        u = _make_user()
        tpl = BadgeTemplate(name='X', tags='office', is_active=True)
        db.session.add(tpl)
        db.session.commit()
        r = _make_result(u.id, id='oer-fail', score=200, passed=False)
        badge = issue_office_badge(r, u)
        assert badge is None
