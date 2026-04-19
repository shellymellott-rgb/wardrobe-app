import { useState, useRef } from "react";
import { callClaude } from "../utils/callClaude.js";
import { parseJsonObject, parseJsonArray } from "../utils/parseJson.js";
import { OUTFIT_PROMPT, EVALUATE_PROMPT, INSPO_PROMPT } from "../utils/prompts.js";
import { buildChatSystem, itemFocusCtx, buildContextHistory, stripForClaude } from "../utils/wardrobeContext.js";
import { readFile } from "../utils/imageUtils.js";

export function useClaudeStyling({ items, buildStyleSystem, saveSettings, addStyleNote }) {

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
      const text = await callClaude(buildStyleSystem(), OUTFIT_PROMPT(items.map(stripForClaude), occasion), 1000);
      setOutfits(parseJsonArray(text));
    } catch {
      try {
        const fallback = await callClaude(
          buildStyleSystem(),
          `Shelly's wardrobe:\n${items.map(stripForClaude).map(i=>`- [${i.category}] ${i.name}`).join("\n")}\n${occasion?`Occasion: ${occasion}`:"Everyday outfits."}\nGive 3 outfit combos. Direct, editorial.`,
          1000
        );
        setOutfitText(fallback);
      } catch {}
    }
    setLoadingOutfit(false);
  }

  // ── Inspo analysis ─────────────────────────────────────────────────────────
  const [inspoImage, setInspoImage] = useState(null);
  const [inspoResult, setInspoResult] = useState(null);
  const [loadingInspo, setLoadingInspo] = useState(false);

  async function analyzeInspo(e) {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;

    console.log("[inspo] file selected:", file.name, "| type:", file.type, "| size:", file.size, "bytes");

    const dataUrl = await readFile(file);
    console.log("[inspo] readFile done | dataUrl length:", dataUrl?.length, "| prefix:", dataUrl?.substring(0, 60));

    setInspoImage(dataUrl); setInspoResult(null); setLoadingInspo(true);
    try {
      // Compress aggressively before sending — full photos easily exceed serverless body limits.
      // Max 800px on the longest dimension, JPEG 0.5 quality. Aspect ratio preserved by compressImage.
      const compressed = await compressImage(dataUrl, 800, 0.5);
      console.log("[inspo] compressed dataUrl length:", compressed?.length, "(was:", dataUrl?.length, ")");

      const base64 = compressed.split(",")[1];
      const mediaType = "image/jpeg"; // compressImage always outputs JPEG
      console.log("[inspo] base64 length:", base64?.length, "| mediaType:", mediaType);

      // Fetch directly (not via callClaude) to expose the raw response for debugging
      const reqBody = {
        model: "claude-3-5-sonnet-latest",
        max_tokens: 800,
        system: buildStyleSystem(),
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text",  text: INSPO_PROMPT(items.map(stripForClaude)) },
          ],
        }],
      };
      console.log("[inspo] sending to /api/claude | model:", reqBody.model, "| messages[0].content types:", reqBody.messages[0].content.map(c => c.type));

      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      console.log("[inspo] HTTP status:", res.status);

      const rawData = await res.json();
      console.log("[inspo] raw API response:", JSON.stringify(rawData).substring(0, 600));

      if (rawData.error) {
        console.error("[inspo] API error object:", rawData.error);
      }

      const text = rawData.content?.[0]?.text || "";
      console.log("[inspo] extracted text length:", text.length, "| preview:", text.substring(0, 200));

      if (!text) {
        console.warn("[inspo] empty text — likely an API error above");
      }

      const parsed = parseJsonObject(text);
      console.log("[inspo] parseJsonObject result:", parsed);

      setInspoResult(parsed);
    } catch (err) {
      console.error("[inspo] caught error:", err.message);
      console.error("[inspo] stack:", err.stack);
      setInspoResult({
        outfitName: "Inspiration Look",
        pieces: [],
        why: err.message || "Unknown error — check console",
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
  const [correctingIdx, setCorrectingIdx] = useState(null);
  const [correctionInput, setCorrectionInput] = useState("");
  const [learnedIndicator, setLearnedIndicator] = useState(false);
  const chatEndRef = useRef();

  function flashLearned() { setLearnedIndicator(true); setTimeout(() => setLearnedIndicator(false), 2000); }

  async function sendChat(chatHistory, setChatHistory) {
    const msg = chatInput.trim(); if (!msg || chatLoading) return;
    const newHistory = [...chatHistory, { role:"user", content:msg }];
    setChatHistory(newHistory);
    try { localStorage.setItem("wardrobe-chat-history", JSON.stringify(newHistory)); } catch {}
    setChatInput(""); setChatLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:buildChatSystem(items, msg, buildStyleSystem), messages:buildContextHistory(newHistory) }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      const updated = [...newHistory, { role:"assistant", content:reply }];
      setChatHistory(updated);
      try { localStorage.setItem("wardrobe-chat-history", JSON.stringify(updated)); } catch {}
      saveSettings({ chatHistory: updated.slice(-30) });
      extractStyleNote(msg, reply).then(note => { if (note) { addStyleNote(note); flashLearned(); } });
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
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:buildChatSystem(items, correction, buildStyleSystem), messages:buildContextHistory(newHistory) }),
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
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:buildChatSystem(items, initialMsg, buildStyleSystem)+itemFocusCtx(item), messages:newHistory }),
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
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:buildChatSystem(items, msg, buildStyleSystem)+itemFocusCtx(itemChatModal), messages:buildContextHistory(newHistory) }),
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
    sendChat, submitCorrection,
    // item chat
    itemChatModal, setItemChatModal, itemChatHistory, itemChatInput, setItemChatInput,
    itemChatLoading, itemChatEndRef,
    openItemChat, sendItemChat,
  };
}
