"""
Utilidades para Azure Queue Storage

Maneja el encolado de tareas para procesamiento asíncrono.
"""
import os
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def get_queue_client():
    """
    Obtiene el cliente de Azure Queue Storage
    """
    try:
        from azure.storage.queue import QueueClient
        
        connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
        if not connection_string:
            logger.warning("AZURE_STORAGE_CONNECTION_STRING not configured")
            return None
        
        queue_name = os.environ.get('PDF_QUEUE_NAME', 'pdf-generation-queue')
        
        queue_client = QueueClient.from_connection_string(
            connection_string,
            queue_name
        )
        
        # Crear la cola si no existe
        try:
            queue_client.create_queue()
        except Exception:
            pass  # Ya existe
        
        return queue_client
        
    except ImportError:
        logger.warning("azure-storage-queue not installed. Async PDF generation disabled.")
        return None
    except Exception as e:
        logger.error(f"Error connecting to Azure Queue: {str(e)}")
        return None


def queue_pdf_generation(result_id: str, user_id: str, pdf_type: str = 'evaluation_report', callback_url: str = None) -> bool:
    """
    Encola una solicitud de generación de PDF
    
    Args:
        result_id: ID del resultado de examen
        user_id: ID del usuario
        pdf_type: 'evaluation_report' o 'certificate'
        callback_url: URL opcional para notificar cuando esté listo
    
    Returns:
        True si se encoló correctamente, False si no
    """
    queue_client = get_queue_client()
    
    if not queue_client:
        logger.warning("Queue not available, falling back to sync generation")
        return False
    
    try:
        message = {
            "result_id": result_id,
            "user_id": user_id,
            "type": pdf_type,
            "callback_url": callback_url,
            "queued_at": datetime.utcnow().isoformat()
        }
        
        # Encolar mensaje (se codifica automáticamente a base64)
        import base64
        message_json = json.dumps(message)
        encoded_message = base64.b64encode(message_json.encode()).decode()
        
        queue_client.send_message(encoded_message, time_to_live=86400)  # 24 horas TTL
        
        logger.info(f"PDF generation queued: result_id={result_id}, type={pdf_type}")
        return True
        
    except Exception as e:
        logger.error(f"Error queuing PDF generation: {str(e)}")
        return False


def is_async_pdf_enabled() -> bool:
    """
    Verifica si la generación asíncrona de PDF está habilitada
    """
    # Habilitar solo si está configurada la conexión de Azure Storage
    connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
    enable_async = os.environ.get('ENABLE_ASYNC_PDF', 'false').lower() == 'true'
    
    return bool(connection_string) and enable_async
