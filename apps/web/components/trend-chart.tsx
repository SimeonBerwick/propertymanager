import type { TrendPoint } from '@/lib/data'

const SERIES = [
  { key: 'created', label: 'Created', color: '#1f6feb' },
  { key: 'firstReviewed', label: 'First reviewed', color: '#9a6700' },
  { key: 'claimed', label: 'Claimed', color: '#6d28d9' },
  { key: 'completed', label: 'Completed', color: '#166534' },
] as const

export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (!points.length) return null

  const max = Math.max(1, ...points.flatMap((point) => SERIES.map((series) => point[series.key])))
  const chartPoints = SERIES.map((series) => ({
    ...series,
    d: points.map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100
      const y = 100 - (point[series.key] / max) * 100
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' '),
  }))

  return (
    <div className="trendChartWrap">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trendChart" aria-label="Workflow trends chart">
        {[0, 25, 50, 75, 100].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="trendGridLine" />)}
        {chartPoints.map((series) => <path key={series.key} d={series.d} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      <div className="trendLegend">
        {SERIES.map((series) => (
          <span key={series.key} className="trendLegendItem">
            <span className="trendLegendSwatch" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
      <div className="trendAxisLabels">
        <span>{points[0]?.day ?? ''}</span>
        <span>{points[points.length - 1]?.day ?? ''}</span>
      </div>
    </div>
  )
}
