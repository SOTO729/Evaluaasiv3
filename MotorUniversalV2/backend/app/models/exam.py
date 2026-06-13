"""
Modelo de Examen
"""
from datetime import datetime
from app import db

# CDN Helper para transformar URLs
try:
    from app.utils.cdn_helper import transform_to_cdn_url
except ImportError:
    def transform_to_cdn_url(url):
        return url


class Exam(db.Model):
    """Modelo de examen"""
    
    __tablename__ = 'exams'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    version = db.Column(db.String(50), nullable=False)  # Versión del examen (ej: 1.0, 2.0)
    standard = db.Column(db.String(15))  # Deprecated: usar competency_standard_id
    stage_id = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    instructions = db.Column(db.Text)
    duration_minutes = db.Column(db.Integer)  # Duración en minutos
    passing_score = db.Column(db.Integer, default=70)  # Puntaje mínimo para aprobar
    image_url = db.Column(db.Text)  # URL o base64 de la imagen del examen
    pause_on_disconnect = db.Column(db.Boolean, default=True, nullable=False)  # Pausar tiempo al desconectarse
    
    # Configuración de asignación por defecto (heredable al asignar a grupos)
    default_max_attempts = db.Column(db.Integer, default=2)  # Intentos permitidos
    default_max_disconnections = db.Column(db.Integer, default=3)  # Desconexiones permitidas
    default_exam_content_type = db.Column(db.String(20), default='mixed')  # mixed|questions_only|exercises_only
    default_exam_questions_count = db.Column(db.Integer, nullable=True)  # null = usar todas
    default_exam_exercises_count = db.Column(db.Integer, nullable=True)
    default_simulator_questions_count = db.Column(db.Integer, nullable=True)
    default_simulator_exercises_count = db.Column(db.Integer, nullable=True)
    default_duration_minutes = db.Column(db.Integer, nullable=True)  # null = usar duration_minutes
    default_passing_score = db.Column(db.Integer, nullable=True)  # null = usar passing_score
    
    # Relación con Estándar de Competencia (ECM)
    competency_standard_id = db.Column(db.Integer, db.ForeignKey('competency_standards.id'), nullable=True, index=True)
    
    # Estado
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    is_published = db.Column(db.Boolean, default=False, nullable=False, index=True)

    # Catálogo público (modelo Directo / B2C)
    # Si is_public_catalog=True, este examen aparece en /catalog (página pública sin auth)
    # y puede ser comprado directamente por candidatos individuales vía MercadoPago.
    is_public_catalog = db.Column(db.Boolean, default=False, nullable=False, index=True)
    direct_price_mxn = db.Column(db.Numeric(12, 2), nullable=True)  # Precio en MXN; null = no se vende aún
    direct_sale_description = db.Column(db.Text, nullable=True)  # Descripción comercial (marketing copy)
    info_sheet_url = db.Column(db.String(500), nullable=True)  # PDF "Ficha informativa" — Modelo Directo (Conoce más)
    is_free_sample = db.Column(db.Boolean, default=False, nullable=False)  # Si True, examen gratis de muestra (no requiere pago)
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='NO ACTION'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='NO ACTION'), index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    categories = db.relationship('Category', backref='exam', lazy='dynamic', cascade='all, delete-orphan', order_by='Category.order')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_exams')
    updater = db.relationship('User', foreign_keys=[updated_by], backref='updated_exams')
    
    def get_total_questions(self):
        """Calcular total de preguntas del examen (optimizado - single query)"""
        from app.models.question import Question
        from app.models.topic import Topic
        from app.models.category import Category
        return db.session.query(db.func.count(Question.id)).join(
            Topic, Question.topic_id == Topic.id
        ).join(
            Category, Topic.category_id == Category.id
        ).filter(Category.exam_id == self.id).scalar() or 0
    
    def get_total_exercises(self):
        """Calcular total de ejercicios del examen (optimizado - single query)"""
        from app.models.exercise import Exercise
        from app.models.topic import Topic
        from app.models.category import Category
        return db.session.query(db.func.count(Exercise.id)).join(
            Topic, Exercise.topic_id == Topic.id
        ).join(
            Category, Topic.category_id == Category.id
        ).filter(Category.exam_id == self.id).scalar() or 0
    
    def get_mode_counts(self):
        """Calcular conteos de preguntas y ejercicios por tipo (exam/simulator) - optimizado"""
        from app.models.question import Question
        from app.models.exercise import Exercise
        from app.models.topic import Topic
        from app.models.category import Category
        
        # Single query for questions by type
        q_counts = db.session.query(
            Question.type,
            db.func.count(Question.id)
        ).join(
            Topic, Question.topic_id == Topic.id
        ).join(
            Category, Topic.category_id == Category.id
        ).filter(Category.exam_id == self.id).group_by(Question.type).all()
        
        exam_questions = 0
        simulator_questions = 0
        hidden_questions = 0
        for qtype, cnt in q_counts:
            if qtype == 'simulator':
                simulator_questions = cnt
            elif qtype == 'hidden':
                hidden_questions = cnt
            else:
                exam_questions += cnt
        
        # Single query for exercises by type
        e_counts = db.session.query(
            Exercise.type,
            db.func.count(Exercise.id)
        ).join(
            Topic, Exercise.topic_id == Topic.id
        ).join(
            Category, Topic.category_id == Category.id
        ).filter(Category.exam_id == self.id).group_by(Exercise.type).all()
        
        exam_exercises = 0
        simulator_exercises = 0
        hidden_exercises = 0
        for etype, cnt in e_counts:
            if etype == 'simulator':
                simulator_exercises = cnt
            elif etype == 'hidden':
                hidden_exercises = cnt
            else:
                exam_exercises += cnt

        return {
            'exam_questions_count': exam_questions,
            'simulator_questions_count': simulator_questions,
            'hidden_questions_count': hidden_questions,
            'exam_exercises_count': exam_exercises,
            'simulator_exercises_count': simulator_exercises,
            'hidden_exercises_count': hidden_exercises,
            'has_exam_content': (exam_questions + exam_exercises) > 0,
            'has_simulator_content': (simulator_questions + simulator_exercises) > 0
        }

    @classmethod
    def bulk_counts(cls, exam_ids):
        """Calcula EN LOTE (queries agregadas con GROUP BY exam_id) las cuentas de
        preguntas/ejercicios/temas por examen. Evita el N+1 de llamar
        get_total_questions/get_total_exercises/get_mode_counts/total_topics una vez
        por examen en un listado. Devuelve {exam_id: {dict con las mismas claves que
        usa to_dict}}. 3 queries totales sin importar cuántos exámenes."""
        from app.models.question import Question
        from app.models.exercise import Exercise
        from app.models.topic import Topic
        from app.models.category import Category
        res = {eid: {
            'total_questions': 0, 'total_exercises': 0, 'total_topics': 0,
            'exam_questions_count': 0, 'simulator_questions_count': 0, 'hidden_questions_count': 0,
            'exam_exercises_count': 0, 'simulator_exercises_count': 0, 'hidden_exercises_count': 0,
        } for eid in exam_ids}
        if not exam_ids:
            return res
        q_rows = db.session.query(
            Category.exam_id, Question.type, db.func.count(Question.id)
        ).join(Topic, Question.topic_id == Topic.id).join(
            Category, Topic.category_id == Category.id
        ).filter(Category.exam_id.in_(exam_ids)).group_by(Category.exam_id, Question.type).all()
        for exam_id, qtype, cnt in q_rows:
            r = res[exam_id]
            r['total_questions'] += cnt
            if qtype == 'simulator':
                r['simulator_questions_count'] = cnt
            elif qtype == 'hidden':
                r['hidden_questions_count'] = cnt
            else:
                r['exam_questions_count'] += cnt
        e_rows = db.session.query(
            Category.exam_id, Exercise.type, db.func.count(Exercise.id)
        ).join(Topic, Exercise.topic_id == Topic.id).join(
            Category, Topic.category_id == Category.id
        ).filter(Category.exam_id.in_(exam_ids)).group_by(Category.exam_id, Exercise.type).all()
        for exam_id, etype, cnt in e_rows:
            r = res[exam_id]
            r['total_exercises'] += cnt
            if etype == 'simulator':
                r['simulator_exercises_count'] = cnt
            elif etype == 'hidden':
                r['hidden_exercises_count'] = cnt
            else:
                r['exam_exercises_count'] += cnt
        t_rows = db.session.query(
            Category.exam_id, db.func.count(Topic.id)
        ).join(Category, Topic.category_id == Category.id).filter(
            Category.exam_id.in_(exam_ids)
        ).group_by(Category.exam_id).all()
        for exam_id, cnt in t_rows:
            res[exam_id]['total_topics'] = cnt
        for r in res.values():
            r['has_exam_content'] = (r['exam_questions_count'] + r['exam_exercises_count']) > 0
            r['has_simulator_content'] = (r['simulator_questions_count'] + r['simulator_exercises_count']) > 0
        return res

    @classmethod
    def build_list_ctx(cls, exams):
        """Pre-carga en lote (counts + categorías + materiales vinculados) todo lo que
        to_dict necesita para serializar un LISTADO de exámenes sin N+1. El resultado
        se pasa como to_dict(ctx=...). Para `competency_standard`, el endpoint debe usar
        joinedload. Total: ~5 queries para toda la página, en vez de ~8 por examen."""
        from app.models.category import Category
        from app.models.study_content import StudyMaterial, study_material_exams
        ids = [e.id for e in exams]
        ctx = {'counts': cls.bulk_counts(ids), 'categories': {eid: [] for eid in ids},
               'materials': {eid: [] for eid in ids}}
        if not ids:
            return ctx
        for c in Category.query.filter(Category.exam_id.in_(ids)).order_by(Category.order).all():
            ctx['categories'].setdefault(c.exam_id, []).append(c)
        rows = db.session.query(study_material_exams.c.exam_id, StudyMaterial).join(
            StudyMaterial, StudyMaterial.id == study_material_exams.c.study_material_id
        ).filter(study_material_exams.c.exam_id.in_(ids)).all()
        for exam_id, material in rows:
            ctx['materials'].setdefault(exam_id, []).append(material)
        return ctx

    def to_dict(self, include_details=False, ctx=None):
        """Convertir a diccionario.

        ctx (opcional): contexto pre-cargado por build_list_ctx para serializar listados
        sin N+1. Si es None, se calcula todo individualmente (comportamiento original,
        usado por los endpoints de detalle)."""
        from app.models.topic import Topic
        from app.models.category import Category
        # Categorías: del contexto batch si viene, si no query individual (lazy='dynamic')
        if ctx is not None:
            categories_list = ctx['categories'].get(self.id, [])
        else:
            categories_list = self.categories.all()
        
        data = {
            'id': self.id,
            'name': self.name,
            'version': self.version,
            'standard': self.standard,
            'competency_standard_id': self.competency_standard_id,
            'stage_id': self.stage_id,
            'description': self.description,
            'duration_minutes': self.duration_minutes,
            'passing_score': self.passing_score,
            'pause_on_disconnect': self.pause_on_disconnect,
            'image_url': transform_to_cdn_url(self.image_url),
            # Configuración de asignación por defecto
            'default_max_attempts': self.default_max_attempts if self.default_max_attempts is not None else 2,
            'default_max_disconnections': self.default_max_disconnections if self.default_max_disconnections is not None else 3,
            'default_exam_content_type': self.default_exam_content_type or 'mixed',
            'default_exam_questions_count': self.default_exam_questions_count,
            'default_exam_exercises_count': self.default_exam_exercises_count,
            'default_simulator_questions_count': self.default_simulator_questions_count,
            'default_simulator_exercises_count': self.default_simulator_exercises_count,
            'default_duration_minutes': self.default_duration_minutes,
            'default_passing_score': self.default_passing_score,
            'is_active': self.is_active,
            'is_published': self.is_published,
            # Catálogo público (modelo Directo)
            'is_public_catalog': bool(getattr(self, 'is_public_catalog', False)),
            'direct_price_mxn': float(self.direct_price_mxn) if getattr(self, 'direct_price_mxn', None) is not None else None,
            'direct_sale_description': getattr(self, 'direct_sale_description', None),
            'info_sheet_url': getattr(self, 'info_sheet_url', None),
            'is_free_sample': bool(getattr(self, 'is_free_sample', False)),
            'total_categories': len(categories_list),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'categories': [{'id': cat.id, 'name': cat.name, 'percentage': cat.percentage} for cat in categories_list]  # Siempre incluir resumen de categorías
        }

        # Cuentas (totales + por modo): del contexto batch si viene, si no individual
        if ctx is not None:
            c = ctx['counts'].get(self.id, {})
            data['total_questions'] = c.get('total_questions', 0)
            data['total_exercises'] = c.get('total_exercises', 0)
            data['total_topics'] = c.get('total_topics', 0)
            data['exam_questions_count'] = c.get('exam_questions_count', 0)
            data['simulator_questions_count'] = c.get('simulator_questions_count', 0)
            data['hidden_questions_count'] = c.get('hidden_questions_count', 0)
            data['exam_exercises_count'] = c.get('exam_exercises_count', 0)
            data['simulator_exercises_count'] = c.get('simulator_exercises_count', 0)
            data['hidden_exercises_count'] = c.get('hidden_exercises_count', 0)
            data['has_exam_content'] = c.get('has_exam_content', False)
            data['has_simulator_content'] = c.get('has_simulator_content', False)
        else:
            data['total_questions'] = self.get_total_questions()
            data['total_exercises'] = self.get_total_exercises()
            data['total_topics'] = db.session.query(db.func.count(Topic.id)).join(Category, Topic.category_id == Category.id).filter(Category.exam_id == self.id).scalar() or 0
            data.update(self.get_mode_counts())
        
        # Incluir info del estándar de competencia si existe
        if self.competency_standard:
            data['competency_standard'] = {
                'id': self.competency_standard.id,
                'code': self.competency_standard.code,
                'name': self.competency_standard.name
            }
        
        # Incluir materiales de estudio vinculados (del contexto batch si viene)
        try:
            if ctx is not None:
                materials_iter = ctx['materials'].get(self.id, [])
            elif hasattr(self, 'linked_study_materials'):
                materials_iter = self.linked_study_materials
            else:
                materials_iter = []
            data['linked_study_materials'] = [{
                'id': material.id,
                'title': material.title,
                'description': material.description,
                'image_url': transform_to_cdn_url(material.image_url) if material.image_url else None
            } for material in materials_iter]
        except Exception:
            # La tabla puede no existir aún
            data['linked_study_materials'] = []
        
        # IDs de materiales vinculados (para uso rápido en asignación)
        data['linked_material_ids'] = [m['id'] for m in data.get('linked_study_materials', [])]
        
        if include_details:
            data['instructions'] = self.instructions
            data['categories'] = [cat.to_dict(include_details=True) for cat in categories_list]
        
        return data
    
    def __repr__(self):
        return f'<Exam {self.name} v{self.version}>'
