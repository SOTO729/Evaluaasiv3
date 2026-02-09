/**
 * StyledSelect - Componente de select estilizado con dropdown personalizado
 * Diseño consistente con DatePickerInput para uniformidad visual
 */
import { forwardRef, useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, LucideIcon } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface StyledSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: LucideIcon;
  colorScheme?: 'blue' | 'green' | 'indigo' | 'purple' | 'gray';
  disabled?: boolean;
  required?: boolean;
  className?: string;
  name?: string;
}

const colorClasses = {
  blue: {
    border: 'border-blue-500',
    ring: 'ring-blue-500',
    hover: 'hover:border-blue-300',
    gradient: 'from-blue-50/30',
    icon: 'text-blue-500',
    chevron: 'text-blue-400',
    header: 'from-blue-600 to-indigo-600',
    optionHover: 'hover:bg-blue-50',
    optionSelected: 'bg-blue-50 text-blue-700',
    check: 'text-blue-600',
  },
  green: {
    border: 'border-green-500',
    ring: 'ring-green-500',
    hover: 'hover:border-green-300',
    gradient: 'from-green-50/30',
    icon: 'text-green-500',
    chevron: 'text-green-400',
    header: 'from-green-600 to-emerald-600',
    optionHover: 'hover:bg-green-50',
    optionSelected: 'bg-green-50 text-green-700',
    check: 'text-green-600',
  },
  indigo: {
    border: 'border-indigo-500',
    ring: 'ring-indigo-500',
    hover: 'hover:border-indigo-300',
    gradient: 'from-indigo-50/30',
    icon: 'text-indigo-500',
    chevron: 'text-indigo-400',
    header: 'from-indigo-600 to-purple-600',
    optionHover: 'hover:bg-indigo-50',
    optionSelected: 'bg-indigo-50 text-indigo-700',
    check: 'text-indigo-600',
  },
  purple: {
    border: 'border-purple-500',
    ring: 'ring-purple-500',
    hover: 'hover:border-purple-300',
    gradient: 'from-purple-50/30',
    icon: 'text-purple-500',
    chevron: 'text-purple-400',
    header: 'from-purple-600 to-pink-600',
    optionHover: 'hover:bg-purple-50',
    optionSelected: 'bg-purple-50 text-purple-700',
    check: 'text-purple-600',
  },
  gray: {
    border: 'border-gray-500',
    ring: 'ring-gray-500',
    hover: 'hover:border-gray-400',
    gradient: 'from-gray-50/30',
    icon: 'text-gray-500',
    chevron: 'text-gray-400',
    header: 'from-gray-600 to-slate-600',
    optionHover: 'hover:bg-gray-50',
    optionSelected: 'bg-gray-100 text-gray-700',
    check: 'text-gray-600',
  },
};

const StyledSelect = forwardRef<HTMLDivElement, StyledSelectProps>(({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  icon: Icon,
  colorScheme = 'blue',
  disabled = false,
  required = false,
  className = '',
  name,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const colors = colorClasses[colorScheme];

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

  // Cerrar con Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption?.label || placeholder;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Hidden input for form compatibility */}
      <input type="hidden" name={name} value={value} required={required} />
      
      {/* Trigger button - diseño igual al DatePickerInput */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full fluid-px-4 fluid-py-3 border-2 border-gray-200 rounded-fluid-xl 
          focus:ring-2 ${colors.ring} ${colors.border} ${colors.hover}
          fluid-text-base transition-all cursor-pointer
          bg-gradient-to-r ${colors.gradient} to-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-between text-left
          ${isOpen ? `ring-2 ${colors.ring} ${colors.border}` : ''}
        `}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {Icon && <Icon className={`fluid-icon-base flex-shrink-0 ${colors.icon}`} />}
          <span className={`truncate ${value ? 'text-gray-900' : 'text-gray-400'}`}>
            {displayValue}
          </span>
        </div>
        <ChevronDown 
          className={`fluid-icon-base flex-shrink-0 transition-transform duration-200 ${colors.chevron} ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white rounded-fluid-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header con gradiente como el calendario */}
          <div className={`fluid-px-4 fluid-py-2 bg-gradient-to-r ${colors.header}`}>
            <span className="fluid-text-sm font-semibold text-white">
              {placeholder}
            </span>
          </div>
          
          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {!required && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`
                  w-full fluid-px-4 fluid-py-3 text-left flex items-center justify-between
                  transition-colors fluid-text-base
                  ${!value ? colors.optionSelected : `text-gray-600 ${colors.optionHover}`}
                `}
              >
                <span className="italic text-gray-400">Ninguno</span>
                {!value && <Check className={`fluid-icon-sm ${colors.check}`} />}
              </button>
            )}
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full fluid-px-4 fluid-py-3 text-left flex items-center justify-between
                  transition-colors fluid-text-base
                  ${value === option.value ? colors.optionSelected : `text-gray-700 ${colors.optionHover}`}
                `}
              >
                <span>{option.label}</span>
                {value === option.value && <Check className={`fluid-icon-sm ${colors.check}`} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

StyledSelect.displayName = 'StyledSelect';

export default StyledSelect;
