"""
Servicio de parsing de certificados CONOCER en formato PDF.
Extrae CURP, código ECM, folio, nombre, fecha y entidad certificadora
usando PyMuPDF (fitz) con patrones regex del formato oficial CONOCER.
"""
import re
from typing import Optional, Dict, Any


def parse_conocer_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    Parsear un PDF de certificado CONOCER y extraer datos clave.
    
    El formato oficial CONOCER contiene texto estructurado con:
    - Nombre del certificado después de "Hace constar que"
    - CURP después de "Clave Única de Registro de Población:"
    - Código ECM en "con clave: ECM####"
    - Folio con formato "D-XXXXXXXXXX"
    - Fecha de emisión "a {día} de {mes} de {año}"
    - Entidad certificadora después de "evaluado por"
    
    Args:
        pdf_bytes: Contenido del PDF en bytes
        
    Returns:
        Dict con campos extraídos. Los campos no encontrados son None.
        Siempre incluye 'parse_error' (None si no hubo error).
    """
    result = {
        'curp': None,
        'ecm_code': None,
        'name': None,
        'folio': None,
        'ecm_name': None,
        'issue_date': None,
        'certifying_entity': None,
        'parse_error': None,
    }
    
    try:
        import fitz  # PyMuPDF
    except ImportError:
        result['parse_error'] = 'PyMuPDF (fitz) no está instalado'
        return result
    
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        if doc.page_count == 0:
            result['parse_error'] = 'El PDF no tiene páginas'
            doc.close()
            return result
        
        # Extraer texto de la primera página
        text = doc[0].get_text()
        doc.close()
        
        if not text or len(text.strip()) < 50:
            result['parse_error'] = 'El PDF no contiene texto extraíble'
            return result
        
        # === CURP ===
        # Patrón: 18 caracteres alfanuméricos después de "Registro de Población:"
        curp_match = re.search(
            r'(?:Registro de Poblaci[oó]n|CURP)\s*:?\s*\n?\s*([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)',
            text,
            re.IGNORECASE
        )
        if curp_match:
            result['curp'] = curp_match.group(1).upper()
        else:
            # Fallback: buscar cualquier patrón CURP (18 alfanuméricos)
            curp_fallback = re.search(r'\b([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)\b', text)
            if curp_fallback:
                result['curp'] = curp_fallback.group(1).upper()
        
        # === ECM Code ===
        # Patrón: "con clave: ECM####" o "ECM####" 
        ecm_match = re.search(r'(?:con clave|clave)\s*:?\s*(ECM\d{4})', text, re.IGNORECASE)
        if ecm_match:
            result['ecm_code'] = ecm_match.group(1).upper()
        else:
            # Fallback: buscar ECM seguido de 4 dígitos
            ecm_fallback = re.search(r'\b(ECM\d{4})\b', text)
            if ecm_fallback:
                result['ecm_code'] = ecm_fallback.group(1).upper()
        
        # === Folio CONOCER ===
        # Patrón: "D-" seguido de 10 dígitos
        folio_match = re.search(r'(D-\d{10})', text)
        if folio_match:
            result['folio'] = folio_match.group(1)
        else:
            # Fallback: D- seguido de 7+ dígitos
            folio_fallback = re.search(r'(D-\d{7,})', text)
            if folio_fallback:
                result['folio'] = folio_fallback.group(1)
        
        # === Nombre ===
        # Patrón: texto después de "Hace constar que" (suele estar en la siguiente línea)
        name_match = re.search(
            r'Hace constar que\s*\n\s*(.+?)(?:\n|$)',
            text,
            re.IGNORECASE
        )
        if name_match:
            name = name_match.group(1).strip()
            # Limpiar nombre: quitar caracteres no alfabéticos al inicio/final
            name = re.sub(r'^[^A-ZÁÉÍÓÚÑa-záéíóúñ]+', '', name)
            name = re.sub(r'[^A-ZÁÉÍÓÚÑa-záéíóúñ\s]+$', '', name)
            if len(name) >= 3:
                result['name'] = name.strip()
        
        # === ECM Name (nombre del estándar) ===
        # Patrón: texto después de "competente en" 
        ecm_name_match = re.search(
            r'competente en\s*\n?\s*(.+?)(?:\n|$)',
            text,
            re.IGNORECASE
        )
        if ecm_name_match:
            ecm_name = ecm_name_match.group(1).strip()
            if len(ecm_name) >= 2:
                result['ecm_name'] = ecm_name
        
        # === Fecha de emisión ===
        # Patrón: "a {día} de {mes} de {año}"
        date_match = re.search(
            r'a\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})',
            text,
            re.IGNORECASE
        )
        if date_match:
            day = date_match.group(1)
            month_text = date_match.group(2).lower()
            year = date_match.group(3)
            result['issue_date'] = f"{day} de {month_text} de {year}"
        
        # === Entidad certificadora ===
        # Patrón: texto después de "evaluado por" o "evaluada por"
        entity_match = re.search(
            r'evaluad[oa]\s+por\s*\n?\s*(.+?)(?:\n|$)',
            text,
            re.IGNORECASE
        )
        if entity_match:
            entity = entity_match.group(1).strip()
            if len(entity) >= 3:
                result['certifying_entity'] = entity
        
    except Exception as e:
        result['parse_error'] = f'Error al procesar PDF: {str(e)[:200]}'
    
    return result


def parse_issue_date(date_text: str):
    """
    Parsear texto de fecha en español a objeto date.
    Formato esperado: "2 de enero de 2026"
    
    Returns:
        datetime.date o None si no se puede parsear
    """
    if not date_text:
        return None
    
    months = {
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
        'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
        'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    }
    
    match = re.search(r'(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})', date_text, re.IGNORECASE)
    if not match:
        return None
    
    try:
        from datetime import date
        day = int(match.group(1))
        month_name = match.group(2).lower()
        year = int(match.group(3))
        
        month = months.get(month_name)
        if not month:
            return None
        
        return date(year, month, day)
    except (ValueError, KeyError):
        return None
