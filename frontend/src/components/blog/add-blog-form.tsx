'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBlogStore } from '@/store/blog-store'
import { Plus, Globe } from 'lucide-react'

export function AddBlogForm() {
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
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(true)}
            className="h-auto flex-col gap-2 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-8 w-8" />
            <span>Add Security Blog</span>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Add New Security Blog
        </CardTitle>
        <CardDescription>
          Add a security blog to monitor for new threat intelligence and vulnerability reports
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="blog-url" className="text-sm font-medium">
              Blog URL *
            </label>
            <input
              id="blog-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/security-blog"
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="blog-title" className="text-sm font-medium">
              Blog Title *
            </label>
            <input
              id="blog-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Security Blog Name"
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="blog-description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="blog-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the blog content and focus areas"
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              type="submit" 
              disabled={isLoading || !url.trim() || !title.trim()}
              className="flex-1"
            >
              {isLoading ? 'Adding...' : 'Add Blog'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}