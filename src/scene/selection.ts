import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { getElementAbsoluteCoords, getElementBounds } from "../element";
import { AppState, InteractiveCanvasAppState } from "../types";
import { isBoundToContainer } from "../element/typeChecks";
import {
  elementOverlapsWithFrame,
  getContainingFrame,
  getFrameElements,
} from "../frame";
import { isShallowEqual } from "../utils";

/**
 * Frames and their containing elements are not to be selected at the same time.
 * Given an array of selected elements, if there are frames and their containing elements
 * we only keep the frames.
 * @param selectedElements
 */
export const excludeElementsInFramesFromSelection = <
  T extends ExcalidrawElement,
>(
  selectedElements: readonly T[],
) => {
  const framesInSelection = new Set<T["id"]>();

  selectedElements.forEach((element) => {
    if (element.type === "frame") {
      framesInSelection.add(element.id);
    }
  });

  return selectedElements.filter((element) => {
    if (element.frameId && framesInSelection.has(element.frameId)) {
      return false;
    }
    return true;
  });
};

export const getElementsWithinSelection = (
  elements: readonly NonDeletedExcalidrawElement[],
  selection: NonDeletedExcalidrawElement,
  excludeElementsInFrames: boolean = true,
) => {
  const [selectionX1, selectionY1, selectionX2, selectionY2] =
    getElementAbsoluteCoords(selection);

  let elementsInSelection = elements.filter((element) => {
    let [elementX1, elementY1, elementX2, elementY2] =
      getElementBounds(element);

    const containingFrame = getContainingFrame(element);
    if (containingFrame) {
      const [fx1, fy1, fx2, fy2] = getElementBounds(containingFrame);

      elementX1 = Math.max(fx1, elementX1);
      elementY1 = Math.max(fy1, elementY1);
      elementX2 = Math.min(fx2, elementX2);
      elementY2 = Math.min(fy2, elementY2);
    }

    return (
      element.locked === false &&
      element.type !== "selection" &&
      !isBoundToContainer(element) &&
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2
    );
  });

  elementsInSelection = excludeElementsInFrames
    ? excludeElementsInFramesFromSelection(elementsInSelection)
    : elementsInSelection;

  elementsInSelection = elementsInSelection.filter((element) => {
    const containingFrame = getContainingFrame(element);

    if (containingFrame) {
      return elementOverlapsWithFrame(element, containingFrame);
    }

    return true;
  });

  return elementsInSelection;
};

// FIXME move this into the editor instance to keep utility methods stateless
export const isSomeElementSelected = (function () {
  let lastElements: readonly NonDeletedExcalidrawElement[] | null = null;
  let lastSelectedElementIds: AppState["selectedElementIds"] | null = null;
  let isSelected: boolean | null = null;

  const ret = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: Pick<AppState, "selectedElementIds">,
  ): boolean => {
    if (
      isSelected != null &&
      elements === lastElements &&
      appState.selectedElementIds === lastSelectedElementIds
    ) {
      return isSelected;
    }

    isSelected = elements.some(
      (element) => appState.selectedElementIds[element.id],
    );
    lastElements = elements;
    lastSelectedElementIds = appState.selectedElementIds;

    return isSelected;
  };

  ret.clearCache = () => {
    lastElements = null;
    lastSelectedElementIds = null;
    isSelected = null;
  };

  return ret;
})();

/**
 * Returns common attribute (picked by `getAttribute` callback) of selected
 *  elements. If elements don't share the same value, returns `null`.
 */
export const getCommonAttributeOfSelectedElements = <T>(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Pick<AppState, "selectedElementIds">,
  getAttribute: (element: ExcalidrawElement) => T,
): T | null => {
  const attributes = Array.from(
    new Set(
      getSelectedElements(elements, appState).map((element) =>
        getAttribute(element),
      ),
    ),
  );
  return attributes.length === 1 ? attributes[0] : null;
};

// FIXME II: memoize could be a decorator or something reusable
let selectedElementsCache: NonDeletedExcalidrawElement[] = [];
// FIXME II: add some more meaningful name
let elementsLengthCache2 = 0; // FIXME II: this is probably not enough for all edge cases (could be immutable? is also elsewhere)
// FIXME II: this cache does not really work, there is some bug in selectedElementIds
let selectedElementIdsLengthCache2 = 0;

export const getSelectedElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Pick<InteractiveCanvasAppState, "selectedElementIds">,
  opts?: {
    includeBoundTextElement?: boolean;
    includeElementsInFrames?: boolean;
  },
) => {
  const selectedElementIdsLength = Object.keys(
    appState.selectedElementIds,
  ).length;
  if (
    elementsLengthCache2 !== elements.length ||
    selectedElementIdsLengthCache2 !== selectedElementIdsLength
  ) {
    elementsLengthCache2 = elements.length;
    selectedElementIdsLengthCache2 = selectedElementIdsLength;

    selectedElementsCache = elements.filter((element) => {
      if (appState.selectedElementIds[element.id]) {
        return element;
      }
      if (
        opts?.includeBoundTextElement &&
        isBoundToContainer(element) &&
        appState.selectedElementIds[element?.containerId]
      ) {
        return element;
      }
      return null;
    });
  }

  if (opts?.includeElementsInFrames) {
    const elementsToInclude: ExcalidrawElement[] = [];
    selectedElementsCache.forEach((element) => {
      if (element.type === "frame") {
        getFrameElements(elements, element.id).forEach((e) =>
          elementsToInclude.push(e),
        );
      }
      elementsToInclude.push(element);
    });

    return elementsToInclude;
  }
  return selectedElementsCache;
};

export const getTargetElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Pick<AppState, "selectedElementIds" | "editingElement">,
) =>
  appState.editingElement
    ? [appState.editingElement]
    : getSelectedElements(elements, appState, {
        includeBoundTextElement: true,
      });

/**
 * returns prevState's selectedElementids if no change from previous, so as to
 * retain reference identity for memoization
 */
export const makeNextSelectedElementIds = (
  nextSelectedElementIds: AppState["selectedElementIds"],
  prevState: Pick<AppState, "selectedElementIds">,
) => {
  if (isShallowEqual(prevState.selectedElementIds, nextSelectedElementIds)) {
    return prevState.selectedElementIds;
  }

  return nextSelectedElementIds;
};
