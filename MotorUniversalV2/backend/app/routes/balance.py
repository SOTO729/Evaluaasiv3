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
from app.models.partner import Campus, CandidateGroup, GroupExam, GroupExamMember
from app.models.activity_log import log_activity_from_request
from datetime import datetime
from functools import wraps
from sqlalchemy import desc, or_, func

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
        if not user or user.role not in ['admin', 'developer', 'gerente', 'coordinator']:
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
        if not user or user.role not in ['admin', 'developer', 'gerente', 'financiero']:
            return jsonify({'error': 'Se requiere rol de financiero'}), 403
        return f(*args, **kwargs)
    return decorated


def approver_required(f):
    """Requiere rol de gerente o admin para aprobar, o financiero delegado"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        # Gerente, admin y developer siempre pueden aprobar
        # Financiero solo si tiene delegación activa (can_approve_balance)
        is_delegated_financiero = user and user.role == 'financiero' and user.can_approve_balance
        if not user or (user.role not in ['admin', 'developer', 'gerente'] and not is_delegated_financiero):
            return jsonify({'error': 'Se requiere rol de gerente o administrador, o estar delegado como aprobador'}), 403
        return f(*args, **kwargs)
    return decorated


# =====================================================
# ENDPOINTS PARA COORDINADORES
# =====================================================

@bp.route('/my-balance', methods=['GET'])
@jwt_required()
@coordinator_required
def get_my_balance():
    """Obtener saldos del coordinador logueado (por grupo)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['coordinator']:
            return jsonify({'error': 'Solo coordinadores tienen saldo'}), 400
        
        # Obtener todos los balances por grupo
        balances = CoordinatorBalance.query.filter_by(coordinator_id=user_id).all()
        
        # Calcular totales globales
        total_balance = sum(float(b.current_balance or 0) for b in balances)
        total_received = sum(float(b.total_received or 0) for b in balances)
        total_spent = sum(float(b.total_spent or 0) for b in balances)
        total_scholarships = sum(float(b.total_scholarships or 0) for b in balances)
        
        return jsonify({
            'balances': [b.to_dict(include_group=True) for b in balances],
            'totals': {
                'current_balance': total_balance,
                'total_received': total_received,
                'total_spent': total_spent,
                'total_scholarships': total_scholarships,
            },
            'coordinator': {
                'id': user.id,
                'name': user.name,
                'first_surname': user.first_surname,
                'full_name': user.full_name,
                'email': user.email,
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        return jsonify({'error': str(e)}), 500


@bp.route('/my-transactions', methods=['GET'])
@jwt_required()
@coordinator_required
def get_my_transactions():
    """Obtener historial de movimientos del coordinador (filtrable por grupo)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['coordinator']:
            return jsonify({'error': 'Solo coordinadores tienen transacciones'}), 400
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        group_id = request.args.get('group_id', type=int)
        
        query = BalanceTransaction.query.filter_by(coordinator_id=user_id)
        
        if group_id:
            query = query.filter_by(group_id=group_id)
        
        query = query.order_by(desc(BalanceTransaction.created_at))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'transactions': [t.to_dict(include_created_by=True, include_group=True) for t in pagination.items],
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
        if not data.get('group_id'):
            return jsonify({'error': 'Grupo destino es requerido'}), 400
        
        amount = float(data['amount_requested'])
        if amount <= 0:
            return jsonify({'error': 'El monto debe ser mayor a 0'}), 400
        
        # Verificar que el campus existe
        campus = Campus.query.get(data['campus_id'])
        if not campus:
            return jsonify({'error': 'Plantel no encontrado'}), 404
        
        # Verificar grupo (obligatorio)
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
            group_id=group.id,
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
        
        # Enviar email a gerentes si NO hay delegación activa
        try:
            has_delegation = User.query.filter_by(
                role='financiero', is_active=True, can_approve_balance=True
            ).first() is not None
            
            if not has_delegation:
                from app.services.email_service import send_balance_approval_email
                gerentes = User.query.filter_by(role='gerente', is_active=True).all()
                coordinator_name = user.full_name or user.name or 'Coordinador'
                campus_name = campus.name if campus else 'N/A'
                group_name = group.name if group else 'N/A'
                
                for gerente in gerentes:
                    if gerente.email:
                        send_balance_approval_email(
                            gerente_email=gerente.email,
                            gerente_name=gerente.full_name or gerente.name or 'Gerente',
                            gerente_id=str(gerente.id),
                            request_id=balance_request.id,
                            coordinator_name=coordinator_name,
                            campus_name=campus_name,
                            amount=amount,
                            request_type=balance_request.request_type or 'recarga',
                            justification=data['justification'],
                            has_financiero_review=False,
                        )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error enviando email de nueva solicitud a gerente: {e}")
        
        return jsonify({
            'message': 'Solicitud creada exitosamente',
            'request': balance_request.to_dict(include_campus=True, include_group=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/request-batch', methods=['POST'])
@jwt_required()
@coordinator_required
def create_request_batch():
    """Crear múltiples solicitudes de saldo/beca y enviar UN solo email consolidado por gerente."""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if user.role not in ['coordinator']:
            return jsonify({'error': 'Solo coordinadores pueden solicitar saldo'}), 400

        data = request.get_json()
        items = data.get('items', [])
        justification = (data.get('justification') or '').strip()

        if not items:
            return jsonify({'error': 'Se requiere al menos un ítem'}), 400
        if not justification:
            return jsonify({'error': 'Justificación es requerida'}), 400

        import json as _json
        attachments = data.get('attachments', [])
        attachments_json = _json.dumps(attachments) if attachments else None

        created_requests = []        # BalanceRequest objects
        email_items = []             # dicts for the email table

        for item in items:
            campus_id = item.get('campus_id')
            group_id = item.get('group_id')
            amount = float(item.get('amount_requested', 0))
            request_type = item.get('request_type', 'saldo')

            if amount <= 0:
                continue

            campus = Campus.query.get(campus_id)
            if not campus:
                continue
            group = CandidateGroup.query.get(group_id) if group_id else None
            if group and group.campus_id != campus.id:
                continue

            balance_request = BalanceRequest(
                coordinator_id=user_id,
                campus_id=campus.id,
                group_id=group.id if group else None,
                request_type=request_type,
                amount_requested=amount,
                justification=justification,
                attachments=attachments_json,
            )
            db.session.add(balance_request)
            db.session.flush()  # get id

            log_activity_from_request(
                user=user,
                action_type='balance_request',
                entity_type='balance_request',
                entity_id=balance_request.id,
                details={
                    'amount': amount,
                    'request_type': request_type,
                    'campus_id': campus.id,
                    'campus_name': campus.name,
                    'group_id': group.id if group else None,
                    'group_name': group.name if group else None,
                    'batch': True,
                },
            )

            created_requests.append(balance_request)
            email_items.append({
                'request_id': balance_request.id,
                'campus_name': campus.name,
                'group_name': group.name if group else 'N/A',
                'amount': amount,
                'request_type': request_type,
            })

        if not created_requests:
            return jsonify({'error': 'No se pudo crear ninguna solicitud'}), 400

        db.session.commit()

        # Enviar UN solo email consolidado a cada gerente (si no hay delegación)
        try:
            has_delegation = User.query.filter_by(
                role='financiero', is_active=True, can_approve_balance=True
            ).first() is not None

            if not has_delegation:
                from app.services.email_service import send_balance_batch_approval_email
                gerentes = User.query.filter_by(role='gerente', is_active=True).all()
                coordinator_name = user.full_name or user.name or 'Coordinador'

                for gerente in gerentes:
                    if gerente.email:
                        send_balance_batch_approval_email(
                            gerente_email=gerente.email,
                            gerente_name=gerente.full_name or gerente.name or 'Gerente',
                            gerente_id=str(gerente.id),
                            coordinator_name=coordinator_name,
                            justification=justification,
                            items=email_items,
                            has_financiero_review=False,
                        )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error enviando email batch a gerente: {e}")

        return jsonify({
            'message': f'{len(created_requests)} solicitud{"es" if len(created_requests) > 1 else ""} creada{"s" if len(created_requests) > 1 else ""} exitosamente',
            'requests': [r.to_dict(include_campus=True, include_group=True) for r in created_requests],
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# =====================================================
# CANCELAR SOLICITUD (coordinador o financiero)
# =====================================================

@bp.route('/requests/<int:request_id>/cancel', methods=['PUT', 'OPTIONS'])
@jwt_required(optional=True)
def cancel_request(request_id):
    """Cancelar una solicitud de saldo.
    
    - Coordinador: puede cancelar sus propias solicitudes si están en pending, in_review, 
      recommended_approve o recommended_reject (no aprobadas/rechazadas/canceladas).
    - Financiero: puede cancelar solicitudes que estén en pending, in_review,
      recommended_approve o recommended_reject.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    balance_request = BalanceRequest.query.get(request_id)
    if not balance_request:
        return jsonify({'error': 'Solicitud no encontrada'}), 404
    
    # Verify permissions
    cancellable_statuses = ['pending', 'in_review', 'recommended_approve', 'recommended_reject']
    
    if balance_request.status not in cancellable_statuses:
        return jsonify({'error': f'No se puede cancelar una solicitud con estado "{REQUEST_STATUS.get(balance_request.status, balance_request.status)}"'}), 400
    
    if user.role == 'coordinator':
        # Coordinators can only cancel their own requests
        if balance_request.coordinator_id != user.id:
            return jsonify({'error': 'No tiene permiso para cancelar esta solicitud'}), 403
    elif user.role in ['financiero', 'admin', 'developer', 'gerente']:
        pass  # These roles can cancel any request
    else:
        return jsonify({'error': 'No tiene permiso para cancelar solicitudes'}), 403
    
    data = request.get_json(silent=True) or {}
    reason = data.get('reason', '').strip()
    
    try:
        balance_request.status = 'cancelled'
        balance_request.approved_by_id = user.id
        balance_request.approver_notes = reason or f'Cancelado por {user.full_name}'
        balance_request.approved_at = datetime.utcnow()
        
        # Log activity
        log_activity_from_request(
            user_id=user.id,
            action='balance_request_cancelled',
            entity_type='balance_request',
            entity_id=str(balance_request.id),
            details={
                'request_id': balance_request.id,
                'amount': float(balance_request.amount_requested),
                'reason': reason,
                'cancelled_by_role': user.role,
            }
        )
        
        db.session.commit()
        
        return jsonify({
            'message': 'Solicitud cancelada exitosamente',
            'request': balance_request.to_dict(include_campus=True, include_group=True)
        })
        
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
        
        # Enviar email al gerente cuando financiero recomienda aprobar/rechazar
        # Solo si NO hay delegación activa (si hay delegación, el financiero aprueba directo)
        if action in ('recommend_approve', 'recommend_reject'):
            try:
                has_delegation = User.query.filter_by(
                    role='financiero', is_active=True, can_approve_balance=True
                ).first() is not None
                
                if not has_delegation:
                    from app.services.email_service import send_balance_approval_email
                    # Buscar gerentes activos para notificar
                    gerentes = User.query.filter_by(role='gerente', is_active=True).all()
                    coordinator = User.query.get(balance_request.coordinator_id)
                    campus = Campus.query.get(coordinator.campus_id) if coordinator and coordinator.campus_id else None
                    
                    for gerente in gerentes:
                        if gerente.email:
                            send_balance_approval_email(
                                gerente_email=gerente.email,
                                gerente_name=gerente.full_name or gerente.name or 'Gerente',
                                gerente_id=str(gerente.id),
                                request_id=request_id,
                                coordinator_name=coordinator.full_name if coordinator else 'N/A',
                                campus_name=campus.name if campus else 'N/A',
                                amount=float(balance_request.amount_requested),
                                request_type=balance_request.request_type or 'recarga',
                                justification=balance_request.justification or '',
                                financiero_notes=balance_request.financiero_notes,
                                recommended_amount=balance_request.financiero_recommended_amount,
                                has_financiero_review=True,
                            )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error enviando email de aprobación a gerente: {e}")
        
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
        
        # Filtro por estado
        status_filter = request.args.get('status')
        if status_filter:
            query = query.filter(BalanceRequest.status == status_filter)
        elif not show_all:
            # Por defecto, solicitudes que el gerente puede procesar
            query = query.filter(BalanceRequest.status.in_(
                ['pending', 'in_review', 'recommended_approve', 'recommended_reject']
            ))
        
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
        
        # Acreditar saldo al coordinador para el grupo específico de la solicitud
        is_scholarship = balance_request.request_type == 'beca'
        concept = 'beca' if is_scholarship else 'saldo_aprobado'
        
        transaction, balance = create_balance_transaction(
            coordinator_id=balance_request.coordinator_id,
            group_id=balance_request.group_id,
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
        
        # Notificar al coordinador que su solicitud fue aprobada
        try:
            from app.services.email_service import send_balance_resolution_email
            coordinator = User.query.get(balance_request.coordinator_id)
            if coordinator and coordinator.email:
                send_balance_resolution_email(
                    coordinator_email=coordinator.email,
                    coordinator_name=coordinator.full_name or coordinator.name or 'Coordinador',
                    approved=True,
                    amount=amount_approved,
                    request_type=balance_request.request_type or 'recarga',
                    approver_notes=data.get('notes', ''),
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error enviando email de aprobación a coordinador: {e}")
        
        # Si un financiero con delegación aprobó, notificar a gerentes
        if user.role == 'financiero' and getattr(user, 'can_approve_balance', False):
            try:
                from app.services.email_service import send_balance_delegation_notification_email
                gerentes = User.query.filter_by(role='gerente', is_active=True).all()
                coordinator = coordinator or User.query.get(balance_request.coordinator_id)
                campus = Campus.query.get(coordinator.campus_id) if coordinator and coordinator.campus_id else None
                
                for gerente in gerentes:
                    if gerente.email:
                        send_balance_delegation_notification_email(
                            gerente_email=gerente.email,
                            gerente_name=gerente.full_name or gerente.name or 'Gerente',
                            request_id=request_id,
                            coordinator_name=coordinator.full_name if coordinator else 'N/A',
                            campus_name=campus.name if campus else 'N/A',
                            amount_requested=float(balance_request.amount_requested),
                            amount_approved=amount_approved,
                            request_type=balance_request.request_type or 'recarga',
                            justification=balance_request.justification or '',
                            financiero_name=user.full_name or user.name or 'Financiero',
                            financiero_notes=balance_request.financiero_notes or '',
                        )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error enviando email de delegación a gerente: {e}")
        
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
        
        # Notificar al coordinador que su solicitud fue rechazada
        try:
            from app.services.email_service import send_balance_resolution_email
            coordinator = User.query.get(balance_request.coordinator_id)
            if coordinator and coordinator.email:
                send_balance_resolution_email(
                    coordinator_email=coordinator.email,
                    coordinator_name=coordinator.full_name or coordinator.name or 'Coordinador',
                    approved=False,
                    amount=float(balance_request.amount_requested),
                    request_type=balance_request.request_type or 'recarga',
                    approver_notes=data['notes'],
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error enviando email de rechazo a coordinador: {e}")
        
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
        
        # Obtener saldos por grupo
        results = []
        for coord in coordinators:
            balances = CoordinatorBalance.query.filter_by(coordinator_id=coord.id).all()
            total_balance = sum(float(b.current_balance or 0) for b in balances)
            
            # Filtrar por saldo bajo si se solicita
            if low_balance and total_balance > 1000:  # Umbral de saldo bajo
                continue
            
            results.append({
                'coordinator': {
                    'id': coord.id,
                    'full_name': coord.full_name,
                    'email': coord.email,
                },
                'balances': [b.to_dict(include_group=True) for b in balances],
                'totals': {
                    'current_balance': total_balance,
                    'total_received': sum(float(b.total_received or 0) for b in balances),
                    'total_spent': sum(float(b.total_spent or 0) for b in balances),
                    'total_scholarships': sum(float(b.total_scholarships or 0) for b in balances),
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
        if not data.get('group_id'):
            return jsonify({'error': 'Grupo es requerido para ajustes de saldo'}), 400
        
        coordinator = User.query.get(data['coordinator_id'])
        if not coordinator or coordinator.role != 'coordinator':
            return jsonify({'error': 'Coordinador no encontrado'}), 404
        
        group_id = int(data['group_id'])
        amount = float(data['amount'])  # Puede ser positivo o negativo
        transaction_type = 'credit' if amount > 0 else 'debit'
        
        transaction, balance = create_balance_transaction(
            coordinator_id=coordinator.id,
            group_id=group_id,
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
        coordinators_with_balance = db.session.query(
            func.count(func.distinct(CoordinatorBalance.coordinator_id))
        ).filter(
            CoordinatorBalance.current_balance > 0
        ).scalar() or 0
        
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
# DELEGACIÓN DE APROBACIÓN (Gerente → Financiero)
# =====================================================

def gerente_required(f):
    """Requiere rol de gerente o admin"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role not in ['admin', 'developer', 'gerente']:
            return jsonify({'error': 'Se requiere rol de gerente o administrador'}), 403
        return f(*args, **kwargs)
    return decorated


@bp.route('/delegation/financieros', methods=['GET'])
@jwt_required()
@gerente_required
def get_financieros_for_delegation():
    """Listar financieros activos con su estado de delegación"""
    try:
        financieros = User.query.filter_by(role='financiero', is_active=True).order_by(User.name).all()
        
        return jsonify({
            'financieros': [{
                'id': f.id,
                'name': f.name,
                'first_surname': f.first_surname,
                'second_surname': f.second_surname,
                'full_name': f.full_name,
                'email': f.email,
                'can_approve_balance': f.can_approve_balance,
                'last_login': f.last_login.isoformat() if f.last_login else None,
            } for f in financieros]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/delegation/financieros/<string:financiero_id>/toggle', methods=['PUT', 'OPTIONS'])
@jwt_required(optional=True)
@gerente_required
def toggle_financiero_delegation(financiero_id):
    """Activar/desactivar delegación de aprobación para un financiero"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'PUT, OPTIONS')
        return response, 200
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        financiero = User.query.get(financiero_id)
        if not financiero or financiero.role != 'financiero':
            return jsonify({'error': 'Financiero no encontrado'}), 404
        
        data = request.get_json() or {}
        new_value = data.get('can_approve_balance')
        
        # Si no se especifica, hacer toggle
        if new_value is None:
            new_value = not financiero.can_approve_balance
        
        financiero.can_approve_balance = bool(new_value)
        
        # Log de actividad
        log_activity_from_request(
            user=user,
            action_type='delegation_toggle',
            entity_type='user',
            entity_id=financiero_id,
            entity_name=f"{'Delegación activada' if new_value else 'Delegación revocada'} para {financiero.full_name}",
            details={
                'financiero_id': financiero_id,
                'financiero_name': financiero.full_name,
                'can_approve_balance': new_value,
            }
        )
        
        db.session.commit()
        
        return jsonify({
            'message': f"Delegación {'activada' if new_value else 'revocada'} para {financiero.full_name}",
            'financiero': {
                'id': financiero.id,
                'full_name': financiero.full_name,
                'email': financiero.email,
                'can_approve_balance': financiero.can_approve_balance,
            }
        })
        
    except Exception as e:
        db.session.rollback()
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
    if not user or user.role not in ['admin', 'developer', 'gerente', 'coordinator']:
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


# ============================================================
# HISTORIAL DE ASIGNACIONES (Rastreo detallado de consumo de saldo)
# ============================================================

@bp.route('/assignment-history', methods=['GET'])
@jwt_required()
def get_assignment_history():
    """Historial detallado de asignaciones que consumieron saldo.
    
    Muestra cada transacción de tipo 'asignacion_certificacion' o 'asignacion_retoma'
    con detalles del grupo, examen, candidatos y costos.
    
    Query params:
    - page (int): Página actual (default 1)
    - per_page (int): Resultados por página (default 20)
    - concept (str): Filtrar por concepto (asignacion_certificacion, asignacion_retoma)
    - date_from (str): Fecha desde (YYYY-MM-DD)
    - date_to (str): Fecha hasta (YYYY-MM-DD)
    - group_id (int): Filtrar por grupo específico
    """
    try:
        from app.models import Exam
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        concept_filter = request.args.get('concept')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        group_id_filter = request.args.get('group_id', type=int)
        
        # Query base: transacciones de asignación del coordinador
        query = BalanceTransaction.query.filter(
            BalanceTransaction.coordinator_id == user_id,
            BalanceTransaction.concept.in_(['asignacion_certificacion', 'asignacion_retoma'])
        )
        
        # Filtros opcionales
        if concept_filter:
            query = query.filter(BalanceTransaction.concept == concept_filter)
        
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                query = query.filter(BalanceTransaction.created_at >= from_date)
            except ValueError:
                pass
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                to_date = to_date.replace(hour=23, minute=59, second=59)
                query = query.filter(BalanceTransaction.created_at <= to_date)
            except ValueError:
                pass
        
        # Ordenar por fecha desc
        query = query.order_by(desc(BalanceTransaction.created_at))
        
        # Paginar
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Construir respuesta enriquecida
        transactions = []
        for txn in pagination.items:
            txn_data = txn.to_dict(include_created_by=True)
            
            # Enriquecer con datos del grupo y examen si reference_type es group_exam
            if txn.reference_type == 'group_exam' and txn.reference_id:
                group_exam = GroupExam.query.get(txn.reference_id)
                if group_exam:
                    group = CandidateGroup.query.get(group_exam.group_id)
                    exam = Exam.query.get(group_exam.exam_id)
                    
                    # Contar candidatos asignados
                    if group_exam.assignment_type == 'all':
                        candidates_count = group.members.count() if group else 0
                    else:
                        candidates_count = GroupExamMember.query.filter_by(
                            group_exam_id=group_exam.id
                        ).count()
                    
                    # Calcular costo unitario
                    unit_cost = float(txn.amount) / candidates_count if candidates_count > 0 else 0
                    
                    txn_data['assignment_details'] = {
                        'group_exam_id': group_exam.id,
                        'group': {
                            'id': group.id,
                            'name': group.name,
                            'code': group.code,
                        } if group else None,
                        'exam': {
                            'id': exam.id,
                            'name': exam.name,
                            'ecm_code': getattr(exam, 'ecm_code', None) or getattr(exam, 'standard', None),
                        } if exam else None,
                        'assignment_type': group_exam.assignment_type,
                        'candidates_count': candidates_count,
                        'unit_cost': round(unit_cost, 2),
                        'assigned_at': group_exam.created_at.isoformat() if group_exam.created_at else None,
                    }
                    
                    # Aplicar filtro de grupo si se pidió
                    if group_id_filter and group and group.id != group_id_filter:
                        continue
            
            transactions.append(txn_data)
        
        # Estadísticas resumidas
        total_spent = db.session.query(
            func.sum(BalanceTransaction.amount)
        ).filter(
            BalanceTransaction.coordinator_id == user_id,
            BalanceTransaction.concept.in_(['asignacion_certificacion', 'asignacion_retoma'])
        ).scalar() or 0
        
        total_assignments = BalanceTransaction.query.filter(
            BalanceTransaction.coordinator_id == user_id,
            BalanceTransaction.concept.in_(['asignacion_certificacion', 'asignacion_retoma'])
        ).count()
        
        return jsonify({
            'transactions': transactions,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page,
            'summary': {
                'total_assignments': total_assignments,
                'total_spent': float(total_spent),
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# EMAIL ACTION ENDPOINT (sin autenticación JWT)
# =====================================================

def _email_loading_page(token: str) -> str:
    """Página HTML con pantalla de carga que invoca el procesamiento vía JS fetch."""
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Procesando — Evaluaasi</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 50%,#f0f4ff 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}}
.container{{max-width:520px;width:100%;}}
.brand{{text-align:center;margin-bottom:24px;display:flex;flex-direction:column;align-items:center;gap:8px;}}
.brand img{{width:48px;height:48px;border-radius:10px;}}
.brand h1{{color:#1e40af;font-size:28px;font-weight:700;letter-spacing:-0.5px;}}
.brand p{{color:#6b7280;font-size:13px;margin-top:4px;}}
.card{{background:#ffffff;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.04);padding:40px 32px;text-align:center;overflow:hidden;position:relative;}}
.card::before{{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#1e40af,#2563eb,#60a5fa);}}
/* Loading state */
#loading{{display:flex;flex-direction:column;align-items:center;gap:20px;}}
.spinner{{width:48px;height:48px;border:4px solid #e5e7eb;border-top:4px solid #2563eb;border-radius:50%;animation:spin 0.8s linear infinite;}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}
.loading-text{{color:#374151;font-size:16px;font-weight:500;}}
.loading-sub{{color:#9ca3af;font-size:13px;}}
/* Result state */
#result{{display:none;}}
.result-icon{{font-size:56px;margin-bottom:16px;animation:popIn 0.4s ease-out;}}
@keyframes popIn{{0%{{transform:scale(0);opacity:0;}}50%{{transform:scale(1.2);}}100%{{transform:scale(1);opacity:1;}}}}
.result-title{{font-size:22px;font-weight:700;margin-bottom:8px;}}
.result-message{{font-size:15px;color:#4b5563;line-height:1.6;margin-bottom:24px;}}
.result-details{{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:24px;text-align:left;}}
.detail-row{{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;}}
.detail-row:last-child{{border-bottom:none;}}
.detail-label{{color:#6b7280;}}
.detail-value{{color:#111827;font-weight:600;}}
.close-hint{{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:16px;}}
.close-hint p{{color:#1e40af;font-size:13px;}}
.btn-platform{{display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;transition:background 0.2s;}}
.btn-platform:hover{{background:#1d4ed8;}}
/* Error state */
.error .result-title{{color:#dc2626;}}
.error .close-hint{{background:#fef2f2;border-color:#fecaca;}}
.error .close-hint p{{color:#991b1b;}}
.footer{{text-align:center;margin-top:24px;color:#9ca3af;font-size:11px;}}
</style>
</head>
<body>
<div class="container">
  <div class="brand"><img src="https://thankful-stone-07fbe5410.6.azurestaticapps.net/logo.png" alt="Evaluaasi"><h1>Evaluaasi</h1><p>Plataforma de Evaluación y Certificación</p></div>
  <div class="card" id="card">
    <div id="loading">
      <div class="spinner"></div>
      <p class="loading-text">Procesando solicitud...</p>
      <p class="loading-sub">Esto tomará solo unos segundos</p>
    </div>
    <div id="result"></div>
  </div>
  <p class="footer">&copy; {datetime.now().year} Evaluaasi — Todos los derechos reservados</p>
</div>
<script>
(function(){{
  var token = "{token}";
  fetch(window.location.href, {{method:'POST',headers:{{'Content-Type':'application/json'}}}})
    .then(function(r){{return r.json().then(function(d){{return {{ok:r.ok,data:d}}}});}})
    .then(function(res){{
      var d = res.data;
      document.getElementById('loading').style.display='none';
      var el = document.getElementById('result');
      el.style.display='block';
      if(res.ok && d.success){{
        var details='';
        if(d.details){{
          details='<div class="result-details">';
          for(var i=0;i<d.details.length;i++){{
            details+='<div class="detail-row"><span class="detail-label">'+d.details[i][0]+'</span><span class="detail-value">'+d.details[i][1]+'</span></div>';
          }}
          details+='</div>';
        }}
        el.innerHTML=
          '<div class="result-icon">'+(d.icon||'✅')+'</div>'+
          '<h2 class="result-title" style="color:'+(d.color||'#2563eb')+'">'+d.title+'</h2>'+
          '<p class="result-message">'+d.message+'</p>'+
          details+
          '<div class="close-hint"><p>✓ Puedes cerrar esta ventana de forma segura.</p></div>'+
          '<a class="btn-platform" href="https://thankful-stone-07fbe5410.6.azurestaticapps.net/gerente/aprobaciones">Ir a la plataforma</a>';
      }} else {{
        document.getElementById('card').classList.add('error');
        el.innerHTML=
          '<div class="result-icon">'+(d.icon||'⚠️')+'</div>'+
          '<h2 class="result-title">'+(d.title||'Error')+'</h2>'+
          '<p class="result-message">'+(d.message||'Ocurrió un error inesperado.')+'</p>'+
          '<div class="close-hint"><p>Puedes intentar de nuevo o gestionar la solicitud desde la plataforma.</p></div>'+
          '<a class="btn-platform" href="https://thankful-stone-07fbe5410.6.azurestaticapps.net/gerente/aprobaciones">Ir a la plataforma</a>';
      }}
    }})
    .catch(function(){{
      document.getElementById('loading').style.display='none';
      var el = document.getElementById('result');
      el.style.display='block';
      document.getElementById('card').classList.add('error');
      el.innerHTML=
        '<div class="result-icon">⚠️</div>'+
        '<h2 class="result-title">Error de conexión</h2>'+
        '<p class="result-message">No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.</p>'+
        '<a class="btn-platform" href="https://thankful-stone-07fbe5410.6.azurestaticapps.net/gerente/aprobaciones">Ir a la plataforma</a>';
    }});
}})();
</script>
</body>
</html>"""


@bp.route('/email-action/<token>', methods=['GET', 'POST'])
def email_action(token):
    """
    GET: Devuelve página con pantalla de carga + JS que llama al POST.
    POST: Procesa la acción (aprobar/rechazar) y devuelve JSON.
    """
    from flask import make_response
    from app.services.email_service import verify_email_action_token

    # ─── GET: Mostrar página de carga ───
    if request.method == 'GET':
        # Validación rápida del token (sin procesar)
        payload = verify_email_action_token(token)
        if not payload:
            html = _email_loading_page(token)  # JS will handle the error from POST
            # Better: return error page directly for obviously bad tokens
            resp = make_response(_email_error_page(
                'Enlace inválido o expirado',
                'Este enlace ya no es válido. Puede que haya expirado (válido por 7 días) o el formato no sea correcto.',
            ), 400)
            resp.headers['Content-Type'] = 'text/html; charset=utf-8'
            return resp
        html = _email_loading_page(token)
        resp = make_response(html, 200)
        resp.headers['Content-Type'] = 'text/html; charset=utf-8'
        return resp

    # ─── POST: Procesar la acción ───
    payload = verify_email_action_token(token)
    if not payload:
        return jsonify({
            'success': False, 'icon': '⏰', 'color': '#dc2626',
            'title': 'Enlace inválido o expirado',
            'message': 'Este enlace ya no es válido. Puede que haya expirado (válido por 7 días) o ya se utilizó. Ingresa a la plataforma para gestionar las solicitudes.',
        }), 400

    request_ids = payload['rid']
    gerente_id = payload['gid']
    action = payload['act']

    # Normalizar: soportar tanto int como lista
    if isinstance(request_ids, int):
        request_ids = [request_ids]

    if action not in ('approve', 'reject'):
        return jsonify({
            'success': False, 'icon': '❌', 'color': '#dc2626',
            'title': 'Acción no válida',
            'message': 'La acción solicitada no es reconocida.',
        }), 400

    try:
        gerente = User.query.get(gerente_id)
        if not gerente or gerente.role not in ('gerente', 'admin', 'developer') or not gerente.is_active:
            return jsonify({
                'success': False, 'icon': '🔒', 'color': '#dc2626',
                'title': 'Usuario no autorizado',
                'message': 'El usuario asociado a este enlace ya no tiene permisos de aprobación.',
            }), 403

        # Procesar cada solicitud
        processed = []
        skipped = []
        errors = []

        for rid in request_ids:
            br = BalanceRequest.query.get(rid)
            if not br:
                errors.append(f"#{rid}: no encontrada")
                continue

            if br.status in ('approved', 'rejected'):
                skipped.append(f"#{rid}: ya {'aprobada' if br.status == 'approved' else 'rechazada'}")
                continue

            coordinator = User.query.get(br.coordinator_id)
            coordinator_name = (coordinator.full_name or coordinator.name or 'Coordinador') if coordinator else 'N/A'
            campus = Campus.query.get(br.campus_id) if br.campus_id else None

            if action == 'approve':
                amount_approved = float(br.financiero_recommended_amount or br.amount_requested)

                br.status = 'approved'
                br.amount_approved = amount_approved
                br.approved_by_id = gerente_id
                br.approver_notes = 'Aprobado vía email'
                br.approved_at = datetime.utcnow()

                is_scholarship = br.request_type == 'beca'
                concept = 'beca' if is_scholarship else 'saldo_aprobado'

                transaction, balance = create_balance_transaction(
                    coordinator_id=br.coordinator_id,
                    group_id=br.group_id,
                    transaction_type='credit',
                    concept=concept,
                    amount=amount_approved,
                    reference_type='balance_request',
                    reference_id=rid,
                    notes=f"Aprobado vía email por {gerente.full_name}",
                    created_by_id=gerente_id,
                )

                log_activity_from_request(
                    user=gerente,
                    action_type='balance_approve',
                    entity_type='balance_request',
                    entity_id=rid,
                    entity_name=f"${amount_approved} para {coordinator_name}",
                    details={
                        'amount_requested': float(br.amount_requested),
                        'amount_approved': amount_approved,
                        'request_type': br.request_type,
                        'coordinator_id': br.coordinator_id,
                        'new_balance': float(balance.current_balance),
                        'via': 'email',
                    },
                )

                processed.append({
                    'id': rid,
                    'coordinator': coordinator_name,
                    'campus': campus.name if campus else 'N/A',
                    'amount': amount_approved,
                })

                # Notificar coordinador
                try:
                    from app.services.email_service import send_balance_resolution_email
                    if coordinator and coordinator.email:
                        send_balance_resolution_email(
                            coordinator_email=coordinator.email,
                            coordinator_name=coordinator_name,
                            approved=True,
                            amount=amount_approved,
                            request_type=br.request_type or 'recarga',
                            approver_notes='Aprobado vía email',
                        )
                except Exception:
                    pass

            else:  # reject
                br.status = 'rejected'
                br.approved_by_id = gerente_id
                br.approver_notes = 'Rechazado vía email'
                br.approved_at = datetime.utcnow()

                log_activity_from_request(
                    user=gerente,
                    action_type='balance_reject',
                    entity_type='balance_request',
                    entity_id=rid,
                    entity_name=f"Rechazo: {coordinator_name}",
                    details={
                        'amount_requested': float(br.amount_requested),
                        'request_type': br.request_type,
                        'coordinator_id': br.coordinator_id,
                        'reason': 'Rechazado vía email',
                        'via': 'email',
                    },
                )

                processed.append({
                    'id': rid,
                    'coordinator': coordinator_name,
                    'campus': campus.name if campus else 'N/A',
                    'amount': float(br.amount_requested),
                })

                try:
                    from app.services.email_service import send_balance_resolution_email
                    if coordinator and coordinator.email:
                        send_balance_resolution_email(
                            coordinator_email=coordinator.email,
                            coordinator_name=coordinator_name,
                            approved=False,
                            amount=float(br.amount_requested),
                            request_type=br.request_type or 'recarga',
                            approver_notes='Rechazado vía email',
                        )
                except Exception:
                    pass

        db.session.commit()

        # Construir respuesta
        total_amount = sum(p['amount'] for p in processed)
        is_approve = action == 'approve'
        action_word = 'aprobada' if is_approve else 'rechazada'
        action_words_plural = 'aprobadas' if is_approve else 'rechazadas'

        if not processed and skipped:
            return jsonify({
                'success': True, 'icon': 'ℹ️', 'color': '#3b82f6',
                'title': 'Solicitudes ya procesadas',
                'message': f'Todas las solicitudes ya habían sido procesadas previamente. No se realizó ninguna acción adicional.',
                'details': [['Estado', s] for s in skipped],
            })

        if not processed:
            return jsonify({
                'success': False, 'icon': '❌', 'color': '#dc2626',
                'title': 'No se procesó ninguna solicitud',
                'message': 'No se encontraron solicitudes válidas para procesar.',
            }), 404

        details = []
        if len(processed) == 1:
            p = processed[0]
            details = [
                ['Coordinador', p['coordinator']],
                ['Plantel', p['campus']],
                ['Monto', f"${p['amount']:,.2f} MXN"],
                ['Estado', f"{'✅ Aprobada' if is_approve else '❌ Rechazada'}"],
            ]
            msg = f"La solicitud de <strong>{p['coordinator']}</strong> por <strong>${p['amount']:,.2f} MXN</strong> ha sido {action_word} exitosamente."
            if is_approve:
                msg += " El saldo ha sido acreditado."
        else:
            details = [
                ['Solicitudes procesadas', str(len(processed))],
                ['Monto total', f"${total_amount:,.2f} MXN"],
                ['Estado', f"{'✅ Aprobadas' if is_approve else '❌ Rechazadas'}"],
            ]
            if skipped:
                details.append(['Ya procesadas previamente', str(len(skipped))])
            msg = f"Se {action_words_plural} <strong>{len(processed)} solicitudes</strong> por un total de <strong>${total_amount:,.2f} MXN</strong>."
            if is_approve:
                msg += " Los saldos han sido acreditados."

        return jsonify({
            'success': True,
            'icon': '✅' if is_approve else '❌',
            'color': '#2563eb' if is_approve else '#dc2626',
            'title': f'Solicitud{"es" if len(processed) > 1 else ""} {action_words_plural if len(processed) > 1 else action_word}',
            'message': msg,
            'details': details,
        })

    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f"Error en email-action: {e}")
        return jsonify({
            'success': False, 'icon': '⚠️', 'color': '#dc2626',
            'title': 'Error al procesar',
            'message': 'Ocurrió un error al procesar la acción. Por favor, ingresa a la plataforma para completar la operación.',
        }), 500


def _email_error_page(title: str, message: str) -> str:
    """Página HTML estática de error (sin JS, para tokens inválidos detectados temprano)."""
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Evaluaasi</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#fef2f2 0%,#fff1f2 50%,#fef2f2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}}
.container{{max-width:520px;width:100%;}}
.brand{{text-align:center;margin-bottom:24px;display:flex;flex-direction:column;align-items:center;gap:8px;}}
.brand img{{width:48px;height:48px;border-radius:10px;}}
.brand h1{{color:#1e40af;font-size:28px;font-weight:700;letter-spacing:-0.5px;}}
.brand p{{color:#6b7280;font-size:13px;margin-top:4px;}}
.card{{background:#ffffff;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.04);padding:40px 32px;text-align:center;position:relative;overflow:hidden;}}
.card::before{{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:#dc2626;}}
.icon{{font-size:56px;margin-bottom:16px;}}
h2{{font-size:22px;font-weight:700;color:#dc2626;margin-bottom:8px;}}
p.msg{{font-size:15px;color:#4b5563;line-height:1.6;margin-bottom:24px;}}
.hint{{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:20px;}}
.hint p{{color:#991b1b;font-size:13px;}}
.btn{{display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;}}
.footer{{text-align:center;margin-top:24px;color:#9ca3af;font-size:11px;}}
</style>
</head>
<body>
<div class="container">
  <div class="brand"><img src="https://thankful-stone-07fbe5410.6.azurestaticapps.net/logo.png" alt="Evaluaasi"><h1>Evaluaasi</h1><p>Plataforma de Evaluación y Certificación</p></div>
  <div class="card">
    <div class="icon">⏰</div>
    <h2>{title}</h2>
    <p class="msg">{message}</p>
    <div class="hint"><p>Puedes gestionar las solicitudes directamente desde la plataforma.</p></div>
    <a class="btn" href="https://thankful-stone-07fbe5410.6.azurestaticapps.net/gerente/aprobaciones">Ir a la plataforma</a>
  </div>
  <p class="footer">&copy; {datetime.now().year} Evaluaasi — Todos los derechos reservados</p>
</div>
</body>
</html>"""
