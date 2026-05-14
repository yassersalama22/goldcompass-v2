import { AboutSection } from '@/components/about-section'
import { InvestmentCompass } from '@/components/investment-compass'
import { MarketInsights } from '@/components/market-insights'
import { PriceTrends } from '@/components/price-trends'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

function App() {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <InvestmentCompass />
        <PriceTrends />
        <MarketInsights />
        <AboutSection />
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
