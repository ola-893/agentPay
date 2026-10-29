import { useCallback, useEffect, useRef, useState } from "react";
import { reduceRun, validateRun } from "../lib/run-events.mjs";
import { recordingChoices } from "../lib/workflow-view.mjs";
const empty = () => ({ events: [], status: "idle" });
const localDev =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  ["127.0.0.1", "localhost"].includes(window.location.hostname);
export default function useWorkflowRun() {
  const [mode, setMode] = useState("recorded"),
    [agent, setAgent] = useState(null),
    [manifest, setManifest] = useState([]),
    [selected, setSelected] = useState(""),
    [recording, setRecording] = useState(null),
    [policy, setPolicy] = useState(null),
    [pay, setPay] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [run, updateRun] = useState(empty),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(""),
    [connection, setConnection] = useState("Checking recorded evidence…"),
    [activeId, setActiveId] = useState(null);
  const source = useRef(null),
    timer = useRef(null);
  const stop = () => {
    clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };
  // Keep transport validation synchronous so malformed SSE data is caught by
  // the message handler instead of throwing later in a React state updater.
  const currentRun = useRef(empty());
  const setRun = useCallback((state) => {
    currentRun.current = state;
    updateRun(state);
  }, []);
  const apply = (e) => setRun(reduceRun(currentRun.current, e));
  useEffect(() => {
    const c = new AbortController();
    fetch(`${import.meta.env.BASE_URL}runs/index.json`, {
      signal: c.signal,
      cache: "no-cache",
    })
      .then((r) => {
        if (!r.ok) throw new Error("Recorded run index unavailable.");
        return r.json();
      })
      .then((data) => {
        if (data.schemaVersion !== 1 || !Array.isArray(data.runs))
          throw new Error("Invalid recorded run index.");
        const { primary, history } = recordingChoices(data.runs);
        const list = [...primary, ...history];
        setManifest(list);
        setSelected(list[0]?.id || "");
        setConnection(
          list.length
            ? "Recorded evidence ready."
            : "No captured runs have been published yet."
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => {
      c.abort();
      source.current?.close();
      clearInterval(timer.current);
    };
  }, []);
  const connect = useCallback(async () => {
    if (!localDev) return;
    try {
      const response = await fetch("/api/agent", {
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Start npm run dev:live."
        );
      const data = await response.json();
      setAgent(data);
      setConnection(
        "Local server connected. CRE and signing run on this computer."
      );
      setPay(false);
      setConfirmed(false);
    } catch (e) {
      setAgent(null);
      setConnection(
        "Local runner unavailable. Recorded mode is available; start npm run dev:live."
      );
      setError(e.message || "Local server not connected.");
    }
  }, []);
  useEffect(() => {
    if (localDev) connect();
  }, [connect]); // Only local Vite development probes its same-origin API.
  useEffect(() => {
    if (mode !== "recorded" || !selected) return;
    const c = new AbortController();
    let live = true;
    setRecording(null);
    setError("");
    setRun(empty());
    const item = manifest.find((x) => x.id === selected);
    if (!item) return;
    fetch(`${import.meta.env.BASE_URL}runs/${item.file}`, {
      signal: c.signal,
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Recorded events unavailable.");
        const text = await response.text();
        const bytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(text)
        );
        const digest = Array.from(new Uint8Array(bytes))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        if (digest !== item.sha256)
          throw new Error("Recorded event hash mismatch.");
        const events = validateRun(
          text
            .trim()
            .split("\n")
            .map((x) => JSON.parse(x))
        );
        if (events[0].runId !== item.id)
          throw new Error("Recorded run ID mismatch.");
        if (live) {
          setRecording({ item, events });
          setPolicy(events[0].data.profile.policy);
        }
      })
      .catch((e) => {
        if (live && e.name !== "AbortError") setError(e.message);
      });
    return () => {
      live = false;
      c.abort();
      clearInterval(timer.current);
      setPlaying(false);
    };
  }, [mode, selected, manifest, setRun]);
  useEffect(() => {
    if (mode === "live" && agent) setPolicy(agent.profile.policy);
  }, [mode, agent]);
  const profile =
    mode === "live" ? agent?.profile : recording?.events[0].data.profile;
  const info =
    run.start || (mode === "recorded" ? recording?.events[0].data : null);
  const balances =
    mode === "live"
      ? agent?.balances
      : {
          usdcRaw: info?.balances.payerUsdcRaw,
          ethRaw: info?.balances.payerEthRaw,
        };
  const working =
    busy || playing || (run.status === "running" && mode === "live");
  function changeMode(next) {
    source.current?.close();
    stop();
    setMode(next);
    setRun(empty());
    setError("");
    setPay(false);
    setConfirmed(false);
    if (next === "live" && agent) setPolicy(agent.profile.policy);
  }
  function listen(id) {
    source.current?.close();
    setRun(empty());
    setActiveId(id);
    setBusy(true);
    const stream = new EventSource(`/api/runs/${id}/events`);
    source.current = stream;
    stream.onmessage = (event) => {
      try {
        const e = JSON.parse(event.data);
        apply(e);
        if (e.type === "run.end") {
          stream.close();
          setBusy(false);
        }
      } catch {
        stream.close();
        setError(
          "Invalid event stream. Inspect the local CLI before retrying."
        );
        setBusy(false);
      }
    };
    stream.onerror = () => {
      stream.close();
      setBusy(false);
      setError(
        "Event connection closed. The local run may still be active; reconnect to its timeline before starting another payment."
      );
    };
  }
  async function start(e) {
    e.preventDefault();
    setError("");
    if (mode === "recorded") {
      if (!recording) return;
      if (playing) {
        stop();
        return;
      }
      let index = run.summary ? 0 : run.events.length;
      if (index === 0) setRun(empty());
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        let state = empty();
        for (const event of recording.events) state = reduceRun(state, event);
        setRun(state);
        return;
      }
      setPlaying(true);
      timer.current = setInterval(() => {
        if (index >= recording.events.length) {
          stop();
          return;
        }
        try {
          apply(recording.events[index++]);
        } catch {
          stop();
          setError(
            "Recorded event sequence is invalid. Reload the captured evidence."
          );
        }
      }, 350);
      return;
    }
    if (!policy || !agent) return;
    setBusy(true);
    setRun(empty());
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agentpay-token": agent.token,
        },
        body: JSON.stringify({
          profileId: profile.id,
          mode: pay ? "pay" : "preview",
          confirmPay: confirmed,
          policy,
        }),
        signal: AbortSignal.timeout(90000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConfirmed(false);
      listen(data.id);
    } catch (e) {
      setError(
        e.message || "Local run could not start. Check the server terminal."
      );
      setBusy(false);
    }
  }
  const artifact = (file) => {
    if (!file) return null;
    if (mode === "live")
      return activeId
        ? `/api/runs/${activeId}/artifact?path=${encodeURIComponent(file)}`
        : null;
    const mapped = recording?.item.artifacts[file];
    return mapped
      ? `${import.meta.env.BASE_URL}runs/${recording.item.id}/${mapped}`
      : null;
  };
  function restart() {
    stop();
    setRun(empty());
  }
  function step() {
    stop();
    if (!recording) return;
    const current = currentRun.current;
    if (current.summary) {
      setRun(empty());
      return;
    }
    const next = recording.events[current.events.length];
    if (next) apply(next);
  }
  return {
    mode,
    agent,
    manifest,
    selected,
    setSelected,
    recording,
    policy,
    setPolicy,
    pay,
    setPay,
    confirmed,
    setConfirmed,
    run,
    busy,
    playing,
    error,
    connection,
    profile,
    info,
    balances,
    working,
    localDev,
    connect,
    changeMode,
    listen,
    activeId,
    start,
    artifact,
    restart,
    step,
  };
}
