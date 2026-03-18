import { render, screen } from '@testing-library/react';
import configureStore from 'redux-mock-store';
import { Provider } from 'react-redux';
import { SpatialStatsResult } from 'context/opensppStatsSlice';
import OpensppStatisticsPanel from '..';

// Mock the useOpensppStats hook so the panel does not trigger API calls
jest.mock('../useOpensppStats', () => ({
  useOpensppStats: jest.fn(),
}));

// Mock SaveTargetingZoneDialog to keep tests focused on the panel's own UI
jest.mock('../SaveTargetingZoneDialog', () => () => null);

const mockStore = configureStore([]);

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

function buildStore(
  overrides: Partial<{
    status: string;
    result: SpatialStatsResult | null;
    selectedLayerTitle: string | null;
    selectedFeatureProperties: Record<string, any> | null;
    errorMessage: string | null;
  }> = {},
) {
  return mockStore({
    opensppStats: {
      status: 'idle',
      result: null,
      selectedGeometry: null,
      selectedFeatureProperties: null,
      selectedLayerId: null,
      selectedLayerTitle: null,
      errorMessage: null,
      jobId: null,
      ...overrides,
    },
  });
}

describe('OpensppStatisticsPanel', () => {
  it('renders nothing when status is idle', () => {
    const store = buildStore({ status: 'idle' });
    const { container } = render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows spinner and "Querying OpenSPP..." when loading', () => {
    const store = buildStore({
      status: 'loading',
      selectedLayerTitle: 'Test Layer',
    });
    render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    expect(screen.getByText('Querying OpenSPP...')).toBeInTheDocument();
  });

  it('shows error message when status is error', () => {
    const store = buildStore({
      status: 'error',
      selectedLayerTitle: 'Test Layer',
    });
    render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    expect(screen.getByText('Could not load statistics.')).toBeInTheDocument();
    expect(
      screen.getByText('Try a smaller area or retry.'),
    ).toBeInTheDocument();
  });

  it('shows "No registered beneficiaries" when status is zero_results', () => {
    const store = buildStore({
      status: 'zero_results',
      selectedLayerTitle: 'Test Layer',
    });
    render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    expect(screen.getByText('No registered beneficiaries')).toBeInTheDocument();
  });

  it('shows statistics when status is success', () => {
    const store = buildStore({
      status: 'success',
      result: mockStatsResult,
      selectedLayerTitle: 'Test Layer',
    });
    render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    // Check that the enrolled count is shown (80 formatted as "80")
    expect(screen.getByText('80')).toBeInTheDocument();
    // Check the "Save as targeting zone" button
    expect(screen.getByText('Save as targeting zone')).toBeInTheDocument();
  });

  it('shows the layer title in the panel header', () => {
    const store = buildStore({
      status: 'loading',
      selectedLayerTitle: 'Flood Affected Areas',
    });
    render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    expect(screen.getByText('Flood Affected Areas')).toBeInTheDocument();
  });
});
