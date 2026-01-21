"""
Módulo de conexión a base de datos para Azure Functions

Utiliza las mismas variables de entorno que el backend principal.
"""
import os
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
import urllib

Base = declarative_base()


def get_connection_string():
    """
    Construye el connection string para Azure SQL Server
    """
    server = os.environ.get('DB_SERVER')
    database = os.environ.get('DB_NAME')
    username = os.environ.get('DB_USER')
    password = os.environ.get('DB_PASSWORD')
    
    # Construir connection string para pyodbc
    params = urllib.parse.quote_plus(
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
        f"Connection Timeout=30;"
    )
    
    return f"mssql+pyodbc:///?odbc_connect={params}"


def get_db_session():
    """
    Crea una sesión de base de datos
    """
    engine = create_engine(get_connection_string(), pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    return Session()


# Modelos simplificados (solo los campos necesarios para PDF)
class User(Base):
    """Modelo de usuario simplificado"""
    __tablename__ = 'users'
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True)
    email = Column(String(255))
    name = Column(String(255))
    first_surname = Column(String(255))
    second_surname = Column(String(255))
    company_id = Column(UNIQUEIDENTIFIER)


class Exam(Base):
    """Modelo de examen simplificado"""
    __tablename__ = 'exams'
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True)
    name = Column(String(500))
    version = Column(String(100))  # ECM code
    passing_score = Column(Integer, default=70)
    competency_standard_id = Column(UNIQUEIDENTIFIER)


class Result(Base):
    """Modelo de resultado de examen"""
    __tablename__ = 'results'
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True)
    exam_id = Column(UNIQUEIDENTIFIER, ForeignKey('exams.id'))
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id'))
    score = Column(Float)
    result = Column(Integer)  # 1 = aprobado, 0 = no aprobado
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    certificate_code = Column(String(100))
    report_url = Column(String(500))
    certificate_url = Column(String(500))
    pdf_status = Column(String(50), default='pending')  # pending, processing, completed, error


class CompetencyStandard(Base):
    """Modelo de estándar de competencia"""
    __tablename__ = 'competency_standards'
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True)
    name = Column(String(255))
    code = Column(String(100))
    description = Column(Text)
