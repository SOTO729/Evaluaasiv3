"""
Utilidad para comprimir archivos en formato ZIP
"""
import zipfile
import tempfile
import os
import shutil
from werkzeug.utils import secure_filename


class FileCompressor:
    """Servicio para comprimir múltiples archivos en ZIP"""
    
    def __init__(self):
        pass
    
    def compress_files_to_zip(self, files, zip_filename='archivos.zip'):
        """
        Comprimir múltiples archivos en un ZIP
        
        Args:
            files: Lista de FileStorage de Flask
            zip_filename: Nombre para el archivo ZIP
        
        Returns:
            tuple: (zip_path, total_original_size, zip_size) o (None, 0, 0) si falla
        """
        if not files:
            return None, 0, 0
        
        try:
            temp_dir = tempfile.mkdtemp()
            zip_path = os.path.join(temp_dir, secure_filename(zip_filename))
            total_original_size = 0
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file in files:
                    if file and file.filename:
                        # Leer contenido del archivo
                        file_content = file.read()
                        total_original_size += len(file_content)
                        
                        # Agregar al ZIP con nombre seguro
                        safe_name = secure_filename(file.filename)
                        zipf.writestr(safe_name, file_content)
                        
                        # Reset del archivo por si se necesita de nuevo
                        file.seek(0)
            
            zip_size = os.path.getsize(zip_path)
            
            return zip_path, total_original_size, zip_size
            
        except Exception as e:
            print(f"Error comprimiendo archivos: {str(e)}")
            return None, 0, 0
    
    def compress_single_file(self, file, zip_filename=None):
        """
        Comprimir un solo archivo en ZIP (opcional, solo si se quiere forzar ZIP)
        
        Args:
            file: FileStorage de Flask
            zip_filename: Nombre para el archivo ZIP (opcional)
        
        Returns:
            tuple: (zip_path, original_size, zip_size) o (None, 0, 0) si falla
        """
        if not file or not file.filename:
            return None, 0, 0
        
        zip_name = zip_filename or f"{os.path.splitext(secure_filename(file.filename))[0]}.zip"
        return self.compress_files_to_zip([file], zip_name)
    
    def get_file_info(self, file):
        """
        Obtener información de un archivo
        
        Args:
            file: FileStorage de Flask
        
        Returns:
            dict: Información del archivo
        """
        if not file or not file.filename:
            return None
        
        # Obtener tamaño
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        
        # Mapeo de tipos MIME comunes
        mime_types = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            'txt': 'text/plain',
            'csv': 'text/csv',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
        }
        
        return {
            'filename': filename,
            'extension': ext,
            'size_bytes': size,
            'size_mb': round(size / (1024 * 1024), 2),
            'content_type': file.content_type or mime_types.get(ext, 'application/octet-stream')
        }
    
    def cleanup_temp_file(self, file_path):
        """Limpiar archivo temporal y su directorio"""
        if file_path and os.path.exists(file_path):
            try:
                temp_dir = os.path.dirname(file_path)
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass


# Instancia global
file_compressor = FileCompressor()
