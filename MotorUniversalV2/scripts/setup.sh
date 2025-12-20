#!/bin/bash

# Script de inicialización para Evaluaasi Motor Universal V2
# Autor: Evaluaasi Team
# Descripción: Configura el entorno de desarrollo local

set -e  # Exit on error

echo "🚀 Iniciando configuración de Evaluaasi Motor Universal V2..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Verificar requisitos
echo "📋 Verificando requisitos previos..."

# Verificar Docker
if command -v docker &> /dev/null; then
    print_success "Docker está instalado: $(docker --version)"
else
    print_error "Docker no está instalado. Por favor instálalo desde https://www.docker.com/"
    exit 1
fi

# Verificar Docker Compose
if command -v docker-compose &> /dev/null; then
    print_success "Docker Compose está instalado: $(docker-compose --version)"
else
    print_error "Docker Compose no está instalado"
    exit 1
fi

# Verificar Node.js (opcional)
if command -v node &> /dev/null; then
    print_success "Node.js está instalado: $(node --version)"
else
    print_warning "Node.js no está instalado (opcional para desarrollo local)"
fi

# Verificar Python (opcional)
if command -v python3 &> /dev/null; then
    print_success "Python está instalado: $(python3 --version)"
else
    print_warning "Python no está instalado (opcional para desarrollo local)"
fi

echo ""
echo "⚙️  Configurando variables de entorno..."

# Configurar Backend
if [ ! -f "backend/.env" ]; then
    echo "Creando backend/.env desde .env.example..."
    cp backend/.env.example backend/.env
    
    # Generar secrets aleatorios
    SECRET_KEY=$(openssl rand -base64 32)
    JWT_SECRET_KEY=$(openssl rand -base64 32)
    
    # Reemplazar en .env (macOS compatible)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/your-secret-key-here/$SECRET_KEY/" backend/.env
        sed -i '' "s/your-jwt-secret-key-here/$JWT_SECRET_KEY/" backend/.env
    else
        sed -i "s/your-secret-key-here/$SECRET_KEY/" backend/.env
        sed -i "s/your-jwt-secret-key-here/$JWT_SECRET_KEY/" backend/.env
    fi
    
    print_success "Archivo backend/.env creado con secrets generados"
else
    print_warning "backend/.env ya existe, saltando..."
fi

# Configurar Frontend
if [ ! -f "frontend/.env" ]; then
    echo "Creando frontend/.env desde .env.example..."
    cp frontend/.env.example frontend/.env
    print_success "Archivo frontend/.env creado"
else
    print_warning "frontend/.env ya existe, saltando..."
fi

echo ""
echo "🐳 Iniciando servicios con Docker Compose..."

# Construir imágenes
docker-compose build

# Iniciar servicios
docker-compose up -d

echo ""
echo "⏳ Esperando a que los servicios estén listos..."
sleep 10

# Verificar que los servicios estén corriendo
if docker-compose ps | grep -q "evaluaasi_db.*Up"; then
    print_success "Base de datos PostgreSQL está corriendo"
else
    print_error "Base de datos no está corriendo"
fi

if docker-compose ps | grep -q "evaluaasi_redis.*Up"; then
    print_success "Redis está corriendo"
else
    print_error "Redis no está corriendo"
fi

if docker-compose ps | grep -q "evaluaasi_backend.*Up"; then
    print_success "Backend Flask está corriendo"
else
    print_error "Backend no está corriendo"
fi

if docker-compose ps | grep -q "evaluaasi_frontend.*Up"; then
    print_success "Frontend React está corriendo"
else
    print_error "Frontend no está corriendo"
fi

echo ""
echo "🗄️  Configurando base de datos..."

# Ejecutar migraciones
echo "Ejecutando migraciones..."
docker-compose exec -T backend flask db upgrade
print_success "Migraciones ejecutadas"

# Preguntar si cargar datos de prueba
echo ""
read -p "¿Deseas cargar datos de prueba? (usuarios: admin, editor, alumno) [Y/n]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    docker-compose exec -T backend python seed.py
    print_success "Datos de prueba cargados"
    echo ""
    echo "📝 Usuarios de prueba creados:"
    echo "   - Usuario: admin    | Password: Admin123!  | Rol: Administrador"
    echo "   - Usuario: editor   | Password: Editor123! | Rol: Editor"
    echo "   - Usuario: alumno   | Password: Alumno123! | Rol: Alumno"
else
    print_warning "Saltando carga de datos de prueba"
fi

echo ""
echo "✨ ¡Configuración completada!"
echo ""
echo "🌐 Accede a la aplicación:"
echo "   - Frontend:     http://localhost:5173"
echo "   - Backend API:  http://localhost:5000"
echo "   - API Docs:     http://localhost:5000/api/docs"
echo ""
echo "📚 Comandos útiles:"
echo "   - Ver logs:           docker-compose logs -f"
echo "   - Detener servicios:  docker-compose down"
echo "   - Reiniciar:          docker-compose restart"
echo "   - Limpiar todo:       docker-compose down -v"
echo ""
echo "📖 Documentación:"
echo "   - Desarrollo:   docs/development.md"
echo "   - Despliegue:   docs/deployment.md"
echo "   - Arquitectura: docs/architecture.md"
echo ""
print_success "¡Happy coding! 🎉"
