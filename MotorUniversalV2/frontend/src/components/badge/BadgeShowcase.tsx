import { ReactNode } from 'react'
import { CheckCircle2, Shield, Calendar, Zap, BookOpen, ExternalLink, User, Award } from 'lucide-react'

/**
 * BadgeShowcase — tarjeta de presentación de una insignia digital al estilo
 * Credly (layout limpio de 2 columnas) pero con la identidad verde de Evaluaasi.
 *
 * Componente puramente presentacional: se usa tanto en la página pública de
 * verificación (`VerifyPage`) como en la vista previa en vivo del formulario de
 * plantillas (`BadgeTemplateFormPage`). No depende de routing ni de auth.
 */

export interface BadgeShowcaseProps {
  name: string
  imageUrl?: string | null
  issuerName?: string
  issuerLogoUrl?: string | null
  /** Nombre del titular (en preview puede ser un placeholder). */
  earnerName?: string | null
  /** Fecha de emisión ya formateada (string legible). */
  issuedDate?: string | null
  /** Fecha de caducidad ya formateada; si null y noExpiry=false no se muestra. */
  expiresDate?: string | null
  noExpiry?: boolean
  expired?: boolean
  description?: string | null
  criteriaNarrative?: string | null
  criteriaUrl?: string | null
  /** Aptitudes separadas por coma. */
  skills?: string | null
  ecmCode?: string | null
  /** Muestra el check verde "Verificada" sobre la imagen. */
  verified?: boolean
  /** Variante reducida para el preview del formulario. */
  compact?: boolean
  /** Slot para acciones (compartir, etc.) bajo la imagen. */
  actions?: ReactNode
}

const skillList = (skills?: string | null) =>
  (skills || '').split(',').map(s => s.trim()).filter(Boolean)

export default function BadgeShowcase(props: BadgeShowcaseProps) {
  const {
    name, imageUrl, issuerName = 'Grupo Eduit', issuerLogoUrl,
    earnerName, issuedDate, expiresDate, noExpiry, expired,
    description, criteriaNarrative, criteriaUrl, skills, ecmCode,
    verified, compact, actions,
  } = props

  const skills_ = skillList(skills)
  const imgSize = compact ? 'w-36 h-36' : 'w-48 h-48 lg:w-56 lg:h-56'

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 items-start">
      {/* ── Columna izquierda: imagen + emisor + acciones ── */}
      <div className="md:col-span-2 flex flex-col items-center text-center gap-4">
        <div className="relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name || 'Insignia'}
              className={`${imgSize} object-contain drop-shadow-md`}
            />
          ) : (
            <div className={`${imgSize} rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center`}>
              <Award className="w-1/2 h-1/2 text-emerald-500" />
            </div>
          )}
          {verified && (
            <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Emisor */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {issuerLogoUrl ? (
              <img src={issuerLogoUrl} alt={issuerName} className="w-full h-full object-contain p-0.5" />
            ) : (
              <Shield className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <div className="text-left leading-tight">
            <p className="text-[11px] text-gray-400">Emitida por</p>
            <p className="text-sm font-semibold text-gray-700">{issuerName}</p>
          </div>
        </div>

        {actions && <div className="w-full">{actions}</div>}
      </div>

      {/* ── Columna derecha: metadata ── */}
      <div className="md:col-span-3 min-w-0">
        {ecmCode && (
          <span className="inline-flex items-center px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold tracking-wide mb-2">
            {ecmCode}
          </span>
        )}
        <h2 className={`font-bold text-gray-900 break-words ${compact ? 'text-xl' : 'text-2xl lg:text-3xl'}`}>
          {name || 'Nombre de la insignia'}
        </h2>

        {/* Titular + fecha */}
        {(earnerName || issuedDate) && (
          <div className="flex items-start gap-2 mt-3 text-sm text-gray-600">
            <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p>
              {earnerName ? <>Otorgada a <span className="font-semibold text-gray-800">{earnerName}</span></> : 'Otorgada al titular'}
              {issuedDate && <> · {issuedDate}</>}
            </p>
          </div>
        )}

        {/* Aptitudes */}
        {skills_.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-emerald-600" /> Aptitudes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skills_.map((skill, i) => (
                <span key={i} className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full text-xs font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Descripción */}
        {description && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descripción</p>
            <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
          </div>
        )}

        {/* Criterios de obtención */}
        {criteriaNarrative && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-gray-500" /> Criterios de obtención
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{criteriaNarrative}</p>
            {criteriaUrl && (
              <a
                href={criteriaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Ver criterios completos
              </a>
            )}
          </div>
        )}

        {/* Fechas */}
        {(issuedDate || expiresDate || noExpiry) && (
          <div className="mt-5 grid grid-cols-2 gap-3 max-w-sm">
            {issuedDate && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-[11px] text-gray-500">Emisión</p>
                </div>
                <p className="text-sm font-semibold text-gray-800">{issuedDate}</p>
              </div>
            )}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-[11px] text-gray-500">Caducidad</p>
              </div>
              {noExpiry || !expiresDate ? (
                <p className="text-sm font-semibold text-emerald-700">Sin caducidad</p>
              ) : (
                <p className={`text-sm font-semibold ${expired ? 'text-red-600' : 'text-gray-800'}`}>{expiresDate}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
