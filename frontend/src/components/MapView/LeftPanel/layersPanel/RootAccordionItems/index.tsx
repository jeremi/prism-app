import { LayersCategoryType, MenuItemType } from 'config/types';
import { memo, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useLayers from 'utils/layers-utils';
import { useMapState } from 'utils/useMapState';
import { appConfig } from 'config';
import { registerDynamicLayer } from 'config/utils';
import {
  opensppCollectionsSelector,
  opensppCollectionsLoadingSelector,
  fetchOpenSPPCollections,
} from 'context/opensppStateSlice';
import type { CollectionInfo } from 'utils/openspp-types';
import MenuItem from '../MenuItem';
import { getDynamicMenuList } from '../../utils';

function collectionToLayer(collection: CollectionInfo) {
  const layerId = `openspp_${collection.id}`;
  return {
    id: layerId,
    type: 'openspp_report' as const,
    title: collection.title,
    collectionId: collection.id,
    dataField: 'value',
    opacity: 0.7,
    legend: [],
    legendText: collection.description || collection.title,
  };
}

const RootAccordionItems = memo(() => {
  const dispatch = useDispatch();
  const { adminBoundariesExtent: extent } = useLayers();
  const mapState = useMapState();
  const selectedLayers = mapState.layers;

  const isOpenSPPEnabled = !!appConfig.openspp?.enabled;
  const collections = useSelector(opensppCollectionsSelector);
  const collectionsLoading = useSelector(opensppCollectionsLoadingSelector);

  // Fetch OpenSPP collections on mount if enabled
  useEffect(() => {
    if (isOpenSPPEnabled && collections.length === 0 && !collectionsLoading) {
      dispatch(fetchOpenSPPCollections() as any);
    }
  }, [dispatch, isOpenSPPEnabled, collections.length, collectionsLoading]);

  const menuList = useMemo(
    () => getDynamicMenuList(selectedLayers),
    [selectedLayers],
  );

  const layersMenuItems = useMemo(
    () =>
      menuList.filter((menuItem: MenuItemType) =>
        menuItem.layersCategories.some(
          (layerCategory: LayersCategoryType) =>
            layerCategory.layers.length > 0,
        ),
      ),
    [menuList],
  );

  // Convert collections to layer objects (pure computation)
  const opensppLayers = useMemo(
    () =>
      isOpenSPPEnabled && collections.length > 0
        ? collections.map(collectionToLayer)
        : [],
    [isOpenSPPEnabled, collections],
  );

  // Register dynamic layers as a side effect
  useEffect(() => {
    opensppLayers.forEach(layer => {
      registerDynamicLayer(layer.id, layer as any);
    });
  }, [opensppLayers]);

  // Build menu item from layers (pure computation)
  const opensppMenuItem = useMemo(() => {
    if (opensppLayers.length === 0) {
      return null;
    }
    return {
      title: 'OpenSPP Reports',
      layersCategories: [
        {
          title: 'Collections',
          layers: opensppLayers as any[],
          tables: [],
        },
      ],
    };
  }, [opensppLayers]);

  return (
    <>
      {layersMenuItems.map((menuItem: MenuItemType) => (
        <MenuItem
          key={menuItem.title}
          title={menuItem.title}
          layersCategories={menuItem.layersCategories}
          extent={extent}
        />
      ))}
      {opensppMenuItem && (
        <MenuItem
          key={opensppMenuItem.title}
          title={opensppMenuItem.title}
          layersCategories={opensppMenuItem.layersCategories}
          extent={extent}
        />
      )}
    </>
  );
});

export default RootAccordionItems;
