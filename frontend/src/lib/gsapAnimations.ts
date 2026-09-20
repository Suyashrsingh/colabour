import gsap from "gsap";

/**
 * Checks if the user prefers reduced motion.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Initializes smooth GSAP entrance and parallax animations on the landing page.
 * Returns a cleanup function to revert GSAP contexts when unmounted.
 */
export function initLandingAnimations(container: HTMLElement | null): () => void {
  if (!container || prefersReducedMotion()) return () => {};

  const ctx = gsap.context(() => {
    // 1. Hero Entrance Timeline
    const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

    heroTl.from(".landing-hero-heading", {
      opacity: 0,
      y: 28,
      duration: 0.85,
    });

    heroTl.from(
      ".landing-hero-copy",
      {
        opacity: 0,
        y: 20,
        duration: 0.7,
      },
      "-=0.5"
    );

    heroTl.from(
      ".landing-search-card",
      {
        opacity: 0,
        y: 24,
        duration: 0.75,
      },
      "-=0.4"
    );

    heroTl.from(
      ".landing-trust-strip",
      {
        opacity: 0,
        y: 16,
        duration: 0.6,
      },
      "-=0.3"
    );

    // 2. Subtle Interactive Parallax on Hero Visual Card
    const heroVisual = container.querySelector(".landing-hero-visual") as HTMLElement | null;
    if (heroVisual) {
      const handleMouseMove = (e: MouseEvent) => {
        const { clientX, clientY } = e;
        const xOffset = (clientX / window.innerWidth - 0.5) * 16;
        const yOffset = (clientY / window.innerHeight - 0.5) * 16;

        gsap.to(heroVisual, {
          x: xOffset,
          y: yOffset,
          duration: 0.8,
          ease: "power1.out",
          overwrite: "auto",
        });
      };

      window.addEventListener("mousemove", handleMouseMove, { passive: true });

      // Clean up window event listener
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
      };
    }
  }, container);

  return () => ctx.revert();
}

/**
 * Animates cards and widgets inside dashboards with subtle, crisp staggered reveal.
 */
export function animateDashboardReveal(container: HTMLElement | null): () => void {
  if (!container || prefersReducedMotion()) return () => {};

  const ctx = gsap.context(() => {
    // Animate KPI cards
    const kpis = container.querySelectorAll(".kpi");
    if (kpis.length > 0) {
      gsap.from(kpis, {
        opacity: 0,
        y: 18,
        stagger: 0.06,
        duration: 0.55,
        ease: "power2.out",
        clearProps: "all",
      });
    }

    // Animate main panels
    const panels = container.querySelectorAll(".panel, .society-verification-card, .analytics-card");
    if (panels.length > 0) {
      gsap.from(panels, {
        opacity: 0,
        y: 22,
        stagger: 0.08,
        duration: 0.65,
        ease: "power2.out",
        clearProps: "all",
      });
    }

    // Animate worker cards
    const workerCards = container.querySelectorAll(".worker-card");
    if (workerCards.length > 0) {
      gsap.from(workerCards, {
        opacity: 0,
        y: 16,
        stagger: 0.05,
        duration: 0.5,
        ease: "power2.out",
        clearProps: "all",
      });
    }
  }, container);

  return () => ctx.revert();
}
