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

  it('shows privacy note when breakdown has suppressed entries', () => {
    const resultWithSuppression: SpatialStatsResult = {
      ...mockStatsResult,
      breakdown: {
        '2|adult': {
          count: 65,
          statistics: {},
          labels: {
            gender: { value: '2', display: 'Female' },
            age_group: { value: 'adult', display: 'Adult (18-59)' },
          },
        },
        '1|adult': {
          count: 71,
          statistics: {},
          labels: {
            gender: { value: '1', display: 'Male' },
            age_group: { value: 'adult', display: 'Adult (18-59)' },
          },
        },
        '1|under_5': {
          count: '<5',
          suppressed: true,
          statistics: {},
        },
      },
    };
    const store = buildStore({
      status: 'success',
      result: resultWithSuppression,
      selectedLayerTitle: 'Test Layer',
    });
    render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    expect(
      screen.getByText(
        'Some categories hidden for privacy. Percentages may not total 100%.',
      ),
    ).toBeInTheDocument();
  });

  it('does not show privacy note when no entries are suppressed', () => {
    const resultNoSuppression: SpatialStatsResult = {
      ...mockStatsResult,
      breakdown: {
        '2|adult': {
          count: 65,
          statistics: {},
          labels: {
            gender: { value: '2', display: 'Female' },
            age_group: { value: 'adult', display: 'Adult (18-59)' },
          },
        },
        '1|adult': {
          count: 71,
          statistics: {},
          labels: {
            gender: { value: '1', display: 'Male' },
            age_group: { value: 'adult', display: 'Adult (18-59)' },
          },
        },
      },
    };
    const store = buildStore({
      status: 'success',
      result: resultNoSuppression,
      selectedLayerTitle: 'Test Layer',
    });
    render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    expect(
      screen.queryByText(
        'Some categories hidden for privacy. Percentages may not total 100%.',
      ),
    ).not.toBeInTheDocument();
  });

  it('handles suppressed total_members by hiding percentages', () => {
    const resultSuppressedTotal: SpatialStatsResult = {
      ...mockStatsResult,
      statistics: {
        ...mockStatsResult.statistics,
        total_members: '<5' as any,
      },
      breakdown: {
        '1|adult': {
          count: '<5',
          suppressed: true,
          statistics: {},
        },
      },
    };
    const store = buildStore({
      status: 'success',
      result: resultSuppressedTotal,
      selectedLayerTitle: 'Test Layer',
    });
    const { container } = render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    // total_members should render as the suppressed string "<5"
    expect(container.textContent).toContain('<5 members');
    // No breakdown percentage values should appear (e.g., "52%")
    // since the only breakdown entry is suppressed.
    // The privacy note contains "100%" so we match numeric percentages
    // like "(52%)" specifically.
    expect(container.textContent).not.toMatch(/\(\d+%\)/);
  });

  it('computes percentages from dimension totals, not total_members', () => {
    // Female=65 + Male=71 = 136 total for gender dimension.
    // total_members=450 (from mockStatsResult) is intentionally different
    // to prove we use the dimension sum, not total_members.
    // Expected: Female 65/136 = 48%, Male 71/136 = 52%
    const resultWithBreakdown: SpatialStatsResult = {
      ...mockStatsResult,
      breakdown: {
        '2|adult': {
          count: 65,
          statistics: {},
          labels: {
            gender: { value: '2', display: 'Female' },
            age_group: { value: 'adult', display: 'Adult (18-59)' },
          },
        },
        '1|adult': {
          count: 71,
          statistics: {},
          labels: {
            gender: { value: '1', display: 'Male' },
            age_group: { value: 'adult', display: 'Adult (18-59)' },
          },
        },
      },
    };
    const store = buildStore({
      status: 'success',
      result: resultWithBreakdown,
      selectedLayerTitle: 'Test Layer',
    });
    const { container } = render(
      <Provider store={store}>
        <OpensppStatisticsPanel />
      </Provider>,
    );
    // Percentages should be based on 65+71=136, not total_members=450
    expect(container.textContent).toContain('65 (48%)');
    expect(container.textContent).toContain('71 (52%)');
    // Verify NOT using total_members (65/450=14%, 71/450=16%)
    expect(container.textContent).not.toContain('14%');
    expect(container.textContent).not.toContain('16%');
  });
});
