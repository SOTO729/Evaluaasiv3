"""
Catálogo de productos / add-ons para el Modelo Directo (B2C).

El precio que paga el candidato ya NO se define por examen (el editor solo
indica si el examen está publicado en el catálogo). En su lugar, el candidato
arma su compra eligiendo qué productos quiere:

    - examen           — Aplicación del examen + simulador + material de estudio (BASE, obligatorio)
    - cert_eduit       — Certificado digital EduIT en PDF
    - cert_conocer     — Certificado oficial CONOCER
    - badge            — Insignia digital verificable (Open Badges 3.0)

Cada producto se cobra "por examen" del bundle. Ej.: 2 exámenes + EduIT =
2 × (precio_examen + precio_cert_eduit).

Los precios son provisionales (definidos aquí); migrar a una tabla admin más
adelante si se requiere edición sin redeploy.
"""
from decimal import Decimal
from typing import Iterable


# Orden canónico de exhibición + definición
ADDONS = [
    {
        'key': 'examen',
        'label': 'Examen y simulador',
        'description': 'Aplicación del examen, simulador y material de estudio (lecturas, videos y ejercicios) sin costo adicional.',
        'price': 499.00,
        'required': True,
        'icon': 'GraduationCap',
    },
    {
        'key': 'cert_eduit',
        'label': 'Certificado EduIT',
        'description': 'Certificado digital EduIT en PDF de alta calidad, con folio verificable.',
        'price': 349.00,
        'required': False,
        'icon': 'Award',
    },
    {
        'key': 'cert_conocer',
        'label': 'Certificado CONOCER',
        'description': 'Certificado oficial CONOCER del estándar de competencia.',
        'price': 1299.00,
        'required': False,
        'icon': 'BadgeCheck',
    },
    {
        'key': 'badge',
        'label': 'Insignia digital (Open Badge)',
        'description': 'Insignia verificable Open Badges 3.0 para compartir en LinkedIn y redes profesionales.',
        'price': 149.00,
        'required': False,
        'icon': 'Medal',
    },
]

ADDONS_BY_KEY = {a['key']: a for a in ADDONS}
REQUIRED_KEYS = {a['key'] for a in ADDONS if a['required']}
VALID_KEYS = set(ADDONS_BY_KEY.keys())


def normalize_addons(selected: Iterable[str] | None) -> list[str]:
    """Devuelve la lista de addons válidos + los obligatorios, en orden canónico."""
    s = set(selected or []) | REQUIRED_KEYS
    s = s & VALID_KEYS
    return [a['key'] for a in ADDONS if a['key'] in s]


def calculate_bundle(num_exams: int, selected_addons: Iterable[str] | None
                     ) -> tuple[Decimal, list[dict]]:
    """Calcula el total y la lista de líneas (para MP `items`) del bundle.

    Args:
        num_exams: cantidad de exámenes en el carrito.
        selected_addons: addons elegidos por el usuario (se agregan los
            obligatorios automáticamente).

    Returns:
        (total_decimal, line_items)
        line_items: lista de {key, label, unit_price (float), quantity, subtotal}
    """
    if num_exams <= 0:
        return Decimal('0'), []
    keys = normalize_addons(selected_addons)
    total = Decimal('0')
    line_items: list[dict] = []
    for key in keys:
        meta = ADDONS_BY_KEY[key]
        unit_price = Decimal(str(meta['price']))
        if unit_price <= 0:
            # Producto incluido sin costo (e.g. material de estudio):
            # no se agrega como línea de cobro (MP rechaza items con precio 0).
            continue
        subtotal = unit_price * num_exams
        total += subtotal
        line_items.append({
            'key': key,
            'label': meta['label'],
            'description': meta['description'],
            'unit_price': float(unit_price),
            'quantity': num_exams,
            'subtotal': float(subtotal),
        })
    return total, line_items
