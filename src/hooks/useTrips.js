import { useState, useEffect, useRef } from "react";
import { sbLoadTrips, sbSaveTrip, sbDeleteTrip, sbLoadTripMessages } from "../supabase.js";
import { buildChatSystem } from "../utils/wardrobeContext.js";

export function useTrips({ user, items, buildStyleSystem, weather, season, journalEntries }) {
  const [trips, setTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripMessages, setTripMessages] = useState([]);
  const [tripInput, setTripInput] = useState("");
  const [tripLoading, setTripLoading] = useState(false);
  const [showNewTripForm, setShowNewTripForm] = useState(false);
  const tripEndRef = useRef(null);

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
    const { createSession } = await import("./useChatSessions.js");
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
      const system = buildChatSystem(items, msg, buildStyleSystem, null, weather, season, 14, journalEntries) + tripContext;
      const apiMessages = newHistory.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, system, messages: apiMessages }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      const assistantMsg = { role: "assistant", content: reply };
      const finalHistory = [...newHistory, assistantMsg];
      setTripMessages(finalHistory);

      // Save messages to DB
      if (activeTrip.session_id) {
        const { saveMessage } = await import("./useChatSessions.js");
        await saveMessage(activeTrip.session_id, "user", msg);
        await saveMessage(activeTrip.session_id, "assistant", reply);
      }
    } catch (e) {
      setTripMessages([...newHistory, { role: "assistant", content: "Sorry, something went wrong." }]);
    }
    setTripLoading(false);
  }

  return {
    trips, activeTrip, setActiveTrip,
    tripMessages, tripInput, setTripInput,
    tripLoading, tripEndRef,
    showNewTripForm, setShowNewTripForm,
    createTrip, openTrip, deleteTrip, sendTripMessage,
  };
}
