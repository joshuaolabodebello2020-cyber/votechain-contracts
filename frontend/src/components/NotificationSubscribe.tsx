import React, { useState } from "react";

type EventType = "created" | "voting_ended" | "executed";

type Subscription = {
  type: "email" | "webhook";
  target: string;
  events: EventType[];
};

const ALL_EVENTS: { key: EventType; label: string }[] = [
  { key: "created", label: "Proposal created" },
  { key: "voting_ended", label: "Voting ended" },
  { key: "executed", label: "Proposal executed" },
];

const STORAGE_KEY = "vc_notification_subs";

function loadSubs(): Subscription[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSubs(subs: Subscription[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
}

export function NotificationSubscribe() {
  const [subs, setSubs] = useState<Subscription[]>(loadSubs);
  const [type, setType] = useState<"email" | "webhook">("email");
  const [target, setTarget] = useState("");
  const [events, setEvents] = useState<EventType[]>(["created", "voting_ended", "executed"]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggleEvent(key: EventType) {
    setEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]
    );
  }

  function validate(): string | null {
    if (!target.trim()) return "Please enter an email or webhook URL.";
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))
      return "Invalid email address.";
    if (type === "webhook" && !/^https?:\/\/.+/.test(target))
      return "Webhook URL must start with http:// or https://";
    if (events.length === 0) return "Select at least one event.";
    return null;
  }

  function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    const next = [...subs, { type, target: target.trim(), events }];
    saveSubs(next);
    setSubs(next);
    setTarget("");
    setError(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  function unsubscribe(index: number) {
    const next = subs.filter((_, i) => i !== index);
    saveSubs(next);
    setSubs(next);
  }

  return (
    <section aria-labelledby="notif-heading" style={cardStyle}>
      <h2 id="notif-heading" style={{ marginBottom: 12 }}>Notification Subscriptions</h2>

      <form onSubmit={subscribe} noValidate>
        <div style={rowStyle}>
          <label htmlFor="notif-type" style={labelStyle}>Type</label>
          <select
            id="notif-type"
            value={type}
            onChange={(e) => setType(e.target.value as "email" | "webhook")}
            style={inputStyle}
          >
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label htmlFor="notif-target" style={labelStyle}>
            {type === "email" ? "Email address" : "Webhook URL"}
          </label>
          <input
            id="notif-target"
            type={type === "email" ? "email" : "url"}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={type === "email" ? "you@example.com" : "https://example.com/hook"}
            style={inputStyle}
            aria-describedby={error ? "notif-error" : undefined}
          />
        </div>

        <fieldset style={{ border: "none", padding: 0, margin: "8px 0" }}>
          <legend style={labelStyle}>Notify on</legend>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
            {ALL_EVENTS.map(({ key, label }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={events.includes(key)}
                  onChange={() => toggleEvent(key)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p id="notif-error" role="alert" style={{ color: "#ef5350", fontSize: 13, margin: "4px 0" }}>
            {error}
          </p>
        )}
        {success && (
          <p role="status" style={{ color: "#66bb6a", fontSize: 13, margin: "4px 0" }}>
            Subscription saved.
          </p>
        )}

        <button type="submit" style={{ marginTop: 8 }}>Subscribe</button>
      </form>

      {subs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Active subscriptions</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {subs.map((s, i) => (
              <li
                key={i}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 0", borderBottom: "1px solid #333", fontSize: 13,
                }}
              >
                <span>
                  <strong>{s.type}</strong>: {s.target}{" "}
                  <span style={{ color: "#aaa" }}>({s.events.join(", ")})</span>
                </span>
                <button
                  onClick={() => unsubscribe(i)}
                  aria-label={`Unsubscribe ${s.target}`}
                  style={{ fontSize: 12, padding: "2px 8px" }}
                >
                  Unsubscribe
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1e1e1e",
  borderRadius: 8,
  padding: 20,
  border: "1px solid #333",
  color: "#e0e0e0",
  fontFamily: "sans-serif",
};
const rowStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 };
const labelStyle: React.CSSProperties = { fontSize: 13, color: "#aaa" };
const inputStyle: React.CSSProperties = {
  background: "#121212", border: "1px solid #444", borderRadius: 4,
  color: "#e0e0e0", padding: "6px 8px", fontSize: 14,
};
