import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { api } from "../lib/api";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import ClientReviews from "../components/ClientReviews";
import OurTraders from "../components/OurTraders";
import WeeklyHighestPayout from "../components/WeeklyHighestPayout";
import {
  TrustStats,
  PayoutProofs,
  SuccessStories,
  CompanyDetails,
} from "../components/TrustSection";
import {
  PlatformPreview,
  MonthlyLeaderboard,
  WhyChoose,
} from "../components/HomeSections";
import { HeroFX, Ticker } from "../components/HeroFX";
import { useReveal } from "../lib/useReveal";
import ScrollStatement from "../components/ScrollStatement";
import {
  ArrowRight,
  ShieldCheck,
  Trophy,
  Wallet,
  Target,
  Headphones,
  ChevronDown,
  BookOpen,
} from "lucide-react";

export default function Home() {
  const [blogs, setBlogs] = useState([]);
  const { settings } = useSettings();
  const { user } = useAuth();
  const h = settings.hero;
  const sections = settings.home_sections || {};
  const href = user ? "/challenges" : "/login?next=/challenges";
  const show = (name) => sections[name] !== false;
  const faqs = (settings.faq_groups || []).flatMap((group) => group.items || []).slice(0, 6);
  useEffect(() => {
    api
      .get("/blogs")
      .then((r) => setBlogs(r.data))
      .catch(() => {});
  }, []);
  useReveal([blogs.length]);
  return (
    <div className="funded-home">
      <section className="home-hero">
        <HeroFX />
        <div className="container-xl home-hero-inner">
          <div className="home-eyebrow">
            <span className="home-status-dot" /> {h.chip}
          </div>
          <div className="home-brand-name">IndiFunded</div>
          <h1 className="font-display">
            {h.title_before}
            <br />
            <span>{h.title_highlight}</span> {h.title_after}
          </h1>
          <p className="home-hero-subtitle">{h.subtitle}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <Button asChild size="lg" className="home-primary-cta">
              <Link to="/challenges" data-testid="hero-cta-primary">
                Explore Challenges <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/how-it-works" data-testid="hero-cta-secondary">
                How It Works <BookOpen />
              </Link>
            </Button>
          </div>
          <div className="home-assurances">
            <span>
              <ShieldCheck /> Clear challenge rules
            </span>
            <span>
              <Wallet /> One-time fee
            </span>
            <span>
              <Headphones /> Trader support
            </span>
          </div>
          <div className="home-hero-stats">
            {(h.stats || []).map((stat, i) => (
              <div key={i} data-testid={`hero-stat-${i}`}>
                <strong className="font-display">{stat.k}</strong>
                <span>{stat.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Ticker />
      {show("trust") && (
        <section className="home-band home-stats-band">
          <div className="container-xl">
            <TrustStats stats={settings.trust?.stats} />
          </div>
        </section>
      )}
      {show("payouts") && <OurTraders showEmpty heading="Trader videos & success stories" />}
      {show("steps") && (
        <section data-reveal className="home-band">
          <div className="container-xl">
            <div className="home-section-heading">
              <div>
                <div className="home-eyebrow">How it works</div>
                <h2 className="font-display">
                  {settings.steps.title_prefix}
                  <br />
                  {settings.steps.title_suffix}
                </h2>
                <p>Choose your account. Read the rules. Make your next move.</p>
              </div>
              <Button asChild variant="outline">
                <Link to="/how-it-works">
                  The full journey <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="home-steps">
              {(settings.steps.items || []).map((step, i) => {
                const Icon = [Target, ShieldCheck, Trophy][i] || Target;
                return (
                  <div data-reveal className="home-step" key={i}>
                    <div className="home-step-top">
                      <span>STEP {step.n}</span>
                      <Icon />
                    </div>
                    <h3 className="font-display">{step.t}</h3>
                    <p>{step.d}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
      <PlatformPreview />
      {show("payouts") && (
        <section className="home-band">
          <div className="container-xl">
            <div className="home-section-heading">
              <div>
                <div className="home-eyebrow">Latest payouts</div>
                <h2 className="font-display">Paid, and verifiable</h2>
                <p>Each published payout can be checked with its Payout ID.</p>
              </div>
              <Button asChild variant="outline">
                <Link to="/verify-payout">
                  Verify a payout <ArrowRight />
                </Link>
              </Button>
            </div>
            <PayoutProofs proofs={settings.trust?.payout_proofs} limit={3} />
          </div>
        </section>
      )}
      {show("payouts") && (
        <div className="home-proof-band">
          <WeeklyHighestPayout />
        </div>
      )}
      <MonthlyLeaderboard />
      {show("trust") &&
        (settings.trust?.stories || []).some((x) => x?.enabled !== false && x?.name) && (
          <section className="home-band">
            <div className="container-xl">
              <SuccessStories stories={settings.trust?.stories} limit={3} />
            </div>
          </section>
        )}
      {show("reviews") && <ClientReviews heading="Real Traders. Real Experiences." />}
      {show("benefits") && <WhyChoose />}
      {show("faq") && (
        <section data-reveal className="home-band">
          <div className="container-xl home-faq-layout">
            <div>
              <div className="home-eyebrow">The details matter</div>
              <h2 className="font-display">
                Questions?
                <br />
                Let's clear them up.
              </h2>
              <Button asChild variant="link" className="px-0 mt-4">
                <Link to="/faq">
                  All questions <ArrowRight />
                </Link>
              </Button>
            </div>
            <div>
              {faqs.map((faq, i) => (
                <details className="home-faq" key={i}>
                  <summary>
                    {faq.q}
                    <ChevronDown size={18} />
                  </summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="home-closing">
        <div className="container-xl">
          <div className="home-eyebrow">Your next move</div>
          <h2 className="font-display">
            Start your
            <br />
            <span>IndiFunded</span> challenge.
          </h2>
          <Button asChild size="lg" className="home-primary-cta mt-7">
            <Link to={href}>
              Choose your challenge <ArrowRight />
            </Link>
          </Button>
          <p>Read the rules. Find your plan. Trade with purpose.</p>
        </div>
      </section>
      {show("trust") && (
        <section className="home-band home-company-band" aria-labelledby="company-heading">
          <div className="container-xl">
            <div className="home-section-heading">
              <div>
                <div className="home-eyebrow">Company & transparency</div>
                <h2 id="company-heading" className="font-display">
                  Who you are trading with
                </h2>
              </div>
              <Button asChild variant="outline">
                <Link to="/trust">
                  Trust center <ArrowRight />
                </Link>
              </Button>
            </div>
            <CompanyDetails
              company={settings.trust?.company}
              documents={settings.trust?.documents}
              team={settings.trust?.support_team}
            />
          </div>
        </section>
      )}
    </div>
  );
}
