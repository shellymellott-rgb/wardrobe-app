import { useState, useEffect, useRef } from "react";
import { sbLoadTrips, sbSaveTrip, sbDeleteTrip, sbLoadTripMessages } from "../supabase.js";
import { buildChatSystem, buildContextHistory } from "../utils/wardrobeContext.js";
import { useChatSessions } from "./useChatSessions.js";

function parseJsonArray(text) {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

async function readClaudeResponse(res, label) {
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    console.error(`[${label}] Claude API returned non-JSON:`, raw || `HTTP ${res.status}`);
    throw new Error(raw || `HTTP ${res.status}`);
  }
  if (!res.ok || data.error) {
    const message = typeof data.error === "object" ? data.error?.message : data.error;
    console.error(`[${label}] Claude API failed:`, message || `HTTP ${res.status}`);
    throw new Error(message || `HTTP ${res.status}`);
  }
  return data.content?.[0]?.text || "";
}

async function postClaudeWithRetry({ label, messages, system, fallbackSystem, maxTokens = 1000 }) {
  const send = async (systemText) => {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system: systemText, messages }),
    });
    return readClaudeResponse(res, label);
  };

  try {
    return await send(system);
  } catch (e) {
    const message = String(e.message || "");
    const shouldRetry = fallbackSystem && /too large|prompt|tokens|context|request|body|timeout|timed out|internal server error|413|400|500|504|529|overloaded/i.test(message);
    if (!shouldRetry) throw e;
    console.warn(`[${label}] retrying with smaller closet context after:`, message);
    return send(fallbackSystem);
  }
}

export function useTrips({ user, items, buildStyleSystem, weather, season, journalEntries }) {
  const { createSession, saveMessage } = useChatSessions();
  const [trips, setTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripMessages, setTripMessages] = useState([]);
  const [tripInput, setTripInput] = useState("");
  const [tripLoading, setTripLoading] = useState(false);
  const [showNewTripForm, setShowNewTripForm] = useState(false);
  const [planCards, setPlanCards] = useState([]);
  const tripEndRef = useRef(null);

  function detectPlan(text) {
    const multiDay = [/## /g, /\bDAY\b/gi, /\bMay\s+\d/g, /\bJune\s+\d/g, /\bJuly\s+\d/g, /\bAugust\s+\d/g];
    const multiDayCount = multiDay.reduce((acc, p) => acc + (text.match(p)?.length || 0), 0);
    if (multiDayCount >= 3) return true;
    const outfitLabels = [/\*{0,2}Top:\*{0,2}/i, /\*{0,2}Bottom:\*{0,2}/i, /\*{0,2}Pants:\*{0,2}/i, /\*{0,2}Shoes:\*{0,2}/i, /\*{0,2}Dress:\*{0,2}/i, /\*{0,2}Accessories:\*{0,2}/i];
    const outfitCount = outfitLabels.reduce((acc, p) => acc + (p.test(text) ? 1 : 0), 0);
    return outfitCount >= 2;
  }

  async function extractPlan(reply) {
    try {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 800,
          system: "You extract structured outfit plans from conversations. Return ONLY a JSON array, no markdown, no explanation.",
          messages: [{ role: "user", content: `Extract outfit(s) from this text. Return a JSON array where each entry is: { "date": "YYYY-MM-DD", "label": "brief occasion label", "itemNames": ["exact item names"] }. For single outfits use tomorrow's date: ${tomorrowStr}. For multi-day plans, infer dates from the trip context if dates are mentioned. Return []  if nothing clear.\n\nText:\n${reply}` }],
        }),
      });
      const text = await readClaudeResponse(res, "trip-extract-plan");
      const parsed = parseJsonArray(text);
      if (!parsed?.length) return;
      const cards = parsed.map(entry => {
        const itemIds = (entry.itemNames || []).map(name => {
          const lc = name.toLowerCase();
          const exact = items.find(i => i.name.toLowerCase() === lc);
          const contains = items.find(i => i.name.toLowerCase().includes(lc));
          const match = exact || contains;
          return match ? String(match.id) : null;
        }).filter(Boolean);
        return { date: entry.date, label: entry.label || "", itemIds, itemNames: entry.itemNames || [] };
      }).filter(c => c.date && c.itemIds.length > 0);
      if (cards.length) setPlanCards(prev => [...prev, ...cards]);
    } catch (e) { console.error("[trip extractPlan] failed:", e.message); }
  }

  useEffect(() => {
    if (user?.id) loadTrips();
  }, [user?.id]);

  useEffect(() => {
    tripEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tripMessages]);

  async function loadTrips() {
    const data = await sbLoadTrips(user.id);
    if (data) setTrips(data);
  }

  async function createTrip({ name, destination, startDate, endDate, itinerary, weatherNotes }) {
    const id = crypto.randomUUID();
    // Create a chat session for this trip
    const sessionId = await createSession(user.id);
    const trip = {
      id,
      user_id: user.id,
      name,
      destination: destination || "",
      start_date: startDate || null,
      end_date: endDate || null,
      itinerary: itinerary || "",
      weather_notes: weatherNotes || "",
      session_id: sessionId,
    };
    await sbSaveTrip(trip);
    setTrips(prev => [trip, ...prev]);
    setActiveTrip(trip);
    setTripMessages([]);
    setShowNewTripForm(false);
  }

  async function openTrip(trip) {
    setActiveTrip(trip);
    if (trip.session_id) {
      const messages = await sbLoadTripMessages(trip.session_id);
      setTripMessages(messages?.map(m => ({ role: m.role, content: m.content })) || []);
    } else {
      setTripMessages([]);
    }
  }

  async function deleteTrip(tripId) {
    await sbDeleteTrip(tripId, user.id);
    setTrips(prev => prev.filter(t => t.id !== tripId));
    if (activeTrip?.id === tripId) { setActiveTrip(null); setTripMessages([]); }
  }

  async function sendTripMessage(msg) {
    if (!msg.trim() || !activeTrip) return;
    const userMsg = { role: "user", content: msg };
    const newHistory = [...tripMessages, userMsg];
    setTripMessages(newHistory);
    setTripInput("");
    setTripLoading(true);

    const tripContext = `\n\nTRIP CONTEXT:\nTrip: ${activeTrip.name}${activeTrip.destination ? ` to ${activeTrip.destination}` : ""}${activeTrip.start_date ? ` (${activeTrip.start_date} to ${activeTrip.end_date || "?"})` : ""}\n${activeTrip.itinerary ? `Itinerary:\n${activeTrip.itinerary}\n` : ""}${activeTrip.weather_notes ? `Weather: ${activeTrip.weather_notes}\n` : ""}\nYou are helping plan outfits for this specific trip. Reference the itinerary for each day's activities. Suggest outfits day by day. When suggesting outfits use the labeled format so they can be saved to the journal.`;

    try {
      const system = buildChatSystem(items, msg, buildStyleSystem, null, weather, season, 14, journalEntries, { maxDetailed: 32, maxCompactIndex: 18 }) + tripContext;
      const fallbackSystem = buildChatSystem(items, msg, buildStyleSystem, null, weather, season, 14, journalEntries, { maxDetailed: 16, maxCompactIndex: 8 }) + tripContext;
      const apiMessages = buildContextHistory(newHistory).map(m => ({ role: m.role, content: m.content }));
      const reply = await postClaudeWithRetry({
        label: "trip-chat",
        messages: apiMessages,
        system,
        fallbackSystem,
        maxTokens: 1500,
      });
      const assistantMsg = { role: "assistant", content: reply };
      if (detectPlan(reply)) extractPlan(reply);
      const finalHistory = [...newHistory, assistantMsg];
      setTripMessages(finalHistory);

      // Save messages to DB
      if (activeTrip.session_id) {
        await saveMessage(activeTrip.session_id, "user", msg);
        await saveMessage(activeTrip.session_id, "assistant", reply);
      }
    } catch (e) {
      setTripMessages([...newHistory, { role: "assistant", content: `Error: ${e.message || "Try again."}` }]);
    }
    setTripLoading(false);
  }

  return {
    trips, setTrips, activeTrip, setActiveTrip,
    tripMessages, tripInput, setTripInput,
    tripLoading, tripEndRef,
    showNewTripForm, setShowNewTripForm,
    planCards, setPlanCards,
    createTrip, openTrip, deleteTrip, sendTripMessage,
  };
}
