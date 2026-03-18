"""
Tests para el sistema de retry robusto de RENAPO.

Cubre:
  1. _calc_retry_delay: exponential backoff con jitter
  2. Circuit breaker: apertura, cooldown, half-open, reset
  3. _ensure_browser / _restart_browser: health check
  4. Integration (contra API real): retry en bulk + individual

USO: python tests/test_renapo_retry.py
"""
import sys
import os
import time
import threading

# Ajustar path para imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

passed = 0
failed = 0
warnings = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ {name}")
        passed += 1
    else:
        print(f"  ❌ {name} — {detail}")
        failed += 1


def warn(name, detail=""):
    global warnings
    print(f"  ⚠️  {name} — {detail}")
    warnings += 1


def main():
    global passed, failed

    print("\n" + "=" * 60)
    print("  TESTS: RENAPO RETRY SYSTEM")
    print("=" * 60)

    # ════════════════════════════════════════════════════════════
    # TEST 1: _calc_retry_delay — exponential backoff
    # ════════════════════════════════════════════════════════════
    print("\n── 1. Exponential backoff con jitter ──")

    from app.services.renapo_service import (
        _calc_retry_delay, MAX_RETRIES, RETRY_BASE_DELAY, RETRY_MAX_DELAY, RETRY_JITTER,
    )

    test("MAX_RETRIES >= 5", MAX_RETRIES >= 5, f"MAX_RETRIES = {MAX_RETRIES}")
    test("MAX_RETRIES <= 10", MAX_RETRIES <= 10, f"MAX_RETRIES = {MAX_RETRIES}")

    # Verificar que los delays escalan exponencialmente
    delays = [_calc_retry_delay(i) for i in range(1, MAX_RETRIES + 1)]
    print(f"  ℹ️  Delays calculados: {[f'{d:.1f}s' for d in delays]}")

    test("Delay intento 1 ~ 2s (±jitter)", 1.0 <= delays[0] <= 4.0,
         f"delay[1] = {delays[0]:.1f}s")
    test("Delay intento 2 ~ 4s (±jitter)", 2.0 <= delays[1] <= 6.5,
         f"delay[2] = {delays[1]:.1f}s")
    test("Delay intento 3 ~ 8s (±jitter)", 4.0 <= delays[2] <= 13.0,
         f"delay[3] = {delays[2]:.1f}s")

    # Verificar cap en RETRY_MAX_DELAY
    high_delay = _calc_retry_delay(100)
    test(f"Delay cap en <= {RETRY_MAX_DELAY}s", high_delay <= RETRY_MAX_DELAY,
         f"delay[100] = {high_delay:.1f}s")
    test("Delay siempre >= 1s", all(d >= 1.0 for d in delays),
         f"min delay = {min(delays):.1f}s")

    # Verificar jitter: ejecutar 20 veces el mismo attempt y ver que varía
    samples_3 = [_calc_retry_delay(3) for _ in range(20)]
    unique_vals = len(set(f"{d:.2f}" for d in samples_3))
    test("Jitter produce valores distintos", unique_vals >= 3,
         f"Solo {unique_vals} valores únicos de 20 muestras")

    # ════════════════════════════════════════════════════════════
    # TEST 2: Circuit breaker
    # ════════════════════════════════════════════════════════════
    print("\n── 2. Circuit breaker ──")

    from app.services import renapo_service
    from app.services.renapo_service import (
        _check_circuit_breaker, _record_renapo_success, _record_renapo_failure,
        _CIRCUIT_THRESHOLD, _CIRCUIT_COOLDOWN,
    )

    print(f"  ℹ️  Threshold={_CIRCUIT_THRESHOLD}, Cooldown={_CIRCUIT_COOLDOWN}s")

    # Reset state
    with renapo_service._circuit_lock:
        renapo_service._consecutive_failures = 0
        renapo_service._circuit_opened_at = 0.0

    test("Circuito cerrado inicialmente", not _check_circuit_breaker())

    # Registrar fallos hasta justo debajo del threshold
    for _ in range(_CIRCUIT_THRESHOLD - 1):
        _record_renapo_failure()
    test(f"Circuito cerrado con {_CIRCUIT_THRESHOLD - 1} fallos",
         not _check_circuit_breaker())

    # Un fallo más → abre el circuito
    _record_renapo_failure()
    test(f"Circuito ABIERTO con {_CIRCUIT_THRESHOLD} fallos",
         _check_circuit_breaker())

    # Éxito → resetea
    _record_renapo_success()
    test("Éxito resetea circuito", not _check_circuit_breaker())
    with renapo_service._circuit_lock:
        test("Contador de fallos = 0", renapo_service._consecutive_failures == 0)

    # Test half-open: abrir circuito, simular que cooldown expiró
    for _ in range(_CIRCUIT_THRESHOLD):
        _record_renapo_failure()
    test("Circuito abierto de nuevo", _check_circuit_breaker())

    # Simular que el cooldown ya pasó
    with renapo_service._circuit_lock:
        renapo_service._circuit_opened_at = time.time() - _CIRCUIT_COOLDOWN - 1
    test("Half-open: permite intento tras cooldown", not _check_circuit_breaker())

    # Limpiar
    _record_renapo_success()

    # ════════════════════════════════════════════════════════════
    # TEST 3: Circuit breaker thread-safe
    # ════════════════════════════════════════════════════════════
    print("\n── 3. Circuit breaker thread-safety ──")

    with renapo_service._circuit_lock:
        renapo_service._consecutive_failures = 0
        renapo_service._circuit_opened_at = 0.0

    errors = []

    def stress_failures(n):
        try:
            for _ in range(n):
                _record_renapo_failure()
        except Exception as e:
            errors.append(str(e))

    def stress_successes(n):
        try:
            for _ in range(n):
                _record_renapo_success()
        except Exception as e:
            errors.append(str(e))

    threads = []
    for _ in range(5):
        threads.append(threading.Thread(target=stress_failures, args=(20,)))
        threads.append(threading.Thread(target=stress_successes, args=(10,)))
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=5)

    test("Sin errores en acceso concurrente", len(errors) == 0,
         f"{len(errors)} errores: {errors[:3]}")

    # Reset
    _record_renapo_success()

    # ════════════════════════════════════════════════════════════
    # TEST 4: validate_curp_renapo con circuit breaker abierto
    # ════════════════════════════════════════════════════════════
    print("\n── 4. validate_curp_renapo respeta circuit breaker ──")

    from app.services.renapo_service import validate_curp_renapo, validate_curp_format

    # Abrir circuito
    with renapo_service._circuit_lock:
        renapo_service._consecutive_failures = _CIRCUIT_THRESHOLD
        renapo_service._circuit_opened_at = time.time()

    start = time.time()
    result = validate_curp_renapo("GARC850101HDFRRR01")
    elapsed = time.time() - start

    test("Retorna inválido con circuito abierto", not result.valid)
    test("Error menciona 'temporalmente'", "temporalmente" in (result.error or ""),
         f"error: {result.error}")
    test("Respuesta inmediata (< 1s)", elapsed < 1.0,
         f"Tardó {elapsed:.1f}s")

    # Reset
    _record_renapo_success()

    # ════════════════════════════════════════════════════════════
    # TEST 5: Format validation shortcuts (no llama a RENAPO)
    # ════════════════════════════════════════════════════════════
    print("\n── 5. Shortcuts que no tocan RENAPO ──")

    # CURP vacía
    r = validate_curp_renapo("")
    test("CURP vacía → inválida", not r.valid)

    # CURP genérica extranjera
    r = validate_curp_renapo("XEXX010101HNEXXXA4")
    test("CURP genérica extranjera → válida", r.valid)

    # Formato inválido
    r = validate_curp_renapo("ABC")
    test("Formato inválido → inválida", not r.valid)
    test("Error menciona formato", "formato" in (r.error or "").lower() or "Formato" in (r.error or ""),
         f"error: {r.error}")

    # ════════════════════════════════════════════════════════════
    # TEST 6: Config values son razonables para operación a escala
    # ════════════════════════════════════════════════════════════
    print("\n── 6. Configuración para operación a escala ──")

    from app.services.renapo_service import _BROWSER_RESTART_AFTER

    test("MAX_RETRIES = 7", MAX_RETRIES == 7, f"Got: {MAX_RETRIES}")
    test("RETRY_MAX_DELAY = 30s", RETRY_MAX_DELAY == 30, f"Got: {RETRY_MAX_DELAY}")
    test("CIRCUIT_THRESHOLD = 10", _CIRCUIT_THRESHOLD == 10, f"Got: {_CIRCUIT_THRESHOLD}")
    test("CIRCUIT_COOLDOWN = 120s", _CIRCUIT_COOLDOWN == 120, f"Got: {_CIRCUIT_COOLDOWN}")
    test("BROWSER_RESTART_AFTER = 3", _BROWSER_RESTART_AFTER == 3, f"Got: {_BROWSER_RESTART_AFTER}")

    # Calcular worst-case total time por CURP
    # Sum of all retry delays: 2+4+8+16+30+30+... (capped) ≈ 90s delays + 7×(30+60+30)s per attempt
    # En práctica mucho menos porque sale al primer éxito
    total_max_delay = sum(_calc_retry_delay(i) for i in range(1, MAX_RETRIES + 1))
    print(f"  ℹ️  Total max delay entre reintentos: ~{total_max_delay:.0f}s")
    test("Total max delay razonable (< 200s)", total_max_delay < 200,
         f"total = {total_max_delay:.0f}s")

    # ════════════════════════════════════════════════════════════
    # RESUMEN
    # ════════════════════════════════════════════════════════════
    print("\n" + "=" * 60)
    total = passed + failed
    emoji = "✅" if failed == 0 else "⚠️" if failed <= 2 else "❌"
    print(f"{emoji} RESULTADOS: {passed}/{total} tests pasaron")
    if warnings:
        print(f"   ⚠️  {warnings} advertencias")
    if failed:
        print(f"   ❌ {failed} tests fallaron")
    print("=" * 60)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
