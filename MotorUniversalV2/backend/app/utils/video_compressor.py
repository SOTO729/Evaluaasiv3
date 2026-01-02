"""
Utilidad para comprimir videos usando FFmpeg
Reduce tamaño de archivos ~60% manteniendo buena calidad
"""
import subprocess
import os
import tempfile
import shutil
from werkzeug.datastructures import FileStorage


class VideoCompressor:
    """Servicio para comprimir videos antes de subirlos a Azure"""
    
    # Configuración de compresión optimizada para educación
    DEFAULT_CONFIG = {
        'video_codec': 'libx264',
        'audio_codec': 'aac',
        'crf': 28,  # Calidad (18-28, menor = mejor calidad pero más tamaño)
        'preset': 'medium',  # faster, fast, medium, slow (más lento = mejor compresión)
        'audio_bitrate': '128k',
        'max_width': 1280,  # Máximo 720p para videos educativos
        'max_height': 720,
    }
    
    def __init__(self):
        self.ffmpeg_available = self._check_ffmpeg()
    
    def _check_ffmpeg(self):
        """Verificar si FFmpeg está instalado"""
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
    
    def compress_video(self, input_file, config=None):
        """
        Comprimir video usando FFmpeg
        
        Args:
            input_file: FileStorage de Flask o path al archivo
            config: Diccionario con configuración de compresión
        
        Returns:
            tuple: (compressed_file_path, original_size, compressed_size) o (None, 0, 0) si falla
        """
        if not self.ffmpeg_available:
            print("FFmpeg no disponible, retornando archivo original")
            return None, 0, 0
        
        config = config or self.DEFAULT_CONFIG
        
        try:
            # Crear archivos temporales
            temp_dir = tempfile.mkdtemp()
            
            # Guardar archivo de entrada
            if isinstance(input_file, FileStorage):
                input_path = os.path.join(temp_dir, 'input_video')
                input_file.save(input_path)
                input_file.seek(0)  # Reset para uso posterior si es necesario
            else:
                input_path = input_file
            
            original_size = os.path.getsize(input_path)
            
            # Determinar extensión de salida
            output_path = os.path.join(temp_dir, 'compressed.mp4')
            
            # Construir comando FFmpeg
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-c:v', config['video_codec'],
                '-crf', str(config['crf']),
                '-preset', config['preset'],
                '-c:a', config['audio_codec'],
                '-b:a', config['audio_bitrate'],
                # Escalar si es más grande que el máximo, mantener aspect ratio
                '-vf', f"scale=min({config['max_width']}\\,iw):min({config['max_height']}\\,ih):force_original_aspect_ratio=decrease",
                '-movflags', '+faststart',  # Optimizar para streaming
                '-y',  # Sobreescribir
                output_path
            ]
            
            # Ejecutar compresión
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 minutos máximo
            )
            
            if result.returncode != 0:
                print(f"Error FFmpeg: {result.stderr}")
                # Limpiar
                shutil.rmtree(temp_dir, ignore_errors=True)
                return None, original_size, 0
            
            compressed_size = os.path.getsize(output_path)
            
            # Solo usar comprimido si es significativamente menor
            if compressed_size < original_size * 0.9:  # Al menos 10% de reducción
                return output_path, original_size, compressed_size
            else:
                print(f"Compresión no significativa: {original_size} -> {compressed_size}")
                shutil.rmtree(temp_dir, ignore_errors=True)
                return None, original_size, compressed_size
                
        except subprocess.TimeoutExpired:
            print("Timeout durante compresión de video")
            return None, 0, 0
        except Exception as e:
            print(f"Error comprimiendo video: {str(e)}")
            return None, 0, 0
    
    def get_video_info(self, file_path):
        """Obtener información del video usando FFprobe"""
        if not self.ffmpeg_available:
            return None
        
        try:
            cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                file_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                import json
                return json.loads(result.stdout)
            return None
        except Exception:
            return None
    
    def get_video_dimensions(self, file_path):
        """Obtener ancho y alto del video"""
        info = self.get_video_info(file_path)
        if not info:
            return None, None
        
        try:
            # Buscar el stream de video
            for stream in info.get('streams', []):
                if stream.get('codec_type') == 'video':
                    width = stream.get('width')
                    height = stream.get('height')
                    if width and height:
                        return int(width), int(height)
            return None, None
        except Exception:
            return None, None
    
    def cleanup_temp_file(self, file_path):
        """Limpiar archivo temporal y su directorio"""
        if file_path and os.path.exists(file_path):
            try:
                temp_dir = os.path.dirname(file_path)
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass


# Instancia global
video_compressor = VideoCompressor()
