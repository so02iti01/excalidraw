import { GroupId, ExcalidrawElement, NonDeleted } from "./element/types";
import { AppState, InteractiveCanvasAppState } from "./types";
import { getSelectedElements } from "./scene";
import { getBoundTextElement } from "./element/textElement";
import { makeNextSelectedElementIds } from "./scene/selection";

export const selectGroup = (
  groupId: GroupId,
  appState: InteractiveCanvasAppState,
  elements: readonly NonDeleted<ExcalidrawElement>[],
): InteractiveCanvasAppState => {
  const elementsInGroup = elements.reduce((acc, element) => {
    if (element.groupIds.includes(groupId)) {
      acc[element.id] = true;
    }
    return acc;
  }, {} as Record<string, boolean>);

  if (Object.keys(elementsInGroup).length < 2) {
    if (
      appState.selectedGroupIds[groupId] ||
      appState.editingGroupId === groupId
    ) {
      return {
        ...appState,
        selectedGroupIds: { ...appState.selectedGroupIds, [groupId]: false },
        editingGroupId: null,
      };
    }
    return appState;
  }

  return {
    ...appState,
    selectedGroupIds: { ...appState.selectedGroupIds, [groupId]: true },
    selectedElementIds: {
      ...appState.selectedElementIds,
      ...elementsInGroup,
    } as AppState["selectedElementIds"],
  };
};

// FIXME II: memoize with some prop. solution - could be a decorator, some lib (lodash memo?)
// FIXME II: add tests and compare with `selectGroup`
let appStateCache: InteractiveCanvasAppState | undefined = undefined;
let selectedElementsLengthCache = 0;
let editingGroupIdCache: string | null = null;

export const selectGroups = (
  selectedElements: readonly NonDeleted<ExcalidrawElement>[],
  elements: readonly NonDeleted<ExcalidrawElement>[],
  appState: InteractiveCanvasAppState,
): InteractiveCanvasAppState => {
  if (
    appStateCache === undefined ||
    selectedElementsLengthCache !== selectedElements.length ||
    editingGroupIdCache !== appState.editingGroupId
  ) {
    selectedElementsLengthCache = selectedElements.length;
    editingGroupIdCache = appState.editingGroupId;

    const groups: Record<GroupId, boolean> = {};

    for (const selectedElement of selectedElements) {
      let groupIds = selectedElement.groupIds;
      if (appState.editingGroupId) {
        // handle the case where a group is nested within a group //FIXME II: test
        const indexOfEditingGroup = groupIds.indexOf(appState.editingGroupId);
        if (indexOfEditingGroup > -1) {
          groupIds = groupIds.slice(0, indexOfEditingGroup);
        }
      }
      if (groupIds.length > 0) {
        const lastSelectedGroup = groupIds[groupIds.length - 1];
        groups[lastSelectedGroup] = true;
      }
    }

    const elementsInGroup = elements.reduce((acc, element) => {
      if (element.groupIds.some((id) => groups[id])) {
        acc[element.id] = true;
      }
      return acc;
    }, {} as Record<string, boolean>);

    appStateCache = {
      ...appState,
      selectedGroupIds: groups,
      selectedElementIds: {
        ...appState.selectedElementIds,
        ...elementsInGroup,
      } as AppState["selectedElementIds"],
    };
  }

  return appStateCache;
};

/**
 * If the element's group is selected, don't render an individual
 * selection border around it.
 */
export const isSelectedViaGroup = (
  appState: InteractiveCanvasAppState,
  element: ExcalidrawElement,
) => getSelectedGroupForElement(appState, element) != null;

export const getSelectedGroupForElement = (
  appState: InteractiveCanvasAppState,
  element: ExcalidrawElement,
) =>
  element.groupIds
    .filter((groupId) => groupId !== appState.editingGroupId)
    .find((groupId) => appState.selectedGroupIds[groupId]);

export const getSelectedGroupIds = (
  appState: InteractiveCanvasAppState,
): GroupId[] =>
  Object.entries(appState.selectedGroupIds)
    .filter(([groupId, isSelected]) => isSelected)
    .map(([groupId, isSelected]) => groupId);

/**
 * When you select an element, you often want to actually select the whole group it's in, unless
 * you're currently editing that group.
 */
export const selectGroupsForSelectedElements = (
  appState: InteractiveCanvasAppState,
  elements: readonly NonDeleted<ExcalidrawElement>[],
  prevAppState: InteractiveCanvasAppState,
): InteractiveCanvasAppState => {
  let nextAppState: InteractiveCanvasAppState = {
    ...appState,
    selectedGroupIds: {},
  };
  const selectedElements = getSelectedElements(elements, appState);

  if (!selectedElements.length) {
    return {
      ...nextAppState,
      editingGroupId: null,
      selectedElementIds: makeNextSelectedElementIds(
        nextAppState.selectedElementIds,
        prevAppState,
      ),
    };
  }

  nextAppState = selectGroups(selectedElements, elements, appState);

  return nextAppState;
};

// given a list of elements, return the the actual group ids that should be selected
// or used to update the elements
export const selectGroupsFromGivenElements = (
  elements: readonly NonDeleted<ExcalidrawElement>[],
  appState: InteractiveCanvasAppState,
) => {
  let nextAppState: InteractiveCanvasAppState = {
    ...appState,
    selectedGroupIds: {},
  };

  nextAppState = selectGroups(elements, elements, appState);

  return nextAppState.selectedGroupIds;
};

export const editGroupForSelectedElement = (
  appState: AppState,
  element: NonDeleted<ExcalidrawElement>,
): AppState => {
  return {
    ...appState,
    editingGroupId: element.groupIds.length ? element.groupIds[0] : null,
    selectedGroupIds: {},
    selectedElementIds: {
      [element.id]: true,
    },
  };
};

export const isElementInGroup = (element: ExcalidrawElement, groupId: string) =>
  element.groupIds.includes(groupId);

export const getElementsInGroup = (
  elements: readonly ExcalidrawElement[],
  groupId: string,
) => elements.filter((element) => isElementInGroup(element, groupId));

export const getSelectedGroupIdForElement = (
  element: ExcalidrawElement,
  selectedGroupIds: { [groupId: string]: boolean },
) => element.groupIds.find((groupId) => selectedGroupIds[groupId]);

export const getNewGroupIdsForDuplication = (
  groupIds: ExcalidrawElement["groupIds"],
  editingGroupId: AppState["editingGroupId"],
  mapper: (groupId: GroupId) => GroupId,
) => {
  const copy = [...groupIds];
  const positionOfEditingGroupId = editingGroupId
    ? groupIds.indexOf(editingGroupId)
    : -1;
  const endIndex =
    positionOfEditingGroupId > -1 ? positionOfEditingGroupId : groupIds.length;
  for (let index = 0; index < endIndex; index++) {
    copy[index] = mapper(copy[index]);
  }

  return copy;
};

export const addToGroup = (
  prevGroupIds: ExcalidrawElement["groupIds"],
  newGroupId: GroupId,
  editingGroupId: AppState["editingGroupId"],
) => {
  // insert before the editingGroupId, or push to the end.
  const groupIds = [...prevGroupIds];
  const positionOfEditingGroupId = editingGroupId
    ? groupIds.indexOf(editingGroupId)
    : -1;
  const positionToInsert =
    positionOfEditingGroupId > -1 ? positionOfEditingGroupId : groupIds.length;
  groupIds.splice(positionToInsert, 0, newGroupId);
  return groupIds;
};

export const removeFromSelectedGroups = (
  groupIds: ExcalidrawElement["groupIds"],
  selectedGroupIds: { [groupId: string]: boolean },
) => groupIds.filter((groupId) => !selectedGroupIds[groupId]);

export const getMaximumGroups = (
  elements: ExcalidrawElement[],
): ExcalidrawElement[][] => {
  const groups: Map<String, ExcalidrawElement[]> = new Map<
    String,
    ExcalidrawElement[]
  >();

  elements.forEach((element: ExcalidrawElement) => {
    const groupId =
      element.groupIds.length === 0
        ? element.id
        : element.groupIds[element.groupIds.length - 1];

    const currentGroupMembers = groups.get(groupId) || [];

    // Include bound text if present when grouping
    const boundTextElement = getBoundTextElement(element);
    if (boundTextElement) {
      currentGroupMembers.push(boundTextElement);
    }
    groups.set(groupId, [...currentGroupMembers, element]);
  });

  return Array.from(groups.values());
};

export const elementsAreInSameGroup = (elements: ExcalidrawElement[]) => {
  const allGroups = elements.flatMap((element) => element.groupIds);
  const groupCount = new Map<string, number>();
  let maxGroup = 0;

  for (const group of allGroups) {
    groupCount.set(group, (groupCount.get(group) ?? 0) + 1);
    if (groupCount.get(group)! > maxGroup) {
      maxGroup = groupCount.get(group)!;
    }
  }

  return maxGroup === elements.length;
};
