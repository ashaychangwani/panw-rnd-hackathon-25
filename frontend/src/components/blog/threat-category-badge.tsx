import { ThreatCategory } from '@/types/blog'
import { Badge } from '@/components/ui/badge'

interface ThreatCategoryBadgeProps {
  category: ThreatCategory
}

const categoryConfig: Record<ThreatCategory, { label: string; color: string }> = {
  malware: { label: 'Malware', color: 'bg-red-50 text-red-700 border-red-200' },
  ransomware: { label: 'Ransomware', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  apt: { label: 'APT', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  vulnerability: { label: 'Vulnerability', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  phishing: { label: 'Phishing', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  general: { label: 'General', color: 'bg-slate-50 text-slate-700 border-slate-200' }
}

export function ThreatCategoryBadge({ category }: ThreatCategoryBadgeProps) {
  const config = categoryConfig[category]
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.color} text-xs`}
    >
      {config.label}
    </Badge>
  )
}