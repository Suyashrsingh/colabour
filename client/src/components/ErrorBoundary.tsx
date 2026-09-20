/* Style reminder: Preserve Warm Editorial Service Atlas. Error fallback must feel calm and trustworthy, not alarming. */
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ivory)", fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif", padding: "40px 20px" }}>
          <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--danger-soft)", display: "grid", placeItems: "center", margin: "0 auto 22px", color: "var(--danger)" }}>
              <AlertTriangle size={26} />
            </div>
            <p style={{ fontSize: 10, letterSpacing: ".14em", color: "var(--muted-foreground)", marginBottom: 10, textTransform: "uppercase" }}>SYSTEM / UNEXPECTED ERROR</p>
            <h1 style={{ font: "600 30px/1 'Space Grotesk', ui-sans-serif", letterSpacing: "-.06em", margin: "0 0 10px", color: "var(--ink)" }}>Something went wrong.</h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6, margin: "0 0 26px" }}>
              The cooperative interface ran into an unexpected problem. Your session data is safe. Try reloading the page to restore the workspace.
            </p>
            {this.state.error && (
              <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 11, padding: "13px 16px", marginBottom: 22, textAlign: "left", overflow: "auto", maxHeight: 160 }}>
                <pre style={{ margin: 0, fontSize: 10, color: "var(--muted-foreground)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {this.state.error.message}
                </pre>
              </div>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{ border: 0, borderRadius: 999, padding: "12px 20px", background: "var(--forest)", color: "var(--paper)", font: "600 12px 'IBM Plex Sans', ui-sans-serif", display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer", marginRight: 10 }}
            >
              <RotateCcw size={15} /> Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "12px 20px", background: "var(--paper)", color: "var(--ink)", font: "600 12px 'IBM Plex Sans', ui-sans-serif", display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer" }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
