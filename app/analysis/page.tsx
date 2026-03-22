import { Suspense } from 'react'
import AnalysisLoader from './AnalysisLoader'

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#E2EFDE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '2.5px solid #0A8754', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <AnalysisLoader />
    </Suspense>
  )
}
