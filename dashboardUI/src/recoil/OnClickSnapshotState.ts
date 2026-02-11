import { atom } from "recoil";

// Stores the "before click" snapshot of all variables that onClick will modify.
// When the user clicks a chart point, we save current values here.
// When they click "Reset" or click outside, we restore from this snapshot.

export interface OnClickSnapshot {
  active: boolean;                           // Is an onClick drill-down currently active?
  sourceChartId: string | null;              // Which chart (configKey) triggered the onClick
  sourceParentCardId: string | null;         // Which parent card ID the click originated from
  originalValues: Record<string, string>;    // { variableName: originalStringValue }
}

export const onClickSnapshotState = atom<OnClickSnapshot>({
  key: 'onClickSnapshotState',
  default: {
    active: false,
    sourceChartId: null,
    sourceParentCardId: null,
    originalValues: {},
  },
});

