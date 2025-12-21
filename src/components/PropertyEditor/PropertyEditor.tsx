import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { styled } from "@mui/material/styles";
import { Drawer as MuiDrawer } from "@mui/material";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { useEditorContext } from "@src/context/useEditorContext";
import type {
  WidgetProperties,
  PropertyValue,
  PropertyKey,
  WidgetProperty,
  MultiWidgetPropertyUpdates,
} from "@src/types/widgets";
import { FRONT_UI_ZIDX } from "@src/constants/constants";
import { CATEGORY_DISPLAY_ORDER } from "@src/types/widgetProperties";
import PropertyGroups from "./PropertyGroups";

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
    setPropertyEditorFocused,
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
  const paperRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(drawerWidth);

  useEffect(() => {
    widthRef.current = drawerWidth;
  }, [drawerWidth]);

  const properties: WidgetProperties = useMemo(() => {
    if (editingWidgets.length === 0) return {};
    if (singleWidget) {
      return editingWidgets[0].editableProperties;
    }
    // Get only common properties
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
    if (!isOnlyGridSelected) {
      setOpen(true);
      return;
    }
    if (!pinned) setOpen(false);
  }, [pinned, isOnlyGridSelected]);

  const toggleDrawer = () => {
    setOpen((prev) => !prev);
  };

  const togglePin = () => {
    setPinned((prev) => !prev);
  };

  const toggleGroup = useCallback((category: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [category]: !(prev[category] ?? true),
    }));
  }, []);

  const header = singleWidget
    ? `${editingWidgets[0].widgetLabel} properties`
    : "Common properties in selection";
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

  if (!inEditMode) return null;
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
        onFocus={() => setPropertyEditorFocused(true)}
        onBlur={() => setPropertyEditorFocused(false)}
        sx={{ zIndex: FRONT_UI_ZIDX + 1 }}
        slotProps={{
          paper: {
            ref: paperRef,
            style: { width: open ? drawerWidth : 0 },
          },
        }}
      >
        <ResizeHandle onMouseDown={startResize} />
        <Toolbar />
        <List sx={{ width: "100%" }}>
          <ListItem
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
          <PropertyGroups
            groupedProperties={groupedProperties}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            onChange={handlePropChange}
          />
        </List>
      </Drawer>
    </>
  );
};

export default PropertyEditor;
