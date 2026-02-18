"""
Modelos de base de datos
"""
from app.models.user import User
from app.models.exam import Exam
from app.models.category import Category
from app.models.topic import Topic
from app.models.question import Question
from app.models.answer import Answer
from app.models.exercise import Exercise, ExerciseStep, ExerciseAction
from app.models.voucher import Voucher
from app.models.result import Result
from app.models.study_content import (
    StudyMaterial,
    StudySession,
    StudyTopic,
    StudyReading,
    StudyVideo,
    StudyDownloadableExercise,
    StudyInteractiveExercise,
    StudyInteractiveExerciseStep,
    StudyInteractiveExerciseAction
)
from app.models.student_progress import (
    StudentContentProgress,
    StudentTopicProgress
)
from app.models.conocer_certificate import ConocerCertificate
from app.models.conocer_upload import ConocerUploadBatch, ConocerUploadLog
from app.models.competency_standard import CompetencyStandard, DeletionRequest
from app.models.brand import Brand
from app.models.vm_session import VmSession
from app.models.partner import (
    Partner,
    PartnerStatePresence,
    Campus,
    SchoolCycle,
    CandidateGroup,
    GroupMember,
    GroupExam,
    GroupExamMaterial,
    GroupStudyMaterial,
    GroupStudyMaterialMember,
    EcmCandidateAssignment,
    MEXICAN_STATES,
    user_partners
)
from app.models.balance import (
    CoordinatorBalance,
    BalanceRequest,
    BalanceTransaction,
    create_balance_transaction,
    REQUEST_STATUS,
    REQUEST_TYPES,
    TRANSACTION_TYPES,
    TRANSACTION_CONCEPTS
)
from app.models.activity_log import (
    ActivityLog,
    log_activity,
    log_activity_from_request,
    get_request_info,
    ACTION_TYPES,
    ENTITY_TYPES,
    PERSONAL_ROLES
)

__all__ = [
    'User',
    'Exam',
    'Category',
    'Topic',
    'Question',
    'Answer',
    'Exercise',
    'ExerciseStep',
    'ExerciseAction',
    'Voucher',
    'Result',
    'StudyMaterial',
    'StudySession',
    'StudyTopic',
    'StudyReading',
    'StudyVideo',
    'StudyDownloadableExercise',
    'StudyInteractiveExercise',
    'StudyInteractiveExerciseStep',
    'StudyInteractiveExerciseAction',
    'StudentContentProgress',
    'StudentTopicProgress',
    'ConocerCertificate',
    'ConocerUploadBatch',
    'ConocerUploadLog',
    'CompetencyStandard',
    'DeletionRequest',
    'Brand',
    'VmSession',
    'Partner',
    'PartnerStatePresence',
    'Campus',
    'CandidateGroup',
    'GroupMember',
    'GroupExam',
    'GroupExamMaterial',
    'GroupStudyMaterial',
    'GroupStudyMaterialMember',
    'EcmCandidateAssignment',
    'MEXICAN_STATES',
    'user_partners',
    # Balance models
    'CoordinatorBalance',
    'BalanceRequest',
    'BalanceTransaction',
    'create_balance_transaction',
    'REQUEST_STATUS',
    'REQUEST_TYPES',
    'TRANSACTION_TYPES',
    'TRANSACTION_CONCEPTS',
    # Activity log models
    'ActivityLog',
    'log_activity',
    'log_activity_from_request',
    'get_request_info',
    'ACTION_TYPES',
    'ENTITY_TYPES',
    'PERSONAL_ROLES'
]
