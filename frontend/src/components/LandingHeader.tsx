import { useState, useEffect } from "react";
import { Menu, X, ArrowRight, BriefcaseBusiness, ShieldCheck, Users, Building2, Store } from "lucide-react";
import { BrandLockup } from "@/components/BrandMark";

export type LandingHeaderProps = {
  currentPath?: "landing" | "marketplace";
  onSignIn?: () => void;
  onCreateAccount?: () => void;
};

export default function LandingHeader({
  currentPath = "landing",
  onSignIn,
  onCreateAccount,
}: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 960 && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [menuOpen]);

  // Close menu on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLinkClick = () => {
    setMenuOpen(false);
  };

  const isLanding = currentPath === "landing";

  return (
    <>
      <header className="landing-header">
        <a href="/" className="landing-brand" aria-label="Co-Labour home" onClick={handleLinkClick}>
          <BrandLockup />
        </a>

        {/* Desktop Navigation */}
        <nav className="landing-nav" aria-label="Main navigation">
          <a href={isLanding ? "#services" : "/#services"} onClick={handleLinkClick}>
            Find a service
          </a>
          <a href="/marketplace" onClick={handleLinkClick} style={{ color: !isLanding ? "var(--forest)" : undefined, fontWeight: !isLanding ? 700 : undefined }}>
            Marketplace
          </a>
          <a href={isLanding ? "#how-it-works" : "/#how-it-works"} onClick={handleLinkClick}>
            How it works
          </a>
          <a href={isLanding ? "#workers" : "/#workers"} onClick={handleLinkClick}>
            For workers
          </a>
          <a href={isLanding ? "#cooperatives" : "/#cooperatives"} onClick={handleLinkClick}>
            For cooperatives
          </a>
        </nav>

        {/* Right side actions */}
        <div className="landing-header-actions">
          <button
            type="button"
            className="landing-text-button"
            onClick={() => {
              handleLinkClick();
              onSignIn?.();
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className="landing-button landing-button--small"
            onClick={() => {
              handleLinkClick();
              onCreateAccount?.();
            }}
          >
            Create account <ArrowRight size={14} />
          </button>

          {/* Hamburger button (visible on mobile / tablet <= 960px) */}
          <button
            type="button"
            className="landing-menu-button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer / Backdrop */}
      {menuOpen && (
        <div
          className="landing-mobile-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        >
          <div
            className="landing-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div className="landing-mobile-drawer-header">
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--forest)" }}>
                Cooperative Navigation
              </span>
              <button
                type="button"
                className="landing-mobile-close-btn"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="landing-mobile-links">
              <a href={isLanding ? "#services" : "/#services"} onClick={handleLinkClick} className="landing-mobile-link">
                <BriefcaseBusiness size={17} style={{ color: "var(--forest)" }} />
                <span>Find a service</span>
              </a>
              <a href="/marketplace" onClick={handleLinkClick} className="landing-mobile-link">
                <Store size={17} style={{ color: "var(--forest)" }} />
                <span style={{ fontWeight: !isLanding ? 700 : 500 }}>Marketplace</span>
              </a>
              <a href={isLanding ? "#how-it-works" : "/#how-it-works"} onClick={handleLinkClick} className="landing-mobile-link">
                <ShieldCheck size={17} style={{ color: "var(--forest)" }} />
                <span>How it works</span>
              </a>
              <a href={isLanding ? "#workers" : "/#workers"} onClick={handleLinkClick} className="landing-mobile-link">
                <Users size={17} style={{ color: "var(--forest)" }} />
                <span>For workers</span>
              </a>
              <a href={isLanding ? "#cooperatives" : "/#cooperatives"} onClick={handleLinkClick} className="landing-mobile-link">
                <Building2 size={17} style={{ color: "var(--forest)" }} />
                <span>For cooperatives</span>
              </a>
            </div>

            <div className="landing-mobile-drawer-actions">
              <button
                type="button"
                className="landing-mobile-signin-btn"
                onClick={() => {
                  handleLinkClick();
                  onSignIn?.();
                }}
              >
                Sign in to your account
              </button>
              <button
                type="button"
                className="landing-button landing-button--small"
                style={{ width: "100%", justifyContent: "center", padding: "12px 18px", fontSize: 13 }}
                onClick={() => {
                  handleLinkClick();
                  onCreateAccount?.();
                }}
              >
                Create new account <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
