"""
Rutas para gestión de Saldos y Solicitudes de Financiamiento

Endpoints para:
- Coordinadores: ver saldo, solicitar saldo/beca, historial
- Financieros: revisar solicitudes, recomendar aprobación/rechazo
- Gerentes/Admin: aprobar o rechazar solicitudes
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.balance import (
    CoordinatorBalance, 
    BalanceRequest, 
    BalanceTransaction,
    create_balance_transaction,
    REQUEST_STATUS,
    REQUEST_TYPES
)
from app.models.partner import Campus, CandidateGroup
from app.models.activity_log import log_activity_from_request
from datetime import datetime
from functools import wraps
from sqlalchemy import desc, or_

bp = Blueprint('balance', __name__)


# =====================================================
# DECORADORES DE PERMISOS
# =====================================================

def coordinator_required(f):
    """Requiere rol de coordinador"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role not in ['admin', 'gerente', 'coordinator']:
            return jsonify({'error': 'Se requiere rol de coordinador'}), 403
        return f(*args, **kwargs)
    return decorated


def financiero_required(f):
    """Requiere rol de financiero o superior"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role not in ['admin', 'gerente', 'financiero']:
            return jsonify({'error': 'Se requiere rol de financiero'}), 403
        return f(*args, **kwargs)
    return decorated


def approver_required(f):
    """Requiere rol de gerente o admin para aprobar"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role not in ['admin', 'gerente']:
            return jsonify({'error': 'Se requiere rol de gerente o administrador'}), 403
        return f(*args, **kwargs)
    return decorated


# =====================================================
# ENDPOINTS PARA COORDINADORES
# =====================================================

@bp.route('/my-balance', methods=['GET'])
@jwt_required()
@coordinator_required
def get_my_balance():
    """Obtener saldo actual del coordinador logueado"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['coordinator']:
            return jsonify({'error': 'Solo coordinadores tienen saldo'}), 400
        
        balance = CoordinatorBalance.query.filter_by(coordinator_id=user_id).first()
        
        if not balance:
            # Crear balance con 0 si no existe
            balance = CoordinatorBalance(coordinator_id=user_id)
            db.session.add(balance)
            db.session.commit()
        
        return jsonify(balance.to_dict(include_coordinator=True))
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/my-transactions', methods=['GET'])
@jwt_required()
@coordinator_required
def get_my_transactions():
    """Obtener historial de movimientos del coordinador"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['coordinator']:
            return jsonify({'error': 'Solo coordinadores tienen transacciones'}), 400
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = BalanceTransaction.query.filter_by(coordinator_id=user_id)
        query = query.order_by(desc(BalanceTransaction.created_at))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'transactions': [t.to_dict(include_created_by=True) for t in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/my-requests', methods=['GET'])
@jwt_required()
@coordinator_required
def get_my_requests():
    """Obtener solicitudes de saldo del coordinador"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['coordinator']:
            return jsonify({'error': 'Solo coordinadores pueden solicitar saldo'}), 400
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')  # Filtro opcional
        
        query = BalanceRequest.query.filter_by(coordinator_id=user_id)
        
        if status:
            query = query.filter_by(status=status)
        
        query = query.order_by(desc(BalanceRequest.requested_at))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'requests': [r.to_dict(include_campus=True, include_group=True, include_reviewers=True) 
                        for r in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/request', methods=['POST'])
@jwt_required()
@coordinator_required
def create_request():
    """Crear una nueva solicitud de saldo o beca"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['coordinator']:
            return jsonify({'error': 'Solo coordinadores pueden solicitar saldo'}), 400
        
        data = request.get_json()
        
        # Validaciones
        if not data.get('amount_requested'):
            return jsonify({'error': 'Monto solicitado es requerido'}), 400
        if not data.get('justification'):
            return jsonify({'error': 'Justificación es requerida'}), 400
        if not data.get('campus_id'):
            return jsonify({'error': 'Plantel destino es requerido'}), 400
        
        amount = float(data['amount_requested'])
        if amount <= 0:
            return jsonify({'error': 'El monto debe ser mayor a 0'}), 400
        
        # Verificar que el campus existe
        campus = Campus.query.get(data['campus_id'])
        if not campus:
            return jsonify({'error': 'Plantel no encontrado'}), 404
        
        # Verificar grupo si se especifica
        group = None
        if data.get('group_id'):
            group = CandidateGroup.query.get(data['group_id'])
            if not group:
                return jsonify({'error': 'Grupo no encontrado'}), 404
            if group.campus_id != campus.id:
                return jsonify({'error': 'El grupo no pertenece al plantel especificado'}), 400
        
        # Procesar attachments si se proporcionan
        import json
        attachments = data.get('attachments', [])
        attachments_json = json.dumps(attachments) if attachments else None
        
        # Crear solicitud
        balance_request = BalanceRequest(
            coordinator_id=user_id,
            campus_id=campus.id,
            group_id=group.id if group else None,
            request_type=data.get('request_type', 'saldo'),
            amount_requested=amount,
            justification=data['justification'],
            attachments=attachments_json
        )
        
        db.session.add(balance_request)
        
        # Log de actividad
        log_activity_from_request(
            user=user,
            action_type='balance_request',
            entity_type='balance_request',
            entity_id=balance_request.id,
            details={
                'amount': amount,
                'request_type': balance_request.request_type,
                'campus_id': campus.id,
                'campus_name': campus.name,
                'group_id': group.id if group else None,
                'group_name': group.name if group else None
            }
        )
        
        db.session.commit()
        
        return jsonify({
            'message': 'Solicitud creada exitosamente',
            'request': balance_request.to_dict(include_campus=True, include_group=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# =====================================================
# ENDPOINTS PARA FINANCIEROS
# =====================================================

@bp.route('/pending-requests', methods=['GET'])
@jwt_required()
@financiero_required
def get_pending_requests():
    """Obtener solicitudes pendientes de revisión (para financiero)"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', 'pending')  # Por defecto solo pendientes
        request_type = request.args.get('type')  # saldo o beca
        
        query = BalanceRequest.query
        
        # Filtrar por estado
        if status == 'pending':
            query = query.filter_by(status='pending')
        elif status == 'in_review':
            query = query.filter_by(status='in_review')
        elif status == 'all_pending':
            query = query.filter(BalanceRequest.status.in_(['pending', 'in_review']))
        elif status != 'all':
            query = query.filter_by(status=status)
        
        if request_type:
            query = query.filter_by(request_type=request_type)
        
        query = query.order_by(desc(BalanceRequest.requested_at))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'requests': [r.to_dict(include_coordinator=True, include_campus=True, 
                                   include_group=True, include_reviewers=True) 
                        for r in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'stats': {
                'pending': BalanceRequest.query.filter_by(status='pending').count(),
                'in_review': BalanceRequest.query.filter_by(status='in_review').count(),
                'recommended': BalanceRequest.query.filter(
                    BalanceRequest.status.in_(['recommended_approve', 'recommended_reject'])
                ).count()
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/requests/<int:request_id>', methods=['GET', 'OPTIONS'])
@jwt_required(optional=True)
def get_request_detail(request_id):
    """
    Obtener detalle de una solicitud específica.
    Incluye desglose de saldo solicitado y archivos adjuntos.
    """
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Max-Age'] = '86400'
        return response, 200
    
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Autenticación requerida'}), 401
            
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        balance_request = BalanceRequest.query.get_or_404(request_id)
        
        # Verificar permisos: coordinador dueño, financiero, gerente o admin
        if user.role == 'coordinator' and str(balance_request.coordinator_id) != str(user_id):
            return jsonify({'error': 'No tienes permiso para ver esta solicitud'}), 403
        elif user.role not in ['coordinator', 'financiero', 'gerente', 'admin']:
            return jsonify({'error': 'No tienes permiso para ver esta solicitud'}), 403
        
        # Obtener datos completos incluyendo attachments
        result = balance_request.to_dict(
            include_coordinator=True, 
            include_campus=True, 
            include_group=True, 
            include_reviewers=True
        )
        
        # Parsear attachments si existe
        if balance_request.attachments:
            import json
            try:
                result['attachments'] = json.loads(balance_request.attachments)
            except:
                result['attachments'] = []
        else:
            result['attachments'] = []
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/requests/<int:request_id>/review', methods=['PUT', 'OPTIONS'])
@jwt_required(optional=True)
@financiero_required
def review_request(request_id):
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'PUT, OPTIONS')
        return response, 200
    """
    Financiero revisa y recomienda aprobar o rechazar una solicitud.
    También puede solicitar documentación adicional para becas.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        balance_request = BalanceRequest.query.get_or_404(request_id)
        
        # Solo se pueden revisar solicitudes pendientes o en revisión
        if balance_request.status not in ['pending', 'in_review']:
            return jsonify({'error': 'La solicitud ya fue procesada'}), 400
        
        data = request.get_json()
        action = data.get('action')  # 'request_docs', 'recommend_approve', 'recommend_reject'
        
        if action == 'request_docs':
            # Solicitar documentación adicional (para becas)
            if not data.get('documentation_requested'):
                return jsonify({'error': 'Debe especificar qué documentación requiere'}), 400
            
            balance_request.status = 'in_review'
            balance_request.financiero_id = user_id
            balance_request.documentation_requested = data['documentation_requested']
            balance_request.financiero_reviewed_at = datetime.utcnow()
            
            log_activity_from_request(
                user=user,
                action_type='balance_review',
                entity_type='balance_request',
                entity_id=request_id,
                details={'action': 'request_docs', 'docs_requested': data['documentation_requested']}
            )
            
        elif action == 'recommend_approve':
            recommended_amount = data.get('recommended_amount', balance_request.amount_requested)
            
            balance_request.status = 'recommended_approve'
            balance_request.financiero_id = user_id
            balance_request.financiero_notes = data.get('notes', '')
            balance_request.financiero_recommended_amount = float(recommended_amount)
            balance_request.financiero_reviewed_at = datetime.utcnow()
            
            log_activity_from_request(
                user=user,
                action_type='balance_recommend',
                entity_type='balance_request',
                entity_id=request_id,
                details={'action': 'recommend_approve', 'recommended_amount': float(recommended_amount)}
            )
            
        elif action == 'recommend_reject':
            if not data.get('notes'):
                return jsonify({'error': 'Debe proporcionar un motivo para rechazar'}), 400
            
            balance_request.status = 'recommended_reject'
            balance_request.financiero_id = user_id
            balance_request.financiero_notes = data['notes']
            balance_request.financiero_reviewed_at = datetime.utcnow()
            
            log_activity_from_request(
                user=user,
                action_type='balance_recommend',
                entity_type='balance_request',
                entity_id=request_id,
                details={'action': 'recommend_reject', 'reason': data['notes']}
            )
            
        else:
            return jsonify({'error': 'Acción no válida'}), 400
        
        db.session.commit()
        
        return jsonify({
            'message': 'Solicitud actualizada',
            'request': balance_request.to_dict(include_coordinator=True, include_campus=True, 
                                               include_group=True, include_reviewers=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# =====================================================
# ENDPOINTS PARA GERENTES/ADMIN (APROBACIÓN FINAL)
# =====================================================

@bp.route('/requests-for-approval', methods=['GET'])
@jwt_required()
@approver_required
def get_requests_for_approval():
    """Obtener solicitudes recomendadas, listas para aprobación final"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        show_all = request.args.get('show_all', 'false') == 'true'
        
        query = BalanceRequest.query
        
        if not show_all:
            # Por defecto, solo las recomendadas
            query = query.filter(BalanceRequest.status.in_(['recommended_approve', 'recommended_reject']))
        
        query = query.order_by(desc(BalanceRequest.financiero_reviewed_at))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'requests': [r.to_dict(include_coordinator=True, include_campus=True, 
                                   include_group=True, include_reviewers=True) 
                        for r in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'stats': {
                'recommended_approve': BalanceRequest.query.filter_by(status='recommended_approve').count(),
                'recommended_reject': BalanceRequest.query.filter_by(status='recommended_reject').count(),
                'approved': BalanceRequest.query.filter_by(status='approved').count(),
                'rejected': BalanceRequest.query.filter_by(status='rejected').count()
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/requests/<int:request_id>/approve', methods=['PUT', 'OPTIONS'])
@jwt_required(optional=True)
@approver_required
def approve_request(request_id):
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'PUT, OPTIONS')
        return response, 200
    """Gerente/Admin aprueba una solicitud de saldo"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        balance_request = BalanceRequest.query.get_or_404(request_id)
        
        # Solo se pueden aprobar solicitudes recomendadas
        if balance_request.status not in ['recommended_approve', 'recommended_reject', 'pending', 'in_review']:
            return jsonify({'error': 'La solicitud ya fue procesada'}), 400
        
        data = request.get_json()
        
        # Monto a aprobar (puede ser diferente al solicitado o recomendado)
        amount_approved = data.get('amount_approved')
        if amount_approved is None:
            amount_approved = balance_request.financiero_recommended_amount or balance_request.amount_requested
        
        amount_approved = float(amount_approved)
        if amount_approved <= 0:
            return jsonify({'error': 'El monto aprobado debe ser mayor a 0'}), 400
        
        # Actualizar solicitud
        balance_request.status = 'approved'
        balance_request.amount_approved = amount_approved
        balance_request.approved_by_id = user_id
        balance_request.approver_notes = data.get('notes', '')
        balance_request.approved_at = datetime.utcnow()
        
        # Acreditar saldo al coordinador
        is_scholarship = balance_request.request_type == 'beca'
        concept = 'beca' if is_scholarship else 'saldo_aprobado'
        
        transaction, balance = create_balance_transaction(
            coordinator_id=balance_request.coordinator_id,
            transaction_type='credit',
            concept=concept,
            amount=amount_approved,
            reference_type='balance_request',
            reference_id=request_id,
            notes=f"Aprobado por {user.full_name}. {data.get('notes', '')}",
            created_by_id=user_id
        )
        
        # Log de actividad
        log_activity_from_request(
            user=user,
            action_type='balance_approve',
            entity_type='balance_request',
            entity_id=request_id,
            entity_name=f"${amount_approved} para {balance_request.coordinator.full_name}",
            details={
                'amount_requested': float(balance_request.amount_requested),
                'amount_approved': amount_approved,
                'request_type': balance_request.request_type,
                'coordinator_id': balance_request.coordinator_id,
                'new_balance': float(balance.current_balance)
            }
        )
        
        db.session.commit()
        
        return jsonify({
            'message': f'Saldo aprobado: ${amount_approved:,.2f}',
            'request': balance_request.to_dict(include_coordinator=True, include_campus=True, 
                                               include_group=True, include_reviewers=True),
            'new_balance': float(balance.current_balance)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/requests/<int:request_id>/reject', methods=['PUT', 'OPTIONS'])
@jwt_required(optional=True)
@approver_required
def reject_request(request_id):
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'PUT, OPTIONS')
        return response, 200
    """Gerente/Admin rechaza una solicitud de saldo"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        balance_request = BalanceRequest.query.get_or_404(request_id)
        
        if balance_request.status in ['approved', 'rejected']:
            return jsonify({'error': 'La solicitud ya fue procesada'}), 400
        
        data = request.get_json()
        
        if not data.get('notes'):
            return jsonify({'error': 'Debe proporcionar un motivo para rechazar'}), 400
        
        balance_request.status = 'rejected'
        balance_request.approved_by_id = user_id
        balance_request.approver_notes = data['notes']
        balance_request.approved_at = datetime.utcnow()
        
        # Log de actividad
        log_activity_from_request(
            user=user,
            action_type='balance_reject',
            entity_type='balance_request',
            entity_id=request_id,
            entity_name=f"Rechazo: {balance_request.coordinator.full_name}",
            details={
                'amount_requested': float(balance_request.amount_requested),
                'request_type': balance_request.request_type,
                'coordinator_id': balance_request.coordinator_id,
                'reason': data['notes']
            }
        )
        
        db.session.commit()
        
        return jsonify({
            'message': 'Solicitud rechazada',
            'request': balance_request.to_dict(include_coordinator=True, include_campus=True, 
                                               include_group=True, include_reviewers=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# =====================================================
# ENDPOINTS DE REPORTES
# =====================================================

@bp.route('/coordinators', methods=['GET'])
@jwt_required()
@financiero_required
def get_coordinators_balances():
    """Obtener lista de coordinadores con sus saldos (para reportes)"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '')
        low_balance = request.args.get('low_balance', 'false') == 'true'
        
        # Query de coordinadores
        query = User.query.filter_by(role='coordinator', is_active=True)
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(or_(
                User.name.ilike(search_term),
                User.first_surname.ilike(search_term),
                User.email.ilike(search_term)
            ))
        
        coordinators = query.all()
        
        # Obtener saldos
        results = []
        for coord in coordinators:
            balance = CoordinatorBalance.query.filter_by(coordinator_id=coord.id).first()
            current_balance = float(balance.current_balance) if balance else 0
            
            # Filtrar por saldo bajo si se solicita
            if low_balance and current_balance > 1000:  # Umbral de saldo bajo
                continue
            
            results.append({
                'coordinator': {
                    'id': coord.id,
                    'full_name': coord.full_name,
                    'email': coord.email,
                },
                'balance': balance.to_dict() if balance else {
                    'current_balance': 0,
                    'total_received': 0,
                    'total_spent': 0,
                    'total_scholarships': 0
                }
            })
        
        # Paginación manual
        total = len(results)
        start = (page - 1) * per_page
        end = start + per_page
        
        return jsonify({
            'coordinators': results[start:end],
            'total': total,
            'pages': (total + per_page - 1) // per_page,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/adjustments', methods=['POST'])
@jwt_required()
@approver_required
def create_adjustment():
    """Crear un ajuste manual al saldo de un coordinador (devolución, corrección, etc.)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        data = request.get_json()
        
        if not data.get('coordinator_id'):
            return jsonify({'error': 'Coordinador es requerido'}), 400
        if not data.get('amount'):
            return jsonify({'error': 'Monto es requerido'}), 400
        if not data.get('notes'):
            return jsonify({'error': 'Notas/justificación es requerida'}), 400
        
        coordinator = User.query.get(data['coordinator_id'])
        if not coordinator or coordinator.role != 'coordinator':
            return jsonify({'error': 'Coordinador no encontrado'}), 404
        
        amount = float(data['amount'])  # Puede ser positivo o negativo
        transaction_type = 'credit' if amount > 0 else 'debit'
        
        transaction, balance = create_balance_transaction(
            coordinator_id=coordinator.id,
            transaction_type='adjustment',
            concept='ajuste_manual',
            amount=amount,
            notes=data['notes'],
            created_by_id=user_id
        )
        
        # Log de actividad
        log_activity_from_request(
            user=user,
            action_type='balance_adjust' if amount != 0 else 'balance_review',
            entity_type='balance_transaction',
            entity_id=transaction.id,
            entity_name=f"Ajuste ${amount:+,.2f} para {coordinator.full_name}",
            details={
                'amount': amount,
                'coordinator_id': coordinator.id,
                'new_balance': float(balance.current_balance),
                'reason': data['notes']
            }
        )
        
        db.session.commit()
        
        return jsonify({
            'message': f'Ajuste aplicado: ${amount:+,.2f}',
            'transaction': transaction.to_dict(),
            'new_balance': float(balance.current_balance)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/stats', methods=['GET'])
@jwt_required()
@financiero_required
def get_balance_stats():
    """Obtener estadísticas generales de saldos"""
    try:
        from sqlalchemy import func
        
        # Total de saldo actual de todos los coordinadores
        total_balance = db.session.query(func.sum(CoordinatorBalance.current_balance)).scalar() or 0
        total_received = db.session.query(func.sum(CoordinatorBalance.total_received)).scalar() or 0
        total_spent = db.session.query(func.sum(CoordinatorBalance.total_spent)).scalar() or 0
        total_scholarships = db.session.query(func.sum(CoordinatorBalance.total_scholarships)).scalar() or 0
        
        # Conteos
        coordinators_with_balance = CoordinatorBalance.query.filter(
            CoordinatorBalance.current_balance > 0
        ).count()
        
        pending_requests = BalanceRequest.query.filter_by(status='pending').count()
        in_review_requests = BalanceRequest.query.filter_by(status='in_review').count()
        recommended_requests = BalanceRequest.query.filter(
            BalanceRequest.status.in_(['recommended_approve', 'recommended_reject'])
        ).count()
        
        return jsonify({
            'totals': {
                'current_balance': float(total_balance),
                'total_received': float(total_received),
                'total_spent': float(total_spent),
                'total_scholarships': float(total_scholarships)
            },
            'coordinators_with_balance': coordinators_with_balance,
            'requests': {
                'pending': pending_requests,
                'in_review': in_review_requests,
                'awaiting_approval': recommended_requests
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# UPLOAD DE ARCHIVOS ADJUNTOS
# =====================================================

ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'xls', 'xlsx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/upload-attachment', methods=['POST', 'OPTIONS'])
@jwt_required(optional=True)
def upload_attachment():
    """
    Subir archivo adjunto para solicitud de saldo.
    Sube a Azure Blob Storage (cuenta cool) y retorna la URL.
    """
    from flask import make_response
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response, 200
    
    # Para POST, verificar autenticación
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({'error': 'Token de autenticación requerido'}), 401
    
    user = User.query.get(user_id)
    if not user or user.role not in ['admin', 'gerente', 'coordinator']:
        return jsonify({'error': 'No autorizado'}), 403
    
    import json
    from app.utils.azure_storage import AzureStorageService
    from werkzeug.utils import secure_filename
    
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No se proporcionó archivo'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Nombre de archivo vacío'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                'error': f'Tipo de archivo no permitido. Permitidos: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Verificar tamaño
        file.seek(0, 2)  # Ir al final
        file_size = file.tell()
        file.seek(0)  # Volver al inicio
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': f'Archivo demasiado grande. Máximo: 10 MB'}), 400
        
        # Subir a Azure
        storage = AzureStorageService()
        url = storage.upload_file(file, folder='balance-attachments')
        
        if not url:
            return jsonify({'error': 'Error al subir archivo a Azure'}), 500
        
        # Retornar info del archivo
        original_name = secure_filename(file.filename)
        ext = original_name.rsplit('.', 1)[1].lower() if '.' in original_name else ''
        
        return jsonify({
            'success': True,
            'attachment': {
                'name': original_name,
                'url': url,
                'type': ext,
                'size': file_size
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/request/<int:request_id>/attachments', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_request_attachments(request_id):
    """
    Actualizar los archivos adjuntos de una solicitud.
    Solo el coordinador dueño puede actualizar mientras está pendiente.
    """
    import json
    
    try:
        user_id = get_jwt_identity()
        
        balance_request = BalanceRequest.query.get(request_id)
        if not balance_request:
            return jsonify({'error': 'Solicitud no encontrada'}), 404
        
        # Verificar propiedad y estado
        if balance_request.coordinator_id != user_id:
            return jsonify({'error': 'No tienes permiso para modificar esta solicitud'}), 403
        
        if balance_request.status not in ['pending', 'in_review']:
            return jsonify({'error': 'No se pueden modificar adjuntos de solicitudes procesadas'}), 400
        
        data = request.get_json()
        attachments = data.get('attachments', [])
        
        # Validar estructura
        for att in attachments:
            if not all(k in att for k in ['name', 'url', 'type', 'size']):
                return jsonify({'error': 'Estructura de adjunto inválida'}), 400
        
        # Guardar
        balance_request.attachments = json.dumps(attachments) if attachments else None
        balance_request.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'attachments': attachments
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
