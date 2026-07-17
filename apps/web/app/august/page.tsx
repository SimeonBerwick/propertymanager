import Image from 'next/image'
import { CampaignLink, CampaignTracker } from '@/components/campaign-tracker'
import { augustCampaignMedium, parseAugustCampaignSource } from '@/lib/campaign-attribution'
import { ConsultationForm } from './consultation-form'

export const metadata = {
  title: '30-Day Assisted Trial | Simeonware',
  description: 'A card-free, 30-day assisted maintenance-management trial for U.S. property managers.',
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

  return (
    <main className="marketingPage augustCampaignPage">
      <CampaignTracker source={source} />
      <section className="marketingHero augustCampaignHero">
        <div className="marketingHeroCopy">
          <div className="eyebrow">Simeonware founding-manager offer</div>
          <h1>30 days to put your maintenance workflow in one place.</h1>
          <p>Try the complete Simeonware maintenance manager with a personal onboarding conversation and help importing supported unit and vendor records.</p>
          <div className="heroActions">
            <CampaignLink className="button primary buttonLarge" href={consultationHref} eventName="campaign_consultation_click" source={source}>Request a 20-minute conversation</CampaignLink>
            <CampaignLink className="button buttonLarge" href={signupHref} eventName="campaign_trial_click" source={source}>Start a self-service trial</CampaignLink>
          </div>
          <div className="trustLine">
            <span>No credit card required</span>
            <span>U.S. property businesses only</span>
            <span>No automatic paid conversion</span>
          </div>
          <p className="muted">Onboarding and import assistance are included only after acceptance into the assisted founding-manager program. The self-service trial does not include those services.</p>
        </div>
        <figure className="campaignProductFigure">
          <Image src="/product-screenshots/vendor-coordination.png" alt="Simeonware maintenance request showing vendor coordination and the next manager action" width={1440} height={1000} priority sizes="(max-width: 980px) 100vw, 48vw" />
          <figcaption>Real Simeonware request detail</figcaption>
        </figure>
      </section>

      <section className="proofStrip" aria-label="Assisted trial benefits">
        <div><strong>One onboarding appointment</strong><span>Review your current maintenance process with a real person.</span></div>
        <div><strong>Personal import assistance</strong><span>We help prepare supported unit and vendor records; you review the imported data.</span></div>
        <div><strong>Complete product access</strong><span>Use manager, tenant, staff, and vendor workflows during the trial.</span></div>
        <div><strong>12-month price protection</strong><span>Founding-manager pricing is locked for 12 months if you subscribe.</span></div>
      </section>

      <section className="marketingSection augustOffer" aria-labelledby="august-offer-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Clear terms</div>
          <h2 id="august-offer-heading">A useful trial, without a billing surprise.</h2>
          <p>The 30 days begin when your Simeonware account is created. The onboarding conversation is scheduled within the first few business days when calendars allow, and does not extend the trial.</p>
        </div>
        <div className="processGrid">
          <article><span>1</span><h3>Talk through the workflow</h3><p>We learn how requests, vendors, approvals, scheduling, and closeout work for your portfolio.</p></article>
          <article><span>2</span><h3>Start with clean records</h3><p>We assist with supported imports. Your company remains responsible for reviewing names, units, vendors, and other imported information.</p></article>
          <article><span>3</span><h3>Decide without pressure</h3><p>No payment method is collected. The trial ends after 30 days unless you separately choose a paid plan.</p></article>
        </div>
        <div className="notice">Assisted places are limited and may be refused when a business is outside the U.S. target market or cannot be supported responsibly. No operational or financial result is guaranteed.</div>
      </section>

      <section className="marketingSection" id="conversation" aria-labelledby="conversation-heading">
        <div className="sectionIntro">
          <div className="eyebrow">20-minute conversation</div>
          <h2 id="conversation-heading">Tell us where maintenance gets stuck.</h2>
          <p>Send a short request here. We will reply by email to arrange a time that works for you.</p>
        </div>
        <div className="card" style={{ maxWidth: 760 }}>
          <ConsultationForm source={source} />
        </div>
      </section>

      <section className="finalCta">
        <div>
          <div className="eyebrow">Campaign code: AUGUSTFOUNDERS</div>
          <h2>Bring one real maintenance workflow.</h2>
          <p>We will show you how it would move through Simeonware, from intake through closeout.</p>
        </div>
        <CampaignLink className="button primary buttonLarge" href={consultationHref} eventName="campaign_consultation_click" source={source}>Request a conversation</CampaignLink>
      </section>
    </main>
  )
}
