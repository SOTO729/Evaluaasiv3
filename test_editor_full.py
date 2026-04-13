"""
Test completo de TODOS los endpoints del editor contra DEV API.
Cubre: Exams, Categories, Topics, Questions, Answers, Exercises, Steps, Actions,
       Study Contents, Sessions, Study Topics, Reading, Standards, Brands, Badges.
"""
import requests
import json
import sys
import time

BASE = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
TIMEOUT = 30

# ─── Tracking ───
results = []
created_ids = {}  # Track IDs for cleanup

def log(module, test_name, method, url, status, ok, detail=""):
    tag = "PASS" if ok else "FAIL"
    results.append((module, test_name, tag, status, detail))
    short_url = url.replace(BASE, "")
    print(f"  [{tag}] {method} {short_url} → {status} {detail[:80] if detail else ''}")

def section(name):
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")

# ─── Auth ───
def login():
    print("Logging in as editor...")
    r = requests.post(f"{BASE}/auth/login", json={"username": "editor", "password": "editor123"}, timeout=TIMEOUT)
    if r.status_code != 200:
        # Try admin
        print("  Editor login failed, trying admin...")
        r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=TIMEOUT)
    if r.status_code != 200:
        print(f"  LOGIN FAILED: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    data = r.json()
    token = data.get("access_token") or data.get("token")
    user = data.get("user", {})
    print(f"  Logged in as: {user.get('username', '?')} (role: {user.get('role', '?')})")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def get(headers, path, params=None):
    r = requests.get(f"{BASE}{path}", headers=headers, params=params, timeout=TIMEOUT)
    return r

def post(headers, path, data=None):
    r = requests.post(f"{BASE}{path}", headers=headers, json=data, timeout=TIMEOUT)
    return r

def put(headers, path, data=None):
    r = requests.put(f"{BASE}{path}", headers=headers, json=data, timeout=TIMEOUT)
    return r

def delete(headers, path):
    r = requests.delete(f"{BASE}{path}", headers=headers, timeout=TIMEOUT)
    return r


def test_exams(h):
    section("EXAMS MODULE")

    # ── List exams ──
    r = get(h, "/exams")
    ok = r.status_code == 200
    exams = []
    if ok:
        data = r.json()
        exams = data.get("exams", data if isinstance(data, list) else [])
        log("Exams", "List exams", "GET", f"{BASE}/exams", r.status_code, ok, f"{len(exams)} exams")
    else:
        log("Exams", "List exams", "GET", f"{BASE}/exams", r.status_code, False, r.text[:100])

    # ── Get first exam details ──
    exam_id = None
    if exams:
        exam_id = exams[0].get("id") if isinstance(exams[0], dict) else None
    if exam_id:
        r = get(h, f"/exams/{exam_id}", {"include_details": "true"})
        ok = r.status_code == 200
        detail = ""
        if ok:
            ed = r.json()
            detail = f"name={ed.get('name','?')}, cats={ed.get('total_categories',0)}"
        else:
            detail = r.text[:100]
        log("Exams", f"Get exam {exam_id}", "GET", f"{BASE}/exams/{exam_id}", r.status_code, ok, detail)

    # ── Get question types ──
    r = get(h, "/exams/question-types")
    ok = r.status_code == 200
    qtypes = []
    if ok:
        qtypes = r.json() if isinstance(r.json(), list) else r.json().get("question_types", [])
    log("Exams", "Question types", "GET", f"{BASE}/exams/question-types", r.status_code, ok,
        f"{len(qtypes)} types" if ok else r.text[:100])

    # ── Validate exam ──
    if exam_id:
        r = get(h, f"/exams/{exam_id}/validate")
        ok = r.status_code == 200
        log("Exams", f"Validate exam {exam_id}", "GET", f"{BASE}/exams/{exam_id}/validate", r.status_code, ok,
            r.text[:100] if not ok else "")

    return exam_id


def test_categories(h, exam_id):
    section("CATEGORIES MODULE")
    if not exam_id:
        print("  SKIP: No exam_id available")
        return None

    # ── List categories ──
    r = get(h, f"/exams/{exam_id}/categories", {"include_details": "true"})
    ok = r.status_code == 200
    cats = []
    if ok:
        data = r.json()
        cats = data.get("categories", data if isinstance(data, list) else [])
    log("Categories", f"List categories exam {exam_id}", "GET",
        f"{BASE}/exams/{exam_id}/categories", r.status_code, ok,
        f"{len(cats)} categories" if ok else r.text[:100])

    cat_id = cats[0].get("id") if cats else None
    return cat_id


def test_topics(h, cat_id):
    section("TOPICS MODULE")
    if not cat_id:
        print("  SKIP: No category_id available")
        return None

    # ── List topics ──
    r = get(h, f"/exams/categories/{cat_id}/topics", {"include_details": "true"})
    ok = r.status_code == 200
    topics = []
    if ok:
        data = r.json()
        topics = data.get("topics", data if isinstance(data, list) else [])
    log("Topics", f"List topics cat {cat_id}", "GET",
        f"{BASE}/exams/categories/{cat_id}/topics", r.status_code, ok,
        f"{len(topics)} topics" if ok else r.text[:100])

    topic_id = topics[0].get("id") if topics else None
    return topic_id


def test_questions(h, topic_id):
    section("QUESTIONS MODULE")
    if not topic_id:
        print("  SKIP: No topic_id available")
        return None

    # ── List questions ──
    r = get(h, f"/exams/topics/{topic_id}/questions", {"include_correct": "true"})
    ok = r.status_code == 200
    questions = []
    if ok:
        data = r.json()
        questions = data.get("questions", data if isinstance(data, list) else [])
    log("Questions", f"List questions topic {topic_id}", "GET",
        f"{BASE}/exams/topics/{topic_id}/questions", r.status_code, ok,
        f"{len(questions)} questions" if ok else r.text[:100])

    # ── Create question ──
    r = post(h, f"/exams/topics/{topic_id}/questions", {
        "question_type_id": 1,
        "question_text": "TEST: ¿Pregunta automática de prueba?",
        "answers": [
            {"answer_text": "Opción A", "is_correct": True},
            {"answer_text": "Opción B", "is_correct": False}
        ]
    })
    ok = r.status_code in (200, 201)
    q_id = None
    if ok:
        qdata = r.json()
        q_id = qdata.get("id") or qdata.get("question", {}).get("id")
        created_ids["question"] = q_id
    log("Questions", "Create question", "POST",
        f"{BASE}/exams/topics/{topic_id}/questions", r.status_code, ok,
        f"id={q_id}" if ok else r.text[:100])

    # ── Get question ──
    if q_id:
        r = get(h, f"/exams/questions/{q_id}")
        ok = r.status_code == 200
        log("Questions", f"Get question {q_id}", "GET",
            f"{BASE}/exams/questions/{q_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Update question ──
    if q_id:
        r = put(h, f"/exams/questions/{q_id}", {
            "question_text": "TEST: ¿Pregunta actualizada?"
        })
        ok = r.status_code == 200
        log("Questions", f"Update question {q_id}", "PUT",
            f"{BASE}/exams/questions/{q_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    return q_id


def test_answers(h, q_id):
    section("ANSWERS MODULE")
    if not q_id:
        print("  SKIP: No question_id available")
        return

    # ── List answers ──
    r = get(h, f"/exams/questions/{q_id}/answers")
    ok = r.status_code == 200
    answers = []
    if ok:
        data = r.json()
        answers = data.get("answers", data if isinstance(data, list) else [])
    log("Answers", f"List answers q {q_id}", "GET",
        f"{BASE}/exams/questions/{q_id}/answers", r.status_code, ok,
        f"{len(answers)} answers" if ok else r.text[:100])

    # ── Create answer ──
    r = post(h, f"/exams/questions/{q_id}/answers", {
        "answer_text": "TEST: Respuesta nueva",
        "is_correct": False
    })
    ok = r.status_code in (200, 201)
    a_id = None
    if ok:
        adata = r.json()
        a_id = adata.get("id") or adata.get("answer", {}).get("id")
        created_ids["answer"] = a_id
    log("Answers", "Create answer", "POST",
        f"{BASE}/exams/questions/{q_id}/answers", r.status_code, ok,
        f"id={a_id}" if ok else r.text[:100])

    # ── Update answer ──
    if a_id:
        r = put(h, f"/exams/answers/{a_id}", {"answer_text": "TEST: Respuesta actualizada"})
        ok = r.status_code == 200
        log("Answers", f"Update answer {a_id}", "PUT",
            f"{BASE}/exams/answers/{a_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Delete answer ──
    if a_id:
        r = delete(h, f"/exams/answers/{a_id}")
        ok = r.status_code in (200, 204)
        log("Answers", f"Delete answer {a_id}", "DELETE",
            f"{BASE}/exams/answers/{a_id}", r.status_code, ok,
            r.text[:100] if not ok else "")


def test_exercises(h, topic_id):
    section("EXERCISES MODULE")
    if not topic_id:
        print("  SKIP: No topic_id available")
        return None

    # ── List exercises ──
    r = get(h, f"/exams/topics/{topic_id}/exercises")
    ok = r.status_code == 200
    exercises = []
    if ok:
        data = r.json()
        exercises = data.get("exercises", data if isinstance(data, list) else [])
    log("Exercises", f"List exercises topic {topic_id}", "GET",
        f"{BASE}/exams/topics/{topic_id}/exercises", r.status_code, ok,
        f"{len(exercises)} exercises" if ok else r.text[:100])

    # ── Create exercise ──
    r = post(h, f"/exams/topics/{topic_id}/exercises", {
        "exercise_text": "TEST: Ejercicio automático de prueba",
        "is_complete": False
    })
    ok = r.status_code in (200, 201)
    ex_id = None
    if ok:
        edata = r.json()
        ex_id = edata.get("id") or edata.get("exercise", {}).get("id")
        created_ids["exercise"] = ex_id
    log("Exercises", "Create exercise", "POST",
        f"{BASE}/exams/topics/{topic_id}/exercises", r.status_code, ok,
        f"id={ex_id}" if ok else r.text[:100])

    # ── Get exercise details ──
    if ex_id:
        r = get(h, f"/exams/exercises/{ex_id}/details")
        ok = r.status_code == 200
        log("Exercises", f"Get exercise {ex_id} details", "GET",
            f"{BASE}/exams/exercises/{ex_id}/details", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Update exercise ──
    if ex_id:
        r = put(h, f"/exams/exercises/{ex_id}", {
            "exercise_text": "TEST: Ejercicio actualizado"
        })
        ok = r.status_code == 200
        log("Exercises", f"Update exercise {ex_id}", "PUT",
            f"{BASE}/exams/exercises/{ex_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    return ex_id


def test_steps(h, ex_id):
    section("EXERCISE STEPS MODULE")
    if not ex_id:
        print("  SKIP: No exercise_id available")
        return None

    # ── List steps ──
    r = get(h, f"/exams/exercises/{ex_id}/steps")
    ok = r.status_code == 200
    steps = []
    if ok:
        data = r.json()
        steps = data.get("steps", data if isinstance(data, list) else [])
    log("Steps", f"List steps exercise {ex_id}", "GET",
        f"{BASE}/exams/exercises/{ex_id}/steps", r.status_code, ok,
        f"{len(steps)} steps" if ok else r.text[:100])

    # ── Create step ──
    r = post(h, f"/exams/exercises/{ex_id}/steps", {
        "title": "TEST: Paso de prueba",
        "description": "Descripción del paso de prueba"
    })
    ok = r.status_code in (200, 201)
    step_id = None
    if ok:
        sdata = r.json()
        step_id = sdata.get("id") or sdata.get("step", {}).get("id")
        created_ids["step"] = step_id
    log("Steps", "Create step", "POST",
        f"{BASE}/exams/exercises/{ex_id}/steps", r.status_code, ok,
        f"id={step_id}" if ok else r.text[:100])

    # ── Get step ──
    if step_id:
        r = get(h, f"/exams/steps/{step_id}")
        ok = r.status_code == 200
        log("Steps", f"Get step {step_id}", "GET",
            f"{BASE}/exams/steps/{step_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Update step ──
    if step_id:
        r = put(h, f"/exams/steps/{step_id}", {
            "title": "TEST: Paso actualizado"
        })
        ok = r.status_code == 200
        log("Steps", f"Update step {step_id}", "PUT",
            f"{BASE}/exams/steps/{step_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    return step_id


def test_actions(h, step_id):
    section("EXERCISE ACTIONS MODULE")
    if not step_id:
        print("  SKIP: No step_id available")
        return

    # ── List actions ──
    r = get(h, f"/exams/steps/{step_id}/actions")
    ok = r.status_code == 200
    actions = []
    if ok:
        data = r.json()
        actions = data.get("actions", data if isinstance(data, list) else [])
    log("Actions", f"List actions step {step_id}", "GET",
        f"{BASE}/exams/steps/{step_id}/actions", r.status_code, ok,
        f"{len(actions)} actions" if ok else r.text[:100])

    # ── Create action ──
    r = post(h, f"/exams/steps/{step_id}/actions", {
        "action_type": "button",
        "label": "TEST: Botón prueba",
        "position_x": 100,
        "position_y": 200,
        "width": 120,
        "height": 40,
        "correct_answer": "click"
    })
    ok = r.status_code in (200, 201)
    act_id = None
    if ok:
        adata = r.json()
        act_id = adata.get("id") or adata.get("action", {}).get("id")
        created_ids["action"] = act_id
    log("Actions", "Create action", "POST",
        f"{BASE}/exams/steps/{step_id}/actions", r.status_code, ok,
        f"id={act_id}" if ok else r.text[:100])

    # ── Get action ──
    if act_id:
        r = get(h, f"/exams/actions/{act_id}")
        ok = r.status_code == 200
        log("Actions", f"Get action {act_id}", "GET",
            f"{BASE}/exams/actions/{act_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Update action ──
    if act_id:
        r = put(h, f"/exams/actions/{act_id}", {
            "label": "TEST: Botón actualizado"
        })
        ok = r.status_code == 200
        log("Actions", f"Update action {act_id}", "PUT",
            f"{BASE}/exams/actions/{act_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Delete action ──
    if act_id:
        r = delete(h, f"/exams/actions/{act_id}")
        ok = r.status_code in (200, 204)
        log("Actions", f"Delete action {act_id}", "DELETE",
            f"{BASE}/exams/actions/{act_id}", r.status_code, ok,
            r.text[:100] if not ok else "")


def test_study_contents(h):
    section("STUDY CONTENTS MODULE")

    # ── List materials ──
    r = get(h, "/study-contents")
    ok = r.status_code == 200
    materials = []
    if ok:
        data = r.json()
        materials = data.get("materials", data.get("items", data if isinstance(data, list) else []))
    log("StudyContents", "List materials", "GET",
        f"{BASE}/study-contents", r.status_code, ok,
        f"{len(materials)} materials" if ok else r.text[:100])

    # ── Create material ──
    r = post(h, "/study-contents", {
        "title": "TEST: Material automático de prueba",
        "description": "<p>Descripción de prueba</p>",
        "is_published": False
    })
    ok = r.status_code in (200, 201)
    mat_id = None
    if ok:
        mdata = r.json()
        mat_id = mdata.get("id") or mdata.get("material", {}).get("id")
        created_ids["study_material"] = mat_id
    log("StudyContents", "Create material", "POST",
        f"{BASE}/study-contents", r.status_code, ok,
        f"id={mat_id}" if ok else r.text[:200])

    # ── Get material ──
    if mat_id:
        r = get(h, f"/study-contents/{mat_id}")
        ok = r.status_code == 200
        log("StudyContents", f"Get material {mat_id}", "GET",
            f"{BASE}/study-contents/{mat_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Update material ──
    if mat_id:
        r = put(h, f"/study-contents/{mat_id}", {
            "title": "TEST: Material actualizado"
        })
        ok = r.status_code == 200
        log("StudyContents", f"Update material {mat_id}", "PUT",
            f"{BASE}/study-contents/{mat_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    return mat_id


def test_sessions(h, mat_id):
    section("STUDY SESSIONS MODULE")
    if not mat_id:
        print("  SKIP: No material_id available")
        return None

    # ── List sessions ──
    r = get(h, f"/study-contents/{mat_id}/sessions")
    ok = r.status_code == 200
    sessions = []
    if ok:
        data = r.json()
        if isinstance(data, list):
            sessions = data
        elif isinstance(data, dict):
            sessions = data.get("sessions", [])
    log("Sessions", f"List sessions mat {mat_id}", "GET",
        f"{BASE}/study-contents/{mat_id}/sessions", r.status_code, ok,
        f"{len(sessions)} sessions" if ok else r.text[:100])

    # ── Create session ──
    r = post(h, f"/study-contents/{mat_id}/sessions", {
        "title": "TEST: Sesión de prueba",
        "description": "Desc sesión"
    })
    ok = r.status_code in (200, 201)
    sess_id = None
    if ok:
        sdata = r.json()
        if isinstance(sdata, dict):
            sess_id = sdata.get("id") or sdata.get("session", {}).get("id")
        log_detail = f"id={sess_id}"
    else:
        log_detail = r.text[:200]
    log("Sessions", "Create session", "POST",
        f"{BASE}/study-contents/{mat_id}/sessions", r.status_code, ok,
        log_detail if ok else r.text[:200])

    # ── Get session ──
    if sess_id:
        r = get(h, f"/study-contents/{mat_id}/sessions/{sess_id}")
        ok = r.status_code == 200
        log("Sessions", f"Get session {sess_id}", "GET",
            f"{BASE}/study-contents/{mat_id}/sessions/{sess_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Update session ──
    if sess_id:
        r = put(h, f"/study-contents/{mat_id}/sessions/{sess_id}", {
            "title": "TEST: Sesión actualizada"
        })
        ok = r.status_code == 200
        log("Sessions", f"Update session {sess_id}", "PUT",
            f"{BASE}/study-contents/{mat_id}/sessions/{sess_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    return sess_id


def test_study_topics(h, mat_id, sess_id):
    section("STUDY TOPICS MODULE")
    if not mat_id or not sess_id:
        print("  SKIP: No material_id or session_id available")
        return None

    base_path = f"/study-contents/{mat_id}/sessions/{sess_id}/topics"

    # ── List topics ──
    r = get(h, base_path)
    ok = r.status_code == 200
    topics = []
    if ok:
        data = r.json()
        if isinstance(data, list):
            topics = data
        elif isinstance(data, dict):
            topics = data.get("topics", [])
    log("StudyTopics", f"List study topics", "GET",
        f"{BASE}{base_path}", r.status_code, ok,
        f"{len(topics)} topics" if ok else r.text[:100])

    # ── Create topic ──
    r = post(h, base_path, {
        "title": "TEST: Tema de estudio de prueba",
        "description": "Desc tema",
        "estimated_time_minutes": 15,
        "allow_reading": True,
        "allow_video": True,
        "allow_downloadable": False,
        "allow_interactive": False
    })
    ok = r.status_code in (200, 201)
    topic_id = None
    if ok:
        tdata = r.json()
        if isinstance(tdata, dict):
            topic_id = tdata.get("id") or tdata.get("topic", {}).get("id")
        created_ids["study_topic"] = topic_id
    log("StudyTopics", "Create study topic", "POST",
        f"{BASE}{base_path}", r.status_code, ok,
        f"id={topic_id}" if ok else r.text[:200])

    # ── Get topic ──
    if topic_id:
        r = get(h, f"{base_path}/{topic_id}")
        ok = r.status_code == 200
        log("StudyTopics", f"Get study topic {topic_id}", "GET",
            f"{BASE}{base_path}/{topic_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Update topic ──
    if topic_id:
        r = put(h, f"{base_path}/{topic_id}", {
            "title": "TEST: Tema actualizado"
        })
        ok = r.status_code == 200
        log("StudyTopics", f"Update study topic {topic_id}", "PUT",
            f"{BASE}{base_path}/{topic_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    return topic_id


def test_reading(h, mat_id, sess_id, topic_id):
    section("STUDY READING MODULE")
    if not all([mat_id, sess_id, topic_id]):
        print("  SKIP: Missing IDs")
        return

    base_path = f"/study-contents/{mat_id}/sessions/{sess_id}/topics/{topic_id}/reading"

    # ── Create/update reading (upsert) ──
    r = post(h, base_path, {
        "title": "TEST: Lectura de prueba",
        "content": "# Contenido de prueba\n\nEsto es un **test** automático.",
        "estimated_time_minutes": 10
    })
    ok = r.status_code in (200, 201)
    log("Reading", "Create/update reading", "POST",
        f"{BASE}{base_path}", r.status_code, ok,
        r.text[:200] if not ok else "")

    # ── Delete reading ──
    r = delete(h, base_path)
    ok = r.status_code in (200, 204)
    log("Reading", "Delete reading", "DELETE",
        f"{BASE}{base_path}", r.status_code, ok,
        r.text[:100] if not ok else "")


def test_standards(h):
    section("COMPETENCY STANDARDS MODULE")

    # ── List standards ──
    r = get(h, "/competency-standards/")
    ok = r.status_code == 200
    standards = []
    if ok:
        data = r.json()
        standards = data.get("standards", data if isinstance(data, list) else [])
    log("Standards", "List standards", "GET",
        f"{BASE}/competency-standards/", r.status_code, ok,
        f"{len(standards)} standards" if ok else r.text[:100])

    # ── Get first standard ──
    std_id = None
    if standards and isinstance(standards[0], dict):
        std_id = standards[0].get("id")
        r = get(h, f"/competency-standards/{std_id}")
        ok = r.status_code == 200
        log("Standards", f"Get standard {std_id}", "GET",
            f"{BASE}/competency-standards/{std_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Create standard ──
    unique_code = f"TST{int(time.time()) % 100000:05d}"
    r = post(h, "/competency-standards/", {
        "code": unique_code,
        "name": "TEST: Estándar de prueba automática",
        "description": "Estándar creado por test automático",
        "sector": "Tecnología",
        "level": 3
    })
    ok = r.status_code in (200, 201)
    new_std_id = None
    if ok:
        sdata = r.json()
        new_std_id = sdata.get("id") or sdata.get("standard", {}).get("id")
        created_ids["standard"] = new_std_id
    log("Standards", f"Create standard ({unique_code})", "POST",
        f"{BASE}/competency-standards/", r.status_code, ok,
        f"id={new_std_id}" if ok else r.text[:200])

    # ── Update standard ──
    if new_std_id:
        r = put(h, f"/competency-standards/{new_std_id}", {
            "name": "TEST: Estándar actualizado"
        })
        ok = r.status_code == 200
        log("Standards", f"Update standard {new_std_id}", "PUT",
            f"{BASE}/competency-standards/{new_std_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Check code ──
    r = get(h, "/competency-standards/check-code", {"code": unique_code})
    ok = r.status_code == 200
    log("Standards", f"Check code {unique_code}", "GET",
        f"{BASE}/competency-standards/check-code", r.status_code, ok,
        r.text[:100] if not ok else "")

    return new_std_id


def test_brands(h):
    section("BRANDS MODULE")

    # ── List brands ──
    r = get(h, "/competency-standards/brands")
    ok = r.status_code == 200
    brands = []
    if ok:
        data = r.json()
        brands = data.get("brands", data if isinstance(data, list) else [])
    log("Brands", "List brands", "GET",
        f"{BASE}/competency-standards/brands", r.status_code, ok,
        f"{len(brands)} brands" if ok else r.text[:100])

    # ── Create brand ──
    r = post(h, "/competency-standards/brands", {
        "name": f"TEST Brand {int(time.time()) % 10000}",
        "description": "Marca de prueba automática"
    })
    ok = r.status_code in (200, 201)
    brand_id = None
    if ok:
        bdata = r.json()
        brand_id = bdata.get("id") or bdata.get("brand", {}).get("id")
        created_ids["brand"] = brand_id
    log("Brands", "Create brand", "POST",
        f"{BASE}/competency-standards/brands", r.status_code, ok,
        f"id={brand_id}" if ok else r.text[:200])

    # ── Get brand ──
    if brand_id:
        r = get(h, f"/competency-standards/brands/{brand_id}")
        ok = r.status_code == 200
        log("Brands", f"Get brand {brand_id}", "GET",
            f"{BASE}/competency-standards/brands/{brand_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Update brand ──
    if brand_id:
        r = put(h, f"/competency-standards/brands/{brand_id}", {
            "name": "TEST Brand Updated"
        })
        ok = r.status_code == 200
        log("Brands", f"Update brand {brand_id}", "PUT",
            f"{BASE}/competency-standards/brands/{brand_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    return brand_id


def test_badges(h):
    section("BADGES MODULE")

    # ── List badge templates ──
    r = get(h, "/badges/templates")
    ok = r.status_code == 200
    templates = []
    if ok:
        data = r.json()
        templates = data.get("templates", data if isinstance(data, list) else [])
    log("Badges", "List badge templates", "GET",
        f"{BASE}/badges/templates", r.status_code, ok,
        f"{len(templates)} templates" if ok else r.text[:100])

    # ── Get first template ──
    tmpl_id = None
    if templates and isinstance(templates[0], dict):
        tmpl_id = templates[0].get("id")
        r = get(h, f"/badges/templates/{tmpl_id}")
        ok = r.status_code == 200
        log("Badges", f"Get template {tmpl_id}", "GET",
            f"{BASE}/badges/templates/{tmpl_id}", r.status_code, ok,
            r.text[:100] if not ok else "")

    # ── Get issuer profile ──
    r = get(h, "/badges/issuer")
    ok = r.status_code == 200
    log("Badges", "Get issuer profile", "GET",
        f"{BASE}/badges/issuer", r.status_code, ok,
        r.text[:100] if not ok else "")


def cleanup(h):
    section("CLEANUP - Deleting test data")

    # Delete in reverse dependency order
    for key, label, path_fn in [
        ("step", "Step", lambda id: f"/exams/steps/{id}"),
        ("exercise", "Exercise", lambda id: f"/exams/exercises/{id}"),
        ("question", "Question", lambda id: f"/exams/questions/{id}"),
        ("study_topic", "Study Topic", lambda id: None),  # Deleted with session
        ("session", "Session", lambda id: None),  # Deleted with material
        ("study_material", "Study Material", lambda id: f"/study-contents/{id}"),
        ("standard", "Standard", lambda id: f"/competency-standards/{id}"),
        ("brand", "Brand", lambda id: f"/competency-standards/brands/{id}"),
    ]:
        cid = created_ids.get(key)
        if cid and path_fn(cid) is not None:
            try:
                path = path_fn(cid)
                r = delete(h, path)
                ok = r.status_code in (200, 204)
                status = "deleted" if ok else f"failed ({r.status_code})"
                print(f"  Cleanup {label} {cid}: {status}")
            except Exception as e:
                print(f"  Cleanup {label} {cid}: error - {e}")


def print_summary():
    section("TEST SUMMARY")
    total = len(results)
    passed = sum(1 for r in results if r[2] == "PASS")
    failed = sum(1 for r in results if r[2] == "FAIL")
    print(f"\n  Total: {total}  |  PASS: {passed}  |  FAIL: {failed}\n")

    if failed > 0:
        print("  FAILURES:")
        print("  " + "-" * 56)
        for module, test, tag, status, detail in results:
            if tag == "FAIL":
                print(f"  [{module}] {test}: HTTP {status}")
                if detail:
                    print(f"    → {detail[:120]}")
        print()


def main():
    print("=" * 60)
    print("  EVALUAASI EDITOR - FULL API TEST")
    print("  Target: DEV API")
    print("=" * 60)

    h = login()

    exam_id = test_exams(h)
    cat_id = test_categories(h, exam_id)
    topic_id = test_topics(h, cat_id)
    q_id = test_questions(h, topic_id)
    test_answers(h, q_id)
    ex_id = test_exercises(h, topic_id)
    step_id = test_steps(h, ex_id)
    test_actions(h, step_id)
    mat_id = test_study_contents(h)
    sess_id = test_sessions(h, mat_id)
    study_topic_id = test_study_topics(h, mat_id, sess_id)
    test_reading(h, mat_id, sess_id, study_topic_id)
    new_std_id = test_standards(h)
    test_brands(h)
    test_badges(h)

    cleanup(h)
    print_summary()

    # Exit code for CI
    failed = sum(1 for r in results if r[2] == "FAIL")
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
