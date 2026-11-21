import Link from 'next/link'

export const metadata = {
  title: 'Simeonware | Service Assistant for trade service companies',
  description: 'Coming soon: schedule visits, do the work from your phone, get customer approval, invoice, and record payment. Versions for general service, generators, electricians, and HVAC. No QuickBooks needed.',
}

// Pre-launch page. Wording rules (Assistant pricing record, November 21, 2026): the $99 price always carries
// "for the first 12 months", and the receptionist is described as planned, never as available, until its
// legal and cost checks are complete.
const EARLY_ACCESS_HREF = 'mailto:founder@simeonware.com?subject=Service%20assistant%20early%20access'

export default function ServiceAssistantPage() {
  return (
    <main className="marketingPage">
      <section className="marketingHero marketingHeroSingle">
        <div className="marketingHeroCopy">
          <div className="eyebrow">Coming soon for small trade service companies</div>
          <h1>Your service day, handled.</h1>
          <p>
            Schedule the visit, do the work from your phone, get the customer&apos;s approval, and send the invoice.
            The Simeonware Service Assistant keeps every job moving so the paperwork is done when the work is done.
          </p>
          <div className="heroActions">
            <a href={EARLY_ACCESS_HREF} className="button primary buttonLarge">Get early access</a>
            <a href="#founding-price" className="button buttonLarge">See the founding price</a>
          </div>
          <div className="trustLine">
            <span>Versions for general service, generators, electricians, and HVAC</span>
            <span>No QuickBooks needed</span>
            <span>Built for owners who do the work</span>
          </div>
        </div>
      </section>

      <section className="proofStrip" aria-label="What the service assistant does">
        <div><strong>Schedule and dispatch</strong><span>Book the visit with a time and send it to the technician, or to yourself, in one step</span></div>
        <div><strong>Do the visit on your phone</strong><span>Trade checks, readings, photos, parts, and voice notes stay with the job</span></div>
        <div><strong>Approve and invoice</strong><span>Customer approval, then an invoice with clear numbers. Mistakes can be corrected, not hidden</span></div>
        <div><strong>Record the payment</strong><span>Cash, check, or your own card terminal, with balances kept for you</span></div>
      </section>

      <section className="marketingSection" aria-labelledby="owner-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Built for the way small companies work</div>
          <h2 id="owner-heading">Whether you work alone or have an office.</h2>
          <p>
            If you run the company and do the work yourself, you can schedule, finish, and accept your own jobs without
            anyone else signing off. When someone helps in the office, they can review visits and handle customer
            approvals, and the same login can do office and field work.
          </p>
        </div>
      </section>

      <section className="marketingSection" aria-labelledby="trades-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Four trade versions at launch</div>
          <h2 id="trades-heading">Made for your trade, not a generic form.</h2>
          <p>Choose one trade or several. Each work order keeps its own trade, so a company doing generator and electrical work gets the right steps on every job.</p>
        </div>
        <div className="pricingGrid productChoiceGrid">
          <article className="pricingCard">
            <h3>General service</h3>
            <p>Service calls, repairs, and maintenance visits with the checks and records every job needs.</p>
          </article>
          <article className="pricingCard">
            <h3>Generator and electromechanical</h3>
            <p>Inspection, maintenance, and repair of standby generators, motors, and drives, with suggested checks and readings such as run hours, battery condition, and transfer switch tests.</p>
          </article>
          <article className="pricingCard">
            <h3>Electrician</h3>
            <p>Suggested service checks and readings for electrical work, plus visit types for service and panel upgrades.</p>
          </article>
          <article className="pricingCard">
            <h3>HVAC</h3>
            <p>Suggested checks and readings for heating and cooling work, plus maintenance and tune-up visits.</p>
          </article>
        </div>
      </section>

      <section className="marketingSection" aria-labelledby="receptionist-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Planned for launch</div>
          <h2 id="receptionist-heading">An AI receptionist for the calls you miss.</h2>
          <p>
            We plan to include an AI receptionist that answers after-hours, weekend, and overflow calls, so a customer
            calling while you&apos;re on a ladder still gets an answer. It will answer US and Canadian phone numbers only.
            Final details will be confirmed before launch.
          </p>
        </div>
      </section>

      <section className="marketingSection" id="founding-price" aria-labelledby="price-heading">
        <div className="sectionIntro">
          <div className="eyebrow">Planned founding price</div>
          <h2 id="price-heading">One plan for small teams.</h2>
        </div>
        <div className="pricingGrid productChoiceGrid">
          <article className="pricingCard pricingCardFeatured">
            <h3>Essentials</h3>
            <div className="price">$99<span>/month</span></div>
            <p><strong>$99 a month for the first 12 months</strong>, then the then-current price, with advance notice before any change.</p>
            <ul>
              <li>Up to 5 users</li>
              <li>General service, generator, electrician, and HVAC versions</li>
              <li>Scheduling, visits, approvals, invoices, and payments</li>
              <li>100 AI receptionist minutes a month, once the receptionist is live</li>
            </ul>
            <a href={EARLY_ACCESS_HREF} className="button primary">Get early access</a>
          </article>
          <article className="pricingCard">
            <h3>More receptionist minutes</h3>
            <div className="price">+$50<span>/month</span></div>
            <p>An optional add-on that raises the receptionist allowance to 300 minutes a month in total.</p>
            <p className="muted">Most small companies are expected to need about 50 minutes a month.</p>
          </article>
        </div>
        <p className="pricingNote">Pricing is planned and may change before launch. Nothing is charged before launch, and the terms at signup will show exactly what you pay.</p>
      </section>

      <section className="marketingSection">
        <div className="faqLayout">
          <div className="sectionIntro">
            <div className="eyebrow">Frequently asked questions</div>
            <h2>Know what to expect.</h2>
            <p>Have another question? <Link href="/support">Contact support.</Link></p>
          </div>
          <div className="faqList">
            <details><summary>When does it launch?</summary><p>We&apos;re finishing the launch checks now. Ask for early access and we&apos;ll email you when it&apos;s ready.</p></details>
            <details><summary>Do I need QuickBooks?</summary><p>No. The service assistant keeps your invoices, payments, and balances itself.</p></details>
            <details><summary>Is this the same as Simeonware property maintenance?</summary><p>No. Property maintenance is for property managers coordinating tenants and vendors. The service assistant is for trade companies doing the work themselves.</p></details>
            <details><summary>What does early access mean?</summary><p>You&apos;ll hear first when the service assistant opens, and you can tell us about your trade and how your day works. There&apos;s no charge and no commitment.</p></details>
          </div>
        </div>
      </section>

      <section className="finalCta">
        <div>
          <div className="eyebrow">Be first in line</div>
          <h2>Spend the day on the work, not the paperwork.</h2>
          <p>Tell us your trade and we&apos;ll let you know as soon as the service assistant opens.</p>
        </div>
        <a href={EARLY_ACCESS_HREF} className="button primary buttonLarge">Get early access</a>
      </section>
    </main>
  )
}
