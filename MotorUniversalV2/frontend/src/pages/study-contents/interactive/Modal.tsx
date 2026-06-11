import React from 'react'

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

/** Modal genérico del editor de ejercicios interactivos. */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizeClasses = {
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] fluid-p-4" onClick={onClose}>
      <div className={`bg-white rounded-fluid-lg ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center fluid-p-4 border-b">
          <h3 className="fluid-text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="fluid-p-1 hover:bg-gray-100 rounded">
            <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="fluid-p-4">{children}</div>
      </div>
    </div>
  );
};
