import Scene from "../scene/Scene";
import { useMemo } from "react";
import { InteractiveCanvasAppState, StaticCanvasAppState } from "../types";
import { isImageElement } from "../element/typeChecks";
import { NonDeletedExcalidrawElement } from "../element/types";

export const useMutatedElements = ({
  appState,
  scene,
}: {
  appState: InteractiveCanvasAppState | StaticCanvasAppState;
  scene: Scene;
}): [readonly NonDeletedExcalidrawElement[], number | undefined] => {
  const mutationNonce = scene.getMutationNonce();
  const nonDeletedElements = scene.getNonDeletedElements(); // FIXME II: why isn't this just visible elements, why all?

  const elements = useMemo(() => {
    return nonDeletedElements.filter((element) => {
      if (isImageElement(element)) {
        if (
          // not placed on canvas yet (but in elements array)
          appState.pendingImageElementId === element.id
        ) {
          return false;
        }
      }
      // don't render text element that's being currently edited (it's
      // rendered on remote only)
      return (
        !appState.editingElement ||
        appState.editingElement.type !== "text" ||
        element.id !== appState.editingElement.id
      );
    });

    // FIXME I: Rerunnning the computation only when mutation occured might not be enough, re-check also other deps
    // FIXME I: Isn't mutation too much? I.e. If the element is being dragged, it's nonce is changing but there is no need for this recalculation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutationNonce]);

  return [elements, mutationNonce];
};
