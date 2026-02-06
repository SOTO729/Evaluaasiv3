"""
Script de emergencia para crear resultados de examen aprobados
para el grupo "Grupo Emergencia Educare"
"""
import os
import sys
from datetime import datetime, timedelta
import uuid

# Configurar el path para importar la app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models import User
from app.models.result import Result
from app.models.partner import CandidateGroup, GroupMember, GroupExam, GroupExamMember
from app.models.exam import Exam

def main():
    app = create_app()
    
    with app.app_context():
        # 1. Buscar el grupo
        group = CandidateGroup.query.filter(
            CandidateGroup.name.ilike('%Emergencia Educare%')
        ).first()
        
        if not group:
            print("ERROR: No se encontró el grupo 'Grupo Emergencia Educare'")
            # Listar todos los grupos para referencia
            all_groups = CandidateGroup.query.all()
            print("\nGrupos disponibles:")
            for g in all_groups:
                print(f"  - ID: {g.id}, Nombre: {g.name}")
            return
        
        print(f"\n{'='*60}")
        print(f"GRUPO ENCONTRADO: {group.name} (ID: {group.id})")
        print(f"{'='*60}\n")
        
        # 2. Obtener miembros activos del grupo
        members = GroupMember.query.filter_by(
            group_id=group.id,
            status='active'
        ).all()
        
        print(f"Miembros activos en el grupo: {len(members)}")
        
        if not members:
            print("No hay miembros activos en este grupo")
            return
        
        # 3. Obtener exámenes asignados al grupo
        group_exams = GroupExam.query.filter_by(
            group_id=group.id,
            is_active=True
        ).all()
        
        print(f"Exámenes asignados al grupo: {len(group_exams)}")
        
        if not group_exams:
            print("No hay exámenes asignados a este grupo")
            return
        
        for ge in group_exams:
            exam = Exam.query.get(ge.exam_id)
            print(f"  - Examen ID: {ge.exam_id}, Nombre: {exam.name if exam else 'N/A'}, Tipo: {ge.assignment_type}")
        
        print(f"\n{'='*60}")
        print("PROCESANDO RESULTADOS...")
        print(f"{'='*60}\n")
        
        results_created = []
        results_skipped = []
        
        for member in members:
            user = member.user
            if not user:
                print(f"  SKIP: Miembro {member.id} sin usuario asociado")
                continue
            
            print(f"\nUsuario: {user.full_name} ({user.email})")
            
            # Determinar qué exámenes tiene asignados este usuario
            for group_exam in group_exams:
                exam = Exam.query.get(group_exam.exam_id)
                if not exam:
                    continue
                
                # Verificar si el usuario tiene acceso a este examen
                has_access = False
                if group_exam.assignment_type == 'all':
                    has_access = True
                else:
                    # Verificar en GroupExamMember
                    exam_member = GroupExamMember.query.filter_by(
                        group_exam_id=group_exam.id,
                        user_id=user.id
                    ).first()
                    has_access = exam_member is not None
                
                if not has_access:
                    print(f"    - Examen '{exam.name}': Sin acceso (skip)")
                    continue
                
                # Verificar si ya tiene un resultado aprobado para este examen
                existing_result = Result.query.filter_by(
                    user_id=user.id,
                    exam_id=exam.id,
                    status=1,  # completado
                    result=1   # aprobado
                ).first()
                
                if existing_result:
                    print(f"    - Examen '{exam.name}': Ya tiene resultado aprobado (skip)")
                    results_skipped.append({
                        'user': user.full_name,
                        'exam': exam.name,
                        'reason': 'Ya tiene resultado aprobado'
                    })
                    continue
                
                # Crear nuevo resultado
                now = datetime.utcnow()
                start_time = now - timedelta(minutes=30)  # Simular 30 min de duración
                
                new_result = Result(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    exam_id=exam.id,
                    competency_standard_id=exam.competency_standard_id if hasattr(exam, 'competency_standard_id') else None,
                    score=100,
                    status=1,  # completado
                    result=1,  # aprobado
                    start_date=start_time,
                    end_date=now,
                    duration_seconds=1800,  # 30 minutos
                    ip_address='192.168.1.1',
                    user_agent='Mozilla/5.0 (Emergency Script)',
                    browser='Emergency Script',
                    answers_data=None,
                    questions_order=None,
                    pdf_status='pending'
                )
                
                db.session.add(new_result)
                print(f"    - Examen '{exam.name}': RESULTADO CREADO (100%, Aprobado)")
                results_created.append({
                    'user': user.full_name,
                    'email': user.email,
                    'exam': exam.name,
                    'result_id': new_result.id
                })
        
        # Confirmar cambios
        if results_created:
            db.session.commit()
            print(f"\n{'='*60}")
            print(f"RESUMEN")
            print(f"{'='*60}")
            print(f"Resultados creados: {len(results_created)}")
            print(f"Resultados omitidos (ya existían): {len(results_skipped)}")
            print("\nDetalles de resultados creados:")
            for r in results_created:
                print(f"  - {r['user']} ({r['email']}): {r['exam']}")
        else:
            print("\nNo se crearon nuevos resultados")

if __name__ == '__main__':
    main()
