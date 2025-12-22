import { useState, useEffect, useRef, useCallback } from "react";
import { EDIT_MODE, type Mode } from "@src/constants/constants";
import { useWidgetManager } from "./useWidgetManager";
import type { ExportedWidget, Widget } from "@src/types/widgets";
import useEpicsWS from "./useEpicsWS";
import {
  authService,
  Roles,
  type OAuthProvider,
  type User,
  type AuthStatus,
  AuthStatuses,
} from "@src/services/AuthService/AuthService";

/**
 * Hook that manages global UI state for WEISS.
 */
export default function useUIManager(
  ws: ReturnType<typeof useEpicsWS>,
  editorWidgets: ReturnType<typeof useWidgetManager>["editorWidgets"],
  setSelectedWidgetIDs: ReturnType<typeof useWidgetManager>["setSelectedWidgetIDs"],
  loadWidgets: ReturnType<typeof useWidgetManager>["loadWidgets"],
  formatWdgToExport: ReturnType<typeof useWidgetManager>["formatWdgToExport"]
) {
  const [releaseShortcuts, setReleaseShortcuts] = useState(false);
  const [wdgPickerOpen, setWdgPickerOpen] = useState(false);
  const [pickedWidget, setPickedWidget] = useState<Widget | null>(null);
  const [mode, setMode] = useState<Mode>(EDIT_MODE);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [user, setUser] = useState<User | null>(() => authService.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    authService.isAuthenticated()
  );
  const loadedRef = useRef(false);
  const inEditMode = mode === EDIT_MODE;
  const RECONNECT_TIMEOUT = 3000;
  const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

  useEffect(() => {
    const authHandlers = {
      onAuthStatusChange(status: AuthStatus, user: User | null) {
        setUser(user);
        setIsAuthenticated(status === AuthStatuses.AUTHENTICATED);
      },
      onLogout() {
        // Additional logout handling if needed
        // maybe redirect to login page? to be decided
      },
    };

    const unsubscribe = authService.subscribe(authHandlers);
    return unsubscribe;
  }, []);

  const login = useCallback(
    async (provider: OAuthProvider, demoProfile?: Roles) => {
      if (isAuthenticated) return;
      await authService.login(provider, demoProfile);
    },
    [isAuthenticated]
  );

  const logout = useCallback(() => {
    authService.logout();
  }, []);

  const updateMode = useCallback(
    (newMode: Mode) => {
      const isEdit = newMode === EDIT_MODE;
      if (isEdit) {
        ws.stopSession();
      } else {
        setSelectedWidgetIDs([]);
        setWdgPickerOpen(false);
        ws.startNewSession();
      }
      setMode(newMode);
    },
    [setSelectedWidgetIDs, ws]
  );

  /**
   * Handles WS reconnection when needed
   */
  useEffect(() => {
    if (inEditMode || ws.wsConnected) return;

    let triedReconnect = false;

    const intervalId = setInterval(() => {
      if (!inEditMode && !ws.wsConnected) {
        triedReconnect = true;
        console.warn("Socket disconnected. Attempting reconnection...");
        ws.startNewSession();
      }
    }, RECONNECT_TIMEOUT);

    return () => {
      clearInterval(intervalId);
      if (triedReconnect) {
        console.log("Reconnected.");
      }
    };
  }, [inEditMode, ws]);

  /**
   * Load widgets from localStorage on component mount.
   * This runs only once and initializes the editor with saved layout if available.
   */
  useEffect(() => {
    if (!loadedRef.current) {
      const saved = localStorage.getItem("editorWidgets");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ExportedWidget[];
          if (parsed.length > 1) loadWidgets(parsed);
        } catch (err) {
          console.error("Failed to load widgets from localStorage:", err);
        }
      }
      loadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Save widgets to localStorage whenever they change.
   * Only writes while in edit mode to avoid saving runtime PV updates.
   */
  useEffect(() => {
    if (inEditMode) {
      try {
        const exportable = editorWidgets.map(formatWdgToExport);
        localStorage.setItem("editorWidgets", JSON.stringify(exportable));
      } catch (err) {
        console.error("Failed to save widgets:", err);
      }
    }
  }, [editorWidgets, inEditMode, formatWdgToExport]);

  return {
    releaseShortcuts,
    setReleaseShortcuts,
    mode,
    updateMode,
    wdgPickerOpen,
    setWdgPickerOpen,
    pickedWidget,
    setPickedWidget,
    inEditMode,
    isDragging,
    setIsDragging,
    isPanning,
    setIsPanning,
    isDemo,
    user,
    isAuthenticated,
    login,
    logout,
  };
}
