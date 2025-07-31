'use client'

import { SecurityBlog } from '@/types/blog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from './status-indicator'
import { ThreatCategoryBadge } from './threat-category-badge'
import { useBlogStore } from '@/store/blog-store'
import { formatDate } from '@/lib/utils'
import { 
  Globe, 
  Clock, 
  FileText, 
  Play, 
  Pause, 
  Settings, 
  Trash2,
  Zap,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react'

interface ProfessionalBlogCardProps {
  blog: SecurityBlog
}

export function ProfessionalBlogCard({ blog }: ProfessionalBlogCardProps) {
  const { 
    toggleBlogMonitoring, 
    removeBlog, 
    simulateNewPost 
  } = useBlogStore()

  const handleToggleMonitoring = () => {
    toggleBlogMonitoring(blog.id)
  }

  const handleRemoveBlog = () => {
    removeBlog(blog.id)
  }

  const handleSimulatePost = () => {
    if (blog.isDemo) {
      simulateNewPost(blog.id)
    }
  }

  return (
    <Card className="w-full hover:shadow-lg transition-all duration-200 bg-white min-h-[320px]">
      {/* Header - 56px */}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg flex-shrink-0">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary truncate">{blog.title}</h3>
              {blog.isDemo && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  Demo
                </Badge>
              )}
            </div>
            <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
              {blog.description}
            </p>
          </div>
          <StatusIndicator status={blog.status} />
        </div>
      </CardHeader>

      {/* Content - Flexible */}
      <CardContent className="space-y-4">
        {/* URL */}
        <div className="flex items-center gap-2 p-3 bg-surface rounded-lg">
          <ExternalLink className="h-3 w-3 text-text-muted flex-shrink-0" />
          <a 
            href={blog.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-text-secondary hover:text-primary transition-colors truncate flex-1 font-mono"
          >
            {blog.url}
          </a>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-text-muted" />
            <span className="text-sm text-text-muted">Posts:</span>
            <span className="text-sm font-semibold text-text-primary">{blog.postCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-text-muted" />
            <span className="text-sm text-text-muted">Every:</span>
            <span className="text-sm font-semibold text-text-primary">{blog.preferences.checkInterval}m</span>
          </div>
        </div>

        {/* Last Update */}
        {blog.lastChecked && (
          <div className="text-xs text-text-muted">
            Last checked: {formatDate(blog.lastChecked)}
          </div>
        )}

        {/* Threat Categories */}
        <div className="flex flex-wrap gap-1.5">
          {blog.preferences.categories.map((category) => (
            <ThreatCategoryBadge key={category} category={category} />
          ))}
        </div>

        {/* Recent Posts */}
        {blog.recentPosts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-text-secondary">Recent Activity</h4>
            <div className="space-y-2">
              {blog.recentPosts.slice(0, 2).map((post) => (
                <div 
                  key={post.id} 
                  className="p-3 bg-surface rounded-lg border border-border-muted"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary line-clamp-1">{post.title}</span>
                    {post.analyzed && (
                      <Badge variant="success" className="text-xs">
                        Analyzed
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">
                    {formatDate(post.publishedAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Actions - 48px */}
      <div className="px-6 pb-6">
        <div className="flex gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleMonitoring}
            className="flex-1"
          >
            {blog.preferences.enabled ? (
              <>
                <Pause className="h-3 w-3" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Resume
              </>
            )}
          </Button>

          {blog.isDemo && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSimulatePost}
              className="flex-1"
            >
              <Zap className="h-3 w-3" />
              Simulate Post
            </Button>
          )}

          <Button variant="ghost" size="sm" className="px-3">
            <Settings className="h-3 w-3" />
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRemoveBlog}
            className="px-3 text-error hover:text-error hover:bg-error/10"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  )
}