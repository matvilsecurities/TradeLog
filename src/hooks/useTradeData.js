import { useCallback, useEffect, useState } from "react";
import {
  fetchTradesDb,
  saveTradeDb,
  deleteTradeDb,
  deleteTradeStoragePaths,
  fetchMissedTradesDb,
  saveMissedTradeDb,
  deleteMissedTradeDb,
  deleteMissedTradeStoragePaths,
  fetchSettingsDb,
  uploadTradeImage,
  getTradeImages,
  uploadMissedTradeImage,
  getMissedTradeImages,
  deleteMissedTradeImages,
  deleteTradeImages,
  deleteTradeImageByType,
  deleteMissedTradeImageByType,
} from "../supabase.js";

function upsertByDate(previous, record) {
  const exists = previous.some((item) => item.id === record.id);
  const next = exists
    ? previous.map((item) => item.id === record.id ? record : item)
    : [record, ...previous];
  return [...next].sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
}

function mergeById(previous, incoming) {
  const map = new Map(previous.map((item) => [String(item.id), item]));
  for (const item of incoming || []) {
    const key = String(item.id);
    map.set(key, { ...map.get(key), ...item });
  }
  return [...map.values()].sort((a, b) => {
    const dateCompare = String(b?.date || "").localeCompare(String(a?.date || ""));
    return dateCompare || String(b?.time || "").localeCompare(String(a?.time || ""));
  });
}

const PAGE_SIZE = 100;

export function useTradeData({ session, authLoading, onSettingsLoaded, defaultAccountId = null, view = "dashboard" }) {
  const [trades, setTrades] = useState([]);
  const [missedTrades, setMissedTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refreshData = useCallback(async () => {
    if (authLoading || !session) return;

    try {
      setLoaded(false);

      const [tradeData, settings, missed] = await Promise.all([
        fetchTradesDb({ limit: PAGE_SIZE, includeImages: false }),
        fetchSettingsDb(),
        fetchMissedTradesDb({ limit: PAGE_SIZE, includeImages: false }),
      ]);

      onSettingsLoaded?.(settings);
      setTrades(tradeData || []);
      setMissedTrades(missed || []);

      if (view !== "dashboard") {
        void (async () => {
          let cursor = tradeData?.nextCursor || null;
          let hasMore = tradeData?.hasMore;
          while (hasMore && cursor) {
            await new Promise((resolve) => setTimeout(resolve, 75));
            const page = await fetchTradesDb({ limit: PAGE_SIZE, cursor, includeImages: false });
            setTrades((previous) => mergeById(previous, page));
            cursor = page?.nextCursor || null;
            hasMore = page?.hasMore;
          }
        })().catch((error) => console.warn("Background trade history hydration stopped:", error));

        void (async () => {
          let offset = PAGE_SIZE;
          let hasMore = missed?.hasMore;
          while (hasMore) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const page = await fetchMissedTradesDb({ limit: PAGE_SIZE, offset, includeImages: false });
            setMissedTrades((previous) => mergeById(previous, page));
            offset += PAGE_SIZE;
            hasMore = page?.hasMore;
          }
        })().catch((error) => console.warn("Background missed-trade history hydration stopped:", error));
      }
    } catch (error) {
      console.error("Failed to refresh TradeLog data from Supabase:", error);
      alert(`Failed to refresh trades: ${error.message}`);
    } finally {
      setLoaded(true);
    }
  }, [authLoading, session, onSettingsLoaded]);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      setLoaded(true);
      setTrades([]);
      setMissedTrades([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoaded(false);
        const [tradeData, settings, missed] = await Promise.all([
          fetchTradesDb({ limit: PAGE_SIZE, includeImages: false }),
          fetchSettingsDb(),
          fetchMissedTradesDb({ limit: PAGE_SIZE, includeImages: false }),
        ]);

        if (cancelled) return;
        onSettingsLoaded?.(settings);
        setTrades(tradeData || []);
        setMissedTrades(missed || []);

        if (view !== "dashboard") {
          void (async () => {
            let cursor = tradeData?.nextCursor || null;
            let hasMore = tradeData?.hasMore;
            while (!cancelled && hasMore && cursor) {
              await new Promise((resolve) => setTimeout(resolve, 75));
              const page = await fetchTradesDb({ limit: PAGE_SIZE, cursor, includeImages: false });
              if (cancelled) return;
              setTrades((previous) => mergeById(previous, page));
              cursor = page?.nextCursor || null;
              hasMore = page?.hasMore;
            }
          })().catch((error) => { if (!cancelled) console.warn("Background trade history hydration stopped:", error); });

          void (async () => {
            let offset = PAGE_SIZE;
            let hasMore = missed?.hasMore;
            while (!cancelled && hasMore) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const page = await fetchMissedTradesDb({ limit: PAGE_SIZE, offset, includeImages: false });
              if (cancelled) return;
              setMissedTrades((previous) => mergeById(previous, page));
              offset += PAGE_SIZE;
              hasMore = page?.hasMore;
            }
          })().catch((error) => { if (!cancelled) console.warn("Background missed-trade history hydration stopped:", error); });
        }
      } catch (error) {
        console.error("Failed to load TradeLog data from Supabase:", error);
        if (!cancelled) alert(`Failed to load trades: ${error.message}`);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [session?.user?.id, authLoading, onSettingsLoaded]);

  const loadTradeImages = useCallback(async (tradeId) => {
    if (!tradeId) return [];
    try {
      const images = await getTradeImages(tradeId);
      setTrades((previous) => previous.map((trade) => String(trade.id) === String(tradeId)
        ? { ...trade, screenshot_before: images.find((img) => img.image_type === "before_entry")?.url || "", screenshot_after: images.find((img) => img.image_type === "after_exit")?.url || "" }
        : trade));
      return images;
    } catch (error) {
      console.warn("Failed to lazy-load trade images:", error);
      return [];
    }
  }, []);

  const saveTrade = useCallback(async (trade) => {
    try {
      const previousTrade = trades.find((item) => item.id === trade?.id);
      const wasEditing = !!previousTrade?.id;
      const removedBefore = wasEditing && previousTrade.screenshot_before && trade.screenshot_before === "";
      const removedAfter = wasEditing && previousTrade.screenshot_after && trade.screenshot_after === "";

      const saved = await saveTradeDb(trade);
      const savedTrade = saved?.[0];
      if (!savedTrade?.id) throw new Error("Trade saved, but no Supabase trade ID was returned.");

      if (trade.screenshot_before?.file instanceof File) {
        await uploadTradeImage(trade.screenshot_before.file, savedTrade.id, "before_entry");
      } else if (removedBefore) {
        await deleteTradeImageByType(savedTrade.id, "before_entry");
      }

      if (trade.screenshot_after?.file instanceof File) {
        await uploadTradeImage(trade.screenshot_after.file, savedTrade.id, "after_exit");
      } else if (removedAfter) {
        await deleteTradeImageByType(savedTrade.id, "after_exit");
      }

      const images = await getTradeImages(savedTrade.id);
      const updatedTrade = {
        ...trade,
        id: savedTrade.id,
        // Take server-truth fields from the saved row so later edits use the fresh updated_at.
        updatedAt: savedTrade.updated_at || trade.updatedAt || null,
        accountId: savedTrade.account_id || trade.accountId,
        accountUuid: savedTrade.account_uuid || trade.accountUuid || "",
        screenshot_before: images.find((img) => img.image_type === "before_entry")?.url || "",
        screenshot_after: images.find((img) => img.image_type === "after_exit")?.url || "",
      };

      setTrades((previous) => upsertByDate(previous, updatedTrade));
      return updatedTrade;
    } catch (error) {
      // Not alert()'d here — every caller of saveTrade already catches and
      // surfaces this via the app's toast notifications. Alerting here too
      // meant a save failure showed a blocking native dialog *and* a toast.
      console.error("Failed to save trade:", error);
      throw error;
    }
  }, [trades]);

  const deleteTrade = useCallback(async (id) => {
    if (!window.confirm("Delete this trade?")) return;
    try {
      const deletion = await deleteTradeDb(id);
      await deleteTradeStoragePaths(deletion?.storage_paths || []);
      setTrades((previous) => previous.filter((trade) => trade.id !== id));
    } catch (error) {
      // Surfaced via toast by the caller — see note in saveTrade above.
      console.error("Failed to delete trade:", error);
      throw error;
    }
  }, []);

  const saveMissedTrade = useCallback(async (trade, previousTrade = null) => {
    try {
      const wasEditing = !!previousTrade?.id;
      const removedBefore = wasEditing && previousTrade.screenshot_before && trade.screenshot_before === "";
      const removedAfter = wasEditing && previousTrade.screenshot_after && trade.screenshot_after === "";

      const missedAccountId = trade.accountId || trade.account_id || defaultAccountId;
      if (!missedAccountId) throw new Error("Missed trade account is required. Select the intended trading account and try again.");
      const saved = await saveMissedTradeDb({ ...trade, accountId: missedAccountId });
      const savedRecord = saved?.[0];
      if (!savedRecord?.id) throw new Error("Missed trade saved but no Supabase ID was returned.");

      if (trade.screenshot_before?.file instanceof File) {
        await uploadMissedTradeImage(trade.screenshot_before.file, savedRecord.id, "before_entry");
      } else if (removedBefore) {
        await deleteMissedTradeImageByType(savedRecord.id, "before_entry");
      }

      if (trade.screenshot_after?.file instanceof File) {
        await uploadMissedTradeImage(trade.screenshot_after.file, savedRecord.id, "after_exit");
      } else if (removedAfter) {
        await deleteMissedTradeImageByType(savedRecord.id, "after_exit");
      }

      const images = await getMissedTradeImages(savedRecord.id);
      const updatedRecord = {
        ...trade,
        id: savedRecord.id,
        screenshot_before: images.find((img) => img.image_type === "before_entry")?.url || "",
        screenshot_after: images.find((img) => img.image_type === "after_exit")?.url || "",
      };

      setMissedTrades((previous) => upsertByDate(previous, updatedRecord));
      return updatedRecord;
    } catch (error) {
      // Surfaced via toast by the caller — see note in saveTrade above.
      console.error("Failed to save missed trade:", error);
      throw error;
    }
  }, [defaultAccountId]);

  const deleteMissedTrade = useCallback(async (id) => {
    if (!window.confirm("Delete this missed trade?")) return;
    try {
      const deletion = await deleteMissedTradeDb(id);
      await deleteMissedTradeStoragePaths(deletion?.storage_paths || []);
      setMissedTrades((previous) => previous.filter((trade) => trade.id !== id));
    } catch (error) {
      // Previously this caught-and-alerted without rethrowing, so App.jsx's
      // wrapper (which awaits this and then shows a "deleted" success toast)
      // had no way to know the delete had actually failed — the user would
      // see a false "Missed trade deleted." success message. Rethrowing lets
      // the existing catch block in App.jsx show the real error instead.
      console.error("Failed to delete missed trade:", error);
      throw error;
    }
  }, []);

  return { trades, missedTrades, loaded, refreshData, loadTradeImages, saveTrade, deleteTrade, saveMissedTrade, deleteMissedTrade };
}
