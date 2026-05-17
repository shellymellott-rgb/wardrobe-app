import { useState } from "react";
import { T } from "../theme.js";

const ML = { fontFamily: T.mono, letterSpacing: ".18em", textTransform: "uppercase", fontSize: 10 };

export default function TripsView({
  trips, activeTrip, setActiveTrip,
  tripMessages, tripInput, setTripInput,
  tripLoading, tripEndRef,
  showNewTripForm, setShowNewTripForm,
  createTrip, openTrip, deleteTrip, sendTripMessage,
  journalPrefill, onPrefillConsumed,
}) {
  const [form, setForm] = useState({ name: "", destination: "", startDate: "", endDate: "", itinerary: "", weatherNotes: "" });

  if (activeTrip) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.rule}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={() => setActiveTrip(null)} style={{ background: "none", border: "none", color: T.ink3, cursor: "pointer", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase" }}>← TRIPS</button>
          <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink }}>{activeTrip.name}</div>
          {activeTrip.destination && <div style={{ ...ML, color: T.ink3 }}>{activeTrip.destination}</div>}
          {activeTrip.start_date && <div style={{ ...ML, color: T.ink3 }}>{activeTrip.start_date}{activeTrip.end_date ? ` – ${activeTrip.end_date}` : ""}</div>}
        </div>

        {/* Trip context pills */}
        {(activeTrip.itinerary || activeTrip.weather_notes) && (
          <div style={{ padding: "8px 24px", borderBottom: `1px solid ${T.rule}`, background: T.paper, flexShrink: 0 }}>
            {activeTrip.itinerary && <div style={{ fontSize: 11, color: T.ink3, marginBottom: 4 }}><span style={{ ...ML, color: T.ink2 }}>ITINERARY: </span>{activeTrip.itinerary.slice(0, 120)}{activeTrip.itinerary.length > 120 ? "…" : ""}</div>}
            {activeTrip.weather_notes && <div style={{ fontSize: 11, color: T.ink3 }}><span style={{ ...ML, color: T.ink2 }}>WEATHER: </span>{activeTrip.weather_notes}</div>}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {tripMessages.length === 0 && (
            <div style={{ textAlign: "center", color: T.ink3, fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", marginTop: 40 }}>
              START PLANNING — ASK ABOUT OUTFITS FOR EACH DAY
            </div>
          )}
          {tripMessages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: msg.role === "user" ? T.paper : T.inkSurface, color: msg.role === "user" ? T.ink : "#c8c0b0", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {msg.content}
              </div>
            </div>
          ))}
          {tripLoading && <div style={{ color: T.ink3, fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em" }}>THINKING…</div>}
          <div ref={tripEndRef} />
        </div>

        {/* Input */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${T.rule}`, padding: "12px 16px", display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={tripInput}
            onChange={e => setTripInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTripMessage(tripInput); } }}
            placeholder="Ask about outfits for each day…"
            style={{ flex: 1, background: "transparent", border: `1px solid ${T.rule}`, borderRadius: 3, padding: "10px 14px", fontSize: 13, color: T.ink, fontFamily: "inherit", outline: "none" }}
          />
          <button onClick={() => sendTripMessage(tripInput)} disabled={tripLoading || !tripInput.trim()} style={{ background: T.cobalt, border: "none", borderRadius: 3, padding: "10px 16px", color: "#fff", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>SEND</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ ...ML, color: T.ink3, fontSize: 12 }}>TRIPS</div>
        <button onClick={() => setShowNewTripForm(true)} style={{ background: T.cobalt, border: "none", borderRadius: 3, padding: "8px 16px", color: "#fff", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>+ NEW TRIP</button>
      </div>

      {showNewTripForm && (
        <div style={{ background: T.wash, border: `1px solid ${T.rule}`, borderRadius: 4, padding: 20, marginBottom: 24 }}>
          <div style={{ ...ML, marginBottom: 16, color: T.ink2 }}>NEW TRIP</div>
          {[
            { key: "name", label: "TRIP NAME *", placeholder: "Portugal 2026" },
            { key: "destination", label: "DESTINATION", placeholder: "Lisbon, Porto" },
            { key: "startDate", label: "START DATE", placeholder: "2026-05-19", type: "date" },
            { key: "endDate", label: "END DATE", placeholder: "2026-05-25", type: "date" },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ ...ML, fontSize: 9, marginBottom: 4, color: T.ink3 }}>{label}</div>
              <input
                type={type || "text"}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: "100%", background: "transparent", border: `1px solid ${T.rule}`, borderRadius: 3, padding: "8px 12px", fontSize: 13, color: T.ink, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <div style={{ ...ML, fontSize: 9, marginBottom: 4, color: T.ink3 }}>ITINERARY (paste your day-by-day plan)</div>
            <textarea
              value={form.itinerary}
              onChange={e => setForm(f => ({ ...f, itinerary: e.target.value }))}
              placeholder={"Day 1 - Porto arrival, easy lunch, light wandering\nDay 2 - Clérigos Tower, Livraria Lello, cobblestones\n..."}
              style={{ width: "100%", background: "transparent", border: `1px solid ${T.rule}`, borderRadius: 3, padding: "8px 12px", fontSize: 13, color: T.ink, fontFamily: "inherit", outline: "none", minHeight: 120, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...ML, fontSize: 9, marginBottom: 4, color: T.ink3 }}>WEATHER NOTES</div>
            <input
              value={form.weatherNotes}
              onChange={e => setForm(f => ({ ...f, weatherNotes: e.target.value }))}
              placeholder="High 70s, some rain expected, cobblestones"
              style={{ width: "100%", background: "transparent", border: `1px solid ${T.rule}`, borderRadius: 3, padding: "8px 12px", fontSize: 13, color: T.ink, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { if (form.name.trim()) createTrip(form); }} disabled={!form.name.trim()} style={{ flex: 1, background: T.cobalt, border: "none", borderRadius: 3, padding: "10px", color: "#fff", fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: form.name.trim() ? "pointer" : "not-allowed", opacity: form.name.trim() ? 1 : 0.4 }}>CREATE TRIP</button>
            <button onClick={() => setShowNewTripForm(false)} style={{ background: "transparent", border: `1px solid ${T.rule}`, borderRadius: 3, padding: "10px 16px", color: T.ink3, fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", cursor: "pointer" }}>CANCEL</button>
          </div>
        </div>
      )}

      {trips.length === 0 && !showNewTripForm && (
        <div style={{ textAlign: "center", color: T.ink3, fontFamily: T.mono, fontSize: 10, letterSpacing: ".18em", marginTop: 60 }}>
          NO TRIPS YET — CREATE YOUR FIRST TRIP TO START PLANNING OUTFITS
        </div>
      )}

      {trips.map(trip => (
        <div key={trip.id} onClick={() => openTrip(trip)} style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 16, marginBottom: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginBottom: 4 }}>{trip.name}</div>
            <div style={{ display: "flex", gap: 12 }}>
              {trip.destination && <div style={{ ...ML, color: T.ink3 }}>{trip.destination}</div>}
              {trip.start_date && <div style={{ ...ML, color: T.ink3 }}>{trip.start_date}{trip.end_date ? ` – ${trip.end_date}` : ""}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ ...ML, color: T.ink3 }}>→</div>
            <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${trip.name}"?`)) deleteTrip(trip.id); }} style={{ background: "none", border: "none", color: T.ink3, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
