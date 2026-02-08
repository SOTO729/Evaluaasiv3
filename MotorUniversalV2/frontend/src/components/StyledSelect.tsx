/**
 * StyledSelect - Componente de select estilizado
 * Diseño consistente con DatePickerInput para uniformidad visual
 */
import { forwardRef } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';

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
    focus: 'focus:ring-blue-500 focus:border-blue-500',
    hover: 'hover:border-blue-300',
    gradient: 'from-blue-50/30',
    icon: 'text-blue-500',
    chevron: 'text-blue-400',
  },
  green: {
    focus: 'focus:ring-green-500 focus:border-green-500',
    hover: 'hover:border-green-300',
    gradient: 'from-green-50/30',
    icon: 'text-green-500',
    chevron: 'text-green-400',
  },
  indigo: {
    focus: 'focus:ring-indigo-500 focus:border-indigo-500',
    hover: 'hover:border-indigo-300',
    gradient: 'from-indigo-50/30',
    icon: 'text-indigo-500',
    chevron: 'text-indigo-400',
  },
  purple: {
    focus: 'focus:ring-purple-500 focus:border-purple-500',
    hover: 'hover:border-purple-300',
    gradient: 'from-purple-50/30',
    icon: 'text-purple-500',
    chevron: 'text-purple-400',
  },
  gray: {
    focus: 'focus:ring-gray-500 focus:border-gray-500',
    hover: 'hover:border-gray-400',
    gradient: 'from-gray-50/30',
    icon: 'text-gray-500',
    chevron: 'text-gray-400',
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
  const colors = colorClasses[colorScheme];

  return (
    <div ref={ref} className={`relative ${className}`}>
      {Icon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
          <Icon className={`fluid-icon-base ${colors.icon}`} />
        </div>
      )}
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className={`
          w-full fluid-py-3 border-2 border-gray-200 rounded-fluid-xl 
          focus:ring-2 ${colors.focus} ${colors.hover}
          fluid-text-base transition-all cursor-pointer appearance-none
          bg-gradient-to-r ${colors.gradient} to-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${Icon ? 'fluid-pl-11 fluid-pr-10' : 'fluid-pl-4 fluid-pr-10'}
        `}
      >
        {placeholder && !required && (
          <option value="">{placeholder}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <ChevronDown className={`fluid-icon-base ${colors.chevron}`} />
      </div>
    </div>
  );
});

StyledSelect.displayName = 'StyledSelect';

export default StyledSelect;
