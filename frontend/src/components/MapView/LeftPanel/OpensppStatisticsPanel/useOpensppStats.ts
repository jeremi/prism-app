import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import simplify from '@turf/simplify';
import {
  polygon as turfPolygon,
  multiPolygon as turfMultiPolygon,
} from '@turf/helpers';
import {
  opensppStatsSelector,
  setStatsResult,
  setStatsError,
  setJobId,
} from 'context/opensppStatsSlice';
import { OPENSPP_API_URL } from 'utils/constants';

const DEBOUNCE_MS = 500;
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 15000;
const SIMPLIFY_TOLERANCE = 0.001;

function simplifyGeometry(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
  try {
    if (geometry.type === 'Polygon') {
      const simplified = simplify(turfPolygon(geometry.coordinates), {
        tolerance: SIMPLIFY_TOLERANCE,
        highQuality: false,
      });
      return simplified.geometry;
    }
    if (geometry.type === 'MultiPolygon') {
      const simplified = simplify(turfMultiPolygon(geometry.coordinates), {
        tolerance: SIMPLIFY_TOLERANCE,
        highQuality: false,
      });
      return simplified.geometry;
    }
  } catch {
    // If simplification fails, use original geometry
  }
  return geometry;
}

export function useOpensppStats(): void {
  const dispatch = useDispatch();
  const { selectedGeometry, status } = useSelector(opensppStatsSelector);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };

    if (!selectedGeometry || status !== 'loading') {
      cleanup();
      return cleanup;
    }

    // Debounce the API call
    debounceRef.current = setTimeout(() => {
      const abortController = new AbortController();
      abortRef.current = abortController;
      const startTime = Date.now();

      // Set hard timeout
      timeoutRef.current = setTimeout(() => {
        abortController.abort();
        dispatch(
          setStatsError(
            'Could not load statistics. Try a smaller area or retry.',
          ),
        );
      }, TIMEOUT_MS);

      const simplifiedGeometry = simplifyGeometry(selectedGeometry);

      const fetchStats = async () => {
        try {
          const response = await fetch(
            `${OPENSPP_API_URL}/spatial-statistics`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inputs: {
                  geometry: simplifiedGeometry,
                  group_by: ['gender', 'age_group'],
                },
              }),
              signal: abortController.signal,
            },
          );

          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }

          const data = await response.json();

          // Check if async (job_id returned)
          if (data.job_id) {
            dispatch(setJobId(data.job_id));
            await pollJob(data.job_id, abortController, startTime);
            return;
          }

          // Synchronous result
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          dispatch(setStatsResult(data));
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return; // Cancelled, do nothing
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          dispatch(
            setStatsError(
              'Could not load statistics. Try a smaller area or retry.',
            ),
          );
        }
      };

      const pollJob = async (
        jobId: string,
        controller: AbortController,
        start: number,
      ) => {
        const poll = async (): Promise<void> => {
          if (controller.signal.aborted) {
            return;
          }

          const elapsed = Date.now() - start;
          if (elapsed >= TIMEOUT_MS) {
            dispatch(
              setStatsError(
                'Could not load statistics. Try a smaller area or retry.',
              ),
            );
            return;
          }

          try {
            const response = await fetch(`${OPENSPP_API_URL}/jobs/${jobId}`, {
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(`Job poll error: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'successful' && data.result) {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }
              dispatch(setStatsResult(data.result));
              return;
            }

            if (data.status === 'failed') {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }
              dispatch(
                setStatsError(
                  'Could not load statistics. Try a smaller area or retry.',
                ),
              );
              return;
            }

            // Still running, poll again after interval
            await new Promise<void>(resolve => {
              const timer = setTimeout(resolve, POLL_INTERVAL_MS);
              controller.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                resolve();
              });
            });

            await poll();
          } catch (err: any) {
            if (err.name === 'AbortError') {
              return;
            }
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            dispatch(
              setStatsError(
                'Could not load statistics. Try a smaller area or retry.',
              ),
            );
          }
        };

        await poll();
      };

      fetchStats();
    }, DEBOUNCE_MS);

    return cleanup;
  }, [selectedGeometry, status, dispatch]);
}
