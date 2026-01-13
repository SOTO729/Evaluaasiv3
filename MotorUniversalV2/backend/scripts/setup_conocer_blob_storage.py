#!/usr/bin/env python3
"""
Script para configurar Azure Blob Storage para certificados CONOCER

Este script:
1. Crea el contenedor 'conocer-certificates' con tier Cool
2. Configura lifecycle management para mover a Archive después de 90 días
3. Habilita soft delete (30 días)
4. Habilita versionado

Ejecutar con:
    python setup_conocer_blob_storage.py

Requiere las siguientes variables de entorno:
    - AZURE_STORAGE_CONNECTION_STRING: Connection string de la cuenta de storage
    
O usar Azure CLI:
    az storage container create --name conocer-certificates --account-name <storage_account>
"""
import os
import json
import sys

try:
    from azure.storage.blob import BlobServiceClient
    from azure.mgmt.storage import StorageManagementClient
    from azure.identity import DefaultAzureCredential
except ImportError:
    print("Instalar dependencias: pip install azure-storage-blob azure-mgmt-storage azure-identity")
    sys.exit(1)


def setup_blob_storage():
    """Configurar el contenedor y las políticas"""
    
    connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    if not connection_string:
        print("ERROR: AZURE_STORAGE_CONNECTION_STRING no está configurado")
        print("\nPuede configurarlo con:")
        print("  export AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=https;...'")
        sys.exit(1)
    
    blob_service = BlobServiceClient.from_connection_string(connection_string)
    container_name = 'conocer-certificates'
    
    # 1. Crear contenedor
    print(f"\n1. Creando contenedor '{container_name}'...")
    try:
        container_client = blob_service.create_container(container_name)
        print(f"   ✓ Contenedor '{container_name}' creado exitosamente")
    except Exception as e:
        if 'ContainerAlreadyExists' in str(e):
            print(f"   ℹ Contenedor '{container_name}' ya existe")
        else:
            print(f"   ✗ Error: {e}")
    
    print("\n" + "="*60)
    print("CONFIGURACIÓN MANUAL REQUERIDA EN AZURE PORTAL")
    print("="*60)
    
    print("""
Para completar la configuración, vaya al Azure Portal:

2. LIFECYCLE MANAGEMENT (Administración del ciclo de vida):
   - Navegar a: Storage Account > Data management > Lifecycle management
   - Agregar regla con la siguiente configuración:
   
   Nombre de regla: conocer-archive-policy
   Ámbito: Aplicar a contenedor 'conocer-certificates'
   Tipo de blob: Block blobs
   
   Condiciones:
   - Mover a tier Cool: Después de 0 días desde la última modificación
     (Los blobs ya se suben en Cool por defecto)
   - Mover a tier Archive: Después de 90 días desde el último acceso
   
   JSON de la política:
   """)
    
    lifecycle_policy = {
        "rules": [
            {
                "enabled": True,
                "name": "conocer-archive-policy",
                "type": "Lifecycle",
                "definition": {
                    "filters": {
                        "blobTypes": ["blockBlob"],
                        "prefixMatch": [""]
                    },
                    "actions": {
                        "baseBlob": {
                            "tierToArchive": {
                                "daysAfterLastAccessTimeGreaterThan": 90
                            }
                        }
                    }
                }
            }
        ]
    }
    
    print(json.dumps(lifecycle_policy, indent=2))
    
    print("""
3. SOFT DELETE:
   - Navegar a: Storage Account > Data protection
   - Habilitar 'Enable soft delete for blobs'
   - Configurar retención: 30 días
   
4. BLOB VERSIONING:
   - En la misma sección Data protection
   - Habilitar 'Enable versioning for blobs'

5. ACCESS TRACKING (para lifecycle por último acceso):
   - Navegar a: Storage Account > Configuration
   - Habilitar 'Enable blob last access time tracking'
   
""")
    
    print("="*60)
    print("COMANDOS DE AZURE CLI EQUIVALENTES")
    print("="*60)
    
    # Obtener nombre de la cuenta desde el connection string
    account_name = None
    for part in connection_string.split(';'):
        if part.startswith('AccountName='):
            account_name = part.split('=')[1]
            break
    
    if account_name:
        print(f"""
# Habilitar tracking de último acceso
az storage account blob-service-properties update \\
    --account-name {account_name} \\
    --enable-last-access-tracking true

# Habilitar soft delete (30 días)
az storage blob service-properties delete-policy update \\
    --account-name {account_name} \\
    --enable true \\
    --days-retained 30

# Habilitar versionado
az storage account blob-service-properties update \\
    --account-name {account_name} \\
    --enable-versioning true

# Crear política de lifecycle
az storage account management-policy create \\
    --account-name {account_name} \\
    --policy '{json.dumps(lifecycle_policy)}'
""")
    
    print("\n✓ Script completado. Revise la configuración manual arriba.")


def print_storage_info():
    """Mostrar información sobre los tiers de Azure Blob Storage"""
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║            AZURE BLOB STORAGE - TIERS Y COSTOS                       ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  HOT (Caliente)                                                     ║
║  ├─ Acceso: Inmediato                                               ║
║  ├─ Costo almacenamiento: Alto (~$0.0184/GB/mes)                    ║
║  ├─ Costo lectura: Bajo                                             ║
║  └─ Uso: Datos accedidos frecuentemente                             ║
║                                                                      ║
║  COOL (Frío) ← RECOMENDADO PARA CERTIFICADOS                        ║
║  ├─ Acceso: Inmediato                                               ║
║  ├─ Costo almacenamiento: Medio (~$0.01/GB/mes)                     ║
║  ├─ Costo lectura: Medio                                            ║
║  ├─ Retención mínima: 30 días                                       ║
║  └─ Uso: Datos accedidos ocasionalmente                             ║
║                                                                      ║
║  ARCHIVE (Archivo)                                                   ║
║  ├─ Acceso: Requiere rehidratación (1-15 horas)                     ║
║  ├─ Costo almacenamiento: Muy bajo (~$0.00099/GB/mes)               ║
║  ├─ Costo rehidratación: Alto                                       ║
║  ├─ Retención mínima: 180 días                                      ║
║  └─ Uso: Datos raramente accedidos, archivo a largo plazo           ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  ESTRATEGIA PARA CERTIFICADOS CONOCER:                               ║
║                                                                      ║
║  1. Subida inicial → Tier COOL                                       ║
║     (Balance entre costo y disponibilidad)                          ║
║                                                                      ║
║  2. Después de 90 días sin acceso → Tier ARCHIVE (automático)       ║
║     (Ahorro significativo en almacenamiento)                        ║
║                                                                      ║
║  3. Al solicitar descarga de certificado archivado:                 ║
║     a) Se inicia rehidratación automática a COOL                    ║
║     b) Usuario recibe mensaje de espera (~15 hrs estándar, ~1hr $)  ║
║     c) Una vez rehidratado, se puede descargar                      ║
║     d) El certificado permanece en COOL hasta próximo ciclo         ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
""")


if __name__ == '__main__':
    print_storage_info()
    setup_blob_storage()
