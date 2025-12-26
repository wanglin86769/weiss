import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { styled } from "@mui/material/styles";
import { Divider, Drawer as MuiDrawer, Tab, Tabs } from "@mui/material";
import Toolbar from "@mui/material/Toolbar";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { useEditorContext } from "@src/context/useEditorContext";
import ModeEditIcon from "@mui/icons-material/ModeEdit";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import type {
  WidgetProperties,
  PropertyValue,
  PropertyKey,
  WidgetProperty,
  MultiWidgetPropertyUpdates,
} from "@src/types/widgets";
import { API_URL, FRONT_UI_ZIDX } from "@src/constants/constants";
import { CATEGORY_DISPLAY_ORDER } from "@src/types/widgetProperties";
import PropertyGroups from "./PropertyGroups";
import RepoTree, { type TreeNode } from "./FileNavigator";
import { notifyUser } from "@src/services/Notifications/Notification";

const Drawer = styled(MuiDrawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    right: 0,
    height: "100vh",
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
}));

const ToggleButton = styled(IconButton)<{ open: boolean; drawerWidth: number }>(
  ({ theme, open, drawerWidth }) => ({
    position: "fixed",
    top: (theme.mixins.toolbar.minHeight as number) + 16,
    right: open ? drawerWidth + 8 : 8,
    zIndex: theme.zIndex.drawer + 2,
    background: theme.palette.background.paper,
    boxShadow: theme.shadows[2],
    "&:hover": {
      background: theme.palette.background.default,
    },
  })
);

const ResizeHandle = styled("div")({
  position: "absolute",
  width: 10,
  height: "100%",
  cursor: "col-resize",
  zIndex: FRONT_UI_ZIDX,
});

const getGroupedProperties = (properties: WidgetProperties) => {
  const groups: Record<string, Record<string, WidgetProperty>> = {};
  if (!properties) return groups;

  const presentCategories = new Set(Object.values(properties).map((prop) => prop.category));
  CATEGORY_DISPLAY_ORDER.filter((cat) => presentCategories.has(cat)).forEach((cat) => {
    groups[cat] = {};
  });

  Array.from(presentCategories)
    .filter((cat) => !CATEGORY_DISPLAY_ORDER.includes(cat))
    .forEach((cat) => {
      groups[cat] = {};
    });

  for (const [propName, prop] of Object.entries(properties)) {
    const category = prop.category ?? "Other";
    groups[category][propName] = prop;
  }

  // put booleans and colors last
  for (const category of Object.keys(groups)) {
    const entries = Object.entries(groups[category]);

    const sorted = [
      ...entries.filter(
        ([, p]) =>
          p.selType !== "boolean" && p.selType !== "colorSel" && p.selType !== "colorSelList"
      ),
      ...entries.filter(([, p]) => p.selType === "colorSelList"),
      ...entries.filter(([, p]) => p.selType === "colorSel"),
      ...entries.filter(([, p]) => p.selType === "boolean"),
    ];

    groups[category] = Object.fromEntries(sorted);
  }

  return groups;
};

/**
 * PropertyEditor renders the side panel that allows editing properties of the selected widgets.
 */
const PropertyEditor: React.FC = () => {
  const {
    inEditMode,
    selectedWidgetIDs,
    editingWidgets,
    batchWidgetUpdate,
    setReleaseShortcuts,
    isAuthenticated,
    isDeveloper,
  } = useEditorContext();

  const isOnlyGridSelected = selectedWidgetIDs.length === 0;
  const singleWidget = editingWidgets.length === 1;
  const DEFAULT_WIDTH = 360;
  const MIN_WIDTH = 300;
  const MAX_WIDTH = 700;
  // start with editor closed on smaller screens
  const isSmallScreen = window.innerWidth < 1024;
  const [open, setOpen] = useState(!isSmallScreen);
  const [pinned, setPinned] = useState(!isSmallScreen);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH);
  const [tabIndex, setTabIndex] = useState(0);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(drawerWidth);
  const [repoTree, setRepoTree] = useState<[TreeNode] | null>(null);

  useEffect(() => {
    const reposBaseEndpoint = `${API_URL}/repos/${isDeveloper ? "staging" : "runtime"}`;
    fetch(reposBaseEndpoint)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error fetching repositories: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("Fetched repositories:", data);
        if (data.length > 0) {
          setRepoTree(data as [TreeNode]);
        } else {
          setRepoTree(null);
        }
      })
      .catch((error) => {
        notifyUser(`Failed to fetch repositories: ${error.message}`, "error");
      });
  }, [isDeveloper]);

  useEffect(() => {
    widthRef.current = drawerWidth;
  }, [drawerWidth]);

  useEffect(() => {
    if (isAuthenticated && !inEditMode) setTabIndex(1);
  }, [isAuthenticated, inEditMode]);

  const properties: WidgetProperties = useMemo(() => {
    if (editingWidgets.length === 0) return {};
    if (singleWidget) return editingWidgets[0].editableProperties;

    // Filter only common properties
    const common: WidgetProperties = { ...editingWidgets[0].editableProperties };
    for (let i = 1; i < editingWidgets.length; i++) {
      const currentProps = editingWidgets[i].editableProperties;
      for (const key of Object.keys(common)) {
        const propName = key as PropertyKey;
        if (!(currentProps[propName] as WidgetProperty)) delete common[propName];
      }
    }

    return common;
  }, [editingWidgets, singleWidget]);

  useEffect(() => {
    if (!isOnlyGridSelected) setOpen(true);
    else if (!pinned) setOpen(false);
  }, [pinned, isOnlyGridSelected]);

  const toggleDrawer = () => setOpen((prev) => !prev);
  const togglePin = () => setPinned((prev) => !prev);
  const toggleGroup = useCallback((category: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [category]: !(prev[category] ?? true) }));
  }, []);

  const header =
    tabIndex === 0
      ? singleWidget
        ? `${editingWidgets[0].widgetLabel} properties`
        : "Common properties in selection"
      : "Browse files";
  const groupedProperties = getGroupedProperties(properties);

  const handlePropChange = (propName: PropertyKey, newValue: PropertyValue) => {
    const updates: MultiWidgetPropertyUpdates = {};
    editingWidgets.forEach((w) => {
      updates[w.id] = { [propName]: newValue };
    });
    batchWidgetUpdate(updates);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    const paper = paperRef.current;
    const handle = e.currentTarget as HTMLDivElement;
    if (!paper || !handle) return;
    paper.style.transition = "none";
    // create temporary handle overlay to avoid mouse leaving during resize
    const movingHandle = handle.cloneNode(true) as HTMLDivElement;
    movingHandle.style.position = "fixed";
    movingHandle.style.top = `${handle.getBoundingClientRect().top}px`;
    movingHandle.style.left = `${handle.getBoundingClientRect().left}px`;
    movingHandle.style.width = "50px";
    movingHandle.style.zIndex = `${2 * FRONT_UI_ZIDX}`;
    movingHandle.style.cursor = "col-resize";
    document.body.appendChild(movingHandle);

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      widthRef.current = newWidth;
      paper.style.width = `${newWidth}px`;
      movingHandle.style.left = `${ev.clientX - 30}px`;
    };

    const onUp = () => {
      paper.style.transition = "";
      document.body.removeChild(movingHandle);
      setDrawerWidth(widthRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!inEditMode && !isAuthenticated) return null;

  return (
    <>
      {!open && (
        <Tooltip title="Show properties" placement="left">
          <ToggleButton
            color="primary"
            open={open}
            drawerWidth={drawerWidth}
            onClick={toggleDrawer}
            size="small"
          >
            <ChevronLeftIcon />
          </ToggleButton>
        </Tooltip>
      )}
      <Drawer
        open={open}
        variant="permanent"
        anchor="right"
        onFocus={() => setReleaseShortcuts(true)}
        onBlur={() => setReleaseShortcuts(false)}
        sx={{ zIndex: FRONT_UI_ZIDX + 1 }}
        slotProps={{
          paper: {
            ref: paperRef,
            style: { width: open ? drawerWidth : 0, display: "flex", flexDirection: "column" },
          },
        }}
      >
        <ResizeHandle onMouseDown={startResize} />
        <Toolbar />

        {/* Header */}
        <ListItem
          sx={{ width: "100%", flex: "0 0 auto", height: 60 }}
          secondaryAction={
            <>
              <Tooltip title={pinned ? "Unpin" : "Pin"}>
                <IconButton edge="end" onClick={togglePin} size="small">
                  {pinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                </IconButton>
              </Tooltip>
              <IconButton
                edge="end"
                onClick={toggleDrawer}
                size="small"
                sx={{ display: pinned ? "none" : "auto" }}
              >
                <ChevronRightIcon />
              </IconButton>
            </>
          }
        >
          <ListItemText primary={header} />
        </ListItem>
        <Divider />
        {/* Content */}
        <div style={{ flex: "1 1 auto", overflowY: "auto" }}>
          {tabIndex === 0 ? (
            <PropertyGroups
              groupedProperties={groupedProperties}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              onChange={handlePropChange}
            />
          ) : repoTree ? (
            <div style={{ padding: 16 }}>
              <RepoTree
                root={repoTree[0]}
                onSelect={(node) => {
                  if (node.type === "file") {
                    console.log("Open file:", node.path);
                  }
                }}
              />
            </div>
          ) : (
            <div style={{ padding: 16 }}>No repositories available.</div>
          )}
        </div>

        {/* Tab selector */}
        {isAuthenticated && inEditMode && (
          <Tabs
            value={tabIndex}
            onChange={(_e, newVal: number) => setTabIndex(newVal)}
            sx={{
              flex: "0 0 auto",
              borderTop: (theme) => `1px solid ${theme.palette.divider}`,
              width: "100%",
              paddingBottom: 0.1,
            }}
          >
            <Tab
              icon={<ModeEditIcon fontSize="small" />}
              iconPosition="start"
              label="Edit"
              sx={{
                textTransform: "none",
                width: "50%",
                minHeight: 0,
                paddingTop: 1.5,
              }}
            />
            <Tab
              icon={<FormatListBulletedIcon fontSize="small" />}
              iconPosition="start"
              label="Navigate"
              sx={{
                textTransform: "none",
                width: "50%",
                minHeight: 0,
                paddingTop: 1.5,
              }}
            />
          </Tabs>
        )}
      </Drawer>
    </>
  );
};

export default PropertyEditor;
