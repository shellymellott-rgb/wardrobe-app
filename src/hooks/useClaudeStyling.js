import { useState, useRef, useEffect } from "react";
import { callClaude } from "../utils/callClaude.js";
import { parseJsonObject, parseJsonArray } from "../utils/parseJson.js";
import { OUTFIT_PROMPT, EVALUATE_PROMPT, INSPO_PROMPT } from "../utils/prompts.js";
import { buildChatSystem, itemFocusCtx, buildContextHistory, stripForClaude, filterRelevantItems } from "../utils/wardrobeContext.js";
import { readFile, compressImage } from "../utils/imageUtils.js";
import { useChatSessions } from "./useChatSessions.js";

export function useClaudeStyling({ items, buildStyleSystem, saveSettings, addStyleNote, user, weather, season, journalEntries = null }) {
  const { loadProfile, upsertProfile, createSession, saveMessage } = useChatSessions();
  const [wardrobeProfile, setWardrobeProfile] = useState(null);
  const activeSessionId = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    loadProfile(user.id).then(p => { if (p) setWardrobeProfile(p); });
  }, [user?.id]);

  function reloadProfile() {
    if (!user?.id) return;
    loadProfile(user.id).then(p => { if (p) setWardrobeProfile(p); });
  }

  const rotationDays = wardrobeProfile?.rotation_days || 14;

  // ── Outfit generation ──────────────────────────────────────────────────────
  const [occasion, setOccasion] = useState("");
  const [outfits, setOutfits] = useState([]);
  const [outfitText, setOutfitText] = useState("");
  const [loadingOutfit, setLoadingOutfit] = useState(false);

  function addOutfit(outfit) {
    setOutfits(prev => [outfit, ...prev]);
  }

  async function generateOutfits() {
    if (items.length < 2) return;
    setLoadingOutfit(true); setOutfits([]); setOutfitText("");
    try {
      const outfitItems = filterRelevantItems(items, occasion || "everyday complete outfits");
      const text = await callClaude(buildStyleSystem(), OUTFIT_PROMPT(outfitItems.map(stripForClaude), occasion, outfits), 1000);
      console.log("[outfits] response preview:", text?.slice(0, 200));
      setOutfits(parseJsonArray(text));
    } catch (e) {
      console.error("[outfits] primary failed:", e.message);
      try {
        const fallback = await callClaude(
          buildStyleSystem(),
          `Shelly's wardrobe:\n${items.map(stripForClaude).map(i=>`- [${i.category}] ${i.name}`).join("\n")}\n${occasion?`Occasion: ${occasion}`:"Everyday outfits."}\nGive 3 outfit combos. Direct, editorial.`,
          1000
        );
        if (fallback) {
          setOutfitText(fallback);
        } else {
          setOutfitText("Could not generate outfits. Please try again.");
        }
      } catch (e2) {
        console.error("[outfits] fallback failed:", e2.message);
        setOutfitText("Could not generate outfits. Please try again.");
      }
    }
    setLoadingOutfit(false);
  }

  // ── Inspo analysis ─────────────────────────────────────────────────────────
  const [inspoImage, setInspoImage] = useState(null);
  const [inspoResult, setInspoResult] = useState(null);
  const [loadingInspo, setLoadingInspo] = useState(false);

  async function analyzeInspo(e) {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;

    const dataUrl = await readFile(file);

    setInspoImage(dataUrl); setInspoResult(null); setLoadingInspo(true);
    try {
      // Compress aggressively before sending — full photos easily exceed serverless body limits.
      const compressed = await compressImage(dataUrl, 400, 0.35);

      const base64 = compressed.split(",")[1];
      const mediaType = "image/jpeg"; // compressImage always outputs JPEG

      const reqBody = {
        model: "claude-3-5-sonnet-latest",
        max_tokens: 800,
        system: buildStyleSystem(),
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text",  text: INSPO_PROMPT(filterRelevantItems(items, "recreate outfit inspiration with available closet pieces").map(stripForClaude)) },
          ],
        }],
      };

      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });

      const rawData = await res.json();

      if (rawData.error) {
        console.error("[inspo] API error:", rawData.error);
      }

      const text = rawData.content?.[0]?.text || "";
      const parsed = parseJsonObject(text);

      setInspoResult(parsed);
    } catch (err) {
      console.error("[inspo] error:", err.message);
      setInspoResult({
        outfitName: "Inspiration Look",
        pieces: [],
        why: "Something went wrong. Please try again.",
        tip: "",
        gaps: [],
      });
    }
    setLoadingInspo(false);
  }

  // ── Item evaluation ────────────────────────────────────────────────────────
  const [itemEval, setItemEval] = useState("");
  const [loadingEval, setLoadingEval] = useState(false);

  async function evaluateItem(item) {
    setItemEval(""); setLoadingEval(true);
    try { setItemEval(await callClaude(buildStyleSystem(), EVALUATE_PROMPT(item), 500)); }
    catch { setItemEval("Error. Try again."); }
    setLoadingEval(false);
    return item;
  }

  // ── Style note extraction ──────────────────────────────────────────────────
  async function extractStyleNote(userMsg, assistantReply) {
    try {
      const combined = `Shelly said: "${userMsg}"\nStylist replied: "${assistantReply.substring(0, 400)}"`;
      const note = await callClaude(
        `Read this chat exchange and extract any explicit style preference or dislike that Shelly expressed — things like "I hate X", "I never wear Y", "I love Z", "I prefer A over B". Return ONLY a brief factual note under 15 words (e.g. "Dislikes cropped tops", "Prefers wide-leg pants over skinny"). If no clear preference was stated, return exactly: none`,
        combined, 80
      );
      const c = note.trim();
      return (c && c.toLowerCase() !== "none" && !c.toLowerCase().startsWith("no ") && c.length > 4 && c.length < 130) ? c : null;
    } catch { return null; }
  }

  // ── Main chat ──────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]);
  const [planCards, setPlanCards] = useState([]);
  const [correctingIdx, setCorrectingIdx] = useState(null);
  const [correctionInput, setCorrectionInput] = useState("");
  const [learnedIndicator, setLearnedIndicator] = useState(false);
  const chatEndRef = useRef();

  function flashLearned() { setLearnedIndicator(true); setTimeout(() => setLearnedIndicator(false), 2000); }

  function detectPlan(text) {
    const multiDay = [/## /g, /\bDAY\b/gi, /\bMay\s+\d/g, /\bJune\s+\d/g, /\bJuly\s+\d/g, /\bAugust\s+\d/g, /\bSeptember\s+\d/g];
    const multiDayCount = multiDay.reduce((acc, p) => acc + (text.match(p)?.length || 0), 0);
    if (multiDayCount >= 3) return true;
    const outfitLabels = [/\*{0,2}Top:\*{0,2}/i, /\*{0,2}Bottom:\*{0,2}/i, /\*{0,2}Pants:\*{0,2}/i, /\*{0,2}Shoes:\*{0,2}/i, /\*{0,2}Dress:\*{0,2}/i, /\*{0,2}Layer:\*{0,2}/i, /\*{0,2}Earrings:\*{0,2}/i, /\*{0,2}Accessories:\*{0,2}/i, /\*{0,2}Outfit:\*{0,2}/i, /\*{0,2}Logged outfit:\*{0,2}/i];
    const outfitCount = outfitLabels.reduce((acc, p) => acc + (p.test(text) ? 1 : 0), 0);
    if (outfitCount >= 2) return true;
    const numberedBold = (text.match(/^\d+\.\s+\*\*/gm) || []).length;
    if (numberedBold >= 3) return true;
    return false;
  }

  async function extractPlan(historyOrReply, itemList) {
    try {
      const convo = typeof historyOrReply === "string"
        ? historyOrReply
        : historyOrReply.slice(-30).map(m => {
            const content = Array.isArray(m.content)
              ? m.content.filter(b => b.type === "text").map(b => b.text).join(" ")
              : m.content;
            return `${m.role}: ${content}`;
          }).join("\n");
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: "You extract structured outfit plans from conversations. Return ONLY a JSON array, no markdown, no explanation.",
          messages: [{ role: "user", content: `Extract outfit(s) from this text. If it contains multiple days/occasions, extract each one separately. If it contains a single outfit suggestion, extract just that one. Return a JSON array where each entry is: { "date": "YYYY-MM-DD", "label": "brief occasion label", "itemNames": ["exact item names"] }. For single outfits use tomorrow's date: ${tomorrowStr}. For multi-day plans, infer dates sequentially starting from tomorrow if no explicit dates are given. Ignore outfits that were rejected or replaced earlier in the text. If nothing clear exists, return [].\n\nConversation:\n${convo}` }],
        }),
      });
      const data = await res.json();
      const parsed = parseJsonArray(data.content?.[0]?.text || "");
      if (!parsed?.length) return;
      const cards = parsed.map(entry => {
        const itemIds = (entry.itemNames || []).map(name => {
          const lc = name.toLowerCase();
          const parts = name.split(" - ");
          const descPart = parts[0].toLowerCase();
          const exact = itemList.find(i => i.name.toLowerCase() === lc);
          const contains = itemList.find(i => i.name.toLowerCase().includes(lc));
          const descContains = descPart.length >= 15 ? itemList.find(i => i.name.toLowerCase().includes(descPart)) : null;
          const reverseDesc = itemList.find(i => i.name.toLowerCase().length >= 20 && descPart.includes(i.name.toLowerCase()));
          const match = exact || contains || descContains || reverseDesc;
          return match ? String(match.id) : null;
        }).filter(Boolean);
        return { date: entry.date, label: entry.label || "", itemIds, itemNames: entry.itemNames || [] };
      }).filter(c => c.date && c.itemIds.length > 0);
      if (cards.length) setPlanCards(cards);
    } catch (e) {
      console.error("[extractPlan] failed:", e.message);
    }
  }

  async function sendChat(chatHistory, setChatHistory) {
    const msg = chatInput.trim(); if (!msg || chatLoading) return;
    const newHistory = [...chatHistory, { role:"user", content:msg }];
    setChatHistory(newHistory);
    try { localStorage.setItem("wardrobe-chat-history", JSON.stringify(newHistory)); } catch {}
    setChatInput("");
    const imagesToSend = attachedImages;
    setAttachedImages([]);
    setChatLoading(true);
    if (!activeSessionId.current && user?.id) {
      activeSessionId.current = await createSession(user.id);
    }
    try {
      let apiMessages = buildContextHistory(newHistory);
      if (imagesToSend.length) {
        const imageBlocks = await Promise.all(imagesToSend.map(async (img) => {
          const compressed = await compressImage(img, 400, 0.35);
          const base64 = compressed.split(",")[1];
          return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } };
        }));
        apiMessages = [
          ...apiMessages.slice(0, -1),
          { role: "user", content: [
            ...imageBlocks,
            { type: "text", text: msg },
          ]},
        ];
      }
      const res = await fetch("/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:buildChatSystem(items, msg, buildStyleSystem, wardrobeProfile, weather, season, rotationDays, journalEntries), messages:apiMessages }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      const updated = [...newHistory, { role:"assistant", content:reply }];
      setChatHistory(updated);
      try { localStorage.setItem("wardrobe-chat-history", JSON.stringify(updated)); } catch {}
      saveSettings({ chatHistory: updated.slice(-30) });
      if (activeSessionId.current) {
        saveMessage(activeSessionId.current, "user", msg);
        saveMessage(activeSessionId.current, "assistant", reply);
      }
      extractStyleNote(msg, reply).then(note => { if (note) { addStyleNote(note); flashLearned(); } });
      if (detectPlan(reply)) extractPlan(reply, items);
    } catch {
      setChatHistory(h => [...h, { role:"assistant", content:"Error. Try again." }]);
    }
    setChatLoading(false);
  }

  async function submitCorrection(chatHistory, setChatHistory, idx) {
    const note = correctionInput.trim(); if (!note) return;
    addStyleNote(note); flashLearned();
    const correction = `That last response wasn't right. Correction: ${note}`;
    const newHistory = [...chatHistory, { role:"user", content:correction }];
    setChatHistory(newHistory);
    try { localStorage.setItem("wardrobe-chat-history", JSON.stringify(newHistory)); } catch {}
    setCorrectingIdx(null); setCorrectionInput(""); setChatLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:buildChatSystem(items, correction, buildStyleSystem, null, weather, season, rotationDays, journalEntries), messages:buildContextHistory(newHistory) }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      const updated = [...newHistory, { role:"assistant", content:reply }];
      setChatHistory(updated);
      try { localStorage.setItem("wardrobe-chat-history", JSON.stringify(updated)); } catch {}
      saveSettings({ chatHistory: updated.slice(-30) });
    } catch {
      setChatHistory(h => [...h, { role:"assistant", content:"Error. Try again." }]);
    }
    setChatLoading(false);
  }

  // ── Item chat ──────────────────────────────────────────────────────────────
  const [itemChatModal, setItemChatModal] = useState(null);
  const [itemChatHistory, setItemChatHistory] = useState([]);
  const [itemChatInput, setItemChatInput] = useState("");
  const [itemChatLoading, setItemChatLoading] = useState(false);
  const itemChatEndRef = useRef();

  async function openItemChat(item) {
    setItemChatModal(item); setItemChatInput("");
    const initialMsg = `Help me style the ${item.name}`;
    const newHistory = [{ role:"user", content:initialMsg }];
    setItemChatHistory(newHistory); setItemChatLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:buildChatSystem(items, initialMsg, buildStyleSystem, null, weather, season, rotationDays, journalEntries)+itemFocusCtx(item), messages:newHistory }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      setItemChatHistory([...newHistory, { role:"assistant", content:reply }]);
    } catch {
      setItemChatHistory([...newHistory, { role:"assistant", content:"Error. Try again." }]);
    }
    setItemChatLoading(false);
  }

  async function sendItemChat() {
    const msg = itemChatInput.trim(); if (!msg || itemChatLoading) return;
    const newHistory = [...itemChatHistory, { role:"user", content:msg }];
    setItemChatHistory(newHistory); setItemChatInput(""); setItemChatLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:buildChatSystem(items, msg, buildStyleSystem, null, weather, season, rotationDays, journalEntries)+itemFocusCtx(itemChatModal), messages:buildContextHistory(newHistory) }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      setItemChatHistory(h => [...h, { role:"assistant", content:reply }]);
      extractStyleNote(msg, reply).then(note => { if (note) { addStyleNote(note); flashLearned(); } });
    } catch {
      setItemChatHistory(h => [...h, { role:"assistant", content:"Error. Try again." }]);
    }
    setItemChatLoading(false);
  }

  return {
    // profile
    wardrobeProfile, upsertProfile, reloadProfile,
    // outfits
    occasion, setOccasion, outfits, outfitText, loadingOutfit, generateOutfits, addOutfit,
    // inspo
    inspoImage, setInspoImage, inspoResult, setInspoResult, loadingInspo, analyzeInspo,
    // eval
    itemEval, setItemEval, loadingEval, evaluateItem,
    // chat
    chatInput, setChatInput, chatLoading, chatEndRef,
    correctingIdx, setCorrectingIdx, correctionInput, setCorrectionInput,
    learnedIndicator,
    attachedImages, setAttachedImages,
    planCards, setPlanCards, extractPlan,
    sendChat, submitCorrection,
    // item chat
    itemChatModal, setItemChatModal, itemChatHistory, itemChatInput, setItemChatInput,
    itemChatLoading, itemChatEndRef,
    openItemChat, sendItemChat,
  };
}
