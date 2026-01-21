"""
CDN URL Helper
Transforma URLs de Azure Blob Storage a URLs de CDN para mejor rendimiento
"""
import os
import re

# Configuración de CDN endpoints
CDN_CONFIG = {
    # Storage general (imágenes, archivos)
    'evaluaasimotorv2storage.blob.core.windows.net': {
        'cdn_host': 'evaluaasi-assets-g8hwe5cxb6gdgsa9.z02.azurefd.net',
        'enabled': True
    },
    # Storage de videos
    'evaluaasivideos.blob.core.windows.net': {
        'cdn_host': 'evaluaasi-videos-agfqgme5a9cvdndd.z02.azurefd.net',
        'enabled': True
    }
}

# Variable de entorno para habilitar/deshabilitar CDN globalmente
CDN_ENABLED = os.getenv('CDN_ENABLED', 'true').lower() == 'true'


def transform_to_cdn_url(blob_url: str) -> str:
    """
    Transforma una URL de Azure Blob Storage a URL de CDN
    
    Args:
        blob_url: URL original del blob storage
        
    Returns:
        URL transformada con CDN o la original si no aplica
    """
    if not blob_url or not CDN_ENABLED:
        return blob_url
    
    # Buscar si la URL coincide con algún storage configurado
    for storage_host, config in CDN_CONFIG.items():
        if storage_host in blob_url and config['enabled']:
            # Reemplazar el host del storage por el CDN
            cdn_url = blob_url.replace(
                f'https://{storage_host}',
                f'https://{config["cdn_host"]}'
            )
            # También manejar http (aunque debería ser https)
            cdn_url = cdn_url.replace(
                f'http://{storage_host}',
                f'https://{config["cdn_host"]}'
            )
            return cdn_url
    
    return blob_url


def transform_dict_urls(data: dict, url_fields: list = None) -> dict:
    """
    Transforma todas las URLs en un diccionario a URLs de CDN
    
    Args:
        data: Diccionario con datos
        url_fields: Lista de campos que contienen URLs (opcional)
        
    Returns:
        Diccionario con URLs transformadas
    """
    if not data or not CDN_ENABLED:
        return data
    
    # Campos comunes que contienen URLs
    default_url_fields = [
        'image_url', 'video_url', 'file_url', 'thumbnail_url',
        'cover_url', 'avatar_url', 'photo_url'
    ]
    
    fields_to_check = url_fields or default_url_fields
    
    result = data.copy()
    for field in fields_to_check:
        if field in result and result[field]:
            result[field] = transform_to_cdn_url(result[field])
    
    return result


def get_cdn_url_for_video(video_url: str) -> str:
    """
    Obtiene la URL de CDN para un video
    Útil para videos que requieren streaming optimizado
    """
    return transform_to_cdn_url(video_url)


def get_cdn_url_for_image(image_url: str) -> str:
    """
    Obtiene la URL de CDN para una imagen
    """
    return transform_to_cdn_url(image_url)


def is_cdn_url(url: str) -> bool:
    """
    Verifica si una URL ya es de CDN
    """
    if not url:
        return False
    
    for config in CDN_CONFIG.values():
        if config['cdn_host'] in url:
            return True
    
    return False


def get_original_blob_url(cdn_url: str) -> str:
    """
    Transforma una URL de CDN de vuelta a la URL original del blob
    Útil para operaciones de eliminación/modificación
    """
    if not cdn_url:
        return cdn_url
    
    for storage_host, config in CDN_CONFIG.items():
        if config['cdn_host'] in cdn_url:
            return cdn_url.replace(
                f'https://{config["cdn_host"]}',
                f'https://{storage_host}'
            )
    
    return cdn_url
