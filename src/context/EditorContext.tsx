"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
  type Dispatch,
} from "react";
import type {
  ClusterDefinition,
  ClusterTypeName,
  NetworkDefinition,
} from "@/lib/form-structure";

// ─── State ──────────────────────────────────────────────────────────────────

export type ActiveTab = "clusters" | "networks" | "carbonCopy" | "logs";
export type EditorMode = "select" | "create" | "network" | "carbonCopy";
export type ConfidenceFilter = "all" | "high" | "medium" | "low";

export type EditorState = {
  activeTab: ActiveTab;
  activeSheet: number;
  selectedId: string | null;
  selectedIds: Set<string>;
  selectedNetworkId: string | null;
  selectedSourceId: string | null;
  editorMode: EditorMode;
  filterType: ClusterTypeName | "all";
  filterConfidence: ConfidenceFilter;
  searchQuery: string;
  showNetworkLines: boolean;
  showCarbonCopyLines: boolean;
  leftPanelExpanded: boolean;
  rightPanelExpanded: boolean;
  // Network/CC creation mode intermediate state
  networkFromId: string | null;
  carbonCopyFromId: string | null;
};

const initialState: EditorState = {
  activeTab: "clusters",
  activeSheet: 0,
  selectedId: null,
  selectedIds: new Set(),
  selectedNetworkId: null,
  selectedSourceId: null,
  editorMode: "select",
  filterType: "all",
  filterConfidence: "all",
  searchQuery: "",
  showNetworkLines: true,
  showCarbonCopyLines: true,
  leftPanelExpanded: true,
  rightPanelExpanded: true,
  networkFromId: null,
  carbonCopyFromId: null,
};

// ─── Actions ────────────────────────────────────────────────────────────────

export type EditorAction =
  | { type: "SET_ACTIVE_TAB"; tab: ActiveTab }
  | { type: "SET_ACTIVE_SHEET"; sheet: number }
  | { type: "SET_SELECTED_ID"; id: string | null }
  | { type: "SET_SELECTED_IDS"; ids: Set<string> }
  | { type: "SET_SELECTED_NETWORK_ID"; id: string | null }
  | { type: "SET_SELECTED_SOURCE_ID"; id: string | null }
  | { type: "SET_EDITOR_MODE"; mode: EditorMode }
  | { type: "SET_FILTER_TYPE"; filterType: ClusterTypeName | "all" }
  | { type: "SET_FILTER_CONFIDENCE"; level: ConfidenceFilter }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "TOGGLE_NETWORK_LINES" }
  | { type: "TOGGLE_CARBON_COPY_LINES" }
  | { type: "TOGGLE_LEFT_PANEL" }
  | { type: "TOGGLE_RIGHT_PANEL" }
  | { type: "SET_LEFT_PANEL"; expanded: boolean }
  | { type: "SET_RIGHT_PANEL"; expanded: boolean }
  | { type: "SET_NETWORK_FROM_ID"; id: string | null }
  | { type: "SET_CARBON_COPY_FROM_ID"; id: string | null }
  | { type: "DESELECT_ALL" }
  | { type: "SELECT_CLUSTER"; id: string; multi: boolean }
  | { type: "RUBBER_BAND_SELECT"; ids: Set<string> };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.tab };
    case "SET_ACTIVE_SHEET":
      return {
        ...state,
        activeSheet: action.sheet,
        selectedId: null,
        selectedIds: new Set(),
      };
    case "SET_SELECTED_ID":
      return { ...state, selectedId: action.id };
    case "SET_SELECTED_IDS":
      return { ...state, selectedIds: action.ids };
    case "SET_SELECTED_NETWORK_ID":
      return { ...state, selectedNetworkId: action.id };
    case "SET_SELECTED_SOURCE_ID":
      return { ...state, selectedSourceId: action.id };
    case "SET_EDITOR_MODE":
      return {
        ...state,
        editorMode: action.mode,
        networkFromId: null,
        carbonCopyFromId: null,
      };
    case "SET_FILTER_TYPE":
      return { ...state, filterType: action.filterType };
    case "SET_FILTER_CONFIDENCE":
      return { ...state, filterConfidence: action.level };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };
    case "TOGGLE_NETWORK_LINES":
      return { ...state, showNetworkLines: !state.showNetworkLines };
    case "TOGGLE_CARBON_COPY_LINES":
      return { ...state, showCarbonCopyLines: !state.showCarbonCopyLines };
    case "TOGGLE_LEFT_PANEL":
      return { ...state, leftPanelExpanded: !state.leftPanelExpanded };
    case "TOGGLE_RIGHT_PANEL":
      return { ...state, rightPanelExpanded: !state.rightPanelExpanded };
    case "SET_LEFT_PANEL":
      return { ...state, leftPanelExpanded: action.expanded };
    case "SET_RIGHT_PANEL":
      return { ...state, rightPanelExpanded: action.expanded };
    case "SET_NETWORK_FROM_ID":
      return { ...state, networkFromId: action.id };
    case "SET_CARBON_COPY_FROM_ID":
      return { ...state, carbonCopyFromId: action.id };
    case "DESELECT_ALL":
      return { ...state, selectedId: null, selectedIds: new Set() };
    case "SELECT_CLUSTER": {
      if (action.multi) {
        const next = new Set(state.selectedIds);
        if (next.has(action.id)) next.delete(action.id);
        else next.add(action.id);
        return { ...state, selectedId: action.id, selectedIds: next };
      }
      return {
        ...state,
        selectedId: action.id,
        selectedIds: new Set([action.id]),
      };
    }
    case "RUBBER_BAND_SELECT": {
      const first = action.ids.values().next().value;
      return {
        ...state,
        selectedIds: action.ids,
        selectedId: first ?? null,
      };
    }
    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

type EditorContextValue = {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditorState() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorState must be used within EditorProvider");
  return ctx.state;
}

export function useEditorDispatch() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorDispatch must be used within EditorProvider");
  return ctx.dispatch;
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
