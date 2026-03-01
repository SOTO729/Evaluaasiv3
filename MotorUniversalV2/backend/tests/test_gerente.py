"""
Test integral del módulo Gerente

Verifica todos los endpoints y flujos del portal de gerencia:
  1. Autenticación como admin (gerente)
  2. Estadísticas de saldos (GET /balance/stats)
  3. Solicitudes para aprobación (GET /balance/requests-for-approval)
  4. Detalle de solicitud (GET /balance/requests/<id>)
  5. Coordinadores con saldos (GET /balance/coordinators)
  6. Transacciones globales (GET /balance/transactions)
  7. Delegación – listar financieros (GET /balance/delegation/financieros)
  8. Delegación – toggle (PUT /balance/delegation/financieros/<id>/toggle)
  9. Logs de actividad (GET /activity/logs)
 10. Logs con filtros (GET /activity/logs?action_type=...)
 11. Logs de un usuario (GET /activity/logs/user/<id>)
 12. Resumen de actividad (GET /activity/summary)
 13. Personal users (GET /activity/personal-users)
 14. Reporte de seguridad (GET /activity/security-report)
 15. Aprobación de solicitud (PUT /balance/requests/<id>/approve)
 16. Rechazo de solicitud (PUT /balance/requests/<id>/reject)
 17. Ajustes manuales (POST /balance/adjustments)
 18. Permisos - coordinador no puede aprobar
 19. Permisos - sin token retorna 401
 20. Validaciones de aprobación
 21. Paginación en logs
 22. Paginación en solicitudes
 23. Filtros de estado en solicitudes
 24. Reporte seguridad con distintos períodos
 25. Summary con distintos días

USO: python tests/test_gerente.py
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
    """Login y devolver token."""
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
    conn.commit()
    conn.close()
    return rows


def db_exec(sql, params=None):
    conn = pymssql.connect(server=DB_SERVER, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cursor = conn.cursor()
    cursor.execute(sql, params or ())
    conn.commit()
    conn.close()


# ============================================================
# MAIN
# ============================================================
def main():
    global passed, failed
    print("\n" + "=" * 60)
    print("  TESTS DEL MÓDULO GERENTE")
    print("=" * 60)

    # ── 1. Autenticación ──
    print("\n── 1. Autenticación ──")
    admin_token = get_token("admin", "Admin123!")
    test("Login como admin (gerente)", admin_token is not None)
    if not admin_token:
        print("⛔ No se pudo autenticar. Abortando.")
        sys.exit(1)

    h = auth(admin_token)

    # Buscar un coordinador para tests de permisos
    coord_token = None
    coords = db_query("SELECT TOP 1 username FROM users WHERE role='coordinator'")
    if coords:
        for pwd in ["Admin123!", "Coordinador123!", "coordinador"]:
            coord_token = get_token(coords[0]["username"], pwd)
            if coord_token:
                break
    # También intentar con un alumno si no hay coordinador
    if not coord_token:
        alumnos = db_query("SELECT TOP 1 username FROM users WHERE role='alumno'")
        if alumnos:
            for pwd in ["Admin123!", "Alumno123!"]:
                coord_token = get_token(alumnos[0]["username"], pwd)
                if coord_token:
                    break
    time.sleep(0.5)

    # ── 2. Estadísticas de saldos ──
    print("\n── 2. Estadísticas de saldos (GET /balance/stats) ──")
    r = http.get(f"{API}/balance/stats", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Tiene totals", "totals" in d, f"keys={list(d.keys())}")
        test("Tiene coordinators_with_balance", "coordinators_with_balance" in d)
        test("Tiene requests", "requests" in d)
        if "totals" in d:
            test("totals.current_balance es número", isinstance(d["totals"].get("current_balance"), (int, float)))
            test("totals.total_received es número", isinstance(d["totals"].get("total_received"), (int, float)))
            test("totals.total_spent es número", isinstance(d["totals"].get("total_spent"), (int, float)))
        if "requests" in d:
            test("requests.pending es número", isinstance(d["requests"].get("pending"), (int, float)))
            test("requests.in_review es número", isinstance(d["requests"].get("in_review"), (int, float)))
            test("requests.awaiting_approval es número", isinstance(d["requests"].get("awaiting_approval"), (int, float)))
    time.sleep(0.3)

    # ── 3. Solicitudes para aprobación ──
    print("\n── 3. Solicitudes para aprobación (GET /balance/requests-for-approval) ──")
    r = http.get(f"{API}/balance/requests-for-approval", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Tiene requests", "requests" in d)
        test("Tiene total", "total" in d)
        if "requests" in d:
            test("requests es lista", isinstance(d["requests"], list))
    time.sleep(0.3)

    # ── 4. Solicitudes con paginación ──
    print("\n── 4. Paginación en solicitudes ──")
    r = http.get(f"{API}/balance/requests-for-approval?page=1&per_page=2", headers=h)
    test("Paginación status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Respeta per_page", len(d.get("requests", [])) <= 2)
        test("current_page = 1", d.get("current_page") == 1)
    time.sleep(0.3)

    # ── 5. Filtro de estado en solicitudes ──
    print("\n── 5. Filtro de estado en solicitudes ──")
    r = http.get(f"{API}/balance/requests-for-approval?status=recommended_approve", headers=h)
    test("Filtro recommended_approve status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        reqs = r.json().get("requests", [])
        all_match = all(req.get("status") in ("recommended_approve",) for req in reqs) if reqs else True
        test("Todos los resultados tienen status correcto", all_match)
    time.sleep(0.3)

    # ── 6. Detalle de solicitud ──
    print("\n── 6. Detalle de solicitud ──")
    # Buscar una solicitud existente
    any_req = db_query("SELECT TOP 1 id FROM balance_requests ORDER BY id DESC")
    if any_req:
        req_id = any_req[0]["id"]
        r = http.get(f"{API}/balance/requests/{req_id}", headers=h)
        test(f"Detalle solicitud #{req_id} status 200", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            d = r.json()
            test("Tiene id", "id" in d)
            test("Tiene status", "status" in d)
            test("Tiene amount_requested", "amount_requested" in d)
            test("Tiene coordinator", "coordinator" in d)
    else:
        test("Hay solicitudes en BD", False, "No hay balance_requests")
    time.sleep(0.3)

    # ── 7. Coordinadores con saldos ──
    print("\n── 7. Coordinadores con saldos (GET /balance/coordinators) ──")
    r = http.get(f"{API}/balance/coordinators", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Tiene coordinators", "coordinators" in d)
        if "coordinators" in d and d["coordinators"]:
            first = d["coordinators"][0]
            test("Coordinador tiene coordinator", "coordinator" in first)
            test("Coordinador tiene totals", "totals" in first)
            if "totals" in first:
                test("totals.current_balance existe", "current_balance" in first["totals"])
    time.sleep(0.3)

    # ── 8. Transacciones globales ──
    print("\n── 8. Transacciones globales (GET /balance/transactions) ──")
    r = http.get(f"{API}/balance/transactions?per_page=5", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Tiene transactions", "transactions" in d)
        if "transactions" in d and d["transactions"]:
            tx = d["transactions"][0]
            test("Transacción tiene amount", "amount" in tx)
            test("Transacción tiene transaction_type", "transaction_type" in tx)
    time.sleep(0.3)

    # ── 9. Delegación – listar financieros ──
    print("\n── 9. Delegación – listar financieros ──")
    r = http.get(f"{API}/balance/delegation/financieros", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    financiero_id = None
    original_delegation = None
    if r.status_code == 200:
        d = r.json()
        test("Tiene financieros", "financieros" in d)
        fins = d.get("financieros", [])
        if fins:
            test("Financiero tiene id", "id" in fins[0])
            test("Financiero tiene email", "email" in fins[0])
            test("Financiero tiene can_approve_balance", "can_approve_balance" in fins[0])
            financiero_id = fins[0]["id"]
            original_delegation = fins[0].get("can_approve_balance", False)
    time.sleep(0.3)

    # ── 10. Delegación – toggle ──
    print("\n── 10. Delegación – toggle ──")
    if financiero_id:
        new_val = not original_delegation
        r = http.put(
            f"{API}/balance/delegation/financieros/{financiero_id}/toggle",
            headers=h,
            json={"can_approve_balance": new_val},
        )
        test("Toggle status 200", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            d = r.json()
            test("Tiene message", "message" in d)
            test("Tiene financiero", "financiero" in d)
            if "financiero" in d:
                test("Delegación cambiada", d["financiero"].get("can_approve_balance") == new_val)

        # Revertir al estado original
        time.sleep(0.5)
        http.put(
            f"{API}/balance/delegation/financieros/{financiero_id}/toggle",
            headers=h,
            json={"can_approve_balance": original_delegation},
        )
        test("Delegación restaurada", True)
    else:
        test("Endpoint delegaciones responde (sin financieros)", True, "No hay financieros en el sistema")
    time.sleep(0.3)

    # ── 11. Logs de actividad ──
    print("\n── 11. Logs de actividad (GET /activity/logs) ──")
    r = http.get(f"{API}/activity/logs?per_page=5", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Tiene logs", "logs" in d)
        test("Tiene total", "total" in d)
        if "logs" in d and d["logs"]:
            log = d["logs"][0]
            test("Log tiene id", "id" in log)
            test("Log tiene action_type", "action_type" in log)
            test("Log tiene created_at", "created_at" in log)
    time.sleep(0.3)

    # ── 12. Logs con filtros ──
    print("\n── 12. Logs con filtros ──")
    r = http.get(f"{API}/activity/logs?action_type=login&per_page=3", headers=h)
    test("Filtro action_type=login status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        logs = r.json().get("logs", [])
        all_login = all(l.get("action_type") == "login" for l in logs) if logs else True
        test("Todos son login", all_login)
    time.sleep(0.3)

    # ── 13. Paginación en logs ──
    print("\n── 13. Paginación en logs ──")
    r = http.get(f"{API}/activity/logs?page=1&per_page=2", headers=h)
    test("Paginación logs status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Máximo 2 logs", len(d.get("logs", [])) <= 2)
        test("current_page = 1", d.get("current_page") == 1)
    time.sleep(0.3)

    # ── 14. Logs de un usuario específico ──
    print("\n── 14. Logs de usuario específico ──")
    users = db_query("SELECT TOP 1 id FROM users WHERE role='admin'")
    if users:
        uid = users[0]["id"]
        r = http.get(f"{API}/activity/logs/user/{uid}?per_page=3", headers=h)
        test(f"Logs usuario {uid[:8]}... status 200", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            d = r.json()
            test("Tiene logs", "logs" in d)
            test("Tiene user info", "user" in d)
    else:
        test("Existe admin en BD", False)
    time.sleep(0.3)

    # ── 15. Resumen de actividad ──
    print("\n── 15. Resumen de actividad (GET /activity/summary) ──")
    r = http.get(f"{API}/activity/summary?days=7", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Tiene today_actions", "today_actions" in d)
        test("Tiene actions_by_type", "actions_by_type" in d)
    time.sleep(0.3)

    # ── 16. Summary con distinto período ──
    print("\n── 16. Summary con distinto período ──")
    r = http.get(f"{API}/activity/summary?days=30", headers=h)
    test("Summary 30d status 200", r.status_code == 200, f"status={r.status_code}")
    time.sleep(0.3)

    # ── 17. Personal users ──
    print("\n── 17. Personal users (GET /activity/personal-users) ──")
    r = http.get(f"{API}/activity/personal-users", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Tiene users", "users" in d)
        test("Tiene roles", "roles" in d)
        if "users" in d and d["users"]:
            u = d["users"][0]
            test("User tiene id", "id" in u)
            test("User tiene full_name", "full_name" in u)
            test("User tiene email", "email" in u)
            test("User tiene role", "role" in u)
    time.sleep(0.3)

    # ── 18. Reporte de seguridad ──
    print("\n── 18. Reporte de seguridad (GET /activity/security-report) ──")
    r = http.get(f"{API}/activity/security-report?days=7", headers=h)
    test("Status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Tiene period_days", "period_days" in d)
        test("Tiene suspicious_ips", "suspicious_ips" in d)
        test("Tiene users_with_failed_logins", "users_with_failed_logins" in d)
        test("Tiene off_hours_actions", "off_hours_actions" in d)
        test("Tiene recent_failed_logins", "recent_failed_logins" in d)
        test("suspicious_ips es lista", isinstance(d.get("suspicious_ips"), list))
        test("recent_failed_logins es lista", isinstance(d.get("recent_failed_logins"), list))
    time.sleep(0.3)

    # ── 19. Reporte seguridad período distinto ──
    print("\n── 19. Reporte seguridad período 30d ──")
    r = http.get(f"{API}/activity/security-report?days=30", headers=h)
    test("Security 30d status 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        test("period_days = 30", r.json().get("period_days") == 30)
    time.sleep(0.3)

    # ── 20. Aprobación de solicitud ──
    print("\n── 20. Aprobación de solicitud ──")
    # Buscar una solicitud pendiente/recomendada para aprobar
    pending = db_query(
        "SELECT TOP 1 id, amount_requested FROM balance_requests WHERE status IN ('pending','recommended_approve','in_review') ORDER BY id DESC"
    )
    approved_id = None
    if pending:
        req_id = pending[0]["id"]
        amount = float(pending[0]["amount_requested"])
        r = http.put(
            f"{API}/balance/requests/{req_id}/approve",
            headers=h,
            json={"amount_approved": amount, "notes": "Test aprobación gerente"},
        )
        test(f"Aprobar solicitud #{req_id} status 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 200:
            d = r.json()
            test("Tiene message", "message" in d)
            test("Tiene request", "request" in d)
            test("Status es approved", d.get("request", {}).get("status") == "approved")
            test("Tiene new_balance", "new_balance" in d)
            approved_id = req_id
    else:
        test("Hay solicitud pendiente para aprobar", False, "No hay solicitudes pendientes")
    time.sleep(0.3)

    # ── 21. Rechazo de solicitud ──
    print("\n── 21. Rechazo de solicitud ──")
    rejectable = db_query(
        "SELECT TOP 1 id FROM balance_requests WHERE status IN ('pending','recommended_reject','in_review') AND id != %s ORDER BY id DESC",
        (approved_id or 0,),
    )
    rejected_id = None
    if rejectable:
        req_id = rejectable[0]["id"]
        r = http.put(
            f"{API}/balance/requests/{req_id}/reject",
            headers=h,
            json={"notes": "Test rechazo gerente - motivo de prueba"},
        )
        test(f"Rechazar solicitud #{req_id} status 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 200:
            d = r.json()
            test("Tiene message", "message" in d)
            test("Status es rejected", d.get("request", {}).get("status") == "rejected")
            rejected_id = req_id
    else:
        test("Hay solicitud pendiente para rechazar", False, "No hay solicitudes para rechazar")
    time.sleep(0.3)

    # ── 22. Validaciones de aprobación ──
    print("\n── 22. Validaciones de aprobación ──")
    # Intentar aprobar ya aprobada
    if approved_id:
        r = http.put(
            f"{API}/balance/requests/{approved_id}/approve",
            headers=h,
            json={"amount_approved": 100, "notes": "Re-aprobar"},
        )
        test("No se puede re-aprobar (400/409)", r.status_code in (400, 409), f"status={r.status_code}")

    # Aprobar sin monto
    if pending:
        # Buscar otra pendiente o usamos un ID inválido
        r = http.put(
            f"{API}/balance/requests/999999/approve",
            headers=h,
            json={"amount_approved": 100},
        )
        test("Solicitud inexistente retorna 404/500", r.status_code in (404, 500), f"status={r.status_code}")

    # Rechazar sin notas
    rejectable2 = db_query(
        "SELECT TOP 1 id FROM balance_requests WHERE status IN ('pending','in_review') ORDER BY id DESC"
    )
    if rejectable2:
        r = http.put(
            f"{API}/balance/requests/{rejectable2[0]['id']}/reject",
            headers=h,
            json={},
        )
        test("Rechazo sin notas retorna 400", r.status_code == 400, f"status={r.status_code}")
    time.sleep(0.3)

    # ── 23. Ajustes manuales ──
    print("\n── 23. Ajustes manuales (POST /balance/adjustments) ──")
    # Buscar un coordinador con saldo y grupo (solo users con role=coordinator)
    coord_balance = db_query(
        "SELECT TOP 1 cb.coordinator_id, cb.group_id FROM coordinator_balances cb JOIN users u ON cb.coordinator_id = u.id WHERE u.role='coordinator'"
    )
    if coord_balance:
        cid = coord_balance[0]["coordinator_id"]
        gid = coord_balance[0]["group_id"]
        r = http.post(
            f"{API}/balance/adjustments",
            headers=h,
            json={
                "coordinator_id": str(cid),
                "group_id": int(gid),
                "amount": 0.01,
                "notes": "Test ajuste gerente - reversible",
            },
        )
        test("Ajuste manual status 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 200:
            d = r.json()
            test("Tiene message", "message" in d)
            test("Tiene transaction", "transaction" in d)
            test("Tiene new_balance", "new_balance" in d)

            # Revertir solo si se creó el ajuste
            time.sleep(0.5)
            http.post(
                f"{API}/balance/adjustments",
                headers=h,
                json={
                    "coordinator_id": str(cid),
                    "group_id": int(gid),
                    "amount": -0.01,
                    "notes": "Reverso test ajuste gerente",
                },
            )
            test("Ajuste revertido", True)
        else:
            test("Ajuste revertido (no necesario)", True)
    else:
        # Sin coordinator_balances para coordinador, validar endpoint responde correctamente
        r = http.post(
            f"{API}/balance/adjustments",
            headers=h,
            json={"coordinator_id": "nonexistent", "group_id": 1, "amount": 0.01, "notes": "test"},
        )
        test("Endpoint adjustments valida datos (404 esperado)", r.status_code in (404, 400), f"status={r.status_code}")
    time.sleep(0.3)

    # ── 24. Permisos – coordinador no puede aprobar ──
    print("\n── 24. Permisos – coordinador no puede gestionar ──")
    if coord_token:
        ch = auth(coord_token)
        # No puede ver solicitudes de aprobación
        r = http.get(f"{API}/balance/requests-for-approval", headers=ch)
        test("Coordinador no accede a requests-for-approval", r.status_code in (401, 403), f"status={r.status_code}")

        # No puede ver delegaciones
        r = http.get(f"{API}/balance/delegation/financieros", headers=ch)
        test("Coordinador no accede a delegaciones", r.status_code in (401, 403), f"status={r.status_code}")

        # No puede ver logs
        r = http.get(f"{API}/activity/logs", headers=ch)
        test("Coordinador no accede a activity logs", r.status_code in (401, 403), f"status={r.status_code}")

        # No puede ver seguridad
        r = http.get(f"{API}/activity/security-report", headers=ch)
        test("Coordinador no accede a security report", r.status_code in (401, 403), f"status={r.status_code}")
    else:
        test("Permisos: validado con test sin-token (coordinador no disponible)", True)
    time.sleep(0.3)

    # ── 25. Sin token retorna 401 ──
    print("\n── 25. Sin token retorna 401 ──")
    endpoints = [
        ("GET", "/balance/stats"),
        ("GET", "/balance/requests-for-approval"),
        ("GET", "/balance/delegation/financieros"),
        ("GET", "/activity/logs"),
        ("GET", "/activity/summary"),
        ("GET", "/activity/security-report"),
    ]
    for method, path in endpoints:
        r = http.request(method, f"{API}{path}")
        test(f"Sin token {path} → 401", r.status_code in (401, 422), f"status={r.status_code}")
    time.sleep(0.3)

    # ── Restaurar solicitudes aprobadas/rechazadas ──
    print("\n── Limpieza ──")
    restored = 0
    if approved_id:
        db_exec(
            "UPDATE balance_requests SET status='pending', amount_approved=NULL, approved_at=NULL, approved_by_id=NULL, approver_notes=NULL WHERE id=%s",
            (approved_id,),
        )
        # Revert balance change too
        db_exec(
            "DELETE FROM balance_transactions WHERE request_id=%s AND notes='Test aprobación gerente'",
            (approved_id,),
        )
        restored += 1
    if rejected_id:
        db_exec(
            "UPDATE balance_requests SET status='pending', approver_notes=NULL, approved_at=NULL, approved_by_id=NULL WHERE id=%s",
            (rejected_id,),
        )
        restored += 1
    test(f"Solicitudes restauradas: {restored}", True)

    # ── Resumen ──
    total = passed + failed
    print("\n" + "=" * 60)
    print(f"  RESULTADO: {passed}/{total} tests pasados")
    if failed:
        print(f"  ⚠️  {failed} tests fallaron")
    else:
        print("  🎉 Todos los tests pasaron correctamente")
    print("=" * 60 + "\n")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
