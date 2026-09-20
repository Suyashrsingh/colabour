import { useLocation } from "wouter";
import LandingPage, { type LandingSearch } from "@/pages/LandingPage";

export default function LandingPageRoute() {
  const [, setLocation] = useLocation();

  const handleSearch = (search: LandingSearch) => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("sahaay-landing-search", JSON.stringify(search));
      }
    } catch {}
    // Build URL params so marketplace can pre-filter by service & locality
    const params = new URLSearchParams();
    if (search.service) params.set("service", search.service);
    if (search.locality) params.set("locality", search.locality);
    const qs = params.toString();
    setLocation(`/marketplace${qs ? `?${qs}` : ""}`);
  };

  const openAccess = () => setLocation("/app?access=1");

  return (
    <LandingPage
      onSearch={handleSearch}
      onSignIn={() => setLocation("/app?access=1&intent=signin")}
      onCreateAccount={() => setLocation("/app?access=1&intent=signup")}
      onJoinWorker={() => setLocation("/app?access=1&intent=signup&role=Worker")}
      onAdminAccess={() => setLocation("/app?access=1&intent=signin&role=Admin")}
      onViewProfile={(name: string) => setLocation(`/app?viewProfile=${encodeURIComponent(name)}`)}
    />
  );
}
