'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Globe, X, Check } from 'lucide-react'
import { ThreatCategory } from '@/types/orchestration'

interface AddIntelligenceSourceFormProps {
  onAddSource: (url: string, title: string, description: string, categories: ThreatCategory[]) => void
}

const THREAT_CATEGORIES: { value: ThreatCategory; label: string; color: string }[] = [
  { value: 'malware', label: 'Malware', color: 'bg-red-100 text-red-800' },
  { value: 'ransomware', label: 'Ransomware', color: 'bg-purple-100 text-purple-800' },
  { value: 'apt', label: 'APT', color: 'bg-orange-100 text-orange-800' },
  { value: 'vulnerability', label: 'Vulnerability', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'phishing', label: 'Phishing', color: 'bg-blue-100 text-blue-800' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800' }
]

export function AddIntelligenceSourceForm({ onAddSource }: AddIntelligenceSourceFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<ThreatCategory[]>(['general'])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || !title.trim()) return

    setIsLoading(true)
    try {
      onAddSource(url.trim(), title.trim(), description.trim(), selectedCategories)
      
      // Reset form
      setUrl('')
      setTitle('')
      setDescription('')
      setSelectedCategories(['general'])
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCategory = (category: ThreatCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  if (!isOpen) {
    return (
      <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors bg-gray-50/50 min-h-[400px]">
        <CardContent className="flex flex-col items-center justify-center h-full p-8">
          <button
            onClick={() => setIsOpen(true)}
            className="flex flex-col items-center gap-3 text-gray-500 hover:text-blue-600 transition-colors group"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900">Add Intelligence Source</div>
              <div className="text-xs text-gray-500 mt-1">Monitor new threat intelligence blog or feed</div>
            </div>
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white min-h-[400px]">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Add Intelligence Source</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/security-blog"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Security Blog Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this intelligence source..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Threat Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {THREAT_CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => toggleCategory(category.value)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                      selectedCategories.includes(category.value)
                        ? `${category.color} border-current`
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {selectedCategories.includes(category.value) && (
                      <Check className="w-3 h-3" />
                    )}
                    {category.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select relevant threat categories for this source
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !url.trim() || !title.trim()}
              className="flex-1 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isLoading ? 'Adding...' : 'Add Source'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}