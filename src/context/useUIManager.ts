import { useState, useEffect, useCallback, useRef } from "react";
import { EDIT_MODE, RUNTIME_MODE, type Mode } from "@src/constants/constants";
import { useWidgetManager } from "./useWidgetManager";
import type { Widget } from "@src/types/widgets";
import useEpicsWS from "./useEpicsWS";
import {
  authService,
  Roles,
  type OAuthProvider,
  type AuthStatus,
  AuthStatuses,
} from "@src/services/AuthService/AuthService";
import { notifyUser } from "@src/services/Notifications/Notification";
import {
  getAllDeployedReposTree,
  getAllReposTree,
  type RepoTreeInfo,
  type User,
} from "@src/services/APIClient";

/**
 * Hook that manages global UI state for WEISS.
 */
export default function useUIManager(
  ws: ReturnType<typeof useEpicsWS>,
  setSelectedWidgetIDs: ReturnType<typeof useWidgetManager>["setSelectedWidgetIDs"],
  fileLoadedTrig: ReturnType<typeof useWidgetManager>["fileLoadedTrig"],
) {
  const lastFileLoadedTrig = useRef(0);
  const [releaseShortcuts, setReleaseShortcuts] = useState(false);
  const [wdgPickerOpen, setWdgPickerOpen] = useState(false);
  const [pickedWidget, setPickedWidget] = useState<Widget | null>(null);
  const [mode, setMode] = useState<Mode>(EDIT_MODE);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [user, setUser] = useState<User | null>(() => authService.getUser());
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reposTreeInfo, setReposTreeInfo] = useState<RepoTreeInfo[] | null>(null);
  const inEditMode = mode === EDIT_MODE;
  const RECONNECT_TIMEOUT = 3000;
  const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
  const isDeveloper = user?.role === Roles.DEVELOPER;

  const updateReposTreeInfo = useCallback(async () => {
    try {
      const response = isDeveloper ? await getAllReposTree() : await getAllDeployedReposTree();
      const data = response.data;
      setReposTreeInfo(data.length > 0 ? data : null);
    } catch (error) {
      notifyUser(`Failed to fetch repositories: ${String(error)}`, "error");
    }
  }, [isDeveloper]);

  useEffect(() => {
    if (authChecked) return;
    void authService.restoreSession().finally(() => setAuthChecked(true));
  }, [authChecked]);

  // ensure session is restored after file change
  useEffect(() => {
    if (!inEditMode) {
      ws.startNewSession();
      lastFileLoadedTrig.current = fileLoadedTrig;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileLoadedTrig]);

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
    [setSelectedWidgetIDs, ws],
  );

  useEffect(() => {
    const authHandlers = {
      onAuthStatusChange(status: AuthStatus, user: User | null) {
        setUser(user);
        setIsAuthenticated(status === AuthStatuses.AUTHENTICATED);
        if (user?.role === Roles.OPERATOR) {
          updateMode(RUNTIME_MODE);
        }
      },
      onLogout() {
        // Additional logout handling if needed
      },
    };

    const unsubscribe = authService.subscribe(authHandlers);
    return unsubscribe;
  }, [updateMode]);

  const login = useCallback(
    async (provider: OAuthProvider, demoProfile?: Roles) => {
      if (isAuthenticated) return;
      await authService.login(provider, demoProfile);
    },
    [isAuthenticated],
  );

  const logout = useCallback(() => {
    void authService.logout();
  }, []);

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
        notifyUser("Connection lost. Attempting to reconnect...", "warning");
        ws.startNewSession();
      }
    }, RECONNECT_TIMEOUT);

    return () => {
      clearInterval(intervalId);
      if (triedReconnect) {
        notifyUser("Reconnected to server.", "success");
      }
    };
  }, [inEditMode, ws]);

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
    isDeveloper,
    authChecked,
    isAuthenticated,
    login,
    logout,
    reposTreeInfo,
    setReposTreeInfo,
    updateReposTreeInfo,
  };
}
