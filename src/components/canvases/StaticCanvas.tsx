import React, { useEffect } from "react";
import { RoughCanvas } from "roughjs/bin/canvas";
import { renderStaticScene } from "../../renderer/renderScene";
import { isShallowEqual } from "../../utils";
import type { AppState, StaticCanvasAppState } from "../../types";
import type { StaticCanvasRenderConfig } from "../../scene/types";
import type { NonDeletedExcalidrawElement } from "../../element/types";

type StaticCanvasProps = {
  canvas: HTMLCanvasElement | null;
  rc: RoughCanvas | null;
  elements: readonly NonDeletedExcalidrawElement[];
  mutationNonce: number | undefined;
  selectionNonce: number | undefined;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
  handleCanvasRef: (canvas: HTMLCanvasElement) => void;
};

const StaticCanvas = (props: StaticCanvasProps) => {
  useEffect(() => {
    renderStaticScene(
      {
        scale: window.devicePixelRatio,
        elements: props.elements,
        canvas: props.canvas,
        rc: props.rc!,
        appState: props.appState,
        renderConfig: props.renderConfig,
      },
      window.EXCALIDRAW_THROTTLE_NEXT_RENDER && window.EXCALIDRAW_THROTTLE_RENDER === true,
    );

    if (!window.EXCALIDRAW_THROTTLE_NEXT_RENDER) {
      window.EXCALIDRAW_THROTTLE_NEXT_RENDER = true;
    }
  });

  return (
    <canvas
      className="excalidraw__canvas"
      style={{
        width: props.appState.width,
        height: props.appState.height,
        pointerEvents: "none",
      }}
      width={props.appState.width * window.devicePixelRatio} // FIXME II: could be re-used across canvases
      height={props.appState.height * window.devicePixelRatio}
      ref={props.handleCanvasRef}
    />
  );
};

const stripIrrelevantAppStateProps = (
  appState: AppState,
): Omit<StaticCanvasAppState, "selectedElementIds"> => ({
  zoom: appState.zoom,
  scrollX: appState.scrollX,
  scrollY: appState.scrollY,
  width: appState.width,
  height: appState.height,
  viewModeEnabled: appState.viewModeEnabled,
  editingElement: appState.editingElement,
  editingGroupId: appState.editingGroupId,
  editingLinearElement: appState.editingLinearElement,
  // selectedElementIds: appState.selectedElementIds,
  frameToHighlight: appState.frameToHighlight,
  offsetLeft: appState.offsetLeft,
  offsetTop: appState.offsetTop,
  theme: appState.theme,
  pendingImageElementId: appState.pendingImageElementId,
  shouldCacheIgnoreZoom: appState.shouldCacheIgnoreZoom,
  viewBackgroundColor: appState.viewBackgroundColor,
  exportScale: appState.exportScale,
  selectedElementsAreBeingDragged: appState.selectedElementsAreBeingDragged,
  gridSize: appState.gridSize,
  shouldRenderFrames: appState.shouldRenderFrames,
});

const areEqual = (
  prevProps: StaticCanvasProps,
  nextProps: StaticCanvasProps,
) => {
  if (prevProps.mutationNonce !== nextProps.mutationNonce) {
    return false;
  }

  return isShallowEqual(
    // asserting AppState because we're being passed the whole AppState
    // but resolve to only the InteractiveCanvas-relevant props
    stripIrrelevantAppStateProps(prevProps.appState as AppState),
    stripIrrelevantAppStateProps(nextProps.appState as AppState),
    {},
    true,
  );
};

// FIXME I: add custom/deep comparator - static canvases renders even when it shouldn't
export default React.memo(StaticCanvas, areEqual);
