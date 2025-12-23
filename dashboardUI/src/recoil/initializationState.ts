// src/recoil/initializationState.ts
// Centralized initialization state management to prevent race conditions and duplicate saves

import { atom } from 'recoil';

// Global flag to track if DataInitializer has completed loading all data
// This prevents atom effects from saving data while DataInitializer is loading
let _isDataInitializerActive = false;
let _initializationComplete = false;

// Track which atoms have been initialized by DataInitializer
const _initializedAtoms = new Set<string>();

// Track last values to prevent duplicate saves
const _lastValues = new Map<string, string>();

/**
 * Call this when DataInitializer starts loading data
 */
export function startDataInitialization() {
  _isDataInitializerActive = true;
  _initializationComplete = false;
  console.log('🔒 [Init State] DataInitializer started - saves disabled');
}

/**
 * Call this when DataInitializer finishes loading all data
 */
export function completeDataInitialization() {
  _isDataInitializerActive = false;
  _initializationComplete = true;
  console.log('🔓 [Init State] DataInitializer complete - saves enabled');
}

/**
 * Check if saves should be blocked (during initialization)
 */
export function shouldBlockSave(): boolean {
  return _isDataInitializerActive || !_initializationComplete;
}

/**
 * Check if initialization is complete
 */
export function isInitializationComplete(): boolean {
  return _initializationComplete;
}

/**
 * Mark an atom as initialized by DataInitializer
 */
export function markAtomInitialized(atomKey: string) {
  _initializedAtoms.add(atomKey);
}

/**
 * Check if an atom has been initialized
 */
export function isAtomInitialized(atomKey: string): boolean {
  return _initializedAtoms.has(atomKey);
}

/**
 * Check if value has changed (to prevent duplicate saves)
 */
export function hasValueChanged(atomKey: string, newValue: any): boolean {
  const newJson = JSON.stringify(newValue);
  const lastJson = _lastValues.get(atomKey);
  
  if (lastJson === newJson) {
    return false;
  }
  
  _lastValues.set(atomKey, newJson);
  return true;
}

/**
 * Update the last known value for an atom (without triggering change detection)
 */
export function updateLastValue(atomKey: string, value: any) {
  _lastValues.set(atomKey, JSON.stringify(value));
}

/**
 * Reset all initialization state (useful for testing or full reload)
 */
export function resetInitializationState() {
  _isDataInitializerActive = false;
  _initializationComplete = false;
  _initializedAtoms.clear();
  _lastValues.clear();
}

// Atom to track if all data has been loaded (for UI to wait on)
export const dataLoadedState = atom<boolean>({
  key: 'dataLoadedState',
  default: false,
});

// 🔥 Atom to trigger recalculation after filters are reset to defaults
// Increment this when filters are reset to force useGlobalRecalculation to run
export const filterResetTriggerState = atom<number>({
  key: 'filterResetTriggerState',
  default: 0,
});

// 🔥 Atom to track if this is the first visit to dashboard
// On first visit, DataInitializer already set filters to defaults, so we don't need to reset again
export const isFirstDashboardVisitState = atom<boolean>({
  key: 'isFirstDashboardVisitState',
  default: true,
});

