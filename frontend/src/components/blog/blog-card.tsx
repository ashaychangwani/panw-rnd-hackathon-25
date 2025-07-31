'use client'

import { SecurityBlog } from '@/types/blog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  ExternalLink
} from 'lucide-react'

interface BlogCardProps {
  blog: SecurityBlog
}

export function BlogCard({ blog }: BlogCardProps) {
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
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <CardTitle className="text-lg truncate">{blog.title}</CardTitle>
              {blog.isDemo && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Demo
                </Badge>
              )}
            </div>
            <CardDescription className="line-clamp-2">
              {blog.description}
            </CardDescription>
          </div>
          <StatusIndicator status={blog.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* URL and Metadata */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <a 
            href={blog.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors truncate flex-1"
          >
            {blog.url}
          </a>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Posts:</span>
            <span className="font-medium">{blog.postCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Interval:</span>
            <span className="font-medium">{blog.preferences.checkInterval}m</span>
          </div>
        </div>

        {/* Last Update */}
        {blog.lastChecked && (
          <div className="text-sm text-muted-foreground">
            Last checked: {formatDate(blog.lastChecked)}
          </div>
        )}

        {/* Threat Categories */}
        <div className="flex flex-wrap gap-1">
          {blog.preferences.categories.map((category) => (
            <ThreatCategoryBadge key={category} category={category} />
          ))}
        </div>

        {/* Recent Posts */}
        {blog.recentPosts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Recent Posts</h4>
            <div className="space-y-2">
              {blog.recentPosts.slice(0, 2).map((post) => (
                <div 
                  key={post.id} 
                  className="p-2 bg-muted/50 rounded-lg text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium line-clamp-1">{post.title}</span>
                    <div className="flex items-center gap-1">
                      {post.analyzed && (
                        <Badge variant="success" className="text-xs">
                          Analyzed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground text-xs mt-1">
                    {formatDate(post.publishedAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleMonitoring}
            className="flex-1 min-w-0"
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
              className="flex-1 min-w-0"
            >
              <Zap className="h-3 w-3" />
              Simulate Post
            </Button>
          )}

          <Button variant="ghost" size="sm">
            <Settings className="h-3 w-3" />
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRemoveBlog}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}