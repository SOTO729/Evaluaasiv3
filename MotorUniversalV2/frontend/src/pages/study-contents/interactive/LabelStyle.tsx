import React, { useState, useRef, useEffect } from 'react'

/**
 * Estilo de visualización de la etiqueta de una acción (invisible / texto / sombra).
 * Extraído de StudyInteractiveExercisePage (refactor incremental).
 */

interface LabelStyleOption {
  value: 'invisible' | 'text_only' | 'text_with_shadow' | 'shadow_only';
  label: string;
  description: string;
  isHighlighted?: boolean;
}

const LABEL_STYLE_OPTIONS: LabelStyleOption[] = [
  { value: 'invisible', label: '✨ Invisible', description: 'recomendado para examen o evaluación', isHighlighted: true },
  { value: 'text_only', label: 'Texto indicativo sin sombra', description: 'recomendado para material de estudio' },
  { value: 'text_with_shadow', label: 'Texto indicativo con sombra', description: 'recomendado para material de estudio' },
  { value: 'shadow_only', label: 'Sombra sin texto indicativo', description: 'recomendado para material de estudio' },
];

// Helper para obtener etiqueta corta del estilo de visualización
export const getLabelStyleInfo = (style: string | undefined): { name: string; color: string; iconColor: string } => {
  switch (style) {
    case 'invisible':
      return { name: 'Invisible', color: 'text-purple-700', iconColor: 'text-purple-600' };
    case 'text_only':
      return { name: 'Texto sin sombra', color: 'text-blue-700', iconColor: 'text-blue-600' };
    case 'text_with_shadow':
      return { name: 'Texto con sombra', color: 'text-indigo-700', iconColor: 'text-indigo-600' };
    case 'shadow_only':
      return { name: 'Solo sombra', color: 'text-gray-700', iconColor: 'text-gray-600' };
    default:
      return { name: 'Invisible', color: 'text-purple-700', iconColor: 'text-purple-600' };
  }
};

// Componente de icono para estilo de visualización
export const LabelStyleIcon: React.FC<{ style: string | undefined; className?: string }> = ({ style, className = 'w-3.5 h-3.5' }) => {
  const info = getLabelStyleInfo(style);

  switch (style) {
    case 'invisible':
      // Icono de ojo tachado (invisible)
      return (
        <svg className={`${className} ${info.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      );
    case 'text_only':
      // Icono de texto (T)
      return (
        <svg className={`${className} ${info.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 6v14M8 6V4h8v2" />
        </svg>
      );
    case 'text_with_shadow':
      // Icono de texto con sombra
      return (
        <svg className={`${className} ${info.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 6v14M8 6V4h8v2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8h12M14 8v12" opacity="0.4" />
        </svg>
      );
    case 'shadow_only':
      // Icono de cuadrado con sombra
      return (
        <svg className={`${className} ${info.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="14" height="14" rx="2" strokeWidth={2} />
          <rect x="7" y="7" width="14" height="14" rx="2" strokeWidth={1.5} opacity="0.4" />
        </svg>
      );
    default:
      return (
        <svg className={`${className} ${info.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      );
  }
};

// Helper para saber si el estilo tiene texto indicativo
export const styleHasText = (style: string | undefined): boolean => {
  return style === 'text_only' || style === 'text_with_shadow';
};

interface LabelStyleDropdownProps {
  value: 'invisible' | 'text_only' | 'text_with_shadow' | 'shadow_only';
  onChange: (value: 'invisible' | 'text_only' | 'text_with_shadow' | 'shadow_only') => void;
  accentColor?: 'blue' | 'green';
}

export const LabelStyleDropdown: React.FC<LabelStyleDropdownProps> = ({ value, onChange, accentColor = 'blue' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = LABEL_STYLE_OPTIONS.find(opt => opt.value === value) || LABEL_STYLE_OPTIONS[0];

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ringColor = accentColor === 'green' ? 'focus:ring-green-500' : 'focus:ring-blue-500';
  const isInvisible = value === 'invisible';

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full fluid-px-3 fluid-py-2 border rounded-fluid-lg fluid-text-sm transition-all duration-200 text-left flex items-center justify-between ${ringColor} ${
          isInvisible
            ? 'border-purple-400 bg-purple-50 shadow-[0_0_12px_rgba(147,51,234,0.5)]'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <span className="flex items-baseline fluid-gap-2 flex-wrap">
          <span className={isInvisible ? 'font-semibold text-purple-800' : 'text-gray-900'}>{selectedOption.label}</span>
          <span className={`fluid-text-xs font-bold ${isInvisible ? 'text-purple-600' : 'text-gray-500'}`}>
            {selectedOption.description}
          </span>
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 fluid-mt-1 w-full bg-white border border-gray-200 rounded-fluid-lg shadow-lg overflow-hidden">
          {LABEL_STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full fluid-px-3 py-2.5 text-left flex items-baseline fluid-gap-2 flex-wrap transition-colors ${
                option.value === value
                  ? option.isHighlighted
                    ? 'bg-purple-100'
                    : 'bg-blue-50'
                  : 'hover:bg-gray-50'
              } ${option.isHighlighted ? 'border-l-4 border-purple-500' : ''}`}
            >
              <span className={`fluid-text-sm ${option.isHighlighted ? 'font-semibold text-purple-800' : 'text-gray-900'}`}>
                {option.label}
              </span>
              <span className={`fluid-text-xs font-bold ${option.isHighlighted ? 'text-purple-600' : 'text-amber-600'}`}>
                {option.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
