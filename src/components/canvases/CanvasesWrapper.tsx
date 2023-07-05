import { ReactNode } from "react";
import { useMutatedElements } from "../../hooks/useMutatedElements";
import { AppState } from "../../types";
import { NonDeletedExcalidrawElement } from "../../element/types";
import Scene from "../../scene/Scene";

type CanvasesWrapperProps = {
  appState: AppState;
  scene: Scene;
  children: (
    elements: readonly NonDeletedExcalidrawElement[],
    mutationNonce: number | undefined,
  ) => ReactNode;
};

const CanvasesWrapper = (props: CanvasesWrapperProps) => {
  const [elements, mutationNonce] = useMutatedElements({
    appState: props.appState,
    scene: props.scene,
  });

  return <main>{props.children(elements, mutationNonce)}</main>;
};

export default CanvasesWrapper;
