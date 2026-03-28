"""
Test unitario: Coordinator Candidate Sharing
Verifica que los coordinadores ven TODOS los candidatos (compartidos)
pero solo sus propios responsables/auxiliares.

Ejecutar:
  cd MotorUniversalV2/backend
  python -m pytest test_coordinator_sharing.py -v
"""
import os
import sys
import uuid
import pytest

# Forzar modo development (SQLite)
os.environ['FLASK_ENV'] = 'development'
os.environ['SECRET_KEY'] = 'test-secret-key'

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models.user import User
from sqlalchemy import or_, and_


@pytest.fixture
def app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def make_user(role, coordinator_id=None, campus_id=None, name_prefix='User'):
    uid = str(uuid.uuid4())
    u = User(
        id=uid,
        username=f'{name_prefix}_{uid[:8]}',
        name=name_prefix,
        first_surname='Test',
        second_surname='Auto',
        email=f'{uid[:8]}@test.com',
        role=role,
        coordinator_id=coordinator_id,
        campus_id=campus_id,
        is_active=True,
        is_verified=True,
    )
    u.set_password('test123')
    db.session.add(u)
    return u


def coordinator_query(coord_id):
    """Replica exacta del filtro de list_users para coordinadores."""
    return db.session.query(User).filter(
        or_(
            User.role == 'candidato',
            and_(
                User.role.in_(['responsable', 'responsable_partner', 'auxiliar']),
                User.coordinator_id == coord_id
            )
        )
    )


def coordinator_stats_query(coord_id, allowed_roles):
    """Replica exacta del filtro de get_user_stats para coordinadores."""
    return db.session.query(User).filter(
        User.role.in_(allowed_roles),
        or_(
            User.role == 'candidato',
            and_(
                User.role.in_(['responsable', 'responsable_partner', 'auxiliar']),
                User.coordinator_id == coord_id
            )
        )
    )


class TestCoordinatorCandidateSharing:
    """Coordinadores comparten candidatos pero NO responsables/auxiliares."""

    def test_coord_a_sees_all_candidatos(self, app):
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')
            cand_a1 = make_user('candidato', coordinator_id=coord_a.id, name_prefix='CandA1')
            cand_a2 = make_user('candidato', coordinator_id=coord_a.id, name_prefix='CandA2')
            cand_b1 = make_user('candidato', coordinator_id=coord_b.id, name_prefix='CandB1')
            cand_b2 = make_user('candidato', coordinator_id=coord_b.id, name_prefix='CandB2')
            db.session.commit()

            results = coordinator_query(coord_a.id).all()
            result_ids = [r.id for r in results]

            assert cand_a1.id in result_ids, "Coord A debe ver su propio candidato A1"
            assert cand_a2.id in result_ids, "Coord A debe ver su propio candidato A2"
            assert cand_b1.id in result_ids, "Coord A debe ver candidato B1 (compartido)"
            assert cand_b2.id in result_ids, "Coord A debe ver candidato B2 (compartido)"

    def test_coord_b_sees_all_candidatos(self, app):
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')
            cand_a1 = make_user('candidato', coordinator_id=coord_a.id, name_prefix='CandA1')
            cand_b1 = make_user('candidato', coordinator_id=coord_b.id, name_prefix='CandB1')
            db.session.commit()

            results = coordinator_query(coord_b.id).all()
            result_ids = [r.id for r in results]

            assert cand_a1.id in result_ids, "Coord B debe ver candidato A1 (compartido)"
            assert cand_b1.id in result_ids, "Coord B debe ver su propio candidato B1"

    def test_both_coords_see_same_candidatos(self, app):
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')
            for i in range(3):
                make_user('candidato', coordinator_id=coord_a.id, name_prefix=f'CandA{i}')
            for i in range(2):
                make_user('candidato', coordinator_id=coord_b.id, name_prefix=f'CandB{i}')
            db.session.commit()

            results_a = coordinator_query(coord_a.id).all()
            results_b = coordinator_query(coord_b.id).all()
            cands_a = [r for r in results_a if r.role == 'candidato']
            cands_b = [r for r in results_b if r.role == 'candidato']

            assert len(cands_a) == 5, f"Coord A ve 5 candidatos, no {len(cands_a)}"
            assert len(cands_b) == 5, f"Coord B ve 5 candidatos, no {len(cands_b)}"
            assert set(r.id for r in cands_a) == set(r.id for r in cands_b), \
                "Ambos coordinadores ven los mismos candidatos"

    def test_responsables_not_shared(self, app):
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')
            resp_a = make_user('responsable', coordinator_id=coord_a.id, campus_id=1, name_prefix='RespA')
            resp_b = make_user('responsable', coordinator_id=coord_b.id, campus_id=2, name_prefix='RespB')
            db.session.commit()

            results_a = coordinator_query(coord_a.id).all()
            result_a_ids = [r.id for r in results_a]
            results_b = coordinator_query(coord_b.id).all()
            result_b_ids = [r.id for r in results_b]

            assert resp_a.id in result_a_ids, "Coord A ve su propio responsable"
            assert resp_b.id not in result_a_ids, "Coord A NO ve responsable de B"
            assert resp_b.id in result_b_ids, "Coord B ve su propio responsable"
            assert resp_a.id not in result_b_ids, "Coord B NO ve responsable de A"

    def test_auxiliares_not_shared(self, app):
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')
            aux_a = make_user('auxiliar', coordinator_id=coord_a.id, name_prefix='AuxA')
            aux_b = make_user('auxiliar', coordinator_id=coord_b.id, name_prefix='AuxB')
            db.session.commit()

            results_a = coordinator_query(coord_a.id).all()
            result_a_ids = [r.id for r in results_a]

            assert aux_a.id in result_a_ids, "Coord A ve su propio auxiliar"
            assert aux_b.id not in result_a_ids, "Coord A NO ve auxiliar de B"

    def test_candidato_without_coordinator_visible(self, app):
        """Candidatos sin coordinator_id también deben ser visibles."""
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            orphan = make_user('candidato', coordinator_id=None, name_prefix='Orphan')
            db.session.commit()

            results = coordinator_query(coord_a.id).all()
            result_ids = [r.id for r in results]

            assert orphan.id in result_ids, "Coord A debe ver candidato sin coordinador"

    def test_coordinator_not_visible_to_other_coordinator(self, app):
        """Coordinadores NO deben aparecer en la lista de otro coordinador."""
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')
            db.session.commit()

            results = coordinator_query(coord_a.id).all()
            result_ids = [r.id for r in results]

            assert coord_a.id not in result_ids, "Coord A no se ve a sí mismo"
            assert coord_b.id not in result_ids, "Coord A no ve a Coord B"

    def test_stats_query_shares_candidatos(self, app):
        """El query de stats también comparte candidatos."""
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')
            for i in range(3):
                make_user('candidato', coordinator_id=coord_a.id, name_prefix=f'CandA{i}')
            for i in range(2):
                make_user('candidato', coordinator_id=coord_b.id, name_prefix=f'CandB{i}')
            make_user('responsable', coordinator_id=coord_a.id, campus_id=1, name_prefix='RespA')
            make_user('responsable', coordinator_id=coord_b.id, campus_id=2, name_prefix='RespB')
            db.session.commit()

            allowed_roles = ['candidato', 'responsable', 'responsable_partner', 'auxiliar']
            stats_a = coordinator_stats_query(coord_a.id, allowed_roles).all()
            stats_b = coordinator_stats_query(coord_b.id, allowed_roles).all()

            cands_a = [u for u in stats_a if u.role == 'candidato']
            cands_b = [u for u in stats_b if u.role == 'candidato']
            resps_a = [u for u in stats_a if u.role == 'responsable']
            resps_b = [u for u in stats_b if u.role == 'responsable']

            assert len(cands_a) == 5, f"Stats Coord A: 5 candidatos, no {len(cands_a)}"
            assert len(cands_b) == 5, f"Stats Coord B: 5 candidatos, no {len(cands_b)}"
            assert len(resps_a) == 1, f"Stats Coord A: 1 responsable, no {len(resps_a)}"
            assert len(resps_b) == 1, f"Stats Coord B: 1 responsable, no {len(resps_b)}"

    def test_mixed_scenario(self, app):
        """Escenario completo: 2 coordinadores con candidatos, responsables y auxiliares."""
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')

            # Candidatos de A (3)
            cands_a = [make_user('candidato', coordinator_id=coord_a.id, name_prefix=f'CA{i}') for i in range(3)]
            # Candidatos de B (2)
            cands_b = [make_user('candidato', coordinator_id=coord_b.id, name_prefix=f'CB{i}') for i in range(2)]
            # Candidato huérfano
            orphan = make_user('candidato', coordinator_id=None, name_prefix='Orphan')
            # Responsables
            resp_a = make_user('responsable', coordinator_id=coord_a.id, campus_id=1, name_prefix='RA')
            resp_b = make_user('responsable', coordinator_id=coord_b.id, campus_id=2, name_prefix='RB')
            # Auxiliares
            aux_a = make_user('auxiliar', coordinator_id=coord_a.id, name_prefix='AuxA')
            db.session.commit()

            results_a = coordinator_query(coord_a.id).all()
            ids_a = [r.id for r in results_a]
            results_b = coordinator_query(coord_b.id).all()
            ids_b = [r.id for r in results_b]

            # Candidatos compartidos
            all_cand_ids = [c.id for c in cands_a + cands_b + [orphan]]
            for cid in all_cand_ids:
                assert cid in ids_a, f"Coord A ve candidato {cid}"
                assert cid in ids_b, f"Coord B ve candidato {cid}"

            # Responsables NO compartidos
            assert resp_a.id in ids_a and resp_a.id not in ids_b
            assert resp_b.id in ids_b and resp_b.id not in ids_a

            # Auxiliares NO compartidos
            assert aux_a.id in ids_a and aux_a.id not in ids_b

    def test_responsable_partner_not_shared(self, app):
        """responsable_partner tampoco se comparte entre coordinadores."""
        with app.app_context():
            coord_a = make_user('coordinator', name_prefix='CoordA')
            coord_b = make_user('coordinator', name_prefix='CoordB')
            rp_a = make_user('responsable_partner', coordinator_id=coord_a.id, name_prefix='RPA')
            rp_b = make_user('responsable_partner', coordinator_id=coord_b.id, name_prefix='RPB')
            db.session.commit()

            results_a = coordinator_query(coord_a.id).all()
            ids_a = [r.id for r in results_a]

            assert rp_a.id in ids_a, "Coord A ve su responsable_partner"
            assert rp_b.id not in ids_a, "Coord A NO ve responsable_partner de B"
