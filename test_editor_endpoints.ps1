$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}' -TimeoutSec 60
$token = $login.access_token
$h = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$results = @()
function Test-Endpoint($name, $method, $url, $body=$null) {
    try {
        $params = @{ Uri = $url; Headers = $h; Method = $method; TimeoutSec = 30 }
        if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10); $params.ContentType = "application/json" }
        $r = Invoke-RestMethod @params
        $info = ""
        if ($r.total -ne $null) { $info = "total=$($r.total)" }
        elseif ($r.Count -ne $null -and $r -is [array]) { $info = "items=$($r.Count)" }
        elseif ($r.id) { $info = "id=$($r.id)" }
        elseif ($r.name) { $info = "name=$($r.name)" }
        Write-Host "  PASS  $name  ($info)" -ForegroundColor Green
        return @{ name=$name; status="PASS"; info=$info; data=$r }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $errMsg = ""
        try { $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $errMsg = $reader.ReadToEnd() } catch {}
        Write-Host "  FAIL  $name  [HTTP $code] $($errMsg.Substring(0, [Math]::Min(200, $errMsg.Length)))" -ForegroundColor Red
        return @{ name=$name; status="FAIL"; code=$code; error=$errMsg }
    }
}

Write-Host "`n========== EXAMS CRUD ==========" -ForegroundColor Cyan

# List exams
$r1 = Test-Endpoint "List Exams" "GET" "$base/exams"

# Get first exam
$examId = 2
$r2 = Test-Endpoint "Get Exam $examId" "GET" "$base/exams/$examId"

# Create exam
$newExam = @{ name="TEST_PS_Exam"; description="Test exam from PS"; is_active=$true; time_limit=60 }
$r3 = Test-Endpoint "Create Exam" "POST" "$base/exams" $newExam
$testExamId = if ($r3.data.id) { $r3.data.id } else { $null }

if ($testExamId) {
    # Update exam
    $upd = @{ name="TEST_PS_Exam_Updated"; description="Updated desc" }
    Test-Endpoint "Update Exam $testExamId" "PUT" "$base/exams/$testExamId" $upd
}

Write-Host "`n========== CATEGORIES CRUD ==========" -ForegroundColor Cyan

# List categories for exam
$r4 = Test-Endpoint "List Categories (exam $examId)" "GET" "$base/exams/$examId/categories"

if ($testExamId) {
    # Create category
    $newCat = @{ name="TEST_Category"; percentage=100 }
    $r5 = Test-Endpoint "Create Category (exam $testExamId)" "POST" "$base/exams/$testExamId/categories" $newCat
    $testCatId = if ($r5.data.id) { $r5.data.id } else { $null }

    if ($testCatId) {
        # Update category
        $updCat = @{ name="TEST_Category_Updated"; percentage=50 }
        Test-Endpoint "Update Category $testCatId" "PUT" "$base/exams/$testExamId/categories/$testCatId" $updCat
    }
}

Write-Host "`n========== TOPICS CRUD ==========" -ForegroundColor Cyan

# Get topics from first category of exam 2
$catData = $r4.data
$firstCatId = if ($catData -and $catData.Count -gt 0) { $catData[0].id } elseif ($catData.id) { $catData.id } else { $null }
if ($firstCatId) {
    $r6 = Test-Endpoint "List Topics (cat $firstCatId)" "GET" "$base/exams/$examId/categories/$firstCatId/topics"
}

if ($testCatId -and $testExamId) {
    $newTopic = @{ name="TEST_Topic"; percentage=100 }
    $r7 = Test-Endpoint "Create Topic" "POST" "$base/exams/$testExamId/categories/$testCatId/topics" $newTopic
    $testTopicId = if ($r7.data.id) { $r7.data.id } else { $null }
}

Write-Host "`n========== QUESTIONS CRUD ==========" -ForegroundColor Cyan

# List questions from exam 2
$r8 = Test-Endpoint "List Questions (exam $examId)" "GET" "$base/exams/$examId/questions"

if ($testTopicId -and $testExamId) {
    # Create question
    $newQ = @{
        text = "TEST question?"
        topic_id = $testTopicId
        question_type = "true_false"
        answers = @(
            @{ text = "True"; is_correct = $true },
            @{ text = "False"; is_correct = $false }
        )
    }
    $r9 = Test-Endpoint "Create Question" "POST" "$base/exams/$testExamId/questions" $newQ
    $testQId = if ($r9.data.id) { $r9.data.id } else { $null }

    if ($testQId) {
        $updQ = @{ text = "TEST question updated?"; question_type = "true_false" }
        Test-Endpoint "Update Question $testQId" "PUT" "$base/exams/$testExamId/questions/$testQId" $updQ
    }
}

Write-Host "`n========== EXERCISES CRUD ==========" -ForegroundColor Cyan

# List exercises from exam 2
$r10 = Test-Endpoint "List Exercises (exam $examId)" "GET" "$base/exams/$examId/exercises"

if ($testTopicId -and $testExamId) {
    $newEx = @{
        title = "TEST Exercise"
        description = "Test exercise desc"
        topic_id = $testTopicId
        steps = @(
            @{
                title = "Step 1"
                description = "Do something"
                order_num = 1
                actions = @(
                    @{ action_type = "click"; label = "Click here"; order_num = 1 }
                )
            }
        )
    }
    $r11 = Test-Endpoint "Create Exercise" "POST" "$base/exams/$testExamId/exercises" $newEx
    $testExId = if ($r11.data.id) { $r11.data.id } else { $null }

    if ($testExId) {
        Test-Endpoint "Get Exercise $testExId" "GET" "$base/exams/$testExamId/exercises/$testExId"
    }
}

Write-Host "`n========== STUDY CONTENTS CRUD ==========" -ForegroundColor Cyan

$r12 = Test-Endpoint "List Study Contents" "GET" "$base/study-contents"

$newSC = @{ name="TEST_StudyMaterial"; description="Test material" }
$r13 = Test-Endpoint "Create Study Content" "POST" "$base/study-contents" $newSC
$testSCId = if ($r13.data.id) { $r13.data.id } else { $null }

if ($testSCId) {
    Test-Endpoint "Get Study Content $testSCId" "GET" "$base/study-contents/$testSCId"
    $updSC = @{ name="TEST_StudyMaterial_Updated" }
    Test-Endpoint "Update Study Content $testSCId" "PUT" "$base/study-contents/$testSCId" $updSC
}

Write-Host "`n========== CLEANUP ==========" -ForegroundColor Cyan

# Cleanup in reverse order
if ($testQId -and $testExamId) { Test-Endpoint "Delete Question $testQId" "DELETE" "$base/exams/$testExamId/questions/$testQId" }
if ($testExId -and $testExamId) { Test-Endpoint "Delete Exercise $testExId" "DELETE" "$base/exams/$testExamId/exercises/$testExId" }
if ($testTopicId -and $testExamId -and $testCatId) { Test-Endpoint "Delete Topic $testTopicId" "DELETE" "$base/exams/$testExamId/categories/$testCatId/topics/$testTopicId" }
if ($testCatId -and $testExamId) { Test-Endpoint "Delete Category $testCatId" "DELETE" "$base/exams/$testExamId/categories/$testCatId" }
if ($testExamId) { Test-Endpoint "Delete Exam $testExamId" "DELETE" "$base/exams/$testExamId" }
if ($testSCId) { Test-Endpoint "Delete Study Content $testSCId" "DELETE" "$base/study-contents/$testSCId" }

Write-Host "`n========== DONE ==========" -ForegroundColor Cyan
