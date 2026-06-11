import React, { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Componentes de UI del detalle de material (Modal y Toast).
 * Extraídos de StudyContentDetailPage (refactor incremental). Movimiento puro.
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizeClasses = {
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fluid-p-4" onClick={onClose}>
      <div className={`bg-white rounded-fluid-lg ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center fluid-p-4 border-b">
          <h3 className="fluid-text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="fluid-p-1 hover:bg-gray-100 rounded">
            <X className="fluid-icon-sm" />
          </button>
        </div>
        <div className="fluid-p-4">{children}</div>
      </div>
    </div>
  );
};

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Auto-dismiss after 3 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in">
      <div className={`flex items-center fluid-gap-3 fluid-px-6 fluid-py-4 rounded-fluid-lg shadow-lg ${
        type === 'success'
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}>
        {type === 'success' ? (
          <svg className="fluid-icon-lg flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="fluid-icon-lg flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 hover:opacity-80 transition-opacity"
        >
          <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
