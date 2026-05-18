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

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findItemByName(items, name) {
  const query = normalizeMatchText(name);
  if (!query) return null;
  const scored = items.map(item => {
    const itemName = normalizeMatchText(item.name);
    const brand = normalizeMatchText(item.brand);
    const color = normalizeMatchText(item.color);
    const haystack = [itemName, brand, color].filter(Boolean).join(" ");
    const queryTokens = query.split(/\s+/).filter(token => token.length > 2);
    const itemTokens = new Set(haystack.split(/\s+/).filter(token => token.length > 2));
    const overlap = queryTokens.filter(token => itemTokens.has(token)).length;
    let score = overlap;
    if (itemName === query) score += 100;
    if (itemName.includes(query) || query.includes(itemName)) score += 45;
    if (brand && query.includes(brand)) score += 8;
    if (color && query.includes(color)) score += 5;
    return { item, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 2 ? scored[0].item : null;
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
    const multiDay = [/## /g, /\bDAY\b/gi, /\bMay\s+\d/g, /\bJune\s+\d/g, /\bJuly\s+\d/g, /\bAugust\s+\d/g, /\bDate:\*{0,2}/gi];
    const multiDayCount = multiDay.reduce((acc, p) => acc + (text.match(p)?.length || 0), 0);
    if (multiDayCount >= 3) return true;
    const outfitLabels = [/\*{0,2}Top:\*{0,2}/i, /\*{0,2}Bottoms?:\*{0,2}/i, /\*{0,2}Pants:\*{0,2}/i, /\*{0,2}Shoes:\*{0,2}/i, /\*{0,2}Dress:\*{0,2}/i, /\*{0,2}Accessories:\*{0,2}/i, /\*{0,2}Item:\*{0,2}/i];
    const outfitCount = outfitLabels.reduce((acc, p) => acc + (p.test(text) ? 1 : 0), 0);
    return outfitCount >= 2;
  }

  async function extractPlan(historyOrReply) {
    try {
      const convo = typeof historyOrReply === "string"
        ? historyOrReply
        : historyOrReply.slice(-12).map(m => `${m.role}: ${m.content}`).join("\n");
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 800,
          system: "You extract structured outfit plans from conversations. Return ONLY a JSON array, no markdown, no explanation.",
          messages: [{ role: "user", content: `Extract outfit(s) from this trip chat. Look at the recent conversation, not only the last assistant message. Return a JSON array where each entry is: { "date": "YYYY-MM-DD", "label": "brief occasion label", "itemNames": ["exact item names"], "notes": "activity/weather notes if present" }. For single outfits use tomorrow's date only if no date is mentioned: ${tomorrowStr}. For multi-day plans, infer dates from the trip context if dates are mentioned. Include item names from Top/Bottoms/Shoes/Accessories/Item labels. Return [] if nothing clear.\n\nConversation:\n${convo}` }],
        }),
      });
      const text = await readClaudeResponse(res, "trip-extract-plan");
      const parsed = parseJsonArray(text);
      if (!parsed?.length) return;
      const cards = parsed.map(entry => {
        const itemIds = (entry.itemNames || []).map(name => {
          const match = findItemByName(items, name);
          return match ? String(match.id) : null;
        }).filter(Boolean);
        const label = [entry.label, entry.notes].filter(Boolean).join(" - ");
        return { date: entry.date, label, itemIds, itemNames: entry.itemNames || [] };
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

    const tripContext = `\n\nTRIP CONTEXT:\nTrip: ${activeTrip.name}${activeTrip.destination ? ` to ${activeTrip.destination}` : ""}${activeTrip.start_date ? ` (${activeTrip.start_date} to ${activeTrip.end_date || "?"})` : ""}\n${activeTrip.itinerary ? `Itinerary:\n${activeTrip.itinerary}\n` : ""}${activeTrip.weather_notes ? `Weather: ${activeTrip.weather_notes}\n` : ""}\nYou are helping plan outfits for this specific trip. Reference the itinerary for each day's activities. When suggesting outfits, use labeled lines like **Top:**, **Bottoms:**, **Shoes:**, **Accessories:**, **Date:**, and **Notes:** so the app can create save-to-journal cards. If the user asks for cards or asks to add/save to journal, restate the outfit in that labeled format using exact closet item names. Do not say you cannot create cards or cannot see the journal; the app handles cards and passes planned journal context in your system prompt.`;

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
      const finalHistory = [...newHistory, assistantMsg];
      if (detectPlan(reply) || /\b(card|cards|save|journal|add)\b/i.test(msg)) extractPlan(finalHistory);
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
