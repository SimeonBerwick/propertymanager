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
          <div className="eyebrow">Maintenance coordination for property teams</div>
          <h1>Property maintenance, without the endless follow-up.</h1>
          <p>
            Give tenants a simple way to report issues, keep vendors moving, and see every request,
            update, approval, and bill in one organized workspace.
          </p>
          <div className="heroActions">
            {androidApp ? (
              <Link href="/signup" className="button primary buttonLarge">Start free month</Link>
            ) : (
              <Link href="/signup" className="button primary buttonLarge">Start your 30-day free trial</Link>
            )}
            <Link href="/#product-preview" className="button buttonLarge">See the product</Link>
          </div>
          {androidApp ? (
            <div className="notice" style={{ maxWidth: 640 }}>Start your free month in the app. For subscription details and plan information, visit simeonware.com in a web browser.</div>
          ) : (
            <div className="trustLine">
              <span>No credit card required</span>
              <span>Built for managers, tenants, and vendors</span>
              <span>Cancel anytime</span>
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
        <div><strong>One clear queue</strong><span>Know what needs action now</span></div>
        <div><strong>Fewer status calls</strong><span>Keep everyone informed automatically</span></div>
        <div><strong>Complete history</strong><span>Keep decisions and costs together</span></div>
        <div><strong>Built-in reporting</strong><span>Spot trends across your portfolio</span></div>
      </section>

      <section className="marketingSection productScreenshots" aria-labelledby="real-product-heading">
        <div className="sectionIntro">
          <div className="eyebrow">The real product</div>
          <h2 id="real-product-heading">See the workflow before you start.</h2>
          <p>These are real Simeonware screens showing how requests move from intake through vendor coordination and reporting.</p>
        </div>
        <div className="productScreenshotGrid">
          <figure className="productScreenshotCard">
            <div className="productScreenshotFrame">
              <Image src="/product-screenshots/request-intake.png" alt="Simeonware tenant maintenance request intake form" width={1440} height={1000} loading="eager" sizes="(max-width: 980px) 100vw, 33vw" />
            </div>
            <figcaption><strong>Request intake</strong><span>Tenants share the issue, details, and photos in one guided form.</span></figcaption>
          </figure>
          <figure className="productScreenshotCard">
            <div className="productScreenshotFrame">
              <Image src="/product-screenshots/vendor-coordination.png" alt="Simeonware request detail showing vendor coordination signals" width={1440} height={1000} loading="eager" sizes="(max-width: 980px) 100vw, 33vw" />
            </div>
            <figcaption><strong>Vendor coordination</strong><span>Review vendor replies, scheduling, updates, and visible notes together.</span></figcaption>
          </figure>
          <figure className="productScreenshotCard">
            <div className="productScreenshotFrame">
              <Image src="/product-screenshots/reporting.png" alt="Simeonware property maintenance performance reports" width={1440} height={1000} loading="eager" sizes="(max-width: 980px) 100vw, 33vw" />
            </div>
            <figcaption><strong>Reporting</strong><span>Track volume, response times, aging, and operational trends.</span></figcaption>
          </figure>
        </div>
      </section>

      <section className="marketingSection" id="features">
        <div className="sectionIntro">
          <div className="eyebrow">Everything in one place</div>
          <h2>Run a calmer maintenance operation.</h2>
          <p>Simeonware replaces scattered emails, texts, and spreadsheets with a workflow everyone can follow.</p>
        </div>
        <div className="featureGrid">
          <article className="featureCard featureCardLarge">
            <span className="featureNumber">01</span>
            <h3>See what needs action now</h3>
            <p>Prioritize urgent, overdue, unclaimed, and follow-up requests from one focused queue.</p>
            <div className="miniQueue">
              <span>New requests <strong>5</strong></span>
              <span>Needs follow-up <strong>3</strong></span>
              <span>Completion review <strong>2</strong></span>
            </div>
          </article>
          <article className="featureCard">
            <span className="featureNumber">02</span>
            <h3>Coordinate vendors clearly</h3>
            <p>Share request details, collect responses, review updates, and track scheduled work.</p>
          </article>
          <article className="featureCard">
            <span className="featureNumber">03</span>
            <h3>Give tenants an easy path</h3>
            <p>Collect complete issue reports and photos without forcing tenants into a complicated process.</p>
          </article>
          <article className="featureCard">
            <span className="featureNumber">04</span>
            <h3>Keep costs connected</h3>
            <p>Track vendor billing, approvals, billbacks, and supporting records alongside the request.</p>
          </article>
          <article className="featureCard">
            <span className="featureNumber">05</span>
            <h3>Report with confidence</h3>
            <p>Review maintenance volume, aging, outcomes, and operational trends across your portfolio.</p>
          </article>
        </div>
      </section>

      <section className="marketingSection processSection" id="how-it-works">
        <div className="sectionIntro">
          <div className="eyebrow">A straightforward workflow</div>
          <h2>From issue reported to work complete.</h2>
        </div>
        <div className="processGrid">
          <article><span>1</span><h3>Capture</h3><p>Tenants submit the issue, details, and photos through a simple request form.</p></article>
          <article><span>2</span><h3>Coordinate</h3><p>Your team reviews the request, assigns vendors, and keeps communication together.</p></article>
          <article><span>3</span><h3>Resolve</h3><p>Track scheduling, completion, approvals, and billing through a clear audit trail.</p></article>
        </div>
      </section>

      <section className="marketingSection">
        <div className="trustPanel">
          <div>
            <div className="eyebrow">Designed for responsible operations</div>
            <h2>Your maintenance records deserve more than a group chat.</h2>
          </div>
          <div className="trustGrid">
            <div><strong>Role-based access</strong><span>Managers, tenants, and vendors see the workflows intended for them.</span></div>
            <div><strong>Private media storage</strong><span>Maintenance photos use authenticated access controls.</span></div>
            <div><strong>Operational history</strong><span>Keep comments, status changes, and decisions attached to each request.</span></div>
            <div><strong>Clear data choices</strong><span>Published privacy, terms, support, and account-deletion processes.</span></div>
          </div>
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
          <h2>Spend less time chasing updates.</h2>
          {androidApp ? (
            <p>Start your free month in the app. For subscription details and plan information, visit simeonware.com in a web browser.</p>
          ) : (
            <p>Start your 30-day free trial and bring your maintenance operation into one organized workspace.</p>
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
