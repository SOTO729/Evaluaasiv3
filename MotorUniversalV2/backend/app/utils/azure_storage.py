"""
Utilidades para Azure Storage
Soporta múltiples cuentas: una general y una optimizada para videos (Cool tier)
Implementa SAS tokens de corta duración para mayor seguridad
"""
from azure.storage.blob import BlobServiceClient, ContentSettings, StandardBlobTier, generate_blob_sas, BlobSasPermissions
from azure.core.exceptions import AzureError
from datetime import datetime, timedelta, timezone
import os
import uuid
import re
from urllib.parse import urlparse, parse_qs
from werkzeug.utils import secure_filename

# Configuración de SAS tokens
SAS_TOKEN_DURATION_HOURS = 24  # Duración de SAS tokens en horas
VIDEO_ACCOUNT_NAME = 'evaluaasivideos'
VIDEO_ACCOUNT_KEY = os.getenv('AZURE_VIDEO_ACCOUNT_KEY', 'r9C4hrfzCHwUjbFY2reYY3spGvPjTKV0oBPDmB2sDqhkBI4whu1NkmwAlEp+bRzwmeBxUK0dP3WD+AStEbwldw==')


class AzureStorageService:
    """Servicio para subir archivos a Azure Blob Storage"""
    
    def __init__(self):
        # Cuenta general (Hot tier)
        self.connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        self.container_name = os.getenv('AZURE_STORAGE_CONTAINER', 'evaluaasi-files')
        
        # Cuenta de videos (Cool tier - más económica)
        self.video_connection_string = os.getenv(
            'AZURE_VIDEO_STORAGE_CONNECTION_STRING',
            'DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=evaluaasivideos;AccountKey=r9C4hrfzCHwUjbFY2reYY3spGvPjTKV0oBPDmB2sDqhkBI4whu1NkmwAlEp+bRzwmeBxUK0dP3WD+AStEbwldw=='
        )
        self.video_container_name = os.getenv('AZURE_VIDEO_CONTAINER', 'videos')
        
        # Inicializar cliente general
        if self.connection_string:
            try:
                self.blob_service_client = BlobServiceClient.from_connection_string(self.connection_string)
                self._ensure_container_exists()
            except AzureError:
                self.blob_service_client = None
        else:
            self.blob_service_client = None
        
        # Inicializar cliente de videos
        if self.video_connection_string:
            try:
                self.video_blob_client = BlobServiceClient.from_connection_string(self.video_connection_string)
                self._ensure_video_container_exists()
            except AzureError:
                self.video_blob_client = None
        else:
            self.video_blob_client = None
    
    def _ensure_container_exists(self):
        """Crear contenedor general si no existe"""
        try:
            container_client = self.blob_service_client.get_container_client(self.container_name)
            if not container_client.exists():
                container_client.create_container(public_access='blob')
        except AzureError:
            pass
    
    def _ensure_video_container_exists(self):
        """Crear contenedor de videos si no existe"""
        try:
            container_client = self.video_blob_client.get_container_client(self.video_container_name)
            if not container_client.exists():
                container_client.create_container(public_access='blob')
        except AzureError:
            pass
    
    def upload_file(self, file, folder='general'):
        """
        Subir archivo a Azure Blob Storage
        
        Args:
            file: FileStorage object de Flask
            folder: Carpeta en el contenedor
        
        Returns:
            str: URL del archivo subido o None si falla
        """
        if not self.blob_service_client:
            return None
        
        try:
            # Generar nombre único
            filename = secure_filename(file.filename)
            ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
            unique_filename = f"{uuid.uuid4().hex}.{ext}"
            blob_name = f"{folder}/{unique_filename}"
            
            # Determinar content type
            content_type = file.content_type or 'application/octet-stream'
            
            # Subir archivo
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_name
            )
            
            blob_client.upload_blob(
                file,
                overwrite=True,
                content_settings=ContentSettings(content_type=content_type)
            )
            
            # Retornar URL
            return blob_client.url
        
        except AzureError as e:
            print(f"Error uploading to Azure: {str(e)}")
            return None
    
    def upload_video(self, file_or_path, original_filename=None):
        """
        Subir video a la cuenta de almacenamiento Cool tier (optimizada para costos)
        Soporta tanto FileStorage como path de archivo
        
        Args:
            file_or_path: FileStorage de Flask o path a archivo en disco
            original_filename: Nombre original del archivo (requerido si es path)
        
        Returns:
            str: URL del video subido con SAS token o None si falla
        """
        if not self.video_blob_client:
            print("Cliente de videos no configurado, usando almacenamiento general")
            if hasattr(file_or_path, 'read'):
                return self.upload_file(file_or_path, folder='study-videos')
            return None
        
        try:
            # Determinar si es FileStorage o path
            is_file_storage = hasattr(file_or_path, 'read')
            
            if is_file_storage:
                filename = secure_filename(file_or_path.filename)
            else:
                filename = secure_filename(original_filename or os.path.basename(file_or_path))
            
            # Generar nombre único (siempre .mp4 porque comprimimos a mp4)
            unique_filename = f"{uuid.uuid4().hex}.mp4"
            blob_name = unique_filename
            
            # Subir archivo
            blob_client = self.video_blob_client.get_blob_client(
                container=self.video_container_name,
                blob=blob_name
            )
            
            if is_file_storage:
                blob_client.upload_blob(
                    file_or_path,
                    overwrite=True,
                    content_settings=ContentSettings(content_type='video/mp4'),
                    standard_blob_tier=StandardBlobTier.COOL  # Tier Cool explícito
                )
            else:
                # Es un path a archivo
                with open(file_or_path, 'rb') as f:
                    blob_client.upload_blob(
                        f,
                        overwrite=True,
                        content_settings=ContentSettings(content_type='video/mp4'),
                        standard_blob_tier=StandardBlobTier.COOL
                    )
            
            # Guardar URL base sin SAS token (el SAS se genera bajo demanda)
            base_url = blob_client.url
            print(f"Video subido a Cool tier: {base_url}")
            
            # Para compatibilidad, retornamos URL con SAS token de corta duración
            # El frontend debe usar el endpoint /get-video-url para obtener URLs frescas
            signed_url = self.generate_video_sas_url(base_url)
            return signed_url
        
        except AzureError as e:
            print(f"Error uploading video to Azure Cool tier: {str(e)}")
            return None
    
    def generate_video_sas_url(self, blob_url, duration_hours=None):
        """
        Generar URL con SAS token de corta duración para un video existente
        
        Args:
            blob_url: URL del blob (con o sin SAS token existente)
            duration_hours: Duración del token en horas (default: SAS_TOKEN_DURATION_HOURS)
        
        Returns:
            str: URL con SAS token fresco o None si falla
        """
        if not blob_url:
            return None
        
        # Si no es un video de Azure, retornar tal cual
        if 'blob.core.windows.net' not in blob_url:
            return blob_url
        
        try:
            # Extraer la URL base (sin SAS token si lo tiene)
            base_url = blob_url.split('?')[0]
            
            # Extraer el nombre del blob
            # URL format: https://evaluaasivideos.blob.core.windows.net/videos/filename.mp4
            parsed = urlparse(base_url)
            path_parts = parsed.path.strip('/').split('/', 1)
            
            if len(path_parts) < 2:
                print(f"URL inválida: {blob_url}")
                return blob_url
            
            container_name = path_parts[0]
            blob_name = path_parts[1]
            
            # Determinar account name desde la URL
            account_name = parsed.netloc.split('.')[0]
            
            # Usar la duración especificada o la default
            hours = duration_hours or SAS_TOKEN_DURATION_HOURS
            
            # Generar nuevo SAS token
            sas_token = generate_blob_sas(
                account_name=account_name,
                container_name=container_name,
                blob_name=blob_name,
                account_key=VIDEO_ACCOUNT_KEY,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.now(timezone.utc) + timedelta(hours=hours)
            )
            
            return f"{base_url}?{sas_token}"
        
        except Exception as e:
            print(f"Error generating SAS token: {str(e)}")
            # En caso de error, retornar la URL original
            return blob_url
    
    def get_base_url(self, blob_url):
        """
        Extraer la URL base sin SAS token
        
        Args:
            blob_url: URL completa del blob (puede incluir SAS token)
        
        Returns:
            str: URL base sin query params
        """
        if not blob_url:
            return None
        return blob_url.split('?')[0]
    
    def delete_video(self, blob_url):
        """
        Eliminar video de la cuenta de videos (Cool tier)
        
        Args:
            blob_url: URL completa del blob
        
        Returns:
            bool: True si se eliminó correctamente
        """
        # Determinar qué cuenta usar basado en la URL
        if 'evaluaasivideos' in blob_url:
            client = self.video_blob_client
            container = self.video_container_name
        else:
            client = self.blob_service_client
            container = self.container_name
        
        if not client:
            return False
        
        try:
            # Extraer nombre del blob de la URL
            blob_name = blob_url.split(f'{container}/')[-1]
            
            blob_client = client.get_blob_client(
                container=container,
                blob=blob_name
            )
            
            blob_client.delete_blob()
            return True
        
        except AzureError as e:
            print(f"Error deleting video from Azure: {str(e)}")
            return False
    
    def upload_downloadable(self, file_or_path, original_filename=None, content_type=None):
        """
        Subir archivo descargable a la cuenta Cool tier
        Soporta tanto FileStorage como path de archivo (para ZIPs generados)
        
        Args:
            file_or_path: FileStorage de Flask o path a archivo en disco
            original_filename: Nombre original del archivo
            content_type: Tipo MIME del archivo
        
        Returns:
            tuple: (url, None) si éxito, (None, error_message) si falla
        """
        if not self.video_blob_client:
            print("Cliente Cool tier no configurado, intentando almacenamiento general")
            if hasattr(file_or_path, 'read'):
                result = self.upload_file(file_or_path, folder='downloadables')
                if result:
                    return result, None
                return None, "No hay almacenamiento configurado"
            return None, "Cliente de almacenamiento no disponible"
        
        try:
            is_file_storage = hasattr(file_or_path, 'read')
            
            if is_file_storage:
                filename = secure_filename(file_or_path.filename)
                content_type = content_type or file_or_path.content_type or 'application/octet-stream'
            else:
                filename = secure_filename(original_filename or os.path.basename(file_or_path))
                content_type = content_type or 'application/octet-stream'
            
            # Generar nombre único manteniendo extensión
            ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
            unique_filename = f"downloadables/{uuid.uuid4().hex}.{ext}"
            
            blob_client = self.video_blob_client.get_blob_client(
                container=self.video_container_name,
                blob=unique_filename
            )
            
            if is_file_storage:
                blob_client.upload_blob(
                    file_or_path,
                    overwrite=True,
                    content_settings=ContentSettings(
                        content_type=content_type,
                        content_disposition=f'attachment; filename="{filename}"'
                    ),
                    standard_blob_tier=StandardBlobTier.COOL
                )
            else:
                with open(file_or_path, 'rb') as f:
                    blob_client.upload_blob(
                        f,
                        overwrite=True,
                        content_settings=ContentSettings(
                            content_type=content_type,
                            content_disposition=f'attachment; filename="{filename}"'
                        ),
                        standard_blob_tier=StandardBlobTier.COOL
                    )
            
            # Generar URL con SAS token (válido por 10 años)
            sas_token = generate_blob_sas(
                account_name='evaluaasivideos',
                container_name=self.video_container_name,
                blob_name=unique_filename,
                account_key='r9C4hrfzCHwUjbFY2reYY3spGvPjTKV0oBPDmB2sDqhkBI4whu1NkmwAlEp+bRzwmeBxUK0dP3WD+AStEbwldw==',
                permission=BlobSasPermissions(read=True),
                expiry=datetime.now(timezone.utc) + timedelta(days=3650)  # 10 años
            )
            
            sas_url = f"{blob_client.url}?{sas_token}"
            print(f"Archivo descargable subido a Cool tier: {sas_url}")
            return sas_url, None
        
        except AzureError as e:
            error_msg = f"Error de Azure: {str(e)}"
            print(f"Error uploading downloadable to Azure Cool tier: {error_msg}")
            return None, error_msg
        except Exception as e:
            error_msg = f"Error inesperado: {str(e)}"
            print(f"Error uploading downloadable: {error_msg}")
            return None, error_msg
    
    def delete_downloadable(self, blob_url):
        """
        Eliminar archivo descargable de la cuenta Cool tier
        
        Args:
            blob_url: URL completa del blob
        
        Returns:
            bool: True si se eliminó correctamente
        """
        return self.delete_video(blob_url)  # Usa la misma lógica
    
    def delete_file(self, blob_url):
        """
        Eliminar archivo de Azure Blob Storage
        
        Args:
            blob_url: URL completa del blob
        
        Returns:
            bool: True si se eliminó correctamente
        """
        if not self.blob_service_client:
            return False
        
        try:
            # Extraer nombre del blob de la URL
            blob_name = blob_url.split(f'{self.container_name}/')[-1]
            
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_name
            )
            
            blob_client.delete_blob()
            return True
        
        except AzureError as e:
            print(f"Error deleting from Azure: {str(e)}")
            return False
    
    def get_file_url(self, blob_name):
        """Obtener URL de un blob"""
        if not self.blob_service_client:
            return None
        
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_name
            )
            return blob_client.url
        except:
            return None

    def upload_base64_image(self, base64_data, folder='images'):
        """
        Subir imagen desde base64 a Azure Blob Storage
        
        Args:
            base64_data: String base64 de la imagen (puede incluir prefijo data:image/...)
            folder: Carpeta en el contenedor
        
        Returns:
            str: URL del archivo subido o None si falla
        """
        import base64
        
        if not self.blob_service_client:
            print("Azure Blob Storage no configurado")
            return None
        
        try:
            # Extraer el tipo de imagen y los datos del base64
            if ',' in base64_data:
                header, data = base64_data.split(',', 1)
                # Extraer extensión del header (data:image/png;base64 -> png)
                if 'image/' in header:
                    ext = header.split('image/')[1].split(';')[0]
                else:
                    ext = 'png'
            else:
                data = base64_data
                ext = 'png'
            
            # Decodificar base64
            image_bytes = base64.b64decode(data)
            
            # Generar nombre único
            unique_filename = f"{uuid.uuid4().hex}.{ext}"
            blob_name = f"{folder}/{unique_filename}"
            
            # Determinar content type
            content_types = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'webp': 'image/webp'
            }
            content_type = content_types.get(ext.lower(), 'image/png')
            
            # Subir archivo
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_name
            )
            
            blob_client.upload_blob(
                image_bytes,
                overwrite=True,
                content_settings=ContentSettings(content_type=content_type)
            )
            
            print(f"Imagen subida exitosamente: {blob_client.url}")
            return blob_client.url
        
        except Exception as e:
            print(f"Error uploading base64 image to Azure: {str(e)}")
            return None

    def generate_video_upload_sas(self, filename):
        """
        Generar SAS token para upload directo de video desde el browser
        Evita pasar el archivo por el backend (límite de Azure App Service)
        
        Args:
            filename: Nombre original del archivo
        
        Returns:
            dict: {blob_name, upload_url, download_url} o None si falla
        """
        try:
            # Generar nombre único
            ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'mp4'
            blob_name = f"{uuid.uuid4().hex}.{ext}"
            
            # SAS para upload (write) - válido 1 hora
            upload_sas = generate_blob_sas(
                account_name='evaluaasivideos',
                container_name=self.video_container_name,
                blob_name=blob_name,
                account_key='r9C4hrfzCHwUjbFY2reYY3spGvPjTKV0oBPDmB2sDqhkBI4whu1NkmwAlEp+bRzwmeBxUK0dP3WD+AStEbwldw==',
                permission=BlobSasPermissions(write=True, create=True),
                expiry=datetime.now(timezone.utc) + timedelta(hours=1)
            )
            
            # SAS para download (read) - válido 10 años
            download_sas = generate_blob_sas(
                account_name='evaluaasivideos',
                container_name=self.video_container_name,
                blob_name=blob_name,
                account_key='r9C4hrfzCHwUjbFY2reYY3spGvPjTKV0oBPDmB2sDqhkBI4whu1NkmwAlEp+bRzwmeBxUK0dP3WD+AStEbwldw==',
                permission=BlobSasPermissions(read=True),
                expiry=datetime.now(timezone.utc) + timedelta(days=3650)
            )
            
            base_url = f"https://evaluaasivideos.blob.core.windows.net/{self.video_container_name}/{blob_name}"
            
            return {
                'blob_name': blob_name,
                'upload_url': f"{base_url}?{upload_sas}",
                'download_url': f"{base_url}?{download_sas}"
            }
        except Exception as e:
            print(f"Error generating upload SAS: {str(e)}")
            return None

    def upload_image_as_webp(self, file_data, folder='ecm-logos', quality=85):
        """
        Subir imagen convertida a WebP para optimización
        
        Args:
            file_data: FileStorage de Flask, bytes, o base64 string
            folder: Carpeta en el contenedor
            quality: Calidad de compresión WebP (1-100)
        
        Returns:
            str: URL del archivo subido o None si falla
        """
        from PIL import Image
        import io
        import base64
        
        if not self.blob_service_client:
            print("Azure Blob Storage no configurado")
            return None
        
        try:
            # Obtener bytes de la imagen
            if hasattr(file_data, 'read'):
                # Es un FileStorage
                image_bytes = file_data.read()
            elif isinstance(file_data, str) and ('base64' in file_data or ',' in file_data):
                # Es base64
                if ',' in file_data:
                    _, data = file_data.split(',', 1)
                else:
                    data = file_data
                image_bytes = base64.b64decode(data)
            elif isinstance(file_data, bytes):
                image_bytes = file_data
            else:
                print("Formato de imagen no soportado")
                return None
            
            # Abrir imagen con PIL
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convertir a RGB si tiene canal alpha (para WebP con fondo)
            if image.mode in ('RGBA', 'LA', 'P'):
                # Crear fondo blanco para transparencias
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convertir a WebP
            webp_buffer = io.BytesIO()
            image.save(webp_buffer, format='WEBP', quality=quality, optimize=True)
            webp_bytes = webp_buffer.getvalue()
            
            # Generar nombre único
            unique_filename = f"{uuid.uuid4().hex}.webp"
            blob_name = f"{folder}/{unique_filename}"
            
            # Subir archivo
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name,
                blob=blob_name
            )
            
            blob_client.upload_blob(
                webp_bytes,
                overwrite=True,
                content_settings=ContentSettings(content_type='image/webp')
            )
            
            print(f"Imagen WebP subida exitosamente: {blob_client.url}")
            return blob_client.url
        
        except Exception as e:
            print(f"Error uploading WebP image to Azure: {str(e)}")
            return None


# Instancia global
azure_storage = AzureStorageService()
