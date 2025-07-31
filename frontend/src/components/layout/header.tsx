'use client'

import { Shield, Settings, User, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function Header() {
  return (
    <header className="h-16 bg-white border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Threat Hunting Command Center</h1>
            <p className="text-sm text-text-muted">Orchestration Platform</p>
          </div>
        </div>

        {/* Center - Navigation Breadcrumbs */}
        <nav className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-text-primary font-medium">Command Center</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-muted">Campaign Orchestration</span>
        </nav>

        {/* Right - Demo Mode and Profile */}
        <div className="flex items-center gap-4">
          {/* Demo Mode Badge */}
          <Badge 
            variant="outline" 
            className="bg-blue-50 text-blue-700 border-blue-200 font-medium"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Demo Mode
          </Badge>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            <button 
              className="p-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button 
              className="flex items-center gap-2 p-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
              aria-label="User profile"
            >
              <User className="h-5 w-5" />
              <span className="hidden sm:block text-sm font-medium">Security Analyst</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}