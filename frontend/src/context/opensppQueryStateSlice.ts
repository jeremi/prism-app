/**
 * Redux slice for OpenSPP spatial/proximity query state.
 */
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Polygon, MultiPolygon } from 'geojson';
import type { RootState, CreateAsyncThunkTypes } from './store';
import {
  querySpatialStatistics,
  queryProximity,
} from 'utils/openspp-api';
import type {
  SpatialQueryResponse,
  ProximityQueryResponse,
} from 'utils/openspp-types';

// --- State ---

type QueryMode = 'area' | 'proximity';

interface OpenSPPQueryState {
  mode: QueryMode;
  loading: boolean;
  error: string | null;

  // Area query
  drawnGeometry: Polygon | MultiPolygon | null;
  selectedVariables: string[];
  spatialResult: SpatialQueryResponse | null;

  // Proximity query
  proximityLat: number | null;
  proximityLng: number | null;
  proximityRadiusKm: number;
  proximityRelation: 'within' | 'beyond';
  proximityResult: ProximityQueryResponse | null;

  // Drawing state
  isDrawing: boolean;
}

const initialState: OpenSPPQueryState = {
  mode: 'area',
  loading: false,
  error: null,

  drawnGeometry: null,
  selectedVariables: [],
  spatialResult: null,

  proximityLat: null,
  proximityLng: null,
  proximityRadiusKm: 5,
  proximityRelation: 'within',
  proximityResult: null,

  isDrawing: false,
};

// --- Async thunks ---

export const executeOpenSPPSpatialQuery = createAsyncThunk<
  SpatialQueryResponse,
  { geometry: Polygon | MultiPolygon; variables?: string[] },
  CreateAsyncThunkTypes
>('opensppQuery/executeSpatial', async ({ geometry, variables }) => {
  return querySpatialStatistics({
    geometry,
    variables: variables?.length ? variables : undefined,
  });
});

export const executeOpenSPPProximityQuery = createAsyncThunk<
  ProximityQueryResponse,
  {
    latitude: number;
    longitude: number;
    radius_km: number;
    relation: 'within' | 'beyond';
    variables?: string[];
  },
  CreateAsyncThunkTypes
>('opensppQuery/executeProximity', async (params) => {
  return queryProximity({
    reference_points: [
      { longitude: params.longitude, latitude: params.latitude },
    ],
    radius_km: params.radius_km,
    relation: params.relation,
    variables: params.variables?.length ? params.variables : undefined,
  });
});

// --- Slice ---

export const opensppQuerySlice = createSlice({
  name: 'opensppQuery',
  initialState,
  reducers: {
    setQueryMode: (state, { payload }: PayloadAction<QueryMode>) => {
      state.mode = payload;
    },
    setDrawnGeometry: (
      state,
      { payload }: PayloadAction<Polygon | MultiPolygon | null>,
    ) => {
      state.drawnGeometry = payload;
    },
    setSelectedVariables: (state, { payload }: PayloadAction<string[]>) => {
      state.selectedVariables = payload;
    },
    toggleVariable: (state, { payload }: PayloadAction<string>) => {
      if (state.selectedVariables.includes(payload)) {
        state.selectedVariables = state.selectedVariables.filter(
          (v) => v !== payload,
        );
      } else {
        state.selectedVariables.push(payload);
      }
    },
    setProximityParams: (
      state,
      {
        payload,
      }: PayloadAction<{
        lat?: number | null;
        lng?: number | null;
        radiusKm?: number;
        relation?: 'within' | 'beyond';
      }>,
    ) => {
      if (payload.lat !== undefined) state.proximityLat = payload.lat;
      if (payload.lng !== undefined) state.proximityLng = payload.lng;
      if (payload.radiusKm !== undefined)
        state.proximityRadiusKm = payload.radiusKm;
      if (payload.relation !== undefined)
        state.proximityRelation = payload.relation;
    },
    setIsDrawing: (state, { payload }: PayloadAction<boolean>) => {
      state.isDrawing = payload;
    },
    clearQueryResults: (state) => {
      state.spatialResult = null;
      state.proximityResult = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Spatial query
    builder
      .addCase(executeOpenSPPSpatialQuery.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.spatialResult = null;
      })
      .addCase(executeOpenSPPSpatialQuery.fulfilled, (state, action) => {
        state.loading = false;
        state.spatialResult = action.payload;
      })
      .addCase(executeOpenSPPSpatialQuery.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Spatial query failed';
      });

    // Proximity query
    builder
      .addCase(executeOpenSPPProximityQuery.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.proximityResult = null;
      })
      .addCase(executeOpenSPPProximityQuery.fulfilled, (state, action) => {
        state.loading = false;
        state.proximityResult = action.payload;
      })
      .addCase(executeOpenSPPProximityQuery.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Proximity query failed';
      });
  },
});

// --- Actions ---

export const {
  setQueryMode,
  setDrawnGeometry,
  setSelectedVariables,
  toggleVariable,
  setProximityParams,
  setIsDrawing,
  clearQueryResults,
} = opensppQuerySlice.actions;

// --- Selectors ---

export const opensppQueryModeSelector = (state: RootState) =>
  state.opensppQueryState.mode;
export const opensppQueryLoadingSelector = (state: RootState) =>
  state.opensppQueryState.loading;
export const opensppQueryErrorSelector = (state: RootState) =>
  state.opensppQueryState.error;
export const opensppDrawnGeometrySelector = (state: RootState) =>
  state.opensppQueryState.drawnGeometry;
export const opensppSelectedVariablesSelector = (state: RootState) =>
  state.opensppQueryState.selectedVariables;
export const opensppSpatialResultSelector = (state: RootState) =>
  state.opensppQueryState.spatialResult;
export const opensppProximityResultSelector = (state: RootState) =>
  state.opensppQueryState.proximityResult;
export const opensppIsDrawingSelector = (state: RootState) =>
  state.opensppQueryState.isDrawing;
export const opensppProximityParamsSelector = (state: RootState) => ({
  lat: state.opensppQueryState.proximityLat,
  lng: state.opensppQueryState.proximityLng,
  radiusKm: state.opensppQueryState.proximityRadiusKm,
  relation: state.opensppQueryState.proximityRelation,
});

export default opensppQuerySlice.reducer;
