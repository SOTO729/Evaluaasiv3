import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  path?: string
  isActive?: boolean
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

const Breadcrumb = ({ items }: BreadcrumbProps) => {
  return (
    <nav className="flex items-center space-x-1 text-sm mb-4 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm border border-gray-100">
      <Link 
        to="/exams" 
        className="flex items-center text-gray-500 hover:text-blue-600 transition-colors duration-200"
      >
        <Home className="w-4 h-4" />
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
          {item.path && !item.isActive ? (
            <Link
              to={item.path}
              className="text-gray-500 hover:text-blue-600 transition-colors duration-200 font-medium hover:underline underline-offset-2"
            >
              {item.label}
            </Link>
          ) : (
            <span className={`font-medium ${item.isActive ? 'text-blue-600' : 'text-gray-700'}`}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}

export default Breadcrumb
