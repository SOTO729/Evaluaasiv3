import { useState } from 'react'

interface QuestionPreviewProps {
  questionText: string
  className?: string
}

const QuestionPreview = ({ questionText, className = '' }: QuestionPreviewProps) => {
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Extraer texto plano para la vista colapsada
  const plainText = questionText.replace(/<[^>]*>/g, '')
  const needsExpansion = plainText.length > 100 || questionText.includes('<')

  return (
    <div className={`card ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Pregunta:</h3>
            {needsExpansion && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    Mostrar menos
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    Ver completa
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
          
          {isExpanded ? (
            <div 
              className="prose prose-sm max-w-none text-gray-900"
              dangerouslySetInnerHTML={{ __html: questionText }}
            />
          ) : (
            <p className="text-lg font-medium text-gray-900">
              {plainText.length > 100 ? `${plainText.substring(0, 100)}...` : plainText}
            </p>
          )}
        </div>
      </div>
      
      <style>{`
        .prose h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; }
        .prose h2 { font-size: 1.3em; font-weight: bold; margin: 0.5em 0; }
        .prose h3 { font-size: 1.1em; font-weight: bold; margin: 0.5em 0; }
        .prose p { margin: 0.5em 0; line-height: 1.6; }
        .prose ul, .prose ol { margin: 0.5em 0; padding-left: 1.5em; }
        .prose li { margin: 0.25em 0; }
        .prose strong { font-weight: 600; }
        .prose em { font-style: italic; }
        .prose a { color: #2563eb; text-decoration: underline; }
        .prose img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 0.5rem; }
        .prose table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        .prose th, .prose td { border: 1px solid #e5e7eb; padding: 0.5em; }
        .prose th { background-color: #f3f4f6; font-weight: 600; }
        .prose blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; margin: 1em 0; color: #6b7280; }
        .prose code { background-color: #f3f4f6; padding: 0.2em 0.4em; border-radius: 0.25rem; font-family: monospace; font-size: 0.9em; }
        .prose pre { background-color: #1f2937; color: #f3f4f6; padding: 1em; border-radius: 0.5rem; overflow-x: auto; }
        .prose pre code { background-color: transparent; padding: 0; }
      `}</style>
    </div>
  )
}

export default QuestionPreview
