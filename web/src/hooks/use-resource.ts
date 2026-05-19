"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The lifecycle of an async resource: loading → (data | error), retryable. */
export interface ResourceState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** Re-runs the loader (used by "Try again" buttons and after mutations). */
  reload: () => void;
}

interface InternalState<T> {
  /** Identity of the load this snapshot belongs to. */
  key: string;
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/**
 * Loads an async resource with loading / error / retry state.
 *
 * `loader` receives an `AbortSignal` so an in-flight request is cancelled
 * when dependencies change or the component unmounts. Pass the values the
 * loader depends on (e.g. a project id) as `deps`; the resource reloads
 * whenever they change or `reload()` is called.
 *
 * `deps` is serialized with JSON.stringify to build a stable cache key.
 * Pass only primitives — a new object literal each render causes an
 * infinite re-render loop.
 */
export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<string | number | boolean | null | undefined>,
): ResourceState<T> {
  const [reloadCount, setReloadCount] = useState(0);

  // A string identity for the current load: its dependencies plus the
  // reload counter. Using a derived string keeps the effect's dependency
  // list a single stable value.
  const requestKey = `${JSON.stringify(deps)}#${reloadCount}`;

  const [state, setState] = useState<InternalState<T>>({
    key: requestKey,
    data: null,
    error: null,
    loading: true,
  });

  // When the request identity changes, reset to a loading state *during
  // render* — the pattern React recommends over a setState-in-effect.
  if (state.key !== requestKey) {
    setState({ key: requestKey, data: null, error: null, loading: true });
  }

  // Hold the latest loader without making it an effect dependency: callers
  // pass a fresh closure each render, but reloads are driven by `requestKey`.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    const controller = new AbortController();

    loaderRef.current(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setState({
            key: requestKey,
            data: result,
            error: null,
            loading: false,
          });
        }
      },
      (caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setState({
          key: requestKey,
          data: null,
          error:
            caught instanceof Error
              ? caught
              : new Error("Something went wrong."),
          loading: false,
        });
      },
    );

    return () => controller.abort();
  }, [requestKey]);

  const reload = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    reload,
  };
}
