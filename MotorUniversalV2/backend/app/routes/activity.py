"""
Rutas para el Portal de Gerencia - Log de Actividad

Endpoints para:
- Ver actividad de usuarios tipo "personal"
- Filtrar por usuario, acción, entidad, fecha
- Dashboard de resumen
"""
from flask import Blueprint, request, jsonify
from werkzeug.exceptions import HTTPException
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.activity_log import (
    ActivityLog, 
    ACTION_TYPES, 
    ENTITY_TYPES, 
    PERSONAL_ROLES,
    log_activity_from_request
)
from datetime import datetime, timedelta
from functools import wraps
from sqlalchemy import desc, func, or_, and_

bp = Blueprint('activity', __name__)


# =====================================================
# DECORADORES DE PERMISOS
# =====================================================

def gerente_required(f):
    """Requiere rol de gerente, developer o admin"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role not in ['admin', 'developer', 'gerente']:
            return jsonify({'error': 'Se requiere rol de gerente o administrador'}), 403
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Requiere rol de admin o developer"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role not in ['admin', 'developer']:
            return jsonify({'error': 'Se requiere rol de administrador'}), 403
        return f(*args, **kwargs)
    return decorated


# =====================================================
# ENDPOINTS DE LOGS
# =====================================================

@bp.route('/logs', methods=['GET'])
@jwt_required()
@gerente_required
def get_activity_logs():
    """
    Obtener logs de actividad con filtros.
    El gerente ve actividad de personal (no admin).
    El admin ve todo.
    """
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Filtros
        user_filter = request.args.get('user_id')
        action_filter = request.args.get('action_type')
        entity_filter = request.args.get('entity_type')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        success_filter = request.args.get('success')
        search = request.args.get('search', '')
        
        query = ActivityLog.query
        
        # El gerente no puede ver actividad de candidatos, responsables ni responsables de partner
        excluded_roles = ['candidato', 'responsable', 'responsable_partner']
        if current_user.role == 'gerente':
            query = query.filter(~ActivityLog.user_role.in_(excluded_roles))
        
        # Aplicar filtros
        if user_filter:
            query = query.filter_by(user_id=user_filter)
        
        if action_filter:
            query = query.filter_by(action_type=action_filter)
        
        if entity_filter:
            query = query.filter_by(entity_type=entity_filter)
        
        if date_from:
            try:
                date_from_dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                query = query.filter(ActivityLog.created_at >= date_from_dt)
            except:
                pass
        
        if date_to:
            try:
                date_to_dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                query = query.filter(ActivityLog.created_at <= date_to_dt)
            except:
                pass
        
        if success_filter is not None:
            query = query.filter_by(success=success_filter.lower() == 'true')
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(or_(
                ActivityLog.user_email.ilike(search_term),
                ActivityLog.entity_name.ilike(search_term),
                ActivityLog.details.ilike(search_term)
            ))
        
        # Ordenar por fecha descendente
        query = query.order_by(desc(ActivityLog.created_at))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'logs': [log.to_dict(include_user=True) for log in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'filters_available': {
                'action_types': ACTION_TYPES,
                'entity_types': ENTITY_TYPES
            }
        })
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/logs/user/<user_id>', methods=['GET'])
@jwt_required()
@gerente_required
def get_user_activity(user_id):
    """Obtener actividad de un usuario específico"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        target_user = User.query.get_or_404(user_id)
        
        # El gerente no puede ver actividad del admin
        if current_user.role == 'gerente' and target_user.role == 'admin':
            return jsonify({'error': 'No tiene permiso para ver esta información'}), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        query = ActivityLog.query.filter_by(user_id=user_id)
        query = query.order_by(desc(ActivityLog.created_at))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'user': {
                'id': target_user.id,
                'full_name': target_user.full_name,
                'email': target_user.email,
                'role': target_user.role
            },
            'logs': [log.to_dict() for log in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/summary', methods=['GET'])
@jwt_required()
@gerente_required
def get_activity_summary():
    """Obtener resumen de actividad para el dashboard del gerente"""
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        # Período para el resumen
        days = request.args.get('days', 7, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        query = ActivityLog.query.filter(ActivityLog.created_at >= start_date)
        
        # El gerente no puede ver actividad de candidatos, responsables ni responsables de partner
        excluded_roles = ['candidato', 'responsable', 'responsable_partner']
        if current_user.role == 'gerente':
            query = query.filter(~ActivityLog.user_role.in_(excluded_roles))
        
        # Conteos por tipo de acción
        action_counts = db.session.query(
            ActivityLog.action_type,
            func.count(ActivityLog.id)
        ).filter(
            ActivityLog.created_at >= start_date
        ).group_by(ActivityLog.action_type).all()
        
        # Conteos por usuario
        user_counts = db.session.query(
            ActivityLog.user_id,
            ActivityLog.user_email,
            func.count(ActivityLog.id)
        ).filter(
            ActivityLog.created_at >= start_date
        )
        
        if current_user.role == 'gerente':
            user_counts = user_counts.filter(~ActivityLog.user_role.in_(excluded_roles))
        
        user_counts = user_counts.group_by(
            ActivityLog.user_id, ActivityLog.user_email
        ).order_by(desc(func.count(ActivityLog.id))).limit(10).all()
        
        # Logins fallidos (seguridad)
        failed_logins = ActivityLog.query.filter(
            ActivityLog.action_type == 'login_failed',
            ActivityLog.created_at >= start_date
        ).count()
        
        # Acciones de hoy
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_query = ActivityLog.query.filter(ActivityLog.created_at >= today_start)
        if current_user.role == 'gerente':
            today_query = today_query.filter(~ActivityLog.user_role.in_(excluded_roles))
        today_count = today_query.count()
        
        # Últimas acciones importantes
        important_actions = ['balance_approve', 'balance_reject', 'user_create', 'user_deactivate', 
                           'group_delete', 'campus_deactivate', 'login_failed']
        recent_important = ActivityLog.query.filter(
            ActivityLog.action_type.in_(important_actions),
            ActivityLog.created_at >= start_date
        )
        if current_user.role == 'gerente':
            recent_important = recent_important.filter(~ActivityLog.user_role.in_(excluded_roles))
        recent_important = recent_important.order_by(desc(ActivityLog.created_at)).limit(10).all()
        
        return jsonify({
            'period_days': days,
            'total_actions': query.count(),
            'today_actions': today_count,
            'failed_logins': failed_logins,
            'actions_by_type': {
                action_type: count for action_type, count in action_counts
            },
            'top_users': [
                {'user_id': uid, 'email': email, 'action_count': count}
                for uid, email, count in user_counts
            ],
            'recent_important': [log.to_dict(include_user=True) for log in recent_important]
        })
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/personal-users', methods=['GET'])
@jwt_required()
@gerente_required
def get_personal_users():
    """Obtener lista de usuarios tipo 'personal' para filtros"""
    try:
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        # Roles visibles para el gerente (todos menos candidato, responsable, responsable_partner)
        visible_roles = ['admin', 'developer', 'gerente', 'financiero', 'coordinator', 'editor', 'editor_invitado', 'soporte', 'auxiliar']
        
        users = User.query.filter(
            User.role.in_(visible_roles),
            User.is_active == True
        ).order_by(User.name).all()
        
        return jsonify({
            'users': [{
                'id': u.id,
                'full_name': u.full_name,
                'email': u.email,
                'role': u.role
            } for u in users],
            'roles': visible_roles
        })
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# ENDPOINTS DE SEGURIDAD
# =====================================================

@bp.route('/security-report', methods=['GET'])
@jwt_required()
@gerente_required
def get_security_report():
    """Reporte de seguridad: logins fallidos, IPs sospechosas, etc."""
    try:
        days = request.args.get('days', 7, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Logins fallidos agrupados por IP
        failed_by_ip = db.session.query(
            ActivityLog.ip_address,
            func.count(ActivityLog.id).label('count')
        ).filter(
            ActivityLog.action_type == 'login_failed',
            ActivityLog.created_at >= start_date
        ).group_by(ActivityLog.ip_address).having(
            func.count(ActivityLog.id) >= 3  # 3+ intentos fallidos
        ).order_by(desc('count')).limit(20).all()
        
        # Logins fallidos agrupados por usuario
        failed_by_user = db.session.query(
            ActivityLog.user_email,
            func.count(ActivityLog.id).label('count')
        ).filter(
            ActivityLog.action_type == 'login_failed',
            ActivityLog.created_at >= start_date
        ).group_by(ActivityLog.user_email).having(
            func.count(ActivityLog.id) >= 3
        ).order_by(desc('count')).limit(20).all()
        
        # Acciones fuera de horario laboral (antes de 7am o después de 10pm)
        # Esto es una heurística simple
        off_hours_actions = ActivityLog.query.filter(
            ActivityLog.created_at >= start_date,
            or_(
                func.extract('hour', ActivityLog.created_at) < 7,
                func.extract('hour', ActivityLog.created_at) >= 22
            )
        ).count()
        
        # Últimos logins fallidos
        recent_failed = ActivityLog.query.filter(
            ActivityLog.action_type == 'login_failed',
            ActivityLog.created_at >= start_date
        ).order_by(desc(ActivityLog.created_at)).limit(20).all()
        
        return jsonify({
            'period_days': days,
            'suspicious_ips': [
                {'ip': ip, 'failed_attempts': count}
                for ip, count in failed_by_ip
            ],
            'users_with_failed_logins': [
                {'email': email, 'failed_attempts': count}
                for email, count in failed_by_user
            ],
            'off_hours_actions': off_hours_actions,
            'recent_failed_logins': [log.to_dict() for log in recent_failed]
        })

    except HTTPException:

        raise

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# ACTIVIDAD DE EDITORES
# =====================================================

@bp.route('/editor-activity', methods=['GET'])
@jwt_required()
@gerente_required
def get_editor_activity():
    """Actividad reciente de editores: exámenes y materiales creados/actualizados."""
    try:
        from app.models.exam import Exam
        from app.models.study_content import StudyMaterial
        from app.models.question import Question

        days = request.args.get('days', 30, type=int)
        limit_items = request.args.get('limit', 20, type=int)
        since = datetime.utcnow() - timedelta(days=days)

        editor_roles = ('editor', 'editor_invitado')

        # --- Editors list with stats ---
        editors = User.query.filter(User.role.in_(editor_roles), User.is_active == True).all()
        editors_data = []
        for ed in editors:
            exams_created = Exam.query.filter(Exam.created_by == ed.id).count()
            exams_updated = Exam.query.filter(
                Exam.updated_by == ed.id, Exam.updated_by != Exam.created_by
            ).count()
            materials_created = StudyMaterial.query.filter(StudyMaterial.created_by == ed.id).count()
            questions_created = Question.query.filter(Question.created_by == ed.id).count()
            editors_data.append({
                'id': ed.id,
                'name': ed.full_name,
                'email': ed.email,
                'role': ed.role,
                'exams_created': exams_created,
                'exams_updated': exams_updated,
                'materials_created': materials_created,
                'questions_created': questions_created,
                'total_contributions': exams_created + materials_created + questions_created,
            })
        editors_data.sort(key=lambda x: x['total_contributions'], reverse=True)

        # --- Recent items (exams + materials merged timeline) ---
        recent_exams = (
            db.session.query(Exam, User)
            .join(User, Exam.created_by == User.id)
            .filter(User.role.in_(editor_roles), Exam.updated_at >= since)
            .order_by(desc(Exam.updated_at))
            .limit(limit_items)
            .all()
        )
        recent_materials = (
            db.session.query(StudyMaterial, User)
            .join(User, StudyMaterial.created_by == User.id)
            .filter(User.role.in_(editor_roles), StudyMaterial.updated_at >= since)
            .order_by(desc(StudyMaterial.updated_at))
            .limit(limit_items)
            .all()
        )

        timeline = []
        for exam, user in recent_exams:
            is_new = exam.created_at and exam.updated_at and abs((exam.updated_at - exam.created_at).total_seconds()) < 60
            timeline.append({
                'type': 'exam',
                'action': 'created' if is_new else 'updated',
                'id': exam.id,
                'name': exam.name,
                'is_published': exam.is_published,
                'editor_name': user.full_name,
                'editor_email': user.email,
                'date': exam.updated_at.isoformat() if exam.updated_at else None,
            })
        for mat, user in recent_materials:
            is_new = mat.created_at and mat.updated_at and abs((mat.updated_at - mat.created_at).total_seconds()) < 60
            timeline.append({
                'type': 'material',
                'action': 'created' if is_new else 'updated',
                'id': mat.id,
                'name': mat.title,
                'is_published': mat.is_published,
                'editor_name': user.full_name,
                'editor_email': user.email,
                'date': mat.updated_at.isoformat() if mat.updated_at else None,
            })

        timeline.sort(key=lambda x: x['date'] or '', reverse=True)
        timeline = timeline[:limit_items]

        # --- Summary counts ---
        total_exams = Exam.query.join(User, Exam.created_by == User.id).filter(User.role.in_(editor_roles)).count()
        published_exams = Exam.query.join(User, Exam.created_by == User.id).filter(
            User.role.in_(editor_roles), Exam.is_published == True
        ).count()
        total_materials = StudyMaterial.query.join(User, StudyMaterial.created_by == User.id).filter(
            User.role.in_(editor_roles)
        ).count()
        published_materials = StudyMaterial.query.join(User, StudyMaterial.created_by == User.id).filter(
            User.role.in_(editor_roles), StudyMaterial.is_published == True
        ).count()
        total_questions = Question.query.join(User, Question.created_by == User.id).filter(
            User.role.in_(editor_roles)
        ).count()

        return jsonify({
            'editors': editors_data,
            'timeline': timeline,
            'summary': {
                'total_editors': len(editors_data),
                'total_exams': total_exams,
                'published_exams': published_exams,
                'total_materials': total_materials,
                'published_materials': published_materials,
                'total_questions': total_questions,
            }
        })

    except HTTPException:
        raise

    except Exception as e:
        return jsonify({'error': str(e)}), 500
