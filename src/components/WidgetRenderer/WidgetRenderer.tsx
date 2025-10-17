import React, { type ReactNode, useMemo } from "react";
import WidgetRegistry from "@components/WidgetRegistry/WidgetRegistry";
import { useEditorContext } from "@src/context/useEditorContext";
import type { MultiWidgetPropertyUpdates, Widget } from "@src/types/widgets";
import { Rnd, type Position, type RndDragEvent, type DraggableData } from "react-rnd";
import { COLORS, EDIT_MODE, FRONT_UI_ZIDX } from "@src/constants/constants";
import "./WidgetRenderer.css";
import type { DOMRectLike } from "@src/context/useWidgetManager";

interface RendererProps {
  scale: number;
  ensureGridCoordinate: (coord: number) => number;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  isPanning: boolean;
}

/**
 * WidgetRenderer is responsible for rendering all editor widgets and handling their interactions.
 *
 * @features
 * - Rendering individual widgets from the WidgetRegistry
 * - Supporting multi-selection and group manipulation
 * - Dragging and resizing widgets with snapping to grid
 * - Updating widget properties in the editor context
 *
 * @param scale Current zoom level of the grid
 * @param ensureGridCoordinate Function to snap items to grid (if snap activated)
 * @param setIsDragging Callback to indicate dragging state
 * @param isPanning Boolean to indicate if GridZone is panning
 */

const WidgetRenderer: React.FC<RendererProps> = ({
  scale,
  ensureGridCoordinate,
  setIsDragging,
  isPanning,
}) => {
  const {
    mode,
    editorWidgets,
    updateWidgetProperties,
    batchWidgetUpdate,
    selectedWidgetIDs,
    selectedWidgets,
    selectionBounds,
    computeGroupBounds,
    groups,
  } = useEditorContext();

  const inEditMode = mode === EDIT_MODE;
  const isMultipleSelect = selectedWidgetIDs.length > 1;

  function renderWidget(widget: Widget): ReactNode {
    const Comp = WidgetRegistry[widget.widgetName]?.component;
    return Comp ? <Comp data={widget} /> : <div>Unknown widget</div>;
  }

  const handleDragStop = (_e: RndDragEvent, d: DraggableData, w: Widget) => {
    if (w.editableProperties.x?.value === d.x && w.editableProperties.y?.value === d.y) return;
    setIsDragging(false);
    updateWidgetProperties(w.id, {
      x: ensureGridCoordinate(d.x),
      y: ensureGridCoordinate(d.y),
    });
  };

  const handleResizeStop = (ref: HTMLElement, position: Position, w: Widget) => {
    setIsDragging(false);
    const newWidth = ensureGridCoordinate(parseInt(ref.style.width));
    const newHeight = ensureGridCoordinate(parseInt(ref.style.height));
    const newX = ensureGridCoordinate(position.x);
    const newY = ensureGridCoordinate(position.y);

    if (
      w.editableProperties.width?.value === newWidth &&
      w.editableProperties.height?.value === newHeight
    )
      return;

    updateWidgetProperties(w.id, { width: newWidth, height: newHeight, x: newX, y: newY });
  };

  const handleGroupDragStop = (dx: number, dy: number, widgets: Widget[]) => {
    setIsDragging(false);
    const updates: MultiWidgetPropertyUpdates = {};
    widgets.forEach((w) => {
      const x = w.editableProperties.x!.value + dx;
      const y = w.editableProperties.y!.value + dy;
      updates[w.id] = { x: ensureGridCoordinate(x), y: ensureGridCoordinate(y) };
    });
    batchWidgetUpdate(updates);
  };

  const handleGroupResizeStop = (ref: HTMLElement, bounds: DOMRectLike, widgets: Widget[]) => {
    setIsDragging(false);
    const newGroupWidth = ref.offsetWidth;
    const newGroupHeight = ref.offsetHeight;
    const scaleX = newGroupWidth / bounds.width;
    const scaleY = newGroupHeight / bounds.height;
    const updates: MultiWidgetPropertyUpdates = {};
    widgets.forEach((w) => {
      const { width, height, x, y } = {
        width: w.editableProperties.width!.value,
        height: w.editableProperties.height!.value,
        x: w.editableProperties.x!.value,
        y: w.editableProperties.y!.value,
      };
      const relativeX = x - bounds.x;
      const relativeY = y - bounds.y;
      updates[w.id] = {
        width: ensureGridCoordinate(width * scaleX),
        height: ensureGridCoordinate(height * scaleY),
        x: ensureGridCoordinate(bounds.x + relativeX * scaleX),
        y: ensureGridCoordinate(bounds.y + relativeY * scaleY),
      };
    });

    batchWidgetUpdate(updates);
  };

  const handleSelGroupDragStop = (dx: number, dy: number) => {
    setIsDragging(false);
    const updates: MultiWidgetPropertyUpdates = {};
    selectedWidgets.forEach((widget) => {
      const xProp = widget.editableProperties.x;
      const yProp = widget.editableProperties.y;
      if (!xProp || !yProp) return;
      updates[widget.id] = {
        x: ensureGridCoordinate(xProp.value + dx),
        y: ensureGridCoordinate(yProp.value + dy),
      };
    });
    batchWidgetUpdate(updates);
  };

  const renderSelectionBox = () =>
    isMultipleSelect &&
    selectionBounds && (
      <Rnd
        className="selectionBox"
        id="selectionBox"
        bounds="window"
        scale={scale}
        disableDragging={!inEditMode || isPanning}
        size={{ width: selectionBounds.width, height: selectionBounds.height }}
        position={{ x: selectionBounds.x, y: selectionBounds.y }}
        onDrag={() => setIsDragging(true)}
        onDragStop={(_e, d) => {
          const dx = d.x - selectionBounds.x;
          const dy = d.y - selectionBounds.y;
          handleSelGroupDragStop(dx, dy);
        }}
        onResize={() => setIsDragging(true)}
        onResizeStop={(_e, _dir, ref) =>
          handleGroupResizeStop(ref, selectionBounds, selectedWidgets)
        }
        style={{
          outline: "1px dashed",
          zIndex: FRONT_UI_ZIDX - 1,
        }}
      >
        {selectedWidgets.map((w) => (
          <div
            key={w.id}
            className="selectable selected"
            style={{
              width: w.editableProperties.width!.value,
              height: w.editableProperties.height!.value,
              left: w.editableProperties.x!.value - selectionBounds.x,
              top: w.editableProperties.y!.value - selectionBounds.y,
              pointerEvents: isPanning ? "none" : "auto",
            }}
          >
            {renderWidget(w)}
          </div>
        ))}
      </Rnd>
    );

  const renderGroups = () =>
    groups.map(([groupId, groupWidgets]) => {
      const groupBounds = computeGroupBounds(groupWidgets.map((w) => w.id));
      if (!groupBounds) return null;
      const isGroupSelected = groupWidgets.every((w) => selectedWidgetIDs.includes(w.id));
      return (
        <Rnd
          key={groupId}
          id={groupId}
          className={`groupBox ${isGroupSelected ? "selected" : " "}`}
          bounds="window"
          scale={scale}
          disableDragging={!inEditMode || isPanning}
          size={{ width: groupBounds.width, height: groupBounds.height }}
          position={{ x: groupBounds.x, y: groupBounds.y }}
          onResize={() => setIsDragging(true)}
          onDrag={() => setIsDragging(true)}
          onDragStop={(_e, d) => {
            const dx = d.x - groupBounds.x;
            const dy = d.y - groupBounds.y;
            handleGroupDragStop(dx, dy, groupWidgets);
          }}
          onResizeStop={(_e, _dir, ref) => handleGroupResizeStop(ref, groupBounds, groupWidgets)}
          style={{
            outline: isGroupSelected
              ? `2px dashed ${COLORS.highlighted}`
              : inEditMode
              ? "1px dotted rgba(0,0,0,0.27)"
              : "none",
            boxShadow: isGroupSelected ? "2 2 2px rgba(33, 150, 243, 0.5)" : "none",
          }}
        >
          {groupWidgets.map((w) => (
            <div
              key={w.id}
              className="selectable"
              style={{
                width: w.editableProperties.width!.value,
                height: w.editableProperties.height!.value,
                left: w.editableProperties.x!.value - groupBounds.x,
                top: w.editableProperties.y!.value - groupBounds.y,
              }}
            >
              {renderWidget(w)}
            </div>
          ))}
        </Rnd>
      );
    });

  // Render ungrouped or individually selected widgets
  const renderUngroupedWidgets = () =>
    editorWidgets.map((w) => {
      const isGrouped = !!w.groupId;
      const isInSelectionBox = selectedWidgetIDs.includes(w.id) && isMultipleSelect;
      if (isGrouped || isInSelectionBox) return null; // handled by group or selection
      const isOnlySelected = selectedWidgetIDs.includes(w.id) && !isMultipleSelect;

      return (
        <Rnd
          key={w.id}
          id={w.id}
          bounds="window"
          scale={scale}
          className={`selectable ${isOnlySelected ? "selected" : ""}`}
          disableDragging={!inEditMode || isPanning}
          enableResizing={inEditMode && !isPanning}
          size={{
            width: w.editableProperties.width?.value ?? 0,
            height: w.editableProperties.height?.value ?? 0,
          }}
          position={{
            x: w.editableProperties.x?.value ?? 0,
            y: w.editableProperties.y?.value ?? 0,
          }}
          onDrag={() => setIsDragging(true)}
          onDragStop={(_e, d) => handleDragStop(_e, d, w)}
          onResizeStart={() => setIsDragging(true)}
          onResizeStop={(_e, _direction, ref, _delta, position) =>
            handleResizeStop(ref, position, w)
          }
        >
          {renderWidget(w)}
        </Rnd>
      );
    });

  return (
    <>
      {renderSelectionBox()}
      {renderGroups()}
      {renderUngroupedWidgets()}
    </>
  );
};
export default WidgetRenderer;
