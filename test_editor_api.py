"""
Test ALL editor actions against DEV API.
Tests: Exams, Categories, Topics, Questions, Exercises, Study Contents
"""
import requests
import json
import sys

BASE = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
PASS = 0
FAIL = 0
ERRORS = []

def call(name, method, url, json_body=None, expected=(200, 201)):
    global PASS, FAIL
    try:
        r = getattr(requests, method.lower())(url, headers=HEADERS, json=json_body, timeout=30)
        if r.status_code in expected:
            data = r.json() if r.content else {}
            PASS += 1
            print(f"  PASS [{r.status_code}] {name}")
            return data
        else:
            FAIL += 1
            body = r.text[:500]
            ERRORS.append(f"{name}: [{r.status_code}] {body}")
            print(f"  FAIL [{r.status_code}] {name} => {body}")
            return None
    except Exception as e:
        FAIL += 1
        ERRORS.append(f"{name}: EXCEPTION {e}")
        print(f"  FAIL [ERR] {name} => {e}")
        return None

# Login
print("=== LOGIN ===")
login = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=60)
assert login.status_code == 200, f"Login failed: {login.text}"
token = login.json()["access_token"]
HEADERS = {"Authorization": f"Bearer {token}"}
print(f"  OK, token={len(token)} chars\n")

# ========== EXAMS ==========
print("=== EXAM CRUD ===")

# List
call("List Exams", "GET", f"{BASE}/exams")

# Get existing
exams = requests.get(f"{BASE}/exams", headers=HEADERS, timeout=30).json()
exam_ids = [e["id"] for e in exams.get("exams", [])]
print(f"  Available exams: {exam_ids}")
eid = exam_ids[0] if exam_ids else None

if eid:
    call(f"Get Exam {eid}", "GET", f"{BASE}/exams/{eid}")

# Create (need competency_standard)
stds = call("List Standards", "GET", f"{BASE}/standards")
std_id = None
if stds and stds.get("standards"):
    std_id = stds["standards"][0]["id"]
    print(f"  Using standard id: {std_id}")

newexam = call("Create Exam", "POST", f"{BASE}/exams", {
    "name": "TEST_Exam_Python",
    "description": "Test exam",
    "is_active": True,
    "time_limit": 60,
    "stage_id": "practice",
    "competency_standard_id": std_id
})
test_eid = newexam.get("id") if newexam else None
test_cid = None
test_tid = None
print(f"  Created exam: {test_eid}")

if test_eid:
    call("Update Exam", "PUT", f"{BASE}/exams/{test_eid}", {"name": "TEST_Exam_Updated", "description": "Updated"})

# ========== CATEGORIES ==========
print("\n=== CATEGORY CRUD ===")
if eid:
    call(f"List Categories (exam {eid})", "GET", f"{BASE}/exams/{eid}/categories")

if test_eid:
    newcat = call("Create Category", "POST", f"{BASE}/exams/{test_eid}/categories", {"name": "TestCat", "percentage": 100})
    test_cid = newcat.get("id") if newcat else None
    print(f"  Created category: {test_cid}")
    
    if test_cid:
        call("Update Category", "PUT", f"{BASE}/exams/{test_eid}/categories/{test_cid}", {"name": "TestCatUpd", "percentage": 50})

# ========== TOPICS ==========
print("\n=== TOPIC CRUD ===")
if eid:
    cats = requests.get(f"{BASE}/exams/{eid}/categories", headers=HEADERS, timeout=30).json()
    cat_list = cats.get("categories", cats if isinstance(cats, list) else [])
    if cat_list:
        first_cat = cat_list[0]["id"]
        call(f"List Topics (cat {first_cat})", "GET", f"{BASE}/exams/{eid}/categories/{first_cat}/topics")

if test_eid and test_cid:
    newtopic = call("Create Topic", "POST", f"{BASE}/exams/{test_eid}/categories/{test_cid}/topics", {"name": "TestTopic", "percentage": 100})
    test_tid = newtopic.get("id") if newtopic else None
    print(f"  Created topic: {test_tid}")
    
    if test_tid:
        call("Update Topic", "PUT", f"{BASE}/exams/{test_eid}/categories/{test_cid}/topics/{test_tid}", {"name": "TestTopicUpd"})

# ========== QUESTIONS ==========
print("\n=== QUESTION CRUD ===")
if eid:
    call(f"List Questions (exam {eid})", "GET", f"{BASE}/exams/{eid}/questions")

test_qid = None
test_q2id = None
test_q3id = None
if test_eid and test_tid:
    newq = call("Create Question (true_false)", "POST", f"{BASE}/exams/{test_eid}/questions", {
        "text": "Is this a test?",
        "topic_id": test_tid,
        "question_type": "true_false",
        "answers": [
            {"text": "Verdadero", "is_correct": True},
            {"text": "Falso", "is_correct": False}
        ]
    })
    test_qid = newq.get("id") if newq else None
    print(f"  Created question: {test_qid}")
    
    if test_qid:
        call("Get Question", "GET", f"{BASE}/exams/{test_eid}/questions/{test_qid}")
        call("Update Question", "PUT", f"{BASE}/exams/{test_eid}/questions/{test_qid}", {
            "text": "Updated question?",
            "question_type": "true_false"
        })

    # Multiple choice
    newq2 = call("Create Question (multiple_choice)", "POST", f"{BASE}/exams/{test_eid}/questions", {
        "text": "Pick the right answer",
        "topic_id": test_tid,
        "question_type": "multiple_choice",
        "answers": [
            {"text": "Option A", "is_correct": True},
            {"text": "Option B", "is_correct": False},
            {"text": "Option C", "is_correct": False}
        ]
    })
    test_q2id = newq2.get("id") if newq2 else None

    # Ordering
    newq3 = call("Create Question (ordering)", "POST", f"{BASE}/exams/{test_eid}/questions", {
        "text": "Order these items",
        "topic_id": test_tid,
        "question_type": "ordering",
        "answers": [
            {"text": "First", "order_num": 1},
            {"text": "Second", "order_num": 2},
            {"text": "Third", "order_num": 3}
        ]
    })
    test_q3id = newq3.get("id") if newq3 else None

# ========== EXERCISES ==========
print("\n=== EXERCISE CRUD ===")
if eid:
    call(f"List Exercises (exam {eid})", "GET", f"{BASE}/exams/{eid}/exercises")

test_exid = None
if test_eid and test_tid:
    newex = call("Create Exercise", "POST", f"{BASE}/exams/{test_eid}/exercises", {
        "title": "TestExercise",
        "description": "Test exercise",
        "topic_id": test_tid,
        "steps": [
            {
                "title": "Step 1",
                "description": "Do something",
                "order_num": 1,
                "actions": [
                    {"action_type": "click", "label": "Click here", "order_num": 1}
                ]
            }
        ]
    })
    test_exid = newex.get("id") if newex else None
    print(f"  Created exercise: {test_exid}")
    
    if test_exid:
        call("Get Exercise", "GET", f"{BASE}/exams/{test_eid}/exercises/{test_exid}")
        call("Update Exercise", "PUT", f"{BASE}/exams/{test_eid}/exercises/{test_exid}", {
            "title": "TestExercise Updated",
            "description": "Updated desc"
        })

# ========== STUDY CONTENTS ==========
print("\n=== STUDY CONTENT CRUD ===")
call("List Study Contents", "GET", f"{BASE}/study-contents")

newsc = call("Create Study Content", "POST", f"{BASE}/study-contents", {
    "name": "TEST_StudyMaterial",
    "description": "Test study material"
})
test_scid = newsc.get("id") if newsc else None
print(f"  Created study content: {test_scid}")

test_sessid = None
test_stid = None
test_rdid = None
if test_scid:
    call("Get Study Content", "GET", f"{BASE}/study-contents/{test_scid}")
    call("Update Study Content", "PUT", f"{BASE}/study-contents/{test_scid}", {
        "name": "TEST_SC_Updated",
        "description": "Updated"
    })
    
    # Create session
    newsess = call("Create Session", "POST", f"{BASE}/study-contents/{test_scid}/sessions", {
        "title": "Session 1",
        "order_num": 1
    })
    test_sessid = newsess.get("id") if newsess else None
    print(f"  Created session: {test_sessid}")
    
    if test_sessid:
        call("Get Session", "GET", f"{BASE}/study-contents/{test_scid}/sessions/{test_sessid}")
        
        # Create topic
        newst = call("Create Study Topic", "POST", f"{BASE}/study-contents/{test_scid}/sessions/{test_sessid}/topics", {
            "title": "Topic 1",
            "order_num": 1
        })
        test_stid = newst.get("id") if newst else None
        print(f"  Created study topic: {test_stid}")
        
        if test_stid:
            # Create reading
            newrd = call("Create Reading", "POST", f"{BASE}/study-contents/{test_scid}/sessions/{test_sessid}/topics/{test_stid}/readings", {
                "title": "Reading 1",
                "content": "# Test\nSome content",
                "order_num": 1
            })
            test_rdid = newrd.get("id") if newrd else None
            print(f"  Created reading: {test_rdid}")

# ========== CLEANUP ==========
print("\n=== CLEANUP ===")
# Delete questions
for qid in [test_qid, test_q2id, test_q3id]:
    if qid and test_eid:
        call(f"Delete Question {qid}", "DELETE", f"{BASE}/exams/{test_eid}/questions/{qid}")

if test_exid and test_eid:
    call(f"Delete Exercise {test_exid}", "DELETE", f"{BASE}/exams/{test_eid}/exercises/{test_exid}")
if test_tid and test_cid and test_eid:
    call(f"Delete Topic {test_tid}", "DELETE", f"{BASE}/exams/{test_eid}/categories/{test_cid}/topics/{test_tid}")
if test_cid and test_eid:
    call(f"Delete Category {test_cid}", "DELETE", f"{BASE}/exams/{test_eid}/categories/{test_cid}")
if test_eid:
    call(f"Delete Exam {test_eid}", "DELETE", f"{BASE}/exams/{test_eid}")

if test_rdid and test_stid and test_sessid and test_scid:
    call(f"Delete Reading {test_rdid}", "DELETE", f"{BASE}/study-contents/{test_scid}/sessions/{test_sessid}/topics/{test_stid}/readings/{test_rdid}")
if test_stid and test_sessid and test_scid:
    call(f"Delete Study Topic {test_stid}", "DELETE", f"{BASE}/study-contents/{test_scid}/sessions/{test_sessid}/topics/{test_stid}")
if test_sessid and test_scid:
    call(f"Delete Session {test_sessid}", "DELETE", f"{BASE}/study-contents/{test_scid}/sessions/{test_sessid}")
if test_scid:
    call(f"Delete Study Content {test_scid}", "DELETE", f"{BASE}/study-contents/{test_scid}")

# ========== SUMMARY ==========
print(f"\n{'='*60}")
print(f"RESULTS: {PASS} PASSED / {FAIL} FAILED")
if ERRORS:
    print(f"\nFAILED TESTS:")
    for e in ERRORS:
        print(f"  - {e[:200]}")
print(f"{'='*60}")

sys.exit(0 if FAIL == 0 else 1)
