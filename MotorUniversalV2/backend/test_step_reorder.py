"""
Script de prueba para verificar el reordenamiento de pasos
"""
import requests
import json

# Configuración
BASE_URL = "http://localhost:5000/api"

def login():
    """Login y obtener token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get('access_token')
    else:
        print(f"Error en login: {response.text}")
        return None

def get_exercise_details(token, exercise_id):
    """Obtener detalles de un ejercicio"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/exams/exercises/{exercise_id}/details", headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error obteniendo ejercicio: {response.text}")
        return None

def update_step(token, step_id, step_number):
    """Actualizar el step_number de un paso"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.put(
        f"{BASE_URL}/exams/steps/{step_id}",
        headers=headers,
        json={"step_number": step_number}
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error actualizando paso: {response.text}")
        return None

def test_reorder():
    """Test principal"""
    print("\n=== TEST DE REORDENAMIENTO DE PASOS ===\n")
    
    # Login
    print("1. Login...")
    token = login()
    if not token:
        print("❌ Error en login")
        return
    print("✓ Login exitoso\n")
    
    # Solicitar exercise_id al usuario
    exercise_id = input("Ingresa el ID del ejercicio a probar: ").strip()
    
    # Obtener detalles del ejercicio
    print(f"\n2. Obteniendo detalles del ejercicio {exercise_id}...")
    exercise_data = get_exercise_details(token, exercise_id)
    
    if not exercise_data or 'exercise' not in exercise_data:
        print("❌ No se pudo obtener el ejercicio")
        return
    
    steps = exercise_data['exercise'].get('steps', [])
    
    if len(steps) < 2:
        print("❌ El ejercicio necesita al menos 2 pasos para probar el reordenamiento")
        return
    
    print(f"✓ Ejercicio encontrado con {len(steps)} pasos\n")
    
    # Mostrar pasos actuales
    print("Pasos actuales:")
    for step in steps:
        print(f"  - Paso {step['step_number']}: ID={step['id']}")
    
    # Intercambiar los primeros dos pasos
    step1 = steps[0]
    step2 = steps[1]
    
    print(f"\n3. Intercambiando orden de pasos...")
    print(f"   Paso {step1['step_number']} (ID={step1['id']}) → Paso {step2['step_number']}")
    print(f"   Paso {step2['step_number']} (ID={step2['id']}) → Paso {step1['step_number']}")
    
    # Actualizar paso 1
    result1 = update_step(token, step1['id'], step2['step_number'])
    if not result1:
        print("❌ Error actualizando paso 1")
        return
    
    # Actualizar paso 2
    result2 = update_step(token, step2['id'], step1['step_number'])
    if not result2:
        print("❌ Error actualizando paso 2")
        return
    
    print("✓ Pasos actualizados\n")
    
    # Verificar cambios
    print("4. Verificando cambios...")
    exercise_data_updated = get_exercise_details(token, exercise_id)
    
    if not exercise_data_updated:
        print("❌ Error verificando cambios")
        return
    
    steps_updated = exercise_data_updated['exercise'].get('steps', [])
    
    print("Pasos después del reordenamiento:")
    for step in steps_updated:
        print(f"  - Paso {step['step_number']}: ID={step['id']}")
    
    # Verificar que el orden cambió
    if (steps_updated[0]['id'] == step2['id'] and 
        steps_updated[1]['id'] == step1['id']):
        print("\n✅ TEST EXITOSO: Los pasos se reordenaron correctamente")
    else:
        print("\n❌ TEST FALLIDO: El orden no cambió como se esperaba")
        print(f"Esperado: [{step2['id']}, {step1['id']}, ...]")
        print(f"Obtenido: [{steps_updated[0]['id']}, {steps_updated[1]['id']}, ...]")

if __name__ == "__main__":
    test_reorder()
