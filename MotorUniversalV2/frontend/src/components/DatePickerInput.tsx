/**
 * DatePicker personalizado con estilos mejorados
 * Usa react-datepicker con configuración en español
 * Soporta navegación por año con dropdown
 */
import { forwardRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getYear, getMonth } from 'date-fns';
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
          changeYear,
          changeMonth,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => {
          const years = Array.from({ length: 120 }, (_, i) => getYear(new Date()) + 10 - i);
          const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
          ];

          return (
            <div className="flex flex-col gap-1 px-2 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-lg">
              {/* Year and month selectors */}
              <div className="flex items-center gap-1.5 justify-center">
                <select
                  value={getYear(date)}
                  onChange={({ target: { value } }) => changeYear(Number(value))}
                  className="bg-white/20 text-white text-sm font-bold rounded-lg px-2 py-1 border-none focus:ring-2 focus:ring-white/40 outline-none cursor-pointer appearance-none text-center"
                  style={{ colorScheme: 'dark' }}
                >
                  {years.map((year) => (
                    <option key={year} value={year} className="text-gray-900 bg-white">
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  value={months[getMonth(date)]}
                  onChange={({ target: { value } }) => changeMonth(months.indexOf(value))}
                  className="bg-white/20 text-white text-sm font-bold rounded-lg px-2 py-1 border-none focus:ring-2 focus:ring-white/40 outline-none cursor-pointer appearance-none text-center capitalize"
                  style={{ colorScheme: 'dark' }}
                >
                  {months.map((month) => (
                    <option key={month} value={month} className="text-gray-900 bg-white">
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              {/* Navigation arrows */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => changeYear(getYear(date) - 1)}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    title="Año anterior"
                  >
                    <ChevronsLeft className="w-4 h-4 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={decreaseMonth}
                    disabled={prevMonthButtonDisabled}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                </div>
                <span className="text-xs font-medium text-white/80 capitalize">
                  {date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={increaseMonth}
                    disabled={nextMonthButtonDisabled}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeYear(getYear(date) + 1)}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    title="Año siguiente"
                  >
                    <ChevronsRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          );
        }}
        calendarClassName="custom-datepicker-calendar"
        wrapperClassName="w-full"
      />
    </div>
  );
}
