/**
 * Layer data loader for OpenSPP report collections.
 * Fetches GeoJSON via the authenticated OpenSPP GIS API.
 */
import { OpenSPPReportLayerProps } from 'config/types';
import { getCollectionItems } from 'utils/openspp-api';
import type { LazyLoader } from './layer-data';

export const fetchOpenSPPReportLayerData: LazyLoader<OpenSPPReportLayerProps> =
  () =>
  async ({ layer }) => {
    const data = await getCollectionItems(layer.collectionId, {
      limit: 10000,
    });
    return data;
  };
