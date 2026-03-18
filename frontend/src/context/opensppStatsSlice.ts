import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

// Types matching the OpenSPP spatial-statistics API response
export interface BreakdownEntry {
  count: number;
  statistics: Record<string, any>;
  labels: Record<string, { value: string; display: string }>;
}

export interface SpatialStatsResult {
  total_count: number;
  query_method: string;
  areas_matched: number;
  statistics: {
    total_households: number;
    total_members: number;
    pwd_members: number;
    enrolled_any_program: number;
    _grouped: Record<
      string,
      Record<
        string,
        {
          label: string;
          value: number;
          format: string;
          suppressed: boolean;
        }
      >
    >;
  };
  breakdown: Record<string, BreakdownEntry> | null;
  access_level: string;
  computed_at: string;
}

export type StatsStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'zero_results'
  | 'error';

export interface OpensppStatsState {
  selectedGeometry: GeoJSON.Geometry | null;
  selectedFeatureProperties: Record<string, any> | null;
  selectedLayerId: string | null;
  selectedLayerTitle: string | null;
  status: StatsStatus;
  result: SpatialStatsResult | null;
  errorMessage: string | null;
  jobId: string | null;
}

const initialState: OpensppStatsState = {
  selectedGeometry: null,
  selectedFeatureProperties: null,
  selectedLayerId: null,
  selectedLayerTitle: null,
  status: 'idle',
  result: null,
  errorMessage: null,
  jobId: null,
};

export const opensppStatsSlice = createSlice({
  name: 'opensppStats',
  initialState,
  reducers: {
    setSelectedGeometry: (
      state,
      {
        payload,
      }: PayloadAction<{
        geometry: GeoJSON.Geometry;
        properties: Record<string, any>;
        layerId: string;
        layerTitle: string;
      }>,
    ) => ({
      ...state,
      selectedGeometry: payload.geometry,
      selectedFeatureProperties: payload.properties,
      selectedLayerId: payload.layerId,
      selectedLayerTitle: payload.layerTitle,
      status: 'loading' as StatsStatus,
      result: null,
      errorMessage: null,
      jobId: null,
    }),
    clearSelectedGeometry: () => initialState,
    setStatsLoading: state => ({
      ...state,
      status: 'loading' as StatsStatus,
    }),
    setStatsResult: (
      state,
      { payload }: PayloadAction<SpatialStatsResult>,
    ) => ({
      ...state,
      status: (payload.total_count === 0
        ? 'zero_results'
        : 'success') as StatsStatus,
      result: payload,
    }),
    setStatsError: (state, { payload }: PayloadAction<string>) => ({
      ...state,
      status: 'error' as StatsStatus,
      errorMessage: payload,
    }),
    setJobId: (state, { payload }: PayloadAction<string>) => ({
      ...state,
      jobId: payload,
    }),
  },
});

// Selectors
export const opensppStatsSelector = (state: RootState): OpensppStatsState =>
  state.opensppStats;

export const {
  setSelectedGeometry,
  clearSelectedGeometry,
  setStatsLoading,
  setStatsResult,
  setStatsError,
  setJobId,
} = opensppStatsSlice.actions;

export default opensppStatsSlice.reducer;
