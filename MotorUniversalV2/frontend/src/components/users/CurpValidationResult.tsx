/**
 * Muestra el resultado de una validación CURP RENAPO.
 * Se usa en formularios después de validar para mostrar al usuario los datos obtenidos.
 */
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { CurpValidationResult } from '../../services/userManagementService';

interface CurpValidationResultProps {
  result: CurpValidationResult;
  onAccept?: () => void;
  onRetry?: () => void;
}

export default function CurpValidationResultDisplay({ result, onAccept, onRetry }: CurpValidationResultProps) {
  if (result.skip_reason) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2">
        <div className="flex items-center gap-2 text-gray-600">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">{result.skip_reason}</span>
        </div>
      </div>
    );
  }

  if (!result.valid) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-2">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <XCircle className="w-5 h-5" />
          <span className="text-sm font-medium">CURP no válida en RENAPO</span>
        </div>
        <p className="text-sm text-red-600 ml-7">{result.error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 ml-7 text-sm text-red-700 hover:text-red-800 underline"
          >
            Reintentar validación
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-2">
      <div className="flex items-center gap-2 text-green-700 mb-3">
        <CheckCircle className="w-5 h-5" />
        <span className="text-sm font-medium">CURP verificada contra RENAPO</span>
      </div>
      
      {result.data && (
        <div className="ml-7 space-y-1">
          <p className="text-sm text-gray-700">
            <span className="text-gray-500">Nombre:</span>{' '}
            <span className="font-medium">{result.data.name}</span>
          </p>
          <p className="text-sm text-gray-700">
            <span className="text-gray-500">Primer apellido:</span>{' '}
            <span className="font-medium">{result.data.first_surname}</span>
          </p>
          {result.data.second_surname && (
            <p className="text-sm text-gray-700">
              <span className="text-gray-500">Segundo apellido:</span>{' '}
              <span className="font-medium">{result.data.second_surname}</span>
            </p>
          )}
          <p className="text-xs text-green-600 mt-2">
            Los datos de nombre se actualizarán con la información de RENAPO.
          </p>
        </div>
      )}
      
      {onAccept && (
        <button
          onClick={onAccept}
          className="mt-3 ml-7 px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
        >
          Aceptar y continuar
        </button>
      )}
    </div>
  );
}
