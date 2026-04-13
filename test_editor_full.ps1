$ErrorActionPreference = "Continue"
$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}' -TimeoutSec 60
$token = $login.access_token
$h = @{ Authorization = "Bearer $token" }

function Call($name, $method, $url, $jsonBody=$null) {
    try {
        $params = @{ Uri = $url; Headers = $h; Method = $method; TimeoutSec = 30 }
        if ($jsonBody) { $params.Body = $jsonBody; $params.ContentType = "application/json" }
        $r = Invoke-WebRequest @params -UseBasicParsing
        $data = $r.Content | ConvertFrom-Json
        Write-Host "PASS [$($r.StatusCode)] $name"
        return $data
    } catch {
        $code = "?"
        $errBody = ""
        try { $code = $_.Exception.Response.StatusCode.value__; $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $errBody = $reader.ReadToEnd() } catch {}
        Write-Host "FAIL [$code] $name => $($errBody.Substring(0, [Math]::Min(300, $errBody.Length)))"
        return $null
    }
}

Write-Host "=== EXAM CRUD ==="

# CREATE
$r1 = Call "Create Exam" "POST" "$base/exams" '{"name":"TEST_PS_Exam","description":"Test","is_active":true,"time_limit":60}'
$eid = if ($r1) { $r1.id } else { $null }
Write-Host "  Created exam id: $eid"

if ($eid) {
    # UPDATE
    Call "Update Exam" "PUT" "$base/exams/$eid" '{"name":"TEST_PS_Updated","description":"Updated"}'
    
    # CREATE CATEGORY
    $r2 = Call "Create Category" "POST" "$base/exams/$eid/categories" '{"name":"TestCat","percentage":100}'
    $cid = if ($r2) { $r2.id } else { $null }
    Write-Host "  Created cat id: $cid"
    
    if ($cid) {
        Call "Update Category" "PUT" "$base/exams/$eid/categories/$cid" '{"name":"TestCatUpd","percentage":50}'
        
        # CREATE TOPIC
        $r3 = Call "Create Topic" "POST" "$base/exams/$eid/categories/$cid/topics" '{"name":"TestTopic","percentage":100}'
        $tid = if ($r3) { $r3.id } else { $null }
        Write-Host "  Created topic id: $tid"
        
        if ($tid) {
            Call "Update Topic" "PUT" "$base/exams/$eid/categories/$cid/topics/$tid" '{"name":"TestTopicUpd","percentage":50}'
            
            # CREATE QUESTION  
            $qBody = '{"text":"Is this a test?","topic_id":' + $tid + ',"question_type":"true_false","answers":[{"text":"True","is_correct":true},{"text":"False","is_correct":false}]}'
            $r4 = Call "Create Question" "POST" "$base/exams/$eid/questions" $qBody
            $qid = if ($r4) { $r4.id } else { $null }
            Write-Host "  Created question id: $qid"
            
            if ($qid) {
                Call "Get Question" "GET" "$base/exams/$eid/questions/$qid"
                Call "Update Question" "PUT" "$base/exams/$eid/questions/$qid" '{"text":"Updated question?","question_type":"true_false"}'
            }
            
            # CREATE EXERCISE
            $exBody = '{"title":"TestExercise","description":"Test ex","topic_id":' + $tid + ',"steps":[{"title":"Step1","description":"Do stuff","order_num":1,"actions":[{"action_type":"click","label":"Click","order_num":1}]}]}'
            $r5 = Call "Create Exercise" "POST" "$base/exams/$eid/exercises" $exBody
            $exid = if ($r5) { $r5.id } else { $null }
            Write-Host "  Created exercise id: $exid"
            
            if ($exid) {
                Call "Get Exercise" "GET" "$base/exams/$eid/exercises/$exid"
            }
        }
    }
}

Write-Host "`n=== STUDY CONTENT CRUD ==="
$r6 = Call "Create Study Content" "POST" "$base/study-contents" '{"name":"TEST_SC","description":"Test material"}'
$scid = if ($r6) { $r6.id } else { $null }
Write-Host "  Created study content id: $scid"

if ($scid) {
    Call "Get Study Content" "GET" "$base/study-contents/$scid"
    Call "Update Study Content" "PUT" "$base/study-contents/$scid" '{"name":"TEST_SC_Updated"}'

    # Create session
    $sessBody = '{"title":"Session 1","order_num":1,"study_material_id":' + $scid + '}'
    $r7 = Call "Create Session" "POST" "$base/study-contents/$scid/sessions" $sessBody
    $sessid = if ($r7) { $r7.id } else { $null }
    Write-Host "  Created session id: $sessid"
    
    if ($sessid) {
        # Create topic in session
        $stBody = '{"title":"Topic 1","order_num":1}'
        $r8 = Call "Create Study Topic" "POST" "$base/study-contents/$scid/sessions/$sessid/topics" $stBody
        $stid = if ($r8) { $r8.id } else { $null }
        Write-Host "  Created study topic id: $stid"
    }
}

Write-Host "`n=== CLEANUP ==="
if ($qid -and $eid) { Call "Delete Question" "DELETE" "$base/exams/$eid/questions/$qid" }
if ($exid -and $eid) { Call "Delete Exercise" "DELETE" "$base/exams/$eid/exercises/$exid" }
if ($tid -and $cid -and $eid) { Call "Delete Topic" "DELETE" "$base/exams/$eid/categories/$cid/topics/$tid" }
if ($cid -and $eid) { Call "Delete Category" "DELETE" "$base/exams/$eid/categories/$cid" }
if ($eid) { Call "Delete Exam" "DELETE" "$base/exams/$eid" }
if ($stid -and $sessid -and $scid) { Call "Delete Study Topic" "DELETE" "$base/study-contents/$scid/sessions/$sessid/topics/$stid" }
if ($sessid -and $scid) { Call "Delete Session" "DELETE" "$base/study-contents/$scid/sessions/$sessid" }
if ($scid) { Call "Delete Study Content" "DELETE" "$base/study-contents/$scid" }

Write-Host "`n=== DONE ==="
