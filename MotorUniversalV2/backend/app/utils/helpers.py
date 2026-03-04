"""
Utilidades varias
"""
import os
from werkzeug.utils import secure_filename


ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx'}


def allowed_file(filename):
    """Verificar si la extensión del archivo es permitida"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_file_extension(filename):
    """Obtener extensión del archivo"""
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower()
    return ''


def paginate_query(query, page=1, per_page=20):
    """
    Paginar una query
    
    Args:
        query: SQLAlchemy query
        page: Número de página
        per_page: Items por página
    
    Returns:
        dict: Datos paginados
    """
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return {
        'items': pagination.items,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': pagination.page,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev
    }


def generate_voucher_code(length=12):
    """Generar código de voucher único (excluye caracteres confusos: I, L, O, 0)"""
    import random
    import string
    
    _CONFUSING = set('ILO0')
    chars = ''.join(c for c in string.ascii_uppercase + string.digits if c not in _CONFUSING)
    return ''.join(random.choice(chars) for _ in range(length))
