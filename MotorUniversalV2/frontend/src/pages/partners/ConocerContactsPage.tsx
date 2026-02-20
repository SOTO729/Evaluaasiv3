/**
 * Página de Contactos CONOCER
 *
 * Permite gestionar los contactos de correo para solicitudes de
 * línea de captura CONOCER. También muestra el historial de solicitudes enviadas.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Send,
  History,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import {
  getConocerContacts,
  createConocerContact,
  updateConocerContact,
  deleteConocerContact,
  getConocerSolicitudLogs,
  ConocerEmailContact,
  ConocerSolicitudLog,
} from '../../services/partnersService';

export default function ConocerContactsPage() {
  const [contacts, setContacts] = useState<ConocerEmailContact[]>([]);
  const [logs, setLogs] = useState<ConocerSolicitudLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<'contacts' | 'history'>('contacts');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [contactsData, logsData] = await Promise.all([
        getConocerContacts(),
        getConocerSolicitudLogs(),
      ]);
      setContacts(contactsData.contacts);
      setLogs(logsData.logs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    try {
      setAdding(true);
      await createConocerContact({ name: newName.trim(), email: newEmail.trim() });
      setNewName('');
      setNewEmail('');
      setShowAddForm(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear contacto');
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (contact: ConocerEmailContact) => {
    setEditingId(contact.id);
    setEditName(contact.name);
    setEditEmail(contact.email);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editEmail.trim()) return;
    try {
      setSaving(true);
      await updateConocerContact(editingId, { name: editName.trim(), email: editEmail.trim() });
      setEditingId(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar contacto');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (contact: ConocerEmailContact) => {
    try {
      await updateConocerContact(contact.id, { is_active: !contact.is_active });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este contacto?')) return;
    try {
      setDeletingId(id);
      await deleteConocerContact(id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar contacto');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Cargando contactos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/tramites-conocer"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a Trámites CONOCER
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Contactos CONOCER</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los contactos a los que se enviará la solicitud de línea de captura
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'contacts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contactos ({contacts.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial de Envíos ({logs.length})
            </div>
          </button>
        </div>

        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {/* Add button */}
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Agregar Contacto
              </button>
            )}

            {/* Add form */}
            {showAddForm && (
              <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Nuevo Contacto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Correo electrónico</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={adding || !newName.trim() || !newEmail.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Agregar
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewName('');
                      setNewEmail('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Contacts list */}
            {contacts.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No hay contactos configurados</p>
                <p className="text-gray-400 text-xs mt-1">
                  Agrega contactos para poder enviar solicitudes de línea de captura
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center gap-4 px-4 py-3">
                    {editingId === contact.id ? (
                      <>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Guardar"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-900 truncate">{contact.name}</span>
                            {!contact.is_active && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactivo</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                            <span className="text-xs text-gray-500 truncate">{contact.email}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(contact)}
                            className={`p-1.5 rounded transition-colors ${
                              contact.is_active
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-gray-400 hover:bg-gray-50'
                            }`}
                            title={contact.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {contact.is_active ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(contact)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            disabled={deletingId === contact.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Eliminar"
                          >
                            {deletingId === contact.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No se han enviado solicitudes aún</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`bg-white border rounded-lg p-4 ${
                    log.status === 'sent' ? 'border-green-200' : 'border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === 'sent' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {log.total_certificates} certificados
                        </p>
                        <p className="text-xs text-gray-500">
                          {log.sent_by_name ? `Enviado por ${log.sent_by_name}` : 'Envío automático'}
                          {' · '}
                          {new Date(log.sent_at).toLocaleString('es-MX')}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.status === 'sent'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {log.status === 'sent' ? 'Enviado' : 'Error'}
                    </span>
                  </div>

                  {/* Destinatarios */}
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <Send className="w-3 h-3" />
                    {log.recipients.join(', ')}
                  </div>

                  {/* ECM Summary */}
                  {log.ecm_summary && log.ecm_summary.length > 0 && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-1.5">
                        {log.ecm_summary.map((item) => (
                          <span
                            key={item.code}
                            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                          >
                            {item.code}: {item.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.error_message && (
                    <p className="mt-2 text-xs text-red-600">{log.error_message}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
