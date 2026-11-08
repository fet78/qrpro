"use client";

import { useCallback, useReducer, useRef } from "react";
import { normalizeDoc, newId, type Element, type LabelDoc } from "@/lib/labels/doc";

/**
 * État de l'éditeur : document courant, historique (annuler / rétablir) et sélection.
 * Toute modification passe par normalizeDoc : le QR reste valide quoi qu'il arrive.
 */
interface State {
  doc: LabelDoc;
  past: LabelDoc[];
  future: LabelDoc[];
  selected: string | null;
  /** État d'avant une série de changements provisoires (glisser, curseur) : c'est lui qu'on annule. */
  pending: LabelDoc | null;
}

type Action =
  | { type: "set"; doc: LabelDoc; commit: boolean; edited?: boolean }
  | { type: "commit" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; id: string | null };

const LIMIT = 80;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "set": {
      const doc = normalizeDoc({ ...a.doc, edited: a.edited ?? true });
      if (!a.commit) return { ...s, doc, pending: s.pending ?? s.doc };
      return { ...s, doc, past: [...s.past, s.pending ?? s.doc].slice(-LIMIT), future: [], pending: null };
    }
    case "commit":
      if (!s.pending) return s;
      return { ...s, past: [...s.past, s.pending].slice(-LIMIT), future: [], pending: null };
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return { ...s, pending: null, doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], selected: prev.elements.some((e) => e.id === s.selected) ? s.selected : null };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return { ...s, pending: null, doc: next, past: [...s.past, s.doc], future: s.future.slice(1), selected: next.elements.some((e) => e.id === s.selected) ? s.selected : null };
    }
    case "select":
      return { ...s, selected: a.id };
  }
}

export function useEditor(initial: LabelDoc) {
  const [state, dispatch] = useReducer(reducer, { doc: normalizeDoc(initial), past: [], future: [], selected: null, pending: null });
  const docRef = useRef(state.doc);
  docRef.current = state.doc;

  const setDoc = useCallback((doc: LabelDoc, commit = true, edited = true) => dispatch({ type: "set", doc, commit, edited }), []);
  const update = useCallback((id: string, patch: Partial<Element>, commit = true) => {
    const d = docRef.current;
    dispatch({ type: "set", commit, doc: { ...d, elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as Element) : e)) } });
  }, []);
  /** Ajoute un élément au premier plan (sous le QR), ou tout au fond avec `back` (motifs, aplats). */
  const add = useCallback((el: Element, opts: { back?: boolean } = {}) => {
    const d = docRef.current;
    const qr = d.elements.filter((e) => e.type === "qr");
    const others = d.elements.filter((e) => e.type !== "qr");
    dispatch({ type: "set", commit: true, doc: { ...d, elements: opts.back ? [el, ...others, ...qr] : [...others, el, ...qr] } });
    dispatch({ type: "select", id: el.id });
  }, []);
  const remove = useCallback((id: string) => {
    const d = docRef.current;
    const el = d.elements.find((e) => e.id === id);
    if (!el || el.type === "qr") return;
    dispatch({ type: "set", commit: true, doc: { ...d, elements: d.elements.filter((e) => e.id !== id) } });
    dispatch({ type: "select", id: null });
  }, []);
  const duplicate = useCallback((id: string) => {
    const d = docRef.current;
    const el = d.elements.find((e) => e.id === id);
    if (!el || el.type === "qr") return;
    const copy = { ...el, id: newId(el.type), x: el.x + 2, y: el.y + 2, locked: false } as Element;
    const i = d.elements.indexOf(el);
    const elements = [...d.elements];
    elements.splice(i + 1, 0, copy);
    dispatch({ type: "set", commit: true, doc: { ...d, elements } });
    dispatch({ type: "select", id: copy.id });
  }, []);
  /** Ordre des calques : le QR reste toujours au premier plan (dernier du tableau). */
  const reorder = useCallback((id: string, to: "up" | "down" | "front" | "back") => {
    const d = docRef.current;
    const others = d.elements.filter((e) => e.type !== "qr");
    const qr = d.elements.filter((e) => e.type === "qr");
    const i = others.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [el] = others.splice(i, 1);
    const j = to === "front" ? others.length : to === "back" ? 0 : to === "up" ? Math.min(others.length, i + 1) : Math.max(0, i - 1);
    others.splice(j, 0, el!);
    dispatch({ type: "set", commit: true, doc: { ...d, elements: [...others, ...qr] } });
  }, []);

  return {
    doc: state.doc,
    selected: state.selected,
    selectedEl: state.doc.elements.find((e) => e.id === state.selected) ?? null,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    docRef,
    setDoc,
    update,
    add,
    remove,
    duplicate,
    reorder,
    select: useCallback((id: string | null) => dispatch({ type: "select", id }), []),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
    /** Valide la série de changements provisoires en cours (fin d'un glisser) dans l'historique. */
    commit: useCallback(() => dispatch({ type: "commit" }), []),
  };
}

export type EditorApi = ReturnType<typeof useEditor>;
