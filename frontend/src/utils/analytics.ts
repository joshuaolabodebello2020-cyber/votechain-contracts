type AnalyticsEvent =
 | { name: "proposal_created"; status: string }
 | { name: "vote_submitted"; status: string }
 | { name: "proposal_viewed"; proposalId: string };

const isAnalyticsEnabled = (): boolean => {
 return import.meta.env.VITE_ANALYTICS_ENABLED === "true";
};

export function trackEvent(event: AnalyticsEvent): void {
 if (!isAnalyticsEnabled()) return;
 const payload = { event: event.name, metadata: { ...event }, timestamp: new Date().toISOString() };
 if (import.meta.env.DEV) { console.log("[Analytics]", payload); return; }
 fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
}
