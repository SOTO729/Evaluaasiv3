"""
Test integral del módulo Financiero (balance.py)

Verifica todos los endpoints del blueprint de saldos:
  1. Autenticación y permisos por rol
  2. Estadísticas de saldos (GET /stats)
  3. Solicitudes pendientes (GET /pending-requests)
  4. Detalle de solicitud (GET /requests/<id>)
  5. Coordinadores con saldos (GET /coordinators)
  6. Transacciones globales (GET /transactions)
  7. Saldo del coordinador (GET /my-balance)
  8. Solicitudes propias (GET /my-requests)
  9. Transacciones propias (GET /my-transactions)
 10. Historial de asignaciones (GET /assignment-history)
 11. Crear solicitud de saldo (POST /request)
 12. Revisión financiero – recomendar aprobar (PUT /requests/<id>/review)
 13. Revisión financiero – recomendar rechazar
 14. Revisión financiero – solicitar documentos
 15. Validaciones de revisión
 16. Aprobación final (PUT /requests/<id>/approve)
 17. Rechazo final (PUT /requests/<id>/reject)
 18. Solicitudes para aprobación (GET /requests-for-approval)
 19. Cancelar solicitud (PUT /requests/<id>/cancel)
 20. Delegación – listar financieros (GET /delegation/financieros)
 21. Delegación – toggle (PUT /delegation/financieros/<id>/toggle)
 22. Ajustes manuales (POST /adjustments)
 23. Crear solicitud batch (POST /request-batch)
 24. Actualizar adjuntos (PUT /request/<id>/attachments)
 25. Permisos incorrectos (sin token, rol inválido)

USO: python tests/test_financiero.py
"""
import sys
import requests as http
import json
import pymssql
import time

API = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
DB_SERVER = "evaluaasi-motorv2-sql.database.windows.net"
DB_USER = "evaluaasi_admin"
DB_PASS = "EvalAasi2024_newpwd!"
DB_NAME = "evaluaasi"

passed = 0
failed = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ {name}")
        passed += 1
    else:
        print(f"  ❌ {name} — {detail}")
        failed += 1


def get_token(username="admin", password="Admin123!"):
    """Login y devolver token. Reintenta una vez si falla por rate-limit."""
    r = http.post(f"{API}/auth/login", json={"username": username, "password": password})
    if r.status_code == 429:
        print(f"  ⏳ Rate limit, esperando 10s...")
        time.sleep(10)
        r = http.post(f"{API}/auth/login", json={"username": username, "password": password})
    if r.status_code == 200:
        return r.json().get("access_token")
    print(f"  ⚠️ Login fallido ({username}): {r.status_code} {r.text[:200]}")
    return None


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def db_query(sql, params=None):
    conn = pymssql.connect(server=DB_SERVER, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cursor = conn.cursor(as_dict=True)
    cursor.execute(sql, params or ())
    try:
        rows = cursor.fetchall()
    except:
        rows = []
    conn.close()
    return rows


def db_exec(sql, params=None):
    conn = pymssql.connect(server=DB_SERVER, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cursor = conn.cursor()
    cursor.execute(sql, params or ())
    conn.commit()
    conn.close()


# =========================================================
# Helpers para obtener IDs reales del sistema
# =========================================================

def find_coordinator_id():
    """Buscar un coordinador real activo."""
    rows = db_query("SELECT TOP 1 id FROM users WHERE role='coordinator' AND is_active=1")
    return rows[0]['id'] if rows else None


def find_campus_and_group(coordinator_id=None):
    """Buscar campus y grupo válido."""
    if coordinator_id:
        rows = db_query("""
            SELECT TOP 1 cg.id AS group_id, cg.campus_id
            FROM candidate_groups cg
            JOIN campuses c ON c.id = cg.campus_id
            WHERE c.is_active = 1
            ORDER BY cg.id DESC
        """)
    else:
        rows = db_query("""
            SELECT TOP 1 cg.id AS group_id, cg.campus_id
            FROM candidate_groups cg
            JOIN campuses c ON c.id = cg.campus_id
            WHERE c.is_active = 1
            ORDER BY cg.id DESC
        """)
    if rows:
        return rows[0]['campus_id'], rows[0]['group_id']
    return None, None


def find_financiero_id():
    """Buscar un financiero real activo."""
    rows = db_query("SELECT TOP 1 id FROM users WHERE role='financiero' AND is_active=1")
    return rows[0]['id'] if rows else None


# =========================================================
# TESTS
# =========================================================

def main():
    global passed, failed
    print("=" * 60)
    print("  TEST INTEGRAL — MÓDULO FINANCIERO (balance.py)")
    print("=" * 60)

    # ── Login como admin (tiene acceso a todos los endpoints) ──
    print("\n🔐 Obteniendo token admin...")
    token = get_token()
    if not token:
        print("❌ No se pudo obtener token admin. Abortando.")
        sys.exit(1)
    h = auth(token)

    # ── Datos de apoyo ──
    coord_id = find_coordinator_id()
    campus_id, group_id = find_campus_and_group()
    financiero_id = find_financiero_id()

    print(f"  📋 Coordinator ID: {coord_id}")
    print(f"  🏫 Campus ID: {campus_id}, Group ID: {group_id}")
    print(f"  💼 Financiero ID: {financiero_id}")

    # =============================================================
    # 1. GET /balance/stats  (financiero_required)
    # =============================================================
    print("\n── 1. GET /balance/stats ──")
    r = http.get(f"{API}/balance/stats", headers=h)
    test("stats retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("stats tiene totals", "totals" in data, str(data.keys()))
        test("stats tiene requests", "requests" in data, str(data.keys()))
        test("totals tiene current_balance", "current_balance" in data.get("totals", {}))
        test("requests tiene pending", "pending" in data.get("requests", {}))

    # =============================================================
    # 2. GET /balance/pending-requests  (financiero_required)
    # =============================================================
    print("\n── 2. GET /balance/pending-requests ──")
    r = http.get(f"{API}/balance/pending-requests?status=all&per_page=5", headers=h)
    test("pending-requests retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("tiene lista requests", isinstance(data.get("requests"), list))
        test("tiene total", "total" in data)
        test("tiene stats", "stats" in data)
        test("tiene pages", "pages" in data)

    # =============================================================
    # 3. GET /balance/requests/<id>  (detalle)
    # =============================================================
    print("\n── 3. GET /balance/requests/<id> (detalle) ──")
    # Buscar una solicitud existente
    existing = db_query("SELECT TOP 1 id FROM balance_requests ORDER BY id DESC")
    if existing:
        req_id = existing[0]['id']
        r = http.get(f"{API}/balance/requests/{req_id}", headers=h)
        test("detalle retorna 200", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            data = r.json()
            test("detalle tiene id", data.get("id") == req_id, f"id={data.get('id')}")
            test("detalle tiene amount_requested", "amount_requested" in data)
            test("detalle tiene status", "status" in data)
            test("detalle tiene attachments", "attachments" in data)
    else:
        print("  ⏭️  No hay solicitudes existentes, saltando test de detalle")

    # Detalle de ID inexistente
    r = http.get(f"{API}/balance/requests/999999", headers=h)
    test("detalle 404/500 para ID inexistente", r.status_code in [404, 500], f"status={r.status_code}")

    # =============================================================
    # 4. GET /balance/coordinators  (financiero_required)
    # =============================================================
    print("\n── 4. GET /balance/coordinators ──")
    r = http.get(f"{API}/balance/coordinators?per_page=5", headers=h)
    test("coordinators retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("tiene lista coordinators", isinstance(data.get("coordinators"), list))
        test("tiene total", "total" in data)

    # =============================================================
    # 5. GET /balance/transactions  (financiero_required)
    # =============================================================
    print("\n── 5. GET /balance/transactions ──")
    r = http.get(f"{API}/balance/transactions?per_page=5", headers=h)
    test("transactions retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("tiene lista transactions", isinstance(data.get("transactions"), list))
        test("tiene total", "total" in data)

    # =============================================================
    # 6. GET /balance/my-balance  (coordinator_required)
    # =============================================================
    print("\n── 6. GET /balance/my-balance ──")
    r = http.get(f"{API}/balance/my-balance", headers=h)
    # admin tiene acceso como coordinator_required lo permite
    test("my-balance retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("tiene balances o totals", "balances" in data or "totals" in data, str(data.keys()))

    # =============================================================
    # 7. GET /balance/my-requests  (coordinator_required)
    # =============================================================
    print("\n── 7. GET /balance/my-requests ──")
    r = http.get(f"{API}/balance/my-requests?per_page=5", headers=h)
    test("my-requests retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("tiene lista requests", isinstance(data.get("requests"), list))

    # =============================================================
    # 8. GET /balance/my-transactions  (coordinator_required)
    # =============================================================
    print("\n── 8. GET /balance/my-transactions ──")
    r = http.get(f"{API}/balance/my-transactions?per_page=5", headers=h)
    test("my-transactions retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("tiene lista transactions", isinstance(data.get("transactions"), list))

    # =============================================================
    # 9. GET /balance/assignment-history
    # =============================================================
    print("\n── 9. GET /balance/assignment-history ──")
    r = http.get(f"{API}/balance/assignment-history?per_page=5", headers=h)
    test("assignment-history retorna 200", r.status_code == 200, f"status={r.status_code}")

    # =============================================================
    # 10. POST /balance/request — Crear solicitud de saldo
    # =============================================================
    print("\n── 10. POST /balance/request (crear solicitud) ──")
    created_request_id = None
    if campus_id and group_id:
        payload = {
            "amount_requested": 150.00,
            "justification": "TEST - Solicitud de prueba automática",
            "campus_id": campus_id,
            "group_id": group_id,
            "request_type": "saldo"
        }
        r = http.post(f"{API}/balance/request", headers=h, json=payload)
        test("crear solicitud retorna 201", r.status_code == 201, f"status={r.status_code} {r.text[:200]}")
        if r.status_code == 201:
            data = r.json()
            created_request_id = data.get("request", {}).get("id")
            test("solicitud tiene id", created_request_id is not None)
            test("solicitud tiene message", "message" in data)
            test("monto es correcto", data.get("request", {}).get("amount_requested") == 150.0,
                 f"amount={data.get('request', {}).get('amount_requested')}")
    else:
        print("  ⏭️  No hay campus/grupo disponible, saltando creación de solicitud")

    # Validaciones de creación
    print("\n── 10b. Validaciones de creación ──")
    r = http.post(f"{API}/balance/request", headers=h, json={})
    test("crear sin datos retorna 400", r.status_code == 400, f"status={r.status_code}")

    r = http.post(f"{API}/balance/request", headers=h, json={
        "amount_requested": -10, "justification": "test", "campus_id": campus_id, "group_id": group_id
    })
    test("monto negativo retorna 400", r.status_code == 400, f"status={r.status_code}")

    r = http.post(f"{API}/balance/request", headers=h, json={
        "amount_requested": 100, "justification": "test", "campus_id": 999999, "group_id": group_id
    })
    test("campus inválido retorna 404", r.status_code == 404, f"status={r.status_code}")

    # =============================================================
    # 11. PUT /balance/requests/<id>/review — Recomendar aprobar
    # =============================================================
    print("\n── 11. PUT /requests/<id>/review — recomendar aprobar ──")
    review_request_id = None
    if created_request_id:
        # Primero probemos recomendar aprobar
        r = http.put(f"{API}/balance/requests/{created_request_id}/review", headers=h, json={
            "action": "recommend_approve",
            "recommended_amount": 150.00,
            "notes": "TEST - Aprobación recomendada por prueba automática"
        })
        test("recomendar aprobar retorna 200", r.status_code == 200, f"status={r.status_code} {r.text[:200]}")
        if r.status_code == 200:
            data = r.json()
            req_status = data.get("request", {}).get("status")
            test("status cambió a recommended_approve", req_status == "recommended_approve",
                 f"status={req_status}")
            review_request_id = created_request_id
    else:
        print("  ⏭️  No hay solicitud creada, saltando review")

    # =============================================================
    # 12. GET /balance/requests-for-approval  (approver_required)
    # =============================================================
    print("\n── 12. GET /balance/requests-for-approval ──")
    r = http.get(f"{API}/balance/requests-for-approval?per_page=5", headers=h)
    test("requests-for-approval retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("tiene lista requests", isinstance(data.get("requests"), list))
        test("tiene stats", "stats" in data)
        if review_request_id:
            ids = [rq.get("id") for rq in data.get("requests", [])]
            test("solicitud recomendada aparece en for-approval", review_request_id in ids,
                 f"ids={ids[:10]}")

    # =============================================================
    # 13. PUT /balance/requests/<id>/approve — Aprobación final
    # =============================================================
    print("\n── 13. PUT /requests/<id>/approve (aprobación final) ──")
    if review_request_id:
        r = http.put(f"{API}/balance/requests/{review_request_id}/approve", headers=h, json={
            "amount_approved": 120.00,
            "notes": "TEST - Aprobado por prueba automática"
        })
        test("aprobar retorna 200", r.status_code == 200, f"status={r.status_code} {r.text[:300]}")
        if r.status_code == 200:
            data = r.json()
            test("mensaje de aprobación", "aprobado" in data.get("message", "").lower() or "Saldo" in data.get("message", ""),
                 f"msg={data.get('message')}")
            test("retorna new_balance", "new_balance" in data)
            req_status = data.get("request", {}).get("status")
            test("status cambió a approved", req_status == "approved", f"status={req_status}")
    else:
        print("  ⏭️  No hay solicitud recomendada, saltando aprobación")

    # =============================================================
    # 14. Flujo completo: crear → recomendar rechazar → rechazar
    # =============================================================
    print("\n── 14. Flujo: crear → recomendar rechazar → rechazar ──")
    reject_request_id = None
    if campus_id and group_id:
        # Crear solicitud
        r = http.post(f"{API}/balance/request", headers=h, json={
            "amount_requested": 75.00,
            "justification": "TEST - Para rechazar",
            "campus_id": campus_id,
            "group_id": group_id,
            "request_type": "saldo"
        })
        if r.status_code == 201:
            reject_request_id = r.json().get("request", {}).get("id")

        if reject_request_id:
            # Recomendar rechazar
            r = http.put(f"{API}/balance/requests/{reject_request_id}/review", headers=h, json={
                "action": "recommend_reject",
                "notes": "TEST - No cumple requisitos (prueba automática)"
            })
            test("recomendar rechazar retorna 200", r.status_code == 200, f"status={r.status_code}")

            # Rechazar final
            r = http.put(f"{API}/balance/requests/{reject_request_id}/reject", headers=h, json={
                "notes": "TEST - Rechazado (prueba automática)"
            })
            test("rechazar retorna 200", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                data = r.json()
                req_status = data.get("request", {}).get("status")
                test("status cambió a rejected", req_status == "rejected", f"status={req_status}")

            # Intentar rechazar de nuevo (debe fallar)
            r = http.put(f"{API}/balance/requests/{reject_request_id}/reject", headers=h, json={
                "notes": "doble rechazo"
            })
            test("rechazar ya rechazado retorna 400", r.status_code == 400, f"status={r.status_code}")

    # =============================================================
    # 15. Validaciones de revisión
    # =============================================================
    print("\n── 15. Validaciones de revisión ──")
    # Revisar solicitud ya procesada
    if review_request_id:
        r = http.put(f"{API}/balance/requests/{review_request_id}/review", headers=h, json={
            "action": "recommend_approve"
        })
        test("revisar aprobada retorna 400", r.status_code == 400, f"status={r.status_code}")

    # Acción inválida
    val_req_id = None
    if campus_id and group_id:
        r = http.post(f"{API}/balance/request", headers=h, json={
            "amount_requested": 50.00,
            "justification": "TEST - Para validar",
            "campus_id": campus_id,
            "group_id": group_id,
        })
        if r.status_code == 201:
            val_req_id = r.json().get("request", {}).get("id")

        if val_req_id:
            # Acción inválida
            r = http.put(f"{API}/balance/requests/{val_req_id}/review", headers=h, json={
                "action": "invalid_action"
            })
            test("acción inválida retorna 400", r.status_code == 400, f"status={r.status_code}")

            # Recomendar rechazar sin notas
            r = http.put(f"{API}/balance/requests/{val_req_id}/review", headers=h, json={
                "action": "recommend_reject"
            })
            test("rechazar sin notas retorna 400", r.status_code == 400, f"status={r.status_code}")

    # Rechazar sin notas (approver endpoint)
    if val_req_id:
        # Primero recomendar para poder probar reject
        http.put(f"{API}/balance/requests/{val_req_id}/review", headers=h, json={
            "action": "recommend_approve",
            "recommended_amount": 50,
            "notes": "ok"
        })
        r = http.put(f"{API}/balance/requests/{val_req_id}/reject", headers=h, json={})
        test("rechazar sin notas (approver) retorna 400", r.status_code == 400, f"status={r.status_code}")

    # =============================================================
    # 16. PUT /balance/requests/<id>/cancel
    # =============================================================
    print("\n── 16. PUT /requests/<id>/cancel ──")
    cancel_req_id = None
    if campus_id and group_id:
        r = http.post(f"{API}/balance/request", headers=h, json={
            "amount_requested": 30.00,
            "justification": "TEST - Para cancelar",
            "campus_id": campus_id,
            "group_id": group_id,
        })
        if r.status_code == 201:
            cancel_req_id = r.json().get("request", {}).get("id")

        if cancel_req_id:
            r = http.put(f"{API}/balance/requests/{cancel_req_id}/cancel", headers=h, json={
                "reason": "TEST - Cancelación automática de prueba"
            })
            test("cancelar solicitud retorna 200", r.status_code == 200, f"status={r.status_code} {r.text[:200]}")
            if r.status_code == 200:
                data = r.json()
                req_status = data.get("request", {}).get("status")
                test("status cambió a cancelled", req_status == "cancelled", f"status={req_status}")

            # Cancelar ya cancelada
            r = http.put(f"{API}/balance/requests/{cancel_req_id}/cancel", headers=h, json={
                "reason": "doble cancel"
            })
            test("cancelar ya cancelada retorna 400", r.status_code == 400, f"status={r.status_code}")

    # =============================================================
    # 17. GET /balance/delegation/financieros (gerente_required)
    # =============================================================
    print("\n── 17. GET /balance/delegation/financieros ──")
    r = http.get(f"{API}/balance/delegation/financieros", headers=h)
    test("delegation/financieros retorna 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("tiene lista financieros", isinstance(data.get("financieros"), list))
        if data.get("financieros"):
            f0 = data["financieros"][0]
            test("financiero tiene id", "id" in f0)
            test("financiero tiene can_approve_balance", "can_approve_balance" in f0)

    # =============================================================
    # 18. PUT /balance/delegation/financieros/<id>/toggle
    # =============================================================
    print("\n── 18. PUT /delegation/financieros/<id>/toggle ──")
    if financiero_id:
        # Leer estado actual
        orig = db_query("SELECT can_approve_balance FROM users WHERE id=%s", (financiero_id,))
        orig_val = orig[0]['can_approve_balance'] if orig else False

        # Toggle ON
        r = http.put(f"{API}/balance/delegation/financieros/{financiero_id}/toggle", headers=h, json={
            "can_approve_balance": True
        })
        test("toggle delegación retorna 200", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            data = r.json()
            test("financiero retornado tiene can_approve_balance=true",
                 data.get("financiero", {}).get("can_approve_balance") == True)

        # Toggle OFF
        r = http.put(f"{API}/balance/delegation/financieros/{financiero_id}/toggle", headers=h, json={
            "can_approve_balance": False
        })
        test("toggle OFF retorna 200", r.status_code == 200, f"status={r.status_code}")

        # Restaurar valor original
        db_exec("UPDATE users SET can_approve_balance=%s WHERE id=%s",
                (1 if orig_val else 0, financiero_id))
    else:
        print("  ⏭️  No hay financiero disponible, saltando toggle")

    # Toggle con ID inexistente
    r = http.put(f"{API}/balance/delegation/financieros/nonexistent-id/toggle", headers=h, json={
        "can_approve_balance": True
    })
    test("toggle ID inexistente retorna 404", r.status_code == 404, f"status={r.status_code}")

    # =============================================================
    # 19. POST /balance/adjustments (approver_required)
    # =============================================================
    print("\n── 19. POST /balance/adjustments ──")
    if coord_id and group_id:
        r = http.post(f"{API}/balance/adjustments", headers=h, json={
            "coordinator_id": coord_id,
            "group_id": group_id,
            "amount": 25.00,
            "notes": "TEST - Ajuste de prueba automática (+25)"
        })
        test("ajuste positivo retorna 200", r.status_code == 200, f"status={r.status_code} {r.text[:200]}")
        if r.status_code == 200:
            data = r.json()
            test("retorna new_balance", "new_balance" in data)
            test("retorna transaction", "transaction" in data)

        # Ajuste negativo (devolución)
        r = http.post(f"{API}/balance/adjustments", headers=h, json={
            "coordinator_id": coord_id,
            "group_id": group_id,
            "amount": -25.00,
            "notes": "TEST - Reversa del ajuste de prueba (-25)"
        })
        test("ajuste negativo retorna 200", r.status_code == 200, f"status={r.status_code}")

    # Validaciones de ajuste
    r = http.post(f"{API}/balance/adjustments", headers=h, json={})
    test("ajuste sin datos retorna 400", r.status_code == 400, f"status={r.status_code}")

    r = http.post(f"{API}/balance/adjustments", headers=h, json={
        "coordinator_id": "nonexistent", "amount": 10, "notes": "test", "group_id": group_id
    })
    test("ajuste coord inexistente retorna 404", r.status_code == 404, f"status={r.status_code}")

    # =============================================================
    # 20. Flujo con solicitud tipo beca + request_docs
    # =============================================================
    print("\n── 20. Flujo beca + solicitar documentos ──")
    beca_req_id = None
    if campus_id and group_id:
        r = http.post(f"{API}/balance/request", headers=h, json={
            "amount_requested": 200.00,
            "justification": "TEST - Solicitud beca de prueba",
            "campus_id": campus_id,
            "group_id": group_id,
            "request_type": "beca"
        })
        if r.status_code == 201:
            beca_req_id = r.json().get("request", {}).get("id")
            test("crear solicitud beca retorna 201", True)

            # Solicitar documentos
            r = http.put(f"{API}/balance/requests/{beca_req_id}/review", headers=h, json={
                "action": "request_docs",
                "documentation_requested": "TEST - Comprobante de situación económica"
            })
            test("request_docs retorna 200", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                data = r.json()
                req_status = data.get("request", {}).get("status")
                test("status cambió a in_review", req_status == "in_review", f"status={req_status}")

            # Solicitar docs sin texto
            r2 = http.post(f"{API}/balance/request", headers=h, json={
                "amount_requested": 100, "justification": "test",
                "campus_id": campus_id, "group_id": group_id, "request_type": "beca"
            })
            if r2.status_code == 201:
                tmp_id = r2.json().get("request", {}).get("id")
                r3 = http.put(f"{API}/balance/requests/{tmp_id}/review", headers=h, json={
                    "action": "request_docs"
                })
                test("request_docs sin texto retorna 400", r3.status_code == 400, f"status={r3.status_code}")
                # Limpiar
                http.put(f"{API}/balance/requests/{tmp_id}/cancel", headers=h, json={"reason": "cleanup"})
    
    # =============================================================
    # 21. POST /balance/request-batch
    # =============================================================
    print("\n── 21. POST /balance/request-batch ──")
    if campus_id and group_id:
        r = http.post(f"{API}/balance/request-batch", headers=h, json={
            "justification": "TEST - Solicitud batch de prueba",
            "items": [
                {
                    "amount_requested": 60.00,
                    "campus_id": campus_id,
                    "group_id": group_id,
                    "request_type": "saldo"
                },
                {
                    "amount_requested": 80.00,
                    "campus_id": campus_id,
                    "group_id": group_id,
                    "request_type": "saldo"
                }
            ]
        })
        test("request-batch retorna 200 o 201", r.status_code in [200, 201], f"status={r.status_code} {r.text[:200]}")
        if r.status_code in [200, 201]:
            data = r.json()
            test("batch retorna requests", "requests" in data or "created" in data or "results" in data,
                 str(data.keys()))

    # =============================================================
    # 22. PUT /balance/request/<id>/attachments
    # =============================================================
    print("\n── 22. PUT /request/<id>/attachments ──")
    att_req_id = None
    if campus_id and group_id:
        r = http.post(f"{API}/balance/request", headers=h, json={
            "amount_requested": 40.00,
            "justification": "TEST - Para probar attachments",
            "campus_id": campus_id,
            "group_id": group_id,
        })
        if r.status_code == 201:
            att_req_id = r.json().get("request", {}).get("id")

        if att_req_id:
            r = http.put(f"{API}/balance/request/{att_req_id}/attachments", headers=h, json={
                "attachments": [
                    {"name": "test.pdf", "url": "https://example.com/test.pdf", "type": "pdf", "size": 1024}
                ]
            })
            test("actualizar attachments retorna 200", r.status_code == 200, f"status={r.status_code} {r.text[:200]}")
            if r.status_code == 200:
                data = r.json()
                test("retorna attachments", len(data.get("attachments", [])) == 1)

            # Verificar que el detalle muestra los adjuntos
            r = http.get(f"{API}/balance/requests/{att_req_id}", headers=h)
            if r.status_code == 200:
                data = r.json()
                test("detalle muestra attachments", len(data.get("attachments", [])) == 1)

    # =============================================================
    # 23. Permisos — sin token
    # =============================================================
    print("\n── 23. Permisos — sin token ──")
    r = http.get(f"{API}/balance/stats")
    test("stats sin token retorna 401 o 422", r.status_code in [401, 422], f"status={r.status_code}")

    r = http.get(f"{API}/balance/pending-requests")
    test("pending-requests sin token retorna 401 o 422", r.status_code in [401, 422], f"status={r.status_code}")

    r = http.get(f"{API}/balance/coordinators")
    test("coordinators sin token retorna 401 o 422", r.status_code in [401, 422], f"status={r.status_code}")

    # =============================================================
    # 24. Filtros de pending-requests
    # =============================================================
    print("\n── 24. Filtros de pending-requests ──")
    for status_val in ['pending', 'in_review', 'all_pending', 'all']:
        r = http.get(f"{API}/balance/pending-requests?status={status_val}&per_page=3", headers=h)
        test(f"pending-requests status={status_val} → 200", r.status_code == 200, f"status={r.status_code}")

    r = http.get(f"{API}/balance/pending-requests?type=beca&per_page=3", headers=h)
    test("pending-requests type=beca → 200", r.status_code == 200, f"status={r.status_code}")

    # =============================================================
    # 25. Verificar solicitud aprobada en DB
    # =============================================================
    print("\n── 25. Verificación en DB ──")
    if review_request_id:
        rows = db_query("SELECT status, amount_approved FROM balance_requests WHERE id=%s",
                        (review_request_id,))
        if rows:
            test("DB: status=approved", rows[0]['status'] == 'approved', f"status={rows[0]['status']}")
            test("DB: amount_approved=120", float(rows[0]['amount_approved']) == 120.0,
                 f"amount={rows[0]['amount_approved']}")
    if reject_request_id:
        rows = db_query("SELECT status FROM balance_requests WHERE id=%s", (reject_request_id,))
        if rows:
            test("DB: status=rejected", rows[0]['status'] == 'rejected', f"status={rows[0]['status']}")
    if cancel_req_id:
        rows = db_query("SELECT status FROM balance_requests WHERE id=%s", (cancel_req_id,))
        if rows:
            test("DB: status=cancelled", rows[0]['status'] == 'cancelled', f"status={rows[0]['status']}")

    # =============================================================
    # LIMPIEZA — Eliminar solicitudes de prueba
    # =============================================================
    print("\n🧹 Limpieza de solicitudes de prueba...")
    test_ids = [
        created_request_id, reject_request_id, cancel_req_id,
        beca_req_id, att_req_id, val_req_id
    ]
    test_ids = [i for i in test_ids if i is not None]

    if test_ids:
        # Primero eliminar transacciones relacionadas
        placeholders = ",".join(["%s"] * len(test_ids))
        db_exec(
            f"DELETE FROM balance_transactions WHERE reference_type='balance_request' AND reference_id IN ({placeholders})",
            tuple(test_ids)
        )
        # Luego eliminar solicitudes
        db_exec(f"DELETE FROM balance_requests WHERE id IN ({placeholders})", tuple(test_ids))

        # También batch requests
        db_exec(
            "DELETE FROM balance_requests WHERE justification LIKE 'TEST - Batch%'"
        )
        print(f"  🗑️  Eliminadas {len(test_ids)} solicitudes de prueba + batch")

    # =============================================================
    # RESUMEN
    # =============================================================
    print("\n" + "=" * 60)
    total = passed + failed
    print(f"  RESULTADO: {passed}/{total} tests pasaron")
    if failed > 0:
        print(f"  ⚠️  {failed} tests fallaron")
    else:
        print("  ✅ ¡Todos los tests pasaron!")
    print("=" * 60)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
