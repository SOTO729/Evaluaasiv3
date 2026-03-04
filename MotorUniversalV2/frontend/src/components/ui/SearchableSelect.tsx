/**
 * SearchableSelect — Combo box con búsqueda/autocompletado
 *
 * Reemplaza <select> nativo: permite escribir para filtrar opciones,
 * seleccionar con click o teclado, y muestra placeholder cuando está vacío.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';

export interface SearchableOption {
  id: number | string;
  name: string;
  /** Texto adicional para buscar (no se muestra) */
  searchExtra?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: number | string | '';
  onChange: (value: number | string | '') => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  emptyMessage?: string;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '-- Selecciona --',
  disabled = false,
  loading = false,
  loadingText = 'Cargando...',
  emptyMessage = 'Sin opciones',
  icon,
  label,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find(o => o.id === value);

  // Filtrar opciones por búsqueda
  const filtered = search.trim()
    ? options.filter(o => {
        const q = search.toLowerCase();
        return (
          o.name.toLowerCase().includes(q) ||
          (o.searchExtra && o.searchExtra.toLowerCase().includes(q)) ||
          String(o.id).includes(q)
        );
      })
    : options;

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll al item resaltado
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex]);

  const handleOpen = useCallback(() => {
    if (disabled || loading) return;
    setIsOpen(true);
    setSearch('');
    setHighlightIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled, loading]);

  const handleSelect = useCallback(
    (option: SearchableOption) => {
      onChange(option.id);
      setIsOpen(false);
      setSearch('');
      setHighlightIndex(-1);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < filtered.length) {
            handleSelect(filtered[highlightIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearch('');
          setHighlightIndex(-1);
          break;
      }
    },
    [isOpen, filtered, highlightIndex, handleOpen, handleSelect]
  );

  // Resetear highlight al cambiar búsqueda
  useEffect(() => {
    setHighlightIndex(filtered.length > 0 ? 0 : -1);
  }, [search]);

  const displayText = loading
    ? loadingText
    : selectedOption
    ? selectedOption.name
    : placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
          {icon}
          {label}
        </label>
      )}

      {/* Botón principal */}
      <button
        type="button"
        onClick={isOpen ? () => { setIsOpen(false); setSearch(''); } : handleOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        className={`
          w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-all
          ${disabled || loading
            ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
            : isOpen
            ? 'border-purple-500 ring-2 ring-purple-500 bg-white'
            : value
            ? 'border-purple-300 bg-white text-gray-900'
            : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
          }
        `}
      >
        <span className={`truncate ${!selectedOption && !loading ? 'text-gray-400' : ''}`}>
          {displayText}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {value && !disabled && !loading && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Barra de búsqueda */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Lista de opciones */}
          <ul
            ref={listRef}
            className="max-h-52 overflow-y-auto py-1"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">
                {search ? 'Sin resultados' : emptyMessage}
              </li>
            ) : (
              filtered.map((option, idx) => (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={option.id === value}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={`
                    px-3 py-2 text-sm cursor-pointer transition-colors
                    ${option.id === value
                      ? 'bg-purple-50 text-purple-700 font-medium'
                      : idx === highlightIndex
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {option.name}
                </li>
              ))
            )}
          </ul>

          {/* Contador */}
          {options.length > 5 && (
            <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400 text-right">
              {filtered.length} de {options.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
