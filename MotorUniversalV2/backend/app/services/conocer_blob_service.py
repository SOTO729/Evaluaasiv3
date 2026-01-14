"""
Servicio de Azure Blob Storage para Certificados CONOCER
Gestiona el almacenamiento, descarga y lifecycle de los certificados
"""
import os
import hashlib
from datetime import datetime, timedelta
from typing import Optional, BinaryIO, Tuple

# Lazy imports para evitar errores cuando no hay conexión
BlobServiceClient = None
StandardBlobTier = None
ResourceNotFoundError = None
ResourceExistsError = None
generate_blob_sas = None
BlobSasPermissions = None
ContentSettings = None


def _lazy_load_azure():
    """Cargar módulos de Azure de forma perezosa"""
    global BlobServiceClient, StandardBlobTier, ResourceNotFoundError, ResourceExistsError, generate_blob_sas, BlobSasPermissions, ContentSettings
    
    if BlobServiceClient is None:
        from azure.storage.blob import (
            BlobServiceClient as BSC,
            StandardBlobTier as SBT,
            generate_blob_sas as GBS,
            BlobSasPermissions as BSP,
            ContentSettings as CS
        )
        from azure.core.exceptions import (
            ResourceNotFoundError as RNFE,
            ResourceExistsError as REE
        )
        BlobServiceClient = BSC
        StandardBlobTier = SBT
        ResourceNotFoundError = RNFE
        ResourceExistsError = REE
        generate_blob_sas = GBS
        BlobSasPermissions = BSP
        ContentSettings = CS


class ConocerBlobService:
    """
    Servicio para gestionar certificados CONOCER en Azure Blob Storage
    
    Estrategia de almacenamiento:
    - Contenedor: conocer-certificates (Access tier: Cool)
    - Los certificados nuevos se suben en tier Cool (acceso frecuente a corto plazo)
    - Después de 90 días sin acceso, se mueven automáticamente a Archive tier
    - Los certificados en Archive siguen disponibles pero con mayor latencia (rehidratación)
    
    Política de retención:
    - Retención mínima: Indefinida (los certificados deben conservarse permanentemente)
    - Soft delete: 30 días (para recuperar eliminaciones accidentales)
    - Versionado: Habilitado (para mantener historial)
    """
    
    # Configuración de contenedores
    CONTAINER_CERTIFICATES = 'conocer-certificates'  # Certificados activos (Cool)
    
    # Configuración de lifecycle
    DAYS_TO_ARCHIVE = 90  # Días antes de mover a Archive
    SOFT_DELETE_DAYS = 30  # Días de soft delete
    
    def __init__(self, connection_string: str = None):
        """
        Inicializar el servicio de blob storage
        
        Args:
            connection_string: Connection string de Azure Storage. 
                              Si no se provee, se obtiene de variable de entorno.
        """
        _lazy_load_azure()
        
        self.connection_string = connection_string or os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        
        if not self.connection_string:
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING no está configurado")
        
        self.blob_service_client = BlobServiceClient.from_connection_string(self.connection_string)
        self._ensure_container_exists()
    
    def _ensure_container_exists(self):
        """Crear el contenedor si no existe"""
        try:
            container_client = self.blob_service_client.get_container_client(self.CONTAINER_CERTIFICATES)
            if not container_client.exists():
                # Crear contenedor con acceso privado
                container_client.create_container()
                print(f"Contenedor '{self.CONTAINER_CERTIFICATES}' creado")
        except ResourceExistsError:
            pass  # El contenedor ya existe
        except Exception as e:
            print(f"Error verificando contenedor: {e}")
    
    def _generate_blob_name(self, user_id: str, certificate_number: str, standard_code: str) -> str:
        """
        Generar nombre único para el blob
        
        Estructura: {año}/{mes}/{user_id}/{standard_code}_{certificate_number}.pdf
        
        Esta estructura:
        - Agrupa por fecha para facilitar lifecycle management
        - Incluye user_id para organización lógica
        - Incluye standard_code para identificación rápida
        - Termina con certificate_number para unicidad
        """
        now = datetime.utcnow()
        return f"{now.year}/{now.month:02d}/{user_id}/{standard_code}_{certificate_number}.pdf"
    
    def _calculate_file_hash(self, file_content: bytes) -> str:
        """Calcular SHA-256 del archivo para verificación de integridad"""
        return hashlib.sha256(file_content).hexdigest()
    
    def upload_certificate(
        self,
        file_content: bytes,
        user_id: str,
        certificate_number: str,
        standard_code: str,
        content_type: str = 'application/pdf',
        metadata: dict = None
    ) -> Tuple[str, str, int]:
        """
        Subir un certificado CONOCER al blob storage
        
        Args:
            file_content: Contenido del archivo en bytes
            user_id: ID del usuario
            certificate_number: Número de folio del certificado
            standard_code: Código del estándar de competencia (ej: EC0217)
            content_type: Tipo MIME del archivo
            metadata: Metadata adicional para el blob
        
        Returns:
            Tuple con (blob_name, file_hash, file_size)
        
        Raises:
            ValueError: Si el archivo está vacío o excede el límite
            Exception: Si hay error al subir
        """
        if not file_content:
            raise ValueError("El archivo está vacío")
        
        # Límite de 50MB para certificados
        max_size = 50 * 1024 * 1024
        if len(file_content) > max_size:
            raise ValueError(f"El archivo excede el límite de {max_size // (1024*1024)}MB")
        
        blob_name = self._generate_blob_name(user_id, certificate_number, standard_code)
        file_hash = self._calculate_file_hash(file_content)
        file_size = len(file_content)
        
        # Preparar metadata del blob
        blob_metadata = {
            'user_id': user_id,
            'certificate_number': certificate_number,
            'standard_code': standard_code,
            'file_hash': file_hash,
            'uploaded_at': datetime.utcnow().isoformat()
        }
        if metadata:
            blob_metadata.update(metadata)
        
        # Obtener cliente del blob
        blob_client = self.blob_service_client.get_blob_client(
            container=self.CONTAINER_CERTIFICATES,
            blob=blob_name
        )
        
        # Subir con tier Cool
        blob_client.upload_blob(
            file_content,
            blob_type="BlockBlob",
            content_settings=ContentSettings(
                content_type=content_type,
                content_disposition=f'attachment; filename="{standard_code}_{certificate_number}.pdf"'
            ),
            metadata=blob_metadata,
            standard_blob_tier=StandardBlobTier.COOL,
            overwrite=True  # Sobrescribir si existe (por ejemplo, actualización)
        )
        
        return blob_name, file_hash, file_size
    
    def download_certificate(self, blob_name: str) -> Tuple[bytes, dict]:
        """
        Descargar un certificado del blob storage
        
        Args:
            blob_name: Nombre/ruta del blob
        
        Returns:
            Tuple con (contenido_bytes, propiedades_blob)
        
        Raises:
            ResourceNotFoundError: Si el blob no existe
            Exception: Si el blob está en Archive y necesita rehidratación
        """
        blob_client = self.blob_service_client.get_blob_client(
            container=self.CONTAINER_CERTIFICATES,
            blob=blob_name
        )
        
        # Obtener propiedades para verificar el tier
        properties = blob_client.get_blob_properties()
        
        # Si está en Archive, necesita rehidratación
        if properties.blob_tier == StandardBlobTier.ARCHIVE:
            # Verificar si ya hay una rehidratación en progreso
            if properties.archive_status:
                raise Exception(
                    f"El certificado está siendo rehidratado. "
                    f"Estado: {properties.archive_status}. "
                    f"Por favor intente de nuevo en unas horas."
                )
            else:
                # Iniciar rehidratación a Cool
                blob_client.set_standard_blob_tier(
                    StandardBlobTier.COOL,
                    rehydrate_priority='Standard'  # Standard: ~15hrs, High: ~1hr (más caro)
                )
                raise Exception(
                    "El certificado está en almacenamiento de archivo. "
                    "Se ha iniciado la recuperación automática. "
                    "El certificado estará disponible en aproximadamente 15 horas. "
                    "Recibirá una notificación cuando esté listo."
                )
        
        # Descargar el blob
        download_stream = blob_client.download_blob()
        content = download_stream.readall()
        
        return content, {
            'content_type': properties.content_settings.content_type,
            'size': properties.size,
            'last_modified': properties.last_modified,
            'blob_tier': str(properties.blob_tier),
            'metadata': properties.metadata
        }
    
    def generate_download_url(
        self,
        blob_name: str,
        expiry_hours: int = 1,
        filename: str = None
    ) -> Optional[str]:
        """
        Generar URL con SAS token para descarga directa
        
        Args:
            blob_name: Nombre/ruta del blob
            expiry_hours: Horas de validez del URL (default: 1 hora)
            filename: Nombre del archivo para el header Content-Disposition
        
        Returns:
            URL con SAS token para descarga o None si el blob está en Archive
        """
        blob_client = self.blob_service_client.get_blob_client(
            container=self.CONTAINER_CERTIFICATES,
            blob=blob_name
        )
        
        # Verificar que el blob existe y no está en Archive
        try:
            properties = blob_client.get_blob_properties()
            if properties.blob_tier == StandardBlobTier.ARCHIVE:
                return None  # No se puede generar URL para blobs en Archive
        except ResourceNotFoundError:
            return None
        
        # Generar SAS token
        sas_token = generate_blob_sas(
            account_name=self.blob_service_client.account_name,
            container_name=self.CONTAINER_CERTIFICATES,
            blob_name=blob_name,
            account_key=self.blob_service_client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(hours=expiry_hours),
            content_disposition=f'attachment; filename="{filename}"' if filename else None
        )
        
        return f"{blob_client.url}?{sas_token}"
    
    def move_to_archive(self, blob_name: str) -> bool:
        """
        Mover un certificado al tier Archive manualmente
        
        Args:
            blob_name: Nombre/ruta del blob
        
        Returns:
            True si se movió exitosamente, False si ya estaba en Archive
        """
        blob_client = self.blob_service_client.get_blob_client(
            container=self.CONTAINER_CERTIFICATES,
            blob=blob_name
        )
        
        properties = blob_client.get_blob_properties()
        
        if properties.blob_tier == StandardBlobTier.ARCHIVE:
            return False  # Ya está en Archive
        
        blob_client.set_standard_blob_tier(StandardBlobTier.ARCHIVE)
        return True
    
    def rehydrate_from_archive(self, blob_name: str, priority: str = 'Standard') -> dict:
        """
        Iniciar rehidratación de un certificado desde Archive
        
        Args:
            blob_name: Nombre/ruta del blob
            priority: 'Standard' (~15hrs) o 'High' (~1hr, más costoso)
        
        Returns:
            Diccionario con estado de la rehidratación
        """
        blob_client = self.blob_service_client.get_blob_client(
            container=self.CONTAINER_CERTIFICATES,
            blob=blob_name
        )
        
        properties = blob_client.get_blob_properties()
        
        if properties.blob_tier != StandardBlobTier.ARCHIVE:
            return {
                'status': 'ready',
                'message': 'El certificado ya está disponible para descarga'
            }
        
        if properties.archive_status:
            return {
                'status': 'in_progress',
                'archive_status': properties.archive_status,
                'message': 'La rehidratación ya está en progreso'
            }
        
        # Iniciar rehidratación
        rehydrate_priority = 'High' if priority.lower() == 'high' else 'Standard'
        blob_client.set_standard_blob_tier(
            StandardBlobTier.COOL,
            rehydrate_priority=rehydrate_priority
        )
        
        return {
            'status': 'started',
            'priority': rehydrate_priority,
            'estimated_time': '1 hora' if rehydrate_priority == 'High' else '15 horas',
            'message': f'Rehidratación iniciada con prioridad {rehydrate_priority}'
        }
    
    def get_blob_status(self, blob_name: str) -> Optional[dict]:
        """
        Obtener estado de un blob (tier, rehidratación, etc.)
        
        Args:
            blob_name: Nombre/ruta del blob
        
        Returns:
            Diccionario con información del estado o None si no existe
        """
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.CONTAINER_CERTIFICATES,
                blob=blob_name
            )
            
            properties = blob_client.get_blob_properties()
            
            is_available = properties.blob_tier != StandardBlobTier.ARCHIVE
            
            return {
                'exists': True,
                'blob_tier': str(properties.blob_tier),
                'is_available': is_available,
                'archive_status': properties.archive_status,
                'size': properties.size,
                'last_modified': properties.last_modified.isoformat(),
                'content_type': properties.content_settings.content_type,
                'metadata': properties.metadata
            }
        except ResourceNotFoundError:
            return None
    
    def delete_certificate(self, blob_name: str) -> bool:
        """
        Eliminar un certificado (soft delete - recuperable por 30 días)
        
        Args:
            blob_name: Nombre/ruta del blob
        
        Returns:
            True si se eliminó exitosamente
        """
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.CONTAINER_CERTIFICATES,
                blob=blob_name
            )
            blob_client.delete_blob()
            return True
        except ResourceNotFoundError:
            return False
    
    def list_user_certificates(self, user_id: str) -> list:
        """
        Listar todos los certificados de un usuario
        
        Args:
            user_id: ID del usuario
        
        Returns:
            Lista de blobs del usuario
        """
        container_client = self.blob_service_client.get_container_client(self.CONTAINER_CERTIFICATES)
        
        # Los blobs están organizados por año/mes/user_id/...
        # Buscamos en todas las carpetas por el user_id
        certificates = []
        
        for blob in container_client.list_blobs(include=['metadata']):
            if blob.metadata and blob.metadata.get('user_id') == user_id:
                certificates.append({
                    'name': blob.name,
                    'size': blob.size,
                    'tier': str(blob.blob_tier) if blob.blob_tier else 'Unknown',
                    'last_modified': blob.last_modified.isoformat(),
                    'metadata': blob.metadata
                })
        
        return certificates


# Singleton para reutilizar la conexión
_blob_service_instance = None


class FallbackBlobService:
    """
    Servicio fallback cuando no hay Azure Storage dedicado para CONOCER.
    Usa el storage principal de la aplicación (azure_storage).
    """
    CONTAINER_CERTIFICATES = 'conocer-certificates'
    
    def __init__(self):
        self.storage = None
        self.blob_client = None
        self.container_name = None
        self._init_storage()
    
    def _init_storage(self):
        """Inicializar el storage de forma lazy"""
        try:
            from app.utils.azure_storage import azure_storage
            if azure_storage and azure_storage.blob_service_client:
                self.storage = azure_storage
                self.blob_client = azure_storage.blob_service_client
                self.container_name = azure_storage.container_name
                print("FallbackBlobService: Conectado a Azure Storage principal")
            else:
                print("FallbackBlobService: Azure Storage no disponible")
        except Exception as e:
            print(f"FallbackBlobService: Error inicializando storage: {e}")
    
    def _generate_blob_name(self, user_id: str, certificate_number: str, standard_code: str) -> str:
        from datetime import datetime
        now = datetime.utcnow()
        return f"conocer-certificates/{now.year}/{now.month:02d}/{user_id}/{standard_code}_{certificate_number}.pdf"
    
    def _calculate_file_hash(self, file_content: bytes) -> str:
        return hashlib.sha256(file_content).hexdigest()
    
    def upload_certificate(
        self,
        file_content: bytes,
        user_id: str,
        certificate_number: str,
        standard_code: str,
        content_type: str = 'application/pdf',
        metadata: dict = None
    ):
        """Subir certificado usando el storage principal directamente"""
        if not file_content:
            raise ValueError("El archivo está vacío")
        
        blob_name = self._generate_blob_name(user_id, certificate_number, standard_code)
        file_hash = self._calculate_file_hash(file_content)
        file_size = len(file_content)
        
        # Reintentar init si no está disponible
        if not self.blob_client:
            self._init_storage()
        
        if self.blob_client and self.container_name:
            try:
                from azure.storage.blob import ContentSettings
                
                # Subir directamente usando el blob_client
                blob_client = self.blob_client.get_blob_client(
                    container=self.container_name,
                    blob=blob_name
                )
                
                blob_client.upload_blob(
                    file_content,
                    overwrite=True,
                    content_settings=ContentSettings(
                        content_type=content_type,
                        content_disposition=f'attachment; filename="{standard_code}_{certificate_number}.pdf"'
                    )
                )
                
                # La URL completa del blob
                blob_url = blob_client.url
                print(f"FallbackBlobService: Certificado subido: {blob_url[:60]}...")
                
                return blob_url, file_hash, file_size
                    
            except Exception as e:
                import traceback
                print(f"FallbackBlobService: Error subiendo archivo: {e}")
                print(traceback.format_exc())
                raise Exception(f"Error al subir certificado: {e}")
        else:
            raise Exception("Azure Storage no está configurado o no hay blob_client")
    
    def download_certificate(self, blob_name: str):
        """Descargar certificado"""
        if blob_name and blob_name.startswith('http'):
            import requests
            try:
                response = requests.get(blob_name, timeout=30)
                if response.status_code == 200:
                    return response.content, {'content_type': 'application/pdf'}
            except Exception as e:
                print(f"FallbackBlobService: Error descargando: {e}")
        raise Exception("Certificado no disponible")
    
    def get_blob_status(self, blob_name: str):
        """Retorna estado dummy para fallback"""
        return {
            'tier': 'Hot', 
            'rehydration_status': None,
            'is_fallback': True
        }


def get_conocer_blob_service():
    """
    Obtener instancia del servicio de blob storage (singleton)
    Usa FallbackBlobService si no hay connection string específica de CONOCER
    
    Returns:
        Instancia de ConocerBlobService o FallbackBlobService
    """
    global _blob_service_instance
    
    if _blob_service_instance is None:
        # Intentar crear el servicio principal
        try:
            _blob_service_instance = ConocerBlobService()
        except (ValueError, Exception) as e:
            # Si falla, usar el fallback
            print(f"Usando FallbackBlobService: {e}")
            _blob_service_instance = FallbackBlobService()
    
    return _blob_service_instance
