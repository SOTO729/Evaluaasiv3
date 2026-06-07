"""
Servicio para construir un paquete SCORM 1.2 a partir de un StudyMaterial.

El ZIP resultante respeta la estructura jerárquica del material:

    Material (manifest)
      └─ Session (organization > item container)
           └─ Topic (organization > item, scormtype="sco")

Cada topic se renderiza como un único SCO HTML que muestra:
    - Lectura (markdown renderizado en cliente con marked.js)
    - Video (player HTML5 o iframe según video_type)
    - Ejercicio descargable (link al file_url original)
    - Ejercicio interactivo (render estático de pasos y acciones)
    - SCORM anidado (iframe al launch_url del paquete original)

Salida: BytesIO con el ZIP listo para descargar.
"""
from __future__ import annotations

import html
import io
import json
import re
import zipfile
from datetime import datetime, timezone
from typing import Iterable

from app.models.study_content import (
    StudyMaterial,
    StudySession,
    StudyTopic,
)


# ── Helpers de slug/escape ──────────────────────────────────────────────

_SLUG_RE = re.compile(r'[^a-zA-Z0-9_-]+')


def _slug(text: str, fallback: str = 'item', maxlen: int = 60) -> str:
    if not text:
        return fallback
    s = _SLUG_RE.sub('-', text.strip().lower()).strip('-')
    if not s:
        s = fallback
    return s[:maxlen]


def _esc(value) -> str:
    return html.escape(str(value) if value is not None else '', quote=True)


# ── Plantillas base ─────────────────────────────────────────────────────

_SHARED_CSS = """\
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #f8fafc;
  color: #0f172a;
  line-height: 1.6;
}
.container { max-width: 960px; margin: 0 auto; padding: 24px; }
.topic-header { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.topic-header h1 { margin: 0 0 8px; font-size: 26px; color: #0f172a; }
.topic-header p { margin: 0; color: #475569; }
.section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
.section h2 { margin: 0 0 16px; font-size: 18px; color: #0f172a; display: flex; align-items: center; gap: 10px; }
.section .pill { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; background: #e0f2fe; color: #075985; padding: 3px 9px; border-radius: 9999px; font-weight: 600; }
.reading-body { font-size: 15px; }
.reading-body img { max-width: 100%; height: auto; border-radius: 8px; }
.reading-body pre { background: #0f172a; color: #f1f5f9; padding: 14px; border-radius: 8px; overflow-x: auto; }
.reading-body code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: .9em; }
.reading-body pre code { background: transparent; padding: 0; }
.video-wrap { position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; background: #000; }
.video-wrap iframe, .video-wrap video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
.transcript { margin-top: 16px; background: #f8fafc; border-left: 4px solid #38bdf8; padding: 12px 16px; border-radius: 6px; font-size: 14px; color: #334155; white-space: pre-wrap; }
.download-card { display: flex; gap: 16px; align-items: center; padding: 16px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; }
.download-card a { background: #0284c7; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; white-space: nowrap; }
.steps-list { list-style: none; padding: 0; margin: 0; counter-reset: step; }
.step-item { counter-increment: step; padding: 14px 14px 14px 56px; background: #f8fafc; border-left: 4px solid #6366f1; margin-bottom: 12px; border-radius: 6px; position: relative; }
.step-item::before { content: counter(step); position: absolute; left: 14px; top: 14px; background: #6366f1; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.step-item h3 { margin: 0 0 6px; font-size: 15px; color: #1e293b; }
.step-item p { margin: 0; font-size: 14px; color: #475569; }
.step-image { margin-top: 10px; max-width: 100%; border-radius: 6px; }
.actions-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
.actions-table th, .actions-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
.actions-table th { background: #f1f5f9; color: #475569; }
.scorm-embed { width: 100%; height: 600px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
.empty { color: #94a3b8; font-style: italic; padding: 20px; text-align: center; }
.footer-nav { display: flex; justify-content: space-between; margin-top: 28px; padding: 18px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; }
.footer-nav a { color: #0284c7; text-decoration: none; font-weight: 600; padding: 8px 16px; border-radius: 6px; }
.footer-nav a:hover { background: #f0f9ff; }
.crumbs { font-size: 13px; color: #64748b; margin-bottom: 12px; }
"""


# ── SCORM 1.2 API wrapper minimalista (pipwerks-style) ──────────────────
# Cada SCO llama a init al cargar y commit+terminate al descargar.
_SCORM_API_JS = r"""
// SCORM 1.2 wrapper minimal — busca window.API en el frame padre.
(function () {
  function findAPI(win) {
    var n = 0;
    while (win && !win.API && win.parent && win.parent !== win && n++ < 10) {
      win = win.parent;
    }
    return win ? win.API : null;
  }
  var api = null;
  try {
    api = findAPI(window) || (window.opener ? findAPI(window.opener) : null);
  } catch (e) { api = null; }

  function call(fn) {
    if (!api || typeof api[fn] !== 'function') return '';
    try { return api[fn].apply(api, [].slice.call(arguments, 1)); }
    catch (e) { return ''; }
  }

  window.SCORM = {
    init: function () { return call('LMSInitialize', '') === 'true'; },
    set:  function (k, v) { return call('LMSSetValue', k, v) === 'true'; },
    get:  function (k) { return call('LMSGetValue', k); },
    commit: function () { return call('LMSCommit', '') === 'true'; },
    finish: function () { return call('LMSFinish', '') === 'true'; }
  };

  function start() {
    if (!window.SCORM.init()) return;
    window.SCORM.set('cmi.core.lesson_status', 'completed');
    window.SCORM.set('cmi.core.score.raw', '100');
    window.SCORM.commit();
  }
  function end() {
    try { window.SCORM.set('cmi.core.exit', ''); window.SCORM.commit(); window.SCORM.finish(); } catch(e){}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
  window.addEventListener('beforeunload', end);
})();
"""


# ── Renderers ───────────────────────────────────────────────────────────

def _render_reading_section(reading) -> str:
    if not reading:
        return ''
    title = _esc(reading.title or 'Lectura')
    raw = reading.content or ''
    # El cliente renderiza markdown con marked.js (CDN). Lo embebemos como
    # texto plano dentro de un <script type="text/markdown"> para que no se
    # interprete como HTML hasta que marked() lo convierta.
    md_payload = json.dumps(raw)
    return (
        f'<div class="section"><h2><span class="pill">Lectura</span>{title}</h2>'
        f'<div class="reading-body" id="reading-body"></div>'
        f'<script>window.__READING_MD__={md_payload};</script>'
        '</div>'
    )


# Parámetros del reproductor de Vimeo para mostrar SOLO el video, sin título,
# autor, avatar ni botones de acción (compartir, me gusta, ver más tarde) que
# enlazan a vimeo.com. Misma intención que utils/videoEmbed.ts en el frontend.
_VIMEO_CLEAN_PARAMS = 'title=0&byline=0&portrait=0'


def _vimeo_clean_embed(url: str) -> str | None:
    """URL de embed "limpio" de Vimeo (solo el video), o None si no es Vimeo.

    Conserva el hash de privacidad de videos no listados (``?h=`` o ``/<hash>``).
    """
    # Ya es una URL del reproductor: conservarla (incluido ?h=) y añadir params.
    if 'player.vimeo.com/video/' in url:
        sep = '&' if '?' in url else '?'
        return f'{url}{sep}{_VIMEO_CLEAN_PARAMS}'
    # vimeo.com/<id>[/<hash>], vimeo.com/channels/.../<id>, ?h=<hash>, etc.
    m = re.search(
        r'vimeo\.com/(?:channels/[^/]+/|groups/[^/]+/videos/)?(\d+)(?:/([0-9a-zA-Z]+))?',
        url,
    )
    if not m:
        return None
    vid = m.group(1)
    vhash = m.group(2)
    if not vhash:
        hm = re.search(r'[?&]h=([0-9a-zA-Z]+)', url)
        if hm:
            vhash = hm.group(1)
    if vhash:
        return f'https://player.vimeo.com/video/{vid}?h={vhash}&{_VIMEO_CLEAN_PARAMS}'
    return f'https://player.vimeo.com/video/{vid}?{_VIMEO_CLEAN_PARAMS}'


def _render_video_section(video) -> str:
    if not video:
        return ''
    title = _esc(video.title or 'Video')
    url = video.video_url or ''
    vtype = (video.video_type or '').lower()
    transcript = video.description if hasattr(video, 'description') else None
    # Heurística: si la URL contiene youtube/vimeo o el tipo es 'embed', usar iframe.
    is_embed = (
        'youtube.com' in url
        or 'youtu.be' in url
        or 'vimeo.com' in url
        or vtype in ('embed', 'youtube', 'vimeo')
    )
    if is_embed:
        # Normalizar youtube watch?v= a /embed/
        embed_url = url
        m = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{6,})', url)
        if m:
            embed_url = f'https://www.youtube.com/embed/{m.group(1)}'
        else:
            vimeo_embed = _vimeo_clean_embed(url)
            if vimeo_embed:
                embed_url = vimeo_embed
        player = (
            f'<iframe src="{_esc(embed_url)}" allowfullscreen '
            f'allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"></iframe>'
        )
    else:
        player = (
            f'<video controls preload="metadata"><source src="{_esc(url)}">'
            'Tu navegador no soporta video HTML5.</video>'
        )
    trans_html = (
        f'<div class="transcript"><strong>Descripción / Transcripción:</strong><br>{_esc(transcript)}</div>'
        if transcript else ''
    )
    return (
        f'<div class="section"><h2><span class="pill">Video</span>{title}</h2>'
        f'<div class="video-wrap">{player}</div>{trans_html}</div>'
    )


def _render_downloadable_section(dl) -> str:
    if not dl:
        return ''
    title = _esc(dl.title or 'Material descargable')
    fname = _esc(dl.file_name or 'archivo')
    return (
        f'<div class="section"><h2><span class="pill">Descargable</span>{title}</h2>'
        f'<div class="download-card"><div style="flex:1"><strong>{fname}</strong>'
        f'<div style="font-size:13px;color:#64748b">{_esc(dl.file_type or "")}</div></div>'
        f'<a href="{_esc(dl.file_url)}" target="_blank" rel="noopener">Descargar</a></div></div>'
    )


def _render_interactive_section(ex) -> str:
    if not ex:
        return ''
    title = _esc(ex.title or 'Ejercicio interactivo')
    desc = _esc(ex.description or '')
    steps = ex.steps.all() if hasattr(ex, 'steps') and ex.steps else []
    if not steps:
        body = '<div class="empty">Este ejercicio no tiene pasos registrados.</div>'
    else:
        items = []
        for st in steps:
            actions = st.actions.all() if hasattr(st, 'actions') and st.actions else []
            actions_html = ''
            if actions:
                rows = ''.join(
                    f'<tr><td>{_esc(a.action_number)}</td><td>{_esc(a.action_type)}</td>'
                    f'<td>{_esc(a.label or "")}</td><td>{_esc(a.correct_answer or "")}</td></tr>'
                    for a in actions
                )
                actions_html = (
                    '<table class="actions-table"><thead><tr>'
                    '<th>#</th><th>Tipo</th><th>Etiqueta</th><th>Respuesta</th>'
                    f'</tr></thead><tbody>{rows}</tbody></table>'
                )
            img_html = (
                f'<img class="step-image" src="{_esc(st.image_url)}" alt="">'
                if getattr(st, 'image_url', None) else ''
            )
            items.append(
                '<li class="step-item">'
                f'<h3>{_esc(st.title or f"Paso {st.step_number}")}</h3>'
                f'<p>{_esc(st.description or "")}</p>'
                f'{img_html}{actions_html}</li>'
            )
        body = '<ol class="steps-list">' + ''.join(items) + '</ol>'
    desc_html = f'<p style="color:#475569">{desc}</p>' if desc else ''
    return (
        f'<div class="section"><h2><span class="pill">Interactivo</span>{title}</h2>'
        f'{desc_html}{body}</div>'
    )


def _render_scorm_embed_section(pkg) -> str:
    if not pkg:
        return ''
    title = _esc(pkg.title or 'Paquete SCORM')
    return (
        f'<div class="section"><h2><span class="pill">SCORM embebido</span>{title}</h2>'
        f'<iframe class="scorm-embed" src="{_esc(pkg.launch_url)}" '
        'sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>'
        '<p style="font-size:12px;color:#94a3b8;margin-top:8px">Este SCO embebe un paquete SCORM externo.</p></div>'
    )


def _render_topic_html(
    material: StudyMaterial,
    session: StudySession,
    topic: StudyTopic,
    prev_href: str | None,
    next_href: str | None,
) -> str:
    sections: list[str] = []
    try:
        sections.append(_render_reading_section(topic.reading))
    except Exception:
        pass
    try:
        sections.append(_render_video_section(topic.video))
    except Exception:
        pass
    try:
        sections.append(_render_downloadable_section(topic.downloadable_exercise))
    except Exception:
        pass
    try:
        sections.append(_render_interactive_section(topic.interactive_exercise))
    except Exception:
        pass
    try:
        sections.append(_render_scorm_embed_section(topic.scorm_package))
    except Exception:
        pass
    sections = [s for s in sections if s]
    if not sections:
        sections = ['<div class="section"><div class="empty">Este tema no tiene contenido publicado.</div></div>']

    nav_parts = []
    if prev_href:
        nav_parts.append(f'<a href="{_esc(prev_href)}">← Anterior</a>')
    else:
        nav_parts.append('<span></span>')
    if next_href:
        nav_parts.append(f'<a href="{_esc(next_href)}">Siguiente →</a>')
    else:
        nav_parts.append('<span></span>')
    nav = f'<div class="footer-nav">{nav_parts[0]}{nav_parts[1]}</div>'

    crumbs = (
        f'<div class="crumbs">{_esc(material.title)} › '
        f'Sesión {_esc(session.session_number)}: {_esc(session.title)}</div>'
    )

    title_full = _esc(topic.title or 'Tema')
    desc = _esc(topic.description or '')
    desc_html = f'<p>{desc}</p>' if desc else ''
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title_full}</title>
<link rel="stylesheet" href="../../shared/styles.css">
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js" defer></script>
<script src="../../shared/scorm_api.js" defer></script>
</head>
<body>
<div class="container">
  {crumbs}
  <div class="topic-header"><h1>{title_full}</h1>{desc_html}</div>
  {''.join(sections)}
  {nav}
</div>
<script>
  document.addEventListener('DOMContentLoaded', function () {{
    if (window.__READING_MD__ && window.marked) {{
      try {{
        var el = document.getElementById('reading-body');
        if (el) el.innerHTML = window.marked.parse(window.__READING_MD__);
      }} catch (e) {{
        var el = document.getElementById('reading-body');
        if (el) el.textContent = window.__READING_MD__;
      }}
    }} else if (window.__READING_MD__) {{
      var el = document.getElementById('reading-body');
      if (el) el.textContent = window.__READING_MD__;
    }}
  }});
</script>
</body>
</html>
"""


# ── Index / TOC ─────────────────────────────────────────────────────────

def _render_index_html(material: StudyMaterial, sessions_payload: list[dict]) -> str:
    sess_html_parts: list[str] = []
    for sp in sessions_payload:
        topic_links = ''.join(
            f'<li><a href="{_esc(tp["href"])}">{_esc(tp["title"])}</a></li>'
            for tp in sp['topics']
        ) or '<li class="empty">Sin temas</li>'
        sess_html_parts.append(
            f'<div class="section"><h2>Sesión {_esc(sp["number"])}: {_esc(sp["title"])}</h2>'
            f'<ul>{topic_links}</ul></div>'
        )
    desc = _esc(material.description or '')
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{_esc(material.title)}</title>
<link rel="stylesheet" href="shared/styles.css">
</head>
<body>
<div class="container">
  <div class="topic-header">
    <h1>{_esc(material.title)}</h1>
    {f'<p>{desc}</p>' if desc else ''}
  </div>
  {''.join(sess_html_parts)}
</div>
</body>
</html>
"""


# ── Manifest ────────────────────────────────────────────────────────────

def _build_manifest(material: StudyMaterial, sessions_payload: list[dict]) -> str:
    org_items: list[str] = []
    resources: list[str] = []

    for sp in sessions_payload:
        topic_items = []
        for tp in sp['topics']:
            res_id = tp['res_id']
            item_id = tp['item_id']
            href = tp['href']
            topic_items.append(
                f'<item identifier="{_esc(item_id)}" identifierref="{_esc(res_id)}" isvisible="true">'
                f'<title>{_esc(tp["title"])}</title></item>'
            )
            resources.append(
                f'<resource identifier="{_esc(res_id)}" type="webcontent" '
                f'adlcp:scormtype="sco" href="{_esc(href)}">'
                f'<file href="{_esc(href)}"/>'
                '<file href="shared/scorm_api.js"/>'
                '<file href="shared/styles.css"/>'
                '</resource>'
            )
        org_items.append(
            f'<item identifier="{_esc(sp["item_id"])}" isvisible="true">'
            f'<title>Sesión {_esc(sp["number"])}: {_esc(sp["title"])}</title>'
            f'{"".join(topic_items)}'
            '</item>'
        )

    org_id = f'ORG-{material.id}'
    manifest_id = f'EVAL-MAT-{material.id}'
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{_esc(manifest_id)}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="{_esc(org_id)}">
    <organization identifier="{_esc(org_id)}">
      <title>{_esc(material.title)}</title>
      {"".join(org_items)}
    </organization>
  </organizations>
  <resources>
    {"".join(resources)}
  </resources>
</manifest>
"""


# ── Función pública ─────────────────────────────────────────────────────

def build_scorm_zip(material: StudyMaterial) -> tuple[io.BytesIO, int]:
    """Construye el ZIP SCORM 1.2 del material en memoria.

    Returns (BytesIO posicionado en 0, file_count).
    """
    sessions: Iterable[StudySession] = material.sessions.all()

    # Precalcular payload de jerarquía con hrefs únicos.
    sessions_payload: list[dict] = []
    used_slugs: set[str] = set()

    def _unique_dir(base: str) -> str:
        candidate = base
        i = 2
        while candidate in used_slugs:
            candidate = f"{base}-{i}"
            i += 1
        used_slugs.add(candidate)
        return candidate

    for sess in sessions:
        sess_dir = _unique_dir(f"sesion_{sess.session_number}_{_slug(sess.title)}")
        topics_payload: list[dict] = []
        topic_used: set[str] = set()
        topics = sess.topics.all()
        for topic in topics:
            t_base = f"tema_{topic.order}_{_slug(topic.title)}"
            candidate = t_base
            i = 2
            while candidate in topic_used:
                candidate = f"{t_base}-{i}"
                i += 1
            topic_used.add(candidate)
            topic_filename = f"{candidate}.html"
            topics_payload.append({
                'topic': topic,
                'title': topic.title or f'Tema {topic.order}',
                'item_id': f'ITEM-T-{topic.id}',
                'res_id': f'RES-T-{topic.id}',
                'href': f'{sess_dir}/{topic_filename}',
                'filename': topic_filename,
            })
        sessions_payload.append({
            'session': sess,
            'number': sess.session_number,
            'title': sess.title or f'Sesión {sess.session_number}',
            'item_id': f'ITEM-S-{sess.id}',
            'dir': sess_dir,
            'topics': topics_payload,
        })

    # Construcción del ZIP.
    buf = io.BytesIO()
    file_count = 0
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Recursos compartidos.
        zf.writestr('shared/styles.css', _SHARED_CSS)
        file_count += 1
        zf.writestr('shared/scorm_api.js', _SCORM_API_JS)
        file_count += 1

        # Manifest.
        zf.writestr('imsmanifest.xml', _build_manifest(material, sessions_payload))
        file_count += 1

        # Index (TOC navegable, no es SCO).
        zf.writestr('index.html', _render_index_html(material, sessions_payload))
        file_count += 1

        # Flat list de topics para construir prev/next.
        flat: list[tuple[dict, dict]] = []
        for sp in sessions_payload:
            for tp in sp['topics']:
                flat.append((sp, tp))

        for idx, (sp, tp) in enumerate(flat):
            prev_href = (
                f"../../{flat[idx - 1][0]['dir']}/{flat[idx - 1][1]['filename']}"
                if idx > 0 else None
            )
            next_href = (
                f"../../{flat[idx + 1][0]['dir']}/{flat[idx + 1][1]['filename']}"
                if idx < len(flat) - 1 else None
            )
            html_out = _render_topic_html(
                material, sp['session'], tp['topic'],
                prev_href=prev_href, next_href=next_href,
            )
            zf.writestr(f"{sp['dir']}/{tp['filename']}", html_out)
            file_count += 1

        # README minimal.
        zf.writestr(
            'README.txt',
            f"Paquete SCORM 1.2 generado por Evaluaasi\n"
            f"Material: {material.title}\n"
            f"Generado: {datetime.now(timezone.utc).isoformat()}\n"
            f"Total sesiones: {len(sessions_payload)}\n"
            f"Total temas:    {sum(len(s['topics']) for s in sessions_payload)}\n",
        )
        file_count += 1

    buf.seek(0)
    return buf, file_count


def suggested_filename(material: StudyMaterial) -> str:
    base = _slug(material.title, fallback='material', maxlen=80)
    ts = datetime.now(timezone.utc).strftime('%Y%m%d')
    return f"scorm-{base}-{ts}.zip"
