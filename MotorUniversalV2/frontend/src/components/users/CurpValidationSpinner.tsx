/**
 * Spinner overlay que se muestra mientras se valida una CURP contra RENAPO (~10s).
 * Muestra un mensaje informativo y opción de cancelar.
 */
import { Shield, Loader2 } from 'lucide-react';

interface CurpValidationSpinnerProps {
  curp: string;
  onCancel?: () => void;
}

export default function CurpValidationSpinner({ curp, onCancel }: CurpValidationSpinnerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Shield className="w-16 h-16 text-blue-500" />
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin absolute -bottom-1 -right-1" />
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Validando CURP con RENAPO
        </h3>
        
        <p className="text-sm text-gray-500 mb-1">
          Verificando <span className="font-mono font-medium text-gray-700">{curp}</span>
        </p>
        
        <p className="text-xs text-gray-400 mb-6">
          Consultando el Registro Nacional de Población.
          <br />Esto puede tardar unos segundos...
        </p>
        
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4 overflow-hidden">
          <div className="bg-blue-500 h-1.5 rounded-full animate-pulse w-2/3" />
        </div>
        
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
