from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token

from app import db
from app.models import User
from app.routes.support_chat import bp as support_chat_bp


def _build_app():
    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY="test-secret-key-with-32-chars-min",
    )

    db.init_app(app)
    JWTManager(app)
    app.register_blueprint(support_chat_bp)

    with app.app_context():
        db.create_all()

    return app


def _create_user(user_id: str, username: str, role: str) -> User:
    user = User(
        id=user_id,
        email=f"{username}@mail.com",
        username=username,
        name=username,
        first_surname="test",
        role=role,
        is_active=True,
    )
    user.set_password("Password123")
    db.session.add(user)
    return user


def _auth_header(app: Flask, user_id: str) -> dict:
    with app.app_context():
        token = create_access_token(identity=user_id)
    return {"Authorization": f"Bearer {token}"}


def test_candidate_support_chat_flow():
    app = _build_app()

    with app.app_context():
        _create_user("cand-1", "candidate1", "candidato")
        _create_user("supp-1", "support1", "soporte")
        db.session.commit()

    client = app.test_client()
    h_cand = _auth_header(app, "cand-1")
    h_supp = _auth_header(app, "supp-1")

    r = client.post(
        "/api/support/chat/conversations",
        headers=h_cand,
        json={"subject": "Ayuda con examen"},
    )
    assert r.status_code == 201
    conversation_id = r.get_json()["id"]

    r = client.post(
        f"/api/support/chat/conversations/{conversation_id}/messages",
        headers=h_cand,
        json={"content": "Hola, necesito apoyo"},
    )
    assert r.status_code == 201

    r = client.get("/api/support/chat/conversations", headers=h_supp)
    assert r.status_code == 200
    body = r.get_json()
    assert body["total"] == 1
    assert body["conversations"][0]["unread_count"] == 1

    r = client.post(
        f"/api/support/chat/conversations/{conversation_id}/messages",
        headers=h_supp,
        json={"content": "Te ayudo ahora"},
    )
    assert r.status_code == 201

    r = client.get("/api/support/chat/conversations", headers=h_cand)
    assert r.status_code == 200
    assert r.get_json()["conversations"][0]["unread_count"] == 1

    r = client.post(
        f"/api/support/chat/conversations/{conversation_id}/read",
        headers=h_cand,
        json={},
    )
    assert r.status_code == 200
    assert r.get_json()["unread_count"] == 0

    r = client.get(
        f"/api/support/chat/conversations/{conversation_id}/messages?per_page=1&page=1",
        headers=h_cand,
    )
    assert r.status_code == 200
    assert r.get_json()["total"] == 2


def test_candidate_cannot_access_foreign_conversation():
    app = _build_app()

    with app.app_context():
        _create_user("cand-1", "candidate1", "candidato")
        _create_user("cand-2", "candidate2", "candidato")
        db.session.commit()

    client = app.test_client()
    h1 = _auth_header(app, "cand-1")
    h2 = _auth_header(app, "cand-2")

    r = client.post(
        "/api/support/chat/conversations",
        headers=h1,
        json={"subject": "Privada"},
    )
    assert r.status_code == 201
    conversation_id = r.get_json()["id"]

    r = client.get(
        f"/api/support/chat/conversations/{conversation_id}/messages",
        headers=h2,
    )
    assert r.status_code == 403


def test_support_can_create_conversation_for_candidate():
    app = _build_app()

    with app.app_context():
        _create_user("cand-1", "candidate1", "candidato")
        _create_user("supp-1", "support1", "soporte")
        db.session.commit()

    client = app.test_client()
    h_supp = _auth_header(app, "supp-1")

    r = client.post(
        "/api/support/chat/conversations",
        headers=h_supp,
        json={"candidate_user_id": "cand-1", "subject": "Seguimiento"},
    )
    assert r.status_code == 201
    assert r.get_json()["candidate_user_id"] == "cand-1"


def test_status_updates_follow_role_rules():
    app = _build_app()

    with app.app_context():
        _create_user("cand-1", "candidate1", "candidato")
        _create_user("supp-1", "support1", "soporte")
        db.session.commit()

    client = app.test_client()
    h_supp = _auth_header(app, "supp-1")
    h_cand = _auth_header(app, "cand-1")

    r = client.post(
        "/api/support/chat/conversations",
        headers=h_cand,
        json={"subject": "Estado de conversación"},
    )
    assert r.status_code == 201
    conversation_id = r.get_json()["id"]

    # Soporte puede cerrar conversación
    r = client.patch(
        f"/api/support/chat/conversations/{conversation_id}/status",
        headers=h_supp,
        json={"status": "closed"},
    )
    assert r.status_code == 200
    assert r.get_json()["conversation"]["status"] == "closed"

    # Candidato no puede cerrar
    r = client.patch(
        f"/api/support/chat/conversations/{conversation_id}/status",
        headers=h_cand,
        json={"status": "closed"},
    )
    assert r.status_code == 403

    # Candidato sí puede reabrir
    r = client.patch(
        f"/api/support/chat/conversations/{conversation_id}/status",
        headers=h_cand,
        json={"status": "open"},
    )
    assert r.status_code == 200
    assert r.get_json()["conversation"]["status"] == "open"
