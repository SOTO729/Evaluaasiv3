"""
Utilidades para Azure Storage
"""
from azure.storage.blob import BlobServiceClient, ContentSettings
from azure.core.exceptions import AzureError
import os
import uuid
from werkzeug.utils import secure_filename


class AzureStorageService:
    """Servicio para subir archivos a Azure Blob Storage"""
    
    def __init__(self):
        self.connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        self.container_name = os.getenv('AZURE_STORAGE_CONTAINER', 'evaluaasi-files')
        
        if self.connection_string:
            try:
                self.blob_service_client = BlobServiceClient.from_connection_string(self.connection_string)
                self._ensure_container_exists()
            except AzureError:
                self.blob_service_client = None
        else:
            self.blob_service_client = None
    
    def _ensure_container_exists(self):
        """Crear contenedor si no existe"""
        try:
            container_client = self.blob_service_client.get_container_client(self.container_name)
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


# Instancia global
azure_storage = AzureStorageService()
