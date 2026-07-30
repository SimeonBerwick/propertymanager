import Image from 'next/image'
import { CampaignLink, CampaignTracker } from '@/components/campaign-tracker'
import { augustCampaignMedium, parseAugustCampaignSource } from '@/lib/campaign-attribution'
import { ConsultationForm } from './consultation-form'

export const metadata = {
  title: 'Founding Manager Access | Simeonware',
  description: 'Run real maintenance through Simeonware for 30 days with assisted setup, direct founder support, and 12-month founding price protection.',
}

export default async function AugustCampaignPage({
  searchParams,
}: {
  searchParams?: Promise<{ utm_source?: string }>
}) {
  const query = await searchParams
  const source = parseAugustCampaignSource(query?.utm_source) ?? 'direct'
  const medium = augustCampaignMedium(source)
  const signupHref = `/signup?utm_source=${source}&utm_medium=${medium}&utm_campaign=august_founders`
  const consultationHref = '#conversation'
  const demonstrationHref = 'https://youtu.be/lNdIDpyV-dg'

  return (
    <main className="marketingPage augustCampaignPage">
      <CampaignTracker source={source} />
      <section className="marketingHero augustCampaignHero">
        <div className="marketingHeroCopy">
          <div className="eyebrow">Founding Manager Access</div>
          <h1>Property maintenance, beautifully managed.</h1>
          <p>See a complete maintenance workflow in two minutes, then run your own maintenance through Simeonware for 30 days.</p>
          <div className="heroActions">
            <CampaignLink className="button primary buttonLarge" href={demonstrationHref} eventName="campaign_demo_click" source={source}>Watch the two-minute demonstration</CampaignLink>
            <CampaignLink className="button buttonLarge" href={signupHref} eventName="campaign_trial_click" source={source}>Start a 30-day trial</CampaignLink>
            <CampaignLink className="button buttonQuiet buttonLarge" href={consultationHref} eventName="campaign_consultation_click" source={source}>Talk with the founder</CampaignLink>
          </div>
          <div className="trustLine">
            <span>No credit card required</span>
            <span>U.S. property businesses only</span>
            <span>No automatic paid conversion</span>
            <span><a href="https://play.google.com/store/apps/details?id=com.simeonberwick.propertymanager">Android app on Google Play</a></span>
          </div>
          <p className="muted">Founder support is available for managers who want personal onboarding or need to discuss an integration. You can also start independently.</p>
        </div>
        <figure className="campaignHeroVisual">
          <Image src="/campaign/property-maintenance-beautifully-managed.png" alt="Property Maintenance, Beautifully Managed campaign poster" width={1122} height={1402} priority sizes="(max-width: 980px) 100vw, 48vw" />
        </figure>
      </section>

      <section className="proofStrip" aria-label="Founding Manager Access benefits">
        <div><strong>See it work in two minutes</strong><span>Watch one complete maintenance workflow before you commit any time.</span></div>
        <div><strong>Use it with real work</strong><span>Run your own maintenance requests through the complete product for 30 days.</span></div>
        <div><strong>Get help when useful</strong><span>Founding managers can receive assisted setup and direct founder support.</span></div>
        <div><strong>12-month price protection</strong><span>Founding-manager pricing is locked for 12 months if you subscribe.</span></div>
      </section>

      <section className="marketingSection augustOffer" aria-labelledby="august-offer-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Founding Manager Access</div>
          <h2 id="august-offer-heading">Run real maintenance through Simeonware for 30 days.</h2>
          <p>Founding Manager Access combines the complete product with assisted setup, direct founder support, and founding pricing protected for 12 months.</p>
        </div>
        <div className="processGrid">
          <article><span>1</span><h3>See the whole workflow</h3><p>Watch requests move from tenant intake through manager decisions, vendor coordination, and closeout.</p></article>
          <article><span>2</span><h3>Start with your portfolio</h3><p>Use real work during the trial. Accepted founding managers can receive help preparing supported unit and vendor imports.</p></article>
          <article><span>3</span><h3>Keep control</h3><p>No payment method is collected. The trial ends after 30 days unless you separately choose a paid plan.</p></article>
        </div>
        <div className="notice">The trial begins when your account is created. Assisted places are limited and may be refused when a business is outside the U.S. target market or cannot be supported responsibly. Imported information remains subject to your review. No operational or financial result is guaranteed.</div>
      </section>

      <section className="marketingSection campaignOutcomeSection" aria-labelledby="campaign-outcomes-heading">
        <div className="sectionIntro">
          <div className="eyebrow">A calmer maintenance operation</div>
          <h2 id="campaign-outcomes-heading">Clear coordination. Better-kept properties.</h2>
          <p>Managers, residents, staff, and vendors can see the information they need without losing the history of the job.</p>
        </div>
        <div className="campaignVisualGrid">
          <figure>
            <Image src="/campaign/everyone-knows-what-happens-next.png" alt="A property manager and maintenance professional coordinating the next step" width={1122} height={1402} sizes="(max-width: 760px) 100vw, 50vw" />
          </figure>
          <figure>
            <Image src="/campaign/great-properties-great-maintenance.png" alt="A well-maintained residential community supported by clear maintenance coordination" width={1122} height={1402} sizes="(max-width: 760px) 100vw, 50vw" />
          </figure>
        </div>
      </section>

      <section className="marketingSection" id="conversation" aria-labelledby="conversation-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Optional founder support</div>
          <h2 id="conversation-heading">Want help fitting Simeonware to your workflow?</h2>
          <p>Ask for a conversation when you want personal onboarding or have integration questions. You do not need a call to begin the trial.</p>
        </div>
        <div className="card" style={{ maxWidth: 760 }}>
          <ConsultationForm source={source} />
        </div>
      </section>

      <section className="finalCta">
        <div>
          <div className="eyebrow">Campaign code: AUGUSTFOUNDERS</div>
          <h2>Property maintenance, beautifully managed.</h2>
          <p>Watch the complete workflow in two minutes or start working with Simeonware today.</p>
        </div>
        <div className="heroActions">
          <CampaignLink className="button primary buttonLarge" href={signupHref} eventName="campaign_trial_click" source={source}>Start a 30-day trial</CampaignLink>
          <CampaignLink className="button buttonLarge" href={demonstrationHref} eventName="campaign_demo_click" source={source}>Watch the demonstration</CampaignLink>
        </div>
      </section>
    </main>
  )
}
