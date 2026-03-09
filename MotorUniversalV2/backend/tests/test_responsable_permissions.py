"""
Test integral de Permisos del Responsable
==========================================

Verifica que el rol 'responsable' con campus_id asignado:

ACCESO A MÓDULO DE USUARIOS:
  U1. Puede listar usuarios (solo ve candidatos de su plantel)
  U2. Puede ver detalle de candidato de su plantel
  U3. NO puede ver detalle de candidato de OTRO plantel
  U4. NO puede ver usuario con rol distinto a candidato
  U5. NO puede editar usuarios (403)
  U6. NO puede toggle-active usuarios (403)
  U7. Puede ver contraseña de candidato de su plantel
  U8. NO puede ver contraseña de candidato de otro plantel
  U9. User stats solo muestra candidatos

ACCESO A MÓDULO DE GRUPOS:
  G1. Puede listar grupos (solo de su plantel)
  G2. NO ve grupos de otro plantel en search
  G3. Puede ver detalle de grupo de su plantel
  G4. NO puede ver detalle de grupo de otro plantel (403)

ACCESO A PARTNERS/CAMPUS:
  P1. Puede acceder a su campus
  P2. NO puede acceder a campus de otro plantel (403)

RESPONSABLE SIN CAMPUS:
  N1. Responsable sin campus_id recibe 403 en user-management
  N2. Responsable sin campus_id recibe 403 en partners

USO:
  python tests/test_responsable_permissions.py [--env dev|prod|both] [--verbose]
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

TEST_PREFIX = f"RESPTEST_{uuid.uuid4().hex[:6].upper()}"

REQ_TIMEOUT = 120

passed = 0
failed = 0
warnings = 0
errors_detail = []

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


# ── Request session with retry ──
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

_session = requests.Session()
retries = Retry(total=3, backoff_factor=1, status_forcelist=[502, 503, 504],
                allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "PATCH"])
adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=10)
_session.mount("https://", adapter)
_session.mount("http://", adapter)


def safe_request(method, url, **kwargs):
    kwargs.setdefault("timeout", REQ_TIMEOUT)
    try:
        return _session.request(method, url, **kwargs)
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
    def __init__(self, env_name, api_url, db_name):
        self.env_name = env_name
        self.api = api_url
        self.db_name = db_name
        self.admin_token = None
        self.resp_token = None  # responsable with campus
        self.resp_no_campus_token = None  # responsable without campus
        self.resp_id = None
        self.resp_username = None
        self.resp_password = None
        self.resp_no_campus_id = None
        self.resp_no_campus_username = None
        self.resp_no_campus_password = None
        # Reference data
        self.partner_id = None
        self.campus_a_id = None  # campus assigned to responsable
        self.campus_b_id = None  # different campus
        self.group_a_id = None   # group in campus_a
        self.group_b_id = None   # group in campus_b
        self.candidato_a_id = None  # candidato in group_a (campus_a)
        self.candidato_b_id = None  # candidato in group_b (campus_b)
        self.coordinator_id = None  # reference coordinator
        self.coordinator_token = None
        self.coordinator_username = None
        # Cleanup
        self.created_user_ids = []
        self.created_group_ids = []
        self.created_partner_ids = []
        self.created_campus_ids = []
        self.conn = None

    def setup(self):
        print(f"\n{'='*60}")
        print(f"  SETUP — {self.env_name.upper()}")
        print(f"{'='*60}")

        # 1. Connect to DB
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

        # 3. Find or create a coordinator
        print("  → Buscando coordinador...")
        row = db_fetch_one(self.conn,
            "SELECT TOP 1 id, username FROM users WHERE role='coordinator' AND is_active=1")
        if row:
            self.coordinator_id = row[0]
            self.coordinator_username = row[1]
        else:
            cid, cpwd, cusr = self._create_user("coordinator", f"{TEST_PREFIX}_COORD")
            if cid:
                self.coordinator_id = cid
                self.coordinator_username = cusr
        if not self.coordinator_id:
            print("  ❌ No hay coordinador disponible")
            return False
        # Login coordinator
        r = safe_request("POST",
            f"{self.api}/user-management/users/{self.coordinator_id}/generate-password",
            headers=auth(self.admin_token))
        if r is not None and r.status_code == 200:
            coord_pwd = (get_json(r) or {}).get("password")
            if coord_pwd:
                self.coordinator_token = get_token(self.api, self.coordinator_username, coord_pwd)
        if not self.coordinator_token:
            warn("Coordinator login", "No se pudo loguear coordinador — algunos tests dependerán solo de admin")
        print(f"    ✓ Coordinator: {self.coordinator_username}")

        # 4. Ensure we have a partner
        print("  → Verificando partner...")
        row = db_fetch_one(self.conn, "SELECT TOP 1 id FROM partners WHERE is_active=1")
        if row:
            self.partner_id = row[0]
        else:
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

        # 5. Ensure two campuses (A and B)
        print("  → Verificando campuses...")
        rows = db_fetch_all(self.conn,
            "SELECT TOP 2 id FROM campuses WHERE is_active=1 AND partner_id=%s",
            (self.partner_id,))
        if len(rows) >= 2:
            self.campus_a_id = rows[0][0]
            self.campus_b_id = rows[1][0]
        elif len(rows) == 1:
            self.campus_a_id = rows[0][0]
            self.campus_b_id = self._create_campus(f"{TEST_PREFIX}_CampusB")
        else:
            self.campus_a_id = self._create_campus(f"{TEST_PREFIX}_CampusA")
            self.campus_b_id = self._create_campus(f"{TEST_PREFIX}_CampusB")
        if not self.campus_a_id or not self.campus_b_id:
            print("  ❌ No se pudieron crear 2 campuses")
            return False
        print(f"    ✓ Campus A: {self.campus_a_id}, Campus B: {self.campus_b_id}")

        # 6. Create groups in each campus (using coordinator or admin)
        print("  → Creando grupos en cada campus...")
        token_for_groups = self.coordinator_token or self.admin_token
        self.group_a_id = self._create_group(token_for_groups, self.campus_a_id, f"{TEST_PREFIX}_GRP_A")
        self.group_b_id = self._create_group(token_for_groups, self.campus_b_id, f"{TEST_PREFIX}_GRP_B")
        if not self.group_a_id or not self.group_b_id:
            print("  ❌ No se pudieron crear grupos de prueba")
            return False
        print(f"    ✓ Group A: {self.group_a_id} (campus_a), Group B: {self.group_b_id} (campus_b)")

        # 7. Create candidatos in each group
        print("  → Creando candidatos de prueba...")
        self.candidato_a_id = self._create_candidato_in_group(f"{TEST_PREFIX}_CAND_A", self.group_a_id)
        self.candidato_b_id = self._create_candidato_in_group(f"{TEST_PREFIX}_CAND_B", self.group_b_id)
        if not self.candidato_a_id:
            print("  ❌ No se pudo crear candidato A")
            return False
        if not self.candidato_b_id:
            print("  ❌ No se pudo crear candidato B")
            return False
        print(f"    ✓ Candidato A: {str(self.candidato_a_id)[:12]}... (group_a)")
        print(f"    ✓ Candidato B: {str(self.candidato_b_id)[:12]}... (group_b)")

        # 8. Create responsable WITH campus_a assigned
        print("  → Creando responsable con campus...")
        self.resp_id, self.resp_password, self.resp_username = self._create_user(
            "responsable", f"{TEST_PREFIX}_RESP", campus_id=self.campus_a_id
        )
        if not self.resp_id:
            print("  ❌ No se pudo crear responsable")
            return False
        self.resp_token = get_token(self.api, self.resp_username, self.resp_password)
        if not self.resp_token:
            # Try generate password
            r = safe_request("POST",
                f"{self.api}/user-management/users/{self.resp_id}/generate-password",
                headers=auth(self.admin_token))
            if r is not None and r.status_code == 200:
                self.resp_password = (get_json(r) or {}).get("password")
                if self.resp_password:
                    self.resp_token = get_token(self.api, self.resp_username, self.resp_password)
        if not self.resp_token:
            print("  ❌ No se pudo loguear responsable")
            return False
        print(f"    ✓ Responsable: {self.resp_username} (campus_a)")

        # 9. Create responsable WITHOUT campus (for N1/N2 tests)
        print("  → Creando responsable sin campus...")
        self.resp_no_campus_id, self.resp_no_campus_password, self.resp_no_campus_username = \
            self._create_user("responsable", f"{TEST_PREFIX}_RESP_NC")
        if not self.resp_no_campus_id:
            warn("Responsable sin campus", "No se pudo crear — tests N1/N2 se omitirán")
        else:
            self.resp_no_campus_token = get_token(
                self.api, self.resp_no_campus_username, self.resp_no_campus_password)
            if not self.resp_no_campus_token:
                r = safe_request("POST",
                    f"{self.api}/user-management/users/{self.resp_no_campus_id}/generate-password",
                    headers=auth(self.admin_token))
                if r is not None and r.status_code == 200:
                    self.resp_no_campus_password = (get_json(r) or {}).get("password")
                    if self.resp_no_campus_password:
                        self.resp_no_campus_token = get_token(
                            self.api, self.resp_no_campus_username, self.resp_no_campus_password)
            if self.resp_no_campus_token:
                print(f"    ✓ Responsable sin campus: {self.resp_no_campus_username}")
            else:
                warn("Responsable sin campus login", "No se pudo loguear")

        print(f"\n  ✓ Setup completado — {self.env_name.upper()}")
        return True

    def _create_user(self, role, display_name, campus_id=None):
        """Create a test user. Returns (id, password, username) or (None, None, None)."""
        payload = {
            "name": "Test",
            "first_surname": display_name,
            "second_surname": "Perm",
            "gender": "M",
            "email": f"{display_name.lower()}@test.evaluaasi.com",
            "role": role,
        }
        if campus_id:
            payload["campus_id"] = campus_id
        r = safe_request("POST", f"{self.api}/user-management/users",
                         headers=auth(self.admin_token), json=payload)
        if r is not None and r.status_code in (200, 201):
            data = get_json(r)
            user_data = data.get("user", {})
            uid = user_data.get("id") or data.get("id")
            temp_pwd = data.get("temporary_password")
            auto_username = user_data.get("username")
            if uid:
                self.created_user_ids.append(uid)
                return uid, temp_pwd, auto_username
            else:
                log(f"Create user response no ID: {data}")
        else:
            log(f"Create user failed: {r.status_code if r is not None else 'N/A'} "
                f"{r.text[:300] if r is not None else ''}")
        return None, None, None

    def _create_campus(self, name):
        r = safe_request("POST",
            f"{self.api}/partners/{self.partner_id}/campuses",
            headers=auth(self.admin_token),
            json={"name": name, "cct": f"T{uuid.uuid4().hex[:7].upper()}"})
        if r is not None and r.status_code in (200, 201):
            data = get_json(r)
            cid = data.get("id") or data.get("campus", {}).get("id")
            if cid:
                self.created_campus_ids.append(cid)
                return cid
        log(f"Create campus failed: {r.status_code if r is not None else 'N/A'}")
        return None

    def _create_group(self, token, campus_id, name):
        r = safe_request("POST",
            f"{self.api}/partners/campuses/{campus_id}/groups",
            headers=auth(token),
            json={"name": name, "description": f"Test group {name}"})
        if r is not None and r.status_code in (200, 201):
            data = get_json(r)
            gid = data.get("id") or data.get("group", {}).get("id")
            if gid:
                self.created_group_ids.append(gid)
                return gid
        log(f"Create group failed: {r.status_code if r is not None else 'N/A'} "
            f"{r.text[:300] if r is not None else ''}")
        return None

    def _create_candidato_in_group(self, display_name, group_id):
        """Create candidato and add to group."""
        uid, pwd, uname = self._create_user("candidato", display_name)
        if not uid:
            return None
        # Add to group
        r = safe_request("POST",
            f"{self.api}/user-management/candidates/assign-to-group",
            headers=auth(self.admin_token),
            json={"user_ids": [uid], "group_id": group_id})
        if r is None or r.status_code not in (200, 201):
            # Try via partners API
            r = safe_request("POST",
                f"{self.api}/partners/groups/{group_id}/members",
                headers=auth(self.admin_token),
                json={"user_id": uid})
            if r is None or r.status_code not in (200, 201):
                log(f"Add member to group failed: {r.status_code if r is not None else 'N/A'} "
                    f"{r.text[:300] if r is not None else ''}")
                # Try direct DB insert as fallback
                try:
                    db_exec(self.conn,
                        "INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)",
                        (group_id, uid))
                    self.conn.commit()
                    log(f"Added member {uid} to group {group_id} via DB")
                except Exception as e:
                    log(f"DB insert member failed: {e}")
                    return uid  # Return uid anyway, member tests may fail
        return uid

    def teardown(self):
        print(f"\n{'='*60}")
        print(f"  TEARDOWN — {self.env_name.upper()}")
        print(f"{'='*60}")

        if not self.conn:
            self.conn = db_connect(self.db_name)

        if self.conn:
            try:
                cur = self.conn.cursor()

                # Delete group members
                for gid in self.created_group_ids:
                    try:
                        cur.execute("DELETE FROM group_members WHERE group_id=%s", (gid,))
                    except Exception as e:
                        log(f"Error deleting group members for {gid}: {e}")

                # Delete groups
                for gid in self.created_group_ids:
                    try:
                        cur.execute("DELETE FROM candidate_groups WHERE id=%s", (gid,))
                        log(f"Deleted group {gid}")
                    except Exception as e:
                        log(f"Error deleting group {gid}: {e}")

                # Delete users
                for uid in self.created_user_ids:
                    try:
                        cur.execute("DELETE FROM group_members WHERE user_id=%s", (uid,))
                        cur.execute(
                            "UPDATE candidate_groups SET coordinator_id=NULL "
                            "WHERE coordinator_id=%s", (uid,))
                        cur.execute("DELETE FROM users WHERE id=%s", (uid,))
                        log(f"Deleted user {uid}")
                    except Exception as e:
                        log(f"Error deleting user {uid}: {e}")

                # Delete campuses
                for cid in self.created_campus_ids:
                    try:
                        cur.execute("DELETE FROM campuses WHERE id=%s", (cid,))
                        log(f"Deleted campus {cid}")
                    except Exception as e:
                        log(f"Error deleting campus {cid}: {e}")

                # Delete partners
                for pid in self.created_partner_ids:
                    try:
                        cur.execute("DELETE FROM partners WHERE id=%s", (pid,))
                        log(f"Deleted partner {pid}")
                    except Exception as e:
                        log(f"Error deleting partner {pid}: {e}")

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
            print("  ⚠️  No hay conexión DB para limpieza")
            print(f"    Prefijo: {TEST_PREFIX}")
            print(f"    Users: {self.created_user_ids}")
            print(f"    Groups: {self.created_group_ids}")


# ══════════════════════════════════════════════════════════
#          TESTS — USUARIOS (U1-U9)
# ══════════════════════════════════════════════════════════

def test_user_management(ctx: TestContext):
    print(f"\n{'─'*60}")
    print(f"  MÓDULO DE USUARIOS — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    # U1. Listar usuarios — solo ve candidatos
    print("\n  [U1] Listar usuarios (solo candidatos de su plantel)")
    r = safe_request("GET", f"{ctx.api}/user-management/users?per_page=100",
                     headers=auth(ctx.resp_token))
    test("U1.1 Responsable puede listar usuarios",
         r is not None and r.status_code == 200,
         f"Status: {r.status_code if r is not None else 'N/A'}")
    if r is not None and r.status_code == 200:
        data = get_json(r) or {}
        users = data.get("users", [])
        all_candidatos = all(u.get("role") == "candidato" for u in users)
        test("U1.2 Solo retorna candidatos",
             all_candidatos,
             f"Roles encontrados: {set(u.get('role') for u in users)}")
        # Check candidato_a is in the list (should be in campus_a)
        user_ids = [u.get("id") for u in users]
        test("U1.3 Ve candidato de su plantel",
             ctx.candidato_a_id in user_ids,
             f"Candidato A ({str(ctx.candidato_a_id)[:12]}) no encontrado en lista")
        test("U1.4 NO ve candidato de otro plantel",
             ctx.candidato_b_id not in user_ids,
             f"Candidato B ({str(ctx.candidato_b_id)[:12]}) SÍ aparece en lista")
    else:
        log(f"List users response: {r.text[:300] if r is not None else 'N/A'}")

    # U2. Ver detalle de candidato de su plantel
    print("\n  [U2] Detalle de candidato de su plantel")
    r = safe_request("GET", f"{ctx.api}/user-management/users/{ctx.candidato_a_id}",
                     headers=auth(ctx.resp_token))
    test("U2 Puede ver candidato de su plantel",
         r is not None and r.status_code == 200,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # U3. NO puede ver candidato de otro plantel
    print("\n  [U3] Detalle de candidato de OTRO plantel")
    r = safe_request("GET", f"{ctx.api}/user-management/users/{ctx.candidato_b_id}",
                     headers=auth(ctx.resp_token))
    test("U3 NO puede ver candidato de otro plantel (403)",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # U4. NO puede ver usuario con rol != candidato
    print("\n  [U4] Detalle de usuario no-candidato")
    r = safe_request("GET", f"{ctx.api}/user-management/users/{ctx.coordinator_id}",
                     headers=auth(ctx.resp_token))
    test("U4 NO puede ver coordinador (403)",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # U5. NO puede editar usuarios
    print("\n  [U5] Editar usuario")
    r = safe_request("PUT", f"{ctx.api}/user-management/users/{ctx.candidato_a_id}",
                     headers=auth(ctx.resp_token),
                     json={"name": "Modified"})
    test("U5 NO puede editar usuarios (403)",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # U6. NO puede toggle-active
    print("\n  [U6] Toggle active")
    r = safe_request("PATCH", f"{ctx.api}/user-management/users/{ctx.candidato_a_id}/toggle-active",
                     headers=auth(ctx.resp_token))
    test("U6 NO puede toggle-active (403)",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # U7. Puede ver contraseña de candidato de su plantel
    print("\n  [U7] Ver contraseña de candidato propio")
    r = safe_request("GET", f"{ctx.api}/user-management/users/{ctx.candidato_a_id}/password",
                     headers=auth(ctx.resp_token))
    test("U7 Puede ver contraseña de candidato de su plantel",
         r is not None and r.status_code in (200, 404),  # 404 if no stored password
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # U8. NO puede ver contraseña de candidato de otro plantel
    print("\n  [U8] Ver contraseña de candidato de otro plantel")
    r = safe_request("GET", f"{ctx.api}/user-management/users/{ctx.candidato_b_id}/password",
                     headers=auth(ctx.resp_token))
    test("U8 NO puede ver contraseña de candidato de otro plantel (403)",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # U9. Stats solo muestra candidatos
    print("\n  [U9] Estadísticas de usuarios")
    r = safe_request("GET", f"{ctx.api}/user-management/stats",
                     headers=auth(ctx.resp_token))
    test("U9.1 Puede obtener stats",
         r is not None and r.status_code == 200,
         f"Status: {r.status_code if r is not None else 'N/A'}")
    if r is not None and r.status_code == 200:
        data = get_json(r) or {}
        roles_in_stats = [item.get("role") for item in data.get("users_by_role", [])]
        test("U9.2 Stats solo tiene rol candidato",
             roles_in_stats == ["candidato"],
             f"Roles en stats: {roles_in_stats}")


# ══════════════════════════════════════════════════════════
#          TESTS — GRUPOS (G1-G4)
# ══════════════════════════════════════════════════════════

def test_groups(ctx: TestContext):
    print(f"\n{'─'*60}")
    print(f"  MÓDULO DE GRUPOS — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    # G1. Listar grupos — solo de su plantel
    print("\n  [G1] Listar grupos (search paginated)")
    r = safe_request("GET", f"{ctx.api}/partners/groups/search?per_page=100",
                     headers=auth(ctx.resp_token))
    test("G1.1 Puede listar grupos",
         r is not None and r.status_code == 200,
         f"Status: {r.status_code if r is not None else 'N/A'}")
    if r is not None and r.status_code == 200:
        data = get_json(r) or {}
        groups = data.get("groups", [])
        group_ids = [g.get("id") for g in groups]
        # All groups should belong to campus_a
        all_campus_a = all(g.get("campus_id") == ctx.campus_a_id for g in groups)
        test("G1.2 Todos los grupos son de su plantel",
             all_campus_a or len(groups) == 0,
             f"Groups campus_ids: {set(g.get('campus_id') for g in groups)}")
        # G2. Specific check: group_a is visible, group_b is not
        test("G1.3 Ve grupo de su plantel",
             ctx.group_a_id in group_ids,
             f"Group A ({ctx.group_a_id}) no encontrado")

    # G2. NO ve grupos de otro plantel
    print("\n  [G2] No ve grupos de otro plantel")
    if r is not None and r.status_code == 200:
        data = get_json(r) or {}
        groups = data.get("groups", [])
        group_ids = [g.get("id") for g in groups]
        test("G2 NO ve grupo de otro plantel",
             ctx.group_b_id not in group_ids,
             f"Group B ({ctx.group_b_id}) SÍ aparece en lista")

    # G3. Detalle grupo propio
    print("\n  [G3] Detalle de grupo de su plantel")
    r = safe_request("GET", f"{ctx.api}/partners/groups/{ctx.group_a_id}",
                     headers=auth(ctx.resp_token))
    test("G3 Puede ver grupo de su plantel",
         r is not None and r.status_code == 200,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # G4. NO puede ver grupo de otro plantel
    print("\n  [G4] Detalle de grupo de otro plantel")
    r = safe_request("GET", f"{ctx.api}/partners/groups/{ctx.group_b_id}",
                     headers=auth(ctx.resp_token))
    test("G4 NO puede ver grupo de otro plantel (403)",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")


# ══════════════════════════════════════════════════════════
#          TESTS — PARTNERS/CAMPUS (P1-P2)
# ══════════════════════════════════════════════════════════

def test_campus_access(ctx: TestContext):
    print(f"\n{'─'*60}")
    print(f"  ACCESO A CAMPUS — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    # P1. Puede acceder a su campus
    print("\n  [P1] Acceso a su campus")
    r = safe_request("GET", f"{ctx.api}/partners/campuses/{ctx.campus_a_id}",
                     headers=auth(ctx.resp_token))
    test("P1 Puede acceder a su campus",
         r is not None and r.status_code == 200,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # P2. NO puede acceder a campus de otro plantel
    print("\n  [P2] Acceso a campus ajeno")
    r = safe_request("GET", f"{ctx.api}/partners/campuses/{ctx.campus_b_id}",
                     headers=auth(ctx.resp_token))
    test("P2 NO puede acceder a campus ajeno (403)",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")


# ══════════════════════════════════════════════════════════
#     TESTS — RESPONSABLE SIN CAMPUS (N1-N2)
# ══════════════════════════════════════════════════════════

def test_no_campus(ctx: TestContext):
    print(f"\n{'─'*60}")
    print(f"  RESPONSABLE SIN CAMPUS — {ctx.env_name.upper()}")
    print(f"{'─'*60}")

    if not ctx.resp_no_campus_token:
        warn("N1-N2", "Sin token de responsable sin campus — se omiten tests")
        return

    # N1. 403 en user-management
    print("\n  [N1] User management sin campus")
    r = safe_request("GET", f"{ctx.api}/user-management/users",
                     headers=auth(ctx.resp_no_campus_token))
    test("N1 Responsable sin campus recibe 403 en user-management",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")

    # N2. 403 en partners (groups search)
    print("\n  [N2] Partners/groups sin campus")
    r = safe_request("GET", f"{ctx.api}/partners/groups/search",
                     headers=auth(ctx.resp_no_campus_token))
    test("N2 Responsable sin campus recibe 403 en partners/groups",
         r is not None and r.status_code == 403,
         f"Status: {r.status_code if r is not None else 'N/A'}")


# ══════════════════════════════════════════════════════════
#                       MAIN
# ══════════════════════════════════════════════════════════

def run_env(env_name):
    global passed, failed
    env = ENVS[env_name]
    ctx = TestContext(env_name, env["api"], env["db_name"])

    try:
        if not ctx.setup():
            print(f"\n  ❌ Setup fallido para {env_name.upper()}, abortando\n")
            return

        test_user_management(ctx)
        test_groups(ctx)
        test_campus_access(ctx)
        test_no_campus(ctx)

    finally:
        ctx.teardown()


def main():
    global VERBOSE
    parser = argparse.ArgumentParser(description="Test de permisos del responsable")
    parser.add_argument("--env", choices=["dev", "prod", "both"], default="dev",
                        help="Entorno a probar (default: dev)")
    parser.add_argument("--verbose", action="store_true", help="Mostrar debug info")
    args = parser.parse_args()
    VERBOSE = args.verbose

    print(f"\n{'═'*60}")
    print(f"  TEST PERMISOS DEL RESPONSABLE")
    print(f"  Prefijo: {TEST_PREFIX}")
    print(f"{'═'*60}")

    envs_to_test = ["dev", "prod"] if args.env == "both" else [args.env]

    for env_name in envs_to_test:
        run_env(env_name)

    # Summary
    print(f"\n{'═'*60}")
    print(f"  RESUMEN FINAL")
    print(f"{'═'*60}")
    print(f"  ✅ Pasaron: {passed}")
    print(f"  ❌ Fallaron: {failed}")
    if warnings:
        print(f"  ⚠️  Advertencias: {warnings}")
    if errors_detail:
        print(f"\n  Errores:")
        for e in errors_detail:
            print(f"  {e}")
    print()

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
