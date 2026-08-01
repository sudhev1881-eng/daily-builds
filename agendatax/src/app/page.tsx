import { CalculatorApp } from "@/components/CalculatorApp";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#calculator">
        Skip to calculator
      </a>

      <div className="site-shell">
        <header className="site-header">
          <p className="brand-mark" aria-label="AgendaTax home">
            Agenda<span>Tax</span>
          </p>
          <a className="nav-link" href="#how-it-works">
            How it works
          </a>
        </header>

        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="brand-hero">
              Agenda<em>Tax</em>
            </p>
            <h1 id="hero-heading">Every recurring meeting has a price tag.</h1>
            <p className="hero-support">
              Add the invite list, duration, and cadence. AgendaTax estimates
              the real annual cost so you can defend focus time with numbers.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#calculator">
                Calculate a meeting
              </a>
              <a className="btn btn-secondary" href="#how-it-works">
                See how it works
              </a>
            </div>
          </div>

          <aside className="hero-visual" aria-hidden="true">
            <div className="hero-visual-inner">
              <p className="label">Sample weekly sync</p>
              <p className="big-number">$11.9k</p>
              <div className="meta">
                <span>4 attendees · 45 min</span>
                <span>per year</span>
              </div>
            </div>
          </aside>
        </section>

        <CalculatorApp />

        <section className="features" id="how-it-works" aria-labelledby="features-heading">
          <p className="eyebrow">How it works</p>
          <h2 id="features-heading">Salary-weighted calendar math</h2>
          <div className="feature-grid">
            <article className="feature-item">
              <h3>Local & private</h3>
              <p>
                Scenarios save in your browser. Share links encode data in the
                URL hash — nothing is stored on a server.
              </p>
            </article>
            <article className="feature-item">
              <h3>Severity guidance</h3>
              <p>
                Low, moderate, high, or extreme tax levels come with practical
                recommendations to shorten, async, or cancel.
              </p>
            </article>
            <article className="feature-item">
              <h3>Exportable reports</h3>
              <p>
                Download a Markdown report for docs, RFCs, or the next
                “do we still need this meeting?” thread.
              </p>
            </article>
          </div>
        </section>

        <footer className="site-footer">
          <p>© {new Date().getFullYear()} AgendaTax. MIT Licensed.</p>
          <p>Built for managers, ICs, and anyone drowning in recurring invites.</p>
        </footer>
      </div>
    </>
  );
}
