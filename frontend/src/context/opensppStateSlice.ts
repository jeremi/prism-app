/**
 * Redux slice for OpenSPP integration state.
 * Manages collections, geofences, and statistics discovery.
 */
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState, CreateAsyncThunkTypes } from './store';
import {
  getCollections,
  getStatistics,
  listGeofences,
  createGeofence as apiCreateGeofence,
  deleteGeofence as apiDeleteGeofence,
} from 'utils/openspp-api';
import type {
  CollectionInfo,
  GeofenceListItem,
  GeofenceCreateRequest,
  GeofenceResponse,
  StatisticCategoryInfo,
  GeofenceListResponse,
  StatisticsListResponse,
} from 'utils/openspp-types';

// --- State ---

interface OpenSPPState {
  collections: CollectionInfo[];
  collectionsLoading: boolean;
  collectionsError: string | null;

  statistics: StatisticCategoryInfo[];
  statisticsLoading: boolean;

  geofences: GeofenceListItem[];
  geofencesTotal: number;
  geofencesLoading: boolean;
}

const initialState: OpenSPPState = {
  collections: [],
  collectionsLoading: false,
  collectionsError: null,

  statistics: [],
  statisticsLoading: false,

  geofences: [],
  geofencesTotal: 0,
  geofencesLoading: false,
};

// --- Async thunks ---

export const fetchOpenSPPCollections = createAsyncThunk<
  CollectionInfo[],
  void,
  CreateAsyncThunkTypes
>('openspp/fetchCollections', async () => {
  return getCollections();
});

export const fetchOpenSPPStatistics = createAsyncThunk<
  StatisticsListResponse,
  void,
  CreateAsyncThunkTypes
>('openspp/fetchStatistics', async () => {
  return getStatistics();
});

export const fetchOpenSPPGeofences = createAsyncThunk<
  GeofenceListResponse,
  { active?: boolean; _count?: number; _offset?: number } | undefined,
  CreateAsyncThunkTypes
>('openspp/fetchGeofences', async (options) => {
  return listGeofences(options ?? undefined);
});

export const createOpenSPPGeofence = createAsyncThunk<
  GeofenceResponse,
  GeofenceCreateRequest,
  CreateAsyncThunkTypes
>('openspp/createGeofence', async (request) => {
  return apiCreateGeofence(request);
});

export const deleteOpenSPPGeofence = createAsyncThunk<
  number,
  number,
  CreateAsyncThunkTypes
>('openspp/deleteGeofence', async (geofenceId) => {
  await apiDeleteGeofence(geofenceId);
  return geofenceId;
});

// --- Slice ---

export const opensppSlice = createSlice({
  name: 'openspp',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Collections
    builder
      .addCase(fetchOpenSPPCollections.pending, (state) => {
        state.collectionsLoading = true;
        state.collectionsError = null;
      })
      .addCase(fetchOpenSPPCollections.fulfilled, (state, action) => {
        state.collectionsLoading = false;
        state.collections = action.payload;
      })
      .addCase(fetchOpenSPPCollections.rejected, (state, action) => {
        state.collectionsLoading = false;
        state.collectionsError = action.error.message ?? 'Failed to fetch collections';
      });

    // Statistics
    builder
      .addCase(fetchOpenSPPStatistics.pending, (state) => {
        state.statisticsLoading = true;
      })
      .addCase(fetchOpenSPPStatistics.fulfilled, (state, action) => {
        state.statisticsLoading = false;
        state.statistics = action.payload.categories;
      })
      .addCase(fetchOpenSPPStatistics.rejected, (state) => {
        state.statisticsLoading = false;
      });

    // Geofences
    builder
      .addCase(fetchOpenSPPGeofences.pending, (state) => {
        state.geofencesLoading = true;
      })
      .addCase(fetchOpenSPPGeofences.fulfilled, (state, action) => {
        state.geofencesLoading = false;
        state.geofences = action.payload.geofences;
        state.geofencesTotal = action.payload.total;
      })
      .addCase(fetchOpenSPPGeofences.rejected, (state) => {
        state.geofencesLoading = false;
      });

    // Create geofence — re-fetch list after success
    builder.addCase(createOpenSPPGeofence.fulfilled, (state, action) => {
      // Optimistic add to list
      state.geofences.unshift({
        id: action.payload.id,
        name: action.payload.name,
        geofence_type: action.payload.geofence_type,
        area_sqkm: action.payload.area_sqkm,
        active: action.payload.active,
      });
      state.geofencesTotal += 1;
    });

    // Delete geofence
    builder.addCase(deleteOpenSPPGeofence.fulfilled, (state, action) => {
      state.geofences = state.geofences.filter((g) => g.id !== action.payload);
      state.geofencesTotal -= 1;
    });
  },
});

// --- Selectors ---

export const opensppCollectionsSelector = (state: RootState) =>
  state.opensppState.collections;
export const opensppCollectionsLoadingSelector = (state: RootState) =>
  state.opensppState.collectionsLoading;
export const opensppStatisticsSelector = (state: RootState) =>
  state.opensppState.statistics;
export const opensppStatisticsLoadingSelector = (state: RootState) =>
  state.opensppState.statisticsLoading;
export const opensppGeofencesSelector = (state: RootState) =>
  state.opensppState.geofences;
export const opensppGeofencesLoadingSelector = (state: RootState) =>
  state.opensppState.geofencesLoading;

export default opensppSlice.reducer;
