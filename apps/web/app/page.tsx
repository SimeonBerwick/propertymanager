import Link from 'next/link'
import type { Route } from 'next'
import { headers } from 'next/headers'
import { isAndroidWebView } from '@/lib/android-webview'
import { PropertyMaintenanceLanding } from './property-maintenance/property-maintenance-landing'

export const metadata = {
  title: 'Simeonware | Software for property maintenance and field service teams',
  description: 'Simeonware builds focused software for working teams: property maintenance coordination today, and a field service assistant for trade companies coming soon.',
}

export default async function HomePage() {
  // The Android app opens this address. It keeps its property maintenance sign-in screen, unchanged.
  if (isAndroidWebView((await headers()).get('user-agent'))) {
    return <PropertyMaintenanceLanding />
  }

  return (
    <main className="marketingPage">
      <section className="marketingHero marketingHeroSingle">
        <div className="marketingHeroCopy">
          <div className="eyebrow">Software for working teams</div>
          <h1>Less admin. More finished work.</h1>
          <p>
            Simeonware builds focused tools for the people who keep buildings and equipment running.
            Each product does a few core jobs well, so your team spends the day on the work, not the paperwork.
          </p>
        </div>
      </section>

      <section className="marketingSection" aria-labelledby="products-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Products</div>
          <h2 id="products-heading">Choose the product for your work.</h2>
        </div>
        <div className="pricingGrid productChoiceGrid">
          <article className="pricingCard">
            <span className="productChoiceStatus">Available now</span>
            <h3>Property maintenance</h3>
            <p>
              For property managers. Receive tenant requests, invite vendors, approve bids, track photos and costs,
              and know the next step on every job.
            </p>
            <ul>
              <li>Tenant, maintenance staff, and vendor portals</li>
              <li>QuickBooks Online compatible</li>
              <li>14-language communication on Growth and Pro</li>
              <li>Android app on Google Play</li>
            </ul>
            <div className="heroActions">
              <Link href={'/property-maintenance' as Route} className="button primary">Explore property maintenance</Link>
              <Link href="/login" className="button">Sign in</Link>
            </div>
          </article>
          <article className="pricingCard">
            <span className="productChoiceStatus productChoiceStatusSoon">Coming soon</span>
            <h3>Service assistant</h3>
            <p>
              For small trade service companies. Schedule the visit, do the work from your phone, get the customer&apos;s
              approval, and send the invoice without the evening paperwork.
            </p>
            <ul>
              <li>Versions for general service, generators, electricians, and HVAC</li>
              <li>Voice notes on the job</li>
              <li>Invoices and payments with no QuickBooks needed</li>
              <li>Built for owners who do the work themselves</li>
            </ul>
            <div className="heroActions">
              <Link href={'/service-assistant' as Route} className="button primary">Explore the service assistant</Link>
            </div>
          </article>
        </div>
      </section>

      <section className="marketingSection" aria-labelledby="founder-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Why Simeonware exists</div>
          <h2 id="founder-heading">Built by someone who ran the work.</h2>
          <p>
            When I managed 250 rental homes, collecting requests wasn&apos;t the hard part. Keeping every job moving,
            tracking approved costs, and catching delays before they became expensive emergencies was.
            Simeonware turns that experience into software that keeps the next step clear.
          </p>
          <p>Questions? <Link href="/support">Contact support.</Link></p>
        </div>
      </section>
    </main>
  )
}
