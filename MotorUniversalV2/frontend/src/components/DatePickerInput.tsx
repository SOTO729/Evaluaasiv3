/**
 * DatePicker personalizado con estilos mejorados
 * Usa react-datepicker con configuración en español
 */
import { forwardRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

// Registrar locale español
registerLocale('es', es);

interface DatePickerInputProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date | null;
  maxDate?: Date | null;
  colorScheme?: 'green' | 'indigo' | 'blue';
  className?: string;
  disabled?: boolean;
}

// Input personalizado para el DatePicker
const CustomInput = forwardRef<HTMLButtonElement, { 
  value?: string; 
  onClick?: () => void; 
  placeholder?: string;
  colorScheme: 'green' | 'indigo' | 'blue';
  disabled?: boolean;
}>(({ value, onClick, placeholder, colorScheme, disabled }, ref) => {
  const colorClasses = {
    green: 'focus:ring-green-500 focus:border-green-500 hover:border-green-300 from-green-50/30',
    indigo: 'focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-300 from-indigo-50/30',
    blue: 'focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300 from-blue-50/30',
  };
  
  const iconColors = {
    green: 'text-green-500',
    indigo: 'text-indigo-500',
    blue: 'text-blue-500',
  };

  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={`w-full fluid-px-4 fluid-py-3 border-2 border-gray-200 rounded-fluid-xl focus:ring-2 ${colorClasses[colorScheme]} fluid-text-base transition-all bg-gradient-to-r ${colorClasses[colorScheme]} to-transparent cursor-pointer flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span className={value ? 'text-gray-900' : 'text-gray-400'}>
        {value || placeholder || 'Seleccionar fecha'}
      </span>
      <Calendar className={`fluid-icon-base ${iconColors[colorScheme]}`} />
    </button>
  );
});

CustomInput.displayName = 'CustomInput';

export default function DatePickerInput({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  minDate,
  maxDate,
  colorScheme = 'blue',
  className = '',
  disabled = false,
}: DatePickerInputProps) {
  return (
    <div className={`date-picker-wrapper ${className}`}>
      <DatePicker
        selected={value}
        onChange={onChange}
        locale="es"
        dateFormat="dd 'de' MMMM 'de' yyyy"
        minDate={minDate || undefined}
        maxDate={maxDate || undefined}
        disabled={disabled}
        showPopperArrow={false}
        popperPlacement="bottom-start"
        portalId="datepicker-portal"
        customInput={
          <CustomInput 
            colorScheme={colorScheme} 
            placeholder={placeholder}
            disabled={disabled}
          />
        }
        renderCustomHeader={({
          date,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => (
          <div className="flex items-center justify-between fluid-px-4 fluid-py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
            <button
              type="button"
              onClick={decreaseMonth}
              disabled={prevMonthButtonDisabled}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="fluid-icon-base text-white" />
            </button>
            <span className="fluid-text-base font-bold text-white capitalize">
              {date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={increaseMonth}
              disabled={nextMonthButtonDisabled}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="fluid-icon-base text-white" />
            </button>
          </div>
        )}
        calendarClassName="custom-datepicker-calendar"
        wrapperClassName="w-full"
      />
    </div>
  );
}
