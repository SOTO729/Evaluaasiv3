/**
 * Breadcrumb específico para el módulo Partners
 * Navegación: Partners > Partner > Plantel > Grupo > etc
 */
import { Link } from 'react-router-dom';
import { ChevronRight, Building2 } from 'lucide-react';

export interface PartnersBreadcrumbItem {
  label: string;
  path?: string;
}

interface PartnersBreadcrumbProps {
  items: PartnersBreadcrumbItem[];
}

export default function PartnersBreadcrumb({ items }: PartnersBreadcrumbProps) {
  return (
    <nav className="flex items-center flex-wrap fluid-gap-1.5 fluid-text-sm fluid-mb-5 bg-gradient-to-r from-white to-gray-50 rounded-fluid-xl fluid-px-4 fluid-py-3 shadow-sm border border-gray-200">
      {/* Icono y link raíz a Partners */}
      <Link
        to="/partners"
        className="flex items-center fluid-gap-2 text-gray-600 hover:text-blue-600 transition-colors duration-200 group"
      >
        <div className="fluid-p-1.5 bg-blue-100 group-hover:bg-blue-200 rounded-fluid-lg transition-colors">
          <Building2 className="fluid-icon-sm text-blue-600" />
        </div>
        <span className="font-semibold hidden sm:inline">Partners</span>
      </Link>

      {/* Items del breadcrumb */}
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <div key={index} className="flex items-center">
            <ChevronRight className="fluid-icon-sm text-gray-400 fluid-mx-1.5" />
            {item.path && !isLast ? (
              <Link
                to={item.path}
                className="text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium hover:underline underline-offset-2 max-w-[150px] sm:max-w-[200px] truncate"
                title={item.label}
              >
                {item.label}
              </Link>
            ) : (
              <span 
                className={`font-semibold max-w-[150px] sm:max-w-[250px] truncate ${
                  isLast ? 'text-blue-600' : 'text-gray-700'
                }`}
                title={item.label}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
