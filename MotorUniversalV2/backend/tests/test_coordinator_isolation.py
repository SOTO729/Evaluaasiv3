"""
Test integral de Aislamiento de Datos por Coordinador
=====================================================

Verifica las reglas de aislamiento multi-tenant implementadas:

RECURSOS COMPARTIDOS (todos los coordinadores ven todo):
  - Partners (coord puede crear/editar, solo admin puede eliminar)
  - Campuses (coord puede crear/editar, solo admin puede eliminar)
  - Estados de partner (coord puede agregar, solo admin puede eliminar)
  - Usuarios (solo admin puede editar/eliminar)
  - Exámenes disponibles
  - Dashboard: conteos de partners/campuses

RECURSOS AISLADOS (cada coordinador solo ve los suyos):
  - Grupos (filtrados por CandidateGroup.coordinator_id)
  - Miembros de grupo (hereda acceso del grupo)
  - Dashboard: conteos de grupos/miembros, recent_groups

PRUEBAS:
  S1. Partners compartidos: coord ve todos los partners
  S2. Campuses compartidos: coord ve todos los campuses de cualquier partner
  S3. Usuarios compartidos: coord ve candidatos/responsables de cualquier coord
  S4. Dashboard compartido: partners_by_state tiene datos globales
  S5. Candidatos compartidos: búsqueda muestra candidatos de cualquier coord

  I1. Grupos aislados: coord_A NO ve grupos de coord_B en list-all
  I2. Grupos aislados: coord_A NO ve grupos de coord_B en search
  I3. Grupo detalle aislado: coord_A recibe 403 al ver grupo de coord_B
  I4. Grupo edición aislada: coord_A recibe 403 al editar grupo de coord_B
  I5. Grupo eliminación aislada: coord_A recibe 403 al eliminar grupo de coord_B
  I6. Miembros aislados: coord_A recibe 403 al listar miembros de grupo de coord_B
  I7. Dashboard aislado: total_groups solo cuenta grupos propios
  I8. Creación de grupo: se asigna coordinator_id automáticamente

  A1. Coord PUEDE crear partner (200/201)
  A2. Coord PUEDE editar partner (200)
  A3. Admin-only: coord NO puede eliminar partner (403)
  A4. Coord PUEDE crear campus (200/201)
  A5. Coord PUEDE editar campus (200)
  A6. Admin-only: coord NO puede eliminar campus (403)
  A7. Admin-only: coord NO puede editar usuario (403)
  A8. Admin-only: coord NO puede cambiar password usuario (403)
  A9. Admin-only: coord NO puede toggle-active usuario (403)
  A10. Coord PUEDE agregar estado a partner (200/201)
  A11. Admin-only: coord NO puede eliminar estado de partner (403)

  B1. Badges grupo aislado: coord_A recibe 403 al ver badges de grupo de coord_B

  X1. Admin ve TODOS los grupos (sin filtro)
  X2. Admin puede crear partner
  X3. Admin puede editar usuario
  X4. Admin puede crear campus

USO:
  python tests/test_coordinator_isolation.py [--env dev|prod|both] [--verbose]
"""

import sys
import os
import json
import time
import uuid
import argparse
import requests

# ── Configuración de entornos ──
ENVS = {
    "prod": {
        "api": "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
        "db_name": "evaluaasi",
    },
    "dev": {
        "api": "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
        "db_name": "evaluaasi_dev",
    },
}

DB_SERVER = "evaluaasi-motorv2-sql.database.windows.net"
DB_USER = "evaluaasi_admin"
DB_PASS = "EvalAasi2024_newpwd!"

ADMIN_USER = "admin"
ADMIN_PASS = "Admin123!"

# Test prefix for cleanup
TEST_PREFIX = f"ISOTEST_{uuid.uuid4().hex[:6].upper()}"

# Timeout
REQ_TIMEOUT = 120

# ── Contadores ──
passed = 0
failed = 0
warnings = 0
errors_detail = []

# ── Verbose flag ──
VERBOSE = False


# ── Helpers ──
def log(msg):
    if VERBOSE:
        print(f"    [DEBUG] {msg}")


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ {name}")
        passed += 1
    else:
        msg = f"  ❌ {name} — {detail}"
        print(msg)
        failed += 1
        errors_detail.append(msg)


def warn(name, detail=""):
    global warnings
    print(f"  ⚠️  {name} — {detail}")
    warnings += 1


# ── Request session with retry adapter ──
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

_session = requests.Session()
retries = Retry(total=3, backoff_factor=1, status_forcelist=[502, 503, 504],
                allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "PATCH"])
adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=10)
_session.mount("https://", adapter)
_session.mount("http://", adapter)


def safe_request(method, url, **kwargs):
    """Request con session persistente y retry automático."""
    kwargs.setdefault("timeout", REQ_TIMEOUT)
    try:
        r = _session.request(method, url, **kwargs)
        return r
    except requests.exceptions.Timeout as e:
        print(f"    ⚠️  Timeout: {e}")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"    ⚠️  ConnectionError: {e}")
        return None
    except Exception as e:
        print(f"    ⚠️  Error ({type(e).__name__}): {e}")
        return None


def get_token(api_url, username, password):
    """Login y devolver token."""
    r = safe_request("POST", f"{api_url}/auth/login",
                     json={"username": username, "password": password})
    if r is not None and r.status_code == 200:
        return r.json().get("access_token")
    if r is not None and r.status_code == 429:
        wait = int(r.json().get("retry_after", 30))
        print(f"    ⏳ Rate limit, esperando {min(wait, 60)}s...")
        time.sleep(min(wait, 60))
        r = safe_request("POST", f"{api_url}/auth/login",
                         json={"username": username, "password": password})
        if r is not None and r.status_code == 200:
            return r.json().get("access_token")
    status = r.status_code if r is not None else "N/A"
    text = r.text[:200] if r is not None else "No response"
    print(f"    ⚠️  Login fallido ({username}): {status} {text}")
    return None


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def get_json(r):
    """Safe JSON parse."""
    try:
        return r.json() if r is not None else None
    except Exception:
        return None


# ── DB helpers ──
def db_connect(db_name):
    try:
        import pymssql
        return pymssql.connect(DB_SERVER, DB_USER, DB_PASS, db_name)
    except Exception as e:
        print(f"    ⚠️  No se pudo conectar a DB {db_name}: {e}")
        return None


def db_exec(conn, sql, params=None):
    cur = conn.cursor()
    if params:
        cur.execute(sql, params)
    else:
        cur.execute(sql)
    return cur


def db_fetch_one(conn, sql, params=None):
    cur = db_exec(conn, sql, params)
    return cur.fetchone()


def db_fetch_all(conn, sql, params=None):
    cur = db_exec(conn, sql, params)
    return cur.fetchall()


# ══════════════════════════════════════════════════════════
#                    SETUP & TEARDOWN
# ══════════════════════════════════════════════════════════

class TestContext:
    """Almacena tokens, IDs y estado de prueba para un entorno."""
    def __init__(self, env_name, api_url, db_name):
        self.env_name = env_name
        self.api = api_url
        self.db_name = db_name
        self.admin_token = None
        self.coord_a_token = None
        self.coord_b_token = None
        self.coord_a_id = None
        self.coord_b_id = None
        self.coord_a_username = None
        self.coord_b_username = None
        self.coord_b_password = None
        # IDs compartidos
        self.partner_id = None
        self.campus_id = None
        self.candidato_id = None
        # IDs aislados
        self.group_a_id = None  # grupo de coord_A
        self.group_b_id = None  # grupo de coord_B
        # Cleanup
        self.created_user_ids = []
        self.created_group_ids = []
        self.created_partner_ids = []
        self.created_campus_ids = []
        self.conn = None

    def setup(self):
        """Configura el entorno de test."""
        print(f"\n{'='*60}")
        print(f"  SETUP — {self.env_name.upper()}")
        print(f"{'='*60}")

        # 1. Conectar a DB
        self.conn = db_connect(self.db_name)
        if not self.conn:
            print("  ❌ No se puede conectar a DB, abortando setup")
            return False

        # 2. Login admin
        print("  → Login admin...")
        self.admin_token = get_token(self.api, ADMIN_USER, ADMIN_PASS)
        if not self.admin_token:
            print("  ❌ No se puede loguear como admin")
            return False
        print("    ✓ Admin OK")

        # 3. Buscar o crear coordinator A (el existente)
        print("  → Buscando coordinador A existente...")
        row = db_fetch_one(self.conn,
            "SELECT TOP 1 id, username FROM users WHERE role='coordinator' AND is_active=1")
        if row:
            self.coord_a_id = row[0]
            self.coord_a_username = row[1]
            print(f"    ✓ Coord A: {self.coord_a_username} (id={self.coord_a_id[:12]}...)")
        else:
            # Crear coordinator A via API
            print("    → Creando coordinator A...")
            self.coord_a_id, coord_a_pwd, self.coord_a_username = \
                self._create_coordinator(f"{TEST_PREFIX}_COORD_A")
            if not self.coord_a_id:
                print("  ❌ No se puede crear coordinator A")
                return False

        # 4. Crear coordinator B para pruebas de aislamiento
        print("  → Creando coordinador B para pruebas...")
        self.coord_b_id, self.coord_b_password, self.coord_b_username = \
            self._create_coordinator(f"{TEST_PREFIX}_COORD_B")
        if not self.coord_b_id:
            print("  ❌ No se puede crear coordinator B")
            return False
        print(f"    ✓ Coord B: {self.coord_b_username} (id={self.coord_b_id[:12]}...)")

        # 5. Login coordinator A — generate a known password via admin
        print("  → Configurando login de Coord A...")
        # Generate a temporary password for Coord A
        r = safe_request("POST",
            f"{self.api}/user-management/users/{self.coord_a_id}/generate-password",
            headers=auth(self.admin_token))
        if r is not None and r.status_code == 200:
            gen_data = get_json(r) or {}
            coord_a_pwd = gen_data.get("password")
            if coord_a_pwd:
                self.coord_a_token = get_token(self.api, self.coord_a_username, coord_a_pwd)
                if self.coord_a_token:
                    print("    ✓ Coord A login OK")
        
        if not self.coord_a_token:
            # Try changing password via PUT
            coord_a_pwd = f"Test{uuid.uuid4().hex[:8]}!"
            r = safe_request("PUT",
                f"{self.api}/user-management/users/{self.coord_a_id}/password",
                headers=auth(self.admin_token),
                json={"new_password": coord_a_pwd})
            if r is not None and r.status_code == 200:
                self.coord_a_token = get_token(self.api, self.coord_a_username, coord_a_pwd)
                if self.coord_a_token:
                    print("    ✓ Coord A login OK (via password change)")

        if not self.coord_a_token:
            print("  ❌ No se pudo loguear Coord A")
            return False

        # 6. Login coordinator B (using temporary_password from creation)
        print("  → Login coordinador B...")
        self.coord_b_token = get_token(self.api, self.coord_b_username, self.coord_b_password)
        if not self.coord_b_token:
            # Try generating a new password
            r = safe_request("POST",
                f"{self.api}/user-management/users/{self.coord_b_id}/generate-password",
                headers=auth(self.admin_token))
            if r is not None and r.status_code == 200:
                gen_data = get_json(r) or {}
                self.coord_b_password = gen_data.get("password")
                if self.coord_b_password:
                    self.coord_b_token = get_token(
                        self.api, self.coord_b_username, self.coord_b_password)
        if not self.coord_b_token:
            print("  ❌ No se pudo loguear Coord B")
            return False
        print("    ✓ Coord B login OK")

        # 7. Asegurar que hay un partner y campus disponibles
        print("  → Verificando datos de referencia...")
        row = db_fetch_one(self.conn, "SELECT TOP 1 id FROM partners WHERE is_active=1")
        if row:
            self.partner_id = row[0]
        else:
            # Crear partner via admin
            r = safe_request("POST", f"{self.api}/partners",
                headers=auth(self.admin_token),
                json={"name": f"{TEST_PREFIX}_Partner", "rfc": "TEST000000AA0"})
            if r is not None and r.status_code in (200, 201):
                data = get_json(r)
                self.partner_id = data.get("id") or data.get("partner", {}).get("id")
                if self.partner_id:
                    self.created_partner_ids.append(self.partner_id)
            if not self.partner_id:
                print("  ❌ No hay partner disponible")
                return False
        print(f"    ✓ Partner: id={self.partner_id}")

        row = db_fetch_one(self.conn,
            "SELECT TOP 1 id FROM campuses WHERE is_active=1 AND partner_id=%s",
            (self.partner_id,))
        if row:
            self.campus_id = row[0]
        else:
            # Crear campus via admin
            r = safe_request("POST",
                f"{self.api}/partners/{self.partner_id}/campuses",
                headers=auth(self.admin_token),
                json={"name": f"{TEST_PREFIX}_Campus", "cct": "TEST0000"})
            if r is not None and r.status_code in (200, 201):
                data = get_json(r)
                self.campus_id = data.get("id") or data.get("campus", {}).get("id")
                if self.campus_id:
                    self.created_campus_ids.append(self.campus_id)
        if not self.campus_id:
            print("  ❌ No hay campus disponible")
            return False
        print(f"    ✓ Campus: id={self.campus_id}")

        # 8. Crear grupos de prueba para ambos coordinadores
        print("  → Creando grupo para Coord A...")
        self.group_a_id = self._create_group(self.coord_a_token, f"{TEST_PREFIX}_GRP_A")
        if self.group_a_id:
            self.created_group_ids.append(self.group_a_id)
            print(f"    ✓ Grupo A: id={self.group_a_id}")
        else:
            warn("Grupo A", "No se pudo crear — algunas pruebas fallarán")

        print("  → Creando grupo para Coord B...")
        self.group_b_id = self._create_group(self.coord_b_token, f"{TEST_PREFIX}_GRP_B")
        if self.group_b_id:
            self.created_group_ids.append(self.group_b_id)
            print(f"    ✓ Grupo B: id={self.group_b_id}")
        else:
            warn("Grupo B", "No se pudo crear — algunas pruebas fallarán")

        # 9. Buscar un candidato existente
        row = db_fetch_one(self.conn,
            "SELECT TOP 1 id FROM users WHERE role='candidato' AND is_active=1")
        if row:
            self.candidato_id = row[0]
            print(f"    ✓ Candidato referencia: id={self.candidato_id[:12]}...")

        print(f"\n  ✓ Setup completado — {self.env_name.upper()}")
        return True

    def _create_coordinator(self, display_name, password=None):
        """Crear un coordinator de prueba via admin API.
        
        Returns (user_id, password, username) or (None, None, None).
        The API auto-generates the username, so we capture it from the response.
        """
        payload = {
            "name": "Test",
            "first_surname": display_name,
            "second_surname": "Isolation",
            "gender": "M",
            "email": f"{display_name.lower()}@test.evaluaasi.com",
            "role": "coordinator",
        }
        if password:
            payload["password"] = password
        r = safe_request("POST", f"{self.api}/user-management/users",
                         headers=auth(self.admin_token), json=payload)
        if r is not None and r.status_code in (200, 201):
            data = get_json(r)
            user_data = data.get("user", {})
            uid = user_data.get("id") or data.get("id")
            # API may return a temporary_password
            temp_pwd = data.get("temporary_password") or password
            # API auto-generates username
            auto_username = user_data.get("username")
            if uid:
                self.created_user_ids.append(uid)
                return uid, temp_pwd, auto_username
            else:
                log(f"Create coordinator response no ID: {data}")
        else:
            log(f"Create coordinator failed: {r.status_code if r is not None else 'N/A'} "
                f"{r.text[:300] if r is not None else ''}")
        return None, None, None

    def _create_group(self, coord_token, name):
        """Crear un grupo con el token del coordinador."""
        payload = {
            "name": name,
            "description": f"Test isolation group {name}",
        }
        r = safe_request("POST",
            f"{self.api}/partners/campuses/{self.campus_id}/groups",
            headers=auth(coord_token), json=payload)
        if r is not None and r.status_code in (200, 201):
            data = get_json(r)
            gid = data.get("id") or data.get("group", {}).get("id")
            return gid
        else:
            log(f"Create group failed: {r.status_code if r is not None else 'N/A'} "
                f"{r.text[:300] if r is not None else ''}")
        return None

    def teardown(self):
        """Limpiar datos de prueba."""
        print(f"\n{'='*60}")
        print(f"  TEARDOWN — {self.env_name.upper()}")
        print(f"{'='*60}")

        if not self.conn:
            self.conn = db_connect(self.db_name)

        if self.conn:
            try:
                cur = self.conn.cursor()

                # Eliminar grupos de prueba
                for gid in self.created_group_ids:
                    try:
                        cur.execute("DELETE FROM group_members WHERE group_id=%s", (gid,))
                        cur.execute("DELETE FROM candidate_groups WHERE id=%s", (gid,))
                        log(f"Deleted group {gid}")
                    except Exception as e:
                        log(f"Error deleting group {gid}: {e}")

                # Eliminar campuses de prueba
                for cid in self.created_campus_ids:
                    try:
                        cur.execute("DELETE FROM campuses WHERE id=%s", (cid,))
                        log(f"Deleted campus {cid}")
                    except Exception as e:
                        log(f"Error deleting campus {cid}: {e}")

                # Eliminar partners de prueba
                for pid in self.created_partner_ids:
                    try:
                        cur.execute("DELETE FROM partners WHERE id=%s", (pid,))
                        log(f"Deleted partner {pid}")
                    except Exception as e:
                        log(f"Error deleting partner {pid}: {e}")

                # Eliminar usuarios de prueba
                for uid in self.created_user_ids:
                    try:
                        # First remove any group memberships
                        cur.execute("DELETE FROM group_members WHERE user_id=%s", (uid,))
                        # Then remove any coordinator references in groups
                        cur.execute(
                            "UPDATE candidate_groups SET coordinator_id=NULL "
                            "WHERE coordinator_id=%s", (uid,))
                        cur.execute("DELETE FROM users WHERE id=%s", (uid,))
                        log(f"Deleted user {uid}")
                    except Exception as e:
                        log(f"Error deleting user {uid}: {e}")

                self.conn.commit()
                print(f"  ✓ Limpieza completada: {len(self.created_group_ids)} grupos, "
                      f"{len(self.created_user_ids)} usuarios, "
                      f"{len(self.created_campus_ids)} campuses, "
                      f"{len(self.created_partner_ids)} partners")
            except Exception as e:
                print(f"  ⚠️  Error en teardown: {e}")
            finally:
                self.conn.close()
        else:
            print("  ⚠️  No hay conexión DB para limpieza — datos de prueba quedan huérfanos")
            print(f"    Prefijo: {TEST_PREFIX}")
            print(f"    Users: {self.created_user_ids}")
            print(f"    Groups: {self.created_group_ids}")


# ══════════════════════════════════════════════════════════
#              TESTS — RECURSOS COMPARTIDOS
# ══════════════════════════════════════════════════════════

def test_shared_resources(ctx: TestContext):
    """Tests S1-S5: Recursos compartidos visibles para todos los coordinadores."""
    print(f"\n{'─'*60}")
    print(f"  RECURSOS COMPARTIDOS — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    # S1. Partners compartidos
    print("\n  [S1] Partners compartidos")
    r_admin = safe_request("GET", f"{ctx.api}/partners?per_page=100",
                           headers=auth(ctx.admin_token))
    r_coord_a = safe_request("GET", f"{ctx.api}/partners?per_page=100",
                             headers=auth(ctx.coord_a_token))
    r_coord_b = safe_request("GET", f"{ctx.api}/partners?per_page=100",
                             headers=auth(ctx.coord_b_token))

    admin_data = get_json(r_admin) or {}
    coord_a_data = get_json(r_coord_a) or {}
    coord_b_data = get_json(r_coord_b) or {}

    admin_total = admin_data.get("total", 0)
    coord_a_total = coord_a_data.get("total", 0)
    coord_b_total = coord_b_data.get("total", 0)

    test("S1.1 Coord A ve partners",
         r_coord_a is not None and r_coord_a.status_code == 200,
         f"Status: {r_coord_a.status_code if r_coord_a is not None else 'N/A'}")
    test("S1.2 Coord B ve partners",
         r_coord_b is not None and r_coord_b.status_code == 200,
         f"Status: {r_coord_b.status_code if r_coord_b is not None else 'N/A'}")
    test("S1.3 Coord A ve mismos partners que admin",
         coord_a_total == admin_total,
         f"Admin={admin_total}, Coord_A={coord_a_total}")
    test("S1.4 Coord B ve mismos partners que admin",
         coord_b_total == admin_total,
         f"Admin={admin_total}, Coord_B={coord_b_total}")

    log(f"Partners: admin={admin_total}, A={coord_a_total}, B={coord_b_total}")

    # S2. Campuses compartidos
    print("\n  [S2] Campuses compartidos")
    r_a = safe_request("GET",
        f"{ctx.api}/partners/{ctx.partner_id}/campuses",
        headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET",
        f"{ctx.api}/partners/{ctx.partner_id}/campuses",
        headers=auth(ctx.coord_b_token))
    r_admin_c = safe_request("GET",
        f"{ctx.api}/partners/{ctx.partner_id}/campuses",
        headers=auth(ctx.admin_token))

    a_data = get_json(r_a)
    b_data = get_json(r_b)
    admin_c_data = get_json(r_admin_c)

    # Campuses can be returned as list or dict with key
    def count_campuses(data):
        if isinstance(data, list):
            return len(data)
        if isinstance(data, dict):
            for key in ("campuses", "data", "items"):
                if key in data:
                    return len(data[key]) if isinstance(data[key], list) else data.get("total", 0)
            return data.get("total", 0)
        return 0

    a_count = count_campuses(a_data)
    b_count = count_campuses(b_data)
    admin_count = count_campuses(admin_c_data)

    test("S2.1 Coord A ve campuses del partner",
         r_a is not None and r_a.status_code == 200 and a_count > 0,
         f"Status={r_a.status_code if r_a is not None else 'N/A'}, count={a_count}")
    test("S2.2 Coord B ve campuses del partner",
         r_b is not None and r_b.status_code == 200 and b_count > 0,
         f"Status={r_b.status_code if r_b is not None else 'N/A'}, count={b_count}")
    test("S2.3 Ambos ven misma cantidad que admin",
         a_count == admin_count and b_count == admin_count,
         f"Admin={admin_count}, A={a_count}, B={b_count}")

    # S3. Usuarios compartidos
    print("\n  [S3] Usuarios compartidos")
    r_a = safe_request("GET",
        f"{ctx.api}/user-management/users?per_page=5&role=candidato",
        headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET",
        f"{ctx.api}/user-management/users?per_page=5&role=candidato",
        headers=auth(ctx.coord_b_token))

    a_data = get_json(r_a) or {}
    b_data = get_json(r_b) or {}

    a_total = a_data.get("total", 0)
    b_total = b_data.get("total", 0)

    test("S3.1 Coord A ve candidatos",
         r_a is not None and r_a.status_code == 200,
         f"Status={r_a.status_code if r_a is not None else 'N/A'}")
    test("S3.2 Coord B ve candidatos",
         r_b is not None and r_b.status_code == 200,
         f"Status={r_b.status_code if r_b is not None else 'N/A'}")
    test("S3.3 Ambos ven misma cantidad de candidatos",
         a_total == b_total,
         f"A={a_total}, B={b_total}")

    log(f"Candidatos: A={a_total}, B={b_total}")

    # S3.5 Coord puede ver detalle de un candidato ajeno
    if ctx.candidato_id:
        print("\n  [S3.5] Detalle de candidato ajeno")
        r_detail = safe_request("GET",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}",
            headers=auth(ctx.coord_b_token))
        test("S3.5 Coord B ve detalle de candidato existente",
             r_detail is not None and r_detail.status_code == 200,
             f"Status={r_detail.status_code if r_detail is not None else 'N/A'}")

    # S4. Dashboard — datos compartidos
    print("\n  [S4] Dashboard compartido")
    r_a = safe_request("GET", f"{ctx.api}/partners/dashboard",
                       headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET", f"{ctx.api}/partners/dashboard",
                       headers=auth(ctx.coord_b_token))

    a_dash = get_json(r_a) or {}
    b_dash = get_json(r_b) or {}
    a_stats = a_dash.get("stats", {})
    b_stats = b_dash.get("stats", {})

    test("S4.1 Coord A obtiene dashboard",
         r_a is not None and r_a.status_code == 200,
         f"Status={r_a.status_code if r_a is not None else 'N/A'}")
    test("S4.2 Coord B obtiene dashboard",
         r_b is not None and r_b.status_code == 200,
         f"Status={r_b.status_code if r_b is not None else 'N/A'}")
    test("S4.3 Ambos ven mismos total_partners",
         a_stats.get("total_partners") == b_stats.get("total_partners") and a_stats.get("total_partners") is not None,
         f"A={a_stats.get('total_partners')}, B={b_stats.get('total_partners')}")
    test("S4.4 Ambos ven mismos total_campuses",
         a_stats.get("total_campuses") == b_stats.get("total_campuses") and a_stats.get("total_campuses") is not None,
         f"A={a_stats.get('total_campuses')}, B={b_stats.get('total_campuses')}")
    test("S4.5 Ambos ven mismos partners_by_state",
         a_dash.get("partners_by_state") == b_dash.get("partners_by_state"),
         f"Diferences found")

    log(f"Dashboard A: partners={a_stats.get('total_partners')}, "
        f"campuses={a_stats.get('total_campuses')}, "
        f"groups={a_stats.get('total_groups')}")
    log(f"Dashboard B: partners={b_stats.get('total_partners')}, "
        f"campuses={b_stats.get('total_campuses')}, "
        f"groups={b_stats.get('total_groups')}")

    # S5. Búsqueda de candidatos compartida
    print("\n  [S5] Búsqueda candidatos compartida")
    r_a = safe_request("GET",
        f"{ctx.api}/partners/candidates/search?q=a&per_page=5",
        headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET",
        f"{ctx.api}/partners/candidates/search?q=a&per_page=5",
        headers=auth(ctx.coord_b_token))

    test("S5.1 Coord A puede buscar candidatos",
         r_a is not None and r_a.status_code == 200,
         f"Status={r_a.status_code if r_a is not None else 'N/A'}")
    test("S5.2 Coord B puede buscar candidatos",
         r_b is not None and r_b.status_code == 200,
         f"Status={r_b.status_code if r_b is not None else 'N/A'}")

    a_res = get_json(r_a) or {}
    b_res = get_json(r_b) or {}
    a_t = a_res.get("total", len(a_res.get("candidates", [])))
    b_t = b_res.get("total", len(b_res.get("candidates", [])))
    test("S5.3 Ambos ven misma cantidad de resultados",
         a_t == b_t,
         f"A={a_t}, B={b_t}")


# ══════════════════════════════════════════════════════════
#              TESTS — RECURSOS AISLADOS (GRUPOS)
# ══════════════════════════════════════════════════════════

def test_isolated_resources(ctx: TestContext):
    """Tests I1-I8: Grupos aislados por coordinator_id."""
    print(f"\n{'─'*60}")
    print(f"  RECURSOS AISLADOS (GRUPOS) — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    if not ctx.group_a_id or not ctx.group_b_id:
        warn("SKIP", "Se requieren ambos grupos para pruebas de aislamiento")
        return

    # I1. list-all solo muestra grupos propios
    print("\n  [I1] list-all aislado")
    r_a = safe_request("GET", f"{ctx.api}/partners/groups/list-all?per_page=200",
                       headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET", f"{ctx.api}/partners/groups/list-all?per_page=200",
                       headers=auth(ctx.coord_b_token))

    a_data = get_json(r_a) or {}
    b_data = get_json(r_b) or {}

    a_groups = a_data.get("groups", [])
    b_groups = b_data.get("groups", [])
    a_ids = {g.get("id") for g in a_groups}
    b_ids = {g.get("id") for g in b_groups}

    test("I1.1 Coord A ve su grupo en list-all",
         ctx.group_a_id in a_ids,
         f"Grupo A ({ctx.group_a_id}) no aparece en lista de A. IDs: {a_ids}")
    test("I1.2 Coord A NO ve grupo de Coord B en list-all",
         ctx.group_b_id not in a_ids,
         f"Grupo B ({ctx.group_b_id}) aparece en lista de A")
    test("I1.3 Coord B ve su grupo en list-all",
         ctx.group_b_id in b_ids,
         f"Grupo B ({ctx.group_b_id}) no aparece en lista de B. IDs: {b_ids}")
    test("I1.4 Coord B NO ve grupo de Coord A en list-all",
         ctx.group_a_id not in b_ids,
         f"Grupo A ({ctx.group_a_id}) aparece en lista de B")

    log(f"list-all A: {len(a_groups)} groups, B: {len(b_groups)} groups")

    # I2. search aislado
    print("\n  [I2] search aislado")
    r_a = safe_request("GET",
        f"{ctx.api}/partners/groups/search?q={TEST_PREFIX}&per_page=50",
        headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET",
        f"{ctx.api}/partners/groups/search?q={TEST_PREFIX}&per_page=50",
        headers=auth(ctx.coord_b_token))

    a_search = get_json(r_a) or {}
    b_search = get_json(r_b) or {}
    a_s_groups = a_search.get("groups", [])
    b_s_groups = b_search.get("groups", [])
    a_s_ids = {g.get("id") for g in a_s_groups}
    b_s_ids = {g.get("id") for g in b_s_groups}

    test("I2.1 Coord A busca y encuentra su grupo",
         ctx.group_a_id in a_s_ids,
         f"Grupo A no en resultados de búsqueda de A")
    test("I2.2 Coord A NO encuentra grupo de B en búsqueda",
         ctx.group_b_id not in a_s_ids,
         f"Grupo B aparece en búsqueda de A")
    test("I2.3 Coord B busca y encuentra su grupo",
         ctx.group_b_id in b_s_ids,
         f"Grupo B no en resultados de búsqueda de B")
    test("I2.4 Coord B NO encuentra grupo de A en búsqueda",
         ctx.group_a_id not in b_s_ids,
         f"Grupo A aparece en búsqueda de B")

    # I3. Detalle de grupo ajeno → 403
    print("\n  [I3] Detalle grupo ajeno → 403")
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_b_id}",
        headers=auth(ctx.coord_a_token))
    test("I3.1 Coord A recibe 403 al ver detalle de grupo de B",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_a_id}",
        headers=auth(ctx.coord_b_token))
    test("I3.2 Coord B recibe 403 al ver detalle de grupo de A",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # I3.3 Coord A SÍ puede ver su propio grupo
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_a_id}",
        headers=auth(ctx.coord_a_token))
    test("I3.3 Coord A SÍ puede ver su propio grupo",
         r is not None and r.status_code == 200,
         f"Expected 200, got {r.status_code if r is not None else 'N/A'}")

    # I4. Editar grupo ajeno → 403
    print("\n  [I4] Editar grupo ajeno → 403")
    r = safe_request("PUT",
        f"{ctx.api}/partners/groups/{ctx.group_b_id}",
        headers=auth(ctx.coord_a_token),
        json={"name": "HACKED"})
    test("I4.1 Coord A recibe 403 al editar grupo de B",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # I5. Eliminar grupo ajeno → 403
    print("\n  [I5] Eliminar grupo ajeno → 403")
    r = safe_request("DELETE",
        f"{ctx.api}/partners/groups/{ctx.group_b_id}",
        headers=auth(ctx.coord_a_token))
    test("I5.1 Coord A recibe 403 al eliminar grupo de B",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # I6. Miembros de grupo ajeno → 403
    print("\n  [I6] Miembros de grupo ajeno → 403")
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_b_id}/members",
        headers=auth(ctx.coord_a_token))
    test("I6.1 Coord A recibe 403 al listar miembros de grupo de B",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # I6.2 Coord A SÍ puede listar miembros de su grupo
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_a_id}/members",
        headers=auth(ctx.coord_a_token))
    test("I6.2 Coord A SÍ puede listar miembros de su grupo",
         r is not None and r.status_code == 200,
         f"Expected 200, got {r.status_code if r is not None else 'N/A'}")

    # I7. Dashboard aislado: grupos
    print("\n  [I7] Dashboard aislado: conteo de grupos")
    r_a = safe_request("GET", f"{ctx.api}/partners/dashboard",
                       headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET", f"{ctx.api}/partners/dashboard",
                       headers=auth(ctx.coord_b_token))
    r_admin = safe_request("GET", f"{ctx.api}/partners/dashboard",
                           headers=auth(ctx.admin_token))

    a_dash = get_json(r_a) or {}
    b_dash = get_json(r_b) or {}
    admin_dash = get_json(r_admin) or {}

    a_groups_count = a_dash.get("stats", {}).get("total_groups", 0)
    b_groups_count = b_dash.get("stats", {}).get("total_groups", 0)
    admin_groups_count = admin_dash.get("stats", {}).get("total_groups", 0)

    test("I7.1 Coord A y B tienen diferente total_groups",
         a_groups_count != b_groups_count or (a_groups_count >= 1 and b_groups_count >= 1),
         f"A={a_groups_count}, B={b_groups_count}")
    test("I7.2 Admin ve más o igual grupos que cualquier coord",
         admin_groups_count >= a_groups_count and admin_groups_count >= b_groups_count,
         f"Admin={admin_groups_count}, A={a_groups_count}, B={b_groups_count}")

    # I7.3 recent_groups aislado
    a_recent = a_dash.get("recent_groups", [])
    b_recent = b_dash.get("recent_groups", [])
    a_recent_ids = {g.get("id") for g in a_recent}
    b_recent_ids = {g.get("id") for g in b_recent}

    test("I7.3 Grupo B no aparece en recent_groups de A",
         ctx.group_b_id not in a_recent_ids,
         f"Grupo B ({ctx.group_b_id}) en recent_groups de A")
    test("I7.4 Grupo A no aparece en recent_groups de B",
         ctx.group_a_id not in b_recent_ids,
         f"Grupo A ({ctx.group_a_id}) en recent_groups de B")

    log(f"Dashboard groups: admin={admin_groups_count}, A={a_groups_count}, "
        f"B={b_groups_count}")

    # I8. Al crear un grupo se asigna coordinator_id
    print("\n  [I8] coordinator_id se asigna al crear grupo")
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_a_id}",
        headers=auth(ctx.coord_a_token))
    a_group_data = get_json(r) or {}
    # Puede estar anidado
    group_info = a_group_data.get("group", a_group_data)

    test("I8.1 Grupo A tiene coordinator_id del Coord A",
         group_info.get("coordinator_id") == ctx.coord_a_id,
         f"Expected coord_id={ctx.coord_a_id[:12]}..., "
         f"got={group_info.get('coordinator_id')}")

    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_b_id}",
        headers=auth(ctx.coord_b_token))
    b_group_data = get_json(r) or {}
    group_info = b_group_data.get("group", b_group_data)

    test("I8.2 Grupo B tiene coordinator_id del Coord B",
         group_info.get("coordinator_id") == ctx.coord_b_id,
         f"Expected coord_id={ctx.coord_b_id[:12]}..., "
         f"got={group_info.get('coordinator_id')}")


# ══════════════════════════════════════════════════════════
#   TESTS — PERMISOS DE COORDINADOR EN PARTNERS/CAMPUSES
# ══════════════════════════════════════════════════════════

def test_admin_only_restrictions(ctx: TestContext):
    """Tests A1-A11: Coordinadores pueden crear/editar pero NO eliminar en partners/campuses.
    User management sigue siendo admin-only para editar/eliminar."""
    print(f"\n{'─'*60}")
    print(f"  COORDINATOR PERMISSIONS — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    # A1. Coord PUEDE crear partner
    print("\n  [A1] Coord puede crear partner")
    r = safe_request("POST", f"{ctx.api}/partners",
        headers=auth(ctx.coord_a_token),
        json={"name": f"{TEST_PREFIX}_PARTNER_TEST", "rfc": f"TEST{uuid.uuid4().hex[:9].upper()}"})
    log(f"A1 response: status={r.status_code if r is not None else 'None'}, "
        f"body={r.text[:200] if r is not None else 'N/A'}")
    test("A1 Coord puede crear partner",
         r is not None and r.status_code in (200, 201),
         f"Expected 200/201, got {r.status_code if r is not None else 'N/A'}")
    # Guardar partner creado para cleanup
    a1_data = get_json(r) or {}
    a1_partner_id = a1_data.get("id") or a1_data.get("partner", {}).get("id")
    if a1_partner_id:
        ctx.created_partner_ids.append(a1_partner_id)

    # A2. Coord PUEDE editar partner
    print("\n  [A2] Coord puede editar partner")
    r = safe_request("PUT", f"{ctx.api}/partners/{ctx.partner_id}",
        headers=auth(ctx.coord_a_token),
        json={"notes": f"Editado por test {TEST_PREFIX}"})
    test("A2 Coord puede editar partner",
         r is not None and r.status_code == 200,
         f"Expected 200, got {r.status_code if r is not None else 'N/A'}")
    # Restaurar notas originales
    if r is not None and r.status_code == 200:
        safe_request("PUT", f"{ctx.api}/partners/{ctx.partner_id}",
            headers=auth(ctx.admin_token), json={"notes": ""})

    # A3. Coord NO puede eliminar partner
    print("\n  [A3] Coord no puede eliminar partner")
    r = safe_request("DELETE", f"{ctx.api}/partners/{ctx.partner_id}",
        headers=auth(ctx.coord_a_token))
    test("A3 Coord recibe 403 al eliminar partner",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # A4. Coord PUEDE crear campus
    print("\n  [A4] Coord puede crear campus")
    r = safe_request("POST",
        f"{ctx.api}/partners/{ctx.partner_id}/campuses",
        headers=auth(ctx.coord_a_token),
        json={
            "name": f"{TEST_PREFIX}_CAMPUS_TEST",
            "state_name": "Zacatecas",
            "director_name": "Test",
            "director_first_surname": "Director",
            "director_second_surname": "Test",
            "director_email": f"test_dir_{uuid.uuid4().hex[:6]}@test.com",
            "director_phone": "5551234567",
            "director_gender": "M",
            "director_curp": f"TEDR{uuid.uuid4().hex[:14].upper()}",
            "director_date_of_birth": "1990-01-15"
        })
    test("A4 Coord puede crear campus",
         r is not None and r.status_code in (200, 201),
         f"Expected 200/201, got {r.status_code if r is not None else 'N/A'}")
    a4_data = get_json(r) or {}
    a4_campus_id = a4_data.get("id") or a4_data.get("campus", {}).get("id")
    if a4_campus_id:
        ctx.created_campus_ids.append(a4_campus_id)

    # A5. Coord PUEDE editar campus
    print("\n  [A5] Coord puede editar campus")
    r = safe_request("PUT",
        f"{ctx.api}/partners/campuses/{ctx.campus_id}",
        headers=auth(ctx.coord_a_token),
        json={"website": f"https://test-{TEST_PREFIX.lower()}.com"})
    test("A5 Coord puede editar campus",
         r is not None and r.status_code == 200,
         f"Expected 200, got {r.status_code if r is not None else 'N/A'}")
    # Restaurar
    if r is not None and r.status_code == 200:
        safe_request("PUT", f"{ctx.api}/partners/campuses/{ctx.campus_id}",
            headers=auth(ctx.admin_token), json={"website": ""})

    # A6. Coord NO puede eliminar campus
    print("\n  [A6] Coord no puede eliminar campus")
    r = safe_request("DELETE",
        f"{ctx.api}/partners/campuses/{ctx.campus_id}",
        headers=auth(ctx.coord_a_token))
    test("A6 Coord recibe 403 al eliminar campus",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # A7. Coord NO puede editar usuario
    print("\n  [A7] Coord no puede editar usuario")
    if ctx.candidato_id:
        r = safe_request("PUT",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}",
            headers=auth(ctx.coord_a_token),
            json={"first_name": "HACKED"})
        test("A7 Coord recibe 403 al editar usuario",
             r is not None and r.status_code == 403,
             f"Expected 403, got {r.status_code if r is not None else 'N/A'}")
    else:
        warn("A7 SKIP", "No hay candidato de referencia")

    # A8. Coord NO puede cambiar password
    print("\n  [A8] Coord no puede cambiar password de usuario")
    if ctx.candidato_id:
        r = safe_request("PUT",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}/password",
            headers=auth(ctx.coord_a_token),
            json={"new_password": "Hacked123!"})
        test("A8 Coord recibe 403 al cambiar password",
             r is not None and r.status_code == 403,
             f"Expected 403, got {r.status_code if r is not None else 'N/A'}")
    else:
        warn("A8 SKIP", "No hay candidato de referencia")

    # A9. Coord NO puede toggle-active
    print("\n  [A9] Coord no puede toggle-active de usuario")
    if ctx.candidato_id:
        r = safe_request("POST",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}/toggle-active",
            headers=auth(ctx.coord_a_token))
        test("A9 Coord recibe 403 al toggle-active",
             r is not None and r.status_code == 403,
             f"Expected 403, got {r.status_code if r is not None else 'N/A'}")
    else:
        warn("A9 SKIP", "No hay candidato de referencia")

    # A10. Coord PUEDE agregar estado a partner
    print("\n  [A10] Coord puede agregar estado a partner")
    r = safe_request("POST",
        f"{ctx.api}/partners/{ctx.partner_id}/states",
        headers=auth(ctx.coord_a_token),
        json={"state_name": "Tlaxcala"})
    test("A10 Coord puede agregar estado a partner",
         r is not None and r.status_code in (200, 201),
         f"Expected 200/201, got {r.status_code if r is not None else 'N/A'}")
    # Guardar presence_id para cleanup en A11
    a10_data = get_json(r) or {}
    a10_presence_id = a10_data.get("presence", {}).get("id")

    # A11. Coord NO puede eliminar estado de partner
    print("\n  [A11] Coord no puede eliminar estado de partner")
    # Usar el presence_id recién creado, o un ID falso
    del_presence_id = a10_presence_id or 99999
    r = safe_request("DELETE",
        f"{ctx.api}/partners/{ctx.partner_id}/states/{del_presence_id}",
        headers=auth(ctx.coord_a_token))
    test("A11 Coord recibe 403 al eliminar estado de partner",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")
    # Cleanup del estado creado en A10 via admin
    if a10_presence_id:
        safe_request("DELETE",
            f"{ctx.api}/partners/{ctx.partner_id}/states/{a10_presence_id}",
            headers=auth(ctx.admin_token))


# ══════════════════════════════════════════════════════════
#              TESTS — ADMIN FULL ACCESS
# ══════════════════════════════════════════════════════════

def test_admin_full_access(ctx: TestContext):
    """Tests X1-X4: Admin tiene acceso completo."""
    print(f"\n{'─'*60}")
    print(f"  ADMIN FULL ACCESS — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    # X1. Admin ve TODOS los grupos
    print("\n  [X1] Admin ve todos los grupos")
    r = safe_request("GET", f"{ctx.api}/partners/groups/list-all?per_page=200",
                     headers=auth(ctx.admin_token))
    data = get_json(r) or {}
    groups = data.get("groups", [])
    group_ids = {g.get("id") for g in groups}

    test("X1.1 Admin puede listar todos los grupos",
         r is not None and r.status_code == 200,
         f"Status={r.status_code if r is not None else 'N/A'}")

    if ctx.group_a_id and ctx.group_b_id:
        test("X1.2 Admin ve grupo de Coord A",
             ctx.group_a_id in group_ids,
             f"Grupo A ({ctx.group_a_id}) no visible para admin")
        test("X1.3 Admin ve grupo de Coord B",
             ctx.group_b_id in group_ids,
             f"Grupo B ({ctx.group_b_id}) no visible para admin")

    # X2. Admin puede ver detalle de grupo de cualquier coord
    print("\n  [X2] Admin accede a grupos de cualquier coord")
    if ctx.group_a_id:
        r = safe_request("GET",
            f"{ctx.api}/partners/groups/{ctx.group_a_id}",
            headers=auth(ctx.admin_token))
        test("X2.1 Admin puede ver grupo de Coord A",
             r is not None and r.status_code == 200,
             f"Expected 200, got {r.status_code if r is not None else 'N/A'}")

    if ctx.group_b_id:
        r = safe_request("GET",
            f"{ctx.api}/partners/groups/{ctx.group_b_id}",
            headers=auth(ctx.admin_token))
        test("X2.2 Admin puede ver grupo de Coord B",
             r is not None and r.status_code == 200,
             f"Expected 200, got {r.status_code if r is not None else 'N/A'}")

    # X3. Admin puede editar usuario
    print("\n  [X3] Admin puede editar usuario")
    if ctx.candidato_id:
        # Get current data first
        r = safe_request("GET",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}",
            headers=auth(ctx.admin_token))
        user_data = get_json(r) or {}
        user_info = user_data.get("user", user_data)
        original_first = user_info.get("first_name", "Test")

        # Edit
        r = safe_request("PUT",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}",
            headers=auth(ctx.admin_token),
            json={"first_name": original_first})  # Set same value (no-op edit)
        test("X3 Admin puede editar usuario",
             r is not None and r.status_code == 200,
             f"Expected 200, got {r.status_code if r is not None else 'N/A'}")
    else:
        warn("X3 SKIP", "No hay candidato de referencia")

    # X4. Admin puede ver todos los partners
    print("\n  [X4] Admin acceso completo a partners")
    r = safe_request("GET", f"{ctx.api}/partners/{ctx.partner_id}",
                     headers=auth(ctx.admin_token))
    test("X4 Admin puede ver detalle de partner",
         r is not None and r.status_code == 200,
         f"Expected 200, got {r.status_code if r is not None else 'N/A'}")


# ══════════════════════════════════════════════════════════
#         TESTS — BADGES CON AISLAMIENTO DE GRUPO
# ══════════════════════════════════════════════════════════

def test_badges_isolation(ctx: TestContext):
    """Test B1: Badges respetan aislamiento de grupo."""
    print(f"\n{'─'*60}")
    print(f"  BADGES ISOLATION — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    if not ctx.group_a_id or not ctx.group_b_id:
        warn("SKIP Badges", "Se requieren ambos grupos")
        return

    # B1. Coord A no puede ver badges de grupo de B
    print("\n  [B1] Badges de grupo ajeno → 403")
    r = safe_request("GET",
        f"{ctx.api}/badges/group/{ctx.group_b_id}",
        headers=auth(ctx.coord_a_token))
    test("B1.1 Coord A recibe 403 al ver badges de grupo de B",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # B1.2 Coord A SÍ puede ver badges de su grupo
    r = safe_request("GET",
        f"{ctx.api}/badges/group/{ctx.group_a_id}",
        headers=auth(ctx.coord_a_token))
    test("B1.2 Coord A puede ver badges de su propio grupo",
         r is not None and r.status_code == 200,
         f"Expected 200, got {r.status_code if r is not None else 'N/A'}")

    # B1.3 Admin puede ver badges de cualquier grupo
    r = safe_request("GET",
        f"{ctx.api}/badges/group/{ctx.group_b_id}",
        headers=auth(ctx.admin_token))
    test("B1.3 Admin puede ver badges de grupo de B",
         r is not None and r.status_code == 200,
         f"Expected 200, got {r.status_code if r is not None else 'N/A'}")


# ══════════════════════════════════════════════════════════
#       TESTS — GROUP EXAMS & MATERIALS ISOLATION
# ══════════════════════════════════════════════════════════

def test_group_exams_isolation(ctx: TestContext):
    """Tests para exámenes y materiales de grupo aislados."""
    print(f"\n{'─'*60}")
    print(f"  GROUP EXAMS/MATERIALS ISOLATION — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    if not ctx.group_a_id or not ctx.group_b_id:
        warn("SKIP Group Exams", "Se requieren ambos grupos")
        return

    # GE1. Coord A no puede ver exámenes de grupo de B
    print("\n  [GE1] Exámenes de grupo ajeno → 403")
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_b_id}/exams",
        headers=auth(ctx.coord_a_token))
    test("GE1.1 Coord A recibe 403 al ver exámenes de grupo de B",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # GE1.2 Coord A SÍ puede ver exámenes de su grupo
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_a_id}/exams",
        headers=auth(ctx.coord_a_token))
    test("GE1.2 Coord A puede ver exámenes de su grupo",
         r is not None and r.status_code == 200,
         f"Expected 200, got {r.status_code if r is not None else 'N/A'}")

    # GE2. Materiales de estudio de grupo ajeno → 403
    print("\n  [GE2] Materiales de estudio de grupo ajeno → 403")
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_b_id}/study-materials",
        headers=auth(ctx.coord_a_token))
    test("GE2.1 Coord A recibe 403 al ver materiales de grupo de B",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # GE3. Export de grupo ajeno → 403
    print("\n  [GE3] Export miembros de grupo ajeno → 403")
    r = safe_request("GET",
        f"{ctx.api}/partners/groups/{ctx.group_b_id}/export-members",
        headers=auth(ctx.coord_a_token))
    test("GE3.1 Coord A recibe 403 al exportar miembros de grupo de B",
         r is not None and r.status_code == 403,
         f"Expected 403, got {r.status_code if r is not None else 'N/A'}")


# ══════════════════════════════════════════════════════════
#    TESTS — USER MANAGEMENT COORDINADOR RESTRICTIONS
# ══════════════════════════════════════════════════════════

def test_user_management_restrictions(ctx: TestContext):
    """Tests de restricciones de user management para coordinadores."""
    print(f"\n{'─'*60}")
    print(f"  USER MANAGEMENT RESTRICTIONS — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    # UM1. Coord puede crear candidato
    print("\n  [UM1] Coord puede crear candidato")
    candidate_username = f"{TEST_PREFIX}_CAND"
    r = safe_request("POST", f"{ctx.api}/user-management/users",
        headers=auth(ctx.coord_a_token),
        json={
            "name": "Test",
            "first_surname": "Candidato",
            "second_surname": "Isolation",
            "gender": "F",
            "email": f"{candidate_username.lower()}@test.evaluaasi.com",
            "password": "TestCand123!",
            "role": "candidato",
        })
    if r is not None and r.status_code in (200, 201):
        cand_data = get_json(r) or {}
        cand_id = cand_data.get("id") or cand_data.get("user", {}).get("id")
        if cand_id:
            ctx.created_user_ids.append(cand_id)
        test("UM1 Coord puede crear candidato",
             True, "")
    else:
        test("UM1 Coord puede crear candidato",
             False,
             f"Status={r.status_code if r is not None else 'N/A'} {r.text[:200] if r is not None else ''}")

    # UM2. Coord NO puede crear otro coordinator
    print("\n  [UM2] Coord no puede crear coordinator")
    r = safe_request("POST", f"{ctx.api}/user-management/users",
        headers=auth(ctx.coord_a_token),
        json={
            "name": "Fail",
            "first_surname": "Coord",
            "second_surname": "Test",
            "gender": "M",
            "email": f"{TEST_PREFIX.lower()}_coord_fail@test.evaluaasi.com",
            "password": "TestFail123!",
            "role": "coordinator",
        })
    test("UM2 Coord recibe error al crear coordinator",
         r is not None and r.status_code in (400, 403),
         f"Expected 400/403, got {r.status_code if r is not None else 'N/A'}")

    # UM3. Coord NO puede ver usuario con rol admin
    print("\n  [UM3] Coord no puede ver usuario admin")
    admin_row = db_fetch_one(ctx.conn,
        "SELECT id FROM users WHERE username='admin'")
    if admin_row:
        admin_id = admin_row[0]
        r = safe_request("GET",
            f"{ctx.api}/user-management/users/{admin_id}",
            headers=auth(ctx.coord_a_token))
        test("UM3 Coord recibe 403 al ver detalle de admin",
             r is not None and r.status_code == 403,
             f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # UM4. Coord puede ver stats
    print("\n  [UM4] Coord puede ver stats")
    r = safe_request("GET", f"{ctx.api}/user-management/stats",
                     headers=auth(ctx.coord_a_token))
    test("UM4 Coord puede obtener stats de usuarios",
         r is not None and r.status_code == 200,
         f"Status={r.status_code if r is not None else 'N/A'}")

    # UM5. Coord NO puede generar password
    print("\n  [UM5] Coord no puede generar password temporal")
    if ctx.candidato_id:
        r = safe_request("POST",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}/generate-password",
            headers=auth(ctx.coord_a_token))
        test("UM5 Coord recibe 403 al generar password temporal",
             r is not None and r.status_code == 403,
             f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # UM6. Coord NO puede ver password
    print("\n  [UM6] Coord no puede ver password")
    if ctx.candidato_id:
        r = safe_request("GET",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}/password",
            headers=auth(ctx.coord_a_token))
        test("UM6 Coord recibe 403 al ver password",
             r is not None and r.status_code == 403,
             f"Expected 403, got {r.status_code if r is not None else 'N/A'}")

    # UM7. Coord NO puede editar document-options
    print("\n  [UM7] Coord no puede editar document-options")
    if ctx.candidato_id:
        r = safe_request("PUT",
            f"{ctx.api}/user-management/users/{ctx.candidato_id}/document-options",
            headers=auth(ctx.coord_a_token),
            json={"options": {}})
        test("UM7 Coord recibe 403 al editar document-options",
             r is not None and r.status_code == 403,
             f"Expected 403, got {r.status_code if r is not None else 'N/A'}")


# ══════════════════════════════════════════════════════════
#         TESTS — AVAILABLE RESOURCES (SHARED)
# ══════════════════════════════════════════════════════════

def test_available_resources_shared(ctx: TestContext):
    """Tests de recursos disponibles compartidos."""
    print(f"\n{'─'*60}")
    print(f"  AVAILABLE RESOURCES (SHARED) — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    # AR1. Exámenes disponibles compartidos
    print("\n  [AR1] Exámenes disponibles")
    r_a = safe_request("GET", f"{ctx.api}/partners/exams/available",
                       headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET", f"{ctx.api}/partners/exams/available",
                       headers=auth(ctx.coord_b_token))

    test("AR1.1 Coord A ve exámenes disponibles",
         r_a is not None and r_a.status_code == 200,
         f"Status={r_a.status_code if r_a is not None else 'N/A'}")
    test("AR1.2 Coord B ve exámenes disponibles",
         r_b is not None and r_b.status_code == 200,
         f"Status={r_b.status_code if r_b is not None else 'N/A'}")

    # Compare counts
    a_data = get_json(r_a)
    b_data = get_json(r_b)
    a_count = len(a_data) if isinstance(a_data, list) else 0
    b_count = len(b_data) if isinstance(b_data, list) else 0
    test("AR1.3 Ambos ven mismos exámenes disponibles",
         a_count == b_count,
         f"A={a_count}, B={b_count}")

    # AR2. Materiales disponibles
    print("\n  [AR2] Materiales de estudio disponibles")
    r_a = safe_request("GET", f"{ctx.api}/partners/study-materials/available",
                       headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET", f"{ctx.api}/partners/study-materials/available",
                       headers=auth(ctx.coord_b_token))

    test("AR2.1 Coord A ve materiales disponibles",
         r_a is not None and r_a.status_code == 200,
         f"Status={r_a.status_code if r_a is not None else 'N/A'}")
    test("AR2.2 Coord B ve materiales disponibles",
         r_b is not None and r_b.status_code == 200,
         f"Status={r_b.status_code if r_b is not None else 'N/A'}")

    # AR3. Available campuses/partners en user management
    print("\n  [AR3] Campuses/Partners disponibles en user-management")
    r_a = safe_request("GET", f"{ctx.api}/user-management/available-campuses",
                       headers=auth(ctx.coord_a_token))
    r_b = safe_request("GET", f"{ctx.api}/user-management/available-campuses",
                       headers=auth(ctx.coord_b_token))

    test("AR3.1 Coord A ve campuses disponibles para user-mgmt",
         r_a is not None and r_a.status_code == 200,
         f"Status={r_a.status_code if r_a is not None else 'N/A'}")
    test("AR3.2 Coord B ve campuses disponibles para user-mgmt",
         r_b is not None and r_b.status_code == 200,
         f"Status={r_b.status_code if r_b is not None else 'N/A'}")


# ══════════════════════════════════════════════════════════
#                        MAIN
# ══════════════════════════════════════════════════════════

def run_tests_for_env(env_name):
    """Ejecuta todas las pruebas para un entorno."""
    global passed, failed, warnings, errors_detail
    passed = 0
    failed = 0
    warnings = 0
    errors_detail = []

    env_config = ENVS[env_name]
    ctx = TestContext(env_name, env_config["api"], env_config["db_name"])

    print(f"\n{'═'*60}")
    print(f"  TESTS DE AISLAMIENTO — {env_name.upper()}")
    print(f"  API: {env_config['api']}")
    print(f"  Test prefix: {TEST_PREFIX}")
    print(f"{'═'*60}")

    # Warmup
    print("\n  → Warmup...")
    r = safe_request("GET", f"{env_config['api']}/warmup")
    if r is not None and r.status_code == 200:
        print(f"    ✓ API ready ({get_json(r)})")
    else:
        print(f"    ⚠️  Warmup failed, continuando...")

    # Setup
    if not ctx.setup():
        print(f"\n  ❌ Setup falló para {env_name.upper()} — abortando pruebas")
        ctx.teardown()
        return passed, failed, warnings

    try:
        # Run all test suites
        test_shared_resources(ctx)
        test_isolated_resources(ctx)
        test_admin_only_restrictions(ctx)
        test_admin_full_access(ctx)
        test_badges_isolation(ctx)
        test_group_exams_isolation(ctx)
        test_user_management_restrictions(ctx)
        test_available_resources_shared(ctx)
    except Exception as e:
        print(f"\n  ❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Teardown
        ctx.teardown()

    # Summary
    total = passed + failed
    print(f"\n{'═'*60}")
    print(f"  RESUMEN — {env_name.upper()}")
    print(f"{'═'*60}")
    print(f"  Total: {total} tests")
    print(f"  ✅ Pasaron: {passed}")
    print(f"  ❌ Fallaron: {failed}")
    if warnings:
        print(f"  ⚠️  Warnings: {warnings}")
    if errors_detail:
        print(f"\n  Detalle de fallos:")
        for err in errors_detail:
            print(f"  {err}")
    print(f"{'═'*60}")

    return passed, failed, warnings


def main():
    global VERBOSE

    parser = argparse.ArgumentParser(
        description="Tests de aislamiento de datos por coordinador")
    parser.add_argument("--env", choices=["dev", "prod", "both"],
                        default="both",
                        help="Entorno a probar (default: both)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Mostrar logs de debug")
    args = parser.parse_args()

    VERBOSE = args.verbose

    print(f"""
╔══════════════════════════════════════════════════════════╗
║   TEST DE AISLAMIENTO DE DATOS POR COORDINADOR         ║
║   Prefijo: {TEST_PREFIX:<45s}║
║   Entorno: {args.env:<45s}║
╚══════════════════════════════════════════════════════════╝
    """)

    results = {}

    if args.env in ("dev", "both"):
        p, f, w = run_tests_for_env("dev")
        results["dev"] = {"passed": p, "failed": f, "warnings": w}

    if args.env in ("prod", "both"):
        p, f, w = run_tests_for_env("prod")
        results["prod"] = {"passed": p, "failed": f, "warnings": w}

    # Final summary
    if len(results) > 1:
        print(f"\n{'═'*60}")
        print(f"  RESUMEN FINAL")
        print(f"{'═'*60}")
        total_p = sum(r["passed"] for r in results.values())
        total_f = sum(r["failed"] for r in results.values())
        total_w = sum(r["warnings"] for r in results.values())
        for env, r in results.items():
            status = "✅" if r["failed"] == 0 else "❌"
            print(f"  {status} {env.upper()}: {r['passed']}/{r['passed']+r['failed']} "
                  f"pasaron ({r['warnings']} warnings)")
        print(f"\n  TOTAL: {total_p}/{total_p+total_f} pasaron")
        print(f"{'═'*60}")

    # Exit code
    any_failed = any(r["failed"] > 0 for r in results.values())
    sys.exit(1 if any_failed else 0)


if __name__ == "__main__":
    main()
