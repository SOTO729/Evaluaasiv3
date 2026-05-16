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
        for qtype, cnt in q_counts:
            if qtype == 'simulator':
                simulator_questions = cnt
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
        for etype, cnt in e_counts:
            if etype == 'simulator':
                simulator_exercises = cnt
            else:
                exam_exercises += cnt
        
        return {
            'exam_questions_count': exam_questions,
            'simulator_questions_count': simulator_questions,
            'exam_exercises_count': exam_exercises,
            'simulator_exercises_count': simulator_exercises,
            'has_exam_content': (exam_questions + exam_exercises) > 0,
            'has_simulator_content': (simulator_questions + simulator_exercises) > 0
        }
    
    def to_dict(self, include_details=False):
        """Convertir a diccionario"""
        from app.models.topic import Topic
        from app.models.category import Category
        # Obtener las categorías como lista (lazy='dynamic' devuelve una query)
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
            'total_questions': self.get_total_questions(),
            'total_exercises': self.get_total_exercises(),
            'total_categories': len(categories_list),
            'total_topics': db.session.query(db.func.count(Topic.id)).join(Category, Topic.category_id == Category.id).filter(Category.exam_id == self.id).scalar() or 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'categories': [{'id': cat.id, 'name': cat.name, 'percentage': cat.percentage} for cat in categories_list]  # Siempre incluir resumen de categorías
        }
        
        # Agregar conteos por modo (exam/simulator)
        mode_counts = self.get_mode_counts()
        data.update(mode_counts)
        
        # Incluir info del estándar de competencia si existe
        if self.competency_standard:
            data['competency_standard'] = {
                'id': self.competency_standard.id,
                'code': self.competency_standard.code,
                'name': self.competency_standard.name
            }
        
        # Incluir materiales de estudio vinculados
        try:
            if hasattr(self, 'linked_study_materials'):
                linked_materials = []
                for material in self.linked_study_materials:
                    linked_materials.append({
                        'id': material.id,
                        'title': material.title,
                        'description': material.description,
                        'image_url': transform_to_cdn_url(material.image_url) if material.image_url else None
                    })
                data['linked_study_materials'] = linked_materials
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
