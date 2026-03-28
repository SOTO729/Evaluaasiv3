import { useState, useEffect, useRef } from 'react'
import { X, Plus, FileText, Pencil, Trash2, Send, Smile } from 'lucide-react'
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react'
import { supportChatService, type ChatMessageTemplate } from '@/services/supportChatService'

interface Props {
  open: boolean
  onClose: () => void
  onInsert: (content: string) => void
  isAdmin: boolean
}

const MAX_TITLE = 100
const MAX_CONTENT = 4000

export default function ChatTemplateManager({ open, onClose, onInsert, isAdmin }: Props) {
  const [templates, setTemplates] = useState<ChatMessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'personal' | 'global'>('personal')
  const [editing, setEditing] = useState<ChatMessageTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formGlobal, setFormGlobal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) loadTemplates()
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false)
      }
    }
    if (showEmoji) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmoji])

  async function loadTemplates() {
    setLoading(true)
    try {
      const data = await supportChatService.listTemplates()
      setTemplates(data)
    } catch {
      setError('Error al cargar plantillas')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setEditing(null)
    setCreating(false)
    setFormTitle('')
    setFormContent('')
    setFormGlobal(false)
    setError('')
    setShowEmoji(false)
  }

  function startCreate() {
    resetForm()
    setCreating(true)
    setFormGlobal(tab === 'global')
  }

  function startEdit(t: ChatMessageTemplate) {
    setCreating(false)
    setEditing(t)
    setFormTitle(t.title)
    setFormContent(t.content)
    setFormGlobal(t.is_global)
    setError('')
    setShowEmoji(false)
  }

  async function handleSave() {
    const title = formTitle.trim()
    const content = formContent.trim()
    if (!title || !content) {
      setError('Titulo y contenido son requeridos')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await supportChatService.updateTemplate(editing.id, {
          title,
          content,
          is_global: formGlobal,
        })
      } else {
        await supportChatService.createTemplate({
          title,
          content,
          is_global: formGlobal,
        })
      }
      resetForm()
      await loadTemplates()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(t: ChatMessageTemplate) {
    if (!confirm(`Eliminar plantilla "${t.title}"?`)) return
    try {
      await supportChatService.deleteTemplate(t.id)
      await loadTemplates()
    } catch {
      setError('Error al eliminar')
    }
  }

  function onEmojiClick(emoji: EmojiClickData) {
    const ta = contentRef.current
    if (ta) {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newVal = formContent.slice(0, start) + emoji.emoji + formContent.slice(end)
      setFormContent(newVal)
      setTimeout(() => {
        ta.focus()
        ta.setSelectionRange(start + emoji.emoji.length, start + emoji.emoji.length)
      }, 0)
    } else {
      setFormContent((prev) => prev + emoji.emoji)
    }
    setShowEmoji(false)
  }

  if (!open) return null

  const personal = templates.filter((t) => !t.is_global)
  const global = templates.filter((t) => t.is_global)
  const filtered = tab === 'personal' ? personal : global
  const isFormOpen = creating || editing !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-lg font-semibold text-slate-800">Plantillas de mensajes</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs + New button */}
        <div className="flex items-center gap-2 border-b px-5 py-2">
          <button
            onClick={() => setTab('personal')}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              tab === 'personal' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Mis plantillas ({personal.length})
          </button>
          <button
            onClick={() => setTab('global')}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              tab === 'global' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Globales ({global.length})
          </button>
          <div className="flex-1" />
          {(tab === 'personal' || isAdmin) && (
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-3.5 w-3.5" /> Nueva
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* Template list */}
        <div className="max-h-64 overflow-y-auto px-5 py-2">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Cargando...</p>
          ) : filtered.length === 0 && !isFormOpen ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {tab === 'personal' ? 'No tienes plantillas personales' : 'No hay plantillas globales'}
            </p>
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700">{t.title}</p>
                  <p className="truncate text-xs text-slate-400">{t.content}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => { onInsert(t.content); onClose() }}
                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                    title="Usar plantilla"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                  {(t.is_global ? isAdmin : true) && (
                    <>
                      <button
                        onClick={() => startEdit(t)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create/Edit form */}
        {isFormOpen && (
          <div className="border-t px-5 py-3">
            <p className="mb-2 text-sm font-medium text-slate-600">
              {editing ? 'Editar plantilla' : 'Nueva plantilla'}
            </p>
            <input
              type="text"
              placeholder="Titulo de la plantilla"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              maxLength={MAX_TITLE}
              className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <div className="relative">
              <textarea
                ref={contentRef}
                placeholder="Contenido del mensaje..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                maxLength={MAX_CONTENT}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-500"
                title="Insertar emoji"
              >
                <Smile className="h-4 w-4" />
              </button>
              {showEmoji && (
                <div ref={emojiRef} className="absolute right-0 top-10 z-50">
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    width={320}
                    height={350}
                    searchPlaceholder="Buscar emoji..."
                    lazyLoadEmojis
                  />
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
              <span>{formContent.length}/{MAX_CONTENT}</span>
            </div>
            {isAdmin && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={formGlobal}
                  onChange={(e) => setFormGlobal(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Plantilla global (visible para todos)
              </label>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !formTitle.trim() || !formContent.trim()}
                className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg px-4 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
