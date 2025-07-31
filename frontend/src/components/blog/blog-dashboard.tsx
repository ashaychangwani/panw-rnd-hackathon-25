'use client'

import { useBlogStore } from '@/store/blog-store'
import { BlogCard } from './blog-card'
import { AddBlogForm } from './add-blog-form'
import { JobProgress } from './job-progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Globe, 
  Activity, 
  Clock, 
  TrendingUp,
  AlertTriangle 
} from 'lucide-react'

export function BlogDashboard() {
  const { blogs, activeJobs } = useBlogStore()

  const activeBlogs = blogs.filter(blog => blog.preferences.enabled && blog.status === 'active')
  const totalPosts = blogs.reduce((sum, blog) => sum + blog.postCount, 0)
  const recentPosts = blogs.flatMap(blog => blog.recentPosts).length
  const unanalyzedPosts = blogs.flatMap(blog => 
    blog.recentPosts.filter(post => !post.analyzed)
  ).length

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Blog Analyzer</h1>
          <p className="text-muted-foreground mt-1">
            Monitor security blogs and automatically analyze threat intelligence
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          Demo Mode
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Active Blogs</span>
            </div>
            <div className="text-2xl font-bold mt-1">{activeBlogs.length}</div>
            <div className="text-xs text-muted-foreground">
              {blogs.length} total blogs
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Total Posts</span>
            </div>
            <div className="text-2xl font-bold mt-1">{totalPosts.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              {recentPosts} recent posts
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Active Jobs</span>
            </div>
            <div className="text-2xl font-bold mt-1">{activeJobs.length}</div>
            <div className="text-xs text-muted-foreground">
              Analysis in progress
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Pending Analysis</span>
            </div>
            <div className="text-2xl font-bold mt-1">{unanalyzedPosts}</div>
            <div className="text-xs text-muted-foreground">
              Awaiting analysis
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs */}
      <JobProgress />

      {/* Blog Management Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Blog Management</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Add Blog Form */}
          <AddBlogForm />
          
          {/* Existing Blogs */}
          {blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} />
          ))}
        </div>
      </div>

      {/* Demo Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Demo Mode Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <div className="space-y-2 text-sm">
            <p>
              • <strong>Demo Blogs:</strong> Pre-configured security blogs are loaded with threat categories
            </p>
            <p>
              • <strong>Simulate Posts:</strong> Click "Simulate Post" to trigger the analysis workflow
            </p>
            <p>
              • <strong>Real-time Analysis:</strong> Watch jobs progress through IoC extraction and plan generation
            </p>
            <p>
              • <strong>Blog Management:</strong> Add, pause, or configure monitoring preferences
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}