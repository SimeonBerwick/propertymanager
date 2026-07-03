import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import { ANDROID_SUBSCRIPTION_MESSAGE, isAndroidWebView } from '@/lib/android-webview'
import { BILLING_PLANS, OFFERED_PLANS, planPriceLabel } from '@/lib/billing-plans'
import { AndroidRuntimeMarker } from './android-runtime-marker'

export default async function HomePage() {
  const androidApp = isAndroidWebView((await headers()).get('user-agent'))
  const plans = OFFERED_PLANS

  return (
    <main className="marketingPage">
      <AndroidRuntimeMarker />
      <section className="marketingHero">
        <div className="marketingHeroCopy">
          <div className="eyebrow">{androidApp ? 'Simeonware Android app' : 'Maintenance manager for working property teams'}</div>
          <h1>{androidApp ? 'Open your maintenance dashboard.' : 'Run maintenance without chasing every update.'}</h1>
          <p>
            {androidApp
              ? 'Sign in as a property manager, tenant, or vendor. New property managers can start a free month in the app.'
              : 'Simeonware gives property managers one place to receive tenant requests, invite vendors, approve bids, track photos and costs, and know the next step on every job.'}
          </p>
          <div className="heroActions">
            {androidApp ? (
              <>
                <Link href="/login" className="button primary buttonLarge">Sign in</Link>
                <Link href="/signup" className="button buttonLarge">Start free month</Link>
              </>
            ) : (
              <Link href="/signup" className="button primary buttonLarge">Start your 30-day free trial</Link>
            )}
          </div>
          {androidApp ? (
            <div className="notice" style={{ maxWidth: 640 }}>Subscription details and plan information are available at simeonware.com in a web browser. Maintenance work happens here in the app.</div>
          ) : (
            <div className="trustLine">
              <span>No credit card required</span>
              <span>Tenant and vendor portals included</span>
              <span>CSV import and export ready</span>
            </div>
          )}
        </div>

        <div className="productWindow" id="product-preview" aria-label="Simeonware product preview">
          <div className="productWindowBar">
            <span className="windowDot" />
            <span className="windowDot" />
            <span className="windowDot" />
            <span className="productWindowTitle">Maintenance queue</span>
          </div>
          <div className="previewBody">
            <div className="previewHeading">
              <div>
                <span className="previewKicker">Today&apos;s queue</span>
                <strong>What needs attention</strong>
              </div>
              <span className="previewButton">New request</span>
            </div>
            <div className="previewMetrics">
              <div><strong>12</strong><span>Open</span></div>
              <div><strong>3</strong><span>Needs follow-up</span></div>
              <div><strong>2</strong><span>Scheduled today</span></div>
            </div>
            <div className="previewList">
              <div className="previewRow">
                <span className="previewStatus urgent">Urgent</span>
                <div><strong>Water leak under kitchen sink</strong><span>Willow Creek - Unit 204</span></div>
                <span>Needs vendor</span>
              </div>
              <div className="previewRow">
                <span className="previewStatus scheduled">Scheduled</span>
                <div><strong>Air conditioner not cooling</strong><span>Park View - Unit 18</span></div>
                <span>Today, 2:00 PM</span>
              </div>
              <div className="previewRow">
                <span className="previewStatus review">Review</span>
                <div><strong>Replace hallway light fixture</strong><span>Oak Terrace - Common area</span></div>
                <span>Vendor complete</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proofStrip" aria-label="Product benefits">
        <div><strong>Know the next step</strong><span>Each request surfaces the manager action to take now</span></div>
        <div><strong>Bid without losing context</strong><span>Invite vendors, compare replies, and approve from the request</span></div>
        <div><strong>Keep records together</strong><span>Photos, notes, approvals, costs, and closeout stay with the job</span></div>
        <div><strong>Move data by CSV</strong><span>Import and export units, vendors, and tickets for your own systems</span></div>
      </section>

      <section className="marketingSection productScreenshots" aria-labelledby="real-product-heading">
        <div className="sectionIntro">
          <div className="eyebrow">The real product</div>
          <h2 id="real-product-heading">See the maintenance workflow before you start.</h2>
          <p>These are real Simeonware screens showing tenant intake, manager decisions, vendor coordination, and reporting in the same product.</p>
        </div>
        <div className="productScreenshotGrid">
          <figure className="productScreenshotCard">
            <div className="productScreenshotFrame">
              <Image src="/product-screenshots/request-intake.png" alt="Simeonware tenant maintenance request intake form" width={1440} height={1000} loading="eager" sizes="(max-width: 980px) 100vw, 33vw" />
            </div>
            <figcaption><strong>Request intake</strong><span>Tenants share the issue, access notes, and photos in one guided form.</span></figcaption>
          </figure>
          <figure className="productScreenshotCard">
            <div className="productScreenshotFrame">
              <Image src="/product-screenshots/vendor-coordination.png" alt="Simeonware request detail showing vendor coordination signals" width={1440} height={1000} loading="eager" sizes="(max-width: 980px) 100vw, 33vw" />
            </div>
            <figcaption><strong>Vendor coordination</strong><span>Invite bids, approve the right vendor, and keep scheduling updates tied to the job.</span></figcaption>
          </figure>
          <figure className="productScreenshotCard">
            <div className="productScreenshotFrame">
              <Image src="/product-screenshots/reporting.png" alt="Simeonware property maintenance performance reports" width={1440} height={1000} loading="eager" sizes="(max-width: 980px) 100vw, 33vw" />
            </div>
            <figcaption><strong>Operational records</strong><span>View request details, aging, costs, CSV exports, and closeout activity.</span></figcaption>
          </figure>
        </div>
      </section>

      <section className="marketingSection" id="features">
        <div className="sectionIntro">
          <div className="eyebrow">All-in-one maintenance manager</div>
          <h2>All-in-one maintenance management, not another rent ledger.</h2>
          <p>Simeonware is built for the maintenance work property managers repeat every day: tenant intake, vendor bids, approvals, photos, billing records, closeout notes, and CSV movement for custom systems.</p>
        </div>
        <div className="featureGrid">
          <article className="featureCard featureCardLarge">
            <span className="featureNumber">01</span>
            <h3>One focused maintenance command center</h3>
            <p>See urgent, overdue, scheduled, completion-review, and payment-open work from one queue built around maintenance operations.</p>
            <div className="miniQueue">
              <span>New requests <strong>5</strong></span>
              <span>Needs follow-up <strong>3</strong></span>
              <span>Completion review <strong>2</strong></span>
            </div>
          </article>
          <article className="featureCard">
            <span className="featureNumber">02</span>
            <h3>Tenant, vendor, and manager portals</h3>
            <p>Tenants report issues, vendors respond from their own view, and managers control what each side can see.</p>
          </article>
          <article className="featureCard">
            <span className="featureNumber">03</span>
            <h3>Vendor bids and approvals</h3>
            <p>Invite vendors to bid, compare price and availability, approve the right option, and keep the decision with the request.</p>
          </article>
          <article className="featureCard">
            <span className="featureNumber">04</span>
            <h3>Costs stay connected to the job</h3>
            <p>Track vendor invoices, approved overages, tenant billbacks, supporting notes, and closeout history beside the work order.</p>
          </article>
          <article className="featureCard">
            <span className="featureNumber">05</span>
            <h3>Private photo and note trail</h3>
            <p>Maintenance photos, tenant-visible notes, and manager-only/vendor notes stay attached to the request with role-based access.</p>
          </article>
          <article className="featureCard">
            <span className="featureNumber">06</span>
            <h3>CSV in and out for custom systems</h3>
            <p>Upload and download units, vendors, and tickets by CSV so your maintenance data can fit into your own reports, spreadsheets, or custom workflows.</p>
          </article>
          <article className="featureCard">
            <span className="featureNumber">07</span>
            <h3>Suggested next step on every request</h3>
            <p>Each ticket shows the recommended next action first so managers know whether to assign, approve, update, bill, or close the work.</p>
          </article>
        </div>
        <p className="featureNote">Payments are intentionally separate from the core maintenance manager. Today, Simeonware tracks approvals, billbacks, vendor payment records, and closeout status; online payment processing is planned as a future add-on.</p>
      </section>

      <section className="marketingSection processSection" id="how-it-works">
        <div className="sectionIntro">
          <div className="eyebrow">A straightforward workflow</div>
          <h2>From tenant request to closed work order.</h2>
        </div>
        <div className="processGrid">
          <article><span>1</span><h3>Capture</h3><p>Tenants submit the issue, access notes, and photos through a simple request form.</p></article>
          <article><span>2</span><h3>Decide</h3><p>Your team sees the recommended next step: assign directly, invite bids, approve, update, bill, or close.</p></article>
          <article><span>3</span><h3>Close</h3><p>Track scheduling, completion, approvals, costs, and closeout through a clear history.</p></article>
        </div>
      </section>


      <section className={`marketingSection webPricingSection ${androidApp ? 'serverHidden' : ''}`} id="pricing" data-web-pricing>
        <div className="sectionIntro">
          <div className="eyebrow">Simple pricing</div>
          <h2>Start free. Choose the capacity that fits.</h2>
          <p>Every plan includes the complete maintenance workflow. Plans differ only by active-unit capacity.</p>
        </div>
        <div className="pricingGrid">
          {plans.map((plan) => (
            <article className={`pricingCard ${plan === 'pro' ? 'pricingCardFeatured' : ''}`} key={plan}>
              {plan === 'pro' ? <span className="popularLabel">Most popular</span> : null}
              <h3>{BILLING_PLANS[plan].name}</h3>
              <div className="price">{planPriceLabel(plan, 'monthly').replace('/month', '')}<span>/month</span></div>
              <p>{BILLING_PLANS[plan].description}</p>
              <ul>
                <li>Complete manager request queue</li>
                <li>Tenant and vendor workflows</li>
                <li>Billing records and reports</li>
                <li>Email notifications and history</li>
              </ul>
              <Link href="/signup" className={`button ${plan === 'pro' ? 'primary' : ''}`}>Start free trial</Link>
            </article>
          ))}
        </div>
        <p className="pricingNote">Annual billing includes a 10% discount. No credit card is required to start your 30-day trial.</p>
      </section>

      <section className={`marketingSection appSubscriptionSection ${androidApp ? 'serverVisible' : ''}`} data-app-subscription>
        <div className="sectionIntro">
          <div className="eyebrow">Subscription</div>
          <h2>Check your subscription online.</h2>
          <p>{ANDROID_SUBSCRIPTION_MESSAGE}</p>
        </div>
        <div className="heroActions">
          <Link href="/signup" className="button primary">Start free month</Link>
          <Link href="/login" className="button">Sign in</Link>
        </div>
      </section>

      <section className="marketingSection">
        <div className="faqLayout">
          <div className="sectionIntro">
            <div className="eyebrow">Frequently asked questions</div>
            <h2>Know what to expect.</h2>
            <p>Have another question? <Link href="/support">Contact support.</Link></p>
          </div>
          <div className="faqList">
            {androidApp ? (
              <>
                <details><summary>Can I start in the app?</summary><p>Yes. Create your property manager account in the app to start your free month.</p></details>
                <details><summary>Do tenants and vendors need their own signup?</summary><p>No. Property managers invite tenants and vendors into the workflows they need.</p></details>
                <details><summary>Where can I see subscription details?</summary><p>Visit simeonware.com in a web browser to review subscription details and plan information.</p></details>
              </>
            ) : (
              <>
                <details><summary>Do tenants and vendors need paid accounts?</summary><p>No. Property managers control the account and invite tenants and vendors into the workflows they need.</p></details>
                <details><summary>Do I need a credit card to try Simeonware?</summary><p>No. You can use the complete product for 30 days before adding a payment method.</p></details>
                <details><summary>What changes between plans?</summary><p>The active-unit capacity. The core maintenance coordination features are included across all plans.</p></details>
                <details><summary>Can I cancel or change plans?</summary><p>Yes. Plans are available month to month, with an optional annual discount.</p></details>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="finalCta">
        <div>
          <div className="eyebrow">A clearer maintenance workflow starts here</div>
          <h2>Start with the maintenance work that slows your team down.</h2>
          {androidApp ? (
            <p>Start your free month in the app. For subscription details and plan information, visit simeonware.com in a web browser.</p>
          ) : (
            <p>Start your 30-day free trial and see tenant requests, vendor bids, approvals, photos, costs, CSV exports, and closeout in one workspace.</p>
          )}
        </div>
        {androidApp ? (
          <Link href="/signup" className="button primary buttonLarge">Start free month</Link>
        ) : (
          <Link href="/signup" className="button primary buttonLarge">Start free trial</Link>
        )}
      </section>
    </main>
  )
}
