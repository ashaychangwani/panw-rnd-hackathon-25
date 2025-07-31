'use client'

import { AnalysisJob } from '@/types/blog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useBlogStore } from '@/store/blog-store'
import { formatDate } from '@/lib/utils'
import { Activity, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export function JobProgress() {
  const { activeJobs, blogs } = useBlogStore()

  if (activeJobs.length === 0) {
    return null
  }

  const getJobBlog = (blogId: string) => {
    return blogs.find(blog => blog.id === blogId)
  }

  const getStatusIcon = (status: AnalysisJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />
      case 'running':
        return <Activity className="h-4 w-4 text-info animate-pulse" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-error" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-text-muted" />
    }
  }

  const getStatusBadge = (status: AnalysisJob['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>
      case 'running':
        return <Badge variant="info">Running</Badge>
      case 'completed':
        return <Badge variant="success">Completed</Badge>
      case 'failed':
        return <Badge variant="error">Failed</Badge>
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Active Analysis Jobs</h3>
          <p className="text-sm text-text-secondary">Real-time threat intelligence processing</p>
        </div>
      </div>
      
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="space-y-4">
            {activeJobs.map((job) => {
              const blog = getJobBlog(job.blogId)
              
              return (
                <div key={job.id} className="border border-border rounded-lg p-4 space-y-3 bg-surface/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <span className="font-medium text-text-primary">
                        {blog?.title || 'Unknown Blog'}
                      </span>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>

                  {/* Progress Bar */}
                  {job.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Analysis Progress</span>
                        <span className="font-medium text-text-primary">{job.progress}%</span>
                      </div>
                      <div className="w-full bg-border rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Started: {formatDate(job.startedAt)}</span>
                    {job.completedAt && (
                      <span>Completed: {formatDate(job.completedAt)}</span>
                    )}
                  </div>

                  {job.error && (
                    <div className="text-sm text-error bg-red-50 border border-red-200 p-3 rounded-lg">
                      <strong>Error:</strong> {job.error}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}