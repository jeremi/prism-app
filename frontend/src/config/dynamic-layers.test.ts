import {
  LayerDefinitions,
  getInvalidLayerIds,
  registerDynamicLayer,
} from './utils';

describe('getInvalidLayerIds', () => {
  const dynamicLayerId = 'openspp_TEST_DYNAMIC_adm0';

  afterEach(() => {
    delete (LayerDefinitions as Record<string, unknown>)[dynamicLayerId];
  });

  it('reports unknown layer ids as invalid', () => {
    expect(getInvalidLayerIds([dynamicLayerId])).toEqual([dynamicLayerId]);
  });

  it('accepts statically configured layer ids', () => {
    const staticId = Object.keys(LayerDefinitions)[0];
    expect(staticId).toBeDefined();
    expect(getInvalidLayerIds([staticId])).toEqual([]);
  });

  it('accepts layers registered at runtime via registerDynamicLayer', () => {
    registerDynamicLayer(dynamicLayerId, {
      id: dynamicLayerId,
      type: 'openspp_report',
      title: 'Test Dynamic Collection',
      collectionId: 'TEST_DYNAMIC_adm0',
      dataField: 'value',
      opacity: 0.7,
      legend: [],
      legendText: 'Test Dynamic Collection',
    } as any);
    expect(getInvalidLayerIds([dynamicLayerId])).toEqual([]);
  });

  it('validates a mixed list, keeping only unknown ids', () => {
    const staticId = Object.keys(LayerDefinitions)[0];
    expect(getInvalidLayerIds([staticId, dynamicLayerId])).toEqual([
      dynamicLayerId,
    ]);
  });
});
