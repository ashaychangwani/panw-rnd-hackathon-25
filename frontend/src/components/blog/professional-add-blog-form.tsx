'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBlogStore } from '@/store/blog-store'
import { Plus, Globe, X } from 'lucide-react'

export function ProfessionalAddBlogForm() {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { addBlog } = useBlogStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || !title.trim()) return

    setIsLoading(true)
    try {
      addBlog(url.trim(), title.trim(), description.trim())
      
      // Reset form
      setUrl('')
      setTitle('')
      setDescription('')
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <Card className="border-2 border-dashed border-border-muted hover:border-primary/30 transition-colors bg-surface/30 min-h-[320px]">
        <CardContent className="flex flex-col items-center justify-center h-full p-8">
          <button
            onClick={() => setIsOpen(true)}
            className="flex flex-col items-center gap-3 text-text-muted hover:text-primary transition-colors group"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-text-primary">Add Security Blog</div>
              <div className="text-xs text-text-muted mt-1">Monitor new threat intelligence source</div>
            </div>
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white min-h-[320px]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Add Security Blog</CardTitle>
              <CardDescription className="text-sm">
                Add a new threat intelligence source to monitor
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="blog-url" className="text-sm font-medium text-text-primary">
              Blog URL *
            </label>
            <input
              id="blog-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/security-blog"
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="blog-title" className="text-sm font-medium text-text-primary">
              Blog Title *
            </label>
            <input
              id="blog-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Security Blog Name"
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="blog-description" className="text-sm font-medium text-text-primary">
              Description
            </label>
            <textarea
              id="blog-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the blog content and focus areas"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
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
              className="flex-1"
            >
              {isLoading ? 'Adding...' : 'Add Blog'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}