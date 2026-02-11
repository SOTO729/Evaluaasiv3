/**
 * ToggleSwitch — aesthetic toggle component
 * Reusable iOS-style toggle with optional label and description.
 */

interface ToggleSwitchProps {
  checked: boolean | undefined;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  colorScheme?: 'indigo' | 'blue' | 'green' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'rose';
}

const colorMap: Record<string, { on: string; ring: string }> = {
  indigo:  { on: 'bg-indigo-600',  ring: 'focus:ring-indigo-400' },
  blue:    { on: 'bg-blue-600',    ring: 'focus:ring-blue-400' },
  green:   { on: 'bg-green-600',   ring: 'focus:ring-green-400' },
  purple:  { on: 'bg-purple-600',  ring: 'focus:ring-purple-400' },
  amber:   { on: 'bg-amber-500',   ring: 'focus:ring-amber-400' },
  emerald: { on: 'bg-emerald-600', ring: 'focus:ring-emerald-400' },
  cyan:    { on: 'bg-cyan-600',    ring: 'focus:ring-cyan-400' },
  rose:    { on: 'bg-rose-600',    ring: 'focus:ring-rose-400' },
};

export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  colorScheme = 'indigo',
}: ToggleSwitchProps) {
  const c = colorMap[colorScheme] || colorMap.indigo;
  const isChecked = !!checked;

  const sizeClasses = size === 'sm'
    ? { track: 'w-9 h-5', thumb: 'h-3.5 w-3.5', translate: 'translate-x-4', offset: 'translate-x-0.5' }
    : { track: 'w-11 h-6', thumb: 'h-4 w-4', translate: 'translate-x-5', offset: 'translate-x-1' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!isChecked)}
      className={`
        relative inline-flex flex-shrink-0 ${sizeClasses.track} items-center rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 ${c.ring}
        ${isChecked ? c.on : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          inline-block ${sizeClasses.thumb} rounded-full bg-white shadow-md
          transform transition-transform duration-200 ease-in-out
          ${isChecked ? sizeClasses.translate : sizeClasses.offset}
        `}
      />
    </button>
  );
}
