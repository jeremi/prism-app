import { renderHook, act, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import React from 'react';
import opensppStatsReducer, {
  setSelectedGeometry,
  clearSelectedGeometry,
  OpensppStatsState,
  SpatialStatsResult,
} from 'context/opensppStatsSlice';
import { useOpensppStats } from '../useOpensppStats';

// Build a minimal real store with just the opensppStats slice
function makeStore(preloadedState?: {
  opensppStats: Partial<OpensppStatsState>;
}) {
  return configureStore({
    reducer: { opensppStats: opensppStatsReducer },
    preloadedState,
  });
}

function makeWrapper(store: ReturnType<typeof makeStore>) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children);
}

const mockPolygon: GeoJSON.Geometry = {
  type: 'Polygon',
  coordinates: [
    [
      [123.0, 10.0],
      [124.0, 10.0],
      [124.0, 11.0],
      [123.0, 11.0],
      [123.0, 10.0],
    ],
  ],
};

const mockStatsResult: SpatialStatsResult = {
  total_count: 150,
  query_method: 'spatial',
  areas_matched: 5,
  statistics: {
    total_households: 120,
    total_members: 450,
    pwd_members: 30,
    enrolled_any_program: 80,
    _grouped: {},
  },
  breakdown: null,
  access_level: 'full',
  computed_at: '2024-01-01T00:00:00Z',
};

// Helper that advances fake timers and flushes microtasks inside act()
async function advanceTimers(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    // Flush all pending microtasks (Promise resolutions) after timer callbacks fire
    await Promise.resolve();
  });
}

describe('useOpensppStats', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockStatsResult,
    } as Response);
  });

  afterEach(async () => {
    await act(async () => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not fetch when status is idle (no selectedGeometry)', async () => {
    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    await advanceTimers(1000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches spatial-statistics when selectedGeometry is set and status is loading', async () => {
    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    act(() => {
      store.dispatch(
        setSelectedGeometry({
          geometry: mockPolygon,
          properties: { name: 'Test' },
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );
    });

    // Advance past debounce delay (500ms) and flush promises
    await advanceTimers(600);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/spatial-statistics');
    expect(options?.method).toBe('POST');
  });

  it('dispatches setStatsResult on successful synchronous response', async () => {
    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    act(() => {
      store.dispatch(
        setSelectedGeometry({
          geometry: mockPolygon,
          properties: {},
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );
    });

    await advanceTimers(600);

    await waitFor(() => {
      const state = store.getState().opensppStats;
      expect(state.status).toBe('success');
    });

    const state = store.getState().opensppStats;
    expect(state.result).toEqual(mockStatsResult);
  });

  it('dispatches setStatsError on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    act(() => {
      store.dispatch(
        setSelectedGeometry({
          geometry: mockPolygon,
          properties: {},
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );
    });

    await advanceTimers(600);

    await waitFor(() => {
      const state = store.getState().opensppStats;
      expect(state.status).toBe('error');
    });

    const state = store.getState().opensppStats;
    expect(state.errorMessage).toBe(
      'Could not load statistics. Try a smaller area or retry.',
    );
  });

  it('dispatches setStatsError on non-ok HTTP response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    act(() => {
      store.dispatch(
        setSelectedGeometry({
          geometry: mockPolygon,
          properties: {},
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );
    });

    await advanceTimers(600);

    await waitFor(() => {
      const state = store.getState().opensppStats;
      expect(state.status).toBe('error');
    });
  });

  it('dispatches setStatsError on timeout', async () => {
    // fetch never resolves within the timeout window
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => mockStatsResult,
            } as Response);
          }, 30000);
        }),
    );

    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    act(() => {
      store.dispatch(
        setSelectedGeometry({
          geometry: mockPolygon,
          properties: {},
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );
    });

    // Advance past debounce (500ms) + timeout (15000ms)
    await advanceTimers(16000);

    await waitFor(() => {
      const state = store.getState().opensppStats;
      expect(state.status).toBe('error');
    });

    const state = store.getState().opensppStats;
    expect(state.errorMessage).toBe(
      'Could not load statistics. Try a smaller area or retry.',
    );
  });

  it('handles async job polling: job_id response -> poll -> success', async () => {
    // First call returns a job_id; second call (poll) returns a successful result
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job_id: 'job-abc-123' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'successful', result: mockStatsResult }),
      } as Response);

    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    act(() => {
      store.dispatch(
        setSelectedGeometry({
          geometry: mockPolygon,
          properties: {},
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );
    });

    // Advance past debounce (500ms) and allow initial fetch to resolve
    await advanceTimers(600);

    // Wait for initial fetch and job ID to be dispatched
    await waitFor(() => {
      const state = store.getState().opensppStats;
      expect(state.jobId).toBe('job-abc-123');
    });

    // Advance past poll interval (2000ms) and allow poll fetch to resolve
    await advanceTimers(2100);

    await waitFor(() => {
      const state = store.getState().opensppStats;
      expect(state.status).toBe('success');
    });

    const state = store.getState().opensppStats;
    expect(state.result).toEqual(mockStatsResult);
  });

  it('dispatches setStatsError when job polling returns failed status', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job_id: 'job-failed-456' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'failed' }),
      } as Response);

    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    act(() => {
      store.dispatch(
        setSelectedGeometry({
          geometry: mockPolygon,
          properties: {},
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );
    });

    await advanceTimers(600);

    await waitFor(() => {
      const state = store.getState().opensppStats;
      expect(state.jobId).toBe('job-failed-456');
    });

    await advanceTimers(2100);

    await waitFor(() => {
      const state = store.getState().opensppStats;
      expect(state.status).toBe('error');
    });
  });

  it('cleans up and stops fetching when geometry is cleared before debounce fires', async () => {
    const store = makeStore();
    renderHook(() => useOpensppStats(), { wrapper: makeWrapper(store) });

    act(() => {
      store.dispatch(
        setSelectedGeometry({
          geometry: mockPolygon,
          properties: {},
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );
    });

    // Clear before debounce fires (within 500ms)
    act(() => {
      store.dispatch(clearSelectedGeometry());
    });

    await advanceTimers(1000);

    // fetch should not have been called because debounce was cancelled
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getState().opensppStats.status).toBe('idle');
  });
});
