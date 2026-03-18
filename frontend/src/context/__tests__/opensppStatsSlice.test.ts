import reducer, {
  setSelectedGeometry,
  clearSelectedGeometry,
  setStatsResult,
  setStatsError,
  setJobId,
  OpensppStatsState,
  SpatialStatsResult,
} from '../opensppStatsSlice';

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

const mockGeometry: GeoJSON.Geometry = {
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

describe('opensppStatsSlice', () => {
  describe('initial state', () => {
    it('returns the initial state', () => {
      expect(reducer(undefined, { type: '@@INIT' })).toEqual(initialState);
    });
  });

  describe('setSelectedGeometry', () => {
    it('sets geometry, properties, layerId, layerTitle, and resets status to loading', () => {
      const properties = { name: 'Test Area', level: 'high' };

      const result = reducer(
        initialState,
        setSelectedGeometry({
          geometry: mockGeometry,
          properties,
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );

      expect(result.selectedGeometry).toEqual(mockGeometry);
      expect(result.selectedFeatureProperties).toEqual(properties);
      expect(result.selectedLayerId).toBe('layer-1');
      expect(result.selectedLayerTitle).toBe('My Layer');
      expect(result.status).toBe('loading');
    });

    it('clears result, errorMessage, and jobId when setting new geometry', () => {
      const stateWithData: OpensppStatsState = {
        ...initialState,
        result: mockStatsResult,
        errorMessage: 'previous error',
        jobId: 'job-123',
        status: 'success',
      };

      const result = reducer(
        stateWithData,
        setSelectedGeometry({
          geometry: mockGeometry,
          properties: {},
          layerId: 'layer-1',
          layerTitle: 'My Layer',
        }),
      );

      expect(result.result).toBeNull();
      expect(result.errorMessage).toBeNull();
      expect(result.jobId).toBeNull();
      expect(result.status).toBe('loading');
    });
  });

  describe('clearSelectedGeometry', () => {
    it('resets to initial state', () => {
      const stateWithData: OpensppStatsState = {
        selectedGeometry: mockGeometry,
        selectedFeatureProperties: { name: 'Test' },
        selectedLayerId: 'layer-1',
        selectedLayerTitle: 'My Layer',
        status: 'success',
        result: mockStatsResult,
        errorMessage: null,
        jobId: 'job-abc',
      };

      const result = reducer(stateWithData, clearSelectedGeometry());

      expect(result).toEqual(initialState);
    });
  });

  describe('setStatsResult', () => {
    it('sets status to success when total_count is non-zero', () => {
      const loadingState: OpensppStatsState = {
        ...initialState,
        status: 'loading',
      };

      const result = reducer(loadingState, setStatsResult(mockStatsResult));

      expect(result.status).toBe('success');
      expect(result.result).toEqual(mockStatsResult);
    });

    it('sets status to zero_results when total_count is zero', () => {
      const zeroResult: SpatialStatsResult = {
        ...mockStatsResult,
        total_count: 0,
      };
      const loadingState: OpensppStatsState = {
        ...initialState,
        status: 'loading',
      };

      const result = reducer(loadingState, setStatsResult(zeroResult));

      expect(result.status).toBe('zero_results');
      expect(result.result).toEqual(zeroResult);
    });
  });

  describe('setStatsError', () => {
    it('sets status to error and stores the error message', () => {
      const loadingState: OpensppStatsState = {
        ...initialState,
        status: 'loading',
      };
      const errorMessage =
        'Could not load statistics. Try a smaller area or retry.';

      const result = reducer(loadingState, setStatsError(errorMessage));

      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe(errorMessage);
    });
  });

  describe('setJobId', () => {
    it('stores the job ID', () => {
      const result = reducer(initialState, setJobId('job-xyz-456'));

      expect(result.jobId).toBe('job-xyz-456');
    });

    it('does not affect other state fields', () => {
      const result = reducer(initialState, setJobId('job-xyz-456'));

      expect(result.status).toBe('idle');
      expect(result.result).toBeNull();
      expect(result.selectedGeometry).toBeNull();
    });
  });
});
